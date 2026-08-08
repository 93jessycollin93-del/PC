/**
 * The window manager — the shell's compositor.
 *
 * Stacking order is the array order: index 0 is furthest back, the last entry
 * is topmost. Focusing moves an entry to the end rather than juggling z-index
 * numbers, which means the order is always well-defined and there is no
 * counter to overflow.
 *
 * The layout persists through the VFS, so where it is written depends on the
 * backend that won the probe at boot — a browser profile in a tab, a real file
 * on a booted machine. This module does not know which.
 */
import * as React from 'react';

import { bus } from './bus';
import { vfs } from './vfs';
import type { AppManifest, WindowGeometry, WindowInstance } from './types';

const LAYOUT_PATH = '/system/session/windows.json';
const TASKBAR_HEIGHT = 44;

interface WindowManagerValue {
  windows: WindowInstance[];
  /** False until the saved layout has been read back — suppresses a flash of empty desktop. */
  restored: boolean;
  openApp: (app: AppManifest) => void;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximize: (windowId: string) => void;
  moveWindow: (windowId: string, x: number, y: number) => void;
  resizeWindow: (windowId: string, width: number, height: number) => void;
}

const Context = React.createContext<WindowManagerValue | null>(null);

function newWindowId(): string {
  return `win_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Keeps a window's titlebar reachable. A saved layout from a 4K desktop must
 * not strand windows off-screen when the same image boots at 1024x768, so
 * geometry is clamped on restore as well as on move.
 */
function clampToViewport(geometry: WindowGeometry): WindowGeometry {
  if (typeof window === 'undefined') return geometry;
  const maxX = Math.max(0, window.innerWidth - 120);
  const maxY = Math.max(0, window.innerHeight - TASKBAR_HEIGHT - 40);
  return {
    ...geometry,
    x: Math.min(Math.max(geometry.x, -geometry.width + 120), maxX),
    y: Math.min(Math.max(geometry.y, 0), maxY),
  };
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = React.useState<WindowInstance[]>([]);
  const [restored, setRestored] = React.useState(false);
  const cascade = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await vfs().read(LAYOUT_PATH);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as WindowInstance[];
          // Fresh IDs: the saved ones belong to a session that has ended.
          setWindows(
            saved.map((w) => ({
              ...w,
              windowId: newWindowId(),
              geometry: clampToViewport(w.geometry),
            })),
          );
        }
      } catch {
        // A corrupt layout must not cost you a usable desktop.
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after restore only, so the initial empty state never overwrites a
  // saved layout during the read.
  React.useEffect(() => {
    if (!restored) return;
    void vfs()
      .write(LAYOUT_PATH, JSON.stringify(windows))
      .catch(() => {
        /* a full disk should not break window management */
      });
  }, [windows, restored]);

  // Every publish below happens in the event handler, never inside a state
  // updater. StrictMode deliberately double-invokes updaters to surface
  // impurity, and an `emit` in there would double every entry in the IPC
  // trace under `npm run dev` while looking correct in a production build.

  const focusWindow = React.useCallback(
    (windowId: string) => {
      const target = windows.find((w) => w.windowId === windowId);
      if (!target) return;
      // Already topmost and visible — skip both the churn and the event.
      if (windows[windows.length - 1]?.windowId === windowId && !target.minimized) return;
      setWindows((prev) => {
        const current = prev.find((w) => w.windowId === windowId);
        if (!current) return prev;
        return [
          ...prev.filter((w) => w.windowId !== windowId),
          { ...current, minimized: false },
        ];
      });
      bus.emit('window-focused', { appId: target.appId, windowId });
    },
    [windows],
  );

  const openApp = React.useCallback(
    (app: AppManifest) => {
      const existing = windows.find((w) => w.appId === app.id);
      if (existing) {
        setWindows((prev) => {
          const current = prev.find((w) => w.windowId === existing.windowId);
          if (!current) return prev;
          return [
            ...prev.filter((w) => w.windowId !== existing.windowId),
            { ...current, minimized: false },
          ];
        });
        bus.emit('window-focused', { appId: app.id, windowId: existing.windowId });
        return;
      }
      const step = cascade.current++ % 6;
      const instance: WindowInstance = {
        windowId: newWindowId(),
        appId: app.id,
        geometry: clampToViewport({
          x: 88 + step * 30,
          y: 56 + step * 26,
          width: app.defaultSize.width,
          height: app.defaultSize.height,
        }),
        minimized: false,
        maximized: false,
      };
      setWindows((prev) => [...prev, instance]);
      bus.emit('window-opened', { appId: app.id, windowId: instance.windowId });
    },
    [windows],
  );

  const closeWindow = React.useCallback(
    (windowId: string) => {
      const target = windows.find((w) => w.windowId === windowId);
      setWindows((prev) => prev.filter((w) => w.windowId !== windowId));
      if (target) bus.emit('window-closed', { appId: target.appId, windowId });
    },
    [windows],
  );

  const minimizeWindow = React.useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.windowId === windowId ? { ...w, minimized: true } : w)),
    );
  }, []);

  const toggleMaximize = React.useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.windowId !== windowId) return w;
        if (w.maximized) {
          return {
            ...w,
            maximized: false,
            geometry: w.prevGeometry ?? w.geometry,
            prevGeometry: undefined,
          };
        }
        return { ...w, maximized: true, prevGeometry: w.geometry };
      }),
    );
  }, []);

  const moveWindow = React.useCallback((windowId: string, x: number, y: number) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.windowId === windowId
          ? { ...w, geometry: clampToViewport({ ...w.geometry, x, y }) }
          : w,
      ),
    );
  }, []);

  const resizeWindow = React.useCallback((windowId: string, width: number, height: number) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.windowId === windowId ? { ...w, geometry: { ...w.geometry, width, height } } : w,
      ),
    );
  }, []);

  const value = React.useMemo<WindowManagerValue>(
    () => ({
      windows,
      restored,
      openApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      toggleMaximize,
      moveWindow,
      resizeWindow,
    }),
    [
      windows,
      restored,
      openApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      toggleMaximize,
      moveWindow,
      resizeWindow,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWindows(): WindowManagerValue {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error('useWindows must be used inside WindowManagerProvider');
  return ctx;
}

export { TASKBAR_HEIGHT };
