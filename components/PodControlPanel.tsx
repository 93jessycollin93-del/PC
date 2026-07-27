/**
 * Pod Control Panel — compact, always-accessible dashboard over the real
 * SAS pod backend (src/sas-pod-system). Every dot and label reads live pod
 * state from the pod registry; nothing here is decorative. Local and
 * deterministic — no external AI calls.
 */
import React, { useEffect, useReducer, useState } from 'react';
import { Boxes, ChevronDown, Link2, Moon, Play, Plus, Trash2, Unlink, X, Zap } from 'lucide-react';
import {
  getPodControlCenter,
  formatBytes,
  type PodControlCenter,
  type PodView,
} from '../src/sas-pod-system/pod-control';

interface PodControlPanelProps {
  openWindows: { id: string; title: string }[];
}

type Dot = { className: string; label: string };

/** Truthful status dot: derived only from real registry + task state. */
const podDot = (p: PodView): Dot => {
  if (p.lastError) return { className: 'bg-red-500', label: `Error: ${p.lastError}` };
  if (p.task?.status === 'failed') {
    return { className: 'bg-red-500', label: `Task failed: ${p.task.result?.error || 'unknown'}` };
  }
  if (p.state === 'hydrating' || p.state === 'compressing') {
    return { className: 'bg-amber-400', label: p.state };
  }
  return { className: 'bg-emerald-400', label: `${p.state} · healthy` };
};

const worstDot = (pods: PodView[]): Dot => {
  const dots = pods.map(podDot);
  return (
    dots.find((d) => d.className.includes('red')) ||
    dots.find((d) => d.className.includes('amber')) ||
    dots[0] || { className: 'bg-zinc-600', label: 'no pods' }
  );
};

export const PodControlPanel: React.FC<PodControlPanelProps> = ({ openWindows }) => {
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState<PodControlCenter | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    setCenter(getPodControlCenter());
  }, []);

  useEffect(() => {
    if (!center) return;
    return center.subscribe(force);
  }, [center]);

  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);

  // Build form
  const [buildName, setBuildName] = useState('');
  const [buildTier, setBuildTier] = useState('tier_5mb');
  const [buildBudget, setBuildBudget] = useState(120);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Per-pod task runner
  const [taskInput, setTaskInput] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);

  // Attach target per selected pod
  const [attachTarget, setAttachTarget] = useState('');

  const pods = center ? center.getPods() : [];
  const tiers = center ? center.listTiers() : [];
  const status = center?.getSystemStatus();
  const selected = pods.find((p) => p.podId === selectedPodId) || null;

  const handleBuild = async () => {
    if (!center || buildBusy) return;
    setBuildBusy(true);
    setBuildError(null);
    try {
      const podId = await center.buildPod(buildName, buildTier, buildBudget);
      setBuildName('');
      setSelectedPodId(podId);
    } catch (e: any) {
      setBuildError(e?.message || 'Build failed');
    } finally {
      setBuildBusy(false);
    }
  };

  const handleRunTask = async () => {
    if (!center || !selected || taskBusy) return;
    setTaskBusy(true);
    try {
      await center.runTask(selected.podId, taskInput);
    } catch {
      // runTask records failures on the pod itself; the row shows them.
    } finally {
      setTaskBusy(false);
    }
  };

  const selectPod = (podId: string) => {
    setSelectedPodId((prev) => (prev === podId ? null : podId));
    setAttachTarget('');
  };

  return (
    <div className="fixed bottom-16 left-3 z-[3985] font-sans text-zinc-200 select-none">
      {/* Expanded panel */}
      {open && center && (
        <div className="mb-2 w-[340px] max-w-[calc(100vw-1.5rem)] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Boxes size={12} className="text-cyan-400" /> Pod Control
              </div>
              {status && (
                <div className="text-[9px] text-zinc-500">
                  {status.hardware.name} · {status.activePods.instances} instances · {status.activePods.storage}
                </div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400" title="Close panel">
              <X size={13} />
            </button>
          </div>

          {/* Pod list */}
          <div className="max-h-72 overflow-y-auto">
            {pods.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-zinc-500">
                No pods yet — build one below.
              </div>
            ) : (
              pods.map((pod) => {
                const dot = podDot(pod);
                const isSel = selectedPodId === pod.podId;
                return (
                  <div key={pod.podId} className={`border-b border-zinc-900 ${isSel ? 'bg-zinc-900/60' : ''}`}>
                    <button
                      onClick={() => selectPod(pod.podId)}
                      className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-900/40"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot.className}`} title={dot.label} />
                      <span className="text-[11px] font-semibold text-zinc-100 truncate">{pod.name}</span>
                      <span className="text-[9px] text-zinc-500 shrink-0">{formatBytes(pod.tierSize)}</span>
                      <span className="ml-auto text-[9px] text-zinc-400 shrink-0">
                        {pod.state}
                        {pod.task?.status === 'running' ? ' · running' : ''}
                      </span>
                      <span className="text-[9px] text-cyan-500 shrink-0">≤{pod.wordBudget}w</span>
                      <ChevronDown size={11} className={`shrink-0 text-zinc-600 ${isSel ? 'rotate-180' : ''}`} />
                    </button>

                    {isSel && (
                      <div className="px-3 pb-2.5 space-y-2">
                        {/* Status detail — real state, spelled out */}
                        <div className="text-[9px] text-zinc-500">
                          {dot.label}
                          {pod.attachedTo && <> · attached to <span className="text-zinc-300">{pod.attachedTo.windowTitle}</span></>}
                        </div>

                        {/* Last task result — proof the budget is enforced */}
                        {pod.task?.result && pod.task.status === 'complete' && (
                          <div className="text-[9px] text-emerald-400/90 bg-emerald-950/30 border border-emerald-900/50 rounded px-2 py-1">
                            Task: {pod.task.result.wordsIn} words in → {pod.task.result.wordsOut} out
                            {pod.task.result.truncated ? ` (cut at ${pod.task.result.wordBudget}-word budget)` : ' (within budget)'}
                          </div>
                        )}
                        {pod.task?.status === 'failed' && pod.task.result?.error && (
                          <div className="text-[9px] text-red-400 bg-red-950/30 border border-red-900/50 rounded px-2 py-1">
                            {pod.task.result.error}
                          </div>
                        )}

                        {/* Lifecycle + word budget */}
                        <div className="flex items-center gap-1.5">
                          {pod.hasActiveInstance ? (
                            <button
                              onClick={() => center.restPod(pod.podId)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                              title="Compress back to dormant seed"
                            >
                              <Moon size={10} /> Rest
                            </button>
                          ) : (
                            <button
                              onClick={() => center.hydratePod(pod.podId)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-800/50 text-cyan-300"
                              title="Expand seed to active instance"
                            >
                              <Zap size={10} /> Hydrate
                            </button>
                          )}
                          <label className="ml-auto flex items-center gap-1 text-[9px] text-zinc-500">
                            budget
                            <input
                              type="number"
                              min={1}
                              value={pod.wordBudget}
                              onChange={(e) => center.setWordBudget(pod.podId, parseInt(e.target.value) || 1)}
                              className="w-14 px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-200 outline-none focus:border-cyan-700"
                            />
                            w
                          </label>
                          <button
                            onClick={() => { center.removePod(pod.podId); setSelectedPodId(null); }}
                            className="p-1 rounded hover:bg-red-900/30 text-red-500/80"
                            title="Remove pod"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {/* Run a task through the pod */}
                        <div className="flex gap-1.5">
                          <input
                            value={taskInput}
                            onChange={(e) => setTaskInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRunTask()}
                            placeholder="Text for this pod to process…"
                            className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-200 outline-none focus:border-cyan-700"
                          />
                          <button
                            onClick={handleRunTask}
                            disabled={taskBusy}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300"
                            title="Run task (respects word budget)"
                          >
                            <Play size={10} /> Run
                          </button>
                        </div>

                        {/* Attach to an open window */}
                        {pod.attachedTo ? (
                          <button
                            onClick={() => center.detachPod(pod.podId)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                          >
                            <Unlink size={10} /> Detach from {pod.attachedTo.windowTitle}
                          </button>
                        ) : openWindows.length > 0 ? (
                          <div className="flex gap-1.5">
                            <select
                              value={attachTarget}
                              onChange={(e) => setAttachTarget(e.target.value)}
                              className="flex-1 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 outline-none focus:border-cyan-700"
                            >
                              <option value="">Attach to window…</option>
                              {openWindows.map((w) => (
                                <option key={w.id} value={w.id}>{w.title}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const win = openWindows.find((w) => w.id === attachTarget);
                                if (win) center.attachPod(pod.podId, win.id, win.title);
                              }}
                              disabled={!attachTarget}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300"
                            >
                              <Link2 size={10} /> Attach
                            </button>
                          </div>
                        ) : (
                          <div className="text-[9px] text-zinc-600">Open an app window to attach this pod to it.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Build a new pod */}
          <div className="px-3 py-2.5 border-t border-zinc-800 bg-zinc-900/40 space-y-1.5">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Build pod</div>
            <div className="flex gap-1.5">
              <input
                value={buildName}
                onChange={(e) => setBuildName(e.target.value)}
                placeholder="Name (optional)"
                className="flex-1 min-w-0 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-200 outline-none focus:border-cyan-700"
              />
              <select
                value={buildTier}
                onChange={(e) => setBuildTier(e.target.value)}
                className="w-[110px] px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 outline-none focus:border-cyan-700"
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatBytes(t.size)} {t.status === 'on-demand' ? '(on-demand)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1.5 items-center">
              <label className="flex items-center gap-1 text-[9px] text-zinc-500">
                word limit
                <input
                  type="number"
                  min={1}
                  value={buildBudget}
                  onChange={(e) => setBuildBudget(parseInt(e.target.value) || 1)}
                  className="w-16 px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-200 outline-none focus:border-cyan-700"
                />
              </label>
              <button
                onClick={handleBuild}
                disabled={buildBusy}
                className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white"
              >
                <Plus size={10} /> {buildBusy ? 'Building…' : 'Build'}
              </button>
            </div>
            {buildError && <div className="text-[9px] text-red-400">{buildError}</div>}
          </div>
        </div>
      )}

      {/* Collapsed pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur border border-zinc-800 hover:border-zinc-700 shadow-lg"
        title="Pod Control Panel"
      >
        <Boxes size={13} className="text-cyan-400" />
        <span className="text-[11px] font-semibold">Pods</span>
        {center && pods.length > 0 && (
          <>
            <span className="text-[10px] text-zinc-400">{pods.length}</span>
            <span className={`w-2 h-2 rounded-full ${worstDot(pods).className}`} title={worstDot(pods).label} />
          </>
        )}
      </button>
    </div>
  );
};
