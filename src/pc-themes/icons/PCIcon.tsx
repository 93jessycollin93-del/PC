import React from 'react';
import type { DesktopItem } from '../../../types';
import type { PCIconPack } from '../types';

/**
 * PC Icon System — classic pixel icons + per-era start logos.
 *
 * The classic packs (Win95/98/ME/2000/XP) use hand-placed 16×16 pixel-grid
 * SVGs (`shape-rendering: crispEdges`) in the authentic 16-color system
 * palette, so they stay pixel-perfect at any integer scale with zero image
 * assets. Modern packs (Aero/Metro/Fluent) reuse each app's existing lucide
 * glyph on an era-correct plate, so every app keeps a recognizable identity
 * across all themes.
 *
 * Apps are mapped to icons by appId/name keywords in `getPCIconKey` —
 * purely visual, never touching app logic. Unknown apps fall back to the
 * generic "window" icon exactly like unregistered EXEs did on real Windows.
 */

/* Authentic Windows 16-color palette (plus a few soft fills). */
const C = {
  black: '#000000', white: '#ffffff',
  silver: '#c0c0c0', gray: '#808080',
  navy: '#000080', blue: '#0000ff', skyblue: '#3399ff', dkblue: '#1c5eaa',
  teal: '#008080', cyan: '#00ffff',
  green: '#008000', lime: '#00ff00',
  red: '#ff0000', maroon: '#800000',
  yellow: '#ffff00', olive: '#808000',
  cream: '#fff8c0', gold: '#e8c840', dkgold: '#8a6d1f',
  foldLight: '#fff3c2', foldMid: '#f8dc82', foldTab: '#f0c454',
  page: '#f0f0f0',
};

export type PCIconKey =
  | 'computer' | 'folder' | 'document' | 'mail' | 'settings' | 'terminal'
  | 'game' | 'globe' | 'shield' | 'drive' | 'display' | 'app'
  | 'package' | 'star' | 'key' | 'chart' | 'chat';

/** Each icon is a list of pixel rects [x, y, w, h, fill] on a 16×16 grid. */
type Px = [number, number, number, number, string];

const PIXEL_ICONS: Record<PCIconKey, Px[]> = {
  computer: [
    [1, 1, 12, 10, C.gray], [2, 2, 10, 8, C.silver], [3, 3, 8, 6, C.teal],
    [4, 4, 3, 1, C.cyan], [6, 11, 4, 1, C.gray], [4, 12, 8, 2, C.silver],
    [4, 14, 8, 1, C.gray], [11, 12, 1, 1, C.lime],
  ],
  folder: [
    [1, 3, 6, 2, C.foldTab], [1, 5, 14, 8, C.foldMid], [1, 5, 14, 1, C.foldLight],
    [1, 13, 14, 1, C.dkgold], [14, 5, 1, 8, C.dkgold],
  ],
  document: [
    [3, 1, 8, 14, C.white], [11, 1, 2, 2, C.silver], [11, 3, 2, 12, C.white],
    [2, 1, 1, 14, C.gray], [3, 15, 10, 1, C.gray], [13, 3, 1, 12, C.gray],
    [5, 4, 5, 1, C.gray], [5, 6, 6, 1, C.gray], [5, 8, 5, 1, C.gray], [5, 10, 6, 1, C.gray],
  ],
  mail: [
    [1, 4, 14, 9, C.page], [1, 12, 14, 1, C.gray], [14, 4, 1, 9, C.gray],
    [1, 4, 14, 1, C.silver], [2, 5, 12, 1, C.silver], [3, 6, 10, 1, C.silver],
    [4, 7, 8, 1, C.silver], [6, 8, 4, 1, C.silver],
  ],
  settings: [
    [7, 1, 2, 2, C.gray], [7, 13, 2, 2, C.gray], [1, 7, 2, 2, C.gray], [13, 7, 2, 2, C.gray],
    [3, 3, 2, 2, C.gray], [11, 3, 2, 2, C.gray], [3, 11, 2, 2, C.gray], [11, 11, 2, 2, C.gray],
    [5, 5, 6, 6, C.silver], [4, 6, 8, 4, C.silver], [6, 4, 4, 8, C.silver],
    [7, 7, 2, 2, C.black],
  ],
  terminal: [
    [1, 2, 14, 11, C.black], [1, 2, 14, 1, C.silver], [1, 13, 14, 1, C.silver],
    [1, 2, 1, 12, C.silver], [14, 2, 1, 12, C.silver],
    [3, 4, 3, 1, C.lime], [3, 6, 5, 1, C.lime], [8, 8, 2, 1, C.lime],
  ],
  game: [
    [4, 11, 8, 3, C.gray], [3, 12, 10, 2, C.gray], [7, 4, 2, 7, C.silver],
    [6, 2, 4, 3, C.red], [7, 1, 2, 1, C.red], [11, 11, 2, 1, C.yellow],
  ],
  globe: [
    [5, 1, 6, 1, C.skyblue], [3, 2, 10, 1, C.skyblue], [2, 3, 12, 2, C.skyblue],
    [1, 5, 14, 6, C.skyblue], [2, 11, 12, 2, C.skyblue], [3, 13, 10, 1, C.skyblue],
    [5, 14, 6, 1, C.skyblue], [1, 7, 14, 1, C.dkblue], [7, 1, 2, 14, C.dkblue],
    [3, 4, 3, 2, C.lime], [10, 8, 3, 2, C.lime],
  ],
  shield: [
    [3, 1, 10, 7, C.navy], [4, 8, 8, 3, C.navy], [5, 11, 6, 2, C.navy],
    [6, 13, 4, 1, C.navy], [7, 14, 2, 1, C.navy],
    [7, 3, 2, 8, C.white], [5, 5, 6, 2, C.white],
  ],
  drive: [
    [2, 2, 12, 4, C.silver], [2, 6, 12, 2, C.gray], [12, 7, 1, 1, C.lime],
    [2, 9, 12, 4, C.silver], [2, 13, 12, 2, C.gray], [12, 14, 1, 1, C.lime],
  ],
  display: [
    [1, 1, 12, 10, C.gray], [2, 2, 10, 8, C.silver],
    [3, 3, 2, 6, C.red], [5, 3, 2, 6, C.lime], [7, 3, 2, 6, C.blue], [9, 3, 2, 6, C.yellow],
    [6, 11, 4, 1, C.gray], [4, 12, 8, 2, C.silver], [4, 14, 8, 1, C.gray],
  ],
  app: [
    [1, 2, 14, 3, C.navy], [12, 3, 2, 1, C.white], [2, 3, 1, 1, C.white],
    [1, 5, 14, 9, C.silver], [1, 14, 14, 1, C.gray], [14, 5, 1, 9, C.gray],
    [3, 7, 7, 1, C.gray], [3, 9, 9, 1, C.gray], [3, 11, 6, 1, C.gray],
  ],
  package: [
    [2, 7, 12, 7, '#c08040'], [7, 7, 2, 7, '#e8d8a0'], [2, 7, 12, 1, '#8a5a20'],
    [7, 1, 2, 4, C.green], [5, 4, 6, 2, C.green], [6, 5, 4, 1, C.green],
  ],
  star: [
    [7, 2, 2, 12, C.yellow], [2, 7, 12, 2, C.yellow], [6, 6, 4, 4, C.cream],
    [4, 4, 1, 1, C.yellow], [11, 4, 1, 1, C.yellow], [4, 11, 1, 1, C.yellow], [11, 11, 1, 1, C.yellow],
  ],
  key: [
    [2, 4, 5, 5, C.gold], [4, 6, 1, 1, C.black], [7, 6, 7, 2, C.gold],
    [11, 8, 1, 2, C.gold], [13, 8, 1, 3, C.gold],
  ],
  chart: [
    [2, 9, 3, 5, C.navy], [6, 6, 3, 8, C.green], [10, 3, 3, 11, C.red],
    [1, 14, 14, 1, C.black],
  ],
  chat: [
    [2, 3, 12, 8, C.white], [2, 3, 12, 1, C.gray], [2, 10, 12, 1, C.gray],
    [1, 4, 1, 6, C.gray], [14, 4, 1, 6, C.gray], [4, 11, 3, 2, C.white], [4, 13, 2, 1, C.gray],
    [4, 5, 8, 1, C.gray], [4, 7, 6, 1, C.gray],
  ],
};

/** Crisp 16×16 pixel icon scaled to `size`. */
export const PixelIcon: React.FC<{ icon: PCIconKey; size?: number; className?: string }> = ({
  icon, size = 32, className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
    aria-hidden="true"
  >
    {PIXEL_ICONS[icon].map(([x, y, w, h, fill], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
    ))}
  </svg>
);

/* ── Start logos per era ───────────────────────────────────────────────── */

/** The waving four-pane Windows flag (95→XP era), pixel style. */
const Flag95: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ shapeRendering: 'crispEdges' }} aria-hidden="true">
    {/* trailing streamer pixels */}
    <rect x="0" y="4" width="1" height="1" fill={C.black} />
    <rect x="0" y="8" width="1" height="1" fill={C.black} />
    <rect x="0" y="12" width="1" height="1" fill={C.black} />
    {/* wave: left panes sit 1px lower than right panes */}
    <rect x="2" y="3" width="5" height="4" fill={C.red} />
    <rect x="8" y="2" width="6" height="4" fill={C.green} />
    <rect x="2" y="8" width="5" height="4" fill={C.blue} />
    <rect x="8" y="7" width="6" height="4" fill={C.yellow} />
  </svg>
);

/** Flat four-pane mark; color inherits for Metro/Fluent (currentColor). */
const FlatPanes: React.FC<{ size: number; gap?: number; skew?: boolean }> = ({ size, gap = 1.5, skew }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <g fill="currentColor" transform={skew ? 'skewY(-6) translate(0 0.85)' : undefined}>
      <rect x="1" y="1" width={7 - gap} height={7 - gap} />
      <rect x={8 + gap / 2} y="1" width={7 - gap} height={7 - gap} />
      <rect x="1" y={8 + gap / 2} width={7 - gap} height={7 - gap} />
      <rect x={8 + gap / 2} y={8 + gap / 2} width={7 - gap} height={7 - gap} />
    </g>
  </svg>
);

export const StartLogo: React.FC<{
  kind: 'flag95' | 'flagxp' | 'orb' | 'metro' | 'fluent' | 'plasma' | 'drawer' | 'chrome';
  size?: number;
}> = ({ kind, size = 18 }) => {
  switch (kind) {
    case 'flag95':
    case 'flagxp':
      return <Flag95 size={size} />;
    case 'orb':
      // The orb's glassy ball comes from the Start button CSS; the logo
      // itself is the small waving flag floating inside it.
      return <Flag95 size={size} />;
    case 'metro':
      return <FlatPanes size={size} skew />;
    case 'fluent':
      return <FlatPanes size={size} />;
    case 'plasma':
      // KDE Plasma launcher mark: white gear-ish K on the accent disc.
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.25" />
          <text x="8" y="11.6" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" fontFamily="sans-serif">K</text>
        </svg>
      );
    case 'drawer':
      // Android app-drawer: 3×2 dot grid.
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          {[3, 8, 13].map(x => [5, 11].map(y => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />
          )))}
        </svg>
      );
    case 'chrome':
      // ChromeOS launcher: ring + center dot.
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8" cy="8" r="2.6" fill="currentColor" />
        </svg>
      );
  }
};

/** Menubar system-button logos for dock/menubar shells. */
export const MenuLogo: React.FC<{
  kind: 'apple' | 'ubuntu' | 'gnome' | 'pantheon' | 'workbench' | 'beos';
  size?: number;
}> = ({ kind, size = 15 }) => {
  switch (kind) {
    case 'apple':
      // Minimal apple silhouette: body + bite + leaf, in currentColor.
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 4.6c1.1-1.6 3.4-1.8 4.6-.6-1 .7-1.5 1.7-1.4 2.9.1 1.3.8 2.2 1.9 2.7-.5 1.5-1.2 2.9-2.3 4-.6.6-1.3.6-2 .3-.6-.3-1.2-.3-1.8 0-.7.3-1.4.3-2-.3C3.6 12.2 2.6 9.7 3 7.5c.3-1.8 1.7-3 3.3-3 .6 0 1.2.4 1.7.1z" />
          <path d="M8.1 4.2c-.1-1.2.8-2.4 2-2.6.2 1.3-.8 2.5-2 2.6z" />
        </svg>
      );
    case 'ubuntu':
      // Circle-of-friends: ring with three nodes at 120°.
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8" cy="2.6" r="1.7" />
          <circle cx="3.4" cy="10.8" r="1.7" />
          <circle cx="12.6" cy="10.8" r="1.7" />
        </svg>
      );
    case 'gnome':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <ellipse cx="9.5" cy="8.5" rx="3.4" ry="5" />
          <ellipse cx="4.2" cy="4.6" rx="1.3" ry="2.1" transform="rotate(-24 4.2 4.6)" />
          <ellipse cx="7" cy="2.9" rx="1.1" ry="1.9" />
          <ellipse cx="13" cy="3.6" rx="1" ry="1.7" transform="rotate(18 13 3.6)" />
        </svg>
      );
    case 'pantheon':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 10c1-3 5-3 6 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'workbench':
      // Amiga checkmark.
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 8l4 5L14 3" fill="none" stroke="#ff8800" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 8l4 5L14 3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'beos':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="#4c5c96" />
          <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">Be</text>
        </svg>
      );
  }
};

/* ── App → icon mapping (visual only) ──────────────────────────────────── */

const KEYWORD_MAP: Array<[RegExp, PCIconKey]> = [
  [/mail|outlook|inbox/, 'mail'],
  [/notepad|\.txt|note|doc|prompt_library|rulebook|codex(?!_)/, 'document'],
  [/term|shell|console|grok|cli/, 'terminal'],
  [/snake|chess|arcade|laser|game|pinball|mine/, 'game'],
  [/settings|sliders|control|permission|automation/, 'settings'],
  [/security|shield|audit|integrity|anomaly|cve|secret|redaction|vault/, 'shield'],
  [/api_key|\bkey\b/, 'key'],
  [/cost|analytic|budget|stats|chart|monitor/, 'chart'],
  [/theme|display|ui_studio|flash|palette|paint|studio/, 'display'],
  [/update|store|deploy|export|archiv|package|model/, 'package'],
  [/data|pod|drive|storage|memory|db|qpdb|build/, 'drive'],
  [/net|connector|cloud|openclaw|langchain|consensus|router|fleet|globe|github|sync|share|web/, 'globe'],
  [/telegram|chat|cybernetic67|message/, 'chat'],
  [/jack|eru|claude|gemini|agent|bot|brain|llm|ai|sayen|ollama|knowledge|vision|resolver/, 'star'],
  [/computer|pc\b|system/, 'computer'],
];

export function getPCIconKey(item: Pick<DesktopItem, 'appId' | 'name' | 'type'>): PCIconKey {
  if (item.type === 'folder') return 'folder';
  const hay = `${item.appId || ''} ${item.name}`.toLowerCase();
  for (const [re, key] of KEYWORD_MAP) {
    if (re.test(hay)) return key;
  }
  return 'app';
}

/* ── Unified app icon across all packs ─────────────────────────────────── */

interface PCAppIconProps {
  item: Pick<DesktopItem, 'appId' | 'name' | 'type' | 'icon'>;
  pack: PCIconPack;
  size?: number;
}

/**
 * Stable per-app hue so modern packs (macOS/iOS/Android) get varied but
 * deterministic icon colors from the app id alone — pure presentation.
 */
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Renders the right icon for an app under the active pack.
 * `cosmic` is never rendered here — the default theme keeps the original
 * glossy tiles untouched (HomeScreen bypasses this component entirely).
 */
export const PCAppIcon: React.FC<PCAppIconProps> = ({ item, pack, size = 40 }) => {
  if (pack === 'classic' || pack === 'luna') {
    return <PixelIcon icon={getPCIconKey(item)} size={size} />;
  }

  const Lucide = item.icon;
  const hue = hashHue(String(item.appId || item.name));

  if (pack === 'squircle' || pack === 'squircle-gloss') {
    // macOS / iOS superellipse plate; iOS-6 variant adds the glossy shine.
    return (
      <span
        style={{
          width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden', borderRadius: size * 0.24,
          background: `linear-gradient(180deg, hsl(${hue},72%,58%) 0%, hsl(${hue},78%,42%) 100%)`,
          boxShadow: pack === 'squircle-gloss'
            ? 'inset 0 1px 1px rgba(255,255,255,0.7), 0 2px 4px rgba(0,0,0,0.45)'
            : '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        {Lucide && <Lucide style={{ width: size * 0.54, height: size * 0.54 }} color="#fff" />}
        {pack === 'squircle-gloss' && (
          <span style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: '48%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 100%)',
            borderRadius: `${size * 0.24}px ${size * 0.24}px 40% 40%`, pointerEvents: 'none',
          }} />
        )}
      </span>
    );
  }
  if (pack === 'round' || pack === 'material') {
    // Android/ChromeOS circle; Material You uses pastel plate + dark glyph.
    const mat = pack === 'material';
    return (
      <span
        style={{
          width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
          background: mat ? `hsl(${hue},42%,85%)` : `hsl(${hue},55%,45%)`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        {Lucide && <Lucide style={{ width: size * 0.52, height: size * 0.52 }} color={mat ? `hsl(${hue},45%,22%)` : '#fff'} />}
      </span>
    );
  }

  const glyph = Lucide ? <Lucide style={{ width: size * 0.56, height: size * 0.56 }} color="#fff" /> : null;

  if (pack === 'tile') {
    // Metro: full-bleed flat accent tile, hard corners.
    return (
      <span
        className="pc-tile"
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >
        {glyph}
      </span>
    );
  }
  if (pack === 'aero') {
    return (
      <span
        style={{
          width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6, border: '1px solid rgba(255,255,255,0.45)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(120,170,220,0.35) 50%, rgba(30,80,140,0.5) 100%)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), 0 2px 5px rgba(0,0,0,0.45)',
        }}
      >
        {glyph}
      </span>
    );
  }
  // fluent
  return (
    <span
      style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.28) 100%), var(--pc-accent, #0067c0)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      {glyph}
    </span>
  );
};
