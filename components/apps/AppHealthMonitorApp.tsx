import React, { useEffect, useReducer, useState } from 'react';
import { Activity, RotateCcw, AlertTriangle, CheckCircle2, Circle, Zap } from 'lucide-react';
import { appHealthMonitor, type AppHealthSnapshot } from '../../lib/appHealthMonitor';

/**
 * App Health Monitor — track app crashes, errors, and health status
 */

export const AppHealthMonitorApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [snapshots, setSnapshots] = useState<AppHealthSnapshot[]>([]);
  const [stats, setStats] = useState({ totalApps: 0, healthyApps: 0, degradedApps: 0, crashedApps: 0, totalErrors: 0 });
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  const refreshStats = () => {
    setSnapshots(appHealthMonitor.getAllSnapshots());
    setStats(appHealthMonitor.getStats());
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = (appId: string) => {
    if (!confirm(`Reset ${appId}? This will clear its error history.`)) return;
    appHealthMonitor.resetApp(appId);
    refreshStats();
    tick();
  };

  const handleReload = (appId: string) => {
    // Emit reload event that App.tsx can listen to
    window.dispatchEvent(
      new CustomEvent('app-reload-request', {
        detail: { appId },
      })
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400 bg-emerald-900/20 border-emerald-700';
      case 'degraded':
        return 'text-amber-400 bg-amber-900/20 border-amber-700';
      case 'crashed':
        return 'text-red-400 bg-red-900/20 border-red-700';
      case 'blank':
        return 'text-orange-400 bg-orange-900/20 border-orange-700';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 size={14} />;
      case 'degraded':
        return <AlertTriangle size={14} />;
      case 'crashed':
        return <AlertTriangle size={14} />;
      case 'blank':
        return <Circle size={14} />;
      default:
        return <Circle size={14} />;
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const statusOrder = { healthy: 0, degraded: 1, crashed: 2, blank: 3 };
    const statusA = statusOrder[a.status as keyof typeof statusOrder] || 4;
    const statusB = statusOrder[b.status as keyof typeof statusOrder] || 4;
    return statusA - statusB;
  });

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Activity size={16} className="text-emerald-400" />
          App Health Monitor
        </h2>
        <button
          onClick={refreshStats}
          className="p-1 hover:bg-zinc-800 rounded transition"
          title="Refresh stats"
        >
          <Zap size={14} className="text-zinc-500 hover:text-emerald-400" />
        </button>
      </div>

      {/* Health summary */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0">
        <div className="grid grid-cols-5 gap-3 text-[10px]">
          <div>
            <div className="text-zinc-500">Total</div>
            <div className="text-white font-bold text-sm">{stats.totalApps}</div>
          </div>
          <div>
            <div className="text-emerald-500">Healthy</div>
            <div className="text-emerald-400 font-bold text-sm">{stats.healthyApps}</div>
          </div>
          <div>
            <div className="text-amber-500">Degraded</div>
            <div className="text-amber-400 font-bold text-sm">{stats.degradedApps}</div>
          </div>
          <div>
            <div className="text-red-500">Crashed</div>
            <div className="text-red-400 font-bold text-sm">{stats.crashedApps}</div>
          </div>
          <div>
            <div className="text-zinc-500">Errors</div>
            <div className="text-white font-bold text-sm">{stats.totalErrors}</div>
          </div>
        </div>
      </div>

      {/* App list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sortedSnapshots.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No apps monitored yet. Launch an app to begin tracking.
          </div>
        ) : (
          sortedSnapshots.map(snapshot => (
            <div key={snapshot.appId} className="space-y-1">
              {/* App header */}
              <button
                onClick={() =>
                  setExpandedAppId(expandedAppId === snapshot.appId ? null : snapshot.appId)
                }
                className={`w-full px-3 py-2 rounded border text-left text-xs font-bold transition ${getStatusColor(
                  snapshot.status
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(snapshot.status)}
                    <span>{snapshot.appId}</span>
                    {snapshot.consecutiveErrors > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-red-900/40 text-red-300">
                        {snapshot.consecutiveErrors} errs
                      </span>
                    )}
                  </div>
                  <span className="text-[10px]">{expandedAppId === snapshot.appId ? '▼' : '▶'}</span>
                </div>
              </button>

              {/* Expanded details */}
              {expandedAppId === snapshot.appId && (
                <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-zinc-600">Uptime</span>
                      <div className="text-white font-mono">{formatUptime(snapshot.uptime)}</div>
                    </div>
                    <div>
                      <span className="text-zinc-600">Renders</span>
                      <div className="text-white font-mono">{snapshot.renderCount}</div>
                    </div>
                    <div>
                      <span className="text-zinc-600">Total Errors</span>
                      <div className="text-white font-mono">{snapshot.errorCount}</div>
                    </div>
                    <div>
                      <span className="text-zinc-600">Status</span>
                      <div className="capitalize text-white font-mono">{snapshot.status}</div>
                    </div>
                  </div>

                  {snapshot.lastError && (
                    <div className="bg-red-900/20 border border-red-800 p-2 rounded">
                      <div className="text-red-300 font-bold mb-1">Last Error:</div>
                      <div className="text-red-200 font-mono text-[9px] line-clamp-3">
                        {snapshot.lastError}
                      </div>
                      {snapshot.lastErrorTime && (
                        <div className="text-[9px] text-red-400 mt-1">
                          {new Date(snapshot.lastErrorTime).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-zinc-700">
                    <button
                      onClick={() => handleReload(snapshot.appId)}
                      className="flex-1 px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                      Reload
                    </button>
                    <button
                      onClick={() => handleReset(snapshot.appId)}
                      className="flex-1 px-2 py-1 rounded text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Monitors app errors and renders automatically</div>
        <div>• "Crashed" = 3+ consecutive errors</div>
        <div>• "Blank" = no renders for 2 minutes</div>
        <div>• Reset clears history; Reload restarts the app</div>
      </div>
    </div>
  );
};

export default AppHealthMonitorApp;
