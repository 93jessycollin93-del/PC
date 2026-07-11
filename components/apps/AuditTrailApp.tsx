import React, { useState, useEffect } from 'react';
import { BookOpen, Download, Trash2, Filter } from 'lucide-react';
import { auditLog, type AuditEntry } from '../../lib/auditLog';

export const AuditTrailApp: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<{ category?: string; actor?: string }>({});

  useEffect(() => {
    refreshEntries();
    const interval = setInterval(refreshEntries, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const refreshEntries = () => {
    setEntries(auditLog.getEntries(filter));
  };

  const handleExport = (fmt: 'json' | 'csv') => {
    const content = auditLog.export(fmt);
    const blob = new Blob([content], {
      type: fmt === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = [
    'model_call',
    'file_access',
    'permission_change',
    'shell_exec',
    'data_export',
    'auth',
    'other',
  ];

  const resultColor = (result: string) => {
    switch (result) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'denied':
        return 'bg-orange-500/20 text-orange-400';
      case 'error':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-blue-950/30 to-zinc-950 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Audit Trail</h1>
        </div>
        <p className="text-zinc-400">Append-only immutable log of all sensitive actions</p>
      </div>

      {/* Stats & Export */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-zinc-400 mb-1">Total Entries</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('json')}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1 transition-all"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1 transition-all"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div>
            <p className="text-sm text-zinc-400 mb-2 flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Category
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter(prev => ({ ...prev, category: undefined }))}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  !filter.category
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(prev => ({ ...prev, category: cat }))}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    filter.category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="flex-1 overflow-auto p-6 space-y-2">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No audit entries</p>
            <p className="text-xs text-zinc-500 mt-1">Actions will appear here as they occur</p>
          </div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              className="bg-zinc-900/50 border border-zinc-800 rounded p-3 hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm text-zinc-200">{entry.action}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${resultColor(entry.result)}`}>
                      {entry.result}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    <span className="text-zinc-400">Actor:</span> {entry.actor} •{' '}
                    <span className="text-zinc-400">Category:</span> {entry.category.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className="text-xs text-zinc-600 whitespace-nowrap">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {entry.details && Object.keys(entry.details).length > 0 && (
                <p className="text-xs text-zinc-500 font-mono">
                  {Object.entries(entry.details)
                    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                    .join(' ')}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
