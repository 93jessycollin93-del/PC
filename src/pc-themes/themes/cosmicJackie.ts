import type { PCThemeDefinition } from '../types';

/**
 * cosmic-jackie — THE DEFAULT. This theme is a deliberate no-op:
 * while it is active every themed component renders its original,
 * pre-theme-system markup, so the beautiful cosmic Jackie face and the
 * existing PC visuals are preserved bit-for-bit. It exists in the registry
 * only so pickers can show it and users can revert to it.
 */
export const cosmicJackie: PCThemeDefinition = {
  id: 'cosmic-jackie',
  label: 'Cosmic Jackie',
  era: 'Default',
  description: 'The original cosmic PC — Jackie’s home look. Zero overrides.',
  family: 'cosmic',
  iconPack: 'cosmic',
  preview: { a: '#312e81', b: '#7c3aed', c: '#db2777' },
  tokens: {},
  wallpapers: [
    // Kept for picker completeness; the cosmic desktop keeps its live
    // gradient / AI-generated wallpaper pipeline untouched.
    { id: 'cosmic', label: 'Cosmic Nebula', css: '' },
  ],
  defaultWallpaperId: 'cosmic',
  window: { controls: 'fluent', showTitleIcon: true },
  taskbar: {
    startLabel: '',
    startLogo: 'fluent',
    centered: false,
    showThemeTrayButton: true,
    showClock: true,
  },
  startMenu: 'list10',
};
