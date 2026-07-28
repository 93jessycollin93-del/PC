/**
 * appCode — a short code that addresses any part of the PC.
 *
 * One string names an app, a section inside it, and the state to open with,
 * so a place in the OS can be copied, shared, bookmarked, or handed to
 * another device and land exactly where it came from.
 *
 *   qpdb                      the app
 *   qpdb/parse                a section inside it
 *   qpdb/parse~s:eyJ...       a section plus state
 *
 * THREE ENCODINGS, SMALLEST WINS. A code is read constantly and written
 * once, so the encoder tries each strategy and keeps the shortest result.
 * The point is that simple codes stay legible: addressing an app should not
 * produce a wall of base64 just because the machinery could.
 *
 *   plain  no state at all, so the code is literally `app/section`
 *   packed base64url of the JSON, for small state
 *   deflated  compressed then base64url, once compression actually wins
 *
 * The prefix on the state segment records which was used, so decoding never
 * has to guess: `s:` packed, `z:` deflated, absent means plain.
 */
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export interface CodeTarget {
  /** The app to open, e.g. "qpdb". Required — a code with no app addresses nothing. */
  app: string;
  /** Optional area within the app, e.g. "parse". */
  section?: string;
  /** Optional state the app should restore. Must be JSON-representable. */
  state?: unknown;
}

export interface DecodeResult {
  ok: boolean;
  target?: CodeTarget;
  /** Which encoding the code used, useful for diagnostics and tests. */
  encoding?: CodeEncoding;
  error?: string;
}

export type CodeEncoding = 'plain' | 'packed' | 'deflated';

/** Separates the address from its state. Chosen because it survives URLs,
 *  shells, and chat apps without escaping. */
const STATE_SEP = '~';

/** Codes travel through URLs and QR codes, so the alphabet must be
 *  URL-safe: base64url, and without padding, which only adds length. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** App and section ids live in the address, so they must not contain the
 *  separators that structure a code. */
function isCleanSegment(value: string): boolean {
  return value.length > 0 && !/[\/~\s]/.test(value);
}

/**
 * Build the shortest valid code for a target.
 * Throws only on an unaddressable target, which is a programming error
 * rather than something a user can cause.
 */
export function encodeCode(target: CodeTarget): string {
  if (!target?.app || !isCleanSegment(target.app)) {
    throw new Error(`appCode: invalid app id "${target?.app}"`);
  }
  if (target.section !== undefined && !isCleanSegment(target.section)) {
    throw new Error(`appCode: invalid section id "${target.section}"`);
  }

  const address = target.section ? `${target.app}/${target.section}` : target.app;

  // No state means no encoding at all, which keeps the common case readable.
  if (target.state === undefined || target.state === null) return address;

  const json = JSON.stringify(target.state);
  const bytes = strToU8(json);
  const packed = `s:${toBase64Url(bytes)}`;
  const deflated = `z:${toBase64Url(deflateSync(bytes))}`;

  // Compression loses on short payloads, where its header outweighs the
  // savings, so the shorter of the two always wins.
  const smallest = deflated.length < packed.length ? deflated : packed;
  return `${address}${STATE_SEP}${smallest}`;
}

/**
 * Resolve a code back to its target.
 * Returns a result rather than throwing: codes arrive from URLs, pasted
 * text, and QR scans, so malformed input is expected traffic, not an
 * exceptional case.
 */
export function decodeCode(code: string): DecodeResult {
  if (typeof code !== 'string') return { ok: false, error: 'Code must be text.' };

  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: 'Code is empty.' };

  const sepIndex = trimmed.indexOf(STATE_SEP);
  const address = sepIndex === -1 ? trimmed : trimmed.slice(0, sepIndex);
  const statePart = sepIndex === -1 ? '' : trimmed.slice(sepIndex + 1);

  const [app, section, ...rest] = address.split('/');
  if (!app) return { ok: false, error: 'Code does not name an app.' };
  if (rest.length) return { ok: false, error: 'Code has more than one section.' };

  if (!statePart) {
    return { ok: true, encoding: 'plain', target: section ? { app, section } : { app } };
  }

  const marker = statePart.slice(0, 2);
  const payload = statePart.slice(2);
  if (marker !== 's:' && marker !== 'z:') {
    return { ok: false, error: 'Code state has an unknown encoding.' };
  }
  if (!payload) return { ok: false, error: 'Code state is empty.' };

  try {
    const raw = fromBase64Url(payload);
    const bytes = marker === 'z:' ? inflateSync(raw) : raw;
    const state = JSON.parse(strFromU8(bytes));
    return {
      ok: true,
      encoding: marker === 'z:' ? 'deflated' : 'packed',
      target: section ? { app, section, state } : { app, state },
    };
  } catch {
    // Truncated paste, wrong alphabet, corrupt compression: all the same
    // to the person holding the code.
    return { ok: false, error: 'Code state could not be read; it may be incomplete.' };
  }
}

/** How much a code saved versus the raw JSON, for display and tests. */
export function codeStats(target: CodeTarget): {
  code: string;
  encoding: CodeEncoding;
  rawLength: number;
  codeLength: number;
  ratio: number;
} {
  const code = encodeCode(target);
  const decoded = decodeCode(code);
  const rawLength = target.state === undefined || target.state === null
    ? 0
    : JSON.stringify(target.state).length;
  return {
    code,
    encoding: decoded.encoding || 'plain',
    rawLength,
    codeLength: code.length,
    ratio: rawLength ? code.length / rawLength : 1,
  };
}
