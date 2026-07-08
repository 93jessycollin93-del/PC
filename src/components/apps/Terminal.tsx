import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, ChevronRight, Trash2, Settings, ToggleRight, ToggleLeft, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../../lib/toastContext';

interface TerminalCommand {
  id: string;
  input: string;
  generated: string;
  status: 'pending' | 'accepted' | 'rejected' | 'executed' | 'error';
  output?: string;
  error?: string;
  timestamp: Date;
  agent: 'user' | 'claude-code' | 'grok' | 'other';
}

interface Agent {
  id: string;
  name: string;
  active: boolean;
  apiKey?: string;
  lastAccess?: Date;
  requiresAuth: 'password' | 'key' | 'both';
}

interface TerminalProps {
  onClose: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'terminal' | 'settings'>('terminal');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [commandInput, setCommandInput] = useState('');
  const [history, setHistory] = useState<TerminalCommand[]>([]);
  const [pendingReview, setPendingReview] = useState<TerminalCommand | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [agents, setAgents] = useState<Agent[]>([
    { id: 'claude-code', name: 'Claude Code', active: true, requiresAuth: 'both', lastAccess: new Date() },
    { id: 'grok', name: 'Grok CLI', active: false, requiresAuth: 'key' },
    { id: 'ollama', name: 'Ollama (Local)', active: false, requiresAuth: 'key' },
  ]);

  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  const [agentApiKeys, setAgentApiKeys] = useState<{ [key: string]: string }>({});

  const [bgTheme, setBgTheme] = useState<'opus' | 'sunset' | 'ocean' | 'matrix' | 'neon' | 'deep'>('opus');

  const bgGradients: Record<string, string> = {
    opus: 'from-slate-950 via-blue-950/20 to-slate-950',
    sunset: 'from-slate-950 via-orange-950/20 to-purple-950/30',
    ocean: 'from-slate-950 via-cyan-950/30 to-blue-950/20',
    matrix: 'from-slate-950 via-green-950/20 to-slate-950',
    neon: 'from-slate-950 via-pink-950/20 to-purple-950/20',
    deep: 'from-slate-950 via-indigo-950/30 to-slate-950',
  };

  const { successToast, errorToast, infoToast } = useToast();
  const outputEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setPasswordError('Password too short');
      return;
    }
    setIsAuthenticated(true);
    setPassword('');
    setPasswordError('');
    infoToast('Terminal unlocked', 'Opus 4.8 Gateway Active');
  };

  const generateCommand = async (userInput: string) => {
    setIsGenerating(true);
    setCommandInput('');

    const commandId = Date.now().toString();
    const newCommand: TerminalCommand = {
      id: commandId,
      input: userInput,
      generated: 'npm run build && git push origin main',
      status: 'pending',
      timestamp: new Date(),
      agent: 'user',
    };

    try {
      // Simulate Opus generation
      await new Promise((r) => setTimeout(r, 800));
      setPendingReview(newCommand);
      infoToast('Opus generated command', 'Review before accepting');
    } catch (error) {
      errorToast('Generation failed', (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const acceptCommand = async () => {
    if (!pendingReview) return;
    const command = { ...pendingReview, status: 'accepted' as const };
    setHistory([...history, command]);
    setPendingReview(null);
    successToast('Command executed', 'Output ready');
  };

  const rejectCommand = () => {
    if (!pendingReview) return;
    setPendingReview({ ...pendingReview, status: 'rejected' });
    infoToast('Command rejected', 'Not executed');
  };

  const clearHistory = () => {
    setHistory([]);
    successToast('History cleared', 'Fresh start');
  };

  const toggleAgent = (agentId: string) => {
    setAgents(agents.map((a) => (a.id === agentId ? { ...a, active: !a.active } : a)));
  };

  const updateAgentApiKey = (agentId: string, key: string) => {
    setAgentApiKeys({ ...agentApiKeys, [agentId]: key });
  };

  const revokeAgent = (agentId: string) => {
    setAgents(agents.map((a) => (a.id === agentId ? { ...a, active: false } : a)));
    setAgentApiKeys({ ...agentApiKeys, [agentId]: '' });
  };

  if (!isAuthenticated) {
    return (
      <div className={`bg-gradient-to-br ${bgGradients[bgTheme]} rounded-lg border border-slate-700/50 overflow-hidden flex flex-col h-full shadow-2xl`}>
        <div className="bg-slate-800/60 border-b border-slate-600/30 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="font-mono text-xs text-slate-300">Opus Terminal</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-red-900/20 rounded text-red-400 hover:text-red-300">
            <X size={14} />
          </button>
        </div>

        {tab === 'settings' ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div>
              <h3 className="text-xs font-mono text-slate-300 font-bold mb-2">AGENTS</h3>
              <div className="space-y-1.5">
                {agents.map((agent) => (
                  <div key={agent.id} className="bg-slate-800/50 border border-slate-600/30 rounded p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300 font-mono">{agent.name}</span>
                        <span className={`text-xs font-mono ${agent.active ? 'text-green-400' : 'text-slate-500'}`}>
                          {agent.active ? '●' : '○'}
                        </span>
                      </div>
                      <button onClick={() => toggleAgent(agent.id)} className="text-slate-400 hover:text-slate-200">
                        {agent.active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                    </div>

                    {agent.active && agent.requiresAuth === 'key' && (
                      <div className="pt-1.5 border-t border-slate-600/30">
                        <label className="block text-xs text-slate-400 font-mono mb-1">Key</label>
                        <div className="flex gap-1">
                          <input
                            type={showApiKey[agent.id] ? 'text' : 'password'}
                            value={agentApiKeys[agent.id] || ''}
                            onChange={(e) => updateAgentApiKey(agent.id, e.target.value)}
                            placeholder="API key..."
                            className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 font-mono"
                          />
                          <button
                            onClick={() => setShowApiKey({ ...showApiKey, [agent.id]: !showApiKey[agent.id] })}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400"
                          >
                            {showApiKey[agent.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {agent.active && (
                      <button
                        onClick={() => revokeAgent(agent.id)}
                        className="w-full text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded px-2 py-1"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-mono text-slate-300 font-bold mb-2">THEME</h3>
              <div className="grid grid-cols-3 gap-1">
                {Object.keys(bgGradients).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setBgTheme(theme as any)}
                    className={`text-xs px-2 py-1 rounded font-mono ${
                      bgTheme === theme
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs space-y-3">
              <div className="text-center space-y-1">
                <div className="text-3xl opacity-20">🔐</div>
                <div className="text-slate-300 text-xs font-mono">Global Terminal</div>
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Password..."
                  className="w-full bg-slate-800/60 border border-slate-600/50 rounded px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 font-mono"
                  autoFocus
                />
                {passwordError && <div className="text-red-400 text-xs mt-1">{passwordError}</div>}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded px-3 py-2 text-xs text-white font-mono font-bold"
              >
                Unlock
              </button>
            </form>
          </div>
        )}

        <div className="border-t border-slate-600/30 bg-slate-800/50 p-1.5 flex gap-1">
          <button
            onClick={() => setTab('terminal')}
            className={`flex-1 px-2 py-1 rounded text-xs font-mono ${
              tab === 'terminal' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400'
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`flex-1 px-2 py-1 rounded text-xs font-mono ${
              tab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400'
            }`}
          >
            Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br ${bgGradients[bgTheme]} rounded-lg border border-slate-700/50 overflow-hidden flex flex-col h-full shadow-2xl`}>
      <div className="bg-slate-800/60 border-b border-slate-600/30 p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-mono text-xs text-slate-300">Opus Terminal</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-red-900/20 rounded text-red-400 hover:text-red-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-1 gap-2 p-2 min-h-0">
        {/* History */}
        <div className="w-32 bg-slate-800/40 border border-slate-600/30 rounded flex flex-col overflow-hidden">
          <div className="px-2 py-1 border-b border-slate-600/30 flex items-center justify-between bg-slate-800/60">
            <span className="text-xs font-mono text-slate-400">History</span>
            <button
              onClick={clearHistory}
              className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
            >
              <Trash2 size={11} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 p-1.5">
            {history.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-2">—</div>
            ) : (
              history.map((cmd) => (
                <div
                  key={cmd.id}
                  className={`text-xs px-1.5 py-0.5 rounded font-mono truncate ${
                    cmd.status === 'executed'
                      ? 'text-green-400 bg-green-500/10'
                      : cmd.status === 'error'
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-slate-400'
                  }`}
                  title={cmd.input}
                >
                  {cmd.input.substring(0, 16)}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {pendingReview ? (
            <div className="flex-1 flex flex-col bg-slate-800/40 border border-slate-600/30 rounded overflow-hidden">
              <div className="px-3 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs">
                <div className="text-amber-300 font-mono font-bold mb-1">INPUT</div>
                <div className="text-slate-200 font-mono text-xs">{pendingReview.input}</div>
              </div>

              <div className="px-3 py-2 border-b border-indigo-500/30 bg-indigo-500/10 flex-1 overflow-y-auto">
                <div className="text-indigo-300 font-mono font-bold mb-1 text-xs">OPUS</div>
                <div className="text-slate-100 font-mono text-xs whitespace-pre-wrap bg-slate-950/40 p-2 rounded border border-slate-600/30">
                  {pendingReview.generated}
                </div>
              </div>

              <div className="p-2 gap-1 flex">
                <button
                  onClick={acceptCommand}
                  className="flex-1 bg-green-600 hover:bg-green-700 rounded px-2 py-1 text-xs text-white font-bold"
                >
                  Accept
                </button>
                <button
                  onClick={rejectCommand}
                  className="flex-1 bg-red-600 hover:bg-red-700 rounded px-2 py-1 text-xs text-white font-bold"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-slate-800/40 border border-slate-600/30 rounded p-2 font-mono text-xs text-slate-300 space-y-1">
                {history.length === 0 ? (
                  <div className="text-slate-500 text-center py-6">Enter a command</div>
                ) : (
                  history.map((cmd) => (
                    <div key={cmd.id} className="space-y-0.5 bg-slate-900/40 p-1.5 rounded border border-slate-700/30">
                      <div className="text-slate-400">$ {cmd.input}</div>
                      {cmd.status === 'executed' && (
                        <>
                          <div className="text-green-400">✓ Executed</div>
                          {cmd.output && <div className="text-slate-300 text-xs">{cmd.output}</div>}
                        </>
                      )}
                      {cmd.status === 'error' && <div className="text-red-400">✗ {cmd.error}</div>}
                      {cmd.status === 'rejected' && <div className="text-yellow-400">⊘ Rejected</div>}
                    </div>
                  ))
                )}
                <div ref={outputEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commandInput.trim()) generateCommand(commandInput);
                }}
                className="mt-2 flex gap-1"
              >
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  disabled={isGenerating}
                  placeholder="Command..."
                  className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 font-mono"
                />
                <button
                  type="submit"
                  disabled={isGenerating || !commandInput.trim()}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs text-white font-bold disabled:opacity-50"
                >
                  {isGenerating ? '⟳' : '↵'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 border-t border-slate-600/30 px-2 py-1 text-xs text-slate-500 font-mono flex justify-between">
        <span>Opus 4.8</span>
        <span>{history.length}</span>
      </div>
    </div>
  );
};
