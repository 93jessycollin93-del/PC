/**
 * Speed Racer — rank providers by measured speed, not by guesswork.
 *
 * The gateway's fallback order is a hand-written priority list: a reasonable
 * guess that never updates. This measures what actually happens — median and
 * p95 latency, reply throughput, failure rate — and can hand the router a
 * ranking derived from the last week of real calls instead.
 *
 * Median rather than mean throughout: one cold start or one rate-limited
 * retry would otherwise define a provider that is usually fast.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Award, Loader2, Play, Timer, TrendingUp, Zap } from 'lucide-react';
import { allProviders, isProviderReady, type ProviderDef } from '../../lib/ai/catalog';
import { preferredModelFor } from '../../lib/ai/gateway';
import { race, type RaceResult } from '../../lib/ai/parallel';
import { fastestProvider, statsByProvider, subscribeTelemetry } from '../../lib/ai/telemetry';

const BENCH_PROMPT = 'Reply with exactly one short sentence about the number seven.';

export const SpeedRacerApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [running, setRunning] = useState(false);
    const [live, setLive] = useState<RaceResult[]>([]);
    useEffect(() => subscribeTelemetry(() => setTick((t) => t + 1)), []);

    const stats = useMemo(() => statsByProvider(), [tick]);
    const champion = useMemo(() => fastestProvider(), [tick]);
    const ready = useMemo(() => allProviders().filter(isProviderReady), [tick]);

    async function benchmark() {
        setRunning(true);
        setLive([]);
        const contestants = ready
            .map((p: ProviderDef) => {
                const model = preferredModelFor(p);
                return model ? { ref: `${p.id}:${model}`, label: p.label } : null;
            })
            .filter((c): c is { ref: string; label: string } => c !== null);

        // Results stream in as each finishes — a slow provider must not hide
        // the fast ones behind it.
        await race(BENCH_PROMPT, contestants, {
            timeoutMs: 45_000,
            onResult: (r) => setLive((prev) => [...prev, r].sort((a, b) => a.ms - b.ms)),
        });
        setRunning(false);
    }

    const slowest = Math.max(1, ...stats.map((s) => s.p95Ms));

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-200 p-4 font-sans">
            <div className="flex items-center gap-2 mb-4">
                <Timer size={16} className="text-cyan-400" />
                <h1 className="text-sm font-bold">Speed Racer</h1>
                {champion && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Award size={10} /> fastest: {champion}
                    </span>
                )}
                <button
                    onClick={benchmark}
                    disabled={running || ready.length === 0}
                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800/60 text-[11px] disabled:opacity-40"
                >
                    {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    Run benchmark
                </button>
            </div>

            {ready.length === 0 && (
                <p className="text-[11px] text-zinc-500 mb-4">
                    No providers configured. Add a key in API Keys and this fills in.
                </p>
            )}

            {live.length > 0 && (
                <section className="mb-4 rounded-lg border border-cyan-900/40 bg-cyan-950/20 p-3">
                    <h2 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                        <Zap size={11} className="text-cyan-400" /> Live run
                    </h2>
                    <div className="space-y-1">
                        {live.map((r, i) => (
                            <div key={r.ref} className="flex items-center gap-2 text-[11px]">
                                <span className="w-5 text-zinc-600">{r.ok ? `#${i + 1}` : '—'}</span>
                                <span className="w-32 truncate">{r.label}</span>
                                {r.ok ? (
                                    <>
                                        <span className="text-cyan-300 tabular-nums w-16">{r.ms} ms</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                            <div
                                                className="h-full bg-cyan-500"
                                                style={{ width: `${Math.min(100, (r.ms / Math.max(...live.map((x) => x.ms))) * 100)}%` }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-red-400 truncate flex-1">{r.error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h2 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} /> Measured over the last 7 days
                </h2>
                {stats.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">
                        Nothing measured yet. Run a benchmark, or just use the AI apps — every call is timed.
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {[...stats]
                            .sort((a, b) => a.medianMs - b.medianMs)
                            .map((s) => (
                                <div key={s.provider} className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[11px] font-medium">{s.provider}</span>
                                        {s.provider === champion && <Award size={10} className="text-emerald-400" />}
                                        <span className="ml-auto text-[10px] text-zinc-500">
                                            {s.ok}/{s.calls} ok
                                            {s.failed > 0 && <span className="text-red-400"> · {s.failed} failed</span>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <span className="text-cyan-300 tabular-nums w-20">{s.medianMs} ms med</span>
                                        <span className="text-zinc-500 tabular-nums w-20">{s.p95Ms} ms p95</span>
                                        <span className="text-zinc-500 tabular-nums">{s.charsPerSec} ch/s</span>
                                    </div>
                                    <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                        <div
                                            className="h-full bg-cyan-500/70"
                                            style={{ width: `${Math.max(2, (s.medianMs / slowest) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default SpeedRacerApp;
