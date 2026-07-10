/**
 * Agent Team Orchestrator — coordinate multi-agent task execution and messaging
 *
 * Features:
 * - Multi-agent task chains (Research → Analyze → Code → QA)
 * - Inter-pod message routing and acknowledgment
 * - Execution timeline and phase tracking
 * - Team coordination and dependency management
 */

import { bus } from './bus';
import { appStorage } from './appStorage';

export type AgentRole = 'researcher' | 'analyzer' | 'coder' | 'qa' | 'reviewer';
export type ExecutionPhase = 'pending' | 'running' | 'completed' | 'failed' | 'waiting';

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent?: string;
  timestamp: number;
  type: 'task' | 'result' | 'error' | 'status' | 'coordination';
  content: string;
  metadata?: Record<string, any>;
  acknowledgedAt?: number;
}

export interface AgentTask {
  id: string;
  role: AgentRole;
  phase: ExecutionPhase;
  input?: string;
  output?: string;
  startTime?: number;
  endTime?: number;
  messages: AgentMessage[];
  dependencies?: string[]; // Task IDs this depends on
}

export interface TeamExecution {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  goal: string;
  tasks: AgentTask[];
  messages: AgentMessage[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

class AgentTeamOrchestrator {
  private executions: Map<string, TeamExecution> = new Map();
  private currentExecution: TeamExecution | null = null;
  private messageHandlers: Map<string, (msg: AgentMessage) => void> = new Map();

  constructor() {
    this.loadExecutions();

    // Subscribe to pod communication events
    bus.on('pod-message', (detail: any) => {
      this.handlePodMessage(detail);
    });
  }

  /**
   * Start a new team execution
   */
  public startTeamExecution(name: string, goal: string, roles: AgentRole[]): TeamExecution {
    const execution: TeamExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      startTime: Date.now(),
      goal,
      tasks: roles.map(role => this.createTask(role)),
      messages: [],
      status: 'planning',
    };

    this.executions.set(execution.id, execution);
    this.currentExecution = execution;

    bus.emit('team-execution-started', {
      executionId: execution.id,
      name,
      goal,
      roles,
    });

    return execution;
  }

  /**
   * Create an agent task
   */
  private createTask(role: AgentRole): AgentTask {
    return {
      id: `task-${role}-${Date.now()}`,
      role,
      phase: 'pending',
      messages: [],
    };
  }

  /**
   * Send a message between agents
   */
  public sendMessage(
    fromAgent: string,
    toAgent: string | undefined,
    type: 'task' | 'result' | 'error' | 'status' | 'coordination',
    content: string,
    metadata?: Record<string, any>
  ): AgentMessage {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromAgent,
      toAgent,
      timestamp: Date.now(),
      type,
      content,
      metadata,
    };

    if (this.currentExecution) {
      this.currentExecution.messages.push(message);

      // Add to relevant task
      const task = this.currentExecution.tasks.find(t => t.role === fromAgent);
      if (task) {
        task.messages.push(message);
      }
    }

    // Route to handler if registered
    if (toAgent) {
      const handler = this.messageHandlers.get(toAgent);
      if (handler) {
        setTimeout(() => handler(message), 100);
      }
    }

    bus.emit('agent-message', message);
    return message;
  }

  /**
   * Update task status
   */
  public updateTaskStatus(
    executionId: string,
    taskId: string,
    phase: ExecutionPhase,
    output?: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const task = execution.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.phase = phase;
    if (phase === 'running' && !task.startTime) {
      task.startTime = Date.now();
    }
    if ((phase === 'completed' || phase === 'failed') && !task.endTime) {
      task.endTime = Date.now();
    }
    if (output) {
      task.output = output;
    }

    bus.emit('task-status-changed', { taskId, phase, executionId });

    this.saveExecutions();
  }

  /**
   * Get current execution
   */
  public getCurrentExecution(): TeamExecution | null {
    return this.currentExecution;
  }

  /**
   * Get an execution by ID
   */
  public getExecution(id: string): TeamExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Get all executions
   */
  public getExecutions(): TeamExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get execution timeline
   */
  public getTimeline(executionId: string): AgentMessage[] {
    const execution = this.executions.get(executionId);
    return execution ? execution.messages.sort((a, b) => a.timestamp - b.timestamp) : [];
  }

  /**
   * Acknowledge a message
   */
  public acknowledgeMessage(messageId: string): void {
    if (!this.currentExecution) return;

    const msg = this.currentExecution.messages.find(m => m.id === messageId);
    if (msg) {
      msg.acknowledgedAt = Date.now();
    }
  }

  /**
   * Register a message handler for an agent
   */
  public registerMessageHandler(agent: string, handler: (msg: AgentMessage) => void): () => void {
    this.messageHandlers.set(agent, handler);
    return () => this.messageHandlers.delete(agent);
  }

  /**
   * Get execution statistics
   */
  public getStats(executionId: string): {
    total: number;
    completed: number;
    failed: number;
    avgDuration: number;
    messageCount: number;
  } {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return { total: 0, completed: 0, failed: 0, avgDuration: 0, messageCount: 0 };
    }

    const completed = execution.tasks.filter(t => t.phase === 'completed').length;
    const failed = execution.tasks.filter(t => t.phase === 'failed').length;
    const durations = execution.tasks
      .filter(t => t.startTime && t.endTime)
      .map(t => (t.endTime! - t.startTime!) / 1000);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b) / durations.length : 0;

    return {
      total: execution.tasks.length,
      completed,
      failed,
      avgDuration,
      messageCount: execution.messages.length,
    };
  }

  /**
   * Handle pod messages
   */
  private handlePodMessage(detail: any): void {
    if (!this.currentExecution) return;

    const message = this.sendMessage(
      detail.from || 'pod-system',
      detail.to,
      'status',
      detail.message || JSON.stringify(detail),
      detail.metadata
    );
  }

  /**
   * Private methods
   */
  private loadExecutions(): void {
    const storage = appStorage('agent-team');
    const saved = storage.get<TeamExecution[]>('executions', []);
    saved.forEach(e => this.executions.set(e.id, e));
  }

  private saveExecutions(): void {
    const storage = appStorage('agent-team');
    storage.set('executions', Array.from(this.executions.values()));
  }
}

export const agentTeamOrchestrator = new AgentTeamOrchestrator();
