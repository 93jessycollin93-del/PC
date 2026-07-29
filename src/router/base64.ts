import { RouterArtifactError } from './types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  LOOKUP[ALPHABET[i]] = i;
}

/**
 * Pure base64 decoder so nano weights load identically in every JS
 * environment (Hermes, jest, node) without atob or Buffer.
 */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[=]+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) {
    throw new RouterArtifactError('Artifact weights are not valid base64.');
  }
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = LOOKUP[clean[i]];
    const c1 = LOOKUP[clean[i + 1]];
    const c2 = clean[i + 2] !== undefined ? LOOKUP[clean[i + 2]] : -1;
    const c3 = clean[i + 3] !== undefined ? LOOKUP[clean[i + 3]] : -1;
    if (c1 === undefined) {
      throw new RouterArtifactError('Artifact weights are truncated base64.');
    }
    // eslint-disable-next-line no-bitwise
    out[outIndex++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) {
      // eslint-disable-next-line no-bitwise
      out[outIndex++] = ((c1 & 15) << 4) | (c2 >> 2);
    }
    if (c3 >= 0) {
      // eslint-disable-next-line no-bitwise
      out[outIndex++] = ((c2 & 3) << 6) | c3;
    }
  }
  return out;
}
