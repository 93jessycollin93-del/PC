import React, { useEffect, useMemo, useState } from 'react';
import { Power, Search, Settings as SettingsIcon } from 'lucide-react';
import type { DesktopItem } from '../../../types';
import { usePCTheme } from '../PCThemeContext';
import { PCAppIcon, StartLogo } from '../icons/PCIcon';

/**
 * PCTaskbar — the themed taskbar + Start menu for the PC shell.
 *
 * Rendered by App.tsx ONLY when a non-default theme is active and the PC
 * is full-screen, inside the PC scope container — it can never appear over
 * Jackie's chat (its z-index stays below Jackie's overlay layer).
 *
 * Pure shell: it launches/focuses apps through the same callbacks the
 * desktop already uses. It owns zero app state.
 */

export interface PCTaskbarWindow {
  id: string;
  title: string;
  item: DesktopItem;
}

interface PCTaskbarProps {
  apps: DesktopItem[];
  openWindows: PCTaskbarWindow[];
  focusedId: string | null;
  onFocusWindow: (id: string) => void;
  onLaunchApp: (item: DesktopItem) => void;
  /** Launch by appId (Settings / Theme Manager shortcuts). */
  onLaunchAppId: (appId: string) => void;
  /** "Shut Down…" — closes the PC surface and returns to Jackie. */
  onShutDown: () => void;
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const PCTaskbar: React.FC<PCTaskbarProps> = ({
  apps, openWindows, focusedId, onFocusWindow, onLaunchApp, onLaunchAppId, onShutDown,
}) => {
  const { theme } = usePCTheme();
  const [startOpen, setStartOpen] = useState(false);
  const clock = useClock();

  // Escape closes the Start menu (parity with real Windows).
  useEffect(() => {
    if (!startOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStartOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startOpen]);

  const launch = (item: DesktopItem) => {
    setStartOpen(false);
    onLaunchApp(item);
  };
  const launchId = (appId: string) => {
    setStartOpen(false);
    onLaunchAppId(appId);
  };

  return (
    <>
      {startOpen && (
        <>
          {/* Click-away backdrop, confined to the PC scope container. */}
          <div
            className="absolute inset-0"
            style={{ zIndex: 2890 }}
            onPointerDown={() => setStartOpen(false)}
          />
          <PCStartMenu
            apps={apps}
            onLaunch={launch}
            onLaunchAppId={launchId}
            onShutDown={() => { setStartOpen(false); onShutDown(); }}
          />
        </>
      )}

      <div className="pc-taskbar">
        <button
          className={`pc-start-btn ${startOpen ? 'pc-start-open' : ''}`}
          onClick={() => setStartOpen(v => !v)}
          title="Start"
        >
          <StartLogo kind={theme.taskbar.startLogo} size={theme.taskbar.startLogo === 'orb' ? 20 : 17} />
          {theme.taskbar.startLabel && <span>{theme.taskbar.startLabel}</span>}
        </button>

        {/* Running windows */}
        <div className="flex items-center gap-[3px] min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {openWindows.map(w => (
            <button
              key={w.id}
              className={`pc-task-btn ${focusedId === w.id ? 'pc-task-active' : ''}`}
              onClick={() => onFocusWindow(w.id)}
              title={w.title}
            >
              <PCAppIcon item={w.item} pack={theme.iconPack} size={16} />
              <span className="truncate">{w.title}</span>
            </button>
          ))}
        </div>

        <div className="pc-tray">
          {theme.taskbar.showThemeTrayButton && (
            <button
              onClick={() => launchId('pc_themes')}
              title="Themes — change the PC's look"
              className="hover:opacity-80"
              style={{ display: 'inline-flex' }}
            >
              <PCAppIcon
                item={{ appId: 'pc_themes', name: 'Themes', type: 'app', icon: SettingsIcon as DesktopItem['icon'] }}
                pack={theme.iconPack}
                size={16}
              />
            </button>
          )}
          {theme.taskbar.showClock && <span>{clock}</span>}
        </div>
      </div>
    </>
  );
};

/* ═══ Start menu — one component, six era layouts ════════════════════════ */

interface PCStartMenuProps {
  apps: DesktopItem[];
  onLaunch: (item: DesktopItem) => void;
  onLaunchAppId: (appId: string) => void;
  onShutDown: () => void;
}

const PCStartMenu: React.FC<PCStartMenuProps> = (props) => {
  const { theme } = usePCTheme();
  switch (theme.startMenu) {
    case 'classic': return <StartClassic {...props} />;
    case 'luna': return <StartLuna {...props} />;
    case 'aero': return <StartAero {...props} />;
    case 'fullgrid': return <StartFullGrid {...props} />;
    case 'list10': return <StartList10 {...props} />;
    case 'centered11': return <StartCentered11 {...props} />;
  }
};

const MenuRow: React.FC<{
  item: DesktopItem; size?: number; onLaunch: (item: DesktopItem) => void;
}> = ({ item, size = 32, onLaunch }) => {
  const { theme } = usePCTheme();
  return (
    <button className="pc-menu-item" onClick={() => onLaunch(item)}>
      <PCAppIcon item={item} pack={theme.iconPack} size={size} />
      <span className="truncate">{item.name}</span>
    </button>
  );
};

/** Win 95/98/ME/2000: vertical OS banner + single column + system rows. */
const StartClassic: React.FC<PCStartMenuProps> = ({ apps, onLaunch, onLaunchAppId, onShutDown }) => {
  const { theme } = usePCTheme();
  return (
    <div className="pc-startmenu" style={{ width: 300, maxHeight: '68vh' }}>
      <div className="pc-startmenu-banner"><span>{theme.label}</span></div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(68vh - 110px)' }}>
          {apps.map(a => <MenuRow key={a.id} item={a} onLaunch={onLaunch} />)}
        </div>
        <div style={{ borderTop: '1px solid var(--pc-bevel-dark)', boxShadow: '0 1px 0 var(--pc-bevel-light) inset' }}>
          <button className="pc-menu-item" onClick={() => onLaunchAppId('system_settings')}>
            <PCAppIcon item={{ id: '', name: 'Settings', type: 'app' } as DesktopItem} pack={theme.iconPack} size={24} />
            <span>Settings</span>
          </button>
          <button className="pc-menu-item" onClick={() => onLaunchAppId('pc_themes')}>
            <PCAppIcon item={{ id: '', name: 'Display Themes', type: 'app' } as DesktopItem} pack={theme.iconPack} size={24} />
            <span>Themes…</span>
          </button>
          <button className="pc-menu-item" onClick={onShutDown}>
            <PCAppIcon item={{ id: '', name: 'Shut Down computer', type: 'app' } as DesktopItem} pack={theme.iconPack} size={24} />
            <span>Shut Down… (back to Jackie)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/** Windows XP Luna: blue header, white app column, sky-blue side column. */
const StartLuna: React.FC<PCStartMenuProps> = ({ apps, onLaunch, onLaunchAppId, onShutDown }) => {
  const { theme } = usePCTheme();
  return (
    <div className="pc-startmenu flex-col" style={{ width: 400, maxHeight: '70vh', borderRadius: '8px 8px 0 0' }}>
      <div
        className="flex items-center gap-2 px-3 py-2 text-white font-bold"
        style={{ background: 'linear-gradient(180deg, var(--pc-banner-to) 0%, var(--pc-banner-from) 100%)' }}
      >
        <span
          className="inline-flex items-center justify-center rounded"
          style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.6)' }}
        >
          <StartLogo kind="flagxp" size={18} />
        </span>
        Jessy
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto bg-white" style={{ minWidth: 0 }}>
          {apps.map(a => <MenuRow key={a.id} item={a} onLaunch={onLaunch} />)}
        </div>
        <div className="w-36 shrink-0 flex flex-col gap-1 p-2" style={{ background: '#d3e5fa', borderLeft: '1px solid #95bdee' }}>
          <button className="pc-menu-item" onClick={() => onLaunchAppId('system_settings')}>Control Panel</button>
          <button className="pc-menu-item" onClick={() => onLaunchAppId('pc_themes')}>Display Themes</button>
          <button className="pc-menu-item" onClick={() => onLaunchAppId('pc_themes')}>Windows Update</button>
        </div>
      </div>
      <div
        className="flex justify-end px-3 py-1.5 text-white text-xs"
        style={{ background: 'linear-gradient(180deg, var(--pc-banner-from) 0%, var(--pc-banner-to) 100%)' }}
      >
        <button className="flex items-center gap-1.5 hover:opacity-80" onClick={onShutDown}>
          <Power size={13} /> Turn Off Computer
        </button>
      </div>
    </div>
  );
};

/** Vista / 7 Aero: dark glass with a search box. */
const StartAero: React.FC<PCStartMenuProps> = ({ apps, onLaunch, onLaunchAppId, onShutDown }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => apps.filter(a => a.name.toLowerCase().includes(q.toLowerCase())),
    [apps, q]
  );
  return (
    <div className="pc-startmenu flex-col" style={{ width: 340, maxHeight: '70vh' }}>
      <div className="overflow-y-auto flex-1 p-1.5">
        {filtered.map(a => <MenuRow key={a.id} item={a} size={28} onLaunch={onLaunch} />)}
        {filtered.length === 0 && <div className="px-3 py-4 text-xs opacity-60">No items match your search.</div>}
      </div>
      <div className="flex items-center gap-2 p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-center gap-1.5 flex-1 pc-field" style={{ borderRadius: 999 }}>
          <Search size={12} className="opacity-60 shrink-0" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search programs and files"
            className="bg-transparent outline-none w-full text-xs"
            style={{ color: 'inherit' }}
          />
        </div>
        <button className="pc-btn" style={{ minWidth: 0 }} onClick={() => onLaunchAppId('pc_themes')}>Themes</button>
        <button className="pc-btn" style={{ minWidth: 0 }} title="Shut down (back to Jackie)" onClick={onShutDown}>
          <Power size={13} />
        </button>
      </div>
    </div>
  );
};

/** Windows 8: near-fullscreen Start screen of live-style tiles. */
const StartFullGrid: React.FC<PCStartMenuProps> = ({ apps, onLaunch, onLaunchAppId, onShutDown }) => (
  <div className="pc-startmenu flex-col" style={{ padding: '18px 24px' }}>
    <div className="flex items-center justify-between mb-4 shrink-0">
      <span className="text-3xl font-light" style={{ fontFamily: 'var(--pc-titlebar-font)' }}>Start</span>
      <div className="flex items-center gap-2">
        <button className="pc-btn" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: 'none' }} onClick={() => onLaunchAppId('pc_themes')}>
          Themes
        </button>
        <button className="pc-btn" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: 'none', minWidth: 0 }} onClick={onShutDown}>
          <Power size={14} />
        </button>
      </div>
    </div>
    <div className="grid gap-2 overflow-y-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {apps.map(a => {
        const L = a.icon;
        return (
          <button key={a.id} className="pc-tile" style={{ height: 78, background: 'rgba(255,255,255,0.14)' }} onClick={() => onLaunch(a)}>
            {L && <L size={22} color="#fff" />}
            <span className="text-[11px] text-left leading-tight">{a.name}</span>
          </button>
        );
      })}
    </div>
  </div>
);

/** Windows 10: app list + tile pane over dark acrylic. */
const StartList10: React.FC<PCStartMenuProps> = ({ apps, onLaunch, onLaunchAppId, onShutDown }) => (
  <div className="pc-startmenu" style={{ width: 460, height: 'min(66vh, 520px)' }}>
    <div className="flex flex-col justify-end items-center gap-2 p-1.5 shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <button title="Themes" className="p-2 hover:bg-white/10 rounded" onClick={() => onLaunchAppId('pc_themes')}>
        <SettingsIcon size={15} />
      </button>
      <button title="Power (back to Jackie)" className="p-2 hover:bg-white/10 rounded" onClick={onShutDown}>
        <Power size={15} />
      </button>
    </div>
    <div className="w-48 shrink-0 overflow-y-auto py-1">
      {apps.map(a => <MenuRow key={a.id} item={a} size={22} onLaunch={onLaunch} />)}
    </div>
    <div className="flex-1 p-3 overflow-y-auto">
      <div className="text-[11px] opacity-70 mb-2">Pinned</div>
      <div className="grid grid-cols-3 gap-1.5">
        {apps.slice(0, 12).map(a => {
          const L = a.icon;
          return (
            <button key={a.id} className="pc-tile" style={{ height: 84 }} onClick={() => onLaunch(a)}>
              {L && <L size={20} color="#fff" />}
              <span className="text-[10px] text-left leading-tight">{a.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

/** Windows 11: centered acrylic panel with pinned grid + footer. */
const StartCentered11: React.FC<PCStartMenuProps> = ({ apps, onLaunch, onLaunchAppId, onShutDown }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => apps.filter(a => a.name.toLowerCase().includes(q.toLowerCase())),
    [apps, q]
  );
  const { theme } = usePCTheme();
  return (
    <div className="pc-startmenu flex-col" style={{ width: 'min(560px, 94%)', maxHeight: '70vh', padding: 14 }}>
      <div className="pc-field flex items-center gap-2 mb-3 shrink-0" style={{ borderRadius: 999 }}>
        <Search size={13} className="opacity-60 shrink-0" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search for apps, settings, and documents"
          className="bg-transparent outline-none w-full text-xs"
          style={{ color: 'inherit' }}
        />
      </div>
      <div className="text-[11px] font-semibold opacity-80 mb-2 shrink-0">Pinned</div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 overflow-y-auto">
        {filtered.map(a => (
          <button
            key={a.id}
            className="flex flex-col items-center gap-1.5 rounded-md px-1 py-2"
            style={{ minWidth: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--pc-menu-hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onLaunch(a)}
          >
            <PCAppIcon item={a} pack={theme.iconPack} size={34} />
            <span className="text-[10px] truncate w-full text-center">{a.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 mt-2 shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
        <button className="flex items-center gap-2 text-xs hover:opacity-70" onClick={() => onLaunchAppId('pc_themes')}>
          <SettingsIcon size={14} /> Personalize
        </button>
        <button title="Power (back to Jackie)" className="p-2 rounded hover:opacity-70" onClick={onShutDown}>
          <Power size={15} />
        </button>
      </div>
    </div>
  );
};

export default PCTaskbar;
