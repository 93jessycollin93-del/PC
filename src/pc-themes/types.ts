/**
 * PC Theme System — type contract.
 *
 * ISOLATION GUARANTEE
 * ───────────────────
 * Everything in `src/pc-themes/` is scoped to the PC shell ONLY:
 *   • the desktop surface (wallpaper), desktop icons, taskbar/Start menu,
 *     DraggableWindow chrome, and system dialogs.
 *   • Jackie's cosmic chat face, the Eru vault, and every internal app's
 *     logic/state are NEVER touched. Apps render exactly the same React
 *     tree — only the shell *around* them changes.
 *   • When the default `cosmic-jackie` theme is active, every consumer
 *     falls back to its pre-theme-system markup: the UI is bit-for-bit
 *     identical to a build without this folder.
 *
 * EXTENSIBILITY
 * ─────────────
 * A theme is pure data (`PCThemeDefinition`). To add a new OS skin:
 *   1. create `themes/<id>.ts` exporting a definition,
 *   2. register it in `registry.ts`,
 *   3. (optional) add family-level CSS in `pc-themes.css` if it introduces
 *      a brand-new chrome style; otherwise reuse an existing family.
 * Nothing else in the codebase needs to change.
 */

/** Built-in theme ids. `string` is allowed so user packs can extend freely. */
export type PCThemeId =
  | 'cosmic-jackie'
  | 'win95'
  | 'win98'
  | 'winme'
  | 'win2000'
  | 'winxp'
  | 'winvista'
  | 'win7'
  | 'win8'
  | 'win10'
  | 'win11'
  | (string & {});

/**
 * A chrome "family" groups themes that share structural CSS
 * (bevels vs. gradients vs. glass vs. flat). Individual themes inside a
 * family differ only by their token values (colors, fonts, sizes).
 */
export type PCThemeFamily =
  | 'cosmic' // default Jackie look — no overrides at all
  | 'win9x'  // 95 / 98 / ME — gray 3D bevels, MS Sans Serif
  | 'win2k'  // 2000 — win9x structure, gradient titlebar, cooler grays
  | 'winxp'  // XP Luna — rounded blue chrome, green Start
  | 'aero'   // Vista / 7 — translucent glass, glow buttons
  | 'metro'  // 8 / 8.1 — flat, sharp corners, solid accent
  | 'fluent'; // 10 / 11 — acrylic, subtle rounding

/** Which desktop/start-menu icon pack a theme uses. */
export type PCIconPack =
  | 'cosmic'   // untouched original glossy tiles (default theme)
  | 'classic'  // hand-drawn 16×16 pixel SVGs (Win 95/98/ME/2000)
  | 'luna'     // pixel SVGs on soft XP-blue plates
  | 'aero'     // lucide glyph on glassy plate
  | 'tile'     // Metro: lucide glyph on flat solid tile (Win 8)
  | 'fluent';  // lucide glyph on rounded acrylic plate (Win 10/11)

/** One wallpaper option. `css` is any valid CSS `background` value —
 *  gradients and SVG data-URIs ship with zero network cost. Real image
 *  files can be dropped in `public/pc-themes/<theme>/wallpapers/` and
 *  referenced as `url(/pc-themes/<theme>/wallpapers/foo.jpg) center/cover`. */
export interface PCWallpaper {
  id: string;
  label: string;
  css: string;
}

/** Optional sound hooks. Files live in `public/pc-themes/<theme>/sounds/`.
 *  All sounds are OFF unless a theme provides URLs — the provider exposes
 *  `playSound(kind)` which no-ops when a sound is absent or audio fails. */
export interface PCSoundPack {
  startup?: string;
  open?: string;
  close?: string;
  error?: string;
}

/** Window-chrome behavioral hints consumed by DraggableWindow. */
export interface PCWindowStyle {
  /** Which control-button glyph set to draw. */
  controls: 'win9x' | 'winxp' | 'aero' | 'metro' | 'fluent';
  /** Show the small app icon in the titlebar (Win9x/2k/XP tradition). */
  showTitleIcon: boolean;
}

/** Taskbar behavioral hints consumed by PCTaskbar. */
export interface PCTaskbarStyle {
  /** Text on the Start button ('' hides the label — orb/logo only). */
  startLabel: string;
  /** Which Start logo mark to draw next to/instead of the label. */
  startLogo: 'flag95' | 'flagxp' | 'orb' | 'metro' | 'fluent';
  /** Center the app buttons + Start (Windows 11 style). */
  centered: boolean;
  /** Show a quick "Themes" tray button that opens the Theme Manager. */
  showThemeTrayButton: boolean;
  showClock: boolean;
}

/** Start-menu layout variant rendered by PCStartMenu. */
export type PCStartMenuLayout =
  | 'classic'   // 9x/2k: vertical banner + single column
  | 'luna'      // XP: blue header, two columns
  | 'aero'      // Vista/7: dark glass, search box
  | 'fullgrid'  // 8: near-fullscreen tile grid
  | 'list10'    // 10: left list + tile pane
  | 'centered11'; // 11: centered pinned grid

/**
 * The complete, serializable description of a theme.
 * Pure data — no React, no side effects — so the registry can be treated
 * like JSON config and bulk-updated safely.
 */
export interface PCThemeDefinition {
  id: PCThemeId;
  label: string;
  /** Short era tag shown in pickers, e.g. "1995". */
  era: string;
  description: string;
  family: PCThemeFamily;
  iconPack: PCIconPack;
  /** Three colors used to paint the preview swatch in pickers. */
  preview: { a: string; b: string; c: string };
  /**
   * CSS custom properties applied inline on the PC scope container.
   * Every key MUST start with `--pc-` so tokens can never collide with
   * app-level or Jackie-level CSS variables.
   */
  tokens: Record<`--pc-${string}`, string>;
  wallpapers: PCWallpaper[];
  defaultWallpaperId: string;
  window: PCWindowStyle;
  taskbar: PCTaskbarStyle;
  startMenu: PCStartMenuLayout;
  sounds?: PCSoundPack;
}

/** Shape persisted to localStorage (versioned for painless migrations). */
export interface PCThemePersistedState {
  v: 1;
  themeId: PCThemeId;
  /** Remembered wallpaper choice per theme id. */
  wallpaperByTheme: Record<string, string>;
}

export const PC_THEME_STORAGE_KEY = 'pc_theme_v1';
export const PC_DEFAULT_THEME_ID: PCThemeId = 'cosmic-jackie';
