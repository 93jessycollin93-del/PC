/**
 * Command Planner — Smart Execution Planning & Implications
 * Understands what commands will do before executing them
 */

import { RuntimeStateManager } from './runtime-state-manager';

export interface CommandPlan {
  command: string;
  intent: string;
  actions: CommandAction[];
  resourceCost: ResourceCost;
  risks: CommandRisk[];
  explanation: string;
  requiresConfirmation: boolean;
  isDestructive: boolean;
}

export interface CommandAction {
  type: 'spawn' | 'compress' | 'execute' | 'load' | 'unload';
  target: string;
  details: string;
}

export interface ResourceCost {
  storageBytes: number;
  storageFormatted: string;
  memoryBytes: number;
  cpuPercent: number;
  estimatedTime: string;
}

export interface CommandRisk {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation?: string;
}

/**
 * Smart Command Planner
 * Parses user intent and creates detailed execution plans
 */
export class CommandPlanner {
  private tierSizes: Record<string, number> = {
    tier_5mb: 5 * 1024 * 1024,
    tier_50mb: 50 * 1024 * 1024,
    tier_250mb: 250 * 1024 * 1024,
    tier_500mb: 500 * 1024 * 1024,
    tier_1gb: 1024 * 1024 * 1024,
    tier_5gb: 5 * 1024 * 1024 * 1024,
    tier_50gb: 50 * 1024 * 1024 * 1024,
  };

  private appTierMap: Record<string, string> = {
    eru: 'tier_50mb',
    terminal: 'tier_250mb',
    vscode: 'tier_500mb',
    'visual studio code': 'tier_500mb',
    'code editor': 'tier_500mb',
    ollama: 'tier_250mb',
    settings: 'tier_50mb',
    'model status': 'tier_100mb',
    'pod monitor': 'tier_100mb',
    'knowledge base': 'tier_250mb',
  };

  constructor(private stateManager: RuntimeStateManager) {}

  /**
   * Parse user command and create a plan
   */
  planCommand(userInput: string, globalModeEnabled: boolean): CommandPlan {
    const normalized = userInput.toLowerCase().trim();

    // Route to appropriate planner
    if (this.isOpenCommand(normalized)) {
      return this.planOpenApp(normalized, globalModeEnabled);
    } else if (this.isTerminalCommand(normalized)) {
      return this.planTerminalCommand(normalized, globalModeEnabled);
    } else if (this.isCloseCommand(normalized)) {
      return this.planCloseApp(normalized, globalModeEnabled);
    } else if (this.isStatusCommand(normalized)) {
      return this.planStatusCheck(normalized, globalModeEnabled);
    } else if (this.isDestructiveCommand(normalized)) {
      return this.planDestructiveCommand(normalized, globalModeEnabled);
    } else {
      return this.planUnknownCommand(normalized, globalModeEnabled);
    }
  }

  /**
   * Detect if command is "open [app]"
   */
  private isOpenCommand(input: string): boolean {
    return /^(open|launch|start)\s+/.test(input);
  }

  /**
   * Detect if command is terminal/run
   */
  private isTerminalCommand(input: string): boolean {
    return /^(run|execute|terminal|bash|sh)\s+/.test(input) || /^(npm|yarn|pip|python)\s+/.test(input);
  }

  /**
   * Detect if command is close
   */
  private isCloseCommand(input: string): boolean {
    return /^(close|quit|exit|kill)\s+/.test(input);
  }

  /**
   * Detect if command is status/info
   */
  private isStatusCommand(input: string): boolean {
    return /^(status|info|what|how|help|show)/.test(input) || input === '?';
  }

  /**
   * Detect if command is destructive
   */
  private isDestructiveCommand(input: string): boolean {
    return (
      /^(delete|remove|destroy|wipe|kill all|shutdown|stop all)/.test(input) ||
      /system|all|everything|all pods/.test(input)
    );
  }

  /**
   * Plan "open [app]" command
   */
  private planOpenApp(input: string, globalModeEnabled: boolean): CommandPlan {
    const appMatch = input.match(/^(open|launch|start)\s+(.+)/i);
    const appName = appMatch ? appMatch[2].trim() : '';
    const tier = this.appTierMap[appName.toLowerCase()] || 'tier_250mb';
    const tierSize = this.tierSizes[tier] || 250 * 1024 * 1024;

    const cost = this.stateManager.calculateSpawnCost(tierSize);
    const risks: CommandRisk[] = [];

    if (!cost.canSpawn) {
      risks.push({
        severity: 'critical',
        description: `Insufficient storage. Need ${cost.storageFormatted}, have ${this.stateManager.getState().availableStorage}`,
        mitigation: 'Compress dormant pods or close existing apps',
      });
    }

    if (cost.warning) {
      risks.push({
        severity: cost.percentageOfTotal > 50 ? 'high' : 'medium',
        description: cost.warning,
      });
    }

    return {
      command: input,
      intent: `Open ${appName} application`,
      actions: [
        {
          type: 'spawn',
          target: appName,
          details: `Spawn ${tier} pod for ${appName}`,
        },
        {
          type: 'load',
          target: 'information-layers',
          details: 'Load development context and shared knowledge base',
        },
      ],
      resourceCost: {
        storageBytes: tierSize,
        storageFormatted: cost.storageFormatted,
        memoryBytes: tierSize * 0.5, // Rough estimate
        cpuPercent: 15,
        estimatedTime: '2-5 seconds',
      },
      risks,
      explanation: `I'll spawn a ${tier} pod for ${appName} using ${cost.storageFormatted} of storage (${cost.percentageOfTotal.toFixed(2)}% of your capacity). The pod will hydrate using the development information layer, then ${appName} will be ready to use.`,
      requiresConfirmation: globalModeEnabled || !cost.canSpawn,
      isDestructive: false,
    };
  }

  /**
   * Plan terminal/run command
   */
  private planTerminalCommand(input: string, globalModeEnabled: boolean): CommandPlan {
    const cmdMatch = input.match(/^(?:run|execute)\s+(.+)/i);
    const fullCommand = cmdMatch ? cmdMatch[1] : input;
    const isHeavy = /npm\s+install|cargo\s+build|docker|kubernetes/.test(fullCommand);

    const tierSize = isHeavy ? 500 * 1024 * 1024 : 250 * 1024 * 1024;
    const cost = this.stateManager.calculateSpawnCost(tierSize);
    const risks: CommandRisk[] = [];

    if (isHeavy) {
      risks.push({
        severity: 'medium',
        description: 'Heavy command detected (build/compile/container)',
        mitigation: 'Consider running during off-peak hours',
      });
    }

    return {
      command: input,
      intent: `Execute: ${fullCommand}`,
      actions: [
        {
          type: 'spawn',
          target: 'terminal',
          details: `Spawn terminal pod (tier_${isHeavy ? '500mb' : '250mb'})`,
        },
        {
          type: 'execute',
          target: 'command',
          details: fullCommand,
        },
      ],
      resourceCost: {
        storageBytes: tierSize,
        storageFormatted: cost.storageFormatted,
        memoryBytes: tierSize * 0.6,
        cpuPercent: isHeavy ? 80 : 30,
        estimatedTime: isHeavy ? '5-30 minutes' : '1-5 seconds',
      },
      risks,
      explanation: `I'll spawn a terminal pod and execute: "${fullCommand}". This will use ${cost.storageFormatted} of storage. ${isHeavy ? 'This is a heavy operation that may use significant CPU.' : ''}`,
      requiresConfirmation: globalModeEnabled || isHeavy,
      isDestructive: /rm\s+-rf|delete|truncate|DROP TABLE/.test(fullCommand),
    };
  }

  /**
   * Plan close command
   */
  private planCloseApp(input: string, globalModeEnabled: boolean): CommandPlan {
    const appMatch = input.match(/^(?:close|quit|exit|kill)\s+(.+)/i);
    const appName = appMatch ? appMatch[1].trim() : '';
    const pod = this.stateManager.getState().activePods.find((p) =>
      p.name.toLowerCase().includes(appName.toLowerCase())
    );

    if (!pod) {
      return {
        command: input,
        intent: `Close ${appName}`,
        actions: [],
        resourceCost: {
          storageBytes: 0,
          storageFormatted: '0 B',
          memoryBytes: 0,
          cpuPercent: 0,
          estimatedTime: 'N/A',
        },
        risks: [
          {
            severity: 'low',
            description: `${appName} is not currently running`,
          },
        ],
        explanation: `${appName} is not in your active pods. Nothing to close.`,
        requiresConfirmation: false,
        isDestructive: false,
      };
    }

    return {
      command: input,
      intent: `Close ${appName}`,
      actions: [
        {
          type: 'compress',
          target: pod.id,
          details: `Compress ${pod.name} back to dormant seed`,
        },
      ],
      resourceCost: {
        storageBytes: -pod.sizeBytes,
        storageFormatted: `-${this.formatBytes(pod.sizeBytes)}`,
        memoryBytes: 0,
        cpuPercent: -15,
        estimatedTime: '1-2 seconds',
      },
      risks: [],
      explanation: `I'll compress ${pod.name} back to a dormant seed, freeing ${this.formatBytes(pod.sizeBytes)} of storage. The app state will be saved.`,
      requiresConfirmation: false,
      isDestructive: false,
    };
  }

  /**
   * Plan status check
   */
  private planStatusCheck(input: string, globalModeEnabled: boolean): CommandPlan {
    return {
      command: input,
      intent: 'Show system status',
      actions: [],
      resourceCost: {
        storageBytes: 0,
        storageFormatted: '0 B',
        memoryBytes: 0,
        cpuPercent: 0,
        estimatedTime: 'Instant',
      },
      risks: [],
      explanation: "I'll show you a detailed status report of all active pods, resource usage, and any warnings.",
      requiresConfirmation: false,
      isDestructive: false,
    };
  }

  /**
   * Plan destructive command
   */
  private planDestructiveCommand(input: string, globalModeEnabled: boolean): CommandPlan {
    const activePodCount = this.stateManager.getState().activePods.length;
    const totalStorage = this.stateManager.getTotalActiveStorageUsage();

    return {
      command: input,
      intent: 'DESTRUCTIVE OPERATION DETECTED',
      actions: [
        {
          type: 'compress',
          target: 'all-active-pods',
          details: `Compress all ${activePodCount} active pods to dormant seeds`,
        },
      ],
      resourceCost: {
        storageBytes: -totalStorage,
        storageFormatted: `-${this.formatBytes(totalStorage)}`,
        memoryBytes: 0,
        cpuPercent: -100,
        estimatedTime: '5-10 seconds',
      },
      risks: [
        {
          severity: 'critical',
          description: `This will close ${activePodCount} active pods and free ${this.formatBytes(totalStorage)} of storage`,
          mitigation: 'All pod states will be saved as dormant seeds. You can reopen them later.',
        },
        {
          severity: 'high',
          description: 'All running tasks will be interrupted and saved',
        },
      ],
      explanation: `⚠️  DESTRUCTIVE COMMAND: This will compress all ${activePodCount} active pods back to dormant seeds, freeing ${this.formatBytes(totalStorage)} of storage. All running tasks will be saved. Are you ABSOLUTELY sure?`,
      requiresConfirmation: true,
      isDestructive: true,
    };
  }

  /**
   * Plan unknown command
   */
  private planUnknownCommand(input: string, globalModeEnabled: boolean): CommandPlan {
    return {
      command: input,
      intent: 'Unknown command',
      actions: [],
      resourceCost: {
        storageBytes: 0,
        storageFormatted: '0 B',
        memoryBytes: 0,
        cpuPercent: 0,
        estimatedTime: 'N/A',
      },
      risks: [
        {
          severity: 'low',
          description: 'I didn\'t understand that command',
          mitigation: 'Try: "open [app]", "run [command]", "close [app]", or "status"',
        },
      ],
      explanation:
        'I didn\'t understand that command. Try one of these:\n• "open Eru" / "open VSCode" / "open Terminal"\n• "run npm start" / "run python script.py"\n• "close [app]"\n• "status"',
      requiresConfirmation: false,
      isDestructive: false,
    };
  }

  /**
   * Format bytes to human-readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = Math.abs(bytes);
    let unitIdx = 0;

    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx++;
    }

    const sign = bytes < 0 ? '-' : '';
    return `${sign}${size.toFixed(2)} ${units[unitIdx]}`;
  }

  /**
   * Render a command plan as human-readable text
   */
  renderPlan(plan: CommandPlan): string {
    const sections: string[] = [];

    sections.push(`COMMAND PLAN: ${plan.intent}`);
    sections.push('═'.repeat(50));

    // Actions
    if (plan.actions.length > 0) {
      sections.push('\nACTIONS:');
      plan.actions.forEach((action, idx) => {
        sections.push(
          `  ${idx + 1}. [${action.type.toUpperCase()}] ${action.target}\n     ${action.details}`
        );
      });
    }

    // Resources
    sections.push('\nRESOURCE COST:');
    sections.push(`  Storage: ${plan.resourceCost.storageFormatted}`);
    sections.push(`  Memory: ~${this.formatBytes(plan.resourceCost.memoryBytes)}`);
    sections.push(`  CPU: ${plan.resourceCost.cpuPercent}%`);
    sections.push(`  Time: ~${plan.resourceCost.estimatedTime}`);

    // Risks
    if (plan.risks.length > 0) {
      sections.push('\nRISKS:');
      plan.risks.forEach((risk) => {
        const severity = risk.severity.toUpperCase();
        sections.push(`  [${severity}] ${risk.description}`);
        if (risk.mitigation) {
          sections.push(`      → ${risk.mitigation}`);
        }
      });
    }

    // Explanation
    sections.push('\nEXPLANATION:');
    sections.push(plan.explanation);

    if (plan.requiresConfirmation) {
      sections.push('\nREQUIRES CONFIRMATION: Yes');
    }

    if (plan.isDestructive) {
      sections.push('\n⚠️  DESTRUCTIVE OPERATION');
    }

    return sections.join('\n');
  }
}
