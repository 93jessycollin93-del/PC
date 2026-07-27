import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, Check, HardDrive, Loader2, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { appStorage } from '../../lib/appStorage';
import { bus } from '../../lib/bus';

/**
 * On-Device Models — "Choose a Model" downloader.
 *
 * The iOS local-AI onboarding experience, backed by a real Ollama instance:
 * pick a small model card, hit Download, watch true byte-level progress
 * streamed from Ollama's /api/pull (proxied via /api/ollama/pull). Installed
 * models come from the real /api/tags. Without a configured endpoint there is
 * no fake progress — the app says exactly what's missing.
 */

interface CatalogModel {
  id: string;
  name: string;
  size: string;
  description: string;
  /** Ollama pull tag. Editable in the UI — model hubs rename things. */
  tag: string;
  accent: string;
}

const CATALOG: CatalogModel[] = [
  {
    id: 'lfm2-vl',
    name: 'LFM 2 VL',
    size: '1.6B',
    description: 'Vision-language model from Liquid AI. Reliable for chat and vision.',
    tag: 'lfm2-vl:1.6b',
    accent: 'text-zinc-100',
  },
  {
    id: 'gemma3-qat',
    name: 'Gemma 3 QAT',
    size: '1B',
    description: 'Fast model from Google. Efficient memory use for everyday chat.',
    tag: 'gemma3:1b-it-qat',
    accent: 'text-sky-300',
  },
  {
    id: 'qwen3',
    name: 'Qwen 3',
    size: '0.6B',
    description: 'Small Qwen model. Fast and lightweight.',
    tag: 'qwen3:0.6b',
    accent: 'text-violet-300',
  },
  {
    id: 'tinyllama',
    name: 'TinyLlama',
    size: '1.1B',
    description: 'Compact Llama-architecture model, ~640MB download.',
    tag: 'tinyllama:1.1b',
    accent: 'text-amber-300',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    size: '1.5B',
    description: 'Small reasoning model distilled from DeepSeek R1.',
    tag: 'deepseek-r1:1.5b',
    accent: 'text-emerald-300',
  },
];

interface InstalledModel {
  name: string;
  size?: number;
}

interface PullState {
  status: 'idle' | 'downloading' | 'done' | 'error';
  pct: number;
  phase: string;
  error?: string;
}

const store = appStorage('ondevice');

function formatGB(bytes?: number): string {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

export const OnDeviceModelsApp: React.FC = () => {
  const [selected, setSelected] = useState<string>('gemma3-qat');
  const [customTags, setCustomTags] = useState<Record<string, string>>(store.get('customTags', {}));
  const [endpoint, setEndpoint] = useState<string>(
    store.get('endpoint', localStorage.getItem('ollama_endpoint') || ''),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [pull, setPull] = useState<PullState>({ status: 'idle', pct: 0, phase: '' });

  const tagFor = (m: CatalogModel) => customTags[m.id] || m.tag;

  const saveEndpoint = (value: string) => {
    setEndpoint(value);
    store.set('endpoint', value);
    // Share with the other Ollama-aware apps.
    localStorage.setItem('ollama_endpoint', value);
  };

  const refreshInstalled = useCallback(async () => {
    try {
      const qs = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
      const r = await fetch(`/api/ollama/tags${qs}`);
      const data = await r.json();
      setInstalled((data.models || []).map((m: { name: string; size?: number }) => ({ name: m.name, size: m.size })));
      setTagsError(data.error || null);
    } catch (e) {
      setInstalled([]);
      setTagsError(String(e));
    }
  }, [endpoint]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  const isInstalled = (m: CatalogModel) => installed.some(i => i.name === tagFor(m));

  const download = async () => {
    const model = CATALOG.find(m => m.id === selected);
    if (!model || pull.status === 'downloading') return;

    setPull({ status: 'downloading', pct: 0, phase: 'starting…' });
    try {
      const resp = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: tagFor(model), customEndpoint: endpoint || undefined }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      if (!resp.body) throw new Error('No response stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Ollama streams NDJSON: {"status":"pulling …","total":N,"completed":M}
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string };
            if (evt.error) throw new Error(evt.error);
            const pct = evt.total ? Math.round(((evt.completed || 0) / evt.total) * 100) : 0;
            setPull(p => ({
              status: 'downloading',
              pct: evt.total ? pct : p.pct,
              phase: evt.status || p.phase,
            }));
          } catch (e) {
            if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
          }
        }
      }

      setPull({ status: 'done', pct: 100, phase: 'success' });
      bus.emit('jackie-notification', {
        level: 'success',
        title: `Model downloaded — ${model.name} (${model.size})`,
        message: tagFor(model),
        source: 'on-device models',
      });
      refreshInstalled();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPull({ status: 'error', pct: 0, phase: '', error: msg });
      bus.emit('jackie-notification', {
        level: 'error',
        title: `Model download failed — ${model.name}`,
        message: msg,
        source: 'on-device models',
      });
    }
  };

  const selectedModel = CATALOG.find(m => m.id === selected);

  return (
    <div className="h-full w-full bg-black text-zinc-300 font-sans flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-dotted border-white flex items-center justify-center mb-5">
            <ArrowDown size={26} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Choose a Model</h1>
          <p className="text-sm text-zinc-400 mt-2">Select your first model to get started.</p>
        </div>

        {/* Model cards */}
        <div className="space-y-3 max-w-xl mx-auto">
          {CATALOG.map(m => {
            const active = selected === m.id;
            const have = isInstalled(m);
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`w-full text-left rounded-2xl border px-4 py-4 flex items-center gap-3 transition-colors ${
                  active ? 'border-zinc-400 bg-zinc-900/60' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <Sparkles size={20} className={`shrink-0 ${m.accent}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-white">
                    {m.name} <span className="text-zinc-400">({m.size})</span>
                    {have && <span className="ml-2 text-[10px] font-bold text-emerald-400 uppercase">installed</span>}
                  </div>
                  <div className="text-sm text-zinc-400 mt-0.5">{m.description}</div>
                  {showSettings && (
                    <input
                      value={tagFor(m)}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const next = { ...customTags, [m.id]: e.target.value };
                        setCustomTags(next);
                        store.set('customTags', next);
                      }}
                      className="mt-2 w-full px-2 py-1 bg-black border border-zinc-800 rounded text-[11px] font-mono text-zinc-400 focus:border-zinc-500 outline-none"
                    />
                  )}
                </div>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    active ? 'bg-zinc-300' : 'border border-zinc-700'
                  }`}
                >
                  {active && <Check size={14} className="text-black" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Installed on device */}
        {installed.length > 0 && (
          <div className="max-w-xl mx-auto mt-6">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-600 mb-2">
              <HardDrive size={11} /> On this device ({installed.length})
            </div>
            <div className="space-y-1">
              {installed.map(m => (
                <div key={m.name} className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span className="font-mono flex-1 truncate">{m.name}</span>
                  <span className="text-zinc-600">{formatGB(m.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Endpoint settings */}
        <div className="max-w-xl mx-auto mt-6">
          <button
            onClick={() => setShowSettings(s => !s)}
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400"
          >
            <Settings2 size={12} /> Ollama connection {showSettings ? '▾' : '▸'}
          </button>
          {showSettings && (
            <div className="mt-2 space-y-2">
              <input
                value={endpoint}
                onChange={e => saveEndpoint(e.target.value)}
                placeholder="http://your-pc-ip:11434  (or leave empty to use server OLLAMA_ENDPOINT)"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-300 focus:border-zinc-500 outline-none"
              />
              {tagsError && <div className="text-[11px] text-amber-500/80">{tagsError}</div>}
              <div className="text-[10px] text-zinc-600">
                Downloads go to the machine running Ollama (your PC), streamed with real progress. Model tags above are editable.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action area */}
      <div className="px-5 pb-6 pt-2 shrink-0 bg-black">
        <p className="text-center text-xs text-zinc-500 mb-3">Please keep the app open during download.</p>
        {pull.status === 'error' && (
          <p className="text-center text-xs text-red-400 mb-2 break-words">{pull.error}</p>
        )}
        <button
          onClick={download}
          disabled={pull.status === 'downloading' || !selectedModel}
          className="w-full max-w-xl mx-auto block rounded-full bg-white text-black font-bold text-base py-3.5 transition-opacity disabled:opacity-90"
        >
          {pull.status === 'downloading' ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Downloading&nbsp;&nbsp;({pull.pct}%)
            </span>
          ) : pull.status === 'done' ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={18} /> Downloaded — pick another
            </span>
          ) : (
            'Download'
          )}
        </button>
        {pull.status === 'downloading' && pull.phase && (
          <p className="text-center text-[10px] text-zinc-600 mt-2 font-mono truncate">{pull.phase}</p>
        )}
      </div>
    </div>
  );
};

export default OnDeviceModelsApp;
