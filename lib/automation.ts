/**
 * Cross-App Automation Engine ("If-This-Then-Jackie").
 *
 * A rule is: when a Jackie Bus channel fires → run a JackieAction. Rules are
 * persisted (appStorage 'automation'), survive reload, and every execution is
 * recorded to a bounded run log plus broadcast on `automation-run` so Mission
 * Control's live tail shows engine activity.
 */

import { bus, type BusChannel } from './bus';
import { runAction, type JackieAction } from './actions';
import { appStorage } from './appStorage';

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { channel: BusChannel };
  action: JackieAction;
  runCount: number;
  lastRun?: number;
  lastResult?: string;
}

export interface RunLogEntry {
  at: number;
  source: string;
  ok: boolean;
  detail?: string;
}

/** Channels a rule may listen to (excludes the engines' own output channels
 *  so a rule can't trivially feedback-loop on engine traffic). */
export const TRIGGER_CHANNELS: BusChannel[] = [
  'launch-app',
  'refresh-desktop',
  'permission-changed',
  'permission-denied',
  'cloud-sync-status',
  'sync-queue-updated',
  'jackie-notification',
];

const RUN_LOG_LIMIT = 50;
/** Per-rule cooldown so a rule that indirectly re-triggers itself can't storm. */
const RULE_COOLDOWN_MS = 1000;

const store = appStorage('automation');

class AutomationEngine {
  private rules: AutomationRule[] = [];
  private runLog: RunLogEntry[] = [];
  private unsubs: (() => void)[] = [];
  private lastFired = new Map<string, number>();
  private listeners = new Set<() => void>();
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.rules = store.get<AutomationRule[]>('rules', []);
    this.runLog = store.get<RunLogEntry[]>('runlog', []);
    this.rewire();
  }

  private rewire(): void {
    this.unsubs.forEach(off => off());
    this.unsubs = [];
    // One subscription per channel in use; dispatch to matching enabled rules.
    const channels = new Set(this.rules.filter(r => r.enabled).map(r => r.trigger.channel));
    channels.forEach(channel => {
      this.unsubs.push(
        bus.on(channel, () => {
          this.rules
            .filter(r => r.enabled && r.trigger.channel === channel)
            .forEach(r => this.fire(r));
        }),
      );
    });
  }

  private async fire(rule: AutomationRule): Promise<void> {
    const now = Date.now();
    if (now - (this.lastFired.get(rule.id) || 0) < RULE_COOLDOWN_MS) return;
    this.lastFired.set(rule.id, now);

    const result = await runAction(rule.action, rule.name);

    rule.runCount++;
    rule.lastRun = now;
    rule.lastResult = result.ok ? (result.detail || 'ok') : `failed: ${result.detail}`;
    this.runLog = [{ at: now, source: rule.name, ok: result.ok, detail: result.detail }, ...this.runLog].slice(0, RUN_LOG_LIMIT);
    this.persist();
    bus.emit('automation-run', { ruleId: rule.id, name: rule.name, ok: result.ok, detail: result.detail });
  }

  private persist(): void {
    store.set('rules', this.rules);
    store.set('runlog', this.runLog);
    this.listeners.forEach(l => l());
  }

  getRules(): AutomationRule[] {
    return this.rules;
  }

  getRunLog(): RunLogEntry[] {
    return this.runLog;
  }

  addRule(name: string, channel: BusChannel, action: JackieAction): AutomationRule {
    const rule: AutomationRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || 'Untitled rule',
      enabled: true,
      trigger: { channel },
      action,
      runCount: 0,
    };
    this.rules = [...this.rules, rule];
    this.persist();
    this.rewire();
    return rule;
  }

  toggleRule(id: string): void {
    this.rules = this.rules.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    this.persist();
    this.rewire();
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id);
    this.lastFired.delete(id);
    this.persist();
    this.rewire();
  }

  /** Run a rule immediately, ignoring its trigger (for testing from the UI). */
  async runNow(id: string): Promise<void> {
    const rule = this.rules.find(r => r.id === id);
    if (rule) await this.fire(rule);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const automationEngine = new AutomationEngine();
