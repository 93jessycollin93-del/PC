/**
 * Offline Cortex — answers kept so the PC can still speak with no network.
 *
 * The sovereignty thesis in AGENTS.md says the machine should stay useful
 * when disconnected. Today every AI surface fails closed. This caches
 * question→answer pairs and serves them when the network is gone, so the
 * common things you ask still work on a plane.
 *
 * Matching is normalized rather than exact: "what is a pod?" and "What's a
 * pod" are the same question, and an exact-match cache would miss almost
 * every real repeat.
 */
import { safeGetJSON, safeSetJSON } from '../safeStorage';
import { chat } from './gateway';

export interface CachedAnswer {
    id: string;
    question: string;
    /** Normalized form, used for lookup. */
    key: string;
    answer: string;
    provider: string;
    at: number;
    hits: number;
    /** Pinned entries are never evicted. */
    pinned?: boolean;
}

const STORAGE_KEY = 'jackie_cortex_v1';
const MAX_ENTRIES = 300;

/** Strip case, punctuation and filler so near-identical questions collide. */
export function normalize(q: string): string {
    return q
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\b(the|a|an|is|are|of|to|for|please|can you|what s|whats)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function listCache(): CachedAnswer[] {
    return safeGetJSON<CachedAnswer[]>(STORAGE_KEY, []);
}

function persist(list: CachedAnswer[]): void {
    safeSetJSON(STORAGE_KEY, list, { silent: true });
}

export function lookup(question: string): CachedAnswer | null {
    const key = normalize(question);
    if (!key) return null;
    const list = listCache();
    const exact = list.find((e) => e.key === key);
    if (exact) return exact;
    // Containment either way catches "what is a pod" vs "what is a pod in sas".
    return list.find((e) => e.key.includes(key) || key.includes(e.key)) ?? null;
}

export function remember(question: string, answer: string, provider: string): void {
    const key = normalize(question);
    if (!key) return;
    const list = listCache();
    const existing = list.findIndex((e) => e.key === key);
    if (existing >= 0) {
        list[existing] = { ...list[existing], answer, provider, at: Date.now() };
    } else {
        list.push({ id: crypto.randomUUID(), question, key, answer, provider, at: Date.now(), hits: 0 });
    }
    // Evict least-used unpinned entries once over budget.
    if (list.length > MAX_ENTRIES) {
        const unpinned = list.filter((e) => !e.pinned).sort((a, b) => a.hits - b.hits || a.at - b.at);
        const drop = new Set(unpinned.slice(0, list.length - MAX_ENTRIES).map((e) => e.id));
        persist(list.filter((e) => !drop.has(e.id)));
        return;
    }
    persist(list);
}

export function noteHit(id: string): void {
    persist(listCache().map((e) => (e.id === id ? { ...e, hits: e.hits + 1 } : e)));
}

export function setPinned(id: string, pinned: boolean): void {
    persist(listCache().map((e) => (e.id === id ? { ...e, pinned } : e)));
}

export function forget(id: string): void {
    persist(listCache().filter((e) => e.id !== id));
}

export function clearCortex(): void {
    persist([]);
}

/**
 * Ask, preferring the network but falling back to the cache.
 *
 * Returns `fromCache` so a caller can be honest about serving a remembered
 * answer instead of a fresh one — presenting stale text as live would be the
 * wrong kind of helpful.
 */
export async function askWithCortex(
    question: string,
    model?: string,
): Promise<{ text: string; fromCache: boolean; provider: string; at?: number }> {
    // Offline is knowable up front; do not burn a doomed request first.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (!offline) {
        try {
            const res = await chat({ messages: [{ role: 'user', content: question }], model });
            remember(question, res.text, res.provider);
            return { text: res.text, fromCache: false, provider: res.provider };
        } catch {
            /* fall through to the cache */
        }
    }
    const hit = lookup(question);
    if (hit) {
        noteHit(hit.id);
        return { text: hit.answer, fromCache: true, provider: hit.provider, at: hit.at };
    }
    throw new Error(
        offline
            ? 'You are offline and this question is not in the Cortex yet.'
            : 'No provider answered, and nothing similar is cached.',
    );
}

/** Pre-warm the cache by asking a list of questions while online. */
export async function precompute(
    questions: string[],
    onProgress?: (done: number, total: number, q: string) => void,
): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        onProgress?.(i, questions.length, q);
        try {
            const res = await chat({ messages: [{ role: 'user', content: q }] });
            remember(q, res.text, res.provider);
            ok += 1;
        } catch {
            failed += 1;
        }
    }
    onProgress?.(questions.length, questions.length, '');
    return { ok, failed };
}
