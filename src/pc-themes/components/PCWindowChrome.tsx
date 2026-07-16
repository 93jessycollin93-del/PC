import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { PCWindowStyle } from '../types';

/**
 * PCWindowControls — era-correct caption buttons for DraggableWindow when a
 * theme is active.
 *
 * Glyph sets:
 *   win9x/2k  — thick black strokes on raised gray squares (CSS bevels)
 *   XP        — bold white glyphs on glossy pills (red close)
 *   Aero      — thin white glyphs on glass rectangles
 *   Metro/Fluent — hairline glyphs, crimson close hover (via CSS)
 *   traffic   — macOS/Ubuntu round lights, ordered close·min·max; colors
 *               come from --pc-tl-close/--pc-tl-min/--pc-tl-max tokens so
 *               Ubuntu Ambiance can recolor them without new code
 *   platinum  — Mac OS 9 square boxes with inset frame
 *   gnome     — flat circular buttons (GNOME headerbars, iOS sheets)
 *   amiga     — Workbench close/depth gadgets (beveled via retro CSS)
 *   next      — NeXTSTEP dark bevel squares
 *
 * Behavior is passed in — this component adds NO logic of its own, so the
 * window's drag/resize/close/maximize state machine stays byte-identical.
 */

const Glyph: React.FC<{ kind: 'min' | 'max' | 'close'; bold?: boolean }> = ({ kind, bold }) => {
  const sw = bold ? 2 : 1;
  if (kind === 'min') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <line x1="1" y1={bold ? 8 : 5} x2="9" y2={bold ? 8 : 5} stroke="currentColor" strokeWidth={sw} />
      </svg>
    );
  }
  if (kind === 'max') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth={sw} />
        {bold && <line x1="1.5" y1="2" x2="8.5" y2="2" stroke="currentColor" strokeWidth="2" />}
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth={sw} />
      <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth={sw} />
    </svg>
  );
};

interface PCWindowControlsProps {
  controls: PCWindowStyle['controls'];
  url?: string;
  hideMaximize?: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export const PCWindowControls: React.FC<PCWindowControlsProps> = ({
  controls, url, hideMaximize, onToggleMaximize, onClose,
}) => {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const urlBtn = url && (
    <button
      className="pc-title-btn"
      onClick={(e) => { stop(e); window.open(url, '_blank'); }}
      onPointerDown={stop}
      title="Open in new tab"
    >
      <ExternalLink size={9} />
    </button>
  );

  /* — macOS-family round lights: ordered close · min · max — */
  if (controls === 'traffic' || controls === 'gnome' || controls === 'platinum') {
    const round = controls !== 'platinum';
    const sz = controls === 'gnome' ? 18 : 13;
    const mk = (
      kind: 'close' | 'min' | 'max',
      onClick: ((e: React.SyntheticEvent) => void) | undefined,
      title: string,
      bg: string,
    ) => (
      <button
        key={kind}
        className="pc-tl"
        onClick={onClick}
        onPointerDown={stop}
        title={title}
        style={{
          width: sz, height: sz,
          borderRadius: round ? '50%' : 3,
          background: bg,
          border: controls === 'platinum' ? '1px solid #555' : '1px solid rgba(0,0,0,0.18)',
          boxShadow: controls === 'traffic' ? 'inset 0 1px 1px rgba(255,255,255,0.5)' : undefined,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: controls === 'gnome' ? 'inherit' : 'rgba(0,0,0,0.55)',
          flexShrink: 0,
        }}
      >
        <span className="pc-tl-glyph"><Glyph kind={kind} /></span>
      </button>
    );
    return (
      <div className="flex items-center" style={{ gap: controls === 'gnome' ? 6 : 7 }}>
        {mk('close', (e) => { stop(e); onClose(); }, 'Close',
          controls === 'gnome' ? 'var(--pc-tl-close, rgba(127,127,127,0.25))'
            : 'var(--pc-tl-close, linear-gradient(180deg,#ff726a,#e0443e))')}
        {mk('min', stop, 'Minimize',
          controls === 'gnome' ? 'rgba(127,127,127,0.18)'
            : 'var(--pc-tl-min, linear-gradient(180deg,#ffc12f,#dfa023))')}
        {!hideMaximize && mk('max', (e) => { stop(e); onToggleMaximize(); }, 'Zoom',
          controls === 'gnome' ? 'rgba(127,127,127,0.18)'
            : 'var(--pc-tl-max, linear-gradient(180deg,#61c454,#3a9c2d))')}
        {urlBtn}
      </div>
    );
  }

  /* — Amiga Workbench gadgets / NeXT squares (beveled via retro CSS) — */
  if (controls === 'amiga' || controls === 'next') {
    return (
      <div className="flex items-center" style={{ gap: 2 }}>
        {urlBtn}
        <button className="pc-title-btn" onPointerDown={stop} title="To back">
          {controls === 'amiga' ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="1" y="1" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <rect x="5" y="5" width="6" height="6" fill="var(--pc-surface, #aaa)" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          ) : <Glyph kind="min" />}
        </button>
        {!hideMaximize && (
          <button className="pc-title-btn" onClick={(e) => { stop(e); onToggleMaximize(); }} onPointerDown={stop} title="Zoom">
            <Glyph kind="max" />
          </button>
        )}
        <button className="pc-title-btn pc-title-btn-close" onClick={(e) => { stop(e); onClose(); }} onPointerDown={stop} title="Close">
          {controls === 'amiga' ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="4" y="4" width="4" height="4" fill="currentColor" />
            </svg>
          ) : <Glyph kind="close" />}
        </button>
      </div>
    );
  }

  /* — Windows families (original behavior, unchanged) — */
  const bold = controls === 'win9x' || controls === 'winxp';
  return (
    <div
      className="flex items-center"
      style={{
        gap: controls === 'win9x' ? 2 : controls === 'winxp' ? 3 : 0,
        alignSelf: controls === 'aero' || controls === 'metro' || controls === 'fluent' ? 'flex-start' : 'center',
      }}
    >
      {urlBtn}
      <button className="pc-title-btn" onPointerDown={stop} title="Minimize">
        <Glyph kind="min" bold={bold} />
      </button>
      {!hideMaximize && (
        <button
          className="pc-title-btn"
          onClick={(e) => { stop(e); onToggleMaximize(); }}
          onPointerDown={stop}
          title="Maximize / Restore"
        >
          <Glyph kind="max" bold={bold} />
        </button>
      )}
      <button
        className="pc-title-btn pc-title-btn-close"
        onClick={(e) => { stop(e); onClose(); }}
        onPointerDown={stop}
        title="Close"
      >
        <Glyph kind="close" bold={bold} />
      </button>
    </div>
  );
};

export default PCWindowControls;
