import React, { useState, useRef, useEffect } from 'react';
import { HardDrive, Server, Activity, ShieldCheck, Download, Trash2, Search, PlayCircle, Info } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

interface Build {
    id: string;
    name: string;
    size: string;
    status: 'deployed' | 'compiled' | 'failed' | 'building';
    date: string;
    logs: string;
}

export const BuildVaultApp: React.FC = () => {
    const [builds, setBuilds] = useState<Build[]>([
        { id: 'b1', name: 'v2.5.1-prod', size: '4.2 MB', status: 'deployed', date: 'Just now', logs: '[00:00:01] Starting build pipeline...\n[00:00:04] Compiling assets...\n[00:00:10] Optimizing images...\n[00:00:15] Build successful. Deployed to edge network.' },
        { id: 'b2', name: 'v2.5.0-rc3', size: '4.1 MB', status: 'compiled', date: '10 mins ago', logs: '[00:00:01] Starting build pipeline...\n[00:00:05] Build successful. Awaiting manual deployment.' },
        { id: 'b3', name: 'v2.4.9-hotfix', size: '0.0 MB', status: 'failed', date: '1 hour ago', logs: '[00:00:01] Starting build pipeline...\n[00:00:03] ERR: Module not found: "crypto".\n[00:00:03] Build aborted.' },
    ]);
    const [selectedBuild, setSelectedBuild] = useState<Build | null>(builds[0]);
    const [analysis, setAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async (build: Build) => {
        setIsAnalyzing(true);
        setAnalysis('Analyzing build logs...');
        
        try {
            const ai = getAiClient();
            const prompt = `Analyze the following application build logs and provide a concise, technical root cause analysis or health summary. 
            Keep it strictly professional, under 3 sentences.
            
            Build Name: ${build.name}
            Status: ${build.status}
            Logs:
            ${build.logs}`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
            });

            setAnalysis(response.text || 'Analysis completed with no findings.');
        } catch (error: any) {
            setAnalysis(`ERR: Analysis failed. ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const triggerNewBuild = () => {
        const newBuild: Build = {
            id: `b${Date.now()}`,
            name: `v2.5.${builds.length}-beta`,
            size: '---',
            status: 'building',
            date: 'Right now',
            logs: '[00:00:01] Initiating new build instance...'
        };
        setBuilds([newBuild, ...builds]);
        setSelectedBuild(newBuild);
        
        // Simulate build process
        setTimeout(() => {
            setBuilds(prev => prev.map(b => b.id === newBuild.id ? { ...b, status: 'compiled', size: '4.3 MB', logs: b.logs + '\n[00:00:05] Build successful.' } : b));
            if (selectedBuild?.id === newBuild.id) {
                setSelectedBuild(prev => prev ? { ...prev, status: 'compiled', size: '4.3 MB', logs: prev.logs + '\n[00:00:05] Build successful.' } : null);
            }
        }, 5000);
    };

    return (
        <div className="h-full w-full bg-zinc-950 flex font-sans text-sm">
            {/* Sidebar List */}
            <div className="w-1/3 bg-zinc-900 border-r border-zinc-800 flex flex-col">
                <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-500 font-bold">
                        <HardDrive size={18} />
                        BuildVault
                    </div>
                    <button 
                        onClick={triggerNewBuild}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                        title="Trigger New Build"
                    >
                        <PlayCircle size={18} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {builds.map(build => (
                        <div 
                            key={build.id}
                            onClick={() => { setSelectedBuild(build); setAnalysis(''); }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedBuild?.id === build.id ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={`font-bold ${selectedBuild?.id === build.id ? 'text-amber-400' : 'text-zinc-200'}`}>
                                    {build.name}
                                </span>
                                <span className="text-[10px] text-zinc-500">{build.date}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <StatusIndicator status={build.status} />
                                    <span className="text-xs text-zinc-400 capitalize">{build.status}</span>
                                </div>
                                <span className="text-xs text-zinc-500 font-mono">{build.size}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Detail View */}
            <div className="flex-1 flex flex-col bg-zinc-950 relative">
                {selectedBuild ? (
                    <>
                        <div className="p-6 border-b border-zinc-800">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                                        {selectedBuild.name}
                                        <div className="text-xs px-2 py-0.5 rounded-full border bg-zinc-900 flex items-center gap-1.5 capitalize border-zinc-700 text-zinc-300">
                                            <StatusIndicator status={selectedBuild.status} />
                                            {selectedBuild.status}
                                        </div>
                                    </h2>
                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                        <span className="flex items-center gap-1"><Server size={14} /> Node: eu-west-2a</span>
                                        <span className="flex items-center gap-1"><Activity size={14} /> ID: {selectedBuild.id}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleAnalyze(selectedBuild)}
                                        disabled={isAnalyzing || selectedBuild.status === 'building'}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
                                    >
                                        <ShieldCheck size={14} />
                                        Analyze Health
                                    </button>
                                </div>
                            </div>
                            
                            {analysis && (
                                <div className="mt-4 p-4 bg-amber-950/30 border border-amber-900/50 rounded-xl">
                                    <h4 className="text-xs font-bold text-amber-500 uppercase mb-2 flex items-center gap-1.5">
                                        <Info size={14} /> AI Health Analysis
                                    </h4>
                                    <p className="text-sm text-amber-200 leading-relaxed">{analysis}</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 p-6 overflow-y-auto">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Raw Output Logs</h4>
                            <pre className="w-full bg-[#0d1117] border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-300 whitespace-pre-wrap">
                                {selectedBuild.logs}
                            </pre>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                        <HardDrive size={48} className="mb-4 opacity-20" />
                        <p>Select a build to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusIndicator = ({ status }: { status: Build['status'] }) => {
    switch (status) {
        case 'deployed': return <div className="w-2 h-2 rounded-full bg-emerald-500"></div>;
        case 'compiled': return <div className="w-2 h-2 rounded-full bg-blue-500"></div>;
        case 'failed': return <div className="w-2 h-2 rounded-full bg-red-500"></div>;
        case 'building': return <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>;
    }
}
