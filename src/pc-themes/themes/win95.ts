import type { PCThemeDefinition } from '../types';
import { CLOUDS_SKY } from './shared';

/**
 * Windows 95 — "Windows Standard" scheme, faithful to the real system
 * colors (the Arcade95 look): silver #C0C0C0 3D chrome, solid navy
 * #000080 titlebars, teal #008080 desktop, MS Sans Serif.
 *
 * Authentic system-color sources:
 *   ButtonFace #C0C0C0 · ButtonHighlight #FFFFFF · ButtonShadow #808080
 *   3DDkShadow #000000 · ActiveTitle #000080 · InactiveTitle #808080
 *   TitleText #FFFFFF · Desktop #008080 · Highlight #000080 · Window #FFFFFF
 */
export const win95: PCThemeDefinition = {
  id: 'win95',
  label: 'Windows 95',
  era: '1995',
  description: 'Silver bevels, navy titlebars, teal desktop — the classic.',
  family: 'win9x',
  iconPack: 'classic',
  preview: { a: '#008080', b: '#c0c0c0', c: '#000080' },
  tokens: {
    '--pc-font': `'MS Sans Serif', 'Microsoft Sans Serif', 'Pixelated MS Sans Serif', Tahoma, Arial, sans-serif`,
    '--pc-titlebar-font': `'MS Sans Serif', 'Microsoft Sans Serif', Tahoma, Arial, sans-serif`,
    '--pc-desktop-bg': '#008080',
    '--pc-surface': '#c0c0c0',
    '--pc-surface-text': '#000000',
    '--pc-window-bg': '#c0c0c0',
    '--pc-window-radius': '0px',
    '--pc-window-border': '#c0c0c0',
    '--pc-window-shadow': '2px 2px 0 rgba(0,0,0,0.35)',
    '--pc-content-bg': '#c0c0c0',
    '--pc-titlebar-bg': '#000080', // Win95: SOLID navy — no gradient yet.
    '--pc-titlebar-bg-inactive': '#808080',
    '--pc-titlebar-text': '#ffffff',
    '--pc-titlebar-text-inactive': '#c0c0c0',
    '--pc-titlebar-height': '22px',
    '--pc-bevel-light': '#ffffff',
    '--pc-bevel-dark': '#808080',
    '--pc-bevel-darker': '#000000',
    '--pc-accent': '#000080',
    '--pc-accent-text': '#ffffff',
    '--pc-taskbar-bg': '#c0c0c0',
    '--pc-taskbar-text': '#000000',
    '--pc-taskbar-height': '36px',
    '--pc-taskbar-border': '#ffffff',
    '--pc-taskbar-blur': '0px',
    '--pc-start-bg': '#c0c0c0',
    '--pc-start-text': '#000000',
    '--pc-menu-bg': '#c0c0c0',
    '--pc-menu-text': '#000000',
    '--pc-menu-hover-bg': '#000080',
    '--pc-menu-hover-text': '#ffffff',
    '--pc-menu-radius': '0px',
    '--pc-menu-blur': '0px',
    '--pc-icon-label': '#ffffff',
    '--pc-icon-label-shadow': '1px 1px 0 rgba(0,0,0,0.9)',
    '--pc-icon-select-bg': '#000080',
    '--pc-btn-bg': '#c0c0c0',
    '--pc-btn-text': '#000000',
    '--pc-field-bg': '#ffffff',
    '--pc-field-text': '#000000',
    '--pc-banner-from': '#00007b', // Start-menu side banner (navy → black)
    '--pc-banner-to': '#000000',
  },
  wallpapers: [
    { id: 'teal', label: 'Teal (default)', css: '#008080' },
    { id: 'clouds', label: 'Clouds', css: CLOUDS_SKY },
    { id: 'black', label: 'None (Black)', css: '#000000' },
    {
      id: 'setup-blue',
      label: 'Setup Blue',
      css: 'linear-gradient(180deg, #000080 0%, #1084d0 100%)',
    },
  ],
  defaultWallpaperId: 'clouds', // Arcade95 screenshots: blue sky wallpaper.
  window: { controls: 'win9x', showTitleIcon: true },
  taskbar: {
    startLabel: 'Start',
    startLogo: 'flag95',
    centered: false,
    showThemeTrayButton: true,
    showClock: true,
  },
  startMenu: 'classic',
};
