/**
 * Workspace Profiles — Save and restore desktop layouts with window positions
 */

import { appStorage } from './appStorage';
import { bus } from './bus';
import { type DesktopItem } from '../types';

export interface WindowState {
  appId: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized?: boolean;
  zIndex?: number;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  lastUsed?: number;
  windows: WindowState[];
  activeAppId?: string; // which app was focused
}

class WorkspaceProfiles {
  private profiles: Map<string, WorkspaceProfile> = new Map();

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles(): void {
    const storage = appStorage('workspace-profiles');
    const saved = storage.get<WorkspaceProfile[]>('profiles', []);
    saved.forEach(p => this.profiles.set(p.id, p));
  }

  private saveProfiles(): void {
    const storage = appStorage('workspace-profiles');
    storage.set('profiles', Array.from(this.profiles.values()));
  }

  /**
   * Save current desktop state as a workspace profile
   */
  public saveWorkspace(
    name: string,
    windows: WindowState[],
    options: Partial<WorkspaceProfile> = {}
  ): WorkspaceProfile {
    const id = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const profile: WorkspaceProfile = {
      id,
      name,
      description: options.description,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      windows,
      activeAppId: options.activeAppId,
    };

    this.profiles.set(id, profile);
    this.saveProfiles();

    bus.emit('jackie-notification', {
      level: 'success',
      title: `Workspace saved`,
      message: `"${name}" (${windows.length} window${windows.length !== 1 ? 's' : ''})`,
      source: 'workspace-profiles',
    });

    return profile;
  }

  /**
   * Get a workspace profile by ID
   */
  public getWorkspace(id: string): WorkspaceProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * List all saved workspaces
   */
  public listWorkspaces(): WorkspaceProfile[] {
    return Array.from(this.profiles.values()).sort((a, b) => {
      const aTime = a.lastUsed || a.createdAt;
      const bTime = b.lastUsed || b.createdAt;
      return bTime - aTime; // Most recently used first
    });
  }

  /**
   * Delete a workspace profile
   */
  public deleteWorkspace(id: string): boolean {
    const success = this.profiles.delete(id);
    if (success) {
      this.saveProfiles();
      bus.emit('jackie-notification', {
        level: 'info',
        title: `Workspace deleted`,
        message: id,
        source: 'workspace-profiles',
      });
    }
    return success;
  }

  /**
   * Update workspace (e.g., rename, update description)
   */
  public updateWorkspace(id: string, updates: Partial<WorkspaceProfile>): WorkspaceProfile | undefined {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;

    const updated: WorkspaceProfile = {
      ...profile,
      ...updates,
      id: profile.id, // Don't allow ID changes
      createdAt: profile.createdAt, // Don't allow creation time changes
    };

    this.profiles.set(id, updated);
    this.saveProfiles();
    return updated;
  }

  /**
   * Mark workspace as recently used (update lastUsed timestamp)
   */
  public markUsed(id: string): void {
    const profile = this.profiles.get(id);
    if (profile) {
      profile.lastUsed = Date.now();
      this.saveProfiles();
    }
  }

  /**
   * Duplicate a workspace with a new name
   */
  public duplicateWorkspace(sourceId: string, newName: string): WorkspaceProfile | undefined {
    const source = this.profiles.get(sourceId);
    if (!source) return undefined;

    return this.saveWorkspace(newName, JSON.parse(JSON.stringify(source.windows)), {
      description: `Copy of "${source.name}"`,
    });
  }

  /**
   * Get recommended workspaces (most recently used, or quick presets)
   */
  public getRecommended(): WorkspaceProfile[] {
    return this.listWorkspaces().slice(0, 5);
  }

  /**
   * Get workspace statistics
   */
  public getStats(): { total: number; totalWindows: number; oldestProfile?: WorkspaceProfile; mostUsedProfile?: WorkspaceProfile } {
    const profiles = Array.from(this.profiles.values());
    if (profiles.length === 0) {
      return { total: 0, totalWindows: 0 };
    }

    const totalWindows = profiles.reduce((sum, p) => sum + p.windows.length, 0);
    const oldestProfile = profiles.sort((a, b) => a.createdAt - b.createdAt)[0];
    const mostUsedProfile = profiles.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];

    return { total: profiles.length, totalWindows, oldestProfile, mostUsedProfile };
  }
}

export const workspaceProfiles = new WorkspaceProfiles();
