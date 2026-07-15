import type { PCThemeDefinition, PCThemeId } from './types';
import { PC_DEFAULT_THEME_ID } from './types';
import { cosmicJackie } from './themes/cosmicJackie';
import { win95 } from './themes/win95';
import { win98 } from './themes/win98';
import { winme } from './themes/winme';
import { win2000 } from './themes/win2000';
import { winxp } from './themes/winxp';
import { winvista } from './themes/winvista';
import { win7 } from './themes/win7';
import { win8 } from './themes/win8';
import { win10 } from './themes/win10';
import { win11 } from './themes/win11';

/**
 * PC Theme Registry — the single source of truth for available themes.
 *
 * Themes are pure-data configs (see types.ts), so a "big update" is just
 * editing/adding files under `themes/` and this list. Order here is the
 * display order in every picker: default first, then oldest → newest OS.
 *
 * ADDING A THEME LATER (e.g. macOS Classic, Ubuntu, ChromeOS):
 *   1. `themes/macos9.ts` — export a PCThemeDefinition (reuse a family
 *      or add one new CSS block in pc-themes.css).
 *   2. Import + append it below. Done — pickers, persistence, taskbar,
 *      window chrome, and icons all pick it up automatically.
 */
export const PC_THEMES: PCThemeDefinition[] = [
  cosmicJackie,
  win95,
  win98,
  winme,
  win2000,
  winxp,
  winvista,
  win7,
  win8,
  win10,
  win11,
];

const byId = new Map<string, PCThemeDefinition>(PC_THEMES.map(t => [t.id, t]));

/** Resolve a theme id; unknown/removed ids safely fall back to the default. */
export function getPCTheme(id: PCThemeId | null | undefined): PCThemeDefinition {
  return (id && byId.get(id)) || byId.get(PC_DEFAULT_THEME_ID)!;
}

export function isKnownPCTheme(id: string): boolean {
  return byId.has(id);
}
