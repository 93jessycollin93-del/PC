/**
 * API Keys — the real one.
 *
 * This replaces a screen that wrote five flat localStorage entries nothing
 * read, so a key typed here never reached the AI gateway and chat kept
 * insisting no provider was configured. Everything now goes through
 * `lib/ai/keyring.ts`, which is the single store the gateway uses.
 *
 * What it does that the old one could not:
 *   • MANY KEYS PER PROVIDER. Free tiers are per-account, so several Groq
 *     accounts are several allowances. Add as many as you like; the gateway
 *     rides one until it rate-limits, then moves to the next.
 *   • LIVE HEALTH. Each key shows ok / cooling (with a countdown) / rejected,
 *     so you can see which account still has room before you send.
 *   • OTHERS. Any provider that does not exist yet can be added by hand.
 *   • TESTING. Per-key and sweep-everything, asserting that the specific key
 *     answered rather than trusting a silent fallback.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    Key as KeyIcon,
    Loader2,
    Plus,
    RefreshCw,
    Trash2,
    Lock,
    LockOpen,
    Shield,
    ShieldAlert,
    Upload,
    X,
    Zap,
} from 'lucide-react';
import { allProviders, type ProviderDef, type WireFormat } from '../../lib/ai/catalog';
import {
    addKey,
    exportKeyring,
    importKeyring,
    listKeys,
    migrate,
    moveKey,
    removeKey,
    resetStatuses,
    subscribe,
    updateKey,
    type KeyEntry,
} from '../../lib/ai/keyring';
import { deleteCustomProvider, listCustomProviders, saveCustomProvider } from '../../lib/ai/customProviders';
import {
    disableEncryption,
    enableEncryption,
    isEncrypted,
    isLocked,
    lockNow,
    unlock,
} from '../../lib/ai/keyring';
import { lockedAt, passphraseStrength, subscribeVault } from '../../lib/ai/keyringVault';
import { chat } from '../../lib/ai/gateway';
import { clearModelCache } from '../../lib/ai/discovery';

const TIER: Record<ProviderDef['tier'], { label: string; cls: string }> = {
    free: { label: 'FREE', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' },
    freemium: { label: 'FREE TIER', cls: 'bg-teal-900/50 text-teal-300 border-teal-700/50' },
    paid: { label: 'PAID', cls: 'bg-amber-900/40 text-amber-300 border-amber-700/40' },
    local: { label: 'LOCAL', cls: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50' },
    relay: { label: 'SERVER', cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
};

export const APIKeysApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [tab, setTab] = useState<'providers' | 'others' | 'security' | 'backup'>('providers');
    const [migrated, setMigrated] = useState<number | null>(null);
    const [sweeping, setSweeping] = useState(false);

    // Re-render on any keyring change, wherever it came from.
    useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

    // Pull anything the old screens saved into the keyring, once.
    useEffect(() => {
        const n = migrate();
        if (n > 0) setMigrated(n);
    }, []);

    // Cooldown countdowns need a heartbeat to tick down.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const providers = useMemo(() => allProviders(), [tick]);
    const builtIns = providers.filter((p) => !p.custom && p.keyName);
    const customs = providers.filter((p) => p.custom);

    const totalKeys = useMemo(
        () => providers.reduce((n, p) => n + listKeys(p.id).length, 0),
        [providers, tick],
    );

    async function sweep() {
        setSweeping(true);
        for (const p of providers) {
            for (const entry of listKeys(p.id)) {
                await testKey(p, entry);
            }
        }
        setSweeping(false);
    }

    return (
        <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200 font-sans">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                <KeyIcon size={16} className="text-amber-400" />
                <h1 className="text-sm font-bold">API Keys</h1>
                <span className="text-[10px] text-zinc-500">{totalKeys} key{totalKeys === 1 ? '' : 's'} stored</span>
                <div className="ml-auto flex items-center gap-1">
                    {(['providers', 'others', 'security', 'backup'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-2.5 py-1 rounded text-[11px] capitalize transition-colors ${
                                tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {migrated !== null && (
                <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-2 shrink-0">
                    <Check size={12} />
                    Imported {migrated} key{migrated === 1 ? '' : 's'} from the old settings — they work now.
                    <button onClick={() => setMigrated(null)} className="ml-auto text-emerald-500 hover:text-emerald-300">
                        <X size={12} />
                    </button>
                </div>
            )}

            {tab === 'providers' && (
                <>
                    <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2 shrink-0">
                        <button
                            onClick={sweep}
                            disabled={sweeping || totalKeys === 0}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] disabled:opacity-40"
                        >
                            {sweeping ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                            Test every key
                        </button>
                        <button
                            onClick={() => resetStatuses()}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px]"
                            title="Clear cooldowns and verdicts"
                        >
                            <RefreshCw size={11} /> Reset statuses
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {isLocked() && <LockedBanner onGo={() => setTab('security')} />}
                        <p className="text-[11px] text-zinc-500 mb-1">
                            Keys stay in this browser and are sent only to the provider they belong to.
                            Add several per provider — each one is a separate free allowance, and Jackie
                            moves to the next automatically when one runs out.
                        </p>
                        {builtIns.map((p) => (
                            <ProviderCard key={p.id} provider={p} tick={tick} />
                        ))}
                    </div>
                </>
            )}

            {tab === 'others' && <OthersTab tick={tick} customs={customs} />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'backup' && <BackupTab />}
        </div>
    );
};

/* ── testing ───────────────────────────────────────────────────────────── */

/**
 * Send a one-word prompt through ONE specific key.
 *
 * The gateway is a fallback chain, so a naive test can pass because some
 * *other* provider answered. Comparing the returned keyId is what makes this
 * a real assertion about this key rather than about the system as a whole.
 */
async function testKey(provider: ProviderDef, entry: KeyEntry): Promise<boolean> {
    try {
        const res = await chat({
            messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
            model: `${provider.id}:${provider.seedModels[0]}`,
            maxTokens: 16,
        });
        if (res.provider !== provider.id || res.keyId !== entry.id) {
            updateKey(provider.id, entry.id, {
                status: 'error',
                lastError: `did not answer — the chain fell through to ${res.provider}`,
            });
            return false;
        }
        return true;
    } catch {
        // recordOutcome inside the gateway already wrote the verdict.
        return false;
    }
}

/* ── provider card ─────────────────────────────────────────────────────── */

const ProviderCard: React.FC<{ provider: ProviderDef; tick: number }> = ({ provider, tick }) => {
    const keys = useMemo(() => listKeys(provider.id), [provider.id, tick]);
    const [expanded, setExpanded] = useState(false);
    const [draft, setDraft] = useState('');
    const [draftLabel, setDraftLabel] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const healthy = keys.filter((k) => k.status === 'ok').length;
    const cooling = keys.filter((k) => k.cooldownUntil && k.cooldownUntil > Date.now()).length;

    function add() {
        if (!draft.trim()) return;
        const created = addKey(provider.id, draft, draftLabel || undefined);
        if (!created) {
            // Duplicates are the common paste-twice mistake; say so quietly.
            setDraftLabel('');
            setDraft('');
            return;
        }
        setDraft('');
        setDraftLabel('');
        clearModelCache();
    }

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
            >
                <span className="text-xs font-medium">{provider.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TIER[provider.tier].cls}`}>
                    {TIER[provider.tier].label}
                </span>
                {keys.length > 0 && (
                    <span className="text-[10px] text-zinc-500">
                        {keys.length} key{keys.length === 1 ? '' : 's'}
                        {healthy > 0 && <span className="text-emerald-400"> · {healthy} ok</span>}
                        {cooling > 0 && <span className="text-amber-400"> · {cooling} cooling</span>}
                    </span>
                )}
                {keys.length === 0 && <span className="text-[10px] text-zinc-600">not set up</span>}
                <span className="ml-auto text-zinc-500">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>

            {expanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-zinc-800/60 pt-2">
                    {provider.notes && <p className="text-[10px] text-zinc-500">{provider.notes}</p>}
                    {provider.keyUrl && (
                        <a
                            href={provider.keyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                            get a key <ExternalLink size={9} />
                        </a>
                    )}

                    {keys.map((entry, i) => (
                        <KeyRow
                            key={entry.id}
                            provider={provider}
                            entry={entry}
                            index={i}
                            total={keys.length}
                            busy={busy === entry.id}
                            onTest={async () => {
                                setBusy(entry.id);
                                await testKey(provider, entry);
                                setBusy(null);
                            }}
                        />
                    ))}

                    {/* Add another — the whole point of the pool. */}
                    <div className="flex items-center gap-1.5 pt-1">
                        <input
                            value={draftLabel}
                            onChange={(e) => setDraftLabel(e.target.value)}
                            placeholder="label (optional)"
                            className="w-28 shrink-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500/60 placeholder:text-zinc-700"
                        />
                        <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') add();
                            }}
                            placeholder={keys.length ? 'add another key…' : 'paste key…'}
                            autoComplete="off"
                            spellCheck={false}
                            className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono outline-none focus:border-indigo-500/60 placeholder:text-zinc-700"
                        />
                        <button
                            onClick={add}
                            disabled={!draft.trim()}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                            title="Add key"
                        >
                            <Plus size={13} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── one key ───────────────────────────────────────────────────────────── */

const KeyRow: React.FC<{
    provider: ProviderDef;
    entry: KeyEntry;
    index: number;
    total: number;
    busy: boolean;
    onTest: () => void;
}> = ({ provider, entry, index, total, busy, onTest }) => {
    const [reveal, setReveal] = useState(false);
    const [value, setValue] = useState(entry.key);

    // Reflect edits made elsewhere (import, another tab) without clobbering
    // what is being typed here.
    useEffect(() => {
        setValue(entry.key);
    }, [entry.key]);

    const coolingFor =
        entry.cooldownUntil && entry.cooldownUntil > Date.now()
            ? Math.ceil((entry.cooldownUntil - Date.now()) / 1000)
            : 0;

    const badge = coolingFor
        ? { icon: <Clock size={10} />, text: `cooling ${coolingFor}s`, cls: 'text-amber-400' }
        : entry.status === 'ok'
          ? { icon: <Check size={10} />, text: `working${entry.uses ? ` · ${entry.uses} calls` : ''}`, cls: 'text-emerald-400' }
          : entry.status === 'rejected'
            ? { icon: <X size={10} />, text: 'rejected', cls: 'text-red-400' }
            : entry.status === 'error'
              ? { icon: <AlertCircle size={10} />, text: 'failed', cls: 'text-orange-400' }
              : { icon: null, text: 'untested', cls: 'text-zinc-600' };

    return (
        <div className="rounded border border-zinc-800/80 bg-zinc-950/60 p-2">
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 w-4 shrink-0">{index + 1}</span>
                <input
                    type={reveal ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => {
                        // Save on blur as well as on Enter: a key typed and then
                        // tapped away from must not be silently discarded.
                        if (value !== entry.key) updateKey(provider.id, entry.id, { key: value });
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent text-[11px] font-mono outline-none"
                />
                <button onClick={() => setReveal((v) => !v)} className="p-1 rounded text-zinc-500 hover:text-zinc-300">
                    {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                    onClick={onTest}
                    disabled={busy}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                    title="Test this key"
                >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                </button>
                {total > 1 && (
                    <>
                        <button
                            onClick={() => moveKey(provider.id, entry.id, -1)}
                            disabled={index === 0}
                            className="p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
                            title="Use earlier"
                        >
                            <ChevronUp size={12} />
                        </button>
                        <button
                            onClick={() => moveKey(provider.id, entry.id, 1)}
                            disabled={index === total - 1}
                            className="p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
                            title="Use later"
                        >
                            <ChevronDown size={12} />
                        </button>
                    </>
                )}
                <button
                    onClick={() => removeKey(provider.id, entry.id)}
                    className="p-1 rounded text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                    title="Remove"
                >
                    <Trash2 size={12} />
                </button>
            </div>
            <div className="flex items-center gap-2 mt-1 pl-5">
                <input
                    defaultValue={entry.label || ''}
                    onBlur={(e) => updateKey(provider.id, entry.id, { label: e.target.value })}
                    placeholder="label"
                    className="w-24 bg-transparent text-[10px] text-zinc-400 outline-none placeholder:text-zinc-700 border-b border-transparent focus:border-zinc-700"
                />
                <span className={`text-[10px] flex items-center gap-1 ${badge.cls}`}>
                    {badge.icon} {badge.text}
                </span>
                {entry.lastError && (
                    <span className="text-[9px] text-zinc-600 truncate flex-1" title={entry.lastError}>
                        {entry.lastError}
                    </span>
                )}
            </div>
        </div>
    );
};

/* ── Others ────────────────────────────────────────────────────────────── */

interface CustomForm {
    label: string;
    endpoint: string;
    modelsEndpoint: string;
    wire: WireFormat;
    authKind: 'bearer' | 'header' | 'none';
    authHeader: string;
    seedModelsText: string;
    keyUrl: string;
    notes: string;
}

const BLANK: CustomForm = {
    label: '',
    endpoint: '',
    modelsEndpoint: '',
    wire: 'openai',
    authKind: 'bearer',
    authHeader: '',
    seedModelsText: '',
    keyUrl: '',
    notes: '',
};

const OthersTab: React.FC<{ tick: number; customs: ProviderDef[] }> = ({ tick, customs }) => {
    const [form, setForm] = useState<CustomForm>({ ...BLANK });
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const existing = useMemo(() => listCustomProviders(), [tick]);

    function submit() {
        setError(null);
        const res = saveCustomProvider({
            label: form.label,
            endpoint: form.endpoint,
            modelsEndpoint: form.modelsEndpoint || undefined,
            wire: form.wire,
            authKind: form.authKind,
            authHeader: form.authHeader || undefined,
            seedModels: form.seedModelsText.split(',').map((s) => s.trim()).filter(Boolean),
            keyUrl: form.keyUrl || undefined,
            notes: form.notes || undefined,
        });
        if (!res.ok) {
            setError(res.error || 'Could not save.');
            return;
        }
        setForm({ ...BLANK });
        setSaved(true);
        clearModelCache();
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <p className="text-[11px] text-zinc-500">
                Add any provider that is not in the list — including ones that do not exist yet.
                Most new services ship an OpenAI-compatible API, so usually a base URL and a key
                are all it takes. Custom providers get multiple keys, rotation and testing just
                like the built-ins.
            </p>

            {existing.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-[10px] uppercase tracking-wider text-zinc-600">Your providers</h3>
                    {customs.map((p) => (
                        <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{p.label}</span>
                                <span className="text-[9px] text-zinc-600 font-mono truncate">{p.endpoint}</span>
                                <button
                                    onClick={() => deleteCustomProvider(p.id)}
                                    className="ml-auto p-1 rounded text-zinc-500 hover:bg-red-500/20 hover:text-red-400 shrink-0"
                                    title="Delete provider"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <ProviderCard provider={p} tick={tick} />
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <h3 className="text-xs font-bold flex items-center gap-1.5">
                    <Plus size={12} /> Add a provider
                </h3>
                <Field label="Name" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Acme AI" />
                <Field
                    label="Chat endpoint"
                    value={form.endpoint}
                    onChange={(v) => setForm({ ...form, endpoint: v })}
                    placeholder="https://api.acme.ai/v1/chat/completions"
                    mono
                />
                <Field
                    label="Models endpoint"
                    value={form.modelsEndpoint}
                    onChange={(v) => setForm({ ...form, modelsEndpoint: v })}
                    placeholder="https://api.acme.ai/v1/models (optional)"
                    mono
                />
                <Field
                    label="Model ids"
                    value={form.seedModelsText}
                    onChange={(v) => setForm({ ...form, seedModelsText: v })}
                    placeholder="acme-large, acme-small (comma separated)"
                    mono
                />
                <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className="block text-[10px] text-zinc-500 mb-1">API shape</span>
                        <select
                            value={form.wire}
                            onChange={(e) => setForm({ ...form, wire: e.target.value as WireFormat })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500/60"
                        >
                            <option value="openai">OpenAI-compatible (most common)</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="anthropic">Anthropic</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-[10px] text-zinc-500 mb-1">Key sent as</span>
                        <select
                            value={form.authKind}
                            onChange={(e) => setForm({ ...form, authKind: e.target.value as CustomForm['authKind'] })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500/60"
                        >
                            <option value="bearer">Authorization: Bearer</option>
                            <option value="header">Custom header</option>
                            <option value="none">No key</option>
                        </select>
                    </label>
                </div>
                {form.authKind === 'header' && (
                    <Field
                        label="Header name"
                        value={form.authHeader}
                        onChange={(v) => setForm({ ...form, authHeader: v })}
                        placeholder="x-api-key"
                        mono
                    />
                )}
                {error && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle size={10} /> {error}
                    </p>
                )}
                <button
                    onClick={submit}
                    className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors"
                >
                    {saved ? 'Added ✓' : 'Add provider'}
                </button>
            </div>
        </div>
    );
};

const Field: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}> = ({ label, value, onChange, placeholder, mono }) => (
    <label className="block">
        <span className="block text-[10px] text-zinc-500 mb-1">{label}</span>
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className={`w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500/60 placeholder:text-zinc-700 ${mono ? 'font-mono' : ''}`}
        />
    </label>
);

/* ── Backup ────────────────────────────────────────────────────────────── */

const BackupTab: React.FC = () => {
    const [importText, setImportText] = useState('');
    const [result, setResult] = useState<string | null>(null);

    function download() {
        const blob = new Blob([exportKeyring()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jackie-keyring.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function doImport() {
        const res = importKeyring(importText);
        setResult(res.error ? res.error : `Imported ${res.added} key${res.added === 1 ? '' : 's'}.`);
        if (!res.error) setImportText('');
    }

    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className="text-xs font-bold mb-1">Export</h3>
                <p className="text-[10px] text-zinc-500 mb-2">
                    Download every key so you can move to another device. This file contains your
                    keys in plain text — treat it like a password.
                </p>
                <button
                    onClick={download}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px]"
                >
                    <Download size={12} /> Download keyring
                </button>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className="text-xs font-bold mb-1">Import</h3>
                <p className="text-[10px] text-zinc-500 mb-2">
                    Paste an exported keyring. Keys are merged, not replaced — duplicates are skipped.
                </p>
                <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='{ "v": 1, "providers": { … } }'
                    rows={5}
                    spellCheck={false}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono outline-none focus:border-indigo-500/60 placeholder:text-zinc-700 resize-none"
                />
                <button
                    onClick={doImport}
                    disabled={!importText.trim()}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] disabled:opacity-40"
                >
                    <Upload size={12} /> Import
                </button>
                {result && <p className="mt-2 text-[10px] text-zinc-400">{result}</p>}
            </div>
        </div>
    );
};


/* ── Security ──────────────────────────────────────────────────────────── */

const LockedBanner: React.FC<{ onGo: () => void }> = ({ onGo }) => (
    <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 flex items-center gap-2">
        <Lock size={14} className="text-amber-400 shrink-0" />
        <div className="min-w-0">
            <p className="text-xs font-medium text-amber-200">Vault locked</p>
            <p className="text-[10px] text-amber-300/70">
                Your keys are encrypted. Nothing can use them until you unlock.
            </p>
        </div>
        <button
            onClick={onGo}
            className="ml-auto shrink-0 px-2.5 py-1 rounded bg-amber-800/60 hover:bg-amber-700/60 text-[11px] text-amber-100"
        >
            Unlock
        </button>
    </div>
);

const SecurityTab: React.FC = () => {
    const [, force] = useState(0);
    useEffect(() => subscribeVault(() => force((n) => n + 1)), []);

    const [pass, setPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exported, setExported] = useState(false);

    const encrypted = isEncrypted();
    const locked = isLocked();
    const strength = passphraseStrength(pass);

    async function turnOn() {
        setError(null);
        if (pass !== confirm) return setError('The two passphrases do not match.');
        setBusy(true);
        const res = await enableEncryption(pass);
        setBusy(false);
        if (!res.ok) return setError(res.error || 'Could not enable encryption.');
        setPass('');
        setConfirm('');
    }

    async function doUnlock() {
        setError(null);
        setBusy(true);
        const res = await unlock(pass);
        setBusy(false);
        if (!res.ok) return setError(res.error || 'Wrong passphrase.');
        setPass('');
    }

    function turnOff() {
        const res = disableEncryption();
        if (!res.ok) setError(res.error || 'Could not disable.');
    }

    function backupFirst() {
        const blob = new Blob([exportKeyring()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jackie-keyring-backup.json';
        a.click();
        URL.revokeObjectURL(url);
        setExported(true);
    }

    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* What this does and does not do. Stated plainly, because an
                overstated security claim is worse than none. */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className="text-xs font-bold flex items-center gap-1.5 mb-2">
                    <Shield size={12} className="text-indigo-400" /> What encryption here buys you
                </h3>
                <ul className="text-[10px] text-zinc-400 space-y-1 list-disc pl-4">
                    <li>
                        <strong className="text-zinc-300">Protects:</strong> anyone reading this
                        browser&rsquo;s storage while the vault is locked — a shared or borrowed
                        device, a synced profile, a stolen laptop.
                    </li>
                    <li>
                        <strong className="text-zinc-300">Does not protect:</strong> anything running
                        in the page while it is unlocked. The keys must be decrypted to send a
                        request, so at that moment they are readable in memory.
                    </li>
                    <li>
                        <strong className="text-amber-300">No recovery.</strong> Lose the passphrase
                        and the keys are gone — a recoverable secret is not encrypted. Export a
                        backup first.
                    </li>
                </ul>
            </div>

            {!encrypted && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                    <h3 className="text-xs font-bold flex items-center gap-1.5">
                        <LockOpen size={12} /> Encryption is off
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                        Off by default on purpose: these are usually free-tier keys you can re-issue
                        in a minute, and a passphrase every session is real friction. Turn it on if
                        this device is shared or the keys are paid.
                    </p>

                    <button
                        onClick={backupFirst}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px]"
                    >
                        <Download size={11} /> {exported ? 'Backup downloaded ✓' : '1. Download a backup first'}
                    </button>

                    <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="2. Choose a passphrase"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500/60 placeholder:text-zinc-700"
                    />
                    {pass && (
                        <p
                            className={`text-[10px] ${
                                strength.score >= 3
                                    ? 'text-emerald-400'
                                    : strength.score === 2
                                      ? 'text-teal-400'
                                      : strength.score === 1
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                            }`}
                        >
                            {strength.label}
                        </p>
                    )}
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="3. Type it again"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500/60 placeholder:text-zinc-700"
                    />
                    {error && (
                        <p className="text-[10px] text-red-400 flex items-center gap-1">
                            <AlertCircle size={10} /> {error}
                        </p>
                    )}
                    <button
                        onClick={turnOn}
                        disabled={busy || pass.length < 8 || !exported}
                        title={!exported ? 'Download a backup first' : undefined}
                        className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium disabled:opacity-40"
                    >
                        {busy ? 'Encrypting…' : 'Encrypt my keys'}
                    </button>
                </div>
            )}

            {encrypted && locked && (
                <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 space-y-2">
                    <h3 className="text-xs font-bold flex items-center gap-1.5 text-amber-200">
                        <Lock size={12} /> Vault locked
                    </h3>
                    <p className="text-[10px] text-amber-300/70">
                        Locked {lockedAt() ? new Date(lockedAt()!).toLocaleString() : 'earlier'}.
                        Nothing can use your keys until you unlock.
                    </p>
                    <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void doUnlock();
                        }}
                        placeholder="passphrase"
                        autoFocus
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-amber-500/60 placeholder:text-zinc-700"
                    />
                    {error && (
                        <p className="text-[10px] text-red-400 flex items-center gap-1">
                            <AlertCircle size={10} /> {error}
                        </p>
                    )}
                    <button
                        onClick={doUnlock}
                        disabled={busy || !pass}
                        className="w-full py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-xs font-medium disabled:opacity-40"
                    >
                        {busy ? 'Unlocking…' : 'Unlock'}
                    </button>
                </div>
            )}

            {encrypted && !locked && (
                <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3 space-y-2">
                    <h3 className="text-xs font-bold flex items-center gap-1.5 text-emerald-200">
                        <LockOpen size={12} /> Unlocked for this session
                    </h3>
                    <p className="text-[10px] text-emerald-300/70">
                        Your keys are encrypted at rest and available right now. Closing the tab
                        re-locks them automatically.
                    </p>
                    {error && (
                        <p className="text-[10px] text-red-400 flex items-center gap-1">
                            <AlertCircle size={10} /> {error}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={lockNow}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px]"
                        >
                            <Lock size={11} /> Lock now
                        </button>
                        <button
                            onClick={turnOff}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-800 hover:bg-red-900/50 hover:text-red-300 text-[11px]"
                        >
                            <ShieldAlert size={11} /> Turn encryption off
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default APIKeysApp;
