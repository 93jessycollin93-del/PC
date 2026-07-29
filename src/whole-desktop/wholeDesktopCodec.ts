/**
 * wholeDesktopCodec — wraps the Sovereign Engine (lib/engine, previously
 * built and fully tested but never actually wired into the app anywhere)
 * around a WholeDesktopSnapshot, and handles turning its Uint8Array payload
 * into something a JSON file can carry.
 *
 * The round-trip proof is not something this module adds — it is what
 * SovereignPipeline.decode already does: recompute the observer hash after
 * decoding and throw RoundTripError on any mismatch. This module's whole
 * job is picking the stages (json + deflate; no encryption yet — see
 * ENCRYPTED below) and the file envelope around them.
 */
import { SovereignPipeline, jsonStage, compressStage, type SealedArtifact } from '../../lib/engine';
import type { WholeDesktopSnapshot } from './wholeDesktopSnapshot';

export const WHOLE_DESKTOP_FORMAT = 'pc-whole-desktop';
export const WHOLE_DESKTOP_VERSION = 1;

/** Not encrypted in v1: there is no key-management UI for a user password
 *  yet, and shipping AES-GCM without one would mean the "key" is really
 *  just whatever this module hardcoded — false security is worse than
 *  none. Plaintext-but-compressed matches the existing per-item export's
 *  threat model exactly (src/desktop/desktopOps.ts's serializeForExport is
 *  also plain JSON); encryption is real follow-up work, not a gap this
 *  file pretends doesn't exist. */
const pipeline = new SovereignPipeline([jsonStage, compressStage]);

export interface WholeDesktopFile {
  format: typeof WHOLE_DESKTOP_FORMAT;
  version: number;
  payloadBase64: string;
  observerHash: string;
  stages: string[];
  sealedAt: number;
}

function bufToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Seal a snapshot into the file format that gets written to disk. */
export async function sealWholeDesktop(snapshot: WholeDesktopSnapshot): Promise<WholeDesktopFile> {
  const artifact = await pipeline.encode(snapshot);
  return {
    format: WHOLE_DESKTOP_FORMAT,
    version: WHOLE_DESKTOP_VERSION,
    payloadBase64: bufToBase64(artifact.payload),
    observerHash: artifact.observerHash,
    stages: artifact.stages,
    sealedAt: artifact.sealedAt,
  };
}

export interface UnsealResult {
  ok: boolean;
  snapshot?: WholeDesktopSnapshot;
  error?: string;
}

/**
 * Unseal a file back into a snapshot. Always returns a result rather than
 * throwing past the caller — this is fed by a user-chosen file, so "that
 * isn't a valid export" or "this was corrupted" are expected outcomes.
 * A RoundTripError here means real proof of tampering or corruption, not a
 * guess — the whole point of idea #06's "one hash, verified on the way
 * back in."
 */
export async function unsealWholeDesktop(file: unknown): Promise<UnsealResult> {
  const f = file as Partial<WholeDesktopFile>;
  if (!f || f.format !== WHOLE_DESKTOP_FORMAT) {
    return { ok: false, error: 'That file is not a PC whole-desktop export.' };
  }
  if (typeof f.version !== 'number' || f.version > WHOLE_DESKTOP_VERSION) {
    return { ok: false, error: `That export is version ${f.version}, newer than this PC understands (${WHOLE_DESKTOP_VERSION}).` };
  }
  if (typeof f.payloadBase64 !== 'string' || typeof f.observerHash !== 'string' || !Array.isArray(f.stages)) {
    return { ok: false, error: 'That export is missing its sealed data.' };
  }

  let artifact: SealedArtifact;
  try {
    artifact = {
      payload: base64ToBuf(f.payloadBase64),
      observerHash: f.observerHash,
      stages: f.stages,
      sealedAt: f.sealedAt ?? 0,
    };
  } catch {
    return { ok: false, error: 'That export\'s payload is not valid base64.' };
  }

  try {
    const snapshot = await pipeline.decode<WholeDesktopSnapshot>(artifact);
    return { ok: true, snapshot };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'That export failed its round-trip verification — it was corrupted or tampered with.' };
  }
}
