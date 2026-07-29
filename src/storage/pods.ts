/**
 * Storage pods — more room than one browser bucket allows.
 *
 * ONE CONSTRAINT UP FRONT, because the design depends on it: you cannot get a
 * second 5 MB of localStorage. The quota is per-origin, not per-key-prefix, so
 * "another localStorage pod" would share the same 5 MB and buy nothing.
 *
 * IndexedDB on the same origin is a genuinely separate, far larger bucket —
 * typically hundreds of MB to several GB. So Pod 2 is IndexedDB-backed, which
 * is not a workaround; it is the only real answer, and it gives far more than
 * the 5 MB asked for.
 *
 *   Pod 1 (localStorage) — small, SYNCHRONOUS. Some code must read during
 *     render, and only localStorage can answer without awaiting. That property
 *     is the reason to keep it, not its size.
 *   Pod 2 (IndexedDB)    — large, ASYNCHRONOUS. Everything that can await
 *     belongs here, and anything big belongs here regardless.
 *
 * Pod 2 knows it is Pod 2: it carries its own identity and a record of what it
 * overflowed from, so a bundle exported from one device can be understood on
 * another without guessing which half it is.
 */

import { SovereignPipeline, RoundTripError } from '../../lib/engine';
import { jsonStage, compressStage } from '../../lib/engine/stages';

export type PodId = 'pod-1-local' | 'pod-2-indexed';

export interface PodIdentity {
  id: PodId;
  /** Human name, shown in the workstation. */
  name: string;
  /** Position in the chain — Pod 2 knows it is the second. */
  ordinal: number;
  /** Which pod this one overflows from; undefined for the first. */
  overflowsFrom?: PodId;
  backing: 'localStorage' | 'indexedDB';
  /** Rough ceiling, for reporting. IndexedDB's real limit is negotiated with
   *  the browser and varies by device, so this is a floor we can rely on. */
  approxCapacityBytes: number;
  synchronous: boolean;
}

export const POD_1: PodIdentity = {
  id: 'pod-1-local',
  name: 'Pod 1 — fast local',
  ordinal: 1,
  backing: 'localStorage',
  approxCapacityBytes: 5 * 1024 * 1024,
  synchronous: true,
};

export const POD_2: PodIdentity = {
  id: 'pod-2-indexed',
  name: 'Pod 2 — deep store',
  ordinal: 2,
  overflowsFrom: 'pod-1-local',
  backing: 'indexedDB',
  // Deliberately conservative: browsers grant far more, but promising a
  // number we cannot guarantee would be worse than under-promising.
  approxCapacityBytes: 50 * 1024 * 1024,
  synchronous: false,
};

export const PODS: PodIdentity[] = [POD_1, POD_2];

/** A stored record, carrying which pod holds it and whether it is compressed. */
export interface PodRecord {
  id: string;
  pod: PodId;
  /** Base64 of the compressed bytes when compressed, else the raw JSON string. */
  payload: string;
  compressed: boolean;
  /** Bytes before compression — so the workstation can show what was saved. */
  originalBytes: number;
  storedBytes: number;
  updatedAt: number;
}

/** What a pod must be able to do. Both backings satisfy this. */
export interface PodBackend {
  identity: PodIdentity;
  read(key: string): Promise<PodRecord | null>;
  write(record: PodRecord): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  usedBytes(): Promise<number>;
}

/**
 * Lossless codec for pod payloads.
 *
 * Uses the Sovereign pipeline, which verifies its own round trip: `decode`
 * re-encodes what it decoded and compares hashes, throwing RoundTripError if
 * they differ. That is what makes "100% retention" a checked property rather
 * than a claim — a corrupted or truncated payload fails loudly instead of
 * returning subtly wrong data, which is the failure that would be impossible
 * to notice later.
 */
const codec = new SovereignPipeline([jsonStage, compressStage]);

/** Base64 for the compressed bytes, since IndexedDB records stay JSON-safe. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export interface EncodedPayload {
  payload: string;
  bytes: number;
  /** Hash of the ORIGINAL value, taken before compression. decode() verifies
   *  against this, which is what turns retention into a checked property. */
  observerHash: string;
  stages: string[];
  sealedAt: number;
}

export async function encodePayload(value: unknown): Promise<EncodedPayload> {
  const sealed = await codec.encode(value);
  const payload = toBase64(sealed.payload);
  return {
    payload,
    bytes: payload.length,
    observerHash: sealed.observerHash,
    stages: sealed.stages,
    sealedAt: sealed.sealedAt,
  };
}

/** Throws RoundTripError if what comes back is not byte-identical in meaning
 *  to what went in. Failing loudly beats returning subtly wrong data. */
export async function decodePayload<T>(encoded: EncodedPayload): Promise<T> {
  return await codec.decode<T>({
    payload: fromBase64(encoded.payload),
    observerHash: encoded.observerHash,
    stages: encoded.stages,
    sealedAt: encoded.sealedAt,
  });
}

export { RoundTripError };

/**
 * Decide which pod a value belongs in.
 *
 * Small and needed synchronously stays in Pod 1; everything else goes to Pod 2.
 * Size alone is not the rule, because a tiny value read during render still
 * cannot await — that is why `needsSync` exists rather than a byte threshold
 * doing all the work.
 */
export const POD_1_MAX_VALUE_BYTES = 64 * 1024;

export interface RouteDecision {
  pod: PodId;
  reason: string;
  compress: boolean;
}

export function routeToPod(
  bytes: number,
  opts: { needsSync?: boolean } = {}
): RouteDecision {
  if (opts.needsSync) {
    return {
      pod: 'pod-1-local',
      // Stated as a capability, not a preference: Pod 2 cannot answer without
      // awaiting, so a synchronous reader has no alternative.
      reason: 'read synchronously during render; only Pod 1 can answer without awaiting',
      compress: false,
    };
  }
  if (bytes <= POD_1_MAX_VALUE_BYTES) {
    return {
      pod: 'pod-1-local',
      reason: `small (${bytes} B) and fits the fast pod`,
      compress: false,
    };
  }
  return {
    pod: 'pod-2-indexed',
    reason: `large (${bytes} B) — held in the deep pod, compressed losslessly`,
    compress: true,
  };
}
