import React, { useState } from 'react';
import { Cloud, Globe, Box, CheckCircle, Loader2, ArrowRight, Server, UploadCloud, Database } from 'lucide-react';

export const CloudDeployApp = () => {
    const [selectedProvider, setSelectedProvider] = useState<'vercel' | 'gcp' | 'replit' | null>(null);
    const [deploying, setDeploying] = useState(false);
    const [deployed, setDeployed] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const handleDeploy = async () => {
        if (!selectedProvider) return;
        setDeploying(true);
        setDeployed(false);

        if (selectedProvider !== 'replit') {
            // Being real: this environment has no Vercel/GCP credentials connected,
            // so we cannot actually deploy there. Say so instead of faking a log cycle.
            setLogs([`No ${selectedProvider === 'vercel' ? 'Vercel' : 'Google Cloud'} account is connected to this project.`,
                'Connect real hosting credentials (via Replit\'s environment secrets) to enable a real deployment here.']);
            setDeploying(false);
            return;
        }

        // Replit path: this app is already running live in a real Replit container.
        // "Deploying" here means running the real production build against the
        // real running server and reporting its actual live URL.
        setLogs(['Running real production build (`npm run build`)...']);
        try {
            const resp = await fetch('/api/build/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const data = await resp.json();
            if (!data.success) {
                setLogs(prev => [...prev, 'Build failed:', data.stderr || data.stdout || 'Unknown build error']);
                setDeploying(false);
                return;
            }
            setLogs(prev => [...prev, `Build succeeded in ${(data.durationMs / 1000).toFixed(1)}s.`,
                'This container is your real, already-live server — no separate deploy step needed on Replit.',
                `Live at: ${window.location.origin}`]);
            setDeployed(true);
        } catch (err: any) {
            setLogs(prev => [...prev, `Deployment check failed: ${err.message}`]);
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="h-full w-full bg-zinc-950 flex flex-col text-zinc-100 font-mono overflow-y-auto">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900">
                <div className="flex items-center gap-3 mb-2">
                    <Cloud className="text-blue-400" size={24} />
                    <h1 className="text-xl font-bold tracking-tight">Global Cloud Deployment</h1>
                </div>
                <p className="text-sm text-zinc-400 max-w-lg">
                    Deploy your Semantic Compression Pods and Global State architecture directly to your linked cloud providers for zero-latency universal access.
                </p>
            </div>

            <div className="p-6 flex-1 flex flex-col max-w-4xl mx-auto w-full gap-8">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Select Hosting Target</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => { setSelectedProvider('vercel'); setDeployed(false); setLogs([]); }}
                            className={`flex flex-col items-center gap-3 p-6 border rounded-xl transition-all ${selectedProvider === 'vercel' ? 'border-zinc-100 bg-zinc-900 ring-1 ring-zinc-100 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 hover:bg-zinc-900'}`}
                        >
                            <Box size={32} className={selectedProvider === 'vercel' ? 'text-zinc-100' : 'text-zinc-400'} />
                            <div className="text-center">
                                <div className="font-semibold text-zinc-200">Vercel</div>
                                <div className="text-xs text-zinc-500 mt-1">Edge Network & Serverless</div>
                            </div>
                        </button>
                        
                        <button
                            onClick={() => { setSelectedProvider('gcp'); setDeployed(false); setLogs([]); }}
                            className={`flex flex-col items-center gap-3 p-6 border rounded-xl transition-all ${selectedProvider === 'gcp' ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 hover:bg-zinc-900'}`}
                        >
                            <Server size={32} className={selectedProvider === 'gcp' ? 'text-blue-400' : 'text-zinc-400'} />
                            <div className="text-center">
                                <div className="font-semibold text-zinc-200">Google Cloud</div>
                                <div className="text-xs text-zinc-500 mt-1">Cloud Run Containerization</div>
                            </div>
                        </button>
                        
                        <button
                            onClick={() => { setSelectedProvider('replit'); setDeployed(false); setLogs([]); }}
                            className={`flex flex-col items-center gap-3 p-6 border rounded-xl transition-all ${selectedProvider === 'replit' ? 'border-orange-500 bg-orange-950/20 ring-1 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 hover:bg-zinc-900'}`}
                        >
                            <Globe size={32} className={selectedProvider === 'replit' ? 'text-orange-400' : 'text-zinc-400'} />
                            <div className="text-center">
                                <div className="font-semibold text-zinc-200">Replit</div>
                                <div className="text-xs text-zinc-500 mt-1">Instant Globals</div>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Deployment Sequence</h2>
                        <button 
                            disabled={!selectedProvider || deploying || deployed}
                            onClick={handleDeploy}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                        >
                            {deploying ? (
                                <><Loader2 size={16} className="animate-spin" /> Deploying...</>
                            ) : deployed ? (
                                <><CheckCircle size={16} /> Live Online</>
                            ) : (
                                <><UploadCloud size={16} /> Execute Deployment</>
                            )}
                        </button>
                    </div>

                    <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-y-auto">
                        {logs.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-zinc-600">
                                Select a target and execute deployment to monitor the sequence.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {logs.map((log, i) => (
                                    <div key={i} className={`flex items-start gap-2 ${i === logs.length - 1 && !deployed ? 'text-indigo-400' : 'text-zinc-400'}`}>
                                        <ArrowRight size={14} className="shrink-0 mt-0.5 opacity-50" />
                                        <span>{log}</span>
                                    </div>
                                ))}
                                {deploying && (
                                    <div className="flex items-start gap-2 text-zinc-500 animate-pulse">
                                        <Loader2 size={14} className="shrink-0 mt-0.5 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
