import React, { useCallback, useMemo, useState } from 'react';
import { Cpu, Moon, Zap, AlertTriangle } from 'lucide-react';
import { FleetService } from '../../src/fleet/fleetService';
import type { AskOutcome } from '../../src/fleet/fleetService';
import type { FleetTier } from '../../src/fleet/types';

/**
 * Fleet — see what is thinking and what it costs.
 *
 * A thin View over FleetService. It makes no residency decision and does no RAM
 * accounting; it dispatches intents and renders the service's projection. The
 * number that matters is live RAM, because the entire design rests on dormant
 * members costing zero.
 */

/** A starter fleet, so the app shows something real rather than an empty shell. */
function seedFleet(): FleetService {
  const fleet = new FleetService();
  fleet.register({ id: 'jacky', domain: 'general', tier: 'coordinator' });
  const domains = [
    'physics', 'calculus', 'chemistry', 'biology', 'history', 'geography',
    'music', 'metaphor', 'law', 'finance', 'medicine', 'cooking',
  ];
  for (const d of domains) {
    fleet.register({ id: `spec-${d}`, domain: d, tier: 'specialist' });
  }
  for (let i = 1; i <= 5; i++) {
    fleet.register({ id: `assistant-${i}`, domain: 'reasoning', tier: 'assistant' });
  }
  return fleet;
}

const TIER_LABEL: Record<FleetTier, string> = {
  coordinator: 'Coordinator',
  assistant: 'Assistant',
  specialist: 'Specialist',
};

export const FleetApp: React.FC = () => {
  const fleet = useMemo(seedFleet, []);
  const [tick, setTick] = useState(0);
  const [question, setQuestion] = useState('physics');
  const [outcome, setOutcome] = useState<AskOutcome | null>(null);

  const refresh = useCallback(() => setTick(t => t + 1), []);
  const members = useMemo(() => fleet.list(), [fleet, tick]);
  const currentMB = useMemo(() => fleet.currentMB(), [fleet, tick]);

  const ask = () => {
    setOutcome(fleet.ask(question.trim().toLowerCase(), { assistants: 2 }));
    refresh();
  };

  const toggle = (id: string) => {
    if (fleet.isAwake(id)) fleet.sleep(id);
    else fleet.wake(id);
    refresh();
  };

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200">
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={15} className="text-zinc-500 shrink-0" />
          <span className="text-sm flex-1">Agent fleet</span>
          <span className="text-[11px] text-zinc-400 tabular-nums">{currentMB} MB active</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          {members.length} members registered. A member that is not thinking costs nothing.
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Domain to route (physics, calculus…)"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm outline-none placeholder-zinc-600"
        />
        <button onClick={ask} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">
          Route
        </button>
      </div>

      {outcome && (
        <div className="px-3 py-2 border-b border-zinc-800 shrink-0 text-[11px]">
          {outcome.error ? (
            <div className="flex items-start gap-1.5 text-amber-400/90">
              <AlertTriangle size={12} className="mt-px shrink-0" />
              <span>{outcome.error}</span>
            </div>
          ) : (
            <>
              <div className="text-zinc-500 mb-1">
                Peak {outcome.peakMB} MB across {outcome.steps.length} hops
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {outcome.steps.map((s, i) => (
                  <span key={`${s.memberId}-${i}`} className="text-zinc-400">
                    {i > 0 && <span className="text-zinc-700 mr-1">→</span>}
                    {s.memberId}
                    <span className="text-zinc-600"> ({s.costMB} MB)</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {members.map(m => {
          const awake = fleet.isAwake(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className="w-full flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 text-left hover:bg-zinc-900/60"
            >
              {awake ? (
                <Zap size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <Moon size={13} className="text-zinc-700 shrink-0" />
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{m.domain}</span>
                <span className="block text-[11px] text-zinc-500">
                  {TIER_LABEL[m.tier]}
                  {m.pinned && ' · stays warm'}
                </span>
              </span>
              <span className="text-[11px] tabular-nums shrink-0 text-zinc-500">
                {awake ? `${m.activeMB} MB` : '0 MB'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FleetApp;
