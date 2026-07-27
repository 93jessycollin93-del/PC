// Sovereign Engine — palindromic codec pipeline.
//
//   eYe — {8} — 0 — {8} — eYe
//
// encode() runs the stages forward to a sealed artifact (the 0, the boundary).
// decode() runs the SAME stages mirrored — the return path is structurally the
// reverse of the outbound path, never a second implementation.
// An observer hash is taken before encode and verified after decode, so every
// round trip proves itself: decode(encode(x)) deep-equals x, or it throws.

import { sha256 } from 'js-sha256';

export interface Stage<A = unknown, B = unknown> {
  readonly name: string;
  forward(input: A): Promise<B> | B;
  inverse(output: B): Promise<A> | A;
}

export interface SealedArtifact {
  /** Final bytes after all forward stages. */
  payload: Uint8Array;
  /** SHA256 of the canonical source value, taken by the sending observer. */
  observerHash: string;
  /** Stage names in forward order — the recorded journey. */
  stages: string[];
  sealedAt: number;
}

export class RoundTripError extends Error {
  constructor(
    message: string,
    readonly expectedHash?: string,
    readonly actualHash?: string,
  ) {
    super(message);
    this.name = 'RoundTripError';
  }
}

/** Deterministic JSON: object keys sorted at every depth, so the same value
 *  always hashes to the same digest regardless of key insertion order. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

export class SovereignPipeline {
  constructor(private readonly stages: Stage<any, any>[]) {
    if (stages.length === 0) throw new Error('SovereignPipeline requires at least one stage');
  }

  /** The outbound eye: hash, then transform forward through every stage. */
  async encode(value: unknown): Promise<SealedArtifact> {
    const observerHash = sha256(canonical(value));
    let acc: any = value;
    for (const stage of this.stages) {
      acc = await stage.forward(acc);
    }
    if (!(acc instanceof Uint8Array)) {
      throw new Error(`Pipeline must terminate in bytes; got ${typeof acc} after '${this.stages[this.stages.length - 1].name}'`);
    }
    return {
      payload: acc,
      observerHash,
      stages: this.stages.map((s) => s.name),
      sealedAt: Date.now(),
    };
  }

  /** The returning eye: transform inverse through the mirrored stages, then verify. */
  async decode<T = unknown>(artifact: SealedArtifact): Promise<T> {
    let acc: any = artifact.payload;
    for (let i = this.stages.length - 1; i >= 0; i--) {
      acc = await this.stages[i].inverse(acc);
    }
    const returnedHash = sha256(canonical(acc));
    if (returnedHash !== artifact.observerHash) {
      throw new RoundTripError(
        'Round-trip violation: returned value does not match the observer hash',
        artifact.observerHash,
        returnedHash,
      );
    }
    return acc as T;
  }
}
