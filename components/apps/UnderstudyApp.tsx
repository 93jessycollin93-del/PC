/**
 * The Understudy — what the desktop has learned about how you use it.
 *
 * The engine (lib/understudy/predictor.ts) watches launches and predicts the
 * next one. This screen exists so that learning is never invisible: what it
 * thinks, why it thinks it, how often it has been right, and a single switch
 * to stop it and erase what it knows.
 *
 * Predictions here are offers, not actions. The strip at the top launches an
 * app when *you* click it — the Understudy's own initiative stops at warming
 * the chunk.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Flame, Gauge, Play, Power, RotateCcw, Route, Sparkles, Trash2 } from 'lucide-react';
import { bus } from '../../lib/bus';
import {
    accuracy,
    currentApp,
    isEnabled,
    loadModel,
    predictNext,
    prefetch,
    resetModel,
    routines,
    setEnabled,
    subscribeUnderstudy,
    type Prediction,
} from '../../lib/understudy/predictor';

/** `speed_racer` → `Speed Racer`. The registry has no display names. */
function pretty(appId: string): string {
    return appId
        .split(/[_-]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export const UnderstudyApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [enabled, setEnabledState] = useState(isEnabled());
    const [warmed, setWarmed] = useState<string[]>([]);

    useEffect(() => subscribeUnderstudy(() => setTick((t) => t + 1)), []);

    const model = useMemo(() => loadModel(), [tick]);
    const preds = useMemo<Prediction[]>(() => predictNext(currentApp()), [tick]);
    const chains = useMemo(() => routines().slice(0, 6), [tick]);
    const acc = useMemo(() => accuracy(), [tick]);

    const top = useMemo(
        () =>
            Object.entries(model.totals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
        [model],
    );

    const totalLaunches = useMemo(() => Object.values(model.totals).reduce((a, b) => a + b, 0), [model]);

    async function warmNow() {
        setWarmed(await prefetch(preds, 0));
    }

    function toggle() {
        const next = !enabled;
        setEnabled(next);
        setEnabledState(next);
    }

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-200 p-4 font-sans">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-violet-400" />
                <h1 className="text-sm font-bold">The Understudy</h1>
                <button
                    onClick={toggle}
                    className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded text-[10px] ${
                        enabled ? 'bg-violet-900/50 hover:bg-violet-800/50 text-violet-200' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                    }`}
                >
                    <Power size={10} /> {enabled ? 'Learning' : 'Paused'}
                </button>
            </div>

            {!enabled && (
                <p className="text-[11px] text-zinc-500 mb-4">
                    Paused. Nothing is being recorded. Turn it on and the desktop starts learning which app follows which,
                    then warms the next one before you click.
                </p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
                <Tile icon={Gauge} label="Launches seen" value={String(totalLaunches)} sub={`${Object.keys(model.totals).length} apps`} />
                <Tile
                    icon={Brain}
                    label="Accuracy"
                    value={acc === null ? '—' : `${Math.round(acc * 100)}%`}
                    sub={`${model.scored.hits}/${model.scored.hits + model.scored.misses} predictions`}
                />
                <Tile icon={Route} label="Routines" value={String(chains.length)} sub="repeated 3-app runs" />
            </div>

            <section className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                    <Flame size={11} className="text-orange-400" />
                    <h2 className="text-[11px] font-semibold">Probably next</h2>
                    {preds.length > 0 && (
                        <button onClick={warmNow} className="ml-auto px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px]">
                            Warm now
                        </button>
                    )}
                </div>
                {preds.length === 0 ? (
                    <p className="text-[10px] text-zinc-500">
                        Not enough history yet. Predictions start once a pattern repeats a few times — guessing from one
                        data point would just be noise.
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {preds.map((p) => (
                            <div key={p.appId} className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium flex-1 truncate">{pretty(p.appId)}</span>
                                    {warmed.includes(p.appId) && (
                                        <span className="text-[9px] text-emerald-400 shrink-0">warmed</span>
                                    )}
                                    {!p.preloadable && <span className="text-[9px] text-zinc-600 shrink-0">already in shell</span>}
                                    <span className="text-[10px] text-violet-300 shrink-0 tabular-nums">
                                        {Math.round(p.confidence * 100)}%
                                    </span>
                                    <button
                                        onClick={() => bus.emit('launch-app', { appId: p.appId })}
                                        className="shrink-0 p-1 rounded bg-violet-900/40 hover:bg-violet-800/40"
                                        title="Open it"
                                    >
                                        <Play size={10} />
                                    </button>
                                </div>
                                <div className="mt-1 h-1 rounded bg-zinc-800 overflow-hidden">
                                    <div className="h-full bg-violet-500" style={{ width: `${Math.round(p.confidence * 100)}%` }} />
                                </div>
                                <p className="text-[9px] text-zinc-500 mt-1">{p.reason}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {chains.length > 0 && (
                <section className="mb-5">
                    <h2 className="text-[11px] font-semibold mb-2">Routines it has noticed</h2>
                    <div className="space-y-1">
                        {chains.map((r) => (
                            <div key={r.chain.join('>')} className="flex items-center gap-2 text-[10px]">
                                <span className="flex-1 truncate text-zinc-300">{r.chain.map(pretty).join(' → ')}</span>
                                <span className="text-zinc-600 shrink-0">×{r.count}</span>
                                <button
                                    onClick={() => {
                                        // Staggered, so the window manager places
                                        // them instead of stacking them all at once.
                                        r.chain.forEach((appId, i) =>
                                            setTimeout(() => bus.emit('launch-app', { appId }), i * 260),
                                        );
                                    }}
                                    className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
                                >
                                    Run
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {top.length > 0 && (
                <section className="mb-5">
                    <h2 className="text-[11px] font-semibold mb-2">Most used</h2>
                    <div className="space-y-1">
                        {top.map(([appId, n]) => (
                            <div key={appId} className="flex items-center gap-2 text-[10px]">
                                <span className="w-36 truncate text-zinc-300">{pretty(appId)}</span>
                                <div className="flex-1 h-1.5 rounded bg-zinc-800 overflow-hidden">
                                    <div
                                        className="h-full bg-zinc-500"
                                        style={{ width: `${Math.round((n / (top[0][1] || 1)) * 100)}%` }}
                                    />
                                </div>
                                <span className="w-8 text-right text-zinc-600 tabular-nums">{n}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        if (confirm('Erase everything the Understudy has learned about you?')) {
                            resetModel();
                            setWarmed([]);
                            setTick((t) => t + 1);
                        }
                    }}
                    className="px-2.5 py-1 rounded bg-red-900/30 hover:bg-red-800/40 text-[10px] text-red-300 flex items-center gap-1"
                >
                    <Trash2 size={10} /> Forget everything
                </button>
                <button
                    onClick={() => setTick((t) => t + 1)}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] flex items-center gap-1"
                >
                    <RotateCcw size={10} /> Refresh
                </button>
            </div>
        </div>
    );
};

const Tile: React.FC<{ icon: React.ElementType; label: string; value: string; sub: string }> = ({
    icon: Icon,
    label,
    value,
    sub,
}) => (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
            <Icon size={10} /> {label}
        </div>
        <div className="text-base font-bold leading-tight">{value}</div>
        <div className="text-[9px] text-zinc-600 truncate">{sub}</div>
    </div>
);

export default UnderstudyApp;
