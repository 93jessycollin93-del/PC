/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RED TEAM SUITE
 * ==============
 * Written from the attacker's side. Every test here is an attempt to break a
 * property the rest of the code claims, and each one is named for the attack
 * rather than the feature. A test that starts PASSING for the wrong reason is
 * as bad as one that fails, so each asserts the specific failure mode, not
 * merely "it threw".
 *
 * These ran red before the fixes they document. That is the point of keeping
 * them: they are the regression net for vulnerabilities that were real.
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

async function freshVault() {
    g.indexedDB = new IDBFactory();
    localStorage.clear();
    vi.resetModules();
    return import('./vault');
}

describe('ATTACK: message forgery', () => {
    it('an attacker knowing both public keys cannot forge a message from Alice to Bob', async () => {
        // THE ATTACK. Public keys are public — they are literally posted into
        // the chat as handshakes. If key derivation involves only an ephemeral
        // key and the RECIPIENT's static key, then anybody can mint a valid
        // ciphertext and attribute it to anyone. Telegram itself could inject
        // one into Alice's thread and Bob would render it as authentic E2E.
        //
        // Defence: the sender's static private key must be mixed into the
        // derivation, so a valid ciphertext is proof of possession.
        const alice = await party();
        const bob = await party();
        const mallory = await party();

        // Mallory holds only public information, and seals "as Alice".
        const forged = await sealed.seal('transfer the money to me', alice.pub, bob.pub, mallory.id.privateKey);

        // Bob opens it expecting Alice. It must not authenticate.
        await expect(sealed.open(forged.wire, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
            /could not decrypt/i,
        );
    });

    it('a genuine message from Alice still opens', async () => {
        // The counterpart: authentication must not break the honest path.
        const alice = await party();
        const bob = await party();
        const wire = (await sealed.seal('genuinely alice', alice.pub, bob.pub, alice.id.privateKey)).wire;
        expect(await sealed.open(wire, bob.id.privateKey, bob.pub, alice.pub)).toBe('genuinely alice');
    });

    it('a message from Alice does not open as though it came from Mallory', async () => {
        // Sender identity is bound, not advisory: the same ciphertext must not
        // verify under a different claimed sender.
        const alice = await party();
        const bob = await party();
        const mallory = await party();

        const wire = (await sealed.seal('hello bob', alice.pub, bob.pub, alice.id.privateKey)).wire;
        await expect(sealed.open(wire, bob.id.privateKey, bob.pub, mallory.pub)).rejects.toThrow();
    });
});

describe('ATTACK: replay', () => {
    it('the same ciphertext cannot be accepted twice', async () => {
        // Capturing a sealed "yes" and replaying it next week is a real attack
        // even when the crypto is sound. Freshness has to be inside the
        // authenticated envelope, not assumed from the transport.
        const alice = await party();
        const bob = await party();

        const wire = (await sealed.seal('yes, go ahead', alice.pub, bob.pub, alice.id.privateKey)).wire;
        const first = await sealed.openChecked(wire, bob.id.privateKey, bob.pub, alice.pub);
        expect(first.text).toBe('yes, go ahead');

        await expect(sealed.openChecked(wire, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
            /replay/i,
        );
    });

    it('rejects a message stamped far in the past', async () => {
        const alice = await party();
        const bob = await party();

        vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
        const wire = (await sealed.seal('stale', alice.pub, bob.pub, alice.id.privateKey)).wire;
        vi.restoreAllMocks();

        await expect(sealed.openChecked(wire, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
            /too old|clock/i,
        );
    });
});

describe('ATTACK: malformed input', () => {
    it('an off-curve ephemeral point fails like any other bad message', async () => {
        // An invalid-curve point must not produce a distinguishable error. A
        // different exception here is an oracle telling an attacker which part
        // of their forgery attempt was wrong.
        const alice = await party();
        const bob = await party();
        const wire = (await sealed.seal('x', alice.pub, bob.pub, alice.id.privateKey)).wire;

        const raw = atob(wire.slice(wire.indexOf(':') + 1));
        // Corrupt the ephemeral point (bytes 1..64) while keeping the 0x04 tag.
        const broken = raw.slice(0, 1) + 'A'.repeat(64) + raw.slice(65);
        const badWire = wire.slice(0, wire.indexOf(':') + 1) + btoa(broken);

        await expect(sealed.open(badWire, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
            /could not decrypt/i,
        );
    });

    it('survives adversarial junk without leaking a different error', async () => {
        const alice = await party();
        const bob = await party();
        const junk = [
            '\u{1F510}PCE2E1:',
            '\u{1F510}PCE2E1:!!!!not base64!!!!',
            '\u{1F510}PCE2E1:' + btoa('\0'.repeat(200)),
            '\u{1F510}PCE2E1:' + btoa('\xff'.repeat(500)),
        ];
        for (const wire of junk) {
            await expect(sealed.open(wire, bob.id.privateKey, bob.pub, alice.pub)).rejects.toThrow(
                /could not decrypt|malformed/i,
            );
        }
    });

    it('rejects a handshake carrying an off-curve point', async () => {
        // 65 bytes starting 0x04 is the right SHAPE but not necessarily a
        // point on P-256. Shape checks alone are not validation.
        const offCurve = new Uint8Array(65);
        offCurve[0] = 0x04;
        offCurve.fill(0xaa, 1);
        let s = '';
        for (const b of offCurve) s += String.fromCharCode(b);
        const msg = '\u{1F511}PCKEY1:' + btoa(s);

        const key = sealed.readHandshake(msg);
        // Either rejected outright, or rejected on use — never silently trusted.
        if (key !== null) {
            await expect(sealed.importPublicKey(key)).rejects.toThrow();
        }
    });
});

describe('ATTACK: safety number', () => {
    it('uses the full digit range rather than collapsing to 16 bits per group', async () => {
        // A group built from two bytes maxes out at 65535, so the leading digit
        // could never exceed 6 — a quiet loss of entropy and an obvious tell.
        const seen = new Set<string>();
        for (let i = 0; i < 40; i++) {
            const a = await party();
            const b = await party();
            const sn = await sealed.safetyNumber(a.pub, b.pub);
            for (const group of sn.split(' ')) seen.add(group[0]);
        }
        // Across 40 pairs × 12 groups, every leading digit 0-9 should appear.
        expect(seen.size).toBe(10);
    });

    it('does not repeat groups within one safety number', async () => {
        // Index arithmetic that wraps the digest produces visibly repeating
        // groups, which both leaks structure and shrinks the comparison space.
        const a = await party();
        const b = await party();
        const groups = (await sealed.safetyNumber(a.pub, b.pub)).split(' ');
        expect(new Set(groups).size).toBe(groups.length);
    });
});

describe('ATTACK: vault', () => {
    it('concurrent wrong guesses each count against the throttle', async () => {
        // Read-modify-write on the attempt counter: fire the guesses in
        // parallel and a naive implementation records one failure instead of
        // five, handing an attacker a free multiplier on every round.
        const v = await freshVault();
        await v.seal('SESSION', { method: 'passphrase', passphrase: 'correct horse battery' });
        v.lock();

        await Promise.all(
            Array.from({ length: 5 }, () => v.unseal({ passphrase: 'wrong' }).catch(() => undefined)),
        );

        const status = await v.getStatus();
        // Three, not five, and that is the correct number: the third failure
        // engages the backoff, and guesses four and five are then REFUSED
        // rather than tried — so they never reach the passphrase check and
        // rightly do not count as passphrase failures.
        //
        // What matters is that it is not ONE. Before serialisation all five
        // read the same counter and wrote the same n+1, handing an attacker a
        // free 5x multiplier on every round.
        expect(status.failedAttempts).toBeGreaterThanOrEqual(3);
        expect(status.lockedUntil).toBeGreaterThan(Date.now());
    });

    it('refuses to overwrite a sealed vault that has not been unlocked', async () => {
        // Otherwise hostile code on this origin can replace the user's session
        // with one it controls, and the user unknowingly operates the
        // attacker's account.
        const v = await freshVault();
        await v.seal('REAL-SESSION', { method: 'passphrase', passphrase: 'correct horse battery' });
        v.lock();

        await expect(
            v.seal('ATTACKER-SESSION', { method: 'passphrase', passphrase: 'attacker pass' }),
        ).rejects.toThrow(/unlock|already/i);

        // The original must still be intact and openable.
        expect(await v.unseal({ passphrase: 'correct horse battery' })).toBe('REAL-SESSION');
    });

    it('ignores an implausible planted legacy session', async () => {
        // Planting a value at the legacy key is a way to get the app to adopt —
        // and then dutifully encrypt — an attacker-supplied session.
        const v = await freshVault();
        localStorage.setItem('pc.telegram.session', JSON.stringify('x'));
        expect(v.takeLegacyPlaintextSession()).toBeNull();

        localStorage.setItem('pc.telegram.session', JSON.stringify({ evil: true }));
        expect(v.takeLegacyPlaintextSession()).toBeNull();
    });
});
