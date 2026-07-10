import React, { useState, useEffect, useRef } from 'react';
import { Archive, Clock, HardDrive, CheckCircle, AlertCircle, Play, Zap, Database, Video, Cloud, Pause } from 'lucide-react';
import { compressToGzipBase64 } from '../../lib/compression';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface ArchiveJob {
  id: string;
  source: 'chats' | 'logs' | 'feedback' | 'interactions' | 'screen';
  dataSize: number;
  compressed: boolean;
  archived: boolean;
  timestamp: number;
  compressedSize?: number;
  uploadedToCloud?: boolean;
}

interface ArchiverStatus {
  lastRun: number | null;
  nextRun: number;
  isRunning: boolean;
  totalArchived: number;
  totalCompressed: number;
  jobs: ArchiveJob[];
  screenRecordingActive: boolean;
  screenRecordingDuration: number; // seconds
  cloudUploadEnabled: boolean;
  totalUploadedToCloud: number; // bytes
  isEnabled: boolean; // Master toggle for entire archiver
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
    screenRecordingActive: false,
    screenRecordingDuration: 10000, // 10 seconds
    cloudUploadEnabled: false,
    totalUploadedToCloud: 0,
    isEnabled: true, // Master toggle - enabled by default
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

  // Real gzip compression via the browser's native CompressionStream (lib/compression.ts).
  // Returns the actual compressed byte length — no fabricated ratio.
  const realCompress = async (text: string): Promise<{ base64: string; compressedBytes: number }> => {
    const base64 = await compressToGzipBase64(text);
    // Each base64 char encodes 6 bits; real byte length of the compressed payload:
    const compressedBytes = Math.ceil((base64.length * 3) / 4);
    return { base64, compressedBytes };
  };

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Real screen capture: grabs a short real clip via the Screen Capture API,
  // gzip-compresses its actual bytes, and — if cloud upload is on — really
  // writes the compressed clip to Firestore. No random numbers, no fake delays.
  const captureRealScreenClip = async (): Promise<void> => {
    if (!mediaStreamRef.current) return;
    const startTime = performance.now();

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      const stopped = new Promise<void>(resolve => {
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => resolve();
      });
      recorder.start();
      await new Promise(r => setTimeout(r, 2500)); // real 2.5s capture window
      recorder.stop();
      await stopped;

      const clipBlob = new Blob(chunks, { type: 'video/webm' });
      const captureBytes = clipBlob.size;
      if (captureBytes === 0) return; // nothing captured (e.g. tab hidden) — don't fabricate a job

      const compressTime = performance.now();
      // Gzip the real video bytes. WebM is already compressed, so the ratio
      // will honestly be small/near-zero — that's real data, not a fake 90%.
      const buffer = await clipBlob.arrayBuffer();
      const gzipStream = new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'));
      const compressedBlob = await new Response(gzipStream).blob();
      const compressedSize = compressedBlob.size;
      const compressionDuration = (performance.now() - compressTime).toFixed(0);

      const uploadTime = performance.now();
      let uploadedToCloud = false;
      if (status.cloudUploadEnabled) {
        try {
          // Real Firestore write of the compressed clip (base64-encoded).
          const compressedBuffer = await compressedBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)));
          await addDoc(collection(db, 'os_screen_archives'), {
            timestamp: serverTimestamp(),
            originalBytes: captureBytes,
            compressedBytes: compressedSize,
            clipBase64: base64,
          });
          uploadedToCloud = true;
        } catch (uploadErr: any) {
          setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Cloud upload failed: ${uploadErr.message}`]);
        }
      }
      const uploadDuration = (performance.now() - uploadTime).toFixed(0);
      const totalDuration = (performance.now() - startTime).toFixed(0);

      const completedJob: ArchiveJob = {
        id: `screen_${Date.now()}`,
        source: 'screen',
        dataSize: captureBytes,
        compressed: true,
        archived: true,
        timestamp: Date.now(),
        compressedSize,
        uploadedToCloud,
      };

      setStatus(prev => ({
        ...prev,
        totalArchived: prev.totalArchived + captureBytes,
        totalCompressed: prev.totalCompressed + compressedSize,
        totalUploadedToCloud: uploadedToCloud ? prev.totalUploadedToCloud + compressedSize : prev.totalUploadedToCloud,
        jobs: [completedJob, ...prev.jobs].slice(0, 50),
      }));

      setArchiveLog(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 📹 ${(captureBytes / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (compress: ${compressionDuration}ms${uploadedToCloud ? ` upload: ${uploadDuration}ms` : ''}) total: ${totalDuration}ms`,
      ]);
    } catch (err: any) {
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Screen capture error: ${err.message}`]);
    }
  };

  const toggleArchiverEnabled = () => {
    setStatus(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
    setArchiveLog(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Archiver ${!status.isEnabled ? 'enabled' : 'disabled'}`,
    ]);
  };

  const screenLoopRef = useRef<NodeJS.Timeout | null>(null);

  const toggleScreenRecording = async () => {
    if (!status.isEnabled) {
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Cannot record: Archiver is disabled`]);
      return;
    }

    if (status.screenRecordingActive) {
      if (screenLoopRef.current) clearInterval(screenLoopRef.current);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      setStatus(prev => ({ ...prev, screenRecordingActive: false }));
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Screen recording stopped`]);
      return;
    }

    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getDisplayMedia) {
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Screen Capture API not supported in this browser`]);
      return;
    }

    try {
      // Real browser permission prompt — the user picks a real screen/tab/window to share.
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      mediaStreamRef.current = stream;
      // If the user stops sharing from the browser's own UI, stop our loop too.
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (screenLoopRef.current) clearInterval(screenLoopRef.current);
        mediaStreamRef.current = null;
        setStatus(prev => ({ ...prev, screenRecordingActive: false }));
        setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Screen recording stopped (source ended)`]);
      });

      setStatus(prev => ({ ...prev, screenRecordingActive: true }));
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Screen recording started (real capture, ${status.screenRecordingDuration / 1000}s loop)`]);
      screenLoopRef.current = setInterval(captureRealScreenClip, status.screenRecordingDuration);
      captureRealScreenClip(); // capture the first clip immediately
    } catch (err: any) {
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Screen share permission denied or cancelled: ${err.message}`]);
    }
  };

  const toggleCloudUpload = () => {
    setStatus(prev => ({ ...prev, cloudUploadEnabled: !prev.cloudUploadEnabled }));
    setArchiveLog(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Cloud upload ${!status.cloudUploadEnabled ? 'enabled' : 'disabled'}`,
    ]);
  };

  const runArchive = async () => {
    if (!status.isEnabled) {
      setArchiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Cannot archive: Archiver is disabled`]);
      return;
    }

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

      // Real gzip compression of the actual localStorage payload.
      const rawText = [
        localStorage.getItem('shared_chat_history') || '',
        localStorage.getItem('claude_assistant_tasks') || '',
        localStorage.getItem('pc_system_settings') || '',
      ].join('\n');
      const { base64, compressedBytes: compressedSize } = await realCompress(rawText);
      const ratio = dataSize > 0 ? ((1 - compressedSize / dataSize) * 100).toFixed(1) : '0';

      newLog.push(`Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${ratio}% reduction)`);

      if (status.cloudUploadEnabled) {
        newLog.push('Uploading to cloud...');
        try {
          await addDoc(collection(db, 'os_archives'), {
            timestamp: serverTimestamp(),
            originalBytes: dataSize,
            compressedBytes: compressedSize,
            payloadBase64: base64,
          });
          newLog.push('✓ Cloud upload complete');
        } catch (uploadErr: any) {
          newLog.push(`✗ Cloud upload failed: ${uploadErr.message}`);
        }
      }

      newLog.push('✓ Archive complete');

      const uploadedToCloud = status.cloudUploadEnabled && newLog.some(l => l.includes('Cloud upload complete'));
      const newJob: ArchiveJob = {
        id: `archive_${Date.now()}`,
        source: 'logs',
        dataSize,
        compressed: true,
        archived: true,
        timestamp: Date.now(),
        compressedSize,
        uploadedToCloud,
      };

      setStatus(prev => ({
        ...prev,
        lastRun: Date.now(),
        nextRun: Date.now() + ARCHIVE_INTERVAL,
        isRunning: false,
        totalArchived: prev.totalArchived + dataSize,
        totalCompressed: prev.totalCompressed + compressedSize,
        totalUploadedToCloud: uploadedToCloud ? prev.totalUploadedToCloud + compressedSize : prev.totalUploadedToCloud,
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
      if (status.isEnabled && Date.now() >= status.nextRun && !status.isRunning) {
        await runArchive();
      }
    };

    archiveLoopRef.current = setInterval(checkAndRun, 60000); // Check every minute

    return () => {
      if (archiveLoopRef.current) clearInterval(archiveLoopRef.current);
    };
  }, [status.nextRun, status.isRunning, status.isEnabled]);

  const timeUntilNext = Math.max(0, status.nextRun - Date.now());
  const hoursUntilNext = Math.floor(timeUntilNext / 3600000);
  const minsUntilNext = Math.floor((timeUntilNext % 3600000) / 60000);
  const currentDataSize = calculateDataSize();

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${status.isEnabled ? 'bg-purple-500/10 border-purple-500/20' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
            <Archive size={18} className={status.isEnabled ? 'text-purple-400' : 'text-zinc-500'} />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">Archiver AI</h1>
            <p className="text-[10px] text-zinc-500">{status.isEnabled ? 'Compress & archive data on schedule' : 'Disabled'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleArchiverEnabled}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
              status.isEnabled
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
            title={status.isEnabled ? 'Turn off Archiver' : 'Turn on Archiver'}
          >
            {status.isEnabled ? '✓ On' : '⊘ Off'}
          </button>
          <button
            onClick={runArchive}
            disabled={status.isRunning || manualRunning || !status.isEnabled}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Play size={12} />
            Run Now
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`px-4 py-3 border-b border-zinc-800 ${status.isEnabled ? 'bg-zinc-900/50' : 'bg-zinc-900/50 border-b-2 border-zinc-700'}`}>
        {!status.isEnabled && (
          <div className="mb-3 p-2 bg-zinc-800/50 border border-zinc-700 rounded text-xs text-zinc-400 flex items-center gap-2">
            <AlertCircle size={12} className="text-zinc-500" />
            Archiver is currently disabled
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
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
        {/* Recording & Upload Controls */}
        <div className="flex gap-2">
          <button
            onClick={toggleScreenRecording}
            className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1 ${
              status.screenRecordingActive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {status.screenRecordingActive ? (
              <>
                <Pause size={12} />
                Stop Recording
              </>
            ) : (
              <>
                <Video size={12} />
                Record Screen
              </>
            )}
          </button>
          <button
            onClick={toggleCloudUpload}
            className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1 ${
              status.cloudUploadEnabled
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
          >
            <Cloud size={12} />
            {status.cloudUploadEnabled ? 'Cloud' : 'Local'}
          </button>
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
          {status.cloudUploadEnabled && (
            <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-2">
              <p className="text-[10px] text-green-400 font-bold">
                ☁️ Cloud sync: {(status.totalUploadedToCloud / 1024 / 1024).toFixed(1)}MB uploaded
              </p>
            </div>
          )}
          {status.screenRecordingActive && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-2 animate-pulse">
              <p className="text-[10px] text-red-400 font-bold">
                🔴 Recording live (10s loop)
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
