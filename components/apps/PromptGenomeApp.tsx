/**
 * Prompt Genome — version control for prompts, with evidence.
 *
 * A prompt is code you cannot compile, so the only way to know a change was
 * an improvement is to run both against the same input and compare. This
 * keeps every version, lets you fork one into the next, and races two
 * versions head to head so "better" is a result rather than a feeling.
 */
import React, { useMemo, useState } from 'react';
import { Dna, GitBranch, Loader2, Save, Swords, Trash2 } from 'lucide-react';
import { safeGetJSON, safeSetJSON } from '../../lib/safeStorage';
import { race, type RaceResult } from '../../lib/ai/parallel';

interface Version {
    id: string;
    body: string;
    note: string;
    at: number;
    /** Wins recorded in head-to-head trials. */
    wins: number;
    trials: number;
}

interface Lineage {
    id: string;
    name: string;
    versions: Version[];
}

const STORAGE_KEY = 'jackie_prompt_genome_v1';

export const PromptGenomeApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [note, setNote] = useState('');
    const [testInput, setTestInput] = useState('');
    const [trial, setTrial] = useState<RaceResult[]>([]);
    const [running, setRunning] = useState(false);
    const [compare, setCompare] = useState<[string, string] | null>(null);

    const lineages = useMemo(() => safeGetJSON<Lineage[]>(STORAGE_KEY, []), [tick]);
    const active = lineages.find((l) => l.id === activeId) ?? null;

    function persist(list: Lineage[]) {
        safeSetJSON(STORAGE_KEY, list, { silent: true });
        setTick((t) => t + 1);
    }

    function newLineage() {
        const name = prompt('Name this prompt lineage');
        if (!name?.trim()) return;
        const l: Lineage = { id: crypto.randomUUID(), name: name.trim(), versions: [] };
        persist([...lineages, l]);
        setActiveId(l.id);
    }

    function commit() {
        if (!active || !draft.trim()) return;
        const v: Version = {
            id: crypto.randomUUID(),
            body: draft,
            note: note.trim() || `v${active.versions.length + 1}`,
            at: Date.now(),
            wins: 0,
            trials: 0,
        };
        persist(lineages.map((l) => (l.id === active.id ? { ...l, versions: [...l.versions, v] } : l)));
        setNote('');
    }

    /** Race two versions on the same input, then record which won. */
    async function runTrial() {
        if (!active || !compare || !testInput.trim()) return;
        const [aId, bId] = compare;
        const a = active.versions.find((v) => v.id === aId);
        const b = active.versions.find((v) => v.id === bId);
        if (!a || !b) return;

        setRunning(true);
        setTrial([]);
        // Both variants get the identical user input; only the system prompt
        // differs, which is the whole point of the comparison.
        const results = await Promise.all([
            race(testInput, [{ ref: '', label: a.note }], { system: a.body }),
            race(testInput, [{ ref: '', label: b.note }], { system: b.body }),
        ]);
        setTrial([results[0][0], results[1][0]]);
        setRunning(false);
    }

    function recordWin(versionId: string) {
        if (!active || !compare) return;
        persist(
            lineages.map((l) =>
                l.id !== active.id
                    ? l
                    : {
                          ...l,
                          versions: l.versions.map((v) =>
                              compare.includes(v.id)
                                  ? { ...v, trials: v.trials + 1, wins: v.wins + (v.id === versionId ? 1 : 0) }
                                  : v,
                          ),
                      },
            ),
        );
    }

    return (
        <div className="h-full w-full flex bg-zinc-950 text-zinc-200 font-sans">
            <aside className="w-44 shrink-0 border-r border-zinc-800 flex flex-col">
                <button
                    onClick={newLineage}
                    className="m-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] flex items-center justify-center gap-1"
                >
                    <Dna size={11} /> New lineage
                </button>
                <div className="flex-1 overflow-y-auto">
                    {lineages.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => setActiveId(l.id)}
                            className={`w-full text-left px-2.5 py-2 border-b border-zinc-900 ${
                                l.id === activeId ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                            }`}
                        >
                            <div className="text-[11px] truncate">{l.name}</div>
                            <div className="text-[9px] text-zinc-600">{l.versions.length} versions</div>
                        </button>
                    ))}
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                {!active ? (
                    <p className="m-auto text-[11px] text-zinc-600">Pick or create a lineage.</p>
                ) : (
                    <>
                        <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
                            <GitBranch size={13} className="text-fuchsia-400" />
                            <span className="text-xs font-bold">{active.name}</span>
                            <button
                                onClick={() => persist(lineages.filter((l) => l.id !== active.id))}
                                className="ml-auto p-1 rounded text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            <section>
                                <h3 className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Versions</h3>
                                <div className="space-y-1.5">
                                    {active.versions.map((v) => {
                                        const rate = v.trials ? Math.round((v.wins / v.trials) * 100) : null;
                                        const selected = compare?.includes(v.id);
                                        return (
                                            <div
                                                key={v.id}
                                                className={`rounded border p-2 ${
                                                    selected ? 'border-fuchsia-700 bg-fuchsia-950/20' : 'border-zinc-800 bg-zinc-900/40'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[11px] font-medium">{v.note}</span>
                                                    {rate !== null && (
                                                        <span
                                                            className={`text-[10px] ${rate >= 50 ? 'text-emerald-400' : 'text-zinc-500'}`}
                                                        >
                                                            {rate}% win ({v.wins}/{v.trials})
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => setDraft(v.body)}
                                                        className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-200"
                                                        title="Fork into the editor"
                                                    >
                                                        fork
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setCompare((prev) => {
                                                                if (!prev) return [v.id, v.id];
                                                                if (prev[0] === v.id) return null;
                                                                return [prev[0], v.id];
                                                            })
                                                        }
                                                        className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300"
                                                    >
                                                        {selected ? 'unpick' : 'compare'}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-zinc-500 line-clamp-2 font-mono">{v.body}</p>
                                            </div>
                                        );
                                    })}
                                    {active.versions.length === 0 && (
                                        <p className="text-[10px] text-zinc-600">No versions yet — write one below.</p>
                                    )}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">
                                    New version
                                </h3>
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="System prompt…"
                                    rows={5}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] font-mono outline-none focus:border-fuchsia-500/60 placeholder:text-zinc-700 resize-none"
                                />
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="what changed?"
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-fuchsia-500/60 placeholder:text-zinc-700"
                                    />
                                    <button
                                        onClick={commit}
                                        disabled={!draft.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-fuchsia-800/60 hover:bg-fuchsia-700/60 text-[11px] disabled:opacity-40"
                                    >
                                        <Save size={10} /> Commit
                                    </button>
                                </div>
                            </section>

                            {compare && compare[0] !== compare[1] && (
                                <section className="rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/10 p-2.5">
                                    <h3 className="text-[10px] uppercase tracking-wider text-fuchsia-400 mb-1.5">
                                        Head to head
                                    </h3>
                                    <input
                                        value={testInput}
                                        onChange={(e) => setTestInput(e.target.value)}
                                        placeholder="Test input both versions get…"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none mb-1.5 placeholder:text-zinc-700"
                                    />
                                    <button
                                        onClick={runTrial}
                                        disabled={running || !testInput.trim()}
                                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-fuchsia-700/60 hover:bg-fuchsia-600/60 text-[11px] disabled:opacity-40"
                                    >
                                        {running ? <Loader2 size={11} className="animate-spin" /> : <Swords size={11} />}
                                        Run both
                                    </button>
                                    {trial.length === 2 && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {trial.map((t, i) => (
                                                <div key={i} className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                                                    <div className="text-[10px] font-medium mb-1">{t.label}</div>
                                                    <p className="text-[10px] text-zinc-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                                        {t.ok ? t.text : t.error}
                                                    </p>
                                                    <button
                                                        onClick={() => recordWin(compare[i])}
                                                        className="mt-1.5 w-full py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/40 text-[10px] text-emerald-300"
                                                    >
                                                        This one won
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PromptGenomeApp;
