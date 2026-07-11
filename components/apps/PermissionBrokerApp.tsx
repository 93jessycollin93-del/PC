import React, { useEffect, useState } from 'react';
import { ShieldCheck, Globe, RotateCcw, Plus, Lock, Unlock, Zap } from 'lucide-react';
import { permissions, CAPABILITIES, GLOBAL_SCOPE, type Capability, applyPermissionProfile } from '../../lib/permissions';

/**
 * Permission / Capability Broker control panel.
 *
 * A matrix of {app/agent scope} × {capability} toggle switches. The global row
 * (`*`) sets the default for every scope; a per-scope toggle overrides it. This
 * is the user-facing surface for the "toggle access on/off" idea — gated call
 * sites (lib/aiClient.ts) enforce whatever is set here.
 */

// Well-known scopes worth showing by default (the agent/AI-facing apps).
const DEFAULT_SCOPES = [
  'system',
  'claude_assistant',
  'codex',
  'agent_builder',
  'grok_terminal',
  'model_router',
  'aiterm',
  'jacky',
  'eru',
];

const SCOPE_LABELS: Record<string, string> = {
  system: 'System (default)',
  claude_assistant: 'Claude Assistant',
  codex: 'Codex',
  agent_builder: 'Agent Builder',
  grok_terminal: 'Grok Terminal',
  model_router: 'Model Router',
  aiterm: 'ai-term',
  jacky: 'JACKY',
  eru: 'Eru',
};

const PROFILES = [
  {
    name: 'Open',
    description: 'All capabilities enabled (development)',
    value: 'open',
  },
  {
    name: 'Balanced',
    description: 'Safe for general use (no spend)',
    value: 'balanced',
  },
  {
    name: 'Hardened',
    description: 'Restricted (model_access only)',
    value: 'hardened',
  },
  {
    name: 'Paranoid',
    description: 'Maximum security (model_access minimal)',
    value: 'paranoid',
  },
];

export const PermissionBrokerApp: React.FC = () => {
  const [, forceRender] = useState(0);
  const [customScope, setCustomScope] = useState('');
  const [extraScopes, setExtraScopes] = useState<string[]>([]);
  const [showProfiles, setShowProfiles] = useState(false);

  // Re-render whenever a grant changes (from here or anywhere else).
  useEffect(() => permissions.subscribe(() => forceRender(n => n + 1)), []);

  const scopes = Array.from(
    new Set([GLOBAL_SCOPE, ...DEFAULT_SCOPES, ...extraScopes, ...permissions.getScopes()]),
  );

  const addScope = () => {
    const id = customScope.trim().toLowerCase().replace(/\s+/g, '_');
    if (id && !scopes.includes(id)) {
      setExtraScopes(prev => [...prev, id]);
    }
    setCustomScope('');
  };

  const labelFor = (scope: string) =>
    scope === GLOBAL_SCOPE ? 'All apps & agents' : SCOPE_LABELS[scope] || scope;

  const applyProfile = (profile: string) => {
    applyPermissionProfile(profile as any);
    forceRender(n => n + 1);
    setShowProfiles(false);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          Permission Broker
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfiles(!showProfiles)}
            className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1"
          >
            <Zap size={12} /> Profiles
          </button>
          <input
            value={customScope}
            onChange={e => setCustomScope(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addScope()}
            placeholder="add app/agent scope…"
            className="px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-emerald-500 outline-none w-44"
          />
          <button
            onClick={addScope}
            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus size={12} /> Scope
          </button>
        </div>
      </div>

      {/* Profiles section (Phase C step 27) */}
      {showProfiles && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30 space-y-2">
          <p className="text-xs font-semibold text-zinc-300 mb-2">Apply Permission Profile</p>
          <div className="grid grid-cols-2 gap-2">
            {PROFILES.map(profile => (
              <button
                key={profile.value}
                onClick={() => applyProfile(profile.value)}
                className="text-left p-2 rounded border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:border-sky-500 transition-all"
              >
                <p className="text-xs font-semibold text-zinc-200">{profile.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{profile.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-[11px] text-zinc-400">
        Toggle any capability off to block it. The <span className="text-emerald-400 font-semibold">All apps &amp; agents</span> row
        is the default; a per-app toggle overrides it. Blocks are enforced at real call sites (e.g. model access in the AI client).
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left">
              <th className="sticky left-0 bg-zinc-950 py-2 pr-4 font-semibold text-zinc-400">Scope</th>
              {CAPABILITIES.map(cap => (
                <th key={cap.id} className="py-2 px-2 font-semibold text-zinc-400 whitespace-nowrap" title={cap.description}>
                  {cap.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scopes.map(scope => {
              const isGlobal = scope === GLOBAL_SCOPE;
              return (
                <tr key={scope} className="border-t border-zinc-800/70">
                  <td className="sticky left-0 bg-zinc-950 py-2 pr-4 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {isGlobal ? <Globe size={13} className="text-emerald-400" /> : <span className="w-[13px]" />}
                      <span className={isGlobal ? 'text-emerald-300 font-semibold' : 'text-zinc-200'}>
                        {labelFor(scope)}
                      </span>
                    </span>
                  </td>
                  {CAPABILITIES.map(cap => {
                    const allowed = permissions.can(scope, cap.id as Capability);
                    const explicit = permissions.isExplicit(scope, cap.id as Capability);
                    return (
                      <td key={cap.id} className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              allowed
                                ? permissions.revoke(scope, cap.id as Capability)
                                : permissions.grant(scope, cap.id as Capability)
                            }
                            title={`${allowed ? 'Allowed' : 'Blocked'}${explicit ? ' (explicit)' : ' (default)'}`}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              allowed ? 'bg-emerald-600' : 'bg-zinc-700'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                                allowed ? 'left-4' : 'left-0.5'
                              }`}
                            />
                          </button>
                          {!isGlobal && explicit && (
                            <button
                              onClick={() => permissions.reset(scope, cap.id as Capability)}
                              title="Reset to default"
                              className="text-zinc-500 hover:text-zinc-300"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="h-10 border-t border-zinc-800 bg-zinc-900 px-4 flex items-center gap-4 text-[11px] text-zinc-400 shrink-0">
        <span className="flex items-center gap-1"><Unlock size={12} className="text-emerald-400" /> allowed</span>
        <span className="flex items-center gap-1"><Lock size={12} className="text-zinc-500" /> blocked</span>
        <span className="ml-auto text-zinc-500">{scopes.length} scopes · {CAPABILITIES.length} capabilities</span>
      </div>
    </div>
  );
};

export default PermissionBrokerApp;
