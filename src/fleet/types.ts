/**
 * Agent fleet — many small specialists, a few assistants, one coordinator.
 *
 * The shape of the fleet, stated honestly about what each tier can be:
 *
 * - SPECIALIST: a router/classifier, not a language model. Kilobytes, not
 *   megabytes. It does not hold knowledge about its domain; it holds where to
 *   look and who to ask next. This is the only reason 50-100 of them fit — a
 *   500 kB file cannot reason about physics, but it can recognise a physics
 *   question and know which sources and which peer answer it.
 * - ASSISTANT: a small reasoning tier that condenses and negotiates between
 *   specialist outputs. Costs real RAM, so it is capped in count and size and
 *   drops back to zero the moment it is not thinking.
 * - COORDINATOR: the one member that carries actual context about the user and
 *   the vision. Stays warm, because reloading its context is the expensive part.
 *
 * Dormancy is the core rule: a member that is not thinking costs ZERO. RAM is
 * only spent between wake() and sleep().
 */

export type FleetTier = 'coordinator' | 'assistant' | 'specialist';

export interface FleetMember {
  id: string;
  /** What this member is for — 'physics', 'calculus', 'metaphor'. */
  domain: string;
  tier: FleetTier;
  /**
   * RAM this member occupies WHILE AWAKE. Dormant members cost nothing, so
   * this is a ceiling paid only during thinking, never a standing cost.
   */
  activeMB: number;
  /** Never evicted. The coordinator sets this so its context survives. */
  pinned?: boolean;
}

export interface AwakeMember extends FleetMember {
  /** Epoch ms of the last wake — drives least-recently-used eviction. */
  lastUsedAt: number;
}

/** Defaults matching the intended fleet shape; every one is overridable. */
export const TIER_DEFAULTS: Record<FleetTier, { activeMB: number; pinned: boolean }> = {
  // Carries the vision and the user's context; reloading that is the costly
  // part, so it stays resident rather than being torn down between questions.
  coordinator: { activeMB: 40, pinned: true },
  // Real reasoning, so a real cost — but zero whenever it is not called on.
  assistant: { activeMB: 10, pinned: false },
  // A router with a source list. Kilobytes; 1 MB is already generous.
  specialist: { activeMB: 1, pinned: false },
};

/** How many of each tier the fleet will hold awake at once. */
export interface FleetLimits {
  /** Total RAM the whole fleet may occupy while thinking. */
  budgetMB: number;
  /** Ceiling on concurrently-awake assistants. */
  maxAwakeAssistants: number;
}

export const DEFAULT_LIMITS: FleetLimits = {
  // Deliberately small: this has to run on a phone alongside everything else,
  // and the whole design exists to avoid multi-gigabyte residency.
  budgetMB: 120,
  maxAwakeAssistants: 5,
};
