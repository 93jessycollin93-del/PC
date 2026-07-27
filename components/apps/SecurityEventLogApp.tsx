import React, { useState, useEffect } from 'react';
import { AlertTriangle, Lock, Zap, Shield, Clock, Download, Filter } from 'lucide-react';
import { bus } from '../../lib/bus';
import { appStorage } from '../../lib/appStorage';

interface SecurityEvent {
  timestamp: string;
  type: string;
  clientIp?: string;
  [key: string]: any;
}

export const SecurityEventLogApp: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<SecurityEvent[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);

  // Load events from appStorage (persisted by notification collector)
  useEffect(() => {
    const storage = appStorage('security-events');
    const storedEvents = storage.get<SecurityEvent[]>('events', []);
    setEvents(storedEvents);
    applyFilters(storedEvents, selectedType, selectedSeverity);

    // Subscribe to new security events via bus
    const unsubscribe = bus.on('permission-denied', (detail: any) => {
      const event: SecurityEvent = {
        timestamp: new Date().toISOString(),
        type: 'permission-denied',
        ...detail,
      };
      const updated = [event, ...storedEvents];
      setEvents(updated);
      storage.set('events', updated.slice(0, 500)); // Keep last 500 events
      applyFilters(updated, selectedType, selectedSeverity);
    });

    return () => unsubscribe();
  }, [selectedType, selectedSeverity]);

  const applyFilters = (allEvents: SecurityEvent[], typeFilter?: string | null, severityFilter?: string | null) => {
    let filtered = allEvents;

    if (typeFilter) {
      filtered = filtered.filter(e => e.type === typeFilter);
    }

    if (severityFilter) {
      filtered = filtered.filter(e => getEventSeverity(e.type) === severityFilter);
    }

    setFilteredEvents(filtered);
  };

  const getEventSeverity = (type: string): 'critical' | 'high' | 'medium' | 'low' => {
    switch (type) {
      case 'auth-failure':
      case 'symlink-escape-shell-cwd':
      case 'lockdown-enabled':
        return 'critical';
      case 'permission-denied':
      case 'invalid-termfs-path':
      case 'shell-exec-error':
        return 'high';
      case 'shell-exec-success':
      case 'audit-error':
        return 'medium';
      default:
        return 'low';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'auth-failure':
        return <Lock className="w-4 h-4 text-red-400" />;
      case 'permission-denied':
        return <Shield className="w-4 h-4 text-orange-400" />;
      case 'lockdown-enabled':
      case 'lockdown-disabled':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'shell-exec-success':
      case 'shell-exec-error':
        return <Zap className="w-4 h-4 text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getSeverityColor = (type: string) => {
    const severity = getEventSeverity(type);
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'medium':
        return 'bg-amber-500/10 border-amber-500/30';
      default:
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const eventTypes = Array.from(new Set(events.map(e => e.type)));
  const eventStats = {
    total: events.length,
    today: events.filter(e => {
      const eventDate = new Date(e.timestamp).toDateString();
      return eventDate === new Date().toDateString();
    }).length,
  };

  const exportEvents = () => {
    const csv = [
      'Timestamp,Type,Severity,ClientIP,Details',
      ...filteredEvents.map(e => {
        const details = JSON.stringify(e).replace(/"/g, '""');
        return `"${e.timestamp}","${e.type}","${getEventSeverity(e.type)}","${e.clientIp || 'unknown'}","${details}"`;
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-purple-950/30 to-zinc-950 p-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Security Event Log</h1>
        </div>
        <p className="text-zinc-400">Append-only SIEM-lite: auth failures, denials, shell exec, lockdown events</p>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Total Events</p>
              <p className="text-2xl font-bold">{eventStats.total}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Today</p>
              <p className="text-2xl font-bold text-sky-400">{eventStats.today}</p>
            </div>
          </div>
          <button
            onClick={exportEvents}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div>
            <p className="text-sm text-zinc-400 mb-2">Filter by Event Type</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedType(null);
                  applyFilters(events, null, selectedSeverity);
                }}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  selectedType === null
                    ? 'bg-sky-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                All
              </button>
              {eventTypes.map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    applyFilters(events, type, selectedSeverity);
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    selectedType === type
                      ? 'bg-sky-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-zinc-400 mb-2">Filter by Severity</p>
            <div className="flex flex-wrap gap-2">
              {['critical', 'high', 'medium', 'low'].map(severity => (
                <button
                  key={severity}
                  onClick={() => {
                    setSelectedSeverity(selectedSeverity === severity ? null : severity);
                    applyFilters(events, selectedType, selectedSeverity === severity ? null : severity);
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    selectedSeverity === severity
                      ? 'bg-sky-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="p-6 space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No security events</p>
            <p className="text-xs text-zinc-500 mt-1">Security events will appear here</p>
          </div>
        ) : (
          filteredEvents.map((event, idx) => (
            <div
              key={idx}
              className={`border rounded p-3 ${getSeverityColor(event.type)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  {getEventIcon(event.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{event.type}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        getEventSeverity(event.type) === 'critical' ? 'bg-red-500/20 text-red-400' :
                        getEventSeverity(event.type) === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        getEventSeverity(event.type) === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {getEventSeverity(event.type).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatTimestamp(event.timestamp)} {event.clientIp && `from ${event.clientIp}`}
                    </p>
                    {Object.entries(event).filter(([k]) => !['timestamp', 'type', 'clientIp'].includes(k)).length > 0 && (
                      <p className="text-xs text-zinc-400 mt-1 font-mono">
                        {Object.entries(event)
                          .filter(([k]) => !['timestamp', 'type', 'clientIp'].includes(k))
                          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                          .join(' ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
