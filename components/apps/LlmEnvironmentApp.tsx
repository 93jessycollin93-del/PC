import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Server, Search, X, ChevronLeft, ArrowRight, Activity, Network, Database } from 'lucide-react';

type LlmView = 'choose' | 'providers' | 'local' | 'openrouter' | 'custom' | 'diagnostics';

const renderHeader = (title: string, onBack?: () => void) => (
    <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        {onBack ? (
            <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
                <ChevronLeft size={20} />
            </button>
        ) : (
            <div className="w-9" />
        )}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="w-9" />
    </div>
);

// Live diagnostics extracted into its own component so its hooks are only
// mounted when the view is active (React Rules of Hooks compliant).
const DiagnosticsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [latency, setLatency] = useState(42);
    const [tokens, setTokens] = useState(2450);

    useEffect(() => {
        const interval = setInterval(() => {
            setLatency(prev => Math.max(10, prev + Math.floor(Math.random() * 20) - 10));
            setTokens(prev => prev + Math.floor(Math.random() * 5));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-white font-mono">
            {renderHeader('System Diagnostics', onBack)}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-zinc-900 border border-emerald-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="text-emerald-400" size={16} />
                        <h3 className="text-emerald-400 text-sm uppercase tracking-wider font-semibold">Active Metrics</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-xs mb-1 uppercase">Response Latency</div>
                            <div className="text-2xl text-emerald-400 flex items-end gap-1">
                                {latency} <span className="text-sm text-emerald-600 mb-1">ms</span>
                            </div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-xs mb-1 uppercase">Active Tokens</div>
                            <div className="text-2xl text-emerald-400 flex items-end gap-1">
                                {tokens.toLocaleString()} <span className="text-sm text-emerald-600 mb-1">tk</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Network className="text-blue-400" size={16} />
                        <h3 className="text-blue-400 text-sm uppercase tracking-wider font-semibold">Health Connectivity</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2">
                            <span className="text-zinc-400">Main API Gateway</span>
                            <span className="text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2">
                            <span className="text-zinc-400">WebSocket Relay</span>
                            <span className="text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> STABLE
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-400">Vector DB</span>
                            <span className="text-amber-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span> SYNCING
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Database className="text-purple-400" size={16} />
                        <h3 className="text-purple-400 text-sm uppercase tracking-wider font-semibold">Model Routing</h3>
                    </div>
                    <div className="text-sm text-zinc-400">
                        Current fallback chain is fully operational. Overruling local constraints if load exceeds 95%.
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LlmEnvironmentApp: React.FC = () => {
    const [currentView, setCurrentView] = useState<LlmView>('choose');

    const renderChooseModel = () => (
        <div className="flex flex-col h-full bg-zinc-950 text-white">
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <h1 className="text-2xl font-bold mb-2">Choose a model to begin</h1>
                <p className="text-zinc-400 text-center text-sm mb-10 max-w-xs">
                    Chat with models running on your device or in the cloud.
                </p>

                <div className="w-full max-w-sm space-y-4">
                    <button onClick={() => setCurrentView('local')} className="w-full flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors text-left">
                        <Smartphone size={24} className="text-zinc-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-zinc-200">Local Models</h3>
                            <p className="text-sm text-zinc-500">Run models privately on your device. Works best on newer hardware.</p>
                        </div>
                    </button>
                    <button onClick={() => setCurrentView('openrouter')} className="w-full flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors text-left">
                        <RefreshCw size={24} className="text-zinc-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-zinc-200">OpenRouter</h3>
                            <p className="text-sm text-zinc-500">Access a wide range of hosted models including OpenAI, Anthropic, and more.</p>
                        </div>
                    </button>
                    <button onClick={() => setCurrentView('custom')} className="w-full flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors text-left">
                        <Server size={24} className="text-zinc-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-zinc-200">Custom Backends</h3>
                            <p className="text-sm text-zinc-500">Connect your own backend or API to use custom models.</p>
                        </div>
                    </button>
                    <button onClick={() => setCurrentView('diagnostics')} className="w-full flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors text-left border border-zinc-800 bg-zinc-900/20">
                        <Activity size={24} className="text-emerald-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-emerald-400">System Diagnostics</h3>
                            <p className="text-sm text-zinc-500">Monitor active model token usage, response latency, and connectivity metrics.</p>
                        </div>
                    </button>
                </div>
            </div>

            <div className="p-6 border-t border-zinc-900">
                <button onClick={() => setCurrentView('providers')} className="w-full bg-zinc-100 hover:bg-white text-black font-semibold rounded-full py-4 transition-colors">
                    Choose a model
                </button>
            </div>
        </div>
    );

    const renderProviders = () => (
        <div className="flex flex-col h-full bg-zinc-950 text-white relative">
            <div className="p-4 flex items-center justify-between">
                <button onClick={() => setCurrentView('choose')} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
                    <X size={20} />
                </button>
                <h2 className="text-lg font-bold">AI Providers</h2>
                <div className="w-10"></div>
            </div>

            <div className="px-6 py-4">
                <p className="text-sm text-zinc-400 text-center mb-8 px-4">
                    Your model provider determines the AIs you have access to.
                </p>

                <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Providers</h3>
                <div className="bg-zinc-900/80 rounded-3xl overflow-hidden border border-zinc-800">
                    <button onClick={() => setCurrentView('openrouter')} className="w-full flex items-center justify-between p-5 border-b border-zinc-800/80 hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                <RefreshCw size={18} className="text-zinc-300" />
                            </div>
                            <span className="font-medium text-[15px]">OpenRouter</span>
                        </div>
                        <ArrowRight size={18} className="text-zinc-500" />
                    </button>
                    <button onClick={() => setCurrentView('local')} className="w-full flex items-center justify-between p-5 border-b border-zinc-800/80 hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                <Smartphone size={18} className="text-zinc-300" />
                            </div>
                            <span className="font-medium text-[15px]">Local Model</span>
                        </div>
                        <ArrowRight size={18} className="text-zinc-500" />
                    </button>
                    <button onClick={() => setCurrentView('custom')} className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                <Server size={18} className="text-zinc-300" />
                            </div>
                            <span className="font-medium text-[15px]">Custom Backends</span>
                        </div>
                        <ArrowRight size={18} className="text-zinc-500" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderLocalModels = () => (
        <div className="flex flex-col h-full bg-zinc-950 text-white">
            {renderHeader('Local Models', () => setCurrentView('providers'))}

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <p className="text-xs text-zinc-400 text-center mb-6 px-4">
                    Always verify information. Smaller models may produce more inaccuracies.
                </p>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Chat models</h3>
                        <div className="bg-zinc-900/80 rounded-3xl overflow-hidden border border-zinc-800">
                            {[
                                { name: 'LFM2-2.6B', params: '2.6B parameters · LiquidAI' },
                                { name: 'LFM2-2.6B-Exp', params: '2.6B parameters · LiquidAI' },
                                { name: 'LFM2-350M', params: '350M parameters · LiquidAI' },
                                { name: 'LFM2-700M', params: '700M parameters · LiquidAI' },
                                { name: 'LFM2.5-1.2B-Instruct', params: '1.2B parameters · LiquidAI' },
                                { name: 'LFM2.5-1.2B-JP', params: '1.2B parameters · LiquidAI' },
                                { name: 'LFM2.5-1.2B-Thinking', params: '1.2B parameters · LiquidAI' },
                                { name: 'LFM2.5-350M', params: '350M parameters · LiquidAI' }
                            ].map((model, idx) => (
                                <button key={idx} className="w-full flex items-center justify-between p-4 border-b border-zinc-800/80 last:border-0 hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black">
                                            <span className="font-bold">L</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium text-[15px]">{model.name}</div>
                                            <div className="text-xs text-zinc-500">{model.params}</div>
                                        </div>
                                    </div>
                                    <ArrowRight size={18} className="text-zinc-600" />
                                </button>
                            ))}
                            {[
                                { name: 'Qwen3-0.6B', params: '0.6B parameters · Qwen' },
                                { name: 'Qwen3-1.7B', params: '1.7B parameters · Qwen' }
                            ].map((model, idx) => (
                                <button key={'q'+idx} className="w-full flex items-center justify-between p-4 border-b border-zinc-800/80 last:border-0 hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                                            <span className="font-bold">Q</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium text-[15px]">{model.name}</div>
                                            <div className="text-xs text-zinc-500">{model.params}</div>
                                        </div>
                                    </div>
                                    <ArrowRight size={18} className="text-zinc-600" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Translate Models</h3>
                        <div className="bg-zinc-900/80 rounded-3xl overflow-hidden border border-zinc-800">
                            <button className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black">
                                        <span className="font-bold">L</span>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium text-[15px]">LFM2-350M-ENJP-MT</div>
                                        <div className="text-xs text-zinc-500">350M parameters · LiquidAI</div>
                                    </div>
                                </div>
                                <ArrowRight size={18} className="text-zinc-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-zinc-900 bg-zinc-950">
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search local models"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
                    />
                </div>
            </div>
        </div>
    );

    const renderOpenRouter = () => (
        <div className="flex flex-col h-full bg-zinc-950 text-white">
            {renderHeader('OpenRouter', () => setCurrentView('providers'))}

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <p className="text-sm text-zinc-400 text-center mb-8 px-4">
                    OpenRouter provides routing to various LLM providers. Set up autopay to avoid interruptions.
                </p>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">OpenRouter Account</h3>
                        <button className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 text-left font-medium hover:bg-zinc-800/50 transition-colors">
                            Log In
                        </button>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">OpenRouter API Key</h3>
                        <input
                            type="password"
                            placeholder="Paste your key"
                            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-600"
                        />
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Models</h3>
                        <button className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
                            <span className="font-medium">Tap to load models</span>
                            <RefreshCw size={18} className="text-zinc-400" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCustom = () => (
        <div className="flex flex-col h-full bg-zinc-950 text-white">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="w-16" />
                <h2 className="text-lg font-semibold text-white">Custom Backend</h2>
                <button className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-full border border-zinc-700 text-sm transition-colors">
                    Save
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <p className="text-sm text-zinc-400 text-center mb-8 px-4">
                    Field requirements will depend on your specific backend deployment.
                </p>

                <div className="space-y-8">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Chat completion endpoint</h3>
                        <div className="bg-zinc-900/80 rounded-3xl overflow-hidden border border-zinc-800">
                            <div className="flex items-center p-4 border-b border-zinc-800/80">
                                <div className="w-24 text-[15px] font-medium text-white">Name</div>
                                <input type="text" defaultValue="Custom Backend" className="flex-1 bg-transparent border-none outline-none text-white text-[15px]" />
                            </div>
                            <div className="flex items-center p-4 border-b border-zinc-800/80">
                                <div className="w-24 text-[15px] font-medium text-white">Base URL</div>
                                <input type="text" placeholder="http://192.168.1.100:123" className="flex-1 bg-transparent border-none outline-none text-zinc-400 text-[15px]" />
                            </div>
                            <div className="flex items-center p-4 border-b border-zinc-800/80">
                                <div className="w-24 text-[15px] font-medium text-white">Chat Path</div>
                                <input type="text" defaultValue="/v1/chat/completions" className="flex-1 bg-transparent border-none outline-none text-white text-[15px]" />
                            </div>
                            <div className="flex items-center p-4 border-b border-zinc-800/80">
                                <div className="w-24 text-[15px] font-medium text-white">Models Path</div>
                                <input type="text" defaultValue="/v1/models" className="flex-1 bg-transparent border-none outline-none text-white text-[15px]" />
                            </div>
                            <div className="flex items-center p-4">
                                <div className="w-24 text-[15px] font-medium text-white">Auth</div>
                                <input type="text" placeholder="Bearer Token" className="flex-1 bg-transparent border-none outline-none text-zinc-400 text-[15px]" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Custom Model</h3>
                        <input
                            type="text"
                            placeholder="model-id"
                            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-600 mb-2"
                        />
                        <p className="text-xs text-zinc-500 px-2">Specify your model identifier, or reload your custom models.</p>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Models</h3>
                        <button className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
                            <span className="font-medium">Tap to load models</span>
                            <RefreshCw size={18} className="text-zinc-400" />
                        </button>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-2 px-2">Danger</h3>
                        <button className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 text-left font-medium text-red-500 hover:bg-zinc-800/50 transition-colors">
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-zinc-900 flex justify-center">
                <button onClick={() => setCurrentView('providers')} className="text-zinc-500 hover:text-white transition-colors text-sm underline">
                    Cancel
                </button>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full font-sans max-w-md mx-auto border-x border-zinc-900 bg-zinc-950 overflow-hidden relative shadow-2xl">
            {currentView === 'choose' && renderChooseModel()}
            {currentView === 'providers' && renderProviders()}
            {currentView === 'local' && renderLocalModels()}
            {currentView === 'openrouter' && renderOpenRouter()}
            {currentView === 'custom' && renderCustom()}
            {currentView === 'diagnostics' && <DiagnosticsView onBack={() => setCurrentView('choose')} />}
        </div>
    );
};
