import type { PCThemeDefinition } from '../types';
import { BASE_TOKENS } from './shared';

/**
 * Mobile / web OS family — Android, iOS, ChromeOS:
 *   android-material  Android 12+ Material You: pastel dynamic color, big
 *                     28px rounding, tablet taskbar + app-drawer grid.
 *   android-holo      Android 4.x Holo (2011): near-black, Holo blue
 *                     #33B5E5, hard edges, dark app drawer.
 *   ios6              iOS 6 (2012): linen, metallic shelf dock, glossy
 *                     skeuomorphic icons.
 *   ios17             Modern iOS: vibrant wallpaper, floating translucent
 *                     dock, flat squircles, SF type.
 *   chromeos          ChromeOS: light shelf, circular launcher, Google
 *                     blue #1A73E8, Roboto.
 */

export const androidMaterial: PCThemeDefinition = {
  id: 'android-material',
  label: 'Android 14',
  era: '2023',
  description: 'Material You — pastel dynamic color, soft giant corners.',
  family: 'mobile',
  iconPack: 'material',
  preview: { a: '#d0bcff', b: '#fef7ff', c: '#6750a4' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Roboto', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Roboto', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#4a4458',
    '--pc-surface': '#fef7ff',
    '--pc-window-bg': '#fef7ff',
    '--pc-window-radius': '24px',
    '--pc-window-border': 'rgba(0,0,0,0.14)',
    '--pc-content-bg': '#fef7ff',
    '--pc-titlebar-bg': '#fef7ff',
    '--pc-titlebar-bg-inactive': '#f6eef8',
    '--pc-titlebar-text': '#1d1b20',
    '--pc-titlebar-height': '36px',
    '--pc-accent': '#6750a4',
    '--pc-taskbar-bg': 'rgba(243,237,250,0.92)',
    '--pc-taskbar-text': '#1d1b20',
    '--pc-taskbar-height': '46px',
    '--pc-taskbar-border': 'transparent',
    '--pc-menu-bg': 'rgba(243,237,247,0.97)',
    '--pc-menu-text': '#1d1b20',
    '--pc-menu-hover-bg': 'rgba(103,80,164,0.14)',
    '--pc-menu-radius': '24px',
  },
  wallpapers: [
    {
      id: 'you',
      label: 'Material You (default)',
      css:
        'radial-gradient(70% 60% at 25% 30%, rgba(208,188,255,0.9) 0%, transparent 60%),' +
        'radial-gradient(60% 60% at 75% 60%, rgba(255,216,180,0.8) 0%, transparent 65%),' +
        'linear-gradient(160deg, #6a5a8e 0%, #8e7aa8 50%, #4a4458 100%)',
    },
    {
      id: 'mint',
      label: 'Mint',
      css: 'radial-gradient(80% 70% at 30% 30%, #b8e6c8 0%, #6fae8a 55%, #35543f 100%)',
    },
    { id: 'ink', label: 'Ink', css: '#1d1b20' },
  ],
  defaultWallpaperId: 'you',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'drawer', centered: true, showThemeTrayButton: true, showClock: true },
  startMenu: 'fullgrid',
};

export const androidHolo: PCThemeDefinition = {
  id: 'android-holo',
  label: 'Android Holo',
  era: '2011',
  description: 'Ice Cream Sandwich — black glass and Holo blue #33B5E5.',
  family: 'mobile',
  iconPack: 'round',
  preview: { a: '#0f0f12', b: '#33b5e5', c: '#252530' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Roboto', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Roboto', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#0f0f12',
    '--pc-surface': '#1b1b1f',
    '--pc-surface-text': '#f0f0f0',
    '--pc-window-bg': '#1b1b1f',
    '--pc-window-radius': '4px',
    '--pc-window-border': 'rgba(51,181,229,0.5)',
    '--pc-content-bg': '#141418',
    '--pc-titlebar-bg': '#1b1b1f',
    '--pc-titlebar-bg-inactive': '#232328',
    '--pc-titlebar-text': '#33b5e5',
    '--pc-titlebar-text-inactive': '#6a6a72',
    '--pc-titlebar-height': '34px',
    '--pc-accent': '#33b5e5',
    '--pc-taskbar-bg': 'rgba(0,0,0,0.92)',
    '--pc-taskbar-height': '42px',
    '--pc-menu-bg': 'rgba(20,20,24,0.97)',
    '--pc-menu-text': '#f0f0f0',
    '--pc-menu-hover-bg': 'rgba(51,181,229,0.3)',
    '--pc-menu-radius': '4px',
    '--pc-btn-bg': '#2a2a30',
    '--pc-btn-text': '#f0f0f0',
    '--pc-field-bg': '#101014',
    '--pc-field-text': '#f0f0f0',
  },
  wallpapers: [
    {
      id: 'nexus',
      label: 'Nexus Nebula (default)',
      css:
        'radial-gradient(60% 50% at 70% 25%, rgba(51,181,229,0.4) 0%, transparent 60%),' +
        'radial-gradient(50% 60% at 25% 75%, rgba(153,204,0,0.22) 0%, transparent 60%),' +
        'linear-gradient(170deg, #05070c 0%, #101825 55%, #04060a 100%)',
    },
    { id: 'black', label: 'AMOLED Black', css: '#000000' },
    {
      id: 'holo-grid',
      label: 'Holo Grid',
      css: 'linear-gradient(180deg, #06131c 0%, #0d2635 60%, #04101a 100%)',
    },
  ],
  defaultWallpaperId: 'nexus',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: true },
  taskbar: { startLabel: '', startLogo: 'drawer', centered: true, showThemeTrayButton: true, showClock: true },
  startMenu: 'fullgrid',
};

export const ios6: PCThemeDefinition = {
  id: 'ios6',
  label: 'iOS 6',
  era: '2012',
  description: 'Linen, metal shelf, glossy icons — peak skeuomorphism.',
  family: 'mobile',
  iconPack: 'squircle-gloss',
  preview: { a: '#2a2a34', b: '#8fa4bd', c: '#2d6ae2' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Helvetica Neue', Helvetica, Arial, sans-serif`,
    '--pc-titlebar-font': `'Helvetica Neue', Helvetica, Arial, sans-serif`,
    '--pc-desktop-bg': '#26262e',
    '--pc-surface': '#eff2f6',
    '--pc-window-bg': '#eff2f6',
    '--pc-window-radius': '8px',
    '--pc-window-border': 'rgba(0,0,0,0.4)',
    '--pc-content-bg': '#f4f5f7',
    // The iOS 6 blue-gray glossy navigation bar:
    '--pc-titlebar-bg': 'linear-gradient(180deg, #c5d0dd 0%, #94a7bd 49%, #8398b1 50%, #a7b8cc 100%)',
    '--pc-titlebar-bg-inactive': 'linear-gradient(180deg, #d8dde3 0%, #b8c1cc 100%)',
    '--pc-titlebar-text': '#ffffff',
    '--pc-titlebar-height': '30px',
    '--pc-accent': '#2d6ae2',
    '--pc-menu-radius': '10px',
    '--pc-dock-bg': 'linear-gradient(180deg, rgba(220,225,232,0.7) 0%, rgba(130,138,150,0.7) 100%)',
    '--pc-dock-border': 'rgba(255,255,255,0.5)',
    '--pc-dock-radius': '14px',
    '--pc-dock-blur': '10px',
  },
  wallpapers: [
    {
      id: 'linen',
      label: 'Linen (default)',
      css:
        'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 4px),' +
        'repeating-linear-gradient(-45deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 4px),' +
        'linear-gradient(180deg, #2e2e38 0%, #23232c 100%)',
    },
    {
      id: 'earth',
      label: 'Blue Marble',
      css: 'radial-gradient(60% 60% at 50% 42%, #3a76c4 0%, #16305e 55%, #05070c 80%)',
    },
    {
      id: 'rays',
      label: 'Silver Rays',
      css: 'radial-gradient(100% 100% at 50% 0%, #c9d2dd 0%, #8b98a8 55%, #5a6675 100%)',
    },
  ],
  defaultWallpaperId: 'linen',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: true, showThemeTrayButton: true, showClock: true },
  startMenu: 'fullgrid',
  shell: { bars: ['dock'], dockPosition: 'bottom' },
};

export const ios17: PCThemeDefinition = {
  id: 'ios17',
  label: 'iOS 17',
  era: '2023',
  description: 'Vibrant swirls, floating glass dock, flat squircles.',
  family: 'mobile',
  iconPack: 'squircle',
  preview: { a: '#3a7bf0', b: '#e08ad0', c: '#1c2a6e' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `-apple-system, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#1c2a6e',
    '--pc-surface': '#f8f8fc',
    '--pc-window-bg': 'rgba(248,248,252,0.94)',
    '--pc-window-radius': '14px',
    '--pc-window-border': 'rgba(0,0,0,0.16)',
    '--pc-content-bg': '#ffffff',
    '--pc-titlebar-bg': 'rgba(248,248,252,0.92)',
    '--pc-titlebar-bg-inactive': '#f2f2f7',
    '--pc-titlebar-text': '#111111',
    '--pc-titlebar-height': '32px',
    '--pc-accent': '#0a84ff',
    '--pc-menu-radius': '16px',
    '--pc-dock-bg': 'rgba(255,255,255,0.28)',
    '--pc-dock-radius': '26px',
    '--pc-dock-blur': '28px',
  },
  wallpapers: [
    {
      id: 'swirl',
      label: 'Spectrum Swirl (default)',
      css:
        'radial-gradient(70% 60% at 70% 25%, rgba(224,138,208,0.85) 0%, transparent 60%),' +
        'radial-gradient(70% 70% at 25% 65%, rgba(58,123,240,0.9) 0%, transparent 65%),' +
        'linear-gradient(165deg, #26134e 0%, #313a9e 55%, #101038 100%)',
    },
    {
      id: 'sunrise',
      label: 'Sunrise',
      css: 'linear-gradient(170deg, #ffb46e 0%, #f06292 45%, #4a2d8e 100%)',
    },
    { id: 'midnight', label: 'Midnight', css: '#0c0c14' },
  ],
  defaultWallpaperId: 'swirl',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: false },
  taskbar: { startLabel: '', startLogo: 'fluent', centered: true, showThemeTrayButton: true, showClock: true },
  startMenu: 'fullgrid',
  shell: { bars: ['dock'], dockPosition: 'bottom' },
};

export const chromeOS: PCThemeDefinition = {
  id: 'chromeos',
  label: 'ChromeOS',
  era: '2019',
  description: 'Light shelf, circular launcher, Google blue #1A73E8.',
  family: 'mobile',
  iconPack: 'round',
  preview: { a: '#8ab4f8', b: '#f1f3f4', c: '#1a73e8' },
  tokens: {
    ...BASE_TOKENS,
    '--pc-font': `'Roboto', 'Google Sans', 'Noto Sans', 'Segoe UI', sans-serif`,
    '--pc-titlebar-font': `'Roboto', 'Google Sans', 'Segoe UI', sans-serif`,
    '--pc-desktop-bg': '#5a8fd8',
    '--pc-surface': '#ffffff',
    '--pc-window-bg': '#ffffff',
    '--pc-window-radius': '8px',
    '--pc-window-border': 'rgba(0,0,0,0.2)',
    '--pc-content-bg': '#ffffff',
    '--pc-titlebar-bg': '#ffffff',
    '--pc-titlebar-bg-inactive': '#f1f3f4',
    '--pc-titlebar-text': '#202124',
    '--pc-titlebar-height': '32px',
    '--pc-accent': '#1a73e8',
    '--pc-taskbar-bg': 'rgba(241,243,244,0.96)',
    '--pc-taskbar-text': '#202124',
    '--pc-taskbar-height': '44px',
    '--pc-taskbar-border': 'rgba(0,0,0,0.08)',
    '--pc-menu-bg': 'rgba(255,255,255,0.98)',
    '--pc-menu-radius': '16px',
  },
  wallpapers: [
    {
      id: 'landscape',
      label: 'Highlands (default)',
      css:
        'linear-gradient(180deg, #8ec9f5 0%, #b8dcf5 42%, transparent 42%),' +
        'radial-gradient(120% 70% at 30% 100%, #4a9e6e 0%, #2e6e48 60%, #1c4a30 100%)',
    },
    {
      id: 'geometric',
      label: 'Geo Blue',
      css: 'linear-gradient(135deg, #1a73e8 0%, #5a9bf0 45%, #0d47a1 100%)',
    },
    { id: 'light', label: 'Cloud White', css: 'linear-gradient(180deg, #ffffff 0%, #dfe7ee 100%)' },
  ],
  defaultWallpaperId: 'landscape',
  window: { controls: 'gnome', controlsSide: 'right', showTitleIcon: true },
  taskbar: { startLabel: '', startLogo: 'chrome', centered: true, showThemeTrayButton: true, showClock: true },
  startMenu: 'centered11',
};
