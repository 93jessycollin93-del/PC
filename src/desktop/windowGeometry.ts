/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WINDOW GEOMETRY — where a window is allowed to be.
 *
 * Every rule about window placement lives here as a pure function, for two
 * reasons. It can be tested without a browser, and — more importantly — there
 * is exactly one answer to each question. The bugs this replaces all came from
 * having no answer at all:
 *
 *   - Dragging was `pos = pointer - grabOffset` with no bound, so a window
 *     pushed above the top of the screen took its titlebar with it and could
 *     never be grabbed again. The app was still open and permanently
 *     unreachable.
 *   - "Maximize" meant `inset-0`, which is the whole viewport including the
 *     32px taskbar pinned over the bottom of it. Every maximized window had
 *     its last row of content hidden behind the bar.
 *   - One resize handle, bottom-right. A window could only ever grow down and
 *     right, so a window opened near the bottom of the screen could not be
 *     made taller at all.
 *   - Nothing reacted to the browser being resized. Shrink the window and
 *     anything positioned past the new edge was simply gone.
 *
 * COORDINATES
 * -----------
 * All rects are in LAYER coordinates: pixels relative to the positioned
 * ancestor a window's `left`/`top` resolve against, not the viewport.
 *
 * This distinction is the whole ballgame and it is easy to get wrong, because
 * on a full-bleed desktop the two are identical and every test passes. PC's
 * window layer sits below a ~42px top bar, and in half mode it is only part of
 * the screen — so a work area computed from `window.innerHeight` is wrong by
 * exactly the offset, and every clamp lets windows drift that far past the
 * bottom. Pointer events arrive in viewport coordinates and MUST be converted
 * (see `toLayer`) before being compared against anything here.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** The rectangle windows are allowed to occupy: the viewport minus the shell. */
export interface WorkArea {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** BottomBar is `fixed bottom-0 h-8`. Maximized windows must stop above it. */
export const TASKBAR_HEIGHT = 32;

/** Smallest a window may be dragged down to. Below this the chrome overlaps itself. */
export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 220;

/**
 * How much of the titlebar must remain inside the work area horizontally.
 * A window may hang off the left or right edge — that is useful for reading a
 * wide document — but never so far that there is nothing left to grab.
 */
export const GRAB_MARGIN = 96;

/** How close to an edge the pointer must be for a snap zone to arm. */
export const SNAP_THRESHOLD = 12;

export type SnapZone = 'max' | 'left' | 'right' | null;

/** The eight directions a window can be resized from, plus 'move'. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function getWorkArea(viewportWidth: number, viewportHeight: number): WorkArea {
    return {
        left: 0,
        top: 0,
        width: Math.max(MIN_WIDTH, viewportWidth),
        height: Math.max(MIN_HEIGHT, viewportHeight - TASKBAR_HEIGHT),
    };
}

/** A DOMRect, narrowed to what the geometry needs and easy to fabricate in tests. */
export interface LayerBox {
    /** Viewport x of the layer's left edge. */
    left: number;
    /** Viewport y of the layer's top edge. */
    top: number;
    width: number;
    height: number;
}

/**
 * The work area for windows living inside a positioned layer.
 *
 * Returned in LAYER coordinates — origin (0,0) is the layer's own top-left,
 * which is what `left`/`top` on an absolutely positioned child mean.
 *
 * The rule is "where can a window be and still be SEEN", which is not the same
 * as the layer's own height. PC's window layer is `h-full` inside a full-height
 * parent while also being pushed down 42px by the top bar, so it is 900px tall
 * with its bottom 42px hanging off the bottom of a 900px screen — and the
 * taskbar covers 32px more above that. A layer's height is therefore an upper
 * bound on the usable area, never the usable area itself.
 *
 * So: walk both edges in to whichever comes first, the layer's own end or the
 * first thing that hides it, and express the result back in layer coordinates.
 * The earlier version subtracted only the taskbar, which left the 42px of
 * overflow in play and is exactly why windows still settled under the bar
 * after being "clamped".
 */
export function getLayerWorkArea(layer: LayerBox, viewportHeight: number, viewportWidth?: number): WorkArea {
    const screenWidth = viewportWidth ?? layer.left + layer.width;
    const taskbarTop = viewportHeight - TASKBAR_HEIGHT;

    // Visible bounds in viewport coordinates...
    const visibleBottom = Math.min(layer.top + layer.height, taskbarTop);
    const visibleRight = Math.min(layer.left + layer.width, screenWidth);
    // ...converted back to the layer's own space. A layer scrolled above the
    // viewport keeps a positive origin so windows are not placed out of sight.
    const top = Math.max(0, -layer.top);
    const left = Math.max(0, -layer.left);

    return {
        left,
        top,
        width: Math.max(MIN_WIDTH, visibleRight - layer.left - left),
        height: Math.max(MIN_HEIGHT, visibleBottom - layer.top - top),
    };
}

/** Convert a viewport pointer position into the layer's coordinate space. */
export function toLayer(clientX: number, clientY: number, layer: LayerBox): { x: number; y: number } {
    return { x: clientX - layer.left, y: clientY - layer.top };
}

/**
 * Constrain a dragged window so it can always be grabbed again.
 *
 * Deliberately asymmetric: the top edge is hard-clamped to the work area
 * because the titlebar lives there and losing it loses the window, while the
 * left and right are soft — a window may hang off the side as long as
 * GRAB_MARGIN of it stays reachable. The bottom is clamped to the taskbar so a
 * window cannot be parked underneath it.
 */
export function clampToWorkArea(rect: Rect, area: WorkArea): Rect {
    const minX = area.left - Math.max(0, rect.width - GRAB_MARGIN);
    const maxX = area.left + area.width - GRAB_MARGIN;
    const maxY = area.top + area.height - TITLEBAR_HEIGHT;
    return {
        ...rect,
        x: Math.min(Math.max(rect.x, minX), Math.max(minX, maxX)),
        y: Math.min(Math.max(rect.y, area.top), Math.max(area.top, maxY)),
    };
}

/** Height of the window titlebar; the strip that must stay on screen. */
export const TITLEBAR_HEIGHT = 34;

/**
 * Place a window that is opening, or re-place one after the viewport changed.
 *
 * Unlike `clampToWorkArea` this may shrink the window: an app that asks for
 * 1040x700 on a 900px-tall laptop is not being unreasonable, it just cannot
 * have what it asked for, and the honest response is to give it the work area
 * rather than let a fifth of it fall off the bottom.
 */
export function fitToWorkArea(rect: Rect, area: WorkArea): Rect {
    const width = Math.max(MIN_WIDTH, Math.min(rect.width, area.width));
    const height = Math.max(MIN_HEIGHT, Math.min(rect.height, area.height));
    const x = Math.min(Math.max(rect.x, area.left), area.left + area.width - width);
    const y = Math.min(Math.max(rect.y, area.top), area.top + area.height - height);
    return { x: Math.max(area.left, x), y: Math.max(area.top, y), width, height };
}

/**
 * Apply a resize drag.
 *
 * The subtlety is the north and west handles: growing upward moves the origin
 * as well as the size, and the two must stay consistent or the window appears
 * to slide while being resized. Clamping the size at the minimum without also
 * pinning the origin is what produces that — hence the explicit bottom/right
 * edges below rather than arithmetic on width alone.
 */
export function resizeRect(
    start: Rect,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    area: WorkArea,
): Rect {
    let { x, y, width, height } = start;
    const right = start.x + start.width;
    const bottom = start.y + start.height;

    if (handle.includes('e')) width = start.width + dx;
    if (handle.includes('s')) height = start.height + dy;
    if (handle.includes('w')) {
        x = Math.min(start.x + dx, right - MIN_WIDTH);
        width = right - x;
    }
    if (handle.includes('n')) {
        y = Math.min(start.y + dy, bottom - MIN_HEIGHT);
        height = bottom - y;
    }

    // Never let a resize push content under the taskbar or above the top.
    if (y < area.top) {
        height -= area.top - y;
        y = area.top;
    }
    width = Math.max(MIN_WIDTH, width);
    height = Math.max(MIN_HEIGHT, Math.min(height, area.top + area.height - y));
    return { x, y, width, height };
}

/**
 * Which snap zone, if any, the pointer is currently in.
 *
 * Windows' rule, because it is the one people already have in their hands:
 * top edge maximizes, left and right edges take half. Corners are not special
 * — quarter-tiling needs a modifier key to be discoverable and this does not
 * have one, so the nearest whole-edge zone wins.
 */
export function snapZoneAt(pointerX: number, pointerY: number, area: WorkArea): SnapZone {
    if (pointerY <= area.top + SNAP_THRESHOLD) return 'max';
    if (pointerX <= area.left + SNAP_THRESHOLD) return 'left';
    if (pointerX >= area.left + area.width - SNAP_THRESHOLD) return 'right';
    return null;
}

/** The rectangle a snap zone resolves to. */
export function snapRect(zone: Exclude<SnapZone, null>, area: WorkArea): Rect {
    const half = Math.floor(area.width / 2);
    if (zone === 'max') return { x: area.left, y: area.top, width: area.width, height: area.height };
    if (zone === 'left') return { x: area.left, y: area.top, width: half, height: area.height };
    return { x: area.left + half, y: area.top, width: area.width - half, height: area.height };
}

/**
 * Where a newly opened window goes.
 *
 * The old rule was `100 + n*30, 80 + n*30` forever, so the eighth window
 * opened at (310, 290) with a 1000x680 body — 90px of it below a 900px
 * screen. This cascades within the work area and starts over when it would
 * run out, which is what every real window manager does.
 */
export function cascadePosition(index: number, size: { width: number; height: number }, area: WorkArea): Rect {
    const step = 30;
    const maxSteps = Math.max(
        1,
        Math.floor(Math.min(area.width - size.width, area.height - size.height) / step),
    );
    const n = maxSteps > 0 ? index % maxSteps : 0;
    return fitToWorkArea(
        { x: area.left + 40 + n * step, y: area.top + 24 + n * step, width: size.width, height: size.height },
        area,
    );
}
