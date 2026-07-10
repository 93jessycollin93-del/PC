import React, { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, PieChart, BarChart3, AlertCircle, Target, Zap, Calendar } from 'lucide-react';

interface CostRecord {
    date: string;
    provider: string;
    model: string;
    tokensUsed: number;
    cost: number;
    taskType: string;
}

interface BudgetLimit {
    provider: string;
    monthlyLimit: number;
    spent: number;
    remaining: number;
}

const SAMPLE_COSTS: CostRecord[] = [
    { date: '2026-07-10', provider: 'Groq', model: 'Mixtral 8x7B', tokensUsed: 5000, cost: 0, taskType: 'chat' },
    { date: '2026-07-10', provider: 'Ollama', model: 'Llama 3.1 70B', tokensUsed: 12000, cost: 0, taskType: 'reasoning' },
    { date: '2026-07-09', provider: 'DeepSeek', model: 'DeepSeek Chat', tokensUsed: 8000, cost: 0.008, taskType: 'analysis' },
    { date: '2026-07-09', provider: 'Gemini', model: 'Gemini 2.0 Flash', tokensUsed: 3000, cost: 0, taskType: 'vision' },
    { date: '2026-07-08', provider: 'Claude', model: 'Haiku', tokensUsed: 2000, cost: 0.0005, taskType: 'code' },
    { date: '2026-07-08', provider: 'Groq', model: 'Llama 3.3 70B', tokensUsed: 6000, cost: 0, taskType: 'general' },
    { date: '2026-07-07', provider: 'OpenRouter', model: 'Mistral 7B', tokensUsed: 4000, cost: 0.004, taskType: 'instruct' },
];

const BUDGETS: BudgetLimit[] = [
    { provider: 'Groq', monthlyLimit: 0, spent: 0, remaining: 0 },
    { provider: 'Ollama', monthlyLimit: 0, spent: 0, remaining: 0 },
    { provider: 'DeepSeek', monthlyLimit: 50, spent: 12.34, remaining: 37.66 },
    { provider: 'Claude', monthlyLimit: 100, spent: 25.67, remaining: 74.33 },
    { provider: 'Gemini', monthlyLimit: 0, spent: 0, remaining: 0 },
];

export const CostAnalyticsApp: React.FC = () => {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [showBudgetModal, setShowBudgetModal] = useState(false);

    // Calculate metrics
    const totalCost = useMemo(() => SAMPLE_COSTS.reduce((sum, c) => sum + c.cost, 0), []);
    const totalTokens = useMemo(() => SAMPLE_COSTS.reduce((sum, c) => sum + c.tokensUsed, 0), []);
    const avgCostPerK = useMemo(() => totalCost > 0 ? ((totalCost / totalTokens) * 1000).toFixed(4) : '0', [totalCost, totalTokens]);

    const costByProvider = useMemo(() => {
        const providers: Record<string, { cost: number; tokens: number; count: number }> = {};
        SAMPLE_COSTS.forEach(record => {
            if (!providers[record.provider]) {
                providers[record.provider] = { cost: 0, tokens: 0, count: 0 };
            }
            providers[record.provider].cost += record.cost;
            providers[record.provider].tokens += record.tokensUsed;
            providers[record.provider].count += 1;
        });
        return Object.entries(providers).map(([provider, data]) => ({
            provider,
            ...data,
            costPerK: data.tokens > 0 ? ((data.cost / data.tokens) * 1000).toFixed(4) : '0',
        })).sort((a, b) => b.cost - a.cost);
    }, []);

    const costByTask = useMemo(() => {
        const tasks: Record<string, { cost: number; tokens: number; count: number }> = {};
        SAMPLE_COSTS.forEach(record => {
            if (!tasks[record.taskType]) {
                tasks[record.taskType] = { cost: 0, tokens: 0, count: 0 };
            }
            tasks[record.taskType].cost += record.cost;
            tasks[record.taskType].tokens += record.tokensUsed;
            tasks[record.taskType].count += 1;
        });
        return Object.entries(tasks).map(([taskType, data]) => ({
            taskType,
            ...data,
        })).sort((a, b) => b.cost - a.cost);
    }, []);

    const costByDate = useMemo(() => {
        const dates: Record<string, number> = {};
        SAMPLE_COSTS.forEach(record => {
            dates[record.date] = (dates[record.date] || 0) + record.cost;
        });
        return Object.entries(dates)
            .map(([date, cost]) => ({ date, cost }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, []);

    const totalBudgetSpent = BUDGETS.reduce((sum, b) => sum + b.spent, 0);
    const totalBudgetLimit = BUDGETS.reduce((sum, b) => sum + b.monthlyLimit, 0);
    const budgetUtilization = totalBudgetLimit > 0 ? ((totalBudgetSpent / totalBudgetLimit) * 100).toFixed(1) : '0';

    const freeTierUsage = costByProvider.filter(p => parseFloat(p.costPerK) === 0).reduce((sum, p) => sum + p.tokens, 0);
    const paidTierUsage = costByProvider.filter(p => parseFloat(p.costPerK) > 0).reduce((sum, p) => sum + p.tokens, 0);
    const freePercentage = ((freeTierUsage / totalTokens) * 100).toFixed(1);

    return (
        <div className="h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg">
                            <DollarSign size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Cost Analytics</h1>
                            <p className="text-slate-400 text-sm">Track and optimize AI spending across providers</p>
                        </div>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-5 gap-3">
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Total Cost</div>
                        <div className="text-2xl font-bold text-yellow-400">${totalCost.toFixed(3)}</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Total Tokens</div>
                        <div className="text-2xl font-bold text-blue-400">{(totalTokens / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Avg Cost/1K</div>
                        <div className="text-2xl font-bold text-purple-400">${avgCostPerK}</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Free Usage</div>
                        <div className="text-2xl font-bold text-emerald-400">{freePercentage}%</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                        <div className="text-slate-400 text-xs mb-1">Requests</div>
                        <div className="text-2xl font-bold text-white">{SAMPLE_COSTS.length}</div>
                    </div>
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex gap-2">
                {(['7d', '30d', '90d'] as const).map(range => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 rounded text-sm font-semibold transition ${
                            timeRange === range
                                ? 'bg-yellow-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                    >
                        {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 max-w-7xl mx-auto space-y-6">
                    {/* Cost Trend */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-emerald-400" /> Cost Trend
                        </h2>
                        <div className="flex items-end gap-2 h-32 px-4">
                            {costByDate.map((item, i) => {
                                const maxCost = Math.max(...costByDate.map(d => d.cost));
                                const heightPercent = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t hover:from-yellow-400 hover:to-yellow-300 transition cursor-pointer"
                                            style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                                            title={`${item.date}: $${item.cost.toFixed(3)}`}
                                        />
                                        <div className="text-[9px] text-slate-400 text-center">
                                            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cost by Provider & Task */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* By Provider */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={20} className="text-blue-400" /> By Provider
                            </h2>
                            <div className="space-y-2">
                                {costByProvider.map((item, i) => (
                                    <div key={i} className="bg-slate-700 rounded p-2 hover:bg-slate-600 cursor-pointer transition">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-white">{item.provider}</span>
                                            <span className="text-sm font-bold text-yellow-400">${item.cost.toFixed(3)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>{item.tokens.toLocaleString()} tokens • {item.count} calls</span>
                                            <span className={parseFloat(item.costPerK) === 0 ? 'text-emerald-400' : 'text-orange-400'}>
                                                ${item.costPerK}/1K
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* By Task Type */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Target size={20} className="text-purple-400" /> By Task Type
                            </h2>
                            <div className="space-y-2">
                                {costByTask.map((item, i) => (
                                    <div key={i} className="bg-slate-700 rounded p-2 hover:bg-slate-600 cursor-pointer transition">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-white capitalize">{item.taskType}</span>
                                            <span className="text-sm font-bold text-yellow-400">${item.cost.toFixed(3)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>{item.tokens.toLocaleString()} tokens • {item.count} tasks</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Budget Management */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap size={20} className="text-purple-400" /> Budget Tracking
                            </h2>
                            <button
                                onClick={() => setShowBudgetModal(true)}
                                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-semibold transition"
                            >
                                Edit Budgets
                            </button>
                        </div>

                        {totalBudgetLimit > 0 && (
                            <div className="mb-4 bg-slate-700 rounded p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-semibold">Overall Budget Usage</span>
                                    <span className="text-yellow-400 font-bold">${totalBudgetSpent.toFixed(2)} / ${totalBudgetLimit}</span>
                                </div>
                                <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${
                                            parseFloat(budgetUtilization) < 50 ? 'bg-emerald-500' :
                                            parseFloat(budgetUtilization) < 80 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(parseFloat(budgetUtilization), 100)}%` }}
                                    />
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    {budgetUtilization}% utilized
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            {BUDGETS.map((budget, i) => (
                                <div key={i} className={`rounded p-2 border ${
                                    budget.monthlyLimit === 0 ? 'bg-emerald-950/30 border-emerald-700/30' :
                                    budget.spent / budget.monthlyLimit > 0.8 ? 'bg-red-950/30 border-red-700/30' :
                                    'bg-slate-700 border-slate-600'
                                }`}>
                                    <div className="text-xs text-slate-300 font-semibold">{budget.provider}</div>
                                    {budget.monthlyLimit === 0 ? (
                                        <div className="text-[10px] text-emerald-400 mt-1">Free Tier</div>
                                    ) : (
                                        <>
                                            <div className="text-xs text-yellow-400 font-bold mt-1">${budget.spent.toFixed(2)} / ${budget.monthlyLimit}</div>
                                            <div className="text-[10px] text-slate-400">Remaining: ${budget.remaining.toFixed(2)}</div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Optimization Tips */}
                    <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-lg p-4">
                        <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                            <AlertCircle size={20} /> Optimization Opportunities
                        </h2>
                        <ul className="space-y-2 text-sm text-emerald-300">
                            <li>✓ Great job! {freePercentage}% of tokens using free tier (Groq, Ollama, Gemini)</li>
                            <li>• Consider routing DeepSeek to Groq for cost savings when possible</li>
                            <li>• You have {paidTierUsage.toLocaleString()} paid tokens - review for optimization</li>
                            <li>• Current cost per 1K tokens: ${avgCostPerK} (excellent)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
