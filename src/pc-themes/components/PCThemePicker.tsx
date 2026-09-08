import React from 'react';
import { RotateCcw } from 'lucide-react';
import { usePCTheme } from '../PCThemeContext';

/**
 * PCThemePicker — reusable theme + wallpaper chooser.
 *
 * Used in two places (same component, zero duplication):
 *   • System Settings → Appearance tab
 *   • Theme Manager app → Themes tab
 *
 * Deliberately styled with `currentColor` + translucent grays so it looks
 * right on the cosmic dark Settings panel AND on a Win95 gray dialog alike.
 */
export const PCThemePicker: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { themes, themeId, theme, isDefault, wallpaper, setTheme, setWallpaper, revertToDefault } = usePCTheme();

  return (
    <div className="space-y-4" style={{ color: 'inherit' }}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wide opacity-70">PC Theme</span>
          {!isDefault && (
            <button
              onClick={revertToDefault}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border hover:opacity-80"
              style={{ borderColor: 'rgba(127,127,127,0.45)' }}
              title="Back to the cosmic Jackie default"
            >
              <RotateCcw size={11} /> Revert to Cosmic
            </button>
          )}
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 108 : 132}px, 1fr))` }}
        >
          {themes.map(t => {
            const active = t.id === themeId;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={t.description}
                className="text-left rounded-md overflow-hidden border transition-transform hover:scale-[1.03]"
                style={{
                  borderColor: active ? 'var(--pc-accent, #6366f1)' : 'rgba(127,127,127,0.35)',
                  boxShadow: active ? '0 0 0 2px var(--pc-accent, #6366f1)' : undefined,
                }}
              >
                {/* Mini "monitor" preview painted from the theme's swatch. */}
                <div
                  className="h-12 relative"
                  style={{ background: `linear-gradient(135deg, ${t.preview.a} 0%, ${t.preview.b} 60%, ${t.preview.c} 100%)` }}
                >
                  <div
                    className="absolute left-1.5 top-1.5 right-6 h-2 rounded-[1px]"
                    style={{ background: t.preview.c, opacity: 0.9 }}
                  />
                  <div
                    className="absolute left-0 right-0 bottom-0 h-1.5"
                    style={{ background: t.preview.b, opacity: 0.9 }}
                  />
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[11px] font-bold leading-tight">{t.label}</div>
                  <div className="text-[9px] opacity-60">{t.era}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wallpaper options for the ACTIVE theme (hidden for cosmic — the
          default keeps its live gradient / AI-generated wallpaper pipeline). */}
      {!isDefault && theme.wallpapers.length > 1 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide opacity-70 mb-2">Wallpaper</div>
          <div className="flex flex-wrap gap-2">
            {theme.wallpapers.map(w => (
              <button
                key={w.id}
                onClick={() => setWallpaper(w.id)}
                title={w.label}
                className="rounded overflow-hidden border"
                style={{
                  width: 84,
                  borderColor: wallpaper.id === w.id ? 'var(--pc-accent, #6366f1)' : 'rgba(127,127,127,0.35)',
                  boxShadow: wallpaper.id === w.id ? '0 0 0 2px var(--pc-accent, #6366f1)' : undefined,
                }}
              >
                <div className="h-12" style={{ background: w.css }} />
                <div className="text-[9px] px-1 py-0.5 truncate">{w.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PCThemePicker;
