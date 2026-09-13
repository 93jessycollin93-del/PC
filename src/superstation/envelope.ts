/**
 * SAS Superstation — envelope construction, validation and forward-compatible
 * parsing. Normative source: `SPEC.md` §3–§6.
 *
 * Three jobs, in order of importance:
 *
 *   1. Make it impossible to emit a reading without saying how real it is.
 *   2. Make an old reader lossless over new data (`ext` sidecar, §6).
 *   3. Make degradation monotonic, so a chain of pods cannot launder a
 *      simulated number into a live one (`derive`, §4).
 */

import {
  KERNEL_VERSION,
  KNOWN_ENVELOPE_KEYS,
  KNOWN_PROVENANCE_KEYS,
  TRUST_THRESHOLD,
  compatibility,
  isCapabilityId,
  isFidelity,
  isPodId,
  rankOf,
  weakest,
} from './contract.ts';
import type { CapabilityId, Envelope, Fidelity, PodId, Provenance } from './contract.ts';

/* ------------------------------------------------------------------ *
 * Small utilities (no dependencies, by design)
 * ------------------------------------------------------------------ */

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** RFC 3339 UTC, millisecond precision — the only timestamp format §3 allows. */
export function stamp(at: Date | number = Date.now()): string {
  return new Date(at).toISOString().replace(/\.(\d{3})\d*Z$/, '.$1Z');
}

export const isStamp = (v: unknown): v is string =>
  typeof v === 'string' && TS_RE.test(v);

let seq = 0;

/**
 * Envelope IDs need to be unique, not unguessable — nothing authenticates on
 * them. `crypto.randomUUID` where it exists (browsers, Node 19+, Deno), and a
 * time+counter+random fallback elsewhere so the kernel still loads on an old
 * runtime rather than throwing at import time.
 */
export function envelopeId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  seq = (seq + 1) % 0xffff;
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `env-${Date.now().toString(36)}-${seq.toString(36)}-${rand}`;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/* ------------------------------------------------------------------ *
 * Provenance constructors
 * ------------------------------------------------------------------ */

/**
 * The five constructors below are the only supported way to build provenance.
 * Each one takes exactly the fields §4 requires for its rung, so the required-
 * field rules are enforced by the type checker at the call site rather than by
 * a validator after the fact.
 */
export const live = (source: string, observedAt: string = stamp()): Provenance =>
  ({ fidelity: 'live', source, observedAt });

export const cached = (source: string, observedAt: string, staleMs?: number): Provenance => ({
  fidelity: 'cached',
  source,
  observedAt,
  staleMs: staleMs ?? Math.max(0, Date.now() - Date.parse(observedAt)),
});

export const degraded = (source: string, reason: string, observedAt?: string): Provenance =>
  ({ fidelity: 'degraded', source, reason, ...(observedAt ? { observedAt } : {}) });

export const simulated = (source: string, reason: string): Provenance =>
  ({ fidelity: 'simulated', source, reason });

export const absent = (source: string, reason: string): Provenance =>
  ({ fidelity: 'absent', source, reason });

/* ------------------------------------------------------------------ *
 * Trust
 * ------------------------------------------------------------------ */

/**
 * Whether a surface may render this value unlabelled.
 *
 * The honesty rule in one function: everything below `cached` is display-only
 * and must be marked. Panels call this instead of comparing fidelity strings,
 * which is how the threshold stays in one place.
 */
export const trustworthy = (env: Pick<Envelope, 'provenance'>): boolean =>
  rankOf(env.provenance.fidelity) >= TRUST_THRESHOLD;

/** Human-readable badge text for an untrustworthy envelope. `null` when trusted. */
export function badge(env: Pick<Envelope, 'provenance'>): string | null {
  const p = env.provenance;
  if (rankOf(p.fidelity) >= TRUST_THRESHOLD) return null;
  switch (p.fidelity) {
    case 'degraded': return 'PARTIAL';
    case 'simulated': return 'SIMULATED';
    case 'absent': return 'NO DATA';
    default: return 'UNVERIFIED';
  }
}

/* ------------------------------------------------------------------ *
 * Construction
 * ------------------------------------------------------------------ */

export interface SealOptions<T> {
  kind: CapabilityId;
  pod: PodId;
  payload: T;
  provenance: Provenance;
  /** Override the emit timestamp. Tests pin this; production should not. */
  ts?: string;
  /** Extra top-level keys to carry. Reserved for forward-compat round trips. */
  ext?: Record<string, unknown>;
}

/**
 * Build a valid envelope, or throw.
 *
 * Throwing is deliberate and is the one place this kernel does it: a malformed
 * *emit* is a bug in the emitting pod and should fail loudly at the source.
 * Malformed *input* is the normal case and is handled by `parse`, which never
 * throws.
 */
export function seal<T>(opts: SealOptions<T>): Envelope<T> {
  const problems = provenanceProblems(opts.provenance, opts.payload);
  if (!isCapabilityId(opts.kind)) problems.push(`invalid capability id: ${String(opts.kind)}`);
  if (!isPodId(opts.pod)) problems.push(`invalid pod id: ${String(opts.pod)}`);
  if (opts.ts !== undefined && !isStamp(opts.ts)) problems.push(`invalid ts: ${String(opts.ts)}`);
  if (problems.length) {
    throw new Error(`superstation: cannot seal ${String(opts.kind)} — ${problems.join('; ')}`);
  }
  const env: Envelope<T> = {
    kernel: KERNEL_VERSION,
    kind: opts.kind,
    id: envelopeId(),
    ts: opts.ts ?? stamp(),
    pod: opts.pod,
    provenance: opts.provenance,
    payload: opts.payload,
  };
  if (opts.ext && Object.keys(opts.ext).length) env.ext = { ...opts.ext };
  return env;
}

/**
 * Derive a new envelope from one or more inputs.
 *
 * Fidelity of the result is the weakest of the inputs and of any fidelity you
 * ask for — a pod cannot claim its output is fresher than the data it was
 * computed from. `absent` inputs collapse the whole result to `absent`, because
 * a value computed from nothing is nothing.
 */
export function derive<T>(
  from: ReadonlyArray<Pick<Envelope, 'provenance'>>,
  opts: SealOptions<T>,
): Envelope<T> {
  let f: Fidelity = opts.provenance.fidelity;
  const reasons: string[] = [];
  for (const src of from) {
    f = weakest(f, src.provenance.fidelity);
    if (rankOf(src.provenance.fidelity) < TRUST_THRESHOLD && src.provenance.reason) {
      reasons.push(src.provenance.reason);
    }
  }
  if (f === opts.provenance.fidelity) return seal(opts);

  const prov: Provenance = { ...opts.provenance, fidelity: f };
  const inherited = reasons.length ? reasons.join('; ') : `derived from ${f} input`;
  if (rankOf(f) < TRUST_THRESHOLD) {
    prov.reason = opts.provenance.reason ? `${opts.provenance.reason} (${inherited})` : inherited;
  }
  if (f === 'cached') {
    // `cached` requires both observedAt and staleMs (§4). Inherit the oldest
    // observation available; fall back to this envelope's own stamp.
    const observed = from
      .map((s) => s.provenance.observedAt)
      .filter(isStamp)
      .sort()[0] ?? prov.observedAt ?? stamp();
    prov.observedAt = observed;
    prov.staleMs = prov.staleMs ?? Math.max(0, Date.now() - Date.parse(observed));
  }
  if (f === 'absent') return seal({ ...opts, provenance: prov, payload: {} as T });
  return seal({ ...opts, provenance: prov });
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/** The §4 required-field rules, as data rather than branching. */
const REQUIRED_BY_FIDELITY: Readonly<Record<Fidelity, ReadonlyArray<keyof Provenance>>> =
  Object.freeze({
    live: ['observedAt'],
    cached: ['observedAt', 'staleMs'],
    degraded: ['reason'],
    simulated: ['reason'],
    absent: ['reason'],
  });

function provenanceProblems(p: unknown, payload?: unknown): string[] {
  const out: string[] = [];
  if (!isPlainObject(p)) return ['provenance must be an object'];
  if (!isFidelity(p.fidelity)) {
    return [`invalid fidelity: ${String(p.fidelity)}`];
  }
  if (typeof p.source !== 'string' || !p.source) out.push('provenance.source is required');
  for (const key of REQUIRED_BY_FIDELITY[p.fidelity]) {
    if (p[key] === undefined || p[key] === null || p[key] === '') {
      out.push(`fidelity "${p.fidelity}" requires provenance.${String(key)}`);
    }
  }
  if (p.observedAt !== undefined && !isStamp(p.observedAt)) {
    out.push(`invalid provenance.observedAt: ${String(p.observedAt)}`);
  }
  if (p.staleMs !== undefined && (typeof p.staleMs !== 'number' || p.staleMs < 0)) {
    out.push(`invalid provenance.staleMs: ${String(p.staleMs)}`);
  }
  if (p.fidelity === 'absent' && payload !== undefined) {
    const empty = isPlainObject(payload) && Object.keys(payload).length === 0;
    if (!empty) out.push('fidelity "absent" requires an empty payload');
  }
  return out;
}

/** Every §3–§4 rule, returned as a list. Empty means valid. */
export function validate(env: unknown): string[] {
  if (!isPlainObject(env)) return ['envelope must be an object'];
  const out: string[] = [];
  const compat = compatibility(String(env.kernel));
  if (compat === 'malformed') out.push(`invalid kernel version: ${String(env.kernel)}`);
  if (compat === 'incompatible') out.push(`incompatible kernel major: ${String(env.kernel)}`);
  if (!isCapabilityId(env.kind)) out.push(`invalid kind: ${String(env.kind)}`);
  if (!isPodId(env.pod)) out.push(`invalid pod: ${String(env.pod)}`);
  if (typeof env.id !== 'string' || !env.id) out.push('id is required');
  if (!isStamp(env.ts)) out.push(`invalid ts: ${String(env.ts)}`);
  if (!('payload' in env)) out.push('payload is required');
  out.push(...provenanceProblems(env.provenance, env.payload));
  return out;
}

/* ------------------------------------------------------------------ *
 * Forward-compatible parsing (SPEC.md §6)
 * ------------------------------------------------------------------ */

export interface ParseOk<T> {
  ok: true;
  envelope: Envelope<T>;
  /** Non-fatal observations — unknown fields moved aside, newer minor, etc. */
  warnings: string[];
}

export interface ParseErr {
  ok: false;
  errors: string[];
  warnings: string[];
}

export type ParseResult<T> = ParseOk<T> | ParseErr;

/**
 * Parse untrusted input into an envelope. Never throws.
 *
 * Unknown top-level keys and unknown provenance keys are moved into `ext`
 * rather than dropped, so `serialize(parse(x)) === x` for anything a newer
 * producer sends. That round trip is the whole of the fleet's forward-
 * compatibility story and is pinned by the conformance vectors.
 */
export function parse<T = unknown>(input: unknown): ParseResult<T> {
  const warnings: string[] = [];
  const raw: unknown = typeof input === 'string' ? safeJson(input) : input;
  if (raw === undefined) return { ok: false, errors: ['input is not valid JSON'], warnings };
  if (!isPlainObject(raw)) return { ok: false, errors: ['envelope must be an object'], warnings };

  const compat = compatibility(String(raw.kernel));
  if (compat === 'forward') {
    warnings.push(
      `envelope kernel ${String(raw.kernel)} is newer than reader ${KERNEL_VERSION}; ` +
      'unknown fields preserved',
    );
  }

  const errors = validate(raw);
  if (errors.length) return { ok: false, errors, warnings };

  const ext: Record<string, unknown> = isPlainObject(raw.ext) ? { ...raw.ext } : {};
  for (const key of Object.keys(raw)) {
    if (!KNOWN_ENVELOPE_KEYS.includes(key)) {
      ext[key] = raw[key];
      warnings.push(`unknown top-level key "${key}" preserved in ext`);
    }
  }

  const rawProv = raw.provenance as Record<string, unknown>;
  const provExt: Record<string, unknown> = isPlainObject(rawProv.ext) ? { ...rawProv.ext } : {};
  const provenance: Provenance = {
    fidelity: rawProv.fidelity as Fidelity,
    source: rawProv.source as string,
  };
  if (rawProv.observedAt !== undefined) provenance.observedAt = rawProv.observedAt as string;
  if (rawProv.staleMs !== undefined) provenance.staleMs = rawProv.staleMs as number;
  if (rawProv.reason !== undefined) provenance.reason = rawProv.reason as string;
  for (const key of Object.keys(rawProv)) {
    if (!KNOWN_PROVENANCE_KEYS.includes(key)) {
      provExt[key] = rawProv[key];
      warnings.push(`unknown provenance key "${key}" preserved in provenance.ext`);
    }
  }
  if (Object.keys(provExt).length) provenance.ext = provExt;

  const envelope: Envelope<T> = {
    kernel: raw.kernel as string,
    kind: raw.kind as CapabilityId,
    id: raw.id as string,
    ts: raw.ts as string,
    pod: raw.pod as PodId,
    provenance,
    payload: raw.payload as T,
  };
  if (Object.keys(ext).length) envelope.ext = ext;
  return { ok: true, envelope, warnings };
}

/**
 * Inverse of `parse`: lift `ext` back to the top level so a v1.0 reader hands a
 * v1.4 consumer exactly what the v1.4 producer sent.
 */
export function serialize(env: Envelope): Record<string, unknown> {
  const { ext, provenance, ...rest } = env;
  const prov: Record<string, unknown> = { ...provenance };
  const provExt = prov.ext as Record<string, unknown> | undefined;
  delete prov.ext;
  const out: Record<string, unknown> = { ...rest, provenance: { ...prov, ...(provExt ?? {}) } };
  return { ...out, ...(ext ?? {}) };
}

export const toJSON = (env: Envelope): string => JSON.stringify(serialize(env));

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
