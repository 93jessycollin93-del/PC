#!/usr/bin/env node
/**
 * SAS Router — one file, zero dependencies, honest multi-provider LLM router.
 * Node 18+. The "LLM router" piece of Daigle's SAS hub.
 *
 *   node sas-router.mjs ask "Summarize this" --file notes.txt
 *   node sas-router.mjs discover      # what models exist right now ($0 OpenRouter + your providers)
 *   node sas-router.mjs status        # which providers are ready + health/usage
 *   node sas-router.mjs selftest      # proves the routing logic (offline + real local HTTP)
 *   node sas-router.mjs reset         # clear the health/usage ledger
 *
 * What it does
 *  • Speaks one protocol (OpenAI-style /chat/completions) to every provider.
 *  • Routes in priority order. On 429 / 402 / 5xx / network failure it fails over
 *    to the next provider and benches the failed one (honors Retry-After).
 *  • Survives model retirement: each provider has a short list of models. A model
 *    that answers "not found / decommissioned" is remembered as dead for 24h and
 *    the next one is tried. If all are gone, the error says exactly what to set.
 *  • Splits big inputs into chunks under a token budget, runs each, merges (map → reduce).
 *  • Keeps a ledger (~/.sas-router.json, owner-only): calls, failures, latency, tokens.
 *  • Importable: `import { run } from './sas-router.mjs'` — Jackie's model layer.
 *  • Opens no ports and runs no server: nobody can reach it from outside.
 *
 * Setup — each provider switches on only when its key is set:
 *   GROQ_API_KEY  CEREBRAS_API_KEY  OPENROUTER_API_KEY  MISTRAL_API_KEY  GEMINI_API_KEY
 *   OLLAMA_URL=http://localhost:11434      (turns on your local Ollama)
 *   Optional: <ID>_MODEL pins one model (e.g. GROQ_MODEL), SAS_ORDER=ollama,groq,…
 *   Keys live in your environment or a .env you never commit — never in code or chat.
 *
 * Honest notes
 *  • Free tiers change, shrink, and vanish. Nothing here is "free forever".
 *    Model lists were checked against provider deprecation notices in Nov 2026.
 *    They will drift again — `discover` shows what exists today.
 *  • Privacy differs by provider, so every provider is labeled:
 *      local  = never leaves your machine
 *      terms  = provider's terms apply
 *      trains = free tier may train on prompts
 *    --private uses local only · --no-train skips "trains".
 *  • Tokens are estimated (~4 chars/token) unless the provider reports usage.
 *  • It measures speed, reliability, and token use. It does NOT score answer
 *    "quality" — that takes a human or a real eval.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';

// ── Providers, in default priority order. models = try in this order. ────────
export const PROVIDERS = [
  { id: 'ollama', name: 'Ollama (local)', enableEnv: 'OLLAMA_URL', privacy: 'local',
    base: (env) => `${env.OLLAMA_URL.replace(/\/+$/, '')}/v1`,
    models: ['llama3.1', 'llama3.2', 'qwen2.5', 'gemma3', 'mistral'],
    note: 'your own machine: free, private, limited only by your hardware' },
  { id: 'groq', name: 'Groq', keyEnv: 'GROQ_API_KEY', privacy: 'terms',
    base: 'https://api.groq.com/openai/v1',
    models: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'],
    note: 'free tier, very fast, strict rate limits (console.groq.com)' },
  { id: 'cerebras', name: 'Cerebras', keyEnv: 'CEREBRAS_API_KEY', privacy: 'terms',
    base: 'https://api.cerebras.ai/v1',
    models: ['gpt-oss-120b'],
    note: 'free tier, very fast, daily token caps (cloud.cerebras.ai)' },
  { id: 'openrouter', name: 'OpenRouter', keyEnv: 'OPENROUTER_API_KEY', privacy: 'trains',
    base: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-oss-120b:free', 'openai/gpt-oss-20b:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    note: ':free models rotate often; hosts may log or train on prompts' },
  { id: 'mistral', name: 'Mistral', keyEnv: 'MISTRAL_API_KEY', privacy: 'trains',
    base: 'https://api.mistral.ai/v1',
    models: ['mistral-small-latest'],
    note: 'free Experiment tier may use prompts for training unless you opt out' },
  { id: 'gemini', name: 'Google Gemini', keyEnv: 'GEMINI_API_KEY', privacy: 'trains',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-flash-latest', 'gemini-3.5-flash'],
    note: 'free tier: Google may use prompts to improve products; humans may review' },
];

const PRIVACY = {
  local: 'never leaves your machine',
  terms: "provider's terms apply",
  trains: 'free tier may train on prompts',
};

const DAY = 24 * 60 * 60 * 1000;
const MODEL_GONE = /model_not_found|no such model|try pulling it|no endpoints found|model\b[^\n]{0,60}(not found|does not exist|decommissioned|deprecated|no longer|not supported|unknown|invalid)/i;

// ── Small helpers ────────────────────────────────────────────────────────────
export const estimateTokens = (s = '') => Math.ceil(s.length / 4);
const baseFor = (p, env) => (typeof p.base === 'function' ? p.base(env) : p.base);
const pinEnv = (p) => `${p.id.toUpperCase()}_MODEL`;
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Models to try for a provider: a pinned one, or the list minus known-dead ones. */
function modelsFor(p, env, ledger, at) {
  if (env[pinEnv(p)]) return [env[pinEnv(p)]];
  return p.models.filter((m) => !ledger.modelDead(p.id, m, at));
}

function redact(text, env, providers = PROVIDERS) {
  let out = String(text);
  for (const p of providers) {
    const key = p.keyEnv && env[p.keyEnv];
    if (key && key.length >= 8) out = out.split(key).join('***');
  }
  return out;
}

function ordered(providers, env) {
  const order = (env.SAS_ORDER || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!order.length) return providers;
  const rank = (p) => (order.includes(p.id) ? order.indexOf(p.id) : order.length);
  return [...providers].sort((a, b) => rank(a) - rank(b));
}

/** Providers that are configured AND allowed by the privacy flags, in order. */
export function eligible(providers, env, flags = {}) {
  return ordered(providers, env).filter((p) => {
    if (flags.only && p.id !== flags.only) return false;
    if (p.keyEnv && !env[p.keyEnv]) return false;
    if (p.enableEnv && !env[p.enableEnv]) return false;
    if (flags.private) return p.privacy === 'local';
    if (flags.noTrain && p.privacy === 'trains') return false;
    return true;
  });
}

function setupHelp(flags = {}) {
  if (flags.private) return 'No local model is enabled. Start Ollama, then set OLLAMA_URL=http://localhost:11434';
  if (flags.only) return `Provider "${flags.only}" is not usable (no key, or blocked by a privacy flag). Run: node sas-router.mjs status`;
  return [
    'No AI provider is configured. Set at least one of:',
    ...PROVIDERS.map((p) => `  ${(p.keyEnv || p.enableEnv).padEnd(20)} ${p.name} — ${p.note}`),
  ].join('\n');
}

// ── Ledger: health + usage, persisted between runs (owner-only file) ────────
export class Ledger {
  constructor(path) {
    this.path = path;
    this.data = {};
    if (path && existsSync(path)) {
      try { this.data = JSON.parse(readFileSync(path, 'utf8')); } catch { this.data = {}; }
    }
  }
  entry(id) {
    const e = (this.data[id] ??= { calls: 0, ok: 0, fail: 0, tokens: 0, ms: 0, cooldownUntil: 0, lastError: null });
    e.deadModels ??= {};
    return e;
  }
  save() {
    if (this.path) writeFileSync(this.path, JSON.stringify(this.data, null, 2), { mode: 0o600 });
  }
  record(id, { ok, ms = 0, tokens = 0, error = null, cooldownMs = 0 }, at = Date.now()) {
    const e = this.entry(id);
    e.calls += 1; e.ms += ms; e.tokens += tokens;
    if (ok) e.ok += 1;
    else { e.fail += 1; e.lastError = error; if (cooldownMs) e.cooldownUntil = at + cooldownMs; }
    this.save();
  }
  cooling(id, at = Date.now()) {
    return (this.data[id]?.cooldownUntil || 0) > at;
  }
  killModel(id, model, at = Date.now()) {
    this.entry(id).deadModels[model] = at + DAY;
    this.save();
  }
  modelDead(id, model, at = Date.now()) {
    return (this.data[id]?.deadModels?.[model] || 0) > at;
  }
}

/** How long to bench a provider after a failure. */
function cooldownFor(err) {
  const s = err.status;
  if (s === 429) return (err.retryAfter || 60) * 1000;   // rate limited: obey Retry-After
  if (s === 402) return (err.retryAfter || 600) * 1000;  // out of credits / free quota used up
  if (s === 401 || s === 403) return 10 * 60 * 1000;     // bad or blocked key: fix config
  if (!s || s >= 500) return 30 * 1000;                  // network / server trouble
  return 0;                                              // request-specific (400): just fail over
}

// ── One call to one provider + model ─────────────────────────────────────────
async function chat(p, model, messages, { env, fetchImpl, maxTokens = 2048, timeoutMs = 60000 }) {
  const headers = { 'content-type': 'application/json' };
  if (p.keyEnv) headers.authorization = `Bearer ${env[p.keyEnv]}`;
  const res = await fetchImpl(`${baseFor(p, env)}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${raw.replace(/\s+/g, ' ').slice(0, 140)}`);
    err.status = res.status;
    err.retryAfter = Number(res.headers.get('retry-after')) || 0;
    err.modelGone = res.status === 404 || ([400, 410].includes(res.status) && MODEL_GONE.test(raw));
    throw err;
  }
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`non-JSON reply: ${raw.slice(0, 80)}`); }
  const choice = data?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(choice?.finish_reason === 'length'
      ? 'ran out of tokens before answering (reasoning model?) — raise --max-tokens'
      : 'empty completion');
  }
  const tokens = data.usage?.total_tokens ?? estimateTokens(JSON.stringify(messages)) + estimateTokens(text);
  return { text: text.trim(), tokens, model: data.model || model };
}

// ── Router: priority order + model fallback + failover + benching ────────────
export async function route(messages, deps) {
  const { providers = PROVIDERS, env = process.env, flags = {}, ledger = new Ledger(null),
    fetchImpl = fetch, now = Date.now, log = () => {} } = deps;
  const ready = eligible(providers, env, flags);
  if (!ready.length) throw new Error(setupHelp(flags));
  const live = ready.filter((p) => !ledger.cooling(p.id, now()));
  if (!live.length) {
    const wait = Math.min(...ready.map((p) => ledger.entry(p.id).cooldownUntil)) - now();
    throw new Error(`Every configured provider is benched (rate-limited or failing). Try again in ~${Math.ceil(wait / 1000)}s.`);
  }
  const attempts = [];
  const retired = new Set();
  for (const p of live) {
    const models = modelsFor(p, env, ledger, now());
    if (!models.length) {
      retired.add(p);
      attempts.push({ provider: p.id, error: 'all of its default models are retired' });
      continue;
    }
    for (const model of models) {
      const t0 = now();
      try {
        const r = await chat(p, model, messages, { env, fetchImpl, maxTokens: flags.maxTokens, timeoutMs: flags.timeoutMs });
        const ms = now() - t0;
        ledger.record(p.id, { ok: true, ms, tokens: r.tokens }, now());
        return { ...r, provider: p.id, ms, attempts };
      } catch (e) {
        const error = redact(e.name === 'TimeoutError' ? 'timed out' : e.message, env, providers);
        ledger.record(p.id, { ok: false, ms: now() - t0, error, cooldownMs: e.modelGone ? 0 : cooldownFor(e) }, now());
        if (e.modelGone) {
          ledger.killModel(p.id, model, now());
          retired.add(p);
          attempts.push({ provider: `${p.id}/${model}`, error });
          log(`  ↳ ${p.id}: model ${model} is gone — trying its next model`);
          continue;
        }
        attempts.push({ provider: p.id, error });
        log(`  ↳ ${p.id}: ${error} — failing over`);
        break;
      }
    }
  }
  const tips = [...retired].map((p) => `  Tip: run "node sas-router.mjs discover" and pin a current model, e.g. ${pinEnv(p)}=<model id>`);
  throw new Error(['Every provider failed:', ...attempts.map((a) => `  • ${a.provider}: ${a.error}`), ...tips].join('\n'));
}

// ── Chunking: paragraphs → sentences → hard cut, every chunk under budget ────
export function chunkText(text, budgetTokens) {
  const max = budgetTokens * 4;
  if (text.length <= max) return [text];
  const chunks = [];
  let cur = '';
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  for (const para of text.split(/\n\s*\n/)) {
    if (para.length > max) {
      flush();
      for (const s of para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [para]) {
        if (s.length > max) { flush(); for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max)); continue; }
        if (cur.length + s.length > max) flush();
        cur += s;
      }
      flush();
      continue;
    }
    if (cur && cur.length + 2 + para.length > max) flush();
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  flush();
  return chunks;
}

/** Run a task. Small input → one call. Big input → chunk, map, then merge. */
export async function run({ instruction, input = '', budget = 3000, ...deps }) {
  const chunks = input ? chunkText(input, budget) : [''];
  const ask = (content) => route([{ role: 'user', content }], deps);
  if (chunks.length === 1) {
    const r = await ask(input ? `${instruction}\n\n---\n${input}` : instruction);
    return { ...r, chunks: 1, merged: false, parts: [r] };
  }
  const parts = [];
  for (const [i, chunk] of chunks.entries()) {
    deps.log?.(`  chunk ${i + 1}/${chunks.length} (~${estimateTokens(chunk)} tokens)`);
    parts.push(await ask(`${instruction}\n\n(Part ${i + 1} of ${chunks.length} of a larger input — handle only this part.)\n\n---\n${chunk}`));
  }
  const joined = parts.map((p, i) => `[Part ${i + 1}]\n${p.text}`).join('\n\n');
  const tokens = parts.reduce((s, p) => s + p.tokens, 0);
  if (estimateTokens(joined) > budget) {
    return { text: joined, provider: 'mixed', model: '-', tokens, chunks: chunks.length, merged: false, parts };
  }
  const m = await ask(`Combine these partial results into one coherent answer.\nOriginal request: ${instruction}\n\n${joined}`);
  return { ...m, tokens: tokens + m.tokens, chunks: chunks.length, merged: true, parts };
}

// ── Discover: what actually exists right now ─────────────────────────────────
export async function discover({ providers = PROVIDERS, env = process.env, fetchImpl = fetch } = {}) {
  const found = [];
  const get = async (url, headers = {}) => {
    const r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  try {
    const { data } = await get('https://openrouter.ai/api/v1/models');   // public catalog, no key
    for (const m of data) {
      if (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0) {
        found.push({ provider: 'openrouter', model: m.id, context: m.context_length || null });
      }
    }
  } catch (e) { found.push({ provider: 'openrouter', error: e.name === 'TimeoutError' ? 'timed out' : e.message }); }
  for (const p of eligible(providers, env)) {
    if (p.id === 'openrouter') continue;
    try {
      const headers = p.keyEnv ? { authorization: `Bearer ${env[p.keyEnv]}` } : {};
      const { data } = await get(`${baseFor(p, env)}/models`, headers);
      for (const m of data || []) found.push({ provider: p.id, model: m.id, context: m.context_window || m.context_length || null });
    } catch (e) { found.push({ provider: p.id, error: redact(e.message, env) }); }
  }
  return found;
}

// ── Status ───────────────────────────────────────────────────────────────────
function printStatus(env, ledger) {
  const now = Date.now();
  console.log(`${'provider'.padEnd(12)}${'ready'.padEnd(7)}${'privacy'.padEnd(8)}${'health'.padEnd(14)}${'calls'.padStart(6)}${'fail'.padStart(6)}${'avg'.padStart(7)}${'tokens'.padStart(8)}  next model`);
  for (const p of ordered(PROVIDERS, env)) {
    const ready = (p.keyEnv ? env[p.keyEnv] : env[p.enableEnv]) ? 'yes' : 'no';
    const e = ledger.data[p.id] || { calls: 0, fail: 0, ms: 0, tokens: 0, cooldownUntil: 0 };
    const health = !e.calls ? '—'
      : e.cooldownUntil > now ? `benched ${Math.ceil((e.cooldownUntil - now) / 1000)}s` : 'ok';
    const avg = e.calls ? `${(e.ms / e.calls / 1000).toFixed(1)}s` : '—';
    const next = modelsFor(p, env, ledger, now)[0] || `none left — set ${pinEnv(p)}`;
    console.log(`${p.id.padEnd(12)}${ready.padEnd(7)}${p.privacy.padEnd(8)}${health.padEnd(14)}${String(e.calls).padStart(6)}${String(e.fail).padStart(6)}${avg.padStart(7)}${fmt(e.tokens).padStart(8)}  ${next}`);
  }
  console.log('\nprivacy:');
  for (const [k, v] of Object.entries(PRIVACY)) console.log(`  ${k.padEnd(7)} ${v}`);
  const missing = PROVIDERS.filter((p) => !(p.keyEnv ? env[p.keyEnv] : env[p.enableEnv]));
  if (missing.length) {
    console.log('\nto turn on more providers:');
    for (const p of missing) console.log(`  ${(p.keyEnv || p.enableEnv).padEnd(20)} ${p.note}`);
  }
}

// ── Self-test: proves the routing logic ──────────────────────────────────────
function fakeFetch(script) {
  const calls = [];
  const f = async (url, init = {}) => {
    const host = new URL(url).host;
    calls.push(host);
    const b = script[host];
    if (b === 'down') throw new TypeError('fetch failed');
    if (typeof b === 'number') {
      return new Response('{"error":"nope"}', { status: b, headers: b === 429 ? { 'retry-after': '30' } : {} });
    }
    const body = JSON.parse(init.body);
    return Response.json({
      model: body.model,
      choices: [{ message: { content: `ok(${body.messages.at(-1).content.length})` } }],
      usage: { total_tokens: 10 },
    });
  };
  f.calls = calls;
  return f;
}

async function selftest() {
  let n = 0;
  const pass = (msg) => { n += 1; console.log(`  ✓ ${msg}`); };
  const P = (id, privacy, extra = {}) => ({ id, name: id, base: `https://${id}.test/v1`, models: [`${id}-model`], privacy, ...extra });
  const providers = [
    P('flaky', 'terms', { keyEnv: 'FLAKY_KEY' }),
    P('steady', 'terms', { keyEnv: 'STEADY_KEY' }),
    P('trainer', 'trains', { keyEnv: 'TRAINER_KEY' }),
    P('home', 'local', { enableEnv: 'HOME_URL' }),
  ];
  const env = { FLAKY_KEY: 'k1', STEADY_KEY: 'k2', TRAINER_KEY: 'k3' };
  const ids = (list) => list.map((p) => p.id).join(',');
  const msg = (content) => [{ role: 'user', content }];
  console.log('SAS Router self-test — no internet, no keys\n');

  // 1. Gating: keys, privacy flags, custom order
  assert.equal(ids(eligible(providers, env)), 'flaky,steady,trainer');
  assert.equal(ids(eligible(providers, env, { noTrain: true })), 'flaky,steady');
  assert.equal(ids(eligible(providers, env, { private: true })), '');
  assert.equal(ids(eligible(providers, { ...env, HOME_URL: 'http://localhost:11434' }, { private: true })), 'home');
  assert.equal(ids(eligible(providers, env, { only: 'trainer' })), 'trainer');
  assert.equal(ids(eligible(providers, { STEADY_KEY: 'k2' })), 'steady');
  assert.equal(ids(eligible(providers, { ...env, SAS_ORDER: 'trainer,steady' })), 'trainer,steady,flaky');
  pass('key gating, privacy filters (--private / --no-train / --only), custom order');

  // 2. Failover on 429 and bench for Retry-After
  let clock = 1_000_000;
  const ledger = new Ledger(null);
  const script = { 'flaky.test': 429 };
  const fetchImpl = fakeFetch(script);
  const deps = { providers, env, flags: {}, ledger, fetchImpl, now: () => clock };
  let r = await route(msg('hello'), deps);
  assert.equal(r.provider, 'steady');
  assert.deepEqual(r.attempts.map((a) => a.provider), ['flaky']);
  assert.ok(ledger.cooling('flaky', clock) && !ledger.cooling('flaky', clock + 31_000));
  pass('429 on the first provider → failed over to the next, benched it for Retry-After (30s)');

  // 3. A benched provider is skipped — no wasted request
  const before = fetchImpl.calls.length;
  await route(msg('again'), deps);
  assert.deepEqual(fetchImpl.calls.slice(before), ['steady.test']);
  pass('benched provider skipped — no wasted request');

  // 4. Self-healing: once the bench expires it is tried again
  clock += 31_000;
  delete script['flaky.test'];
  r = await route(msg('later'), deps);
  assert.equal(r.provider, 'flaky');
  pass('after the cooldown the provider comes back on its own');

  // 5. Bad key → long bench; network failure → short bench; out of credits → bench; still answered
  script['flaky.test'] = 401;
  script['steady.test'] = 'down';
  r = await route(msg('x'), deps);
  assert.equal(r.provider, 'trainer');
  assert.ok(ledger.cooling('flaky', clock + 9 * 60_000));
  assert.ok(ledger.cooling('steady', clock + 20_000) && !ledger.cooling('steady', clock + 31_000));
  pass('401 bad key → benched 10 min; network failure → benched 30s; answer still delivered');

  // 6. Total outage → one clear error naming every provider and why
  clock += 11 * 60_000;
  script['trainer.test'] = 500;
  await assert.rejects(route(msg('x'), deps),
    (e) => /Every provider failed/.test(e.message) && /flaky: HTTP 401/.test(e.message) && /trainer: HTTP 500/.test(e.message));
  pass('total outage → one clear error naming every provider and why it failed');

  // 7. Nothing configured → tells you exactly what to set
  await assert.rejects(route(msg('x'), { ...deps, env: {} }), /No AI provider is configured/);
  pass('nothing configured → tells you exactly which keys to set');

  // 8. Model retirement: dead model remembered, next one used, no repeat waste
  const seen = [];
  const drift = [P('shifty', 'terms', { keyEnv: 'SHIFTY_KEY', models: ['old-model', 'new-model'] })];
  const driftFetch = async (url, init) => {
    const { model } = JSON.parse(init.body);
    seen.push(model);
    if (model === 'old-model') {
      return new Response('{"error":{"message":"The model `old-model` has been decommissioned","code":"model_decommissioned"}}', { status: 400 });
    }
    return Response.json({ choices: [{ message: { content: 'hi' } }] });
  };
  const dLedger = new Ledger(null);
  const dDeps = { providers: drift, env: { SHIFTY_KEY: 'k' }, ledger: dLedger, fetchImpl: driftFetch, now: () => clock };
  r = await route(msg('x'), dDeps);
  assert.equal(r.model, 'new-model');
  await route(msg('x'), dDeps);
  assert.deepEqual(seen, ['old-model', 'new-model', 'new-model']);
  assert.ok(!dLedger.cooling('shifty', clock));
  const gone = async () => new Response('{"error":{"message":"model not found"}}', { status: 404 });
  await assert.rejects(route(msg('x'), { ...dDeps, ledger: new Ledger(null), fetchImpl: gone }), /SHIFTY_MODEL=/);
  seen.length = 0;
  await route(msg('x'), { ...dDeps, env: { SHIFTY_KEY: 'k', SHIFTY_MODEL: 'pinned-model' } });
  assert.deepEqual(seen, ['pinned-model']);
  pass('retired model → remembered dead, next model used; all gone → tells you what to pin; pin wins');

  // 9. Chunking stays under budget and loses nothing (incl. a giant unbroken run)
  const paras = Array.from({ length: 30 }, (_, i) =>
    `Section ${i}: a small seed expands into large meaning when both sides share the codebook. `.repeat(3).trim());
  const big = [...paras, 'x'.repeat(2500)].join('\n\n');
  const chunks = chunkText(big, 200);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => estimateTokens(c) <= 200));
  assert.equal(chunks.join('').replace(/\s+/g, ''), big.replace(/\s+/g, ''));
  pass(`chunking: ~${fmt(estimateTokens(big))} tokens → ${chunks.length} chunks, each ≤ 200 tokens, zero text lost`);

  // 10. Map → reduce over the chunks
  for (const k of Object.keys(script)) delete script[k];
  clock += 11 * 60_000;
  const out = await run({ instruction: 'Summarize', input: big, budget: 200, ...deps });
  assert.equal(out.parts.length, chunks.length);
  assert.equal(out.merged, true);
  pass(`map → reduce: ${out.parts.length} chunk calls + 1 merge call`);

  // 11. Ledger accounting
  const all = Object.values(ledger.data);
  const calls = all.reduce((s, e) => s + e.calls, 0);
  const tokens = all.reduce((s, e) => s + e.tokens, 0);
  assert.ok(calls > 0 && tokens > 0);
  pass(`ledger tracked ${calls} calls and ${tokens} tokens across providers`);

  // 12. Real HTTP on this machine (no internet): exact wire format + key handling
  const { createServer } = await import('node:http');
  let got;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      got = { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ model: got.body.model, choices: [{ message: { content: 'pong' } }], usage: { total_tokens: 7 } }));
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  try {
    const wire = [{ id: 'wire', name: 'wire', keyEnv: 'WIRE_KEY', privacy: 'terms',
      base: `http://127.0.0.1:${server.address().port}/v1`, models: ['wire-model'] }];
    const w = await route(msg('ping'), { providers: wire, env: { WIRE_KEY: 'test-key-123' } });
    assert.equal(w.text, 'pong');
    assert.equal(w.tokens, 7);
    assert.equal(got.url, '/v1/chat/completions');
    assert.equal(got.auth, 'Bearer test-key-123');
    assert.equal(got.body.model, 'wire-model');
    assert.deepEqual(got.body.messages, msg('ping'));
  } finally {
    server.close();
  }
  pass('real HTTP round-trip on this machine: OpenAI-format request, Bearer key, reply parsed');

  console.log(`\nAll ${n} checks passed ✅`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const USAGE = `SAS Router — honest multi-provider LLM router

  ask "<instruction>" [--file <path>|-] [--private] [--no-train] [--only <id>]
                      [--budget 3000] [--max-tokens 2048] [--json]
  discover            list the models that exist right now
  status              providers, privacy, health, usage, next model
  selftest            verify the routing logic (no internet needed)
  reset               clear the health/usage ledger`;

const positiveInt = (value, name) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive whole number`);
  return n;
};

async function main(argv) {
  const { values: v, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      file: { type: 'string', short: 'f' },
      only: { type: 'string' },
      private: { type: 'boolean' },
      'no-train': { type: 'boolean' },
      budget: { type: 'string' },
      'max-tokens': { type: 'string' },
      json: { type: 'boolean' },
    },
  });
  const [cmd] = positionals;
  const env = process.env;
  const ledger = new Ledger(env.SAS_LEDGER || join(homedir(), '.sas-router.json'));

  if (cmd === 'selftest') return selftest();
  if (cmd === 'status') return printStatus(env, ledger);
  if (cmd === 'reset') { ledger.data = {}; ledger.save(); console.log('Ledger cleared.'); return; }
  if (cmd === 'discover') {
    const rows = await discover({ env });
    for (const r of rows) {
      console.log(r.error
        ? `  ${r.provider.padEnd(12)} unreachable: ${r.error}`
        : `  ${r.provider.padEnd(12)} ${r.model}${r.context ? `  (${fmt(r.context)} ctx)` : ''}`);
    }
    const free = rows.filter((r) => r.provider === 'openrouter' && !r.error).length;
    console.error(rows.some((r) => r.provider === 'openrouter' && r.error)
      ? '\nOpenRouter catalog unreachable — free-model count unknown.'
      : `\n${free} models on OpenRouter cost $0 right now (they may log/train on prompts — see privacy).`);
    return;
  }
  if (cmd === 'ask') {
    const instruction = positionals.slice(1).join(' ').trim();
    if (!instruction) throw new Error('ask needs an instruction, e.g.  ask "Summarize this" --file notes.txt');
    const flags = {
      private: v.private, noTrain: v['no-train'], only: v.only,
      maxTokens: positiveInt(v['max-tokens'], 'max-tokens'),
    };
    const budget = positiveInt(v.budget, 'budget') ?? 3000;
    const input = v.file ? readFileSync(v.file === '-' ? 0 : v.file, 'utf8') : '';
    const t0 = Date.now();
    const out = await run({ instruction, input, budget, env, flags, ledger, log: (m) => console.error(m) });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (v.json) {
      console.log(JSON.stringify({ text: out.text, provider: out.provider, model: out.model,
        tokens: out.tokens, seconds: Number(secs), chunks: out.chunks, merged: out.merged }, null, 2));
      return;
    }
    console.log(out.text);
    console.error(`\n— ${out.provider} · ${out.model} · ~${fmt(out.tokens)} tokens · ${secs}s`
      + (out.chunks > 1 ? ` · ${out.chunks} chunks${out.merged ? ' (merged)' : ''}` : ''));
    return;
  }
  console.log(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
