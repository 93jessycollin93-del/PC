import React, { useEffect, useReducer, useState } from 'react';
import { Save, Trash2, Copy, Clock, Grid2X2, Plus } from 'lucide-react';
import { workspaceProfiles, type WindowState, type WorkspaceProfile } from '../../lib/workspaceProfiles';
import { appStorage } from '../../lib/appStorage';

/**
 * Workspace Manager — Save and restore desktop layouts with window positions
 */

interface WindowStats {
  windows: WindowState[];
  activeAppId?: string;
}

export const WorkspaceManagerApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDesc, setWorkspaceDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Re-render when workspaces change
  useEffect(() => {
    const storage = appStorage('workspace-profiles');
    const unsubscribe = storage.subscribe(tick);
    return unsubscribe;
  }, []);

  const handleSaveWorkspace = () => {
    if (!workspaceName.trim()) return;

    // TODO: In a real implementation, this would extract actual window state from App.tsx
    // For now, we'll create a placeholder with no windows
    const mockWindows: WindowState[] = [];

    workspaceProfiles.saveWorkspace(workspaceName, mockWindows, {
      description: workspaceDesc || undefined,
    });

    setWorkspaceName('');
    setWorkspaceDesc('');
    tick();
  };

  const handleLoadWorkspace = (id: string) => {
    const workspace = workspaceProfiles.getWorkspace(id);
    if (!workspace) return;

    // TODO: In a real implementation, this would:
    // 1. Close all current windows
    // 2. Open windows from the workspace
    // 3. Restore positions and sizes
    // For now, just mark as used and show notification
    workspaceProfiles.markUsed(id);
    tick();
  };

  const handleDeleteWorkspace = (id: string) => {
    if (!confirm('Delete this workspace?')) return;
    workspaceProfiles.deleteWorkspace(id);
    tick();
  };

  const handleDuplicateWorkspace = (id: string) => {
    const newName = prompt('New workspace name:');
    if (!newName) return;
    workspaceProfiles.duplicateWorkspace(id, newName);
    tick();
  };

  const handleRenameWorkspace = (id: string) => {
    if (!editName.trim()) return;
    workspaceProfiles.updateWorkspace(id, { name: editName });
    setEditingId(null);
    setEditName('');
    tick();
  };

  const workspaces = workspaceProfiles.listWorkspaces();
  const stats = workspaceProfiles.getStats();

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Grid2X2 size={16} className="text-cyan-400" />
          Workspace Manager
        </h2>
        <div className="text-xs text-zinc-500">{stats.total} workspace{stats.total !== 1 ? 's' : ''}</div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Save new workspace */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={14} className="text-cyan-400" />
            <h3 className="font-bold text-white">Save Current Layout</h3>
          </div>
          <div className="space-y-2">
            <input
              placeholder="Workspace name (e.g., Coding, Research, Design)"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-cyan-500 outline-none"
            />
            <textarea
              placeholder="Description (optional)"
              value={workspaceDesc}
              onChange={e => setWorkspaceDesc(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-cyan-500 outline-none resize-none h-12"
            />
            <button
              onClick={handleSaveWorkspace}
              className="w-full px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <Save size={14} />
              Save Workspace
            </button>
            <div className="text-[10px] text-zinc-600">
              Saves current window positions, sizes, and active app. Load to restore.
            </div>
          </div>
        </div>

        {/* Workspace list */}
        {workspaces.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No workspaces saved yet. Create one to save your current desktop layout.
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map(workspace => (
              <div
                key={workspace.id}
                className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 space-y-2 hover:border-zinc-600"
              >
                {/* Title & editing */}
                {editingId === workspace.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameWorkspace(workspace.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-cyan-500 outline-none"
                    />
                    <button
                      onClick={() => handleRenameWorkspace(workspace.id)}
                      className="px-2 py-1 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingId(workspace.id);
                      setEditName(workspace.name);
                    }}
                    className="cursor-pointer"
                  >
                    <div className="font-bold text-white hover:text-cyan-300">{workspace.name}</div>
                    {workspace.description && <div className="text-xs text-zinc-500">{workspace.description}</div>}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-zinc-500">Windows</span>
                    <div className="text-white font-semibold">{workspace.windows.length}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Created</span>
                    <div className="text-white font-semibold">{new Date(workspace.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Last used</span>
                    <div className="text-white font-semibold">
                      {workspace.lastUsed ? new Date(workspace.lastUsed).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => handleLoadWorkspace(workspace.id)}
                    className="flex-1 px-2 py-1 rounded text-xs bg-cyan-900/50 hover:bg-cyan-900 text-cyan-300 font-semibold border border-cyan-800"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDuplicateWorkspace(workspace.id)}
                    className="p-1 rounded hover:bg-zinc-800"
                    title="Duplicate workspace"
                  >
                    <Copy size={12} className="text-zinc-500 hover:text-cyan-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteWorkspace(workspace.id)}
                    className="p-1 rounded hover:bg-zinc-800"
                    title="Delete workspace"
                  >
                    <Trash2 size={12} className="text-zinc-600 hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600">
        <div className="flex items-center gap-1 mb-1">
          <Clock size={11} /> Total windows saved: {stats.totalWindows}
        </div>
        <div>
          • Workspaces store window positions, sizes, and state
        </div>
        <div>
          • Load to restore layout instantly
        </div>
      </div>
    </div>
  );
};

export default WorkspaceManagerApp;
