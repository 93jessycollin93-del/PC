/**
 * provenance — a signed, verifiable-offline record of what produced an
 * artifact (app, model, inputs, when), attached to exports the same way a
 * receipt travels with a package.
 *
 * What verification actually proves: the record's signature matches its
 * own embedded public key, and its content hash matches the artifact bytes
 * — i.e. "this exact record was not altered after signing, and this exact
 * artifact is the one it describes." It does NOT prove the identity behind
 * the key (see src/provenance/deviceKey.ts for why that is out of scope for
 * a browser app). A verifier should read the result as chain-of-custody
 * evidence, not a notarized identity claim — the UI copy that surfaces this
 * must say so rather than imply more than the crypto backs.
 *
 * Deliberately NOT a lineage store: `parentRecordId` lets one record point
 * at the record it was derived from, but nothing here persists a queryable
 * graph of records — that is future work, not silently pretended to exist.
 */
import { getOrCreateDeviceKey, type DeviceKeyPair, type DeviceKeyOptions } from './deviceKey';

export interface ProducedBy {
  /** Which PC surface made this, e.g. "desktop-export". */
  app: string;
  /** Model that generated the content, if any (absent for user-authored artifacts). */
  model?: string;
  timestamp: number;
}

export interface ProvenanceRecord {
  v: 1;
  id: string;
  /** SHA-256 of the exact artifact bytes this record describes. */
  contentHash: string;
  /** SHA-256 hashes of whatever fed into producing the artifact (a prompt, a source file) — empty if none apply. */
  inputHashes: string[];
  producedBy: ProducedBy;
  parentRecordId: string | null;
  publicKeyJwk: JsonWebKey;
  /** Base64 ECDSA signature over the record above (everything but this field). */
  signature: string;
}

export interface SignOptions {
  app: string;
  model?: string;
  inputHashes?: string[];
  parentRecordId?: string | null;
  now?: () => number;
  sha256?: (text: string) => Promise<string>;
  subtle?: SubtleCrypto;
  deviceKey?: DeviceKeyPair;
  deviceKeyOptions?: DeviceKeyOptions;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

async function defaultSha256(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('provenance: no SHA-256 implementation available (Web Crypto missing)');
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function resolveSubtle(injected?: SubtleCrypto): SubtleCrypto {
  const subtle = injected ?? (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('provenance: no Web Crypto subtle implementation available');
  return subtle;
}

function newId(): string {
  return `prov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

/** The fields that get signed — everything in a record except the signature itself. */
function signablePayload(record: Omit<ProvenanceRecord, 'signature'>): string {
  return canonical(record);
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}
function base64ToBuf(b64: string): ArrayBuffer {
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Sign an artifact's content, producing a record that can be attached to
 *  its export and verified later by anyone holding just the record. */
export async function signArtifact(content: string, opts: SignOptions): Promise<ProvenanceRecord> {
  const sha256 = opts.sha256 || defaultSha256;
  const subtle = resolveSubtle(opts.subtle);
  const contentHash = await sha256(content);
  const { privateKey, publicKeyJwk } = opts.deviceKey || await getOrCreateDeviceKey({ subtle, ...opts.deviceKeyOptions });

  const unsigned: Omit<ProvenanceRecord, 'signature'> = {
    v: 1,
    id: newId(),
    contentHash,
    inputHashes: opts.inputHashes || [],
    producedBy: { app: opts.app, model: opts.model, timestamp: (opts.now || Date.now)() },
    parentRecordId: opts.parentRecordId ?? null,
    publicKeyJwk,
  };

  const payload = new TextEncoder().encode(signablePayload(unsigned));
  const sigBuffer = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, payload);
  return { ...unsigned, signature: bufToBase64(sigBuffer) };
}

/**
 * Verify a record: its signature matches its own embedded public key, and
 * (if content is supplied) the content hash matches the exact artifact
 * bytes. Both checks are independent — a record can be internally
 * consistent (well-signed) while describing content that was swapped out
 * from under it, which is exactly what the content-hash check catches.
 */
export async function verifyArtifact(
  record: ProvenanceRecord,
  content?: string,
  opts: { sha256?: (text: string) => Promise<string>; subtle?: SubtleCrypto } = {},
): Promise<VerifyResult> {
  if (!record || record.v !== 1) return { ok: false, reason: 'Not a recognized provenance record.' };

  if (content !== undefined) {
    const sha256 = opts.sha256 || defaultSha256;
    const recomputed = await sha256(content);
    if (recomputed !== record.contentHash) {
      return { ok: false, reason: 'Content hash does not match — this content is not what the record describes.' };
    }
  }

  const subtle = resolveSubtle(opts.subtle);
  let publicKey: CryptoKey;
  try {
    publicKey = await subtle.importKey('jwk', record.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  } catch {
    return { ok: false, reason: 'The embedded public key is not a valid P-256 key.' };
  }

  const { signature, ...unsigned } = record;
  const payload = new TextEncoder().encode(signablePayload(unsigned));
  let sigBuffer: ArrayBuffer;
  try {
    sigBuffer = base64ToBuf(signature);
  } catch {
    return { ok: false, reason: 'The signature is not valid base64.' };
  }

  const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBuffer, payload);
  if (!valid) return { ok: false, reason: 'Signature does not match this record\'s content — it was altered after signing, or the key does not match.' };
  return { ok: true };
}
