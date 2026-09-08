# PC Theme System — Multi-OS Shell Skins (Win95 → Win11)

A reusable, registry-driven theme template system that reskins the **PC
shell only**: wallpaper, desktop icons, taskbar + Start menu, window chrome,
and shell dialogs. Jackie's cosmic chat face, the Eru vault, and every
internal app's logic and state are untouched by design.

```
Default: cosmic-jackie  →  the PC looks EXACTLY as it does today.
Windows: win95 · win98 · winme · win2000 · winxp · winvista · win7
         · win8 · win10 · win11
macOS:   macos9 (Platinum) · macosx-aqua · macos-sonoma
Linux:   ubuntu-unity · gnome · kde-plasma · elementary
Mobile:  android-holo · android-material · ios6 · ios17 · chromeos
Retro:   amiga · nextstep · beos
(26 themes, all with era-authentic palettes, fonts, and shell layouts)
```

### Shell layouts

Themes declare which bars they mount via `shell.bars`:

| Layout | Used by |
|---|---|
| `['taskbar']` (default) | all Windows themes, KDE, Android, ChromeOS |
| `['menubar','dock']` | macOS Aqua/Sonoma, GNOME, Unity (left dock), elementary |
| `['menubar']` | Mac OS 9, Amiga Workbench, BeOS |
| `['dock']` | iOS 6/17 (bottom), NeXTSTEP (right column) |

`PCShell` dispatches to `PCTaskbar`, `PCMenuBar` (system-logo menu +
clock), and `PCDock` (Launchpad overlay, running-app indicator dots,
bottom/left/right edges — side docks collapse to bottom on mobile).
Window controls extend the same way: `traffic` (mac/Ubuntu lights via
`--pc-tl-*` tokens), `platinum`, `gnome`, `amiga`, `next`, plus
`controlsSide: 'left'` for the mac-style centered-title layout.

---

## 1. Architecture

```
┌ index.tsx ─ <PCThemeProvider> ────────────────────────────────┐
│  state: themeId + wallpaper choice (localStorage pc_theme_v1) │
│                                                               │
│  ┌ App.tsx — desktop surface div ──────────────────────────┐  │
│  │  data-pc-theme="win95" data-pc-family="win9x"           │  │
│  │  style={ --pc-* tokens, background: wallpaper }  ← SCOPE│  │
│  │                                                         │  │
│  │   HomeScreen → PCDesktopIcon (classic icons)            │  │
│  │   DraggableWindow → .pc-window / .pc-titlebar chrome    │  │
│  │   PCTaskbar → Start menu, task buttons, tray, clock     │  │
│  │   PCThemeManagerApp → Display Properties + PC Update    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  JackieShell (cosmic chat) — NOT inside the scope. Never      │
│  reads the context. Never restyled.                           │
└───────────────────────────────────────────────────────────────┘
```

**Isolation is by construction, not by discipline:**

1. Every selector in `pc-themes.css` is anchored to `[data-pc-family=…]`,
   which exists only on the PC desktop container. CSS cannot leak out.
2. The `cosmic` family matches **zero** selectors — with the default theme
   active the stylesheet is inert and every themed component renders its
   original pre-theme markup (verified bit-for-bit).
3. All design tokens are `--pc-*` prefixed custom properties applied inline
   on the scope element — no globals, no collisions with app CSS.
4. Apps receive the identical React subtree in every theme. Only the shell
   *around* `DraggableWindow` children changes.

### Files

```
src/pc-themes/
├── types.ts                  # PCThemeDefinition contract + storage types
├── registry.ts               # ordered list of themes = single source of truth
├── PCThemeContext.tsx        # provider, persistence, usePCTheme hooks
├── pc-themes.css             # scoped chrome CSS per family (linked in index.html)
├── themes/
│   ├── shared.ts             # CSS/SVG wallpapers (Clouds, Bliss, Aurora, …)
│   ├── cosmicJackie.ts       # the default no-op theme
│   ├── win95.ts … win11.ts   # one pure-data config per OS
├── icons/
│   └── PCIcon.tsx            # 16×16 pixel icon set, start logos, pack renderer
└── components/
    ├── PCTaskbar.tsx         # taskbar + 6 era Start-menu layouts
    ├── PCDesktopIcon.tsx     # classic desktop icon wrapper
    ├── PCWindowChrome.tsx    # era caption buttons for DraggableWindow
    ├── PCThemePicker.tsx     # theme+wallpaper picker (Settings & manager)
    └── PCThemeManagerApp.tsx # Display Properties + Arcade-style PC Update
```

### Integration points (the entire diff outside this folder)

| File | Change |
|---|---|
| `index.tsx` | wraps `<App/>` in `<PCThemeProvider>` |
| `index.html` | one `<link>` for `pc-themes.css` |
| `App.tsx` | scope attrs on the desktop div, theme wallpaper, `<PCTaskbar>`, registers the `pc_themes` app |
| `components/DraggableWindow.tsx` | themed chrome branch (same handlers/state) |
| `components/apps/HomeScreen.tsx` | themed desktop-icon branch |
| `components/apps/SystemSettingsApp.tsx` | new **Appearance** tab hosting the picker |

Eru and ocd-jacky-777 need **zero** changes: the theme system lives entirely
in this repo's shell layer. Apps imported from those projects render inside
`DraggableWindow` exactly as before.

---

## 2. Theming model

A theme is **pure data** (`PCThemeDefinition`):

- `family` selects structural CSS (bevels / Luna frame / glass / flat /
  fluent). Six families cover 1995–2021.
- `tokens` are authentic system colors as CSS variables — e.g. Win95 uses
  the real "Windows Standard" scheme (`#C0C0C0` ButtonFace, `#000080`
  ActiveTitle, `#008080` Desktop), XP uses Luna values, Win10 uses white
  titlebars + `#0078D7` + the `#E81123` close-hover.
- `wallpapers` are CSS gradients / inline SVG data-URIs (zero network,
  works offline). Real bitmaps can be added under
  `public/pc-themes/<theme>/wallpapers/` and referenced with
  `imageWallpaper('/pc-themes/win95/wallpapers/clouds.png')`.
- `iconPack` picks how apps are drawn: hand-made 16×16 pixel SVGs for the
  classic era, era plates around each app's existing lucide glyph for
  Aero/Metro/Fluent.
- `sounds` (optional) — drop files in `public/pc-themes/<theme>/sounds/`
  and reference them; `playSound()` no-ops when absent or autoplay-blocked.

### Adding a new OS/theme later

1. Create `themes/mytheme.ts` exporting a `PCThemeDefinition`
   (copy `win98.ts` as a template; reuse an existing `family`).
2. Import + append it in `registry.ts`.

Done — pickers, persistence, taskbar, Start menu, window chrome, icons and
the Update Center all pick it up automatically. Only a *brand-new chrome
structure* (e.g. macOS Platinum) would need one extra family block in
`pc-themes.css`.

---

## 3. Behavior notes

- **Toggle points:** Settings → Appearance tab · Themes desktop icon ·
  taskbar tray button · Start menu → "Themes…" · PC Update installer.
- **Revert:** one click ("Revert to Cosmic") from any picker.
- **Persistence:** `localStorage["pc_theme_v1"]`
  (`{v:1, themeId, wallpaperByTheme}`), versioned for future migration.
  Corrupt/unknown values fall back to the default silently.
- **Taskbar placement:** rendered only when a Windows theme is active AND
  the PC is full-screen (`pcMode === 'full'`); in half mode Jackie owns the
  lower half of the screen, so the taskbar stays out of her way. It sits at
  `bottom: 2rem` (above the global credits strip) with `z-index: 2800` —
  above windows, below Jackie's overlays (z-3000+).
- **"Shut Down…"** in every Start menu closes the PC surface and returns to
  Jackie — era-appropriate and safe.
- **Single-click launch** is kept on themed desktop icons (mobile-friendly;
  real Win95 double-click would regress touch).
- **Mobile fallback:** inside the PC container, taskbar grows to 46px,
  Start menus become full-width sheets, windows already auto-maximize.
- **Performance:** switching themes swaps one memoized context value + CSS
  variables on one element. App subtrees don't re-render (they don't
  consume the context). No images are fetched; icons are inline SVG.

---

## 4. Test plan

Automated smoke (run in this session with Playwright against `vite preview`,
all passing):

1. Default boot → no `.pc-taskbar`, scope is `cosmic-jackie`, desktop
   renders original glossy tiles.
2. Persisted `win95` → clouds wallpaper, classic icons, taskbar + Start.
3. Start menu opens/closes (click, Escape, click-away backdrop).
4. Launch "Themes…" → `.pc-window` chrome with navy titlebar, beveled
   caption buttons; task button appears on the taskbar.
5. Live-switch Win95 → XP → Win11 from the picker (chrome, taskbar and
   wallpaper all update without remounting the open window's content).
6. PC Update tab: Install a pack → progress bar → theme applies.
7. Revert to Cosmic → taskbar unmounts, original desktop returns,
   localStorage updated.
8. Corrupt `pc_theme_v1` JSON → boots into default, no crash.
9. Start → Shut Down → Jackie's cosmic chat, full screen.
10. 390×844 viewport with win95 → usable taskbar, maximized windows.

Manual checklist for future changes:

- [ ] Open ≥3 windows per theme; drag, resize, maximize, close.
- [ ] Verify an app with internal state (e.g. Notepad text) survives a
      theme switch unchanged.
- [ ] Check Jackie chat + Eru window look identical in every theme.
- [ ] Keyboard: Escape closes Start; ` still opens ai-term.
- [ ] Private-browsing (no localStorage) → in-memory theme still works.

### Known edge cases

- Window `zIndex` grows monotonically with focus changes; after ~2700
  focus events in one persisted session a window could stack above the
  taskbar (z 2800). Harmless and pre-existing behavior; reset by closing
  windows.
- With `pcMode === 'half'` the taskbar intentionally does not render.
- AI-generated wallpapers (Gemini ink) remain a cosmic-default feature;
  Windows themes always paint their own wallpaper.
