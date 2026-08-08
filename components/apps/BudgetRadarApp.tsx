/**
 * Budget Radar — how much free tier you have left, per account.
 *
 * The keyring made several accounts usable; this makes the resulting
 * capacity legible. "I have five Groq keys" is not actionable. "Four are
 * healthy, one cools down in 40s, and you have been averaging 12 calls an
 * hour" is.
 *
 * Everything here is measured from real calls (lib/ai/telemetry.ts) and real
 * key state (lib/ai/keyring.ts). Nothing is estimated from published limits,
 * because those vary by account age and region and would be a guess dressed
 * as a number.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Battery, Clock, Gauge, RefreshCw, Trash2 } from 'lucide-react';
import { allProviders } from '../../lib/ai/catalog';
import { listKeys, subscribe as subscribeKeyring } from '../../lib/ai/keyring';
import {
    callsPerHour,
    clearTelemetry,
    subscribeTelemetry,
    usageByKey,
    allCalls,
} from '../../lib/ai/telemetry';

export const BudgetRadarApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    useEffect(() => subscribeTelemetry(() => setTick((t) => t + 1)), []);
    useEffect(() => subscribeKeyring(() => setTick((t) => t + 1)), []);
    // Cooldown countdowns need their own heartbeat.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const providers = useMemo(() => allProviders().filter((p) => p.auth.kind !== 'none'), [tick]);
    const usage = useMemo(() => usageByKey(), [tick]);
    const hours = useMemo(() => callsPerHour(24), [tick]);
    const calls = useMemo(() => allCalls(), [tick]);

    const lastHour = calls.filter((c) => c.at >= Date.now() - 3_600_000);
    const failRate = lastHour.length ? Math.round((lastHour.filter((c) => !c.ok).length / lastHour.length) * 100) : 0;

    // Capacity: healthy keys across every provider, versus what exists.
    let healthy = 0;
    let cooling = 0;
    let rejected = 0;
    let total = 0;
    for (const p of providers) {
        for (const k of listKeys(p.id)) {
            total += 1;
            if (k.status === 'rejected') rejected += 1;
            else if (k.cooldownUntil && k.cooldownUntil > Date.now()) cooling += 1;
            else healthy += 1;
        }
    }

    const peak = Math.max(1, ...hours.map((h) => h.calls));

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-200 p-4 font-sans">
            <div className="flex items-center gap-2 mb-4">
                <Gauge size={16} className="text-emerald-400" />
                <h1 className="text-sm font-bold">Budget Radar</h1>
                <span className="text-[10px] text-zinc-500">{calls.length} calls tracked</span>
                <button
                    onClick={clearTelemetry}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px]"
                >
                    <Trash2 size={10} /> Reset stats
                </button>
            </div>

            {/* Capacity at a glance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <Stat icon={Battery} label="Ready now" value={String(healthy)} tone="emerald" sub={`of ${total} keys`} />
                <Stat icon={Clock} label="Cooling" value={String(cooling)} tone="amber" sub="rate limited" />
                <Stat icon={AlertTriangle} label="Rejected" value={String(rejected)} tone="red" sub="need attention" />
                <Stat
                    icon={Activity}
                    label="Last hour"
                    value={String(lastHour.length)}
                    tone={failRate > 30 ? 'amber' : 'zinc'}
                    sub={`${failRate}% failed`}
                />
            </div>

            {total === 0 && (
                <p className="text-[11px] text-zinc-500 mb-4">
                    No keys yet. Add one in API Keys — this fills in as soon as anything makes a call.
                </p>
            )}

            {/* 24h shape */}
            <section className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <h2 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                    <RefreshCw size={11} /> Last 24 hours
                </h2>
                <div className="flex items-end gap-[2px] h-16">
                    {hours.map((h, i) => (
                        <div
                            key={i}
                            title={`${h.calls} calls, ${h.failed} failed`}
                            className="flex-1 flex flex-col justify-end"
                        >
                            {h.failed > 0 && (
                                <div
                                    className="w-full bg-red-500/70 rounded-t-sm"
                                    style={{ height: `${(h.failed / peak) * 100}%` }}
                                />
                            )}
                            <div
                                className="w-full bg-emerald-500/70"
                                style={{ height: `${((h.calls - h.failed) / peak) * 100}%` }}
                            />
                        </div>
                    ))}
                </div>
                <p className="mt-1 text-[9px] text-zinc-600">24h ago → now · red is failures</p>
            </section>

            {/* Per account */}
            <section>
                <h2 className="text-xs font-bold mb-2">By account</h2>
                {usage.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">
                        Nothing recorded yet — usage appears here after the first call.
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {usage.map((u) => {
                            const key = listKeys(u.provider).find((k) => k.id === u.keyId);
                            const coolFor =
                                key?.cooldownUntil && key.cooldownUntil > Date.now()
                                    ? Math.ceil((key.cooldownUntil - Date.now()) / 1000)
                                    : 0;
                            return (
                                <div
                                    key={`${u.provider}-${u.keyId}`}
                                    className="rounded border border-zinc-800 bg-zinc-900/40 p-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-medium">{u.provider}</span>
                                        <span className="text-[10px] text-zinc-500">
                                            {u.keyLabel || key?.label || 'unlabelled'}
                                        </span>
                                        {coolFor > 0 ? (
                                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                                <Clock size={9} /> {coolFor}s
                                            </span>
                                        ) : key?.status === 'rejected' ? (
                                            <span className="text-[10px] text-red-400">rejected</span>
                                        ) : (
                                            <span className="text-[10px] text-emerald-400">ready</span>
                                        )}
                                        <span className="ml-auto text-[10px] text-zinc-400">
                                            {u.calls} calls · {u.lastHour}/hr
                                        </span>
                                    </div>
                                    {/* Relative load, so a key carrying the pool is obvious. */}
                                    <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                        <div
                                            className={coolFor > 0 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
                                            style={{
                                                width: `${Math.min(100, (u.calls / Math.max(1, usage[0].calls)) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

const Stat: React.FC<{
    icon: React.ElementType;
    label: string;
    value: string;
    sub: string;
    tone: 'emerald' | 'amber' | 'red' | 'zinc';
}> = ({ icon: Icon, label, value, sub, tone }) => {
    const tones = {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
        zinc: 'text-zinc-400',
    };
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Icon size={10} className={tones[tone]} /> {label}
            </div>
            <div className={`text-xl font-semibold mt-0.5 ${tones[tone]}`}>{value}</div>
            <div className="text-[9px] text-zinc-600">{sub}</div>
        </div>
    );
};

export default BudgetRadarApp;
