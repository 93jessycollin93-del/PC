import { describe, it, expect } from 'vitest';
import { signArtifact, verifyArtifact } from './provenance';
import { getOrCreateDeviceKey } from './deviceKey';

const freshStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
};

describe('signing and verifying an artifact', () => {
  it('produces a record that verifies against its own content', async () => {
    const record = await signArtifact('hello world', { app: 'desktop-export' });
    const result = await verifyArtifact(record, 'hello world');
    expect(result.ok).toBe(true);
  });

  it('verifies even without content supplied (signature-only check)', async () => {
    const record = await signArtifact('some content', { app: 'desktop-export' });
    const result = await verifyArtifact(record);
    expect(result.ok).toBe(true);
  });

  it('records what produced it', async () => {
    const record = await signArtifact('a response', { app: 'chat', model: 'claude-sonnet-5', now: () => 12345 });
    expect(record.producedBy).toEqual({ app: 'chat', model: 'claude-sonnet-5', timestamp: 12345 });
  });

  it('carries input hashes and a parent pointer when given', async () => {
    const record = await signArtifact('derived content', {
      app: 'notes',
      inputHashes: ['abc123'],
      parentRecordId: 'prov-parent-1',
    });
    expect(record.inputHashes).toEqual(['abc123']);
    expect(record.parentRecordId).toBe('prov-parent-1');
  });

  it('defaults parentRecordId to null and inputHashes to empty for a fresh artifact', async () => {
    const record = await signArtifact('original content', { app: 'notes' });
    expect(record.parentRecordId).toBeNull();
    expect(record.inputHashes).toEqual([]);
  });
});

describe('catching what a bare signature cannot be trusted to catch on its own', () => {
  it('fails when the content does not match the recorded hash', async () => {
    const record = await signArtifact('original content', { app: 'notes' });
    const result = await verifyArtifact(record, 'swapped content');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/content hash/i);
  });

  it('fails when any signed field is altered after signing', async () => {
    const record = await signArtifact('content', { app: 'notes' });
    const tampered = { ...record, producedBy: { ...record.producedBy, app: 'a-different-app' } };
    const result = await verifyArtifact(tampered, 'content');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature/i);
  });

  it('fails when the signature itself is altered', async () => {
    const record = await signArtifact('content', { app: 'notes' });
    const tampered = { ...record, signature: record.signature.slice(0, -4) + 'AAAA' };
    const result = await verifyArtifact(tampered, 'content');
    expect(result.ok).toBe(false);
  });

  it('fails when the embedded public key is swapped for an unrelated one', async () => {
    // Two independent device identities (storage: null mints a fresh key
    // per call) — otherwise both calls would share the default persisted
    // key and the "swap" would be a no-op.
    const keyA = await getOrCreateDeviceKey({ storage: null });
    const keyB = await getOrCreateDeviceKey({ storage: null });
    const record = await signArtifact('content', { app: 'notes', deviceKey: keyA });
    const tampered = { ...record, publicKeyJwk: keyB.publicKeyJwk };
    const result = await verifyArtifact(tampered, 'content');
    expect(result.ok).toBe(false);
  });

  it('rejects a record with an unrecognized version rather than guessing its shape', async () => {
    const record = await signArtifact('content', { app: 'notes' });
    const result = await verifyArtifact({ ...record, v: 99 as 1 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not a recognized/i);
  });
});

describe('the device key', () => {
  it('is stable across signatures within the same store, so records from the same device share a public key', async () => {
    const storage = freshStore();
    const key = await getOrCreateDeviceKey({ storage });
    const r1 = await signArtifact('one', { app: 'notes', deviceKey: key });
    const r2 = await signArtifact('two', { app: 'notes', deviceKey: key });
    expect(r1.publicKeyJwk).toEqual(r2.publicKeyJwk);
  });

  it('persists across instances sharing storage, rather than minting a new identity every load', async () => {
    const storage = freshStore();
    const first = await getOrCreateDeviceKey({ storage });
    const second = await getOrCreateDeviceKey({ storage });
    expect(second.publicKeyJwk).toEqual(first.publicKeyJwk);
  });

  it('mints a fresh key when storage is corrupt rather than failing every future export', async () => {
    const storage = freshStore();
    storage.setItem('pc_provenance_device_key_v1', '{{{ not json');
    const key = await getOrCreateDeviceKey({ storage });
    expect(key.publicKeyJwk).toBeTruthy();
  });

  it('mints a fresh key each time when there is no storage to persist to', async () => {
    const a = await getOrCreateDeviceKey({ storage: null });
    const b = await getOrCreateDeviceKey({ storage: null });
    expect(a.publicKeyJwk).not.toEqual(b.publicKeyJwk);
  });
});
