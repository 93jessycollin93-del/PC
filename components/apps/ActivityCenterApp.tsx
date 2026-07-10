import React, { useEffect, useReducer, useState } from 'react';
import { Clock, Trash2, RotateCcw, Download, Filter, Search } from 'lucide-react';
import { activityCenter, type Activity, type ActivityType, type ActivityStatus } from '../../lib/activityCenter';

/**
 * Activity Center — unified view of sync, notifications, and events
 */

export const ActivityCenterApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({ total: 0, byType: {}, byStatus: {} });
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const types: ActivityType[] = ['sync', 'notification', 'error', 'event', 'automation', 'scheduler'];
  const statuses: ActivityStatus[] = ['pending', 'completed', 'failed', 'info', 'success', 'warning'];

  const refreshActivities = () => {
    setActivities(activityCenter.getActivities());
    setStats(activityCenter.getStats());
  };

  useEffect(() => {
    refreshActivities();
    const interval = setInterval(refreshActivities, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredActivities = activities.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (searchText && !a.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const handleRetry = (id: string) => {
    activityCenter.retryActivity(id);
    refreshActivities();
    tick();
  };

  const handleClear = (type?: ActivityType) => {
    if (!confirm(`Clear ${type ? type + ' ' : ''}activities?`)) return;
    activityCenter.clearActivities(type);
    refreshActivities();
    tick();
  };

  const handleExport = () => {
    const json = activityCenter.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activities-${Date.now()}.json`;
    a.click();
  };

  const getStatusColor = (status: ActivityStatus) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'text-emerald-400 bg-emerald-900/20 border-emerald-700';
      case 'pending':
      case 'info':
        return 'text-blue-400 bg-blue-900/20 border-blue-700';
      case 'failed':
        return 'text-red-400 bg-red-900/20 border-red-700';
      case 'warning':
        return 'text-amber-400 bg-amber-900/20 border-amber-700';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getTypeIcon = (type: ActivityType) => {
    switch (type) {
      case 'sync':
        return '💾';
      case 'notification':
        return '🔔';
      case 'error':
        return '❌';
      case 'event':
        return '📋';
      case 'automation':
        return '⚙️';
      case 'scheduler':
        return '⏱️';
      default:
        return '•';
    }
  };

  const syncStatus = activityCenter.getSyncStatus();
  const hasPendingSync = syncStatus.totalPending > 0;

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Clock size={16} className="text-cyan-400" />
          Activity Center
          {hasPendingSync && <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs">
            {syncStatus.totalPending} pending
          </span>}
        </h2>
        <button
          onClick={handleExport}
          className="p-1 hover:bg-zinc-800 rounded"
          title="Export activities"
        >
          <Download size={14} className="text-zinc-500 hover:text-cyan-400" />
        </button>
      </div>

      {/* Statistics bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 shrink-0">
        <div className="grid grid-cols-6 gap-2 text-[10px]">
          <div>
            <div className="text-zinc-600">Total</div>
            <div className="text-white font-bold">{stats.total}</div>
          </div>
          <div>
            <div className="text-blue-500">Pending</div>
            <div className="text-blue-400 font-bold">{(stats.byStatus as any).pending || 0}</div>
          </div>
          <div>
            <div className="text-emerald-500">Success</div>
            <div className="text-emerald-400 font-bold">{(stats.byStatus as any).completed || 0}</div>
          </div>
          <div>
            <div className="text-red-500">Failed</div>
            <div className="text-red-400 font-bold">{(stats.byStatus as any).failed || 0}</div>
          </div>
          <div>
            <div className="text-amber-500">Warned</div>
            <div className="text-amber-400 font-bold">{(stats.byStatus as any).warning || 0}</div>
          </div>
          <div>
            <div className="text-cyan-500">Sync Q</div>
            <div className="text-cyan-400 font-bold">{syncStatus.totalPending}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0 space-y-2">
        {/* Search */}
        <div className="flex gap-2">
          <Search size={14} className="text-zinc-600 mt-1.5" />
          <input
            placeholder="Search activities..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-cyan-500 outline-none"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
              filterType === 'all'
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All Types
          </button>
          {types.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
                filterType === type
                  ? 'bg-cyan-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {getTypeIcon(type)} {type}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
              filterStatus === 'all'
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All Status
          </button>
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
                filterStatus === status
                  ? 'bg-cyan-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Activities timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredActivities.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            {activities.length === 0
              ? 'No activities yet. Events will appear here.'
              : 'No activities match your filters.'}
          </div>
        ) : (
          filteredActivities.map(activity => (
            <div
              key={activity.id}
              className={`border rounded-lg p-2.5 cursor-pointer transition ${getStatusColor(
                activity.status
              )}`}
            >
              {/* Summary */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === activity.id ? null : activity.id)
                }
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{getTypeIcon(activity.type)}</span>
                      <span className="font-bold text-sm">{activity.title}</span>
                      {activity.retryable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30">
                          Retryable
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-70">
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span className="text-sm opacity-60">
                    {expandedId === activity.id ? '▼' : '▶'}
                  </span>
                </div>
              </button>

              {/* Expanded details */}
              {expandedId === activity.id && (
                <div className="border-t border-current border-opacity-30 mt-2 pt-2 space-y-2">
                  {activity.message && (
                    <div className="text-xs opacity-90 line-clamp-4 font-mono">
                      {activity.message}
                    </div>
                  )}

                  {activity.data && (
                    <div className="text-[9px] opacity-70 font-mono max-h-24 overflow-y-auto">
                      {Object.entries(activity.data).map(([k, v]) => (
                        <div key={k}>
                          <strong>{k}:</strong> {JSON.stringify(v).slice(0, 50)}...
                        </div>
                      ))}
                    </div>
                  )}

                  {activity.source && (
                    <div className="text-[10px] opacity-75">
                      Source: <span className="font-mono">{activity.source}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-current border-opacity-20">
                    {activity.retryable && activity.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(activity.id)}
                        className="flex-1 px-2 py-1 rounded text-xs bg-white/20 hover:bg-white/30 font-bold"
                      >
                        <RotateCcw size={11} className="inline mr-1" /> Retry
                      </button>
                    )}
                    <button
                      onClick={() => handleClear()}
                      className="p-1 rounded hover:bg-white/20"
                      title="Clear all"
                    >
                      <Trash2 size={11} />
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
        <div>• Real-time activity feed from all Jackie systems</div>
        <div>• Auto-archives activities older than 7 days</div>
        <div>• Failed sync/automation tasks marked retryable</div>
        <div>• Showing {filteredActivities.length} of {activities.length} activities</div>
      </div>
    </div>
  );
};

export default ActivityCenterApp;
