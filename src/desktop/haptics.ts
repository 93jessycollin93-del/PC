/**
 * haptics — one place that decides how the PC *feels*.
 *
 * Every theme already has a look. This gives each family a matching touch:
 * a Win95 button should feel like a mechanical click, a macOS control like a
 * soft tick, an Amiga gadget like a clunk. Callers ask for an intent
 * ("longPress", "select") and never pick a pattern themselves, so adding a
 * theme means adding one row here and nothing else changes.
 *
 * IMPORTANT PLATFORM LIMIT: this rides the Vibration API, which iOS Safari
 * does not implement — on iPhone/iPad these calls are silently no-ops. It
 * works on Android Chrome/Firefox and desktop Chrome with a motor. There is
 * no web API that reaches the iPhone's Taptic Engine from a normal page, so
 * this is a browser gap, not a bug to fix here. Everything degrades quietly:
 * no errors, no visual difference.
 */

export type HapticIntent =
  /** A hold has registered and the menu is about to open. */
  | 'longPress'
  /** A menu entry / button was chosen. */
  | 'select'
  /** A window or app opened. */
  | 'open'
  /** A window closed, or an action was undone/dismissed. */
  | 'close'
  /** A destructive or rejected action. */
  | 'error';

/** How a family of themes feels. Durations in ms; arrays are
 *  vibrate/pause/vibrate patterns, exactly as navigator.vibrate takes. */
interface HapticProfile {
  longPress: number | number[];
  select: number | number[];
  open: number | number[];
  close: number | number[];
  error: number | number[];
}

/**
 * Feel per theme family. Names match the `data-pc-family` attribute the
 * theme system already stamps on the PC scope container, so this map and
 * the CSS stay keyed off the same single source of truth.
 */
const PROFILES: Record<string, HapticProfile> = {
  // Mechanical eras: short, hard, slightly "double" — a real button.
  win9x:     { longPress: [14, 26, 10], select: 10, open: [10, 30, 14], close: 8,  error: [24, 40, 24] },
  win2k:     { longPress: [14, 26, 10], select: 10, open: [10, 30, 14], close: 8,  error: [24, 40, 24] },
  platinum:  { longPress: [12, 24, 12], select: 9,  open: [9, 28, 12],  close: 8,  error: [22, 38, 22] },
  amiga:     { longPress: [18, 30, 18], select: 12, open: [12, 34, 16], close: 10, error: [28, 44, 28] },
  next:      { longPress: [18, 30, 18], select: 12, open: [12, 34, 16], close: 10, error: [28, 44, 28] },
  retro:     { longPress: [16, 28, 14], select: 11, open: [11, 30, 15], close: 9,  error: [26, 42, 26] },

  // Glossy transitional era: softer, single, with a little body.
  winxp:     { longPress: [12, 20, 8],  select: 8,  open: 14, close: 7,  error: [20, 34, 20] },
  aero:      { longPress: 14,           select: 7,  open: 12, close: 6,  error: [18, 30, 18] },

  // Flat/modern: minimal, crisp, one tick.
  metro:     { longPress: 12, select: 6, open: 10, close: 5, error: [16, 28, 16] },
  fluent:    { longPress: 12, select: 6, open: 10, close: 5, error: [16, 28, 16] },
  gnome:     { longPress: 11, select: 6, open: 9,  close: 5, error: [15, 26, 15] },

  // Apple-like: the lightest touch of all.
  traffic:   { longPress: 10, select: 5, open: 8, close: 4, error: [14, 24, 14] },
  mobileos:  { longPress: 10, select: 5, open: 8, close: 4, error: [14, 24, 14] },

  // The default Jackie/cosmic shell: subtle, a little dreamy.
  cosmic:    { longPress: [8, 18, 8], select: 6, open: [6, 20, 10], close: 5, error: [18, 30, 18] },
};

const DEFAULT_PROFILE = PROFILES.cosmic;

/** Users who don't want buzzing get none. Also the switch a Settings
 *  toggle can flip without any caller knowing. */
const ENABLED_KEY = 'pc_haptics_enabled';

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked — fall back to enabled, the default */
  }
}

/**
 * Read the live theme family off the DOM rather than threading React
 * context through every caller. The theme system already stamps this
 * attribute for its CSS, so there is exactly one source of truth.
 */
function currentFamily(): string {
  if (typeof document === 'undefined') return 'cosmic';
  return document.querySelector('[data-pc-family]')?.getAttribute('data-pc-family') || 'cosmic';
}

/**
 * Fire the pattern for an intent in the active theme's voice.
 * Safe to call anywhere: no-ops when unsupported, disabled, or when the
 * user has reduced-motion set (which we treat as "and reduced buzzing").
 */
export function haptic(intent: HapticIntent): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (!hapticsEnabled()) return;
  if (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const profile = PROFILES[currentFamily()] || DEFAULT_PROFILE;
  try {
    navigator.vibrate(profile[intent]);
  } catch {
    /* some browsers throw if the page isn't visible — never worth surfacing */
  }
}

/** Exposed for tests and for a Settings preview ("try this theme's feel"). */
export function patternFor(intent: HapticIntent, family?: string): number | number[] {
  return (PROFILES[family || currentFamily()] || DEFAULT_PROFILE)[intent];
}
