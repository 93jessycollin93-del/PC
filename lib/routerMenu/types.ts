/**
 * The router menu — a nested, numbered prompt manual you can drive by name or
 * by number, with no network and no model.
 *
 * Shape:
 *   MAIN ROUTER  — always reachable, holds every app plus the global verbs.
 *   SUB-ROUTERS  — their own prompt sets, kept COMPRESSED (unloaded) until
 *                  named. Saying "workstation router" swaps the menu to that
 *                  router; "back" recompresses it and returns to main.
 *
 * "Compressed" is literal, not a metaphor: a sub-router's content is behind a
 * dynamic import, so its text is a separate chunk that never enters the main
 * bundle until it is asked for, and the reference is dropped when it closes.
 * A guide nobody opened costs nothing to carry.
 */

import type { BusChannel } from '../bus';

export type EntryKind = 'command' | 'subrouter' | 'guide';

export interface MenuCommand {
  kind: 'command';
  id: string;
  label: string;
  keywords: string[];
  channel: BusChannel;
  payload?: unknown;
  hint?: string;
}

export interface MenuSubRouter {
  kind: 'subrouter';
  id: string;
  label: string;
  keywords: string[];
  hint?: string;
  /** Loads the sub-router on demand. This is the decompression step. */
  load: () => Promise<RouterDefinition>;
}

/** A page of explanatory text. Also lazily loaded — guides are the bulkiest
 *  content here and the least often opened. */
export interface MenuGuide {
  kind: 'guide';
  id: string;
  label: string;
  keywords: string[];
  hint?: string;
  load: () => Promise<GuideContent>;
}

export type MenuEntry = MenuCommand | MenuSubRouter | MenuGuide;

export interface GuideSection {
  heading: string;
  body: string[];
}

export interface GuideContent {
  title: string;
  /** One line stating what the reader will be able to do afterwards. */
  purpose: string;
  sections: GuideSection[];
}

export interface RouterDefinition {
  id: string;
  /** Shown as the menu's title, so it is always obvious which router is open. */
  title: string;
  /** One line on what this router is for. */
  purpose: string;
  entries: MenuEntry[];
}

/** An entry paired with its position, so "7" selects the seventh. */
export interface NumberedEntry {
  index: number;
  entry: MenuEntry;
}

export function numberEntries(entries: readonly MenuEntry[]): NumberedEntry[] {
  return entries.map((entry, i) => ({ index: i + 1, entry }));
}

/**
 * Resolve typed input against a router.
 *
 * Accepts a number ("7"), an exact label, or keyword text. Numbers are checked
 * first and only when the whole input is digits — otherwise a query like
 * "5 minute timer" would select entry 5 instead of searching, which is the
 * kind of surprise that makes people stop trusting the box.
 */
export function resolveInput(
  input: string,
  entries: readonly MenuEntry[]
): MenuEntry | undefined {
  const text = input.trim();
  if (!text) return undefined;

  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n >= 1 && n <= entries.length ? entries[n - 1] : undefined;
  }

  const lower = text.toLowerCase();
  const exact = entries.find(e => e.label.toLowerCase() === lower);
  if (exact) return exact;
  const byKeyword = entries.find(e => e.keywords.some(k => k.toLowerCase() === lower));
  if (byKeyword) return byKeyword;
  return entries.find(e => e.label.toLowerCase().includes(lower));
}

/** Score an entry for ranked search; -1 means no match. */
export function scoreEntry(query: string, entry: MenuEntry): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const label = entry.label.toLowerCase();
  if (label === q) return 2000;
  if (label.startsWith(q)) return 1000 - label.length;
  if (label.includes(q)) return 500 - label.indexOf(q);
  let best = -1;
  for (const kw of entry.keywords) {
    const k = kw.toLowerCase();
    if (k === q) best = Math.max(best, 400);
    else if (k.startsWith(q)) best = Math.max(best, 300 - k.length);
    else if (k.includes(q)) best = Math.max(best, 200 - k.indexOf(q));
  }
  return best;
}

/** Empty query returns everything, so the menu is browsable rather than a
 *  guessing game. */
export function searchEntries(
  query: string,
  entries: readonly MenuEntry[]
): MenuEntry[] {
  if (!query.trim()) return [...entries];
  if (/^\d+$/.test(query.trim())) {
    const hit = resolveInput(query, entries);
    return hit ? [hit] : [];
  }
  return entries
    .map(entry => ({ entry, score: scoreEntry(query, entry) }))
    .filter(r => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.entry);
}

/** Words that always mean "leave the current router". */
export const BACK_WORDS = ['back', 'exit', 'close', 'up', 'main', 'home', 'pc', 'jackie'];

export function isBackWord(input: string): boolean {
  return BACK_WORDS.includes(input.trim().toLowerCase());
}
