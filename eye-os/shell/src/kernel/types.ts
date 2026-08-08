import type { ComponentType, LazyExoticComponent } from 'react';

/** Where a window sits on the desktop, in CSS pixels. */
export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * An app's manifest. The registry holds these; nothing else in the system
 * knows an app's internals. Adding an app means adding one of these — no
 * other file changes, which is the property that keeps the shell from
 * growing a dependency web as the roster grows.
 */
export interface AppManifest {
  id: string;
  title: string;
  tagline: string;
  /** Single glyph drawn on the desktop icon and taskbar button. */
  glyph: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  /** Lazy: an app's chunk downloads the first time its window opens. */
  component: ComponentType<AppProps> | LazyExoticComponent<ComponentType<AppProps>>;
}

/** Every app receives exactly this — its window handle and the VFS. */
export interface AppProps {
  windowId: string;
}

export interface WindowInstance {
  windowId: string;
  appId: string;
  geometry: WindowGeometry;
  /** Geometry to return to when un-maximizing. */
  prevGeometry?: WindowGeometry;
  minimized: boolean;
  maximized: boolean;
}

/** A single directory entry in the VFS. */
export interface VfsEntry {
  path: string;
  kind: 'file' | 'dir';
  size: number;
  modified: number;
}
