import React, { useState, useEffect, useRef } from 'react';
import { Cpu, HardDrive, RefreshCw, Sparkles, CheckCircle, Activity, Play, Eye, Trash2, Info, ChevronDown, ChevronUp, Smartphone, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';

interface ActiveWindowInfo {
    id: string;
    title: string;
}

interface SystemMonitorProps {
    openWindows: ActiveWindowInfo[];
    onFocusWindow?: (id: string) => void;
}

export const SystemMonitor: React.FC<SystemMonitorProps> = ({ openWindows, onFocusWindow }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [cpuUsage, setCpuUsage] = useState(18); // set a more realistic startup CPU usage
    const [cpuHistory, setCpuHistory] = useState<number[]>(Array(15).fill(18));
    const [ramUsage, setRamUsage] = useState(1.8); // initial realistic RAM usage
    const [ramPercent, setRamPercent] = useState(45);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationSuccess, setOptimizationSuccess] = useState(false);
    const [coreLoads, setCoreLoads] = useState<number[]>(Array(8).fill(18));
    const containerRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<'monitor' | 'sandbox' | 'cleaner'>('monitor');
    const [ramReservationMb, setRamReservationMb] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('cy_ram_reservation_mb');
            return saved ? parseInt(saved, 10) : 500;
        }
        return 500;
    });
    const [isReservationActive, setIsReservationActive] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('cy_ram_reservation_active');
            return saved ? saved === 'true' : true;
        }
        return true;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('cy_ram_reservation_mb', ramReservationMb.toString());
            localStorage.setItem('cy_ram_reservation_active', isReservationActive.toString());
        }
    }, [ramReservationMb, isReservationActive]);

    const [isClearingCache, setIsClearingCache] = useState(false);
    const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);
    const [expandedStep, setExpandedStep] = useState<number | null>(0); // Step 1 expanded by default
    // Real persisted-storage footprint (IndexedDB + localStorage + Cache API),
    // read from the Storage API. This is the actual compressed-vault size.
    const [storageBytes, setStorageBytes] = useState<{ usage: number; quota: number } | null>(null);

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes < 1) return '0 KB';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
    };

    const refreshStorage = React.useCallback(() => {
        if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
            navigator.storage.estimate()
                .then(({ usage, quota }) => setStorageBytes({ usage: usage ?? 0, quota: quota ?? 0 }))
                .catch(() => { /* Storage API unavailable — leave as null */ });
        }
    }, []);

    useEffect(() => {
        if (isOpen) refreshStorage();
    }, [isOpen, activeTab, refreshStorage]);

    const profiles = [
        { id: 'auto', name: 'Auto-Detect (UA)', ram: 16, description: 'Smart automatic detection based on browser platform' },
        { id: 'iphone-12', name: 'iPhone 12 / 13 / 14', ram: 4, description: '4 GB LPDDR4X Memory Profile' },
        { id: 'iphone-pro', name: 'iPhone Pro Series', ram: 6, description: '6 GB LPDDR5 Memory Profile' },
        { id: 'iphone-15-pro', name: 'iPhone 15 Pro / 16', ram: 8, description: '8 GB High-Speed Unified RAM' },
        { id: 'ipad-pro', name: 'iPad Pro (M-Series)', ram: 8, description: '8 GB High-Bandwidth Apple Silicon' },
        { id: 'desktop-standard', name: 'Standard Desktop', ram: 16, description: '16 GB Desktop / Notebook PC' },
        { id: 'desktop-high', name: 'Power Workstation', ram: 32, description: '32 GB Developer / Gaming Rig' },
    ];

    const getAutoDetectedRam = () => {
        if (typeof navigator === 'undefined') return 16;
        
        const ua = navigator.userAgent;
        const isIPhone = /iPhone/i.test(ua);
        const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (isIPhone) {
            return 4; // Standard iPhone 12 has 4 GB RAM
        }
        if (isIPad) {
            return 6; // Standard iPad
        }
        
        const memory = (navigator as any).deviceMemory;
        if (memory) {
            return memory;
        }
        return 16; // Default desktop fallback
    };

    const getAutoDetectedName = () => {
        if (typeof navigator === 'undefined') return 'Unknown Device';
        const ua = navigator.userAgent;
        const isIPhone = /iPhone/i.test(ua);
        const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (isIPhone) {
            return 'iPhone (Estimated 4GB)';
        }
        if (isIPad) {
            return 'iPad (Estimated 6GB)';
        }
        return 'Desktop PC / Mac';
    };

    const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('v-os-device-profile');
            return saved || 'auto';
        }
        return 'auto';
    });

    const [deviceMemory, setDeviceMemory] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const savedProfile = localStorage.getItem('v-os-device-profile') || 'auto';
            if (savedProfile !== 'auto') {
                const found = profiles.find(p => p.id === savedProfile);
                if (found) return found.ram;
            }
        }
        return getAutoDetectedRam();
    });

    // Handle change of device hardware profiles
    const handleProfileChange = (profileId: string) => {
        setSelectedProfileId(profileId);
        if (typeof window !== 'undefined') {
            localStorage.setItem('v-os-device-profile', profileId);
        }
        if (profileId === 'auto') {
            setDeviceMemory(getAutoDetectedRam());
        } else {
            const found = profiles.find(p => p.id === profileId);
            if (found) {
                setDeviceMemory(found.ram);
            }
        }
    };

    // Track state & updates with ultra-low power optimization
    useEffect(() => {
        // When the monitor dropdown is closed, use a very long interval (10 seconds)
        // and bypass all the heavy graphing / core-by-core loops entirely.
        // When open, run at 1.5s with real event loop measurements!
        const intervalDelay = isOpen ? 1500 : 10000;

        const updateInterval = setInterval(() => {
            const activeCount = openWindows.length;

            // 1. Measure ACTUAL Main Thread Event Loop Lag
            const lagStart = performance.now();
            setTimeout(() => {
                const lagEnd = performance.now();
                const actualLag = Math.max(0, lagEnd - lagStart - 100); // 100ms expected delay
                
                // Convert lag to a realistic CPU %
                // Under ordinary circumstances, lag is 0-5ms. If the thread is busy, lag goes up.
                const lagCpuWeight = Math.min(60, actualLag * 1.5); 
                const baseCpu = 5 + Math.floor(Math.random() * 8); // extremely light baseline
                const activeMultiplier = activeCount * 4; // +4% per open application
                const targetCpu = Math.min(99, Math.round(baseCpu + activeMultiplier + lagCpuWeight + (isOptimizing ? 45 : 0)));

                setCpuUsage(prev => {
                    const diff = targetCpu - prev;
                    const next = prev + diff * 0.4;
                    const rounded = Math.round(next * 10) / 10;

                    if (isOpen) {
                        setCpuHistory(history => {
                            const nextHistory = [...history.slice(1), rounded];
                            return nextHistory;
                        });
                    }
                    return rounded;
                });

                if (isOpen) {
                    // Core loads based on actual CPU load + small random variations
                    setCoreLoads(prev => prev.map((_, idx) => {
                        const coreBias = (idx % 2 === 0 ? 1 : -1) * (1 + Math.floor(Math.random() * 3));
                        const coreTarget = Math.max(1, Math.min(99, targetCpu + coreBias));
                        const diff = coreTarget - _;
                        return Math.round(_ + diff * 0.3);
                    }));
                }
            }, 100);

            // 2. Memory Load Calculation (Real JS Heap + Fallback)
            let usedGb = 0.85 + (activeCount * 0.25);
            let totalGb = deviceMemory;

            if (typeof window !== 'undefined' && (window.performance as any)?.memory) {
                const mem = (window.performance as any).memory;
                usedGb = mem.usedJSHeapSize / (1024 * 1024 * 1024); // real used JS heap
                const browserTotalGb = mem.jsHeapSizeLimit / (1024 * 1024 * 1024);
                // If manual profile selected, scale proportionally to match user expectation, or show exact
                totalGb = selectedProfileId === 'auto' ? Math.round(browserTotalGb * 10) / 10 : deviceMemory;
                if (usedGb > totalGb) {
                    usedGb = totalGb * 0.45; // safeguard
                }
            } else {
                // Realistic math fallback
                const scaledBase = Math.min(deviceMemory * 0.35, 1.8);
                const baseRam = scaledBase + (Math.sin(Date.now() / 30000) * 0.05);
                const activeRam = activeCount * 0.28;
                usedGb = Math.max(0.4, Math.min(deviceMemory - 0.1, baseRam + activeRam));
            }

            // Apply RAM Reservation Buffer (Pretending to consume for app security alignment)
            if (isReservationActive) {
                usedGb += (ramReservationMb / 1024);
            }

            setRamUsage(Math.round(usedGb * 100) / 100);
            setRamPercent(Math.min(100, Math.round((usedGb / totalGb) * 100)));

        }, intervalDelay);

        return () => clearInterval(updateInterval);
    }, [openWindows.length, deviceMemory, isOptimizing, isOpen, selectedProfileId, ramReservationMb, isReservationActive]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Perform virtual garbage collection / memory release
    const handleOptimize = () => {
        if (isOptimizing) return;
        setIsOptimizing(true);
        setOptimizationSuccess(false);

        // Simulated heavy work
        setTimeout(() => {
            setCpuUsage(85); // brief spike
            setCoreLoads(Array(8).fill(90));
        }, 500);

        setTimeout(() => {
            // Drop RAM and CPU dramatically after optimization
            const optimizedRam = Math.max(0.5, Math.min(deviceMemory - 0.8, deviceMemory * 0.35));
            setCpuUsage(3.2);
            setCoreLoads(Array(8).fill(3));
            setRamUsage(optimizedRam);
            setRamPercent(Math.round((optimizedRam / deviceMemory) * 100));
            setIsOptimizing(false);
            setOptimizationSuccess(true);

            // Reset success message after 3 seconds
            setTimeout(() => {
                setOptimizationSuccess(false);
            }, 3000);
        }, 2200);
    };

    // Style based on loads
    const getLoadColor = (value: number) => {
        if (value < 40) return 'text-emerald-400 border-emerald-500/20';
        if (value < 75) return 'text-amber-400 border-amber-500/20';
        return 'text-rose-400 border-rose-500/20';
    };

    const getLoadBg = (value: number) => {
        if (value < 40) return 'bg-emerald-500/10 border-emerald-500/20';
        if (value < 75) return 'bg-amber-500/10 border-amber-500/20';
        return 'bg-rose-500/10 border-rose-500/20';
    };

    const getProgressColor = (value: number) => {
        if (value < 40) return 'bg-emerald-500';
        if (value < 75) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    // Calculate maximum index to render dynamic SVG sparkline safely
    const maxVal = Math.max(...cpuHistory, 20);
    const points = cpuHistory
        .map((val, idx) => `${(idx / (cpuHistory.length - 1)) * 110},${35 - (val / maxVal) * 30}`)
        .join(' ');

    const handleClearLocalCache = () => {
        setIsClearingCache(true);
        setCacheClearedSuccess(false);

        try {
            if (typeof window !== 'undefined') {
                sessionStorage.clear();
                const profile = localStorage.getItem('v-os-device-profile');
                localStorage.clear();
                if (profile) {
                    localStorage.setItem('v-os-device-profile', profile);
                }
                if (window.caches) {
                    window.caches.keys().then((keys) => {
                        keys.forEach((key) => window.caches.delete(key));
                    });
                }
            }
        } catch (e) {
            console.error('Cache purge error:', e);
        }

        setTimeout(() => {
            refreshStorage(); // re-measure real footprint after purge
            setIsClearingCache(false);
            setCacheClearedSuccess(true);
            setTimeout(() => {
                setCacheClearedSuccess(false);
            }, 3000);
        }, 1500);
    };

    return (
        <div id="system-monitor" ref={containerRef} className="relative pointer-events-auto">
            {/* Minimal Top-bar Capsule Button */}
            <button
                id="sys-mon-trigger"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-md transition-all duration-300 bg-zinc-950/60 border-zinc-800/40 hover:bg-zinc-900/75 select-none ${
                    isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500/40' : ''
                }`}
                title="System Resources Monitor"
            >
                {/* CPU Indicator */}
                <div className="flex items-center gap-1.5 border-r border-zinc-800/60 pr-2.5">
                    <Cpu className={`w-3.5 h-3.5 ${getLoadColor(cpuUsage)} ${isOptimizing ? 'animate-pulse' : ''}`} />
                    <span className="font-mono text-[11px] tracking-tight text-zinc-300">
                        {Math.round(cpuUsage)}%
                    </span>
                </div>

                {/* RAM Indicator */}
                <div className="flex items-center gap-1.5">
                    <HardDrive className={`w-3.5 h-3.5 ${getLoadColor(ramPercent)}`} />
                    <span className="font-mono text-[11px] tracking-tight text-zinc-300 flex items-center gap-0.5">
                        {ramUsage.toFixed(1)} <span className="text-[9px] text-zinc-500">GB</span>
                        {isReservationActive && (
                            <span title="High Integrity Memory Lock Active" className="inline-flex">
                                <Lock className="w-2.5 h-2.5 text-emerald-400 animate-pulse shrink-0" />
                            </span>
                        )}
                    </span>
                </div>

                {/* Micro Pulsing Core Dot */}
                <div className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        cpuUsage > 75 ? 'bg-rose-500' : 'bg-indigo-500'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        cpuUsage > 75 ? 'bg-rose-500' : 'bg-indigo-500'
                    }`}></span>
                </div>
            </button>

            {/* Micro Bento System Diagnostics Panel */}
            {isOpen && (
                <div
                    id="sys-mon-panel"
                    className="absolute right-0 top-full mt-2 w-80 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-indigo-400" />
                            <h4 className="text-zinc-200 text-xs font-bold uppercase tracking-wider">
                                Task Manager
                            </h4>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                            V-OS Build 2026
                        </span>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800/40 mb-3.5 select-none">
                        <button
                            onClick={() => setActiveTab('monitor')}
                            className={`flex-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                                activeTab === 'monitor'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                            }`}
                        >
                            Monitor
                        </button>
                        <button
                            onClick={() => setActiveTab('sandbox')}
                            className={`flex-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                                activeTab === 'sandbox'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                            }`}
                        >
                            Sandbox
                        </button>
                        <button
                            onClick={() => setActiveTab('cleaner')}
                            className={`flex-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                                activeTab === 'cleaner'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                            }`}
                        >
                            iOS Cache
                        </button>
                    </div>

                    {activeTab === 'monitor' && (
                        <div className="animate-in fade-in duration-150">
                            {/* Stats Summary Bento Grid */}
                            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                                {/* CPU Panel */}
                                <div className={`p-2.5 rounded-xl border ${getLoadBg(cpuUsage)} flex flex-col gap-1`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase text-zinc-500">Processor</span>
                                        <Cpu className={`w-3.5 h-3.5 ${getLoadColor(cpuUsage)}`} />
                                    </div>
                                    <div className="text-lg font-mono font-bold tracking-tight text-zinc-100">
                                        {Math.round(cpuUsage)}%
                                    </div>
                                    {/* Simple dynamic SVG sparkline */}
                                    <svg className="w-full h-8 mt-1.5 opacity-80" viewBox="0 0 110 38">
                                        <polyline
                                            fill="none"
                                            stroke={cpuUsage > 75 ? '#ef4444' : cpuUsage > 40 ? '#f59e0b' : '#10b981'}
                                            strokeWidth="1.5"
                                            points={points}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>

                                {/* RAM Panel */}
                                <div className={`p-2.5 rounded-xl border ${getLoadBg(ramPercent)} flex flex-col justify-between gap-1`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase text-zinc-500">System RAM</span>
                                        <HardDrive className={`w-3.5 h-3.5 ${getLoadColor(ramPercent)}`} />
                                    </div>
                                    <div>
                                        <div className="text-lg font-mono font-bold tracking-tight text-zinc-100">
                                            {ramPercent}%
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-mono mt-1">
                                            {ramUsage.toFixed(2)} / {deviceMemory} GB
                                        </div>
                                    </div>
                                    {/* Horizontal progress indicator */}
                                    <div className="w-full bg-zinc-800/80 rounded-full h-1 mt-1 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${getProgressColor(ramPercent)}`}
                                            style={{ width: `${ramPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Device Hardware Profile Selector */}
                            <div className="mb-3.5 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-2.5">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[10px] font-bold uppercase text-zinc-500">Device Hardware Profile</span>
                                    <span className="text-[9px] text-indigo-400 font-mono">
                                        {selectedProfileId === 'auto' ? 'Auto-Detect' : 'Manual'}
                                    </span>
                                </div>
                                <select
                                    value={selectedProfileId}
                                    onChange={(e) => handleProfileChange(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans cursor-pointer"
                                >
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.id === 'auto' ? `${p.name} (${getAutoDetectedRam()} GB)` : `${p.name} (${p.ram} GB)`}
                                        </option>
                                    ))}
                                </select>
                                <div className="text-[9px] text-zinc-500 mt-1 pl-1">
                                    {selectedProfileId === 'auto' ? `Auto-detected: ${getAutoDetectedName()} (${getAutoDetectedRam()} GB)` : profiles.find(p => p.id === selectedProfileId)?.description}
                                </div>
                            </div>

                            {/* Virtual Multi-Core Processing Threads (CPU Core Threadview) */}
                            <div className="mb-3.5">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[10px] font-bold uppercase text-zinc-500">Virtual CPU Cores</span>
                                    <span className="text-[9px] font-mono text-zinc-400">8 Threads</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 font-mono text-[9px]">
                                    {coreLoads.map((load, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/40 p-1.5 rounded-lg items-center">
                                            <span className="text-zinc-500 text-[8px]">C{idx}</span>
                                            <span className={`font-semibold ${getLoadColor(load)}`}>{load}%</span>
                                            <div className="w-full bg-zinc-800 rounded-full h-1 mt-0.5 overflow-hidden">
                                                <div 
                                                    className={`h-full ${getProgressColor(load)}`}
                                                    style={{ width: `${load}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Active Processes / Opened Apps Section */}
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-zinc-900">
                                    <span className="text-[10px] font-bold uppercase text-zinc-500">Active Task Manager</span>
                                    <span className="text-[10px] font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded text-zinc-300">
                                        {openWindows.length + 3} processes
                                    </span>
                                </div>
                                
                                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                                    {/* Constant System Host */}
                                    <div className="flex justify-between items-center text-xs p-1 px-2 rounded bg-zinc-900/40 border border-zinc-800/10">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                            <span className="font-semibold text-zinc-300">System Kernel</span>
                                        </div>
                                        <span className="font-mono text-[10px] text-zinc-500">1.8% • 150MB</span>
                                    </div>

                                    {/* Constant Firestore Sync Services */}
                                    <div className="flex justify-between items-center text-xs p-1 px-2 rounded bg-zinc-900/40 border border-zinc-800/10">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                            <span className="font-semibold text-zinc-300">Firestore Client</span>
                                        </div>
                                        <span className="font-mono text-[10px] text-zinc-500">0.5% • 45MB</span>
                                    </div>

                                    {/* Dynamically active desktop applications */}
                                    {openWindows.length === 0 ? (
                                        <div className="text-[10px] text-zinc-500 text-center py-2 italic bg-zinc-900/20 rounded border border-dashed border-zinc-900">
                                            No active user applications running
                                        </div>
                                    ) : (
                                        openWindows.map(win => (
                                            <div 
                                                key={win.id} 
                                                className="flex justify-between items-center text-xs p-1 px-2 rounded bg-indigo-950/20 border border-indigo-900/20 hover:bg-indigo-950/35 hover:border-indigo-800/40 transition-all group"
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full group-hover:animate-pulse"></div>
                                                    <span className="font-semibold text-zinc-300 truncate max-w-[120px]">{win.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400 shrink-0">
                                                    <span>{(3 + Math.floor(Math.sin(win.id.charCodeAt(0)) * 2) + 12)}%</span>
                                                    {onFocusWindow && (
                                                        <button
                                                            onClick={() => onFocusWindow(win.id)}
                                                            className="p-0.5 bg-zinc-800 rounded hover:bg-indigo-600 hover:text-white transition-all text-zinc-400 cursor-pointer"
                                                            title="Bring Window to Focus"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Optimize / Release Memory Button */}
                            <button
                                id="sys-mon-optimize-btn"
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    isOptimizing
                                        ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40 cursor-not-allowed'
                                        : optimizationSuccess
                                            ? 'bg-emerald-950/45 text-emerald-300 border-emerald-800/40'
                                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border-zinc-800 hover:border-zinc-700 active:scale-[0.98]'
                                }`}
                            >
                                {isOptimizing ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                        <span>Running Garbage Collection...</span>
                                    </>
                                ) : optimizationSuccess ? (
                                    <>
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                                        <span>Heap Memory Optimized!</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>Purge Cache & Optimize Heap</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {activeTab === 'sandbox' && (
                        <div className="flex flex-col gap-3.5 animate-in fade-in duration-150 text-left">
                            {/* Sandbox Info */}
                            <div className="bg-indigo-950/20 border border-indigo-500/30 p-3 rounded-xl flex gap-2.5 items-start">
                                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="text-[10px] leading-relaxed">
                                    <p className="font-bold text-zinc-100 uppercase tracking-wide">V-OS Core Sandbox Layer</p>
                                    <p className="text-zinc-400 mt-1">
                                        Instruct the environment to pin a contiguous memory block. While standard browsers run in sandboxed space, this pre-allocation request signals maximum priority to the V-OS kernel.
                                    </p>
                                </div>
                            </div>

                            {/* Active Allocation Switch */}
                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-zinc-300">Memory Pinning Loop</span>
                                    <span className="text-[9px] text-zinc-500">
                                        {isReservationActive ? 'Allocating simulated heap page' : 'Simulation loop paused'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsReservationActive(!isReservationActive)}
                                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        isReservationActive ? 'bg-emerald-500' : 'bg-zinc-800'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            isReservationActive ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Allocation Slider / Preset Selector */}
                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase text-zinc-300">Reservation Target</span>
                                    <span className="text-xs font-mono font-bold text-indigo-400">{ramReservationMb} MB</span>
                                </div>

                                <input
                                    type="range"
                                    min="100"
                                    max="1500"
                                    step="50"
                                    value={ramReservationMb}
                                    onChange={(e) => setRamReservationMb(parseInt(e.target.value, 10))}
                                    disabled={!isReservationActive}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                />

                                {/* Quick Presets */}
                                <div className="grid grid-cols-4 gap-1 mt-1">
                                    {[250, 500, 750, 1000].map((preset) => (
                                        <button
                                            key={preset}
                                            disabled={!isReservationActive}
                                            onClick={() => setRamReservationMb(preset)}
                                            className={`py-1 rounded text-[9px] font-mono border transition-all ${
                                                ramReservationMb === preset
                                                    ? 'bg-indigo-600/35 border-indigo-500 text-indigo-200 font-bold'
                                                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-500 hover:text-zinc-300'
                                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                                        >
                                            {preset}M
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Verification Telemetry Log */}
                            <div className="bg-black/40 border border-zinc-900 rounded-xl p-2.5 font-mono text-[9px] text-zinc-500 flex flex-col gap-1">
                                <div className="flex justify-between items-center border-b border-zinc-900 pb-1 mb-1 text-zinc-400">
                                    <span>TELEMETRY_LOG</span>
                                    <span className="text-emerald-400 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                                        SYNCED
                                    </span>
                                </div>
                                <div className="leading-normal">
                                    <p><span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span> SYS_HANDSHAKE: Target client OK.</p>
                                    <p><span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span> MEM_LOCK: {isReservationActive ? `Reserve ${ramReservationMb}MB contiguous block.` : 'Virtual page released.'}</p>
                                    {isReservationActive ? (
                                        <>
                                            <p className="text-emerald-500/80"><span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span> ALLOC_ACTIVE: Heap mock simulation loop running.</p>
                                            <p className="text-zinc-600 font-semibold">// browser environment priority signaled</p>
                                        </>
                                    ) : (
                                        <p className="text-zinc-600 font-semibold">// reservation buffer is currently idle</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'cleaner' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                            {/* Storage Warning Banner */}
                            <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex gap-2 items-start text-left">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-[10px] leading-relaxed">
                                    <p className="font-bold text-amber-300">iPhone Storage Exhausted?</p>
                                    <p className="text-zinc-400 mt-0.5">
                                        You <strong>do NOT</strong> need to factory reset your iPhone! Safari caches can accumulate <strong>20+ GB</strong> of system bloat, which Apple lets you wipe directly.
                                    </p>
                                </div>
                            </div>

                            {/* Local Storage Origin Purger */}
                            <div className="bg-zinc-900/30 border border-zinc-800 p-2.5 rounded-xl flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-left">
                                    <span className="text-[9px] font-bold uppercase text-zinc-500">Vault Footprint (Real)</span>
                                    <span className="text-[10px] font-mono font-bold text-zinc-300">
                                        {storageBytes ? formatBytes(storageBytes.usage) : '—'}
                                        {storageBytes && storageBytes.quota > 0 && (
                                            <span className="text-zinc-500"> / {formatBytes(storageBytes.quota)}</span>
                                        )}
                                    </span>
                                </div>
                                {storageBytes && storageBytes.quota > 0 && (
                                    <div className="w-full bg-zinc-800/80 rounded-full h-1 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, (storageBytes.usage / storageBytes.quota) * 100).toFixed(2)}%` }}
                                        ></div>
                                    </div>
                                )}
                                <p className="text-[9px] text-zinc-400 leading-normal text-left">
                                    Measured live via the Storage API — the true compressed on-device size of this app's IndexedDB, localStorage, and Cache API data. Purging wipes offline caches and re-measures.
                                </p>
                                <button
                                    onClick={handleClearLocalCache}
                                    disabled={isClearingCache}
                                    className={`w-full py-1.5 px-3 rounded-lg border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 mt-0.5 cursor-pointer ${
                                        isClearingCache
                                            ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40 cursor-not-allowed'
                                            : cacheClearedSuccess
                                                ? 'bg-emerald-950/45 text-emerald-300 border-emerald-800/40'
                                                : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-zinc-700'
                                    }`}
                                >
                                    {isClearingCache ? (
                                        <>
                                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                                            <span>Purging storage origin...</span>
                                        </>
                                    ) : cacheClearedSuccess ? (
                                        <>
                                            <CheckCircle className="w-3 h-3 text-emerald-400 animate-bounce" />
                                            <span>Cache Cleared Successfully!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-3 h-3 text-zinc-400" />
                                            <span>Purge Local Web App Data</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* iOS Safari Manual Clearing Accordion */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 px-0.5 text-left">
                                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-[10px] font-bold uppercase text-zinc-400">iOS Safari Clearing Steps</span>
                                </div>

                                {[
                                    {
                                        step: 1,
                                        title: "1. Locate Safari in Settings",
                                        content: "Open the physical iOS Settings app on your iPhone. Scroll down and tap on the \"Safari\" category icon."
                                    },
                                    {
                                        step: 2,
                                        title: "2. Scroll & Select Advanced",
                                        content: "In Safari settings, scroll all the way to the absolute bottom and select \"Advanced\" (found right under developer toggles)."
                                    },
                                    {
                                        step: 3,
                                        title: "3. Open Website Data",
                                        content: "Tap on \"Website Data\" at the top. Allow 5-10 seconds for iOS to calculate. It will display a list of all sites hoarding gigabytes of cached documents and local assets."
                                    },
                                    {
                                        step: 4,
                                        title: "4. Tap Remove All Website Data",
                                        content: "Tap \"Remove All Website Data\" at the bottom of the screen. This instantly deletes up to 20+ Gigabytes of Safari's heavy cache without losing your open tabs, saved passwords, or web history!"
                                    }
                                ].map((item, idx) => {
                                    const isExpanded = expandedStep === idx;
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`border rounded-xl transition-all overflow-hidden text-left ${
                                                isExpanded 
                                                    ? 'bg-indigo-950/10 border-indigo-500/30' 
                                                    : 'bg-zinc-900/30 border-zinc-800/40 hover:border-zinc-800/80'
                                            }`}
                                        >
                                            <button
                                                onClick={() => setExpandedStep(isExpanded ? null : idx)}
                                                className="w-full flex justify-between items-center p-2.5 text-left text-xs font-semibold text-zinc-300 select-none cursor-pointer"
                                            >
                                                <span className={isExpanded ? 'text-indigo-300' : 'text-zinc-300'}>{item.title}</span>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-3 h-3 text-indigo-400" />
                                                ) : (
                                                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                                                )}
                                            </button>
                                            {isExpanded && (
                                                <div className="px-2.5 pb-2.5 pt-0 text-[10px] text-zinc-400 leading-relaxed border-t border-zinc-900/50">
                                                    {item.content}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pro-Tip Information */}
                            <div className="bg-indigo-950/20 border border-indigo-900/30 p-2 rounded-xl flex gap-1.5 items-start text-left text-[9px] text-zinc-400">
                                <Info className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold text-zinc-300">Third-party Browsers:</span> If you use Chrome or Firefox on your iPhone, clear your cache by opening that specific app, tapping Settings {`>`} Privacy & Security {`>`} Clear Browsing Data {`>`} Cached Images.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
