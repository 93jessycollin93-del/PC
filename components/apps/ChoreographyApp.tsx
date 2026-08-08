/**
 * Window Choreography — named layouts that snap into place.
 *
 * The window manager can already put anything anywhere; what it lacked was
 * intent. "Research mode" is a real thing you do — ResearchRabbit, Notepad
 * and a Terminal, arranged the same way every time — and rebuilding it by
 * hand each morning is friction the OS should absorb.
 *
 * A scene stores app ids, not window ids: window ids are per-session, so a
 * scene keyed on them would restore nothing the next day.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Play, Plus, Trash2 } from 'lucide-react';
import { safeGetJSON, safeSetJSON } from '../../lib/safeStorage';
import { bus } from '../../lib/bus';
import { APP_REGISTRY } from '../../lib/appRegistry';

interface Scene {
    id: string;
    name: string;
    appIds: string[];
    createdAt: number;
}

const STORAGE_KEY = 'jackie_scenes_v1';

const PRESETS: { name: string; appIds: string[] }[] = [
    { name: 'Research', appIds: ['research_rabbit', 'notepad', 'semantic_scholar'] },
    { name: 'AI Lab', appIds: ['ai_providers', 'colosseum', 'speed_racer'] },
    { name: 'Ops', appIds: ['budget_radar', 'cartographer', 'bus_recorder'] },
];

export const ChoreographyApp: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [name, setName] = useState('');
    const [picked, setPicked] = useState<string[]>([]);
    const [filter, setFilter] = useState('');

    const scenes = useMemo(() => safeGetJSON<Scene[]>(STORAGE_KEY, []), [tick]);

    // The registry is the list of things that can actually be opened.
    const apps = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return Object.entries(APP_REGISTRY)
            .map(([id, def]) => ({ id, label: (def as { label?: string }).label || id }))
            .filter((a) => !q || a.label.toLowerCase().includes(q) || a.id.includes(q));
    }, [filter]);

    function persist(list: Scene[]) {
        safeSetJSON(STORAGE_KEY, list, { silent: true });
        setTick((t) => t + 1);
    }

    function save() {
        if (!name.trim() || picked.length === 0) return;
        persist([...scenes, { id: crypto.randomUUID(), name: name.trim(), appIds: picked, createdAt: Date.now() }]);
        setName('');
        setPicked([]);
    }

    /** Open a scene. Staggered: a burst of simultaneous launches makes the
     *  window manager cascade them on top of each other. */
    async function playScene(appIds: string[]) {
        for (const appId of appIds) {
            bus.emit('launch-app', { appId });
            await new Promise((r) => setTimeout(r, 260));
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200 font-sans">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
                <LayoutGrid size={16} className="text-orange-400" />
                <h1 className="text-sm font-bold">Window Choreography</h1>
                <span className="text-[10px] text-zinc-500">{scenes.length} scenes</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <section>
                    <h2 className="text-xs font-bold mb-2">Your scenes</h2>
                    {scenes.length === 0 && (
                        <p className="text-[11px] text-zinc-600 mb-2">
                            None yet — build one below, or start from a preset.
                        </p>
                    )}
                    <div className="space-y-1.5">
                        {scenes.map((s) => (
                            <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{s.name}</span>
                                    <span className="text-[10px] text-zinc-500">{s.appIds.length} apps</span>
                                    <button
                                        onClick={() => playScene(s.appIds)}
                                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-orange-900/50 hover:bg-orange-800/50 text-[10px]"
                                    >
                                        <Play size={9} /> Open
                                    </button>
                                    <button
                                        onClick={() => persist(scenes.filter((x) => x.id !== s.id))}
                                        className="p-1 rounded text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                                <p className="mt-1 text-[9px] text-zinc-600 font-mono truncate">
                                    {s.appIds.join(' · ')}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-xs font-bold mb-2">Presets</h2>
                    <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map((p) => (
                            <button
                                key={p.name}
                                onClick={() => playScene(p.appIds)}
                                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-[10px]"
                            >
                                ▶ {p.name}
                            </button>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                        <Plus size={11} /> Build a scene
                    </h2>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Scene name"
                        className="w-full mb-1.5 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-orange-500/60 placeholder:text-zinc-700"
                    />
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="find apps…"
                        className="w-full mb-1.5 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-orange-500/60 placeholder:text-zinc-700"
                    />
                    <div className="max-h-48 overflow-y-auto rounded border border-zinc-800 mb-2">
                        {apps.slice(0, 80).map((a) => (
                            <button
                                key={a.id}
                                onClick={() =>
                                    setPicked((prev) =>
                                        prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                                    )
                                }
                                className={`w-full text-left px-2 py-1 text-[10px] border-b border-zinc-900 ${
                                    picked.includes(a.id) ? 'bg-orange-950/40 text-orange-200' : 'hover:bg-zinc-900'
                                }`}
                            >
                                {picked.includes(a.id) ? `${picked.indexOf(a.id) + 1}. ` : ''}
                                {a.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={save}
                        disabled={!name.trim() || picked.length === 0}
                        className="w-full py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-[11px] disabled:opacity-40"
                    >
                        Save scene ({picked.length} apps, opened in order)
                    </button>
                </section>
            </div>
        </div>
    );
};

export default ChoreographyApp;
