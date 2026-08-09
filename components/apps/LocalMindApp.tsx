/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local Mind — models that run in THIS TAB.
 *
 * The distinction from "Ollama Models" is the whole point and is easy to lose:
 *
 *   Ollama Models   asks software on your machine to download a model. Needs
 *                   PC's server, an endpoint, and Ollama installed. Cannot
 *                   work inside the Jackie embed at all.
 *   Local Mind      downloads weights into this browser and runs them here.
 *                   No server, no account, no key, no external software. Once
 *                   cached it works with the network off, anywhere.
 *
 * PC shipped the second capability — `lib/localLlm.ts` runs transformers.js,
 * and `lib/offlineAiCatalog.ts` lists what it can run — but the only way in
 * was a side panel of the Local AI index finder. So the app named "Model
 * Store" was the one people found, and it was the one that could not put a
 * model on the device. This is the front door for the one that can.
 *
 * HONEST ABOUT COST
 * -----------------
 * Every figure here is the real download, stated before the button. The ONNX
 * runtime that executes these weights is already in PC's bundle, so unlike the
 * sibling app in the companion there is no hidden second download — what the
 * card says is what it costs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Check, Cpu, Download, Loader2, Trash2, Zap } from 'lucide-react';
import {
    browserRunnableModels,
    formatBytes,
    type OfflineModel,
} from '../../lib/offlineAiCatalog';
import {
    DEFAULT_LOCAL_MODEL_ID,
    isLocalModelLoaded,
    loadLocalModel,
    unloadLocalModel,
    generateLocally,
} from '../../lib/localLlm';
import { bus } from '../../lib/bus';

interface LoadState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    pct: number;
    phase: string;
    error?: string;
}

/**
 * `localLlm.ts` builds a `text-generation` pipeline, so it can only run models
 * of that task. Listing an embedding model beside a Load button that cannot
 * load it would repeat exactly the mistake this app exists to correct.
 */
const RUNNABLE_TASKS = new Set(['text-generation']);

/**
 * The catalog's `id` is a human slug ("smollm2-135m-onnx"); transformers.js
 * wants the Hugging Face repo path. The repo is the tail of the catalog's
 * canonical `url`, which is the only place it is recorded.
 *
 * Passing the slug straight through is silent and total: the pipeline would
 * request a repo that does not exist and fail on every model in the list.
 */
function repoId(model: OfflineModel): string | null {
    const match = /huggingface\.co\/([^/]+\/[^/?#]+)/.exec(model.url);
    return match ? match[1] : null;
}

export const LocalMindApp: React.FC = () => {
    const [models, setModels] = useState<OfflineModel[]>([]);
    const [selected, setSelected] = useState<string>('');
    const [load, setLoad] = useState<LoadState>({ status: 'idle', pct: 0, phase: '' });
    const [prompt, setPrompt] = useState('');
    const [reply, setReply] = useState<string | null>(null);
    const [thinking, setThinking] = useState(false);

    useEffect(() => {
        const runnable = browserRunnableModels().filter(m => RUNNABLE_TASKS.has(m.task) && repoId(m));
        setModels(runnable);

        // Prefer the module's default when it is genuinely in the list;
        // otherwise take the first entry. Selecting something absent leaves the
        // button disabled forever with nothing explaining why.
        const preferred =
            runnable.find(m => repoId(m) === DEFAULT_LOCAL_MODEL_ID) ?? runnable[0] ?? null;
        if (preferred) {
            setSelected(preferred.id);
            const repo = repoId(preferred);
            if (repo && isLocalModelLoaded(repo)) setLoad({ status: 'ready', pct: 100, phase: 'ready' });
        }
    }, []);

    const current = models.find(m => m.id === selected) ?? null;

    const doLoad = useCallback(async () => {
        const repo = current ? repoId(current) : null;
        if (!current || !repo || load.status === 'loading') return;
        setLoad({ status: 'loading', pct: 0, phase: 'starting…' });
        setReply(null);
        try {
            await loadLocalModel(repo, p => {
                // transformers.js reports per-file bytes; show the real number
                // rather than a spinner that implies nothing about progress.
                const pct =
                    typeof p.progress === 'number'
                        ? Math.round(p.progress)
                        : p.total && p.loaded
                          ? Math.round((p.loaded / p.total) * 100)
                          : 0;
                setLoad(prev => ({
                    status: 'loading',
                    pct: pct || prev.pct,
                    phase: p.file ? `${p.status ?? 'loading'} · ${p.file}` : (p.status ?? prev.phase),
                }));
            });
            setLoad({ status: 'ready', pct: 100, phase: 'ready' });
            bus.emit('jackie-notification', {
                level: 'success',
                title: `On-device model ready — ${current.name}`,
                message: 'Runs in this tab. Works with the network off.',
                source: 'local mind',
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setLoad({ status: 'error', pct: 0, phase: '', error: msg });
        }
    }, [current, load.status]);

    const doUnload = () => {
        unloadLocalModel();
        setLoad({ status: 'idle', pct: 0, phase: '' });
        setReply(null);
    };

    const ask = async () => {
        if (!prompt.trim() || load.status !== 'ready') return;
        setThinking(true);
        setReply(null);
        try {
            setReply(await generateLocally(prompt.trim(), 96));
        } catch (e) {
            setReply(`[failed: ${e instanceof Error ? e.message : String(e)}]`);
        } finally {
            setThinking(false);
        }
    };

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-black font-sans text-zinc-300">
            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-7">
                {/* hero */}
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700">
                        <Brain size={22} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Local Mind</h2>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
                        Models that run <span className="text-zinc-300">inside this tab</span>. No server, no
                        account, no key, no Ollama. Downloaded once, then it works with the network off.
                    </p>
                </div>

                {/* the distinction, stated once, where it prevents the confusion */}
                <div className="mx-auto mb-5 max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                        Looking for <span className="text-zinc-300">Ollama Models</span>? That one asks Ollama on
                        your machine to pull a model — it needs PC&rsquo;s server and Ollama installed. This one
                        needs neither.
                    </p>
                </div>

                {/* model list */}
                <div className="mx-auto flex max-w-xl flex-col gap-2">
                    {models.length === 0 && (
                        <p className="py-6 text-center text-xs text-zinc-600">
                            No browser-runnable text models in the catalog.
                        </p>
                    )}
                    {models.map(m => {
                        const active = m.id === selected;
                        const repo = repoId(m);
                        const loaded = repo ? isLocalModelLoaded(repo) : false;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setSelected(m.id)}
                                className={`rounded-xl border p-3 text-left transition-colors ${
                                    active
                                        ? 'border-violet-500 bg-violet-950/30'
                                        : 'border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Cpu size={13} className="shrink-0 text-zinc-500" />
                                    <span className="text-sm font-medium text-zinc-100">{m.name}</span>
                                    {loaded && (
                                        <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                            in memory
                                        </span>
                                    )}
                                    <span className="ml-auto shrink-0 text-[11px] text-zinc-500">
                                        {formatBytes(m.approxBytes)}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{m.offlineNotes}</p>
                                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600">
                                    {m.params && <span>{m.params} params</span>}
                                    <span>·</span>
                                    <span>{m.license}</span>
                                    {!m.verified && (
                                        <>
                                            <span>·</span>
                                            <span className="text-amber-500/80">size unverified</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* try it */}
                {load.status === 'ready' && (
                    <div className="mx-auto mt-5 max-w-xl rounded-xl border border-zinc-800 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                            <Zap size={11} /> Running here, offline
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && void ask()}
                                placeholder="Say something to it…"
                                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-violet-500"
                            />
                            <button
                                onClick={() => void ask()}
                                disabled={thinking || !prompt.trim()}
                                className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                            >
                                {thinking ? <Loader2 size={13} className="animate-spin" /> : 'Ask'}
                            </button>
                        </div>
                        {reply && (
                            <p className="mt-2 whitespace-pre-wrap rounded bg-zinc-900/60 p-2 text-xs leading-relaxed text-zinc-300">
                                {reply}
                            </p>
                        )}
                        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                            A model this small is for structure and routing, not knowledge. It will be confidently
                            wrong about facts — which is exactly why the seed system keeps facts in retrievable
                            text rather than in weights.
                        </p>
                    </div>
                )}
            </div>

            {/* action bar */}
            <div className="border-t border-zinc-800 px-5 py-3">
                {load.status === 'error' && (
                    <p className="mb-2 break-words text-center text-xs text-red-400">{load.error}</p>
                )}
                {load.status === 'loading' && (
                    <p className="mb-2 truncate text-center text-[11px] text-zinc-500">{load.phase}</p>
                )}

                {load.status === 'ready' ? (
                    <div className="mx-auto flex max-w-xl gap-2">
                        <div className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-900/40 py-3 text-sm font-semibold text-emerald-300">
                            <Check size={16} /> Loaded and running here
                        </div>
                        <button
                            onClick={doUnload}
                            title="Free the memory. The download stays cached."
                            className="rounded-full border border-zinc-700 px-4 text-xs text-zinc-400 hover:bg-zinc-900"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => void doLoad()}
                        disabled={load.status === 'loading' || !current}
                        className="mx-auto block w-full max-w-xl rounded-full bg-white py-3.5 text-base font-bold text-black transition-opacity disabled:opacity-50"
                    >
                        {load.status === 'loading' ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={18} className="animate-spin" />
                                Downloading ({load.pct}%)
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <Download size={17} />
                                {current ? `Download & run · ${formatBytes(current.approxBytes)}` : 'Pick a model'}
                            </span>
                        )}
                    </button>
                )}
                <p className="mt-2 text-center text-[10px] text-zinc-600">
                    Downloads go into this browser&rsquo;s cache. Keep the tab open until it finishes.
                </p>
            </div>
        </div>
    );
};

export default LocalMindApp;
