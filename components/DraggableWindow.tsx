/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A desktop window: draggable, resizable from all eight edges, snappable,
 * and — the part that was missing — impossible to lose.
 *
 * Every geometry rule lives in src/desktop/windowGeometry.ts as a pure
 * function. This file is the pointer plumbing and the chrome; it decides
 * *when* to move a window, never *where it is allowed to be*.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minus, Square, Copy, ExternalLink } from 'lucide-react';
import { usePCThemeOptional } from '../src/pc-themes/PCThemeContext';
import { PCWindowControls } from '../src/pc-themes/components/PCWindowChrome';
import { useViewport } from '../src/desktop/useViewport';
import { useLayerWorkArea } from '../src/desktop/useLayerWorkArea';
import {
    clampToWorkArea,
    fitToWorkArea,
    resizeRect,
    snapRect,
    snapZoneAt,
    toLayer,
    type Rect,
    type ResizeHandle,
    type SnapZone,
} from '../src/desktop/windowGeometry';

interface DraggableWindowProps {
    id: string;
    title: string;
    icon?: React.ElementType;
    onClose: () => void;
    children: React.ReactNode;
    initialPos?: { x: number; y: number };
    initialSize?: { width: number; height: number };
    zIndex: number;
    onFocus?: () => void;
    onBoundsChange?: (pos: {x: number, y: number}, size: {width: number, height: number}) => void;
    isActive?: boolean;
    url?: string;
    /** Hide the window without closing it; restored from the taskbar.
     *  Without this the titlebar's minimize button does nothing. */
    onMinimize?: () => void;
}

/**
 * The eight resize grips. Corners are listed after edges so a corner drag is
 * never stolen by the edge strip underneath it.
 *
 * Every inset is ZERO OR POSITIVE, because the frame is `overflow-hidden` —
 * it has rounded corners, and dropping the clip so grips could hang outside
 * turned out to overwhelm the compositor once ten apps were painting
 * unclipped, taking the renderer down with it. The clip stays; the grips live
 * inside it.
 *
 * That leaves the outermost border pixel owned by the frame rather than a
 * grip, which is precisely where someone aiming at the edge tends to land, so
 * `edgeAt` below catches presses on the frame itself and turns them into the
 * same resize. Between the two, every pixel of the border resizes.
 *
 * 8px of grab depth: about what native window managers use. Wide enough to hit
 * without aiming, narrow enough not to eat clicks meant for content.
 */
const HANDLES: { dir: ResizeHandle; className: string; cursor: string }[] = [
    { dir: 'n',  className: 'top-0 left-3 right-3 h-2',      cursor: 'ns-resize' },
    { dir: 's',  className: 'bottom-0 left-3 right-3 h-2',   cursor: 'ns-resize' },
    { dir: 'w',  className: 'left-0 top-3 bottom-3 w-2',     cursor: 'ew-resize' },
    { dir: 'e',  className: 'right-0 top-3 bottom-3 w-2',    cursor: 'ew-resize' },
    { dir: 'nw', className: 'top-0 left-0 h-3 w-3',          cursor: 'nwse-resize' },
    { dir: 'ne', className: 'top-0 right-0 h-3 w-3',         cursor: 'nesw-resize' },
    { dir: 'sw', className: 'bottom-0 left-0 h-3 w-3',       cursor: 'nesw-resize' },
    { dir: 'se', className: 'bottom-0 right-0 h-4 w-4',      cursor: 'nwse-resize' },
];

/** How far from an edge a press on the frame itself counts as a resize. */
const EDGE_GRAB_PX = 8;

/** Pointer travel before a drag on a maximized window restores it down. */
const RESTORE_DRAG_PX = 6;

/**
 * Which edge a press on the frame itself is nearest, or null if it is not near
 * one. Only ever consulted when the press landed on the frame element and not
 * on any child, so this cannot steal a click meant for an app.
 */
function edgeAt(box: DOMRect, clientX: number, clientY: number): ResizeHandle | null {
    const nearW = clientX - box.left <= EDGE_GRAB_PX;
    const nearE = box.right - clientX <= EDGE_GRAB_PX;
    const nearN = clientY - box.top <= EDGE_GRAB_PX;
    const nearS = box.bottom - clientY <= EDGE_GRAB_PX;
    if (nearN && nearW) return 'nw';
    if (nearN && nearE) return 'ne';
    if (nearS && nearW) return 'sw';
    if (nearS && nearE) return 'se';
    if (nearN) return 'n';
    if (nearS) return 's';
    if (nearW) return 'w';
    if (nearE) return 'e';
    return null;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
    id,
    title,
    icon: Icon,
    onClose,
    children,
    initialPos = { x: 50, y: 50 },
    initialSize = { width: 960, height: 600 },
    zIndex,
    onFocus,
    onBoundsChange,
    isActive = false,
    url,
    onMinimize
}) => {
    const viewport = useViewport();
    const isMobile = viewport.isMobile;
    const windowRef = useRef<HTMLDivElement>(null);

    // Measured, not assumed: `left`/`top` resolve against the window layer,
    // which sits below the top bar and shrinks in half mode. Deriving bounds
    // from the viewport was wrong by exactly that offset and let every window
    // settle that far under the taskbar.
    const { layer, area } = useLayerWorkArea(windowRef);

    // Both are needed inside pointer handlers, which are registered once per
    // gesture. Reading them from refs keeps a mid-drag resize (or a full/half
    // switch) from being clamped against a stale box.
    const areaRef = useRef(area);
    areaRef.current = area;
    const layerRef = useRef(layer);
    layerRef.current = layer;

    // Seeded from what the caller asked for, then fitted by the reflow effect
    // below as soon as the layer has been measured. A window asking for more
    // room than exists is not an error to reject — it is a request to satisfy
    // as far as the layer allows.
    const [rect, setRect] = useState<Rect>(() => ({ ...initialPos, ...initialSize }));
    const rectRef = useRef(rect);
    useEffect(() => { rectRef.current = rect; }, [rect]);

    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    /** Armed snap zone, painted as a preview while the pointer sits on an edge. */
    const [snap, setSnap] = useState<SnapZone>(null);
    const snapRef = useRef<SnapZone>(null);
    useEffect(() => { snapRef.current = snap; }, [snap]);

    /** Where an un-maximize / un-snap returns to. */
    const restoreRect = useRef<Rect>(rect);

    const effectiveMaximized = isMaximized || isMobile;

    const gesture = useRef<{
        kind: 'move' | ResizeHandle;
        startRect: Rect;
        startX: number;
        startY: number;
        /** Set when a maximized window is being dragged: it restores down on
         *  the first real movement, not on press. See beginGesture. */
        restorePending: boolean;
    }>({ kind: 'move', startRect: rect, startX: 0, startY: 0, restorePending: false });
    // PC theme system: purely visual. `themed` is false for the default
    // cosmic-jackie theme (or if the provider is absent), in which case the
    // original chrome below renders unchanged. Drag/resize/maximize/close
    // logic is shared by both paths — themes cannot alter behavior.
    const pcTheme = usePCThemeOptional();
    const themed = !!pcTheme && !pcTheme.isDefault;
    const pcControls = pcTheme?.theme.window.controls ?? 'fluent';

    /**
     * Keep every window reachable when the browser is resized.
     *
     * Without this, shrinking the window or rotating a tablet stranded any
     * window whose position was past the new edge: still open, still in the
     * taskbar, no longer on screen and not reachable by dragging because the
     * titlebar was outside too.
     */
    useEffect(() => {
        if (effectiveMaximized) return;
        setRect(prev => {
            const next = fitToWorkArea(prev, areaRef.current);
            return next.x === prev.x && next.y === prev.y
                && next.width === prev.width && next.height === prev.height ? prev : next;
        });
    }, [area.width, area.height, effectiveMaximized]);

    const beginGesture = (
        e: React.PointerEvent,
        kind: 'move' | ResizeHandle,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onFocus?.();

        // Dragging a maximized window restores it under the cursor, the way a
        // real window manager does — the alternative (ignore the drag) leaves
        // the maximize button as the only route back to a floating window.
        //
        // Deferred to the first real movement, and that timing is load-bearing:
        // restoring on press meant a double-click on a maximized titlebar
        // restored it on mousedown and then the dblclick handler re-maximized
        // it, so the window appeared frozen at full size. Nothing may change
        // until the pointer has actually travelled.
        gesture.current = {
            kind,
            startRect: rectRef.current,
            startX: e.clientX,
            startY: e.clientY,
            restorePending: kind === 'move' && isMaximized,
        };
        if (kind === 'move') setIsDragging(true);
        else setIsResizing(true);
    };

    const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Ignore if clicking window control buttons
        if (e.target instanceof Element && e.target.closest('button')) return;
        onFocus?.();
        if (isMobile) return;
        beginGesture(e, 'move');
    };

    const applyRect = useCallback((next: Rect) => {
        setRect(next);
        restoreRect.current = next;
    }, []);

    const toggleMaximize = useCallback(() => {
        if (isMaximized) {
            setRect(fitToWorkArea(restoreRect.current, areaRef.current));
        } else {
            restoreRect.current = rectRef.current;
        }
        setIsMaximized(m => !m);
        onFocus?.();
    }, [isMaximized, onFocus]);

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const onMove = (e: PointerEvent) => {
            // Critical for touch devices: prevent native scrolling while dragging/resizing
            e.preventDefault();
            const g = gesture.current;
            let dx = e.clientX - g.startX;
            let dy = e.clientY - g.startY;

            // The deferred restore-down: now that the pointer has really moved,
            // drop the window to its pre-maximize size under the cursor and
            // treat this position as the start of the drag.
            if (g.restorePending && Math.hypot(dx, dy) > RESTORE_DRAG_PX) {
                const restored = restoreRect.current;
                const p = toLayer(e.clientX, e.clientY, layerRef.current);
                const next = fitToWorkArea(
                    {
                        // Grab the restored window near where the cursor sits
                        // along the maximized titlebar, so it does not jump to
                        // a corner.
                        x: p.x - restored.width / 2,
                        y: Math.max(areaRef.current.top, p.y - 16),
                        width: restored.width,
                        height: restored.height,
                    },
                    areaRef.current,
                );
                g.restorePending = false;
                g.startRect = next;
                g.startX = e.clientX;
                g.startY = e.clientY;
                dx = 0;
                dy = 0;
                setIsMaximized(false);
                setRect(next);
                return;
            }
            if (g.restorePending) return;

            if (g.kind === 'move') {
                setRect(clampToWorkArea(
                    { ...g.startRect, x: g.startRect.x + dx, y: g.startRect.y + dy },
                    areaRef.current,
                ));
                const p = toLayer(e.clientX, e.clientY, layerRef.current);
                setSnap(snapZoneAt(p.x, p.y, areaRef.current));
            } else {
                setRect(resizeRect(g.startRect, g.kind, dx, dy, areaRef.current));
            }
        };

        const onUp = () => {
            const zone = snapRef.current;
            if (isDragging && zone) {
                // The pre-snap geometry is what un-snapping restores, so it is
                // captured before the snap overwrites the live rect.
                restoreRect.current = gesture.current.startRect;
                if (zone === 'max') {
                    setIsMaximized(true);
                } else {
                    setRect(snapRect(zone, areaRef.current));
                }
            } else if (isDragging || isResizing) {
                restoreRect.current = rectRef.current;
            }
            setSnap(null);
            setIsDragging(false);
            setIsResizing(false);
            onBoundsChange?.(
                { x: rectRef.current.x, y: rectRef.current.y },
                { width: rectRef.current.width, height: rectRef.current.height },
            );
        };

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [isDragging, isResizing, onBoundsChange]);

    /**
     * Keyboard window management, for the cases a mouse handles badly: a
     * window dragged mostly off-screen, a trackpad that will not hold a
     * 6px edge, or simply wanting the thing filled without aiming.
     * Super/Meta + arrows, matching the Windows shortcut people already know.
     */
    useEffect(() => {
        if (!isActive || isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.altKey) || !e.key.startsWith('Arrow')) return;
            const a = areaRef.current;
            if (e.key === 'ArrowUp') { e.preventDefault(); restoreRect.current = rectRef.current; setIsMaximized(true); }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (isMaximized) { setIsMaximized(false); setRect(fitToWorkArea(restoreRect.current, a)); }
                else onMinimize?.();
            }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); setIsMaximized(false); applyRect(snapRect('left', a)); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); setIsMaximized(false); applyRect(snapRect('right', a)); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isActive, isMobile, isMaximized, applyRect, onMinimize]);

    // Maximized means "the work area", not "the viewport". `inset-0` covered
    // the taskbar and hid the bottom row of every maximized app.
    const frameStyle: React.CSSProperties = effectiveMaximized
        ? isMobile
            ? { left: 0, top: 0, width: '100%', height: '100%', zIndex }
            : { left: area.left, top: area.top, width: area.width, height: area.height, zIndex }
        : { left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex };

    const snapPreview = snap ? (snap === 'max' ? { ...area, x: area.left, y: area.top } : snapRect(snap, area)) : null;

    return (
        <>
            {/* Snap preview — the shape the window will take if the pointer is
                released here. Windows shows this ghost for a reason: an edge
                drag that silently resizes on release feels like a glitch. */}
            {snapPreview && (
                <div
                    className="pointer-events-none absolute rounded-lg border-2 border-sky-400/70 bg-sky-400/10 transition-all duration-75"
                    style={{
                        left: snapPreview.x,
                        top: snapPreview.y,
                        width: snapPreview.width,
                        height: snapPreview.height,
                        zIndex: zIndex - 1,
                    }}
                />
            )}
        <div
            ref={windowRef}
            data-window-id={id}
            style={frameStyle}
            className={
                themed
                    ? `pc-window ${isActive ? 'pc-window-active' : ''} absolute flex flex-col overflow-hidden ${effectiveMaximized ? '!rounded-none m-0' : ''} ${isDragging || isResizing ? '' : 'transition-[left,top,width,height] duration-75 ease-out'} touch-none`
                    : `absolute flex flex-col bg-zinc-900 shadow-2xl border ${effectiveMaximized ? 'rounded-none' : 'rounded-lg'} ${isActive ? 'border-zinc-600 ring-1 ring-zinc-700' : 'border-zinc-800'} overflow-hidden ${isDragging || isResizing ? '' : 'transition-[left,top,width,height] duration-75 ease-out'} touch-none`
            }
            onPointerDown={(e) => {
                onFocus?.();
                // The frame is only the pointer's target when the press landed
                // on its border or padding — every other pixel belongs to the
                // titlebar, the content, or a grip. So a hit here that is near
                // an edge is unambiguously a resize, and nothing an app rendered
                // can be stolen by it.
                if (effectiveMaximized || e.target !== windowRef.current) return;
                const box = windowRef.current.getBoundingClientRect();
                const dir = edgeAt(box, e.clientX, e.clientY);
                if (dir) beginGesture(e, dir);
            }}
        >
            {/* Window Header */}
            {themed ? (
                /* Era window chrome — same handlers, same state machine;
                   only paint + control glyphs change per theme family. */
                <div
                    onDoubleClick={toggleMaximize}
                    onPointerDown={handleHeaderPointerDown}
                    className={`pc-titlebar ${isActive ? 'pc-titlebar-active' : 'pc-titlebar-inactive'} flex items-center justify-between gap-2 select-none touch-none shrink-0 ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''} ${effectiveMaximized && isMobile ? 'pt-4' : ''}`}
                >
                    {/* macOS/Unity-style themes put controls on the LEFT and
                        center the title; Windows keeps title-left/controls-right. */}
                    {pcTheme!.theme.window.controlsSide === 'left' && (
                        <PCWindowControls
                            controls={pcControls}
                            url={url}
                            hideMaximize={isMobile}
                            onMinimize={onMinimize}
                            onToggleMaximize={toggleMaximize}
                            onClose={onClose}
                        />
                    )}
                    <div className={`flex items-center gap-1.5 font-medium pointer-events-none min-w-0 flex-1 ${pcTheme!.theme.window.controlsSide === 'left' ? 'justify-center pr-10' : ''}`}>
                        {pcTheme!.theme.window.showTitleIcon && Icon && <Icon size={13} className="opacity-90 shrink-0" />}
                        <span className="truncate">{title}</span>
                    </div>
                    {pcTheme!.theme.window.controlsSide !== 'left' && (
                        <PCWindowControls
                            controls={pcControls}
                            url={url}
                            hideMaximize={isMobile}
                            onMinimize={onMinimize}
                            onToggleMaximize={toggleMaximize}
                            onClose={onClose}
                        />
                    )}
                </div>
            ) : (
            <div
                onDoubleClick={toggleMaximize}
                onPointerDown={handleHeaderPointerDown}
                className={`bg-zinc-800 border-b border-zinc-700 px-3 py-2 flex items-center justify-between select-none touch-none shrink-0 ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''} ${effectiveMaximized && isMobile ? 'pt-4' : ''}`}
            >
                <div className="flex items-center gap-2 text-zinc-300 font-medium pointer-events-none min-w-0">
                    {Icon && <Icon size={14} className="text-os-accent opacity-80 shrink-0" />}
                    <span className="text-xs truncate">{title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                     {/* Window Controls. Touch targets grow to a real tappable
                         size on mobile (isMobile forces every window fullscreen,
                         so these buttons are the only way to close/minimize). */}
                     {url && (
                        <button
                            onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors mr-1 ${isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1'}`}
                            title="Open in new tab"
                        >
                            <ExternalLink size={12} />
                        </button>
                     )}
                     <button
                        onClick={(e) => { e.stopPropagation(); onMinimize?.(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="Minimize"
                        className={`flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors ${isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1'}`}
                    >
                        <Minus size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title={isMaximized ? 'Restore down' : 'Maximize'}
                        className={`flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors ${isMobile ? 'hidden' : 'p-1'}`}
                    >
                        {isMaximized ? <Copy size={10} /> : <Square size={10} />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="Close"
                        className={`flex items-center justify-center rounded text-zinc-400 hover:bg-red-500 hover:text-white transition-colors ${isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1'}`}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
            )}

            {/* Window Content */}
            <div className={`flex-1 min-h-0 overflow-hidden relative ${themed ? 'pc-window-content' : 'bg-os-bg'} ${effectiveMaximized && isMobile ? 'pb-20' : ''}`}>
                {children}
                {/* While a gesture is running the pointer belongs to the frame,
                    not to whatever is under it — an iframe or canvas child
                    would otherwise swallow the move events and the window would
                    stick mid-drag. */}
                {(isDragging || isResizing) && <div className="absolute inset-0 z-50" />}
                 {/* Overlay to catch events when not active */}
                {!isActive && <div className="absolute inset-0 bg-transparent" />}
            </div>

            {/* Resize grips — all eight, so a window can grow in any direction.
                There was one, bottom-right, which meant a window near the
                bottom of the screen could not be made taller at all. */}
            {!effectiveMaximized && HANDLES.map(h => (
                <div
                    key={h.dir}
                    role="presentation"
                    aria-hidden="true"
                    onPointerDown={(e) => beginGesture(e, h.dir)}
                    style={{ cursor: h.cursor }}
                    className={`absolute z-20 touch-none ${h.className}`}
                />
            ))}
        </div>
        </>
    );
};
