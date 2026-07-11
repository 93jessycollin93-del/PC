/**
 * Unified namespaced storage service (v1).
 *
 * One small API over localStorage so platform modules stop free-styling raw
 * keys: values are JSON-serialized under `${namespace}::${key}`, and same-tab
 * subscribers are notified on every write. This is the foundation layer for
 * the automation engine, scheduler, and notification center; existing apps'
 * keys are untouched (they can migrate namespace-by-namespace later).
 *
 * For opt-in encryption (Phase B step 20), use appStorageEncrypted() instead,
 * which provides async get/set with AES-GCM encryption using vault key.
 */

type Listener = () => void;

export interface AppStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  /** Keys in this namespace (without the namespace prefix). */
  keys(): string[];
  /** Notified after any set/remove in this namespace (same tab). */
  subscribe(listener: Listener): () => void;
  /** Approximate bytes used by this namespace. */
  estimateBytes(): number;
}

export interface AppStorageEncrypted {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): string[];
  subscribe(listener: Listener): () => void;
  estimateBytes(): number;
}

const listenersByNs = new Map<string, Set<Listener>>();

function notify(ns: string): void {
  listenersByNs.get(ns)?.forEach(l => l());
}

// Helpers for encryption (AES-GCM, matching secretsVault)
function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBuffer(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
}

const ENCRYPTION_TAG = '__encrypted__:'; // marker for encrypted values

export function appStorage(namespace: string): AppStorage {
  const prefix = `${namespace}::`;

  return {
    get<T>(key: string, fallback: T): T {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(prefix + key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    set<T>(key: string, value: T): void {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch (e) {
        // Quota exceeded — surface loudly rather than silently dropping state.
        console.error(`[appStorage:${namespace}] write failed for "${key}":`, e);
      }
      notify(namespace);
    },

    remove(key: string): void {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(prefix + key);
      notify(namespace);
    },

    keys(): string[] {
      if (typeof localStorage === 'undefined') return [];
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
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
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          bytes += k.length + (localStorage.getItem(k)?.length || 0);
        }
      }
      return bytes * 2; // UTF-16
    },
  };
}

/**
 * Encrypted variant of appStorage (Phase B step 20).
 * Provides async get/set with AES-GCM encryption using a vault key.
 * Values are stored as `__encrypted__:<iv>|<data>` (base64).
 */
export function appStorageEncrypted(namespace: string, key: CryptoKey): AppStorageEncrypted {
  const prefix = `${namespace}::`;

  return {
    async get<T>(keyName: string, fallback: T): Promise<T> {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(prefix + keyName);
      if (raw === null) return fallback;

      if (!raw.startsWith(ENCRYPTION_TAG)) {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return fallback;
        }
      }

      try {
        const parts = raw.slice(ENCRYPTION_TAG.length).split('|');
        if (parts.length !== 2) return fallback;
        const iv = base64ToBuffer(parts[0]);
        const encryptedData = base64ToBuffer(parts[1]);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
        const json = new TextDecoder().decode(decrypted);
        return JSON.parse(json) as T;
      } catch (e) {
        console.error(`[appStorageEncrypted:${namespace}] decryption failed for "${keyName}":`, e);
        return fallback;
      }
    },

    async set<T>(keyName: string, value: T): Promise<void> {
      if (typeof localStorage === 'undefined') return;
      try {
        const json = JSON.stringify(value);
        const data = new TextEncoder().encode(json);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
        const encrypted = ENCRYPTION_TAG + bufferToBase64(iv) + '|' + bufferToBase64(encryptedData);
        localStorage.setItem(prefix + keyName, encrypted);
      } catch (e) {
        console.error(`[appStorageEncrypted:${namespace}] encryption/write failed for "${keyName}":`, e);
      }
      notify(namespace);
    },

    async remove(keyName: string): Promise<void> {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(prefix + keyName);
      notify(namespace);
    },

    keys(): string[] {
      if (typeof localStorage === 'undefined') return [];
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
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
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          bytes += k.length + (localStorage.getItem(k)?.length || 0);
        }
      }
      return bytes * 2; // UTF-16
    },
  };
}
