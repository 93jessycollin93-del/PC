import React, { useState } from 'react';
import { Box, Cpu, Sparkles, Loader2, Play, Terminal, HelpCircle, Clipboard, Check, Code, Settings, MessageSquare, Zap, Activity } from 'lucide-react';
import { getAiClient } from '../../lib/gemini';

interface PresetMechanic {
    name: string;
    description: string;
    category: 'Blueprint' | 'C++' | 'Shader' | 'Optimization';
}

export const UnrealEngineApp: React.FC = () => {
    const [prompt, setPrompt] = useState('Create a double jump mechanism with air control');
    const [selectedCategory, setSelectedCategory] = useState<'blueprint' | 'cpp' | 'shader' | 'optimization'>('blueprint');
    const [isLoading, setIsLoading] = useState(false);
    
    // AI Response Content
    const [generatedTitle, setGeneratedTitle] = useState('Double Jump Mechanism');
    const [generatedGuide, setGeneratedGuide] = useState('Select a preset below or enter a custom game mechanics prompt to generate blueprint networks, HLSL materials, and C++ modules.');
    const [generatedCode, setGeneratedCode] = useState('');
    const [copied, setCopied] = useState(false);

    const presets: PresetMechanic[] = [
        { name: 'Double Jump with Air Control', description: 'Blueprint logic handling Jump counts and custom launch velocity.', category: 'Blueprint' },
        { name: 'Interactive Health HUD Component', description: 'C++ actor component that broadcasts damage events to UMG widgets.', category: 'C++' },
        { name: 'Procedural Lava Flow Material', description: 'HLSL pixel shader generating dynamic noise driven waves.', category: 'Shader' },
        { name: 'Draw Call & Nanite Profiling', description: 'Optimization checklist for high density static mesh pipelines.', category: 'Optimization' }
    ];

    const handleGenerate = async (customPrompt?: string) => {
        const finalPrompt = customPrompt || prompt;
        if (!finalPrompt.trim()) return;
        setIsLoading(true);
        try {
            const ai = getAiClient();
            const formatInstruction = {
                blueprint: 'Create a structured visual node connections guide ("Unreal Blueprint Guide") with a step-by-step description of Variable states, Input events, and Execution nodes, plus the equivalent Blueprint Node pseudocode.',
                cpp: 'Create a fully formatted, complete Unreal Engine C++ header (.h) and implementation (.cpp) file utilizing standard UE5 macros (UCLASS, GENERATED_BODY, UPROPERTY, etc.).',
                shader: 'Create a highly optimized HLSL shader code block for custom material nodes, plus step-by-step instructions on setting up the Material Parameter collection in the material editor.',
                optimization: 'Create a technical, professional profile checklist, troubleshooting log, console variables configuration list (e.g. r.Nanite.MaxNodes), and optimization guide.'
            }[selectedCategory];

            const systemPrompt = `You are an elite Unreal Engine 5 Principal Technical Director.
The user wants to implement: "${finalPrompt}".
Target Category: ${selectedCategory}.
Action: ${formatInstruction}

Make sure to provide high-quality, professional, and directly usable game development code/guide.
Return your response structured cleanly. Separate the explanatory textual guide from the raw code/nodes.
Format:
[TITLE] Simple Name of implementation
[GUIDE] Detailed guide or node graph connections instructions.
[CODE] The raw C++ code, HLSL code, or Blueprint pseudocode.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: systemPrompt,
            });

            const rawText = res.text || '';
            
            // Extract sections
            let title = 'Unreal Engine AI Module';
            let guide = '';
            let code = '';

            const titleMatch = rawText.match(/\[TITLE\]([\s\S]*?)\[GUIDE\]/);
            const guideMatch = rawText.match(/\[GUIDE\]([\s\S]*?)\[CODE\]/);
            const codeMatch = rawText.match(/\[CODE\]([\s\S]*)$/);

            if (titleMatch) title = titleMatch[1].trim();
            if (guideMatch) guide = guideMatch[1].trim();
            if (codeMatch) code = codeMatch[1].trim();

            if (!guide && !code) {
                // Fallback parsing if formatting was missed
                guide = rawText;
            }

            setGeneratedTitle(title);
            setGeneratedGuide(guide);
            setGeneratedCode(code);
        } catch (e) {
            console.error(e);
            setGeneratedGuide('Error generating Unreal Engine mechanics code. Verify credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedCode || generatedGuide);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                    <Box className="text-purple-400 animate-pulse" size={18} />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-purple-400">Unreal Engine Pipeline Assistant</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex border border-zinc-800 rounded overflow-hidden text-[10px] font-mono">
                        {(['blueprint', 'cpp', 'shader', 'optimization'] as const).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2 py-1 uppercase ${selectedCategory === cat ? 'bg-purple-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                            >
                                {cat === 'cpp' ? 'C++' : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel: Mechanics Presets & Prompter */}
                <div className="w-80 border-r border-zinc-800 p-4 overflow-auto space-y-4 shrink-0 flex flex-col justify-between bg-zinc-950">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider mb-2">Editor Presets</h3>
                            <div className="space-y-2">
                                {presets.map((p, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setPrompt(p.name);
                                            setSelectedCategory(p.category.toLowerCase() as any);
                                            handleGenerate(p.name);
                                        }}
                                        className="bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 hover:border-purple-500/40 p-2.5 rounded-lg cursor-pointer transition-all text-left"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-[9px] text-purple-400 font-bold uppercase">{p.category}</span>
                                        </div>
                                        <h4 className="font-bold text-xs text-zinc-200 mt-1">{p.name}</h4>
                                        <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">{p.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Prompter */}
                    <div className="border-t border-zinc-800 pt-3">
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="Describe a gameplay mechanic, UCLASS variable set, custom shader, or profile script..."
                            rows={3}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-300 placeholder-zinc-500 outline-none focus:border-purple-500 resize-none"
                        />
                        <button
                            onClick={() => handleGenerate()}
                            disabled={isLoading}
                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-55 text-white text-xs font-mono font-bold py-2 rounded mt-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                            Compile Mechanics
                        </button>
                    </div>
                </div>

                {/* Right Panel: Code compilation & documentation viewport */}
                <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 p-4">
                    <div className="flex-1 flex flex-col min-h-0 space-y-4">
                        {/* Title bar */}
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <div>
                                <h3 className="font-bold text-sm text-purple-400 font-mono flex items-center gap-1.5">
                                    <Activity size={14} />
                                    {generatedTitle}
                                </h3>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">GENERATED PIPELINE ASSETS</p>
                            </div>
                            {(generatedCode || generatedGuide) && (
                                <button
                                    onClick={copyToClipboard}
                                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    {copied ? <Check size={12} className="text-green-400" /> : <Clipboard size={12} />}
                                    {copied ? 'Copied' : 'Copy All'}
                                </button>
                            )}
                        </div>

                        {/* Split output: Guide at the top, scrollable Code block at the bottom */}
                        <div className="flex-1 flex flex-col min-h-0 space-y-4 overflow-auto">
                            {/* Guide documentation */}
                            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 overflow-auto max-h-56">
                                <h4 className="text-[10px] font-mono uppercase text-zinc-400 font-bold mb-2 flex items-center gap-1">
                                    <MessageSquare size={10} />
                                    Implementation Guide & Nodes Graph
                                </h4>
                                {isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
                                        <Loader2 size={13} className="animate-spin text-purple-500" />
                                        <span>Reading Unreal blueprints dictionary...</span>
                                    </div>
                                ) : (
                                    <div className="text-xs text-zinc-300 leading-relaxed space-y-1.5">
                                        {generatedGuide.split('\n').map((line, idx) => (
                                            <p key={idx}>{line}</p>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Raw Code Editor / Node Graphs pseudocode */}
                            <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900 shrink-0">
                                    <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold flex items-center gap-1">
                                        <Code size={11} />
                                        Executable C++/HLSL/Blueprint Blocks
                                    </span>
                                </div>
                                <div className="flex-1 p-4 overflow-auto font-mono text-[11px] bg-zinc-950 text-indigo-300">
                                    {isLoading ? (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                            <Loader2 size={24} className="animate-spin text-purple-500 mb-2" />
                                            <span>Compiling script interfaces...</span>
                                        </div>
                                    ) : generatedCode ? (
                                        <pre className="whitespace-pre-wrap">{generatedCode}</pre>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                                            <Sparkles size={20} className="mb-2 text-zinc-700 animate-pulse" />
                                            <p className="max-w-xs leading-relaxed text-[11px]">Select a preset, configure, and compile to generate raw material/C++ codes.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
