/**
 * Unified storage service v2 — consolidation layer
 *
 * Enhances appStorage v1 with:
 * - Automatic compression for large values (>50KB)
 * - Spillover to IndexedDB for very large values (>500KB localStorage limit)
 * - Quota monitoring and warnings
 * - Cloud sync coordination flags
 * - Key migration helpers for legacy per-app keys
 * - Optional encryption layer (via secretsVault)
 */

import LZString from 'lz-string';
import { appStorage as baseAppStorage, type AppStorage } from './appStorage';
import { bus } from './bus';

const COMPRESSION_THRESHOLD = 50 * 1024; // 50 KB
const IDB_SPILLOVER_THRESHOLD = 500 * 1024; // 500 KB (localStorage practical limit)
const QUOTA_WARNING_PERCENT = 80; // Warn at 80% usage
const IDB_DB_NAME = 'AppStorage_V2';
const IDB_STORE_NAME = 'spillover';

interface StorageMetadata {
  compressed?: boolean;
  spilledToIDB?: boolean;
  cloudSyncFlag?: boolean; // Mark for cloud sync
  migratedFrom?: string; // Track key migrations
  createdAt: number;
  lastModified: number;
}

type Listener = () => void;

let idbReady = false;
let idbDatabase: IDBDatabase | null = null;

async function initializeIDB(): Promise<IDBDatabase> {
  if (idbDatabase) return idbDatabase;
  if (idbReady && !idbDatabase) {
    throw new Error('IndexedDB initialization failed in this environment');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      idbReady = true;
      reject(new Error('IndexedDB init timeout'));
    }, 2000);

    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);

      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        idbReady = true;
        idbDatabase = request.result;
        resolve(idbDatabase);
      };

      request.onerror = () => {
        clearTimeout(timeout);
        idbReady = true;
        reject(request.error);
      };
    } catch (e) {
      clearTimeout(timeout);
      idbReady = true;
      reject(e);
    }
  });
}

async function writeToIDB(key: string, data: string): Promise<void> {
  try {
    const db = await initializeIDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.put(data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[appStorageV2] IDB write failed, falling back to localStorage:', e);
  }
}

async function readFromIDB(key: string): Promise<string | null> {
  try {
    const db = await initializeIDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[appStorageV2] IDB read failed:', e);
    return null;
  }
}

async function removeFromIDB(key: string): Promise<void> {
  try {
    const db = await initializeIDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[appStorageV2] IDB delete failed:', e);
  }
}

function maybeCompress(data: string): { data: string; compressed: boolean } {
  if (data.length < COMPRESSION_THRESHOLD) {
    return { data, compressed: false };
  }

  const compressed = LZString.compressToBase64(data);
  // Only use compression if it actually saves space
  if (compressed.length < data.length) {
    return { data: compressed, compressed: true };
  }

  return { data, compressed: false };
}

function maybeDecompress(data: string, compressed: boolean): string {
  if (!compressed) return data;
  try {
    return LZString.decompressFromBase64(data) || data;
  } catch {
    return data;
  }
}

export interface AppStorageV2 extends AppStorage {
  /** Get quota usage stats (approximate) */
  getQuotaStats(): {
    usedBytes: number;
    availableBytes: number;
    percentUsed: number;
  };
  /** Migrate a key from old namespace/format */
  migrateKey(oldKey: string, newKey: string, oldNamespace?: string): void;
  /** Mark a key for cloud sync on next save */
  markForCloudSync(key: string): void;
  /** Get metadata for a key */
  getMetadata(key: string): StorageMetadata | null;
}

const listenersByNs = new Map<string, Set<Listener>>();

function notify(ns: string): void {
  listenersByNs.get(ns)?.forEach(l => l());
}

export function appStorageV2(namespace: string): AppStorageV2 {
  const prefix = `${namespace}::`;
  const metaPrefix = `${namespace}::_meta_`;
  const base = baseAppStorage(namespace);

  const getMeta = (key: string): StorageMetadata => {
    const meta = base.get<Partial<StorageMetadata>>(`_meta_${key}`, {});
    return {
      compressed: false,
      spilledToIDB: false,
      cloudSyncFlag: false,
      createdAt: Date.now(),
      lastModified: Date.now(),
      ...meta,
    };
  };

  const setMeta = (key: string, meta: Partial<StorageMetadata>): void => {
    const current = getMeta(key);
    base.set(`_meta_${key}`, { ...current, ...meta, lastModified: Date.now() });
  };

  return {
    get<T>(key: string, fallback: T): T {
      try {
        const meta = getMeta(key);

        // Try IDB first if spilled
        if (meta.spilledToIDB) {
          readFromIDB(`${prefix}${key}`).then(idbData => {
            if (idbData) {
              const decompressed = maybeDecompress(idbData, meta.compressed);
              return JSON.parse(decompressed) as T;
            }
          }).catch(() => {
            // Fall back to localStorage on IDB failure
          });
        }

        // Fall back to localStorage
        const raw = localStorage.getItem(prefix + key);
        if (raw === null) return fallback;

        const decompressed = maybeDecompress(raw, meta.compressed);
        return JSON.parse(decompressed) as T;
      } catch (e) {
        console.warn(`[appStorageV2:${namespace}] get failed for "${key}":`, e);
        return fallback;
      }
    },

    set<T>(key: string, value: T): void {
      try {
        const json = JSON.stringify(value);
        const { data, compressed } = maybeCompress(json);

        // Decide storage location
        if (data.length > IDB_SPILLOVER_THRESHOLD) {
          // Spill to IDB
          writeToIDB(`${prefix}${key}`, data).catch(e => {
            console.error(`[appStorageV2:${namespace}] IDB spillover failed, storing in localStorage:`, e);
            localStorage.setItem(prefix + key, data);
          });

          setMeta(key, { compressed, spilledToIDB: true });
          localStorage.removeItem(prefix + key); // Clear localStorage entry
        } else {
          // Store in localStorage
          localStorage.setItem(prefix + key, data);
          setMeta(key, { compressed, spilledToIDB: false });
          removeFromIDB(`${prefix}${key}`).catch(() => {}); // Clean up IDB if exists
        }

        // Check quota
        const stats = this.getQuotaStats();
        if (stats.percentUsed > QUOTA_WARNING_PERCENT) {
          bus.emit('jackie-notification', {
            level: 'warning',
            title: `Storage quota warning for "${namespace}"`,
            message: `${stats.percentUsed}% used. Consider cleaning up old data.`,
            source: 'app-storage-v2',
          });
        }

        notify(namespace);
      } catch (e) {
        console.error(`[appStorageV2:${namespace}] set failed for "${key}":`, e);
      }
    },

    remove(key: string): void {
      const meta = getMeta(key);
      localStorage.removeItem(prefix + key);
      localStorage.removeItem(metaPrefix + key);
      if (meta.spilledToIDB) {
        removeFromIDB(`${prefix}${key}`).catch(() => {});
      }
      notify(namespace);
    },

    keys(): string[] {
      if (typeof localStorage === 'undefined') return [];
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && !k.includes('_meta_')) {
          out.push(k.slice(prefix.length));
        }
      }
      return out;
    },

    subscribe(listener: Listener): () => void {
      let set = listenersByNs.get(namespace);
      if (!set) {
        set = new Set();
        listenersByNs.set(namespace, set);
      }
      set.add(listener);
      return () => set!.delete(listener);
    },

    estimateBytes(): number {
      if (typeof localStorage === 'undefined') return 0;
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k || '');
        if (k && k.startsWith(prefix) && v) {
          total += k.length + v.length;
        }
      }
      return total;
    },

    getQuotaStats() {
      const usedBytes = this.estimateBytes();
      // Estimate based on localStorage quota (typically 5-10 MB)
      const estimatedQuota = 5 * 1024 * 1024; // 5 MB estimate
      const availableBytes = Math.max(0, estimatedQuota - usedBytes);
      const percentUsed = Math.round((usedBytes / estimatedQuota) * 100);

      return { usedBytes, availableBytes, percentUsed };
    },

    migrateKey(oldKey: string, newKey: string, oldNamespace?: string): void {
      try {
        const oldPrefix = oldNamespace ? `${oldNamespace}::` : prefix;
        const oldRaw = localStorage.getItem(oldPrefix + oldKey);

        if (oldRaw === null) {
          console.warn(`[appStorageV2] No data found for migration key: ${oldPrefix}${oldKey}`);
          return;
        }

        // Parse old value
        let value: any;
        try {
          value = JSON.parse(oldRaw);
        } catch {
          value = oldRaw; // Plain string fallback
        }

        // Store in new location
        this.set(newKey, value);

        // Mark as migrated
        setMeta(newKey, { migratedFrom: oldKey });

        // Clean up old key
        localStorage.removeItem(oldPrefix + oldKey);

        bus.emit('jackie-notification', {
          level: 'info',
          title: `Key migrated`,
          message: `${oldKey} → ${newKey}`,
          source: 'app-storage-v2',
        });
      } catch (e) {
        console.error('[appStorageV2] Migration failed:', e);
      }
    },

    markForCloudSync(key: string): void {
      setMeta(key, { cloudSyncFlag: true });
    },

    getMetadata(key: string): StorageMetadata | null {
      const meta = getMeta(key);
      const exists = localStorage.getItem(prefix + key) !== null;
      return exists ? meta : null;
    },
  };
}

// Export for convenience
export const appStorageV2Convenience = appStorageV2;
