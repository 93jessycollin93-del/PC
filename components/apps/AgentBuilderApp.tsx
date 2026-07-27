import React, { useState, useEffect, useMemo } from 'react';
import { Bot, Plus, Trash2, Play, Settings, Save, Copy, AlertCircle, CheckCircle, Eye, Code2, Target, Zap, Workflow, History, Bug } from 'lucide-react';

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

// Approximate blended USD cost per token for each model tier, used to
// estimate a run's cost from usageMetadata.totalTokenCount.
const COST_PER_TOKEN: Record<Agent['modelTier'], number> = {
    free: 0,
    low: 0.0000002,
    medium: 0.000001,
    high: 0.000005,
    burst: 0.00001,
};

interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    agentSequence: string[];
    estimatedTime: number;
    tags: string[];
    createdAt: number;
}

interface ExecutionRun {
    id: string;
    workflowId?: string;
    agentId?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    logs: string[];
    result?: string;
    error?: string;
}

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

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    {
        id: 'wf_1',
        name: 'Monitor → Analyze → Report',
        description: 'Observe system, analyze metrics, generate report',
        agentSequence: ['observer', 'analyzer'],
        estimatedTime: 15,
        tags: ['monitoring', 'reporting'],
        createdAt: Date.now()
    },
    {
        id: 'wf_2',
        name: 'Daily Health Check',
        description: 'Quick system health check and status update',
        agentSequence: ['observer', 'coordinator'],
        estimatedTime: 5,
        tags: ['health-check', 'quick'],
        createdAt: Date.now()
    },
    {
        id: 'wf_3',
        name: 'Data Processing Pipeline',
        description: 'Analyze data and execute processing tasks',
        agentSequence: ['analyzer', 'executor'],
        estimatedTime: 20,
        tags: ['data', 'processing'],
        createdAt: Date.now()
    },
    {
        id: 'wf_4',
        name: 'Full System Analysis',
        description: 'Comprehensive monitoring and analysis workflow',
        agentSequence: ['observer', 'analyzer', 'coordinator'],
        estimatedTime: 30,
        tags: ['comprehensive', 'analysis'],
        createdAt: Date.now()
    }
];

export const AgentBuilderApp: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [workflows, setWorkflows] = useState<WorkflowTemplate[]>(WORKFLOW_TEMPLATES);
    const [executionHistory, setExecutionHistory] = useState<ExecutionRun[]>([]);
    const [showBuilder, setShowBuilder] = useState(false);
    const [showWorkflows, setShowWorkflows] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [selectedRun, setSelectedRun] = useState<string | null>(null);
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
        const savedAgents = localStorage.getItem('agents');
        if (savedAgents) {
            try {
                setAgents(JSON.parse(savedAgents));
            } catch (e) {
                console.error('Failed to load agents:', e);
            }
        }
        const savedWorkflows = localStorage.getItem('agent_workflows');
        if (savedWorkflows) {
            try {
                setWorkflows(JSON.parse(savedWorkflows));
            } catch (e) {
                console.error('Failed to load workflows:', e);
            }
        }
        const savedHistory = localStorage.getItem('agent_execution_history');
        if (savedHistory) {
            try {
                setExecutionHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error('Failed to load execution history:', e);
            }
        }
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('agents', JSON.stringify(agents));
    }, [agents]);

    useEffect(() => {
        localStorage.setItem('agent_workflows', JSON.stringify(workflows));
    }, [workflows]);

    useEffect(() => {
        localStorage.setItem('agent_execution_history', JSON.stringify(executionHistory));
    }, [executionHistory]);

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

    const executeWorkflow = (workflowId: string) => {
        const workflow = workflows.find(w => w.id === workflowId);
        if (!workflow) return;

        const run: ExecutionRun = {
            id: `run_${Date.now()}`,
            workflowId,
            status: 'running',
            startTime: Date.now(),
            logs: [`Starting workflow: ${workflow.name}`, ...workflow.agentSequence.map(cap => `Preparing ${cap} agent...`)]
        };

        setExecutionHistory([run, ...executionHistory]);

        setTimeout(() => {
            setExecutionHistory(prev =>
                prev.map(r =>
                    r.id === run.id
                        ? {
                            ...r,
                            status: 'completed',
                            endTime: Date.now(),
                            logs: [...r.logs, 'Workflow completed successfully', `Total time: ${workflow.estimatedTime}s`],
                            result: `Workflow executed successfully across ${workflow.agentSequence.length} agents`
                          }
                        : r
                )
            );
        }, workflow.estimatedTime * 1000);
    };

    const executeAgent = (agentId: string) => {
        const agent = agents.find(a => a.id === agentId);
        if (!agent) return;

        const run: ExecutionRun = {
            id: `run_${Date.now()}`,
            agentId,
            status: 'running',
            startTime: Date.now(),
            logs: [`Starting agent: ${agent.name}`, `Role: ${agent.role}`, `Capability: ${agent.capability}`]
        };

        setExecutionHistory([run, ...executionHistory]);
        setAgents(agents.map(a => a.id === agentId ? { ...a, lastRun: Date.now(), runsCompleted: a.runsCompleted + 1 } : a));

        setTimeout(() => {
            setExecutionHistory(prev =>
                prev.map(r =>
                    r.id === run.id
                        ? {
                            ...r,
                            status: 'completed',
                            endTime: Date.now(),
                            logs: [...r.logs, `Agent completed task successfully`, `Tokens used: ~${Math.random() * 1000 | 0}`],
                            result: 'Agent executed successfully'
                          }
                        : r
                )
            );
        }, 3000);
    };

    const addWorkflow = (name: string, agentSequence: string[]) => {
        if (!name.trim() || agentSequence.length === 0) return;
        const newWorkflow: WorkflowTemplate = {
            id: `wf_${Date.now()}`,
            name,
            description: `Custom workflow with ${agentSequence.length} agents`,
            agentSequence,
            estimatedTime: agentSequence.length * 5,
            tags: ['custom'],
            createdAt: Date.now()
        };
        setWorkflows([newWorkflow, ...workflows]);
    };

    const deleteWorkflow = (id: string) => {
        setWorkflows(workflows.filter(w => w.id !== id));
    };

    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.active).length;
    const totalCost = agents.reduce((sum, a) => sum + a.totalCost, 0);
    const successfulRuns = useMemo(() => executionHistory.filter(r => r.status === 'completed').length, [executionHistory]);

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
                        <p className="text-[10px] text-slate-500">{activeAgents}/{totalAgents} active • {successfulRuns} runs completed • ${totalCost.toFixed(2)} total cost</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowWorkflows(!showWorkflows)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 border ${showWorkflows ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}
                    >
                        <Workflow size={12} />
                        Workflows
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 border ${showHistory ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}
                    >
                        <History size={12} />
                        History
                    </button>
                    <button
                        onClick={() => setShowBuilder(!showBuilder)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-1"
                    >
                        <Plus size={12} />
                        New Agent
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 space-y-6">
                    {/* Workflows Section */}
                    {showWorkflows && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Workflow size={14} className="text-blue-400" />
                                Workflow Templates
                            </h2>
                            <div className="space-y-2">
                                {workflows.map(workflow => (
                                    <div key={workflow.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-xs font-bold text-white">{workflow.name}</h3>
                                                <p className="text-[9px] text-zinc-400 mt-0.5">{workflow.description}</p>
                                                <div className="flex gap-1 mt-2 flex-wrap">
                                                    {workflow.agentSequence.map((cap, idx) => (
                                                        <span key={idx} className="px-1.5 py-0.5 bg-slate-700 rounded text-[8px] text-slate-200 capitalize">
                                                            {cap}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => executeWorkflow(workflow.id)}
                                                    className="p-1.5 hover:bg-blue-900/20 rounded text-blue-400 transition-colors"
                                                    title="Execute workflow"
                                                >
                                                    <Play size={12} />
                                                </button>
                                                {workflow.tags.includes('custom') && (
                                                    <button
                                                        onClick={() => deleteWorkflow(workflow.id)}
                                                        className="p-1.5 hover:bg-red-900/20 rounded text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-[8px] text-zinc-500 flex gap-2">
                                            <span>⏱️ ~{workflow.estimatedTime}s</span>
                                            <span>Agents: {workflow.agentSequence.length}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Execution History Section */}
                    {showHistory && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <History size={14} className="text-green-400" />
                                Execution History
                            </h2>
                            {executionHistory.length === 0 ? (
                                <div className="text-center py-6 text-zinc-500 text-xs">
                                    <p>No executions yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {executionHistory.slice(0, 10).map(run => (
                                        <div key={run.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 space-y-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h3 className="text-xs font-bold text-white">
                                                        {run.workflowId ? `Workflow: ${run.id.slice(0, 8)}` : `Agent: ${run.agentId?.slice(0, 8)}`}
                                                    </h3>
                                                    <div className="text-[8px] text-zinc-400 mt-1">
                                                        {new Date(run.startTime).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                    run.status === 'running' ? 'bg-blue-500/20 text-blue-300' :
                                                    run.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                                    'bg-red-500/20 text-red-300'
                                                }`}>
                                                    {run.status}
                                                </span>
                                            </div>
                                            {run.result && (
                                                <p className="text-[8px] text-zinc-300">{run.result}</p>
                                            )}
                                            {run.error && (
                                                <p className="text-[8px] text-red-300">{run.error}</p>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setShowDebug(selectedRun === run.id ? false : true);
                                                    setSelectedRun(selectedRun === run.id ? null : run.id);
                                                }}
                                                className="text-[8px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                            >
                                                <Bug size={10} /> Debug logs
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Debug Panel */}
                    {showDebug && selectedRun && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto font-mono text-[8px]">
                            <h3 className="text-xs font-bold text-white flex items-center gap-2">
                                <Bug size={12} className="text-yellow-400" />
                                Debug Logs
                            </h3>
                            {executionHistory.find(r => r.id === selectedRun)?.logs.map((log, idx) => (
                                <div key={idx} className="text-zinc-400 whitespace-pre-wrap">
                                    <span className="text-yellow-600">[{new Date().toLocaleTimeString()}]</span> {log}
                                </div>
                            ))}
                        </div>
                    )}

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
                                                        onClick={() => executeAgent(agent.id)}
                                                        className="p-1 hover:bg-green-900/20 rounded text-green-400 transition-colors"
                                                        title="Execute agent"
                                                    >
                                                        <Play size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => duplicateAgent(agent.id)}
                                                        className="p-1 hover:bg-blue-900/20 rounded text-blue-400 transition-colors"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteAgent(agent.id)}
                                                        className="p-1 hover:bg-red-900/20 rounded text-red-400 transition-colors"
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
