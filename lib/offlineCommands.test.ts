/**
 * The offline command catalog.
 *
 * These assert the OUTCOME a user gets (which commands come back, in what
 * order, and that the catalog stays reachable with no network) rather than
 * that some matcher was consulted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  OFFLINE_COMMANDS,
  searchCommands,
  scoreCommand,
  groupByCategory,
  listCategories,
} from './offlineCommands';

describe('offline command catalog', () => {
  it('returns the WHOLE catalog for an empty query so the menu is browsable', () => {
    // The bug this guards: a palette that shows nothing until you type is only
    // usable by someone who already knows the answer.
    expect(searchCommands('')).toHaveLength(OFFLINE_COMMANDS.length);
    expect(searchCommands('   ')).toHaveLength(OFFLINE_COMMANDS.length);
  });

  it('finds a way out when the user types how they actually feel', () => {
    // "get out" is a keyword precisely because it is what someone types when
    // they are lost and no label uses those words.
    const labels = searchCommands('get out').map(c => c.label);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some(l => /close|desktop/i.test(l))).toBe(true);
  });

  it('surfaces diagnostics for a plain-language failure question', () => {
    const ids = searchCommands('why is this broken').map(c => c.id);
    expect(ids).toContain('open-app_health_monitor');
  });

  it('ranks an exact label above a mere keyword hit', () => {
    const open = OFFLINE_COMMANDS.find(c => c.id === 'open-mail')!;
    expect(scoreCommand('open mail', open)).toBeGreaterThan(scoreCommand('email', open));
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchCommands('zzzznotacommand')).toHaveLength(0);
  });

  it('groups the catalog without losing or duplicating any command', () => {
    const groups = groupByCategory();
    const total = groups.reduce((n, g) => n + g.commands.length, 0);
    expect(total).toBe(OFFLINE_COMMANDS.length);
    expect(listCategories().length).toBe(groups.length);
  });

  it('gives every command a unique id', () => {
    const ids = OFFLINE_COMMANDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds the theme system by the OS name a user would search for', () => {
    expect(searchCommands('windows 95').map(c => c.id)).toContain('open-pc_themes');
  });

  it('every command carries a bus channel, so nothing in the menu is a dead end', () => {
    // A menu entry that looks clickable but does nothing is the exact defect
    // class the disconnected-UI audit found elsewhere in this app.
    for (const command of OFFLINE_COMMANDS) {
      expect(command.channel).toBeTruthy();
      expect(command.label.length).toBeGreaterThan(0);
    }
  });
});

describe('every command points at something real', () => {
  // The bug this guards: 13 of the original catalog entries used invented
  // appIds ('files', 'health', 'storage'…) that no dispatch branch handles,
  // so they rendered as clickable menu items that opened nothing. A menu of
  // dead ends is worse than no menu, and it is invisible without this check.
  const APP_TSX = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const TYPES = readFileSync(new URL('../types.ts', import.meta.url), 'utf8');

  const dispatchable = new Set<string>([
    ...[...APP_TSX.matchAll(/appId === '([a-z_0-9]+)'/g)].map(m => m[1]),
    ...[...(TYPES.match(/export type AppId[^;]+;/)?.[0] ?? '').matchAll(/'([a-z_0-9]+)'/g)].map(
      m => m[1]
    ),
  ]);

  it('resolves every launch-app command to an appId the OS can actually open', () => {
    const unresolved = OFFLINE_COMMANDS.filter(c => {
      if (c.channel !== 'launch-app') return false;
      const appId = (c.payload as { appId?: string } | undefined)?.appId;
      return !appId || !dispatchable.has(appId);
    }).map(c => c.id);

    expect(unresolved).toEqual([]);
  });

  it('found a non-trivial number of dispatchable apps (guards a broken scrape)', () => {
    // If the regex above ever stops matching, the test above would pass
    // vacuously. This makes that failure loud instead of silent.
    expect(dispatchable.size).toBeGreaterThan(30);
  });
});
