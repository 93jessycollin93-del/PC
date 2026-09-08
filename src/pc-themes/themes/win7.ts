import type { PCThemeDefinition } from '../types';
import { AURORA_VISTA, HARMONY_7 } from './shared';

/**
 * Windows 7 — Aero refined: lighter sky-tinted glass ("Sky" default frame
 * color), the luminous Harmony wallpaper with its central flag glow, the
 * taller translucent taskbar with big icons, and the Start orb.
 */
export const win7: PCThemeDefinition = {
  id: 'win7',
  label: 'Windows 7',
  era: '2009',
  description: 'Aero at its peak — sky glass, glowing Harmony, the beloved 7.',
  family: 'aero',
  iconPack: 'aero',
  preview: { a: '#1863b8', b: '#8cc8ff', c: '#0a2f66' },
  tokens: {
    '--pc-font': `'Segoe UI', Tahoma, Arial, sans-serif`,
    '--pc-titlebar-font': `'Segoe UI', Tahoma, Arial, sans-serif`,
    '--pc-desktop-bg': '#0a3f86',
    '--pc-surface': 'rgba(240, 246, 252, 0.96)',
    '--pc-surface-text': '#1a1a1a',
    '--pc-window-bg': 'rgba(160, 195, 225, 0.6)',
    '--pc-window-radius': '7px',
    '--pc-window-border': 'rgba(255,255,255,0.45)',
    '--pc-window-shadow': '0 8px 30px rgba(0,0,0,0.55)',
    '--pc-content-bg': '#f0f0f0',
    '--pc-titlebar-bg':
      'linear-gradient(180deg, rgba(215,235,250,0.75) 0%, rgba(160,200,235,0.65) 50%, rgba(130,175,215,0.7) 51%, rgba(175,210,240,0.65) 100%)',
    '--pc-titlebar-bg-inactive':
      'linear-gradient(180deg, rgba(215,222,228,0.6) 0%, rgba(175,185,195,0.55) 100%)',
    '--pc-titlebar-text': '#1a1a1a',
    '--pc-titlebar-text-inactive': 'rgba(30,30,30,0.6)',
    '--pc-titlebar-height': '30px',
    '--pc-bevel-light': 'rgba(255,255,255,0.6)',
    '--pc-bevel-dark': 'rgba(0,0,0,0.25)',
    '--pc-bevel-darker': 'rgba(0,0,0,0.45)',
    '--pc-accent': '#1883d7',
    '--pc-accent-text': '#ffffff',
    '--pc-taskbar-bg':
      'linear-gradient(180deg, rgba(90,120,155,0.72) 0%, rgba(35,55,85,0.78) 48%, rgba(18,32,55,0.85) 52%, rgba(45,70,105,0.78) 100%)',
    '--pc-taskbar-text': '#ffffff',
    '--pc-taskbar-height': '42px',
    '--pc-taskbar-border': 'rgba(255,255,255,0.22)',
    '--pc-taskbar-blur': '12px',
    '--pc-start-bg': 'radial-gradient(circle at 35% 30%, #9fe0ff 0%, #3d90d8 45%, #16457a 100%)',
    '--pc-start-text': '#ffffff',
    '--pc-menu-bg': 'rgba(240, 246, 252, 0.96)',
    '--pc-menu-text': '#1a1a1a',
    '--pc-menu-hover-bg': 'rgba(80, 150, 215, 0.25)',
    '--pc-menu-hover-text': '#000000',
    '--pc-menu-radius': '8px',
    '--pc-menu-blur': '14px',
    '--pc-icon-label': '#ffffff',
    '--pc-icon-label-shadow': '0 1px 3px rgba(0,0,0,0.9)',
    '--pc-icon-select-bg': 'rgba(120, 180, 230, 0.4)',
    '--pc-btn-bg': 'linear-gradient(180deg, #f8fbfe 0%, #dce9f5 100%)',
    '--pc-btn-text': '#1a1a1a',
    '--pc-field-bg': '#ffffff',
    '--pc-field-text': '#1a1a1a',
    '--pc-banner-from': '#16457a',
    '--pc-banner-to': '#3d90d8',
  },
  wallpapers: [
    { id: 'harmony', label: 'Harmony (default)', css: HARMONY_7 },
    { id: 'aurora', label: 'Aurora', css: AURORA_VISTA },
    {
      id: 'architecture',
      label: 'Architecture',
      css: 'linear-gradient(200deg, #37414d 0%, #6b7885 45%, #232a33 100%)',
    },
    {
      id: 'characters',
      label: 'Characters',
      css: 'radial-gradient(100% 120% at 30% 20%, #f3f7fa 0%, #cfe0ee 45%, #9fc0dd 100%)',
    },
  ],
  defaultWallpaperId: 'harmony',
  window: { controls: 'aero', showTitleIcon: true },
  taskbar: {
    startLabel: '',
    startLogo: 'orb',
    centered: false,
    showThemeTrayButton: true,
    showClock: true,
  },
  startMenu: 'aero',
};
