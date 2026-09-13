/**
 * SAS Superstation — contract types and version rules.
 *
 * Normative source: `superstation/SPEC.md`. If this file and the spec disagree,
 * the spec wins and this file is a bug.
 *
 * Zero imports, deliberately — the nine repos in the fleet share no dependency
 * in common, and this must drop into a Flask-adjacent Node script, a Vite/React
 * app and a Deno edge function without a build step in between.
 */

/** Contract version implemented by this kernel. Semver, per SPEC.md §5. */
export const KERNEL_VERSION = '1.0.0';

/* ------------------------------------------------------------------ *
 * Identifiers (SPEC.md §2)
 * ------------------------------------------------------------------ */

export const CAPABILITY_ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,5}$/;
export const POD_ID_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){1,3}$/;

export type CapabilityId = string;
export type PodId = string;

export const isCapabilityId = (v: unknown): v is CapabilityId =>
  typeof v === 'string' && CAPABILITY_ID_RE.test(v);

export const isPodId = (v: unknown): v is PodId =>
  typeof v === 'string' && POD_ID_RE.test(v);

/**
 * Prefix match, on segment boundaries only. `sas.telemetry` matches
 * `sas.telemetry.thermal` but never `sas.telemetryx`. Used by the bus for
 * wildcard subscription.
 */
export function idMatchesPrefix(id: CapabilityId, prefix: string): boolean {
  if (prefix === '*' || prefix === id) return true;
  return id.startsWith(prefix + '.');
}

/* ------------------------------------------------------------------ *
 * Fidelity ladder (SPEC.md §4)
 * ------------------------------------------------------------------ */

export type Fidelity = 'live' | 'cached' | 'degraded' | 'simulated' | 'absent';

/** Total order over the ladder. Consumers compare ranks, never strings. */
export const FIDELITY_RANK: Readonly<Record<Fidelity, number>> = Object.freeze({
  live: 4,
  cached: 3,
  degraded: 2,
  simulated: 1,
  absent: 0,
});

export const FIDELITIES = Object.keys(FIDELITY_RANK) as Fidelity[];

export const isFidelity = (v: unknown): v is Fidelity =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(FIDELITY_RANK, v);

export const rankOf = (f: Fidelity): number => FIDELITY_RANK[f];

/**
 * At or above this rank, a reading came from the real source and a surface may
 * render it unlabelled. Below it, the surface is obliged to mark it.
 *
 * Exported as one constant so no panel re-derives the threshold and quietly
 * picks a friendlier one.
 */
export const TRUST_THRESHOLD = FIDELITY_RANK.cached;

/** The weaker of two fidelities. Degradation through a chain is monotonic. */
export const weakest = (a: Fidelity, b: Fidelity): Fidelity =>
  rankOf(a) <= rankOf(b) ? a : b;

export interface Provenance {
  fidelity: Fidelity;
  /** Stable, free-form origin label, e.g. `jacky:/api/metrics`. */
  source: string;
  /** When the underlying reading was actually taken. Required for live/cached. */
  observedAt?: string;
  /** How stale the reading is, in ms. Required for cached. */
  staleMs?: number;
  /** Why fidelity is below `cached`. Required for degraded/simulated/absent. */
  reason?: string;
  /** Forward-compat sidecar for unknown provenance keys (SPEC.md §6). */
  ext?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Envelope (SPEC.md §3)
 * ------------------------------------------------------------------ */

export interface Envelope<T = unknown> {
  kernel: string;
  kind: CapabilityId;
  id: string;
  ts: string;
  pod: PodId;
  provenance: Provenance;
  payload: T;
  /** Unknown top-level keys, preserved for round-trip (SPEC.md §6). */
  ext?: Record<string, unknown>;
}

/** Keys the kernel understands at the top level. Everything else goes to `ext`. */
export const KNOWN_ENVELOPE_KEYS: readonly string[] = Object.freeze([
  'kernel', 'kind', 'id', 'ts', 'pod', 'provenance', 'payload', 'ext',
]);

export const KNOWN_PROVENANCE_KEYS: readonly string[] = Object.freeze([
  'fidelity', 'source', 'observedAt', 'staleMs', 'reason', 'ext',
]);

/* ------------------------------------------------------------------ *
 * Capabilities (SPEC.md §7)
 * ------------------------------------------------------------------ */

export interface CapabilityDescriptor {
  id: CapabilityId;
  /** Semver of the payload contract. Independent of KERNEL_VERSION. */
  version: string;
  title?: string;
  degradesTo?: CapabilityId;
  requires?: CapabilityId[];
  /** Declares state mutation / secret exposure. Declaration only — see SPEC.md §9. */
  privileged?: boolean;
}

export type PodRole = 'engine' | 'surface' | 'vault' | 'bot' | 'knowledge';

export interface PodIdentity {
  id: PodId;
  name: string;
  role: PodRole;
  /** `owner/repo`. */
  repo: string;
  summary?: string;
}

export interface CapabilityRequirement {
  id: CapabilityId;
  /** Accepted payload-contract major, e.g. `1.x`. Absent means any. */
  range?: string;
  optional?: boolean;
}

export interface PodManifest {
  kernel: string;
  pod: PodIdentity;
  provides: CapabilityDescriptor[];
  requires?: CapabilityRequirement[];
  surfaces?: Array<{ kind: string; base?: string; note?: string }>;
}

/* ------------------------------------------------------------------ *
 * Version compatibility (SPEC.md §5)
 * ------------------------------------------------------------------ */

export type Compatibility = 'compatible' | 'forward' | 'incompatible' | 'malformed';

export interface SemVer { major: number; minor: number; patch: number }

export function parseSemVer(v: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(typeof v === 'string' ? v : '');
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/**
 * How a reader at `readerVersion` should treat data at `dataVersion`.
 *
 * `forward` is the interesting case and the reason the fleet does not need a
 * lockstep upgrade: newer minor data is *accepted*, with its unknown fields
 * preserved rather than dropped.
 */
export function compatibility(
  dataVersion: string,
  readerVersion: string = KERNEL_VERSION,
): Compatibility {
  const d = parseSemVer(dataVersion);
  const r = parseSemVer(readerVersion);
  if (!d || !r) return 'malformed';
  if (d.major !== r.major) return 'incompatible';
  if (d.minor > r.minor) return 'forward';
  return 'compatible';
}

/** Does a payload-contract `version` satisfy a `range` like `1.x` or `1.2`? */
export function satisfiesRange(version: string, range?: string): boolean {
  if (!range) return true;
  const v = parseSemVer(version);
  if (!v) return false;
  const m = /^(\d+)\.(x|\d+)$/.exec(range);
  if (!m) return false;
  if (v.major !== +m[1]) return false;
  return m[2] === 'x' || v.minor === +m[2];
}
