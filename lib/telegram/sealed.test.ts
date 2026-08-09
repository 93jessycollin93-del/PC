/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sealed messages carry the claim that Telegram cannot read them. Each test
 * names the property or the attack it stands against. If one of these starts
 * failing, the claim in docs/TELEGRAM.md has stopped being true.
 */
import { describe, expect, it } from 'vitest';
import * as sealed from './sealed';

/** A party: identity keypair plus its exported public key. */
async function party() {
    const id = await sealed.generateIdentity();
    const pub = await sealed.exportPublicKey(id.publicKey);
    return { id, pub };
}

describe('sealed messages', () => {
    it('round-trips a message between two parties', async () => {
        const alice = await party();
        const bob = await party();

        const { wire } = await sealed.seal('meet at the usual place', alice.pub, bob.pub);
        const opened = await sealed.open(wire, bob.id.privateKey, bob.pub, alice.pub);
        expect(opened).toBe('meet at the usual place');
    });

    it('puts no plaintext on the wire', async () => {
        const alice = await party();
        const bob = await party();
        const secret = 'ATTACK-AT-DAWN';

        const { wire } = await sealed.seal(secret, alice.pub, bob.pub);
        expect(wire).not.toContain(secret);
        // Nor should it survive a naive base64 decode of the payload.
        expect(atob(wire.slice(wire.indexOf(':') + 1))).not.toContain(secret);
    });

    it('is opaque to a third party holding their own key', async () => {
        const alice = await party();
        const bob = await party();
        const eve = await party();

        const { wire } = await sealed.seal('for bob only', alice.pub, bob.pub);
        await expect(sealed.open(wire, eve.id.privateKey, eve.pub, alice.pub)).rejects.toThrow(
            /could not decrypt/i,
        );
    });

    it('produces a different ciphertext every time — no deterministic leak', async () => {
        const alice = await party();
        const bob = await party();

        const a = await sealed.seal('same text', alice.pub, bob.pub);
        const b = await sealed.seal('same text', alice.pub, bob.pub);
        expect(a.wire).not.toBe(b.wire);
        // Both must still open.
        expect(await sealed.open(a.wire, bob.id.privateKey, bob.pub, alice.pub)).toBe('same text');
        expect(await sealed.open(b.wire, bob.id.privateKey, bob.pub, alice.pub)).toBe('same text');
    });

    it('rejects a ciphertext replayed into a different conversation', async () => {
        // The AEAD's additional data commits to both fingerprints, so a message
        // sealed for Alice→Bob must not authenticate as Carol→Bob.
        const alice = await party();
        const bob = await party();
        const carol = await party();

        const { wire } = await sealed.seal('context-bound', alice.pub, bob.pub);
        await expect(sealed.open(wire, bob.id.privateKey, bob.pub, carol.pub)).rejects.toThrow(
            /could not decrypt/i,
        );
    });

    it('rejects a tampered ciphertext', async () => {
        const alice = await party();
        const bob = await party();
        const { wire } = await sealed.seal('do not alter me', alice.pub, bob.pub);

        // Flip a byte late in the payload (inside the ciphertext, past the
        // ephemeral key and nonce) and the GCM tag must catch it.
        const b64 = wire.slice(wire.indexOf(':') + 1);
        const raw = atob(b64);
        const idx = raw.length - 5;
        const mutated = raw.slice(0, idx) + String.fromCharCode(raw.charCodeAt(idx) ^ 0xff) + raw.slice(idx + 1);
        const tamperedWire = wire.slice(0, wire.indexOf(':') + 1) + btoa(mutated);

        await expect(sealed.open(tamperedWire, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow();
    });

    it('rejects a truncated payload instead of misreading it', async () => {
        const alice = await party();
        const bob = await party();
        const { wire } = await sealed.seal('short', alice.pub, bob.pub);
        const truncated = wire.slice(0, wire.indexOf(':') + 1) + btoa('too short');
        await expect(sealed.open(truncated, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
            /malformed/i,
        );
    });

    it('uses a fresh ephemeral key per message', async () => {
        // Sender-side forward secrecy depends on this: the same ephemeral key
        // twice would mean one compromise unlocks both messages.
        const alice = await party();
        const bob = await party();

        const a = await sealed.seal('one', alice.pub, bob.pub);
        const b = await sealed.seal('two', alice.pub, bob.pub);
        const ephA = a.wire.slice(a.wire.indexOf(':') + 1).slice(0, 88);
        const ephB = b.wire.slice(b.wire.indexOf(':') + 1).slice(0, 88);
        expect(ephA).not.toBe(ephB);
    });

    it('agrees on the safety number from both sides', async () => {
        const alice = await party();
        const bob = await party();

        const fromAlice = await sealed.safetyNumber(alice.pub, bob.pub);
        const fromBob = await sealed.safetyNumber(bob.pub, alice.pub);
        expect(fromAlice).toBe(fromBob);
        // 60 digits in 12 groups of 5 — the format people will actually read out.
        expect(fromAlice.replace(/ /g, '')).toMatch(/^\d{60}$/);
        expect(fromAlice.split(' ')).toHaveLength(12);
    });

    it('gives a different safety number when a key is substituted', async () => {
        // This is the whole point of comparing it: a swapped key must be visible.
        const alice = await party();
        const bob = await party();
        const attacker = await party();

        const honest = await sealed.safetyNumber(alice.pub, bob.pub);
        const mitm = await sealed.safetyNumber(alice.pub, attacker.pub);
        expect(honest).not.toBe(mitm);
    });

    it('recognises its own wire format and ignores ordinary text', async () => {
        const alice = await party();
        const bob = await party();
        const { wire } = await sealed.seal('hello', alice.pub, bob.pub);

        expect(sealed.isSealedWire(wire)).toBe(true);
        expect(sealed.isSealedWire('just a normal message')).toBe(false);
        await expect(sealed.open('just a normal message', bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
            /not a sealed message/i,
        );
    });

    it('round-trips a handshake and rejects malformed ones', async () => {
        const alice = await party();
        const msg = sealed.handshakeMessage(alice.pub);
        expect(sealed.readHandshake(msg)).toBe(alice.pub);

        // A hostile or corrupt handshake must fail here, not inside WebCrypto.
        expect(sealed.readHandshake('hello there')).toBeNull();
        expect(sealed.readHandshake('\u{1F511}PCKEY1:not-base64!!')).toBeNull();
        expect(sealed.readHandshake('\u{1F511}PCKEY1:' + btoa('too short'))).toBeNull();
    });

    it('keeps the identity private key non-extractable', async () => {
        // The strongest claim this module makes: script injection cannot copy
        // the key out, only ask this page to use it.
        const alice = await sealed.generateIdentity();
        expect(alice.privateKey.extractable).toBe(false);
        await expect(crypto.subtle.exportKey('pkcs8', alice.privateKey)).rejects.toThrow();
    });

    it('survives unicode and long messages intact', async () => {
        const alice = await party();
        const bob = await party();
        const text = '🔐 переписка — 中文 — ' + 'x'.repeat(2000);

        const { wire } = await sealed.seal(text, alice.pub, bob.pub);
        expect(await sealed.open(wire, bob.id.privateKey, bob.pub, alice.pub)).toBe(text);
        // Must still fit a single Telegram message (4096 chars).
        expect(wire.length).toBeLessThan(4096);
    });
});
