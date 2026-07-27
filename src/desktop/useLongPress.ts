/**
 * useLongPress — one input seam for "the user wants the context menu".
 *
 * A real PC opens it on right-click. A phone has no right button, so the
 * platform-standard equivalent is press-and-hold. Both are the SAME intent,
 * so callers get one callback and never branch on pointer type themselves.
 *
 * Handles the details that make hold-to-open feel right rather than broken:
 *   - cancels if the finger moves (that's a scroll, not a hold)
 *   - cancels on lift/cancel, and never double-fires with contextmenu
 *   - suppresses iOS Safari's own text-callout so ours is the only menu
 *   - fires a short haptic tick on devices that support it
 */
import { useCallback, useEffect, useRef } from 'react';
import { haptic } from './haptics';

/** Hold duration before the menu opens.
 *
 *  Platform standard is ~500ms (iOS ~500, Android ~400-500). Longer than
 *  this and a hold stops reading as "hold" and starts reading as "the tap
 *  didn't work" — people lift early and think the app is broken. Raise this
 *  single constant if a slower hold is wanted. */
export const LONG_PRESS_MS = 500;

/** Finger travel that reclassifies a hold as a scroll/drag, in px. */
const MOVE_CANCEL_PX = 10;

export interface ContextRequest {
  /** Viewport coordinates to anchor the menu at. */
  x: number;
  y: number;
  /** What produced it — useful for sizing hit areas, not for branching logic. */
  source: 'mouse' | 'touch';
}

export interface LongPressHandlers {
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

/**
 * @param onRequest fires once when the user asks for a context menu.
 * @param enabled   set false to disable (e.g. while a menu is already open).
 */
export function useLongPress(
  onRequest: (req: ContextRequest) => void,
  enabled: boolean = true,
): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  // Set when a hold fires, so the browser's synthetic contextmenu (some
  // touch stacks emit one after a long press) doesn't open a second menu.
  const justFired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  // Never leave a timer running past unmount.
  useEffect(() => clear, [clear]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (justFired.current) {
        justFired.current = false;
        return;
      }
      onRequest({ x: e.clientX, y: e.clientY, source: 'mouse' });
    },
    [enabled, onRequest],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Mouse right-click is handled by onContextMenu; only hold-to-open
      // needs a timer, and only for a primary touch/pen contact.
      if (!enabled || e.pointerType === 'mouse' || !e.isPrimary) return;
      // A hold on a nested target (a desktop icon) belongs to that target,
      // not to the surface behind it. Without this, both timers run and the
      // ancestor's menu wins the race — the icon's menu never appears.
      e.stopPropagation();
      clear();
      const { clientX: x, clientY: y } = e;
      origin.current = { x, y };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        justFired.current = true;
        // A tick confirms the hold registered, so the user lets go instead
        // of holding longer and wondering. Its character comes from the
        // active theme (see haptics.ts).
        haptic('longPress');
        onRequest({ x, y, source: 'touch' });
      }, LONG_PRESS_MS);
    },
    [enabled, onRequest, clear],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timer.current === null || !origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clear();
    },
    [clear],
  );

  return {
    onContextMenu,
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
  };
}
