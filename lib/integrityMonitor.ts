/**
 * Integrity/Anti-Tamper Monitor
 *
 * Hashes critical app state in appStorage and detects unexpected mutations.
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

interface IntegrityRecord {
  namespace: string;
  hash: string;
  timestamp: number;
  label: string;
}

class IntegrityMonitor {
  private records: Map<string, IntegrityRecord> = new Map();
  private checksEnabled = true;

  start(): void {
    // Load baseline hashes
    this.loadBaselines();

    // Check integrity every 30 seconds
    setInterval(() => this.checkAll(), 30000);
  }

  private loadBaselines(): void {
    try {
      const storage = appStorage('integrity-monitor');
      const stored = storage.get<Record<string, IntegrityRecord>>('baselines', {});
      this.records = new Map(Object.entries(stored));
    } catch (e) {
      console.warn('[INTEGRITY] Could not load baselines:', e);
    }
  }

  private persist(): void {
    try {
      const storage = appStorage('integrity-monitor');
      storage.set('baselines', Object.fromEntries(this.records));
    } catch (e) {
      console.warn('[INTEGRITY] Could not persist baselines:', e);
    }
  }

  private hashValue(value: any): string {
    const str = JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'hash_' + Math.abs(hash).toString(16);
  }

  /**
   * Register a namespace for integrity monitoring.
   */
  watch(namespace: string, label?: string): void {
    try {
      const storage = appStorage(namespace);
      const value = storage.get('_all', {});
      const hash = this.hashValue(value);

      this.records.set(namespace, {
        namespace,
        hash,
        timestamp: Date.now(),
        label: label || namespace,
      });

      this.persist();
    } catch (e) {
      console.warn(`[INTEGRITY] Could not watch ${namespace}:`, e);
    }
  }

  /**
   * Check a single namespace for tampering.
   */
  check(namespace: string): { ok: boolean; tampered?: boolean; detail?: string } {
    const record = this.records.get(namespace);
    if (!record) return { ok: false, detail: 'Not monitored' };

    try {
      const storage = appStorage(namespace);
      const value = storage.get('_all', {});
      const currentHash = this.hashValue(value);

      if (currentHash !== record.hash) {
        const event = {
          timestamp: new Date().toISOString(),
          type: 'integrity-violation',
          namespace,
          expectedHash: record.hash,
          currentHash,
          label: record.label,
        };

        bus.emit('jackie-notification', {
          level: 'critical',
          title: 'Integrity violation detected',
          message: `Unexpected mutation in ${record.label}`,
          source: 'integrity-monitor',
        });

        const storage = appStorage('security-events');
        const events = storage.get<any[]>('events', []);
        storage.set('events', [event, ...events].slice(0, 500));

        return { ok: true, tampered: true, detail: 'Unexpected mutation detected' };
      }

      return { ok: true, tampered: false };
    } catch (e) {
      console.error(`[INTEGRITY] Error checking ${namespace}:`, e);
      return { ok: false, detail: String(e) };
    }
  }

  /**
   * Check all monitored namespaces.
   */
  checkAll(): { ok: boolean; violated: string[] } {
    if (!this.checksEnabled) return { ok: true, violated: [] };

    const violated: string[] = [];
    this.records.forEach((_, namespace) => {
      const result = this.check(namespace);
      if (result.tampered) violated.push(namespace);
    });

    return { ok: violated.length === 0, violated };
  }

  /**
   * Get all monitored namespaces and their status.
   */
  getStatus(): Array<{ namespace: string; label: string; lastCheck: number; hash: string; ok: boolean }> {
    return Array.from(this.records.values()).map(record => ({
      namespace: record.namespace,
      label: record.label,
      lastCheck: record.timestamp,
      hash: record.hash.slice(0, 8) + '...',
      ok: this.check(record.namespace).ok && !this.check(record.namespace).tampered,
    }));
  }

  /**
   * Disable checks (for testing or during configuration).
   */
  disable(): void {
    this.checksEnabled = false;
  }

  enable(): void {
    this.checksEnabled = true;
  }
}

export const integrityMonitor = new IntegrityMonitor();
