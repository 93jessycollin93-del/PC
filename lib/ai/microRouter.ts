/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Micro-router: routes a task to the best free AI provider, compressing the
// conversational payload (LZW → Base64 via lib/compression) for storage and
// transport, and optionally sealing it with the Sovereign Engine pipeline.

import { PROVIDERS, AiProvider, TaskKind } from './providers';
import { Persona, JACKY } from './personas';
import { compressToLZWBase64, decompressFromLZWBase64 } from '../compression';

export interface RouteRequest {
  task: TaskKind;
  prompt: string;
  persona?: Persona;
  /** Runtime-supplied API keys keyed by provider id; kept in memory only. */
  keys?: Record<string, string>;
  /** Restrict routing to these provider ids. */
  allow?: string[];
  signal?: AbortSignal;
}

export interface RouteResult {
  providerId: string;
  model: string;
  text: string;
  /** LZW-compressed transcript for sovereign local storage. */
  compressedTranscript: string;
  latencyMs: number;
}

/** Compress a transcript for vault storage. */
export function sealTranscript(prompt: string, response: string): string {
  return compressToLZWBase64(JSON.stringify({ prompt, response }));
}

/** Restore a compressed transcript. */
export function openTranscript(sealed: string): { prompt: string; response: string } {
  return JSON.parse(decompressFromLZWBase64(sealed));
}

function eligible(p: AiProvider, req: RouteRequest): boolean {
  if (req.allow && !req.allow.includes(p.id)) return false;
  if (!p.models[req.task]) return false;
  if (p.requiresKey && !req.keys?.[p.id]) return false;
  return true;
}

async function callOllama(p: AiProvider, model: string, req: RouteRequest): Promise<string> {
  const res = await fetch(`${p.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: (req.persona ?? JACKY).systemPrompt },
        { role: 'user', content: req.prompt },
      ],
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data?.message?.content ?? '';
}

async function callGeminiProxy(p: AiProvider, model: string, req: RouteRequest): Promise<string> {
  const res = await fetch(p.baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      contents: req.prompt,
      config: { systemInstruction: (req.persona ?? JACKY).systemPrompt },
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`Gemini proxy HTTP ${res.status}`);
  const data = await res.json();
  return data?.response ?? '';
}

async function callOpenAiCompatible(p: AiProvider, model: string, req: RouteRequest): Promise<string> {
  const res = await fetch(p.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (req.keys?.[p.id] ?? ''),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: (req.persona ?? JACKY).systemPrompt },
        { role: 'user', content: req.prompt },
      ],
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callHuggingFace(p: AiProvider, model: string, req: RouteRequest): Promise<string> {
  const res = await fetch(`${p.baseUrl}/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (req.keys?.[p.id] ?? ''),
    },
    body: JSON.stringify({
      inputs: `${(req.persona ?? JACKY).systemPrompt}\n\n${req.prompt}`,
      parameters: { return_full_text: false },
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`HuggingFace HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data[0]?.generated_text ?? '') : (data?.generated_text ?? '');
}

async function dispatch(p: AiProvider, model: string, req: RouteRequest): Promise<string> {
  switch (p.id) {
    case 'ollama':
      return callOllama(p, model, req);
    case 'gemini-proxy':
      return callGeminiProxy(p, model, req);
    case 'huggingface-free':
      return callHuggingFace(p, model, req);
    default:
      return callOpenAiCompatible(p, model, req);
  }
}

/**
 * Route a request across the free AI fleet: Ollama first (local sovereignty),
 * then free cloud tiers in priority order. Falls through on failure.
 */
export async function route(req: RouteRequest): Promise<RouteResult> {
  const candidates = PROVIDERS.filter((p) => eligible(p, req));
  if (candidates.length === 0) {
    throw new Error(`No eligible provider for task '${req.task}'. Supply keys or start Ollama.`);
  }
  let lastError: unknown = null;
  for (const p of candidates) {
    const model = p.models[req.task]!;
    const started = Date.now();
    try {
      const text = await dispatch(p, model, req);
      return {
        providerId: p.id,
        model,
        text,
        compressedTranscript: sealTranscript(req.prompt, text),
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`All providers failed for task '${req.task}': ${String(lastError)}`);
}
