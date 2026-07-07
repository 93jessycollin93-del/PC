import React, { useState, useEffect, useRef } from 'react';
import { Download, Zap, Server, Activity, Trash2, Play, AlertCircle, CheckCircle, Clock, HardDrive, Cpu, RefreshCw } from 'lucide-react';

interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
}

interface OllamaStatus {
    connected: boolean;
    version?: string;
    models: OllamaModel[];
    error?: string;
}

const OLLAMA_HOST = process.env.REACT_APP_OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_TIMEOUT = 5000;

const checkOllamaConnection = async (): Promise<OllamaStatus> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

        const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
            method: 'GET',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                connected: false,
                models: [],
                error: `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const data = await response.json();
        return {
            connected: true,
            models: data.models || [],
            version: 'Local Ollama',
        };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Connection failed';
        return {
            connected: false,
            models: [],
            error: errorMsg,
        };
    }
};

const pullModel = async (modelName: string, onProgress: (status: string) => void): Promise<boolean> => {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: true }),
        });

        if (!response.ok) {
            onProgress(`Failed to pull model: ${response.statusText}`);
            return false;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            onProgress('Failed to stream response');
            return false;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const json = JSON.parse(line);
                        if (json.status) {
                            const pct = json.completed && json.total
                                ? ` ${Math.round((json.completed / json.total) * 100)}%`
                                : '';
                            onProgress(`${json.status}${pct}`);
                        }
                    } catch {}
                }
            }
        }

        onProgress('Download complete');
        return true;
    } catch (err) {
        onProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return false;
    }
};

const deleteModel = async (modelName: string): Promise<boolean> => {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
        });
        return response.ok;
    } catch (err) {
        console.error('Failed to delete model:', err);
        return false;
    }
};

const runModel = async (modelName: string, prompt: string): Promise<string> => {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, prompt, stream: false }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return data.response || '';
    } catch (err) {
        throw new Error(`Failed to run model: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
};

export const OllamaApp: React.FC = () => {
    const [status, setStatus] = useState<OllamaStatus>({ connected: false, models: [] });
    const [loading, setLoading] = useState(false);
    const [activeModel, setActiveModel] = useState<string | null>(null);
    const [pullInput, setPullInput] = useState('');
    const [pullProgress, setPullProgress] = useState<{ model: string; status: string } | null>(null);
    const [testPrompt, setTestPrompt] = useState('What is machine learning?');
    const [testOutput, setTestOutput] = useState('');
    const [testLoading, setTestLoading] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const checkConnection = async () => {
            setLoading(true);
            const result = await checkOllamaConnection();
            setStatus(result);
            if (result.models.length > 0 && !activeModel) {
                setActiveModel(result.models[0].name);
            }
            setLoading(false);
        };

        checkConnection();
        pollRef.current = setInterval(checkConnection, 30000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const handlePullModel = async () => {
        if (!pullInput.trim()) return;

        setPullProgress({ model: pullInput, status: 'Starting pull...' });

        const success = await pullModel(pullInput, (msg) => {
            setPullProgress(prev => prev ? { ...prev, status: msg } : null);
        });

        if (success) {
            const result = await checkOllamaConnection();
            setStatus(result);
            setPullProgress(null);
            setPullInput('');
        }
    };

    const handleDeleteModel = async (modelName: string) => {
        if (!window.confirm(`Delete ${modelName}?`)) return;

        const success = await deleteModel(modelName);
        if (success) {
            const result = await checkOllamaConnection();
            setStatus(result);
            if (activeModel === modelName) setActiveModel(null);
        }
    };

    const handleTestModel = async () => {
        if (!activeModel || !testPrompt.trim()) return;

        setTestLoading(true);
        setTestOutput('Running...');

        try {
            const response = await runModel(activeModel, testPrompt);
            setTestOutput(response);
        } catch (err) {
            setTestOutput(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setTestLoading(false);
        }
    };

    const formatBytes = (bytes: number): string => {
        const gb = bytes / 1024 / 1024 / 1024;
        return gb.toFixed(2) + ' GB';
    };

    return (
        <div className="h-full w-full bg-[#09090b] text-slate-300 font-sans flex flex-col">
            <div className="h-14 border-b border-zinc-800/80 bg-[#0f1115] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <Zap size={18} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-200">Local Ollama</h1>
                        <p className="text-[10px] text-slate-500">On-device LLM inference</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        setLoading(true);
                        const result = await checkOllamaConnection();
                        setStatus(result);
                        setLoading(false);
                    }}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={12} className="inline mr-1" />
                    Refresh
                </button>
            </div>

            <div className={`px-4 py-3 border-b ${status.connected ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-red-950/30 border-red-900/50'}`}>
                <div className="flex items-center gap-2">
                    {status.connected ? (
                        <>
                            <CheckCircle size={16} className="text-emerald-400" />
                            <span className="text-sm font-semibold text-emerald-300">
                                Connected • {status.models.length} model{status.models.length !== 1 ? 's' : ''}
                            </span>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={16} className="text-red-400" />
                            <span className="text-sm font-semibold text-red-300">Disconnected</span>
                            <span className="text-xs text-red-200/70 ml-2">{status.error}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {!status.connected ? (
                    <div className="p-6 space-y-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <AlertCircle size={14} className="text-orange-400" />
                                Unable to connect
                            </h3>
                            <div className="text-xs text-zinc-400 space-y-2">
                                <p>Start Ollama on your PC:</p>
                                <code className="block bg-zinc-950 p-2 rounded border border-zinc-800 text-orange-400 font-mono text-[11px]">
                                    ollama serve
                                </code>
                                <p>Current host: <span className="text-orange-400">{OLLAMA_HOST}</span></p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Server size={14} className="text-blue-400" />
                                Models
                            </h2>

                            {status.models.length === 0 ? (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center text-zinc-500 text-sm">
                                    <Zap size={16} className="mx-auto mb-2 opacity-50" />
                                    No models. Pull one to start.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {status.models.map((model) => (
                                        <div
                                            key={model.name}
                                            onClick={() => setActiveModel(model.name)}
                                            className={`border rounded-lg p-3 cursor-pointer transition-all ${
                                                activeModel === model.name
                                                    ? 'bg-orange-950/30 border-orange-500/50'
                                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-sm text-white">{model.name}</h3>
                                                    <div className="text-xs text-zinc-500 gap-4 mt-1">
                                                        {formatBytes(model.size)}
                                                    </div>
                                                </div>
                                                {activeModel === model.name && (
                                                    <span className="text-[10px] font-bold text-orange-300">ACTIVE</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteModel(model.name);
                                                }}
                                                className="w-full px-2 py-1 text-xs font-semibold bg-red-900/40 hover:bg-red-900 text-red-400 rounded transition-colors"
                                            >
                                                <Trash2 size={12} className="inline mr-1" />
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <Download size={14} className="text-emerald-400" />
                                Pull Model
                            </h3>
                            {pullProgress ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-zinc-400">{pullProgress.model}</p>
                                    <p className="text-xs font-mono text-orange-400">{pullProgress.status}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. llama2, mistral"
                                        value={pullInput}
                                        onChange={(e) => setPullInput(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                    />
                                    <button
                                        onClick={handlePullModel}
                                        disabled={!pullInput.trim()}
                                        className="w-full px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                                    >
                                        Pull
                                    </button>
                                </div>
                            )}
                        </div>

                        {activeModel && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <Cpu size={14} className="text-blue-400" />
                                    Test: {activeModel}
                                </h3>
                                <textarea
                                    value={testPrompt}
                                    onChange={(e) => setTestPrompt(e.target.value)}
                                    placeholder="Prompt..."
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600 resize-none h-16"
                                />
                                <button
                                    onClick={handleTestModel}
                                    disabled={testLoading}
                                    className="w-full px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                                >
                                    {testLoading ? (
                                        <>
                                            <Activity size={12} className="inline mr-1 animate-spin" />
                                            Running...
                                        </>
                                    ) : (
                                        <>
                                            <Play size={12} className="inline mr-1" />
                                            Run
                                        </>
                                    )}
                                </button>
                                {testOutput && (
                                    <div className="bg-zinc-800 border border-zinc-700 rounded p-3 max-h-32 overflow-y-auto">
                                        <p className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">{testOutput}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
