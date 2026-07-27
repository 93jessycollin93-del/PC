import React, { useEffect, useReducer, useState } from 'react';
import { Copy, Trash2, Search, Download, Filter } from 'lucide-react';
import { clipboardBridge, type DataType } from '../../lib/clipboardBridge';

/**
 * Clipboard Manager — shared clipboard and data bridge between apps
 */

export const ClipboardManagerApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [history, setHistory] = useState(clipboardBridge.getHistory());
  const [stats, setStats] = useState(clipboardBridge.getStats());
  const [currentData, setCurrentData] = useState(clipboardBridge.getCurrentData());
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<DataType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const types: DataType[] = ['text', 'code', 'json', 'file', 'html', 'image'];

  const refreshHistory = () => {
    setHistory(clipboardBridge.getHistory());
    setStats(clipboardBridge.getStats());
    setCurrentData(clipboardBridge.getCurrentData());
  };

  useEffect(() => {
    refreshHistory();

    // Subscribe to clipboard changes
    const unsubscribe = clipboardBridge.subscribe(() => {
      refreshHistory();
      tick();
    });

    return unsubscribe;
  }, []);

  const filteredHistory = history.filter(e => {
    if (filterType !== 'all' && e.dataType !== filterType) return false;
    if (searchText && !e.data.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const handleCopy = (entryId: string) => {
    const entry = history.find(e => e.id === entryId);
    if (!entry) return;
    clipboardBridge.copy(entry.data, entry.dataType, 'clipboard-manager', { copiedFrom: entryId });
    refreshHistory();
    tick();
  };

  const handleDelete = (entryId: string) => {
    clipboardBridge.clearHistory();
    refreshHistory();
    tick();
  };

  const handleExport = () => {
    const json = clipboardBridge.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipboard-${Date.now()}.json`;
    a.click();
  };

  const getTypeColor = (type: DataType) => {
    switch (type) {
      case 'code':
        return 'text-amber-400 bg-amber-900/20 border-amber-700';
      case 'json':
        return 'text-blue-400 bg-blue-900/20 border-blue-700';
      case 'html':
        return 'text-pink-400 bg-pink-900/20 border-pink-700';
      case 'file':
        return 'text-emerald-400 bg-emerald-900/20 border-emerald-700';
      case 'image':
        return 'text-purple-400 bg-purple-900/20 border-purple-700';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getTypeIcon = (type: DataType) => {
    switch (type) {
      case 'code':
        return '📝';
      case 'json':
        return '{}';
      case 'html':
        return '🌐';
      case 'file':
        return '📄';
      case 'image':
        return '🖼️';
      default:
        return '📋';
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Copy size={16} className="text-teal-400" />
          Clipboard Manager
          {currentData && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-900/50 text-teal-300 text-xs">
              {getTypeIcon(currentData.dataType)} Active
            </span>
          )}
        </h2>
        <button
          onClick={handleExport}
          className="p-1 hover:bg-zinc-800 rounded"
          title="Export history"
        >
          <Download size={14} className="text-zinc-500 hover:text-teal-400" />
        </button>
      </div>

      {/* Current clipboard */}
      {currentData && (
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0">
          <div className="text-[10px] text-zinc-600 mb-2">Current clipboard</div>
          <div className={`border rounded p-2 text-xs ${getTypeColor(currentData.dataType)}`}>
            <div className="font-mono line-clamp-3">{currentData.data.slice(0, 100)}</div>
            {currentData.sourceApp && (
              <div className="text-[10px] mt-1 opacity-70">From: {currentData.sourceApp}</div>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 shrink-0">
        <div className="grid grid-cols-7 gap-2 text-[10px]">
          <div>
            <div className="text-zinc-600">Total</div>
            <div className="text-white font-bold">{stats.total}</div>
          </div>
          {types.map(type => (
            <div key={type}>
              <div className="text-zinc-600 capitalize">{type}</div>
              <div className="text-white font-bold">{(stats.byType as any)[type] || 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0 space-y-2">
        <div className="flex gap-2">
          <Search size={14} className="text-zinc-600 mt-1.5" />
          <input
            placeholder="Search clipboard..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-teal-500 outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
              filterType === 'all'
                ? 'bg-teal-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {types.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
                filterType === type
                  ? 'bg-teal-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {getTypeIcon(type)} {type}
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            {history.length === 0
              ? 'Clipboard is empty. Copy data from apps to populate history.'
              : 'No entries match your filters.'}
          </div>
        ) : (
          filteredHistory.map(entry => (
            <button
              key={entry.id}
              onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
              className={`w-full text-left border rounded-lg p-2.5 transition ${getTypeColor(
                entry.dataType
              )} hover:opacity-80`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-lg mt-0.5">{getTypeIcon(entry.dataType)}</span>
                  <div className="flex-1 min-w-0">
                    {entry.title ? (
                      <>
                        <div className="font-bold text-sm truncate">{entry.title}</div>
                        <div className="text-[10px] opacity-75 line-clamp-2">
                          {entry.data.slice(0, 80)}...
                        </div>
                      </>
                    ) : (
                      <div className="text-xs font-mono line-clamp-2">
                        {entry.data.slice(0, 100)}
                        {entry.data.length > 100 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] opacity-60 whitespace-nowrap">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Expanded */}
              {selectedId === entry.id && (
                <div className="border-t border-current border-opacity-30 mt-2 pt-2 space-y-2">
                  <div className="bg-black/30 p-2 rounded text-[10px] max-h-24 overflow-y-auto font-mono">
                    {entry.data}
                  </div>

                  {entry.sourceApp && (
                    <div className="text-[10px] opacity-75">
                      Source: <span className="font-bold">{entry.sourceApp}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-current border-opacity-20">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleCopy(entry.id);
                      }}
                      className="flex-1 px-2 py-1 rounded text-xs bg-white/20 hover:bg-white/30 font-bold"
                    >
                      Copy
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(entry.id);
                      }}
                      className="p-1 rounded hover:bg-white/20"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Auto-detects data type (text, code, JSON, HTML)</div>
        <div>• Supports drag-drop between apps with custom MIME types</div>
        <div>• History persists across sessions</div>
        <div>• Click entry to preview and copy</div>
      </div>
    </div>
  );
};

export default ClipboardManagerApp;
