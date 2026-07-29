/**
 * Storage pods, the router between them, and lossless retention.
 *
 * Drives the REAL codec (Sovereign pipeline) and the REAL router. The deep
 * store is faked because IndexedDB does not exist in this environment — but it
 * is a dumb map, so all the logic under assertion runs for real. Deleting the
 * router or the codec fails these.
 *
 * The headline invariant: nothing is ever lost. A write Pod 1 refuses lands in
 * Pod 2, and anything that round-trips comes back deep-equal or throws.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PodService, type DeepStore } from './podService';
import {
  routeToPod,
  encodePayload,
  decodePayload,
  RoundTripError,
  POD_1,
  POD_2,
  POD_1_MAX_VALUE_BYTES,
} from './pods';

function fakeDeep(): DeepStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async k => map.get(k) ?? null,
    put: async (k, v) => { map.set(k, v); },
    delete: async k => { map.delete(k); },
    keys: async () => [...map.keys()],
  };
}

class FakeLocal {
  map = new Map<string, string>();
  full = false;
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null; }
  setItem(k: string, v: string) {
    if (this.full) {
      const e = new Error('quota') as Error & { name: string };
      e.name = 'QuotaExceededError';
      throw e;
    }
    this.map.set(k, v);
  }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}

const g = globalThis as Record<string, any>;
let local: FakeLocal;
let original: any;

beforeEach(() => {
  original = g.localStorage;
  local = new FakeLocal();
  g.localStorage = local;
});
afterEach(() => { g.localStorage = original; });

describe('pod identity', () => {
  it('Pod 2 knows it is the second and what it overflows from', () => {
    expect(POD_2.ordinal).toBe(2);
    expect(POD_2.overflowsFrom).toBe(POD_1.id);
    expect(POD_1.overflowsFrom).toBeUndefined();
  });

  it('records that only Pod 1 can be read synchronously', () => {
    // This is the real reason Pod 1 survives, not its size — some code reads
    // during render and cannot await.
    expect(POD_1.synchronous).toBe(true);
    expect(POD_2.synchronous).toBe(false);
  });

  it('gives Pod 2 a materially larger floor than Pod 1', () => {
    expect(POD_2.approxCapacityBytes).toBeGreaterThan(POD_1.approxCapacityBytes);
  });
});

describe('routing rule', () => {
  it('keeps a synchronous read in Pod 1 regardless of size', () => {
    const d = routeToPod(10_000_000, { needsSync: true });
    expect(d.pod).toBe('pod-1-local');
    expect(d.reason).toMatch(/synchronous/i);
  });

  it('keeps small values in the fast pod, uncompressed', () => {
    const d = routeToPod(100);
    expect(d.pod).toBe('pod-1-local');
    expect(d.compress).toBe(false);
  });

  it('sends large values to the deep pod, compressed', () => {
    const d = routeToPod(POD_1_MAX_VALUE_BYTES + 1);
    expect(d.pod).toBe('pod-2-indexed');
    expect(d.compress).toBe(true);
  });

  it('treats the threshold itself as fitting Pod 1', () => {
    expect(routeToPod(POD_1_MAX_VALUE_BYTES).pod).toBe('pod-1-local');
  });
});

describe('lossless retention is checked, not claimed', () => {
  it('round-trips a value deep-equal', async () => {
    const value = { a: 1, b: ['x', null, true], c: { nested: { deep: 'ok' } } };
    const encoded = await encodePayload(value);
    expect(await decodePayload(encoded)).toEqual(value);
  });

  it('round-trips unicode, emoji and empty structures unchanged', async () => {
    const value = { s: 'sauté 🙂 日本語', empty: {}, list: [], zero: 0, f: false };
    const encoded = await encodePayload(value);
    expect(await decodePayload(encoded)).toEqual(value);
  });

  it('actually compresses repetitive data', async () => {
    const value = { text: 'the same sentence over and over. '.repeat(500) };
    const raw = JSON.stringify(value).length;
    const encoded = await encodePayload(value);
    expect(encoded.bytes).toBeLessThan(raw / 2);
  });

  it('THROWS rather than returning subtly wrong data when bytes are tampered with', async () => {
    // The property that makes retention verifiable: a payload that no longer
    // means what it meant fails loudly instead of decoding to something
    // plausible that nobody would notice was wrong.
    const encoded = await encodePayload({ important: 'value' });
    const tampered = { ...encoded, observerHash: 'not-the-right-hash' };
    await expect(decodePayload(tampered)).rejects.toBeInstanceOf(RoundTripError);
  });
});

describe('pod service', () => {
  it('puts a small value in Pod 1', async () => {
    const svc = new PodService(fakeDeep());
    const r = await svc.set('k', { small: true });
    expect(r.pod).toBe('pod-1-local');
    expect(r.compressed).toBe(false);
    expect(await svc.get('k', null)).toEqual({ small: true });
  });

  it('puts a large value in Pod 2, compressed, and reads it back intact', async () => {
    const svc = new PodService(fakeDeep());
    const big = { blob: 'x'.repeat(POD_1_MAX_VALUE_BYTES + 1000) };
    const r = await svc.set('big', big);
    expect(r.pod).toBe('pod-2-indexed');
    expect(r.compressed).toBe(true);
    expect(r.storedBytes).toBeLessThan(r.originalBytes);
    expect(await svc.get('big', null)).toEqual(big);
  });

  it('OVERFLOWS to Pod 2 when Pod 1 is full, instead of losing the write', async () => {
    // The entire point of a second pod. Without this the value vanishes and
    // the user is never told.
    const svc = new PodService(fakeDeep());
    local.full = true;
    const r = await svc.set('k', { keep: 'this' });
    expect(r.overflowed).toBe(true);
    expect(r.pod).toBe('pod-2-indexed');
    expect(r.reason).toMatch(/full/i);
    expect(await svc.get('k', null)).toEqual({ keep: 'this' });
  });

  it('finds an overflowed value by its ordinary key', async () => {
    // If the caller had to know it overflowed, the overflow would just be a
    // silent loss wearing a different hat.
    const svc = new PodService(fakeDeep());
    local.full = true;
    await svc.set('same-key', { v: 1 });
    local.full = false;
    expect(await svc.get('same-key', null)).toEqual({ v: 1 });
  });

  it('reports which pod holds a key', async () => {
    const svc = new PodService(fakeDeep());
    await svc.set('small', { a: 1 });
    await svc.set('big', { blob: 'y'.repeat(POD_1_MAX_VALUE_BYTES + 10) });
    expect(await svc.locate('small')).toBe('pod-1-local');
    expect(await svc.locate('big')).toBe('pod-2-indexed');
    expect(await svc.locate('missing')).toBeNull();
  });

  it('removes from BOTH pods so a stale copy cannot resurface', async () => {
    const deep = fakeDeep();
    const svc = new PodService(deep);
    await svc.set('k', { a: 1 });
    local.full = true;
    await svc.set('k', { a: 2 }); // now also in Pod 2
    local.full = false;
    await svc.remove('k');
    expect(await svc.get('k', 'gone')).toBe('gone');
    expect(deep.map.has('k')).toBe(false);
  });

  it('returns the fallback rather than throwing when a payload is corrupt', async () => {
    const deep = fakeDeep();
    deep.map.set('bad', '{"truncated":');
    const svc = new PodService(deep);
    expect(await svc.get('bad', 'fallback')).toBe('fallback');
  });

  it('returns the fallback when the deep store itself fails', async () => {
    const broken: DeepStore = {
      get: async () => { throw new Error('store offline'); },
      put: async () => { throw new Error('store offline'); },
      delete: async () => {},
      keys: async () => [],
    };
    const svc = new PodService(broken);
    expect(await svc.get('k', 'fallback')).toBe('fallback');
  });

  it('exposes both pods so the chain can be shown', async () => {
    const svc = new PodService(fakeDeep());
    expect(svc.pods().map(p => p.ordinal)).toEqual([1, 2]);
  });
});
