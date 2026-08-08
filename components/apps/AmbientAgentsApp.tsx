/**
 * Ambient Agents — schedule work, read the results later.
 * UI over lib/ambient/agents.ts; see that file for the scheduling rationale.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Clock, Loader2, Pause, Play, Plus, Trash2, X, Zap } from 'lucide-react';
import {
    CADENCE_LABEL,
    deleteAgent,
    isSchedulerRunning,
    listAgents,
    runAgent,
    saveAgent,
    setEnabled,
    startScheduler,
    stopScheduler,
    subscribeAgents,
    type Cadence,
} from '../../lib/ambient/agents';

export const AmbientAgentsApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [busy, setBusy] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [name, setName] = useState('');
    const [instruction, setInstruction] = useState('');
    const [cadence, setCadence] = useState<Cadence>('hourly');

    useEffect(() => subscribeAgents(() => setTick((t) => t + 1)), []);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 10_000);
        return () => clearInterval(id);
    }, []);

    const agents = useMemo(() => listAgents(), [tick]);
    const schedulerOn = isSchedulerRunning();

    function create() {
        if (!name.trim() || !instruction.trim()) return;
        saveAgent({ name, instruction, cadence });
        setName('');
        setInstruction('');
        setShowNew(false);
        if (!isSchedulerRunning()) startScheduler();
    }

    return (
        <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200 font-sans">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                <Bot size={16} className="text-violet-400" />
                <h1 className="text-sm font-bold">Ambient Agents</h1>
                <span className="text-[10px] text-zinc-500">{agents.length} defined</span>
                <button
                    onClick={() => (schedulerOn ? stopScheduler() : startScheduler())}
                    className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] ${
                        schedulerOn ? 'bg-emerald-900/50 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                    }`}
                >
                    {schedulerOn ? <Pause size={11} /> : <Play size={11} />}
                    {schedulerOn ? 'Running' : 'Paused'}
                </button>
                <button
                    onClick={() => setShowNew((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-violet-900/60 hover:bg-violet-800/60 text-[11px]"
                >
                    <Plus size={11} /> New
                </button>
            </div>

            {showNew && (
                <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0 bg-zinc-900/40">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name — e.g. Morning briefing"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-violet-500/60 placeholder:text-zinc-700"
                    />
                    <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="What should it do each time it runs?"
                        rows={3}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-violet-500/60 placeholder:text-zinc-700 resize-none"
                    />
                    <div className="flex items-center gap-2">
                        <select
                            value={cadence}
                            onChange={(e) => setCadence(e.target.value as Cadence)}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none"
                        >
                            {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => (
                                <option key={c} value={c}>
                                    {CADENCE_LABEL[c]}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={create}
                            disabled={!name.trim() || !instruction.trim()}
                            className="ml-auto px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-[11px] disabled:opacity-40"
                        >
                            Create agent
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {agents.length === 0 && (
                    <p className="p-6 text-center text-[11px] text-zinc-600">
                        No agents yet. They run on a schedule and leave results here — try
                        &ldquo;summarise what changed in my notes&rdquo; hourly.
                    </p>
                )}
                {agents.map((a) => {
                    const dueIn = Math.max(0, a.nextRunAt - Date.now());
                    const mins = Math.round(dueIn / 60_000);
                    return (
                        <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{a.name}</span>
                                <span className="text-[10px] text-zinc-500">{CADENCE_LABEL[a.cadence]}</span>
                                {a.enabled ? (
                                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                        <Clock size={9} /> {mins <= 0 ? 'due now' : `in ${mins}m`}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-zinc-600">paused</span>
                                )}
                                <div className="ml-auto flex items-center gap-1">
                                    <button
                                        onClick={async () => {
                                            setBusy(a.id);
                                            await runAgent(a.id);
                                            setBusy(null);
                                        }}
                                        disabled={busy === a.id}
                                        className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                        title="Run now"
                                    >
                                        {busy === a.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                                    </button>
                                    <button
                                        onClick={() => setEnabled(a.id, !a.enabled)}
                                        className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                        title={a.enabled ? 'Pause' : 'Resume'}
                                    >
                                        {a.enabled ? <Pause size={11} /> : <Play size={11} />}
                                    </button>
                                    <button
                                        onClick={() => deleteAgent(a.id)}
                                        className="p-1 rounded text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                                        title="Delete"
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mb-2">{a.instruction}</p>
                            {a.lastRunAt && (
                                <div className="rounded border border-zinc-800/80 bg-zinc-950/60 p-2">
                                    <div className="flex items-center gap-1.5 text-[10px] mb-1">
                                        {a.lastOk ? (
                                            <Check size={9} className="text-emerald-400" />
                                        ) : (
                                            <X size={9} className="text-red-400" />
                                        )}
                                        <span className="text-zinc-500">
                                            {new Date(a.lastRunAt).toLocaleString()} · run {a.runs}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {a.lastOk ? a.lastOutput : a.lastError}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AmbientAgentsApp;
