/**
 * Telemetry — the measured truth about every AI call.
 *
 * Six of the ten features on the roadmap need the same underlying facts:
 * which provider/key/model answered, how long it took, whether it worked.
 * Budget Radar needs burn rate, Speed Racer needs latency, Offline Cortex
 * needs a cache signal, the Understudy needs usage patterns. Rather than
 * bolt a counter onto each, the gateway records once and everything reads
 * from here.
 *
 * Deliberately local and bounded: a ring buffer in localStorage, capped so a
 * long session cannot fill the quota that the desktop's own state needs. No
 * call content is stored — only shape and timing — so this is never a
 * transcript of what you asked.
 */
import { safeGetJSON, safeSetJSON } from '../safeStorage';

export interface CallRecord {
    at: number;
    provider: string;
    model: string;
    /** Which key answered, for per-account accounting. Null when keyless. */
    keyId: string | null;
    keyLabel?: string;
    ms: number;
    ok: boolean;
    /** HTTP status when the call failed. */
    status?: number;
    /** Rough token estimate; providers rarely agree, so this is indicative. */
    promptChars: number;
    replyChars: number;
    /** How many providers/keys were tried before this one succeeded. */
    fallbacks: number;
}

const STORAGE_KEY = 'jackie_ai_telemetry_v1';

/** Ring buffer size. ~2000 calls is weeks of normal use at a few KB total. */
const MAX_RECORDS = 2000;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeTelemetry(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

let cache: CallRecord[] | null = null;

export function allCalls(): CallRecord[] {
    if (!cache) cache = safeGetJSON<CallRecord[]>(STORAGE_KEY, []);
    return cache;
}

export function record(entry: CallRecord): void {
    const list = allCalls();
    list.push(entry);
    // Trim from the front: recent behaviour is what every consumer wants.
    if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
    cache = list;
    safeSetJSON(STORAGE_KEY, list, { silent: true });
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* a broken listener must not break a call */
        }
    });
}

export function clearTelemetry(): void {
    cache = [];
    safeSetJSON(STORAGE_KEY, [], { silent: true });
    listeners.forEach((fn) => fn());
}

export function since(ms: number): CallRecord[] {
    const cutoff = Date.now() - ms;
    return allCalls().filter((c) => c.at >= cutoff);
}

/* ── derived views ─────────────────────────────────────────────────────── */

export interface ProviderStats {
    provider: string;
    calls: number;
    ok: number;
    failed: number;
    /** Median, not mean: one cold start should not define a provider. */
    medianMs: number;
    p95Ms: number;
    /** Characters of reply per second — a proxy for tokens/sec. */
    charsPerSec: number;
    lastAt: number;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[i];
}

export function statsByProvider(windowMs = 7 * 24 * 60 * 60 * 1000): ProviderStats[] {
    const rows = since(windowMs);
    const byProvider = new Map<string, CallRecord[]>();
    for (const r of rows) {
        const list = byProvider.get(r.provider) ?? [];
        list.push(r);
        byProvider.set(r.provider, list);
    }
    const out: ProviderStats[] = [];
    for (const [provider, list] of byProvider) {
        const okCalls = list.filter((r) => r.ok);
        const times = okCalls.map((r) => r.ms).sort((a, b) => a - b);
        const totalChars = okCalls.reduce((n, r) => n + r.replyChars, 0);
        const totalSec = okCalls.reduce((n, r) => n + r.ms, 0) / 1000;
        out.push({
            provider,
            calls: list.length,
            ok: okCalls.length,
            failed: list.length - okCalls.length,
            medianMs: percentile(times, 50),
            p95Ms: percentile(times, 95),
            charsPerSec: totalSec > 0 ? Math.round(totalChars / totalSec) : 0,
            lastAt: Math.max(...list.map((r) => r.at)),
        });
    }
    return out.sort((a, b) => b.calls - a.calls);
}

export interface KeyUsage {
    provider: string;
    keyId: string;
    keyLabel?: string;
    calls: number;
    lastAt: number;
    /** Calls in the last hour — the number that predicts a rate limit. */
    lastHour: number;
}

export function usageByKey(): KeyUsage[] {
    const rows = allCalls().filter((r) => r.keyId);
    const hourAgo = Date.now() - 3_600_000;
    const map = new Map<string, KeyUsage>();
    for (const r of rows) {
        const id = `${r.provider}:${r.keyId}`;
        const cur = map.get(id) ?? {
            provider: r.provider,
            keyId: r.keyId!,
            keyLabel: r.keyLabel,
            calls: 0,
            lastAt: 0,
            lastHour: 0,
        };
        cur.calls += 1;
        cur.lastAt = Math.max(cur.lastAt, r.at);
        if (r.at >= hourAgo) cur.lastHour += 1;
        if (r.keyLabel) cur.keyLabel = r.keyLabel;
        map.set(id, cur);
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
}

/** Calls bucketed by hour, for sparklines. */
export function callsPerHour(hours = 24): { hour: number; calls: number; failed: number }[] {
    const now = Date.now();
    const buckets: { hour: number; calls: number; failed: number }[] = [];
    for (let i = hours - 1; i >= 0; i -= 1) {
        const start = now - (i + 1) * 3_600_000;
        const end = now - i * 3_600_000;
        const rows = allCalls().filter((r) => r.at >= start && r.at < end);
        buckets.push({ hour: i, calls: rows.length, failed: rows.filter((r) => !r.ok).length });
    }
    return buckets;
}

/** The fastest provider by measured median, among those used recently. */
export function fastestProvider(minCalls = 3): string | null {
    const stats = statsByProvider().filter((s) => s.ok >= minCalls);
    if (stats.length === 0) return null;
    return stats.sort((a, b) => a.medianMs - b.medianMs)[0].provider;
}
