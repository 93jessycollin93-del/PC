/**
 * Recorder — everything the OS does, as an inspectable stream.
 *
 * The bus already carries every meaningful action in the desktop, but the
 * events vanish the instant they are handled. Capturing them turns three
 * separate ideas into one substrate: time-travel debugging (replay what
 * happened), macros (replay it on purpose), and the Cartographer (draw what
 * actually talks to what).
 *
 * Capture is OFF by default and explicitly started, because a recorder that
 * runs unasked is surveillance rather than a tool.
 */
import { bus, type BusChannel } from '../bus';
import { safeGetJSON, safeSetJSON } from '../safeStorage';

export interface BusEvent {
    at: number;
    channel: string;
    /** Payload, shallow-serialized. Big or circular values are summarized. */
    detail?: unknown;
}

const STORAGE_KEY = 'jackie_bus_recording_v1';
const MAX_EVENTS = 5000;

/** Channels worth recording. The rest are high-frequency noise. */
const WATCHED: BusChannel[] = [
    'launch-app',
    'refresh-desktop',
    'open-command-palette',
    'open-router-menu',
    'global-back-request',
    'jackie-notification',
    'permission-changed',
    'permission-denied',
    'automation-run',
    'scheduler-run',
    'app-error',
    'app-reset',
    'clipboard-copied',
    'clipboard-pasted',
    'voice-command-executed',
    'cloud-sync-status',
];

let events: BusEvent[] = [];
let unsubscribers: (() => void)[] = [];
let recording = false;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeRecorder(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* never let a listener break capture */
        }
    });
}

/** Reduce any payload to something safe to keep and cheap to render. */
function summarize(detail: unknown): unknown {
    if (detail === undefined || detail === null) return undefined;
    if (typeof detail !== 'object') return detail;
    try {
        const json = JSON.stringify(detail);
        if (json.length <= 400) return JSON.parse(json);
        return { summary: `${json.slice(0, 200)}…`, bytes: json.length };
    } catch {
        // Circular or non-serializable — the shape is still useful.
        return { unserializable: Object.prototype.toString.call(detail) };
    }
}

export function isRecording(): boolean {
    return recording;
}

export function startRecording(): void {
    if (recording) return;
    recording = true;
    for (const channel of WATCHED) {
        unsubscribers.push(
            bus.on(channel, (detail: unknown) => {
                events.push({ at: Date.now(), channel, detail: summarize(detail) });
                if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
                notify();
            }),
        );
    }
    notify();
}

export function stopRecording(): void {
    recording = false;
    unsubscribers.forEach((off) => off());
    unsubscribers = [];
    notify();
}

export function getEvents(): BusEvent[] {
    return events;
}

export function clearEvents(): void {
    events = [];
    notify();
}

export function saveRecording(name: string): void {
    const saved = safeGetJSON<Record<string, BusEvent[]>>(STORAGE_KEY, {});
    saved[name] = events;
    safeSetJSON(STORAGE_KEY, saved, { silent: true });
    notify();
}

export function listRecordings(): string[] {
    return Object.keys(safeGetJSON<Record<string, BusEvent[]>>(STORAGE_KEY, {}));
}

export function loadRecording(name: string): BusEvent[] {
    return safeGetJSON<Record<string, BusEvent[]>>(STORAGE_KEY, {})[name] ?? [];
}

export function deleteRecording(name: string): void {
    const saved = safeGetJSON<Record<string, BusEvent[]>>(STORAGE_KEY, {});
    delete saved[name];
    safeSetJSON(STORAGE_KEY, saved, { silent: true });
    notify();
}

/**
 * Replay a recording by re-emitting its events.
 *
 * `speed` scales the original gaps, so a session recorded over a minute can
 * be replayed in seconds. Only replayable channels are re-emitted —
 * re-firing a notification or an error would be theatre, not a replay.
 */
const REPLAYABLE = new Set<string>(['launch-app', 'open-command-palette', 'open-router-menu', 'refresh-desktop']);

export async function replay(
    list: BusEvent[],
    opts: { speed?: number; signal?: AbortSignal; onStep?: (e: BusEvent, i: number) => void } = {},
): Promise<void> {
    const speed = opts.speed ?? 4;
    for (let i = 0; i < list.length; i += 1) {
        if (opts.signal?.aborted) return;
        const e = list[i];
        if (i > 0) {
            const gap = Math.min(3000, (e.at - list[i - 1].at) / speed);
            if (gap > 0) await new Promise((r) => setTimeout(r, gap));
        }
        if (REPLAYABLE.has(e.channel)) {
            // Cast is contained here: the channel came from a real emission,
            // so its payload already matched the channel's type.
            bus.emit(e.channel as BusChannel, e.detail as never);
        }
        opts.onStep?.(e, i);
    }
}

/* ── the graph, for the Cartographer ───────────────────────────────────── */

export interface OsEdge {
    from: string;
    to: string;
    count: number;
}

/**
 * Which channels follow which, within a short window. Not a call graph — a
 * behavioural one, built from what actually happened rather than what the
 * imports imply.
 */
export function buildGraph(list: BusEvent[] = events, windowMs = 2000): OsEdge[] {
    const edges = new Map<string, OsEdge>();
    for (let i = 0; i < list.length - 1; i += 1) {
        const a = list[i];
        const b = list[i + 1];
        if (b.at - a.at > windowMs) continue;
        const id = `${a.channel}→${b.channel}`;
        const edge = edges.get(id) ?? { from: a.channel, to: b.channel, count: 0 };
        edge.count += 1;
        edges.set(id, edge);
    }
    return [...edges.values()].sort((x, y) => y.count - x.count);
}
