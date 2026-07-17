import React, { useState, useEffect } from 'react';
import { Cpu, BarChart3, Zap, DollarSign, Plus, Trash2, Download, Network, AlertCircle, CheckCircle, Eye, EyeOff, Shield, TrendingUp, Activity, Clock } from 'lucide-react';

interface ModelProvider {
    id: string;
    name: string;
    type: 'local' | 'free_cloud' | 'paid_cloud';
    status: 'available' | 'unavailable' | 'downloading';
    models: AIModel[];
    apiKey?: string;
    hideKey?: boolean;
    monthlyBudget?: number;
    monthlyUsed?: number;
    priority: number;
}

interface AIModel {
    id: string;
    name: string;
    size_gb?: number;
    type: 'reasoning' | 'code' | 'chat' | 'general' | 'instruct';
    costPerMRequest?: number;
    contextWindow?: number;
    speedRating: 'slow' | 'medium' | 'fast' | 'ultrafast';
    reasoning_level: 'basic' | 'intermediate' | 'advanced';
    downloadUrl?: string;
    isLocal?: boolean;
}

// Comprehensive free + open-source AI model catalog
const FREE_AI_MODELS: Record<string, ModelProvider> = {
    ollama_local: {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'local',
        status: 'available',
        priority: 1,
        models: [
            { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', type: 'general', speedRating: 'medium', reasoning_level: 'advanced', contextWindow: 8192, downloadUrl: 'ollama.ai/library/llama:70b', isLocal: true },
            { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', type: 'reasoning', speedRating: 'slow', reasoning_level: 'advanced', contextWindow: 128000, downloadUrl: 'ollama.ai/library/llama:405b', isLocal: true },
            { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', type: 'general', speedRating: 'medium', reasoning_level: 'advanced', contextWindow: 8192, downloadUrl: 'ollama.ai/library/llama:70b', isLocal: true },
            { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', contextWindow: 8192, downloadUrl: 'ollama.ai/library/llama:8b', isLocal: true },
            { id: 'mistral-7b', name: 'Mistral 7B', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', contextWindow: 32768, downloadUrl: 'ollama.ai/library/mistral', isLocal: true },
            { id: 'neural-chat-7b', name: 'Neural Chat 7B', type: 'chat', speedRating: 'fast', reasoning_level: 'basic', contextWindow: 4096, downloadUrl: 'ollama.ai/library/neural-chat', isLocal: true },
            { id: 'dolphin-mixtral', name: 'Dolphin Mixtral 8x7B', type: 'code', speedRating: 'medium', reasoning_level: 'advanced', contextWindow: 32768, downloadUrl: 'ollama.ai/library/dolphin-mixtral', isLocal: true },
            { id: 'hermes-2-pro', name: 'Hermes 2 Pro 8B', type: 'general', speedRating: 'fast', reasoning_level: 'intermediate', contextWindow: 4096, downloadUrl: 'ollama.ai/library/hermes2-pro', isLocal: true },
            { id: 'vicuna-13b', name: 'Vicuna 13B', type: 'chat', speedRating: 'fast', reasoning_level: 'intermediate', contextWindow: 4096, downloadUrl: 'ollama.ai/library/vicuna', isLocal: true },
            { id: 'zephyr-7b', name: 'Zephyr 7B', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', contextWindow: 4096, downloadUrl: 'ollama.ai/library/zephyr', isLocal: true },
        ]
    },

    groq_free: {
        id: 'groq',
        name: 'Groq (Free)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 2,
        models: [
            { id: 'llama-3.3-70b-groq', name: 'Llama 3.3 70B (Groq)', type: 'general', speedRating: 'ultrafast', reasoning_level: 'advanced', costPerMRequest: 0, contextWindow: 8192 },
            { id: 'mixtral-8x7b-groq', name: 'Mixtral 8x7B (Groq)', type: 'general', speedRating: 'ultrafast', reasoning_level: 'intermediate', costPerMRequest: 0, contextWindow: 32768 },
            { id: 'llama-2-70b-groq', name: 'Llama 2 70B (Groq)', type: 'general', speedRating: 'ultrafast', reasoning_level: 'intermediate', costPerMRequest: 0, contextWindow: 4096 },
        ]
    },

    deepseek_free: {
        id: 'deepseek',
        name: 'DeepSeek (Free Tier)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 3,
        models: [
            { id: 'deepseek-chat', name: 'DeepSeek Chat', type: 'chat', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0.001, contextWindow: 4096 },
            { id: 'deepseek-coder', name: 'DeepSeek Coder', type: 'code', speedRating: 'medium', reasoning_level: 'advanced', costPerMRequest: 0.001, contextWindow: 4096 },
        ]
    },

    google_free: {
        id: 'google',
        name: 'Google Gemini (Free)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 4,
        models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', type: 'general', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0, contextWindow: 1000000 },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'general', speedRating: 'ultrafast', reasoning_level: 'advanced', costPerMRequest: 0, contextWindow: 1000000 },
        ]
    },

    anthropic_free: {
        id: 'anthropic',
        name: 'Anthropic (Free Tier)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 5,
        models: [
            { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', type: 'general', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0, contextWindow: 200000 },
        ]
    },

    openrouter_free: {
        id: 'openrouter',
        name: 'OpenRouter (Free Models)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 6,
        models: [
            { id: 'meta-llama-3.1-8b', name: 'Llama 3.1 8B (OpenRouter)', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0.001, contextWindow: 8192 },
            { id: 'mistral-7b-instruct', name: 'Mistral 7B Instruct', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0.001, contextWindow: 32768 },
            { id: 'neural-chat-7b-or', name: 'Neural Chat 7B', type: 'chat', speedRating: 'fast', reasoning_level: 'basic', costPerMRequest: 0.0005, contextWindow: 4096 },
        ]
    },

    huggingface_models: {
        id: 'huggingface',
        name: 'Hugging Face (Community)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 7,
        models: [
            { id: 'nous-hermes-2-mixtral', name: 'Nous Hermes 2 Mixtral', type: 'general', speedRating: 'medium', reasoning_level: 'advanced', costPerMRequest: 0 },
            { id: 'open-hermes-2.5', name: 'Open Hermes 2.5', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0 },
            { id: 'starling-lm-7b', name: 'Starling LM 7B', type: 'chat', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0 },
            { id: 'openchat-3.5', name: 'OpenChat 3.5', type: 'chat', speedRating: 'fast', reasoning_level: 'basic', costPerMRequest: 0 },
        ]
    },

    together_free: {
        id: 'together',
        name: 'Together AI (Free Credits)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 8,
        models: [
            { id: 'llama-2-70b-together', name: 'Llama 2 70B', type: 'general', speedRating: 'medium', reasoning_level: 'intermediate', costPerMRequest: 0.0005 },
            { id: 'mistral-7b-together', name: 'Mistral 7B', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0.0005 },
            { id: 'falcon-180b', name: 'Falcon 180B', type: 'general', speedRating: 'slow', reasoning_level: 'advanced', costPerMRequest: 0.001 },
        ]
    },

    replicate_free: {
        id: 'replicate',
        name: 'Replicate (Free Tier)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 9,
        models: [
            { id: 'llama-2-70b-chat-replicate', name: 'Llama 2 70B Chat', type: 'chat', speedRating: 'medium', reasoning_level: 'intermediate', costPerMRequest: 0 },
            { id: 'mistral-7b-instruct-replicate', name: 'Mistral 7B Instruct', type: 'instruct', speedRating: 'fast', reasoning_level: 'intermediate', costPerMRequest: 0 },
        ]
    },

    perplexity_free: {
        id: 'perplexity',
        name: 'Perplexity (Free)',
        type: 'free_cloud',
        status: 'unavailable',
        priority: 10,
        models: [
            { id: 'sonar-small-online', name: 'Sonar Small Online', type: 'chat', speedRating: 'fast', reasoning_level: 'basic', costPerMRequest: 0, contextWindow: 127072 },
            { id: 'sonar-small-chat', name: 'Sonar Small Chat', type: 'chat', speedRating: 'fast', reasoning_level: 'basic', costPerMRequest: 0, contextWindow: 127072 },
        ]
    },
};

export const ModelRouterApp: React.FC = () => {
    const [providers, setProviders] = useState<ModelProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [routingMode, setRoutingMode] = useState<'free_first' | 'balanced' | 'performance'>('free_first');
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [newProviderForm, setNewProviderForm] = useState<Partial<ModelProvider>>({ hideKey: true });
    const [activeTab, setActiveTab] = useState<'routing' | 'analytics' | 'comparison'>('routing');
    const [checkingHealth, setCheckingHealth] = useState(false);
    const [lastHealthCheck, setLastHealthCheck] = useState<number | null>(null);
    const [healthError, setHealthError] = useState<string | null>(null);

    // Reachability probes per provider. Local providers get a real API hit;
    // cloud providers get an opaque (no-cors) ping that still fails on DNS/
    // network errors, which is enough to flag a provider as unreachable.
    const HEALTH_PROBES: Record<string, { url: string; mode: RequestMode }> = {
        ollama_local: { url: 'http://localhost:11434/api/tags', mode: 'cors' },
        groq_free: { url: 'https://api.groq.com/openai/v1/models', mode: 'no-cors' },
        deepseek_free: { url: 'https://api.deepseek.com', mode: 'no-cors' },
        google_free: { url: 'https://generativelanguage.googleapis.com', mode: 'no-cors' },
        anthropic_free: { url: 'https://api.anthropic.com', mode: 'no-cors' },
        openrouter_free: { url: 'https://openrouter.ai/api/v1/models', mode: 'no-cors' },
        huggingface_models: { url: 'https://huggingface.co', mode: 'no-cors' },
        together_free: { url: 'https://api.together.xyz', mode: 'no-cors' },
        replicate_free: { url: 'https://api.replicate.com', mode: 'no-cors' },
        perplexity_free: { url: 'https://api.perplexity.ai', mode: 'no-cors' },
    };

    const checkProviderHealth = async () => {
        setCheckingHealth(true);
        setHealthError(null);
        try {
            const results = await Promise.all(providers.map(async (p) => {
                const probe = HEALTH_PROBES[p.id];
                if (!probe) return { id: p.id, status: p.status };
                try {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), 4000);
                    await fetch(probe.url, { method: 'GET', mode: probe.mode, signal: ctrl.signal });
                    clearTimeout(timer);
                    return { id: p.id, status: 'available' as ModelProvider['status'] };
                } catch {
                    return { id: p.id, status: 'unavailable' as ModelProvider['status'] };
                }
            }));
            setProviders(prev => prev.map(p => {
                const r = results.find(x => x.id === p.id);
                return r ? { ...p, status: r.status } : p;
            }));
            setLastHealthCheck(Date.now());
        } catch (e) {
            setHealthError(e instanceof Error ? e.message : 'Health check failed');
        } finally {
            setCheckingHealth(false);
        }
    };

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('model_router');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setProviders(data.providers || []);
            } catch (e) {
                console.error('Failed to load model router:', e);
            }
        } else {
            // Initialize with local Ollama
            setProviders([FREE_AI_MODELS.ollama_local]);
        }
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('model_router', JSON.stringify({ providers }));
    }, [providers]);

    const addProvider = (providerKey: keyof typeof FREE_AI_MODELS) => {
        const providerTemplate = FREE_AI_MODELS[providerKey];
        if (!providers.find(p => p.id === providerTemplate.id)) {
            setProviders([...providers, { ...providerTemplate }]);
        }
        setShowAddProvider(false);
    };

    const deleteProvider = (id: string) => {
        setProviders(providers.filter(p => p.id !== id));
    };

    const updateProviderBudget = (id: string, budget: number) => {
        setProviders(providers.map(p => p.id === id ? { ...p, monthlyBudget: budget } : p));
    };

    const getRecommendedModel = (taskType: 'reasoning' | 'code' | 'chat' | 'general') => {
        const activeProviders = providers.filter(p => p.status === 'available');

        for (const provider of activeProviders.sort((a, b) => a.priority - b.priority)) {
            for (const model of provider.models) {
                // Check budget if set
                if (provider.monthlyBudget && provider.monthlyUsed && provider.monthlyUsed >= provider.monthlyBudget) {
                    continue; // Skip over budget
                }

                // Prefer free first
                if (provider.type === 'local' || !model.costPerMRequest || model.costPerMRequest === 0) {
                    if (model.type === taskType || model.type === 'general') {
                        return { provider: provider.name, model: model.name, cost: 0 };
                    }
                }
            }
        }

        // Fallback to Ollama
        return { provider: 'Ollama (Local)', model: 'Llama 3.1 8B', cost: 0 };
    };

    const totalFreeModels = Object.values(FREE_AI_MODELS).reduce((sum, p) => sum + p.models.length, 0);
    const activeProviders = providers.filter(p => p.status === 'available').length;

    const getSpeedScore = (speed: string): number => {
        switch(speed) {
            case 'ultrafast': return 5;
            case 'fast': return 4;
            case 'medium': return 3;
            case 'slow': return 2;
            default: return 1;
        }
    };

    const getCostScore = (cost: number): number => {
        if (cost === 0) return 10;
        if (cost <= 0.0005) return 9;
        if (cost <= 0.001) return 8;
        if (cost <= 0.01) return 5;
        return 2;
    };

    const getModelScore = (model: AIModel): number => {
        const speedScore = getSpeedScore(model.speedRating) * 1.5;
        const costScore = getCostScore(model.costPerMRequest || 0);
        const reasoningScore = model.reasoning_level === 'advanced' ? 10 : model.reasoning_level === 'intermediate' ? 5 : 2;
        return (speedScore + costScore + reasoningScore) / 3;
    };

    const topModels = providers
        .flatMap(p => p.models.map(m => ({ provider: p.name, model: m, score: getModelScore(m) })))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    return (
        <div className="h-full w-full bg-[#09090b] text-slate-300 font-sans flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800/80 bg-[#0f1115] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Network size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-200">Model Router</h1>
                        <p className="text-[10px] text-slate-500">{activeProviders} providers • {totalFreeModels} free models</p>
                    </div>
                </div>
                <button
                    onClick={checkProviderHealth}
                    disabled={checkingHealth}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                    title="Actually ping each provider's API"
                >
                    {checkingHealth ? 'Checking…' : 'Check Real Status'}
                </button>
            </div>
            {lastHealthCheck && (
                <div className="px-4 py-1 text-[9px] text-zinc-500 border-b border-zinc-800/80 bg-[#0f1115]">
                    Last real check: {new Date(lastHealthCheck).toLocaleTimeString()}
                </div>
            )}
            {healthError && (
                <div className="px-4 py-1 text-[9px] text-red-400 border-b border-zinc-800/80 bg-[#0f1115]">
                    Health check failed: {healthError}
                </div>
            )}

            {/* Tabs */}
            <div className="h-10 border-b border-zinc-800/80 bg-[#0f1115] flex items-center px-4 shrink-0 gap-4">
                {(['routing', 'analytics', 'comparison'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                            activeTab === tab
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {tab === 'routing' ? '🔀 Routing' : tab === 'analytics' ? '📊 Analytics' : '⚔️ Compare'}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 space-y-6">
                    {activeTab === 'routing' && (
                    <>
                    <div className="h-10 flex items-center px-4 gap-2">
                        <span className="text-xs text-zinc-400">Routing Mode:</span>
                        {(['free_first', 'balanced', 'performance'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setRoutingMode(mode)}
                                className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                                    routingMode === mode
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {mode === 'free_first' ? '💚 Free First' : mode === 'balanced' ? '⚖️ Balanced' : '⚡ Performance'}
                            </button>
                        ))}
                    </div>
                    {/* Routing Status */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <Zap size={14} className="text-yellow-400" />
                            Recommended Models by Task
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {(['reasoning', 'code', 'chat', 'general'] as const).map(task => {
                                const rec = getRecommendedModel(task);
                                return (
                                    <div key={task} className="bg-zinc-950 rounded-lg p-2 border border-zinc-800">
                                        <div className="text-[9px] text-zinc-400 capitalize font-bold">{task}</div>
                                        <div className="text-[10px] text-white mt-1">{rec.model}</div>
                                        <div className="text-[8px] text-emerald-400 mt-0.5">
                                            {rec.cost === 0 ? '💚 Free' : `$${rec.cost}/1M`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Providers */}
                    {providers.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-white">Active Providers</h2>
                            <div className="space-y-2">
                                {providers.map(provider => (
                                    <div key={provider.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-xs font-bold text-white">{provider.name}</div>
                                                <div className="text-[9px] text-zinc-400 mt-0.5">{provider.models.length} models • {provider.type}</div>
                                            </div>
                                            <button
                                                onClick={() => deleteProvider(provider.id)}
                                                className="p-1 hover:bg-red-900/20 rounded text-red-400"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>

                                        {provider.type === 'paid_cloud' && (
                                            <div className="space-y-1">
                                                <label className="text-[8px] text-zinc-400">Monthly Budget ($)</label>
                                                <input
                                                    type="number"
                                                    placeholder="e.g. 50"
                                                    value={provider.monthlyBudget || ''}
                                                    onChange={(e) => updateProviderBudget(provider.id, parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                                />
                                                {provider.monthlyBudget && (
                                                    <div className="text-[8px] text-zinc-400">
                                                        Used: ${provider.monthlyUsed || 0} / ${provider.monthlyBudget}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="text-[8px] text-zinc-500">
                                            Models: {provider.models.slice(0, 3).map(m => m.name).join(', ')}{provider.models.length > 3 ? ` +${provider.models.length - 3}` : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Provider */}
                    {!showAddProvider ? (
                        <button
                            onClick={() => setShowAddProvider(true)}
                            className="w-full px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={14} />
                            Add Free AI Provider
                        </button>
                    ) : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                            <h3 className="text-sm font-bold text-white">Available Free & Open Models</h3>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                {Object.entries(FREE_AI_MODELS).filter(([_, p]) => !providers.find(prov => prov.id === p.id)).map(([key, provider]) => (
                                    <button
                                        key={key}
                                        onClick={() => addProvider(key as keyof typeof FREE_AI_MODELS)}
                                        className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-blue-500 transition-all text-left text-xs"
                                    >
                                        <div className="font-bold text-white">{provider.name}</div>
                                        <div className="text-[8px] text-zinc-400 mt-1">{provider.models.length} models</div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowAddProvider(false)}
                                className="w-full px-3 py-1.5 text-xs font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <Shield size={12} />
                            Free-First Guarantee
                        </div>
                        <p className="text-[9px] text-emerald-300/80">
                            This router always prioritizes free models and local Ollama. Paid APIs are only used if you explicitly set a budget and enable them. Never forced.
                        </p>
                    </div>
                    </>
                    )}

                    {activeTab === 'analytics' && (
                    <>
                    {/* Top Performers */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <TrendingUp size={14} className="text-blue-400" />
                            Top Performers
                        </h2>
                        <div className="space-y-2">
                            {topModels.map((item, i) => (
                                <div key={i} className="bg-zinc-950 rounded-lg p-2 border border-zinc-800 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-white font-semibold">{item.model.name}</div>
                                        <div className="text-[8px] text-zinc-400">{item.provider}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-emerald-400">{item.score.toFixed(1)}/10</div>
                                        <div className="text-[8px] text-zinc-400">{item.model.speedRating}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cost Summary */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
                            <div className="text-[9px] text-zinc-400 flex items-center gap-1">
                                <DollarSign size={12} /> Free Models
                            </div>
                            <div className="text-lg font-bold text-emerald-400">
                                {providers.flatMap(p => p.models).filter(m => !m.costPerMRequest || m.costPerMRequest === 0).length}
                            </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
                            <div className="text-[9px] text-zinc-400 flex items-center gap-1">
                                <Activity size={12} /> Providers
                            </div>
                            <div className="text-lg font-bold text-blue-400">{activeProviders}</div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
                            <div className="text-[9px] text-zinc-400 flex items-center gap-1">
                                <Clock size={12} /> Fastest
                            </div>
                            <div className="text-lg font-bold text-yellow-400">
                                {providers.flatMap(p => p.models).filter(m => m.speedRating === 'ultrafast').length}
                            </div>
                        </div>
                    </div>
                    </>
                    )}

                    {activeTab === 'comparison' && (
                    <>
                    {/* Capability Matrix */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart3 size={14} className="text-purple-400" />
                            Model Capability Matrix
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-zinc-700">
                                        <th className="text-left py-2 px-2 text-zinc-400">Model</th>
                                        <th className="text-center py-2 px-2 text-zinc-400">Speed</th>
                                        <th className="text-center py-2 px-2 text-zinc-400">Reasoning</th>
                                        <th className="text-center py-2 px-2 text-zinc-400">Cost</th>
                                        <th className="text-center py-2 px-2 text-zinc-400">Context</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topModels.map((item, i) => (
                                        <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                            <td className="py-2 px-2 text-white font-semibold">{item.model.name}</td>
                                            <td className="py-2 px-2 text-center">
                                                <span className="text-emerald-400">{item.model.speedRating}</span>
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <span className="text-blue-400">{item.model.reasoning_level}</span>
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <span className={item.model.costPerMRequest === 0 ? 'text-green-400' : 'text-yellow-400'}>
                                                    {item.model.costPerMRequest === 0 ? 'Free' : `$${item.model.costPerMRequest}`}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-center text-zinc-400">
                                                {item.model.contextWindow ? `${(item.model.contextWindow / 1000).toFixed(0)}K` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Speed vs Cost Ranking */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <h2 className="text-sm font-bold text-white">Speed vs Cost Trade-off</h2>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                                <span className="text-zinc-300">Best Value</span>
                                <span className="text-emerald-400 font-bold">Groq Free Tier</span>
                            </div>
                            <div className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                                <span className="text-zinc-300">Most Capable</span>
                                <span className="text-purple-400 font-bold">Claude 3.5 Haiku</span>
                            </div>
                            <div className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                                <span className="text-zinc-300">Most Flexible</span>
                                <span className="text-blue-400 font-bold">Gemini 2.0 Flash</span>
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
};
