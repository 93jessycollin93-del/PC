import React, { useEffect, useReducer, useState } from 'react';
import { HardDrive, RefreshCw, Trash2, Copy, AlertCircle } from 'lucide-react';
import { appStorageV2 } from '../../lib/appStorageV2';

/**
 * Storage Stats — monitor quota usage, view keys, and manage storage consolidation
 */

interface StorageKey {
  namespace: string;
  key: string;
  size: number;
  compressed?: boolean;
  spilledToIDB?: boolean;
  createdAt?: number;
}

export const StorageStatsApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [keys, setKeys] = useState<StorageKey[]>([]);
  const [stats, setStats] = useState({ usedBytes: 0, availableBytes: 0, percentUsed: 0 });
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set());
  const [selectedForMigration, setSelectedForMigration] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');

  const refreshStats = () => {
    const namespaces = ['workspace-profiles', 'automation', 'scheduler', 'notifications', 'secrets-vault'];
    const allKeys: StorageKey[] = [];

    namespaces.forEach(ns => {
      const storage = appStorageV2(ns);
      const nsKeys = storage.keys();
      nsKeys.forEach(key => {
        const meta = storage.getMetadata(key);
        if (meta) {
          allKeys.push({
            namespace: ns,
            key,
            size: 0, // Rough estimate
            compressed: meta.compressed,
            spilledToIDB: meta.spilledToIDB,
            createdAt: meta.createdAt,
          });
        }
      });
    });

    setKeys(allKeys);

    // Use primary namespace for stats demo
    const storage = appStorageV2('workspace-profiles');
    setStats(storage.getQuotaStats());
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const toggleNamespace = (ns: string) => {
    const next = new Set(expandedNamespaces);
    if (next.has(ns)) {
      next.delete(ns);
    } else {
      next.add(ns);
    }
    setExpandedNamespaces(next);
  };

  const handleClearNamespace = (ns: string) => {
    if (!confirm(`Clear all keys in "${ns}"? This cannot be undone.`)) return;
    const storage = appStorageV2(ns);
    storage.keys().forEach(k => storage.remove(k));
    refreshStats();
    tick();
  };

  const handleMigrateKey = (ns: string, oldKey: string) => {
    if (!newKeyName.trim()) return;
    const storage = appStorageV2(ns);
    storage.migrateKey(oldKey, newKeyName, ns);
    setSelectedForMigration(null);
    setNewKeyName('');
    refreshStats();
    tick();
  };

  const bytesToMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);
  const groupedByNs = keys.reduce((acc, k) => {
    if (!acc[k.namespace]) acc[k.namespace] = [];
    acc[k.namespace].push(k);
    return acc;
  }, {} as Record<string, StorageKey[]>);

  const quotaPercent = Math.min(100, stats.percentUsed);
  const quotaColor = quotaPercent > 90 ? 'bg-red-500' : quotaPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <HardDrive size={16} className="text-blue-400" />
          Storage Stats
        </h2>
        <button
          onClick={refreshStats}
          className="p-1 hover:bg-zinc-800 rounded transition"
          title="Refresh stats"
        >
          <RefreshCw size={14} className="text-zinc-500 hover:text-blue-400" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quota overview */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-blue-400" />
            <h3 className="font-bold text-white">Quota Usage</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">Used</span>
                <span className="text-white font-mono">{bytesToMB(stats.usedBytes)} MB / 5 MB</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${quotaColor} transition-all duration-300`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              <div>• {stats.percentUsed}% used</div>
              <div>• {bytesToMB(stats.availableBytes)} MB available</div>
              {stats.percentUsed > 80 && (
                <div className="text-amber-400 mt-1">⚠ Storage nearing limit</div>
              )}
            </div>
          </div>
        </div>

        {/* Namespaces */}
        {Object.entries(groupedByNs).length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No keys found. Storage is empty.
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedByNs).map(([ns, nsKeys]) => (
              <div key={ns} className="bg-zinc-900/50 border border-zinc-700 rounded-lg overflow-hidden">
                {/* Namespace header */}
                <button
                  onClick={() => toggleNamespace(ns)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800 transition text-left"
                >
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">{ns}</div>
                    <div className="text-xs text-zinc-500">{nsKeys.length} key(s)</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleClearNamespace(ns);
                      }}
                      className="p-1 hover:bg-zinc-700 rounded"
                      title="Clear namespace"
                    >
                      <Trash2 size={12} className="text-zinc-500 hover:text-red-400" />
                    </button>
                    <div className="text-zinc-600 text-lg">
                      {expandedNamespaces.has(ns) ? '▼' : '▶'}
                    </div>
                  </div>
                </button>

                {/* Keys list */}
                {expandedNamespaces.has(ns) && (
                  <div className="border-t border-zinc-700 max-h-64 overflow-y-auto">
                    {nsKeys.map(k => (
                      <div key={k.key} className="px-4 py-2 border-b border-zinc-800 last:border-b-0 text-xs hover:bg-zinc-800/50">
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-zinc-300 truncate">{k.key}</div>
                            <div className="text-zinc-600 text-[10px] mt-0.5">
                              {k.compressed && '📦 '}
                              {k.spilledToIDB && '💾 '}
                              {k.createdAt && new Date(k.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          {selectedForMigration === k.key ? (
                            <div className="flex gap-1">
                              <input
                                autoFocus
                                placeholder="new key"
                                value={newKeyName}
                                onChange={e => setNewKeyName(e.target.value)}
                                className="w-20 px-1.5 py-0.5 bg-zinc-950 border border-zinc-700 rounded text-[10px] text-zinc-300 focus:border-blue-500 outline-none"
                              />
                              <button
                                onClick={() => handleMigrateKey(ns, k.key)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-bold"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedForMigration(null);
                                  setNewKeyName('');
                                }}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 hover:bg-zinc-600 text-white"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedForMigration(k.key)}
                              className="p-0.5 hover:bg-zinc-700 rounded"
                              title="Migrate key"
                            >
                              <Copy size={10} className="text-zinc-500 hover:text-blue-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Auto-compression for values ≥50KB (LZString)</div>
        <div>• IndexedDB spillover for values ≥500KB</div>
        <div>• Quota warnings at 80% usage</div>
        <div>• Key migration supports namespace changes</div>
      </div>
    </div>
  );
};

export default StorageStatsApp;
