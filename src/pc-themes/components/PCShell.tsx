import React, { useEffect, useState } from 'react';
import { Grip, Power, Settings as SettingsIcon } from 'lucide-react';
import type { DesktopItem } from '../../../types';
import { usePCTheme } from '../PCThemeContext';
import { MenuLogo, PCAppIcon } from '../icons/PCIcon';
import { PCTaskbar, type PCTaskbarWindow } from './PCTaskbar';

/**
 * PCShell — dispatches the theme's shell-bar layout.
 *
 * Windows-era themes declare no `shell` config and get the classic
 * <PCTaskbar>. macOS/Linux/mobile/retro themes compose from:
 *   • 'menubar' — top strip with a system-logo menu, app label, clock
 *   • 'dock'    — bottom/left/right dock with a Launchpad overlay
 *   • 'taskbar' — the existing PCTaskbar (KDE, Android, ChromeOS)
 *
 * Same isolation contract as everything else here: rendered only inside
 * the PC scope when a non-default theme is active; drives apps through the
 * exact same launch/focus callbacks; owns zero app state.
 */

export interface PCShellProps {
  apps: DesktopItem[];
  openWindows: PCTaskbarWindow[];
  focusedId: string | null;
  onFocusWindow: (id: string) => void;
  onLaunchApp: (item: DesktopItem) => void;
  onLaunchAppId: (appId: string) => void;
  onShutDown: () => void;
}

export const PCShell: React.FC<PCShellProps> = (props) => {
  const { theme } = usePCTheme();
  const bars = theme.shell?.bars ?? ['taskbar'];
  return (
    <>
      {bars.includes('menubar') && <PCMenuBar {...props} />}
      {bars.includes('dock') && <PCDock {...props} position={theme.shell?.dockPosition ?? 'bottom'} />}
      {bars.includes('taskbar') && <PCTaskbar {...props} />}
    </>
  );
};

/* ═══ Menubar (macOS / GNOME top bar / Workbench title strip) ═══════════ */

function useClock(withDay = true): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return withDay ? `${now.toLocaleDateString([], { weekday: 'short' })} ${time}` : time;
}

const PCMenuBar: React.FC<PCShellProps> = ({ apps, onLaunchApp, onLaunchAppId, onShutDown }) => {
  const { theme } = usePCTheme();
  const [open, setOpen] = useState(false);
  const clock = useClock();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && (
        <>
          <div className="absolute inset-0" style={{ zIndex: 2890 }} onPointerDown={() => setOpen(false)} />
          <div className="pc-menubar-menu">
            <div className="overflow-y-auto" style={{ maxHeight: '52vh' }}>
              {apps.map(a => (
                <button key={a.id} className="pc-menu-item" onClick={() => { setOpen(false); onLaunchApp(a); }}>
                  <PCAppIcon item={a} pack={theme.iconPack} size={20} />
                  <span className="truncate">{a.name}</span>
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(127,127,127,0.35)' }}>
              <button className="pc-menu-item" onClick={() => { setOpen(false); onLaunchAppId('system_settings'); }}>
                System Settings…
              </button>
              <button className="pc-menu-item" onClick={() => { setOpen(false); onLaunchAppId('pc_themes'); }}>
                Appearance / Themes…
              </button>
              <button className="pc-menu-item" onClick={() => { setOpen(false); onShutDown(); }}>
                Shut Down… (back to Jackie)
              </button>
            </div>
          </div>
        </>
      )}
      <div className="pc-menubar">
        <button
          className={`pc-menubar-logo ${open ? 'pc-menubar-logo-open' : ''}`}
          onClick={() => setOpen(v => !v)}
          title="System menu"
        >
          {theme.shell?.menuLogo && <MenuLogo kind={theme.shell.menuLogo} />}
          {theme.shell?.menuLabel && <span className="font-bold">{theme.shell.menuLabel}</span>}
        </button>
        <span className="font-bold text-[12px] opacity-90">{theme.label}</span>
        <div className="flex-1" />
        <button className="opacity-80 hover:opacity-100" title="Themes" onClick={() => onLaunchAppId('pc_themes')}>
          <SettingsIcon size={13} />
        </button>
        <span className="text-[12px]">{clock}</span>
      </div>
    </>
  );
};

/* ═══ Dock (macOS / Unity launcher / Plank / iOS shelf / NeXT column) ═══ */

const PCDock: React.FC<PCShellProps & { position: 'bottom' | 'left' | 'right' }> = ({
  apps, openWindows, focusedId, onFocusWindow, onLaunchAppId, onLaunchApp, onShutDown, position,
}) => {
  const { theme } = usePCTheme();
  const [padOpen, setPadOpen] = useState(false);

  useEffect(() => {
    if (!padOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPadOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [padOpen]);

  return (
    <>
      {padOpen && (
        <div className="pc-launchpad" onPointerDown={(e) => { if (e.target === e.currentTarget) setPadOpen(false); }}>
          <div className="pc-launchpad-grid">
            {apps.map(a => (
              <button
                key={a.id}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/10"
                onClick={() => { setPadOpen(false); onLaunchApp(a); }}
              >
                <PCAppIcon item={a} pack={theme.iconPack} size={52} />
                <span className="text-[11px] text-white text-center truncate w-full" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {a.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pc-dock" data-pc-dock={position}>
        <button className="pc-dock-item" title="Launchpad — all apps" onClick={() => setPadOpen(v => !v)}>
          <span className="pc-dock-plate"><Grip size={20} /></span>
        </button>
        <span className="pc-dock-sep" />
        {openWindows.map(w => (
          <button
            key={w.id}
            className={`pc-dock-item ${focusedId === w.id ? 'pc-dock-active' : ''}`}
            title={w.title}
            onClick={() => onFocusWindow(w.id)}
          >
            <PCAppIcon item={w.item} pack={theme.iconPack} size={38} />
            <span className="pc-dock-dot" />
          </button>
        ))}
        {openWindows.length > 0 && <span className="pc-dock-sep" />}
        <button className="pc-dock-item" title="Themes" onClick={() => onLaunchAppId('pc_themes')}>
          <span className="pc-dock-plate"><SettingsIcon size={18} /></span>
        </button>
        <button className="pc-dock-item" title="Shut down (back to Jackie)" onClick={onShutDown}>
          <span className="pc-dock-plate"><Power size={18} /></span>
        </button>
      </div>
    </>
  );
};

export default PCShell;
