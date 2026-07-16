import type { PCThemeDefinition } from '../types';
import { BASE_TOKENS } from './shared';

/**
 * macOS family — three eras of Apple desktop:
 *   macos9        Mac OS 9 "Platinum" (1999): striped titlebars, box gadgets,
 *                 menubar only (no dock yet), Charcoal-era type.
 *   macosx-aqua   Mac OS X 10.0–10.4 Aqua (2001): pinstripes, glossy
 *                 traffic lights, Lucida Grande, the blue swirl desktop.
 *   macos-sonoma  Modern Ventura/Sonoma: SF Pro, translucent menubar +
 *                 floating dock, 10px rounding, flat traffic lights.
 * All three put controls on the LEFT with centered titles — the Mac way.
 */

export const macos9: PCThemeDefinition = {
  id: 'macos9',
  label: 'Mac OS 9',
  era: '1999',
  description: 'Platinum — striped titlebars, box gadgets, the classic Mac.',
  family: 'macclassic',
  iconPack: 'classic',
  preview: { a: '#7395c9', b: '#dddddd', c: '#3366cc' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Charcoal', Geneva, 'Helvetica Neue', Arial, sans-serif`,
    '--pc-titlebar-font': `'Charcoal', Geneva, 'Helvetica Neue', Arial, sans-serif`,
    '--pc-desktop-bg': '#7395c9',
    '--pc-surface': '#dddddd',
    '--pc-window-bg': '#dddddd',
    '--pc-window-radius': '0px',
    '--pc-window-shadow': '2px 3px 8px rgba(0,0,0,0.4)',
    '--pc-content-bg': '#dddddd',
    // The Platinum horizontal pinstripe drag bar:
    '--pc-titlebar-bg': 'repeating-linear-gradient(180deg, #ececec 0 2px, #c8c8c8 2px 4px)',
    '--pc-titlebar-bg-inactive': '#e8e8e8',
    '--pc-titlebar-text': '#000000',
    '--pc-titlebar-text-inactive': '#888888',
    '--pc-titlebar-height': '24px',
    '--pc-bevel-light': '#ffffff',
    '--pc-bevel-dark': '#9a9a9a',
    '--pc-bevel-darker': '#555555',
    '--pc-accent': '#3366cc',
    '--pc-menu-bg': '#eeeeee',
    '--pc-menu-hover-bg': '#3366cc',
    '--pc-menu-hover-text': '#ffffff',
    '--pc-menu-radius': '4px',
    '--pc-menu-blur': '0px',
    '--pc-menubar-height': '24px',
    '--pc-menubar-bg': '#eeeeee',
    '--pc-menubar-text': '#000000',
    '--pc-tl-close': '#c9c5be',
    '--pc-tl-min': '#c9c5be',
    '--pc-tl-max': '#c9c5be',
  },
  wallpapers: [
    {
      id: 'platinum-blue',
      label: 'Mac OS Blue (default)',
      css: 'radial-gradient(120% 120% at 30% 20%, #8fb0dd 0%, #5b7fb8 55%, #33517f 100%)',
    },
    { id: 'platinum-gray', label: 'Platinum', css: '#9c9c9c' },
    {
      id: 'bondi',
      label: 'Bondi',
      css: 'linear-gradient(160deg, #0a8f9e 0%, #0fb3c4 55%, #056572 100%)',
    },
  ],
  defaultWallpaperId: 'platinum-blue',
  window: { controls: 'platinum', controlsSide: 'left', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'list10',
  shell: { bars: ['menubar'], menuLogo: 'apple' },
};

export const macosxAqua: PCThemeDefinition = {
  id: 'macosx-aqua',
  label: 'Mac OS X Aqua',
  era: '2001',
  description: 'Pinstripes, gel buttons, Lucida Grande — lickable Aqua.',
  family: 'mac',
  iconPack: 'squircle',
  preview: { a: '#2a6be0', b: '#ececec', c: '#7db8f0' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Lucida Grande', 'Helvetica Neue', Verdana, sans-serif`,
    '--pc-titlebar-font': `'Lucida Grande', 'Helvetica Neue', Verdana, sans-serif`,
    '--pc-desktop-bg': '#2a6be0',
    '--pc-surface': '#ececec',
    '--pc-window-bg': '#ececec',
    '--pc-window-radius': '8px',
    '--pc-window-border': 'rgba(0,0,0,0.35)',
    '--pc-content-bg': '#f2f2f2',
    // Aqua's horizontal pinstripe titlebar:
    '--pc-titlebar-bg': 'repeating-linear-gradient(180deg, #fbfbfb 0 2px, #e2e2e2 2px 4px)',
    '--pc-titlebar-bg-inactive': '#f4f4f4',
    '--pc-titlebar-text': '#1a1a1a',
    '--pc-titlebar-height': '26px',
    '--pc-accent': '#1f62d8',
    '--pc-menu-radius': '8px',
    '--pc-menubar-bg': 'rgba(250,250,250,0.9)',
    '--pc-dock-bg': 'rgba(240,240,245,0.5)',
    '--pc-dock-border': 'rgba(255,255,255,0.55)',
    '--pc-dock-radius': '14px',
  },
  wallpapers: [
    {
      id: 'aqua-blue',
      label: 'Aqua Blue (default)',
      css:
        'radial-gradient(80% 70% at 25% 25%, rgba(180,215,255,0.85) 0%, transparent 60%),' +
        'radial-gradient(90% 80% at 75% 65%, rgba(60,120,225,0.9) 0%, transparent 70%),' +
        'linear-gradient(160deg, #4a8ae8 0%, #1c50c0 60%, #0d2f86 100%)',
    },
    {
      id: 'jaguar',
      label: 'Jaguar',
      css: 'radial-gradient(100% 100% at 50% 40%, #3a7be0 0%, #12318e 70%, #081b52 100%)',
    },
    { id: 'graphite', label: 'Graphite', css: 'linear-gradient(160deg, #7a8290 0%, #4a505c 100%)' },
  ],
  defaultWallpaperId: 'aqua-blue',
  window: { controls: 'traffic', controlsSide: 'left', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'list10',
  shell: { bars: ['menubar', 'dock'], dockPosition: 'bottom', menuLogo: 'apple' },
};

export const macosSonoma: PCThemeDefinition = {
  id: 'macos-sonoma',
  label: 'macOS Sonoma',
  era: '2023',
  description: 'SF Pro, floating translucent dock, modern Mac calm.',
  family: 'mac',
  iconPack: 'squircle',
  preview: { a: '#e08a4e', b: '#f5f5f7', c: '#5a4a9e' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `-apple-system, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#3c2f52',
    '--pc-surface': '#f5f5f7',
    '--pc-window-bg': 'rgba(245,245,247,0.92)',
    '--pc-window-radius': '10px',
    '--pc-window-border': 'rgba(0,0,0,0.22)',
    '--pc-content-bg': '#ffffff',
    '--pc-titlebar-bg': '#f5f5f7',
    '--pc-titlebar-bg-inactive': '#f5f5f7',
    '--pc-titlebar-text': '#1d1d1f',
    '--pc-titlebar-height': '30px',
    '--pc-accent': '#0071e3',
    '--pc-menu-radius': '12px',
    '--pc-menubar-bg': 'rgba(250,250,252,0.6)',
    '--pc-dock-bg': 'rgba(250,250,252,0.35)',
    '--pc-dock-radius': '22px',
    '--pc-dock-blur': '26px',
  },
  wallpapers: [
    {
      id: 'sonoma',
      label: 'Sonoma Horizon (default)',
      css:
        'radial-gradient(90% 70% at 70% 20%, rgba(240,160,90,0.75) 0%, transparent 60%),' +
        'radial-gradient(80% 80% at 25% 70%, rgba(90,74,158,0.85) 0%, transparent 65%),' +
        'linear-gradient(170deg, #2b2140 0%, #59396e 50%, #1c1530 100%)',
    },
    {
      id: 'ventura',
      label: 'Ventura',
      css: 'linear-gradient(140deg, #e2542e 0%, #b53f8f 45%, #2b2a72 100%)',
    },
    {
      id: 'monterey',
      label: 'Monterey',
      css: 'radial-gradient(100% 100% at 30% 30%, #7fc8f5 0%, #3a6bd8 45%, #2b1d6e 100%)',
    },
  ],
  defaultWallpaperId: 'sonoma',
  window: { controls: 'traffic', controlsSide: 'left', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'list10',
  shell: { bars: ['menubar', 'dock'], dockPosition: 'bottom', menuLogo: 'apple' },
};
