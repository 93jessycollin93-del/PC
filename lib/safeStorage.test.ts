/**
 * Hardened storage.
 *
 * Drives the REAL helpers against a storage that misbehaves the way a real one
 * does — full, corrupt, or absent. The invariant is that no call site can be
 * taken down by storage, and that a failed WRITE is never silent, because a
 * user believing their work is saved when it is not is the worst outcome here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  safeGetJSON,
  safeSetJSON,
  safeRemove,
  measureStorage,
  isQuotaError,
  isArray,
  isObject,
  isFailure,
} from './safeStorage';
import { bus } from './bus';

class FakeStorage {
  map = new Map<string, string>();
  /** Set to make every write fail the way a full browser does. */
  full = false;
  /** Set to make reads throw, as privacy modes can. */
  hostile = false;

  getItem(k: string) {
    if (this.hostile) throw new Error('read denied');
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    if (this.full) {
      const err = new Error('exceeded the quota') as Error & { name: string; code: number };
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

const g = globalThis as Record<string, any>;
let fake: FakeStorage;
let original: any;

beforeEach(() => {
  original = g.localStorage;
  fake = new FakeStorage();
  g.localStorage = fake;
});
afterEach(() => {
  g.localStorage = original;
});

describe('reading never takes down the caller', () => {
  it('returns the stored value when it is valid', () => {
    fake.map.set('k', JSON.stringify({ a: 1 }));
    expect(safeGetJSON('k', {})).toEqual({ a: 1 });
  });

  it('returns the fallback for a missing key', () => {
    expect(safeGetJSON('nope', { d: true })).toEqual({ d: true });
  });

  it('returns the fallback for corrupt JSON instead of throwing', () => {
    // A write interrupted by a crash or a quota error leaves exactly this.
    fake.map.set('k', '{"half":');
    expect(() => safeGetJSON('k', [])).not.toThrow();
    expect(safeGetJSON('k', [])).toEqual([]);
  });

  it('returns the fallback when the shape is wrong', () => {
    // Valid JSON of the wrong type is the nastier case: it parses, then fails
    // somewhere far away when something calls .map on it.
    fake.map.set('k', JSON.stringify({ not: 'an array' }));
    expect(safeGetJSON('k', [] as unknown[], isArray)).toEqual([]);
  });

  it('treats a stored null as absent rather than handing null back', () => {
    fake.map.set('k', 'null');
    expect(safeGetJSON('k', { safe: true }, isObject)).toEqual({ safe: true });
  });

  it('survives a storage that throws on read', () => {
    fake.hostile = true;
    expect(safeGetJSON('k', 'fallback')).toBe('fallback');
  });

  it('survives storage being absent entirely', () => {
    g.localStorage = undefined;
    expect(safeGetJSON('k', 'fallback')).toBe('fallback');
  });

  it('treats an empty string as absent', () => {
    fake.map.set('k', '');
    expect(safeGetJSON('k', 'fallback')).toBe('fallback');
  });
});

describe('a failed write is never silent', () => {
  let notes: { title: string; message?: string }[];
  let off: () => void;
  beforeEach(() => {
    notes = [];
    off = bus.on('jackie-notification', n => notes.push({ title: n.title, message: n.message }));
  });
  afterEach(() => off());

  it('writes and reports success', () => {
    expect(safeSetJSON('k', { a: 1 })).toEqual({ ok: true });
    expect(JSON.parse(fake.map.get('k') as string)).toEqual({ a: 1 });
  });

  it('reports quota exhaustion rather than throwing', () => {
    fake.full = true;
    const outcome = safeSetJSON('k', { a: 1 });
    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ reason: 'quota' });
  });

  it('TELLS THE USER when storage is full', () => {
    // The whole point: silently dropping a save is worse than any error.
    fake.full = true;
    safeSetJSON('k', { a: 1 });
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toMatch(/full/i);
    expect(notes[0].message).toMatch(/not saved/i);
  });

  it('can stay quiet for high-frequency writes, but still reports the outcome', () => {
    fake.full = true;
    const outcome = safeSetJSON('k', { a: 1 }, { silent: true });
    expect(notes).toHaveLength(0);
    expect(outcome.ok).toBe(false);
  });

  it('reports an unserializable value with the key named', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const outcome = safeSetJSON('loop', circular);
    // Uses the exported guard rather than a cast: a cast keeps compiling if
    // the union changes shape, which is exactly the drift worth catching.
    expect(isFailure(outcome)).toBe(true);
    if (!isFailure(outcome)) return;
    expect(outcome.reason).toBe('error');
    expect(outcome.message).toContain('loop');
  });

  it('reports storage being unavailable rather than pretending it saved', () => {
    g.localStorage = undefined;
    const outcome = safeSetJSON('k', 1);
    expect(outcome).toMatchObject({ ok: false, reason: 'unavailable' });
  });
});

describe('quota error detection', () => {
  it('recognises the standard name', () => {
    const e = new Error('full');
    e.name = 'QuotaExceededError';
    expect(isQuotaError(e)).toBe(true);
  });

  it('recognises the Firefox name, which differs', () => {
    const e = new Error('full');
    e.name = 'NS_ERROR_DOM_QUOTA_REACHED';
    expect(isQuotaError(e)).toBe(true);
  });

  it('recognises the legacy numeric codes', () => {
    const a = Object.assign(new Error('full'), { code: 22 });
    const b = Object.assign(new Error('full'), { code: 1014 });
    expect(isQuotaError(a)).toBe(true);
    expect(isQuotaError(b)).toBe(true);
  });

  it('does not mistake an ordinary error for a quota error', () => {
    expect(isQuotaError(new Error('something else'))).toBe(false);
    expect(isQuotaError('not an error')).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('measuring what storage holds', () => {
  it('reports usage and the largest entries first', () => {
    fake.map.set('small', 'a');
    fake.map.set('huge', 'x'.repeat(1000));
    const usage = measureStorage();
    expect(usage.keys).toBe(2);
    expect(usage.usedBytes).toBeGreaterThan(2000);
    // Largest first is what someone freeing space actually needs — a total
    // alone does not tell you what to delete.
    expect(usage.largest[0].key).toBe('huge');
  });

  it('honours topN', () => {
    for (let i = 0; i < 10; i++) fake.map.set(`k${i}`, 'v'.repeat(i + 1));
    expect(measureStorage(3).largest).toHaveLength(3);
  });

  it('returns zeros when storage is unavailable', () => {
    g.localStorage = undefined;
    expect(measureStorage()).toEqual({ usedBytes: 0, keys: 0, largest: [] });
  });

  it('degrades rather than throwing on a hostile storage', () => {
    fake.map.set('k', 'v');
    fake.hostile = true;
    expect(() => measureStorage()).not.toThrow();
  });
});

describe('removal', () => {
  it('removes a key', () => {
    fake.map.set('k', '1');
    safeRemove('k');
    expect(fake.map.has('k')).toBe(false);
  });

  it('never throws when storage is absent', () => {
    g.localStorage = undefined;
    expect(() => safeRemove('k')).not.toThrow();
  });
});
