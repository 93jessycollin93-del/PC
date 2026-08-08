/**
 * AI gateway — the one place that talks to a model.
 *
 * Every AI surface in the PC calls `chat()`. Nothing else in the app knows a
 * provider's URL, auth header, or wire format, which is the property that
 * makes providers swappable: adding one is an entry in `catalog.ts`, and no
 * call site changes.
 *
 * Three wire formats cover the field. OpenAI's `/chat/completions` is the de
 * facto standard, so one adapter serves OpenRouter, Groq, Cerebras, Mistral,
 * Together, DeepSeek, xAI, OpenAI, GitHub Models and Ollama. Google and
 * Anthropic get their own. The Jackie relay keeps its existing envelope so
 * the Express host keeps working unchanged.
 *
 * FAILURE IS THE NORMAL CASE HERE. Free tiers rate-limit, keys expire, local
 * Ollama is unreachable from a phone. So `chat()` walks a chain rather than
 * betting on one provider, and — critically — it reports *why* each one
 * failed. The bug this replaces surfaced every failure as the single word
 * "Load failed", which is unactionable: it could equally mean no key, a dead
 * model id, a CORS refusal or a rate limit.
 */
import {
    getProvider,
    parseModelRef,
    readyProviders,
    type ProviderDef,
} from './catalog';
import {
    hasAnyKey,
    listKeys,
    recordOutcome,
    usableKeys,
    type KeyEntry,
} from './keyring';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    messages: ChatMessage[];
    /** `provider:model`. Omit to use the automatic chain. */
    model?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
}

export interface ChatResult {
    text: string;
    /** Which provider/model actually answered. */
    provider: string;
    model: string;
    /** Which key in the provider's pool answered; null for keyless providers.
     *  Lets the UI prove a specific key works rather than just "something did". */
    keyId: string | null;
    /** Every provider/key tried before this one, and why each failed. */
    attempts: AttemptFailure[];
}

export interface AttemptFailure {
    provider: string;
    model: string;
    /** Which key failed, when the provider has a pool. */
    keyLabel?: string;
    reason: string;
}

/** Thrown when the whole chain is exhausted. Carries each failure. */
export class AllProvidersFailedError extends Error {
    attempts: AttemptFailure[];
    /** True when the user has no keys at all — a setup problem, not an outage. */
    unconfigured: boolean;

    constructor(attempts: AttemptFailure[], unconfigured: boolean) {
        // Two genuinely different situations deserve two different messages.
        // Ollama and the server relay need no key, so they are always tried and
        // always fail on a phone — which meant a user with zero keys got a
        // technical chain dump about mixed content instead of the one sentence
        // that actually helps: add a key.
        super(
            unconfigured
                ? 'No AI provider is set up yet. Open AI Providers and add a key — Google Gemini, Groq and OpenRouter all have free tiers that need no card.'
                : `No AI provider could answer. ${attempts
                      .map((a) => `${a.provider}${a.keyLabel ? ` (${a.keyLabel})` : ''}: ${a.reason}`)
                      .join(' · ')}`,
        );
        this.name = 'AllProvidersFailedError';
        this.attempts = attempts;
        this.unconfigured = unconfigured;
    }
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function authHeaders(p: ProviderDef, key: string | null): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (p.auth.kind === 'bearer' && key) headers.Authorization = `Bearer ${key}`;
    if (p.auth.kind === 'header' && key) headers[p.auth.name] = key;

    if (p.id === 'openrouter') {
        // OpenRouter attributes traffic with these; harmless elsewhere.
        headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://jackie.pc';
        headers['X-Title'] = "Jackie's PC";
    }
    if (p.id === 'anthropic') {
        headers['anthropic-version'] = '2023-06-01';
        // Anthropic blocks browser calls unless this opt-in is present.
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    return headers;
}

/**
 * Turn any thrown value into something a person can act on.
 *
 * A bare `TypeError: Load failed` (Safari) or `Failed to fetch` (Chromium)
 * means the request never reached the server — almost always CORS, an
 * offline device, or an http:// endpoint called from an https:// page. Saying
 * that is the difference between a dead end and a next step.
 */
function describeError(err: unknown, p: ProviderDef): string {
    if (err instanceof Error) {
        const m = err.message;
        if (/load failed|failed to fetch|networkerror/i.test(m)) {
            if (p.endpoint.startsWith('http://')) {
                return 'unreachable — this endpoint is plain http, which a secure page cannot call (local-only provider)';
            }
            return 'could not be reached (network, CORS, or offline)';
        }
        return m;
    }
    return String(err);
}

/** A provider error that kept its HTTP status, so rotation can react to it. */
export class ProviderHttpError extends Error {
    status: number;
    retryAfterSec?: number;
    constructor(message: string, status: number, retryAfterSec?: number) {
        super(message);
        this.name = 'ProviderHttpError';
        this.status = status;
        this.retryAfterSec = retryAfterSec;
    }
}

async function readError(res: Response): Promise<string> {
    let detail = '';
    try {
        const body = await res.text();
        // Providers disagree on error shape; try JSON, fall back to raw text.
        try {
            const parsed = JSON.parse(body);
            detail = parsed?.error?.message || parsed?.message || parsed?.error || body;
        } catch {
            detail = body;
        }
    } catch {
        /* body already consumed or empty */
    }
    const hint =
        res.status === 401 || res.status === 403
            ? ' (key rejected — check it in Settings → API Keys)'
            : res.status === 404
              ? ' (no such model for this provider)'
              : res.status === 429
                ? ' (rate limited — free tiers reset, try another provider)'
                : '';
    return `HTTP ${res.status}${hint}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`;
}

/** Build the typed error, preserving Retry-After when the provider sends it. */
async function httpError(res: Response): Promise<ProviderHttpError> {
    const message = await readError(res);
    const header = res.headers.get('retry-after');
    // Retry-After is either seconds or an HTTP date; both appear in the wild.
    let retryAfterSec: number | undefined;
    if (header) {
        const asNumber = Number(header);
        if (Number.isFinite(asNumber)) retryAfterSec = asNumber;
        else {
            const when = Date.parse(header);
            if (!Number.isNaN(when)) retryAfterSec = Math.max(0, Math.round((when - Date.now()) / 1000));
        }
    }
    return new ProviderHttpError(message, res.status, retryAfterSec);
}

/* ── wire adapters ─────────────────────────────────────────────────────── */

async function callOpenAiCompatible(
    p: ProviderDef,
    model: string,
    req: ChatRequest,
    key: string | null,
): Promise<string> {
    const res = await fetch(p.endpoint, {
        method: 'POST',
        headers: authHeaders(p, key),
        signal: req.signal,
        body: JSON.stringify({
            model,
            messages: req.messages,
            temperature: req.temperature ?? 0.7,
            ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
        }),
    });
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('response had no message content');
    return text;
}

async function callGemini(p: ProviderDef, model: string, req: ChatRequest, key: string | null): Promise<string> {
    // Gemini separates the system instruction and calls the assistant "model".
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = req.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const res = await fetch(`${p.endpoint}/${model}:generateContent`, {
        method: 'POST',
        headers: authHeaders(p, key),
        signal: req.signal,
        body: JSON.stringify({
            contents,
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: {
                temperature: req.temperature ?? 0.7,
                ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
            },
        }),
    });
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((x: { text?: string }) => x.text ?? '').join('').trim();
    if (!text) throw new Error('response had no text');
    return text;
}

async function callAnthropic(p: ProviderDef, model: string, req: ChatRequest, key: string | null): Promise<string> {
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const messages = req.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(p.endpoint, {
        method: 'POST',
        headers: authHeaders(p, key),
        signal: req.signal,
        body: JSON.stringify({
            model,
            messages,
            ...(system ? { system } : {}),
            // Anthropic requires max_tokens; pick a sane default rather than failing.
            max_tokens: req.maxTokens ?? 4096,
            temperature: req.temperature ?? 0.7,
        }),
    });
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    const text = (data?.content ?? [])
        .map((b: { text?: string }) => b.text ?? '')
        .join('')
        .trim();
    if (!text) throw new Error('response had no text');
    return text;
}

async function callJackieRelay(p: ProviderDef, model: string, req: ChatRequest): Promise<string> {
    const prompt = req.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    const res = await fetch(p.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: req.signal,
        body: JSON.stringify({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) throw await httpError(res);
    // A static host answers /api/* with index.html, so a 200 is not proof of
    // a relay. Parsing as JSON is what actually distinguishes them.
    const body = await res.text();
    let data: { response?: string; error?: string };
    try {
        data = JSON.parse(body);
    } catch {
        throw new Error('no relay here — this deployment has no Express host');
    }
    if (data.error) throw new Error(data.error);
    if (!data.response) throw new Error('relay returned no response');
    return data.response;
}

async function callProvider(
    p: ProviderDef,
    model: string,
    req: ChatRequest,
    key: string | null,
): Promise<string> {
    switch (p.wire) {
        case 'openai':
            return callOpenAiCompatible(p, model, req, key);
        case 'gemini':
            return callGemini(p, model, req, key);
        case 'anthropic':
            return callAnthropic(p, model, req, key);
        case 'jackie-relay':
            return callJackieRelay(p, model, req);
        default:
            throw new Error(`unknown wire format for ${p.id}`);
    }
}

/* ── the entry point ───────────────────────────────────────────────────── */

/**
 * Ask a model. Tries the requested provider first, then every other ready
 * provider in priority order, and only gives up when all of them have failed.
 */
export async function chat(req: ChatRequest): Promise<ChatResult> {
    const attempts: AttemptFailure[] = [];

    // Build the candidate chain: the explicit choice first, then the rest.
    const candidates: { provider: ProviderDef; model: string }[] = [];

    if (req.model) {
        const ref = parseModelRef(req.model);
        const p = ref && getProvider(ref.provider);
        if (p) candidates.push({ provider: p, model: ref!.model });
    }

    for (const p of readyProviders()) {
        if (candidates.some((c) => c.provider.id === p.id)) continue;
        const model = preferredModelFor(p);
        if (model) candidates.push({ provider: p, model });
    }

    for (const { provider, model } of candidates) {
        // Keyless providers (local Ollama, the server relay) get one attempt
        // with no key at all.
        if (provider.auth.kind === 'none') {
            try {
                const text = await callProvider(provider, model, req, null);
                return { text, provider: provider.id, model, keyId: null, attempts };
            } catch (err) {
                if (req.signal?.aborted) throw err;
                attempts.push({ provider: provider.id, model, reason: describeError(err, provider) });
            }
            continue;
        }

        const pool = listKeys(provider.id);
        if (pool.length === 0) {
            attempts.push({ provider: provider.id, model, reason: 'no API key set' });
            continue;
        }

        // ── The rotation, and the reason multiple keys are worth having ──
        // Sticky order: ride the first healthy key until it rate-limits, then
        // the next takes over. Draining one free allowance fully beats
        // spreading requests across every account and exhausting them all at
        // once. `usableKeys` already excludes cooling and rejected keys.
        const usable = usableKeys(provider.id);
        if (usable.length === 0) {
            const cooling = pool.filter((k) => k.cooldownUntil && k.cooldownUntil > Date.now());
            attempts.push({
                provider: provider.id,
                model,
                reason: cooling.length
                    ? `all ${pool.length} key(s) rate limited — retry in ${Math.ceil((Math.min(...cooling.map((k) => k.cooldownUntil!)) - Date.now()) / 1000)}s`
                    : `all ${pool.length} key(s) were rejected — check them in API Keys`,
            });
            continue;
        }

        for (const entry of usable) {
            try {
                const text = await callProvider(provider, model, req, entry.key);
                recordOutcome(provider.id, entry.id, { ok: true });
                return { text, provider: provider.id, model, keyId: entry.id, attempts };
            } catch (err) {
                if (req.signal?.aborted) throw err;
                const status = err instanceof ProviderHttpError ? err.status : undefined;
                const retryAfterSec = err instanceof ProviderHttpError ? err.retryAfterSec : undefined;
                const reason = describeError(err, provider);
                recordOutcome(provider.id, entry.id, { ok: false, status, error: reason, retryAfterSec });
                attempts.push({
                    provider: provider.id,
                    model,
                    keyLabel: keyLabelOf(entry, pool),
                    reason,
                });

                // A 404 means the MODEL is wrong, not the key — trying the same
                // request on four more keys of the same provider would fail
                // identically and burn four requests to learn nothing.
                if (status === 404 || status === 400) break;
            }
        }
    }

    // "Unconfigured" means nothing that needs a key has one. The keyless
    // providers (local Ollama, the server relay) failing on their own does not
    // tell the user anything they can act on.
    throw new AllProvidersFailedError(attempts, !hasAnyKey());
}

/** A short human handle for a key, for error text — never the secret itself. */
function keyLabelOf(entry: KeyEntry, pool: KeyEntry[]): string {
    if (entry.label) return entry.label;
    const index = pool.findIndex((k) => k.id === entry.id);
    return `key ${index + 1}`;
}

/** The model to use for a provider when the user has not chosen one. */
export function preferredModelFor(p: ProviderDef): string | undefined {
    try {
        const saved = localStorage.getItem(`jackie_ai_model_${p.id}`);
        if (saved) return saved;
    } catch {
        /* fall through to the seed */
    }
    return p.seedModels[0];
}

export function setPreferredModel(providerId: string, model: string): void {
    try {
        localStorage.setItem(`jackie_ai_model_${providerId}`, model);
    } catch {
        /* private mode */
    }
}

/** Convenience for one-shot prompts. */
export async function ask(prompt: string, system?: string, model?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const result = await chat({ messages, model });
    return result.text;
}
