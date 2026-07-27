/**
 * ContextMenu — the menu itself. Pure presentation: it renders a model and
 * reports which entry was chosen. It knows nothing about desktops, folders,
 * or apps, so the same component serves icons, empty desktop, and anything
 * added later.
 *
 * Built for both input worlds at once:
 *   - clamps itself into the viewport instead of opening off-screen
 *   - rows are finger-sized on touch, compact on mouse
 *   - submenus fly out beside the row on mouse, expand inline on touch
 *     (a flyout on a 390px-wide phone has nowhere to go)
 *   - Escape / arrows / Enter for keyboard, click-outside to dismiss
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { haptic } from './haptics';

export interface MenuEntry {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Right-aligned hint, e.g. "F2" — shown on mouse only, where it applies. */
  shortcut?: string;
  disabled?: boolean;
  /** Destructive actions read red, as everywhere else. */
  danger?: boolean;
  separatorBefore?: boolean;
  submenu?: MenuEntry[];
  onSelect?: () => void;
}

/**
 * A mouse-mode submenu. Opens to the right of its parent row, but flips to
 * the left when there isn't room — otherwise entries near the screen edge
 * render off-screen and can't be clicked at all.
 */
const Flyout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure in the default (right-hand) position, then flip if it spills.
    const box = el.getBoundingClientRect();
    if (box.right > window.innerWidth - EDGE_GAP) setFlip(true);
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      className={[
        'absolute top-0 -mt-1 min-w-[190px] p-1 rounded-lg z-10',
        'bg-zinc-900/97 backdrop-blur-xl border border-zinc-700/70',
        'shadow-[0_16px_40px_-8px_rgba(0,0,0,0.85)]',
        flip ? 'right-full mr-1' : 'left-full ml-1',
      ].join(' ')}
      style={{ maxHeight: '70vh', overflowY: 'auto' }}
    >
      {children}
    </div>
  );
};

interface ContextMenuProps {
  x: number;
  y: number;
  entries: MenuEntry[];
  /** Drives sizing: touch gets 44px rows and inline submenus. */
  source: 'mouse' | 'touch';
  onClose: () => void;
  /** Shown as a small dimmed header, e.g. the icon's name. */
  title?: string;
}

const EDGE_GAP = 8;

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x, y, entries, source, onClose, title,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [openSub, setOpenSub] = useState<string | null>(null);
  const touch = source === 'touch';

  // Clamp after mount, when the real size is known. useLayoutEffect so the
  // correction lands before paint and the menu never visibly jumps.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - width - EDGE_GAP;
    const maxTop = window.innerHeight - height - EDGE_GAP;
    setPos({
      left: Math.max(EDGE_GAP, Math.min(x, maxLeft)),
      top: Math.max(EDGE_GAP, Math.min(y, maxTop)),
    });
  }, [x, y, entries]);

  // Dismiss on outside press, Escape, scroll, or resize — any of which mean
  // the anchor this menu was positioned against is no longer valid.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    // `true` = capture, so we see it before the desktop's own handlers.
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const choose = useCallback((entry: MenuEntry) => {
    if (entry.disabled) return;
    if (entry.submenu) {
      haptic('select');
      setOpenSub((cur) => (cur === entry.id ? null : entry.id));
      return;
    }
    // Destructive entries get the heavier "error" pattern, so a delete
    // never feels the same as an ordinary pick.
    haptic(entry.danger ? 'error' : 'select');
    entry.onSelect?.();
    onClose();
  }, [onClose]);

  const rowClass = (entry: MenuEntry) => [
    'w-full flex items-center gap-2.5 text-left transition-colors rounded-md',
    touch ? 'px-3 min-h-[44px] text-[15px]' : 'px-2.5 py-1.5 text-[13px]',
    entry.disabled
      ? 'text-zinc-600 cursor-default'
      : entry.danger
        ? 'text-red-300 hover:bg-red-500/20 active:bg-red-500/30'
        : 'text-zinc-200 hover:bg-white/10 active:bg-white/15',
  ].join(' ');

  const renderRow = (entry: MenuEntry, depth = 0) => {
    const Icon = entry.icon;
    const expanded = openSub === entry.id;
    return (
      <React.Fragment key={entry.id}>
        {entry.separatorBefore && <div className="my-1 h-px bg-white/10" role="separator" />}
        <div
          className="relative"
          // On mouse, hovering a parent row opens its flyout — the behavior
          // every desktop OS has. Touch uses tap instead (handled in choose).
          onMouseEnter={!touch && entry.submenu ? () => setOpenSub(entry.id) : undefined}
        >
          <button
            type="button"
            role="menuitem"
            aria-haspopup={entry.submenu ? 'menu' : undefined}
            aria-expanded={entry.submenu ? expanded : undefined}
            aria-disabled={entry.disabled || undefined}
            disabled={entry.disabled}
            onClick={() => choose(entry)}
            className={rowClass(entry)}
          >
            {Icon
              ? <Icon size={touch ? 17 : 14} className="shrink-0 opacity-80" />
              : <span className={touch ? 'w-[17px] shrink-0' : 'w-[14px] shrink-0'} />}
            <span className="flex-1 truncate">{entry.label}</span>
            {entry.submenu
              ? <ChevronRight size={touch ? 16 : 13} className={`shrink-0 opacity-60 transition-transform ${touch && expanded ? 'rotate-90' : ''}`} />
              : entry.shortcut && !touch
                ? <span className="shrink-0 text-[11px] text-zinc-500 tabular-nums">{entry.shortcut}</span>
                : null}
          </button>

          {/* Touch: expand in place. Mouse: fly out to the right. */}
          {entry.submenu && expanded && (
            touch ? (
              <div className="pl-4 border-l border-white/10 ml-4 my-0.5" role="menu">
                {entry.submenu.map((sub) => renderRow(sub, depth + 1))}
              </div>
            ) : (
              <Flyout>
                {entry.submenu.map((sub) => renderRow(sub, depth + 1))}
              </Flyout>
            )
          )}
        </div>
      </React.Fragment>
    );
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={title || 'Context menu'}
      // z sits above windows (4000) and the bottom bar so the menu is never
      // clipped by the chrome it was opened over.
      className={[
        'fixed z-[5000] p-1 rounded-xl select-none',
        'bg-zinc-900/97 backdrop-blur-xl border border-zinc-700/70',
        'shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]',
        touch ? 'min-w-[228px] max-w-[86vw]' : 'min-w-[210px]',
      ].join(' ')}
      // Scrolling and flyouts are mutually exclusive: an `overflow` value
      // other than visible clips absolutely-positioned children, which would
      // cut a flyout submenu off and make its entries unclickable. Touch
      // mode expands submenus inline (nothing to escape) so it can scroll;
      // mouse mode uses flyouts, and its menus are short enough — plus
      // position-clamped above — to not need scrolling.
      style={
        touch
          ? { left: pos.left, top: pos.top, maxHeight: '80vh', overflowY: 'auto' }
          : { left: pos.left, top: pos.top, overflow: 'visible' }
      }
      // The menu is its own context surface; a right-click inside it should
      // not bubble up and open a second one behind it.
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {title && (
        <div className={`px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 truncate ${touch ? 'text-xs' : ''}`}>
          {title}
        </div>
      )}
      {entries.map((entry) => renderRow(entry))}
    </div>
  );
};
