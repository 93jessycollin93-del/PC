/**
 * Runtime State Manager — Live System Awareness
 * Tracks active pods, resources, risks, and system health
 */

import type { RuntimeState, ActivePodInfo, InformationLayerStatus } from './system-context';

export class RuntimeStateManager {
  private state: RuntimeState;
  private stateHistory: RuntimeState[] = [];
  private readonly MAX_HISTORY = 50;

  constructor(initialState: RuntimeState) {
    this.state = initialState;
    this.stateHistory.push(JSON.parse(JSON.stringify(initialState)));
  }

  /**
   * Get current runtime state
   */
  getState(): RuntimeState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update runtime state and track history
   */
  updateState(changes: Partial<RuntimeState>): void {
    this.state = {
      ...this.state,
      ...changes,
      activePods: changes.activePods || this.state.activePods,
      informationLayers: changes.informationLayers || this.state.informationLayers,
      potentialRisks: changes.potentialRisks || this.state.potentialRisks,
    };

    // Track history
    this.stateHistory.push(JSON.parse(JSON.stringify(this.state)));
    if (this.stateHistory.length > this.MAX_HISTORY) {
      this.stateHistory.shift();
    }
  }

  /**
   * Spawn a new pod (add to active pods list)
   */
  spawnPod(pod: ActivePodInfo): void {
    const updated = [...this.state.activePods, pod];
    this.updateState({ activePods: updated });
  }

  /**
   * Compress a pod (remove from active, add to dormant seeds)
   */
  compressPod(podId: string): void {
    const updated = this.state.activePods.filter((p) => p.id !== podId);
    this.updateState({ activePods: updated });
  }

  /**
   * Get total active storage usage
   */
  getTotalActiveStorageUsage(): number {
    return this.state.activePods.reduce((sum, pod) => sum + pod.sizeBytes, 0);
  }

  /**
   * Get available storage in bytes
   */
  getAvailableStorageBytes(): number {
    const parts = this.state.availableStorage.split(' ');
    const value = parseFloat(parts[0]);
    const unit = parts[1];

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };

    return value * (multipliers[unit] || 1);
  }

  /**
   * Calculate resource implications of spawning a pod
   */
  calculateSpawnCost(tierSize: number): {
    storageBytes: number;
    storageFormatted: string;
    percentageOfTotal: number;
    canSpawn: boolean;
    warning: string | null;
  } {
    const available = this.getAvailableStorageBytes();
    const percentageOfTotal = (tierSize / available) * 100;
    const canSpawn = tierSize <= available;

    return {
      storageBytes: tierSize,
      storageFormatted: this.formatBytes(tierSize),
      percentageOfTotal: Math.round(percentageOfTotal * 100) / 100,
      canSpawn,
      warning:
        percentageOfTotal > 50
          ? 'HIGH USAGE: This will use over 50% of available storage'
          : percentageOfTotal > 25
            ? 'MODERATE USAGE: This will use over 25% of available storage'
            : null,
    };
  }

  /**
   * Check for resource conflicts or issues
   */
  assessRisks(): string[] {
    const risks: string[] = [];
    const totalUsage = this.getTotalActiveStorageUsage();
    const available = this.getAvailableStorageBytes();
    const usagePercent = (totalUsage / available) * 100;

    // Storage warnings
    if (usagePercent > 80) {
      risks.push('CRITICAL: Active pods using over 80% of available storage');
    } else if (usagePercent > 60) {
      risks.push('WARNING: Active pods using over 60% of available storage');
    }

    // Pod count warnings
    if (this.state.activePods.length > 20) {
      risks.push('HIGH POD COUNT: Managing 20+ active pods may impact performance');
    }

    // Information layer warnings
    const loadedLayers = this.state.informationLayers.filter((l) => l.loaded);
    if (loadedLayers.length === 0 && this.state.activePods.length > 0) {
      risks.push('NO INFO LAYERS: Active pods have no loaded information layers');
    }

    // Memory warnings
    const totalMemory = this.state.activePods.reduce(
      (sum, pod) => sum + pod.resourceUsage.memory,
      0
    );
    const availableMemory = parseFloat(this.state.availableMemory.split(' ')[0]);
    if (totalMemory > availableMemory * 0.8) {
      risks.push('HIGH MEMORY: Active pods using over 80% of available memory');
    }

    return risks;
  }

  /**
   * Generate human-readable status report
   */
  generateStatusReport(): string {
    const totalUsage = this.getTotalActiveStorageUsage();
    const available = this.getAvailableStorageBytes();
    const usagePercent = (totalUsage / available) * 100;
    const risks = this.assessRisks();

    return `
JACKIE SYSTEM STATUS REPORT
═══════════════════════════════════════════

ACTIVE PODS: ${this.state.activePods.length}
${this.state.activePods.map((p) => `  • ${p.name} (${p.tier}) — ${this.formatBytes(p.sizeBytes)}`).join('\n')}

RESOURCE USAGE:
  Storage: ${this.formatBytes(totalUsage)} / ${this.state.availableStorage} (${usagePercent.toFixed(1)}%)
  Memory: ${this.state.availableMemory}
  CPUs: ${this.state.totalCPUs}

INFORMATION LAYERS:
  ${this.state.informationLayers.map((l) => `${l.loaded ? '✓' : '✗'} ${l.name} (${this.formatBytes(l.sizeBytes)}, accessed ${l.accessCount}x)`).join('\n  ')}

GLOBAL MODE: ${this.state.globalModeEnabled ? '🔴 ON' : '🟢 OFF'}
COMMANDS EXECUTED: ${this.state.commandsExecuted}
SESSION DURATION: ${this.state.sessionDuration}

${risks.length > 0 ? `ALERTS:\n  ${risks.join('\n  ')}\n` : ''}

STATUS: ${usagePercent > 80 ? '🔴 CRITICAL' : usagePercent > 60 ? '🟡 WARNING' : '🟢 HEALTHY'}
    `;
  }

  /**
   * Get pod by ID
   */
  getPodById(podId: string): ActivePodInfo | null {
    return this.state.activePods.find((p) => p.id === podId) || null;
  }

  /**
   * Get pods by tier
   */
  getPodsByTier(tier: string): ActivePodInfo[] {
    return this.state.activePods.filter((p) => p.tier === tier);
  }

  /**
   * Format bytes to human-readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIdx = 0;

    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx++;
    }

    return `${size.toFixed(2)} ${units[unitIdx]}`;
  }

  /**
   * Get state history
   */
  getHistory(): RuntimeState[] {
    return this.stateHistory.map((s) => JSON.parse(JSON.stringify(s)));
  }

  /**
   * Reset to initial state (for session restart)
   */
  reset(initialState: RuntimeState): void {
    this.state = JSON.parse(JSON.stringify(initialState));
    this.stateHistory = [JSON.parse(JSON.stringify(initialState))];
  }
}
