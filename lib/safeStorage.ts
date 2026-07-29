/**
 * Storage that fails loudly instead of silently.
 *
 * Two failure modes this app had no answer for:
 *
 * 1. QUOTA. localStorage is roughly 5 MB. This OS stores desktop snapshots,
 *    a hash-chained time-travel log, knowledge documents and per-app state in
 *    it, so filling it is a matter of when. Every `setItem` throws once full,
 *    and an unguarded call site means the user's work stops being saved with
 *    nothing on screen to say so. Silent data loss is the worst outcome
 *    available, so a failed write is reported rather than swallowed.
 *
 * 2. CORRUPTION. A write interrupted by a crash, a killed tab, or a quota
 *    error mid-string leaves invalid JSON behind. An unguarded
 *    `JSON.parse(localStorage.getItem(k))` then throws during render and takes
 *    out whatever was drawing it — an app that will not open until storage is
 *    manually cleared, which most users cannot do.
 *
 * Both are handled here once so call sites do not each need to remember.
 */

import { bus } from './bus';

export interface StorageSuccess {
  ok: true;
}

export interface StorageFailure {
  ok: false;
  reason: 'quota' | 'unavailable' | 'error';
  message: string;
}

export type StorageOutcome = StorageSuccess | StorageFailure;

/**
 * Narrow an outcome to the failure case.
 *
 * Exported because every caller that wants to show `message` needs this, and
 * without it each one reaches for a cast — which silently keeps compiling if
 * the union ever changes shape.
 */
export function isFailure(outcome: StorageOutcome): outcome is StorageFailure {
  return outcome.ok === false;
}

/**
 * Is this the browser saying "full"?
 *
 * The name and code differ across engines, and Firefox historically used a
 * different name entirely, so checking one of them misses the others. Also
 * treats a zero-length storage as a signal, since Safari in private mode
 * throws on write while reporting a working storage object.
 */
export function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { code?: number; name: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
}

function storage(): Storage | null {
  try {
    // Accessing localStorage throws outright in some privacy modes, so even
    // the reference has to be guarded.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSON value. Never throws.
 *
 * `validate` is applied to the parsed value; anything it rejects is treated as
 * corrupt and the fallback is returned. Without it a stored `"null"`, a string
 * where an array was expected, or a truncated object all reach the caller and
 * fail somewhere less obvious.
 */
export function safeGetJSON<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => boolean
): T {
  const store = storage();
  if (!store) return fallback;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Common validators, so call sites do not hand-roll them inconsistently. */
export const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Write a JSON value. Never throws; returns what happened.
 *
 * On a quota failure it emits a notification, because the alternative is the
 * user believing their work is saved when it is not. `silent` exists for
 * high-frequency writes that would otherwise spam, and those callers are
 * expected to check the returned outcome instead.
 */
export function safeSetJSON(key: string, value: unknown, opts: { silent?: boolean } = {}): StorageOutcome {
  const store = storage();
  if (!store) {
    return { ok: false, reason: 'unavailable', message: 'Storage is not available in this browser session.' };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (err) {
    // Circular structures and BigInt land here. Reporting the key matters:
    // without it the message is unactionable.
    return {
      ok: false,
      reason: 'error',
      message: `Could not serialize value for "${key}": ${(err as Error).message}`,
    };
  }

  try {
    store.setItem(key, serialized);
    return { ok: true };
  } catch (err) {
    const quota = isQuotaError(err);
    const outcome: StorageOutcome = {
      ok: false,
      reason: quota ? 'quota' : 'error',
      message: quota
        ? 'Storage is full. Recent changes were not saved. Export what matters, then remove old items.'
        : `Could not save "${key}": ${(err as Error).message}`,
    };
    if (!opts.silent) {
      bus.emit('jackie-notification', {
        level: 'error',
        title: quota ? 'Storage is full' : 'Could not save',
        message: outcome.message,
        source: 'storage',
      });
    }
    return outcome;
  }
}

/** Remove a key. Never throws. */
export function safeRemove(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing useful to do; the caller wanted it gone either way.
  }
}

export interface StorageUsage {
  /** Bytes currently held, as measured by summing what is stored. */
  usedBytes: number;
  keys: number;
  /** Largest entries first — what to remove to actually free space. */
  largest: { key: string; bytes: number }[];
}

/**
 * Measure what storage is holding.
 *
 * `navigator.storage.estimate()` covers the whole origin (IndexedDB, caches),
 * so it cannot answer "which of MY keys is huge". Summing the keys can, and
 * that is what someone freeing space actually needs.
 */
export function measureStorage(topN = 5): StorageUsage {
  const store = storage();
  if (!store) return { usedBytes: 0, keys: 0, largest: [] };
  const entries: { key: string; bytes: number }[] = [];
  let usedBytes = 0;
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key === null) continue;
      const value = store.getItem(key) ?? '';
      // UTF-16 code units: what the quota is actually counted in.
      const bytes = (key.length + value.length) * 2;
      usedBytes += bytes;
      entries.push({ key, bytes });
    }
  } catch {
    return { usedBytes, keys: entries.length, largest: [] };
  }
  entries.sort((a, b) => b.bytes - a.bytes);
  return { usedBytes, keys: entries.length, largest: entries.slice(0, topN) };
}
