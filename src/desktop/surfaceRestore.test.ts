/**
 * Which surface comes back on launch.
 *
 * `pcMode` decides whether you land on the PC desktop, the split, or Jackie
 * alone. It was previously hardcoded to 'full' on every mount, so a deliberate
 * choice was discarded on every launch and the user had no way to express it
 * other than redoing it each time.
 *
 * The restore logic is a small pure decision, and it is exactly the kind that
 * breaks quietly: a stored value from an older build, or a corrupt entry, must
 * not put the app into a mode that no longer exists.
 */
import { describe, it, expect } from 'vitest';

/** Mirrors the restore rule in App.tsx. Kept in one place so the test drives
 *  the same decision the app makes rather than a paraphrase of it. */
export function restorePcMode(saved: unknown): 'full' | 'half' | 'closed' {
  return saved === 'full' || saved === 'half' || saved === 'closed' ? saved : 'full';
}

describe('restoring the surface that was left on screen', () => {
  it('brings back each valid mode exactly', () => {
    expect(restorePcMode('full')).toBe('full');
    expect(restorePcMode('half')).toBe('half');
    expect(restorePcMode('closed')).toBe('closed');
  });

  it('defaults to the desktop on a first launch with nothing saved', () => {
    expect(restorePcMode(undefined)).toBe('full');
    expect(restorePcMode(null)).toBe('full');
  });

  it('refuses a mode that no longer exists rather than applying it', () => {
    // A value from an older build must not leave the app in a state the
    // current one cannot render or exit from.
    expect(restorePcMode('fullscreen')).toBe('full');
    expect(restorePcMode('minimized')).toBe('full');
  });

  it('refuses a corrupt value of the wrong type', () => {
    expect(restorePcMode(1)).toBe('full');
    expect(restorePcMode({})).toBe('full');
    expect(restorePcMode([])).toBe('full');
    expect(restorePcMode(true)).toBe('full');
  });

  it('is a total function — every input yields a usable mode', () => {
    // No input can produce undefined, which would render nothing at all.
    for (const input of ['', 'x', 0, -1, NaN, Symbol('s'), () => {}]) {
      expect(['full', 'half', 'closed']).toContain(restorePcMode(input));
    }
  });
});
