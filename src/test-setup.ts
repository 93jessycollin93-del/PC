/**
 * Minimal browser globals for the pure modules under test.
 *
 * These modules touch three things: localStorage, one document query (to read
 * the active theme), and navigator.vibrate. Shimming those is cheaper and
 * faster than a full jsdom, and it keeps the tests honest — anything needing
 * more DOM than this belongs in a browser test, not here.
 */

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

const g = globalThis as Record<string, any>;

g.localStorage = new MemoryStorage();

// Themed haptics read the family off this attribute; tests override the
// return value per case.
g.document = {
  querySelector: () => null,
};

// Node exposes navigator as a getter-only property, so it has to be
// redefined rather than assigned.
Object.defineProperty(g, 'navigator', {
  configurable: true,
  writable: true,
  value: { vibrate: () => true },
});

/**
 * A real EventTarget for `window`, so the Jackie Bus works under test.
 *
 * The bus is plain `window` CustomEvents, so anything that emits or subscribes
 * needs dispatch to genuinely deliver — a stub that swallows events would let a
 * broken subscription pass as green, which is the exact false-positive this
 * suite exists to avoid. Node's built-in EventTarget covers it without pulling
 * in jsdom, keeping the reasoning in the config header intact.
 */
class WindowShim extends EventTarget {
  matchMedia() {
    return { matches: false };
  }
}

g.window = new WindowShim();

// CustomEvent is not global in older Node; the bus constructs it directly.
if (typeof g.CustomEvent !== 'function') {
  g.CustomEvent = class CustomEvent extends Event {
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      super(type);
      this.detail = init?.detail;
    }
  };
}
