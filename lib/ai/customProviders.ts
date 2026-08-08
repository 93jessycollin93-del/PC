/**
 * Custom providers — the "Others" section.
 *
 * The built-in catalog names the providers that exist today. New ones launch
 * constantly, and waiting for a release to use one is the wrong shape: this
 * lets any provider be added at runtime with a name, a URL and a key.
 *
 * The reason this works in practice is that OpenAI's /chat/completions has
 * become the de facto interface — nearly every new entrant ships it, often
 * as their only API. So `openai` is the default wire format, and for most
 * future launches "add a provider" really is just pasting a base URL.
 *
 * A custom provider is not second-class: it joins the same catalog, the same
 * fallback chain, the same keyring (so it gets multiple keys and rotation
 * too), and the same test button.
 */
import type { AuthStyle, ProviderDef, WireFormat } from './catalog';

const STORAGE_KEY = 'jackie_custom_providers_v1';

export interface CustomProviderInput {
    id?: string;
    label: string;
    /** Full chat-completions URL. */
    endpoint: string;
    /** Optional models list URL, for discovery. */
    modelsEndpoint?: string;
    wire: WireFormat;
    /** How the key is sent. Most providers use a bearer token. */
    authKind: 'bearer' | 'header' | 'none';
    /** Header name when authKind is 'header'. */
    authHeader?: string;
    /** Comma-separated seed models, used until discovery returns. */
    seedModels: string[];
    keyUrl?: string;
    notes?: string;
}

export interface CustomProvider extends CustomProviderInput {
    id: string;
    createdAt: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeCustom(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* one bad listener must not break a save */
        }
    });
}

export function listCustomProviders(): CustomProvider[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((p): p is CustomProvider => !!p && typeof p.id === 'string' && typeof p.endpoint === 'string');
    } catch {
        return [];
    }
}

function persist(list: CustomProvider[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        /* quota — the provider stays for this session only */
    }
    notify();
}

/** Ids are prefixed so a custom provider can never shadow a built-in one. */
export function customId(label: string): string {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'provider';
    return `custom-${slug}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ValidationResult {
    ok: boolean;
    error?: string;
}

/** Reject the mistakes that would otherwise surface as a confusing runtime error. */
export function validateCustomProvider(input: CustomProviderInput): ValidationResult {
    if (!input.label.trim()) return { ok: false, error: 'Give it a name.' };
    if (!input.endpoint.trim()) return { ok: false, error: 'An endpoint URL is required.' };
    let url: URL;
    try {
        url = new URL(input.endpoint);
    } catch {
        return { ok: false, error: 'That endpoint is not a valid URL.' };
    }
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        // A secure page cannot call plain http; better to say so now than to
        // let it fail later as an unexplained network error.
        return { ok: false, error: 'Use https — a secure page cannot call a plain http endpoint (localhost excepted).' };
    }
    if (input.authKind === 'header' && !input.authHeader?.trim()) {
        return { ok: false, error: 'Name the header the key goes in.' };
    }
    if (input.seedModels.length === 0) {
        return { ok: false, error: 'Add at least one model id.' };
    }
    return { ok: true };
}

export function saveCustomProvider(input: CustomProviderInput): { ok: boolean; error?: string; id?: string } {
    const check = validateCustomProvider(input);
    if (!check.ok) return { ok: false, error: check.error };

    const list = listCustomProviders();
    const id = input.id || customId(input.label);
    const existing = list.findIndex((p) => p.id === id);
    const record: CustomProvider = {
        ...input,
        id,
        label: input.label.trim(),
        endpoint: input.endpoint.trim(),
        modelsEndpoint: input.modelsEndpoint?.trim() || undefined,
        createdAt: existing >= 0 ? list[existing].createdAt : Date.now(),
    };
    if (existing >= 0) list[existing] = record;
    else list.push(record);
    persist(list);
    return { ok: true, id };
}

export function deleteCustomProvider(id: string): void {
    persist(listCustomProviders().filter((p) => p.id !== id));
}

function toAuthStyle(p: CustomProvider): AuthStyle {
    if (p.authKind === 'bearer') return { kind: 'bearer' };
    if (p.authKind === 'header') return { kind: 'header', name: p.authHeader || 'x-api-key' };
    return { kind: 'none' };
}

/** Project a custom provider into the shape the gateway already understands. */
export function toProviderDef(p: CustomProvider): ProviderDef {
    return {
        id: p.id,
        label: p.label,
        // Cost is unknowable for an arbitrary endpoint, so it is not implied.
        tier: 'freemium',
        wire: p.wire,
        endpoint: p.endpoint,
        modelsEndpoint: p.modelsEndpoint,
        auth: toAuthStyle(p),
        keyName: p.authKind === 'none' ? undefined : p.id,
        keyUrl: p.keyUrl,
        seedModels: p.seedModels,
        // Below every built-in: a hand-added endpoint should not silently
        // take priority over a known-good free tier.
        priority: 60,
        notes: p.notes,
        custom: true,
    };
}

export function customProviderDefs(): ProviderDef[] {
    return listCustomProviders().map(toProviderDef);
}
