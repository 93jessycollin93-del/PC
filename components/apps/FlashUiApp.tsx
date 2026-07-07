import React, { useState } from 'react';
import { Zap, Code2, Play, Copy, Check, Loader2 } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

export const FlashUiApp: React.FC = () => {
    const [prompt, setPrompt] = useState('Generate a premium dark mode contact card');
    const [code, setCode] = useState('// Your component code will compile here');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setCode('// Compiling UI components based on directives...\n// Initiating Flash UI build process...');
        
        try {
            const ai = getAiClient();
            const fullPrompt = `Generate modern, beautiful React + Tailwind CSS code for the following UI request: "${prompt}". 
            Output ONLY the raw code for the React component without any markdown wrapping, explanations, or backticks. 
            Assume standard lucide-react icons are available. Use premium, modern styling (gradients, glassmorphism if appropriate).`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: fullPrompt,
                config: { temperature: 0.4 }
            });

            if (response.text) {
                // Strip markdown if the model accidentally included it
                let finalCode = response.text;
                if (finalCode.startsWith('```')) {
                    const lines = finalCode.split('\n');
                    if (lines.length > 2) {
                        lines.shift(); // remove first line
                        if (lines[lines.length-1].startsWith('```')) {
                            lines.pop(); // remove last line
                        }
                        finalCode = lines.join('\n');
                    }
                }
                setCode(finalCode.trim());
            }
        } catch (error: any) {
            setCode(`// ERR: Build failed\n// ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 flex items-center justify-center">
            <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 h-[600px]">
                
                {/* Editor Panel */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                    <div className="bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
                        <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            <Zap size={16} className="text-yellow-400" />
                            Flash UI Builder
                        </h4>
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-mono uppercase text-zinc-500 font-bold tracking-wider">UI Description Directive</label>
                            <textarea 
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                rows={4}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-yellow-500 font-sans resize-none transition-colors"
                                placeholder="Describe the UI component you want to build..."
                            />
                        </div>
                        
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                            <span>{isGenerating ? 'Synthesizing UI...' : 'Compile Component'}</span>
                        </button>

                        <div className="mt-auto p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                            <h5 className="text-xs font-bold text-zinc-400 mb-2 uppercase">Capabilities</h5>
                            <ul className="text-xs text-zinc-500 space-y-1">
                                <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Tailwind CSS V3 natively supported</li>
                                <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> React Hooks ready</li>
                                <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Lucide icons pre-imported</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Code View Panel */}
                <div className="bg-[#0d1117] border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
                    <div className="bg-[#161b22] border-b border-zinc-800 p-3 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            </div>
                            <span className="text-xs font-mono text-zinc-400 ml-2">GeneratedComponent.tsx</span>
                        </div>
                        <button 
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors"
                            title="Copy Code"
                        >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4">
                        <pre className="font-mono text-xs text-zinc-300 whitespace-pre leading-relaxed">
                            <code dangerouslySetInnerHTML={{ __html: highlightSyntax(code) }} />
                        </pre>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Simple syntax highlighter for basic TSX
function highlightSyntax(code: string) {
    if (!code) return '';
    return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\b(import|export|const|let|var|function|return|if|else|switch|case|default|break|continue|for|while|do|try|catch|finally|throw|new|class|extends|implements|interface|type)\b/g, '<span class="text-pink-400">$1</span>')
        .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-blue-400">$1</span>')
        .replace(/(['"`].*?['"`])/g, '<span class="text-green-300">$1</span>')
        .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span class="text-yellow-300">$1</span>')
        .replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="text-zinc-500">$1</span>');
}
