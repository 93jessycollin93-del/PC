import React, { useState, useEffect } from 'react';
import { Cloud, Plus, Trash2, Settings, BarChart3, GitBranch, Zap, HardDrive, ArrowRight, Database, Cpu, Share2, AlertCircle, CheckCircle, LinkIcon } from 'lucide-react';

interface CloudProvider {
    id: string;
    name: string;
    type: 'google' | 'azure' | 'aws';
    role: 'data' | 'training' | 'operation' | 'distribution';
    size_tb: number;
    used_tb: number;
    status: 'connected' | 'disconnected' | 'error';
    config?: {
        project_id?: string;
        subscription_id?: string;
        bucket_name?: string;
    };
}

interface DataPipeline {
    id: string;
    name: string;
    from: string;
    to: string;
    data_type: 'raw' | 'trained' | 'distribution';
    throughput_gb_day: number;
    status: 'active' | 'paused' | 'error';
    last_sync?: number;
}

interface KnowledgeDistribution {
    id: string;
    dataset_id: string;
    destination: 'meta' | 'google' | 'openai' | 'anthropic' | 'public';
    stage: 'staged' | 'in_distribution' | 'distributed' | 'public';
    size_gb: number;
    timestamp: number;
}

const CLOUD_ROLES = {
    data: { label: 'Data Cloud', color: 'from-blue-600 to-blue-900', icon: Database, capacity: 5 },
    training: { label: 'Training Cloud', color: 'from-purple-600 to-purple-900', icon: Cpu, capacity: 2 },
    operation: { label: 'Operation Cloud', color: 'from-emerald-600 to-emerald-900', icon: Zap, capacity: 1 },
    distribution: { label: 'Distribution', color: 'from-orange-600 to-orange-900', icon: Share2, capacity: 0.5 },
};

export const CloudInfrastructureApp: React.FC = () => {
    const [providers, setProviders] = useState<CloudProvider[]>([]);
    const [pipelines, setPipelines] = useState<DataPipeline[]>([]);
    const [distributions, setDistributions] = useState<KnowledgeDistribution[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [showNewProvider, setShowNewProvider] = useState(false);
    const [newProviderForm, setNewProviderForm] = useState<Partial<CloudProvider>>({});

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('cloud_infrastructure');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setProviders(data.providers || []);
                setPipelines(data.pipelines || []);
                setDistributions(data.distributions || []);
            } catch (e) {
                console.error('Failed to load cloud infrastructure:', e);
            }
        }
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('cloud_infrastructure', JSON.stringify({
            providers,
            pipelines,
            distributions,
        }));
    }, [providers, pipelines, distributions]);

    const addProvider = () => {
        if (!newProviderForm.name || !newProviderForm.type || !newProviderForm.role) return;

        const provider: CloudProvider = {
            id: `cloud_${Date.now()}`,
            name: newProviderForm.name,
            type: newProviderForm.type as 'google' | 'azure' | 'aws',
            role: newProviderForm.role as 'data' | 'training' | 'operation' | 'distribution',
            size_tb: newProviderForm.size_tb || 0,
            used_tb: 0,
            status: 'disconnected',
            config: {},
        };

        setProviders([...providers, provider]);
        setNewProviderForm({});
        setShowNewProvider(false);
    };

    const deleteProvider = (id: string) => {
        setProviders(providers.filter(p => p.id !== id));
        setPipelines(pipelines.filter(p => p.from !== id && p.to !== id));
    };

    const totalCapacity = providers.reduce((sum, p) => sum + p.size_tb, 0);
    const totalUsed = providers.reduce((sum, p) => sum + p.used_tb, 0);

    const getRoleIcon = (role: string) => {
        const info = CLOUD_ROLES[role as keyof typeof CLOUD_ROLES];
        return info?.icon || Database;
    };

    const getRoleLabel = (role: string) => {
        const info = CLOUD_ROLES[role as keyof typeof CLOUD_ROLES];
        return info?.label || role;
    };

    return (
        <div className="h-full w-full bg-[#09090b] text-slate-300 font-sans flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800/80 bg-[#0f1115] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Cloud size={18} className="text-blue-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-200">Cloud Infrastructure</h1>
                        <p className="text-[10px] text-slate-500">{totalUsed.toFixed(1)}TB / {totalCapacity}TB used</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowNewProvider(!showNewProvider)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                        <Plus size={12} className="inline mr-1" />
                        Add Cloud
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 space-y-6">
                    {/* Storage Overview */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart3 size={14} className="text-blue-400" />
                            Total Infrastructure Capacity
                        </h2>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-zinc-400">Storage Usage</span>
                                <span className="text-blue-400 font-bold">{totalUsed.toFixed(1)} TB / {totalCapacity} TB</span>
                            </div>
                            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                                    style={{ width: totalCapacity > 0 ? `${(totalUsed / totalCapacity) * 100}%` : '0%' }}
                                />
                            </div>
                            <div className="grid grid-cols-4 gap-2 pt-2">
                                {Object.entries(CLOUD_ROLES).map(([role, info]) => {
                                    const roleProviders = providers.filter(p => p.role === role);
                                    const roleCapacity = roleProviders.reduce((sum, p) => sum + p.size_tb, 0);
                                    const roleUsed = roleProviders.reduce((sum, p) => sum + p.used_tb, 0);
                                    return (
                                        <div key={role} className={`bg-gradient-to-br ${info.color} rounded-lg p-2 border border-black/30`}>
                                            <div className="text-[9px] font-bold text-white">{info.label}</div>
                                            <div className="text-[10px] text-white/80 mt-1">{roleUsed.toFixed(1)} / {roleCapacity} TB</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* New Provider Form */}
                    {showNewProvider && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-bold text-white">Add Cloud Provider</h3>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Cloud name (e.g. Google Cloud 1)"
                                    value={newProviderForm.name || ''}
                                    onChange={(e) => setNewProviderForm({ ...newProviderForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={newProviderForm.type || ''}
                                        onChange={(e) => setNewProviderForm({ ...newProviderForm, type: e.target.value as any })}
                                        className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
                                    >
                                        <option value="">Provider Type</option>
                                        <option value="google">Google Cloud</option>
                                        <option value="azure">Microsoft Azure</option>
                                        <option value="aws">AWS</option>
                                    </select>
                                    <select
                                        value={newProviderForm.role || ''}
                                        onChange={(e) => setNewProviderForm({ ...newProviderForm, role: e.target.value as any })}
                                        className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
                                    >
                                        <option value="">Cloud Role</option>
                                        <option value="data">Data Cloud (Raw datasets)</option>
                                        <option value="training">Training Cloud (Model training)</option>
                                        <option value="operation">Operation Cloud (Live inference)</option>
                                        <option value="distribution">Distribution (Public access)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 mb-1 block">Capacity (TB)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 5"
                                        value={newProviderForm.size_tb || ''}
                                        onChange={(e) => setNewProviderForm({ ...newProviderForm, size_tb: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600"
                                    />
                                </div>
                                <button
                                    onClick={addProvider}
                                    disabled={!newProviderForm.name || !newProviderForm.type || !newProviderForm.role}
                                    className="w-full px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                                >
                                    Create Provider
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Cloud Providers */}
                    {providers.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-white">Connected Clouds</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {providers.map(provider => {
                                    const Icon = getRoleIcon(provider.role);
                                    return (
                                        <div
                                            key={provider.id}
                                            onClick={() => setSelectedProvider(provider.id)}
                                            className={`border rounded-lg p-3 cursor-pointer transition-all ${
                                                selectedProvider === provider.id
                                                    ? 'bg-zinc-800 border-blue-500/50'
                                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-start gap-2 flex-1">
                                                    <Icon size={16} className="text-blue-400 mt-0.5" />
                                                    <div>
                                                        <h3 className="text-xs font-bold text-white">{provider.name}</h3>
                                                        <p className="text-[10px] text-zinc-400">{provider.type.toUpperCase()}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteProvider(provider.id);
                                                    }}
                                                    className="p-1 hover:bg-red-900/20 rounded text-red-400"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] text-zinc-400">
                                                    <span>{getRoleLabel(provider.role)}</span>
                                                    <span className={provider.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}>
                                                        {provider.status === 'connected' ? '● Connected' : '● Disconnected'}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500"
                                                        style={{ width: provider.size_tb > 0 ? `${(provider.used_tb / provider.size_tb) * 100}%` : '0%' }}
                                                    />
                                                </div>
                                                <div className="text-[9px] text-zinc-500 text-right">
                                                    {provider.used_tb.toFixed(1)} / {provider.size_tb} TB
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Data Pipeline Visualization */}
                    {providers.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <GitBranch size={14} className="text-purple-400" />
                                Data Pipeline Flow
                            </h2>
                            <div className="space-y-3">
                                <div className="text-[10px] text-zinc-400 bg-zinc-950 rounded p-2 border border-zinc-800">
                                    <div className="font-mono space-y-1">
                                        <div className="text-blue-400">DATA CLOUD</div>
                                        <div className="text-zinc-500">↓ Raw user datasets from chats</div>
                                        <div className="text-purple-400">TRAINING CLOUD</div>
                                        <div className="text-zinc-500">↓ Train models on personal data</div>
                                        <div className="text-emerald-400">OPERATION CLOUD</div>
                                        <div className="text-zinc-500">↓ Live inference & API access</div>
                                        <div className="text-orange-400">DISTRIBUTION</div>
                                        <div className="text-zinc-500">↓ Major AIs first, then public</div>
                                        <div className="text-amber-400">FEEDBACK LOOP</div>
                                        <div className="text-zinc-500">← New knowledge back to DATA</div>
                                    </div>
                                </div>
                                <div className="text-xs text-zinc-400 p-2 bg-zinc-950 rounded border border-zinc-800">
                                    <p><span className="text-white font-bold">Status:</span> Pipeline framework configured. Ready to connect real clouds.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Getting Started */}
                    {providers.length === 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
                            <AlertCircle size={24} className="mx-auto text-blue-400 opacity-50" />
                            <h3 className="text-sm font-bold text-white">Start Building Your Infrastructure</h3>
                            <p className="text-xs text-zinc-400">
                                Add your Google, Azure, or AWS clouds above to begin. Your data pipeline will flow:
                            </p>
                            <div className="text-[10px] text-zinc-500 font-mono space-y-1 mt-3">
                                <div>5TB Google Cloud (Data) → 2TB Google Cloud (Training)</div>
                                <div>→ Operation Cloud → Distribution → Public</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
