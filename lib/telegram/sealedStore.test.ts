/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The store's job is not secrecy — peer keys are public. Its job is refusing
 * to accept a changed key quietly, because silent acceptance is precisely the
 * mechanism a key-substitution attack relies on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as sealed from './sealed';

const g = globalThis as unknown as { indexedDB: IDBFactory };

async function reset() {
    g.indexedDB = new IDBFactory();
    localStorage.clear();
    vi.resetModules();
    return import('./sealedStore');
}

/**
 * Real P-256 points, not filler. `acceptPeer` validates keys now — storing
 * junk defers the failure to every future send — so a placeholder string is
 * rejected exactly as an attacker's would be.
 */
let KEY_A = '';
let KEY_B = '';

async function realKey(): Promise<string> {
    return sealed.exportPublicKey((await sealed.generateIdentity()).publicKey);
}

describe('sealed message store', () => {
    beforeEach(async () => {
        await reset();
        KEY_A = await realKey();
        KEY_B = await realKey();
    });

    it('creates one identity and reuses it', async () => {
        const s = await reset();
        const first = await s.getIdentity();
        const second = await s.getIdentity();
        expect(second.publicKeyB64).toBe(first.publicKeyB64);
        expect(first.publicKeyB64.length).toBeGreaterThan(80);
    });

    it('keeps the stored identity key non-extractable', async () => {
        // The property that survives storage is the one that matters: a key
        // round-tripped through IndexedDB must still refuse to be exported.
        const s = await reset();
        const identity = await s.getIdentity();
        expect(identity.privateKey.extractable).toBe(false);
        await expect(crypto.subtle.exportKey('pkcs8', identity.privateKey)).rejects.toThrow();
    });

    it('accepts a first peer key as unverified', async () => {
        const s = await reset();
        const peer = await s.acceptPeer('chat-1', KEY_A);
        expect(peer.publicKey).toBe(KEY_A);
        // Nothing is trusted until a human compares the safety number.
        expect(peer.verified).toBe(false);
        expect(peer.changedAt).toBeUndefined();
    });

    it('re-accepting the same key is a no-op, not a key change', async () => {
        const s = await reset();
        await s.acceptPeer('chat-1', KEY_A);
        await s.markVerified('chat-1');
        const again = await s.acceptPeer('chat-1', KEY_A);
        // A repeated handshake must not silently drop verification.
        expect(again.verified).toBe(true);
        expect(again.changedAt).toBeUndefined();
    });

    it('flags a changed key and revokes verification', async () => {
        // The attack this stands against: substitute a key mid-conversation
        // and hope the client swaps it without saying anything.
        const s = await reset();
        await s.acceptPeer('chat-1', KEY_A);
        await s.markVerified('chat-1');

        const changed = await s.acceptPeer('chat-1', KEY_B);
        expect(changed.publicKey).toBe(KEY_B);
        expect(changed.verified).toBe(false);
        expect(changed.changedAt).toBeGreaterThan(0);
        expect(changed.previousKey).toBe(KEY_A);
    });

    it('clears the change flag once re-verified', async () => {
        const s = await reset();
        await s.acceptPeer('chat-1', KEY_A);
        await s.acceptPeer('chat-1', KEY_B);
        await s.markVerified('chat-1');

        const peer = await s.getPeer('chat-1');
        expect(peer?.verified).toBe(true);
        expect(peer?.changedAt).toBeUndefined();
        expect(peer?.previousKey).toBeUndefined();
    });

    it('keeps peers separate per conversation', async () => {
        const s = await reset();
        await s.acceptPeer('chat-1', KEY_A);
        await s.acceptPeer('chat-2', KEY_B);
        expect((await s.getPeer('chat-1'))?.publicKey).toBe(KEY_A);
        expect((await s.getPeer('chat-2'))?.publicKey).toBe(KEY_B);
        expect(await s.listPeers()).toHaveLength(2);
    });

    it('forgets a peer on request', async () => {
        const s = await reset();
        await s.acceptPeer('chat-1', KEY_A);
        await s.forgetPeer('chat-1');
        expect(await s.getPeer('chat-1')).toBeNull();
    });

    it('resetting the identity produces a genuinely new one', async () => {
        const s = await reset();
        const before = (await s.getIdentity()).publicKeyB64;
        await s.resetIdentity();
        const after = (await s.getIdentity()).publicKeyB64;
        expect(after).not.toBe(before);
    });
});
