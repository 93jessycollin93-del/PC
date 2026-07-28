import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { haptic, patternFor, hapticsEnabled, setHapticsEnabled } from './haptics';

/** Pretend a given theme family is active, the way the shell stamps it. */
function setFamily(family: string | null) {
  (globalThis as any).document.querySelector = () =>
    family === null ? null : { getAttribute: () => family };
}

/** Capture what the device would have been asked to do. */
function captureVibrate() {
  const calls: (number | number[])[] = [];
  (globalThis as any).navigator.vibrate = (p: number | number[]) => { calls.push(p); return true; };
  return calls;
}

beforeEach(() => {
  localStorage.clear();
  setFamily('cosmic');
  (globalThis as any).window.matchMedia = () => ({ matches: false });
});

afterEach(() => vi.restoreAllMocks());

describe('each theme family has its own feel', () => {
  it('gives a mechanical era a harder, doubled pattern than an Apple-like one', () => {
    // The point of the module: a Win95 button should not feel like a macOS one.
    const win9x = patternFor('longPress', 'win9x');
    const traffic = patternFor('longPress', 'traffic');
    expect(Array.isArray(win9x)).toBe(true);
    expect(win9x).not.toEqual(traffic);
  });

  it('reads the family off the live theme rather than a second registry', () => {
    setFamily('win9x');
    const themed = patternFor('select');
    setFamily('traffic');
    expect(patternFor('select')).not.toEqual(themed);
  });

  it('falls back to the default shell when no theme is stamped', () => {
    setFamily(null);
    expect(patternFor('select')).toEqual(patternFor('select', 'cosmic'));
  });

  it('makes a destructive action feel heavier than an ordinary pick', () => {
    const select = patternFor('select', 'fluent');
    const error = patternFor('error', 'fluent');
    expect(error).not.toEqual(select);
    const weight = (p: number | number[]) =>
      Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
    expect(weight(error)).toBeGreaterThan(weight(select));
  });

  it('has a pattern for every intent in every family it claims to support', () => {
    const families = ['win9x', 'win2k', 'winxp', 'aero', 'metro', 'fluent',
      'traffic', 'gnome', 'platinum', 'amiga', 'next', 'retro', 'mobileos', 'cosmic'];
    const intents = ['longPress', 'select', 'open', 'close', 'error'] as const;
    for (const family of families) {
      for (const intent of intents) {
        expect(patternFor(intent, family), `${family}.${intent}`).toBeDefined();
      }
    }
  });
});

describe('firing', () => {
  it('asks the device to buzz with the active theme pattern', () => {
    setFamily('win9x');
    const calls = captureVibrate();
    haptic('longPress');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(patternFor('longPress', 'win9x'));
  });

  it('stays silent once switched off', () => {
    const calls = captureVibrate();
    setHapticsEnabled(false);
    haptic('select');
    expect(calls).toHaveLength(0);
    expect(hapticsEnabled()).toBe(false);
  });

  it('comes back when switched on again', () => {
    setHapticsEnabled(false);
    setHapticsEnabled(true);
    const calls = captureVibrate();
    haptic('select');
    expect(calls).toHaveLength(1);
  });

  it('is on by default, so the feel is there without configuring anything', () => {
    expect(hapticsEnabled()).toBe(true);
  });

  it('honors reduced motion as reduced buzzing too', () => {
    const calls = captureVibrate();
    (globalThis as any).window.matchMedia = () => ({ matches: true });
    haptic('longPress');
    expect(calls).toHaveLength(0);
  });

  it('does nothing on a device with no vibration support, rather than erroring', () => {
    // iOS Safari is exactly this case, so the no-op path is the common one.
    const nav = (globalThis as any).navigator;
    const saved = nav.vibrate;
    delete nav.vibrate;
    expect(() => haptic('select')).not.toThrow();
    nav.vibrate = saved;
  });

  it('swallows a throwing vibrate, since a buzz failing is never worth an error', () => {
    (globalThis as any).navigator.vibrate = () => { throw new Error('not allowed'); };
    expect(() => haptic('select')).not.toThrow();
  });
});
