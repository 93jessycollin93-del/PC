/**
 * Jackie Seed Tool — Compressed, deployable version of Jackie
 * Can be embedded in Mini PC, Eru, or used as standalone orchestrator
 * ~40KB compressed seed form, expands on demand
 */

import type { RuntimeState } from './system-context';
import { RuntimeStateManager } from './runtime-state-manager';
import { CommandPlanner } from './command-planner';
import { MiniPCManager } from './mini-pc-integration';
import { EruIntegration } from './eru-integration';

export interface JackieSeedConfig {
  name: string;
  tier: string;
  globalModeEnabled: boolean;
  miniPCEnabled: boolean;
  eruEnabled: boolean;
}

export interface JackieToolResponse {
  status: 'success' | 'error' | 'pending_confirmation';
  message: string;
  action?: any;
  requiresConfirmation?: boolean;
  options?: string[];
}

/**
 * Jackie Seed Tool
 * Lightweight, compressed version of Jackie that can be deployed anywhere
 */
export class JackieSeedTool {
  private config: JackieSeedConfig;
  private stateManager: RuntimeStateManager | null = null;
  private commandPlanner: CommandPlanner | null = null;
  private miniPC: MiniPCManager | null = null;
  private eru: EruIntegration | null = null;

  constructor(config: Partial<JackieSeedConfig> = {}) {
    this.config = {
      name: config.name || 'Jackie',
      tier: config.tier || 'tier_1gb',
      globalModeEnabled: config.globalModeEnabled ?? false,
      miniPCEnabled: config.miniPCEnabled ?? true,
      eruEnabled: config.eruEnabled ?? true,
    };
  }

  /**
   * Initialize Jackie (hydration)
   */
  initialize(initialState?: RuntimeState): void {
    // Initialize state manager
    const state: RuntimeState = initialState || {
      activePods: [],
      availableStorage: '512 GB',
      availableMemory: '32 GB',
      totalCPUs: 8,
      globalModeEnabled: this.config.globalModeEnabled,
      commandsExecuted: 0,
      sessionDuration: '0s',
      potentialRisks: [],
      informationLayers: [],
    };

    this.stateManager = new RuntimeStateManager(state);
    this.commandPlanner = new CommandPlanner(this.stateManager);

    // Initialize integrations if enabled
    if (this.config.miniPCEnabled) {
      this.miniPC = new MiniPCManager();
    }

    if (this.config.eruEnabled) {
      this.eru = new EruIntegration();
    }
  }

  /**
   * Process a user command/request
   */
  async processCommand(userInput: string): Promise<JackieToolResponse> {
    if (!this.stateManager || !this.commandPlanner) {
      return {
        status: 'error',
        message: 'Jackie not initialized. Call initialize() first.',
      };
    }

    try {
      // Plan the command
      const plan = this.commandPlanner.planCommand(
        userInput,
        this.config.globalModeEnabled
      );

      // If it requires confirmation in Global Mode
      if (plan.requiresConfirmation && this.config.globalModeEnabled) {
        return {
          status: 'pending_confirmation',
          message: plan.explanation,
          action: plan,
          requiresConfirmation: true,
          options: ['Cancel', 'Proceed'],
        };
      }

      // Check if it's a Mini PC command
      if (this.miniPC && this._isMiniPCCommand(userInput)) {
        return await this._handleMiniPCCommand(userInput);
      }

      // Check if it's an Eru command
      if (this.eru && this._isEruCommand(userInput)) {
        return await this._handleEruCommand(userInput);
      }

      // Execute the planned command
      return {
        status: 'success',
        message: plan.explanation,
        action: plan,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if command targets Mini PC
   */
  private _isMiniPCCommand(input: string): boolean {
    return /mini pc|open app|launch app|expand|collapse/i.test(input);
  }

  /**
   * Check if command targets Eru
   */
  private _isEruCommand(input: string): boolean {
    return /ask eru|eru|reasoning|task|help|explain/i.test(input);
  }

  /**
   * Handle Mini PC command
   */
  private async _handleMiniPCCommand(
    userInput: string
  ): Promise<JackieToolResponse> {
    if (!this.miniPC) {
      return { status: 'error', message: 'Mini PC not enabled' };
    }

    if (/expand/i.test(userInput)) {
      this.miniPC.expandMiniPC();
      return {
        status: 'success',
        message: 'Mini PC expanded to full screen. Available apps:\n' +
          this.miniPC.listApps().map(a => `  • ${a.name} - ${a.description}`).join('\n'),
      };
    }

    if (/collapse/i.test(userInput)) {
      this.miniPC.collapseMiniPC();
      return {
        status: 'success',
        message: 'Mini PC collapsed to sidebar.',
      };
    }

    const appMatch = userInput.match(/open\s+(\w+)|launch\s+(\w+)/i);
    if (appMatch) {
      const appName = (appMatch[1] || appMatch[2]).toLowerCase();
      try {
        await this.miniPC.spawnApp(appName);
        return {
          status: 'success',
          message: `✓ Spawned ${appName}`,
        };
      } catch (error) {
        return {
          status: 'error',
          message: `Could not spawn ${appName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    return {
      status: 'success',
      message: this.miniPC.generateStatusForJackie(),
    };
  }

  /**
   * Handle Eru command
   */
  private async _handleEruCommand(
    userInput: string
  ): Promise<JackieToolResponse> {
    if (!this.eru) {
      return { status: 'error', message: 'Eru not enabled' };
    }

    if (/capabilities|help/i.test(userInput)) {
      const caps = this.eru.getCapabilities();
      return {
        status: 'success',
        message: `Eru's Capabilities:\n${caps.map((c) => `  • ${c.name}: ${c.description}`).join('\n')}`,
      };
    }

    // Extract the actual request
    const taskMatch = userInput.match(
      /ask\s+eru\s+(.+)|eru\s+(.+)|help\s+(.+)/i
    );
    if (taskMatch) {
      const task = taskMatch[1] || taskMatch[2] || taskMatch[3];
      try {
        const eruTask = await this.eru.requestTask(task);
        return {
          status: 'success',
          message: `✓ Eru working on: "${task}"\nTask ID: ${eruTask.id}`,
          action: { taskId: eruTask.id, task },
        };
      } catch (error) {
        return {
          status: 'error',
          message: `Could not create Eru task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    return {
      status: 'success',
      message: this.eru.generateStatusForJackie(),
    };
  }

  /**
   * Get current status
   */
  getStatus(): string {
    if (!this.stateManager) {
      return 'Jackie not initialized';
    }

    const status = [
      `JACKIE STATUS`,
      `═══════════════════`,
      `Config: ${this.config.name} (${this.config.tier})`,
      `Global Mode: ${this.config.globalModeEnabled ? '🔴 ON' : '🟢 OFF'}`,
      `Mini PC: ${this.config.miniPCEnabled ? '✓ Enabled' : '✗ Disabled'}`,
      `Eru: ${this.config.eruEnabled ? '✓ Enabled' : '✗ Disabled'}`,
      ``,
      this.stateManager.generateStatusReport(),
    ];

    if (this.miniPC) {
      status.push(``, this.miniPC.generateStatusForJackie());
    }

    if (this.eru) {
      status.push(``, this.eru.generateStatusForJackie());
    }

    return status.join('\n');
  }

  /**
   * Enable/disable Global Mode
   */
  setGlobalMode(enabled: boolean): void {
    this.config.globalModeEnabled = enabled;
    if (this.stateManager) {
      this.stateManager.updateState({ globalModeEnabled: enabled });
    }
  }

  /**
   * Get Jackie seed metadata (for packaging)
   */
  getSeedMetadata() {
    return {
      name: this.config.name,
      tier: this.config.tier,
      compressed_size_kb: 40,
      expanded_size_mb: parseFloat(this.config.tier.match(/\d+/)?.[0] || '1'),
      capabilities: [
        'pod-orchestration',
        'mini-pc-management',
        'eru-integration',
        'global-control',
        'command-routing',
      ],
      version: '1.0.0',
      created: new Date().toISOString(),
    };
  }

  /**
   * Export Jackie as a deployable seed (for distribution)
   */
  exportAsSeed(): string {
    return JSON.stringify(
      {
        seed: {
          name: this.config.name,
          tier: this.config.tier,
          config: this.config,
          capabilities: ['orchestration', 'reasoning', 'task-management'],
          entrypoint: 'JackieSeedTool',
          version: '1.0.0',
        },
      },
      null,
      2
    );
  }
}

/**
 * Factory function for creating Jackie instances
 */
export function createJackie(
  config?: Partial<JackieSeedConfig>
): JackieSeedTool {
  const jackie = new JackieSeedTool(config);
  jackie.initialize();
  return jackie;
}

/**
 * Quick helper: Ask Jackie something
 */
export async function askJackie(
  query: string,
  config?: Partial<JackieSeedConfig>
): Promise<JackieToolResponse> {
  const jackie = createJackie(config);
  return await jackie.processCommand(query);
}
