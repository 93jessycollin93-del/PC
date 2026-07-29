import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ChevronLeft, BookOpen, FolderOpen } from 'lucide-react';
import { bus } from '../lib/bus';
import { mainRouter } from '../lib/routerMenu/mainRouter';
import {
  isBackWord,
  searchEntries,
  resolveInput,
  type GuideContent,
  type MenuEntry,
  type RouterDefinition,
} from '../lib/routerMenu/types';

/**
 * The router menu — the front door, reachable from everywhere.
 *
 * A thin View. It holds no catalog and makes no routing decision; it renders
 * whichever router is open and dispatches what the user picks.
 *
 * Navigation is a stack: opening a sub-router pushes, "back" pops. The loaded
 * definition is dropped on pop, so a sub-router that is closed stops occupying
 * anything — the recompression half of "decompress when named".
 */

export const RouterMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<RouterDefinition[]>([mainRouter]);
  const [guide, setGuide] = useState<GuideContent | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const router = stack[stack.length - 1];
  const results = useMemo(() => searchEntries(query, router.entries), [query, router]);

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

  useEffect(() => bus.on('open-router-menu', () => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;
    setStack([mainRouter]);
    setGuide(null);
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results, active]);

  /** Pop a level, dropping the loaded sub-router with it. */
  const goBack = useCallback(() => {
    if (guide) {
      setGuide(null);
      return;
    }
    if (stack.length > 1) {
      setStack(s => s.slice(0, -1));
      setQuery('');
      return;
    }
    setOpen(false);
  }, [guide, stack.length]);

  const choose = useCallback(async (entry: MenuEntry) => {
    if (entry.kind === 'command') {
      (bus.emit as (c: string, p?: unknown) => void)(entry.channel, entry.payload);
      setOpen(false);
      return;
    }
    // Sub-routers and guides arrive over a dynamic import — this is the
    // decompression, and the only moment their content costs anything.
    setLoading(true);
    try {
      if (entry.kind === 'subrouter') {
        const loaded = await entry.load();
        setStack(s => [...s, loaded]);
        setQuery('');
        setActive(0);
      } else {
        setGuide(await entry.load());
      }
    } catch {
      // A guide that will not load must not trap the user in a blank panel.
      setGuide(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isBackWord(query)) {
        goBack();
        setQuery('');
        return;
      }
      // A typed number or exact name wins over the highlighted row, so typing
      // "7" then Enter selects seven rather than whatever happened to be first.
      const direct = resolveInput(query, router.entries);
      const target = direct ?? results[active];
      if (target) void choose(target);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[94%] max-w-2xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
          {(stack.length > 1 || guide) && (
            <button onClick={goBack} title="Back" className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
              <ChevronLeft size={16} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-200 truncate">{guide ? guide.title : router.title}</div>
            <div className="text-[11px] text-zinc-500 truncate">{guide ? guide.purpose : router.purpose}</div>
          </div>
          <kbd className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">esc</kbd>
        </div>

        {guide ? (
          <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
            {guide.sections.map(section => (
              <div key={section.heading} className="mb-4">
                <h3 className="text-sm text-zinc-200 mb-1.5">{section.heading}</h3>
                {section.body.map((line, i) => (
                  <p key={i} className="text-[13px] text-zinc-400 leading-relaxed mb-1.5">{line}</p>
                ))}
              </div>
            ))}
            <button onClick={goBack} className="text-[11px] text-zinc-500 hover:text-zinc-300">
              Back to {router.title}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 border-b border-zinc-800">
              <Search size={15} className="text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Type a name or a number.  'back' to go up."
                className="flex-1 bg-transparent py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              />
              <span className="text-[10px] text-zinc-600 shrink-0">{results.length} entries</span>
            </div>

            <div className="max-h-[55vh] overflow-y-auto py-1">
              {loading && <div className="px-4 py-3 text-sm text-zinc-500">Opening…</div>}
              {!loading && results.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-zinc-500">Nothing matches that</div>
              )}
              {!loading &&
                results.map((entry, i) => {
                  const position = router.entries.indexOf(entry) + 1;
                  return (
                    <button
                      key={entry.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => void choose(entry)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        i === active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      <span className="w-7 text-[11px] text-zinc-600 tabular-nums shrink-0">{position}</span>
                      {entry.kind === 'subrouter' && <FolderOpen size={13} className="text-emerald-400/80 shrink-0" />}
                      {entry.kind === 'guide' && <BookOpen size={13} className="text-sky-400/80 shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-zinc-200 truncate">{entry.label}</span>
                        {entry.hint && (
                          <span className="block text-[11px] text-zinc-500 truncate">{entry.hint}</span>
                        )}
                      </span>
                      {i === active && <CornerDownLeft size={13} className="text-zinc-500 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RouterMenu;
