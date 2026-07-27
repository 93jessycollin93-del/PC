import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { DesktopItem } from '../types';
import { bus } from '../lib/bus';

/**
 * Command Palette — global ⌘K / Ctrl-K launcher.
 *
 * Fuzzy-searches every desktop app and launches it by emitting `launch-app` on
 * the Jackie Bus (the same channel FloatingNav and the apps use), so it needs no
 * special wiring beyond the desktop item list. Keyboard-first: ⌘K/Ctrl-K to open,
 * arrows to move, Enter to launch, Esc to close.
 */

interface CommandPaletteProps {
  items: DesktopItem[];
}

/** Lightweight subsequence fuzzy match with a simple relevance score. */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 1000 - t.length;
  if (t.includes(q)) return 500 - t.indexOf(q);
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global open/close hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after the overlay mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const launchable = items.filter(i => i && i.type === 'app' && i.appId);
    return launchable
      .map(item => ({ item, score: fuzzyScore(query, item.name) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.item);
  }, [items, query]);

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results, active]);

  const launch = (item?: DesktopItem) => {
    const target = item || results[active];
    if (target && target.appId) {
      bus.emit('launch-app', { appId: target.appId });
      setOpen(false);
    }
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      launch();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[92%] max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search apps…  (⌘K / Ctrl-K)"
            className="flex-1 bg-transparent py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
          />
          <kbd className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No matching apps</div>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => launch(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${item.bgColor || 'bg-zinc-800'}`}>
                    {Icon && <Icon size={15} className="text-white" />}
                  </span>
                  <span className="flex-1 text-sm text-zinc-200">{item.name}</span>
                  {i === active && <CornerDownLeft size={14} className="text-zinc-500" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
