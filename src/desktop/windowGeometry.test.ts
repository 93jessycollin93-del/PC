/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * These tests exist because every one of them corresponds to a way a window
 * could previously be lost, hidden, or made unusable. They are written as
 * "can the user still get at it", not as arithmetic checks.
 */
import { describe, it, expect } from 'vitest';
import {
    GRAB_MARGIN,
    MIN_HEIGHT,
    MIN_WIDTH,
    TASKBAR_HEIGHT,
    TITLEBAR_HEIGHT,
    cascadePosition,
    clampToWorkArea,
    fitToWorkArea,
    getLayerWorkArea,
    getWorkArea,
    resizeRect,
    snapRect,
    snapZoneAt,
    toLayer,
} from './windowGeometry';

const AREA = getWorkArea(1440, 900);

describe('work area', () => {
    it('stops above the taskbar so a maximized window is fully visible', () => {
        expect(AREA.height).toBe(900 - TASKBAR_HEIGHT);
    });

    it('survives a viewport smaller than a window can legally be', () => {
        const tiny = getWorkArea(100, 40);
        expect(tiny.width).toBeGreaterThanOrEqual(MIN_WIDTH);
        expect(tiny.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
    });
});

/**
 * These cover the bug a browser stress test found and unit tests did not: the
 * work area was computed from `window.innerHeight` while windows are absolutely
 * positioned inside a layer that starts ~42px down. Every clamp was loose by
 * exactly that offset, so windows settled under the taskbar despite clamping,
 * and snapping never armed because pointer coordinates were compared against
 * bounds in a different coordinate space.
 */
describe('layer coordinates', () => {
    const VH = 900;

    it('stops at the taskbar for a layer that reaches it', () => {
        const full = getLayerWorkArea({ left: 0, top: 42, width: 1440, height: 858 }, VH);
        expect(full.height).toBe(858 - TASKBAR_HEIGHT);
    });

    it('ignores the part of a layer that hangs off the bottom of the screen', () => {
        // The real shape in PC: `h-full` (900) pushed down 42px, so the layer
        // claims 900px of which the last 42 are off-screen entirely and 32 more
        // sit behind the taskbar. Usable is 868 - 42 = 826. Subtracting only
        // the bar left those 42px in play, which is how a window still ended
        // up under it after being "clamped".
        const real = getLayerWorkArea({ left: 0, top: 42, width: 1440, height: 900 }, VH);
        expect(real.height).toBe(826);
    });

    it('takes nothing off a layer that already stops above the taskbar', () => {
        // Half mode: the PC owns the upper half, nowhere near the bar.
        const half = getLayerWorkArea({ left: 0, top: 42, width: 1440, height: 400 }, VH);
        expect(half.height).toBe(400);
    });

    it('trims only the overlapping slice for a layer that just clips the bar', () => {
        // Layer bottom at 880; the bar starts at 868 — 12px of overlap.
        const clipped = getLayerWorkArea({ left: 0, top: 40, width: 1440, height: 840 }, VH);
        expect(clipped.height).toBe(840 - 12);
    });

    it('reports the area in layer coordinates, always starting at the origin', () => {
        const a = getLayerWorkArea({ left: 120, top: 42, width: 800, height: 500 }, VH);
        expect(a.left).toBe(0);
        expect(a.top).toBe(0);
    });

    it('converts a viewport pointer into the layer space the bounds use', () => {
        const layer = { left: 120, top: 42, width: 800, height: 500 };
        expect(toLayer(120, 42, layer)).toEqual({ x: 0, y: 0 });
        expect(toLayer(300, 242, layer)).toEqual({ x: 180, y: 200 });
    });

    it('arms the top snap when the pointer is at the layer top, not the screen top', () => {
        const layer = { left: 0, top: 42, width: 1440, height: 900 };
        const area = getLayerWorkArea(layer, VH);
        const p = toLayer(700, 44, layer);
        expect(snapZoneAt(p.x, p.y, area)).toBe('max');
        // The same viewport y, compared without converting, would be 44 — also
        // within threshold of a viewport-origin area, which is exactly why the
        // old code looked like it worked until the offset grew.
        const deep = toLayer(700, 300, layer);
        expect(snapZoneAt(deep.x, deep.y, area)).toBeNull();
    });

    it('clamps a dragged window against the layer, keeping it clear of the bar', () => {
        const area = getLayerWorkArea({ left: 0, top: 42, width: 1440, height: 900 }, VH);
        const r = clampToWorkArea({ x: 100, y: 99999, width: 600, height: 400 }, area);
        // In layer space; add the layer's own 42px offset to compare to the
        // screen. 42 + y + TITLEBAR must stay above the bar at 868.
        expect(42 + r.y + TITLEBAR_HEIGHT).toBeLessThanOrEqual(VH - TASKBAR_HEIGHT);
    });

    it('never lets a fitted window overlap the taskbar once offset back to the screen', () => {
        const layer = { left: 0, top: 42, width: 1440, height: 900 };
        const area = getLayerWorkArea(layer, VH);
        const r = fitToWorkArea({ x: 0, y: 0, width: 1000, height: 5000 }, area);
        expect(layer.top + r.y + r.height).toBeLessThanOrEqual(VH - TASKBAR_HEIGHT);
    });
});

describe('clampToWorkArea — the titlebar can always be grabbed again', () => {
    it('refuses to let a window go above the top of the screen', () => {
        const r = clampToWorkArea({ x: 200, y: -400, width: 600, height: 400 }, AREA);
        expect(r.y).toBe(AREA.top);
    });

    it('refuses to park a window under the taskbar', () => {
        const r = clampToWorkArea({ x: 200, y: 5000, width: 600, height: 400 }, AREA);
        expect(r.y).toBeLessThanOrEqual(AREA.top + AREA.height - TITLEBAR_HEIGHT);
    });

    it('allows hanging off the left, but keeps a grabbable strip on screen', () => {
        const r = clampToWorkArea({ x: -100000, y: 100, width: 600, height: 400 }, AREA);
        expect(r.x + r.width).toBeGreaterThanOrEqual(GRAB_MARGIN);
    });

    it('allows hanging off the right, but keeps a grabbable strip on screen', () => {
        const r = clampToWorkArea({ x: 100000, y: 100, width: 600, height: 400 }, AREA);
        expect(r.x).toBeLessThanOrEqual(AREA.left + AREA.width - GRAB_MARGIN);
    });

    it('leaves a window that is already inside completely alone', () => {
        const inside = { x: 120, y: 90, width: 600, height: 400 };
        expect(clampToWorkArea(inside, AREA)).toEqual(inside);
    });

    it('never produces a position a further clamp would change (idempotent)', () => {
        const once = clampToWorkArea({ x: -9999, y: -9999, width: 600, height: 400 }, AREA);
        expect(clampToWorkArea(once, AREA)).toEqual(once);
    });
});

describe('fitToWorkArea — an oversized window is shrunk, not cropped', () => {
    it('caps a window taller than the screen to the work area', () => {
        const r = fitToWorkArea({ x: 0, y: 0, width: 2000, height: 2000 }, AREA);
        expect(r.width).toBe(AREA.width);
        expect(r.height).toBe(AREA.height);
    });

    it('pulls a window fully inside rather than leaving an edge off-screen', () => {
        const r = fitToWorkArea({ x: 1400, y: 800, width: 900, height: 600 }, AREA);
        expect(r.x + r.width).toBeLessThanOrEqual(AREA.left + AREA.width);
        expect(r.y + r.height).toBeLessThanOrEqual(AREA.top + AREA.height);
        expect(r.x).toBeGreaterThanOrEqual(AREA.left);
        expect(r.y).toBeGreaterThanOrEqual(AREA.top);
    });

    it('honours the minimum size even on an absurd screen', () => {
        const r = fitToWorkArea({ x: 0, y: 0, width: 10, height: 10 }, getWorkArea(200, 150));
        expect(r.width).toBeGreaterThanOrEqual(MIN_WIDTH);
        expect(r.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
    });
});

describe('resizeRect — all eight directions, none of them corrupting', () => {
    const start = { x: 400, y: 300, width: 600, height: 400 };

    it('grows right without moving the left edge', () => {
        const r = resizeRect(start, 'e', 120, 0, AREA);
        expect(r.x).toBe(start.x);
        expect(r.width).toBe(720);
    });

    it('grows left by moving the origin, keeping the right edge pinned', () => {
        const r = resizeRect(start, 'w', -120, 0, AREA);
        expect(r.x).toBe(280);
        expect(r.x + r.width).toBe(start.x + start.width);
    });

    it('grows up by moving the origin, keeping the bottom edge pinned', () => {
        const r = resizeRect(start, 'n', 0, -120, AREA);
        expect(r.y).toBe(180);
        expect(r.y + r.height).toBe(start.y + start.height);
    });

    it('does not let a north drag push the titlebar off the top', () => {
        const r = resizeRect(start, 'n', 0, -100000, AREA);
        expect(r.y).toBeGreaterThanOrEqual(AREA.top);
    });

    it('does not let a south drag push content under the taskbar', () => {
        const r = resizeRect(start, 's', 100000, 100000, AREA);
        expect(r.y + r.height).toBeLessThanOrEqual(AREA.top + AREA.height);
    });

    it('collapsing westward stops at the minimum without sliding the window', () => {
        const r = resizeRect(start, 'w', 100000, 0, AREA);
        expect(r.width).toBe(MIN_WIDTH);
        expect(r.x + r.width).toBe(start.x + start.width);
    });

    it('collapsing northward stops at the minimum without sliding the window', () => {
        const r = resizeRect(start, 'n', 0, 100000, AREA);
        expect(r.height).toBe(MIN_HEIGHT);
        expect(r.y + r.height).toBe(start.y + start.height);
    });

    it('a corner drag moves both axes', () => {
        const r = resizeRect(start, 'nw', -50, -60, AREA);
        expect(r.x).toBe(350);
        expect(r.y).toBe(240);
        expect(r.width).toBe(650);
        expect(r.height).toBe(460);
    });

    it('never returns a window smaller than the minimum, from any handle', () => {
        for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const) {
            const r = resizeRect(start, dir, -100000, -100000, AREA);
            expect(r.width, dir).toBeGreaterThanOrEqual(MIN_WIDTH);
            expect(r.height, dir).toBeGreaterThanOrEqual(MIN_HEIGHT);
        }
    });
});

describe('snapping', () => {
    it('arms maximize at the top edge', () => {
        expect(snapZoneAt(700, AREA.top, AREA)).toBe('max');
    });

    it('arms half-screen at the left and right edges', () => {
        expect(snapZoneAt(0, 400, AREA)).toBe('left');
        expect(snapZoneAt(1439, 400, AREA)).toBe('right');
    });

    it('stays disarmed in the middle of the screen', () => {
        expect(snapZoneAt(700, 400, AREA)).toBeNull();
    });

    it('left and right halves tile exactly, with no gap or overlap', () => {
        const l = snapRect('left', AREA);
        const r = snapRect('right', AREA);
        expect(l.x + l.width).toBe(r.x);
        expect(r.x + r.width).toBe(AREA.left + AREA.width);
    });

    it('a snapped window never covers the taskbar', () => {
        for (const zone of ['max', 'left', 'right'] as const) {
            const r = snapRect(zone, AREA);
            expect(r.y + r.height, zone).toBeLessThanOrEqual(AREA.top + AREA.height);
        }
    });
});

describe('cascadePosition — the twentieth window is still on screen', () => {
    it('places every window of a long run fully inside the work area', () => {
        for (let i = 0; i < 40; i++) {
            const r = cascadePosition(i, { width: 1000, height: 680 }, AREA);
            expect(r.x, `window ${i}`).toBeGreaterThanOrEqual(AREA.left);
            expect(r.y, `window ${i}`).toBeGreaterThanOrEqual(AREA.top);
            expect(r.x + r.width, `window ${i}`).toBeLessThanOrEqual(AREA.left + AREA.width);
            expect(r.y + r.height, `window ${i}`).toBeLessThanOrEqual(AREA.top + AREA.height);
        }
    });

    it('still succeeds when the window is bigger than the screen', () => {
        const small = getWorkArea(700, 500);
        const r = cascadePosition(5, { width: 1200, height: 900 }, small);
        expect(r.width).toBeLessThanOrEqual(small.width);
        expect(r.height).toBeLessThanOrEqual(small.height);
        expect(r.x).toBeGreaterThanOrEqual(small.left);
        expect(r.y).toBeGreaterThanOrEqual(small.top);
    });

    it('offsets consecutive windows so they are not stacked invisibly', () => {
        const a = cascadePosition(0, { width: 600, height: 400 }, AREA);
        const b = cascadePosition(1, { width: 600, height: 400 }, AREA);
        expect(a.x === b.x && a.y === b.y).toBe(false);
    });
});
