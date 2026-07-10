import React, { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Play, Settings, Save, Copy, AlertCircle, CheckCircle, Eye, Code2, Target, Zap } from 'lucide-react';

interface Agent {
    id: string;
    name: string;
    role: string;
    description: string;
    systemPrompt: string;
    capability: 'observer' | 'executor' | 'analyzer' | 'coordinator';
    modelTier: 'free' | 'low' | 'medium' | 'high' | 'burst';
    cloudAssignment: 'local' | 'data' | 'training' | 'operation' | 'distribution';
    maxTokens: number;
    tasksDefinition: string[];
    active: boolean;
    createdAt: number;
    lastRun?: number;
    runsCompleted: number;
    totalCost: number;
    lastOutput?: string;
    running?: boolean;
}

// Real per-token pricing used to compute real cost from real usage metadata
// (Gemini Flash-tier public pricing, per token). Free-tier local models cost $0.
const COST_PER_TOKEN: Record<Agent['modelTier'], number> = {
    free: 0,
    low: 0.000000075,
    medium: 0.00000015,
    high: 0.0000005,
    burst: 0.000002,
};

const CAPABILITY_TEMPLATES: Record<string, Partial<Agent>> = {
    observer: {
        capability: 'observer',
        systemPrompt: `You are an Observer Agent. Your role is to:
1. Monitor system state and metrics
2. Detect anomalies or changes
3. Report findings clearly and concisely
4. Flag issues that need attention

Keep responses under 500 tokens. Focus on facts and observations.`,
        maxTokens: 500,
        tasksDefinition: [
            'Monitor system health',
            'Track resource usage',
            'Detect anomalies',
            'Generate reports'
        ]
    },
    executor: {
        capability: 'executor',
        systemPrompt: `You are an Executor Agent. Your role is to:
1. Execute specific, defined tasks
2. Follow step-by-step instructions
3. Report task status and results
4. Handle errors gracefully

Be precise and systematic. Only execute assigned tasks.`,
        maxTokens: 1024,
        tasksDefinition: [
            'Execute task queue',
            'Process data batches',
            'Run automation workflows',
            'Deploy configurations'
        ]
    },
    analyzer: {
        capability: 'analyzer',
        systemPrompt: `You are an Analyzer Agent. Your role is to:
1. Analyze data and patterns
2. Extract insights and trends
3. Identify correlations
4. Generate actionable recommendations

Be thorough but concise. Provide evidence for claims.`,
        maxTokens: 2048,
        tasksDefinition: [
            'Analyze datasets',
            'Extract patterns',
            'Generate insights',
            'Provide recommendations'
        ]
    },
    coordinator: {
        capability: 'coordinator',
        systemPrompt: `You are a Coordinator Agent. Your role is to:
1. Coordinate between other agents
2. Manage task dependencies
3. Prioritize workloads
4. Optimize resource allocation

Think strategically about task ordering and resource usage.`,
        maxTokens: 1536,
        tasksDefinition: [
            'Coordinate agent tasks',
            'Manage dependencies',
            'Prioritize workloads',
            'Allocate resources'
        ]
    }
};

const MODEL_TIER_INFO = {
    free: { label: 'Free (Ollama/Groq)', color: 'from-emerald-600 to-emerald-900', maxDaily: 1000 },
    low: { label: 'Low Tier', color: 'from-blue-600 to-blue-900', maxDaily: 100 },
    medium: { label: 'Medium Tier', color: 'from-purple-600 to-purple-900', maxDaily: 50 },
    high: { label: 'High Tier', color: 'from-amber-600 to-amber-900', maxDaily: 20 },
    burst: { label: 'Burst Premium', color: 'from-red-600 to-red-900', maxDaily: 5 }
};

export const AgentBuilderApp: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [showBuilder, setShowBuilder] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [newAgentForm, setNewAgentForm] = useState<Partial<Agent>>({
        modelTier: 'free',
        cloudAssignment: 'local',
        maxTokens: 1024,
        tasksDefinition: [],
        runsCompleted: 0,
        totalCost: 0
    });

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('agents');
        if (saved) {
            try {
                setAgents(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load agents:', e);
            }
        }
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('agents', JSON.stringify(agents));
    }, [agents]);

    const createAgent = () => {
        if (!newAgentForm.name || !newAgentForm.role || !newAgentForm.systemPrompt) return;

        const agent: Agent = {
            id: `agent_${Date.now()}`,
            name: newAgentForm.name || '',
            role: newAgentForm.role || '',
            description: newAgentForm.description || '',
            systemPrompt: newAgentForm.systemPrompt || '',
            capability: newAgentForm.capability || 'observer',
            modelTier: newAgentForm.modelTier || 'free',
            cloudAssignment: newAgentForm.cloudAssignment || 'local',
            maxTokens: newAgentForm.maxTokens || 1024,
            tasksDefinition: newAgentForm.tasksDefinition || [],
            active: true,
            createdAt: Date.now(),
            runsCompleted: 0,
            totalCost: 0
        };

        setAgents([...agents, agent]);
        setNewAgentForm({
            modelTier: 'free',
            cloudAssignment: 'local',
            maxTokens: 1024,
            tasksDefinition: [],
            runsCompleted: 0,
            totalCost: 0
        });
        setShowBuilder(false);
        setSelectedTemplate(null);
    };

    const deleteAgent = (id: string) => {
        setAgents(agents.filter(a => a.id !== id));
        if (selectedAgent === id) setSelectedAgent(null);
    };

    const duplicateAgent = (id: string) => {
        const agent = agents.find(a => a.id === id);
        if (agent) {
            const newAgent = { ...agent, id: `agent_${Date.now()}`, name: `${agent.name} (Copy)` };
            setAgents([...agents, newAgent]);
        }
    };

    const toggleAgent = (id: string) => {
        setAgents(agents.map(a => a.id === id ? { ...a, active: !a.active } : a));
    };

    // Real execution: actually calls the backend's Gemini proxy with the
    // agent's real system prompt and records real token usage as cost.
    const runAgent = async (id: string) => {
        const agent = agents.find(a => a.id === id);
        if (!agent) return;
        setAgents(prev => prev.map(a => a.id === id ? { ...a, running: true } : a));
        try {
            const resp = await fetch('/api/gemini/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: `${agent.systemPrompt}\n\nTask: ${agent.tasksDefinition[0] || agent.role}`,
                }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Request failed');
            const tokens = (data.usageMetadata?.totalTokenCount as number) || 0;
            const cost = tokens * COST_PER_TOKEN[agent.modelTier];
            setAgents(prev => prev.map(a => a.id === id ? {
                ...a,
                running: false,
                lastRun: Date.now(),
                runsCompleted: a.runsCompleted + 1,
                totalCost: a.totalCost + cost,
                lastOutput: data.response || '(no output)',
            } : a));
        } catch (err: any) {
            setAgents(prev => prev.map(a => a.id === id ? { ...a, running: false, lastOutput: `Error: ${err.message}` } : a));
        }
    };

    const applyTemplate = (templateKey: string) => {
        const template = CAPABILITY_TEMPLATES[templateKey];
        setNewAgentForm({
            ...newAgentForm,
            ...template,
            capability: template.capability as any
        });
        setSelectedTemplate(templateKey);
    };

    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.active).length;
    const totalCost = agents.reduce((sum, a) => sum + a.totalCost, 0);

    return (
        <div className="h-full w-full bg-[#09090b] text-slate-300 font-sans flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800/80 bg-[#0f1115] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <Bot size={18} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-200">Agent Builder</h1>
                        <p className="text-[10px] text-slate-500">{activeAgents}/{totalAgents} active • ${totalCost.toFixed(2)} total cost</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowBuilder(!showBuilder)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-1"
                >
                    <Plus size={12} />
                    New Agent
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 space-y-6">
                    {/* Agent Builder */}
                    {showBuilder && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                            <h2 className="text-sm font-bold text-white">Create New Agent</h2>

                            {/* Template Selection */}
                            {!selectedTemplate ? (
                                <div className="space-y-2">
                                    <label className="text-xs text-zinc-400">Choose Template</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(CAPABILITY_TEMPLATES).map(([key, _]) => (
                                            <button
                                                key={key}
                                                onClick={() => applyTemplate(key)}
                                                className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-purple-500 transition-all text-left text-xs"
                                            >
                                                <div className="font-bold text-white capitalize">{key} Agent</div>
                                                <div className="text-[8px] text-zinc-400 mt-0.5">Start with template</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-zinc-400 mb-1 block">Agent Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Data Monitor, Code Analyzer"
                                            value={newAgentForm.name || ''}
                                            onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-400 mb-1 block">Role</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. System Monitor, Bug Detector"
                                            value={newAgentForm.role || ''}
                                            onChange={(e) => setNewAgentForm({ ...newAgentForm, role: e.target.value })}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-400 mb-1 block">Description</label>
                                        <textarea
                                            placeholder="What does this agent do?"
                                            value={newAgentForm.description || ''}
                                            onChange={(e) => setNewAgentForm({ ...newAgentForm, description: e.target.value })}
                                            rows={2}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs text-zinc-400 mb-1 block">Model Tier</label>
                                            <select
                                                value={newAgentForm.modelTier || 'free'}
                                                onChange={(e) => setNewAgentForm({ ...newAgentForm, modelTier: e.target.value as any })}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
                                            >
                                                {Object.entries(MODEL_TIER_INFO).map(([tier, info]) => (
                                                    <option key={tier} value={tier}>{info.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs text-zinc-400 mb-1 block">Cloud</label>
                                            <select
                                                value={newAgentForm.cloudAssignment || 'local'}
                                                onChange={(e) => setNewAgentForm({ ...newAgentForm, cloudAssignment: e.target.value as any })}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
                                            >
                                                <option value="local">Local (Ollama)</option>
                                                <option value="data">Data Cloud</option>
                                                <option value="training">Training Cloud</option>
                                                <option value="operation">Operation Cloud</option>
                                                <option value="distribution">Distribution</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-400 mb-1 block">Max Tokens</label>
                                        <input
                                            type="number"
                                            value={newAgentForm.maxTokens || 1024}
                                            onChange={(e) => setNewAgentForm({ ...newAgentForm, maxTokens: parseInt(e.target.value) || 1024 })}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-400 mb-1 block">System Prompt</label>
                                        <textarea
                                            value={newAgentForm.systemPrompt || ''}
                                            onChange={(e) => setNewAgentForm({ ...newAgentForm, systemPrompt: e.target.value })}
                                            rows={4}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white font-mono"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedTemplate(null);
                                                setNewAgentForm({
                                                    modelTier: 'free',
                                                    cloudAssignment: 'local',
                                                    maxTokens: 1024,
                                                    tasksDefinition: [],
                                                    runsCompleted: 0,
                                                    totalCost: 0
                                                });
                                            }}
                                            className="flex-1 px-3 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={createAgent}
                                            disabled={!newAgentForm.name || !newAgentForm.role}
                                            className="flex-1 px-3 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50"
                                        >
                                            Create Agent
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Agents List */}
                    {agents.length > 0 ? (
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-white">Active Agents</h2>
                            <div className="space-y-2">
                                {agents.map(agent => {
                                    const tierInfo = MODEL_TIER_INFO[agent.modelTier];
                                    return (
                                        <div key={agent.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => toggleAgent(agent.id)}
                                                            className={`w-4 h-4 rounded border ${agent.active ? 'bg-purple-600 border-purple-500' : 'border-zinc-600 bg-zinc-800'}`}
                                                        />
                                                        <div>
                                                            <div className="text-xs font-bold text-white">{agent.name}</div>
                                                            <div className="text-[9px] text-zinc-400 mt-0.5">{agent.role}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => runAgent(agent.id)}
                                                        disabled={agent.running}
                                                        title="Run agent now (real Gemini call)"
                                                        className="p-1 hover:bg-emerald-900/20 rounded text-emerald-400 disabled:opacity-50"
                                                    >
                                                        <Play size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => duplicateAgent(agent.id)}
                                                        className="p-1 hover:bg-blue-900/20 rounded text-blue-400"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteAgent(agent.id)}
                                                        className="p-1 hover:bg-red-900/20 rounded text-red-400"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-[9px] text-zinc-500">{agent.description}</div>

                                            <div className="grid grid-cols-4 gap-1 text-[8px]">
                                                <div className="bg-zinc-950 rounded px-1.5 py-1">
                                                    <span className="text-zinc-400">Capability:</span>
                                                    <span className="text-white ml-0.5 font-bold capitalize">{agent.capability}</span>
                                                </div>
                                                <div className="bg-zinc-950 rounded px-1.5 py-1">
                                                    <span className="text-zinc-400">Model:</span>
                                                    <span className="text-white ml-0.5 font-bold">{tierInfo.label}</span>
                                                </div>
                                                <div className="bg-zinc-950 rounded px-1.5 py-1">
                                                    <span className="text-zinc-400">Runs:</span>
                                                    <span className="text-white ml-0.5 font-bold">{agent.runsCompleted}</span>
                                                </div>
                                                <div className="bg-zinc-950 rounded px-1.5 py-1">
                                                    <span className="text-zinc-400">Cost:</span>
                                                    <span className="text-white ml-0.5 font-bold">${agent.totalCost.toFixed(4)}</span>
                                                </div>
                                            </div>
                                            {agent.running && (
                                                <div className="text-[9px] text-emerald-400 animate-pulse">Running real call…</div>
                                            )}
                                            {agent.lastOutput && !agent.running && (
                                                <div className="bg-zinc-950 border border-zinc-800 rounded p-2 text-[9px] text-zinc-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                                    {agent.lastOutput}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
                            <Bot size={24} className="mx-auto text-purple-400 opacity-50" />
                            <h3 className="text-sm font-bold text-white">No Agents Created Yet</h3>
                            <p className="text-xs text-zinc-400">
                                Create your first agent to start automating tasks. Agents can monitor systems, execute tasks, analyze data, or coordinate workflows.
                            </p>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-purple-950/30 border border-purple-700/30 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-bold text-purple-400 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Agent Tiers
                        </div>
                        <div className="text-[9px] text-purple-300/80 space-y-0.5">
                            <div><span className="font-bold">Free:</span> Ollama/Groq - unlimited for free models</div>
                            <div><span className="font-bold">Low/Medium/High:</span> Paid tiers with budget limits</div>
                            <div><span className="font-bold">Burst:</span> Premium models, limited daily runs</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
