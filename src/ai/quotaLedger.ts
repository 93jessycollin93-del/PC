/**
 * Provider Quota Ledger
 * Predictive quota tracking so the router can hand off BEFORE a provider rate-limits,
 * instead of discovering exhaustion by failing a live request.
 */

import type { ModelProvider } from '../../lib/modelRouter';

export type QuotaStatus = 'ok' | 'warn' | 'critical' | 'exhausted';

/** null means "no published limit", which we treat as unlimited rather than guessing. */
export interface ProviderLimits {
  requestsPerMinute: number | null;
  tokensPerMinute: number | null;
  requestsPerDay: number | null;
  tokensPerDay: number | null;
}

export interface UsageSample {
  tokens?: number;
  requests?: number;
  /** Event time. Defaults to the injected clock so callers rarely pass it. */
  at?: number;
}

export interface QuotaForecast {
  provider: ModelProvider;
  /** Worst-case fill across every limited dimension, 0..1 (can exceed 1 when over). */
  utilization: number;
  /** Projected ms until the tightest dimension is spent at the current rate. */
  willExhaustInMs: number | null;
  headroomRequests: number;
  headroomTokens: number;
  status: QuotaStatus;
  requestsLastMinute: number;
  tokensLastMinute: number;
  requestsToday: number;
  tokensToday: number;
  /** Requests/min and tokens/min implied by recent consumption, not by raw counts. */
  requestRatePerMinute: number;
  tokenRatePerMinute: number;
  /** Which dimension drives the forecast, for logs and UI. */
  limitedBy: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface QuotaLedgerOptions {
  /** Injected so every time-based decision is deterministic under test. */
  now?: () => number;
  storage?: StorageLike | null;
  storageKey?: string;
  limits?: Partial<Record<ModelProvider, Partial<ProviderLimits>>>;
  warnThreshold?: number;
  criticalThreshold?: number;
  /** Switch early if the tightest dimension dies within this many ms. */
  horizonMs?: number;
  /** Keep this many requests in reserve so an in-flight retry still fits. */
  reserveRequests?: number;
  rateWindowMs?: number;
}

interface Slot {
  s: number; // slot start, aligned to SLOT_MS
  r: number;
  t: number;
}

interface ProviderState {
  slots: Slot[];
  days: Record<string, { r: number; t: number }>;
}

interface WindowUsage {
  requests: number;
  tokens: number;
}

const SLOT_MS = 10_000; // 10s granularity keeps the rolling window cheap to persist
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const SLOT_RETENTION_MS = 5 * MINUTE_MS;
const DAY_RETENTION = 2;
const STORAGE_VERSION = 1;
const DEFAULT_STORAGE_KEY = 'jackie_quota_ledger_v1';

/**
 * Public free-tier numbers where they are documented. Anything undocumented stays null:
 * a wrong guess would trigger handoffs that cost money for no reason.
 */
export const DEFAULT_PROVIDER_LIMITS: Record<ModelProvider, ProviderLimits> = {
  groq: { requestsPerMinute: 30, tokensPerMinute: 6000, requestsPerDay: 14400, tokensPerDay: 500000 },
  gemini: { requestsPerMinute: 15, tokensPerMinute: 1000000, requestsPerDay: 1500, tokensPerDay: null },
  deepseek: { requestsPerMinute: 60, tokensPerMinute: null, requestsPerDay: null, tokensPerDay: null },
  anthropic: { requestsPerMinute: 50, tokensPerMinute: 40000, requestsPerDay: null, tokensPerDay: null },
  grok: { requestsPerMinute: null, tokensPerMinute: null, requestsPerDay: null, tokensPerDay: null },
  ollama: { requestsPerMinute: null, tokensPerMinute: null, requestsPerDay: null, tokensPerDay: null },
};

const EMPTY_LIMITS: ProviderLimits = {
  requestsPerMinute: null,
  tokensPerMinute: null,
  requestsPerDay: null,
  tokensPerDay: null,
};

function resolveDefaultStorage(): StorageLike | null {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    return candidate || null;
  } catch {
    // Access itself throws in locked-down/private-mode browsers.
    return null;
  }
}

function toCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export class QuotaLedger {
  private nowFn: () => number;
  private storage: StorageLike | null;
  private storageKey: string;
  private limits: Record<string, ProviderLimits>;
  private warnThreshold: number;
  private criticalThreshold: number;
  private horizonMs: number;
  private reserveRequests: number;
  private rateWindowMs: number;
  private state: Record<string, ProviderState> = {};
  private loaded = false;

  constructor(options: QuotaLedgerOptions = {}) {
    this.nowFn = options.now || (() => Date.now());
    // `undefined` means "use ambient localStorage", explicit null means "stay in memory".
    this.storage = options.storage === undefined ? resolveDefaultStorage() : options.storage;
    this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    this.warnThreshold = options.warnThreshold ?? 0.6;
    this.criticalThreshold = options.criticalThreshold ?? 0.85;
    this.horizonMs = options.horizonMs ?? 15_000;
    this.reserveRequests = options.reserveRequests ?? 2;
    this.rateWindowMs = options.rateWindowMs ?? MINUTE_MS;

    this.limits = {};
    (Object.keys(DEFAULT_PROVIDER_LIMITS) as ModelProvider[]).forEach(p => {
      this.limits[p] = { ...DEFAULT_PROVIDER_LIMITS[p] };
    });
    if (options.limits) {
      (Object.keys(options.limits) as ModelProvider[]).forEach(p => {
        this.setLimits(p, options.limits[p]);
      });
    }
  }

  /** Record consumption. Safe to call on every completed call, including failures. */
  public record(provider: ModelProvider, sample: UsageSample = {}): void {
    this.ensureLoaded();
    const at = Number.isFinite(sample.at) ? (sample.at as number) : this.nowFn();
    const requests = sample.requests === undefined ? 1 : toCount(sample.requests);
    const tokens = toCount(sample.tokens);
    if (requests === 0 && tokens === 0) return;

    const state = this.stateFor(provider);
    const slotStart = Math.floor(at / SLOT_MS) * SLOT_MS;
    const slot = state.slots.find(s => s.s === slotStart);
    if (slot) {
      slot.r += requests;
      slot.t += tokens;
    } else {
      state.slots.push({ s: slotStart, r: requests, t: tokens });
      state.slots.sort((a, b) => a.s - b.s);
    }

    const dayKey = String(Math.floor(at / DAY_MS));
    const day = state.days[dayKey] || { r: 0, t: 0 };
    day.r += requests;
    day.t += tokens;
    state.days[dayKey] = day;

    this.prune(at);
    this.persist();
  }

  public forecast(provider: ModelProvider): QuotaForecast {
    this.ensureLoaded();
    const now = this.nowFn();
    const state = this.stateFor(provider);
    const limits = this.getLimits(provider);

    const minute = this.windowUsage(state, now - MINUTE_MS, now);
    const dayKey = String(Math.floor(now / DAY_MS));
    const today = state.days[dayKey] || { r: 0, t: 0 };

    const rate = this.rateUsage(state, now);
    const requestRatePerMs = rate.requests;
    const tokenRatePerMs = rate.tokens;

    // Each dimension is scored independently, then the tightest one wins.
    const dims = [
      { name: 'requestsPerMinute', used: minute.requests, limit: limits.requestsPerMinute, rate: requestRatePerMs },
      { name: 'tokensPerMinute', used: minute.tokens, limit: limits.tokensPerMinute, rate: tokenRatePerMs },
      { name: 'requestsPerDay', used: today.r, limit: limits.requestsPerDay, rate: requestRatePerMs },
      { name: 'tokensPerDay', used: today.t, limit: limits.tokensPerDay, rate: tokenRatePerMs },
    ];

    let utilization = 0;
    let limitedBy: string | null = null;
    let willExhaustInMs: number | null = null;

    dims.forEach(dim => {
      if (!dim.limit || dim.limit <= 0) return;
      const dimUtil = dim.used / dim.limit;
      if (limitedBy === null || dimUtil > utilization) {
        utilization = dimUtil;
        limitedBy = dim.name;
      }
      const remaining = Math.max(dim.limit - dim.used, 0);
      const eta = remaining <= 0 ? 0 : dim.rate > 0 ? remaining / dim.rate : null;
      if (eta !== null && (willExhaustInMs === null || eta < willExhaustInMs)) {
        willExhaustInMs = eta;
      }
    });

    const headroomRequests = this.headroom(
      [
        { used: minute.requests, limit: limits.requestsPerMinute },
        { used: today.r, limit: limits.requestsPerDay },
      ]
    );
    const headroomTokens = this.headroom(
      [
        { used: minute.tokens, limit: limits.tokensPerMinute },
        { used: today.t, limit: limits.tokensPerDay },
      ]
    );

    return {
      provider,
      utilization,
      willExhaustInMs,
      headroomRequests,
      headroomTokens,
      status: this.statusFor(utilization),
      requestsLastMinute: minute.requests,
      tokensLastMinute: minute.tokens,
      requestsToday: today.r,
      tokensToday: today.t,
      requestRatePerMinute: requestRatePerMs * MINUTE_MS,
      tokenRatePerMinute: tokenRatePerMs * MINUTE_MS,
      limitedBy,
    };
  }

  public forecastAll(providers?: ModelProvider[]): QuotaForecast[] {
    const list = providers && providers.length
      ? providers
      : (Object.keys(DEFAULT_PROVIDER_LIMITS) as ModelProvider[]);
    return list.map(p => this.forecast(p));
  }

  /**
   * The predictive question: will this provider die during the next call or two?
   * Answering yes here is what turns failover from reactive into planned.
   */
  public shouldPreemptivelySwitch(provider: ModelProvider): boolean {
    const f = this.forecast(provider);
    if (f.status === 'exhausted' || f.status === 'critical') return true;
    if (f.headroomRequests <= this.reserveRequests) return true;
    if (f.willExhaustInMs !== null && f.willExhaustInMs <= this.horizonMs) return true;
    return false;
  }

  /**
   * Rank the bench by remaining headroom so the handoff target is known in advance.
   * Fractional headroom leads because absolute counts are not comparable across providers.
   */
  public nextInLine(current: ModelProvider | null, candidates: ModelProvider[]): ModelProvider[] {
    const seen: Record<string, boolean> = {};
    const pool: ModelProvider[] = [];
    (candidates || []).forEach(c => {
      if (!c || c === current || seen[c]) return;
      seen[c] = true;
      pool.push(c);
    });

    return pool
      .map((provider, index) => ({ provider, index, forecast: this.forecast(provider) }))
      .sort((a, b) => {
        const freeA = 1 - a.forecast.utilization;
        const freeB = 1 - b.forecast.utilization;
        if (freeA !== freeB) return freeB - freeA;
        if (a.forecast.headroomRequests !== b.forecast.headroomRequests) {
          return b.forecast.headroomRequests - a.forecast.headroomRequests;
        }
        return a.index - b.index; // stable, so caller-supplied preference survives ties
      })
      .map(entry => entry.provider);
  }

  public setLimits(provider: ModelProvider, limits: Partial<ProviderLimits>): void {
    const base = this.limits[provider] || { ...EMPTY_LIMITS };
    this.limits[provider] = { ...base, ...(limits || {}) };
  }

  public getLimits(provider: ModelProvider): ProviderLimits {
    return { ...(this.limits[provider] || EMPTY_LIMITS) };
  }

  /** Raw counters, mostly for a debug panel. */
  public snapshot(): Record<string, ProviderState> {
    this.ensureLoaded();
    return JSON.parse(JSON.stringify(this.state));
  }

  public reset(provider?: ModelProvider): void {
    this.ensureLoaded();
    if (provider) {
      delete this.state[provider];
    } else {
      this.state = {};
    }
    this.persist();
  }

  private statusFor(utilization: number): QuotaStatus {
    if (utilization >= 1) return 'exhausted';
    if (utilization >= this.criticalThreshold) return 'critical';
    if (utilization >= this.warnThreshold) return 'warn';
    return 'ok';
  }

  private headroom(dims: { used: number; limit: number | null }[]): number {
    let headroom = Number.POSITIVE_INFINITY;
    dims.forEach(d => {
      if (!d.limit || d.limit <= 0) return;
      headroom = Math.min(headroom, Math.max(d.limit - d.used, 0));
    });
    return headroom;
  }

  private stateFor(provider: ModelProvider): ProviderState {
    let state = this.state[provider];
    if (!state) {
      state = { slots: [], days: {} };
      this.state[provider] = state;
    }
    return state;
  }

  /** Slots overlapping the window count in full: over-counting switches early, which is the safe side. */
  private windowUsage(state: ProviderState, from: number, to: number): WindowUsage {
    let requests = 0;
    let tokens = 0;
    state.slots.forEach(slot => {
      if (slot.s + SLOT_MS <= from || slot.s > to) return;
      requests += slot.r;
      tokens += slot.t;
    });
    return { requests, tokens };
  }

  /** Consumption per ms over the trailing window, which is what makes the forecast predictive. */
  private rateUsage(state: ProviderState, now: number): WindowUsage {
    const from = now - this.rateWindowMs;
    const usage = this.windowUsage(state, from, now);
    if (usage.requests === 0 && usage.tokens === 0) return { requests: 0, tokens: 0 };

    const first = state.slots.find(slot => slot.s + SLOT_MS > from && slot.s <= now);
    const observedFrom = first ? Math.max(first.s, from) : now;
    // Floor the divisor at one slot so a burst inside a single slot cannot imply an infinite rate.
    const elapsed = Math.max(now - observedFrom, SLOT_MS);
    return { requests: usage.requests / elapsed, tokens: usage.tokens / elapsed };
  }

  private prune(reference: number): void {
    const slotCutoff = reference - SLOT_RETENTION_MS;
    const dayCutoff = Math.floor(reference / DAY_MS) - (DAY_RETENTION - 1);
    Object.keys(this.state).forEach(key => {
      const state = this.state[key];
      state.slots = state.slots.filter(slot => slot.s + SLOT_MS > slotCutoff);
      Object.keys(state.days).forEach(dayKey => {
        if (Number(dayKey) < dayCutoff) delete state.days[dayKey];
      });
    });
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Anything unexpected on disk is dropped rather than repaired: a wrong ledger is worse than an empty one.
      if (!parsed || typeof parsed !== 'object' || parsed.v !== STORAGE_VERSION) return;
      const providers = parsed.providers;
      if (!providers || typeof providers !== 'object') return;
      Object.keys(providers).forEach(key => {
        const entry = providers[key];
        if (!entry || typeof entry !== 'object') return;
        const slots: Slot[] = Array.isArray(entry.slots)
          ? entry.slots
              .filter((s: unknown) => !!s && typeof s === 'object' && Number.isFinite((s as Slot).s))
              .map((s: Slot) => ({ s: Number(s.s), r: toCount(s.r), t: toCount(s.t) }))
              .sort((a: Slot, b: Slot) => a.s - b.s)
          : [];
        const days: Record<string, { r: number; t: number }> = {};
        if (entry.days && typeof entry.days === 'object') {
          Object.keys(entry.days).forEach(dayKey => {
            const d = entry.days[dayKey];
            if (!d || typeof d !== 'object') return;
            days[dayKey] = { r: toCount(d.r), t: toCount(d.t) };
          });
        }
        this.state[key] = { slots, days };
      });
      this.prune(this.nowFn());
    } catch {
      // Corrupt or unreadable storage degrades to an empty ledger instead of breaking routing.
      this.state = {};
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify({ v: STORAGE_VERSION, providers: this.state }));
    } catch {
      // Quota or private-mode failures must never break a live request.
    }
  }
}

export const quotaLedger = new QuotaLedger();
