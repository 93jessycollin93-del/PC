/**
 * SAS Superstation — the facade a pod actually holds.
 *
 * A pod constructs one `Station`, hands it its own manifest, and from then on
 * publishes through it and asks it for capabilities. Registry, bus and envelope
 * sealing are wired together here so an adopting repo imports one thing.
 */

import { KERNEL_VERSION, compatibility } from './contract.ts';
import type {
  CapabilityId,
  Envelope,
  PodManifest,
  Provenance,
} from './contract.ts';
import { Bus } from './bus.ts';
import type { BusOptions, Listener, Unsubscribe } from './bus.ts';
import { Registry } from './registry.ts';
import type { Resolution } from './registry.ts';
import { absent, derive, parse, seal, trustworthy } from './envelope.ts';
import type { ParseResult } from './envelope.ts';

export interface StationOptions extends BusOptions {
  /** This pod's own manifest. Its capabilities are registered on construction. */
  manifest: PodManifest;
  /** Manifests of pods this one knows about. More can be added later. */
  peers?: PodManifest[];
}

export class Station {
  readonly registry = new Registry();
  readonly bus: Bus;
  readonly manifest: PodManifest;
  /** Non-fatal notes accumulated during wiring — surfaced by `report()`. */
  readonly warnings: string[] = [];

  constructor(opts: StationOptions) {
    this.manifest = opts.manifest;
    this.bus = new Bus(opts);
    this.warnings.push(...this.registry.add(opts.manifest));
    for (const peer of opts.peers ?? []) {
      try {
        this.warnings.push(...this.registry.add(peer));
      } catch (err) {
        // A peer on an incompatible major is a fact about the fleet, not a
        // crash: this pod keeps running with one fewer peer.
        this.warnings.push(String(err instanceof Error ? err.message : err));
      }
    }
  }

  get podId(): string { return this.manifest.pod.id; }

  join(peer: PodManifest): string[] {
    const w = this.registry.add(peer);
    this.warnings.push(...w);
    return w;
  }

  /** Seal a value as this pod and publish it on the bus. */
  publish<T>(kind: CapabilityId, payload: T, provenance: Provenance, ts?: string): Envelope<T> {
    const env = seal<T>({ kind, pod: this.podId, payload, provenance, ...(ts ? { ts } : {}) });
    this.bus.emit(env);
    return env;
  }

  /** Publish a value computed from other envelopes, with fidelity carried down. */
  publishDerived<T>(
    from: ReadonlyArray<Pick<Envelope, 'provenance'>>,
    kind: CapabilityId,
    payload: T,
    provenance: Provenance,
  ): Envelope<T> {
    const env = derive<T>(from, { kind, pod: this.podId, payload, provenance });
    this.bus.emit(env);
    return env;
  }

  /**
   * Publish the fact that a capability has no data.
   *
   * The station's answer to a dead engine link. An `absent` envelope is a real
   * envelope: panels bound to the kind get told "nothing, because X" instead of
   * waiting forever on a tick that is never coming.
   */
  publishAbsent(kind: CapabilityId, source: string, reason: string): Envelope<Record<string, never>> {
    return this.publish(kind, {} as Record<string, never>, absent(source, reason));
  }

  /** Accept an envelope from outside — a fetch, a postMessage, an edge function. */
  ingest(input: unknown): ParseResult<unknown> {
    const res = parse(input);
    if (res.ok) this.bus.emit(res.envelope);
    return res;
  }

  on<T = unknown>(prefix: CapabilityId | '*', fn: Listener<T>): Unsubscribe {
    return this.bus.on(prefix, fn);
  }

  /** Resolve a capability through the registry, including `degradesTo` walks. */
  need(id: CapabilityId, range?: string): Resolution {
    return this.registry.resolve(id, range);
  }

  /** Is there a *trustworthy* current value for this kind? */
  isLive(kind: CapabilityId): boolean {
    const env = this.bus.latest(kind);
    return env !== undefined && trustworthy(env);
  }

  /**
   * One object describing the station's health: kernel version, what resolved,
   * what is running degraded, what is missing, and which retained values are
   * currently trustworthy.
   *
   * Intended to back a status panel directly — it is the honest answer to "is
   * any of this real right now?", which is the question every dashboard in this
   * fleet has previously answered by guessing.
   */
  report(): {
    kernel: string;
    pod: string;
    capabilities: CapabilityId[];
    unmet: string[];
    degraded: string[];
    trusted: CapabilityId[];
    untrusted: Array<{ kind: CapabilityId; fidelity: string; reason?: string }>;
    warnings: string[];
  } {
    const audit = this.registry.audit();
    const trusted: CapabilityId[] = [];
    const untrusted: Array<{ kind: CapabilityId; fidelity: string; reason?: string }> = [];
    for (const env of this.bus.snapshot()) {
      if (trustworthy(env)) trusted.push(env.kind);
      else untrusted.push({
        kind: env.kind,
        fidelity: env.provenance.fidelity,
        ...(env.provenance.reason ? { reason: env.provenance.reason } : {}),
      });
    }
    return {
      kernel: KERNEL_VERSION,
      pod: this.podId,
      capabilities: this.registry.capabilities(),
      unmet: audit.unmet.map((u) => `${u.pod} needs ${u.requirement.id}`),
      degraded: audit.degraded.map(
        (d) => `${d.pod} needs ${d.requirement.id}, served by ${d.resolution.chain.join(' -> ')}`,
      ),
      trusted,
      untrusted,
      warnings: this.warnings,
    };
  }
}

/** Convenience for pods that only need the version check. */
export const readerCompatibility = (dataVersion: string) => compatibility(dataVersion);
