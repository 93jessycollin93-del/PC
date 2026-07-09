/**
 * Escalation Logic — Confidence-based task escalation
 * If an agent's confidence is below threshold, escalate to next agent
 */

export interface EscalationConfig {
  minConfidenceThreshold: number; // 0-100
  maxEscalationDepth: number; // prevent infinite loops
  escalationDelayMs: number; // time to wait before escalating
}

export class EscalationEngine {
  private config: EscalationConfig;

  constructor(config: Partial<EscalationConfig> = {}) {
    this.config = {
      minConfidenceThreshold: config.minConfidenceThreshold ?? 65,
      maxEscalationDepth: config.maxEscalationDepth ?? 3,
      escalationDelayMs: config.escalationDelayMs ?? 1000,
    };
  }

  /**
   * Determine if task should be escalated
   */
  shouldEscalate(confidence: number, escalationDepth: number = 0): boolean {
    if (escalationDepth >= this.config.maxEscalationDepth) {
      return false; // Prevent infinite escalation
    }

    return confidence < this.config.minConfidenceThreshold;
  }

  /**
   * Get next escalation target
   * Chain: agent1 -> agent2 -> agent3 -> fallback (visionary)
   */
  getNextEscalationTarget(escalationChain: string[], currentDepth: number): string | null {
    if (currentDepth >= this.config.maxEscalationDepth) {
      return null; // Max depth reached
    }

    if (currentDepth < escalationChain.length) {
      return escalationChain[currentDepth];
    }

    return null; // No more escalation targets
  }

  /**
   * Calculate escalation delay
   * Exponential backoff: 1s, 2s, 4s, etc.
   */
  getEscalationDelay(escalationDepth: number): number {
    return this.config.escalationDelayMs * Math.pow(2, escalationDepth);
  }
}
