import { describe, it, expect } from 'vitest';
import { QuotaLedger } from './quotaLedger';

/** Discardable storage, so each case starts from nothing. */
const freshStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
};

/** A ledger with a caller-driven clock, and groq's public free-tier limits
 *  declared explicitly — this package bakes in no provider's numbers. */
function at(start = 1_000_000) {
  let now = start;
  const ledger = new QuotaLedger({
    now: () => now,
    storage: freshStore(),
    limits: { groq: { requestsPerMinute: 30, tokensPerMinute: 6000 } },
  });
  return { ledger, advance: (ms: number) => { now += ms; }, now: () => now };
}

describe('predicting exhaustion before it happens', () => {
  it('signals a switch while headroom still remains', () => {
    const { ledger, advance } = at();
    for (let i = 0; i < 20; i++) { ledger.record('groq', { requests: 1 }); advance(500); }

    const forecast = ledger.forecast('groq');
    expect(ledger.shouldPreemptivelySwitch('groq')).toBe(true);
    expect(forecast.headroomRequests).toBeGreaterThan(0);
    expect(forecast.status).not.toBe('exhausted');
  });

  it('stays put on a slow trickle of the same volume', () => {
    const { ledger, advance } = at();
    for (let i = 0; i < 5; i++) { ledger.record('groq', { requests: 1 }); advance(10_000); }
    expect(ledger.shouldPreemptivelySwitch('groq')).toBe(false);
  });

  it('does not signal a switch when nothing has been used', () => {
    expect(at().ledger.shouldPreemptivelySwitch('groq')).toBe(false);
  });

  it('never signals for a provider with no declared limits', () => {
    // The whole point of not baking in numbers: an unconfigured provider must
    // never be treated as constrained.
    const { ledger, advance } = at();
    for (let i = 0; i < 500; i++) { ledger.record('anything', { requests: 1 }); advance(10); }
    expect(ledger.shouldPreemptivelySwitch('anything')).toBe(false);
    expect(ledger.forecast('anything').status).toBe('ok');
  });

  it('shortens its estimate as consumption climbs', () => {
    const light = at();
    for (let i = 0; i < 8; i++) { light.ledger.record('groq', { requests: 1 }); light.advance(300); }
    const lightEta = light.ledger.forecast('groq').willExhaustInMs;

    const heavy = at();
    for (let i = 0; i < 20; i++) { heavy.ledger.record('groq', { requests: 1 }); heavy.advance(300); }
    const heavyEta = heavy.ledger.forecast('groq').willExhaustInMs;

    expect(lightEta).not.toBeNull();
    expect(heavyEta).not.toBeNull();
    expect(heavyEta!).toBeLessThan(lightEta!);
  });

  it('reports utilization rising with use', () => {
    const { ledger, advance } = at();
    expect(ledger.forecast('groq').utilization).toBe(0);
    for (let i = 0; i < 10; i++) { ledger.record('groq', { requests: 1 }); advance(200); }
    expect(ledger.forecast('groq').utilization).toBeGreaterThan(0);
  });

  it('marks a spent provider exhausted with no headroom left', () => {
    const { ledger, advance } = at();
    for (let i = 0; i < 30; i++) { ledger.record('groq', { requests: 1 }); advance(100); }
    const f = ledger.forecast('groq');
    expect(f.status).toBe('exhausted');
    expect(f.headroomRequests).toBe(0);
  });

  it('recovers on its own once the rate window passes', () => {
    const { ledger, advance } = at();
    for (let i = 0; i < 25; i++) { ledger.record('groq', { requests: 1 }); advance(100); }
    expect(ledger.forecast('groq').status).not.toBe('ok');
    advance(120_000);
    expect(ledger.shouldPreemptivelySwitch('groq')).toBe(false);
  });
});

describe('choosing who takes over', () => {
  it('never nominates the provider being replaced', () => {
    const { ledger } = at();
    const order = ledger.nextInLine('groq', ['groq', 'gemini', 'deepseek']);
    expect(order).not.toContain('groq');
    expect(order).toHaveLength(2);
  });

  it('puts the provider with more room to spare first', () => {
    const { ledger, advance } = at();
    ledger.setLimits('gemini', { requestsPerMinute: 15 });
    for (let i = 0; i < 12; i++) { ledger.record('gemini', { requests: 1 }); advance(200); }
    expect(ledger.nextInLine('groq', ['gemini', 'deepseek'])[0]).toBe('deepseek');
  });

  it('returns nothing when there is nobody to switch to', () => {
    expect(at().ledger.nextInLine('groq', [])).toEqual([]);
  });

  it('requires providers to be named explicitly for forecastAll', () => {
    // No baked-in roster exists to default to.
    expect(at().ledger.forecastAll(['groq', 'gemini'])).toHaveLength(2);
    expect(at().ledger.forecastAll([])).toEqual([]);
  });
});

describe('limits are declared, not discovered', () => {
  it('accepts a correction at runtime, so a wrong guess needs no redeploy', () => {
    const { ledger, advance } = at();
    for (let i = 0; i < 4; i++) { ledger.record('groq', { requests: 1 }); advance(500); }
    expect(ledger.shouldPreemptivelySwitch('groq')).toBe(false);

    ledger.setLimits('groq', { requestsPerMinute: 5 });
    expect(ledger.shouldPreemptivelySwitch('groq')).toBe(true);
  });
});

describe('storage', () => {
  it('carries usage across instances that share a store', () => {
    const store = freshStore();
    let now = 500_000;
    const first = new QuotaLedger({ now: () => now, storage: store });
    for (let i = 0; i < 8; i++) { first.record('groq', { requests: 1 }); now += 300; }

    const second = new QuotaLedger({ now: () => now, storage: store });
    expect(second.forecast('groq').requestsLastMinute).toBeGreaterThan(0);
  });

  it('starts clean on a corrupt payload rather than throwing during boot', () => {
    const store = freshStore();
    store.setItem('predictive_router_quota_ledger_v1', '{{{ not json');
    const ledger = new QuotaLedger({ now: () => 1_000_000, storage: store });
    expect(() => ledger.forecast('groq')).not.toThrow();
    expect(ledger.forecast('groq').requestsLastMinute).toBe(0);
  });

  it('survives storage that refuses to read or write', () => {
    const hostile = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const ledger = new QuotaLedger({ now: () => 1_000_000, storage: hostile });
    expect(() => ledger.record('groq', { requests: 1 })).not.toThrow();
    expect(() => ledger.forecast('groq')).not.toThrow();
  });
});
