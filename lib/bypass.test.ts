/**
 * The bypass: seeing it, and keeping it true.
 *
 * The second describe block is the important one. It is a structural test over
 * the real source tree, and it is what stops the architecture drifting: the
 * moment one app imports another, they stop being independently openable and
 * the "everything off except one or two" property quietly dies. Nothing else
 * in the suite would notice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { bypass } from './bypass';
import { bus } from './bus';

describe('the bypass records what travels', () => {
  beforeEach(() => bypass.reset());

  it('counts an emit even when not recording', () => {
    // Counting is always on; only the per-message trace is opt-in, so the
    // panel is useful the moment it opens rather than after a restart.
    bus.emit('refresh-desktop');
    expect(bypass.channels().find(c => c.channel === 'refresh-desktop')?.emitted).toBe(1);
  });

  it('keeps a trace only while recording', () => {
    bus.emit('refresh-desktop');
    expect(bypass.recent()).toHaveLength(0);
    bypass.start();
    bus.emit('refresh-desktop');
    expect(bypass.recent()).toHaveLength(1);
  });

  it('describes a payload WITHOUT retaining it', () => {
    // Messages can carry secrets; a debug panel is a bad place for them.
    bypass.start();
    bus.emit('launch-app', { appId: 'mail' });
    const [event] = bypass.recent();
    expect(event.shape).toBe('{appId}');
    expect(JSON.stringify(event)).not.toContain('mail');
  });

  it('tracks listeners as they come and go', () => {
    const off = bus.on('refresh-desktop', () => {});
    expect(bypass.channels().find(c => c.channel === 'refresh-desktop')?.listeners).toBe(1);
    off();
    expect(bypass.channels().find(c => c.channel === 'refresh-desktop')?.listeners).toBe(0);
  });

  it('never lets the listener count go negative', () => {
    const off = bus.on('refresh-desktop', () => {});
    off();
    off();
    expect(bypass.channels().find(c => c.channel === 'refresh-desktop')?.listeners).toBe(0);
  });

  it('flags a channel that fired with nobody listening', () => {
    bus.emit('refresh-desktop');
    expect(bypass.unheardChannels()).toContain('refresh-desktop');
  });

  it('flags a channel wired up but never used', () => {
    const off = bus.on('voice-error', () => {});
    expect(bypass.silentChannels()).toContain('voice-error');
    off();
  });

  it('bounds the trace so a long session cannot grow without limit', () => {
    bypass.start();
    for (let i = 0; i < 400; i++) bus.emit('refresh-desktop');
    expect(bypass.recent(1000).length).toBeLessThanOrEqual(200);
  });

  it('keeps the most RECENT events when it trims', () => {
    bypass.start();
    for (let i = 0; i < 250; i++) bus.emit('refresh-desktop');
    bus.emit('launch-app', { appId: 'x' });
    expect(bypass.recent()[0].channel).toBe('launch-app');
  });
});

describe('no app imports another — the bypass stays true', () => {
  const appsDir = fileURLToPath(new URL('../components/apps', import.meta.url));
  const files = readdirSync(appsDir).filter(f => f.endsWith('.tsx'));

  // An "app" is a component App.tsx dispatches behind an appId — derived
  // rather than assumed, because components/apps also holds shell pieces
  // (backgrounds, the folder view, the simulator) that are legitimately
  // shared. Treating those as apps would flag correct code and train someone
  // to ignore the check, which is worse than not having it.
  const APP_TSX = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
  const dispatched = new Set<string>(
    [...APP_TSX.matchAll(/appId === '[a-z_0-9]+'\)[^<]*<([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1])
  );
  const appFiles = files.filter(f => dispatched.has(f.replace('.tsx', '')));

  it('found the app directory (a broken scan must not pass silently)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('identified the real apps from the dispatch, not just the folder', () => {
    // If this ever collapses to zero the coupling test below would pass
    // vacuously, so the count is asserted directly.
    expect(appFiles.length).toBeGreaterThan(20);
  });

  it('no app imports another app directly', () => {
    // Direct coupling is what would make one app require another to load,
    // undoing the property that any single app can open on its own.
    const offenders: string[] = [];
    for (const file of appFiles) {
      const source = readFileSync(join(appsDir, file), 'utf8');
      for (const m of source.matchAll(/^import[^;]*?from\s+'\.\/([A-Za-z0-9_]+)'/gm)) {
        const target = `${m[1]}.tsx`;
        // A shared, non-app module in the same folder is fine; another APP is not.
        if (appFiles.includes(target) && target !== file) {
          offenders.push(`${file} -> ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('apps talk over the bus rather than reaching for each other', () => {
    // Positive evidence, not just absence: the spine is actually used.
    let usingBus = 0;
    for (const file of files) {
      const source = readFileSync(join(appsDir, file), 'utf8');
      if (/from '\.\.\/\.\.\/lib\/bus'|from '\.\.\/lib\/bus'/.test(source)) usingBus++;
    }
    expect(usingBus).toBeGreaterThan(0);
  });
});
