/**
 * deviceKey — a persistent ECDSA P-256 keypair this PC signs provenance
 * records with. Generated once (Web Crypto, no dependency) and kept in
 * storage so records signed across sessions all verify against the same
 * public key.
 *
 * SCOPE, STATED PLAINLY: a private key sitting in browser storage is not a
 * hardware-backed secret, so this proves "this exact record was signed by
 * the key that made this claim, and its content has not changed since" —
 * tamper-evidence and self-consistency. It does NOT prove which human or
 * organization holds that key (real non-repudiation needs a secure enclave
 * or a certificate authority binding the key to an identity, neither of
 * which a browser app can manufacture on its own). See provenance.ts for
 * where that proof is actually checked.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DeviceKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
}

export interface DeviceKeyOptions {
  subtle?: SubtleCrypto;
  storage?: StorageLike | null;
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'pc_provenance_device_key_v1';
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;

function resolveDefaultStorage(): StorageLike | null {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    return candidate || null;
  } catch {
    return null;
  }
}

function resolveSubtle(injected?: SubtleCrypto): SubtleCrypto {
  const subtle = injected ?? (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) {
    throw new Error('deviceKey: no Web Crypto subtle implementation available (and none was injected)');
  }
  return subtle;
}

async function generateAndPersist(
  subtle: SubtleCrypto,
  storage: StorageLike | null,
  storageKey: string,
): Promise<DeviceKeyPair> {
  const keyPair = await subtle.generateKey(ALGO, true, ['sign', 'verify']);
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);
  try {
    storage?.setItem(storageKey, JSON.stringify({ publicKeyJwk, privateKeyJwk }));
  } catch {
    // Storage pressure must not block signing; the key just won't survive
    // a reload, so the next export mints (and tries to persist) a new one.
  }
  return { publicKeyJwk, privateKey: keyPair.privateKey };
}

/** Load the persisted device key, or mint and persist a fresh one. */
export async function getOrCreateDeviceKey(options: DeviceKeyOptions = {}): Promise<DeviceKeyPair> {
  const subtle = resolveSubtle(options.subtle);
  const storage = options.storage === undefined ? resolveDefaultStorage() : options.storage;
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;

  if (storage) {
    const raw = storage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const privateKey = await subtle.importKey('jwk', parsed.privateKeyJwk, ALGO, true, ['sign']);
        return { publicKeyJwk: parsed.publicKeyJwk, privateKey };
      } catch {
        // Corrupt or unimportable stored key: fall through and mint a new
        // one rather than leaving every future export permanently broken.
      }
    }
  }
  return generateAndPersist(subtle, storage, storageKey);
}
