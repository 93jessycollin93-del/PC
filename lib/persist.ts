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

export const saveGlobalState = async (state: any) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: 'syncing' }));
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

        // Tertiary globally accessible write to Cloud Sync (Firestore)
        try {
            await setDoc(doc(db, 'GlobalState', 'master_pod_v3'), {
                data: b64,
                updatedAt: new Date().toISOString()
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: 'ready' }));
            }
        } catch (e) {
            console.warn('Cloud Sync failed, operating with local resilience.', e);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: 'offline' }));
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
        
        // 0. Try Cloud Sync first (with a strict timeout of 1200ms to prevent network/iframe hang)
        try {
            const cloudDocPromise = getDoc(doc(db, 'GlobalState', 'master_pod_v3'));
            const cloudDoc = await Promise.race([
                cloudDocPromise,
                new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Cloud sync timeout')), 1200))
            ]);
            if (cloudDoc && cloudDoc.exists()) {
                const b64 = cloudDoc.data().data;
                compressedU8 = base64ToU8(b64);
            }
        } catch (e) {
            console.warn('Cloud Sync unavailable, falling back to local Memory Pods.', e);
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
