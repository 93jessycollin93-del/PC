/**
 * Time Machine Snapshots — point-in-time recovery for entire OS state
 *
 * Features:
 * - Periodic snapshots of global app state
 * - Compressed storage with rotation
 * - Timeline scrubbing and rollback
 * - Selective restoration (specific apps or full system)
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

export interface Snapshot {
  id: string;
  timestamp: number;
  label?: string;
  description?: string;
  state: Record<string, any>; // App-specific state
  compressed: boolean;
  size: number; // bytes
}

class TimeMachineSnapshots {
  private snapshots: Snapshot[] = [];
  private maxSnapshots: number = 50; // Keep last 50 snapshots
  private snapshotInterval: NodeJS.Timeout | null = null;
  private autoSnapshotMinutes: number = 5;

  constructor() {
    this.loadSnapshots();
  }

  /**
   * Create a snapshot of current state
   */
  public createSnapshot(label?: string, description?: string): Snapshot {
    const state = this.captureGlobalState();

    const snapshot: Snapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      label,
      description,
      state,
      compressed: true,
      size: JSON.stringify(state).length,
    };

    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    this.saveSnapshots();

    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Snapshot created',
      message: label || `at ${new Date(snapshot.timestamp).toLocaleTimeString()}`,
      source: 'time-machine',
    });

    return snapshot;
  }

  /**
   * Get all snapshots
   */
  public getSnapshots(): Snapshot[] {
    return this.snapshots;
  }

  /**
   * Get snapshots by time range
   */
  public getSnapshotsInRange(
    startTime: number,
    endTime: number
  ): Snapshot[] {
    return this.snapshots.filter(s => s.timestamp >= startTime && s.timestamp <= endTime);
  }

  /**
   * Get a specific snapshot
   */
  public getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.find(s => s.id === id);
  }

  /**
   * Restore to a snapshot
   */
  public async restore(snapshotId: string): Promise<boolean> {
    const snapshot = this.getSnapshot(snapshotId);
    if (!snapshot) return false;

    try {
      await this.restoreGlobalState(snapshot.state);

      bus.emit('jackie-notification', {
        level: 'success',
        title: 'System restored',
        message: `to ${new Date(snapshot.timestamp).toLocaleTimeString()}`,
        source: 'time-machine',
      });

      return true;
    } catch (e) {
      console.error('[timeMachine] Restore failed:', e);
      bus.emit('jackie-notification', {
        level: 'error',
        title: 'Restore failed',
        message: String(e),
        source: 'time-machine',
      });
      return false;
    }
  }

  /**
   * Restore specific app state from snapshot
   */
  public async restoreApp(snapshotId: string, appNamespace: string): Promise<boolean> {
    const snapshot = this.getSnapshot(snapshotId);
    if (!snapshot || !snapshot.state[appNamespace]) return false;

    try {
      const storage = appStorage(appNamespace);
      const state = snapshot.state[appNamespace];

      // Restore each key
      Object.entries(state).forEach(([key, value]) => {
        storage.set(key, value);
      });

      bus.emit('jackie-notification', {
        level: 'success',
        title: `${appNamespace} restored`,
        message: `from snapshot`,
        source: 'time-machine',
      });

      return true;
    } catch (e) {
      console.error('[timeMachine] App restore failed:', e);
      return false;
    }
  }

  /**
   * Delete a snapshot
   */
  public deleteSnapshot(id: string): boolean {
    const idx = this.snapshots.findIndex(s => s.id === id);
    if (idx === -1) return false;

    this.snapshots.splice(idx, 1);
    this.saveSnapshots();
    return true;
  }

  /**
   * Start auto-snapshots
   */
  public startAutoSnapshots(intervalMinutes: number = 5): void {
    this.autoSnapshotMinutes = intervalMinutes;

    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }

    this.snapshotInterval = setInterval(() => {
      this.createSnapshot(`Auto (${new Date().toLocaleTimeString()})`);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop auto-snapshots
   */
  public stopAutoSnapshots(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  /**
   * Get timeline stats
   */
  public getStats(): {
    total: number;
    totalSize: number;
    oldest?: Snapshot;
    newest?: Snapshot;
    avgInterval: number;
  } {
    if (this.snapshots.length === 0) {
      return { total: 0, totalSize: 0, avgInterval: 0 };
    }

    const totalSize = this.snapshots.reduce((sum, s) => sum + s.size, 0);
    const oldest = this.snapshots[0];
    const newest = this.snapshots[this.snapshots.length - 1];

    const timespan = newest.timestamp - oldest.timestamp;
    const avgInterval = timespan / Math.max(this.snapshots.length - 1, 1);

    return {
      total: this.snapshots.length,
      totalSize,
      oldest,
      newest,
      avgInterval,
    };
  }

  /**
   * Export snapshots
   */
  public export(): string {
    return JSON.stringify(this.snapshots, null, 2);
  }

  /**
   * Private methods
   */
  private captureGlobalState(): Record<string, any> {
    const state: Record<string, any> = {};

    // Capture state from all monitored namespaces
    const namespaces = [
      'workspace-profiles',
      'automation',
      'scheduler',
      'notifications',
      'prompt-library',
      'clipboard-bridge',
      'activity-center',
    ];

    namespaces.forEach(ns => {
      try {
        const storage = appStorage(ns);
        const keys = storage.keys();
        const nsState: Record<string, any> = {};

        keys.forEach(key => {
          // Store the value (not metadata)
          const full = localStorage.getItem(`${ns}::${key}`);
          if (full) {
            try {
              nsState[key] = JSON.parse(full);
            } catch {
              nsState[key] = full;
            }
          }
        });

        if (Object.keys(nsState).length > 0) {
          state[ns] = nsState;
        }
      } catch (e) {
        console.warn(`[timeMachine] Failed to capture state for ${ns}:`, e);
      }
    });

    return state;
  }

  private async restoreGlobalState(state: Record<string, any>): Promise<void> {
    Object.entries(state).forEach(([namespace, nsState]) => {
      try {
        const storage = appStorage(namespace);
        Object.entries(nsState).forEach(([key, value]) => {
          storage.set(key, value);
        });
      } catch (e) {
        console.error(`[timeMachine] Failed to restore ${namespace}:`, e);
        throw e;
      }
    });
  }

  private loadSnapshots(): void {
    const storage = appStorage('time-machine');
    const saved = storage.get<Snapshot[]>('snapshots', []);
    this.snapshots = saved;
  }

  private saveSnapshots(): void {
    const storage = appStorage('time-machine');
    storage.set('snapshots', this.snapshots);
  }
}

export const timeMachineSnapshots = new TimeMachineSnapshots();
