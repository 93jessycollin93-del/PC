import React from 'react';
import { Server, Settings2, Sparkles, ChevronDown } from 'lucide-react';

interface EngineSelectorProps {
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    useHardwareOllama: boolean;
    setUseHardwareOllama: (use: boolean) => void;
    customOllamaEndpoint: string;
    setCustomOllamaEndpoint: (endpoint: string) => void;
    customOllamaModel: string;
    setCustomOllamaModel: (model: string) => void;
    customOllamaApiKey: string;
    setCustomOllamaApiKey: (key: string) => void;
    isPremiumSubscribed: boolean;
    onPremiumUpgrade: () => void;
}

export function EngineSelector({
    selectedModel,
    setSelectedModel,
    useHardwareOllama,
    setUseHardwareOllama,
    customOllamaEndpoint,
    setCustomOllamaEndpoint,
    customOllamaModel,
    setCustomOllamaModel,
    customOllamaApiKey,
    setCustomOllamaApiKey,
    isPremiumSubscribed,
    onPremiumUpgrade
}: EngineSelectorProps) {
    const [engineType, setEngineType] = React.useState<'gemini' | 'ollama' | 'openrouter'>(useHardwareOllama ? 'ollama' : 'gemini');

    const handleEngineChange = (type: 'gemini' | 'ollama' | 'openrouter') => {
        setEngineType(type);
        if (type === 'ollama') {
            setUseHardwareOllama(true);
        } else {
            setUseHardwareOllama(false);
        }
    };

    return (
        <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden border border-[#2c2c2e]">
            {/* Header / Engine Type Tabs */}
            <div className="flex bg-[#252528] p-1 gap-1 border-b border-[#2c2c2e]">
                <button
                    onClick={() => handleEngineChange('gemini')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                        engineType === 'gemini' 
                            ? 'bg-[#333336] text-white shadow-sm' 
                            : 'text-[#8e8e93] hover:text-white hover:bg-[#333336]/50'
                    }`}
                >
                    <Sparkles size={14} className={engineType === 'gemini' ? 'text-sky-400' : ''} />
                    Gemini
                </button>
                <button
                    onClick={() => handleEngineChange('ollama')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                        engineType === 'ollama' 
                            ? 'bg-[#333336] text-white shadow-sm' 
                            : 'text-[#8e8e93] hover:text-white hover:bg-[#333336]/50'
                    }`}
                >
                    <Server size={14} className={engineType === 'ollama' ? 'text-emerald-400' : ''} />
                    Local
                </button>
                <button
                    onClick={() => handleEngineChange('openrouter')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                        engineType === 'openrouter' 
                            ? 'bg-[#333336] text-white shadow-sm' 
                            : 'text-[#8e8e93] hover:text-white hover:bg-[#333336]/50'
                    }`}
                >
                    <Settings2 size={14} className={engineType === 'openrouter' ? 'text-indigo-400' : ''} />
                    Custom
                </button>
            </div>

            {/* Content Area */}
            <div className="p-4 space-y-4">
                {engineType === 'gemini' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-1.5 relative">
                            <label className="text-[11px] font-mono text-[#8e8e93] uppercase tracking-wider pl-1">Model Selection</label>
                            <div className="relative">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => {
                                        const model = e.target.value;
                                        if (model === 'gemini-2.5-pro' && !isPremiumSubscribed) {
                                            onPremiumUpgrade();
                                        } else {
                                            setSelectedModel(model);
                                        }
                                    }}
                                    className="w-full bg-[#252528] border-none rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 appearance-none cursor-pointer"
                                >
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Free)</option>
                                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Premium)</option>
                                    <option value="gemini-2.0-flash-thinking-exp-01-21">Gemini 2.0 Flash Thinking</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8e8e93]">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#252528] rounded-xl p-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-[#8e8e93] uppercase">Status</span>
                                {isPremiumSubscribed ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                        PREMIUM UNLOCKED
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                                        BASIC TIER
                                    </span>
                                )}
                            </div>
                            {!isPremiumSubscribed && (
                                <button 
                                    onClick={onPremiumUpgrade}
                                    className="w-full mt-1 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-400 transition-all text-center"
                                >
                                    UPGRADE TO PRO
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {engineType === 'ollama' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-mono text-[#8e8e93] uppercase tracking-wider pl-1">Endpoint URL</label>
                            <input 
                                type="text" 
                                value={customOllamaEndpoint}
                                onChange={(e) => setCustomOllamaEndpoint(e.target.value)}
                                placeholder="http://localhost:11434"
                                className="w-full bg-[#252528] border-none rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-shadow"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-mono text-[#8e8e93] uppercase tracking-wider pl-1">Model Name</label>
                            <input 
                                type="text" 
                                value={customOllamaModel}
                                onChange={(e) => setCustomOllamaModel(e.target.value)}
                                placeholder="llama3.2"
                                className="w-full bg-[#252528] border-none rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-shadow"
                            />
                        </div>
                        <p className="text-xs text-[#8e8e93] px-1 leading-relaxed">
                            Connect to your local Ollama instance or proxy tunnel to process requests entirely on your own hardware.
                        </p>
                    </div>
                )}

                {engineType === 'openrouter' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <div className="space-y-1.5 relative">
                            <label className="text-[11px] font-mono text-[#8e8e93] uppercase tracking-wider pl-1">Provider Selection</label>
                            <div className="relative">
                                <select
                                    disabled
                                    className="w-full bg-[#252528] border-none rounded-xl px-4 py-3 text-[14px] text-[#8e8e93] focus:outline-none appearance-none cursor-not-allowed opacity-70"
                                >
                                    <option>OpenRouter (Coming Soon)</option>
                                    <option>Anthropic (Coming Soon)</option>
                                    <option>Custom OpenAI Compatible (Coming Soon)</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#555]">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>
                         <div className="space-y-1.5">
                            <label className="text-[11px] font-mono text-[#8e8e93] uppercase tracking-wider pl-1">API Key</label>
                            <input 
                                type="password" 
                                value={customOllamaApiKey}
                                onChange={(e) => setCustomOllamaApiKey(e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="w-full bg-[#252528] border-none rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-shadow font-mono"
                            />
                        </div>
                        <p className="text-xs text-[#8e8e93] px-1 leading-relaxed">
                            Support for custom remote endpoints and custom headers is currently being engineered by the dev nodes.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
