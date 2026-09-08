import type { PCThemeDefinition } from '../types';
import { BLISS_HILL, CLOUDS_SKY } from './shared';

/**
 * Windows XP — the Luna (Blue) visual style over the Bliss hillside:
 *   • rounded blue titlebars (#0855DD → #3F8CF3 with #0831D9 edges),
 *   • butter-cream dialogs (ButtonFace #ECE9D8),
 *   • the two-tone blue taskbar (#245EDC base, #3C81F3 sheen),
 *   • the green Start button (#3C9838 → #2F7D2C),
 *   • Tahoma UI text, Trebuchet MS bold window titles,
 *   • selection blue #316AC5.
 */
export const winxp: PCThemeDefinition = {
  id: 'winxp',
  label: 'Windows XP',
  era: '2001',
  description: 'Luna blue chrome, the green Start button, and Bliss.',
  family: 'winxp',
  iconPack: 'luna',
  preview: { a: '#4f9be8', b: '#57a639', c: '#245edc' },
  tokens: {
    '--pc-font': `Tahoma, 'Segoe UI', Verdana, Arial, sans-serif`,
    '--pc-titlebar-font': `'Trebuchet MS', Tahoma, 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#5a7edc',
    '--pc-surface': '#ece9d8',
    '--pc-surface-text': '#000000',
    '--pc-window-bg': '#ece9d8',
    '--pc-window-radius': '8px 8px 0 0',
    '--pc-window-border': '#0831d9',
    '--pc-window-shadow': '2px 4px 10px rgba(0,0,0,0.4)',
    '--pc-content-bg': '#ece9d8',
    '--pc-titlebar-bg':
      'linear-gradient(180deg, #0997ff 0%, #0855dd 8%, #148aff 40%, #045be5 88%, #0347b8 100%)',
    '--pc-titlebar-bg-inactive':
      'linear-gradient(180deg, #9db9eb 0%, #7996de 8%, #92b1e8 40%, #7c9fe0 100%)',
    '--pc-titlebar-text': '#ffffff',
    '--pc-titlebar-text-inactive': '#e8eefb',
    '--pc-titlebar-height': '28px',
    '--pc-bevel-light': '#ffffff',
    '--pc-bevel-dark': '#aca899',
    '--pc-bevel-darker': '#716f64',
    '--pc-accent': '#316ac5',
    '--pc-accent-text': '#ffffff',
    '--pc-taskbar-bg':
      'linear-gradient(180deg, #3c81f3 0%, #245edc 6%, #2663e0 45%, #1941a5 98%, #123274 100%)',
    '--pc-taskbar-text': '#ffffff',
    '--pc-taskbar-height': '38px',
    '--pc-taskbar-border': '#1941a5',
    '--pc-taskbar-blur': '0px',
    '--pc-start-bg':
      'linear-gradient(180deg, #7ce261 0%, #3c9838 10%, #37962f 45%, #256b1f 95%)',
    '--pc-start-text': '#ffffff',
    '--pc-menu-bg': '#ffffff',
    '--pc-menu-text': '#000000',
    '--pc-menu-hover-bg': '#316ac5',
    '--pc-menu-hover-text': '#ffffff',
    '--pc-menu-radius': '6px',
    '--pc-menu-blur': '0px',
    '--pc-icon-label': '#ffffff',
    '--pc-icon-label-shadow': '1px 1px 2px rgba(0,0,0,0.85)',
    '--pc-icon-select-bg': '#316ac5',
    '--pc-btn-bg': 'linear-gradient(180deg, #ffffff 0%, #ece9d8 100%)',
    '--pc-btn-text': '#000000',
    '--pc-field-bg': '#ffffff',
    '--pc-field-text': '#000000',
    '--pc-banner-from': '#1c50d8', // Luna Start header gradient
    '--pc-banner-to': '#3f8cf3',
  },
  wallpapers: [
    { id: 'bliss', label: 'Bliss (default)', css: BLISS_HILL },
    {
      id: 'azul',
      label: 'Azul',
      css: 'linear-gradient(180deg, #0b3d91 0%, #1e6fd8 45%, #74c4f0 100%)',
    },
    { id: 'clouds', label: 'Clouds', css: CLOUDS_SKY },
    {
      id: 'energy-blue',
      label: 'Energy Blue',
      css: 'radial-gradient(120% 100% at 50% 100%, #8fd3ff 0%, #2f7ce0 55%, #0b3d91 100%)',
    },
  ],
  defaultWallpaperId: 'bliss',
  window: { controls: 'winxp', showTitleIcon: true },
  taskbar: {
    startLabel: 'start',
    startLogo: 'flagxp',
    centered: false,
    showThemeTrayButton: true,
    showClock: true,
  },
  startMenu: 'luna',
};
