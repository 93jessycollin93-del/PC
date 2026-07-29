/**
 * Fleet residency — who is awake, and what that costs.
 *
 * The eviction rule is adapted from off-grid-ai-mobile's modelResidency policy,
 * which was written after a real out-of-memory bug: the app held two heavy
 * models at once because a caller consulted the budget and then ignored the
 * verdict. The lesson encoded here is that the decision and its consequence
 * must live in one place — `planWake` returns `fits`, and a caller that ignores
 * it is the bug, so the service never separates the two.
 *
 * Pure: no I/O, no clock of its own, no globals. Same inputs, same plan.
 */

import type { AwakeMember, FleetMember, FleetTier } from './types';

export interface WakePlan {
  /** Members to put back to sleep, in the order they should be released. */
  evict: AwakeMember[];
  /** Whether the incoming member fits once those have slept. */
  fits: boolean;
  freedMB: number;
  /** Why it does not fit, when it does not. Rendered by the UI. */
  reason?: string;
}

/**
 * What to KEEP, highest first. Eviction takes the lowest first, so specialists
 * (cheap to re-wake, hold no state) go before assistants, and the coordinator
 * is normally pinned out of the running entirely.
 */
const KEEP_PRIORITY: Record<FleetTier, number> = {
  coordinator: 2,
  assistant: 1,
  specialist: 0,
};

export function totalActiveMB(awake: readonly AwakeMember[]): number {
  return awake.reduce((sum, m) => sum + m.activeMB, 0);
}

/**
 * The single rule for "who sleeps next": lowest tier first, then
 * least-recently-used. Never returns a pinned member or the incoming one.
 * Undefined means nothing further can be released.
 */
export function selectSleepVictim(
  awake: readonly AwakeMember[],
  incoming: FleetMember,
  alreadyChosen: (m: AwakeMember) => boolean
): AwakeMember | undefined {
  return [...awake]
    .filter(m => !m.pinned && m.id !== incoming.id && !alreadyChosen(m))
    .sort((a, b) => {
      const pa = KEEP_PRIORITY[a.tier];
      const pb = KEEP_PRIORITY[b.tier];
      if (pa !== pb) return pa - pb;
      return a.lastUsedAt - b.lastUsedAt;
    })[0];
}

/**
 * Plan how to make room for `incoming` inside `budgetMB`.
 *
 * A member already awake costs nothing extra to "wake" again — it is simply
 * touched — so re-waking never evicts anyone.
 */
export function planWake(
  awake: readonly AwakeMember[],
  incoming: FleetMember,
  budgetMB: number
): WakePlan {
  const alreadyAwake = awake.some(m => m.id === incoming.id);
  if (alreadyAwake) return { evict: [], fits: true, freedMB: 0 };

  if (incoming.activeMB > budgetMB) {
    // No amount of eviction helps: the member alone exceeds the whole budget.
    // Saying so plainly beats emptying the fleet and still failing.
    return {
      evict: [],
      fits: false,
      freedMB: 0,
      reason: `${incoming.id} needs ${incoming.activeMB} MB but the fleet budget is ${budgetMB} MB`,
    };
  }

  const evict: AwakeMember[] = [];
  const chosen = (m: AwakeMember) => evict.some(e => e.id === m.id);
  const usedMB = () =>
    awake.filter(m => !chosen(m) && m.id !== incoming.id).reduce((s, m) => s + m.activeMB, 0);

  while (usedMB() + incoming.activeMB > budgetMB) {
    const victim = selectSleepVictim(awake, incoming, chosen);
    if (!victim) {
      const freedMB = evict.reduce((s, m) => s + m.activeMB, 0);
      return {
        evict,
        fits: false,
        freedMB,
        // Pinned members are the usual cause, and knowing that is the
        // difference between "out of memory" and an actionable message.
        reason: `Cannot free enough RAM for ${incoming.id}; ${usedMB()} MB is held by pinned or in-use members`,
      };
    }
    evict.push(victim);
  }

  return { evict, fits: true, freedMB: evict.reduce((s, m) => s + m.activeMB, 0) };
}
