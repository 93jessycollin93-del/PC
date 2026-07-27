/**
 * Cross-AI Lab — Multi-agent experiment orchestration
 * Run prompts across different AI models and compare responses
 */

import React, { useState, useCallback } from 'react';
import {
    Send,
    Copy,
    Trash2,
    RotateCcw,
    Settings,
    Plus,
    Zap,
    TrendingUp,
    Grid3x3,
    List,
    Download,
    Archive,
    Star,
    Heart,
} from 'lucide-react';
import {
    AGENT_REGISTRY,
    getEnabledAgents,
    isAgentConfigured,
    setAgentApiKey,
} from '../../lib/agents/agentRegistry';
import {
    createExperiment,
    runExperiment,
    saveExperiment,
    listExperiments,
    Experiment,
} from '../../lib/agents/experimentRunner';
import { scoreResponses, findConsensus } from '../../lib/agents/responseAnalyzer';
import {
    saveVote,
    getVote,
    getExperimentVotes,
    getFavorites,
    calculateAgentStats,
    getLeaderboard,
} from '../../lib/agents/responseVoting';
import type { ResponseVote } from '../../lib/agents/responseVoting';

type ViewMode = 'editor' | 'results' | 'history' | 'favorites' | 'leaderboard';

export const CrossAiLabApp: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('editor');
    const [currentExperiment, setCurrentExperiment] = useState<Experiment | null>(null);
    const [prompt, setPrompt] = useState('');
    const [selectedAgents, setSelectedAgents] = useState<string[]>(['claude-opus', 'gemini-2-0']);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [theme, setTheme] = useState('research');
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [selectedAgentForKey, setSelectedAgentForKey] = useState<string | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState('');

    const enabledAgents = getEnabledAgents();
    const savedExperiments = listExperiments();
    const [experimentVotes, setExperimentVotes] = useState<Map<string, ResponseVote>>(() => {
        if (!currentExperiment) return new Map();
        const votes = getExperimentVotes(currentExperiment.id);
        const map = new Map<string, ResponseVote>();
        votes.forEach(v => map.set(v.agentId, v));
        return map;
    });

    const handleToggleAgent = (agentId: string) => {
        setSelectedAgents(prev =>
            prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
        );
    };

    const handleRunExperiment = async () => {
        if (!prompt.trim() || selectedAgents.length === 0) return;

        setIsRunning(true);
        const exp = createExperiment(prompt.slice(0, 50) + '...', prompt, selectedAgents, theme);
        setCurrentExperiment(exp);

        const result = await runExperiment(exp, (completed, total) => {
            setProgress(Math.round((completed / total) * 100));
        });

        setCurrentExperiment(result.experiment);
        saveExperiment(result.experiment);
        setIsRunning(false);
        setViewMode('results');
        setProgress(0);
    };

    const handleSaveApiKey = () => {
        if (selectedAgentForKey && apiKeyInput) {
            setAgentApiKey(selectedAgentForKey, apiKeyInput);
            setApiKeyInput('');
            setSelectedAgentForKey(null);
            setShowApiKeyModal(false);
        }
    };

    const handleCopyResponse = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleRateResponse = (agentId: string, rating: number) => {
        if (!currentExperiment) return;

        const vote: ResponseVote = {
            experimentId: currentExperiment.id,
            agentId,
            rating,
            isFavorite: experimentVotes.get(agentId)?.isFavorite || false,
            votedAt: new Date(),
        };

        saveVote(vote);
        setExperimentVotes(prev => new Map(prev).set(agentId, vote));
    };

    const handleToggleFavorite = (agentId: string) => {
        if (!currentExperiment) return;

        const existing = experimentVotes.get(agentId);
        const vote: ResponseVote = {
            experimentId: currentExperiment.id,
            agentId,
            rating: existing?.rating || 0,
            isFavorite: !existing?.isFavorite,
            votedAt: new Date(),
        };

        saveVote(vote);
        setExperimentVotes(prev => new Map(prev).set(agentId, vote));
    };

    const handleExportExperiment = () => {
        if (!currentExperiment) return;
        const json = JSON.stringify(currentExperiment, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `experiment_${currentExperiment.id}.json`;
        a.click();
    };

    if (viewMode === 'editor') {
        return (
            <div className="flex flex-col h-full bg-gradient-to-br from-zinc-950 via-purple-950 to-zinc-950 p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-purple-300">Cross-AI Lab</h1>
                        <p className="text-sm text-zinc-400">Run experiments across multiple AI agents</p>
                    </div>
                    <button
                        onClick={() => setViewMode('history')}
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
                    >
                        <Archive size={16} />
                        History
                    </button>
                </div>

                {/* Prompt Editor */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-purple-300 mb-2">Experiment Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        className="w-full h-32 px-4 py-2 bg-zinc-900 border border-purple-500/30 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500/60 resize-none"
                        placeholder="Enter your prompt here... (will be sent to all selected agents)"
                    />
                </div>

                {/* Agent Selection */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-purple-300">Select Agents</label>
                        <button
                            onClick={() => setShowApiKeyModal(!showApiKeyModal)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition"
                        >
                            <Settings size={14} />
                            API Keys
                        </button>
                    </div>

                    {showApiKeyModal && (
                        <div className="mb-4 p-4 bg-zinc-900 border border-yellow-500/30 rounded-lg">
                            <p className="text-xs text-yellow-400 mb-3">Configure API Keys</p>
                            <div className="space-y-2">
                                {enabledAgents.map(agent => (
                                    <div key={agent.id} className="flex items-center gap-2">
                                        <input
                                            type="password"
                                            placeholder={`${agent.name} API Key`}
                                            value={
                                                selectedAgentForKey === agent.id
                                                    ? apiKeyInput
                                                    : isAgentConfigured(agent.id)
                                                        ? '••••••••'
                                                        : ''
                                            }
                                            onChange={e => {
                                                setSelectedAgentForKey(agent.id);
                                                setApiKeyInput(e.target.value);
                                            }}
                                            className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100"
                                        />
                                        <button
                                            onClick={() => {
                                                setSelectedAgentForKey(agent.id);
                                                handleSaveApiKey();
                                            }}
                                            className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs text-white transition"
                                        >
                                            Save
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {enabledAgents.map(agent => (
                            <label
                                key={agent.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                    selectedAgents.includes(agent.id)
                                        ? 'bg-purple-500/20 border-purple-500/50'
                                        : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-700/50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedAgents.includes(agent.id)}
                                    onChange={() => handleToggleAgent(agent.id)}
                                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-sm text-zinc-100">{agent.name}</div>
                                    <div className="text-xs text-zinc-400">{agent.description}</div>
                                </div>
                                {!isAgentConfigured(agent.id) && !agent.isLocal && (
                                    <Zap size={14} className="text-yellow-500" />
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Theme Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-purple-300 mb-2">Experiment Theme</label>
                    <div className="flex gap-2">
                        {['code', 'creative', 'analysis', 'research'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTheme(t)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                    theme === t
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Run Button */}
                <button
                    onClick={handleRunExperiment}
                    disabled={isRunning || !prompt.trim() || selectedAgents.length === 0}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition"
                >
                    {isRunning ? (
                        <>
                            <div className="animate-spin">⚡</div>
                            Running ({progress}%)
                        </>
                    ) : (
                        <>
                            <Send size={18} />
                            Run Experiment
                        </>
                    )}
                </button>
            </div>
        );
    }

    if (viewMode === 'results' && currentExperiment) {
        const responses = Array.from(currentExperiment.responses.values());
        const scores = scoreResponses(responses);
        const consensus = findConsensus(responses);

        return (
            <div className="flex flex-col h-full bg-gradient-to-br from-zinc-950 via-purple-950 to-zinc-950 p-6 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-gradient-to-b from-zinc-950 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-purple-300">Experiment Results</h1>
                        <p className="text-xs text-zinc-400 mt-1">{currentExperiment.title}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExperiment}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
                        >
                            <Download size={16} />
                            Export
                        </button>
                        <button
                            onClick={() => setViewMode('favorites')}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
                        >
                            <Heart size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('leaderboard')}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
                        >
                            <TrendingUp size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('editor')}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition"
                        >
                            New
                        </button>
                    </div>
                </div>

                {/* Scores Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {scores.map(score => (
                        <div key={score.agentId} className="p-4 bg-zinc-800/50 border border-purple-500/20 rounded-lg">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-medium text-purple-300">{score.agentName}</h3>
                                    {consensus.includes(score.agentId) && (
                                        <span className="text-xs bg-green-500/30 text-green-300 px-2 py-1 rounded mt-1 inline-block">
                                            Consensus
                                        </span>
                                    )}
                                </div>
                                <div className="text-2xl font-bold text-purple-400">{score.overallScore}</div>
                            </div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between text-zinc-300">
                                    <span>Readability</span>
                                    <span className="text-emerald-400">{score.readabilityScore}</span>
                                </div>
                                <div className="flex justify-between text-zinc-300">
                                    <span>Completeness</span>
                                    <span className="text-emerald-400">{score.completenessScore}</span>
                                </div>
                                <div className="flex justify-between text-zinc-300">
                                    <span>Speed</span>
                                    <span className="text-emerald-400">{score.speedScore}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Responses */}
                <div className="space-y-4">
                    {responses.map((response, idx) => {
                        const vote = experimentVotes.get(response.agentId);
                        return (
                            <div key={response.agentId} className={`p-4 rounded-lg border transition ${vote?.isFavorite ? 'bg-purple-900/30 border-purple-500/40' : 'bg-zinc-800/30 border-zinc-700/50'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-medium text-zinc-100">{response.agentName}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-400">{response.latencyMs.toFixed(0)}ms</span>
                                        <button
                                            onClick={() => handleToggleFavorite(response.agentId)}
                                            className="p-1 hover:bg-zinc-700 rounded transition"
                                        >
                                            <Heart
                                                size={14}
                                                className={vote?.isFavorite ? 'text-red-500 fill-red-500' : 'text-zinc-400'}
                                            />
                                        </button>
                                        <button
                                            onClick={() => handleCopyResponse(response.content)}
                                            className="p-1 hover:bg-zinc-700 rounded transition"
                                        >
                                            <Copy size={14} className="text-zinc-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Star Rating */}
                                <div className="flex gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => handleRateResponse(response.agentId, star)}
                                            className="transition hover:scale-110"
                                        >
                                            <Star
                                                size={16}
                                                className={
                                                    star <= (vote?.rating || 0)
                                                        ? 'text-yellow-400 fill-yellow-400'
                                                        : 'text-zinc-600'
                                                }
                                            />
                                        </button>
                                    ))}
                                    {vote?.rating && <span className="text-xs text-zinc-400 ml-2">Rated {vote.rating}/5</span>}
                                </div>

                                {response.error ? (
                                    <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded">Error: {response.error}</div>
                                ) : (
                                    <div className="text-sm text-zinc-300 leading-relaxed max-h-48 overflow-y-auto bg-zinc-900/50 p-3 rounded">
                                        {response.content}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (viewMode === 'history') {
        return (
            <div className="flex flex-col h-full bg-gradient-to-br from-zinc-950 via-purple-950 to-zinc-950 p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-purple-300">Experiment History</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('favorites')}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
                        >
                            <Heart size={16} />
                            Favorites
                        </button>
                        <button
                            onClick={() => setViewMode('leaderboard')}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
                        >
                            <TrendingUp size={16} />
                            Leaderboard
                        </button>
                        <button
                            onClick={() => setViewMode('editor')}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition"
                        >
                            New Experiment
                        </button>
                    </div>
                </div>

                {/* Experiments List */}
                <div className="space-y-3 overflow-y-auto">
                    {savedExperiments.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400">
                            <p>No experiments yet. Create one to get started!</p>
                        </div>
                    ) : (
                        savedExperiments.map(exp => (
                            <button
                                key={exp.id}
                                onClick={() => {
                                    setCurrentExperiment(exp);
                                    setViewMode('results');
                                }}
                                className="w-full p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-left transition"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-purple-300">{exp.title}</h3>
                                        <p className="text-xs text-zinc-400 mt-1">
                                            {exp.selectedAgentIds.length} agents •{' '}
                                            {new Date(exp.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-xs text-zinc-400">{exp.completedCount} responses</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    if (viewMode === 'favorites') {
        const favorites = getFavorites();

        return (
            <div className="flex flex-col h-full bg-gradient-to-br from-zinc-950 via-purple-950 to-zinc-950 p-6 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-gradient-to-b from-zinc-950 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-purple-300">Favorite Responses</h1>
                        <p className="text-xs text-zinc-400 mt-1">{favorites.length} saved favorites</p>
                    </div>
                    <button
                        onClick={() => setViewMode('history')}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition"
                    >
                        Back to History
                    </button>
                </div>

                {/* Favorites List */}
                <div className="space-y-4">
                    {favorites.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400">
                            <Heart size={32} className="mx-auto mb-2 text-zinc-600" />
                            <p>No favorites yet. Mark responses as favorites while reviewing experiments!</p>
                        </div>
                    ) : (
                        favorites.map((vote, idx) => {
                            const experiment = savedExperiments.find(e => e.id === vote.experimentId);
                            const response = experiment?.responses.get(vote.agentId);

                            if (!response) return null;

                            return (
                                <div key={`${vote.experimentId}_${vote.agentId}_${idx}`} className="p-4 bg-purple-900/30 border border-purple-500/40 rounded-lg">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-medium text-zinc-100">{response.agentName}</h3>
                                            <p className="text-xs text-zinc-400 mt-1">
                                                {experiment?.title} • {new Date(vote.votedAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {vote.rating > 0 && (
                                                <div className="flex gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            size={14}
                                                            className={i < vote.rating ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            <Heart size={14} className="text-red-500 fill-red-500" />
                                        </div>
                                    </div>

                                    {vote.notes && (
                                        <div className="mb-3 text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded italic">
                                            "{vote.notes}"
                                        </div>
                                    )}

                                    <div className="text-sm text-zinc-300 leading-relaxed max-h-48 overflow-y-auto bg-zinc-900/50 p-3 rounded">
                                        {response.content}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    if (viewMode === 'leaderboard') {
        const leaderboardStats = getLeaderboard(enabledAgents.map(a => ({ id: a.id, name: a.name })));

        return (
            <div className="flex flex-col h-full bg-gradient-to-br from-zinc-950 via-purple-950 to-zinc-950 p-6 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-gradient-to-b from-zinc-950 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-purple-300">Agent Leaderboard</h1>
                        <p className="text-xs text-zinc-400 mt-1">Ranked by average user rating</p>
                    </div>
                    <button
                        onClick={() => setViewMode('history')}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition"
                    >
                        Back to History
                    </button>
                </div>

                {/* Leaderboard Table */}
                {leaderboardStats.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400">
                        <TrendingUp size={32} className="mx-auto mb-2 text-zinc-600" />
                        <p>No votes yet. Rate responses to build the leaderboard!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {leaderboardStats.map((stat, rank) => (
                            <div key={stat.agentId} className="p-4 bg-zinc-800/50 border border-purple-500/20 rounded-lg">
                                <div className="flex items-center gap-4">
                                    {/* Rank Badge */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center font-bold text-white">
                                        {rank + 1}
                                    </div>

                                    {/* Agent Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-zinc-100">{stat.agentName}</h3>
                                        <div className="flex gap-2 text-xs text-zinc-400 mt-1">
                                            <span>{stat.totalVotes} vote{stat.totalVotes !== 1 ? 's' : ''}</span>
                                            <span>•</span>
                                            <span>{stat.favoriteCount} favorite{stat.favoriteCount !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex-shrink-0 text-right">
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    size={12}
                                                    className={i < Math.round(stat.averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}
                                                />
                                            ))}
                                        </div>
                                        <div className="text-sm font-bold text-purple-300 mt-1">{stat.averageRating.toFixed(1)}</div>
                                    </div>

                                    {/* Win Rate */}
                                    <div className="flex-shrink-0 text-right">
                                        <div className="text-xs text-zinc-400">Win Rate</div>
                                        <div className="text-sm font-bold text-emerald-400">{stat.winRate}%</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
};
