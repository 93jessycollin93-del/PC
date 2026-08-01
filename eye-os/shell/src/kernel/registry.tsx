import { lazy } from 'react';

import type { AppManifest } from './types';

/**
 * The app roster.
 *
 * Every entry is lazy, so an app's JavaScript downloads the first time its
 * window opens and never before. On a booted image that matters twice over:
 * the desktop paints before the apps exist, and an app you never open costs
 * nothing but the bytes of this manifest.
 *
 * Adding an app is exactly one entry here plus one file in `../apps/`.
 * Nothing else in the shell imports an app directly.
 */
export const APPS: AppManifest[] = [
  {
    id: 'terminal',
    title: 'Terminal',
    tagline: 'Shell commands against the live VFS',
    glyph: '>_',
    defaultSize: { width: 660, height: 420 },
    minSize: { width: 360, height: 220 },
    component: lazy(() => import('../apps/TerminalApp')),
  },
  {
    id: 'files',
    title: 'Files',
    tagline: 'Browse and edit the filesystem',
    glyph: '🗀',
    defaultSize: { width: 720, height: 460 },
    minSize: { width: 420, height: 260 },
    component: lazy(() => import('../apps/FilesApp')),
  },
  {
    id: 'editor',
    title: 'Text Editor',
    tagline: 'Read and write files',
    glyph: '✎',
    defaultSize: { width: 620, height: 440 },
    minSize: { width: 340, height: 240 },
    component: lazy(() => import('../apps/EditorApp')),
  },
  {
    id: 'sysinfo',
    title: 'System Info',
    tagline: 'Backend, uptime, and the live IPC trace',
    glyph: 'ⓘ',
    defaultSize: { width: 640, height: 480 },
    minSize: { width: 380, height: 280 },
    component: lazy(() => import('../apps/SystemInfoApp')),
  },
  {
    id: 'settings',
    title: 'Settings',
    tagline: 'Theme and session',
    glyph: '⚙',
    defaultSize: { width: 560, height: 420 },
    minSize: { width: 340, height: 260 },
    component: lazy(() => import('../apps/SettingsApp')),
  },
];

export function findApp(appId: string): AppManifest | undefined {
  return APPS.find((app) => app.id === appId);
}
