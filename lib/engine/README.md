# Sovereign Engine — Required Reading Before You Touch This Code

This module is the storage core of the application. Every artifact the app
persists or transmits goes through this pipeline. If you work on this codebase,
you are expected to understand everything on this page — the compression, the
encryption, the verification law, and the one distinction that must never be
blurred (lossless save vs lossy semantic index).

```
eYe — {8} — 0 — {8} — eYe
value → [json] → [deflate] → [aes-gcm] → SealedArtifact → [aes-gcm⁻¹] → [inflate] → [json⁻¹] → value
        └────────── encode (forward) ──────────┘└────────── decode (mirror) ──────────┘
```

## The round-trip law (the whole point)

`decode(encode(x))` must deep-equal `x` — always, or the engine throws.

- Before encoding, the engine takes an **observer hash**: SHA256 of the
  *canonical* form of the value (object keys sorted at every depth, so the same
  value always produces the same digest regardless of key insertion order).
- After decoding, the hash is recomputed from what came back. Any mismatch
  throws `RoundTripError`. **Corruption can never pass silently.**
- `decode` is not a second implementation: it is structurally the same stage
  list run in reverse, calling each stage's `inverse`. If you change a stage's
  `forward`, its `inverse` changes in the same commit or the law breaks.

## The stages, exactly

| # | Stage | Forward | Inverse | Library |
|---|---|---|---|---|
| 1 | `json` | value → UTF-8 JSON bytes | `JSON.parse` | native |
| 2 | `deflate` | raw DEFLATE compression | inflate | `fflate` (`deflateSync`/`inflateSync`) |
| 3 | `aes-gcm` | AES-256-GCM encrypt; fresh random 12-byte IV per call, prepended to ciphertext | slice IV, decrypt | WebCrypto (`crypto.subtle`) |

**JSON contract (stage 1):** `undefined`, functions, symbols, and negative
zero are not representable in JSON and must not appear in payloads. `Map`,
`Set`, `Date`, and class instances must be converted to plain data first.

**Compression (stage 2):** DEFLATE is fully lossless. Typical ratios on vault
state are 5–20:1 depending on repetition. It is byte-exact on the way back —
this is what makes real restore possible.

**Encryption (stage 3):** AES-GCM is authenticated encryption (AEAD) — the GCM
tag rejects tampered ciphertext at decrypt time, and the observer hash then
verifies the decoded *value*. Two layers of integrity. The IV is generated
fresh on every encode, so encrypting the same value twice yields different
bytes (this is correct and required — never "fix" it). Keys enter through a
provider seam (`encryptStage(getKey)`); this module never stores, derives, or
persists keys. In the app, the vault's PodCustodian is the key authority.

## SealedArtifact — what actually gets stored

```ts
{
  payload: Uint8Array,   // bytes after all forward stages
  observerHash: string,  // sha256 of the canonical source value
  stages: string[],      // e.g. ['json', 'deflate', 'aes-gcm'] — the recorded journey
  sealedAt: number,      // epoch ms
}
```

Persist all four fields. `stages` tells any future reader which pipeline to
mirror; `observerHash` is the proof of faithful return.

## LOSSLESS vs LOSSY — the line you must never blur

- **This engine is the save path.** It is lossless. What you store is exactly
  what you get back, verified.
- **Semantic fingerprints** (embedding → PCA → vector-quantization sketches,
  a.k.a. qpdb fingerprints) are **lossy by construction**. They are excellent
  as a *semantic index* — find, recall, route by meaning — and they may be
  attached to artifacts as metadata. They can NEVER reconstruct the original
  state; anything that "restores" from a fingerprint alone is generating a
  plausible guess, not returning the truth. Do not present such output as a
  restore.

If you add semantic indexing, attach it as optional metadata alongside a
sealed artifact — never in place of one.

## Rules for adding or changing a stage

1. A stage is a true inverse pair: `inverse(forward(x)) === x` for every input
   it accepts. If you can't write the inverse, it doesn't belong in this
   pipeline (see lossless vs lossy above).
2. Ship the stage and its tests in the same commit: round-trip across payload
   shapes, plus a tamper case proving corrupt bytes are rejected, not decoded.
3. Never weaken the observer-hash check, never catch-and-ignore
   `RoundTripError`, never reuse an IV.
4. The pipeline must still terminate in bytes (`Uint8Array`).

Reference test suite: `pipeline.test.ts` (12 cases — round-trip law, canonical
hashing, forged hash rejection, payload tampering, wrong key, IV freshness,
malformed pipelines). Run with `npm test`. Keep it green; it is the law.
