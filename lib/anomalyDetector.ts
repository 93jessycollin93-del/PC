/**
 * Anomaly & Alert Engine — detects unusual patterns in spend/exec/failed-auth
 */

import { bus } from './bus';
import { appStorage } from './appStorage';

export interface AnomalyAlert {
  id: string;
  timestamp: string;
  type: 'spend_spike' | 'exec_rate' | 'auth_failures' | 'error_rate';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  threshold: number;
  actual: number;
  resolved?: boolean;
}

interface AnomalyMetric {
  timestamp: number;
  value: number;
}

class AnomalyDetector {
  private metrics: Map<string, AnomalyMetric[]> = new Map();
  private alerts: Map<string, AnomalyAlert> = new Map();
  private windowMs = 3600000; // 1 hour rolling window
  private cleanupInterval: any;

  constructor() {
    this.load();
    this.startCleanup();
  }

  private load(): void {
    try {
      const storage = appStorage('anomaly-detector');
      const savedAlerts = storage.get<Record<string, AnomalyAlert>>('alerts', {});
      this.alerts = new Map(Object.entries(savedAlerts));
    } catch (e) {
      console.warn('[ANOMALY] Could not load alerts:', e);
    }
  }

  private save(): void {
    try {
      const storage = appStorage('anomaly-detector');
      storage.set('alerts', Object.fromEntries(this.alerts));
    } catch (e) {
      console.warn('[ANOMALY] Could not save alerts:', e);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.metrics.forEach((metrics, key) => {
        // Keep only metrics from last 24 hours
        const filtered = metrics.filter(m => now - m.timestamp < 86400000);
        this.metrics.set(key, filtered);
      });
    }, 3600000); // Cleanup every hour
  }

  /**
   * Record a metric value (e.g., spend amount, execution count).
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push({ timestamp: Date.now(), value });

    // Keep rolling window
    const cutoff = Date.now() - this.windowMs;
    this.metrics.set(
      name,
      metrics.filter(m => m.timestamp > cutoff)
    );

    this.checkAnomalies(name);
  }

  /**
   * Get statistics for a metric over the rolling window.
   */
  getStats(name: string): { mean: number; stdDev: number; max: number; count: number } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const values = metrics.map(m => m.value);
    const count = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / count;
    const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const max = Math.max(...values);

    return { mean, stdDev, max, count };
  }

  /**
   * Check for anomalies in a metric.
   */
  private checkAnomalies(name: string): void {
    const stats = this.getStats(name);
    if (!stats || stats.count < 5) return; // Need at least 5 samples

    const recent = this.metrics.get(name)?.slice(-1)[0];
    if (!recent) return;

    const zScore = stats.stdDev > 0 ? (recent.value - stats.mean) / stats.stdDev : 0;

    if (zScore > 3) {
      this.raiseAlert(name, 'Anomaly detected', `${name} spike: ${recent.value.toFixed(2)} (avg: ${stats.mean.toFixed(2)})`, recent.value, stats.mean, 'warning');
    } else if (zScore > 5) {
      this.raiseAlert(name, 'Critical anomaly', `${name} critical: ${recent.value.toFixed(2)}`, recent.value, stats.mean, 'critical');
    }
  }

  /**
   * Raise a threshold-based alert.
   */
  raiseAlert(name: string, title: string, message: string, actual: number, threshold: number, severity: 'warning' | 'critical'): void {
    const alert: AnomalyAlert = {
      id: `${name}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: (name.includes('spend') ? 'spend_spike' : 'exec_rate') as any,
      severity,
      title,
      message,
      threshold,
      actual,
    };

    this.alerts.set(alert.id, alert);
    this.save();

    bus.emit('jackie-notification' as any, {
      level: severity,
      title,
      message,
      source: 'anomaly-detector',
    });
  }

  /**
   * Get all active alerts.
   */
  getAlerts(): AnomalyAlert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  /**
   * Acknowledge and resolve an alert.
   */
  resolveAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.resolved = true;
      this.save();
    }
  }

  /**
   * Clear all alerts.
   */
  clearAlerts(): void {
    this.alerts.clear();
    this.save();
  }

  stop(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

export const anomalyDetector = new AnomalyDetector();
