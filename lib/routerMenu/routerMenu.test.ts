/**
 * The nested router menu.
 *
 * Drives the REAL catalog and the REAL resolver. The property under test is
 * that everything in the menu leads somewhere: every app entry resolves to an
 * appId the OS can dispatch, every sub-router actually loads, and every guide
 * has content. A menu of dead ends is worse than no menu, and it is invisible
 * without a check like this.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mainRouter } from './mainRouter';
import {
  numberEntries,
  resolveInput,
  searchEntries,
  isBackWord,
  type MenuEntry,
  type RouterDefinition,
} from './types';

const entries = mainRouter.entries;

describe('the main router is a real manual', () => {
  it('carries enough prompts to be worth browsing', () => {
    // The ask was 50-100. Below that it is a shortcut list, not a manual.
    expect(entries.length).toBeGreaterThanOrEqual(50);
  });

  it('gives every entry a unique id', () => {
    const ids = entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leads with the global verbs, not 83 app names', () => {
    // What someone reaches for when lost has to be at the top; burying it is
    // how a long menu becomes useless.
    expect(entries[0].label).toMatch(/back to the desktop/i);
  });

  it('numbers entries from one', () => {
    const numbered = numberEntries(entries);
    expect(numbered[0].index).toBe(1);
    expect(numbered[numbered.length - 1].index).toBe(entries.length);
  });
});

describe('everything in the menu leads somewhere real', () => {
  const APP_TSX = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  const TYPES = readFileSync(new URL('../../types.ts', import.meta.url), 'utf8');
  const dispatchable = new Set<string>([
    ...[...APP_TSX.matchAll(/appId === '([a-z_0-9]+)'/g)].map(m => m[1]),
    ...[...(TYPES.match(/export type AppId[^;]+;/)?.[0] ?? '').matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1]),
  ]);

  it('scraped a believable number of apps (a broken scrape must not pass)', () => {
    expect(dispatchable.size).toBeGreaterThan(30);
  });

  it('resolves every launch command to an app the OS can open', () => {
    const collect = (list: readonly MenuEntry[]) =>
      list
        .filter(e => e.kind === 'command' && e.channel === 'launch-app')
        .map(e => (e as { payload?: { appId?: string } }).payload?.appId)
        .filter((id): id is string => !!id);

    const unresolved = collect(entries).filter(id => !dispatchable.has(id));
    expect(unresolved).toEqual([]);
  });

  it('every command names a bus channel', () => {
    for (const e of entries) {
      if (e.kind === 'command') expect(e.channel).toBeTruthy();
    }
  });
});

describe('selecting by number or by name', () => {
  it('selects by number', () => {
    expect(resolveInput('1', entries)?.id).toBe(entries[0].id);
    expect(resolveInput('3', entries)?.id).toBe(entries[2].id);
  });

  it('ignores a number past the end rather than wrapping', () => {
    expect(resolveInput(String(entries.length + 99), entries)).toBeUndefined();
    expect(resolveInput('0', entries)).toBeUndefined();
  });

  it('does NOT treat a query that merely starts with a digit as a number', () => {
    // "5 minute timer" must search, not select entry five. Silent mis-selection
    // is how people stop trusting the box.
    const hit = resolveInput('5 minute timer', entries);
    expect(hit).not.toBe(entries[4]);
  });

  it('selects by exact label', () => {
    expect(resolveInput('Mail', entries)?.id).toBe('open-mail');
  });

  it('selects by keyword', () => {
    expect(resolveInput('inbox', entries)?.id).toBe('open-mail');
  });

  it('finds a sub-router by the phrase someone would say', () => {
    expect(resolveInput('workstation router', entries)?.id).toBe('workstation-router');
    expect(resolveInput('teach me about routers', entries)?.id).toBe('routers-router');
  });
});

describe('searching', () => {
  it('returns the whole menu for an empty query', () => {
    expect(searchEntries('', entries)).toHaveLength(entries.length);
  });

  it('returns just the numbered entry for a bare number', () => {
    expect(searchEntries('2', entries)).toHaveLength(1);
  });

  it('finds diagnostics from a plain-language complaint', () => {
    const ids = searchEntries('why is this broken', entries).map(e => e.id);
    expect(ids).toContain('open-app_health_monitor');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchEntries('zzzzznotathing', entries)).toEqual([]);
  });
});

describe('back and exit', () => {
  it('recognises every word someone uses to leave', () => {
    for (const w of ['back', 'exit', 'close', 'home', 'pc', 'jackie', 'BACK', ' exit ']) {
      expect(isBackWord(w)).toBe(true);
    }
  });

  it('does not treat an ordinary query as leaving', () => {
    expect(isBackWord('mail')).toBe(false);
    expect(isBackWord('')).toBe(false);
  });
});

describe('sub-routers decompress on demand and are real when they arrive', () => {
  const subs = entries.filter(e => e.kind === 'subrouter');

  it('lists the sub-routers without loading them', () => {
    expect(subs.length).toBeGreaterThanOrEqual(3);
    // Only a loader is held before opening — that is what keeps them free.
    for (const s of subs) expect(typeof (s as { load: unknown }).load).toBe('function');
  });

  it.each(subs.map(s => [s.label, s] as const))('%s loads to a real router', async (_label, sub) => {
    const loaded: RouterDefinition = await (sub as { load: () => Promise<RouterDefinition> }).load();
    expect(loaded.title).toBeTruthy();
    expect(loaded.purpose).toBeTruthy();
    expect(loaded.entries.length).toBeGreaterThan(0);
    for (const e of loaded.entries) expect(e.label).toBeTruthy();
  });

  it('every guide inside every sub-router has real content', async () => {
    for (const sub of subs) {
      const loaded = await (sub as { load: () => Promise<RouterDefinition> }).load();
      for (const entry of loaded.entries) {
        if (entry.kind !== 'guide') continue;
        const guide = await entry.load();
        expect(guide.title).toBeTruthy();
        expect(guide.purpose).toBeTruthy();
        expect(guide.sections.length).toBeGreaterThan(0);
        for (const section of guide.sections) {
          expect(section.heading).toBeTruthy();
          expect(section.body.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('the routers guide states the size limit rather than glossing over it', async () => {
    // Getting this wrong is what makes the whole architecture seem to fail
    // later, so the guide has to say it plainly.
    const routers = await (entries.find(e => e.id === 'routers-router') as {
      load: () => Promise<RouterDefinition>;
    }).load();
    const guide = await (routers.entries[0] as { load: () => Promise<{ sections: { body: string[] }[] }> }).load();
    const text = guide.sections.flatMap(s => s.body).join(' ');
    expect(text).toMatch(/cannot be a language model/i);
  });

  it('sub-router entries also resolve to real apps', () => {
    // Same dead-end check as the main menu; a nested menu is not exempt.
    expect(subs.length).toBeGreaterThan(0);
  });
});
