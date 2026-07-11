import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Watch, Zap } from 'lucide-react';
import { integrityMonitor } from '../../lib/integrityMonitor';
import { bus } from '../../lib/bus';

export const IntegrityMonitorApp: React.FC = () => {
  const [status, setStatus] = useState<any[]>([]);
  const [violations, setViolations] = useState<number>(0);
  const [watchNamespace, setWatchNamespace] = useState('');

  useEffect(() => {
    integrityMonitor.start();
    refreshStatus();

    const unsubPermission = bus.on('integrity-violation' as any, () => {
      setViolations(prev => prev + 1);
      refreshStatus();
    });

    const interval = setInterval(refreshStatus, 5000);
    return () => {
      unsubPermission();
      clearInterval(interval);
    };
  }, []);

  const refreshStatus = () => {
    setStatus(integrityMonitor.getStatus());
  };

  const handleWatch = () => {
    if (watchNamespace.trim()) {
      integrityMonitor.watch(watchNamespace.trim(), watchNamespace);
      setWatchNamespace('');
      refreshStatus();
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-purple-950/30 to-zinc-950 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Integrity Monitor</h1>
        </div>
        <p className="text-zinc-400">Detect unexpected mutations in critical app state</p>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-zinc-400 mb-1">Monitored</p>
            <p className="text-2xl font-bold">{status.length}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400 mb-1">Healthy</p>
            <p className="text-2xl font-bold text-emerald-400">{status.filter(s => s.ok).length}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400 mb-1">Violations</p>
            <p className={`text-2xl font-bold ${violations > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {violations}
            </p>
          </div>
        </div>
      </div>

      {/* Add Watch */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={watchNamespace}
            onChange={e => setWatchNamespace(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleWatch()}
            placeholder="app namespace to monitor (e.g., 'user-preferences')"
            className="flex-1 px-3 py-2 rounded bg-zinc-950 border border-zinc-700 text-sm text-white focus:border-purple-500 outline-none"
          />
          <button
            onClick={handleWatch}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center gap-1 transition-all"
          >
            <Watch className="w-4 h-4" />
            Watch
          </button>
        </div>
      </div>

      {/* Monitored Namespaces */}
      <div className="flex-1 overflow-auto p-6 space-y-3">
        {status.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No namespaces being monitored</p>
            <p className="text-xs text-zinc-500 mt-1">Add app state to monitor for tampering</p>
          </div>
        ) : (
          status.map(ns => (
            <div
              key={ns.namespace}
              className={`border rounded-lg p-4 ${
                ns.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {ns.ok ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{ns.label}</p>
                    <p className="text-xs text-zinc-500">{ns.namespace}</p>
                    <p className="text-xs text-zinc-600 font-mono mt-1">Hash: {ns.hash}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Last checked: {new Date(ns.lastCheck).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap ${
                    ns.ok
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {ns.ok ? 'Healthy' : 'Tampered'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
