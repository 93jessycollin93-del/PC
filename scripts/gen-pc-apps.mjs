/**
 * Generate the PC's app roster as a TypeScript module for embedding shells.
 *
 * Jackie's left menu deep-links into the embedded PC with `/pc?app=<id>`. That
 * menu was written by hand, and it drifted: it pointed at `unreal` when the PC
 * calls it `unreal_engine`, at a `folder` app that has never existed, and it
 * reached only 38 of the PC's 90 apps. Generating the list from the PC's own
 * desktop items is what stops a link from going dead when an app is renamed.
 *
 *   npm run gen:pc-apps -- <path/to/pcApps.ts>
 *
 * The PC resolves `?app=` against `item.id` OR `item.appId`, recursing into
 * folders (see the deep-link effect in App.tsx), so both are valid targets.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SOURCE = 'App.tsx';
const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/gen-pc-apps.mjs <path/to/pcApps.ts>');
  process.exit(1);
}

const src = readFileSync(SOURCE, 'utf8');

// Anchor on the array itself, not the `DesktopItem[]` type annotation before it.
const declIdx = src.indexOf('const INITIAL_DESKTOP_ITEMS');
if (declIdx === -1) throw new Error(`INITIAL_DESKTOP_ITEMS not found in ${SOURCE}`);
const arrayStart = src.indexOf('[', src.indexOf('=', declIdx));

/**
 * Collect every object literal in the array, at any nesting depth so items
 * inside folders are seen too. Strings and comments are skipped: entries carry
 * template literals of notepad content that contain unbalanced braces, and a
 * naive brace count walks straight off the end because of them.
 */
function objectLiterals(s, start) {
  const found = [];
  const stack = [];
  let depth = 0;
  for (let j = start; j < s.length; j++) {
    const c = s[j];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      j++;
      while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === quote) break;
        j++;
      }
    } else if (c === '/' && s[j + 1] === '/') {
      j = s.indexOf('\n', j);
    } else if (c === '/' && s[j + 1] === '*') {
      j = s.indexOf('*/', j) + 1;
    } else if (c === '{') {
      depth++; stack.push(j);
    } else if (c === '[') {
      depth++;
    } else if (c === '}') {
      found.push(s.slice(stack.pop(), j + 1));
      if (--depth === 0) return found;
    } else if (c === ']') {
      if (--depth === 0) return found;
    }
  }
  return found;
}

const field = (o, name) => {
  const m =
    o.match(new RegExp(`\\b${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`)) ||
    o.match(new RegExp(`\\b${name}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1] : null;
};

const apps = [];
const folders = [];
for (const o of objectLiterals(src, arrayStart)) {
  const type = field(o, 'type');
  if (type === 'app') {
    apps.push({ id: field(o, 'id'), name: field(o, 'name'), appId: field(o, 'appId'), featured: o.includes('featured: true') });
  } else if (type === 'folder') {
    folders.push({ appId: field(o, 'id'), name: field(o, 'name') });
  }
}

// Several desktop items share one appId (the notepad docs), and the PC opens
// the first match, so one entry per appId is what the library should offer.
const unique = [];
const seen = new Set();
for (const a of apps) {
  if (!a.appId || !a.name || seen.has(a.appId)) continue;
  seen.add(a.appId);
  unique.push(a);
}
unique.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

if (unique.length === 0) throw new Error('parsed no apps — the desktop item shape probably changed');

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const body = `/**
 * The PC's app roster, as reachable deep links.
 *
 * The PC ships whole under /public/pc-os/ and is framed by /pc (PCDesktop).
 * It resolves \`?app=<id>\` against its own desktop items on boot, matching
 * either the item id or its appId — which is what lets Jackie open the PC
 * directly on one tool instead of dropping you on the desktop to hunt.
 *
 * GENERATED from the PC's INITIAL_DESKTOP_ITEMS by \`npm run gen:pc-apps\` in
 * the PC repo. Do not hand-edit — the hand-written menu this replaces had
 * drifted into dead links, which is the failure mode generating it prevents.
 */

export interface PcApp {
  /** Value passed as ?app= — the PC matches this against appId or item id. */
  appId: string;
  /** Label as the PC itself names it. */
  name: string;
  /** Surfaced first in the library. */
  featured?: boolean;
}

export const PC_APPS: PcApp[] = [
${unique.map((a) => `  { appId: "${esc(a.appId)}", name: "${esc(a.name)}"${a.featured ? ', featured: true' : ''} },`).join('\n')}
];

/** Folders on the PC desktop, also addressable via ?app=<id>. */
export const PC_FOLDERS: PcApp[] = [
${folders.map((f) => `  { appId: "${esc(f.appId)}", name: "${esc(f.name)}" },`).join('\n')}
];

/** Deep link into the embedded PC for a given app id. */
export const pcAppHref = (appId: string) => \`/pc?app=\${encodeURIComponent(appId)}\`;
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, body);
console.log(`Wrote ${unique.length} apps and ${folders.length} folders to ${out}`);
