import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Save, Check, AlertCircle, Copy } from 'lucide-react';

interface ApiKeyConfig {
  provider: 'groq' | 'gemini' | 'deepseek' | 'anthropic';
  label: string;
  storageKey: string;
  getUrl: string;
  description: string;
  status: 'configured' | 'missing';
}

const API_KEYS_CONFIG: ApiKeyConfig[] = [
  {
    provider: 'groq',
    label: 'Groq',
    storageKey: 'groq_api_key',
    getUrl: 'https://console.groq.com/keys',
    description: 'Free fast inference - Mixtral & Llama access',
    status: 'missing',
  },
  {
    provider: 'gemini',
    label: 'Google Gemini',
    storageKey: 'gemini_api_key',
    getUrl: 'https://ai.google.dev/tutorials/setup',
    description: 'Free tier with generous limits',
    status: 'missing',
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    storageKey: 'deepseek_api_key',
    getUrl: 'https://platform.deepseek.com/api_keys',
    description: 'Cheap inference (~$0.0007 per 1k tokens)',
    status: 'missing',
  },
  {
    provider: 'anthropic',
    label: 'Anthropic (Claude)',
    storageKey: 'anthropic_api_key',
    getUrl: 'https://console.anthropic.com/account/keys',
    description: 'Fallback - Claude 3 Haiku',
    status: 'missing',
  },
];

export const APIKeysApp: React.FC = () => {
  const [keys, setKeys] = useState<Map<string, string>>(new Map());
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    // Load all keys from localStorage
    const loadedKeys = new Map<string, string>();
    API_KEYS_CONFIG.forEach(config => {
      const stored = localStorage.getItem(config.storageKey);
      if (stored) {
        loadedKeys.set(config.storageKey, stored);
      }
    });
    setKeys(loadedKeys);
  }, []);

  const handleKeyChange = (storageKey: string, value: string) => {
    const newKeys = new Map(keys);
    if (value) {
      newKeys.set(storageKey, value);
    } else {
      newKeys.delete(storageKey);
    }
    setKeys(newKeys);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      keys.forEach((value, key) => {
        localStorage.setItem(key, value);
      });
      // Clear any deleted keys
      API_KEYS_CONFIG.forEach(config => {
        if (!keys.has(config.storageKey)) {
          localStorage.removeItem(config.storageKey);
        }
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 300);
  };

  const toggleShowKey = (storageKey: string) => {
    const newShow = new Set(showKeys);
    if (newShow.has(storageKey)) {
      newShow.delete(storageKey);
    } else {
      newShow.add(storageKey);
    }
    setShowKeys(newShow);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Key size={14} className="text-yellow-400" />
          API Keys Manager
        </h2>
        <button
          onClick={handleSave}
          disabled={saveStatus !== 'idle'}
          className={`px-4 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-2 ${
            saveStatus === 'saved'
              ? 'bg-green-600/30 border border-green-500/50 text-green-300'
              : saveStatus === 'saving'
              ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
              : 'bg-yellow-600 hover:bg-yellow-500 border border-yellow-500 text-white'
          }`}
        >
          <Save size={14} />
          {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'saving' ? 'Saving...' : 'Save Keys'}
        </button>
      </div>

      {/* Info Section */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-400">
        <p className="mb-2">
          🔐 API keys are stored locally in your browser. Never commit keys to git or share with others.
        </p>
        <p>Model Router will automatically select the best provider based on cost, speed, and availability.</p>
      </div>

      {/* API Keys List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {API_KEYS_CONFIG.map(config => {
          const value = keys.get(config.storageKey) || '';
          const isConfigured = value.length > 0;
          const isVisible = showKeys.has(config.storageKey);

          return (
            <div
              key={config.storageKey}
              className={`border rounded-lg p-4 transition-colors ${
                isConfigured
                  ? 'bg-green-950/20 border-green-900/50'
                  : 'bg-zinc-900/50 border-zinc-800'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white">{config.label}</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{config.description}</p>
                </div>
                {isConfigured && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-600/20 rounded text-[10px] text-green-400 font-bold">
                    <Check size={12} />
                    Configured
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="relative mb-2">
                <input
                  type={isVisible ? 'text' : 'password'}
                  value={value}
                  onChange={e => handleKeyChange(config.storageKey, e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-xs font-mono text-zinc-300 focus:border-yellow-500 outline-none transition-colors"
                />
                {value && (
                  <button
                    onClick={() => toggleShowKey(config.storageKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>

              {/* Action Link */}
              <a
                href={config.getUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-bold transition-colors"
              >
                Get API Key →
              </a>
            </div>
          );
        })}
      </div>

      {/* Stats Footer */}
      <div className="h-16 border-t border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center justify-between text-xs shrink-0">
        <div className="space-y-1">
          <p className="text-zinc-400">
            Configured: <span className="text-green-400 font-bold">{keys.size}</span> / {API_KEYS_CONFIG.length}
          </p>
          <p className="text-[10px] text-zinc-500">Model Router will auto-select based on cost & speed</p>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          {keys.size === API_KEYS_CONFIG.length ? (
            <div className="flex items-center gap-1 text-green-400">
              <Check size={14} />
              All configured
            </div>
          ) : keys.size > 0 ? (
            <div className="flex items-center gap-1 text-yellow-400">
              <AlertCircle size={14} />
              {keys.size} of {API_KEYS_CONFIG.length}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-400">
              <AlertCircle size={14} />
              No keys configured
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
