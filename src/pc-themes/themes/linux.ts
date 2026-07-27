import type { PCThemeDefinition } from '../types';
import { BASE_TOKENS } from './shared';

/**
 * Linux family — four desktops people actually recognize:
 *   ubuntu-unity  Ubuntu 12.04-era Unity: aubergine + orange, LEFT launcher,
 *                 global menubar, Ambiance window buttons on the left.
 *   gnome         Modern GNOME/Adwaita: black top bar, light headerbars,
 *                 12px rounding, dash dock, GNOME blue #3584E4, Cantarell.
 *   kde-plasma    KDE Plasma/Breeze: dark bottom panel (classic taskbar!),
 *                 Breeze blue #3DAEE9, Noto Sans.
 *   elementary    elementary OS Pantheon: translucent top panel + Plank
 *                 dock, airy light chrome.
 */

export const ubuntuUnity: PCThemeDefinition = {
  id: 'ubuntu-unity',
  label: 'Ubuntu Unity',
  era: '2012',
  description: 'Aubergine + orange, the left launcher, Ambiance chrome.',
  family: 'linux',
  iconPack: 'round',
  preview: { a: '#77216f', b: '#e95420', c: '#2c001e' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Ubuntu', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Ubuntu', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#2c001e',
    '--pc-surface': '#f2f1f0',
    '--pc-window-bg': '#f2f1f0',
    '--pc-window-radius': '6px 6px 0 0',
    '--pc-window-border': 'rgba(0,0,0,0.4)',
    '--pc-content-bg': '#f2f1f0',
    // Ambiance dark-chocolate headerbar:
    '--pc-titlebar-bg': 'linear-gradient(180deg, #4c4a44 0%, #3c3b37 100%)',
    '--pc-titlebar-bg-inactive': '#484742',
    '--pc-titlebar-text': '#dfdbd2',
    '--pc-titlebar-text-inactive': '#93908a',
    '--pc-titlebar-height': '28px',
    '--pc-accent': '#e95420',
    '--pc-menu-bg': 'rgba(60,59,55,0.97)',
    '--pc-menu-text': '#dfdbd2',
    '--pc-menu-hover-bg': '#e95420',
    '--pc-menu-hover-text': '#ffffff',
    '--pc-menu-radius': '6px',
    '--pc-menubar-height': '26px',
    '--pc-menubar-bg': 'rgba(44,42,40,0.96)',
    '--pc-menubar-text': '#dfdbd2',
    '--pc-dock-bg': 'rgba(50,15,45,0.8)',
    '--pc-dock-border': 'rgba(255,255,255,0.12)',
    '--pc-dock-plate-bg': 'rgba(255,255,255,0.1)',
    // Ambiance window lights: orange close, muted min/max.
    '--pc-tl-close': 'radial-gradient(circle at 35% 30%, #f8996e 0%, #df4f1c 70%)',
    '--pc-tl-min': '#56534d',
    '--pc-tl-max': '#56534d',
  },
  wallpapers: [
    {
      id: 'aubergine',
      label: 'Precise Aubergine (default)',
      css:
        'radial-gradient(110% 110% at 20% 15%, rgba(233,84,32,0.28) 0%, transparent 55%),' +
        'radial-gradient(120% 120% at 70% 80%, #77216f 0%, #5e2750 45%, #2c001e 100%)',
    },
    { id: 'plain', label: 'Aubergine Flat', css: '#3b0f33' },
    {
      id: 'warty',
      label: 'Warm Brown',
      css: 'linear-gradient(160deg, #6e4b32 0%, #4a2f1e 60%, #2b1a10 100%)',
    },
  ],
  defaultWallpaperId: 'aubergine',
  window: { controls: 'traffic', controlsSide: 'left', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'aero',
  shell: { bars: ['menubar', 'dock'], dockPosition: 'left', menuLogo: 'ubuntu', menuLabel: 'Ubuntu' },
};

export const gnomeAdwaita: PCThemeDefinition = {
  id: 'gnome',
  label: 'GNOME',
  era: '2021',
  description: 'Adwaita — black top bar, soft headerbars, GNOME blue.',
  family: 'linux',
  iconPack: 'round',
  preview: { a: '#3584e4', b: '#f6f5f4', c: '#241f31' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Cantarell', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Cantarell', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#241f31',
    '--pc-surface': '#fafafa',
    '--pc-window-bg': '#fafafa',
    '--pc-window-radius': '12px',
    '--pc-window-border': 'rgba(0,0,0,0.28)',
    '--pc-content-bg': '#fafafa',
    '--pc-titlebar-bg': 'linear-gradient(180deg, #f6f5f4 0%, #ebe8e6 100%)',
    '--pc-titlebar-bg-inactive': '#f6f5f4',
    '--pc-titlebar-text': '#2e3436',
    '--pc-titlebar-height': '34px',
    '--pc-accent': '#3584e4',
    '--pc-menu-radius': '12px',
    '--pc-menubar-height': '26px',
    '--pc-menubar-bg': 'rgba(0,0,0,0.92)',
    '--pc-menubar-text': '#ffffff',
    '--pc-dock-bg': 'rgba(0,0,0,0.72)',
    '--pc-dock-border': 'rgba(255,255,255,0.1)',
    '--pc-dock-radius': '16px',
  },
  wallpapers: [
    {
      id: 'adwaita',
      label: 'Adwaita Night (default)',
      css:
        'radial-gradient(90% 80% at 70% 20%, rgba(98,160,234,0.5) 0%, transparent 60%),' +
        'linear-gradient(165deg, #1c1633 0%, #37325a 55%, #131020 100%)',
    },
    {
      id: 'adwaita-day',
      label: 'Adwaita Day',
      css: 'linear-gradient(165deg, #8ec5f2 0%, #4a90d9 55%, #2b5f9e 100%)',
    },
    { id: 'slate', label: 'Slate', css: '#3d3846' },
  ],
  defaultWallpaperId: 'adwaita',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'aero',
  shell: { bars: ['menubar', 'dock'], dockPosition: 'bottom', menuLogo: 'gnome', menuLabel: 'Activities' },
};

export const kdePlasma: PCThemeDefinition = {
  id: 'kde-plasma',
  label: 'KDE Plasma',
  era: '2020',
  description: 'Breeze — dark panel, crisp light windows, #3DAEE9.',
  family: 'linux',
  iconPack: 'round',
  preview: { a: '#1b1e20', b: '#3daee9', c: '#eff0f1' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#1d99f3',
    '--pc-surface': '#eff0f1',
    '--pc-window-bg': '#eff0f1',
    '--pc-window-radius': '6px 6px 0 0',
    '--pc-window-border': 'rgba(0,0,0,0.35)',
    '--pc-content-bg': '#eff0f1',
    '--pc-titlebar-bg': '#2b2e31',
    '--pc-titlebar-bg-inactive': '#3a3e42',
    '--pc-titlebar-text': '#fcfcfc',
    '--pc-titlebar-text-inactive': '#9a9ea2',
    '--pc-titlebar-height': '30px',
    '--pc-accent': '#3daee9',
    '--pc-taskbar-bg': 'rgba(27,30,32,0.95)',
    '--pc-taskbar-height': '40px',
    '--pc-menu-bg': 'rgba(39,43,46,0.97)',
    '--pc-menu-text': '#fcfcfc',
    '--pc-menu-hover-bg': 'rgba(61,174,233,0.35)',
    '--pc-menu-hover-text': '#ffffff',
    '--pc-menu-radius': '4px',
  },
  wallpapers: [
    {
      id: 'next',
      label: 'Breeze Next (default)',
      css:
        'linear-gradient(120deg, transparent 0 52%, rgba(255,255,255,0.08) 52% 64%, transparent 64%),' +
        'linear-gradient(160deg, #0f3b6e 0%, #1d99f3 55%, #12507f 100%)',
    },
    {
      id: 'shell',
      label: 'Midnight Coast',
      css: 'linear-gradient(165deg, #16213a 0%, #274690 55%, #101828 100%)',
    },
    { id: 'plain', label: 'Plasma Blue', css: '#1d99f3' },
  ],
  defaultWallpaperId: 'next',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: true },
  taskbar: { startLabel: '', startLogo: 'plasma', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'list10',
  // No shell config → classic bottom taskbar, exactly like Plasma's panel.
};

export const elementaryOS: PCThemeDefinition = {
  id: 'elementary',
  label: 'elementary OS',
  era: '2015',
  description: 'Pantheon — translucent panel, Plank dock, airy and quiet.',
  family: 'linux',
  iconPack: 'squircle',
  preview: { a: '#64baff', b: '#f5f5f5', c: '#485a6c' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Inter', 'Open Sans', 'Droid Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Inter', 'Open Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#485a6c',
    '--pc-surface': '#f5f5f5',
    '--pc-window-bg': '#f5f5f5',
    '--pc-window-radius': '8px',
    '--pc-window-border': 'rgba(0,0,0,0.25)',
    '--pc-content-bg': '#fafafa',
    '--pc-titlebar-bg': 'linear-gradient(180deg, #fbfbfb 0%, #ececec 100%)',
    '--pc-titlebar-bg-inactive': '#f5f5f5',
    '--pc-titlebar-text': '#333333',
    '--pc-titlebar-height': '30px',
    '--pc-accent': '#3689e6',
    '--pc-menubar-height': '26px',
    '--pc-menubar-bg': 'rgba(20,28,36,0.55)',
    '--pc-menubar-text': '#ffffff',
    '--pc-dock-bg': 'rgba(250,250,250,0.6)',
    '--pc-dock-border': 'rgba(0,0,0,0.12)',
    '--pc-dock-radius': '12px',
    '--pc-tl-close': 'radial-gradient(circle at 35% 30%, #a8b8c8 0%, #7e8f9e 70%)',
    '--pc-tl-min': '#c8d2da',
    '--pc-tl-max': '#c8d2da',
  },
  wallpapers: [
    {
      id: 'odin',
      label: 'Sunset Coast (default)',
      css:
        'radial-gradient(90% 60% at 70% 30%, rgba(255,170,110,0.6) 0%, transparent 60%),' +
        'linear-gradient(170deg, #f2a06e 0%, #c96a7e 40%, #485a6c 100%)',
    },
    {
      id: 'loki',
      label: 'Blue Ridge',
      css: 'linear-gradient(170deg, #9cc9f0 0%, #5a92c8 50%, #2e4a66 100%)',
    },
    { id: 'plain', label: 'Slate Gray', css: '#485a6c' },
  ],
  defaultWallpaperId: 'odin',
  window: { controls: 'traffic', controlsSide: 'left', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: false, showThemeTrayButton: true, showClock: true },
  startMenu: 'aero',
  shell: { bars: ['menubar', 'dock'], dockPosition: 'bottom', menuLogo: 'pantheon', menuLabel: 'Applications' },
};
