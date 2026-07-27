/**
 * Studio Orchestrator - AI Studio-specific task orchestration
 * Optimized for AI-powered app generation and enhancement workflows
 */

import GeminiBridge, { type GeminiConfig } from './gemini-bridge';

export interface StudioTask {
  id: string;
  type: 'generate' | 'analyze' | 'enhance' | 'debug' | 'document';
  description: string;
  context?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  timestamp: Date;
}

export interface StudioConfig {
  gemini: GeminiConfig;
  autoSave?: boolean;
  maxHistory?: number;
}

class StudioOrchestrator {
  private gemini: GeminiBridge;
  private tasks: Map<string, StudioTask> = new Map();
  private history: StudioTask[] = [];
  private config: StudioConfig;

  constructor(config: StudioConfig) {
    this.config = {
      autoSave: false,
      maxHistory: 50,
      ...config,
    };
    this.gemini = new GeminiBridge(config.gemini);
  }

  async generateComponent(description: string, imageUrl?: string): Promise<StudioTask> {
    const task: StudioTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'generate',
      description,
      status: 'running',
      timestamp: new Date(),
    };

    this.tasks.set(task.id, task);

    try {
      const systemPrompt = `You are an expert React component generator.
Generate clean, well-structured React components using TypeScript and Tailwind CSS.
Follow shadcn/ui component patterns when applicable.`;

      const response = await this.gemini.prompt(`${systemPrompt}\n\nGenerate: ${description}`, imageUrl);

      task.result = response.text;
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.addToHistory(task);
    return task;
  }

  async analyzeCode(code: string): Promise<StudioTask> {
    const task: StudioTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'analyze',
      description: 'Analyze code',
      status: 'running',
      timestamp: new Date(),
    };

    this.tasks.set(task.id, task);

    try {
      const response = await this.gemini.prompt(`Analyze this code and provide insights:\n\n${code}`);
      task.result = response.text;
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.addToHistory(task);
    return task;
  }

  async enhanceCode(code: string, enhancement: string): Promise<StudioTask> {
    const task: StudioTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'enhance',
      description: enhancement,
      status: 'running',
      timestamp: new Date(),
      context: { originalCode: code },
    };

    this.tasks.set(task.id, task);

    try {
      const prompt = `Enhance the following code with: ${enhancement}\n\nCode:\n${code}`;
      const response = await this.gemini.prompt(prompt);
      task.result = response.text;
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.addToHistory(task);
    return task;
  }

  async debugIssue(error: string, context?: string): Promise<StudioTask> {
    const task: StudioTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'debug',
      description: error,
      status: 'running',
      timestamp: new Date(),
    };

    this.tasks.set(task.id, task);

    try {
      let prompt = `Debug and fix this error:\n${error}`;
      if (context) {
        prompt += `\n\nContext:\n${context}`;
      }

      const response = await this.gemini.prompt(prompt);
      task.result = response.text;
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.addToHistory(task);
    return task;
  }

  async generateDocumentation(code: string): Promise<StudioTask> {
    const task: StudioTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'document',
      description: 'Generate documentation',
      status: 'running',
      timestamp: new Date(),
    };

    this.tasks.set(task.id, task);

    try {
      const response = await this.gemini.prompt(
        `Generate comprehensive documentation for this code:\n\n${code}\n\nInclude:\n- Purpose\n- Parameters\n- Return values\n- Usage examples\n- Edge cases`
      );
      task.result = response.text;
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.addToHistory(task);
    return task;
  }

  getTask(id: string): StudioTask | undefined {
    return this.tasks.get(id);
  }

  getHistory(limit?: number): StudioTask[] {
    const historyLimit = limit || this.config.maxHistory || 50;
    return this.history.slice(-historyLimit);
  }

  clearHistory(): void {
    this.history = [];
    this.tasks.clear();
  }

  private addToHistory(task: StudioTask): void {
    this.history.push(task);
    if (this.history.length > (this.config.maxHistory || 50)) {
      this.history.shift();
    }
  }

  getStatus(): Record<string, unknown> {
    return {
      activeTasks: Array.from(this.tasks.values()).filter((t) => t.status === 'running').length,
      totalTasks: this.tasks.size,
      historySize: this.history.length,
      timestamp: new Date(),
    };
  }
}

export default StudioOrchestrator;
