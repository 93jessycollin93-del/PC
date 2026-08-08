import * as React from 'react';

import { APPS, findApp } from '../kernel/registry';
import { useWindows } from '../kernel/windows';

/** Wall clock, ticking on the minute rather than the second. */
function Clock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    // Align to the next minute boundary so the display never lags by ~59s.
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      },
      (60 - new Date().getSeconds()) * 1000,
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return (
    <div className="taskbar__clock" title={now.toDateString()}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

export function Taskbar() {
  const { windows, openApp, focusWindow, minimizeWindow } = useWindows();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const topmost = windows[windows.length - 1]?.windowId ?? null;

  // Close the launcher on Escape or on any click outside it.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.launcher, .taskbar__start')) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [menuOpen]);

  return (
    <>
      {menuOpen && (
        <div className="launcher" role="menu">
          <div className="launcher__head">Applications</div>
          {APPS.map((app) => (
            <button
              key={app.id}
              className="launcher__item"
              role="menuitem"
              onClick={() => {
                openApp(app);
                setMenuOpen(false);
              }}
            >
              <span className="launcher__glyph" aria-hidden="true">
                {app.glyph}
              </span>
              <span>
                <span className="launcher__title">{app.title}</span>
                <span className="launcher__tagline">{app.tagline}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="taskbar">
        <button
          className={`taskbar__start${menuOpen ? ' taskbar__start--open' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
        >
          <span aria-hidden="true">◈</span> Start
        </button>

        <div className="taskbar__windows">
          {windows.map((instance) => {
            const app = findApp(instance.appId);
            const active = instance.windowId === topmost && !instance.minimized;
            return (
              <button
                key={instance.windowId}
                className={`taskbar__task${active ? ' taskbar__task--active' : ''}`}
                // Clicking the focused window minimizes it — the behaviour
                // every taskbar has, and the only way to reach the desktop.
                onClick={() =>
                  active ? minimizeWindow(instance.windowId) : focusWindow(instance.windowId)
                }
                title={app?.tagline}
              >
                <span aria-hidden="true">{app?.glyph ?? '▢'}</span>
                <span className="taskbar__task-label">{app?.title ?? instance.appId}</span>
              </button>
            );
          })}
        </div>

        <Clock />
      </div>
    </>
  );
}
