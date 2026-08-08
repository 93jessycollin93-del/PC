/**
 * Keyring encryption — optional, opt-in, honest about what it buys.
 *
 * WHAT THIS PROTECTS AGAINST, AND WHAT IT DOES NOT
 * ────────────────────────────────────────────────
 * Encrypting the keyring means the keys are not readable by anyone who gets
 * at this browser's localStorage while the vault is locked — a shared or
 * borrowed device, a stolen laptop, a synced profile, someone reading the
 * export file over your shoulder.
 *
 * It does NOT protect against anything running inside the page while the
 * vault is UNLOCKED: at that point the keys are decrypted in memory, because
 * they have to be in order to make a request. Any XSS in the app can read
 * them then. Saying otherwise would be a lie, and a lie about encryption is
 * worse than no encryption, so this is stated in the UI too.
 *
 * DEFAULT IS OFF. A passphrase re-entered every session is real friction,
 * and the common case here is free-tier keys that can be re-issued in a
 * minute. Encryption should be a choice made by someone who wants the
 * trade, not a tax on everyone.
 *
 * LOSING THE PASSPHRASE LOSES THE KEYS. There is no recovery path and there
 * cannot be one — a recoverable secret is not encrypted. The UI insists on
 * an export before locking for the first time.
 */

const CIPHER_KEY = 'jackie_keyring_encrypted_v1';

/**
 * PBKDF2 iterations. OWASP's current floor for PBKDF2-HMAC-SHA256 is far
 * above the 100k used elsewhere in this codebase; 310k is a deliberate
 * middle ground — meaningfully harder to brute force, while still unlocking
 * in well under a second on the phones this actually runs on.
 */
const ITERATIONS = 310_000;

export interface EncryptedBlob {
    v: 1;
    salt: string;
    iv: string;
    data: string;
    /** So the UI can say when it was locked without decrypting anything. */
    at: number;
}

/* ── base64 helpers ────────────────────────────────────────────────────── */

function toBase64(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/** Returns Uint8Array<ArrayBuffer>: WebCrypto's BufferSource excludes
 *  SharedArrayBuffer, which the widened default type would allow. */
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/* ── key derivation ────────────────────────────────────────────────────── */

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: ITERATIONS },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/* ── state ─────────────────────────────────────────────────────────────── */

/**
 * The derived key for this session. Held in memory only — never persisted,
 * so closing the tab re-locks the vault. That is the point.
 */
let sessionKey: CryptoKey | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeVault(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* a broken listener must not break a lock/unlock */
        }
    });
}

function readBlob(): EncryptedBlob | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CIPHER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.v === 1 && parsed.salt && parsed.iv && parsed.data ? parsed : null;
    } catch {
        return null;
    }
}

/** Is the keyring stored encrypted at all? */
export function isEncrypted(): boolean {
    return readBlob() !== null;
}

/** Encrypted, and not yet unlocked this session. */
export function isLocked(): boolean {
    return isEncrypted() && sessionKey === null;
}

export function lockedAt(): number | null {
    return readBlob()?.at ?? null;
}

/* ── operations ────────────────────────────────────────────────────────── */

/**
 * Encrypt `plaintext` under a passphrase and store it. The caller is
 * responsible for removing the plaintext copy — `keyring.ts` does that as
 * part of `enableEncryption`, so the two can never drift apart.
 */
export async function encryptAndStore(plaintext: string, passphrase: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
    const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const key = await deriveKey(passphrase, salt);
    const data = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext),
    );
    const blob: EncryptedBlob = {
        v: 1,
        salt: toBase64(salt),
        iv: toBase64(iv),
        data: toBase64(data),
        at: Date.now(),
    };
    localStorage.setItem(CIPHER_KEY, JSON.stringify(blob));
    sessionKey = key;
    notify();
}

/**
 * Try a passphrase. Returns the decrypted plaintext, or null when it is
 * wrong — AES-GCM authenticates, so a bad passphrase fails to decrypt rather
 * than yielding garbage.
 */
export async function decryptWith(passphrase: string): Promise<string | null> {
    const blob = readBlob();
    if (!blob) return null;
    try {
        const key = await deriveKey(passphrase, fromBase64(blob.salt));
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(blob.iv) },
            key,
            fromBase64(blob.data),
        );
        sessionKey = key;
        notify();
        return new TextDecoder().decode(plain);
    } catch {
        return null;
    }
}

/** Re-encrypt with the passphrase already unlocked this session. */
export async function reEncrypt(plaintext: string): Promise<boolean> {
    if (!sessionKey) return false;
    const blob = readBlob();
    if (!blob) return false;
    try {
        const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
        const data = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            sessionKey,
            new TextEncoder().encode(plaintext),
        );
        localStorage.setItem(
            CIPHER_KEY,
            JSON.stringify({ ...blob, iv: toBase64(iv), data: toBase64(data), at: Date.now() }),
        );
        return true;
    } catch {
        return false;
    }
}

/** Forget the session key. The stored blob is untouched. */
export function lock(): void {
    sessionKey = null;
    notify();
}

/** Remove encryption entirely. The caller restores the plaintext keyring. */
export function removeEncryption(): void {
    try {
        localStorage.removeItem(CIPHER_KEY);
    } catch {
        /* nothing stored */
    }
    sessionKey = null;
    notify();
}

/** Rough strength feedback — guidance, not a gate. */
export function passphraseStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
    if (p.length < 8) return { score: 0, label: 'too short — use at least 8 characters' };
    let variety = 0;
    if (/[a-z]/.test(p)) variety += 1;
    if (/[A-Z]/.test(p)) variety += 1;
    if (/[0-9]/.test(p)) variety += 1;
    if (/[^A-Za-z0-9]/.test(p)) variety += 1;
    if (p.length >= 20 || (p.length >= 14 && variety >= 3)) return { score: 3, label: 'strong' };
    if (p.length >= 12 && variety >= 2) return { score: 2, label: 'good' };
    return { score: 1, label: 'weak — longer is better than complicated' };
}
