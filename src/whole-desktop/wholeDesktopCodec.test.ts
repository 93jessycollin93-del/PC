import { describe, it, expect } from 'vitest';
import { sealWholeDesktop, unsealWholeDesktop, WHOLE_DESKTOP_FORMAT, WHOLE_DESKTOP_VERSION } from './wholeDesktopCodec';
import type { WholeDesktopSnapshot } from './wholeDesktopSnapshot';

const sample = (): WholeDesktopSnapshot => ({
  v: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  desktopItems: [
    { id: 'a', name: 'Mail', type: 'app', iconName: 'Globe', appId: 'mail' },
    { id: 'user-folder-1', name: 'My Folder', type: 'folder', iconName: 'Folder', contents: [] },
  ],
  desktopVisibility: { a: true, 'user-folder-1': false },
  wallpaperUrl: 'data:image/png;base64,xyz',
  pcTheme: { v: 1, themeId: 'cosmic-jackie', wallpaperByTheme: {} },
  timeTravelLog: '{"v":1,"commits":{},"branches":{},"currentBranchId":"main"}',
});

describe('sealing and unsealing a whole-desktop snapshot', () => {
  it('round-trips deep-equal to the original', async () => {
    const snapshot = sample();
    const file = await sealWholeDesktop(snapshot);
    const result = await unsealWholeDesktop(file);
    expect(result.ok).toBe(true);
    expect(result.snapshot).toEqual(snapshot);
  });

  it('writes a recognizable, versioned envelope', async () => {
    const file = await sealWholeDesktop(sample());
    expect(file.format).toBe(WHOLE_DESKTOP_FORMAT);
    expect(file.version).toBe(WHOLE_DESKTOP_VERSION);
    expect(file.stages).toEqual(['json', 'deflate']);
    expect(typeof file.payloadBase64).toBe('string');
  });

  it('actually compresses — the payload is smaller than the raw JSON for a real-sized snapshot', async () => {
    const big = sample();
    big.desktopItems = Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`, name: `Item ${i}`, type: 'app' as const, iconName: 'Globe', appId: 'mail',
    }));
    const file = await sealWholeDesktop(big);
    expect(file.payloadBase64.length).toBeLessThan(JSON.stringify(big).length);
  });
});

describe('catching a corrupted or tampered export — the actual point of idea #06', () => {
  it('rejects a payload whose bytes were altered after sealing', async () => {
    const file = await sealWholeDesktop(sample());
    const tampered = { ...file, payloadBase64: file.payloadBase64.slice(0, -8) + 'AAAAAAAA' };
    const result = await unsealWholeDesktop(tampered);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a payload whose observerHash was altered after sealing', async () => {
    const file = await sealWholeDesktop(sample());
    const tampered = { ...file, observerHash: '0'.repeat(64) };
    const result = await unsealWholeDesktop(tampered);
    expect(result.ok).toBe(false);
  });

  it('rejects a file with the wrong format string rather than guessing', async () => {
    const result = await unsealWholeDesktop({ format: 'something-else', version: 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a PC whole-desktop export/);
  });

  it('rejects a version newer than this build understands', async () => {
    const file = await sealWholeDesktop(sample());
    const future = { ...file, version: 99 };
    const result = await unsealWholeDesktop(future);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/99/);
  });

  it('rejects garbage input instead of throwing, since the file is user-chosen', async () => {
    expect((await unsealWholeDesktop(null)).ok).toBe(false);
    expect((await unsealWholeDesktop('not an object')).ok).toBe(false);
    expect((await unsealWholeDesktop({})).ok).toBe(false);
  });

  it('rejects an unparseable base64 payload cleanly', async () => {
    const file = await sealWholeDesktop(sample());
    const tampered = { ...file, payloadBase64: '***not base64***' };
    const result = await unsealWholeDesktop(tampered);
    expect(result.ok).toBe(false);
  });
});
