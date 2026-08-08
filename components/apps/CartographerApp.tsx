/**
 * Cartographer — a live map of your own OS.
 *
 * With 100+ apps and a dozen subsystems, nobody can hold the shape of this
 * thing in their head. This draws it from two sources of truth that cannot
 * flatter it: the app registry (what exists) and the recorded bus (what
 * actually fires). The gap between those two is the interesting part — it is
 * where the dead code lives.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Activity, Boxes, Radio } from 'lucide-react';
import { buildGraph, getEvents, isRecording, startRecording, subscribeRecorder } from '../../lib/observe/recorder';
import { allProviders } from '../../lib/ai/catalog';
import { statsByProvider } from '../../lib/ai/telemetry';

export const CartographerApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    useEffect(() => subscribeRecorder(() => setTick((t) => t + 1)), []);

    const events = useMemo(() => getEvents(), [tick]);
    const edges = useMemo(() => buildGraph(events).slice(0, 20), [tick]);
    const providers = useMemo(() => allProviders(), [tick]);
    const providerStats = useMemo(() => statsByProvider(), [tick]);

    // Channel frequency: what the OS actually spends its time doing.
    const channels = useMemo(() => {
        const counts = new Map<string, number>();
        for (const e of events) counts.set(e.channel, (counts.get(e.channel) ?? 0) + 1);
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    }, [tick]);

    const peak = Math.max(1, ...channels.map(([, n]) => n));

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-200 p-4 font-sans">
            <div className="flex items-center gap-2 mb-4">
                <Compass size={16} className="text-teal-400" />
                <h1 className="text-sm font-bold">Cartographer</h1>
                {!isRecording() && (
                    <button
                        onClick={startRecording}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded bg-teal-900/50 hover:bg-teal-800/50 text-[11px]"
                    >
                        <Radio size={10} /> Start observing
                    </button>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
                <Tile icon={Boxes} label="Providers" value={String(providers.length)} sub={`${providerStats.length} used`} />
                <Tile icon={Activity} label="Channels seen" value={String(channels.length)} sub={`${events.length} events`} />
                <Tile icon={Compass} label="Connections" value={String(edges.length)} sub="observed" />
            </div>

            {events.length === 0 && (
                <p className="text-[11px] text-zinc-500 mb-4">
                    Nothing observed yet. Start observing, then use the desktop — the map draws
                    itself from what actually happens, not from what the code implies.
                </p>
            )}

            <section className="mb-4">
                <h2 className="text-xs font-bold mb-2">Busiest channels</h2>
                <div className="space-y-1">
                    {channels.slice(0, 12).map(([ch, n]) => (
                        <div key={ch} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono w-44 truncate text-cyan-300">{ch}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-teal-500" style={{ width: `${(n / peak) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-zinc-500 w-8 text-right tabular-nums">{n}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-4">
                <h2 className="text-xs font-bold mb-2">What follows what</h2>
                <p className="text-[10px] text-zinc-600 mb-2">
                    Observed sequences within 2 seconds — behaviour, not imports.
                </p>
                <div className="space-y-1">
                    {edges.map((e) => (
                        <div key={`${e.from}-${e.to}`} className="flex items-center gap-2 text-[10px]">
                            <span className="font-mono text-zinc-400 w-40 truncate text-right">{e.from}</span>
                            <span className="text-teal-500">→</span>
                            <span className="font-mono text-zinc-400 w-40 truncate">{e.to}</span>
                            <span className="text-zinc-600 tabular-nums">×{e.count}</span>
                        </div>
                    ))}
                    {edges.length === 0 && <p className="text-[10px] text-zinc-600">No sequences captured yet.</p>}
                </div>
            </section>

            <section>
                <h2 className="text-xs font-bold mb-2">Provider reality check</h2>
                <div className="space-y-1">
                    {providers.map((p) => {
                        const s = providerStats.find((x) => x.provider === p.id);
                        return (
                            <div key={p.id} className="flex items-center gap-2 text-[10px]">
                                <span className="w-32 truncate">{p.label}</span>
                                {s ? (
                                    <span className="text-emerald-400">
                                        {s.calls} calls · {s.medianMs}ms median
                                    </span>
                                ) : (
                                    <span className="text-zinc-600">never used</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

const Tile: React.FC<{ icon: React.ElementType; label: string; value: string; sub: string }> = ({
    icon: Icon,
    label,
    value,
    sub,
}) => (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Icon size={10} className="text-teal-400" /> {label}
        </div>
        <div className="text-xl font-semibold mt-0.5 text-teal-300">{value}</div>
        <div className="text-[9px] text-zinc-600">{sub}</div>
    </div>
);

export default CartographerApp;
