import LZString from 'lz-string';
import { strToU8, compressSync, decompressSync, strFromU8 } from 'fflate';
import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Multi-dimensional unit handler (Replacer)
const podReplacer = (key: string, value: any) => {
    if (value instanceof Map) {
        return { _type: 'Map', value: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
        return { _type: 'Set', value: Array.from(value) };
    }
    if (typeof value === 'object' && value !== null) {
        if (Object.prototype.toString.call(value) === '[object Date]') {
            return { _type: 'Date', value: value.toISOString() };
        }
    }
    return value;
};

// Multi-dimensional unit extractor (Reviver)
const podReviver = (key: string, value: any) => {
    if (value && typeof value === 'object' && value._type) {
        switch (value._type) {
            case 'Map': return new Map(value.value);
            case 'Set': return new Set(value.value);
            case 'Date': return new Date(value.value);
        }
    }
    return value;
};

const DB_NAME = 'VC_GlobalStateDB_PodV3';
const STORE_NAME = 'MemoryPods';
const DB_VERSION = 1;

let useIDB = true;

// Check if we are in an iframe (Vite dev environment in AI Studio)
if (typeof window !== 'undefined') {
    try {
        const isIframe = window.self !== window.top;
        if (isIframe) {
            useIDB = false;
        }
    } catch (e) {
        useIDB = false;
    }
}

const getDB = (): Promise<IDBDatabase> => {
    if (!useIDB) {
        return Promise.reject(new Error('IndexedDB is disabled in this environment'));
    }
    return new Promise((resolve, reject) => {
        // Strict timeout of 1000ms. If IndexedDB does not resolve within this window,
        // we disable useIDB permanently for this session and reject to trigger the LocalStorage fallback immediately.
        const timeoutId = setTimeout(() => {
            useIDB = false;
            reject(new Error('IndexedDB open timed out'));
        }, 1000);

        try {
            if (!window.indexedDB) {
                clearTimeout(timeoutId);
                useIDB = false;
                reject(new Error('IndexedDB not supported'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => {
                clearTimeout(timeoutId);
                const dbInstance = req.result;
                dbInstance.onversionchange = () => {
                    dbInstance.close();
                };
                dbInstance.onerror = (event: any) => {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                    }
                };
                resolve(dbInstance);
            };
            req.onerror = (event: any) => {
                clearTimeout(timeoutId);
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(req.error || new Error('Failed to open database'));
            };
        } catch (err) {
            clearTimeout(timeoutId);
            useIDB = false;
            reject(err);
        }
    });
};

const u8ToBase64 = (u8: Uint8Array): string => {
    let binary = '';
    const len = u8.byteLength;
    // Chunking to avoid stack overflow if using apply, but standard loop is safe
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(u8[i]);
    }
    return btoa(binary);
};

const base64ToU8 = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        u8[i] = binary.charCodeAt(i);
    }
    return u8;
};

// ---- Cloud Sync on/off + cadence control ----
// Enabled state persists across sessions. Default OFF: until a real Firestore
// database exists for this project, "on" mode just burns time retrying a
// connection that can never succeed, so we don't force it on new devices.
const CLOUD_SYNC_ENABLED_KEY = 'vc_cloud_sync_enabled';

let cloudSyncEnabled = false;
let cloudConnected = false;
let pendingStateB64: string | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
let lastConnectAttemptAt = 0;

const RETRY_INTERVAL_MS = 30_000;       // while disconnected: try to (re)connect every 30s
const PERIODIC_SYNC_INTERVAL_MS = 5 * 60_000; // once connected: full sync every 5 minutes

if (typeof window !== 'undefined') {
    try {
        cloudSyncEnabled = localStorage.getItem(CLOUD_SYNC_ENABLED_KEY) === 'true';
    } catch (e) {
        cloudSyncEnabled = false;
    }
}

const dispatchSyncStatus = (detail: 'syncing' | 'ready' | 'offline' | 'disabled') => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail }));
    }
};

const stopRetryTimer = () => {
    if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
    }
};

const stopPeriodicSyncTimer = () => {
    if (periodicSyncTimer) {
        clearInterval(periodicSyncTimer);
        periodicSyncTimer = null;
    }
};

const startRetryTimer = () => {
    if (retryTimer || !cloudSyncEnabled) return;
    retryTimer = setInterval(() => {
        if (cloudSyncEnabled && !cloudConnected) {
            tryCloudWrite(true);
        } else {
            stopRetryTimer();
        }
    }, RETRY_INTERVAL_MS);
};

const startPeriodicSyncTimer = () => {
    if (periodicSyncTimer || !cloudSyncEnabled) return;
    periodicSyncTimer = setInterval(() => {
        if (cloudSyncEnabled && cloudConnected) {
            tryCloudWrite(true);
        } else {
            stopPeriodicSyncTimer();
        }
    }, PERIODIC_SYNC_INTERVAL_MS);
};

// Attempts one cloud write of whatever state is currently pending.
// Used by: the retry loop (while disconnected), the periodic loop (while
// connected), and manual "force sync now". `force` bypasses the 30s
// disconnected-retry throttle (used by forceCloudSync and the retry timer itself).
const tryCloudWrite = async (force = false): Promise<boolean> => {
    if (!cloudSyncEnabled || !pendingStateB64) return false;
    if (!cloudConnected) {
        const now = Date.now();
        if (!force && now - lastConnectAttemptAt < RETRY_INTERVAL_MS) {
            // Throttle disconnected attempts to the 30s cadence instead of retrying on every save.
            return false;
        }
        // Every actual disconnected attempt (throttled or forced/timer-driven) resets the clock,
        // so a save right after a retry tick doesn't sneak in an extra attempt.
        lastConnectAttemptAt = now;
    }
    dispatchSyncStatus('syncing');
    try {
        await setDoc(doc(db, 'GlobalState', 'master_pod_v3'), {
            data: pendingStateB64,
            updatedAt: new Date().toISOString()
        });
        const wasConnected = cloudConnected;
        cloudConnected = true;
        dispatchSyncStatus('ready');
        stopRetryTimer();
        startPeriodicSyncTimer();
        return true;
    } catch (e) {
        if (cloudConnected) {
            console.warn('Cloud Sync lost connection, will retry.', e);
        }
        cloudConnected = false;
        stopPeriodicSyncTimer();
        dispatchSyncStatus('offline');
        startRetryTimer();
        return false;
    }
};

export const isCloudSyncEnabled = () => cloudSyncEnabled;

export const setCloudSyncEnabled = (enabled: boolean) => {
    cloudSyncEnabled = enabled;
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            // ignore quota errors on a simple flag
        }
        window.dispatchEvent(new CustomEvent('cloud-sync-enabled-changed', { detail: enabled }));
    }
    if (enabled) {
        // Kick off a connection attempt right away instead of waiting for the next save,
        // and give the UI a deterministic status immediately rather than leaving it stale.
        if (pendingStateB64) {
            tryCloudWrite(true);
        } else {
            dispatchSyncStatus('offline');
            startRetryTimer();
        }
    } else {
        cloudConnected = false;
        stopRetryTimer();
        stopPeriodicSyncTimer();
        dispatchSyncStatus('disabled');
    }
};

// Manually force an immediate sync attempt, bypassing the 30s/5min cadence.
export const forceCloudSync = async (): Promise<boolean> => {
    if (!cloudSyncEnabled) {
        dispatchSyncStatus('disabled');
        return false;
    }
    if (!pendingStateB64) {
        // Nothing saved yet to push — reflect current connection state deterministically
        // instead of leaving the UI on a stale status.
        dispatchSyncStatus(cloudConnected ? 'ready' : 'offline');
        return false;
    }
    return tryCloudWrite(true);
};

export const saveGlobalState = async (state: any) => {
    if (!cloudSyncEnabled && typeof window !== 'undefined') {
        dispatchSyncStatus('disabled');
    }
    try {
        const json = JSON.stringify(state, podReplacer);
        
        // Universal DEFLATE compression (highest efficiency)
        const buf = strToU8(json);
        const compressedU8 = compressSync(buf, { level: 9 });
        
        // Primary highly-efficient write to IndexedDB (zero-data-loss guaranteed via massive quota)
        // IDB natively supports Uint8Array so we skip base64 overhead
        if (useIDB) {
            try {
                const db = await getDB();
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.put(compressedU8, 'master_pod_v3');
                    tx.oncomplete = () => resolve();
                    tx.onerror = (event: any) => {
                        if (event && typeof event.preventDefault === 'function') {
                            event.preventDefault();
                        }
                        useIDB = false;
                        reject(tx.error);
                    };
                    req.onerror = (event: any) => {
                        if (event && typeof event.preventDefault === 'function') {
                            event.preventDefault();
                        }
                        useIDB = false;
                    };
                });
            } catch (idbError) {
                console.warn('IDB Backup write failed', idbError);
            }
        }

        // Secondary redundant write to LocalStorage (requires Base64)
        const b64 = u8ToBase64(compressedU8);
        try {
            localStorage.setItem('vc_global_state_pod_v3', b64);
            
            // Cleanup old legacy formats
            localStorage.removeItem('vc_global_state_pod_v2');
            localStorage.removeItem('vc_global_state_compressed');
            localStorage.removeItem('vc_global_state');
        } catch (e) {
            console.warn('LocalStorage quota exceeded, but data is safe in IDB.');
        }

        // Tertiary globally accessible write to Cloud Sync (Firestore) — only when enabled.
        // Track the latest state regardless, so a reconnect or the next periodic tick
        // can push it up without the caller needing to save again.
        pendingStateB64 = b64;
        if (cloudSyncEnabled) {
            if (cloudConnected) {
                // Already connected: don't hammer Firestore on every save, the periodic
                // timer (every 5 min) or a manual force-sync will pick this up.
                dispatchSyncStatus('ready');
            } else {
                // Not connected yet: try now, then fall back to the 30s retry loop.
                await tryCloudWrite();
            }
        }
    } catch (e) {
        console.error('Failed to compress and save global state:', e);
    }
};

let cachedState: any = null;

export const loadGlobalState = () => {
    return cachedState;
};

export const initializeGlobalState = async () => {
    try {
        let compressedU8: Uint8Array | null = null;
        
        // 0. Try Cloud Sync first, but only when the user has turned it on.
        // (with a strict timeout of 1200ms to prevent network/iframe hang)
        if (cloudSyncEnabled) {
            try {
                const cloudDocPromise = getDoc(doc(db, 'GlobalState', 'master_pod_v3'));
                const cloudDoc = await Promise.race([
                    cloudDocPromise,
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Cloud sync timeout')), 1200))
                ]);
                if (cloudDoc && cloudDoc.exists()) {
                    const b64 = cloudDoc.data().data;
                    compressedU8 = base64ToU8(b64);
                    pendingStateB64 = b64;
                    cloudConnected = true;
                    dispatchSyncStatus('ready');
                    startPeriodicSyncTimer();
                }
            } catch (e) {
                console.warn('Cloud Sync unavailable, falling back to local Memory Pods.', e);
                cloudConnected = false;
                dispatchSyncStatus('offline');
                startRetryTimer();
            }
        } else {
            dispatchSyncStatus('disabled');
        }

        // 1. Try to load from robust IDB first (v3 DEFLATE) if cloud didn't have it
        if (!compressedU8) {
            try {
                const localDb = await getDB();
                compressedU8 = await Promise.race([
                    new Promise<Uint8Array | null>((resolve, reject) => {
                        const tx = localDb.transaction(STORE_NAME, 'readonly');
                        const store = tx.objectStore(STORE_NAME);
                        const req = store.get('master_pod_v3');
                        req.onsuccess = () => resolve(req.result || null);
                        req.onerror = (event: any) => {
                            if (event && typeof event.preventDefault === 'function') {
                                event.preventDefault();
                            }
                        };
                        tx.onerror = (event: any) => {
                            if (event && typeof event.preventDefault === 'function') {
                                event.preventDefault();
                            }
                            useIDB = false;
                            reject(tx.error);
                        };
                    }),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
                ]);
            } catch (e) {
                console.warn('IDB read failed, checking LocalStorage fallback...', e);
            }
        }

        // 2. Fallback to LocalStorage (v3 DEFLATE via Base64)
        if (!compressedU8) {
            const b64 = localStorage.getItem('vc_global_state_pod_v3');
            if (b64) {
                compressedU8 = base64ToU8(b64);
            }
        }

        if (compressedU8) {
            try {
                const decompressedBuf = decompressSync(compressedU8);
                const json = strFromU8(decompressedBuf);
                cachedState = JSON.parse(json, podReviver);
                return;
            } catch (err) {
                console.error("V3 Decompression failed", err);
            }
        }

        // 3. Migration paths (Legacy formats)
        
        // v2 (LZString Base64)
        const v2Data = localStorage.getItem('vc_global_state_pod_v2');
        if (v2Data) {
            const json = LZString.decompressFromBase64(v2Data);
            if (json) {
                cachedState = JSON.parse(json, podReviver);
                return;
            }
        }

        // v1 (LZString UTF16)
        const v1Data = localStorage.getItem('vc_global_state_compressed');
        if (v1Data) {
            const json = LZString.decompressFromUTF16(v1Data);
            if (json) {
                cachedState = JSON.parse(json, podReviver);
                return;
            }
        }
        
        // v0 (Raw JSON)
        const legacyData = localStorage.getItem('vc_global_state');
        if (legacyData) cachedState = JSON.parse(legacyData);
    } catch (e) {
        console.error('Failed to load global state:', e);
    }
};
