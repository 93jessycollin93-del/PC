/**
 * Eru Integration Layer for Jackie
 * Allows Jackie to request work from Eru and track its reasoning
 */

export interface EruTask {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface EruCapability {
  name: string;
  description: string;
  examples: string[];
}

/**
 * Eru Integration — Jackie's interface to Eru AI Assistant
 */
export class EruIntegration {
  private tasks: Map<string, EruTask> = new Map();
  private taskCounter = 0;

  private capabilities: EruCapability[] = [
    {
      name: 'reasoning',
      description: 'Deep reasoning on complex problems',
      examples: [
        'Explain how Pod System scaling works',
        'Debug a TypeScript type issue',
        'Design a system architecture',
      ],
    },
    {
      name: 'coding',
      description: 'Write, refactor, and debug code',
      examples: [
        'Generate a new component',
        'Fix a bug in existing code',
        'Optimize performance',
      ],
    },
    {
      name: 'documentation',
      description: 'Create and improve documentation',
      examples: [
        'Write a README',
        'Generate API documentation',
        'Create a getting started guide',
      ],
    },
    {
      name: 'analysis',
      description: 'Analyze data and systems',
      examples: [
        'Review code for issues',
        'Analyze system performance',
        'Assess security implications',
      ],
    },
  ];

  /**
   * Check if Eru can help with a specific type of task
   */
  canHelp(taskType: string): boolean {
    return this.capabilities.some(
      (c) =>
        c.name.toLowerCase().includes(taskType.toLowerCase()) ||
        taskType.toLowerCase().includes(c.name.toLowerCase())
    );
  }

  /**
   * Get Eru's capabilities
   */
  getCapabilities(): EruCapability[] {
    return this.capabilities;
  }

  /**
   * Ask Eru to work on something
   */
  async requestTask(description: string): Promise<EruTask> {
    const id = `eru-${++this.taskCounter}`;
    const task: EruTask = {
      id,
      description,
      status: 'pending',
      createdAt: new Date(),
    };

    this.tasks.set(id, task);

    // Simulate Eru starting work
    setTimeout(() => {
      task.status = 'in-progress';
    }, 500);

    return task;
  }

  /**
   * Complete a task from Eru
   */
  completeTask(taskId: string, result: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): EruTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getTasks(): EruTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Suggest a task for Eru based on user intent
   */
  suggestTask(userIntent: string): string {
    const intents: Record<string, string> = {
      debug: 'Help me debug this issue',
      explain: 'Explain how this system works',
      build: 'Help me build this feature',
      optimize: 'Optimize this code for performance',
      document: 'Write documentation for this',
      design: 'Help me design this architecture',
      review: 'Review this code for issues',
      test: 'Create tests for this functionality',
    };

    return (
      intents[userIntent.toLowerCase()] ||
      'Help me with this task'
    );
  }

  /**
   * Generate status for Jackie's awareness
   */
  generateStatusForJackie(): string {
    const tasksByStatus = {
      pending: this.getTasks().filter((t) => t.status === 'pending').length,
      'in-progress': this.getTasks().filter(
        (t) => t.status === 'in-progress'
      ).length,
      completed: this.getTasks().filter((t) => t.status === 'completed').length,
    };

    return `
ERU STATUS
═════════════════════
Tier: tier_50mb (AI Assistant Pod)
Capabilities: ${this.capabilities.length} (Reasoning, Coding, Documentation, Analysis)

Task Backlog:
  🕐 Pending: ${tasksByStatus.pending}
  ⏳ In Progress: ${tasksByStatus['in-progress']}
  ✅ Completed: ${tasksByStatus.completed}

Recommendation:
Eru is perfect for:
• Deep reasoning and problem solving
• Code generation and debugging
• System design and architecture
• Code review and optimization
    `;
  }

  /**
   * Suggest what Jackie should ask Eru for a given problem
   */
  suggestApproach(problem: string): string {
    const approaches: Record<string, string> = {
      pod: 'Ask Eru to explain the Pod System architecture and how to extend it',
      ui: 'Ask Eru to design UI components and layouts',
      bug: 'Ask Eru to help debug this issue',
      performance: 'Ask Eru to profile and optimize this',
      test: 'Ask Eru to create comprehensive tests',
    };

    for (const [key, value] of Object.entries(approaches)) {
      if (problem.toLowerCase().includes(key)) {
        return value;
      }
    }

    return 'Ask Eru for help with this problem';
  }
}
