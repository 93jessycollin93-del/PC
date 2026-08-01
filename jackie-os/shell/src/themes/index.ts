/**
 * Themes are pure CSS custom properties. Applying one writes tokens onto
 * `:root` and nothing else — no component reads a theme object, so a new theme
 * is a data change with no code behind it.
 *
 * Every wallpaper is a gradient or an inline SVG data-URI, so a theme costs
 * zero network requests. That is a hard requirement, not a nicety: on a booted
 * image there may be no network at all.
 */

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  /** Three swatches for the picker, no rendering required. */
  preview: [string, string, string];
  tokens: Record<string, string>;
}

const SLATE_WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M0 0h32v32H0z' fill='none'/%3E%3Cpath d='M0 31.5h32M31.5 0v32' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3C/svg%3E\") repeat, linear-gradient(160deg, #10151d 0%, #1b2430 55%, #131a24 100%)";

export const THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Dark slate with a faint grid. The default.',
    preview: ['#131a24', '#2c3b4f', '#5aa9e6'],
    tokens: {
      '--font': "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      '--mono': "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
      '--desktop-bg': SLATE_WALLPAPER,
      '--window-bg': '#1b2430',
      '--window-border': '#2f3d4f',
      '--window-radius': '10px',
      '--window-shadow': '0 18px 48px rgba(0,0,0,0.55)',
      '--titlebar-bg': 'linear-gradient(180deg, #2c3b4f 0%, #243040 100%)',
      '--titlebar-bg-inactive': '#212b38',
      '--titlebar-text': '#eef4fb',
      '--titlebar-text-inactive': '#7d8b9c',
      '--titlebar-height': '34px',
      '--content-bg': '#161e28',
      '--content-text': '#dce6f2',
      '--muted-text': '#8899ab',
      '--accent': '#5aa9e6',
      '--accent-text': '#06121d',
      '--taskbar-bg': 'rgba(18,24,33,0.92)',
      '--taskbar-text': '#dce6f2',
      '--taskbar-border': '#2f3d4f',
      '--field-bg': '#111823',
      '--field-border': '#33445a',
      '--danger': '#e5646d',
      '--success': '#5fd0a0',
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Light, high contrast, flat chrome.',
    preview: ['#e9e6df', '#ffffff', '#2f6f4f'],
    tokens: {
      '--font': "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      '--mono': "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
      '--desktop-bg': 'linear-gradient(165deg, #efece5 0%, #ddd8cd 100%)',
      '--window-bg': '#ffffff',
      '--window-border': '#c6c0b4',
      '--window-radius': '8px',
      '--window-shadow': '0 12px 32px rgba(60,50,35,0.18)',
      '--titlebar-bg': '#f3f0e9',
      '--titlebar-bg-inactive': '#e8e4db',
      '--titlebar-text': '#2a2620',
      '--titlebar-text-inactive': '#8a8378',
      '--titlebar-height': '34px',
      '--content-bg': '#ffffff',
      '--content-text': '#22201b',
      '--muted-text': '#6f695e',
      '--accent': '#2f6f4f',
      '--accent-text': '#ffffff',
      '--taskbar-bg': 'rgba(243,240,233,0.94)',
      '--taskbar-text': '#2a2620',
      '--taskbar-border': '#c6c0b4',
      '--field-bg': '#faf8f4',
      '--field-border': '#c6c0b4',
      '--danger': '#b3403f',
      '--success': '#2f6f4f',
    },
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Phosphor green on black, square corners.',
    preview: ['#000000', '#0d1f0d', '#4bf07a'],
    tokens: {
      '--font': "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
      '--mono': "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
      '--desktop-bg': 'radial-gradient(ellipse at 50% 40%, #0d1f0d 0%, #000000 78%)',
      '--window-bg': '#04120a',
      '--window-border': '#1d6b34',
      '--window-radius': '0px',
      '--window-shadow': '0 0 0 1px #0b3d1c, 0 12px 30px rgba(0,0,0,0.8)',
      '--titlebar-bg': '#0b3d1c',
      '--titlebar-bg-inactive': '#062210',
      '--titlebar-text': '#7ffaa0',
      '--titlebar-text-inactive': '#2f7a45',
      '--titlebar-height': '28px',
      '--content-bg': '#000000',
      '--content-text': '#4bf07a',
      '--muted-text': '#2f9c53',
      '--accent': '#4bf07a',
      '--accent-text': '#00160a',
      '--taskbar-bg': 'rgba(4,18,10,0.95)',
      '--taskbar-text': '#4bf07a',
      '--taskbar-border': '#1d6b34',
      '--field-bg': '#02170b',
      '--field-border': '#1d6b34',
      '--danger': '#ff6b6b',
      '--success': '#4bf07a',
    },
  },
];

export const DEFAULT_THEME_ID = 'midnight';

export function findTheme(themeId: string): ThemeDefinition {
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
}

/** Writes a theme's tokens onto the document root. Idempotent. */
export function applyTheme(themeId: string): void {
  if (typeof document === 'undefined') return;
  const theme = findTheme(themeId);
  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(token, value);
  }
  root.dataset.theme = theme.id;
}
