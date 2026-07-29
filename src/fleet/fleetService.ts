/**
 * Fleet service — owns who is awake, what it costs, and where a question goes.
 *
 * This is the owning seam: it holds the residency state machine and the RAM
 * accounting. Callers dispatch intents (`ask`, `wake`, `sleep`) and read a
 * projection; they never decide who to evict and cannot bypass the budget.
 *
 * The invariant, stated once: a member that is not thinking costs ZERO. RAM is
 * spent strictly between wake and sleep, which is what makes 50-100 specialists
 * affordable on a phone.
 */

import {
  DEFAULT_LIMITS,
  TIER_DEFAULTS,
  type AwakeMember,
  type FleetLimits,
  type FleetMember,
  type FleetTier,
} from './types';
import { planWake, totalActiveMB, type WakePlan } from './residency';

export interface RegisterOptions {
  id: string;
  domain: string;
  tier: FleetTier;
  /** Overrides the tier default. */
  activeMB?: number;
  pinned?: boolean;
  /**
   * Which domains this member can answer for. A specialist declares its own
   * domain; a coordinator usually declares none and takes what is left over.
   */
  handles?: string[];
}

export interface AskStep {
  memberId: string;
  domain: string;
  tier: FleetTier;
  /** RAM held during this step — zero before and after, by construction. */
  costMB: number;
}

export interface AskOutcome {
  /** The hop sequence: specialist, then assistants, then coordinator. */
  steps: AskStep[];
  /** Peak RAM the whole exchange occupied. */
  peakMB: number;
  /** Set when the fleet could not run the plan. */
  error?: string;
}

export class FleetService {
  private members = new Map<string, FleetMember & { handles: string[] }>();
  private awake = new Map<string, AwakeMember>();
  private limits: FleetLimits;
  private now: () => number;

  constructor(limits: Partial<FleetLimits> = {}, now: () => number = Date.now) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.now = now;
  }

  public register(options: RegisterOptions): FleetMember {
    const defaults = TIER_DEFAULTS[options.tier];
    const member: FleetMember & { handles: string[] } = {
      id: options.id,
      domain: options.domain,
      tier: options.tier,
      activeMB: options.activeMB ?? defaults.activeMB,
      pinned: options.pinned ?? defaults.pinned,
      handles: options.handles ?? [options.domain],
    };
    this.members.set(member.id, member);
    return member;
  }

  public list(): FleetMember[] {
    return [...this.members.values()];
  }

  /** Who is awake right now, and therefore what the fleet currently costs. */
  public listAwake(): AwakeMember[] {
    return [...this.awake.values()];
  }

  public currentMB(): number {
    return totalActiveMB(this.listAwake());
  }

  public isAwake(id: string): boolean {
    return this.awake.has(id);
  }

  /** What would happen if this member woke — exposed so the UI can explain. */
  public previewWake(id: string): WakePlan | undefined {
    const member = this.members.get(id);
    if (!member) return undefined;
    return planWake(this.listAwake(), member, this.limits.budgetMB);
  }

  /**
   * Wake a member, evicting as planned. Returns false when it does not fit —
   * and when it returns false NOTHING was woken, because the decision and its
   * consequence are applied together here rather than left to a caller.
   */
  public wake(id: string): boolean {
    const member = this.members.get(id);
    if (!member) return false;

    if (this.awake.has(id)) {
      // Re-waking is a touch, not a load: refresh LRU and spend nothing.
      const existing = this.awake.get(id) as AwakeMember;
      this.awake.set(id, { ...existing, lastUsedAt: this.now() });
      return true;
    }

    // Assistants are capped by count as well as RAM: five thinking at once is
    // the design, and a sixth would be a different system.
    if (member.tier === 'assistant') {
      const awakeAssistants = this.listAwake().filter(m => m.tier === 'assistant');
      if (awakeAssistants.length >= this.limits.maxAwakeAssistants) {
        const oldest = [...awakeAssistants].sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
        if (oldest) this.sleep(oldest.id);
      }
    }

    const plan = planWake(this.listAwake(), member, this.limits.budgetMB);
    if (!plan.fits) return false;
    for (const victim of plan.evict) this.awake.delete(victim.id);

    this.awake.set(id, { ...member, lastUsedAt: this.now() });
    return true;
  }

  /** Put a member back to dormant — its cost returns to zero immediately. */
  public sleep(id: string): boolean {
    if (this.members.get(id)?.pinned) return false;
    return this.awake.delete(id);
  }

  /** Release every unpinned member. The coordinator stays warm by design. */
  public sleepAll(): void {
    for (const m of this.listAwake()) {
      if (!m.pinned) this.awake.delete(m.id);
    }
  }

  /** Which member should take a question about `domain`. */
  public routeTo(domain: string): FleetMember | undefined {
    const key = domain.trim().toLowerCase();
    const specialist = [...this.members.values()].find(
      m => m.tier === 'specialist' && m.handles.some(h => h.toLowerCase() === key)
    );
    if (specialist) return specialist;
    // No specialist claims it, so the coordinator takes it — the fleet always
    // has an answerer rather than silently dropping the question.
    return [...this.members.values()].find(m => m.tier === 'coordinator');
  }

  /**
   * Run one question through the fleet: specialist, then assistants to condense
   * and negotiate, then back to the coordinator to judge.
   *
   * Each hop wakes, is measured, and sleeps — so the peak reflects what the
   * device actually had to hold, not the sum of everything that participated.
   */
  public ask(domain: string, opts: { assistants?: number } = {}): AskOutcome {
    const steps: AskStep[] = [];
    let peakMB = this.currentMB();

    const runStep = (member: FleetMember): string | undefined => {
      if (!this.wake(member.id)) {
        const plan = planWake(this.listAwake(), member, this.limits.budgetMB);
        return plan.reason ?? `${member.id} could not be woken`;
      }
      peakMB = Math.max(peakMB, this.currentMB());
      steps.push({
        memberId: member.id,
        domain: member.domain,
        tier: member.tier,
        costMB: member.activeMB,
      });
      return undefined;
    };

    const first = this.routeTo(domain);
    if (!first) return { steps, peakMB, error: 'No member can take this question' };

    const error = runStep(first);
    if (error) return { steps, peakMB, error };
    if (!first.pinned) this.sleep(first.id);

    const wanted = Math.min(opts.assistants ?? 0, this.limits.maxAwakeAssistants);
    const assistants = [...this.members.values()]
      .filter(m => m.tier === 'assistant')
      .slice(0, wanted);
    for (const assistant of assistants) {
      const failure = runStep(assistant);
      if (failure) return { steps, peakMB, error: failure };
    }
    for (const assistant of assistants) this.sleep(assistant.id);

    const coordinator = [...this.members.values()].find(m => m.tier === 'coordinator');
    if (coordinator && coordinator.id !== first.id) {
      const failure = runStep(coordinator);
      if (failure) return { steps, peakMB, error: failure };
    }

    return { steps, peakMB };
  }
}

export const fleetService = new FleetService();
