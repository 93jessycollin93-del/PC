import * as React from 'react';

import { APPS } from '../kernel/registry';
import { useWindows } from '../kernel/windows';
import { Taskbar } from './Taskbar';
import { Notifications } from './Notifications';
import { Window } from './Window';

/**
 * The desktop: icon grid at the back, window stack over it, taskbar on top.
 *
 * Stacking is done with z-index, not DOM order, and that is load-bearing
 * rather than stylistic. Windows focus on pointerdown; if focusing also
 * reordered the children, React would move the DOM node mid-gesture and the
 * browser would never deliver the `click` — pressing Minimize on an unfocused
 * window would raise it and do nothing else, and you would have to click
 * twice. Rendering in a stable order and painting by z-index keeps every node
 * put for the whole press.
 *
 * Window IDs embed their creation timestamp, so sorting by ID is stable and
 * gives the oldest window the lowest slot.
 */
export function Desktop() {
  const { windows, restored, openApp } = useWindows();
  const [selected, setSelected] = React.useState<string | null>(null);
  const topmost = windows[windows.length - 1]?.windowId ?? null;

  // `windows` is the stacking order; this is the render order.
  const { stableOrder, depth } = React.useMemo(() => {
    const byStack = new Map(windows.map((w, index) => [w.windowId, index]));
    return {
      stableOrder: [...windows].sort((a, b) => a.windowId.localeCompare(b.windowId)),
      depth: byStack,
    };
  }, [windows]);

  return (
    <div className="desktop">
      <div
        className="desktop__icons"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}
      >
        {APPS.map((app) => (
          <button
            key={app.id}
            className={`icon${selected === app.id ? ' icon--selected' : ''}`}
            onClick={() => setSelected(app.id)}
            onDoubleClick={() => openApp(app)}
            // A single tap has to open an app on a touchscreen — there is no
            // double-click there, and the kiosk image may well be a tablet.
            onTouchEnd={(event) => {
              event.preventDefault();
              openApp(app);
            }}
            title={app.tagline}
          >
            <span className="icon__glyph" aria-hidden="true">
              {app.glyph}
            </span>
            <span className="icon__label">{app.title}</span>
          </button>
        ))}
      </div>

      {restored &&
        stableOrder.map((instance) => (
          <Window
            key={instance.windowId}
            instance={instance}
            focused={instance.windowId === topmost}
            depth={depth.get(instance.windowId) ?? 0}
          />
        ))}

      <Notifications />
      <Taskbar />
    </div>
  );
}
