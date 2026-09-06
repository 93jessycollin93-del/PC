/**
 * SAS Superstation — envelope bus. Prefix-matched pub/sub with no transport
 * assumptions and no dependencies.
 *
 * Deliberately unopinionated about *where* envelopes come from. A surface can
 * feed it from `jackyClient` polling, a Supabase realtime channel, a
 * `postMessage` from the embedded PC OS, or nothing at all. The bus only
 * guarantees delivery semantics and isolation between subscribers.
 */

import { idMatchesPrefix } from './contract.ts';
import type { CapabilityId, Envelope } from './contract.ts';

export type Listener<T = unknown> = (env: Envelope<T>) => void;
export type Unsubscribe = () => void;

interface Sub { prefix: string; fn: Listener<never>; once: boolean }

export interface BusOptions {
  /**
   * Where a throwing subscriber goes. Defaults to `console.error`.
   *
   * One bad panel must not stop delivery to the other eight — a station whose
   * telemetry stops because a chart threw is worse than one that logs and
   * carries on.
   */
  onError?: (err: unknown, env: Envelope) => void;
  /** Retain the last envelope per kind, so late subscribers get current state. */
  retain?: boolean;
}

export class Bus {
  private subs: Sub[] = [];
  private readonly retained = new Map<CapabilityId, Envelope>();
  private readonly onError: (err: unknown, env: Envelope) => void;
  private readonly retain: boolean;

  constructor(opts: BusOptions = {}) {
    this.onError = opts.onError ?? ((err, env) => {
      // eslint-disable-next-line no-console
      console.error(`superstation: subscriber threw on ${env.kind}`, err);
    });
    this.retain = opts.retain ?? true;
  }

  /**
   * Subscribe to a capability ID or a prefix of one. `sas.telemetry` receives
   * `sas.telemetry.thermal`; `*` receives everything.
   *
   * When retention is on, a matching retained envelope is delivered
   * synchronously at subscribe time, so a panel mounting late renders current
   * state instead of an empty box waiting for the next tick.
   */
  on<T = unknown>(prefix: CapabilityId | '*', fn: Listener<T>): Unsubscribe {
    const sub: Sub = { prefix, fn: fn as Listener<never>, once: false };
    this.subs.push(sub);
    if (this.retain) {
      for (const env of this.retained.values()) {
        if (idMatchesPrefix(env.kind, prefix)) this.deliver(sub, env);
      }
    }
    return () => { this.subs = this.subs.filter((s) => s !== sub); };
  }

  once<T = unknown>(prefix: CapabilityId | '*', fn: Listener<T>): Unsubscribe {
    const sub: Sub = { prefix, fn: fn as Listener<never>, once: true };
    this.subs.push(sub);
    return () => { this.subs = this.subs.filter((s) => s !== sub); };
  }

  /** Publish. Returns how many subscribers were invoked. */
  emit(env: Envelope): number {
    if (this.retain) this.retained.set(env.kind, env);
    // Snapshot: a subscriber that subscribes or unsubscribes during delivery
    // must not change who receives this envelope.
    const targets = this.subs.filter((s) => idMatchesPrefix(env.kind, s.prefix));
    for (const sub of targets) {
      if (sub.once) this.subs = this.subs.filter((s) => s !== sub);
      this.deliver(sub, env);
    }
    return targets.length;
  }

  /** Last envelope seen for a kind, if retention is on. */
  latest<T = unknown>(kind: CapabilityId): Envelope<T> | undefined {
    return this.retained.get(kind) as Envelope<T> | undefined;
  }

  /** Everything currently retained, sorted by kind. */
  snapshot(): Envelope[] {
    return [...this.retained.values()].sort((a, b) => (a.kind < b.kind ? -1 : 1));
  }

  clear(): void { this.subs = []; this.retained.clear(); }

  private deliver(sub: Sub, env: Envelope): void {
    try {
      (sub.fn as Listener)(env);
    } catch (err) {
      this.onError(err, env);
    }
  }
}
