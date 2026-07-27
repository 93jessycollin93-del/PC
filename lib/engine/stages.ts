// Standard stages for the Sovereign Engine. Each stage is a true involution
// pair: inverse(forward(x)) must equal x for every input it accepts.

import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type { Stage } from './pipeline';

/** Value <-> UTF-8 JSON bytes. Note the JSON contract: undefined, functions,
 *  symbols, and negative zero are not representable and must not appear in
 *  vault payloads. */
export const jsonStage: Stage<unknown, Uint8Array> = {
  name: 'json',
  forward: (value) => strToU8(JSON.stringify(value)),
  inverse: (bytes) => JSON.parse(strFromU8(bytes)),
};

/** DEFLATE compression (fflate, same library the vault backups already use). */
export const compressStage: Stage<Uint8Array, Uint8Array> = {
  name: 'deflate',
  forward: (bytes) => deflateSync(bytes),
  inverse: (bytes) => inflateSync(bytes),
};

/** AES-GCM encryption. The key comes from a provider seam so the browser app
 *  can plug in PodCustodian (the encryption authority) without this stage
 *  knowing anything about key custody. IV is prepended to the ciphertext. */
export function encryptStage(getKey: () => Promise<CryptoKey>): Stage<Uint8Array, Uint8Array> {
  return {
    name: 'aes-gcm',
    forward: async (plain) => {
      const key = await getKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain as BufferSource),
      );
      const out = new Uint8Array(iv.length + cipher.length);
      out.set(iv);
      out.set(cipher, iv.length);
      return out;
    },
    inverse: async (sealed) => {
      const key = await getKey();
      const iv = sealed.slice(0, 12);
      const cipher = sealed.slice(12);
      return new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher as BufferSource),
      );
    },
  };
}
