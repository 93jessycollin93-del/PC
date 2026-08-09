/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useLayerWorkArea — measure the box a window is actually positioned against.
 *
 * A window's `left`/`top` resolve against its offset parent, not the viewport.
 * PC's window layer sits under a top bar and, in half mode, occupies only part
 * of the screen. Computing bounds from `window.innerHeight` is therefore wrong
 * by the layer's offset, and every clamp is loose by exactly that much — which
 * is how windows ended up parked under the taskbar despite being clamped.
 *
 * Measured rather than assumed, because the offset is not a constant: it moves
 * with the theme's chrome and with the PC's full/half split.
 */
import { useEffect, useState } from 'react';
import {
    getLayerWorkArea,
    type LayerBox,
    type WorkArea,
} from './windowGeometry';

/** Fallback used before the first measurement and in non-browser renders. */
function viewportBox(): LayerBox {
    if (typeof window === 'undefined') return { left: 0, top: 0, width: 1024, height: 768 };
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

export interface LayerGeometry {
    /** The layer's box in VIEWPORT coordinates — for converting pointer events. */
    layer: LayerBox;
    /** Where windows may sit, in LAYER coordinates. */
    area: WorkArea;
}

/**
 * @param ref  Any element inside the layer. Its `offsetParent` is the layer.
 */
export function useLayerWorkArea(ref: React.RefObject<HTMLElement | null>): LayerGeometry {
    const [layer, setLayer] = useState<LayerBox>(viewportBox);

    useEffect(() => {
        const measure = () => {
            const parent = (ref.current?.offsetParent as HTMLElement | null) ?? null;
            const box = parent ? parent.getBoundingClientRect() : null;
            // A zero-size parent means the layer is mid-mount or hidden;
            // adopting it would clamp every window to nothing.
            const next: LayerBox = box && box.width > 0 && box.height > 0
                ? { left: box.left, top: box.top, width: box.width, height: box.height }
                : viewportBox();
            setLayer(prev =>
                prev.left === next.left && prev.top === next.top
                    && prev.width === next.width && prev.height === next.height ? prev : next,
            );
        };

        measure();

        // The layer resizes without the viewport resizing — switching the PC
        // between full and half is exactly that — so observe the element too.
        const parent = (ref.current?.offsetParent as HTMLElement | null) ?? null;
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (parent && observer) observer.observe(parent);
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);
        // Scrolling moves the layer relative to the viewport, which changes the
        // pointer conversion even though nothing was resized.
        window.addEventListener('scroll', measure, true);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [ref]);

    const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
    const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
    return { layer, area: getLayerWorkArea(layer, viewportHeight, viewportWidth) };
}
