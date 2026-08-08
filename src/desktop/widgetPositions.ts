/**
 * Widget positions — where the floating widgets live, and how that survives.
 *
 * Every floating widget used to nail itself to the screen with a Tailwind
 * `fixed bottom-4` and stay there forever. Exactly one (FloatingNav) could be
 * moved, because it carried ~95 lines of drag logic of its own and wrote to a
 * key only it knew about. That is why the ⌘ orb would not move: nothing was
 * broken, the capability simply only ever existed in one component.
 *
 * This module is the storage half of the replacement. One key holds a map of
 * widget id → position, so:
 *   • adding a movable widget costs no new storage key,
 *   • "reset every widget" is a single remove rather than a list someone has
 *     to remember to keep up to date.
 *
 * Positions are viewport pixels of the widget's top-left corner. They are
 * clamped on read against the *current* viewport (see `clampToViewport`),
 * which is what stops a widget dragged to the bottom in landscape from
 * sitting off-screen forever after a rotation.
 */

export interface WidgetPosition {
    x: number;
    y: number;
}

export type WidgetPositionMap = Record<string, WidgetPosition>;

const STORAGE_KEY = 'pc_widget_positions_v1';

/** Keeps a dragged widget from being pushed fully off any edge. */
const EDGE_MARGIN = 8;

function readAll(): WidgetPositionMap {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        // A corrupt entry must not take out every other widget's position.
        const out: WidgetPositionMap = {};
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
            const v = value as Partial<WidgetPosition> | null;
            if (v && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y)) {
                out[id] = { x: v.x, y: v.y };
            }
        }
        return out;
    } catch {
        return {};
    }
}

function writeAll(map: WidgetPositionMap): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* quota or private mode — the widget still moves, it just will not
           be remembered. Not worth interrupting a drag over. */
    }
}

export function loadWidgetPosition(id: string): WidgetPosition | null {
    return readAll()[id] ?? null;
}

export function saveWidgetPosition(id: string, pos: WidgetPosition): void {
    const all = readAll();
    all[id] = pos;
    writeAll(all);
}

export function clearWidgetPosition(id: string): void {
    const all = readAll();
    delete all[id];
    writeAll(all);
}

/** Send every widget back to the position its component declares. */
export function clearAllWidgetPositions(): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* nothing to clear */
    }
    // Same-tab listeners: `storage` only fires in *other* tabs, so widgets
    // mounted here would keep their old position until a reload without this.
    window.dispatchEvent(new CustomEvent('pc-widget-positions-reset'));
}

/**
 * Pull a position back inside the viewport.
 *
 * Called on restore and on every resize/orientation change. `width`/`height`
 * are the widget's measured size — the previous implementation used two
 * hardcoded constants (150 and 50) for every widget regardless of its real
 * size, so a wide toolbar could still be dragged most of the way off-screen.
 */
export function clampToViewport(
    pos: WidgetPosition,
    width: number,
    height: number,
): WidgetPosition {
    if (typeof window === 'undefined') return pos;
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN);
    return {
        x: Math.min(Math.max(EDGE_MARGIN, pos.x), maxX),
        y: Math.min(Math.max(EDGE_MARGIN, pos.y), maxY),
    };
}
