/**
 * SAS Superstation kernel — public surface.
 *
 * ```ts
 * import { Station, live, simulated } from './superstation/kernel/ts';
 * import manifest from '../station.pod.json';
 *
 * const station = new Station({ manifest });
 * station.publish('sas.telemetry.thermal', { gpuC: 61 }, live('jacky:/api/metrics'));
 * ```
 *
 * Contract: `superstation/SPEC.md`. Cross-language agreement with the Python
 * kernel is pinned by `superstation/conformance/`.
 */

export {
  KERNEL_VERSION,
  FIDELITIES,
  FIDELITY_RANK,
  TRUST_THRESHOLD,
  CAPABILITY_ID_RE,
  POD_ID_RE,
  compatibility,
  idMatchesPrefix,
  isCapabilityId,
  isFidelity,
  isPodId,
  parseSemVer,
  rankOf,
  satisfiesRange,
  weakest,
} from './contract.ts';

export type {
  CapabilityDescriptor,
  CapabilityId,
  CapabilityRequirement,
  Compatibility,
  Envelope,
  Fidelity,
  PodId,
  PodIdentity,
  PodManifest,
  PodRole,
  Provenance,
  SemVer,
} from './contract.ts';

export {
  absent,
  badge,
  cached,
  degraded,
  derive,
  envelopeId,
  isStamp,
  live,
  parse,
  seal,
  serialize,
  simulated,
  stamp,
  toJSON,
  trustworthy,
  validate,
} from './envelope.ts';

export type { ParseErr, ParseOk, ParseResult, SealOptions } from './envelope.ts';

export { Bus } from './bus.ts';
export type { BusOptions, Listener, Unsubscribe } from './bus.ts';

export { Registry } from './registry.ts';
export type { Registration, Resolution, ResolutionStatus } from './registry.ts';

export { Station, readerCompatibility } from './station.ts';
export type { StationOptions } from './station.ts';
