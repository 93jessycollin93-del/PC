/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The vault holds a credential that IS a Telegram account, so its properties
 * are asserted rather than assumed. Each test below names the attack it stands
 * against; if one starts failing, something real has regressed.
 *
 * The passkey tier is not covered here — WebAuthn needs an authenticator, and
 * a mock would assert the mock. It is exercised in a browser instead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const g = globalThis as unknown as { indexedDB: IDBFactory };

/**
 * A brand-new IndexedDB and a brand-new module instance per test.
 *
 * Both matter: the vault holds plaintext in module scope, and a shared
 * database would let one test's sealed record satisfy another's assertions —
 * which is exactly how a security suite quietly stops testing anything.
 */
async function reset() {
    g.indexedDB = new IDBFactory();
    localStorage.clear();
    vi.resetModules();
    return import('./vault');
}

const PASS = 'correct horse battery staple';

describe('sealed session vault', () => {
    beforeEach(async () => {
        await reset();
    });

    it('round-trips a session through seal and unseal', async () => {
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        expect(v.getUnsealed()).toBe('SESSION-ABC');

        v.lock();
        expect(v.getUnsealed()).toBeNull();

        const recovered = await v.unseal({ passphrase: PASS });
        expect(recovered).toBe('SESSION-ABC');
    });

    it('never writes the session in plaintext', async () => {
        const v = await reset();
        await v.seal('SUPER-SECRET-SESSION', { method: 'passphrase', passphrase: PASS });

        // Nothing in localStorage may contain the secret — the install id lives
        // there, but the credential must not.
        const dump = Object.keys(localStorage)
            .map(k => `${k}=${localStorage.getItem(k)}`)
            .join('|');
        expect(dump).not.toContain('SUPER-SECRET-SESSION');
    });

    it('rejects the wrong passphrase', async () => {
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        v.lock();
        await expect(v.unseal({ passphrase: 'wrong passphrase' })).rejects.toThrow(/could not unlock/i);
        expect(v.getUnsealed()).toBeNull();
    });

    it('gives the same error for a wrong passphrase and a tampered vault', async () => {
        // Distinguishing the two tells an attacker which one they achieved.
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        v.lock();
        const wrongPass = await v.unseal({ passphrase: 'nope nope nope' }).catch((e: Error) => e.message);

        const v2 = await reset();
        await v2.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        v2.lock();
        // Simulate tampering by moving the blob to a different install.
        localStorage.setItem('pc.telegram.install-id', 'some-other-install');
        const tampered = await v2.unseal({ passphrase: PASS }).catch((e: Error) => e.message);

        expect(wrongPass).toBe(tampered);
    });

    it('fails authentication when the ciphertext is bound to another install', async () => {
        // AES-GCM additional data binds the blob to origin + install. Copying
        // the IndexedDB record to another profile must not decrypt.
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        v.lock();

        localStorage.setItem('pc.telegram.install-id', crypto.randomUUID());
        await expect(v.unseal({ passphrase: PASS })).rejects.toThrow();
    });

    it('throttles repeated failures, and clears the penalty on success', async () => {
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        v.lock();

        // The first two misses are free — a typo should not cost anything.
        for (let i = 0; i < 3; i++) {
            await v.unseal({ passphrase: 'bad' }).catch(() => undefined);
        }
        const throttled = await v.getStatus();
        expect(throttled.failedAttempts).toBe(3);
        expect(throttled.lockedUntil).toBeGreaterThan(Date.now());

        // While throttled, even the correct passphrase is refused.
        await expect(v.unseal({ passphrase: PASS })).rejects.toThrow(/too many failed attempts/i);

        // Once the window passes, success resets the counter.
        vi.spyOn(Date, 'now').mockReturnValue(throttled.lockedUntil + 1000);
        await expect(v.unseal({ passphrase: PASS })).resolves.toBe('SESSION-ABC');
        vi.restoreAllMocks();
        expect((await v.getStatus()).failedAttempts).toBe(0);
    });

    it('reports status without unsealing anything', async () => {
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        v.lock();
        const status = await v.getStatus();
        expect(status.exists).toBe(true);
        expect(status.method).toBe('passphrase');
        expect(status.unlocked).toBe(false);
        expect(v.getUnsealed()).toBeNull();
    });

    it('wipe makes the session unrecoverable', async () => {
        const v = await reset();
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        await v.wipe();
        expect(v.getUnsealed()).toBeNull();
        expect((await v.getStatus()).exists).toBe(false);
        await expect(v.unseal({ passphrase: PASS })).rejects.toThrow(/no sealed session/i);
    });

    it('refuses a weak passphrase rather than sealing under it', async () => {
        const v = await reset();
        await expect(v.seal('S', { method: 'passphrase', passphrase: 'short' })).rejects.toThrow(/at least 8/i);
        expect((await v.getStatus()).exists).toBe(false);
    });

    it('migrates a legacy plaintext session and removes the old copy', async () => {
        const v = await reset();
        // Must look like a real StringSession: the migration shape-checks now,
        // because that key is writable by anything on the origin and a planted
        // value would otherwise be adopted and then encrypted as if it were
        // the user's own. See attack.test.ts.
        const REAL_LOOKING = 'A'.repeat(120);
        localStorage.setItem('pc.telegram.session', JSON.stringify(REAL_LOOKING));

        const recovered = v.takeLegacyPlaintextSession();
        expect(recovered).toBe(REAL_LOOKING);
        // The whole point: the plaintext copy stops existing.
        expect(localStorage.getItem('pc.telegram.session')).toBeNull();
        // And it is not returned twice.
        expect(v.takeLegacyPlaintextSession()).toBeNull();
    });

    it('removes a corrupt legacy value instead of leaving it behind', async () => {
        const v = await reset();
        localStorage.setItem('pc.telegram.session', '{not valid json');
        expect(v.takeLegacyPlaintextSession()).toBeNull();
        expect(localStorage.getItem('pc.telegram.session')).toBeNull();
    });

    it('locks on the idle timer', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const v = await reset();
        v.configureAutoLock({ idleMs: 1000, lockOnHide: false });
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });
        expect(v.getUnsealed()).toBe('SESSION-ABC');

        vi.advanceTimersByTime(1001);
        expect(v.getUnsealed()).toBeNull();
        vi.useRealTimers();
    });

    it('activity defers the idle lock', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const v = await reset();
        v.configureAutoLock({ idleMs: 1000, lockOnHide: false });
        await v.seal('SESSION-ABC', { method: 'passphrase', passphrase: PASS });

        vi.advanceTimersByTime(800);
        v.touchActivity();
        vi.advanceTimersByTime(800);
        expect(v.getUnsealed()).toBe('SESSION-ABC');

        vi.advanceTimersByTime(400);
        expect(v.getUnsealed()).toBeNull();
        vi.useRealTimers();
    });
});
