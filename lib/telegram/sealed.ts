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
 * Per message   The sender generates a NEW ephemeral keypair every time and
 *               does ECDH against the recipient's long-term public key. The
 *               ephemeral private key is discarded immediately.
 *
 *               That gives sender-side forward secrecy: compromising the
 *               sender's device later reveals nothing about messages already
 *               sent, because the key that encrypted them no longer exists
 *               anywhere. This is the sealed-box construction, and it is a
 *               real property — but see the limits below before believing it
 *               is more than it is.
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
    const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', enc.encode(`${HKDF_INFO_PREFIX}|${a}|${b}`)),
    );
    let digits = '';
    for (let i = 0; i < 30; i += 1) {
        // Two bytes per group of digits, mod 100000 for five decimal digits.
        const chunk = ((digest[i * 2 % digest.length] << 8) | digest[(i * 2 + 1) % digest.length]) % 100000;
        digits += String(chunk).padStart(5, '0');
    }
    return (digits.slice(0, 60).match(/.{5}/g) ?? []).join(' ');
}

/* ------------------------------------------------------------------ crypto */

async function deriveMessageKey(
    privateKey: CryptoKey,
    peerPublicKey: CryptoKey,
    salt: Uint8Array,
    info: string,
): Promise<CryptoKey> {
    const shared = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: peerPublicKey },
        privateKey,
        256,
    );
    const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: enc.encode(info) },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
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

/**
 * Encrypt `plaintext` to `peerPublicB64`. A fresh ephemeral keypair is used and
 * then dropped, so this exact message cannot be decrypted again by anyone who
 * later compromises the sender.
 */
export async function seal(
    plaintext: string,
    ourPublicB64: string,
    peerPublicB64: string,
): Promise<SealResult> {
    const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
        'deriveBits',
    ])) as CryptoKeyPair;

    const peerKey = await importPublicKey(peerPublicB64);
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const context = contextFor(await fingerprint(ourPublicB64), await fingerprint(peerPublicB64));
    const key = await deriveMessageKey(ephemeral.privateKey, peerKey, salt, context);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(context) as BufferSource },
            key,
            enc.encode(plaintext),
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
 * Decrypt a wire string addressed to us. Throws on any failure — a wrong key,
 * a truncated payload and a forged tag are deliberately indistinguishable.
 */
export async function open(
    wire: string,
    ourPrivateKey: CryptoKey,
    ourPublicB64: string,
    peerPublicB64: string,
): Promise<string> {
    if (!isSealedWire(wire)) throw new Error('Not a sealed message.');
    const payload = fromB64(wire.slice(WIRE_PREFIX.length));

    // 65-byte uncompressed P-256 point + 32 salt + 12 iv + at least a 16-byte tag.
    if (payload.length < 65 + 32 + 12 + 16) throw new Error('Sealed message is malformed.');

    const ephemeralPubRaw = payload.slice(0, 65);
    const salt = payload.slice(65, 97);
    const iv = payload.slice(97, 109);
    const ciphertext = payload.slice(109);

    const ephemeralPub = await crypto.subtle.importKey(
        'raw',
        ephemeralPubRaw as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
    );

    const context = contextFor(await fingerprint(ourPublicB64), await fingerprint(peerPublicB64));
    const key = await deriveMessageKey(ourPrivateKey, ephemeralPub, salt, context);

    try {
        const buf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(context) as BufferSource },
            key,
            ciphertext as BufferSource,
        );
        return dec.decode(buf);
    } catch {
        throw new Error('Could not decrypt. Wrong key, or the message was altered.');
    }
}

/* ------------------------------------------------------------- handshake */

const HANDSHAKE_PREFIX = '\u{1F511}PCKEY1:';

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
