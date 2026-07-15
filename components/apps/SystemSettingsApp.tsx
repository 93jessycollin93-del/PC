import React, { useState, useEffect } from 'react';
import { Settings, Sliders, Save, RotateCcw } from 'lucide-react';
import { useAuth } from '../../lib/authContext';

interface SystemSettings {
  defaultAiModel: 'claude' | 'gemini' | 'ollama' | 'codex' | 'grok';
  globalPermissionMode: 'strict' | 'balanced' | 'trusted';
  autoSaveInterval: number; // minutes
  backupFrequency: 'never' | '6hours' | '12hours' | '24hours';
  theme: 'dark' | 'light';
  enableNotifications: boolean;
  enableAutoBackup: boolean;
  enableTelemetry: boolean;
  /** Master switch that lets Jackie modify the user's code. Default OFF. */
  jackieCodeUnlock: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  defaultAiModel: 'claude',
  globalPermissionMode: 'balanced',
  autoSaveInterval: 5,
  backupFrequency: '24hours',
  theme: 'dark',
  enableNotifications: true,
  enableAutoBackup: true,
  enableTelemetry: false,
  jackieCodeUnlock: false
};

export const SystemSettingsApp: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'ai' | 'system' | 'privacy' | 'info'>('ai');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pc_system_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      localStorage.setItem('pc_system_settings', JSON.stringify(settings));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to default?')) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Settings size={14} className="text-purple-400" />
          System Settings
        </h2>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-400 font-bold">Saved!</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="h-12 border-b border-zinc-800 bg-zinc-900/50 px-4 flex items-center gap-1 shrink-0">
        {(['ai', 'system', 'privacy', 'info'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs rounded font-bold transition-colors capitalize ${
              activeTab === tab
                ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                : 'border border-zinc-800 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* AI Settings */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="block text-sm font-bold text-white mb-3">Default AI Model</label>
              <select
                value={settings.defaultAiModel}
                onChange={(e) => updateSetting('defaultAiModel', e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-zinc-300 focus:border-purple-500 outline-none transition-colors text-sm"
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="gemini">Gemini (Google)</option>
                <option value="codex">Codex (GitHub)</option>
                <option value="grok">Grok (xAI)</option>
                <option value="ollama">Local Ollama</option>
              </select>
              <p className="text-[10px] text-zinc-400 mt-2">Used when no specific model is selected in an app</p>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="block text-sm font-bold text-white mb-3">Global Permission Mode</label>
              <div className="space-y-2">
                {(['strict', 'balanced', 'trusted'] as const).map(mode => (
                  <label key={mode} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-zinc-700/50 transition-colors">
                    <input
                      type="radio"
                      name="permission"
                      value={mode}
                      checked={settings.globalPermissionMode === mode}
                      onChange={(e) => updateSetting('globalPermissionMode', e.target.value as any)}
                      className="cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white capitalize">{mode}</p>
                      <p className="text-[10px] text-zinc-400">
                        {mode === 'strict' && 'Requires approval for all AI actions'}
                        {mode === 'balanced' && 'Auto-approve simple tasks, ask for complex ones'}
                        {mode === 'trusted' && 'Fast-track for frequently-used operations'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* System Settings */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="block text-sm font-bold text-white mb-3">Auto-Save Interval (minutes)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.autoSaveInterval}
                onChange={(e) => updateSetting('autoSaveInterval', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-zinc-300 focus:border-purple-500 outline-none transition-colors text-sm"
              />
              <p className="text-[10px] text-zinc-400 mt-2">How often to automatically save PC state</p>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="block text-sm font-bold text-white mb-3">Backup Frequency</label>
              <select
                value={settings.backupFrequency}
                onChange={(e) => updateSetting('backupFrequency', e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-zinc-300 focus:border-purple-500 outline-none transition-colors text-sm"
              >
                <option value="never">Never</option>
                <option value="6hours">Every 6 hours</option>
                <option value="12hours">Every 12 hours</option>
                <option value="24hours">Daily</option>
              </select>
              <p className="text-[10px] text-zinc-400 mt-2">Automatic backup creation schedule</p>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) => updateSetting('enableNotifications', e.target.checked)}
                  className="cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-white">Enable Notifications</p>
                  <p className="text-[10px] text-zinc-400">Show alerts for important events</p>
                </div>
              </label>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableAutoBackup}
                  onChange={(e) => updateSetting('enableAutoBackup', e.target.checked)}
                  className="cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-white">Auto-Backup</p>
                  <p className="text-[10px] text-zinc-400">Automatically backup on schedule</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Privacy & Security */}
        {activeTab === 'privacy' && (
          <div className="space-y-4">
            {/* Jackie code-change master switch */}
            <div className={`p-4 rounded-lg border transition-colors ${settings.jackieCodeUnlock ? 'bg-emerald-900/20 border-emerald-500/40' : 'bg-zinc-800/50 border-zinc-700'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.jackieCodeUnlock}
                  onChange={(e) => {
                    updateSetting('jackieCodeUnlock', e.target.checked);
                    // Persist immediately so Jackie sees the change without a Save.
                    try {
                      const next = { ...settings, jackieCodeUnlock: e.target.checked };
                      localStorage.setItem('pc_system_settings', JSON.stringify(next));
                    } catch {}
                  }}
                  className="cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-white">
                    Allow Jackie to change code {settings.jackieCodeUnlock ? '🔓' : '🔒'}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    When OFF, Jackie can plan and explain code but never modify your files.
                    Turn ON only when you want her to make real code changes.
                  </p>
                </div>
              </label>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableTelemetry}
                  onChange={(e) => updateSetting('enableTelemetry', e.target.checked)}
                  className="cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-white">Enable Telemetry</p>
                  <p className="text-[10px] text-zinc-400">Send anonymous usage data to improve PC OS</p>
                </div>
              </label>
            </div>

            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <h3 className="text-sm font-bold text-red-300 mb-3">Danger Zone</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (confirm('Clear ALL local PC data (settings, pinned apps, Jackie brain, caches)? This cannot be undone.')) {
                      const keep = /^firebase:|^__/;
                      Object.keys(localStorage)
                        .filter(k => !keep.test(k))
                        .forEach(k => localStorage.removeItem(k));
                      alert('Local data cleared. Reload to start fresh.');
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 rounded text-sm font-bold transition-colors"
                >
                  Clear All Data
                </button>
                <button
                  onClick={() => {
                    if (confirm('Reset all settings to factory defaults?')) {
                      setSettings(DEFAULT_SETTINGS);
                      localStorage.setItem('pc_system_settings', JSON.stringify(DEFAULT_SETTINGS));
                      setSaveStatus('saved');
                      setTimeout(() => setSaveStatus('idle'), 2000);
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 rounded text-sm font-bold transition-colors"
                >
                  Reset to Factory Defaults
                </button>
              </div>
            </div>
          </div>
        )}

        {/* System Info */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <h3 className="text-sm font-bold text-white mb-3">PC_X_ULTRA Information</h3>
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Version</span>
                  <span className="text-zinc-300 font-bold">2.0.0-ultra</span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                  <span className="text-zinc-400">Build</span>
                  <span className="text-zinc-300 font-bold">PC_X_ULTRA/additive-real-build</span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                  <span className="text-zinc-400">Platform</span>
                  <span className="text-zinc-300 font-bold">React 19 + Vite</span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                  <span className="text-zinc-400">TypeScript</span>
                  <span className="text-zinc-300 font-bold">Strict Mode</span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                  <span className="text-zinc-400">User</span>
                  <span className="text-zinc-300 font-bold">{user?.email || 'Guest'}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                  <span className="text-zinc-400">Last Saved</span>
                  <span className="text-zinc-300 font-bold">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h3 className="text-sm font-bold text-blue-300 mb-2">Environment</h3>
              <p className="text-[10px] text-blue-200 space-y-1">
                <div>• Anthropic Claude API for Claude Assistant & Codex</div>
                <div>• Google Gemini API for AI processing</div>
                <div>• Firebase for authentication & data</div>
                <div>• Vercel for hosting & deployment</div>
                <div>• Ollama for local LLM inference</div>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="h-16 border-t border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded text-sm font-bold transition-colors flex items-center gap-2"
        >
          <RotateCcw size={14} />
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saveStatus !== 'idle'}
          className={`px-6 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2 ${
            saveStatus === 'saved'
              ? 'bg-green-600/30 border border-green-500/50 text-green-300'
              : saveStatus === 'saving'
              ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
              : 'bg-purple-600 hover:bg-purple-500 border border-purple-500 text-white'
          }`}
        >
          <Save size={14} />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
