/**
 * AI Providers — keys, model discovery, and the picker.
 *
 * One screen that answers "why won't it answer me?": which providers are
 * configured, what each one costs, how many models it actually offers, and
 * a live connection test per provider.
 *
 * Keys are the user's own and stay in this browser's localStorage. They are
 * sent only to the provider they belong to, never to Jackie's server.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Check,
    ExternalLink,
    Eye,
    EyeOff,
    Loader2,
    RefreshCw,
    Search,
    Sparkles,
    X,
    Zap,
} from 'lucide-react';
import {
    getApiKey,
    isProviderReady,
    PROVIDERS,
    setApiKey,
    type ProviderDef,
} from '../../lib/ai/catalog';
import { clearModelCache, discoverAll, type DiscoveredModel } from '../../lib/ai/discovery';
import { chat } from '../../lib/ai/gateway';

const SELECTED_KEY = 'jackie_ai_selected_model';

const TIER_STYLE: Record<ProviderDef['tier'], { label: string; className: string }> = {
    free: { label: 'FREE', className: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' },
    freemium: { label: 'FREE TIER', className: 'bg-teal-900/50 text-teal-300 border-teal-700/50' },
    paid: { label: 'PAID', className: 'bg-amber-900/40 text-amber-300 border-amber-700/40' },
    local: { label: 'LOCAL', className: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50' },
    relay: { label: 'SERVER', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
};

export const AiProvidersApp: React.FC = () => {
    const [tab, setTab] = useState<'models' | 'keys'>('models');
    const [models, setModels] = useState<DiscoveredModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [freeOnly, setFreeOnly] = useState(false);
    const [selected, setSelected] = useState<string | null>(() => {
        try {
            return localStorage.getItem(SELECTED_KEY);
        } catch {
            return null;
        }
    });

    const load = useCallback(async (force = false) => {
        setLoading(true);
        if (force) clearModelCache();
        setModels(await discoverAll(force));
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return models.filter((m) => {
            if (freeOnly && !m.free) return false;
            if (!q) return true;
            return m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.providerLabel.toLowerCase().includes(q);
        });
    }, [models, query, freeOnly]);

    const freeCount = useMemo(() => models.filter((m) => m.free).length, [models]);

    function choose(ref: string) {
        setSelected(ref);
        try {
            localStorage.setItem(SELECTED_KEY, ref);
        } catch {
            /* private mode — the choice just will not persist */
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200 font-sans">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                <Sparkles size={16} className="text-indigo-400" />
                <h1 className="text-sm font-bold">AI Providers</h1>
                <span className="text-[10px] text-zinc-500 ml-1">
                    {loading ? 'discovering…' : `${models.length} models · ${freeCount} free`}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    {(['models', 'keys'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                                tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                    <button
                        onClick={() => void load(true)}
                        title="Re-discover models"
                        className="p-1.5 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {tab === 'models' ? (
                <>
                    <div className="p-3 border-b border-zinc-800 shrink-0 space-y-2">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search models…"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-2 py-1.5 text-xs outline-none focus:border-indigo-500/60 placeholder:text-zinc-600"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer w-fit">
                            <input
                                type="checkbox"
                                checked={freeOnly}
                                onChange={(e) => setFreeOnly(e.target.checked)}
                                className="accent-emerald-500"
                            />
                            Only models that cost nothing
                        </label>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-600">
                                <Loader2 size={18} className="animate-spin mx-auto" />
                            </div>
                        ) : visible.length === 0 ? (
                            <p className="p-8 text-center text-xs text-zinc-600">
                                {models.length === 0
                                    ? 'No providers configured yet — add a key in the Keys tab.'
                                    : `Nothing matches “${query}”.`}
                            </p>
                        ) : (
                            visible.map((m) => (
                                <button
                                    key={m.ref}
                                    onClick={() => choose(m.ref)}
                                    className={`w-full text-left px-3 py-2 border-b border-zinc-900 flex items-center gap-2 transition-colors ${
                                        selected === m.ref ? 'bg-indigo-950/40' : 'hover:bg-zinc-900/60'
                                    }`}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-medium truncate">{m.label}</span>
                                        <span className="block text-[10px] text-zinc-500 truncate font-mono">{m.id}</span>
                                    </span>
                                    {m.contextLength ? (
                                        <span className="text-[9px] text-zinc-600 shrink-0">
                                            {Math.round(m.contextLength / 1000)}k
                                        </span>
                                    ) : null}
                                    {m.free && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-emerald-900/50 text-emerald-300 border-emerald-700/50 shrink-0">
                                            FREE
                                        </span>
                                    )}
                                    <span className="text-[9px] text-zinc-500 shrink-0 w-20 text-right truncate">
                                        {m.providerLabel}
                                    </span>
                                    {selected === m.ref && <Check size={13} className="text-indigo-400 shrink-0" />}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="px-3 py-2 border-t border-zinc-800 text-[10px] text-zinc-500 shrink-0">
                        {selected ? (
                            <>Jackie will use <span className="text-zinc-300 font-mono">{selected}</span>, falling back automatically if it fails.</>
                        ) : (
                            <>No model pinned — Jackie tries every configured provider in order.</>
                        )}
                    </div>
                </>
            ) : (
                <KeysTab onChanged={() => void load(true)} />
            )}
        </div>
    );
};

const KeysTab: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <p className="text-[11px] text-zinc-500 mb-3">
                Keys stay in this browser and are sent only to the provider they belong to.
                Start with a free one — Gemini, Groq and OpenRouter need no card.
            </p>
            {PROVIDERS.filter((p) => p.keyName).map((p) => (
                <ProviderKeyRow key={p.id} provider={p} onChanged={onChanged} />
            ))}
            {PROVIDERS.filter((p) => !p.keyName).map((p) => (
                <div key={p.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{p.label}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TIER_STYLE[p.tier].className}`}>
                            {TIER_STYLE[p.tier].label}
                        </span>
                        <span className="ml-auto text-[10px] text-zinc-500">no key needed</span>
                    </div>
                    {p.notes && <p className="text-[10px] text-zinc-500 mt-1">{p.notes}</p>}
                </div>
            ))}
        </div>
    );
};

const ProviderKeyRow: React.FC<{ provider: ProviderDef; onChanged: () => void }> = ({ provider, onChanged }) => {
    const [value, setValue] = useState(() => getApiKey(provider.id) || '');
    const [reveal, setReveal] = useState(false);
    const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'fail'; detail?: string }>({ state: 'idle' });

    const ready = isProviderReady(provider);

    function save(next: string) {
        setValue(next);
        setApiKey(provider.id, next.trim());
        setTest({ state: 'idle' });
        onChanged();
    }

    async function runTest() {
        setTest({ state: 'running' });
        try {
            const res = await chat({
                messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
                model: `${provider.id}:${provider.seedModels[0]}`,
                maxTokens: 16,
            });
            // The chain can succeed via a *different* provider; that would be a
            // misleading pass, so confirm who actually answered.
            if (res.provider !== provider.id) {
                setTest({ state: 'fail', detail: `fell back to ${res.provider} — this provider did not answer` });
            } else {
                setTest({ state: 'ok', detail: res.text.slice(0, 40) });
            }
        } catch (err) {
            setTest({ state: 'fail', detail: err instanceof Error ? err.message.slice(0, 160) : 'failed' });
        }
    }

    return (
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium">{provider.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TIER_STYLE[provider.tier].className}`}>
                    {TIER_STYLE[provider.tier].label}
                </span>
                {ready && <Check size={12} className="text-emerald-400" />}
                {provider.keyUrl && (
                    <a
                        href={provider.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                        get a key <ExternalLink size={9} />
                    </a>
                )}
            </div>
            {provider.notes && <p className="text-[10px] text-zinc-500 mb-2">{provider.notes}</p>}
            <div className="flex items-center gap-1.5">
                <input
                    type={reveal ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => save(e.target.value)}
                    placeholder="paste key…"
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-indigo-500/60 placeholder:text-zinc-700"
                />
                <button
                    onClick={() => setReveal((v) => !v)}
                    className="p-1.5 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    title={reveal ? 'Hide' : 'Reveal'}
                >
                    {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                    onClick={runTest}
                    disabled={!ready || test.state === 'running'}
                    className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] disabled:opacity-40 flex items-center gap-1"
                    title="Send a one-word prompt through this provider"
                >
                    {test.state === 'running' ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                    Test
                </button>
            </div>
            {test.state === 'ok' && (
                <p className="mt-1.5 text-[10px] text-emerald-400 flex items-center gap-1">
                    <Check size={10} /> working — replied “{test.detail}”
                </p>
            )}
            {test.state === 'fail' && (
                <p className="mt-1.5 text-[10px] text-red-400 flex items-start gap-1">
                    <X size={10} className="mt-0.5 shrink-0" /> {test.detail}
                </p>
            )}
        </div>
    );
};

export default AiProvidersApp;
