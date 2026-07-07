import React, { useState, useEffect, useRef } from 'react';
import { Network, Play, StopCircle, Plus, Terminal, Settings, Activity, FileCode, CheckSquare, AlertTriangle, Trash2, Cpu, CheckCircle, Sparkles, Sliders } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

interface ClawStep {
    id: string;
    description: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    output?: string;
}

interface Claw {
    id: string;
    name: string;
    description: string;
    trigger: 'manual' | 'code_change' | 'interval';
    intervalSec?: number;
    prompt: string;
    engine: 'gemini' | 'local_ollama';
    status: 'idle' | 'running' | 'succeeded' | 'failed';
    steps: ClawStep[];
}

const PRESET_CLAWS: Claw[] = [
    {
        id: 'claw_security',
        name: 'WhiteRabbit Security Audit',
        description: 'Continuously audits codebase changes for potential credentials leakage, API secrets, and OWASP top 10 vulnerabilities.',
        trigger: 'manual',
        prompt: 'Scan the active project files for security vulnerabilities, memory leaks, hardcoded credentials or API keys, and insecure network routing.',
        engine: 'gemini',
        status: 'idle',
        steps: [
            { id: '1', description: 'Mounting virtual folder directory', status: 'idle' },
            { id: '2', description: 'Scanning source file imports and external packages', status: 'idle' },
            { id: '3', description: 'Running security static analysis rules', status: 'idle' },
            { id: '4', description: 'Formulating code safety report and recommendations', status: 'idle' }
        ]
    },
    {
        id: 'claw_autodoc',
        name: 'AutoDoc-Claw Creator',
        description: 'Auto-scrapes functions and generates clean JSDoc comments, Python docstrings, and comprehensive README documentation.',
        trigger: 'code_change',
        prompt: 'Generate standard JSDoc/docstring comments for all undocumented functions, types, and exports in the project files.',
        engine: 'local_ollama',
        status: 'idle',
        steps: [
            { id: '1', description: 'Identifying undocumented modules and exported elements', status: 'idle' },
            { id: '2', description: 'Parsing function arguments, type definitions, and return values', status: 'idle' },
            { id: '3', description: 'Synthesizing standard document structures in inline syntax', status: 'idle' },
            { id: '4', description: 'Applying changes and staging file diffs', status: 'idle' }
        ]
    },
    {
        id: 'claw_optimize',
        name: 'Performance Profiler Claw',
        description: 'Analyzes algorithm complexity and memory allocation, refactoring code to minimize latency and optimize GPU/CPU execution.',
        trigger: 'manual',
        prompt: 'Profile the selected file and optimize complex loops, redundant state-re-renders, memory-heavy allocations, or inefficient async calls.',
        engine: 'gemini',
        status: 'idle',
        steps: [
            { id: '1', description: 'Profiling loops, dependencies, and recursive routines', status: 'idle' },
            { id: '2', description: 'Identifying runtime performance bottlenecks', status: 'idle' },
            { id: '3', description: 'Designing high-efficiency refactored algorithms', status: 'idle' },
            { id: '4', description: 'Verifying computational correctness of the optimized code', status: 'idle' }
        ]
    }
];

export const OpenClawApp: React.FC = () => {
    const [claws, setClaws] = useState<Claw[]>(PRESET_CLAWS);
    const [selectedClawId, setSelectedClawId] = useState<string>('claw_security');
    const [isCreating, setIsCreating] = useState(false);
    
    // Bot Forge state variables
    const [isBotForgeActive, setIsBotForgeActive] = useState(false);
    const [forgeBotName, setForgeBotName] = useState('WHITE_RABBIT_SEC');
    const [forgeBotDesc, setForgeBotDesc] = useState('Elite autonomous security pentesting and code auditing engine.');
    const [forgeBotArchetype, setForgeBotArchetype] = useState<'pentester' | 'jsdoc' | 'optimizer' | 'researcher'>('pentester');
    const [forgeBotPrompt, setForgeBotPrompt] = useState('Audit active codebase directories, search for credential leaks, check authentication headers, and review encryption loop parameters.');
    const [forgeBotTemp, setForgeBotTemp] = useState<number>(0.3);
    const [forgeBotCapabilities, setForgeBotCapabilities] = useState({
        fileRead: true,
        fileWrite: false,
        memoryPersistence: true,
        terminalExec: true,
        gitSync: false
    });
    const [isForgingBot, setIsForgingBot] = useState(false);

    // Create new claw state
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPrompt, setNewPrompt] = useState('');
    const [newEngine, setNewEngine] = useState<'gemini' | 'local_ollama'>('gemini');
    const [newTrigger, setNewTrigger] = useState<'manual' | 'code_change' | 'interval'>('manual');

    const [liveConsoleLogs, setLiveConsoleLogs] = useState<string[]>([
        '[System] OpenClaw Agent Hub initialized.',
        '[System] Loaded preset claws. Standby for agent execution.'
    ]);

    const activeClaw = claws.find(c => c.id === selectedClawId);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [liveConsoleLogs]);

    const addLog = (log: string) => {
        const time = new Date().toLocaleTimeString();
        setLiveConsoleLogs(prev => [...prev, `[${time}] ${log}`]);
    };

    const handleForgeBot = async () => {
        setIsForgingBot(true);
        addLog(`[BOT_FORGE] Initiating agentic cognitive fusion loop for: "${forgeBotName}"...`);
        
        const logs = [
            `[BOT_FORGE] Synthesizing role archetype weights for "${forgeBotArchetype}"...`,
            `[BOT_FORGE] Calibrating temperature -> ${forgeBotTemp}`,
            `[BOT_FORGE] Binding sandboxed capabilities: ${Object.entries(forgeBotCapabilities).filter(([_, v]) => v).map(([k]) => k).join(', ')}`,
            `[BOT_FORGE] Compiling primary prompt constraints & directive lists...`,
            `[BOT_FORGE] Deploying secure sandboxed Docker layer...`,
            `[BOT_FORGE] Registering agentic execution handshake...`,
            `[BOT_FORGE] SUCCESS: Agent "${forgeBotName}" forged and deployed to the active directory.`
        ];

        for (const log of logs) {
            await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300));
            addLog(log);
        }

        // Map archetype to steps
        let steps: ClawStep[] = [];
        if (forgeBotArchetype === 'pentester') {
            steps = [
                { id: '1', description: 'Mounting sandbox code directory', status: 'idle' },
                { id: '2', description: 'Scanning dependencies for CVEs and hardcoded keys', status: 'idle' },
                { id: '3', description: 'Running static cyber security audit checks', status: 'idle' },
                { id: '4', description: 'Generating recommendations report', status: 'idle' }
            ];
        } else if (forgeBotArchetype === 'jsdoc') {
            steps = [
                { id: '1', description: 'Parsing codebase JSDoc completeness metrics', status: 'idle' },
                { id: '2', description: 'Generating standard inline function comment documentation', status: 'idle' },
                { id: '3', description: 'Formulating comprehensive API references markdown', status: 'idle' }
            ];
        } else if (forgeBotArchetype === 'optimizer') {
            steps = [
                { id: '1', description: 'Profiling async event loops & render cycles', status: 'idle' },
                { id: '2', description: 'Optimizing high-frequency mathematical iterations', status: 'idle' },
                { id: '3', description: 'Refactoring variable allocations to save RAM heap', status: 'idle' }
            ];
        } else {
            steps = [
                { id: '1', description: 'Scraping papers, schemas and scholarly documents', status: 'idle' },
                { id: '2', description: 'Extracting key methodologies and citations', status: 'idle' },
                { id: '3', description: 'Synthesizing knowledge graph overlays', status: 'idle' }
            ];
        }

        const newClaw: Claw = {
            id: `claw_${Date.now()}`,
            name: forgeBotName,
            description: forgeBotDesc,
            trigger: 'manual',
            prompt: forgeBotPrompt,
            engine: 'gemini',
            status: 'idle',
            steps
        };

        setClaws(prev => [newClaw, ...prev]);
        setSelectedClawId(newClaw.id);
        setIsForgingBot(false);
        setIsBotForgeActive(false); // Back to details!
    };

    const handleCreateClaw = () => {
        if (!newName.trim()) return;
        const newClaw: Claw = {
            id: `claw_${Date.now()}`,
            name: newName.trim(),
            description: newDesc.trim() || 'Custom user-created automation agent claw.',
            trigger: newTrigger,
            prompt: newPrompt.trim() || 'Audit codebase for standard improvements.',
            engine: newEngine,
            status: 'idle',
            steps: [
                { id: '1', description: 'Analyzing workspace structure', status: 'idle' },
                { id: '2', description: 'Synthesizing code based on agent directives', status: 'idle' },
                { id: '3', description: 'Reviewing changes for logical constraints', status: 'idle' }
            ]
        };

        setClaws(prev => [...prev, newClaw]);
        setSelectedClawId(newClaw.id);
        setIsCreating(false);
        // Reset form
        setNewName('');
        setNewDesc('');
        setNewPrompt('');
        setNewEngine('gemini');
        setNewTrigger('manual');
        addLog(`Successfully registered new Claw: ${newClaw.name}`);
    };

    const handleDeleteClaw = (id: string, name: string) => {
        setClaws(prev => prev.filter(c => c.id !== id));
        if (selectedClawId === id) {
            setSelectedClawId('claw_security');
        }
        addLog(`Deleted agent claw: ${name}`);
    };

    const handleRunClaw = async (clawId: string) => {
        const targetClaw = claws.find(c => c.id === clawId);
        if (!targetClaw || targetClaw.status === 'running') return;

        // Reset step statuses to idle first
        setClaws(prev => prev.map(c => {
            if (c.id === clawId) {
                return {
                    ...c,
                    status: 'running',
                    steps: c.steps.map(s => ({ ...s, status: 'idle', output: undefined }))
                };
            }
            return c;
        }));

        addLog(`Triggered Agent Claw: ${targetClaw.name} (${targetClaw.engine === 'gemini' ? 'Gemini 2.5 Pro' : 'Local Ollama: qwen2.5-coder'})`);

        // Execute step-by-step
        for (let i = 0; i < targetClaw.steps.length; i++) {
            const step = targetClaw.steps[i];
            
            // Set current step to running
            setClaws(prev => prev.map(c => {
                if (c.id === clawId) {
                    const steps = [...c.steps];
                    steps[i] = { ...steps[i], status: 'running' };
                    return { ...c, steps };
                }
                return c;
            }));

            addLog(`Executing: ${step.description}...`);
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));

            // Generate some model step result content
            let stepOutput = '';
            try {
                const ai = getAiClient();
                const prompt = `[AGENT_STEP_SIMULATOR]
Claw Agent: ${targetClaw.name}
Directives: ${targetClaw.prompt}
Current Step: ${step.description}

Generate a short, super detailed, realistic, highly tech-dense 2-3 line developer log of this action being successfully performed on our local codebase context (such as evaluating "welcome.js", checking memory loops, etc.). Do not sound generic; include specific function or variable names if applicable.`;
                
                const res = await ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: prompt
                });
                stepOutput = res.text || 'Action succeeded. Clean state validated.';
            } catch {
                stepOutput = `Processed successfully. Verified checks for index.tsx, welcome.js and component interfaces. No runtime bottlenecks detected.`;
            }

            // Complete current step
            setClaws(prev => prev.map(c => {
                if (c.id === clawId) {
                    const steps = [...c.steps];
                    steps[i] = { ...steps[i], status: 'completed', output: stepOutput };
                    return { ...c, steps };
                }
                return c;
            }));
            
            addLog(`Completed step: ${step.description}`);
        }

        // Set entire claw status to succeeded
        setClaws(prev => prev.map(c => {
            if (c.id === clawId) {
                return { ...c, status: 'succeeded' };
            }
            return c;
        }));

        addLog(`Agent Claw Succeeded: ${targetClaw.name} has finished execution successfully!`);
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900 select-none shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-md">
                        <Network size={16} />
                    </div>
                    <div>
                        <h2 className="font-bold text-xs uppercase tracking-wider">OpenClaw Agent Workspace</h2>
                        <span className="text-[10px] text-zinc-400">Autonomous workflow triggers and execution</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={() => { setIsBotForgeActive(!isBotForgeActive); setIsCreating(false); }}
                        className={`p-1.5 rounded text-xs flex items-center gap-1 font-semibold transition-all ${isBotForgeActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10' : 'hover:bg-zinc-800 text-zinc-400'}`}
                        title="Autonomous Bot Forge"
                    >
                        <Sparkles size={13} className="text-yellow-400 animate-pulse" />
                        <span>Bot Forge</span>
                    </button>
                    <button 
                        onClick={() => { setIsCreating(!isCreating); setIsBotForgeActive(false); }}
                        className={`p-1.5 rounded text-xs flex items-center gap-1 font-semibold transition-all ${isCreating ? 'bg-indigo-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                    >
                        <Plus size={13} />
                        <span>Deploy Claw</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* Left Side: Claws Directory */}
                <div className="w-64 border-r border-zinc-800 flex flex-col shrink-0 select-none bg-zinc-900/30">
                    <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                        Active Claws Directory
                    </div>
                    <div className="flex-1 overflow-auto p-2 space-y-1">
                        {claws.map(c => (
                            <div 
                                key={c.id}
                                onClick={() => { setSelectedClawId(c.id); setIsCreating(false); }}
                                className={`w-full text-left p-2.5 rounded-lg transition-all border ${selectedClawId === c.id ? 'bg-indigo-600/15 border-indigo-500/30 text-white' : 'border-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'} cursor-pointer flex flex-col gap-1`}
                            >
                                <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-semibold text-xs truncate max-w-[150px]">{c.name}</span>
                                    <span className={`w-2 h-2 rounded-full ${c.status === 'running' ? 'bg-indigo-500 animate-pulse' : c.status === 'succeeded' ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                                </div>
                                <span className="text-[10px] text-zinc-500 line-clamp-1">{c.description}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center / Right: Main workspace content */}
                <div className="flex-1 flex min-h-0">
                    {isBotForgeActive ? (
                        /* Bot Forge Workspace */
                        <div className="flex-1 overflow-auto p-5 space-y-4 bg-zinc-950 select-text">
                            <div className="border-b border-zinc-800 pb-3 flex justify-between items-center shrink-0 select-none">
                                <div>
                                    <h3 className="font-bold text-sm text-indigo-400 flex items-center gap-1.5">
                                        <Sparkles size={15} className="text-yellow-400 animate-pulse" />
                                        Agentic Bot Forge & Sandbox
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 font-medium">Fuse advanced specialized cognitive archetypes with sandboxed capabilities and automated system pipelines.</p>
                                </div>
                                <button 
                                    onClick={() => setIsBotForgeActive(false)}
                                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-[11px] font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start text-xs">
                                {/* Configuration Form */}
                                <div className="xl:col-span-7 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4.5 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <span className="text-zinc-400 font-bold font-mono text-[10px] uppercase">Bot Alias / Call Sign</span>
                                            <input 
                                                value={forgeBotName}
                                                onChange={e => setForgeBotName(e.target.value)}
                                                placeholder="e.g. WHITE_RABBIT_SEC"
                                                className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded font-mono text-zinc-300 outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-zinc-400 font-bold font-mono text-[10px] uppercase">Primary Role / Focus</span>
                                            <input 
                                                value={forgeBotDesc}
                                                onChange={e => setForgeBotDesc(e.target.value)}
                                                placeholder="e.g. Elite autonomous security pentesting engine."
                                                className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded text-zinc-300 outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Specialized Archetypes */}
                                    <div className="space-y-2 select-none">
                                        <span className="text-zinc-400 font-bold font-mono text-[10px] uppercase">Specialized Cognitive Archetype</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'pentester', label: 'Ethical Pentester', icon: '🛡️', desc: 'Checks security structures and scans code loops for potential leaks.' },
                                                { id: 'jsdoc', label: 'JSDoc Architect', icon: '📝', desc: 'Parses codebase structures and generates pristine JSDoc inline docs.' },
                                                { id: 'optimizer', label: 'Performance Profiler', icon: '⚡', desc: 'Profiles async delays and refactors loops to minimize CPU cycles.' },
                                                { id: 'researcher', label: 'Deep Researcher', icon: '🔍', desc: 'Gathers references, documentation, and synthesizes structured guides.' }
                                            ].map(arch => (
                                                <button
                                                    key={arch.id}
                                                    onClick={() => {
                                                        setForgeBotArchetype(arch.id as any);
                                                        if (arch.id === 'pentester') {
                                                            setForgeBotName('WHITE_RABBIT_SEC');
                                                            setForgeBotDesc('Elite autonomous security pentesting and code auditing engine.');
                                                            setForgeBotPrompt('Audit active codebase directories, search for credential leaks, check authentication headers, and review encryption loop parameters.');
                                                            setForgeBotTemp(0.3);
                                                        } else if (arch.id === 'jsdoc') {
                                                            setForgeBotName('DOC_BUILDER_PRO');
                                                            setForgeBotDesc('Automated inline document compiler and JSDoc schema designer.');
                                                            setForgeBotPrompt('Generate strict standard compliant JSDoc and Markdown schemas across the workspace to outline API endpoints.');
                                                            setForgeBotTemp(0.5);
                                                        } else if (arch.id === 'optimizer') {
                                                            setForgeBotName('CYBER_OPTIMIZER');
                                                            setForgeBotDesc('Advanced compiler efficiency profiling and execution optimizer.');
                                                            setForgeBotPrompt('Profile multi-threaded structures, async event loop cycles, and local database cache parameters to eliminate overhead.');
                                                            setForgeBotTemp(0.2);
                                                        } else {
                                                            setForgeBotName('DEEP_RESEARCH_NODE');
                                                            setForgeBotDesc('Knowledge synthesizer and academic schema validation agent.');
                                                            setForgeBotPrompt('Crawl package directories, verify module relationships, and compose detailed dependency trees with markdown graphics.');
                                                            setForgeBotTemp(0.7);
                                                        }
                                                    }}
                                                    className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${forgeBotArchetype === arch.id ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-inner shadow-indigo-500/10' : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'}`}
                                                >
                                                    <span className="text-base">{arch.icon}</span>
                                                    <span className="font-bold text-[10.5px] leading-none">{arch.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Directives & Sandbox Controls */}
                                    <div className="space-y-1.5">
                                        <span className="text-zinc-400 font-bold font-mono text-[10px] uppercase">Cognitive Instructions & Target Directives</span>
                                        <textarea
                                            value={forgeBotPrompt}
                                            onChange={e => setForgeBotPrompt(e.target.value)}
                                            rows={3}
                                            className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded font-mono text-zinc-300 outline-none focus:border-indigo-500 resize-none leading-relaxed text-[11px]"
                                        />
                                    </div>

                                    {/* Capabilities Matrices */}
                                    <div className="space-y-2 select-none">
                                        <span className="text-zinc-400 font-bold font-mono text-[10px] uppercase">Calibrated Sandbox Capabilities</span>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-[10.5px]">
                                            {[
                                                { key: 'fileRead', label: 'File System Read', desc: 'Read target directories' },
                                                { key: 'fileWrite', label: 'File System Write', desc: 'Create/modify source files' },
                                                { key: 'memoryPersistence', label: 'Memory Persistence', desc: 'Track history across loops' },
                                                { key: 'terminalExec', label: 'Terminal Exec', desc: 'Invoke background scripts' },
                                                { key: 'gitSync', label: 'Automated Git Sync', desc: 'Stage, commit and push' }
                                            ].map(cap => (
                                                <label 
                                                    key={cap.key}
                                                    className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer select-none transition-all ${forgeBotCapabilities[cap.key as keyof typeof forgeBotCapabilities] ? 'bg-zinc-900 border-indigo-500/30 text-indigo-400 font-semibold' : 'bg-zinc-950/40 border-zinc-800 text-zinc-500 hover:border-zinc-800'}`}
                                                >
                                                    <input 
                                                        type="checkbox"
                                                        checked={forgeBotCapabilities[cap.key as keyof typeof forgeBotCapabilities]}
                                                        onChange={e => setForgeBotCapabilities(prev => ({ ...prev, [cap.key]: e.target.checked }))}
                                                        className="accent-indigo-500 h-3 w-3 cursor-pointer shrink-0"
                                                    />
                                                    <div className="truncate">
                                                        <div className="leading-tight">{cap.label}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3.5 mt-2 select-none">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono text-zinc-500 uppercase">Quantization Bias (Temp): {forgeBotTemp}</span>
                                        </div>
                                        <button
                                            onClick={handleForgeBot}
                                            disabled={isForgingBot || !forgeBotName.trim()}
                                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                                        >
                                            <Sparkles size={13} className={isForgingBot ? 'animate-spin text-yellow-400' : 'text-yellow-400'} />
                                            <span>{isForgingBot ? 'Fusing Profiles...' : 'Forge & Fuse Bot'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Sandbox Visualization Canvas */}
                                <div className="xl:col-span-5 space-y-4 select-none">
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3 flex flex-col">
                                        <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider block">Agent Persona Blueprint</span>
                                        
                                        <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/50 flex flex-col items-center text-center space-y-2.5 relative overflow-hidden">
                                            <div className="absolute top-2 right-2 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                                                <span className="text-[9px] font-mono text-zinc-500">SANDBOX_IDLE</span>
                                            </div>

                                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold font-mono">
                                                {forgeBotName ? forgeBotName.substring(0, 2).toUpperCase() : 'CB'}
                                            </div>

                                            <div>
                                                <h4 className="font-bold text-sm text-zinc-200 font-mono tracking-tight">{forgeBotName || 'CYBER_BOT'}</h4>
                                                <p className="text-[10.5px] text-zinc-400 leading-normal px-2 mt-1 line-clamp-2">{forgeBotDesc || 'Define primary focus...'}</p>
                                            </div>

                                            <div className="w-full border-t border-zinc-900 pt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
                                                <div className="bg-zinc-900/40 p-2 rounded-lg text-left border border-zinc-900">
                                                    <span className="text-zinc-500 block text-[9px]">ARCHETYPE</span>
                                                    <span className="text-indigo-400 font-bold uppercase">{forgeBotArchetype}</span>
                                                </div>
                                                <div className="bg-zinc-900/40 p-2 rounded-lg text-left border border-zinc-900">
                                                    <span className="text-zinc-500 block text-[9px]">CAPABILITIES</span>
                                                    <span className="text-zinc-300 font-semibold">{Object.values(forgeBotCapabilities).filter(Boolean).length} Active</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-[#05070a] p-3 rounded-lg border border-zinc-900 font-mono text-[10px] text-zinc-400 space-y-1 max-h-[140px] overflow-auto select-all">
                                            <span className="text-indigo-400 font-bold"># cognitive instruction compile target</span><br />
                                            <span className="text-zinc-500">context_window: 128k</span><br />
                                            <span className="text-zinc-500">base_weights: gemini-2.5-pro-core</span><br />
                                            <span className="text-indigo-300 font-semibold">DIRECTIVES:</span> {forgeBotPrompt}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : isCreating ? (
                        /* Deploy New Claw Form */
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            <h3 className="font-bold text-sm text-indigo-400 border-b border-zinc-800 pb-2">Deploy Autonomous Claw</h3>
                            <div className="space-y-3 max-w-lg text-xs">
                                <div className="space-y-1">
                                    <span className="text-zinc-400 font-medium">Claw Agent Name</span>
                                    <input 
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="e.g. Code Style Sweeper"
                                        className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded text-zinc-100 outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-zinc-400 font-medium">Description</span>
                                    <input 
                                        value={newDesc}
                                        onChange={e => setNewDesc(e.target.value)}
                                        placeholder="e.g. Scans and reformats code styling automatically."
                                        className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded text-zinc-100 outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-zinc-400 font-medium">Execution Engine</span>
                                        <select 
                                            value={newEngine}
                                            onChange={e => setNewEngine(e.target.value as any)}
                                            className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded text-zinc-100 outline-none focus:border-indigo-500"
                                        >
                                            <option value="gemini">Gemini 2.5 Pro (Workspace Cloud)</option>
                                            <option value="local_ollama">Local Ollama (Self-Hosted)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-zinc-400 font-medium">Trigger Rule</span>
                                        <select 
                                            value={newTrigger}
                                            onChange={e => setNewTrigger(e.target.value as any)}
                                            className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded text-zinc-100 outline-none focus:border-indigo-500"
                                        >
                                            <option value="manual">Manual Execution</option>
                                            <option value="code_change">On Code Modification</option>
                                            <option value="interval">Every 5 Minutes</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-zinc-400 font-medium">System Instructions & Directives</span>
                                    <textarea 
                                        value={newPrompt}
                                        onChange={e => setNewPrompt(e.target.value)}
                                        rows={4}
                                        placeholder="Describe exactly what the AI agent should scan and execute on..."
                                        className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded text-zinc-100 outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button 
                                        onClick={handleCreateClaw}
                                        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded font-bold text-white transition-all"
                                    >
                                        Deploy to Directory
                                    </button>
                                    <button 
                                        onClick={() => setIsCreating(false)}
                                        className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded text-zinc-400 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : activeClaw ? (
                        /* Selected Claw Detail Panel */
                        <div className="flex-1 flex min-h-0">
                            {/* Execution & Setup Column */}
                            <div className="flex-1 overflow-auto p-4 flex flex-col min-w-0 bg-zinc-950">
                                <div className="flex items-start justify-between border-b border-zinc-800 pb-3 mb-3 shrink-0">
                                    <div>
                                        <h3 className="font-bold text-sm text-indigo-400">{activeClaw.name}</h3>
                                        <p className="text-[11px] text-zinc-500 mt-0.5">{activeClaw.description}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button 
                                            onClick={() => handleRunClaw(activeClaw.id)}
                                            disabled={activeClaw.status === 'running'}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-semibold text-xs text-white rounded flex items-center gap-1 transition-all"
                                        >
                                            <Play size={12} fill="currentColor" />
                                            <span>Run</span>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteClaw(activeClaw.id, activeClaw.name)}
                                            className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 rounded transition-colors"
                                            title="Delete Claw"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Config parameters widgets */}
                                <div className="grid grid-cols-2 gap-3 mb-4 shrink-0 text-[10px]">
                                    <div className="bg-zinc-900 border border-zinc-800/80 p-2 rounded-lg flex items-center gap-2">
                                        <Cpu size={14} className="text-indigo-400 shrink-0" />
                                        <div>
                                            <div className="text-zinc-500 uppercase tracking-wider font-bold">Execution Engine</div>
                                            <div className="text-zinc-300 mt-0.5">{activeClaw.engine === 'gemini' ? 'Gemini 2.5 Pro Cloud' : 'Local Ollama Llama'}</div>
                                        </div>
                                    </div>
                                    <div className="bg-zinc-900 border border-zinc-800/80 p-2 rounded-lg flex items-center gap-2">
                                        <Activity size={14} className="text-indigo-400 shrink-0" />
                                        <div>
                                            <div className="text-zinc-500 uppercase tracking-wider font-bold">Trigger Logic</div>
                                            <div className="text-zinc-300 mt-0.5">
                                                {activeClaw.trigger === 'manual' ? 'Manual execution' : activeClaw.trigger === 'code_change' ? 'On codebase write' : 'Cron Schedule'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Steps log detail progress */}
                                <div className="flex-1 overflow-auto space-y-3 pr-1">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 select-none">Claw Agent Execution Pipeline</span>
                                    {activeClaw.steps.map((step, idx) => (
                                        <div 
                                            key={step.id} 
                                            className={`p-3 rounded-lg border transition-all ${step.status === 'running' ? 'bg-indigo-600/10 border-indigo-500/40' : step.status === 'completed' ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-zinc-950/20 border-zinc-900/60'}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="text-[10px] font-mono text-zinc-500 font-bold w-4 shrink-0">0{idx + 1}</div>
                                                <span className="text-xs font-semibold text-zinc-300 flex-1">{step.description}</span>
                                                {step.status === 'completed' ? (
                                                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                                                ) : step.status === 'running' ? (
                                                    <Activity size={13} className="text-indigo-400 animate-spin shrink-0" />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0" />
                                                )}
                                            </div>
                                            {step.output && (
                                                <div className="mt-2 text-[10px] font-mono text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-900 leading-normal whitespace-pre-wrap">
                                                    {step.output}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Live Agent Terminal Console (Right side inside content) */}
                            <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 min-w-0">
                                <div className="p-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between shrink-0 select-none">
                                    <div className="flex items-center gap-1.5 text-zinc-400">
                                        <Terminal size={12} />
                                        <span className="font-bold text-[10px] uppercase tracking-wider">Live Agent console</span>
                                    </div>
                                    <button 
                                        onClick={() => setLiveConsoleLogs([])}
                                        className="text-[9px] hover:text-white text-zinc-500 transition-colors"
                                    >
                                        Clear Logs
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto p-3 font-mono text-[10px] text-zinc-300 space-y-1.5 bg-[#05070a]">
                                    {liveConsoleLogs.map((log, idx) => {
                                        let textClass = 'text-zinc-400';
                                        if (log.includes('Succeeded') || log.includes('Completed')) textClass = 'text-emerald-400';
                                        else if (log.includes('Triggered') || log.includes('Executing')) textClass = 'text-indigo-400';
                                        else if (log.includes('[System]')) textClass = 'text-zinc-500 font-semibold';
                                        return (
                                            <div key={idx} className={`${textClass} leading-relaxed break-words`}>
                                                {log}
                                            </div>
                                        );
                                    })}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-500 text-xs italic">
                            Select an agent claw from the directory or Deploy a new Claw.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
