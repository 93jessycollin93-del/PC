import React, { useEffect, useReducer, useState } from 'react';
import { DollarSign, Trash2, TrendingUp, AlertTriangle, CheckCircle2, Edit2 } from 'lucide-react';
import { budgetGuardian, type BudgetConfig } from '../../lib/budgetGuardian';
import { appStorage } from '../../lib/appStorage';

/**
 * Budget Guardian — per-app spend tracking with monthly limits and auto-stop enforcement
 */

type BudgetFormMode = 'view' | 'edit' | 'new';

export const BudgetGuardianApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [formMode, setFormMode] = useState<BudgetFormMode>('view');
  const [editingScope, setEditingScope] = useState<string | null>(null);
  const [newScope, setNewScope] = useState('');
  const [newLimit, setNewLimit] = useState('');

  // Re-render when budgets change
  useEffect(() => {
    const storage = appStorage('budget-guardian');
    const unsubscribe = storage.subscribe(tick);
    return unsubscribe;
  }, []);

  const budgets = budgetGuardian.getAllBudgets();
  const spendData = budgetGuardian.getAllSpend();
  const spendMap = new Map(spendData.map(s => [s.scope, s]));

  const handleSetBudget = () => {
    if (!newScope.trim() || !newLimit) return;
    const limitNum = parseFloat(newLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    budgetGuardian.setBudget(newScope.trim(), limitNum);
    setNewScope('');
    setNewLimit('');
    setFormMode('view');
  };

  const handleToggleAutoDowngrade = (scope: string, enabled: boolean) => {
    budgetGuardian.toggleAutoDowngrade(scope, !enabled);
    tick();
  };

  const handleToggleAutoStop = (scope: string, enabled: boolean) => {
    budgetGuardian.toggleAutoStop(scope, !enabled);
    tick();
  };

  const handleRemoveBudget = (scope: string) => {
    budgetGuardian.removeBudget(scope);
    tick();
  };

  const getStatusColor = (currentSpend: number, limit: number): string => {
    const pct = (currentSpend / limit) * 100;
    if (pct >= 100) return 'text-red-400';
    if (pct >= 90) return 'text-amber-400';
    if (pct >= 75) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getStatusBg = (currentSpend: number, limit: number): string => {
    const pct = (currentSpend / limit) * 100;
    if (pct >= 100) return 'bg-red-900/30 border-red-700';
    if (pct >= 90) return 'bg-amber-900/30 border-amber-700';
    if (pct >= 75) return 'bg-yellow-900/30 border-yellow-700';
    return 'bg-emerald-900/30 border-emerald-700';
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <DollarSign size={16} className="text-amber-400" />
          Budget Guardian
        </h2>
        <button
          onClick={() => setFormMode(formMode === 'view' ? 'new' : 'view')}
          className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700"
        >
          {formMode === 'view' ? '+ New Budget' : 'Done'}
        </button>
      </div>

      {/* New budget form */}
      {formMode === 'new' && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 space-y-2">
          <div className="flex gap-2">
            <input
              placeholder="Scope (app or agent name)"
              value={newScope}
              onChange={e => setNewScope(e.target.value)}
              className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none"
            />
            <input
              placeholder="Monthly limit (USD)"
              type="number"
              min="0.01"
              step="0.01"
              value={newLimit}
              onChange={e => setNewLimit(e.target.value)}
              className="w-32 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none"
            />
            <button
              onClick={handleSetBudget}
              className="px-3 py-1 rounded text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
            >
              Set
            </button>
          </div>
          <div className="text-[10px] text-zinc-600">
            Budget enforces monthly spend limits. Auto-downgrade prefers free models when near cap; auto-stop blocks requests when over cap.
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {budgets.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No budgets set yet. Create one to start tracking spend for an app or agent.
          </div>
        ) : (
          budgets.map(budget => {
            const spend = spendMap.get(budget.scope) || { currentMonthSpend: 0, spendByProvider: {} };
            const currentSpend = spend.currentMonthSpend;
            const predicted = budgetGuardian.predictMonthlySpend(budget.scope);
            const pct = Math.round((currentSpend / budget.monthlyLimitUSD) * 100);
            const remaining = Math.max(0, budget.monthlyLimitUSD - currentSpend);
            const statusColor = getStatusColor(currentSpend, budget.monthlyLimitUSD);
            const statusBg = getStatusBg(currentSpend, budget.monthlyLimitUSD);

            return (
              <div
                key={budget.scope}
                className={`border rounded-lg p-4 ${statusBg}`}
              >
                {/* Title & scope */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-white">{budget.scope}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {pct >= 100 ? '⚠️ Over budget' : pct >= 90 ? '⚠️ Critical' : pct >= 75 ? '⚠️ Warning' : '✓ On track'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBudget(budget.scope)}
                    className="p-1 rounded hover:bg-zinc-700/50"
                    title="Delete budget"
                  >
                    <Trash2 size={13} className="text-zinc-500 hover:text-red-400" />
                  </button>
                </div>

                {/* Progress bar & spend summary */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold tabular-nums ${statusColor}`}>
                      ${currentSpend.toFixed(2)} / ${budget.monthlyLimitUSD.toFixed(2)}
                    </span>
                    <span className="text-zinc-500">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100
                          ? 'bg-red-500'
                          : pct >= 90
                            ? 'bg-amber-500'
                            : pct >= 75
                              ? 'bg-yellow-500'
                              : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Remaining & predicted */}
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <div className="text-zinc-500">Remaining</div>
                    <div className="font-semibold text-white">${remaining.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Predicted</div>
                    <div className="font-semibold text-white">${predicted.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Days left</div>
                    <div className="font-semibold text-white">~{currentSpend > 0 ? Math.ceil((budget.monthlyLimitUSD / (predicted / 30)) - 30) : 30}d</div>
                  </div>
                </div>

                {/* Provider breakdown */}
                {Object.keys(spend.spendByProvider).length > 0 && (
                  <div className="space-y-1 mb-3 text-[10px]">
                    {Object.entries(spend.spendByProvider)
                      .sort((a, b) => b[1] - a[1])
                      .map(([provider, cost]) => (
                        <div key={provider} className="flex justify-between text-zinc-500">
                          <span>{provider}</span>
                          <span className="tabular-nums">${cost.toFixed(4)}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-1">
                    <input
                      type="checkbox"
                      checked={budget.autoDowngrade}
                      onChange={() => handleToggleAutoDowngrade(budget.scope, budget.autoDowngrade)}
                      className="w-3 h-3"
                    />
                    Auto-downgrade
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-1">
                    <input
                      type="checkbox"
                      checked={budget.autoStop}
                      onChange={() => handleToggleAutoStop(budget.scope, budget.autoStop)}
                      className="w-3 h-3"
                    />
                    Auto-stop
                  </label>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Budgets reset monthly (30-day cycles)</div>
        <div>• Auto-downgrade: Prefer free models when near cap</div>
        <div>• Auto-stop: Reject requests when over monthly limit</div>
      </div>
    </div>
  );
};

export default BudgetGuardianApp;
