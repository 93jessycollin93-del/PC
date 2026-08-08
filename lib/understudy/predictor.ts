/**
 * The Understudy — learns the shape of a session and gets there first.
 *
 * Every desktop makes you re-derive your own routine by hand: open the same
 * three apps in the same order, wait for the same chunk to download, wait for
 * the same model list to fetch. None of that is new information after the
 * fifth time.
 *
 * So this watches `launch-app` and builds two small models:
 *   • a first-order transition table — what you open *after* what,
 *   • an hour-of-day histogram — what you open *at* this time.
 * Predictions blend the two, because "what's next" and "what's next at 9am"
 * are different questions and the second one is often the better answer.
 *
 * It only ever acts by prefetching. It never opens an app on its own: a
 * desktop that launches things you did not ask for is a worse desktop, no
 * matter how good the guess.
 */
import { bus } from '../bus';
import { safeGetJSON, safeSetJSON } from '../safeStorage';
import { APP_REGISTRY, type PreloadableLazy } from '../appRegistry';
import type { AppId } from '../../types';

export interface UnderstudyModel {
    /** from → to → count. */
    transitions: Record<string, Record<string, number>>;
    /** hour (0-23) → appId → count. */
    byHour: Record<string, Record<string, number>>;
    /** appId → total opens. */
    totals: Record<string, number>;
    /** Rolling launch log, newest last. Capped — this is a model, not an archive. */
    recent: { appId: string; at: number }[];
    /** Predictions made vs. predictions the next launch confirmed. */
    scored: { hits: number; misses: number };
}

export interface Prediction {
    appId: string;
    /** 0-1. Blended from the transition and hour-of-day models. */
    confidence: number;
    /** Why this app, in words a person can check. */
    reason: string;
    /** True when the app's chunk can actually be warmed. */
    preloadable: boolean;
}

const STORAGE_KEY = 'jackie_understudy_v1';
const MAX_RECENT = 400;
/** Below this, the model is guessing rather than predicting. */
const MIN_SAMPLES = 3;

function empty(): UnderstudyModel {
    return { transitions: {}, byHour: {}, totals: {}, recent: [], scored: { hits: 0, misses: 0 } };
}

export function loadModel(): UnderstudyModel {
    const m = safeGetJSON<UnderstudyModel>(STORAGE_KEY, empty());
    // Tolerate a model written by an older shape rather than throwing it away.
    return {
        transitions: m.transitions ?? {},
        byHour: m.byHour ?? {},
        totals: m.totals ?? {},
        recent: m.recent ?? [],
        scored: m.scored ?? { hits: 0, misses: 0 },
    };
}

function save(m: UnderstudyModel): void {
    safeSetJSON(STORAGE_KEY, m, { silent: true });
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* one bad listener must not stop the rest */
        }
    });
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeUnderstudy(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Enabled by default off — learning about someone is opt-in. */
const ENABLED_KEY = 'jackie_understudy_enabled_v1';

export function isEnabled(): boolean {
    return safeGetJSON<boolean>(ENABLED_KEY, false);
}

export function setEnabled(on: boolean): void {
    safeSetJSON(ENABLED_KEY, on, { silent: true });
    if (on) start();
    else stop();
    listeners.forEach((fn) => fn());
}

/** The last set of predictions, kept so the next launch can score them. */
let lastPredictions: string[] = [];

export function record(appId: string, at = Date.now()): void {
    const m = loadModel();
    const prev = m.recent[m.recent.length - 1];

    // Score the previous prediction before it is overwritten. A predictor
    // that never reports its own accuracy is asking to be trusted blindly.
    if (lastPredictions.length) {
        if (lastPredictions.includes(appId)) m.scored.hits += 1;
        else m.scored.misses += 1;
        lastPredictions = [];
    }

    // Re-opening the app you are already in says nothing about sequence.
    if (prev && prev.appId !== appId) {
        const row = (m.transitions[prev.appId] ??= {});
        row[appId] = (row[appId] ?? 0) + 1;
    }

    const hour = String(new Date(at).getHours());
    const hrow = (m.byHour[hour] ??= {});
    hrow[appId] = (hrow[appId] ?? 0) + 1;

    m.totals[appId] = (m.totals[appId] ?? 0) + 1;
    m.recent.push({ appId, at });
    if (m.recent.length > MAX_RECENT) m.recent = m.recent.slice(-MAX_RECENT);

    save(m);
}

function preloadableFor(appId: string): PreloadableLazy | null {
    const def = APP_REGISTRY[appId as AppId];
    const C = def?.Component as PreloadableLazy | undefined;
    return C && typeof C.preload === 'function' ? C : null;
}

/**
 * Rank what is likely to come next.
 *
 * Transition evidence is weighted above the hour-of-day signal because "you
 * just opened the Vault" is a sharper cue than "it is 3pm", but the hour
 * model carries the session's first launch, when there is no previous app.
 */
export function predictNext(currentAppId: string | null, limit = 4): Prediction[] {
    const m = loadModel();
    const scores = new Map<string, { p: number; reasons: string[] }>();

    const bump = (appId: string, p: number, reason: string) => {
        const cur = scores.get(appId) ?? { p: 0, reasons: [] };
        cur.p += p;
        cur.reasons.push(reason);
        scores.set(appId, cur);
    };

    if (currentAppId) {
        const row = m.transitions[currentAppId] ?? {};
        const total = Object.values(row).reduce((a, b) => a + b, 0);
        if (total >= MIN_SAMPLES) {
            for (const [appId, n] of Object.entries(row)) {
                bump(appId, 0.65 * (n / total), `${Math.round((n / total) * 100)}% of the time after this app`);
            }
        }
    }

    const hour = String(new Date().getHours());
    const hrow = m.byHour[hour] ?? {};
    const htotal = Object.values(hrow).reduce((a, b) => a + b, 0);
    if (htotal >= MIN_SAMPLES) {
        for (const [appId, n] of Object.entries(hrow)) {
            bump(appId, 0.35 * (n / htotal), `often opened around ${hour}:00`);
        }
    }

    // Nothing learned yet — say so by returning nothing rather than
    // inventing a ranking from a single data point.
    if (!scores.size) return [];

    if (currentAppId) scores.delete(currentAppId);

    return [...scores.entries()]
        .map(([appId, s]) => ({
            appId,
            confidence: Math.min(1, s.p),
            reason: s.reasons.join(' · '),
            preloadable: !!preloadableFor(appId),
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);
}

/** Repeated three-app sequences — the routines worth naming. */
export function routines(minCount = 2): { chain: string[]; count: number }[] {
    const m = loadModel();
    const seen = new Map<string, number>();
    for (let i = 0; i + 2 < m.recent.length; i += 1) {
        const chain = [m.recent[i].appId, m.recent[i + 1].appId, m.recent[i + 2].appId];
        if (new Set(chain).size < 3) continue; // A→A→B is not a routine.
        const key = chain.join('>');
        seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.entries()]
        .filter(([, n]) => n >= minCount)
        .map(([key, count]) => ({ chain: key.split('>'), count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Warm what the predictions imply, and report what was actually warmed.
 *
 * Only apps registered in APP_REGISTRY carry a preloadable chunk; the rest
 * are compiled into the shell already, so there is nothing to fetch and
 * claiming otherwise would be theatre.
 */
export async function prefetch(predictions: Prediction[], minConfidence = 0.25): Promise<string[]> {
    const warmed: string[] = [];
    for (const p of predictions) {
        if (p.confidence < minConfidence) continue;
        const C = preloadableFor(p.appId);
        if (!C) continue;
        try {
            await C.preload();
            warmed.push(p.appId);
        } catch {
            /* a chunk that will not fetch now will fetch on click */
        }
    }
    lastPredictions = predictions.map((p) => p.appId);
    return warmed;
}

export function accuracy(): number | null {
    const { hits, misses } = loadModel().scored;
    const total = hits + misses;
    return total ? hits / total : null;
}

export function resetModel(): void {
    lastPredictions = [];
    save(empty());
}

let unsubscribe: (() => void) | null = null;
let current: string | null = null;

/** Begin watching launches. Idempotent. */
export function start(): void {
    if (unsubscribe) return;
    unsubscribe = bus.on('launch-app', ({ appId }) => {
        const id = String(appId);
        record(id);
        current = id;
        // Predict and warm for the *next* step, not this one.
        void prefetch(predictNext(id));
    });
}

export function stop(): void {
    unsubscribe?.();
    unsubscribe = null;
}

export function currentApp(): string | null {
    return current;
}

/** Called once at boot; a disabled Understudy costs nothing. */
export function initUnderstudy(): void {
    if (isEnabled()) start();
}
