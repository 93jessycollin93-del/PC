import React, { useEffect, useReducer, useState } from 'react';
import { RotateCcw, Trash2, Save, Clock, Download } from 'lucide-react';
import { timeMachineSnapshots, type Snapshot } from '../../lib/timeMachineSnapshots';

/**
 * Time Machine — point-in-time recovery via snapshots
 */

export const TimeMachineApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [stats, setStats] = useState(timeMachineSnapshots.getStats());
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [autoSnapshotEnabled, setAutoSnapshotEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refreshSnapshots = () => {
    setSnapshots(timeMachineSnapshots.getSnapshots());
    setStats(timeMachineSnapshots.getStats());
  };

  useEffect(() => {
    refreshSnapshots();
  }, []);

  const handleCreateSnapshot = () => {
    timeMachineSnapshots.createSnapshot(label || undefined, description || undefined);
    setLabel('');
    setDescription('');
    refreshSnapshots();
    tick();
  };

  const handleRestoreSnapshot = async (id: string) => {
    if (!confirm('Restore to this snapshot? Current state will be replaced.')) return;
    const success = await timeMachineSnapshots.restore(id);
    if (success) {
      refreshSnapshots();
      tick();
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    timeMachineSnapshots.deleteSnapshot(id);
    refreshSnapshots();
    tick();
  };

  const handleToggleAutoSnapshots = () => {
    if (autoSnapshotEnabled) {
      timeMachineSnapshots.stopAutoSnapshots();
      setAutoSnapshotEnabled(false);
    } else {
      timeMachineSnapshots.startAutoSnapshots(5);
      setAutoSnapshotEnabled(true);
    }
  };

  const handleExport = () => {
    const json = timeMachineSnapshots.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshots-${Date.now()}.json`;
    a.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Clock size={16} className="text-orange-400" />
          Time Machine
        </h2>
        <button
          onClick={handleExport}
          className="p-1 hover:bg-zinc-800 rounded"
          title="Export snapshots"
        >
          <Download size={14} className="text-zinc-500 hover:text-orange-400" />
        </button>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <div className="text-zinc-600">Total Snapshots</div>
            <div className="text-white font-bold text-lg">{stats.total}</div>
          </div>
          <div>
            <div className="text-zinc-600">Storage Used</div>
            <div className="text-white font-bold text-lg">{formatBytes(stats.totalSize)}</div>
          </div>
          <div>
            <div className="text-zinc-600">Oldest</div>
            <div className="text-white font-mono text-xs">
              {stats.oldest ? new Date(stats.oldest.timestamp).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-zinc-600">Newest</div>
            <div className="text-white font-mono text-xs">
              {stats.newest ? new Date(stats.newest.timestamp).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Create snapshot form */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Save size={14} className="text-orange-400" />
            <h3 className="font-bold text-white">New Snapshot</h3>
          </div>
          <div className="space-y-2">
            <input
              placeholder="Snapshot label (optional)"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-orange-500 outline-none"
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-orange-500 outline-none resize-none h-12"
            />
            <button
              onClick={handleCreateSnapshot}
              className="w-full px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm"
            >
              Create Snapshot Now
            </button>

            {/* Auto-snapshot toggle */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
              <input
                type="checkbox"
                id="autoSnapshot"
                checked={autoSnapshotEnabled}
                onChange={handleToggleAutoSnapshots}
                className="rounded"
              />
              <label htmlFor="autoSnapshot" className="text-xs text-zinc-400">
                Auto-snapshot every 5 minutes
              </label>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {snapshots.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No snapshots yet. Create one to save system state.
          </div>
        ) : (
          <div className="space-y-2">
            {[...snapshots].reverse().map(snapshot => (
              <div
                key={snapshot.id}
                className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 cursor-pointer hover:border-zinc-600"
              >
                {/* Summary */}
                <button
                  onClick={() => setSelectedId(selectedId === snapshot.id ? null : snapshot.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white">
                        {snapshot.label || 'Snapshot'}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(snapshot.timestamp).toLocaleString()}
                      </div>
                      {snapshot.description && (
                        <div className="text-xs text-zinc-400 mt-1 line-clamp-1">
                          {snapshot.description}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                      {formatBytes(snapshot.size)}
                    </span>
                  </div>
                </button>

                {/* Expanded */}
                {selectedId === snapshot.id && (
                  <div className="border-t border-zinc-700 mt-2 pt-2 space-y-2">
                    <div className="text-[10px] text-zinc-600">
                      Contains data from: workspace, automation, scheduler, notifications, prompts,
                      clipboard
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreSnapshot(snapshot.id)}
                        className="flex-1 px-2 py-1 rounded text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold"
                      >
                        <RotateCcw size={11} className="inline mr-1" /> Restore
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        className="px-2 py-1 rounded text-xs bg-red-900/50 hover:bg-red-900 text-red-300"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Snapshots capture all app state (workspaces, automations, settings)</div>
        <div>• Can restore entire system or specific app state</div>
        <div>• Keeps last 50 snapshots; older ones are rotated out</div>
        <div>• Storage includes: {formatBytes(stats.totalSize)} total</div>
      </div>
    </div>
  );
};

export default TimeMachineApp;
