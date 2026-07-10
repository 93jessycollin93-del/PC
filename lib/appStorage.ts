/**
 * Unified namespaced storage service (v1).
 *
 * One small API over localStorage so platform modules stop free-styling raw
 * keys: values are JSON-serialized under `${namespace}::${key}`, and same-tab
 * subscribers are notified on every write. This is the foundation layer for
 * the automation engine, scheduler, and notification center; existing apps'
 * keys are untouched (they can migrate namespace-by-namespace later).
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

const listenersByNs = new Map<string, Set<Listener>>();

function notify(ns: string): void {
  listenersByNs.get(ns)?.forEach(l => l());
}

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
