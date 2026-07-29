import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { DesktopItem } from '../types';
import { bus } from '../lib/bus';
import { searchCommands, groupByCategory, type OfflineCommand } from '../lib/offlineCommands';

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

  // Visible trigger (FloatingNav's search button) for touch/mouse users who
  // have no keyboard shortcut to find — otherwise this whole search-every-app
  // feature is reachable only by someone who already knows to press ⌘K.
  useEffect(() => bus.on('open-command-palette', () => setOpen(true)), []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after the overlay mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const launchable = items.filter(i => i && i.type === 'app' && i.appId);
    return launchable
      .map(item => ({ item, score: fuzzyScore(query, item.name) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.item);
  }, [items, query]);

  // Offline commands — actions, not just apps. These are matched by plain
  // string comparison against a static catalog, so they keep working with no
  // network and no model, which is the whole reason they exist.
  const commandResults = useMemo(() => searchCommands(query), [query]);

  // With an empty box the palette shows the WHOLE catalog, grouped. Otherwise
  // it is only usable by someone who already knows what to type — which is
  // exactly the discoverability gap this closes.
  const browsing = !query.trim();
  const browseGroups = useMemo(
    () => (browsing ? groupByCategory(commandResults) : []),
    [browsing, commandResults]
  );


  // One flat list drives keyboard navigation, whether the palette is browsing
  // the catalog or showing search results, so arrows/Enter behave the same way
  // in both modes.
  const entries = useMemo(
    () => [
      ...results.map(item => ({ kind: 'app' as const, item })),
      ...commandResults.map(command => ({ kind: 'command' as const, command })),
    ],
    [results, commandResults]
  );

  useEffect(() => {
    if (active >= entries.length) setActive(0);
  }, [entries, active]);

  const runCommand = (command: OfflineCommand) => {
    // The payload shape is per-channel; the catalog is the source of truth for
    // which payload goes with which channel.
    (bus.emit as (c: string, p?: unknown) => void)(command.channel, command.payload);
    setOpen(false);
  };

  const launch = (item?: DesktopItem) => {
    if (item && item.appId) {
      bus.emit('launch-app', { appId: item.appId });
      setOpen(false);
      return;
    }
    const entry = entries[active];
    if (!entry) return;
    if (entry.kind === 'app' && entry.item.appId) {
      bus.emit('launch-app', { appId: entry.item.appId });
      setOpen(false);
    } else if (entry.kind === 'command') {
      runCommand(entry.command);
    }
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, entries.length - 1));
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
          {browsing ? (
            // The full catalog, grouped. Everything here works with no network
            // and no model, so it is the menu to reach for when nothing else
            // is reachable.
            browseGroups.map(group => (
              <div key={group.category}>
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-zinc-600">
                  {group.category}
                </div>
                {group.commands.map(command => {
                  const i = entries.findIndex(
                    e => e.kind === 'command' && e.command.id === command.id
                  );
                  return (
                    <button
                      key={command.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => runCommand(command)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        i === active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-zinc-200 truncate">{command.label}</span>
                        {command.hint && (
                          <span className="block text-[11px] text-zinc-500 truncate">{command.hint}</span>
                        )}
                      </span>
                      {i === active && <CornerDownLeft size={14} className="text-zinc-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          ) : entries.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No matching apps or commands</div>
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

          {/* Matching commands rank alongside apps rather than being hidden
              behind a separate mode, so "close", "save" or "why is this
              broken" are findable from the same box that launches apps. */}
          {!browsing &&
            commandResults.map(command => {
              const i = entries.findIndex(
                e => e.kind === 'command' && e.command.id === command.id
              );
              return (
                <button
                  key={command.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runCommand(command)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    i === active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-zinc-200 truncate">{command.label}</span>
                    <span className="block text-[11px] text-zinc-500 truncate">
                      {command.hint || command.category}
                    </span>
                  </span>
                  {i === active && <CornerDownLeft size={14} className="text-zinc-500 shrink-0" />}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
