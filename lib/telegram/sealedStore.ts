/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistence for sealed messaging: one long-term identity, and the peer keys
 * you have accepted per conversation.
 *
 * The identity private key is stored as a `CryptoKey` object, not as bytes.
 * IndexedDB structured-clones it, and because it was generated
 * non-extractable, WebCrypto refuses to serialise the key material even to
 * itself — what lands on disk is an opaque handle the browser can use and
 * nothing in this realm can read. Storing an exported JWK instead would undo
 * the entire property, so `exportKey` must never be called on it.
 *
 * Peer keys are public, so they are stored plainly. What matters for them is
 * not secrecy but change detection: a peer key that silently changes is
 * indistinguishable from an attacker substituting one, so `verified` and
 * `firstSeen` are recorded and a change is surfaced rather than accepted.
 */
import * as sealed from './sealed';

const DB_NAME = 'pc-telegram-vault';
const DB_VERSION = 2;
const IDENTITY_STORE = 'identity';
const PEERS_STORE = 'peers';
const SEALED_STORE = 'sealed';
const IDENTITY_ID = 'self';

export interface PeerRecord {
    /** Telegram chat id this key belongs to. */
    id: string;
    publicKey: string;
    /** True once the human has compared the safety number out of band. */
    verified: boolean;
    firstSeen: number;
    /** Set when a different key arrived for a chat that already had one. */
    changedAt?: number;
    previousKey?: string;
    /**
     * Sealed mode, stored HERE rather than in localStorage.
     *
     * It used to live in a loose localStorage array, which anything on this
     * origin could rewrite — clear the flag and the next message the user
     * types goes out in the clear while the UI still says end-to-end. Keeping
     * it beside the key material means turning sealing off is a deliberate
     * recorded act, not something an attacker achieves by deletion.
     */
    sealed?: boolean;
}

export type ChatKind = 'user' | 'group' | 'channel';

interface IdentityRecord {
    id: string;
    privateKey: CryptoKey;
    publicKey: CryptoKey;
    publicKeyB64: string;
    createdAt: number;
}

/**
 * Shares the vault's database so a single "forget everything" wipes both.
 * Version 2 adds the two stores; the vault's own store is created here too so
 * whichever module opens the database first produces a complete schema.
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SEALED_STORE)) db.createObjectStore(SEALED_STORE, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(IDENTITY_STORE)) db.createObjectStore(IDENTITY_STORE, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(PEERS_STORE)) db.createObjectStore(PEERS_STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('sealed store: cannot open database'));
    });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    return openDB().then(
        db =>
            new Promise<T>((resolve, reject) => {
                const request = run(db.transaction(store, mode).objectStore(store));
                request.onsuccess = () => {
                    resolve(request.result as T);
                    db.close();
                };
                request.onerror = () => {
                    reject(request.error);
                    db.close();
                };
            }),
    );
}

/* --------------------------------------------------------------- identity */

let cached: IdentityRecord | null = null;

/** The identity, created on first use. */
export async function getIdentity(): Promise<{ privateKey: CryptoKey; publicKeyB64: string }> {
    if (cached) return { privateKey: cached.privateKey, publicKeyB64: cached.publicKeyB64 };

    const existing = await tx<IdentityRecord | undefined>(IDENTITY_STORE, 'readonly', s => s.get(IDENTITY_ID));
    if (existing) {
        cached = existing;
        return { privateKey: existing.privateKey, publicKeyB64: existing.publicKeyB64 };
    }

    const identity = await sealed.generateIdentity();
    const record: IdentityRecord = {
        id: IDENTITY_ID,
        privateKey: identity.privateKey,
        publicKey: identity.publicKey,
        publicKeyB64: await sealed.exportPublicKey(identity.publicKey),
        createdAt: Date.now(),
    };
    await tx(IDENTITY_STORE, 'readwrite', s => s.put(record));
    cached = record;
    return { privateKey: record.privateKey, publicKeyB64: record.publicKeyB64 };
}

/** Destroy the identity. Past sealed messages become permanently unreadable. */
export async function resetIdentity(): Promise<void> {
    cached = null;
    await tx(IDENTITY_STORE, 'readwrite', s => s.delete(IDENTITY_ID));
}

/* ------------------------------------------------------------------ peers */

export async function getPeer(chatId: string): Promise<PeerRecord | null> {
    return (await tx<PeerRecord | undefined>(PEERS_STORE, 'readonly', s => s.get(chatId))) ?? null;
}

export async function listPeers(): Promise<PeerRecord[]> {
    return (await tx<PeerRecord[]>(PEERS_STORE, 'readonly', s => s.getAll())) ?? [];
}

/**
 * Record a peer's key for a conversation.
 *
 * A key arriving for a chat that already has a DIFFERENT one is the exact
 * shape of a man-in-the-middle, so it is stored with `changedAt` set and
 * `verified` forced back to false. The UI must show that rather than swapping
 * silently — silent acceptance is what makes key substitution work.
 */
export async function acceptPeer(
    chatId: string,
    publicKey: string,
    opts: { chatKind?: ChatKind } = {},
): Promise<PeerRecord> {
    // Groups and channels: any member can post a handshake, so auto-adopting
    // the first one lets any participant install themselves as "the peer" for
    // the whole thread. Sealing is one-to-one only until there is a real
    // multi-party design.
    if (opts.chatKind && opts.chatKind !== 'user') {
        throw new Error('Sealed messaging is direct (one-to-one) only — not available in groups or channels.');
    }

    // Reflection: bounce our own key back and we would seal to ourselves.
    // ECDH(ours, ours) succeeds, the transcript looks encrypted and verified,
    // and the real peer is cut out entirely.
    const me = await getIdentity();
    if (publicKey === me.publicKeyB64) {
        throw new Error('Refusing a handshake that is our own key reflected back.');
    }

    // Validate before storing. Junk stored now is a failure at every future
    // send, and an unopenable conversation reads as a crypto bug, not an attack.
    await sealed.importPublicKey(publicKey);

    const existing = await getPeer(chatId);

    if (existing && existing.publicKey === publicKey) return existing;

    const record: PeerRecord = existing
        ? {
              ...existing,
              publicKey,
              verified: false,
              changedAt: Date.now(),
              previousKey: existing.publicKey,
          }
        : { id: chatId, publicKey, verified: false, firstSeen: Date.now() };

    await tx(PEERS_STORE, 'readwrite', s => s.put(record));
    return record;
}

/** Mark a peer verified after the safety number was compared out of band. */
export async function markVerified(chatId: string): Promise<void> {
    const peer = await getPeer(chatId);
    if (!peer) return;
    await tx(PEERS_STORE, 'readwrite', s =>
        s.put({ ...peer, verified: true, changedAt: undefined, previousKey: undefined }),
    );
}

export async function forgetPeer(chatId: string): Promise<void> {
    await tx(PEERS_STORE, 'readwrite', s => s.delete(chatId));
}

/* ------------------------------------------------------------ sealed mode */

export async function isSealed(chatId: string): Promise<boolean> {
    return Boolean((await getPeer(chatId))?.sealed);
}

/** Sealing requires a peer key; there is nothing to seal to without one. */
export async function setSealed(chatId: string, on: boolean): Promise<void> {
    const peer = await getPeer(chatId);
    if (!peer) throw new Error('No key for this conversation yet — send your key first.');
    await tx(PEERS_STORE, 'readwrite', s => s.put({ ...peer, sealed: on }));
}

/**
 * Remove the identity and every peer key.
 *
 * "Forget" that leaves the identity behind is not forgetting: a later session
 * silently reuses a key the user believed was destroyed, and every peer who
 * verified the old safety number still matches.
 */
export async function forgetEverything(): Promise<void> {
    cached = null;
    await tx(IDENTITY_STORE, 'readwrite', s => s.clear());
    await tx(PEERS_STORE, 'readwrite', s => s.clear());
}
