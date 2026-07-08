import React, { useState, useEffect } from 'react';
import { Cpu, Plus, Trash2, Play, Square, ChevronRight, Settings, HardDrive, Zap, Code, AlertCircle, CheckCircle } from 'lucide-react';

interface SmallAgent {
    id: string;
    name: string;
    role: 'coder' | 'architect' | 'visualizer' | 'archivist' | 'security';
    systemPrompt: string;
    status: 'idle' | 'running' | 'processing';
    estimatedMemoryMB: number;
    taskCount: number;
    lastTaskTime?: number;
}

const AGENT_TEMPLATES: Record<string, { name: string; role: SmallAgent['role']; prompt: string; memoryMB: number }> = {
    coder: {
        name: 'Code Coder',
        role: 'coder',
        prompt: `You are a specialized coding agent. Your sole purpose is to:
- Write clean, functional code
- Fix bugs in existing code
- Suggest optimizations
- Explain code logic clearly

Keep responses focused, concise, and code-first. You know Python, JavaScript, TypeScript, and Shell.`,
        memoryMB: 12,
    },
    architect: {
        name: 'System Architect',
        role: 'architect',
        prompt: `You are a system architect. Your role is to:
- Design system architecture and data flows
- Review and improve existing designs
- Ensure alignment with requirements
- Identify architectural issues

Be precise, think in diagrams, focus on clarity and scalability.`,
        memoryMB: 15,
    },
    visualizer: {
        name: 'Visualizer',
        role: 'visualizer',
        prompt: `You are a visualization and UI specialist. Your focus:
- Design visual layouts and user flows
- Suggest UI/UX improvements
- Create ASCII diagrams and mockups
- Explain visual concepts

Be creative but practical.`,
        memoryMB: 10,
    },
    archivist: {
        name: 'Knowledge Archivist',
        role: 'archivist',
        prompt: `You are a knowledge archivist. Your responsibilities:
- Document important decisions and rationales
- Maintain knowledge consistency
- Create summaries and references
- Organize information hierarchically

Be thorough, structured, and comprehensive.`,
        memoryMB: 14,
    },
    security: {
        name: 'Security Supervisor',
        role: 'security',
        prompt: `You are a security supervisor. Your focus:
- Identify potential security vulnerabilities
- Review access controls and permissions
- Suggest security best practices
- Audit code for common exploits

Be strict, paranoid, and thorough.`,
        memoryMB: 11,
    },
};

export const SmallAgentFleetApp: React.FC = () => {
    const [agents, setAgents] = useState<SmallAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [taskInput, setTaskInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Load agents from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('small_agent_fleet');
        if (saved) {
            try {
                setAgents(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load agents:', e);
            }
        }
    }, []);

    // Persist agents to localStorage
    useEffect(() => {
        localStorage.setItem('small_agent_fleet', JSON.stringify(agents));
    }, [agents]);

    const createAgent = (template: keyof typeof AGENT_TEMPLATES) => {
        const tmpl = AGENT_TEMPLATES[template];
        const newAgent: SmallAgent = {
            id: `agent_${Date.now()}`,
            name: tmpl.name,
            role: tmpl.role,
            systemPrompt: tmpl.prompt,
            status: 'idle',
            estimatedMemoryMB: tmpl.memoryMB,
            taskCount: 0,
        };
        setAgents([...agents, newAgent]);
        setSelectedAgent(newAgent.id);
    };

    const deleteAgent = (id: string) => {
        setAgents(agents.filter(a => a.id !== id));
        if (selectedAgent === id) setSelectedAgent(null);
    };

    const runTask = async (agentId: string, task: string) => {
        if (!task.trim()) return;

        const agent = agents.find(a => a.id === agentId);
        if (!agent) return;

        setIsProcessing(true);
        setAgents(agents.map(a => a.id === agentId ? { ...a, status: 'processing' } : a));

        try {
            // In a real implementation, this would call Ollama or a cloud LLM
            // For now, simulate processing
            await new Promise(resolve => setTimeout(resolve, 1000));

            setAgents(agents.map(a =>
                a.id === agentId
                    ? { ...a, status: 'idle', taskCount: a.taskCount + 1, lastTaskTime: Date.now() }
                    : a
            ));

            setTaskInput('');
        } finally {
            setIsProcessing(false);
        }
    };

    const totalMemoryMB = agents.reduce((sum, a) => sum + a.estimatedMemoryMB, 0);
    const activeAgents = agents.filter(a => a.status !== 'idle').length;

    return (
        <div className="h-full w-full bg-[#09090b] text-slate-300 font-sans flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800/80 bg-[#0f1115] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Cpu size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-200">Small Agent Fleet</h1>
                        <p className="text-[10px] text-slate-500">{totalMemoryMB} MB • {agents.length} agents</p>
                    </div>
                </div>
                <div className="text-xs text-zinc-400">
                    Active: <span className="text-emerald-400 font-bold">{activeAgents}</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Agent List */}
                <div className="w-64 border-r border-zinc-800/80 bg-[#0c0e12] overflow-y-auto flex flex-col">
                    {/* Memory Bar */}
                    <div className="p-3 border-b border-zinc-800/50 space-y-2">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase">Memory Budget</div>
                        <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.min(100, (totalMemoryMB / 200) * 100)}%` }}
                            />
                        </div>
                        <div className="text-xs text-zinc-500 flex justify-between">
                            <span>{totalMemoryMB} MB used</span>
                            <span className="text-emerald-400">200 MB max</span>
                        </div>
                    </div>

                    {/* Agent List */}
                    <div className="flex-1 overflow-y-auto space-y-2 p-3">
                        {agents.length === 0 ? (
                            <div className="text-xs text-zinc-500 text-center py-8">
                                No agents. Create one below.
                            </div>
                        ) : (
                            agents.map(agent => (
                                <div
                                    key={agent.id}
                                    onClick={() => setSelectedAgent(agent.id)}
                                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                                        selectedAgent === agent.id
                                            ? 'bg-emerald-950/30 border-emerald-500/50'
                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex-1">
                                            <h4 className="text-xs font-bold text-white">{agent.name}</h4>
                                            <p className="text-[10px] text-zinc-500">{agent.role}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {agent.status === 'processing' ? (
                                                <Zap size={12} className="text-orange-400 animate-pulse" />
                                            ) : agent.status === 'running' ? (
                                                <Zap size={12} className="text-emerald-400" />
                                            ) : (
                                                <CheckCircle size={12} className="text-zinc-600" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[9px] text-zinc-500 flex justify-between">
                                        <span>{agent.estimatedMemoryMB} MB</span>
                                        <span>{agent.taskCount} tasks</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Create Agent Buttons */}
                    <div className="p-3 border-t border-zinc-800/50 space-y-1.5">
                        <div className="text-[9px] font-bold text-zinc-500 uppercase mb-2">New Agent</div>
                        <button
                            onClick={() => createAgent('coder')}
                            className="w-full px-2 py-1.5 text-xs font-semibold bg-blue-900/40 hover:bg-blue-900 text-blue-300 rounded transition-colors"
                        >
                            <Code size={12} className="inline mr-1" />
                            Coder
                        </button>
                        <button
                            onClick={() => createAgent('architect')}
                            className="w-full px-2 py-1.5 text-xs font-semibold bg-purple-900/40 hover:bg-purple-900 text-purple-300 rounded transition-colors"
                        >
                            Architect
                        </button>
                        <button
                            onClick={() => createAgent('visualizer')}
                            className="w-full px-2 py-1.5 text-xs font-semibold bg-cyan-900/40 hover:bg-cyan-900 text-cyan-300 rounded transition-colors"
                        >
                            Visualizer
                        </button>
                        <button
                            onClick={() => createAgent('archivist')}
                            className="w-full px-2 py-1.5 text-xs font-semibold bg-amber-900/40 hover:bg-amber-900 text-amber-300 rounded transition-colors"
                        >
                            Archivist
                        </button>
                        <button
                            onClick={() => createAgent('security')}
                            className="w-full px-2 py-1.5 text-xs font-semibold bg-red-900/40 hover:bg-red-900 text-red-300 rounded transition-colors"
                        >
                            Security
                        </button>
                    </div>
                </div>

                {/* Agent Detail & Task */}
                <div className="flex-1 flex flex-col bg-[#09090b]">
                    {selectedAgent && agents.find(a => a.id === selectedAgent) ? (
                        (() => {
                            const agent = agents.find(a => a.id === selectedAgent)!;
                            return (
                                <>
                                    {/* Agent Header */}
                                    <div className="p-4 border-b border-zinc-800/50 bg-[#0f1115]">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h2 className="text-lg font-bold text-white">{agent.name}</h2>
                                                <p className="text-xs text-zinc-400 mt-1">Role: {agent.role}</p>
                                            </div>
                                            <button
                                                onClick={() => deleteAgent(agent.id)}
                                                className="p-2 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-zinc-400 space-y-1">
                                            <div><span className="text-zinc-500">Memory:</span> {agent.estimatedMemoryMB} MB</div>
                                            <div><span className="text-zinc-500">Tasks:</span> {agent.taskCount}</div>
                                            <div><span className="text-zinc-500">Status:</span> <span className="text-emerald-400 font-mono">{agent.status}</span></div>
                                        </div>
                                    </div>

                                    {/* System Prompt */}
                                    <div className="p-4 border-b border-zinc-800/50 bg-zinc-950/50">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase mb-2">System Prompt</div>
                                        <div className="bg-zinc-900 border border-zinc-800 rounded p-2 text-[11px] text-zinc-300 font-mono max-h-20 overflow-y-auto whitespace-pre-wrap">
                                            {agent.systemPrompt}
                                        </div>
                                    </div>

                                    {/* Task Input */}
                                    <div className="flex-1 flex flex-col p-4">
                                        <textarea
                                            value={taskInput}
                                            onChange={(e) => setTaskInput(e.target.value)}
                                            placeholder="Describe a task for this agent..."
                                            disabled={isProcessing}
                                            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600 resize-none disabled:opacity-50"
                                        />
                                    </div>

                                    {/* Task Controls */}
                                    <div className="p-4 border-t border-zinc-800/50 bg-[#0f1115] flex gap-2">
                                        <button
                                            onClick={() => runTask(agent.id, taskInput)}
                                            disabled={isProcessing || !taskInput.trim()}
                                            className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Zap size={12} className="inline mr-1 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={12} className="inline mr-1" />
                                                    Run Task
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            );
                        })()
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-500">
                            <div className="text-center">
                                <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Select an agent to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
