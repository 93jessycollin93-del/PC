let useIDB = true;

// Check if we are inside an iframe (like Vite dev mode / preview iframe)
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

const getFallbackKey = (storeName: string) => `VC_Offline_DB_fallback_${storeName}`;

const getFallback = <T>(storeName: string): T[] => {
    try {
        const data = localStorage.getItem(getFallbackKey(storeName));
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('LocalStorage fallback read error', e);
        return [];
    }
};

const saveFallback = <T extends { id: string }>(storeName: string, data: T | T[]): void => {
    try {
        const current = getFallback<T>(storeName);
        const map = new Map(current.map(item => [item.id, item]));
        
        if (Array.isArray(data)) {
            data.forEach(item => map.set(item.id, item));
        } else {
            map.set(data.id, data);
        }
        
        localStorage.setItem(getFallbackKey(storeName), JSON.stringify(Array.from(map.values())));
    } catch (e) {
        console.error('LocalStorage fallback write error', e);
    }
};

const deleteFallback = (storeName: string, id: string): void => {
    try {
        const current = getFallback<any>(storeName);
        const filtered = current.filter(item => item.id !== id);
        localStorage.setItem(getFallbackKey(storeName), JSON.stringify(filtered));
    } catch (e) {
        console.error('LocalStorage fallback delete error', e);
    }
};

const queueSyncActionFallback = (action: any): void => {
    try {
        const current = getFallback<any>('SyncQueue');
        if (!action.id) {
            action.id = 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        }
        current.push(action);
        localStorage.setItem(getFallbackKey('SyncQueue'), JSON.stringify(current));
    } catch (e) {
        console.error('LocalStorage fallback queueSyncAction error', e);
    }
};

export const initDB = (): Promise<IDBDatabase> => {
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
            const request = indexedDB.open('VC_Offline_DB', 1);
            request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('OfflineBot')) db.createObjectStore('OfflineBot', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('BotChat')) db.createObjectStore('BotChat', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('BotMessage')) db.createObjectStore('BotMessage', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('MemoryPod')) db.createObjectStore('MemoryPod', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('SyncQueue')) db.createObjectStore('SyncQueue', { keyPath: 'id', autoIncrement: true });
            };
            request.onsuccess = () => {
                clearTimeout(timeoutId);
                const dbInstance = request.result;
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
            request.onerror = (event: any) => {
                clearTimeout(timeoutId);
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(request.error || new Error('Failed to open database'));
            };
        } catch (err) {
            clearTimeout(timeoutId);
            useIDB = false;
            reject(err);
        }
    });
};

export const getFromStore = async <T>(storeName: string): Promise<T[]> => {
    if (!useIDB) {
        return getFallback<T>(storeName);
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as T[]);
            request.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(request.error);
            };
            tx.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(tx.error);
            };
        });
    } catch (err) {
        useIDB = false;
        return getFallback<T>(storeName);
    }
};

export const saveToStore = async <T extends { id: string }>(storeName: string, data: T | T[]): Promise<void> => {
    if (!useIDB) {
        saveFallback<T>(storeName, data);
        return;
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            if (Array.isArray(data)) {
                data.forEach(item => store.put(item));
            } else {
                store.put(data);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(tx.error);
            };
        });
    } catch (err) {
        useIDB = false;
        saveFallback<T>(storeName, data);
    }
};

export const deleteFromStore = async (storeName: string, id: string): Promise<void> => {
    if (!useIDB) {
        deleteFallback(storeName, id);
        if (storeName === 'SyncQueue' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-queue-updated'));
        }
        return;
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => {
                if (storeName === 'SyncQueue' && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sync-queue-updated'));
                }
                resolve();
            };
            request.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(request.error);
            };
            tx.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(tx.error);
            };
        });
    } catch (err) {
        useIDB = false;
        deleteFallback(storeName, id);
        if (storeName === 'SyncQueue' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-queue-updated'));
        }
    }
};

export const queueSyncAction = async (action: { collection: string, type: 'CREATE' | 'UPDATE' | 'DELETE', payload: any, id: string }) => {
    if (!useIDB) {
        queueSyncActionFallback(action);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-queue-updated'));
        }
        return;
    }
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('SyncQueue', 'readwrite');
            const store = tx.objectStore('SyncQueue');
            store.put(action);
            tx.oncomplete = () => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sync-queue-updated'));
                }
                resolve();
            };
            tx.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(tx.error);
            };
        });
    } catch (err) {
        useIDB = false;
        queueSyncActionFallback(action);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-queue-updated'));
        }
    }
};

export const getSyncQueue = async (): Promise<any[]> => {
    if (!useIDB) {
        return getFallback<any>('SyncQueue');
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('SyncQueue', 'readonly');
            const store = tx.objectStore('SyncQueue');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(request.error);
            };
            tx.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(tx.error);
            };
        });
    } catch (err) {
        useIDB = false;
        return getFallback<any>('SyncQueue');
    }
};

export const clearSyncQueue = async () => {
    if (!useIDB) {
        localStorage.setItem(getFallbackKey('SyncQueue'), JSON.stringify([]));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-queue-updated'));
        }
        return;
    }
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('SyncQueue', 'readwrite');
            const store = tx.objectStore('SyncQueue');
            store.clear();
            tx.oncomplete = () => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sync-queue-updated'));
                }
                resolve();
            };
            tx.onerror = (event: any) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                useIDB = false;
                reject(tx.error);
            };
        });
    } catch (err) {
        useIDB = false;
        localStorage.setItem(getFallbackKey('SyncQueue'), JSON.stringify([]));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-queue-updated'));
        }
    }
};
