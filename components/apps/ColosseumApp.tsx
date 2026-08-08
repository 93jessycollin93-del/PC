/**
 * Model Colosseum — one prompt, many models, side by side, then judged.
 *
 * Owning hundreds of models is only worth something if you can compare them
 * on your own work. This fans one prompt across a chosen set, streams each
 * answer in as it lands, and can then ask a separate model to rank them.
 *
 * The judging is blind: entrants are relabelled A, B, C before the judge
 * sees them, and identities are restored afterwards (see lib/ai/parallel.ts).
 * A judge told which model wrote which answer rates reputations rather than
 * text.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gavel, Loader2, Swords, Trophy, X } from 'lucide-react';
import { discoverAll, type DiscoveredModel } from '../../lib/ai/discovery';
import { judge, race, type RaceResult } from '../../lib/ai/parallel';

const MAX_CONTESTANTS = 8;

export const ColosseumApp: React.FC = () => {
    const [models, setModels] = useState<DiscoveredModel[]>([]);
    const [picked, setPicked] = useState<string[]>([]);
    const [prompt, setPrompt] = useState('');
    const [results, setResults] = useState<RaceResult[]>([]);
    const [running, setRunning] = useState(false);
    const [verdict, setVerdict] = useState<string | null>(null);
    const [judging, setJudging] = useState(false);
    const [filter, setFilter] = useState('');
    const [freeOnly, setFreeOnly] = useState(true);

    useEffect(() => {
        void discoverAll().then(setModels);
    }, []);

    const visible = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return models
            .filter((m) => (!freeOnly || m.free) && (!q || m.label.toLowerCase().includes(q) || m.provider.includes(q)))
            .slice(0, 200);
    }, [models, filter, freeOnly]);

    function toggle(ref: string) {
        setPicked((prev) =>
            prev.includes(ref) ? prev.filter((r) => r !== ref) : prev.length >= MAX_CONTESTANTS ? prev : [...prev, ref],
        );
    }

    async function start() {
        if (!prompt.trim() || picked.length < 2) return;
        setRunning(true);
        setResults([]);
        setVerdict(null);
        const contestants = picked.map((ref) => ({
            ref,
            label: models.find((m) => m.ref === ref)?.label ?? ref,
        }));
        // Stream: a slow entrant must not hide the ones already done.
        const all = await race(prompt, contestants, {
            onResult: (r) => setResults((prev) => [...prev, r]),
        });
        setResults(all);
        setRunning(false);
    }

    async function runJudge() {
        setJudging(true);
        try {
            const { verdict: v } = await judge(prompt, results);
            setVerdict(v);
        } catch (err) {
            setVerdict(err instanceof Error ? err.message : 'The judge could not be reached.');
        }
        setJudging(false);
    }

    const winners = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);

    return (
        <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200 font-sans">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                <Swords size={16} className="text-rose-400" />
                <h1 className="text-sm font-bold">Model Colosseum</h1>
                <span className="text-[10px] text-zinc-500">
                    {picked.length}/{MAX_CONTESTANTS} chosen
                </span>
                <button
                    onClick={start}
                    disabled={running || picked.length < 2 || !prompt.trim()}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded bg-rose-900/60 hover:bg-rose-800/60 text-[11px] disabled:opacity-40"
                    title={picked.length < 2 ? 'Pick at least two models' : undefined}
                >
                    {running ? <Loader2 size={11} className="animate-spin" /> : <Swords size={11} />}
                    Fight
                </button>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Roster */}
                <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
                    <div className="p-2 border-b border-zinc-800 space-y-1.5">
                        <input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="filter models…"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] outline-none focus:border-rose-500/60 placeholder:text-zinc-600"
                        />
                        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <input
                                type="checkbox"
                                checked={freeOnly}
                                onChange={(e) => setFreeOnly(e.target.checked)}
                                className="accent-emerald-500"
                            />
                            free only
                        </label>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {visible.length === 0 && (
                            <p className="p-3 text-[10px] text-zinc-600">
                                No models yet — add a key in API Keys.
                            </p>
                        )}
                        {visible.map((m) => (
                            <button
                                key={m.ref}
                                onClick={() => toggle(m.ref)}
                                className={`w-full text-left px-2 py-1.5 border-b border-zinc-900 flex items-center gap-1.5 ${
                                    picked.includes(m.ref) ? 'bg-rose-950/40' : 'hover:bg-zinc-900/60'
                                }`}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[10px] truncate">{m.label}</span>
                                    <span className="block text-[9px] text-zinc-600 truncate">{m.providerLabel}</span>
                                </span>
                                {m.free && <span className="text-[8px] text-emerald-400 shrink-0">FREE</span>}
                                {picked.includes(m.ref) && <Check size={10} className="text-rose-400 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Arena */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-2 border-b border-zinc-800">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ask them all the same thing…"
                            rows={2}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs outline-none focus:border-rose-500/60 placeholder:text-zinc-600 resize-none"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {results.length === 0 && !running && (
                            <p className="p-6 text-center text-[11px] text-zinc-600">
                                Pick two or more models, type a prompt, and hit Fight.
                            </p>
                        )}
                        {results.map((r) => {
                            const place = winners.findIndex((w) => w.ref === r.ref) + 1;
                            return (
                                <div
                                    key={r.ref}
                                    className={`rounded-lg border p-2.5 ${
                                        r.ok ? 'border-zinc-800 bg-zinc-900/40' : 'border-red-900/50 bg-red-950/20'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        {r.ok && place === 1 && <Trophy size={11} className="text-amber-400" />}
                                        <span className="text-[11px] font-medium truncate">{r.label}</span>
                                        {r.ok ? (
                                            <span className="text-[10px] text-zinc-500">
                                                #{place} · {r.ms} ms · {r.text?.length ?? 0} chars
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-red-400 flex items-center gap-1">
                                                <X size={9} /> {r.error}
                                            </span>
                                        )}
                                        {r.ok && (
                                            <button
                                                onClick={() => navigator.clipboard?.writeText(r.text || '')}
                                                className="ml-auto p-1 rounded text-zinc-500 hover:text-zinc-200 shrink-0"
                                                title="Copy"
                                            >
                                                <Copy size={10} />
                                            </button>
                                        )}
                                    </div>
                                    {r.ok && (
                                        <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                                            {r.text}
                                        </p>
                                    )}
                                </div>
                            );
                        })}

                        {verdict && (
                            <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-2.5">
                                <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-amber-200">
                                    <Gavel size={11} /> Verdict
                                </div>
                                <p className="text-[11px] text-amber-100/90 whitespace-pre-wrap leading-relaxed">
                                    {verdict}
                                </p>
                            </div>
                        )}
                    </div>

                    {winners.length >= 2 && !running && (
                        <div className="p-2 border-t border-zinc-800">
                            <button
                                onClick={runJudge}
                                disabled={judging}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-amber-900/50 hover:bg-amber-800/50 text-[11px] disabled:opacity-40"
                            >
                                {judging ? <Loader2 size={11} className="animate-spin" /> : <Gavel size={11} />}
                                Judge these answers (blind)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ColosseumApp;
