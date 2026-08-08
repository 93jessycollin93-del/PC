/**
 * Keyring — every API key, in one place, with room for many per provider.
 *
 * WHY THIS EXISTS
 * ───────────────
 * There were three key stores that did not know about each other:
 *
 *   • components/apps/APIKeysApp.tsx wrote `groq_api_key`, `gemini_api_key`, …
 *   • lib/ai/catalog.ts read `jackie_ai_key_*`
 *   • lib/secretsVault.ts held its own encrypted blob
 *
 * So a key typed into Settings → API Keys was written somewhere the AI
 * gateway never looked, and chat kept reporting "no provider set up" while
 * the key sat right there on screen. This module is the single source of
 * truth; `migrate()` sweeps the old locations in so nothing already saved is
 * lost.
 *
 * MANY KEYS PER PROVIDER
 * ──────────────────────
 * A provider holds a LIST of keys, not one. Free tiers are per-account, so
 * three Groq accounts are three separate allowances — the point of the list
 * is to use all of them. Selection is STICKY: the first healthy key is used
 * until it rate-limits, then the next takes over. Round-robin would spread
 * requests thinly across every account and hit all their limits at once;
 * sticky drains one allowance fully before touching the next.
 *
 * Rate limits are temporary, so a 429'd key is put on a cooldown and skipped
 * until it expires rather than being retried into the ground. A key that is
 * actually *rejected* (401/403) is marked bad and stays out of rotation until
 * the user edits it.
 */

export type KeyStatus = 'untested' | 'ok' | 'cooling' | 'rejected' | 'error';

export interface KeyEntry {
    /** Stable id, so the UI can address a key without using its secret. */
    id: string;
    key: string;
    /** Optional user label — "work", "burner 2" — for telling accounts apart. */
    label?: string;
    addedAt: number;
    status: KeyStatus;
    /** Epoch ms until which this key is skipped (rate limited). */
    cooldownUntil?: number;
    /** Why it last failed, for the UI. */
    lastError?: string;
    lastOkAt?: number;
    /** Successful calls made with this key — shows which account is carrying. */
    uses: number;
}

export interface Keyring {
    v: 1;
    /** providerId → keys, in priority order. */
    providers: Record<string, KeyEntry[]>;
}

const STORAGE_KEY = 'jackie_keyring_v1';

/** Default cooldown when a provider rate-limits without saying for how long. */
const DEFAULT_COOLDOWN_MS = 60_000;

const EMPTY: Keyring = { v: 1, providers: {} };

/* ── notifications ─────────────────────────────────────────────────────── */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to keyring changes (same tab). */
export function subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* a broken listener must not break a save */
        }
    });
}

/* ── storage ───────────────────────────────────────────────────────────── */

let cache: Keyring | null = null;

function read(): Keyring {
    if (cache) return cache;
    if (typeof localStorage === 'undefined') return { ...EMPTY };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            cache = { ...EMPTY, providers: {} };
            return cache;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || typeof parsed.providers !== 'object') {
            cache = { ...EMPTY, providers: {} };
            return cache;
        }
        // Defensive: one corrupt provider list must not lose the others.
        const providers: Record<string, KeyEntry[]> = {};
        for (const [pid, entries] of Object.entries(parsed.providers as Record<string, unknown>)) {
            if (!Array.isArray(entries)) continue;
            providers[pid] = entries
                .filter((e): e is KeyEntry => !!e && typeof (e as KeyEntry).key === 'string')
                .map((e) => ({
                    id: e.id || crypto.randomUUID(),
                    key: e.key,
                    label: e.label,
                    addedAt: e.addedAt || Date.now(),
                    status: e.status || 'untested',
                    cooldownUntil: e.cooldownUntil,
                    lastError: e.lastError,
                    lastOkAt: e.lastOkAt,
                    uses: typeof e.uses === 'number' ? e.uses : 0,
                }));
        }
        cache = { v: 1, providers };
        return cache;
    } catch {
        cache = { ...EMPTY, providers: {} };
        return cache;
    }
}

function write(next: Keyring): void {
    cache = next;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* quota or private mode — keys stay in memory for this session */
    }
    notify();
}

/** Drop the in-memory cache; the next read re-parses storage. */
export function invalidate(): void {
    cache = null;
}

/* ── reads ─────────────────────────────────────────────────────────────── */

export function getKeyring(): Keyring {
    return read();
}

export function listKeys(providerId: string): KeyEntry[] {
    return read().providers[providerId] ?? [];
}

/** Every provider that has at least one key stored. */
export function providersWithKeys(): string[] {
    const ring = read();
    return Object.keys(ring.providers).filter((p) => (ring.providers[p]?.length ?? 0) > 0);
}

export function hasAnyKey(): boolean {
    return providersWithKeys().length > 0;
}

/** True when a key is currently skippable (cooling or rejected). */
export function isUsable(entry: KeyEntry): boolean {
    if (entry.status === 'rejected') return false;
    if (entry.cooldownUntil && entry.cooldownUntil > Date.now()) return false;
    return true;
}

/**
 * The key to use right now for a provider — sticky, first healthy one.
 * Returns null when the provider has no key, or every key is cooling/rejected.
 */
export function nextUsableKey(providerId: string): KeyEntry | null {
    const keys = listKeys(providerId);
    return keys.find(isUsable) ?? null;
}

/** Every key that could be tried this request, in order. */
export function usableKeys(providerId: string): KeyEntry[] {
    return listKeys(providerId).filter(isUsable);
}

/* ── writes ────────────────────────────────────────────────────────────── */

function setProviderKeys(providerId: string, entries: KeyEntry[]): void {
    const ring = read();
    write({ ...ring, providers: { ...ring.providers, [providerId]: entries } });
}

/** Add a key. Duplicates are ignored rather than silently stacking. */
export function addKey(providerId: string, key: string, label?: string): KeyEntry | null {
    const trimmed = key.trim();
    if (!trimmed) return null;
    const existing = listKeys(providerId);
    if (existing.some((e) => e.key === trimmed)) return null;

    const entry: KeyEntry = {
        id: crypto.randomUUID(),
        key: trimmed,
        label: label?.trim() || undefined,
        addedAt: Date.now(),
        status: 'untested',
        uses: 0,
    };
    setProviderKeys(providerId, [...existing, entry]);
    return entry;
}

export function updateKey(providerId: string, keyId: string, patch: Partial<KeyEntry>): void {
    const entries = listKeys(providerId).map((e) => {
        if (e.id !== keyId) return e;
        const next = { ...e, ...patch };
        // Editing the secret clears any verdict earned by the old value.
        if (patch.key !== undefined && patch.key !== e.key) {
            next.status = 'untested';
            next.cooldownUntil = undefined;
            next.lastError = undefined;
        }
        return next;
    });
    setProviderKeys(providerId, entries);
}

export function removeKey(providerId: string, keyId: string): void {
    setProviderKeys(
        providerId,
        listKeys(providerId).filter((e) => e.id !== keyId),
    );
}

/** Move a key up or down the priority order. */
export function moveKey(providerId: string, keyId: string, direction: -1 | 1): void {
    const entries = [...listKeys(providerId)];
    const i = entries.findIndex((e) => e.id === keyId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= entries.length) return;
    [entries[i], entries[j]] = [entries[j], entries[i]];
    setProviderKeys(providerId, entries);
}

export function removeProvider(providerId: string): void {
    const ring = read();
    const providers = { ...ring.providers };
    delete providers[providerId];
    write({ ...ring, providers });
}

/* ── outcome recording: what makes rotation work ───────────────────────── */

export interface KeyOutcome {
    ok: boolean;
    /** HTTP status, when there was one. */
    status?: number;
    error?: string;
    /** Seconds from a Retry-After header, when the provider sent one. */
    retryAfterSec?: number;
}

/**
 * Record what happened when a key was used. This is the whole basis of
 * rotation: a 429 puts the key to sleep so the next request naturally lands
 * on the next account, and a 401 takes it out of rotation entirely.
 */
export function recordOutcome(providerId: string, keyId: string, outcome: KeyOutcome): void {
    const entries = listKeys(providerId).map((e) => {
        if (e.id !== keyId) return e;
        if (outcome.ok) {
            return {
                ...e,
                status: 'ok' as KeyStatus,
                lastOkAt: Date.now(),
                lastError: undefined,
                cooldownUntil: undefined,
                uses: e.uses + 1,
            };
        }
        if (outcome.status === 429) {
            // Honour Retry-After when given; otherwise a minute is long enough
            // to move on and short enough to come back quickly.
            const ms = outcome.retryAfterSec ? outcome.retryAfterSec * 1000 : DEFAULT_COOLDOWN_MS;
            return {
                ...e,
                status: 'cooling' as KeyStatus,
                cooldownUntil: Date.now() + ms,
                lastError: outcome.error || 'rate limited',
            };
        }
        if (outcome.status === 401 || outcome.status === 403) {
            return {
                ...e,
                status: 'rejected' as KeyStatus,
                lastError: outcome.error || 'key rejected',
                cooldownUntil: undefined,
            };
        }
        // Network blips and 5xx are not the key's fault; do not condemn it.
        return { ...e, status: 'error' as KeyStatus, lastError: outcome.error || 'request failed' };
    });
    setProviderKeys(providerId, entries);
}

/** Clear cooldowns and verdicts so everything is retried fresh. */
export function resetStatuses(providerId?: string): void {
    const ring = read();
    const providers = { ...ring.providers };
    const clear = (entries: KeyEntry[]) =>
        entries.map((e) => ({ ...e, status: 'untested' as KeyStatus, cooldownUntil: undefined, lastError: undefined }));
    if (providerId) {
        providers[providerId] = clear(providers[providerId] ?? []);
    } else {
        for (const pid of Object.keys(providers)) providers[pid] = clear(providers[pid]);
    }
    write({ ...ring, providers });
}

/* ── migration ─────────────────────────────────────────────────────────── */

/** Old flat localStorage keys → provider id in the new catalog. */
const LEGACY_KEYS: Record<string, string> = {
    // components/apps/APIKeysApp.tsx
    grok_api_key: 'xai',
    groq_api_key: 'groq',
    gemini_api_key: 'gemini',
    deepseek_api_key: 'deepseek',
    anthropic_api_key: 'anthropic',
    // lib/ai/catalog.ts's first pass
    jackie_ai_key_openrouter: 'openrouter',
    jackie_ai_key_gemini: 'gemini',
    jackie_ai_key_groq: 'groq',
    jackie_ai_key_cerebras: 'cerebras',
    jackie_ai_key_mistral: 'mistral',
    jackie_ai_key_github: 'github-models',
    jackie_ai_key_huggingface: 'huggingface',
    jackie_ai_key_openai: 'openai',
    jackie_ai_key_anthropic: 'anthropic',
    jackie_ai_key_deepseek: 'deepseek',
    jackie_ai_key_xai: 'xai',
    jackie_ai_key_together: 'together',
};

const MIGRATED_FLAG = 'jackie_keyring_migrated_v1';

/**
 * Sweep every legacy location into the keyring. Idempotent, and additive —
 * it never deletes the old values, so a rollback loses nothing.
 */
export function migrate(): number {
    if (typeof localStorage === 'undefined') return 0;
    let imported = 0;
    try {
        for (const [legacyKey, providerId] of Object.entries(LEGACY_KEYS)) {
            const value = localStorage.getItem(legacyKey);
            if (!value || !value.trim()) continue;
            // addKey() de-duplicates, so running this twice is harmless.
            if (addKey(providerId, value, 'imported')) imported += 1;
        }
        localStorage.setItem(MIGRATED_FLAG, String(Date.now()));
    } catch {
        /* storage unavailable — nothing to migrate from */
    }
    return imported;
}

/* ── portability ───────────────────────────────────────────────────────── */

export function exportKeyring(): string {
    return JSON.stringify(read(), null, 2);
}

/** Merge an exported keyring in. Returns how many keys were added. */
export function importKeyring(json: string): { added: number; error?: string } {
    try {
        const parsed = JSON.parse(json);
        if (!parsed || parsed.v !== 1 || typeof parsed.providers !== 'object') {
            return { added: 0, error: 'Not a keyring export (expected v1).' };
        }
        let added = 0;
        for (const [pid, entries] of Object.entries(parsed.providers as Record<string, KeyEntry[]>)) {
            if (!Array.isArray(entries)) continue;
            for (const e of entries) {
                if (e?.key && addKey(pid, e.key, e.label)) added += 1;
            }
        }
        return { added };
    } catch (err) {
        return { added: 0, error: err instanceof Error ? err.message : 'Could not parse that file.' };
    }
}
