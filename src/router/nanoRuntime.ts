import { decodeBase64 } from './base64';
import { NanoModel, RouteResult } from './types';

/**
 * The nano router runtime - the TypeScript twin of the Python runtime in the
 * PC forge (jacky/router_forge.py). Every step here mirrors the Python
 * pipeline exactly; the shared golden fixture (router-fixture-v1.json)
 * asserts both produce identical outputs. Change nothing here without
 * changing the fixture contract on both sides.
 */

/** Mirrors Python `" ".join(text.lower().split())`. */
export function normalizeText(text: string): string {
  return text.toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * UTF-8 encode by hand: no TextEncoder dependency, and byte-for-byte the
 * same output as Python's str.encode("utf-8"), including surrogate pairs.
 */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

/** FNV-1a 32-bit, identical to the Python forge's `_fnv1a`. */
export function fnv1a(bytes: number[]): number {
  // eslint-disable-next-line no-bitwise
  let h = 0x811c9dc5;
  for (const b of bytes) {
    // eslint-disable-next-line no-bitwise
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // eslint-disable-next-line no-bitwise
  return h >>> 0;
}

/**
 * Hashed char n-gram counts, L2 normalized. N-grams are over Unicode code
 * points (Python indexes strings by code point, so an emoji is ONE char).
 */
export function extractFeatures(
  text: string,
  hashDim: number,
  ngrams: number[],
): Map<number, number> {
  const chars = Array.from(normalizeText(text));
  const counts = new Map<number, number>();
  for (const n of ngrams) {
    if (chars.length < n) {
      continue;
    }
    for (let i = 0; i <= chars.length - n; i++) {
      const idx = fnv1a(utf8Bytes(chars.slice(i, i + n).join(''))) % hashDim;
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
  }
  let sumSquares = 0;
  for (const v of counts.values()) {
    sumSquares += v * v;
  }
  const norm = Math.sqrt(sumSquares);
  if (norm > 0) {
    for (const [k, v] of counts) {
      counts.set(k, v / norm);
    }
  }
  return counts;
}

/** Softmax with max subtraction, mirroring the Python `_softmax`. */
export function softmax(scores: number[]): number[] {
  const peak = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - peak));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / total);
}

/** Turn raw per-label scores into the shared RouteResult shape. */
export function scoresToResult(labels: string[], raw: number[]): RouteResult {
  const probs = softmax(raw);
  let best = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[best]) {
      best = i;
    }
  }
  const scores: Record<string, number> = {};
  labels.forEach((label, i) => {
    scores[label] = Math.round(probs[i] * 10000) / 10000;
  });
  return { label: labels[best], confidence: Math.round(probs[best] * 10000) / 10000, scores };
}

/** A loaded nano router: dequantized weights ready to score text. */
export interface CompiledNano {
  route(text: string): RouteResult;
}

export function compileNano(labels: string[], model: NanoModel): CompiledNano {
  const raw = decodeBase64(model.weights);
  const weights: number[][] = [];
  for (let c = 0; c < labels.length; c++) {
    const row = new Array<number>(model.hashDim);
    const scale = model.scales[c];
    for (let j = 0; j < model.hashDim; j++) {
      const byte = raw[c * model.hashDim + j];
      row[j] = (byte > 127 ? byte - 256 : byte) * scale;
    }
    weights.push(row);
  }
  return {
    route(text: string): RouteResult {
      const feats = extractFeatures(text, model.hashDim, model.ngrams);
      const rawScores = labels.map((_, c) => {
        let z = model.biases[c];
        for (const [idx, val] of feats) {
          z += weights[c][idx] * val;
        }
        return z;
      });
      return scoresToResult(labels, rawScores);
    },
  };
}
