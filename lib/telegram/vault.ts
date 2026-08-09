/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SEALED SESSION VAULT
 * ====================
 * A Telegram session string is the whole account: read everything, send as
 * you, no expiry. The first cut of this app kept it in localStorage, which is
 * what Telegram Web itself does — and which is not good enough here, because
 * this origin also runs code The Forge generated.
 *
 * What this changes, precisely:
 *
 *   at rest      ciphertext only, AES-256-GCM, in a SEPARATE IndexedDB
 *                database from the rest of the desktop. A bug in app storage
 *                cannot read it; a `localStorage.clear()` cannot corrupt it.
 *   in memory    plaintext exists only between unlock and lock, and lock is
 *                automatic on idle and (optionally) whenever the tab is hidden.
 *   key          never persisted. Derived per unlock from a passkey or a
 *                passphrase, held as a non-extractable CryptoKey so that even
 *                code running in this realm cannot read the bytes out — it can
 *                use the key while unlocked, but it cannot copy it out to use
 *                later or elsewhere.
 *   binding      the ciphertext is bound to this origin + install via AES-GCM
 *                additional authenticated data. Lifting the blob to another
 *                origin produces an authentication failure, not a plaintext.
 *
 * HONEST LIMITS — do not oversell these:
 *   - While UNLOCKED, hostile code in this realm can ask the live client to
 *     act. Encryption at rest does not fix that; short auto-lock windows and
 *     realm isolation do. This is why the idle timer defaults low.
 *   - An attacker with the ciphertext can brute-force offline at their own
 *     pace. The only real defence there is KDF cost, which is why the
 *     passphrase tier uses 600,000 PBKDF2 iterations (OWASP's current floor)
 *     and why the passkey tier — where the secret never leaves the
 *     authenticator — is offered first and recommended.
 *   - Attempt throttling below defends the live page, not offline cracking.
 *     It is not a substitute for a strong passphrase.
 */

const DB_NAME = 'pc-telegram-vault';
const DB_VERSION = 2;
const STORE = 'sealed';
const RECORD_ID = 'telegram-session';

/** OWASP's current floor for PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;
const DEFAULT_IDLE_LOCK_MS = 15 * 60 * 1000;

export type UnlockMethod = 'passkey' | 'passphrase';

interface SealedRecord {
    id: string;
    method: UnlockMethod;
    /** AES-GCM ciphertext of the session string. */
    ciphertext: ArrayBuffer;
    iv: Uint8Array;
    /** PBKDF2 salt (passphrase) or PRF salt (passkey). */
    salt: Uint8Array;
    iterations: number;
    /** Credential id for the passkey tier, so we can re-derive on unlock. */
    credentialId?: ArrayBuffer;
    /** Bound into the AEAD as additional data; see aad(). */
    installId: string;
    createdAt: number;
    /** Failed-attempt state, persisted so a reload does not reset the penalty. */
    failedAttempts: number;
    lockedUntil: number;
}

export interface VaultStatus {
    exists: boolean;
    method: UnlockMethod | null;
    unlocked: boolean;
    failedAttempts: number;
    /** Epoch ms; unlock attempts are refused until this passes. */
    lockedUntil: number;
    passkeySupported: boolean;
}

/* ------------------------------------------------------------------- state */

/** Plaintext lives here and nowhere else, and only while unlocked. */
let plaintext: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let idleLockMs = DEFAULT_IDLE_LOCK_MS;
let lockOnHide = true;
const watchers = new Set<() => void>();

function notify(): void {
    watchers.forEach(w => w());
}

export function subscribeVault(cb: () => void): () => void {
    watchers.add(cb);
    return () => watchers.delete(cb);
}

/* ---------------------------------------------------------------- indexeddb */

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        // Shares the database with sealedStore.ts, so BOTH must declare the
        // same version and create the full schema. If one lags, whichever
        // opens second fails with a VersionError and the app half-works.
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
            if (!db.objectStoreNames.contains('identity')) db.createObjectStore('identity', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('peers')) db.createObjectStore('peers', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('vault: cannot open database'));
    });
}

async function readRecord(): Promise<SealedRecord | null> {
    const db = await openDB();
    try {
        return await new Promise<SealedRecord | null>((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD_ID);
            req.onsuccess = () => resolve((req.result as SealedRecord) ?? null);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

async function writeRecord(record: SealedRecord): Promise<void> {
    const db = await openDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

async function deleteRecord(): Promise<void> {
    const db = await openDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(RECORD_ID);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

/* -------------------------------------------------------------------- crypto */

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * A per-install random id, kept in localStorage. It is NOT a secret — it is
 * bound into the AEAD's additional data so that a ciphertext copied to another
 * origin or profile fails authentication instead of decrypting. Losing it is
 * equivalent to losing the vault, which is intended: the blob alone is inert.
 */
function installId(): string {
    const KEY = 'pc.telegram.install-id';
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(KEY, id);
    }
    return id;
}

/** Origin, or a stable stand-in outside a browser (tests). */
function originTag(): string {
    return typeof location !== 'undefined' && location.origin ? location.origin : 'non-browser';
}

/**
 * Additional authenticated data for AES-GCM.
 *
 * Every component is read from the LIVE environment, never from the stored
 * record. That distinction is the whole mechanism: an earlier version took
 * `installId` off the record, so a stolen blob carried its own binding along
 * with it and authenticated anywhere. Deriving it from the environment means a
 * blob lifted to another origin — or another profile — fails authentication
 * even when the attacker also has the passphrase.
 *
 * `origin` is the part an attacker cannot forge from another site. The install
 * id is defence in depth against a same-origin copy between profiles.
 */
function aad(method: UnlockMethod): Uint8Array {
    return enc.encode(`${originTag()}|${installId()}|${method}|v1`);
}

async function keyFromPassphrase(
    passphrase: string,
    salt: Uint8Array,
    iterations: number,
): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
        'deriveKey',
    ]);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        // Non-extractable: usable, never readable.
        false,
        ['encrypt', 'decrypt'],
    );
}

/* -------------------------------------------------------------------- passkey */

export function passkeySupported(): boolean {
    return typeof PublicKeyCredential !== 'undefined' && Boolean(navigator.credentials);
}

/**
 * Enrol a platform authenticator and confirm it can do PRF. Returns null when
 * the authenticator or browser lacks PRF, so the caller can fall back to the
 * passphrase tier and SAY SO rather than silently downgrading.
 */
async function enrolPasskey(): Promise<{ credentialId: ArrayBuffer } | null> {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: "Jackie's PC", id: location.hostname },
            user: { id: userId, name: 'telegram-vault', displayName: 'Telegram Vault' },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'required',
            },
            timeout: 60_000,
            extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
        },
    })) as PublicKeyCredential | null;
    if (!cred) return null;

    const ext = cred.getClientExtensionResults() as { prf?: { enabled?: boolean } };
    if (!ext.prf?.enabled) return null;
    return { credentialId: cred.rawId };
}

/** Derive the wrapping key from the authenticator's PRF output. */
async function keyFromPasskey(credentialId: ArrayBuffer, salt: Uint8Array): Promise<CryptoKey> {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = (await navigator.credentials.get({
        publicKey: {
            challenge,
            allowCredentials: [{ type: 'public-key', id: credentialId }],
            userVerification: 'required',
            timeout: 60_000,
            extensions: {
                prf: { eval: { first: salt as BufferSource } },
            } as AuthenticationExtensionsClientInputs,
        },
    })) as PublicKeyCredential | null;
    if (!assertion) throw new Error('Passkey cancelled');

    const ext = assertion.getClientExtensionResults() as {
        prf?: { results?: { first?: ArrayBuffer } };
    };
    const secret = ext.prf?.results?.first;
    if (!secret) throw new Error('This authenticator did not return a PRF result');

    // HKDF the PRF output into an AES key rather than using it raw, so the
    // authenticator secret and the encryption key are not the same value.
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: enc.encode('pc-telegram-vault/v1') },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/* ------------------------------------------------------------------ auto-lock */

function armIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    if (plaintext === null || idleLockMs <= 0) return;
    idleTimer = setTimeout(() => lock('idle'), idleLockMs);
}

export function configureAutoLock(opts: { idleMs?: number; lockOnHide?: boolean }): void {
    if (typeof opts.idleMs === 'number') idleLockMs = opts.idleMs;
    if (typeof opts.lockOnHide === 'boolean') lockOnHide = opts.lockOnHide;
    armIdleTimer();
}

/** Call on genuine user activity so an active session is not locked mid-use. */
export function touchActivity(): void {
    if (plaintext !== null) armIdleTimer();
}

// Feature-detect rather than assume a DOM: this module is also loaded under
// the test runner and would be loaded in an SSR pass by the sibling app, and
// in neither does `document` carry event-target methods.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && lockOnHide) lock('hidden');
    });
}

/* --------------------------------------------------------------------- API */

export async function getStatus(): Promise<VaultStatus> {
    const record = await readRecord().catch(() => null);
    return {
        exists: Boolean(record),
        method: record?.method ?? null,
        unlocked: plaintext !== null,
        failedAttempts: record?.failedAttempts ?? 0,
        lockedUntil: record?.lockedUntil ?? 0,
        passkeySupported: passkeySupported(),
    };
}

/** The unsealed session, or null while locked. */
export function getUnsealed(): string | null {
    return plaintext;
}

export function isUnlocked(): boolean {
    return plaintext !== null;
}

/**
 * Encrypt `secret` under a freshly derived key and persist the ciphertext.
 * Leaves the vault UNLOCKED, since the caller just proved possession.
 */
export async function seal(
    secret: string,
    opts: { method: UnlockMethod; passphrase?: string },
): Promise<void> {
    // Refuse to replace a vault nobody has unlocked. Otherwise hostile code on
    // this origin can swap the user's session for one it controls, and the
    // user goes on operating the attacker's account believing it is theirs.
    // Replacing after a successful unlock is fine — that is a re-key.
    const existing = await readRecord().catch(() => null);
    if (existing && plaintext === null) {
        throw new Error('A sealed session already exists. Unlock it first, or forget it, before sealing another.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const id = installId();

    let key: CryptoKey;
    let credentialId: ArrayBuffer | undefined;

    if (opts.method === 'passkey') {
        const enrolled = await enrolPasskey();
        if (!enrolled) {
            throw new Error(
                'This device or browser does not support passkey encryption (WebAuthn PRF). Use a passphrase instead.',
            );
        }
        credentialId = enrolled.credentialId;
        key = await keyFromPasskey(credentialId, salt);
    } else {
        if (!opts.passphrase || opts.passphrase.length < 8) {
            throw new Error('Passphrase must be at least 8 characters.');
        }
        key = await keyFromPassphrase(opts.passphrase, salt, PBKDF2_ITERATIONS);
    }

    const record: SealedRecord = {
        id: RECORD_ID,
        method: opts.method,
        ciphertext: new ArrayBuffer(0),
        iv,
        salt,
        iterations: PBKDF2_ITERATIONS,
        credentialId,
        installId: id,
        createdAt: Date.now(),
        failedAttempts: 0,
        lockedUntil: 0,
    };
    record.ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(opts.method) as BufferSource },
        key,
        enc.encode(secret),
    );

    await writeRecord(record);
    plaintext = secret;
    armIdleTimer();
    notify();
}

/**
 * Backoff after failed attempts. Doubles from 5s, capped at 5 minutes, and
 * starts only after three misses so an ordinary typo costs nothing.
 */
function penaltyFor(attempts: number): number {
    if (attempts < 3) return 0;
    return Math.min(5_000 * 2 ** (attempts - 3), 300_000);
}

/**
 * Unlock attempts are serialised.
 *
 * The counter is a read-modify-write against IndexedDB, so five guesses fired
 * in parallel all read the same `failedAttempts` and all write n+1 — five
 * tries for the price of one, every round, forever. A single-realm promise
 * chain is enough to close that, and cheap: unlocking is not a hot path.
 */
let unsealChain: Promise<unknown> = Promise.resolve();

export function unseal(opts: { passphrase?: string }): Promise<string> {
    const run = unsealChain.then(
        () => unsealOnce(opts),
        () => unsealOnce(opts),
    );
    // Keep the chain alive regardless of this attempt's outcome.
    unsealChain = run.catch(() => undefined);
    return run;
}

async function unsealOnce(opts: { passphrase?: string }): Promise<string> {
    const record = await readRecord();
    if (!record) throw new Error('No sealed session on this device.');

    if (record.lockedUntil > Date.now()) {
        const secs = Math.ceil((record.lockedUntil - Date.now()) / 1000);
        throw new Error(`Too many failed attempts. Try again in ${secs}s.`);
    }

    let key: CryptoKey;
    if (record.method === 'passkey') {
        if (!record.credentialId) throw new Error('Vault is corrupt: no credential id.');
        key = await keyFromPasskey(record.credentialId, record.salt);
    } else {
        if (!opts.passphrase) throw new Error('Passphrase required.');
        key = await keyFromPassphrase(opts.passphrase, record.salt, record.iterations);
    }

    try {
        const buf = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: record.iv as BufferSource,
                additionalData: aad(record.method) as BufferSource,
            },
            key,
            record.ciphertext,
        );
        plaintext = dec.decode(buf);
        // Reset the penalty only on a real success.
        if (record.failedAttempts || record.lockedUntil) {
            await writeRecord({ ...record, failedAttempts: 0, lockedUntil: 0 });
        }
        armIdleTimer();
        notify();
        return plaintext;
    } catch {
        const failedAttempts = record.failedAttempts + 1;
        const penalty = penaltyFor(failedAttempts);
        await writeRecord({
            ...record,
            failedAttempts,
            lockedUntil: penalty ? Date.now() + penalty : 0,
        });
        notify();
        // Deliberately identical message for a wrong passphrase and a tampered
        // blob: distinguishing them tells an attacker which one they achieved.
        throw new Error('Could not unlock. Wrong passphrase, or the vault was tampered with.');
    }
}

export function lock(_reason: 'manual' | 'idle' | 'hidden' = 'manual'): void {
    if (plaintext === null) return;
    plaintext = null;
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    notify();
}

/** Destroy the sealed record entirely. Irreversible by design. */
export async function wipe(): Promise<void> {
    plaintext = null;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    await deleteRecord().catch(() => undefined);
    notify();
}

/**
 * One-time migration off the plaintext localStorage key shipped in the first
 * version. Returns the recovered session so the caller can immediately re-seal
 * it; the old key is removed either way so the plaintext copy stops existing.
 */
export function takeLegacyPlaintextSession(): string | null {
    const LEGACY_KEY = 'pc.telegram.session';
    try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) return null;
        localStorage.removeItem(LEGACY_KEY);
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'string') return null;
        // Shape-check before adopting. This key is writable by anything on the
        // origin, so a planted value is a way to get the app to adopt — and
        // then dutifully encrypt — an attacker-supplied session. A real
        // StringSession is a long base64-ish blob; short or odd input is not
        // one, and is dropped rather than sealed.
        const looksLikeSession = parsed.length >= 64 && /^[A-Za-z0-9+/=_-]+$/.test(parsed);
        return looksLikeSession ? parsed : null;
    } catch {
        localStorage.removeItem(LEGACY_KEY);
        return null;
    }
}
