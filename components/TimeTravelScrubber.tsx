/**
 * TimeTravelScrubber — drag along the desktop's history, preview any point,
 * restore it, or fork a new timeline from it.
 *
 * Deliberately NOT a merge tool: forking gives you a place to explore an
 * alternate history, but reconciling two forks back together needs real
 * design work this component does not attempt. See src/desktop/timeTravel.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, RotateCcw, GitBranch, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import type { Commit, Branch } from '../src/desktop/timeTravel';

interface TimeTravelScrubberProps {
  history: Commit[];
  branches: Branch[];
  currentBranchId: string;
  integrityOk: boolean | null; // null while checking
  onSwitchBranch: (branchId: string) => void;
  onRestore: (commit: Commit) => void;
  onFork: (commit: Commit) => void;
  onClose: () => void;
}

function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const TimeTravelScrubber: React.FC<TimeTravelScrubberProps> = ({
  history, branches, currentBranchId, integrityOk, onSwitchBranch, onRestore, onFork, onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(history.length - 1);
  const [now, setNow] = useState(() => Date.now());

  // Keep the selection pinned to "latest" as new commits arrive, unless the
  // user has actually scrubbed backward.
  useEffect(() => {
    setSelectedIndex(prevIndex => {
      const wasAtEnd = prevIndex >= history.length - 2;
      return wasAtEnd ? history.length - 1 : Math.min(prevIndex, history.length - 1);
    });
  }, [history.length]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const selected = history[selectedIndex] || null;
  const isLatest = selectedIndex === history.length - 1;

  const itemCounts = useMemo(() => {
    if (!selected) return { total: 0 };
    return { total: selected.snapshot.desktopItemIds.filter(Boolean).length };
  }, [selected]);

  return (
    <div
      role="dialog"
      aria-label="Desktop history"
      // Above every other floating surface (GlobalTerminal/CommandPalette
      // sit at 9999-10000, FloatingNav at 4000) so its own action buttons
      // are never covered by a widget docked over the same screen region.
      className="fixed inset-x-0 bottom-0 z-[10001] bg-zinc-950/97 backdrop-blur-xl border-t border-zinc-800 shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.9)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-900">
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={15} className="text-amber-400 shrink-0" />
          <span className="text-sm font-semibold text-zinc-200">Desktop History</span>
          {integrityOk === false && (
            <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded" title="The history log failed its integrity check — a commit may have been altered outside the app.">
              <ShieldAlert size={11} /> chain broken
            </span>
          )}
          {integrityOk === true && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400" title="Every commit's hash matches its recorded content and its parent link.">
              <ShieldCheck size={11} /> verified
            </span>
          )}
          {branches.length > 1 && (
            <select
              value={currentBranchId}
              onChange={e => onSwitchBranch(e.target.value)}
              className="ml-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200" title="Close" aria-label="Close history">
          <X size={16} />
        </button>
      </div>

      {history.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-500">
          No history yet on this branch. Every folder you create, item you move, or wallpaper you change will show up here.
        </div>
      ) : (
        <>
          {/* Scrub track */}
          <div className="px-5 pt-4 pb-2">
            <input
              type="range"
              min={0}
              max={Math.max(history.length - 1, 0)}
              value={selectedIndex}
              onChange={e => setSelectedIndex(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Scrub through desktop history"
              aria-valuetext={selected ? selected.label : undefined}
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1 px-0.5">
              <span>{history.length > 0 ? relativeTime(history[0].timestamp, now) : ''}</span>
              <span>{isLatest ? 'now' : ''}</span>
            </div>
          </div>

          {/* Preview */}
          {selected && (
            <div className="px-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm text-zinc-100 font-medium truncate">{selected.label}</div>
                <div className="text-xs text-zinc-500">
                  {relativeTime(selected.timestamp, now)} &middot; {itemCounts.total} item(s) on the desktop
                  {isLatest && <span className="text-emerald-500"> &middot; current</span>}
                </div>
              </div>
              {!isLatest && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onFork(selected)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                    title="Branch off from this point without touching the current timeline"
                  >
                    <GitBranch size={13} /> Fork here
                  </button>
                  <button
                    onClick={() => onRestore(selected)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-black"
                    title="Make this the current desktop state"
                  >
                    <RotateCcw size={13} /> Restore this point
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
