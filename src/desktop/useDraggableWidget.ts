/**
 * useDraggableWidget — makes any floating widget movable, and remembers it.
 *
 * One primitive, so a widget opts in with a single line instead of carrying
 * its own copy of drag logic. Everything below exists because the previous
 * one-off implementation in FloatingNav got it subtly wrong in ways that only
 * show up on a phone:
 *
 *   • ACTIVATION DIFFERS BY INPUT. With a mouse, a small movement means
 *     "drag" — waiting 1.5s to move something feels broken. With a finger,
 *     movement means "scroll", so a drag has to be claimed by holding first.
 *     Same widget, two correct answers; callers should not have to know that.
 *
 *   • A WIDGET IS USUALLY A BUTTON. The ⌘ orb both opens the terminal and now
 *     moves, so a drag must not fire the click. `suppressClick` closes that:
 *     the click that ends a real drag is swallowed, a plain tap is not.
 *
 *   • ROTATION. A position is only valid against the viewport it was chosen
 *     in. Positions are re-clamped on resize and orientation change, which is
 *     what stops a widget from becoming permanently unreachable.
 *
 *   • WRITE VOLUME. The old code wrote to localStorage on every pointermove —
 *     dozens of JSON serializations a second during a drag. The position is
 *     saved once, on release.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from './haptics';
import {
    clampToViewport,
    clearWidgetPosition,
    loadWidgetPosition,
    saveWidgetPosition,
    type WidgetPosition,
} from './widgetPositions';

/** Hold before a touch drag begins. Matches useLongPress's platform-standard
 *  500ms — the old 1.5s read as "the app is not responding". */
const TOUCH_HOLD_MS = 500;

/** Mouse travel that turns a press into a drag rather than a click. */
const MOUSE_DRAG_THRESHOLD_PX = 6;

/** Finger travel during the hold that reclassifies it as a scroll. */
const TOUCH_CANCEL_PX = 10;

export interface DraggableWidgetOptions {
    /** Stable id — the storage key for this widget's position. */
    id: string;
    /** Set false to pin a widget in place (e.g. while a menu is open). */
    enabled?: boolean;
}

export interface DraggableWidgetResult {
    /** Spread onto the widget's root element. */
    handlers: {
        onPointerDown: (e: React.PointerEvent) => void;
        onPointerMove: () => void;
        onPointerUp: (e: React.PointerEvent) => void;
        onPointerCancel: (e: React.PointerEvent) => void;
        onClickCapture: (e: React.MouseEvent) => void;
    };
    /** Ref for the widget's root element; needed to measure it. */
    ref: React.RefObject<HTMLDivElement | null>;
    /** Inline style: absent until the widget has been moved, so an untouched
     *  widget keeps whatever CSS position its component already declares. */
    style: React.CSSProperties | undefined;
    isDragging: boolean;
    /** True while a touch hold is counting down — for a visual cue. */
    isArming: boolean;
    /** Raw position, for widgets that must place a panel relative to
     *  themselves (FloatingNav's app drawer opens under the pill). Null while
     *  the widget still sits at its declared CSS position. */
    position: WidgetPosition | null;
    hasCustomPosition: boolean;
    /** Send this widget back to its declared CSS position. */
    resetPosition: () => void;
}

export function useDraggableWidget({ id, enabled = true }: DraggableWidgetOptions): DraggableWidgetResult {
    const ref = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<WidgetPosition | null>(() => loadWidgetPosition(id));
    const [isDragging, setIsDragging] = useState(false);
    const [isArming, setIsArming] = useState(false);

    // Pointer offset within the widget, so it does not jump to the cursor.
    const grabOffset = useRef<WidgetPosition>({ x: 0, y: 0 });
    const pressOrigin = useRef<WidgetPosition | null>(null);
    const holdTimer = useRef<number | null>(null);
    const pointerKind = useRef<'mouse' | 'touch'>('mouse');
    // Set when a drag actually happened, so the trailing click is swallowed.
    const suppressClick = useRef(false);
    const draggingRef = useRef(false);

    const clearHold = useCallback(() => {
        if (holdTimer.current !== null) {
            window.clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
        setIsArming(false);
    }, []);

    /** Begin dragging from the widget's current on-screen box. */
    const beginDrag = useCallback((clientX: number, clientY: number) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        grabOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
        draggingRef.current = true;
        setIsDragging(true);
        // Seed from the measured box so a widget that was CSS-positioned does
        // not jump when it becomes explicitly positioned.
        setPosition({ x: rect.left, y: rect.top });
    }, []);

    // Window-level listeners that live only between pointerdown and the
    // moment a press resolves into either a drag or a click.
    const pressCleanup = useRef<(() => void) | null>(null);

    const detachPressListeners = useCallback(() => {
        pressCleanup.current?.();
        pressCleanup.current = null;
    }, []);

    const attachPressListeners = useCallback(() => {
        detachPressListeners();
        const onMove = (e: PointerEvent) => {
            if (draggingRef.current || !pressOrigin.current) return;
            const travel = Math.hypot(
                e.clientX - pressOrigin.current.x,
                e.clientY - pressOrigin.current.y,
            );
            if (pointerKind.current === 'mouse') {
                if (travel > MOUSE_DRAG_THRESHOLD_PX) {
                    beginDrag(e.clientX, e.clientY);
                    detachPressListeners();
                }
            } else if (travel > TOUCH_CANCEL_PX) {
                // Finger moved before the hold completed — that was a scroll.
                clearHold();
                pressOrigin.current = null;
                detachPressListeners();
            }
        };
        const onUp = () => {
            clearHold();
            pressOrigin.current = null;
            detachPressListeners();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        pressCleanup.current = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [beginDrag, clearHold, detachPressListeners]);

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (!enabled || e.button !== 0 || !e.isPrimary) return;
            pointerKind.current = e.pointerType === 'mouse' ? 'mouse' : 'touch';
            pressOrigin.current = { x: e.clientX, y: e.clientY };
            suppressClick.current = false;

            // Threshold detection listens on `window`, not on the element.
            //
            // Element-level pointermove stops the instant the cursor leaves
            // the widget's box — for a 44px orb that is immediately, so the
            // drag would never start. Pointer capture would fix the events but
            // retargets the trailing `click` to the capturing element, which
            // breaks any inner <button> (the orb both moves AND opens the
            // terminal). Window listeners give us the moves without touching
            // click delivery.
            attachPressListeners();

            if (pointerKind.current === 'touch') {
                // Hold to claim the drag, so a swipe over the widget still
                // scrolls the page.
                const { clientX, clientY } = e;
                setIsArming(true);
                holdTimer.current = window.setTimeout(() => {
                    holdTimer.current = null;
                    setIsArming(false);
                    haptic('longPress');
                    beginDrag(clientX, clientY);
                }, TOUCH_HOLD_MS);
            }
        },
        [enabled, beginDrag, attachPressListeners],
    );

    // Threshold detection happens on the window listeners above; this stays
    // on the element only so the returned handler surface is complete.
    const onPointerMove = useCallback(() => {}, []);

    const endPress = useCallback(() => {
        clearHold();
        pressOrigin.current = null;
        detachPressListeners();
    }, [clearHold]);

    const onClickCapture = useCallback((e: React.MouseEvent) => {
        if (suppressClick.current) {
            // Stop the drag's terminating click from also activating the
            // widget — otherwise moving the ⌘ orb would open the terminal.
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
        }
    }, []);

    // Global listeners live only for the duration of a drag.
    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: PointerEvent) => {
            e.preventDefault();
            const el = ref.current;
            const width = el?.offsetWidth ?? 0;
            const height = el?.offsetHeight ?? 0;
            setPosition(
                clampToViewport(
                    { x: e.clientX - grabOffset.current.x, y: e.clientY - grabOffset.current.y },
                    width,
                    height,
                ),
            );
        };

        const onUp = () => {
            draggingRef.current = false;
            setIsDragging(false);
            suppressClick.current = true;
            pressOrigin.current = null;
            // Saved once, on release — not on every move.
            setPosition(current => {
                if (current) saveWidgetPosition(id, current);
                return current;
            });
        };

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [isDragging, id]);

    // A stored position is only meaningful against the viewport it was chosen
    // in; re-clamp so a rotation cannot strand a widget off-screen.
    useEffect(() => {
        const reclamp = () => {
            setPosition(current => {
                if (!current) return current;
                const el = ref.current;
                const next = clampToViewport(current, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0);
                if (next.x === current.x && next.y === current.y) return current;
                saveWidgetPosition(id, next);
                return next;
            });
        };
        window.addEventListener('resize', reclamp);
        window.addEventListener('orientationchange', reclamp);
        return () => {
            window.removeEventListener('resize', reclamp);
            window.removeEventListener('orientationchange', reclamp);
        };
    }, [id]);

    // Clamp once after mount, when the real size is known.
    useEffect(() => {
        setPosition(current => {
            if (!current) return current;
            const el = ref.current;
            if (!el) return current;
            return clampToViewport(current, el.offsetWidth, el.offsetHeight);
        });
    }, []);

    const resetPosition = useCallback(() => {
        clearWidgetPosition(id);
        setPosition(null);
    }, [id]);

    // "Reset all widgets" is a same-tab action, so it is delivered as an event
    // rather than through `storage` (which only fires in other tabs).
    useEffect(() => {
        const onReset = () => setPosition(null);
        window.addEventListener('pc-widget-positions-reset', onReset);
        return () => window.removeEventListener('pc-widget-positions-reset', onReset);
    }, []);

    // Never leave a hold timer or press listener running past unmount.
    useEffect(
        () => () => {
            clearHold();
            detachPressListeners();
        },
        [clearHold, detachPressListeners],
    );

    return {
        ref,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endPress,
            onPointerCancel: endPress,
            onClickCapture,
        },
        style: position
            ? {
                  position: 'fixed',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  right: 'auto',
                  bottom: 'auto',
                  // A widget being dragged must sit above the rest of the shell.
                  ...(isDragging ? { zIndex: 99999, touchAction: 'none' } : null),
              }
            : undefined,
        isDragging,
        isArming,
        position,
        hasCustomPosition: position !== null,
        resetPosition,
    };
}
