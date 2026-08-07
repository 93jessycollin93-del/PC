/**
 * Build the PC as an embeddable sub-path app, for Jackie's `public/pc-os/`.
 *
 * Jackie (`sasjacky777`) serves the whole PC build under `/pc-os/` and frames
 * it at `/pc` via `PCDesktop.tsx`. That only works if the build knows it lives
 * under a sub-path, so this sets `--base=/pc-os/` rather than the default `/`.
 *
 * It exists because the embed drifted: the copy in Jackie was built before
 * Tailwind moved from the CDN into the bundle, so it shipped a 1.2 kB
 * stylesheet and depended on reaching cdn.tailwindcss.com. Refreshing it by
 * hand is what let that happen, so refreshing it is one command now.
 *
 *   npm run build:pc-os
 *   cp -a dist/. <jackie>/public/pc-os/
 *
 * `sw.js` and `index.tsx` are already sub-path aware (scope-relative caching,
 * `import.meta.env.BASE_URL` for registration), so the only thing the build
 * cannot get right on its own is the web manifest, patched below.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = '/pc-os/';

execFileSync('npx', ['vite', 'build', `--base=${BASE}`], { stdio: 'inherit' });

// Vite rewrites asset URLs for the base, but public/manifest.json is copied
// verbatim. Left alone, `start_url: "/"` means installing the PC from its own
// tab launches Jackie's root instead of the PC.
const path = 'dist/manifest.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));
manifest.start_url = BASE;
manifest.scope = BASE;
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\nEmbed built for ${BASE} — manifest start_url/scope patched.`);
console.log('Copy dist/ (including .vite/manifest.json) to <jackie>/public/pc-os/.');
