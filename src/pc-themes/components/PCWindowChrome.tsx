import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * PCWindowControls — era-correct caption buttons (minimize / maximize /
 * close / open-in-tab) for DraggableWindow when a Windows theme is active.
 *
 * Glyphs are tiny inline SVGs drawn to match each era:
 *   win9x/2k — thick black strokes on raised gray squares
 *   XP       — bold white glyphs on glossy pills (red close)
 *   Aero     — thin white glyphs on glass rectangles
 *   Metro/Fluent — hairline glyphs, crimson close hover (via CSS)
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
  /** 'win9x' | 'winxp' draw bold glyphs; the rest hairline. */
  controls: 'win9x' | 'winxp' | 'aero' | 'metro' | 'fluent';
  url?: string;
  hideMaximize?: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export const PCWindowControls: React.FC<PCWindowControlsProps> = ({
  controls, url, hideMaximize, onToggleMaximize, onClose,
}) => {
  const bold = controls === 'win9x' || controls === 'winxp';
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="flex items-center"
      style={{
        gap: controls === 'win9x' ? 2 : controls === 'winxp' ? 3 : 0,
        alignSelf: controls === 'aero' || controls === 'metro' || controls === 'fluent' ? 'flex-start' : 'center',
      }}
    >
      {url && (
        <button
          className="pc-title-btn"
          onClick={(e) => { stop(e); window.open(url, '_blank'); }}
          onPointerDown={stop}
          title="Open in new tab"
        >
          <ExternalLink size={9} />
        </button>
      )}
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
