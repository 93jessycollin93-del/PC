/**
 * SAS Superstation — capability registry and resolution. `SPEC.md` §7.
 *
 * This is the expandability mechanism. A new capability is a new manifest
 * entry: no kernel change, no registry change, and no change to consumers that
 * do not want it. Nothing here knows what a thermal reading or a route decision
 * *is* — only who claims to provide one and whether that claim currently holds.
 */

import {
  isCapabilityId,
  satisfiesRange,
  parseSemVer,
  compatibility,
} from './contract.ts';
import type {
  CapabilityDescriptor,
  CapabilityId,
  CapabilityRequirement,
  PodId,
  PodManifest,
} from './contract.ts';

export interface Registration extends CapabilityDescriptor {
  pod: PodId;
}

export type ResolutionStatus =
  /** The requested capability itself resolved. */
  | 'exact'
  /** A `degradesTo` fallback resolved instead. `chain` shows the walk. */
  | 'degraded'
  /** Nothing resolved. */
  | 'unresolved';

export interface Resolution {
  status: ResolutionStatus;
  requested: CapabilityId;
  /** The provider that will actually serve this, if any. */
  provider?: Registration;
  /** Capability IDs walked, requested first. Length > 1 means fallbacks were used. */
  chain: CapabilityId[];
  /** Why the exact request failed. Empty when `status === 'exact'`. */
  notes: string[];
}

/** Ordering: highest payload-contract version wins; ties broken by pod id for determinism. */
function betterThan(a: Registration, b: Registration): boolean {
  const va = parseSemVer(a.version);
  const vb = parseSemVer(b.version);
  if (!va) return false;
  if (!vb) return true;
  if (va.major !== vb.major) return va.major > vb.major;
  if (va.minor !== vb.minor) return va.minor > vb.minor;
  if (va.patch !== vb.patch) return va.patch > vb.patch;
  return a.pod < b.pod;
}

export class Registry {
  private readonly byId = new Map<CapabilityId, Registration[]>();
  private readonly pods = new Map<PodId, PodManifest>();

  /** Register one capability. Later registrations never clobber earlier ones. */
  register(pod: PodId, cap: CapabilityDescriptor): void {
    if (!isCapabilityId(cap.id)) {
      throw new Error(`superstation: invalid capability id "${String(cap.id)}" from pod ${pod}`);
    }
    if (!parseSemVer(cap.version)) {
      throw new Error(`superstation: capability ${cap.id} has invalid version "${cap.version}"`);
    }
    const list = this.byId.get(cap.id) ?? [];
    list.push({ ...cap, pod });
    this.byId.set(cap.id, list);
  }

  /**
   * Ingest a whole pod manifest.
   *
   * A manifest on an incompatible kernel major is rejected outright — its
   * capability semantics are not ours. A *newer minor* is accepted, which is
   * what lets a repo upgrade its kernel without waiting for the other eight.
   */
  add(manifest: PodManifest): string[] {
    const warnings: string[] = [];
    const compat = compatibility(manifest.kernel);
    if (compat === 'incompatible' || compat === 'malformed') {
      throw new Error(
        `superstation: pod ${manifest.pod?.id} declares kernel ${manifest.kernel}, ` +
        'which this kernel cannot interpret',
      );
    }
    if (compat === 'forward') {
      warnings.push(`pod ${manifest.pod.id} is on a newer kernel (${manifest.kernel})`);
    }
    this.pods.set(manifest.pod.id, manifest);
    for (const cap of manifest.provides ?? []) this.register(manifest.pod.id, cap);
    return warnings;
  }

  known(id: CapabilityId): boolean { return this.byId.has(id); }
  providers(id: CapabilityId): Registration[] { return [...(this.byId.get(id) ?? [])]; }
  capabilities(): CapabilityId[] { return [...this.byId.keys()].sort(); }
  manifests(): PodManifest[] { return [...this.pods.values()]; }

  /**
   * Resolve a capability, walking `degradesTo` when the exact request cannot be
   * served.
   *
   * A provider counts as usable only if its own `requires` also resolve — which
   * is what stops a surface from binding to a telemetry capability whose engine
   * link is missing. The walk is depth-guarded: a `degradesTo` cycle terminates
   * with `unresolved` rather than hanging. `station_doctor` reports the cycle
   * as a manifest error; the runtime just refuses to spin.
   */
  resolve(id: CapabilityId, range?: string): Resolution {
    const chain: CapabilityId[] = [];
    const notes: string[] = [];
    const seen = new Set<CapabilityId>();
    let current: CapabilityId | undefined = id;

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(current);
      const candidates = (this.byId.get(current) ?? [])
        .filter((c) => {
          if (!satisfiesRange(c.version, current === id ? range : undefined)) {
            notes.push(`${c.pod} provides ${current}@${c.version}, outside range ${range}`);
            return false;
          }
          return true;
        })
        .filter((c) => {
          const missing = (c.requires ?? []).filter((dep) => !this.satisfiable(dep, new Set(seen)));
          if (missing.length) {
            notes.push(`${c.pod} provides ${current} but requires unmet ${missing.join(', ')}`);
            return false;
          }
          return true;
        })
        .sort((a, b) => (betterThan(a, b) ? -1 : 1));

      if (candidates.length) {
        return {
          status: chain.length === 1 ? 'exact' : 'degraded',
          requested: id,
          provider: candidates[0],
          chain,
          notes: chain.length === 1 ? [] : notes,
        };
      }
      if (!this.byId.has(current)) notes.push(`no pod provides ${current}`);

      // Follow the fallback declared by *any* known descriptor for this id.
      const next: CapabilityId | undefined = (this.byId.get(current) ?? [])
        .map((c) => c.degradesTo)
        .find((d): d is CapabilityId => typeof d === 'string');
      current = next;
    }
    if (current && seen.has(current)) notes.push(`degradesTo cycle at ${current}`);
    return { status: 'unresolved', requested: id, chain, notes };
  }

  /** Cheap yes/no used for dependency checking, without building a Resolution. */
  private satisfiable(id: CapabilityId, guard: Set<CapabilityId>): boolean {
    if (guard.has(id)) return false;
    guard.add(id);
    for (const c of this.byId.get(id) ?? []) {
      if ((c.requires ?? []).every((dep) => this.satisfiable(dep, guard))) return true;
    }
    return false;
  }

  /**
   * Check every `requires` across every registered pod.
   *
   * This is the station's readiness report: what is wired, what is running on a
   * fallback, and what is simply not there. Optional requirements that fail are
   * reported but do not count as unmet.
   */
  audit(): {
    ok: boolean;
    unmet: Array<{ pod: PodId; requirement: CapabilityRequirement; resolution: Resolution }>;
    degraded: Array<{ pod: PodId; requirement: CapabilityRequirement; resolution: Resolution }>;
  } {
    const unmet: Array<{ pod: PodId; requirement: CapabilityRequirement; resolution: Resolution }> = [];
    const degradedList: typeof unmet = [];
    for (const manifest of this.pods.values()) {
      for (const req of manifest.requires ?? []) {
        const res = this.resolve(req.id, req.range);
        if (res.status === 'unresolved') {
          if (!req.optional) unmet.push({ pod: manifest.pod.id, requirement: req, resolution: res });
        } else if (res.status === 'degraded') {
          degradedList.push({ pod: manifest.pod.id, requirement: req, resolution: res });
        }
      }
    }
    return { ok: unmet.length === 0, unmet, degraded: degradedList };
  }
}
