/**
 * Agent Router — Core orchestration logic
 * Routes tasks to the best available agent based on:
 * - Keyword matching
 * - Confidence scoring
 * - Resource availability
 * - Escalation chains
 */

import { Agent, Task } from "@cybernetic/data-models";

export interface RoutingDecision {
  agentId: string;
  confidence: number;
  rationale: string;
  escalatedFrom?: string;
}

export interface ScoringResult {
  agentId: string;
  score: number;
  keywordMatches: string[];
  resourceAvailability: number; // 0-100
}

export class AgentRouter {
  private agents: Map<string, Agent> = new Map();

  constructor(agents: Agent[]) {
    agents.forEach((agent) => this.agents.set(agent.id, agent));
  }

  /**
   * Route a task to the best agent
   * Returns agent selection + confidence score
   */
  async route(task: Task): Promise<RoutingDecision> {
    const scores = await this.scoreAllAgents(task.input);

    if (scores.length === 0) {
      throw new Error("No agents available for routing");
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    const topChoice = scores[0];

    return {
      agentId: topChoice.agentId,
      confidence: topChoice.score,
      rationale: `Matched keywords: ${topChoice.keywordMatches.join(", ")} | Resource availability: ${topChoice.resourceAvailability}%`,
    };
  }

  /**
   * Score all agents for a given query
   */
  private async scoreAllAgents(query: string): Promise<ScoringResult[]> {
    const results: ScoringResult[] = [];

    for (const [agentId, agent] of this.agents) {
      if (agent.status === "paused") continue;

      const keywordMatches = this.matchKeywords(query, agent.keywords);
      const matchScore = (keywordMatches.length / Math.max(agent.keywords.length, 1)) * 100;

      // Resource availability (simplified — would check actual system state)
      const resourceAvailability = agent.status === "active" ? 100 : 70;

      const combinedScore = matchScore * 0.7 + resourceAvailability * 0.3;

      results.push({
        agentId,
        score: Math.min(combinedScore, 100),
        keywordMatches,
        resourceAvailability,
      });
    }

    return results;
  }

  /**
   * Extract matching keywords from query
   */
  private matchKeywords(query: string, keywords: string[]): string[] {
    const lowerQuery = query.toLowerCase();
    return keywords.filter((keyword) =>
      lowerQuery.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get escalation chain for an agent
   * Returns the path to escalate if confidence is too low
   */
  getEscalationChain(agentId: string): string[] {
    const agent = this.agents.get(agentId);
    if (!agent) return [];
    return agent.escalateTo;
  }
}
