/**
 * Budget Guardian — per-app spend limits with auto-downgrade and auto-stop enforcement
 */

import { appStorage } from './appStorage';
import { modelRouter, type ModelProvider } from './modelRouter';
import { bus } from './bus';

export interface BudgetConfig {
  scope: string;
  monthlyLimitUSD: number;
  autoDowngrade: boolean; // prefer free models when near cap
  autoStop: boolean; // reject requests when over cap
  notifyAtPercentage: number; // e.g. 75, 90
}

interface ScopeSpend {
  scope: string;
  currentMonthSpend: number;
  currentMonthStart: number;
  lastUpdated: number;
  spendByProvider: Record<ModelProvider, number>;
}

class BudgetGuardian {
  private budgets: Map<string, BudgetConfig> = new Map();
  private spend: Map<string, ScopeSpend> = new Map();
  private notifiedAt: Map<string, number[]> = new Map(); // scope -> [percentage, ...]

  constructor() {
    this.loadBudgets();
    this.loadSpend();
  }

  private loadBudgets(): void {
    const storage = appStorage('budget-guardian');
    const saved = storage.get<BudgetConfig[]>('budgets', []);
    saved.forEach(b => this.budgets.set(b.scope, b));
  }

  private loadSpend(): void {
    const storage = appStorage('budget-guardian');
    const saved = storage.get<ScopeSpend[]>('spend', []);
    saved.forEach(s => {
      this.spend.set(s.scope, s);
      this.notifiedAt.set(s.scope, []);
    });
  }

  private saveBudgets(): void {
    const storage = appStorage('budget-guardian');
    const budgets = Array.from(this.budgets.values());
    storage.set('budgets', budgets);
  }

  private saveSpend(): void {
    const storage = appStorage('budget-guardian');
    const spend = Array.from(this.spend.values());
    storage.set('spend', spend);
  }

  private createSpendByProvider(): Record<ModelProvider, number> {
    return {
      gemini: 0,
      deepseek: 0,
      anthropic: 0,
      groq: 0,
      grok: 0,
      ollama: 0,
    };
  }

  private getOrCreateSpend(scope: string): ScopeSpend {
    if (!this.spend.has(scope)) {
      this.spend.set(scope, {
        scope,
        currentMonthSpend: 0,
        currentMonthStart: Date.now(),
        lastUpdated: Date.now(),
        spendByProvider: this.createSpendByProvider(),
      });
    }
    return this.spend.get(scope)!;
  }

  private resetMonthIfNeeded(spend: ScopeSpend): void {
    const now = Date.now();
    const monthAgo = 30 * 24 * 60 * 60 * 1000;
    if (now - spend.currentMonthStart > monthAgo) {
      spend.currentMonthSpend = 0;
      spend.spendByProvider = this.createSpendByProvider();
      spend.currentMonthStart = now;
      this.notifiedAt.set(spend.scope, []);
    }
  }

  /**
   * Record a spend event (called after AI call)
   */
  public recordSpend(scope: string, provider: ModelProvider, cost: number): void {
    const spend = this.getOrCreateSpend(scope);
    this.resetMonthIfNeeded(spend);
    spend.currentMonthSpend += cost;
    if (!spend.spendByProvider[provider]) {
      spend.spendByProvider[provider] = 0;
    }
    spend.spendByProvider[provider] += cost;
    spend.lastUpdated = Date.now();
    this.saveSpend();

    // Check budget thresholds
    const budget = this.budgets.get(scope);
    if (budget) {
      const pct = Math.round((spend.currentMonthSpend / budget.monthlyLimitUSD) * 100);
      this.checkThresholds(scope, budget, spend, pct);
    }
  }

  private checkThresholds(scope: string, budget: BudgetConfig, spend: ScopeSpend, pct: number): void {
    const notified = this.notifiedAt.get(scope) || [];

    if (pct >= 100 && !notified.includes(100)) {
      notified.push(100);
      this.notifiedAt.set(scope, notified);
      bus.emit('jackie-notification', {
        level: 'error',
        title: `Budget exceeded for "${scope}"`,
        message: `Spent $${spend.currentMonthSpend.toFixed(2)} of $${budget.monthlyLimitUSD}${budget.autoStop ? ' — auto-stop active' : ''}`,
        source: 'budget-guardian',
      });
    } else if (pct >= budget.notifyAtPercentage && !notified.includes(budget.notifyAtPercentage)) {
      notified.push(budget.notifyAtPercentage);
      this.notifiedAt.set(scope, notified);
      const remaining = (budget.monthlyLimitUSD - spend.currentMonthSpend).toFixed(2);
      bus.emit('jackie-notification', {
        level: 'warning',
        title: `Budget ${budget.notifyAtPercentage}% for "${scope}"`,
        message: `Spent $${spend.currentMonthSpend.toFixed(2)}, $${remaining} remaining this month`,
        source: 'budget-guardian',
      });
    }
  }

  /**
   * Check if a spend is allowed (returns true if OK, false if would exceed cap)
   */
  public canSpend(scope: string, estimatedCost: number): boolean {
    const budget = this.budgets.get(scope);
    if (!budget) return true; // no budget set = unlimited

    const spend = this.getOrCreateSpend(scope);
    this.resetMonthIfNeeded(spend);

    return spend.currentMonthSpend + estimatedCost <= budget.monthlyLimitUSD;
  }

  /**
   * Get current month spend for a scope
   */
  public getCurrentSpend(scope: string): number {
    const spend = this.spend.get(scope);
    if (!spend) return 0;
    this.resetMonthIfNeeded(spend);
    return spend.currentMonthSpend;
  }

  /**
   * Predict monthly spend based on current rate
   */
  public predictMonthlySpend(scope: string): number {
    const spend = this.spend.get(scope);
    if (!spend || spend.currentMonthSpend === 0) return 0;

    const now = Date.now();
    const elapsedDays = (now - spend.currentMonthStart) / (24 * 60 * 60 * 1000);
    if (elapsedDays < 1) return spend.currentMonthSpend * 30;

    return (spend.currentMonthSpend / elapsedDays) * 30;
  }

  /**
   * Set or update a budget
   */
  public setBudget(scope: string, monthlyLimitUSD: number, options: Partial<BudgetConfig> = {}): void {
    this.budgets.set(scope, {
      scope,
      monthlyLimitUSD,
      autoDowngrade: options.autoDowngrade ?? true,
      autoStop: options.autoStop ?? true,
      notifyAtPercentage: options.notifyAtPercentage ?? 75,
    });
    this.getOrCreateSpend(scope); // ensure spend exists
    this.saveBudgets();
    bus.emit('jackie-notification', {
      level: 'info',
      title: `Budget set for "${scope}"`,
      message: `$${monthlyLimitUSD}/month${options.autoStop ? ', auto-stop enabled' : ''}`,
      source: 'budget-guardian',
    });
  }

  /**
   * Remove a budget
   */
  public removeBudget(scope: string): void {
    this.budgets.delete(scope);
    this.saveBudgets();
  }

  /**
   * Get all budgets
   */
  public getAllBudgets(): BudgetConfig[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Get budget for a scope
   */
  public getBudget(scope: string): BudgetConfig | undefined {
    return this.budgets.get(scope);
  }

  /**
   * Get all spend data
   */
  public getAllSpend(): ScopeSpend[] {
    return Array.from(this.spend.values());
  }

  /**
   * Get detailed spend for a scope
   */
  public getDetailedSpend(scope: string): ScopeSpend | undefined {
    const spend = this.spend.get(scope);
    if (spend) {
      this.resetMonthIfNeeded(spend);
    }
    return spend;
  }

  /**
   * Toggle auto-downgrade for a scope
   */
  public toggleAutoDowngrade(scope: string, enabled: boolean): void {
    const budget = this.budgets.get(scope);
    if (budget) {
      budget.autoDowngrade = enabled;
      this.saveBudgets();
    }
  }

  /**
   * Toggle auto-stop for a scope
   */
  public toggleAutoStop(scope: string, enabled: boolean): void {
    const budget = this.budgets.get(scope);
    if (budget) {
      budget.autoStop = enabled;
      this.saveBudgets();
    }
  }

  /**
   * Check if auto-stop would block this request
   */
  public isAutoStopActive(scope: string, estimatedCost: number): boolean {
    const budget = this.budgets.get(scope);
    if (!budget || !budget.autoStop) return false;

    const spend = this.getOrCreateSpend(scope);
    this.resetMonthIfNeeded(spend);

    return spend.currentMonthSpend + estimatedCost > budget.monthlyLimitUSD;
  }
}

export const budgetGuardian = new BudgetGuardian();
