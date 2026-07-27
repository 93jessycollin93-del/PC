import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap, TrendingUp, AlertCircle, CheckCircle, Clock, Activity, BarChart3, Users } from 'lucide-react';

interface Agent {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    capability: 'observer' | 'executor' | 'analyzer' | 'coordinator';
    lastRun?: number;
    runsCompleted: number;
    successRate: number;
    avgExecutionTime: number;
    totalTokensUsed: number;
}

interface WorkflowExecution {
    id: string;
    name: string;
    startTime: number;
    endTime?: number;
    status: 'running' | 'completed' | 'failed';
    agentSequence: string[];
    tokensUsed: number;
    cost: number;
}

const SAMPLE_AGENTS: Agent[] = [
    {
        id: 'obs_1',
        name: 'System Monitor',
        status: 'idle',
        capability: 'observer',
        runsCompleted: 247,
        successRate: 99.2,
        avgExecutionTime: 2.3,
        totalTokensUsed: 52000,
        lastRun: Date.now() - 5 * 60000,
    },
    {
        id: 'exec_1',
        name: 'Task Executor',
        status: 'idle',
        capability: 'executor',
        runsCompleted: 156,
        successRate: 98.7,
        avgExecutionTime: 5.1,
        totalTokensUsed: 78000,
        lastRun: Date.now() - 15 * 60000,
    },
    {
        id: 'ana_1',
        name: 'Data Analyzer',
        status: 'idle',
        capability: 'analyzer',
        runsCompleted: 89,
        successRate: 99.8,
        avgExecutionTime: 8.7,
        totalTokensUsed: 124000,
        lastRun: Date.now() - 2 * 60000,
    },
    {
        id: 'coord_1',
        name: 'Task Coordinator',
        status: 'idle',
        capability: 'coordinator',
        runsCompleted: 312,
        successRate: 99.5,
        avgExecutionTime: 3.2,
        totalTokensUsed: 98000,
        lastRun: Date.now() - 30 * 60000,
    },
];

const WORKFLOW_TEMPLATES = [
    {
        name: 'Monitor → Analyze → Report',
        description: 'Observe system, analyze data, generate report',
        agents: ['obs_1', 'ana_1', 'exec_1'],
        estimatedTime: 18,
        estimatedCost: 0.02,
    },
    {
        name: 'Daily Health Check',
        description: 'System monitoring with quick status report',
        agents: ['obs_1', 'coord_1'],
        estimatedTime: 5,
        estimatedCost: 0.005,
    },
    {
        name: 'Full Pipeline Analysis',
        description: 'Comprehensive system analysis with recommendations',
        agents: ['obs_1', 'ana_1', 'ana_1', 'exec_1'],
        estimatedTime: 25,
        estimatedCost: 0.03,
    },
];

export const AgentOrchestrationDashboard: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>(SAMPLE_AGENTS);
    const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'workflows' | 'history'>('dashboard');

    const totalRuns = agents.reduce((sum, a) => sum + a.runsCompleted, 0);
    const avgSuccessRate = (agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length).toFixed(1);
    const totalTokens = agents.reduce((sum, a) => sum + a.totalTokensUsed, 0);

    const runWorkflow = (templateName: string) => {
        setIsRunning(true);
        const template = WORKFLOW_TEMPLATES.find(t => t.name === templateName);
        if (!template) return;

        const execution: WorkflowExecution = {
            id: `exec_${Date.now()}`,
            name: templateName,
            startTime: Date.now(),
            status: 'running',
            agentSequence: template.agents,
            tokensUsed: 0,
            cost: 0,
        };

        setExecutions(prev => [...prev, execution]);

        // Simulate execution
        setTimeout(() => {
            setExecutions(prev =>
                prev.map(e =>
                    e.id === execution.id
                        ? {
                            ...e,
                            endTime: Date.now(),
                            status: 'completed',
                            tokensUsed: Math.floor(Math.random() * 5000) + 2000,
                            cost: parseFloat((Math.random() * 0.02 + 0.005).toFixed(4)),
                        }
                        : e
                )
            );
            setIsRunning(false);
        }, 3000);
    };

    return (
        <div className="h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-4 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                            <Users size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Agent Orchestration</h1>
                            <p className="text-slate-400 text-sm">Coordinate and monitor multi-agent workflows</p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Total Runs</div>
                        <div className="text-2xl font-bold text-white">{totalRuns}</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Avg Success Rate</div>
                        <div className="text-2xl font-bold text-emerald-400">{avgSuccessRate}%</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Total Tokens</div>
                        <div className="text-2xl font-bold text-blue-400">{(totalTokens / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Estimated Cost</div>
                        <div className="text-2xl font-bold text-yellow-400">$0.15</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-slate-800 border-b border-slate-700 flex px-4 gap-2">
                {(['dashboard', 'workflows', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 font-semibold border-b-2 transition ${
                            activeTab === tab
                                ? 'text-white border-blue-500'
                                : 'text-slate-400 border-transparent hover:text-slate-200'
                        }`}
                    >
                        {tab === 'dashboard' ? '📊 Dashboard' : tab === 'workflows' ? '⚙️ Workflows' : '📈 History'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 max-w-7xl mx-auto">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            {/* Active Agents */}
                            <div>
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-400" /> Active Agents
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {agents.map(agent => (
                                        <div key={agent.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="text-white font-semibold">{agent.name}</h3>
                                                    <p className="text-slate-400 text-xs capitalize">{agent.capability}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    agent.status === 'idle' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    agent.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                                    agent.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {agent.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-slate-700 rounded p-2">
                                                    <div className="text-slate-400">Runs</div>
                                                    <div className="text-white font-bold">{agent.runsCompleted}</div>
                                                </div>
                                                <div className="bg-slate-700 rounded p-2">
                                                    <div className="text-slate-400">Success</div>
                                                    <div className="text-emerald-400 font-bold">{agent.successRate}%</div>
                                                </div>
                                                <div className="bg-slate-700 rounded p-2">
                                                    <div className="text-slate-400">Avg Time</div>
                                                    <div className="text-white font-bold">{agent.avgExecutionTime.toFixed(1)}s</div>
                                                </div>
                                                <div className="bg-slate-700 rounded p-2">
                                                    <div className="text-slate-400">Tokens</div>
                                                    <div className="text-blue-400 font-bold">{(agent.totalTokensUsed / 1000).toFixed(0)}K</div>
                                                </div>
                                            </div>

                                            {agent.lastRun && (
                                                <div className="mt-3 text-[11px] text-slate-400">
                                                    Last run: {new Date(agent.lastRun).toLocaleTimeString()}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Performance Metrics */}
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-emerald-400" /> Performance
                                </h2>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="bg-slate-700 rounded p-3">
                                        <div className="text-slate-400 mb-1">Average Execution Time</div>
                                        <div className="text-2xl font-bold text-white">
                                            {(agents.reduce((sum, a) => sum + a.avgExecutionTime, 0) / agents.length).toFixed(1)}s
                                        </div>
                                    </div>
                                    <div className="bg-slate-700 rounded p-3">
                                        <div className="text-slate-400 mb-1">Total Cost Today</div>
                                        <div className="text-2xl font-bold text-yellow-400">$0.42</div>
                                    </div>
                                    <div className="bg-slate-700 rounded p-3">
                                        <div className="text-slate-400 mb-1">Workflow Success Rate</div>
                                        <div className="text-2xl font-bold text-blue-400">99.1%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'workflows' && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Zap size={20} className="text-yellow-400" /> Workflow Templates
                            </h2>
                            {WORKFLOW_TEMPLATES.map((template, i) => (
                                <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-white font-semibold text-lg">{template.name}</h3>
                                            <p className="text-slate-400 text-sm mt-1">{template.description}</p>
                                            <div className="flex gap-2 mt-3">
                                                {template.agents.map(agentId => {
                                                    const agent = agents.find(a => a.id === agentId);
                                                    return (
                                                        <span key={agentId} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-200">
                                                            {agent?.name}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => runWorkflow(template.name)}
                                            disabled={isRunning}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded font-semibold flex items-center gap-2 transition"
                                        >
                                            <Play size={16} /> Run
                                        </button>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-400">
                                        <span>⏱️ Est. Time: {template.estimatedTime}s</span>
                                        <span>💰 Est. Cost: ${template.estimatedCost.toFixed(3)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-purple-400" /> Execution History
                            </h2>
                            {executions.length === 0 ? (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
                                    <Clock size={40} className="mx-auto text-slate-600 mb-2" />
                                    <p className="text-slate-400">No executions yet. Run a workflow to get started!</p>
                                </div>
                            ) : (
                                executions.map(exec => (
                                    <div key={exec.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-white font-semibold">{exec.name}</h3>
                                                <p className="text-slate-400 text-sm">
                                                    {new Date(exec.startTime).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded font-semibold flex items-center gap-1 ${
                                                exec.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                                exec.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                                {exec.status === 'completed' ? <CheckCircle size={14} /> : <Activity size={14} />}
                                                {exec.status}
                                            </span>
                                        </div>
                                        {exec.status === 'completed' && (
                                            <div className="grid grid-cols-4 gap-2 text-xs text-slate-300">
                                                <div>Duration: {((exec.endTime! - exec.startTime) / 1000).toFixed(2)}s</div>
                                                <div>Tokens: {exec.tokensUsed.toLocaleString()}</div>
                                                <div>Cost: ${exec.cost.toFixed(4)}</div>
                                                <div>Agents: {exec.agentSequence.length}</div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
