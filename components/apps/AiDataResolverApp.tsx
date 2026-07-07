import React, { useState } from 'react';
import { Database, FileJson, ArrowRight, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

export const AiDataResolverApp: React.FC = () => {
    const [datasetA, setDatasetA] = useState('{\n  "userId": "1042",\n  "name": "William R.",\n  "status": "active",\n  "lastPayment": "failed"\n}');
    const [datasetB, setDatasetB] = useState('{\n  "id": "1042",\n  "fullName": "William Robert",\n  "account_state": "suspended",\n  "card_status": "expired"\n}');
    const [resolutionRules, setResolutionRules] = useState('Merge records. B is more recent for billing, A is more recent for profile.');
    
    const [resolvedData, setResolvedData] = useState<string>('// Resolved output will appear here');
    const [isResolving, setIsResolving] = useState(false);

    const handleResolve = async () => {
        setIsResolving(true);
        setResolvedData('// Analyzing schema structures...\n// Computing merge strategies...');
        
        try {
            const ai = getAiClient();
            const prompt = `You are an AI Data Resolver. Your job is to take two conflicting JSON data structures and merge them into a single, clean, cohesive JSON structure according to the provided resolution rules.
            Output ONLY the resolved raw JSON data. Do not include markdown blocks.
            
            Dataset A:
            ${datasetA}
            
            Dataset B:
            ${datasetB}
            
            Resolution Rules / Context:
            ${resolutionRules}`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: { temperature: 0.1, responseMimeType: "application/json" }
            });

            if (response.text) {
                try {
                    const parsed = JSON.parse(response.text);
                    setResolvedData(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    setResolvedData(response.text);
                }
            }
        } catch (error: any) {
            setResolvedData(`// ERR: Conflict resolution failed.\n// ${error.message}`);
        } finally {
            setIsResolving(false);
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 flex items-center justify-center">
            <div className="max-w-6xl mx-auto w-full h-[650px] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                
                <div className="bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <Database size={16} className="text-emerald-400" />
                        AI Data Resolver
                    </h4>
                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                        <Layers size={14} /> Schema Merge Engine Active
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Inputs */}
                    <div className="w-full md:w-1/2 flex flex-col border-r border-zinc-800">
                        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase text-emerald-500 font-bold tracking-wider flex justify-between items-center">
                                    <span>Dataset A (Legacy / Origin)</span>
                                    <FileJson size={12} />
                                </label>
                                <textarea 
                                    value={datasetA}
                                    onChange={e => setDatasetA(e.target.value)}
                                    className="w-full h-32 bg-[#0d1117] border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 font-mono resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase text-emerald-500 font-bold tracking-wider flex justify-between items-center">
                                    <span>Dataset B (Incoming / Delta)</span>
                                    <FileJson size={12} />
                                </label>
                                <textarea 
                                    value={datasetB}
                                    onChange={e => setDatasetB(e.target.value)}
                                    className="w-full h-32 bg-[#0d1117] border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 font-mono resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-wider">Resolution Heuristics / Rules</label>
                                <textarea 
                                    value={resolutionRules}
                                    onChange={e => setResolutionRules(e.target.value)}
                                    className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 font-sans resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-zinc-950 border-t border-zinc-800">
                            <button 
                                onClick={handleResolve}
                                disabled={isResolving || !datasetA || !datasetB}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                {isResolving ? <RefreshCw className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                                <span>{isResolving ? 'Resolving Conflicts...' : 'Merge & Resolve'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Output */}
                    <div className="w-full md:w-1/2 bg-[#0d1117] flex flex-col relative group">
                        <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CheckCircle2 size={12} /> Consolidated
                        </div>
                        <div className="p-4 border-b border-zinc-800/50">
                            <h5 className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider">Resolved Golden Record</h5>
                        </div>
                        <pre className="flex-1 p-6 font-mono text-xs text-emerald-200/90 overflow-auto leading-relaxed">
                            {resolvedData}
                        </pre>
                    </div>
                </div>
                
            </div>
        </div>
    );
};
