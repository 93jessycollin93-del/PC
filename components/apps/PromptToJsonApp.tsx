import React, { useState } from 'react';
import { Braces, RefreshCw, Sparkles, Copy, Check } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { Type } from '@google/genai';

export const PromptToJsonApp: React.FC = () => {
    const [jsonPrompt, setJsonPrompt] = useState('Create a cyberpunk space explorer profile with inventory');
    const [compiledJson, setCompiledJson] = useState('{\n  "metadata": "Input a prompt to generate structure"\n}');
    const [isCompilingJson, setIsCompilingJson] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCompileJson = async () => {
        if (!jsonPrompt.trim()) return;
        setIsCompilingJson(true);
        setCompiledJson('Generating schema and compiling JSON...');
        
        try {
            const ai = getAiClient();
            
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: `Generate a detailed, deeply nested JSON data structure based on this prompt: "${jsonPrompt}". Output raw JSON only. Do not wrap in markdown tags like \`\`\`json. Make it highly detailed and imaginative.`,
                config: {
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            });

            if (response.text) {
                try {
                    const parsed = JSON.parse(response.text);
                    setCompiledJson(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    setCompiledJson(response.text);
                }
            } else {
                setCompiledJson('{\n  "error": "Failed to generate JSON"\n}');
            }
        } catch (error: any) {
            setCompiledJson(JSON.stringify({ error: error.message }, null, 2));
        } finally {
            setIsCompilingJson(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(compiledJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 flex flex-col justify-start">
            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                        <Braces size={16} className="text-purple-400" />
                        Prompt to Structured JSON
                    </h4>
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase text-zinc-500">Image/Scene Prompt Description</span>
                        <textarea 
                            value={jsonPrompt}
                            onChange={e => setJsonPrompt(e.target.value)}
                            rows={6}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-purple-500 font-sans resize-none"
                            placeholder="Describe what data structure you want to generate..."
                        />
                    </div>
                    <button 
                        onClick={handleCompileJson}
                        disabled={isCompilingJson || !jsonPrompt.trim()}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
                    >
                        {isCompilingJson ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        <span>{isCompilingJson ? 'Compiling Schema...' : 'Synthesize Detailed JSON'}</span>
                    </button>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col h-[500px] shadow-xl relative group">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider">Compiled JSON Document Output</span>
                        <button 
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                    </div>
                    <pre className="flex-1 bg-black/40 p-4 rounded-xl border border-zinc-800/60 font-mono text-xs text-purple-300 overflow-auto whitespace-pre-wrap break-words leading-relaxed">
                        {compiledJson}
                    </pre>
                </div>
            </div>
        </div>
    );
};
