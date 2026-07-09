/**
 * Orchestrator Service — Main coordination engine
 * Integrates: Router + Escalation + Situation Assessment
 * Handles task lifecycle: route -> execute -> monitor -> escalate if needed
 */

import { Agent, Task } from "@cybernetic/data-models";
import { AgentRouter, type RoutingDecision } from "./agent-router";
import { EscalationEngine, type EscalationConfig } from "./escalation";
import { SitationAssessor, type SystemState } from "./situation-assessor";

export interface OrchestrationConfig {
  escalationConfig?: Partial<EscalationConfig>;
}

export class OrchestratorService {
  private router: AgentRouter;
  private escalationEngine: EscalationEngine;
  private situationAssessor: SitationAssessor;

  constructor(agents: Agent[], config: OrchestrationConfig = {}) {
    this.router = new AgentRouter(agents);
    this.escalationEngine = new EscalationEngine(config.escalationConfig);
    this.situationAssessor = new SitationAssessor();
  }

  /**
   * Main task orchestration workflow
   */
  async orchestrateTask(
    task: Task,
    systemState: SystemState,
    escalationDepth: number = 0
  ): Promise<RoutingDecision> {
    // Step 1: Assess system capacity
    const capacity = this.situationAssessor.assessCapacity(systemState);

    if (!capacity.canDeployFullModels && escalationDepth === 0) {
      console.warn("System constrained:", capacity.recommendations);
    }

    // Step 2: Route to best agent
    const routing = await this.router.route(task);

    // Step 3: Check if escalation needed
    if (this.escalationEngine.shouldEscalate(routing.confidence, escalationDepth)) {
      const escalationChain = this.router.getEscalationChain(routing.agentId);
      const nextTarget = this.escalationEngine.getNextEscalationTarget(
        escalationChain,
        escalationDepth
      );

      if (nextTarget) {
        console.log(
          `Escalating from ${routing.agentId} to ${nextTarget} (depth: ${escalationDepth})`
        );

        // Create escalated task
        const escalatedTask: Task = {
          ...task,
          escalatedFrom: routing.agentId,
        };

        // Recursive call with next escalation target
        return this.orchestrateTask(escalatedTask, systemState, escalationDepth + 1);
      }
    }

    return routing;
  }

  /**
   * Get system assessment for monitoring
   */
  getCapacityAssessment(systemState: SystemState) {
    return this.situationAssessor.assessCapacity(systemState);
  }
}
