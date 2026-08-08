import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { DesktopItem } from '../types';
import { bus } from '../lib/bus';
import { searchCommands, groupByCategory, type OfflineCommand } from '../lib/offlineCommands';
import { go, resolve, type ResolvedDestination } from '../lib/backroad';

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

  // Searched through the back road rather than a private list with private
  // ranking. Two things fall out of that: every router now agrees on what
  // "budget" matches, and the palette reaches destinations it never could —
  // typing a theme name switches theme, typing a provider opens AI Providers.
  const results = useMemo(() => (query.trim() ? resolve(query, 8) : []), [query]);

  // The desktop item behind a destination, for its icon and tile colour.
  // Absent for themes, providers and verbs, which have no tile — those fall
  // back to a kind badge rather than borrowing an unrelated app's icon.
  const itemFor = (address: string) => {
    const appId = address.startsWith('app:') ? address.slice(4) : null;
    if (!appId) return undefined;
    return items.find(i => i && (i.appId === appId || i.id === appId)) ?? undefined;
  };

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
      ...results.map(dest => ({ kind: 'app' as const, dest })),
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

  const launch = (dest?: ResolvedDestination) => {
    const target = dest ?? (entries[active]?.kind === 'app' ? entries[active].dest : undefined);
    if (target) {
      // One call, whatever the destination turns out to be — the palette no
      // longer needs to know that an app is a bus emit and a theme is a raw
      // CustomEvent.
      void go(target.address);
      setOpen(false);
      return;
    }
    const entry = entries[active];
    if (entry?.kind === 'command') runCommand(entry.command);
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
            results.map((dest, i) => {
              const item = itemFor(dest.address);
              const Icon = item?.icon;
              return (
                <button
                  key={dest.address}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => launch(dest)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${item?.bgColor || 'bg-zinc-800'}`}>
                    {Icon ? (
                      <Icon size={15} className="text-white" />
                    ) : (
                      <span className="text-[9px] uppercase text-zinc-400">{dest.kind.slice(0, 4)}</span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-zinc-200 truncate">{dest.label}</span>
                    {dest.kind !== 'app' && (
                      <span className="block text-[11px] text-zinc-500 truncate">
                        {dest.description || dest.address}
                      </span>
                    )}
                  </span>
                  {i === active && <CornerDownLeft size={14} className="text-zinc-500 shrink-0" />}
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
