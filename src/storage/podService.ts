/**
 * The pod router — one entry point, two pods behind it.
 *
 * Callers say `set(key, value)` and never choose a pod. The routing rule lives
 * here once (see routeToPod), so a value cannot end up in the fast pod on one
 * code path and the deep pod on another, which is how a store starts returning
 * different answers depending on who asked.
 *
 * The behaviour that matters most: when Pod 1 refuses a write because the
 * browser bucket is full, the value OVERFLOWS to Pod 2 rather than being lost.
 * That is the point of a second pod — not extra room in the abstract, but a
 * place for the write that would otherwise have vanished.
 */

import {
  POD_1,
  POD_2,
  POD_1_MAX_VALUE_BYTES,
  routeToPod,
  encodePayload,
  decodePayload,
  RoundTripError,
  type EncodedPayload,
  type PodId,
  type PodIdentity,
} from './pods';
import { safeGetJSON, safeSetJSON, safeRemove, isFailure } from '../../lib/safeStorage';

const POD_PREFIX = 'pod1:';

/** Minimal async store, so the deep pod can be swapped or faked in tests. */
export interface DeepStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** IndexedDB-backed deep store. Opened lazily so importing costs nothing. */
export function createIndexedDeepStore(dbName = 'pc-pod-2', storeName = 'records'): DeepStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };

  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const req = fn(t.objectStore(storeName));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  };

  return {
    get: k => tx<string | null>('readonly', s => s.get(k)).then(v => v ?? null),
    put: (k, v) => tx<IDBValidKey>('readwrite', s => s.put(v, k)).then(() => undefined),
    delete: k => tx<undefined>('readwrite', s => s.delete(k)).then(() => undefined),
    keys: () => tx<IDBValidKey[]>('readonly', s => s.getAllKeys()).then(ks => ks.map(String)),
  };
}

export interface PodSetResult {
  pod: PodId;
  reason: string;
  compressed: boolean;
  originalBytes: number;
  storedBytes: number;
  /** True when Pod 1 refused and Pod 2 took the write instead. */
  overflowed: boolean;
}

export class PodService {
  constructor(private deep: DeepStore) {}

  /** Both pods, so the workstation can show the chain and its identities. */
  public pods(): PodIdentity[] {
    return [POD_1, POD_2];
  }

  /**
   * Store a value. Never throws: a failure in one pod becomes an attempt in
   * the next, and only an exhausted chain reports failure to the caller.
   */
  public async set(
    key: string,
    value: unknown,
    opts: { needsSync?: boolean } = {}
  ): Promise<PodSetResult> {
    const raw = JSON.stringify(value ?? null);
    const originalBytes = raw.length;
    const decision = routeToPod(originalBytes, opts);

    if (decision.pod === 'pod-1-local') {
      const outcome = safeSetJSON(POD_PREFIX + key, value, { silent: true });
      if (!isFailure(outcome)) {
        return {
          pod: 'pod-1-local',
          reason: decision.reason,
          compressed: false,
          originalBytes,
          storedBytes: originalBytes,
          overflowed: false,
        };
      }
      // Pod 1 is full. This is the whole reason Pod 2 exists: the write
      // survives instead of disappearing with the user none the wiser.
      const encoded = await encodePayload(value);
      await this.deep.put(key, JSON.stringify(encoded));
      return {
        pod: 'pod-2-indexed',
        reason: `Pod 1 is full (${outcome.reason}) — overflowed to Pod 2`,
        compressed: true,
        originalBytes,
        storedBytes: encoded.bytes,
        overflowed: true,
      };
    }

    const encoded = await encodePayload(value);
    await this.deep.put(key, JSON.stringify(encoded));
    return {
      pod: 'pod-2-indexed',
      reason: decision.reason,
      compressed: true,
      originalBytes,
      storedBytes: encoded.bytes,
      overflowed: false,
    };
  }

  /**
   * Read a value from wherever it lives. Pod 1 first because it is cheaper,
   * then Pod 2 — a value that overflowed must still be found by its key, or
   * the overflow would be a silent loss in a different disguise.
   *
   * A payload that fails its round-trip check returns the fallback rather than
   * subtly wrong data, and rethrows nothing: the caller asked for a value, and
   * a corrupt one is the same as an absent one to them.
   */
  public async get<T>(key: string, fallback: T): Promise<T> {
    const local = safeGetJSON<T | undefined>(POD_PREFIX + key, undefined);
    if (local !== undefined) return local;

    let raw: string | null;
    try {
      raw = await this.deep.get(key);
    } catch {
      return fallback;
    }
    if (!raw) return fallback;

    try {
      const encoded = JSON.parse(raw) as EncodedPayload;
      return await decodePayload<T>(encoded);
    } catch (err) {
      if (err instanceof RoundTripError) {
        // The stored bytes no longer mean what they meant. Saying so beats
        // handing back a value that looks plausible and is not.
        console.error(`[pods] ${key} failed its round-trip check; treating as absent`, err);
      }
      return fallback;
    }
  }

  /** Remove from both pods, so a stale copy cannot resurface later. */
  public async remove(key: string): Promise<void> {
    safeRemove(POD_PREFIX + key);
    try {
      await this.deep.delete(key);
    } catch {
      // Already absent, or the store is unavailable; either way it is gone
      // from the caller's point of view.
    }
  }

  /** Where a key currently lives, for the workstation view. */
  public async locate(key: string): Promise<PodId | null> {
    if (safeGetJSON<unknown>(POD_PREFIX + key, undefined) !== undefined) return 'pod-1-local';
    try {
      return (await this.deep.get(key)) ? 'pod-2-indexed' : null;
    } catch {
      return null;
    }
  }
}

export { POD_1, POD_2, POD_1_MAX_VALUE_BYTES, routeToPod };
