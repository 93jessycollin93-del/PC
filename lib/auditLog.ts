/**
 * Audit Trail — append-only immutable log of sensitive actions.
 */

import { appStorage } from './appStorage';

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string; // scope/app that performed the action
  category: 'model_call' | 'file_access' | 'permission_change' | 'shell_exec' | 'data_export' | 'auth' | 'other';
  details?: Record<string, any>;
  result: 'success' | 'denied' | 'error';
}

class AuditLog {
  private entries: AuditEntry[] = [];
  private maxEntries = 1000;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const storage = appStorage('audit-trail');
      this.entries = storage.get<AuditEntry[]>('entries', []);
    } catch (e) {
      console.warn('[AUDIT] Could not load entries:', e);
    }
  }

  private save(): void {
    try {
      const storage = appStorage('audit-trail');
      storage.set('entries', this.entries.slice(-this.maxEntries));
    } catch (e) {
      console.warn('[AUDIT] Could not save entries:', e);
    }
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(auditEntry);
    this.save();

    // Also log to security-events for the SIEM
    try {
      const storage = appStorage('security-events');
      const events = storage.get<any[]>('events', []);
      storage.set('events', [{ ...auditEntry, type: 'audit-trail' }, ...events].slice(0, 500));
    } catch (e) {
      console.warn('[AUDIT] Could not log to security-events:', e);
    }
  }

  logModelCall(actor: string, model: string, success: boolean, costUsd?: number): void {
    this.log({
      action: `model_call:${model}`,
      actor,
      category: 'model_call',
      details: { model, costUsd },
      result: success ? 'success' : 'error',
    });
  }

  logFileAccess(actor: string, path: string, operation: string, success: boolean): void {
    this.log({
      action: `file_${operation}:${path}`,
      actor,
      category: 'file_access',
      details: { path, operation },
      result: success ? 'success' : 'error',
    });
  }

  logPermissionChange(actor: string, scope: string, capability: string, granted: boolean): void {
    this.log({
      action: `permission_${granted ? 'grant' : 'revoke'}:${scope}/${capability}`,
      actor,
      category: 'permission_change',
      details: { scope, capability, granted },
      result: 'success',
    });
  }

  logShellExec(actor: string, cmd: string, success: boolean): void {
    this.log({
      action: `shell_exec:${cmd}`,
      actor,
      category: 'shell_exec',
      details: { cmd },
      result: success ? 'success' : 'error',
    });
  }

  logDataExport(actor: string, format: string, size: number): void {
    this.log({
      action: `data_export:${format}`,
      actor,
      category: 'data_export',
      details: { format, bytes: size },
      result: 'success',
    });
  }

  logAuth(actor: string, success: boolean, reason?: string): void {
    this.log({
      action: 'auth_attempt',
      actor,
      category: 'auth',
      details: reason ? { reason } : undefined,
      result: success ? 'success' : 'denied',
    });
  }

  getEntries(filter?: { category?: string; actor?: string; days?: number }): AuditEntry[] {
    let filtered = this.entries;

    if (filter?.category) {
      filtered = filtered.filter(e => e.category === filter.category);
    }

    if (filter?.actor) {
      filtered = filtered.filter(e => e.actor === filter.actor);
    }

    if (filter?.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filter.days);
      filtered = filtered.filter(e => new Date(e.timestamp) >= cutoff);
    }

    return filtered.reverse(); // Most recent first
  }

  export(format: 'csv' | 'json' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.entries, null, 2);
    }

    // CSV format
    const csv = [
      'Timestamp,Action,Actor,Category,Result,Details',
      ...this.entries.map(e =>
        `"${e.timestamp}","${e.action}","${e.actor}","${e.category}","${e.result}","${JSON.stringify(e.details || {}).replace(/"/g, '""')}"`
      ),
    ].join('\n');

    return csv;
  }

  clear(): void {
    this.entries = [];
    this.save();
  }
}

export const auditLog = new AuditLog();
