/**
 * Provider catalog — every place Jackie can get an answer from.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Chat failed with "Load failed" on every send, for three stacked reasons:
 *
 *   1. Jackie called `/api/gemini/generate` directly with no fallback. That
 *      route only exists when the Express host (server.ts) is running; on a
 *      statically-hosted build there is nothing behind it, so the fetch fails
 *      at the network level — which is exactly the error Safari words as
 *      "Load failed".
 *   2. Every model id in the tree was invented: `gemini-3-flash-preview`,
 *      `gemini-3.5-flash`, `gemini-3.1-pro-preview`. None of those exist, so
 *      even a correct key with a reachable relay would have 404'd.
 *   3. `lib/ai/providers.ts` + the micro-router already described a
 *      multi-provider fallback chain, but nothing in the UI imported them.
 *      The capability existed on paper only.
 *
 * The fix for (2) is structural rather than a better guess: model lists are
 * DISCOVERED at runtime from each provider's own models endpoint (see
 * `discovery.ts`). The few ids named below are seeds so a provider is usable
 * before discovery returns — the live list always wins.
 *
 * ADDING A PROVIDER is one entry here. Nothing else changes: the gateway
 * dispatches on `wire`, and the picker, fallback chain and key manager all
 * read this array.
 */

/**
 * The request/response shape a provider speaks.
 *
 * Most of the industry has standardised on OpenAI's `/chat/completions`, so
 * one adapter covers OpenRouter, Groq, Cerebras, Mistral, Together, DeepSeek,
 * xAI, OpenAI, GitHub Models and Ollama. Google and Anthropic each need their
 * own, and the Jackie relay has its own thin envelope.
 */
import { addKey, listKeys, nextUsableKey } from './keyring';
import { customProviderDefs } from './customProviders';

export type WireFormat = 'openai' | 'gemini' | 'anthropic' | 'jackie-relay';

/** How the key is presented. */
export type AuthStyle =
  | { kind: 'bearer' }                       // Authorization: Bearer <key>
  | { kind: 'header'; name: string }         // <name>: <key>
  | { kind: 'none' };                        // local or server-side relay

export interface ProviderDef {
  id: string;
  label: string;
  /** Shown in the picker so the cost of a choice is legible. */
  tier: 'free' | 'freemium' | 'paid' | 'local' | 'relay';
  wire: WireFormat;
  /** Chat completions endpoint. */
  endpoint: string;
  /** Models list endpoint, when the provider exposes one. */
  modelsEndpoint?: string;
  auth: AuthStyle;
  /** localStorage key holding the user's key for this provider. */
  keyName?: string;
  /** Where to get a key — surfaced in the UI, never fetched. */
  keyUrl?: string;
  /** Seeds, used until discovery returns. Never treated as authoritative. */
  seedModels: string[];
  /** Ordering for the automatic fallback chain; lower is tried first. */
  priority: number;
  notes?: string;
  /** True for user-added providers (the "Others" section). */
  custom?: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  /* ── The breadth play ──────────────────────────────────────────────────
     One key, 300+ models, dozens of them free (`:free` suffix). This is what
     makes "hundreds of options" true rather than aspirational. */
  {
    id: 'openrouter',
    label: 'OpenRouter',
    tier: 'freemium',
    wire: 'openai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'openrouter',
    keyUrl: 'https://openrouter.ai/keys',
    seedModels: [
      'deepseek/deepseek-chat-v3.1:free',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free',
    ],
    priority: 1,
    notes: 'One key unlocks every model on the network. Models ending in :free cost nothing.',
  },

  /* ── Native free tiers ─────────────────────────────────────────────── */
  {
    id: 'gemini',
    label: 'Google Gemini',
    tier: 'free',
    wire: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    auth: { kind: 'header', name: 'x-goog-api-key' },
    keyName: 'gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    seedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    priority: 2,
    notes: 'Generous free tier from AI Studio. No card required.',
  },
  {
    id: 'groq',
    label: 'Groq',
    tier: 'free',
    wire: 'openai',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'groq',
    keyUrl: 'https://console.groq.com/keys',
    seedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    priority: 3,
    notes: 'Free tier, and the fastest tokens/sec of anything here.',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    tier: 'free',
    wire: 'openai',
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    modelsEndpoint: 'https://api.cerebras.ai/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'cerebras',
    keyUrl: 'https://cloud.cerebras.ai/',
    seedModels: ['llama-3.3-70b', 'llama3.1-8b'],
    priority: 4,
    notes: 'Free tier with very high throughput.',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    tier: 'free',
    wire: 'openai',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    modelsEndpoint: 'https://api.mistral.ai/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'mistral',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    seedModels: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-nemo'],
    priority: 5,
    notes: 'Free experimental tier on La Plateforme.',
  },
  {
    id: 'github-models',
    label: 'GitHub Models',
    tier: 'free',
    wire: 'openai',
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    modelsEndpoint: 'https://models.inference.ai.azure.com/models',
    auth: { kind: 'bearer' },
    keyName: 'github',
    keyUrl: 'https://github.com/settings/tokens',
    seedModels: ['gpt-4o-mini', 'gpt-4o', 'Llama-3.3-70B-Instruct'],
    priority: 6,
    notes: 'Free with any GitHub personal access token. Rate limited, no card.',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    tier: 'free',
    wire: 'openai',
    endpoint: 'https://router.huggingface.co/v1/chat/completions',
    modelsEndpoint: 'https://router.huggingface.co/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'huggingface',
    keyUrl: 'https://huggingface.co/settings/tokens',
    seedModels: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
    priority: 7,
    notes: 'Free inference credits on a HF token.',
  },

  /* ── Local: no key, no network, no cost ────────────────────────────────
     Priority is deliberately BELOW the cloud free tiers. Ollama was priority
     0 before, which meant every phone tried to reach http://localhost:11434
     first — a request that cannot succeed from a phone and, on an https page,
     is blocked as mixed content before it is even sent. That was a large part
     of why chat appeared to fail instantly. */
  {
    id: 'ollama',
    label: 'Ollama (local)',
    tier: 'local',
    wire: 'openai',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    modelsEndpoint: 'http://localhost:11434/v1/models',
    auth: { kind: 'none' },
    seedModels: ['llama3.2', 'qwen2.5-coder'],
    priority: 20,
    notes: 'Runs on your own machine. Only reachable from that same machine.',
  },

  /* ── The server relay ──────────────────────────────────────────────────
     Only real when server.ts is hosting the app. Kept last so a static
     deployment never fails on it first. */
  {
    id: 'jackie-relay',
    label: 'Jackie server relay',
    tier: 'relay',
    wire: 'jackie-relay',
    endpoint: '/api/gemini/generate',
    auth: { kind: 'none' },
    seedModels: ['gemini-2.5-flash'],
    priority: 30,
    notes: 'Uses the key on the server, when the Express host is running.',
  },

  /* ── Paid, advertised rather than assumed ───────────────────────────── */
  {
    id: 'openai',
    label: 'OpenAI',
    tier: 'paid',
    wire: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'openai',
    keyUrl: 'https://platform.openai.com/api-keys',
    seedModels: ['gpt-4o', 'gpt-4o-mini'],
    priority: 40,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    tier: 'paid',
    wire: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelsEndpoint: 'https://api.anthropic.com/v1/models',
    auth: { kind: 'header', name: 'x-api-key' },
    keyName: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    seedModels: ['claude-sonnet-4-5', 'claude-opus-4-1'],
    priority: 41,
    notes: 'Browser calls need anthropic-dangerous-direct-browser-access.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    tier: 'paid',
    wire: 'openai',
    endpoint: 'https://api.deepseek.com/chat/completions',
    modelsEndpoint: 'https://api.deepseek.com/models',
    auth: { kind: 'bearer' },
    keyName: 'deepseek',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    seedModels: ['deepseek-chat', 'deepseek-reasoner'],
    priority: 42,
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    tier: 'paid',
    wire: 'openai',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    modelsEndpoint: 'https://api.x.ai/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'xai',
    keyUrl: 'https://console.x.ai/',
    seedModels: ['grok-2-latest'],
    priority: 43,
  },
  {
    id: 'together',
    label: 'Together AI',
    tier: 'freemium',
    wire: 'openai',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    modelsEndpoint: 'https://api.together.xyz/v1/models',
    auth: { kind: 'bearer' },
    keyName: 'together',
    keyUrl: 'https://api.together.xyz/settings/api-keys',
    seedModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo-Free'],
    priority: 44,
    notes: 'Some models are free; the rest are pay-as-you-go.',
  },
];

/**
 * Every provider: the built-ins above plus anything the user added in the
 * "Others" section. Recomputed per call rather than cached, because a custom
 * provider added in Settings must be usable immediately, without a reload.
 */
export function allProviders(): ProviderDef[] {
    return [...PROVIDERS, ...customProviderDefs()].sort((a, b) => a.priority - b.priority);
}

export function getProvider(id: string): ProviderDef | undefined {
    return allProviders().find((p) => p.id === id);
}

/** A fully-qualified model reference: `provider:model-id`. */
export interface ModelRef {
    provider: string;
    model: string;
}

/** Parse `openrouter:deepseek/deepseek-chat:free` → provider + model.
 *  Split on the FIRST colon only: model ids contain colons (`:free`). */
export function parseModelRef(ref: string): ModelRef | null {
    const idx = ref.indexOf(':');
    if (idx <= 0) return null;
    const provider = ref.slice(0, idx);
    const model = ref.slice(idx + 1);
    if (!provider || !model || !getProvider(provider)) return null;
    return { provider, model };
}

export function formatModelRef(provider: string, model: string): string {
    return `${provider}:${model}`;
}

/* ── keys ──────────────────────────────────────────────────────────────
   Storage lives in `keyring.ts`, which holds MANY keys per provider and
   tracks each one's health. These wrappers are what the rest of the app
   calls, so no call site needs to know about rotation. */

/** The key to use right now, honouring cooldowns. Null when none is usable. */
export function getApiKey(providerId: string): string | null {
    return nextUsableKey(providerId)?.key ?? null;
}

/** Add a key to a provider's pool. */
export function setApiKey(providerId: string, key: string): void {
    const trimmed = key.trim();
    if (!trimmed) return;
    addKey(providerId, trimmed);
}

/** Does this provider have what it needs to be called right now? */
export function isProviderReady(p: ProviderDef): boolean {
    if (p.auth.kind === 'none') return true;
    return listKeys(p.id).length > 0;
}

/** Providers that can actually be called, best first. */
export function readyProviders(): ProviderDef[] {
    return allProviders().filter(isProviderReady).sort((a, b) => a.priority - b.priority);
}
