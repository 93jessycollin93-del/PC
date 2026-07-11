import React, { useEffect, useReducer, useState } from 'react';
import { Mic, MicOff, Plus, Trash2, Radio, Volume2 } from 'lucide-react';
import { voiceCommandService, type VoiceCommand } from '../../lib/voiceCommandService';

/**
 * Voice Commands — register and manage voice-controlled app launch and automation
 */

export const VoiceCommandsApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [session, setSession] = useState(voiceCommandService.getSession());
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [wakeWords, setWakeWords] = useState(voiceCommandService.getWakeWords().join(', '));

  // Create command form
  const [createKeyword, setCreateKeyword] = useState('');
  const [createIntent, setCreateIntent] = useState<'launch_app' | 'trigger_automation' | 'dictate'>('launch_app');
  const [createAppId, setCreateAppId] = useState('');

  const apps = [
    'home_screen',
    'notepad',
    'terminal',
    'mail',
    'slides',
    'automation',
    'scheduler',
    'notification_center',
  ];

  const refreshState = () => {
    setSession(voiceCommandService.getSession());
    setCommands(voiceCommandService.getCommands());
  };

  useEffect(() => {
    refreshState();

    // Subscribe to voice events
    window.addEventListener('voice-state-changed', refreshState);
    window.addEventListener('voice-woken', () => tick());
    window.addEventListener('voice-transcript', () => tick());

    return () => {
      window.removeEventListener('voice-state-changed', refreshState);
      window.removeEventListener('voice-woken', refreshState);
      window.removeEventListener('voice-transcript', refreshState);
    };
  }, []);

  const handleToggleListening = () => {
    if (session.isActive) {
      voiceCommandService.stopListening();
    } else {
      voiceCommandService.startListening();
    }
    setTimeout(refreshState, 100);
  };

  const handleCreateCommand = () => {
    if (!createKeyword.trim()) return;

    voiceCommandService.registerCommand({
      keyword: createKeyword.toLowerCase(),
      intent: createIntent,
      payload: createIntent === 'launch_app' ? { appId: createAppId } : undefined,
      enabled: true,
    });

    setCreateKeyword('');
    setCreateAppId('');
    refreshState();
    tick();
  };

  const handleRemoveCommand = (id: string) => {
    if (!confirm('Remove this command?')) return;
    voiceCommandService.removeCommand(id);
    refreshState();
    tick();
  };

  const handleUpdateWakeWords = () => {
    const words = wakeWords.split(',').map(w => w.trim().toLowerCase());
    voiceCommandService.setWakeWords(words);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Mic size={16} className="text-purple-400" />
          Voice Commands
        </h2>
        <button
          onClick={handleToggleListening}
          className={`p-2 rounded transition ${
            session.isActive
              ? 'bg-purple-600 hover:bg-purple-500 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          title={session.isActive ? 'Stop listening' : 'Start listening'}
        >
          {session.isActive ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
      </div>

      {/* Status bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Status</span>
            <div className="flex items-center gap-2">
              {session.isActive && (
                <>
                  <div className="animate-pulse w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-xs font-bold text-purple-400">
                    {session.isListening ? 'Listening' : 'Active'}
                  </span>
                </>
              )}
              {!session.isActive && (
                <span className="text-xs text-zinc-600">Stopped</span>
              )}
            </div>
          </div>

          {session.transcript && (
            <div className="bg-purple-900/30 border border-purple-700 p-2 rounded">
              <div className="text-[10px] text-zinc-600 mb-1">Heard:</div>
              <div className="text-xs text-purple-200 font-mono">{session.transcript}</div>
              <div className="text-[10px] text-purple-500 mt-1">
                Confidence: {Math.round(session.confidence * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Wake words configuration */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={14} className="text-purple-400" />
            <h3 className="font-bold text-white">Wake Words</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Say any of these words to activate command mode (e.g., "Hey Jackie, open terminal")
          </p>
          <div className="space-y-2">
            <input
              value={wakeWords}
              onChange={e => setWakeWords(e.target.value)}
              placeholder="Comma-separated wake words"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
            />
            <button
              onClick={handleUpdateWakeWords}
              className="w-full px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm"
            >
              Save Wake Words
            </button>
            <div className="text-[10px] text-zinc-600">
              Default: "hey jackie", "jackie", "ok jackie"
            </div>
          </div>
        </div>

        {/* Create command */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={14} className="text-purple-400" />
            <h3 className="font-bold text-white">New Command</h3>
          </div>
          <div className="space-y-2">
            <input
              placeholder="Keyword (e.g., 'open mail', 'show notes')"
              value={createKeyword}
              onChange={e => setCreateKeyword(e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
            />
            <select
              value={createIntent}
              onChange={e => setCreateIntent(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
            >
              <option value="launch_app">Launch App</option>
              <option value="trigger_automation">Trigger Automation</option>
              <option value="dictate">Dictate Text</option>
            </select>

            {createIntent === 'launch_app' && (
              <select
                value={createAppId}
                onChange={e => setCreateAppId(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
              >
                <option value="">Select app...</option>
                {apps.map(app => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleCreateCommand}
              className="w-full px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm"
            >
              Add Command
            </button>
          </div>
        </div>

        {/* Commands list */}
        {commands.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No voice commands yet. Create one above to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map(cmd => (
              <div
                key={cmd.id}
                className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-white">
                      <span className="text-purple-400">"</span>
                      {cmd.keyword}
                      <span className="text-purple-400">"</span>
                    </div>
                    <div className="text-xs text-zinc-500 capitalize">{cmd.intent.replace('_', ' ')}</div>
                    {cmd.payload?.appId && (
                      <div className="text-xs text-zinc-400 mt-1">
                        → Opens: {cmd.payload.appId}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveCommand(cmd.id)}
                    className="p-1 hover:bg-zinc-800 rounded"
                    title="Delete command"
                  >
                    <Trash2 size={12} className="text-zinc-600 hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Say wake word + command to trigger actions</div>
        <div>• Browser must have microphone permission</div>
        <div>• Commands are case-insensitive and fuzzy-matched</div>
        <div>• Voice recognition uses browser's built-in Speech API</div>
      </div>
    </div>
  );
};

export default VoiceCommandsApp;
