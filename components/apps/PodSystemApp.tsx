import React, { useState, useEffect, useRef } from 'react';
import { Database, Activity, HardDrive, TrendingDown, Zap, Play, Pause, RefreshCw, BarChart3, ArrowRight } from 'lucide-react';

interface DataTier {
  name: string;
  capacity: number;
  current: number;
  compressionRatio: number;
  description: string;
  color: string;
  throughput: number;
}

interface PodStatus {
  isRecording: boolean;
  recordingDuration: number;
  tiers: DataTier[];
  totalDataProcessed: number;
  totalCompressionSavings: number;
  lastUpdateTime: number;
  isEnabled: boolean;
}

const TIER_CONFIGS = [
  { name: 'Raw', capacity: 5 * 1024 * 1024 * 1024, ratio: 1.0, desc: 'Screen recordings & logs', color: 'from-blue-600 to-blue-400' },
  { name: 'Tier-1', capacity: 2 * 1024 * 1024 * 1024, ratio: 0.4, desc: 'First compression (LZ4)', color: 'from-purple-600 to-purple-400' },
  { name: 'Tier-2', capacity: 1 * 1024 * 1024 * 1024, ratio: 0.2, desc: 'Deep compression (ZSTD)', color: 'from-pink-600 to-pink-400' },
  { name: 'Archive', capacity: 512 * 1024 * 1024, ratio: 0.1, desc: 'Ultra-compact (LZMA)', color: 'from-amber-600 to-amber-400' },
];

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)}${units[unitIndex]}`;
};

export const PodSystemApp: React.FC = () => {
  const [status, setStatus] = useState<PodStatus>({
    isRecording: true,
    recordingDuration: 0,
    tiers: TIER_CONFIGS.map((cfg) => ({
      name: cfg.name,
      capacity: cfg.capacity,
      current: 0,
      compressionRatio: cfg.ratio,
      description: cfg.desc,
      color: cfg.color,
      throughput: 0,
    })),
    totalDataProcessed: 0,
    totalCompressionSavings: 0,
    lastUpdateTime: Date.now(),
    isEnabled: true,
  });

  const [logs, setLogs] = useState<string[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const compressionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pod_system_status');
    if (saved) {
      try {
        setStatus(JSON.parse(saved));
        setLogs(JSON.parse(localStorage.getItem('pod_system_logs') || '[]'));
      } catch (e) {
        console.error('Failed to load pod system status:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pod_system_status', JSON.stringify(status));
    localStorage.setItem('pod_system_logs', JSON.stringify(logs.slice(-100)));
  }, [status, logs]);

  useEffect(() => {
    if (!status.isEnabled || !status.isRecording) return;

    recordingIntervalRef.current = setInterval(() => {
      setStatus(prev => {
        const newTiers = [...prev.tiers];
        const capturedData = Math.random() * 5 * 1024 * 1024;

        newTiers[0].current = Math.min(newTiers[0].current + capturedData, newTiers[0].capacity);
        newTiers[0].throughput = capturedData / 1000;

        return {
          ...prev,
          recordingDuration: prev.recordingDuration + 1,
          tiers: newTiers,
          totalDataProcessed: prev.totalDataProcessed + capturedData,
        };
      });
    }, 1000);

    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [status.isEnabled, status.isRecording]);

  useEffect(() => {
    if (!status.isEnabled) return;

    compressionIntervalRef.current = setInterval(() => {
      setStatus(prev => {
        const newTiers = [...prev.tiers];
        let totalSavings = prev.totalCompressionSavings;

        for (let i = 0; i < newTiers.length - 1; i++) {
          const sourceTier = newTiers[i];
          const targetTier = newTiers[i + 1];

          const flowAmount = Math.min(sourceTier.current * 0.15, sourceTier.capacity * 0.1);
          if (flowAmount > 0) {
            sourceTier.current = Math.max(sourceTier.current - flowAmount, 0);

            const compressedAmount = flowAmount * targetTier.compressionRatio;
            const saved = flowAmount - compressedAmount;
            totalSavings += saved;

            targetTier.current = Math.min(targetTier.current + compressedAmount, targetTier.capacity);
            targetTier.throughput = compressedAmount / 1000;
          }
        }

        return {
          ...prev,
          tiers: newTiers,
          totalCompressionSavings: totalSavings,
          lastUpdateTime: Date.now(),
        };
      });
    }, 2000);

    return () => {
      if (compressionIntervalRef.current) clearInterval(compressionIntervalRef.current);
    };
  }, [status.isEnabled]);

  const toggleRecording = () => {
    if (!status.isEnabled) {
      const msg = `[${new Date().toLocaleTimeString()}] ❌ Cannot record: Pod System is disabled`;
      setLogs(prev => [...prev, msg]);
      return;
    }

    setStatus(prev => ({ ...prev, isRecording: !prev.isRecording }));
    const action = !status.isRecording ? 'started' : 'stopped';
    const msg = `[${new Date().toLocaleTimeString()}] 📹 Recording ${action}`;
    setLogs(prev => [...prev, msg]);
  };

  const togglePodEnabled = () => {
    setStatus(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
    const action = !status.isEnabled ? 'enabled' : 'disabled';
    const msg = `[${new Date().toLocaleTimeString()}] 🟢 Pod System ${action}`;
    setLogs(prev => [...prev, msg]);
  };

  const resetTiers = () => {
    setStatus(prev => ({
      ...prev,
      tiers: prev.tiers.map(t => ({ ...t, current: 0, throughput: 0 })),
    }));
    const msg = `[${new Date().toLocaleTimeString()}] 🔄 All tiers cleared`;
    setLogs(prev => [...prev, msg]);
  };

  const compressionEfficiency = status.totalDataProcessed > 0
    ? ((status.totalCompressionSavings / status.totalDataProcessed) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col">
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Database size={16} className="text-blue-400" />
          Pod System — Tiered RL Data Pipeline
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            disabled={!status.isEnabled}
            className={`px-3 py-1.5 text-xs rounded font-bold transition-colors flex items-center gap-1 ${
              status.isRecording
                ? 'bg-red-600/30 border border-red-500/50 text-red-300'
                : 'bg-green-600/30 border border-green-500/50 text-green-300'
            }`}
          >
            {status.isRecording ? <Pause size={12} /> : <Play size={12} />}
            {status.isRecording ? 'Recording' : 'Paused'}
          </button>
          <button
            onClick={togglePodEnabled}
            className={`px-3 py-1.5 text-xs rounded font-bold transition-colors ${
              status.isEnabled
                ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                : 'bg-zinc-700/30 border border-zinc-600/50 text-zinc-400'
            }`}
          >
            {status.isEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="h-16 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center justify-between gap-4 shrink-0 text-xs">
        <div className="flex gap-6">
          <div>
            <span className="text-zinc-500">Duration</span>
            <p className="text-white font-mono font-bold">{Math.floor(status.recordingDuration / 60)}m {status.recordingDuration % 60}s</p>
          </div>
          <div>
            <span className="text-zinc-500">Data Processed</span>
            <p className="text-white font-mono font-bold">{formatBytes(status.totalDataProcessed)}</p>
          </div>
          <div>
            <span className="text-zinc-500">Compression Savings</span>
            <p className="text-green-400 font-mono font-bold">{formatBytes(status.totalCompressionSavings)}</p>
          </div>
          <div>
            <span className="text-zinc-500">Efficiency</span>
            <p className="text-yellow-400 font-mono font-bold">{compressionEfficiency}%</p>
          </div>
        </div>
        <button
          onClick={resetTiers}
          className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 transition-colors flex items-center gap-1"
        >
          <RefreshCw size={12} />
          Reset
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-500 uppercase">Data Flow Pipeline</p>

          <div className="space-y-2">
            {status.tiers.map((tier, idx) => {
              const fillPercent = (tier.current / tier.capacity) * 100;
              const nextTier = idx < status.tiers.length - 1;

              return (
                <div key={tier.name} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-white">{tier.name}</h3>
                      <p className="text-[10px] text-zinc-400">{tier.description}</p>
                      <div className="flex gap-2 mt-1 text-[10px] text-zinc-500">
                        <span>Cap: {formatBytes(tier.capacity)}</span>
                        <span>•</span>
                        <span>Ratio: {(tier.compressionRatio * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span>Flow: {formatBytes(tier.throughput * 1000)}/s</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative h-6 bg-zinc-900 rounded border border-zinc-800 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${tier.color} transition-all duration-300`}
                      style={{ width: `${fillPercent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono">
                      <span className="text-zinc-300 font-bold drop-shadow">
                        {formatBytes(tier.current)}
                      </span>
                      <span className="text-zinc-500">
                        {fillPercent.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {nextTier && (
                    <div className="flex items-center justify-center py-1">
                      <ArrowRight size={14} className="text-zinc-700 animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 space-y-2">
          <p className="text-xs font-bold text-zinc-500 uppercase">System Metrics</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <Activity size={12} className="text-green-500" />
                Recording Status
              </div>
              <p className="text-xs font-bold text-white">
                {status.isRecording ? '🔴 Active' : '⚫ Paused'}
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <TrendingDown size={12} className="text-blue-500" />
                Total Compressed
              </div>
              <p className="text-xs font-mono font-bold text-white">
                {formatBytes(status.tiers.reduce((sum, t) => sum + t.current, 0))}
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <Zap size={12} className="text-yellow-500" />
                Avg Throughput
              </div>
              <p className="text-xs font-mono font-bold text-white">
                {formatBytes(status.tiers.reduce((sum, t) => sum + t.throughput, 0) * 1000)}/s
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <BarChart3 size={12} className="text-purple-500" />
                Archive Capacity
              </div>
              <p className="text-xs font-mono font-bold text-white">
                {(((status.tiers[3]?.current || 0) / (status.tiers[3]?.capacity || 1)) * 100).toFixed(0)}% full
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 space-y-2">
          <p className="text-xs font-bold text-zinc-500 uppercase">Activity Log</p>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-2 max-h-32 overflow-y-auto space-y-1">
            {logs.slice(-20).reverse().map((log, idx) => (
              <p key={idx} className="text-[10px] text-zinc-400 font-mono">
                {log}
              </p>
            ))}
            {logs.length === 0 && (
              <p className="text-[10px] text-zinc-500">System initialized • Ready to record</p>
            )}
          </div>
        </div>
      </div>

      <div className="h-12 border-t border-zinc-800 bg-zinc-900/50 px-4 py-2 flex items-center justify-between text-[10px] shrink-0">
        <div className="text-zinc-500">
          Pod System • Captures: Screen + RL logs • Compression: LZ4 → ZSTD → LZMA
        </div>
        <div className="text-zinc-600">
          {status.isEnabled ? '✓ Running' : '✗ Disabled'} • Last update: {new Date(status.lastUpdateTime).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
