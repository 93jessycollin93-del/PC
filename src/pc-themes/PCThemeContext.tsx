import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  PCThemeDefinition, PCThemeId, PCThemePersistedState, PCWallpaper,
} from './types';
import { PC_DEFAULT_THEME_ID, PC_THEME_STORAGE_KEY } from './types';
import { getPCTheme, isKnownPCTheme, PC_THEMES } from './registry';

/**
 * PCThemeProvider — the one stateful piece of the theme system.
 *
 * ISOLATION: this context is consumed ONLY by PC-shell components
 * (desktop surface, taskbar, DraggableWindow chrome, desktop icons,
 * Settings' Appearance tab, Theme Manager app). Jackie's cosmic chat and
 * every internal app never read it, so switching themes cannot affect
 * their logic or state. While `isDefault` is true, every consumer renders
 * its original pre-theme markup — a zero-cost passthrough.
 *
 * PERFORMANCE: theme switching swaps a memoized context value + a set of
 * CSS custom properties on ONE container element. App subtrees don't
 * re-render (they don't consume the context); the browser repaints chrome
 * only. Wallpapers are CSS gradients/SVG data-URIs — no network requests.
 */

interface PCThemeContextValue {
  /** The active theme definition (never null — falls back to default). */
  theme: PCThemeDefinition;
  themeId: PCThemeId;
  /** True when cosmic-jackie is active → all consumers render original UI. */
  isDefault: boolean;
  /** Every registered theme, in display order. */
  themes: PCThemeDefinition[];
  /** The active wallpaper for the current theme. */
  wallpaper: PCWallpaper;
  setTheme: (id: PCThemeId) => void;
  setWallpaper: (wallpaperId: string) => void;
  /** One-tap revert to the cosmic-jackie default. */
  revertToDefault: () => void;
  /** Play an optional theme sound; silently no-ops when absent/blocked. */
  playSound: (kind: 'startup' | 'open' | 'close' | 'error') => void;
  /**
   * Props for the PC scope container: data attributes that activate the
   * scoped CSS plus the theme's CSS variables as inline style. Spread them
   * on the desktop-surface element only.
   */
  scopeProps: {
    'data-pc-theme': string;
    'data-pc-family': string;
    style: CSSProperties;
  };
}

const PCThemeContext = createContext<PCThemeContextValue | null>(null);

/* ── persistence (defensive: storage may be unavailable/corrupt) ───────── */

function loadPersisted(): PCThemePersistedState {
  const fallback: PCThemePersistedState = {
    v: 1, themeId: PC_DEFAULT_THEME_ID, wallpaperByTheme: {},
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PC_THEME_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || typeof parsed.themeId !== 'string') return fallback;
    return {
      v: 1,
      // A theme removed in a later release must not brick the shell:
      themeId: isKnownPCTheme(parsed.themeId) ? parsed.themeId : PC_DEFAULT_THEME_ID,
      wallpaperByTheme:
        parsed.wallpaperByTheme && typeof parsed.wallpaperByTheme === 'object'
          ? parsed.wallpaperByTheme
          : {},
    };
  } catch {
    return fallback;
  }
}

function savePersisted(state: PCThemePersistedState) {
  try { localStorage.setItem(PC_THEME_STORAGE_KEY, JSON.stringify(state)); } catch { /* quota/private mode — keep in-memory state */ }
}

/* ── provider ──────────────────────────────────────────────────────────── */

export const PCThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [persisted, setPersisted] = useState<PCThemePersistedState>(loadPersisted);

  useEffect(() => { savePersisted(persisted); }, [persisted]);

  const theme = getPCTheme(persisted.themeId);
  const isDefault = theme.id === PC_DEFAULT_THEME_ID;

  const wallpaper = useMemo<PCWallpaper>(() => {
    const chosenId = persisted.wallpaperByTheme[theme.id] ?? theme.defaultWallpaperId;
    return (
      theme.wallpapers.find(w => w.id === chosenId) ||
      theme.wallpapers.find(w => w.id === theme.defaultWallpaperId) ||
      theme.wallpapers[0]
    );
  }, [theme, persisted.wallpaperByTheme]);

  const setTheme = useCallback((id: PCThemeId) => {
    setPersisted(prev => ({ ...prev, themeId: isKnownPCTheme(id) ? id : PC_DEFAULT_THEME_ID }));
  }, []);

  const setWallpaper = useCallback((wallpaperId: string) => {
    setPersisted(prev => ({
      ...prev,
      wallpaperByTheme: { ...prev.wallpaperByTheme, [prev.themeId]: wallpaperId },
    }));
  }, []);

  const revertToDefault = useCallback(() => setTheme(PC_DEFAULT_THEME_ID), [setTheme]);

  const playSound = useCallback((kind: 'startup' | 'open' | 'close' | 'error') => {
    const url = theme.sounds?.[kind];
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.volume = 0.4;
      void audio.play().catch(() => { /* autoplay blocked — stay silent */ });
    } catch { /* no Audio support — stay silent */ }
  }, [theme]);

  const scopeProps = useMemo(
    () => ({
      'data-pc-theme': theme.id,
      'data-pc-family': theme.family,
      style: theme.tokens as CSSProperties,
    }),
    [theme]
  );

  const value = useMemo<PCThemeContextValue>(
    () => ({
      theme, themeId: theme.id, isDefault, themes: PC_THEMES, wallpaper,
      setTheme, setWallpaper, revertToDefault, playSound, scopeProps,
    }),
    [theme, isDefault, wallpaper, setTheme, setWallpaper, revertToDefault, playSound, scopeProps]
  );

  return <PCThemeContext.Provider value={value}>{children}</PCThemeContext.Provider>;
};

/* ── hooks ─────────────────────────────────────────────────────────────── */

/** Strict hook for components that only exist inside the PC shell. */
export function usePCTheme(): PCThemeContextValue {
  const ctx = useContext(PCThemeContext);
  if (!ctx) throw new Error('usePCTheme must be used within <PCThemeProvider>');
  return ctx;
}

/**
 * Optional hook for shared components (DraggableWindow, HomeScreen) that
 * must keep working even if rendered without the provider — e.g. in tests
 * or if the provider is ever removed. Returns null in that case, which
 * consumers treat exactly like the default theme (original markup).
 */
export function usePCThemeOptional(): PCThemeContextValue | null {
  return useContext(PCThemeContext);
}
