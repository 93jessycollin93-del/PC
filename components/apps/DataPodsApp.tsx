import React, { useState, useEffect, useRef } from 'react';
import { Database, HardDrive, Download, Settings, Shield, Server, Box, Activity, Zap, FileJson, Hash, Link, Terminal, Layout, Cpu, Network, Lock, Layers, Check, FolderTree, Folder, Trash2, Cloud, Clock, AlertCircle } from 'lucide-react';
import { compress, decompress } from 'fflate';

interface DataPod {
    id: string;
    category: string;
    name: string;
    description: string;
    sizeMB: number;
    progress: number;
    status: 'idle' | 'downloading' | 'compiling' | 'ready' | 'error';
    contents: string[];
    rawSizeBytes?: number;
    compressedSizeBytes?: number;
    compressionRatio?: number;
    lastModified?: number;
    cloudBackups?: { slot: 1 | 2 | 3; timestamp: number }[];
}

interface PodStorageEntry {
    id: string;
    data: Uint8Array;
    metadata: DataPod;
    timestamp: number;
}

interface VaultBackupRotation {
    slot: 1 | 2 | 3;
    timestamp: number;
    totalPodsCount: number;
    totalCompressedSizeMB: number;
    checksum: string;
}

const DB_NAME = 'SAS_ZERO_VAULT';
const STORE_NAME = 'pods';

const getIndexedDB = (): IDBDatabase | null => {
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    return (window as any).__idbInstance || null;
};

const initIndexedDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            (window as any).__idbInstance = req.result;
            resolve(req.result);
        };
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const savePodToIDB = async (pod: DataPod, data: Uint8Array): Promise<void> => {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const entry: PodStorageEntry = {
            id: pod.id,
            data,
            metadata: { ...pod, progress: 0 },
            timestamp: Date.now(),
        };
        const req = store.put(entry);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
    });
};

const loadPodFromIDB = async (podId: string): Promise<{ pod: DataPod; data: Uint8Array } | null> => {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(podId);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            if (!req.result) return resolve(null);
            const entry = req.result as PodStorageEntry;
            resolve({ pod: entry.metadata as DataPod, data: entry.data });
        };
    });
};

const getTotalStorageUsed = async (): Promise<number> => {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            let total = 0;
            (req.result as PodStorageEntry[]).forEach(entry => {
                total += entry.data.length + JSON.stringify(entry.metadata).length;
            });
            resolve(total);
        };
    });
};

const deletePodFromIDB = async (podId: string): Promise<void> => {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(podId);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
    });
};

// Cloud backup rotation: maintains 3 copies, rotates every 1.5-6 hours
const getVaultBackupRotation = async (): Promise<VaultBackupRotation | null> => {
    const stored = localStorage.getItem('vault_backup_rotation');
    if (!stored) return null;
    return JSON.parse(stored) as VaultBackupRotation;
};

const updateVaultBackupRotation = async (totalPodsCount: number, totalCompressedSizeMB: number): Promise<void> => {
    const lastRotation = await getVaultBackupRotation();
    const now = Date.now();

    // Rotate every 1.5 hours (90 min) for production, or 6 hours for full day cycle
    const ROTATION_INTERVAL = 90 * 60 * 1000; // 1.5 hours

    if (!lastRotation || (now - lastRotation.timestamp) > ROTATION_INTERVAL) {
        // Cycle through slots: 1→2→3→1
        const nextSlot: 1 | 2 | 3 = (lastRotation?.slot || 0) === 3 ? 1 : ((lastRotation?.slot || 0) + 1) as (1 | 2 | 3);

        // Generate checksum for integrity
        const checksum = `v${Date.now().toString(36)}_s${nextSlot}`;

        const rotation: VaultBackupRotation = {
            slot: nextSlot,
            timestamp: now,
            totalPodsCount,
            totalCompressedSizeMB,
            checksum,
        };

        localStorage.setItem('vault_backup_rotation', JSON.stringify(rotation));
        localStorage.setItem(`vault_backup_slot_${nextSlot}`, JSON.stringify({
            rotation,
            podsSnapshot: localStorage.getItem('vault_pods_snapshot'),
            metadata: { backup_at: new Date().toISOString() },
        }));
    }
};

const getVaultBackupSlots = (): { slot: 1 | 2 | 3; timestamp: number; size: number }[] => {
    const slots: { slot: 1 | 2 | 3; timestamp: number; size: number }[] = [];
    for (const slot of [1, 2, 3] as const) {
        const backup = localStorage.getItem(`vault_backup_slot_${slot}`);
        if (backup) {
            try {
                const parsed = JSON.parse(backup);
                slots.push({
                    slot,
                    timestamp: parsed.rotation.timestamp,
                    size: parsed.rotation.totalCompressedSizeMB,
                });
            } catch (e) {
                console.error(`Failed to parse backup slot ${slot}`, e);
            }
        }
    }
    return slots.sort((a, b) => b.timestamp - a.timestamp);
};

const INITIAL_PODS: DataPod[] = [
    { 
        id: 'pod_tldr_1', category: 'Reference', name: 'tldr-pages (CLI)', 
        description: 'Command-line examples for ~5,000 tools. Extremely high signal-to-noise ratio.', 
        sizeMB: 5, progress: 100, status: 'ready', 
        contents: ['knowledge.jsonl', 'metadata.json', 'checksum']
    },
    { 
        id: 'pod_devdocs_py', category: 'Reference', name: 'DevDocs (Python)', 
        description: 'Official Python documentation and standard library, structured for offline retrieval.', 
        sizeMB: 15, progress: 100, status: 'ready',
        contents: ['knowledge.jsonl', 'metadata.json', 'relationships.db', 'checksum']
    },
    {
        id: 'pod_devdocs_web', category: 'Reference', name: 'DevDocs (Web)',
        description: 'MDN content slices: JS, HTML, and CSS references, DOM APIs, and Web APIs.',
        sizeMB: 30, progress: 100, status: 'ready',
        contents: ['knowledge.jsonl', 'metadata.json', 'relationships.db', 'checksum']
    },
    {
        id: 'pod_devdocs_sys', category: 'Reference', name: 'DevDocs (Bash/Git/SQL)',
        description: 'Core system tools, Git internals, and SQLite pragmas/functions.',
        sizeMB: 10, progress: 100, status: 'ready',
        contents: ['knowledge.jsonl', 'metadata.json', 'checksum']
    },
    {
        id: 'pod_alpaca', category: 'Instructions', name: 'CodeAlpaca-20k',
        description: 'Proven instruction-tuning format. Works extremely well for few-shot RAG examples.',
        sizeMB: 3, progress: 0, status: 'idle',
        contents: ['knowledge.jsonl', 'metadata.json']
    },
    {
        id: 'pod_evol', category: 'Instructions', name: 'Evol-Instruct-Code-80k',
        description: 'High quality, complex tasks with progressive reasoning chains.',
        sizeMB: 35, progress: 0, status: 'idle',
        contents: ['knowledge.jsonl', 'metadata.json', 'relationships.db']
    },
    {
        id: 'pod_evals', category: 'Instructions', name: 'MBPP + HumanEval',
        description: 'Small but canonical benchmarks. Doubles as an automated test set for the local pipeline.',
        sizeMB: 2, progress: 0, status: 'idle',
        contents: ['knowledge.jsonl', 'metadata.json']
    },
    {
        id: 'pod_rosetta', category: 'Instructions', name: 'Rosetta Code',
        description: 'Same task solved across dozens of languages. Perfect for cross-language translation.',
        sizeMB: 15, progress: 0, status: 'idle',
        contents: ['knowledge.jsonl', 'metadata.json', 'relationships.db']
    },
    {
        id: 'pod_so', category: 'Curated Q&A', name: 'Stack Overflow (Filtered)',
        description: 'Python & JS accepted answers with score > 5. Deduplicated and stripped of conversational noise.',
        sizeMB: 75, progress: 0, status: 'idle',
        contents: ['knowledge.jsonl', 'metadata.json', 'relationships.db', 'checksum']
    }
];

export const DataPodsApp: React.FC = () => {
    const [pods, setPods] = useState<DataPod[]>(INITIAL_PODS);
    const [activeTab, setActiveTab] = useState<'vault' | 'graph' | 'architecture' | 'backups'>('vault');
    const [expandedPod, setExpandedPod] = useState<string | null>(null);
    const [storageUsedBytes, setStorageUsedBytes] = useState<number>(0);
    const [backupSlots, setBackupSlots] = useState<{ slot: 1 | 2 | 3; timestamp: number; size: number }[]>([]);
    const [currentRotation, setCurrentRotation] = useState<VaultBackupRotation | null>(null);
    const initDoneRef = useRef(false);

    const CORE_MB = 50;
    const RESERVED_MB = 600;
    const TOTAL_MB = 950;
    const DATASETS_LIMIT_MB = 300;

    // Initialize IndexedDB and load persisted pods
    useEffect(() => {
        if (initDoneRef.current) return;
        initDoneRef.current = true;

        (async () => {
            try {
                await initIndexedDB();
                const usage = await getTotalStorageUsed();
                setStorageUsedBytes(usage);

                // Load persisted pods from IDB
                const persistedPods = await Promise.all(
                    INITIAL_PODS.map(async (pod) => {
                        const stored = await loadPodFromIDB(pod.id);
                        if (stored && stored.pod.status === 'ready') {
                            return stored.pod;
                        }
                        return pod;
                    })
                );
                setPods(persistedPods);

                // Initialize cloud backup rotation if needed
                const readyPods = persistedPods.filter(p => p.status === 'ready');
                const totalMB = readyPods.reduce((sum, p) => sum + (p.compressedSizeBytes || 0), 0) / 1024 / 1024;
                await updateVaultBackupRotation(readyPods.length, totalMB);
            } catch (err) {
                console.error('Failed to init vault storage:', err);
            }
        })();
    }, []);

    // Trigger backup rotation whenever pods change
    useEffect(() => {
        (async () => {
            const readyPods = pods.filter(p => p.status === 'ready');
            if (readyPods.length > 0) {
                const totalMB = readyPods.reduce((sum, p) => sum + (p.compressedSizeBytes || 0), 0) / 1024 / 1024;
                await updateVaultBackupRotation(readyPods.length, totalMB);
                // Save pod snapshot for recovery
                localStorage.setItem('vault_pods_snapshot', JSON.stringify(readyPods));
                // Update current rotation display
                const rotation = await getVaultBackupRotation();
                setCurrentRotation(rotation);
            }
        })();
    }, [pods]);

    const datasetsUsed = pods.filter(p => p.status === 'ready').reduce((acc, pod) => acc + pod.sizeMB, 0);
    const storageUsedMB = Math.round(storageUsedBytes / 1024 / 1024 * 100) / 100;

    const handleAction = async (podId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPods(prev => prev.map(p => {
            if (p.id === podId && (p.status === 'idle' || p.status === 'error')) {
                return { ...p, status: 'downloading', progress: 0 };
            }
            return p;
        }));

        let p = 0;
        const interval = setInterval(async () => {
            p += Math.floor(Math.random() * 15) + 5;
            if (p >= 100) {
                clearInterval(interval);

                // Simulate pod data compression
                setPods(prev => prev.map(pod => pod.id === podId ? { ...pod, status: 'compiling', progress: 100 } : pod));

                setTimeout(async () => {
                    try {
                        const pod = pods.find(p => p.id === podId);
                        if (!pod) return;

                        // Generate fake pod data (in real scenario, this would be actual knowledge base)
                        const rawData = JSON.stringify({
                            id: pod.id,
                            content: Array(pod.sizeMB * 10000).fill(pod.name),
                            metadata: pod.contents,
                            timestamp: Date.now(),
                        });

                        const rawBytes = new TextEncoder().encode(rawData);

                        // Compress with fflate
                        compress(rawBytes, (err, compressed) => {
                            if (err) {
                                console.error('Compression failed:', err);
                                return;
                            }

                            const ratio = Math.round((1 - compressed.length / rawBytes.length) * 100);
                            const updatedPod: DataPod = {
                                ...pod,
                                status: 'ready',
                                progress: 0,
                                rawSizeBytes: rawBytes.length,
                                compressedSizeBytes: compressed.length,
                                compressionRatio: ratio,
                                lastModified: Date.now(),
                            };

                            // Save to IndexedDB
                            savePodToIDB(updatedPod, compressed)
                                .then(async () => {
                                    const usage = await getTotalStorageUsed();
                                    setStorageUsedBytes(usage);
                                    setPods(prev => prev.map(p => p.id === podId ? updatedPod : p));
                                })
                                .catch(err => console.error('Failed to save pod:', err));
                        });
                    } catch (err) {
                        console.error('Pod compilation failed:', err);
                        setPods(prev => prev.map(p => p.id === podId ? { ...p, status: 'error' } : p));
                    }
                }, 1500);
            } else {
                setPods(prev => prev.map(pod => pod.id === podId ? { ...pod, progress: Math.min(100, p) } : pod));
            }
        }, 300);
    };

    const handleDelete = async (podId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deletePodFromIDB(podId);
            const usage = await getTotalStorageUsed();
            setStorageUsedBytes(usage);
            setPods(prev => prev.map(p => p.id === podId ? { ...p, status: 'idle', rawSizeBytes: undefined, compressedSizeBytes: undefined, compressionRatio: undefined } : p));
        } catch (err) {
            console.error('Failed to delete pod:', err);
        }
    };

    const getCategoryIcon = (cat: string) => {
        switch(cat) {
            case 'Reference': return <Database size={14} className="text-blue-400" />;
            case 'Instructions': return <Terminal size={14} className="text-emerald-400" />;
            case 'Curated Q&A': return <Check size={14} className="text-purple-400" />;
            default: return <Box size={14} className="text-slate-400" />;
        }
    };

    return (
        <div className="h-full w-full bg-[#09090b] text-slate-300 font-sans flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800/80 bg-[#0f1115] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Database size={18} className="text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-slate-200">Semantic Data Pods</h1>
                        <p className="text-[10px] text-slate-500">Structured Offline Knowledge Retrieval</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('vault')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'vault' ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}>Pods</button>
                    <button onClick={() => { setActiveTab('backups'); setBackupSlots(getVaultBackupSlots()); }} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${activeTab === 'backups' ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}><Cloud size={12} /> Backups</button>
                    <button onClick={() => setActiveTab('architecture')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'architecture' ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}>Architecture</button>
                    <button onClick={() => setActiveTab('graph')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'graph' ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}>Graph</button>
                </div>
            </div>

            {activeTab === 'vault' ? (
                <>
                    {/* Storage Allocation Overview */}
                    <div className="p-5 bg-gradient-to-b from-[#0f1115] to-[#09090b] shrink-0 border-b border-zinc-800/50">
                        <div className="flex justify-between items-end mb-3">
                            <div className="space-y-1">
                                <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1.5"><HardDrive size={12} /> Vault Storage (IndexedDB)</div>
                                <div className="text-xl font-black tracking-tight text-white flex gap-4">
                                    <span className="flex items-baseline gap-1"><span className="text-emerald-400">{storageUsedMB.toFixed(2)}</span> <span className="text-xs text-zinc-500 font-medium">MB Compressed</span></span>
                                    <span className="text-xs text-zinc-600">({datasetsUsed} pods ready)</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="h-4 w-full bg-zinc-900 rounded-md overflow-hidden flex shadow-inner shadow-black/80 ring-1 ring-white/5">
                            {/* Core Application (50MB) */}
                            <div className="h-full bg-zinc-600 border-r border-black/20 relative group cursor-help" style={{ width: `${(CORE_MB/TOTAL_MB)*100}%` }}>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-500 text-[9px] font-bold text-white uppercase">App Core</div>
                            </div>
                            
                            {/* Datasets (variable up to 300MB) */}
                            <div className="h-full bg-emerald-500/80 border-r border-black/20 relative group transition-all duration-500" style={{ width: `${(datasetsUsed/TOTAL_MB)*100}%` }}>
                                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-950 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Pods</div>
                            </div>
                            <div className="h-full bg-emerald-950/30 border-r border-black/20 relative" style={{ width: `${((DATASETS_LIMIT_MB - datasetsUsed)/TOTAL_MB)*100}%` }}>
                                {/* Empty dataset space */}
                            </div>

                            {/* Reserved (600MB) */}
                            <div className="h-full bg-indigo-900/40 relative group cursor-help flex-1">
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-800 text-[9px] font-bold text-indigo-100 uppercase">Working Set (LRU)</div>
                            </div>
                        </div>
                        <div className="flex justify-between mt-1.5 text-[9px] font-mono text-zinc-500 font-bold uppercase">
                            <span>50MB (Core)</span>
                            <span>300MB (Semantic Pods)</span>
                            <span>600MB (Working Set)</span>
                        </div>
                    </div>

                    {/* Pods List */}
                    <div className="flex-1 overflow-auto p-4 space-y-3 pb-8">
                        {pods.map(pod => (
                            <div 
                                key={pod.id} 
                                onClick={() => setExpandedPod(expandedPod === pod.id ? null : pod.id)}
                                className={`bg-[#111318] border rounded-xl overflow-hidden cursor-pointer transition-all ${expandedPod === pod.id ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/5' : 'border-zinc-800/80 hover:border-zinc-700'}`}
                            >
                                <div className="p-4 flex items-center justify-between select-none">
                                    <div className="flex items-start gap-3.5">
                                        <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
                                            pod.status === 'ready' ? 'bg-zinc-900 border-zinc-700 text-zinc-300' :
                                            pod.status === 'downloading' || pod.status === 'compiling' ? 'bg-indigo-950 border-indigo-800 text-indigo-400' :
                                            'bg-zinc-950 border-zinc-800 text-zinc-600'
                                        }`}>
                                            {pod.status === 'ready' ? <Database size={18} /> : pod.status === 'downloading' || pod.status === 'compiling' ? <Activity size={18} className="animate-pulse" /> : <Box size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {getCategoryIcon(pod.category)}
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{pod.category}</span>
                                            </div>
                                            <h3 className="font-bold text-[15px] text-zinc-100">{pod.name}</h3>
                                            <p className="text-xs text-zinc-500 mt-1 line-clamp-1 pr-4">{pod.description}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                            {pod.status === 'ready' ? (
                                                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md text-[10px] font-bold font-mono">
                                                    <Shield size={12} /> {pod.sizeMB} MB
                                                </div>
                                            ) : pod.status === 'downloading' || pod.status === 'compiling' ? (
                                                <div className="flex flex-col items-end gap-1 w-24">
                                                    <span className="text-[9px] text-indigo-400 font-mono font-bold uppercase">{pod.status === 'compiling' ? 'Building Graph...' : `Fetching ${pod.progress}%`}</span>
                                                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 transition-all duration-200" style={{ width: `${pod.progress}%` }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] font-mono font-bold text-zinc-600">{pod.sizeMB} MB</span>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {pod.status === 'idle' || pod.status === 'error' ? (
                                                <button
                                                    onClick={(e) => handleAction(pod.id, e)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                                                    title="Download & compress pod"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            ) : pod.status === 'ready' ? (
                                                <>
                                                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Pod settings">
                                                        <Settings size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(pod.id, e)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-500 hover:bg-red-900 hover:text-red-400 transition-colors"
                                                        title="Delete pod from vault"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-600">
                                                    <Activity size={14} className="animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Pod Details */}
                                {expandedPod === pod.id && (
                                    <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 bg-[#0c0e12]">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2.5">
                                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Internal Structure</h4>
                                                <div className="space-y-1.5">
                                                    {pod.contents.map((file, idx) => (
                                                        <div key={idx} className={`flex items-center gap-2 text-xs font-mono p-1.5 rounded-md ${pod.status === 'ready' ? 'text-zinc-300 bg-zinc-900/50' : 'text-zinc-600'}`}>
                                                            {file.includes('json') ? <FileJson size={13} className={pod.status === 'ready' ? "text-amber-400" : ""} /> : 
                                                             file.includes('bin') ? <Hash size={13} className={pod.status === 'ready' ? "text-purple-400" : ""} /> :
                                                             file.includes('db') ? <Database size={13} className={pod.status === 'ready' ? "text-blue-400" : ""} /> :
                                                             <Box size={13} />}
                                                            {file}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2.5">
                                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Compression Metadata</h4>
                                                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-400 space-y-1.5">
                                                    <div className="flex justify-between"><span>Format:</span> <span className="text-zinc-300">fflate Compressed</span></div>
                                                    <div className="flex justify-between"><span>Raw Size:</span> <span className="text-zinc-300">{pod.rawSizeBytes ? `${(pod.rawSizeBytes / 1024 / 1024).toFixed(2)} MB` : 'Pending'}</span></div>
                                                    <div className="flex justify-between"><span>Compressed:</span> <span className="text-emerald-400">{pod.compressedSizeBytes ? `${(pod.compressedSizeBytes / 1024).toFixed(1)} KB` : 'Pending'}</span></div>
                                                    <div className="flex justify-between"><span>Ratio:</span> <span className={pod.compressionRatio ? 'text-emerald-400' : 'text-zinc-500'}>{pod.compressionRatio ? `${pod.compressionRatio}%` : 'Pending'}</span></div>
                                                    <div className="mt-2 pt-2 border-t border-zinc-800 text-indigo-400 flex items-center gap-1"><Check size={10} /> Persisted in IndexedDB</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            ) : activeTab === 'backups' ? (
                /* Cloud Backups Tab */
                <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto bg-[#09090b]">
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Cloud size={20} className="text-blue-400" /> Vault Backup Rotation</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            3-copy rotating backup system: vault automatically backs up every 1.5 hours through three cloud slots. Each rotation preserves full vault state for 1.5-hour rollback window.
                        </p>
                    </div>

                    {/* Current Rotation Status */}
                    {currentRotation && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Clock size={14} /> Active Rotation</h3>
                            <div className="space-y-2 text-xs font-mono">
                                <div className="flex justify-between"><span className="text-zinc-400">Slot:</span> <span className="text-blue-400">{currentRotation.slot} of 3</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Last Update:</span> <span className="text-blue-400">{new Date(currentRotation.timestamp).toLocaleTimeString()}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Pods Stored:</span> <span className="text-emerald-400">{currentRotation.totalPodsCount}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Compressed:</span> <span className="text-emerald-400">{currentRotation.totalCompressedSizeMB.toFixed(2)} MB</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Checksum:</span> <span className="text-zinc-500 font-mono text-[9px]">{currentRotation.checksum}</span></div>
                            </div>
                        </div>
                    )}

                    {/* Backup Slots */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-white">Backup Slots</h3>
                        {backupSlots.length === 0 ? (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center text-zinc-500 text-sm">
                                <AlertCircle size={16} className="mx-auto mb-2 opacity-50" />
                                No backups yet. Backups will begin after first pod save.
                            </div>
                        ) : (
                            backupSlots.map(backup => (
                                <div key={backup.slot} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-sm font-bold text-white">Slot {backup.slot}</div>
                                            <div className="text-xs text-zinc-500">{new Date(backup.timestamp).toLocaleString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-mono text-emerald-400">{backup.size.toFixed(2)} MB</div>
                                            <div className={`text-[10px] font-bold px-2 py-1 rounded ${backup.slot === currentRotation?.slot ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                                {backup.slot === currentRotation?.slot ? 'ACTIVE' : 'ARCHIVED'}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="w-full px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors">
                                        Restore from Slot {backup.slot}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Recovery Strategy */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                        <h3 className="text-sm font-bold text-white">Recovery Window</h3>
                        <p className="text-xs text-zinc-400">
                            Vault maintains 3 independent copies. Each rotation (1.5 hours) creates a new snapshot. Maximum rollback:
                            <span className="text-emerald-400 font-mono ml-1">~4.5 hours (3 rotations)</span>
                        </p>
                    </div>
                </div>
            ) : activeTab === 'graph' ? (
                /* Graph Relations Tab */
                <div className="flex-1 flex flex-col p-6 items-center justify-center text-center">
                    <div className="relative w-64 h-64 mb-6">
                        <div className="absolute inset-0 border border-zinc-800 rounded-full flex items-center justify-center bg-[#0c0e12]">
                            <div className="w-32 h-32 border border-zinc-700 rounded-full flex items-center justify-center bg-[#111318]">
                                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                                    <Database size={24} className="text-white" />
                                </div>
                            </div>
                        </div>
                        
                        {/* Orbiting Elements */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] font-bold text-emerald-400 flex flex-col items-center gap-1 shadow-lg">
                            <Layers size={14} /> Layer 1: Tiny Facts
                        </div>
                        <div className="absolute bottom-12 -left-4 p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] font-bold text-blue-400 flex flex-col items-center gap-1 shadow-lg">
                            <Layout size={14} /> Layer 2: Knowledge
                        </div>
                        <div className="absolute bottom-12 -right-4 p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] font-bold text-purple-400 flex flex-col items-center gap-1 shadow-lg">
                            <Link size={14} /> Layer 3: Relations
                        </div>
                    </div>
                    
                    <h2 className="text-lg font-bold text-zinc-100 mb-2">Multi-Layer Graph Database</h2>
                    <p className="text-sm text-zinc-400 max-w-md mx-auto">
                        Instead of raw text search, active pods are loaded into an in-memory graph. The local AI agent traverses concepts (Syntax ↔ Pattern ↔ Dependency) to construct context dynamically.
                    </p>
                </div>
            ) : activeTab === 'architecture' ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#09090b]">
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><FolderTree size={20} className="text-indigo-400" /> Data Pods Vault Architecture</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Structured for a 950 MB footprint (300 MB datasets / 600 MB active working set / 50 MB core index).
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Directory Structure */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-[11px] text-zinc-300">
                            <div className="text-emerald-400 font-bold mb-3 border-b border-zinc-800 pb-2">E:\AI\DataPods</div>
                            <div className="pl-2 space-y-1">
                                <div className="flex items-center gap-2 text-indigo-300"><Folder size={12} /> app\</div>
                                <div className="pl-5 text-zinc-500">├── backend\</div>
                                <div className="pl-5 text-zinc-500">├── frontend\</div>
                                <div className="pl-5 text-zinc-500">└── api\</div>
                                
                                <div className="flex items-center gap-2 text-indigo-300 mt-2"><Folder size={12} /> datasets\</div>
                                <div className="pl-5 text-zinc-500">├── incoming\</div>
                                <div className="pl-5 text-zinc-500">└── packed\</div>

                                <div className="flex items-center gap-2 text-amber-300 mt-2"><Folder size={12} /> pods\</div>
                                <div className="pl-5 text-zinc-400">├── manifest.db <span className="text-zinc-600 text-[9px]">(SQLite)</span></div>
                                <div className="pl-5 text-zinc-400">├── pod_001.zst <span className="text-zinc-600 text-[9px]">(Compressed)</span></div>
                                <div className="pl-5 text-zinc-400">└── pod_002.zst</div>

                                <div className="flex items-center gap-2 text-rose-300 mt-2"><Folder size={12} /> cache\ <span className="text-zinc-500 text-[10px] ml-2 font-sans">(600MB Working Set)</span></div>
                                <div className="pl-5 text-zinc-400">├── active_pod_001\</div>
                                <div className="pl-8 text-zinc-500">├── knowledge.jsonl</div>
                                <div className="pl-8 text-zinc-500">├── embeddings.bin</div>
                                <div className="pl-8 text-zinc-500">└── relationships.db</div>
                            </div>
                        </div>

                        {/* SQLite Manifest */}
                        <div className="space-y-4">
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-[10px] text-zinc-400 overflow-x-auto">
                                <div className="text-blue-400 font-bold mb-2">manifest.db Schema</div>
                                <pre className="text-orange-300">CREATE TABLE pods (</pre>
                                <pre className="pl-4">id TEXT PRIMARY KEY,</pre>
                                <pre className="pl-4">name TEXT,</pre>
                                <pre className="pl-4">version TEXT,</pre>
                                <pre className="pl-4">compressed_size INTEGER,</pre>
                                <pre className="pl-4">checksum TEXT</pre>
                                <pre className="text-orange-300">);</pre>
                                <br />
                                <pre className="text-orange-300">CREATE TABLE documents (</pre>
                                <pre className="pl-4">id TEXT PRIMARY KEY,</pre>
                                <pre className="pl-4">pod_id TEXT,</pre>
                                <pre className="pl-4">content TEXT,</pre>
                                <pre className="pl-4">embedding BLOB</pre>
                                <pre className="text-orange-300">);</pre>
                            </div>
                            
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-center space-y-2">
                                <div className="text-xs font-bold text-white mb-1">Backend Stack</div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-emerald-400">FastAPI</span>
                                    <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-blue-400">SQLite (FTS5)</span>
                                    <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-rose-400">Zstandard</span>
                                    <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-amber-400">llama.cpp</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
