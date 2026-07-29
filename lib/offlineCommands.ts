/**
 * Offline command catalog — the menu you can drive with no network and no AI.
 *
 * Every entry here is matched by plain string comparison against a static list.
 * There is deliberately NO model call, NO fetch, and NO async work anywhere in
 * this module: it exists precisely for the moment when the network is gone and
 * the local box is down, so anything that could fail in that moment would
 * defeat the point.
 *
 * The catalog is the single source of truth. The palette renders from it, so
 * adding a command is one entry here and zero UI changes.
 */

import type { BusChannel } from './bus';

export type CommandCategory =
  | 'Apps'
  | 'Windows'
  | 'Navigation'
  | 'Save & Data'
  | 'Time Travel'
  | 'Local AI'
  | 'Diagnostics'
  | 'Appearance';

export interface OfflineCommand {
  /** Stable id — used as a React key and for tests. */
  id: string;
  /** What the user sees in the menu. */
  label: string;
  /** Grouping in the browse menu. */
  category: CommandCategory;
  /** Extra words that should match this command (plural forms, synonyms,
   *  and the words someone actually types when they are lost). */
  keywords: string[];
  /** The bus channel to emit when the command runs. */
  channel: BusChannel;
  /** Payload for that channel, when the channel needs one. */
  payload?: unknown;
  /** Shown under the label so the menu explains itself. */
  hint?: string;
}

/** Launch an app by its registered appId. */
function launch(
  id: string,
  label: string,
  keywords: string[],
  hint?: string
): OfflineCommand {
  return {
    id: `open-${id}`,
    label,
    category: 'Apps',
    keywords: ['open', 'launch', 'start', 'go to', ...keywords],
    channel: 'launch-app',
    payload: { appId: id },
    hint,
  };
}

/**
 * The catalog.
 *
 * Ordered so the browse menu reads usefully top-to-bottom for someone who does
 * not yet know what the OS can do: get somewhere, manage what is open, get
 * back out, keep your work, then the deeper systems.
 */
export const OFFLINE_COMMANDS: readonly OfflineCommand[] = [
  // ---- Apps ---------------------------------------------------------------
  launch('mail', 'Open Mail', ['email', 'inbox', 'message']),
  launch('notepad', 'Open Notepad', ['note', 'text', 'write', 'document']),
  launch('slides', 'Open Slides', ['presentation', 'deck']),
  launch('terminal', 'Open Terminal', ['term', 'shell', 'console', 'command line']),
  launch('system_settings', 'Open System Settings', ['preferences', 'config', 'options']),
  launch('jacky', 'Open Jacky', ['assistant', 'ai', 'chat', 'agent']),
  launch('ollama', 'Open Local Models', ['ollama', 'local ai', 'gpu', 'offline model']),
  launch('knowledge', 'Search my documents', [
    'knowledge',
    'notes',
    'docs',
    'document',
    'find in my notes',
    'what did i write',
    'rag',
  ], 'Keyword search over your own documents — no network, no model'),
  launch('pod_system', 'Open Pods', ['pod', 'workspace']),
  launch('security_center', 'Open Security Center', ['secure', 'safety', 'audit']),
  launch('secrets_vault', 'Open Vault', ['secrets', 'keys', 'password']),
  launch('mission_control', 'Open Mission Control', ['cpu', 'ram', 'memory', 'performance', 'usage']),

  // ---- Windows ------------------------------------------------------------
  {
    id: 'window-close',
    label: 'Close the current window',
    category: 'Windows',
    keywords: ['close', 'quit', 'exit', 'dismiss', 'shut', 'get out'],
    channel: 'global-back-request',
    hint: 'Closes whatever is focused right now',
  },
  {
    id: 'window-home',
    label: 'Go back to the desktop',
    category: 'Windows',
    keywords: ['home', 'desktop', 'back out', 'escape', 'exit everything', 'get out'],
    channel: 'global-back-request',
    hint: 'Leaves the current app without closing your work',
  },

  // ---- Navigation ---------------------------------------------------------
  {
    id: 'nav-search',
    label: 'Search all apps',
    category: 'Navigation',
    keywords: ['search', 'find', 'look for', 'where is', 'palette'],
    channel: 'open-command-palette',
    hint: 'Also on Cmd-K / Ctrl-K',
  },
  {
    id: 'nav-refresh',
    label: 'Refresh the desktop',
    category: 'Navigation',
    keywords: ['refresh', 'reload', 'redraw', 'stuck', 'frozen', 'not updating'],
    channel: 'refresh-desktop',
    hint: 'Re-reads your items if the desktop looks wrong',
  },

  // ---- Local AI -----------------------------------------------------------
  {
    // Same app as "Open Local Models", different intent and phrasing, so it
    // needs its own id — `launch()` derives the id from the appId and would
    // collide.
    id: 'local-ai-status',
    label: 'Check if my GPU box is up',
    category: 'Local AI',
    keywords: [
      'is jacky up',
      'gpu status',
      'local ai status',
      'brain dead',
      'is the box up',
      'offline model',
    ],
    channel: 'launch-app',
    payload: { appId: 'ollama' },
    hint: 'Local models run first; cloud only when the box is unreachable',
  },

  // ---- Diagnostics --------------------------------------------------------
  launch('activity_center', 'Show recent activity', ['activity', 'history', 'what happened', 'log']),
  launch('notification_center', 'Show notifications', ['alerts', 'warnings', 'messages']),
  launch('app_health_monitor', 'Show app health', [
    'why is this broken',
    'what failed',
    'errors',
    'diagnostics',
    'something is wrong',
  ]),
  launch('storage_stats', 'Show storage usage', ['space', 'disk', 'how much room', 'full']),

  // ---- Appearance ---------------------------------------------------------
  launch('pc_themes', 'Change the OS theme', [
    'theme',
    'skin',
    'appearance',
    'windows 95',
    'windows 98',
    'macos',
    'linux',
    'retro',
    'look',
  ]),
] as const;

/** Every category present in the catalog, in first-appearance order. */
export function listCategories(
  commands: readonly OfflineCommand[] = OFFLINE_COMMANDS
): CommandCategory[] {
  const seen: CommandCategory[] = [];
  for (const c of commands) {
    if (!seen.includes(c.category)) seen.push(c.category);
  }
  return seen;
}

/** The catalog grouped for the browse menu, preserving catalog order. */
export function groupByCategory(
  commands: readonly OfflineCommand[] = OFFLINE_COMMANDS
): { category: CommandCategory; commands: OfflineCommand[] }[] {
  return listCategories(commands).map(category => ({
    category,
    commands: commands.filter(c => c.category === category),
  }));
}

/**
 * Score a command against a query. Higher is better; -1 means "no match".
 *
 * Mirrors the palette's existing app scoring so commands and apps rank against
 * each other consistently instead of one class always winning.
 */
export function scoreCommand(query: string, command: OfflineCommand): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const label = command.label.toLowerCase();
  if (label === q) return 2000;
  if (label.startsWith(q)) return 1000 - label.length;
  if (label.includes(q)) return 500 - label.indexOf(q);

  // Keywords are how someone lost in the UI actually phrases it
  // ("get out", "why is this broken") — worth matching on directly.
  let best = -1;
  for (const kw of command.keywords) {
    const k = kw.toLowerCase();
    if (k === q) best = Math.max(best, 400);
    else if (k.startsWith(q)) best = Math.max(best, 300 - k.length);
    else if (k.includes(q)) best = Math.max(best, 200 - k.indexOf(q));
  }
  return best;
}

/**
 * Search the catalog. An empty query returns the WHOLE catalog rather than
 * nothing — that is what makes this a browsable menu instead of something you
 * must already know the answer to.
 */
export function searchCommands(
  query: string,
  commands: readonly OfflineCommand[] = OFFLINE_COMMANDS
): OfflineCommand[] {
  if (!query.trim()) return [...commands];
  return commands
    .map(command => ({ command, score: scoreCommand(query, command) }))
    .filter(r => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.command);
}
