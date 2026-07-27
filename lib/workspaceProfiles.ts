/**
 * Workspace Profiles — save & restore named desktop layouts
 *
 * Features:
 * - Save current window state as a named profile (windows open, positions, sizes, focused app)
 * - Restore entire workspace to a saved state
 * - List all saved profiles with metadata
 * - Delete profiles
 * - Quick presets (Coding, Research, Ops workspaces)
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

export interface WindowState {
  itemId: string;
  id: string;
  zIndex: number;
  pos: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  windows: WindowState[];
  focusedId?: string;
  nextZIndex?: number;
}

class WorkspaceProfiles {
  private profiles: Map<string, WorkspaceProfile> = new Map();

  constructor() {
    this.loadProfiles();
  }

  /**
   * Save current workspace state as a profile
   */
  public saveProfile(
    name: string,
    windows: WindowState[],
    focusedId: string | null,
    nextZIndex: number,
    description?: string
  ): WorkspaceProfile {
    const profile: WorkspaceProfile = {
      id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      timestamp: Date.now(),
      windows,
      focusedId: focusedId || undefined,
      nextZIndex,
    };

    this.profiles.set(profile.id, profile);
    this.saveProfilesToStorage();

    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Workspace saved',
      message: `"${name}" with ${windows.length} windows`,
      source: 'workspace-profiles',
    });

    return profile;
  }

  /**
   * Get all profiles
   */
  public getProfiles(): WorkspaceProfile[] {
    return Array.from(this.profiles.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get a specific profile
   */
  public getProfile(id: string): WorkspaceProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get profile by name
   */
  public getProfileByName(name: string): WorkspaceProfile | undefined {
    return Array.from(this.profiles.values()).find(p => p.name === name);
  }

  /**
   * Restore a workspace profile
   */
  public restoreProfile(id: string): WorkspaceProfile | null {
    const profile = this.profiles.get(id);
    if (!profile) return null;

    bus.emit('restore-workspace-profile', {
      profile,
    });

    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Workspace restored',
      message: `"${profile.name}" with ${profile.windows.length} windows`,
      source: 'workspace-profiles',
    });

    return profile;
  }

  /**
   * Delete a profile
   */
  public deleteProfile(id: string): boolean {
    const deleted = this.profiles.delete(id);
    if (deleted) {
      this.saveProfilesToStorage();
    }
    return deleted;
  }

  /**
   * Rename a profile
   */
  public renameProfile(id: string, newName: string): boolean {
    const profile = this.profiles.get(id);
    if (!profile) return false;

    profile.name = newName;
    this.saveProfilesToStorage();
    return true;
  }

  /**
   * Get profile stats
   */
  public getStats(): {
    total: number;
    mostRecent?: WorkspaceProfile;
    largest?: WorkspaceProfile;
  } {
    const profiles = this.getProfiles();
    if (profiles.length === 0) {
      return { total: 0 };
    }

    const mostRecent = profiles[0];
    const largest = profiles.reduce((prev, curr) =>
      curr.windows.length > prev.windows.length ? curr : prev
    );

    return {
      total: profiles.length,
      mostRecent,
      largest,
    };
  }

  /**
   * Private methods
   */
  private loadProfiles(): void {
    const storage = appStorage('workspace-profiles');
    const saved = storage.get<WorkspaceProfile[]>('profiles', []);
    saved.forEach(p => this.profiles.set(p.id, p));
  }

  private saveProfilesToStorage(): void {
    const storage = appStorage('workspace-profiles');
    storage.set('profiles', Array.from(this.profiles.values()));
  }
}

export const workspaceProfiles = new WorkspaceProfiles();
