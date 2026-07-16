import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Download, Gamepad2, Sparkles, Check } from 'lucide-react';
import { bus } from '../../../lib/bus';
import { usePCTheme } from '../PCThemeContext';
import { PCThemePicker } from './PCThemePicker';
import { PixelIcon } from '../icons/PCIcon';

/**
 * PCThemeManagerApp — "Display Properties" + "PC Update" in one window.
 *
 * A PC-shell system app (registered like any other desktop app, but it
 * lives in src/pc-themes/ because it's part of the shell, not the vault).
 * It is theme-aware: under Win95 it renders as a gray beveled dialog with
 * chunky progress bars — the Arcade95 Update-manager look — and under the
 * cosmic default it renders as a clean dark panel.
 *
 * Tabs:
 *   Themes   — full picker (themes + wallpapers + revert).
 *   Updates  — Arcade-style "Theme Pack" installer: each OS look presents
 *              as a downloadable pack with a retro progress bar; finishing
 *              the install applies the theme.
 *   Welcome  — the classic first-boot welcome card with "Did you know?"
 *              tips and the Game Pack shelf (launches the PC's REAL games —
 *              Snake, Zenith Chess, Iron Men Arcade, Laser Tag — in the
 *              spirit of Minesweeper / Pinball / SkiFree).
 */

type Tab = 'themes' | 'updates' | 'welcome';

const GAME_PACK: Array<{ appId: string; title: string; blurb: string }> = [
  { appId: 'snake', title: 'Snake', blurb: 'The timeless grid crawler. Our Minesweeper-era welcome classic.' },
  { appId: 'chess', title: 'Zenith Chess', blurb: 'Strategy pack — thinks harder than Chess.exe ever did.' },
  { appId: 'iron-men-arcade', title: 'Iron Men Arcade', blurb: 'Cabinet action in the SkiFree spirit. Watch for the yeti.' },
  { appId: 'laser-tag', title: 'Laser Tag Arcade', blurb: '3D Pinball energy — full tilt, no table required.' },
];

const TIPS = [
  'You can change this PC’s entire look from the taskbar tray or Settings → Appearance — apps keep running untouched.',
  'The Revert button always brings back the cosmic Jackie default instantly.',
  'Themes only skin the shell: wallpaper, taskbar, window chrome, icons. Your data, Eru’s vault, and Jackie herself never change.',
  'Add your own OS pack by dropping one config file into src/pc-themes/themes/ — see the README.',
  'Press ` (backtick) anywhere to drop into the ai-term console.',
];

export const PCThemeManagerApp: React.FC = () => {
  const { theme, themes, themeId, setTheme, isDefault } = usePCTheme();
  const [tab, setTab] = useState<Tab>('themes');
  const [tipIndex, setTipIndex] = useState(0);

  // Fake-install state for the Updates tab (purely cosmetic fun).
  const [installing, setInstalling] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const install = (id: string) => {
    if (installing) return;
    setInstalling(id);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + 7 + Math.random() * 12;
        if (next >= 100) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setTheme(id);
          setInstalling(null);
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`pc-btn px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors ${
        tab === t ? 'font-bold' : 'opacity-70 hover:opacity-100'
      }`}
      style={{ borderBottomColor: tab === t ? 'var(--pc-accent, #6366f1)' : 'transparent', minWidth: 0 }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="pc-dialog h-full w-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-200"
      style={!isDefault ? { background: 'var(--pc-surface)', color: 'var(--pc-surface-text)' } : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(127,127,127,0.3)' }}>
        <Monitor size={15} />
        <span className="text-sm font-bold">Display Properties — PC Themes</span>
        <span className="ml-auto text-[10px] opacity-60">Active: {theme.label}</span>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-1 px-3 pt-2 border-b shrink-0" style={{ borderColor: 'rgba(127,127,127,0.3)' }}>
        {tabBtn('themes', 'Themes')}
        {tabBtn('updates', 'PC Update')}
        {tabBtn('welcome', 'Welcome')}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'themes' && <PCThemePicker />}

        {tab === 'updates' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs opacity-75">
              <Download size={13} />
              Theme packs available for this PC. Installing a pack applies it instantly — no restart required (we’ve come a long way since 1995).
            </div>
            {themes.filter(t => t.id !== 'cosmic-jackie').map(t => {
              const isActive = t.id === themeId;
              const isInstalling = installing === t.id;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded border p-3"
                  style={{ borderColor: 'rgba(127,127,127,0.35)' }}
                >
                  <div
                    className="w-14 h-10 rounded-sm shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.preview.a}, ${t.preview.b}, ${t.preview.c})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold">{t.label} Theme Pack <span className="opacity-50 font-normal">· {t.era}</span></div>
                    <div className="text-[10px] opacity-70 truncate">{t.description}</div>
                    {isInstalling && (
                      <div className="pc-progress mt-1.5 h-3 rounded-sm overflow-hidden" style={{ background: 'rgba(127,127,127,0.25)' }}>
                        <div className="pc-progress-fill h-full" style={{ width: `${progress}%`, background: 'var(--pc-accent, #6366f1)' }} />
                      </div>
                    )}
                  </div>
                  <button
                    className="pc-btn text-[11px] px-3 py-1.5 rounded border shrink-0"
                    style={{ borderColor: 'rgba(127,127,127,0.4)' }}
                    disabled={isActive || !!installing}
                    onClick={() => install(t.id)}
                  >
                    {isActive ? <span className="flex items-center gap-1"><Check size={11} /> Installed</span>
                      : isInstalling ? `${Math.floor(progress)}%` : 'Install'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'welcome' && (
          <div className="space-y-4 max-w-2xl">
            <div className="rounded border p-4" style={{ borderColor: 'rgba(127,127,127,0.35)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} />
                <span className="text-sm font-bold">Welcome to {theme.label}</span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed mb-3">Did you know…</p>
              <p className="text-xs leading-relaxed rounded p-3" style={{ background: 'rgba(127,127,127,0.12)' }}>
                {TIPS[tipIndex % TIPS.length]}
              </p>
              <button
                className="pc-btn mt-3 text-[11px] px-3 py-1.5 rounded border"
                style={{ borderColor: 'rgba(127,127,127,0.4)' }}
                onClick={() => setTipIndex(i => i + 1)}
              >
                Next Tip
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 size={14} />
                <span className="text-xs font-bold uppercase tracking-wide opacity-70">Arcade Game Pack</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                {GAME_PACK.map(g => (
                  <div key={g.appId} className="rounded border p-3 flex gap-3" style={{ borderColor: 'rgba(127,127,127,0.35)' }}>
                    <PixelIcon icon="game" size={32} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{g.title}</div>
                      <div className="text-[10px] opacity-70 leading-snug mb-1.5">{g.blurb}</div>
                      <button
                        className="pc-btn text-[10px] px-2.5 py-1 rounded border"
                        style={{ borderColor: 'rgba(127,127,127,0.4)' }}
                        onClick={() => bus.emit('launch-app', { appId: g.appId })}
                      >
                        Play
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PCThemeManagerApp;
