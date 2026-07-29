/**
 * The main router — the front door.
 *
 * Holds every app the OS can dispatch (so "say the name or the number" always
 * has an answer), the global verbs, and the sub-routers. Every entry resolves
 * to something real: a test scrapes App.tsx's dispatch branches and fails if
 * any appId here cannot actually be opened, because a menu of dead ends is
 * worse than no menu.
 *
 * Sub-routers are listed but NOT loaded. Their content arrives only when named
 * and is dropped when closed, which is what keeps a menu this large cheap.
 */

import type { MenuCommand, MenuEntry, RouterDefinition } from './types';

/** Launch an app by id. Keywords are how someone actually phrases it. */
function app(id: string, label: string, keywords: string[]): MenuCommand {
  return {
    kind: 'command',
    id: `open-${id}`,
    label,
    keywords: ['open', 'launch', 'start', 'go to', id.replace(/_/g, ' '), ...keywords],
    channel: 'launch-app',
    payload: { appId: id },
  };
}

/** A global verb — works from anywhere, not tied to one app. */
function global(
  id: string,
  label: string,
  keywords: string[],
  channel: MenuCommand['channel'],
  hint?: string,
  payload?: unknown
): MenuCommand {
  return { kind: 'command', id, label, keywords, channel, payload, hint };
}

/** Global verbs first: they are what someone reaches for when lost, and
 *  burying them under 83 app names would defeat the purpose. */
const GLOBALS: MenuEntry[] = [
  global('go-back', 'Back to the desktop', ['back', 'exit', 'close', 'home', 'pc', 'jackie', 'get out', 'escape'], 'global-back-request', 'Leaves the current app without closing your work'),
  global('search-all', 'Search everything', ['search', 'find', 'look for', 'where is'], 'open-command-palette', 'Also on Cmd-K / Ctrl-K'),
  global('refresh', 'Refresh the desktop', ['refresh', 'reload', 'stuck', 'frozen', 'not updating'], 'refresh-desktop', 'Re-reads your items if the desktop looks wrong'),
  global('save-export', 'Export the whole desktop', ['export', 'save', 'backup', 'send to my other device'], 'launch-app', 'Signed, compressed, verifiable', { appId: 'cybernetic_export' }),
  global('import', 'Import a desktop bundle', ['import', 'restore', 'load', 'bring it back'], 'launch-app', 'Restores an exported bundle', { appId: 'cybernetic_export' }),
  global('local-ai', 'Is my GPU box up?', ['gpu', 'local ai', 'is jacky up', 'brain dead', 'offline model'], 'launch-app', 'Local models run first; cloud only when the box is unreachable', { appId: 'ollama' }),
];

/** Sub-routers. Listed here, loaded only when chosen. */
const SUB_ROUTERS: MenuEntry[] = [
  {
    kind: 'subrouter',
    id: 'workstation-router',
    label: 'Workstation router',
    keywords: ['workstation', 'workstation router', 'flow', 'focus', 'build'],
    hint: 'Build, import, export, and drive the whole app from one place',
    load: () => import('./subRouters/workstation').then(m => m.workstationRouter),
  },
  {
    kind: 'subrouter',
    id: 'routers-router',
    label: 'Routers router',
    keywords: ['routers', 'routers router', 'router', 'what are routers', 'teach me about routers'],
    hint: 'What routers are, how they work, and how to make your own',
    load: () => import('./subRouters/routers').then(m => m.routersRouter),
  },
  {
    kind: 'subrouter',
    id: 'storage-router',
    label: 'Storage router',
    keywords: ['storage', 'storage router', 'pods', 'space', 'full', 'disk'],
    hint: 'Pods, what is stored where, and what to do when it is full',
    load: () => import('./subRouters/storage').then(m => m.storageRouter),
  },
];

const APPS: MenuEntry[] = [
  app('activity_center', 'Activity Center', ['history', 'what happened', 'log', 'activity', 'recent']),
  app('agent_builder', 'Agent Builder', ['agent', 'builder']),
  app('agent_orchestration', 'Agent Orchestration', ['agent', 'orchestration']),
  app('agent_team_console', 'Agent Team Console', ['agent', 'team', 'console']),
  app('aiterm', 'AIterm', ['aiterm']),
  app('anomaly_alert', 'Anomaly Alert', ['anomaly', 'alert']),
  app('api_keys', 'API Keys', ['api key', 'token', 'credential', 'forge', 'keys']),
  app('app_connector', 'App Connector', ['app', 'connector']),
  app('app_health_monitor', 'App Health Monitor', ['why is this broken', 'what failed', 'something is wrong', 'errors', 'diagnostics', 'health']),
  app('archiver', 'Archiver', ['archiver']),
  app('audit_trail', 'Audit Trail', ['audit', 'trail']),
  app('automation', 'Automation', ['automation']),
  app('blender', 'Blender', ['blender']),
  app('bot_studio', 'Bot Studio', ['bot', 'studio']),
  app('budget_guardian', 'Budget Guardian', ['budget', 'guardian']),
  app('build_vault', 'Build Vault', ['build', 'vault']),
  app('chat_history_share', 'Chat History Share', ['chat', 'history', 'share']),
  app('chess', 'Chess', ['game', 'play', 'board']),
  app('claude_assistant', 'Claude Assistant', ['claude', 'assistant']),
  app('clipboard_manager', 'Clipboard Manager', ['clipboard', 'manager']),
  app('cloud_deploy', 'Cloud Deploy', ['cloud', 'deploy']),
  app('cloud_infrastructure', 'Cloud Infrastructure', ['cloud', 'infrastructure']),
  app('coderabbit', 'Coderabbit', ['coderabbit']),
  app('codex', 'Codex', ['codex']),
  app('consensus_lab', 'Consensus Lab', ['consensus', 'lab']),
  app('cost_analytics', 'Cost Analytics', ['cost', 'analytics']),
  app('cross_ai_lab', 'Cross AI Lab', ['cross', 'ai', 'lab']),
  app('cyber_rulebook', 'Cyber Rulebook', ['cyber', 'rulebook']),
  app('cybernetic67', 'Cybernetic67', ['cybernetic67']),
  app('cybernetic_export', 'Cybernetic Export', ['cybernetic', 'export']),
  app('data_pods', 'Data Pods', ['data', 'pods']),
  app('data_redaction', 'Data Redaction', ['data', 'redaction']),
  app('data_vault', 'Data Vault', ['data', 'vault']),
  app('dependency_cve_checker', 'Dependency CVE Checker', ['dependency', 'cve', 'checker']),
  app('eru', 'Eru', ['eru']),
  app('fleet_atlas', 'Fleet Atlas', ['fleet', 'atlas']),
  app('flipper', 'Flipper', ['flipper']),
  app('fusion', 'Fusion', ['fusion']),
  app('github_sync', 'Github Sync', ['github', 'sync']),
  app('grok_terminal', 'Grok Terminal', ['grok', 'terminal']),
  app('integrity_monitor', 'Integrity Monitor', ['integrity', 'monitor']),
  app('jacky', 'Jacky', ['assistant', 'ai', 'chat', 'agent']),
  app('knowledge_compressor', 'Knowledge Compressor', ['knowledge', 'compressor']),
  app('langchain', 'Langchain', ['langchain']),
  app('llm_environment', 'Llm Environment', ['llm', 'environment']),
  app('mail', 'Mail', ['email', 'inbox', 'message']),
  app('memory_fabric', 'Memory Fabric', ['remember', 'recall', 'memory']),
  app('mission_control', 'Mission Control', ['cpu', 'ram', 'memory', 'performance', 'usage', 'overview', 'mission control']),
  app('model_router', 'Model Router', ['routing', 'which model', 'providers', 'model router']),
  app('notepad', 'Notepad', ['note', 'write', 'text', 'document']),
  app('notification_center', 'Notification Center', ['alerts', 'warnings', 'messages', 'notifications']),
  app('okse_sandbox', 'Okse Sandbox', ['okse', 'sandbox']),
  app('ollama', 'Ollama', ['local ai', 'gpu', 'offline model', 'is jacky up', 'brain dead', 'ollama']),
  app('ondevice_models', 'Ondevice Models', ['ondevice', 'models']),
  app('openclaw', 'Openclaw', ['openclaw']),
  app('papers_with_code', 'Papers With Code', ['papers', 'with', 'code']),
  app('pc_themes', 'PC Themes', ['theme', 'skin', 'windows 95', 'windows 98', 'macos', 'linux', 'retro', 'appearance', 'how it looks']),
  app('permission_broker', 'Permission Broker', ['permission', 'broker']),
  app('pod_system', 'Pod System', ['pod', 'system']),
  app('prompt_library', 'Prompt Library', ['prompts', 'saved prompts', 'templates']),
  app('qpdb', 'Qpdb', ['qpdb']),
  app('research_rabbit', 'Research Rabbit', ['research', 'rabbit']),
  app('secrets_hygiene', 'Secrets Hygiene', ['secrets', 'hygiene']),
  app('secrets_vault', 'Secrets Vault', ['keys', 'password', 'credentials', 'secrets', 'vault']),
  app('security_center', 'Security Center', ['safety', 'audit', 'secure']),
  app('security_event_log', 'Security Event Log', ['security', 'event', 'log']),
  app('self_audit_scanner', 'Self Audit Scanner', ['self', 'audit', 'scanner']),
  app('semantic_scholar', 'Semantic Scholar', ['semantic', 'scholar']),
  app('session_recorder', 'Session Recorder', ['session', 'recorder']),
  app('slides', 'Slides', ['slides']),
  app('small_agent_fleet', 'Small Agent Fleet', ['small', 'agent', 'fleet']),
  app('snake', 'Snake', ['game', 'play']),
  app('storage_stats', 'Storage Stats', ['space', 'disk', 'how much room', 'full', 'storage', 'usage']),
  app('supersayen', 'Supersayen', ['supersayen']),
  app('system_settings', 'System Settings', ['preferences', 'config', 'options', 'settings']),
  app('terminal', 'Terminal', ['shell', 'console', 'command line', 'terminal']),
  app('termstudio', 'Termstudio', ['termstudio']),
  app('time_machine', 'Time Machine', ['undo', 'go back', 'restore', 'history', 'time travel', 'yesterday']),
  app('tool_registry', 'Tool Registry', ['tool', 'registry']),
  app('ui_studio', 'UI Studio', ['ui', 'studio']),
  app('unreal_engine', 'Unreal Engine', ['unreal', 'engine']),
  app('voice_commands', 'Voice Commands', ['speak', 'talk', 'microphone', 'voice']),
  app('workspace_manager', 'Workspace Manager', ['layout', 'arrange windows', 'workspace']),
];

export const mainRouter: RouterDefinition = {
  id: 'main',
  title: 'Main router',
  purpose: 'Say a name or a number. Everything here works with no network.',
  entries: [...GLOBALS, ...SUB_ROUTERS, ...APPS],
};
