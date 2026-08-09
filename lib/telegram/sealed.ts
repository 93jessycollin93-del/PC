/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SEALED MESSAGES — end-to-end encryption layered over Telegram
 * ============================================================
 * Telegram cloud chats are NOT end-to-end encrypted. They are encrypted in
 * transit and at rest on Telegram's servers, which means Telegram can read
 * them. End-to-end exists only in Secret Chats, which are single-device,
 * mobile-only, and unavailable to every web client including this one.
 *
 * This closes that gap without asking Telegram for anything. A sealed message
 * is an ordinary Telegram text message whose body is ciphertext. Telegram
 * transports it, stores it, syncs it across your devices — and cannot read it.
 * Anyone without this app sees a marker and base64. Anyone with it, holding
 * the right private key, sees the message.
 *
 * DESIGN
 * ------
 * Identity      ECDH P-256, generated once per install. P-256 rather than
 *               X25519 because WebCrypto support for X25519 is still uneven,
 *               and a cipher nobody can run is not security.
 *
 * Per message   TWO Diffie-Hellman operations, mixed:
 *
 *                 DH1 = ECDH(fresh ephemeral private, recipient static public)
 *                 DH2 = ECDH(sender static private,   recipient static public)
 *                 key = HKDF(DH1 || DH2, fresh salt, bound context)
 *
 *               DH1 supplies forward secrecy — the ephemeral private key is
 *               discarded immediately, so compromising the sender later
 *               reveals nothing about messages already sent.
 *
 *               DH2 supplies AUTHENTICATION, and it is not optional. An
 *               earlier version derived from DH1 alone. Public keys are
 *               public — they are posted into the chat as handshakes — so
 *               anyone holding Alice's and Bob's public keys could mint a
 *               ciphertext, and Bob would render it as an authentic
 *               end-to-end message from Alice. Telegram itself could have
 *               injected one. Mixing the sender's static key means a valid
 *               ciphertext is proof of possession of Alice's private key.
 *               `attack.test.ts` fails against the old construction.
 *
 * KDF           HKDF-SHA256 over the ECDH output, with a fresh 32-byte salt
 *               per message and an `info` that binds both parties'
 *               fingerprints. Two different conversations never derive the
 *               same key even from the same ECDH pair.
 *
 * AEAD          AES-256-GCM. The additional data commits to the wire version
 *               and both fingerprints, so a ciphertext cannot be replayed
 *               into a different conversation and still authenticate.
 *
 * HONEST LIMITS — read before trusting this with anything that matters
 * -------------------------------------------------------------------
 *  - NOT a double ratchet. Compromising the RECIPIENT's long-term private key
 *    decrypts every past message they received. Signal's ratchet fixes that;
 *    this does not. Sender-side forward secrecy is genuine; receiver-side is
 *    not claimed.
 *  - Replay and freshness are enforced by `openChecked`, not by `open`. Each
 *    message carries a timestamp and a random id inside the authenticated
 *    plaintext; `openChecked` rejects duplicates and anything outside the
 *    freshness window. Call it rather than `open` on anything that arrives
 *    from the network.
 *  - Metadata is Telegram's, unchanged. Who you talk to, when, how often, and
 *    how long the messages are all remain visible. This encrypts content only.
 *  - Key exchange is only as good as the verification. An attacker who can
 *    substitute a public key in transit reads everything — which is exactly
 *    what the safety number exists to catch. Compare it out of band, over a
 *    channel the attacker does not control. Unverified means unverified.
 *  - The private key is non-extractable, so it cannot be copied out of this
 *    browser. That also means it cannot be backed up: losing the profile
 *    loses the ability to read past sealed messages.
 */

const WIRE_PREFIX = '\u{1F510}PCE2E1:';
const HKDF_INFO_PREFIX = 'pc-telegram-sealed/v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ------------------------------------------------------------------ base64 */

function toB64(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
}

function fromB64(b64: string): Uint8Array {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

/* -------------------------------------------------------------------- keys */

export interface Identity {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
}

/**
 * A new identity. The private key is created NON-EXTRACTABLE: WebCrypto will
 * use it for ECDH and will never hand the bytes back, to us or to anything
 * else running in this realm. Even a full script-injection cannot copy it out
 * — it can only ask this page to use it while the page is open.
 */
export async function generateIdentity(): Promise<Identity> {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
        'deriveBits',
    ])) as CryptoKeyPair;
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

/** Raw uncompressed point, base64 — what gets published to a peer. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
    return toB64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        fromB64(b64) as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
    );
}

/**
 * A short, stable fingerprint of a public key. Used to bind ciphertexts to a
 * conversation and to build the human-comparable safety number.
 */
export async function fingerprint(publicKeyB64: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', fromB64(publicKeyB64) as BufferSource);
    return toB64(new Uint8Array(digest).slice(0, 16));
}

/**
 * The number both people read aloud to confirm nobody swapped a key in the
 * middle. Sorting the two keys makes it identical on both sides, and reading
 * it over a channel the attacker does not control is the ONLY thing that turns
 * this from "encrypted" into "encrypted to the person I think".
 *
 * Sixty digits in twelve groups of five, the same shape Signal uses, because
 * people actually compare that format.
 */
export async function safetyNumber(ourPublicB64: string, theirPublicB64: string): Promise<string> {
    const [a, b] = [ourPublicB64, theirPublicB64].sort();
    // SHA-512 so twelve groups can each take THREE distinct bytes. An earlier
    // version took two bytes per group, capping every group at 65535 — the
    // leading digit could never exceed 6 — and indexed with `i * 2 % len`,
    // which wrapped and repeated groups outright. Both are asserted against
    // in attack.test.ts.
    const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-512', enc.encode(`${HKDF_INFO_PREFIX}|${a}|${b}`)),
    );
    const groups: string[] = [];
    for (let i = 0; i < 12; i += 1) {
        const o = i * 3;
        const chunk = ((digest[o] << 16) | (digest[o + 1] << 8) | digest[o + 2]) % 100000;
        groups.push(String(chunk).padStart(5, '0'));
    }
    return groups.join(' ');
}

/* ------------------------------------------------------------------ crypto */

async function deriveMessageKey(
    ephemeralOrOurPrivate: CryptoKey,
    peerEphemeralOrStatic: CryptoKey,
    staticPrivate: CryptoKey,
    staticPeerPublic: CryptoKey,
    salt: Uint8Array,
    info: string,
): Promise<CryptoKey> {
    // DH1: ephemeral <-> recipient static. Supplies forward secrecy.
    const dh1 = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'ECDH', public: peerEphemeralOrStatic }, ephemeralOrOurPrivate, 256),
    );
    // DH2: sender static <-> recipient static. Supplies AUTHENTICATION — only
    // a holder of the sender's private key can produce it, which is what makes
    // a valid ciphertext proof of authorship rather than proof of knowing a
    // public key. Removing this reintroduces full message forgery.
    const dh2 = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'ECDH', public: staticPeerPublic }, staticPrivate, 256),
    );

    const ikm = new Uint8Array(dh1.length + dh2.length);
    ikm.set(dh1, 0);
    ikm.set(dh2, dh1.length);

    const material = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: enc.encode(info) },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/* --------------------------------------------------------------- envelope */

const ENVELOPE_HEADER = 8 + 16; // timestamp (BE ms) + random message id

/** Freshness window. Anything older, or more than a little ahead, is refused. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SKEW_MS = 5 * 60 * 1000;

function packEnvelope(text: string): Uint8Array {
    const body = enc.encode(text);
    const out = new Uint8Array(ENVELOPE_HEADER + body.length);
    const view = new DataView(out.buffer);
    view.setBigUint64(0, BigInt(Date.now()), false);
    out.set(crypto.getRandomValues(new Uint8Array(16)), 8);
    out.set(body, ENVELOPE_HEADER);
    return out;
}

function unpackEnvelope(buf: Uint8Array): { timestamp: number; id: string; text: string } {
    if (buf.length < ENVELOPE_HEADER) throw new Error('Could not decrypt. Wrong key, or the message was altered.');
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return {
        timestamp: Number(view.getBigUint64(0, false)),
        id: toB64(buf.slice(8, ENVELOPE_HEADER)),
        text: dec.decode(buf.slice(ENVELOPE_HEADER)),
    };
}

/**
 * Bind the ciphertext to this exact pairing and wire version. A message sealed
 * for one conversation will not authenticate if replayed into another.
 * Fingerprints are sorted so both sides compute the same value.
 */
function contextFor(fpA: string, fpB: string): string {
    const [x, y] = [fpA, fpB].sort();
    return `${HKDF_INFO_PREFIX}|${x}|${y}`;
}

export interface SealResult {
    /** The full wire string to send as an ordinary Telegram message. */
    wire: string;
}

/** Everything a decrypted message carries beyond its text. */
export interface OpenedMessage {
    text: string;
    /** Sender's clock at seal time, in epoch ms. */
    timestamp: number;
    /** Random per-message id, used to detect replays. */
    id: string;
}

/** Uniform failure. Never say WHICH part of an attacker's attempt was wrong. */
const OPAQUE = 'Could not decrypt. Wrong key, or the message was altered.';

/**
 * Encrypt `plaintext` to `peerPublicB64`, authenticated as the holder of
 * `ourPrivateKey`. A fresh ephemeral keypair is used and then dropped.
 */
/**
 * Telegram's own limit is 4096 characters and base64 costs ~33%, so anything
 * past this cannot be delivered. Failing at the composer beats failing after
 * the user believes the message was sent.
 */
export const MAX_PLAINTEXT_BYTES = 2600;

export async function seal(
    plaintext: string,
    ourPublicB64: string,
    peerPublicB64: string,
    ourPrivateKey: CryptoKey,
): Promise<SealResult> {
    if (enc.encode(plaintext).length > MAX_PLAINTEXT_BYTES) {
        throw new Error(`Message too long to seal — keep it under ${MAX_PLAINTEXT_BYTES} bytes.`);
    }
    const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
        'deriveBits',
    ])) as CryptoKeyPair;

    const peerKey = await importPublicKey(peerPublicB64);
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const context = contextFor(await fingerprint(ourPublicB64), await fingerprint(peerPublicB64));
    const key = await deriveMessageKey(ephemeral.privateKey, peerKey, ourPrivateKey, peerKey, salt, context);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(context) as BufferSource },
            key,
            packEnvelope(plaintext) as BufferSource,
        ),
    );

    const ephemeralPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

    // ephemeralPub(65) || salt(32) || iv(12) || ciphertext
    const payload = new Uint8Array(ephemeralPub.length + salt.length + iv.length + ciphertext.length);
    payload.set(ephemeralPub, 0);
    payload.set(salt, ephemeralPub.length);
    payload.set(iv, ephemeralPub.length + salt.length);
    payload.set(ciphertext, ephemeralPub.length + salt.length + iv.length);

    return { wire: WIRE_PREFIX + toB64(payload) };
}

/** True when a received message body is a sealed payload. */
export function isSealedWire(text: string): boolean {
    return text.startsWith(WIRE_PREFIX);
}

/**
 * Decrypt a wire string addressed to us and authored by `peerPublicB64`.
 *
 * EVERY failure path throws the same message. An earlier version let
 * `atob` and `importKey` throw their own errors from outside the try, which
 * told an attacker whether their base64, their curve point, or their key was
 * the part that failed — an oracle that makes forgery attempts cheaper to
 * refine. Malformed input is a decryption failure like any other.
 *
 * This does NOT check freshness. Use `openChecked` for anything off a network.
 */
export async function openFull(
    wire: string,
    ourPrivateKey: CryptoKey,
    ourPublicB64: string,
    peerPublicB64: string,
): Promise<OpenedMessage> {
    if (!isSealedWire(wire)) throw new Error('Not a sealed message.');

    try {
        const payload = fromB64(wire.slice(WIRE_PREFIX.length));

        // 65-byte uncompressed P-256 point + 32 salt + 12 iv + 16-byte tag.
        if (payload.length < 65 + 32 + 12 + 16) throw new Error(OPAQUE);

        const ephemeralPub = await crypto.subtle.importKey(
            'raw',
            payload.slice(0, 65) as BufferSource,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            [],
        );
        const salt = payload.slice(65, 97);
        const iv = payload.slice(97, 109);
        const ciphertext = payload.slice(109);

        const peerStatic = await importPublicKey(peerPublicB64);
        const context = contextFor(await fingerprint(ourPublicB64), await fingerprint(peerPublicB64));
        const key = await deriveMessageKey(ourPrivateKey, ephemeralPub, ourPrivateKey, peerStatic, salt, context);

        const buf = new Uint8Array(
            await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(context) as BufferSource },
                key,
                ciphertext as BufferSource,
            ),
        );
        return unpackEnvelope(buf);
    } catch {
        throw new Error(OPAQUE);
    }
}

/** Backwards-compatible text-only open. */
export async function open(
    wire: string,
    ourPrivateKey: CryptoKey,
    ourPublicB64: string,
    peerPublicB64: string,
): Promise<string> {
    return (await openFull(wire, ourPrivateKey, ourPublicB64, peerPublicB64)).text;
}

/* ---------------------------------------------------------- replay guard */

export interface ReplayGuard {
    /** True when this id has been seen before. */
    seen(id: string): Promise<boolean>;
    remember(id: string, timestamp: number): Promise<void>;
}

/**
 * Default guard: in-memory, bounded. Good enough within a session, and
 * deliberately replaced by a persistent implementation in `sealedStore.ts` —
 * an in-memory set forgets across a reload, and an attacker only has to wait
 * for one.
 */
function memoryGuard(): ReplayGuard {
    const seen = new Map<string, number>();
    return {
        async seen(id) {
            return seen.has(id);
        },
        async remember(id, timestamp) {
            seen.set(id, timestamp);
            if (seen.size > 5000) {
                // Drop the oldest half rather than growing without bound.
                [...seen.entries()]
                    .sort((a, b) => a[1] - b[1])
                    .slice(0, 2500)
                    .forEach(([k]) => seen.delete(k));
            }
        },
    };
}

let replayGuard: ReplayGuard = memoryGuard();

export function setReplayGuard(guard: ReplayGuard): void {
    replayGuard = guard;
}

/**
 * Decrypt, then refuse anything replayed or outside the freshness window.
 *
 * Sound crypto does not prevent a captured ciphertext being resent later — a
 * sealed "yes, go ahead" is just as valid next week unless something says
 * otherwise. The timestamp and id live INSIDE the authenticated plaintext, so
 * neither can be edited without breaking the tag.
 */
export async function openChecked(
    wire: string,
    ourPrivateKey: CryptoKey,
    ourPublicB64: string,
    peerPublicB64: string,
): Promise<OpenedMessage> {
    const msg = await openFull(wire, ourPrivateKey, ourPublicB64, peerPublicB64);

    const age = Date.now() - msg.timestamp;
    if (age > MAX_AGE_MS) throw new Error('Sealed message rejected: too old to be trusted.');
    if (age < -MAX_SKEW_MS) throw new Error('Sealed message rejected: clock is too far ahead.');

    if (await replayGuard.seen(msg.id)) {
        throw new Error('Sealed message rejected: replay of a message already received.');
    }
    await replayGuard.remember(msg.id, msg.timestamp);
    return msg;
}

/* ------------------------------------------------------------- handshake */

const HANDSHAKE_PREFIX = '\u{1F511}PCKEY1:';

/**
 * A handshake must never be sealed.
 *
 * If sealing wrapped the handshake itself, key rotation would deadlock: the
 * new key would be encrypted under the key it replaces, and the peer — who by
 * definition cannot read that — is locked out permanently. The send path uses
 * this to bypass encryption for handshakes specifically.
 */
export function isHandshake(text: string): boolean {
    return text.startsWith(HANDSHAKE_PREFIX);
}

/** The message you send once to publish your public key into a conversation. */
export function handshakeMessage(ourPublicB64: string): string {
    return `${HANDSHAKE_PREFIX}${ourPublicB64}`;
}

/** Extract a peer's public key from a handshake message, or null. */
export function readHandshake(text: string): string | null {
    if (!text.startsWith(HANDSHAKE_PREFIX)) return null;
    const b64 = text.slice(HANDSHAKE_PREFIX.length).trim();
    // Reject anything that is not a plausible uncompressed P-256 point, so a
    // malformed or hostile handshake fails here rather than deep in WebCrypto.
    try {
        const raw = fromB64(b64);
        if (raw.length !== 65 || raw[0] !== 0x04) return null;
        return b64;
    } catch {
        return null;
    }
}
