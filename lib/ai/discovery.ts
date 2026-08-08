/**
 * Model discovery — ask each provider what it actually has.
 *
 * The tree previously hardcoded model ids that did not exist
 * (`gemini-3-flash-preview`, `gemini-3.5-flash`), so calls 404'd even when
 * the key and endpoint were fine. Hardcoding is the bug: model names change
 * every few weeks, and no list written by hand stays true.
 *
 * So the catalog carries only seeds, and the real list is fetched from each
 * provider's own models endpoint. OpenRouter alone returns 300+, which is
 * what makes "hundreds of options" a fact about the running app rather than a
 * claim. A provider that cannot be reached simply contributes its seeds.
 *
 * Results are cached, because a picker that refetches 300 models on every
 * keystroke is its own kind of broken.
 */
import { getApiKey, getProvider, isProviderReady, PROVIDERS, type ProviderDef } from './catalog';

export interface DiscoveredModel {
    /** `provider:model` — what the gateway takes. */
    ref: string;
    provider: string;
    providerLabel: string;
    /** The provider's own id for this model. */
    id: string;
    label: string;
    /** True when the model costs nothing to call. */
    free: boolean;
    contextLength?: number;
    tier: ProviderDef['tier'];
}

const CACHE_KEY = 'jackie_ai_model_cache_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — model lists move, but not hourly.

interface CacheEntry {
    at: number;
    models: DiscoveredModel[];
}

function readCache(): Record<string, CacheEntry> {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeCache(cache: Record<string, CacheEntry>): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        /* quota — discovery still works, it just refetches next time */
    }
}

function seedModels(p: ProviderDef): DiscoveredModel[] {
    return p.seedModels.map((id) => ({
        ref: `${p.id}:${id}`,
        provider: p.id,
        providerLabel: p.label,
        id,
        label: id,
        free: p.tier === 'free' || p.tier === 'local' || id.endsWith(':free'),
        tier: p.tier,
    }));
}

/** Normalize the several shapes providers use for a models list. */
function parseModelsResponse(p: ProviderDef, data: unknown): DiscoveredModel[] {
    const out: DiscoveredModel[] = [];

    // Gemini: { models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods }] }
    if (p.wire === 'gemini') {
        const models = (data as { models?: unknown[] })?.models ?? [];
        for (const m of models as { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[]) {
            if (!m.name) continue;
            // Embedding and legacy models cannot answer a chat turn.
            if (m.supportedGenerationMethods && !m.supportedGenerationMethods.includes('generateContent')) continue;
            const id = m.name.replace(/^models\//, '');
            out.push({
                ref: `${p.id}:${id}`,
                provider: p.id,
                providerLabel: p.label,
                id,
                label: m.displayName || id,
                free: true,
                tier: p.tier,
            });
        }
        return out;
    }

    // Anthropic: { data: [{ id, display_name }] }
    // OpenAI-compatible: { data: [{ id }] }
    // OpenRouter: { data: [{ id, name, context_length, pricing: { prompt, completion } }] }
    const rows = (data as { data?: unknown[] })?.data ?? (Array.isArray(data) ? data : []);
    for (const raw of rows as {
        id?: string;
        name?: string;
        display_name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
    }[]) {
        if (!raw.id) continue;
        // OpenRouter prices are decimal strings; "0" on both sides means free.
        const free =
            raw.id.endsWith(':free') ||
            p.tier === 'free' ||
            p.tier === 'local' ||
            (raw.pricing ? Number(raw.pricing.prompt) === 0 && Number(raw.pricing.completion) === 0 : false);
        out.push({
            ref: `${p.id}:${raw.id}`,
            provider: p.id,
            providerLabel: p.label,
            id: raw.id,
            label: raw.name || raw.display_name || raw.id,
            free,
            contextLength: raw.context_length,
            tier: p.tier,
        });
    }
    return out;
}

/** Fetch one provider's catalogue. Falls back to seeds on any failure. */
export async function discoverProvider(p: ProviderDef, force = false): Promise<DiscoveredModel[]> {
    if (!p.modelsEndpoint) return seedModels(p);

    const cache = readCache();
    const hit = cache[p.id];
    if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS && hit.models.length) {
        return hit.models;
    }

    if (!isProviderReady(p)) return seedModels(p);

    try {
        const headers: Record<string, string> = {};
        const key = getApiKey(p.id);
        if (p.auth.kind === 'bearer' && key) headers.Authorization = `Bearer ${key}`;
        if (p.auth.kind === 'header' && key) headers[p.auth.name] = key;
        if (p.id === 'anthropic') {
            headers['anthropic-version'] = '2023-06-01';
            headers['anthropic-dangerous-direct-browser-access'] = 'true';
        }

        const res = await fetch(p.modelsEndpoint, { headers });
        if (!res.ok) return seedModels(p);
        const models = parseModelsResponse(p, await res.json());
        if (!models.length) return seedModels(p);

        cache[p.id] = { at: Date.now(), models };
        writeCache(cache);
        return models;
    } catch {
        // Unreachable provider (offline, CORS, local Ollama on a phone) —
        // seeds keep it selectable rather than making it vanish.
        return seedModels(p);
    }
}

/**
 * Every model the user could pick right now, across every provider.
 * Providers are queried in parallel; one slow provider cannot stall the list.
 */
export async function discoverAll(force = false): Promise<DiscoveredModel[]> {
    const lists = await Promise.all(PROVIDERS.map((p) => discoverProvider(p, force)));
    const all = lists.flat();

    // Free first, then by provider priority, then alphabetically — so the
    // options that cost nothing are the ones in reach.
    return all.sort((a, b) => {
        if (a.free !== b.free) return a.free ? -1 : 1;
        const pa = getProvider(a.provider)?.priority ?? 99;
        const pb = getProvider(b.provider)?.priority ?? 99;
        if (pa !== pb) return pa - pb;
        return a.label.localeCompare(b.label);
    });
}

/** Drop every cached list, e.g. after adding a key. */
export function clearModelCache(): void {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch {
        /* nothing cached */
    }
}
