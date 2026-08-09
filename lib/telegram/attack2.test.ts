/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RED TEAM, ROUND TWO
 * ===================
 * Round one attacked the primitives. This attacks the protocol around them —
 * key adoption, mode state, and the paths where correct crypto is used
 * incorrectly. These are the bugs that survive a cipher review.
 */
import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as sealed from './sealed';

const g = globalThis as unknown as { indexedDB: IDBFactory };

async function party() {
    const id = await sealed.generateIdentity();
    const pub = await sealed.exportPublicKey(id.publicKey);
    return { id, pub };
}

async function freshStore() {
    g.indexedDB = new IDBFactory();
    localStorage.clear();
    vi.resetModules();
    return import('./sealedStore');
}

describe('ATTACK: key adoption', () => {
    it('refuses a handshake that echoes our own public key back', async () => {
        // Reflection. Bounce the victim's own key at them and they seal to
        // themselves: ECDH(ours, ours) succeeds, the transcript looks
        // encrypted and verified, and the real peer is cut out entirely.
        const store = await freshStore();
        const me = await store.getIdentity();

        await expect(store.acceptPeer('chat-1', me.publicKeyB64)).rejects.toThrow(/own key|reflect/i);
        expect(await store.getPeer('chat-1')).toBeNull();
    });

    it('refuses a structurally invalid peer key instead of storing it', async () => {
        // Storing junk defers the failure to every future send, and an
        // unopenable conversation looks like a crypto bug rather than an
        // attack.
        const store = await freshStore();
        await expect(store.acceptPeer('chat-1', 'not-a-key')).rejects.toThrow();
        await expect(store.acceptPeer('chat-2', 'A'.repeat(88))).rejects.toThrow();
        expect(await store.getPeer('chat-1')).toBeNull();
    });

    it('does not auto-adopt a key from a group conversation', async () => {
        // In a group, ANY member can post a handshake. Auto-adopting the first
        // one lets any participant become "the peer" for the whole thread.
        const store = await freshStore();
        const mallory = await party();

        await expect(store.acceptPeer('chat-g', mallory.pub, { chatKind: 'group' })).rejects.toThrow(
            /group|one-to-one|direct/i,
        );
        expect(await store.getPeer('chat-g')).toBeNull();
    });

    it('forgetting everything removes identity and peers, not just the session', async () => {
        // "Forget this session" that leaves the identity key and every peer
        // behind is not forgetting. It also means a later session silently
        // reuses an identity the user believed was gone.
        const store = await freshStore();
        const alice = await party();
        await store.getIdentity();
        await store.acceptPeer('chat-1', alice.pub);

        await store.forgetEverything();

        expect(await store.getPeer('chat-1')).toBeNull();
        expect(await store.listPeers()).toHaveLength(0);
    });
});

describe('ATTACK: mode downgrade', () => {
    it('a chat that has ever been sealed cannot silently revert to plaintext', async () => {
        // The sealed-chat set lived in localStorage — writable by anything on
        // this origin, including a Forge app. Flip one flag and the next
        // message the user types goes out in the clear, with the UI still
        // saying end-to-end. Silent downgrade is the worst outcome available.
        const store = await freshStore();
        const alice = await party();
        await store.acceptPeer('chat-1', alice.pub);
        await store.setSealed('chat-1', true);

        // Attacker clears the loose flag.
        localStorage.clear();

        // The durable record must still assert that this chat is sealed.
        expect(await store.isSealed('chat-1')).toBe(true);
    });

    it('turning sealing off is recorded deliberately, not by absence', async () => {
        const store = await freshStore();
        const alice = await party();
        await store.acceptPeer('chat-1', alice.pub);
        await store.setSealed('chat-1', true);
        await store.setSealed('chat-1', false);
        expect(await store.isSealed('chat-1')).toBe(false);
    });
});

describe('ATTACK: handshake carried under encryption', () => {
    it('a handshake is readable by a peer who has no key yet', async () => {
        // If sealing wraps the handshake itself, key rotation deadlocks: the
        // new key is encrypted under the key it is replacing, and the peer —
        // who by definition cannot read it — is locked out permanently.
        const alice = await party();
        const msg = sealed.handshakeMessage(alice.pub);

        expect(sealed.isSealedWire(msg)).toBe(false);
        expect(sealed.readHandshake(msg)).toBe(alice.pub);
        expect(sealed.isHandshake(msg)).toBe(true);
    });
});

describe('ATTACK: resource exhaustion', () => {
    it('refuses an oversized payload before doing any crypto', async () => {
        // A hostile client is not bound by Telegram's 4096-char UI limit. An
        // unbounded base64 decode plus AES over megabytes is a cheap way to
        // wedge the tab for every message in a thread.
        const alice = await party();
        const bob = await party();
        const huge = '\u{1F510}PCE2E1:' + 'A'.repeat(5_000_000);

        const started = Date.now();
        await expect(sealed.open(huge, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow();
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('refuses to seal a message that could never be delivered', async () => {
        // Better to fail at the composer than to hand Telegram something it
        // rejects after the user believes it was sent.
        const alice = await party();
        const bob = await party();
        await expect(
            sealed.seal('x'.repeat(100_000), alice.pub, bob.pub, alice.id.privateKey),
        ).rejects.toThrow(/too long/i);
    });
});
