/**
 * Bus Recorder — capture what the OS does, then replay it.
 *
 * Time-travel debugging and macros are the same mechanism seen from two
 * angles: if you can faithfully re-emit a sequence of events, you can both
 * diagnose what happened and repeat it deliberately.
 *
 * Only navigational channels are replayed (see REPLAYABLE in the recorder).
 * Re-firing a notification or an error would be theatre — it would show the
 * symptom without reproducing the cause.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Download, Play, Save, Square, Trash2, Radio } from 'lucide-react';
import {
    clearEvents,
    deleteRecording,
    getEvents,
    isRecording,
    listRecordings,
    loadRecording,
    replay,
    saveRecording,
    startRecording,
    stopRecording,
    subscribeRecorder,
    type BusEvent,
} from '../../lib/observe/recorder';

export const BusRecorderApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [name, setName] = useState('');
    const [replaying, setReplaying] = useState(false);
    const [cursor, setCursor] = useState(-1);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => subscribeRecorder(() => setTick((t) => t + 1)), []);

    const events = useMemo(() => getEvents(), [tick]);
    const saved = useMemo(() => listRecordings(), [tick]);
    const recording = isRecording();

    async function doReplay(list: BusEvent[]) {
        setReplaying(true);
        setCursor(-1);
        abortRef.current = new AbortController();
        await replay(list, {
            speed: 6,
            signal: abortRef.current.signal,
            onStep: (_e, i) => setCursor(i),
        });
        setReplaying(false);
        setCursor(-1);
    }

    return (
        <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200 font-sans">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                <Radio size={16} className="text-red-400" />
                <h1 className="text-sm font-bold">Bus Recorder</h1>
                <span className="text-[10px] text-zinc-500">{events.length} events</span>
                <button
                    onClick={() => (recording ? stopRecording() : startRecording())}
                    className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] ${
                        recording ? 'bg-red-900/60 text-red-200' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                >
                    {recording ? <Square size={10} /> : <Circle size={10} className="fill-current" />}
                    {recording ? 'Stop' : 'Record'}
                </button>
                <button
                    onClick={clearEvents}
                    className="p-1.5 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    title="Clear"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {!recording && events.length === 0 && (
                <p className="px-4 py-3 text-[11px] text-zinc-500 border-b border-zinc-800">
                    Capture is off by default — a recorder that runs unasked is surveillance, not a
                    tool. Press Record, use the desktop, then replay or save what happened.
                </p>
            )}

            <div className="flex flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto min-w-0">
                    {events.map((e, i) => (
                        <div
                            key={i}
                            className={`px-3 py-1.5 border-b border-zinc-900 flex items-start gap-2 ${
                                cursor === i ? 'bg-red-950/40' : ''
                            }`}
                        >
                            <span className="text-[9px] text-zinc-600 w-16 shrink-0 tabular-nums">
                                {new Date(e.at).toLocaleTimeString()}
                            </span>
                            <span className="text-[10px] text-cyan-300 w-40 shrink-0 truncate font-mono">
                                {e.channel}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate flex-1 font-mono">
                                {e.detail !== undefined ? JSON.stringify(e.detail) : ''}
                            </span>
                        </div>
                    ))}
                    {events.length === 0 && recording && (
                        <p className="p-6 text-center text-[11px] text-zinc-600">
                            Listening… go use the desktop and come back.
                        </p>
                    )}
                </div>

                <aside className="w-48 shrink-0 border-l border-zinc-800 p-2 space-y-2 overflow-y-auto">
                    <div className="space-y-1.5">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="name this take"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] outline-none focus:border-red-500/60 placeholder:text-zinc-600"
                        />
                        <button
                            onClick={() => {
                                if (!name.trim()) return;
                                saveRecording(name.trim());
                                setName('');
                            }}
                            disabled={!name.trim() || events.length === 0}
                            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] disabled:opacity-40"
                        >
                            <Save size={10} /> Save
                        </button>
                        <button
                            onClick={() => (replaying ? abortRef.current?.abort() : doReplay(events))}
                            disabled={events.length === 0}
                            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] disabled:opacity-40"
                        >
                            {replaying ? <Square size={10} /> : <Play size={10} />}
                            {replaying ? 'Stop replay' : 'Replay'}
                        </button>
                        <button
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'jackie-recording.json';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            disabled={events.length === 0}
                            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] disabled:opacity-40"
                        >
                            <Download size={10} /> Export
                        </button>
                    </div>

                    {saved.length > 0 && (
                        <div>
                            <h3 className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Macros</h3>
                            {saved.map((n) => (
                                <div key={n} className="flex items-center gap-1 mb-1">
                                    <button
                                        onClick={() => doReplay(loadRecording(n))}
                                        className="flex-1 min-w-0 text-left px-1.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] truncate"
                                        title={`Replay ${n}`}
                                    >
                                        ▶ {n}
                                    </button>
                                    <button
                                        onClick={() => deleteRecording(n)}
                                        className="p-1 rounded text-zinc-600 hover:text-red-400 shrink-0"
                                    >
                                        <Trash2 size={9} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default BusRecorderApp;
