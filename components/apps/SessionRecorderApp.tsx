import React, { useState, useEffect } from 'react';
import { Play, Square, Trash2, Download, Tag, Clock, MoreVertical } from 'lucide-react';
import { sessionRecorder, type Incident } from '../../lib/sessionRecorder';

export const SessionRecorderApp: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentIncident, setCurrentIncident] = useState<Incident | null>(null);
  const [newIncidentName, setNewIncidentName] = useState('');
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  useEffect(() => {
    refreshIncidents();
    setCurrentIncident(sessionRecorder.getCurrentIncident());
  }, []);

  const refreshIncidents = () => {
    setIncidents(sessionRecorder.getIncidents());
    setCurrentIncident(sessionRecorder.getCurrentIncident());
  };

  const handleStartRecording = () => {
    if (!newIncidentName.trim()) return;
    const incident = sessionRecorder.startIncident(newIncidentName, newIncidentDesc);
    setCurrentIncident(incident);
    setNewIncidentName('');
    setNewIncidentDesc('');
    refreshIncidents();
  };

  const handleStopRecording = () => {
    const ended = sessionRecorder.endIncident();
    if (ended) {
      setSelectedIncident(ended);
    }
    setCurrentIncident(null);
    refreshIncidents();
  };

  const handleAddTag = (incidentId: string) => {
    if (!tagInput.trim()) return;
    const incident = sessionRecorder.getIncident(incidentId);
    if (incident) {
      if (!incident.tags) incident.tags = [];
      if (!incident.tags.includes(tagInput.trim())) {
        incident.tags.push(tagInput.trim());
      }
    }
    setTagInput('');
    refreshIncidents();
  };

  const handleExport = (id: string) => {
    const json = sessionRecorder.exportIncident(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    sessionRecorder.deleteIncident(id);
    if (selectedIncident?.id === id) setSelectedIncident(null);
    refreshIncidents();
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-orange-950/30 to-zinc-950 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-8 h-8 text-orange-400" />
          <h1 className="text-3xl font-bold">Session Recorder</h1>
        </div>
        <p className="text-zinc-400">Record and replay incident timelines with full event history</p>
      </div>

      {/* Recording Controls */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6 shrink-0">
        {!currentIncident ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Incident Name</label>
              <input
                type="text"
                placeholder="e.g., Deployment Issue on 2026-07-11"
                value={newIncidentName}
                onChange={(e) => setNewIncidentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newIncidentName.trim()) {
                    handleStartRecording();
                  }
                }}
                className="w-full px-3 py-2 rounded bg-zinc-950 border border-zinc-700 text-sm text-white focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Description (optional)</label>
              <input
                type="text"
                placeholder="Brief description of the incident"
                value={newIncidentDesc}
                onChange={(e) => setNewIncidentDesc(e.target.value)}
                className="w-full px-3 py-2 rounded bg-zinc-950 border border-zinc-700 text-sm text-white focus:border-orange-500 outline-none"
              />
            </div>
            <button
              onClick={handleStartRecording}
              disabled={!newIncidentName.trim()}
              className="w-full px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-700 text-white font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Play className="w-4 h-4" />
              Start Recording
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 mb-3">
              <p className="text-sm font-medium text-orange-400 mb-1">Recording in progress</p>
              <p className="text-xs text-zinc-400">{currentIncident.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{currentIncident.events.length} events captured</p>
            </div>
            <button
              onClick={handleStopRecording}
              className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Square className="w-4 h-4" />
              Stop Recording
            </button>
          </div>
        )}
      </div>

      {/* Incidents List */}
      <div className="flex-1 overflow-auto p-6">
        {incidents.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No incidents recorded</p>
            <p className="text-xs text-zinc-500 mt-1">Start a recording to begin capturing events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(incident => (
              <div
                key={incident.id}
                onClick={() => {
                  setSelectedIncident(incident);
                  setExpandedIncident(expandedIncident === incident.id ? null : incident.id);
                }}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedIncident?.id === incident.id
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{incident.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(incident.startedAt).toLocaleTimeString()} • {incident.events.length} events
                    </p>
                    {incident.description && (
                      <p className="text-xs text-zinc-400 mt-1">{incident.description}</p>
                    )}
                  </div>
                  {incident.endedAt && (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400 whitespace-nowrap ml-2">
                      Ended
                    </span>
                  )}
                </div>

                {/* Tags */}
                {incident.tags && incident.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {incident.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Event Timeline */}
                {expandedIncident === incident.id && (
                  <div className="bg-zinc-950/50 rounded p-3 mt-3 border border-zinc-800 max-h-48 overflow-y-auto">
                    <div className="text-xs space-y-2">
                      {incident.events.slice(-20).map((event, idx) => (
                        <div key={idx} className="flex gap-2 text-zinc-400">
                          <span className="text-zinc-600 min-w-fit">{new Date(event.timestamp).toLocaleTimeString()}</span>
                          <span className="text-cyan-400">{event.channel}</span>
                          <span className="text-zinc-500 truncate">{typeof event.data === 'string' ? event.data : JSON.stringify(event.data).substring(0, 50)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedIncident?.id === incident.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add tag"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTag(incident.id);
                        }}
                        className="flex-1 px-2 py-1 rounded text-sm bg-zinc-900 border border-zinc-700 text-white focus:border-orange-500 outline-none"
                      />
                      <button
                        onClick={() => handleAddTag(incident.id)}
                        className="px-3 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExport(incident.id)}
                        className="flex-1 px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 transition-all"
                      >
                        <Download className="w-3 h-3" />
                        Export
                      </button>
                      <button
                        onClick={() => handleDelete(incident.id)}
                        className="flex-1 px-3 py-1 rounded text-xs font-medium bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white flex items-center justify-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
