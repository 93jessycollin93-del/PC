/**
 * App Health Monitor — tracks app crashes, errors, and provides recovery actions
 *
 * Features:
 * - Monitor app errors in real-time
 * - Track uptime and error frequency
 * - Provide reset/reload controls
 * - Health status indicators
 */

import { bus } from './bus';

export interface AppHealthSnapshot {
  appId: string;
  lastChecked: number;
  status: 'healthy' | 'degraded' | 'crashed' | 'blank';
  uptime: number; // milliseconds since last crash
  errorCount: number;
  lastError?: string;
  lastErrorTime?: number;
  consecutiveErrors: number;
  isLoading: boolean;
  renderCount: number;
}

class AppHealthMonitor {
  private healthSnapshots: Map<string, AppHealthSnapshot> = new Map();
  private errorCatchers: Map<string, number> = new Map(); // appId -> error count
  private startTimes: Map<string, number> = new Map();

  constructor() {
    // Subscribe to app launch events
    bus.on('launch-app', (detail: any) => {
      this.registerApp(detail.appId);
    });

    // Health check every 30s
    setInterval(() => this.healthCheck(), 30000);
  }

  /**
   * Register an app for monitoring
   */
  public registerApp(appId: string): void {
    if (this.healthSnapshots.has(appId)) return;

    this.healthSnapshots.set(appId, {
      appId,
      lastChecked: Date.now(),
      status: 'healthy',
      uptime: Date.now() - (this.startTimes.get(appId) || Date.now()),
      errorCount: 0,
      consecutiveErrors: 0,
      isLoading: false,
      renderCount: 0,
    });

    this.startTimes.set(appId, Date.now());
  }

  /**
   * Record an app error
   */
  public recordError(appId: string, error: string): void {
    if (!this.healthSnapshots.has(appId)) {
      this.registerApp(appId);
    }

    const snapshot = this.healthSnapshots.get(appId)!;
    snapshot.errorCount += 1;
    snapshot.consecutiveErrors += 1;
    snapshot.lastError = error;
    snapshot.lastErrorTime = Date.now();

    // Determine status based on error frequency
    if (snapshot.consecutiveErrors >= 3) {
      snapshot.status = 'crashed';
    } else if (snapshot.consecutiveErrors >= 1) {
      snapshot.status = 'degraded';
    }

    bus.emit('app-error', {
      appId,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Record app render
   */
  public recordRender(appId: string): void {
    if (!this.healthSnapshots.has(appId)) {
      this.registerApp(appId);
    }

    const snapshot = this.healthSnapshots.get(appId)!;
    snapshot.renderCount += 1;
    snapshot.consecutiveErrors = 0; // Reset on successful render
    snapshot.lastChecked = Date.now();

    if (snapshot.status === 'degraded' || snapshot.status === 'crashed') {
      snapshot.status = 'healthy';
    }
  }

  /**
   * Record loading state
   */
  public setLoading(appId: string, loading: boolean): void {
    if (!this.healthSnapshots.has(appId)) {
      this.registerApp(appId);
    }

    const snapshot = this.healthSnapshots.get(appId)!;
    snapshot.isLoading = loading;
  }

  /**
   * Get snapshot for an app
   */
  public getSnapshot(appId: string): AppHealthSnapshot | undefined {
    return this.healthSnapshots.get(appId);
  }

  /**
   * Get all app snapshots
   */
  public getAllSnapshots(): AppHealthSnapshot[] {
    return Array.from(this.healthSnapshots.values());
  }

  /**
   * Reset an app (clear errors, restart)
   */
  public resetApp(appId: string): void {
    const snapshot = this.healthSnapshots.get(appId);
    if (snapshot) {
      snapshot.status = 'healthy';
      snapshot.errorCount = 0;
      snapshot.consecutiveErrors = 0;
      snapshot.lastError = undefined;
      snapshot.lastErrorTime = undefined;
      snapshot.uptime = 0;
      this.startTimes.set(appId, Date.now());
    }

    bus.emit('app-reset', { appId, timestamp: Date.now() });
  }

  /**
   * Get app health statistics
   */
  public getStats(): {
    totalApps: number;
    healthyApps: number;
    degradedApps: number;
    crashedApps: number;
    totalErrors: number;
  } {
    const snapshots = Array.from(this.healthSnapshots.values());
    return {
      totalApps: snapshots.length,
      healthyApps: snapshots.filter(s => s.status === 'healthy').length,
      degradedApps: snapshots.filter(s => s.status === 'degraded').length,
      crashedApps: snapshots.filter(s => s.status === 'crashed').length,
      totalErrors: snapshots.reduce((sum, s) => sum + s.errorCount, 0),
    };
  }

  /**
   * Internal health check
   */
  private healthCheck(): void {
    const snapshots = Array.from(this.healthSnapshots.values());
    const now = Date.now();

    snapshots.forEach(snapshot => {
      // No renders in 2 minutes could indicate a blank/stuck app
      if (snapshot.renderCount === 0 && now - snapshot.lastChecked > 120000) {
        if (snapshot.status === 'healthy') {
          snapshot.status = 'blank';
        }
      }

      snapshot.uptime = now - (this.startTimes.get(snapshot.appId) || now);
    });
  }
}

export const appHealthMonitor = new AppHealthMonitor();
