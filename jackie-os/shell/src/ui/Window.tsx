import * as React from 'react';

import { findApp } from '../kernel/registry';
import { useWindows } from '../kernel/windows';
import type { WindowInstance } from '../kernel/types';

/**
 * Drag and resize run on pointer events captured to the grab handle, so a
 * fast drag that outruns the cursor still tracks — the handle keeps receiving
 * events after the pointer has left it. Geometry is committed to the window
 * manager on every move; React batches, and the alternative (local state that
 * syncs on release) drifts out of step with a maximize during a drag.
 */

interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export function Window({
  instance,
  focused,
  depth,
}: {
  instance: WindowInstance;
  focused: boolean;
  /** Position in the stacking order — becomes this window's z-index. */
  depth: number;
}) {
  const { closeWindow, focusWindow, minimizeWindow, toggleMaximize, moveWindow, resizeWindow } =
    useWindows();
  const app = findApp(instance.appId);
  const drag = React.useRef<DragState | null>(null);
  const resize = React.useRef<ResizeState | null>(null);

  // An app removed from the registry must not strand an unclosable window.
  if (!app) {
    return (
      <div className="window window--orphan" style={{ left: 40, top: 40, width: 320, height: 140 }}>
        <div className="window__titlebar">
          <span className="window__title">Unknown app</span>
          <button className="window__btn" onClick={() => closeWindow(instance.windowId)}>
            ✕
          </button>
        </div>
        <div className="window__content window__content--pad">
          No app registered for <code>{instance.appId}</code>.
        </div>
      </div>
    );
  }

  const AppComponent = app.component;
  const { geometry, maximized } = instance;

  const onTitlePointerDown = (event: React.PointerEvent) => {
    if (maximized) return;
    if ((event.target as HTMLElement).closest('.window__btn')) return;
    focusWindow(instance.windowId);
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - geometry.x,
      offsetY: event.clientY - geometry.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onTitlePointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    moveWindow(instance.windowId, event.clientX - state.offsetX, event.clientY - state.offsetY);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  const onResizePointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
    focusWindow(instance.windowId);
    resize.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: geometry.width,
      startHeight: geometry.height,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onResizePointerMove = (event: React.PointerEvent) => {
    const state = resize.current;
    if (!state || state.pointerId !== event.pointerId) return;
    resizeWindow(
      instance.windowId,
      Math.max(app.minSize.width, state.startWidth + (event.clientX - state.startX)),
      Math.max(app.minSize.height, state.startHeight + (event.clientY - state.startY)),
    );
  };

  const endResize = (event: React.PointerEvent) => {
    if (resize.current?.pointerId !== event.pointerId) return;
    resize.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  const style: React.CSSProperties = maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - var(--taskbar-height, 44px))' }
    : { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height };

  return (
    <div
      className={`window${focused ? ' window--focused' : ''}`}
      style={{
        ...style,
        // Windows occupy 1..N; the taskbar sits at 50 and the launcher above
        // that, so the chrome stays reachable however deep the stack gets.
        zIndex: 1 + depth,
        display: instance.minimized ? 'none' : undefined,
      }}
      onPointerDown={() => focusWindow(instance.windowId)}
      role="dialog"
      aria-label={app.title}
    >
      <div
        className="window__titlebar"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => toggleMaximize(instance.windowId)}
      >
        <span className="window__glyph" aria-hidden="true">
          {app.glyph}
        </span>
        <span className="window__title">{app.title}</span>
        <div className="window__actions">
          <button
            className="window__btn"
            onClick={() => minimizeWindow(instance.windowId)}
            aria-label="Minimize"
            title="Minimize"
          >
            −
          </button>
          <button
            className="window__btn"
            onClick={() => toggleMaximize(instance.windowId)}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? '❐' : '▢'}
          </button>
          <button
            className="window__btn window__btn--close"
            onClick={() => closeWindow(instance.windowId)}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="window__content">
        <React.Suspense fallback={<div className="window__loading">Loading {app.title}…</div>}>
          <AppComponent windowId={instance.windowId} />
        </React.Suspense>
      </div>

      {!maximized && (
        <div
          className="window__resize"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
