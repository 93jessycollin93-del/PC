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

g.window = {
  matchMedia: () => ({ matches: false }),
};
