import React, { useState, useEffect, useReducer } from 'react';
import { Save, Trash2, RotateCcw, Grid2X2, Copy } from 'lucide-react';
import { workspaceProfiles, type WorkspaceProfile } from '../../lib/workspaceProfiles';

export const WorkspaceManagerApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>([]);
  const [stats, setStats] = useState(workspaceProfiles.getStats());
  const [profileName, setProfileName] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const refreshProfiles = () => {
    setProfiles(workspaceProfiles.getProfiles());
    setStats(workspaceProfiles.getStats());
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  const handleSaveProfile = () => {
    if (!profileName.trim()) return;
    // This is a placeholder - in real app, would capture current window state from App.tsx
    workspaceProfiles.saveProfile(profileName, [], null, 100, profileDesc || undefined);
    setProfileName('');
    setProfileDesc('');
    refreshProfiles();
    tick();
  };

  const handleRestoreProfile = (id: string) => {
    if (!confirm('Restore this workspace? Current windows will be replaced.')) return;
    workspaceProfiles.restoreProfile(id);
    refreshProfiles();
    tick();
  };

  const handleDeleteProfile = (id: string) => {
    if (!confirm('Delete this workspace profile?')) return;
    workspaceProfiles.deleteProfile(id);
    refreshProfiles();
    tick();
  };

  const handleRenameProfile = (id: string) => {
    if (!editingName.trim()) return;
    workspaceProfiles.renameProfile(id, editingName);
    setEditingId(null);
    setEditingName('');
    refreshProfiles();
    tick();
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Grid2X2 size={16} className="text-cyan-400" />
          Workspace Profiles
        </h2>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-zinc-600">Total Profiles</div>
            <div className="text-white font-bold text-lg">{stats.total}</div>
          </div>
          <div>
            <div className="text-zinc-600">Most Recent</div>
            <div className="text-white text-xs">
              {stats.mostRecent
                ? new Date(stats.mostRecent.timestamp).toLocaleDateString()
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-zinc-600">Largest</div>
            <div className="text-white text-xs">
              {stats.largest ? `${stats.largest.windows.length} windows` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Save workspace form */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Save size={14} className="text-cyan-400" />
            <h3 className="font-bold text-white">Save Current Workspace</h3>
          </div>
          <div className="space-y-2">
            <input
              placeholder="Workspace name (e.g., Coding, Research, Ops)"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-cyan-500 outline-none"
            />
            <textarea
              placeholder="Description (optional)"
              value={profileDesc}
              onChange={e => setProfileDesc(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-cyan-500 outline-none resize-none h-12"
            />
            <button
              onClick={handleSaveProfile}
              className="w-full px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm"
            >
              Save Workspace
            </button>
          </div>
        </div>

        {/* Profiles list */}
        {profiles.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No saved workspaces yet. Configure your desktop and save a workspace to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map(profile => (
              <div
                key={profile.id}
                className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 hover:border-zinc-600"
              >
                {/* Summary */}
                <button
                  onClick={() => setSelectedId(selectedId === profile.id ? null : profile.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      {editingId === profile.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameProfile(profile.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="px-2 py-1 bg-zinc-800 border border-cyan-500 rounded text-sm text-white outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className="font-bold text-white">{profile.name}</div>
                          <div className="text-xs text-zinc-500">
                            {new Date(profile.timestamp).toLocaleString()}
                          </div>
                          {profile.description && (
                            <div className="text-xs text-zinc-400 mt-1 line-clamp-1">
                              {profile.description}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                      {profile.windows.length} windows
                    </span>
                  </div>
                </button>

                {/* Expanded */}
                {selectedId === profile.id && (
                  <div className="border-t border-zinc-700 mt-2 pt-2 space-y-2">
                    <div className="text-[10px] text-zinc-600">
                      Windows: {profile.windows.map(w => w.itemId).join(', ') || 'none'}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreProfile(profile.id)}
                        className="flex-1 px-2 py-1 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                      >
                        <RotateCcw size={11} className="inline mr-1" /> Restore
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(profile.id);
                          setEditingName(profile.name);
                        }}
                        className="px-2 py-1 rounded text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
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
        <div>• Save workspace layouts for quick setup (Coding, Research, Ops, etc.)</div>
        <div>• Each profile stores open windows, positions, sizes, and focused app</div>
        <div>• Restore a profile to instantly recreate a saved layout</div>
        <div>• Rename or delete profiles as needed</div>
      </div>
    </div>
  );
};

export default WorkspaceManagerApp;
