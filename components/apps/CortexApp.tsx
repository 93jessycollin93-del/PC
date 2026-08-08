/**
 * Offline Cortex — the machine's memory of what it has already been told.
 *
 * The engine (lib/ai/cortex.ts) caches question→answer pairs and serves them
 * when no provider will answer. This is the surface for that: ask, see
 * plainly whether the reply came from the network or from memory, and curate
 * what memory keeps.
 *
 * The cache-vs-live badge is the point of the screen. A remembered answer
 * presented as a fresh one is worse than no answer, so every cached reply
 * says so and says how old it is.
 */
import React, { useMemo, useState } from 'react';
import { Brain, Download, Loader2, Pin, PinOff, Send, Trash2, Upload, WifiOff, Zap } from 'lucide-react';
import {
    askWithCortex,
    clearCortex,
    forget,
    listCache,
    precompute,
    setPinned,
    type CachedAnswer,
} from '../../lib/ai/cortex';

interface Turn {
    id: string;
    question: string;
    answer: string;
    fromCache: boolean;
    provider: string;
    /** When the cached answer was originally learned. */
    learnedAt?: number;
}

function ago(ts: number): string {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
}

export const CortexApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [question, setQuestion] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warmList, setWarmList] = useState('');
    const [warming, setWarming] = useState<{ done: number; total: number } | null>(null);
    const [filter, setFilter] = useState('');

    const cache = useMemo<CachedAnswer[]>(() => listCache(), [tick]);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

    const shown = useMemo(() => {
        const q = filter.trim().toLowerCase();
        const list = q ? cache.filter((e) => e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q)) : cache;
        // Pinned first, then most-used — the entries earning their space.
        return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.hits - a.hits || b.at - a.at);
    }, [cache, filter]);

    async function ask() {
        const q = question.trim();
        if (!q || busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await askWithCortex(q);
            setTurns((t) => [
                { id: crypto.randomUUID(), question: q, answer: res.text, fromCache: res.fromCache, provider: res.provider, learnedAt: res.at },
                ...t,
            ]);
            setQuestion('');
            setTick((n) => n + 1);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    /** Ask a batch now so the answers exist later, offline. */
    async function warm() {
        const questions = warmList
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        if (!questions.length || warming) return;
        setWarming({ done: 0, total: questions.length });
        const res = await precompute(questions, (done, total) => setWarming({ done, total }));
        setWarming(null);
        setTick((n) => n + 1);
        setError(res.failed ? `Warmed ${res.ok}, ${res.failed} failed.` : null);
        if (!res.failed) setWarmList('');
    }

    function exportCache() {
        const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cortex-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importCache(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const rows = JSON.parse(String(reader.result));
                if (!Array.isArray(rows)) throw new Error('not a Cortex export');
                // Merge rather than replace: an import should add knowledge,
                // never silently delete what is already remembered.
                const existing = new Set(cache.map((e) => e.key));
                const merged = [...cache, ...rows.filter((r: CachedAnswer) => r?.key && !existing.has(r.key))];
                localStorage.setItem('jackie_cortex_v1', JSON.stringify(merged));
                setTick((n) => n + 1);
                setError(null);
            } catch (e) {
                setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        };
        reader.readAsText(file);
    }

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-200 p-4 font-sans">
            <div className="flex items-center gap-2 mb-4">
                <Brain size={16} className="text-fuchsia-400" />
                <h1 className="text-sm font-bold">Offline Cortex</h1>
                <span className="ml-auto text-[10px] text-zinc-500">{cache.length} remembered</span>
                {offline && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <WifiOff size={10} /> offline
                    </span>
                )}
            </div>

            <div className="flex gap-2 mb-3">
                <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ask()}
                    placeholder={offline ? 'Ask from memory…' : 'Ask anything — the answer is kept for later'}
                    className="flex-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] outline-none focus:border-fuchsia-700"
                />
                <button
                    onClick={ask}
                    disabled={busy || !question.trim()}
                    className="px-3 py-1.5 rounded bg-fuchsia-900/50 hover:bg-fuchsia-800/50 disabled:opacity-40 text-[11px] flex items-center gap-1"
                >
                    {busy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Ask
                </button>
            </div>

            {error && <p className="text-[10px] text-red-400 mb-3">{error}</p>}

            {turns.length > 0 && (
                <div className="space-y-2 mb-5">
                    {turns.map((t) => (
                        <div key={t.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-2.5">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-medium flex-1 truncate">{t.question}</span>
                                {t.fromCache ? (
                                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[9px]">
                                        from memory{t.learnedAt ? ` · learned ${ago(t.learnedAt)}` : ''}
                                    </span>
                                ) : (
                                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-[9px]">
                                        live · {t.provider}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto">{t.answer}</p>
                        </div>
                    ))}
                </div>
            )}

            <section className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                    <Zap size={11} className="text-yellow-400" />
                    <h2 className="text-[11px] font-semibold">Pre-warm</h2>
                    <span className="text-[10px] text-zinc-500">one question per line, asked now so they work offline later</span>
                </div>
                <textarea
                    value={warmList}
                    onChange={(e) => setWarmList(e.target.value)}
                    rows={3}
                    placeholder={'How do I reset a pod?\nWhat does the gateway do when a key 429s?'}
                    className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] outline-none focus:border-fuchsia-700 resize-y"
                />
                <div className="flex items-center gap-2 mt-1.5">
                    <button
                        onClick={warm}
                        disabled={!!warming || !warmList.trim()}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-[10px]"
                    >
                        {warming ? `Warming ${warming.done}/${warming.total}…` : 'Warm the cache'}
                    </button>
                    <button onClick={exportCache} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] flex items-center gap-1">
                        <Download size={10} /> Export
                    </button>
                    <label className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] flex items-center gap-1 cursor-pointer">
                        <Upload size={10} /> Import
                        <input
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && importCache(e.target.files[0])}
                        />
                    </label>
                    <button
                        onClick={() => {
                            if (confirm('Forget everything the Cortex has learned?')) {
                                clearCortex();
                                setTick((n) => n + 1);
                            }
                        }}
                        className="ml-auto px-2.5 py-1 rounded bg-red-900/30 hover:bg-red-800/40 text-[10px] text-red-300"
                    >
                        Clear all
                    </button>
                </div>
            </section>

            <section>
                <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-[11px] font-semibold">Memory</h2>
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="filter…"
                        className="ml-auto w-40 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] outline-none"
                    />
                </div>
                {shown.length === 0 ? (
                    <p className="text-[10px] text-zinc-500">
                        Nothing remembered yet. Every answered question is kept automatically.
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {shown.map((e) => (
                            <div key={e.id} className="rounded border border-zinc-800 bg-zinc-900/30 p-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium flex-1 truncate">{e.question}</span>
                                    <span className="text-[9px] text-zinc-600 shrink-0">
                                        {e.hits} hit{e.hits === 1 ? '' : 's'} · {ago(e.at)}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setPinned(e.id, !e.pinned);
                                            setTick((n) => n + 1);
                                        }}
                                        title={e.pinned ? 'Unpin' : 'Pin — never evict'}
                                        className={`shrink-0 ${e.pinned ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'}`}
                                    >
                                        {e.pinned ? <Pin size={11} /> : <PinOff size={11} />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            forget(e.id);
                                            setTick((n) => n + 1);
                                        }}
                                        className="shrink-0 text-zinc-600 hover:text-red-400"
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                                <p className="text-[9px] text-zinc-500 mt-1 line-clamp-2 whitespace-pre-wrap">{e.answer}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default CortexApp;
