import React, { useState, useEffect, useRef } from 'react';
import { Archive, Clock, HardDrive, CheckCircle, AlertCircle, Play, Zap, Database } from 'lucide-react';

interface ArchiveJob {
  id: string;
  source: 'chats' | 'logs' | 'feedback' | 'interactions';
  dataSize: number;
  compressed: boolean;
  archived: boolean;
  timestamp: number;
  compressedSize?: number;
}

interface ArchiverStatus {
  lastRun: number | null;
  nextRun: number;
  isRunning: boolean;
  totalArchived: number;
  totalCompressed: number;
  jobs: ArchiveJob[];
}

const ARCHIVE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const SIZE_THRESHOLD = 100 * 1024 * 1024; // 100MB

export const ArchiverApp: React.FC = () => {
  const [status, setStatus] = useState<ArchiverStatus>({
    lastRun: null,
    nextRun: Date.now() + ARCHIVE_INTERVAL,
    isRunning: false,
    totalArchived: 0,
    totalCompressed: 0,
    jobs: [],
  });

  const [manualRunning, setManualRunning] = useState(false);
  const [archiveLog, setArchiveLog] = useState<string[]>([]);
  const archiveLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Load status from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('archiver_status');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStatus(parsed);
        setArchiveLog(JSON.parse(localStorage.getItem('archiver_log') || '[]'));
      } catch (e) {
        console.error('Failed to load archiver status:', e);
      }
    }
  }, []);

  // Save status to localStorage
  useEffect(() => {
    localStorage.setItem('archiver_status', JSON.stringify(status));
    localStorage.setItem('archiver_log', JSON.stringify(archiveLog));
  }, [status, archiveLog]);

  const calculateDataSize = (): number => {
    let total = 0;
    const chats = localStorage.getItem('shared_chat_history');
    if (chats) total += new Blob([chats]).size;

    const tasks = localStorage.getItem('claude_assistant_tasks');
    if (tasks) total += new Blob([tasks]).size;

    const settings = localStorage.getItem('pc_system_settings');
    if (settings) total += new Blob([settings]).size;

    return total;
  };

  const simulateCompress = (size: number): number => {
    // Simulate 80-90% compression ratio
    return Math.floor(size * (0.1 + Math.random() * 0.1));
  };

  const runArchive = async () => {
    setStatus(prev => ({ ...prev, isRunning: true }));
    setManualRunning(true);

    const newLog: string[] = [];
    newLog.push(`[${new Date().toLocaleTimeString()}] Archive started`);

    try {
      const dataSize = calculateDataSize();
      newLog.push(`Total data: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);

      if (dataSize < SIZE_THRESHOLD) {
        newLog.push('Below threshold, skipping');
        setArchiveLog(prev => [...prev, ...newLog]);
        setStatus(prev => ({
          ...prev,
          isRunning: false,
          nextRun: Date.now() + ARCHIVE_INTERVAL,
        }));
        setManualRunning(false);
        return;
      }

      // Simulate compression
      const compressedSize = simulateCompress(dataSize);
      const ratio = ((1 - compressedSize / dataSize) * 100).toFixed(1);

      newLog.push(`Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${ratio}% reduction)`);
      newLog.push('Simulating cloud upload...');

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      newLog.push('✓ Archive complete');

      const newJob: ArchiveJob = {
        id: `archive_${Date.now()}`,
        source: 'all',
        dataSize,
        compressed: true,
        archived: true,
        timestamp: Date.now(),
        compressedSize,
      };

      setStatus(prev => ({
        ...prev,
        lastRun: Date.now(),
        nextRun: Date.now() + ARCHIVE_INTERVAL,
        isRunning: false,
        totalArchived: prev.totalArchived + dataSize,
        totalCompressed: prev.totalCompressed + compressedSize,
        jobs: [newJob, ...prev.jobs].slice(0, 20),
      }));
    } catch (err) {
      newLog.push(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatus(prev => ({ ...prev, isRunning: false }));
    }

    setArchiveLog(prev => [...prev, ...newLog]);
    setManualRunning(false);
  };

  // Auto-run archiver on interval
  useEffect(() => {
    const checkAndRun = async () => {
      if (Date.now() >= status.nextRun && !status.isRunning) {
        await runArchive();
      }
    };

    archiveLoopRef.current = setInterval(checkAndRun, 60000); // Check every minute

    return () => {
      if (archiveLoopRef.current) clearInterval(archiveLoopRef.current);
    };
  }, [status.nextRun, status.isRunning]);

  const timeUntilNext = Math.max(0, status.nextRun - Date.now());
  const hoursUntilNext = Math.floor(timeUntilNext / 3600000);
  const minsUntilNext = Math.floor((timeUntilNext % 3600000) / 60000);
  const currentDataSize = calculateDataSize();

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Archive size={18} className="text-purple-400" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">Archiver AI</h1>
            <p className="text-[10px] text-zinc-500">Compress & archive data on schedule</p>
          </div>
        </div>
        <button
          onClick={runArchive}
          disabled={status.isRunning || manualRunning}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Play size={12} />
          Run Now
        </button>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-cyan-400" />
            <div>
              <p className="text-zinc-500">Next run</p>
              <p className="font-mono text-cyan-300">{hoursUntilNext}h {minsUntilNext}m</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive size={14} className="text-orange-400" />
            <div>
              <p className="text-zinc-500">Current data</p>
              <p className="font-mono text-orange-300">{(currentDataSize / 1024 / 1024).toFixed(1)}MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Stats */}
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-[10px] text-zinc-500 uppercase mb-1">Total Archived</p>
              <p className="text-sm font-bold text-purple-300">{(status.totalArchived / 1024 / 1024).toFixed(1)}MB</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-[10px] text-zinc-500 uppercase mb-1">Compressed Size</p>
              <p className="text-sm font-bold text-green-300">{(status.totalCompressed / 1024 / 1024).toFixed(1)}MB</p>
            </div>
          </div>
          {status.totalArchived > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
              <p className="text-[10px] text-zinc-400">
                Compression ratio: {((1 - status.totalCompressed / status.totalArchived) * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        {status.isRunning || manualRunning ? (
          <div className="px-4 py-3 bg-purple-950/30 border-b border-purple-900/50 flex items-center gap-2">
            <Zap size={14} className="text-purple-400 animate-spin" />
            <span className="text-sm text-purple-300">Archiving in progress...</span>
          </div>
        ) : status.lastRun ? (
          <div className="px-4 py-3 bg-green-950/30 border-b border-green-900/50 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-sm text-green-300">
              Last run: {new Date(status.lastRun).toLocaleString()}
            </span>
          </div>
        ) : null}

        {/* Archive Log */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
            <Database size={14} className="text-zinc-400" />
            Archive Log
          </h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 max-h-96 overflow-y-auto font-mono text-[10px]">
            {archiveLog.length === 0 ? (
              <p className="text-zinc-500">No archives yet. Click "Run Now" or wait for scheduled run.</p>
            ) : (
              archiveLog.map((line, idx) => (
                <div key={idx} className={`${line.includes('✓') ? 'text-green-400' : line.includes('✗') ? 'text-red-400' : 'text-zinc-400'}`}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        {status.jobs.length > 0 && (
          <div className="p-4 border-t border-zinc-800">
            <h3 className="text-xs font-bold text-white mb-2">Recent Archives</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {status.jobs.map(job => (
                <div key={job.id} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">{new Date(job.timestamp).toLocaleString()}</span>
                    <span className="text-green-400 font-bold">✓ Archived</span>
                  </div>
                  <div className="text-zinc-500 mt-1">
                    {(job.dataSize / 1024 / 1024).toFixed(1)}MB → {(job.compressedSize! / 1024 / 1024).toFixed(1)}MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
