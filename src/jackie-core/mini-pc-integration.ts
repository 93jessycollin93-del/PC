/**
 * Mini PC Integration Layer for Jackie
 * Allows Jackie to manage, spawn, and interact with Mini PC and Eru apps
 */

export interface MiniPCApp {
  id: string;
  name: string;
  tier: string;
  icon?: string;
  description: string;
  spawning: () => Promise<void>;
  actions: AppAction[];
}

export interface AppAction {
  name: string;
  description: string;
  params?: Record<string, any>;
  execute: (params?: Record<string, any>) => Promise<any>;
}

export interface MiniPCState {
  activeApps: MiniPCApp[];
  uiMode: 'collapsed' | 'expanded' | 'full-screen';
  globalModeActive: boolean;
}

/**
 * Mini PC Manager — Jackie's interface to spawn/control Mini PC and apps
 */
export class MiniPCManager {
  private state: MiniPCState = {
    activeApps: [],
    uiMode: 'collapsed',
    globalModeActive: false,
  };

  private apps: Map<string, MiniPCApp> = new Map();

  constructor() {
    this.initializeApps();
  }

  /**
   * Initialize available apps (Mini PC registry)
   */
  private initializeApps(): void {
    // Eru app definition
    this.apps.set('eru', {
      id: 'eru',
      name: 'Eru',
      tier: 'tier_50mb',
      description: 'AI Assistant Pod - Reasoning and task completion',
      spawning: async () => {
        // Spawn Eru pod
        console.log('Spawning Eru (tier_50mb)...');
      },
      actions: [
        {
          name: 'ask',
          description: 'Ask Eru a question',
          params: { query: 'string' },
          execute: async (params) => {
            return `Eru responded to: ${params?.query}`;
          },
        },
        {
          name: 'task',
          description: 'Give Eru a task to complete',
          params: { task: 'string' },
          execute: async (params) => {
            return `Eru executing: ${params?.task}`;
          },
        },
      ],
    });

    // Terminal app definition
    this.apps.set('terminal', {
      id: 'terminal',
      name: 'Terminal',
      tier: 'tier_250mb',
      description: 'Command execution pod',
      spawning: async () => {
        console.log('Spawning Terminal (tier_250mb)...');
      },
      actions: [
        {
          name: 'run',
          description: 'Run a command',
          params: { command: 'string' },
          execute: async (params) => {
            return `Terminal executed: ${params?.command}`;
          },
        },
      ],
    });

    // VSCode app definition
    this.apps.set('vscode', {
      id: 'vscode',
      name: 'VSCode',
      tier: 'tier_500mb',
      description: 'Code editor pod',
      spawning: async () => {
        console.log('Spawning VSCode (tier_500mb)...');
      },
      actions: [
        {
          name: 'open-file',
          description: 'Open a file in VSCode',
          params: { path: 'string' },
          execute: async (params) => {
            return `VSCode opened: ${params?.path}`;
          },
        },
      ],
    });
  }

  /**
   * Get app by ID
   */
  getApp(appId: string): MiniPCApp | undefined {
    return this.apps.get(appId);
  }

  /**
   * List all available apps
   */
  listApps(): MiniPCApp[] {
    return Array.from(this.apps.values());
  }

  /**
   * Spawn an app (activate it)
   */
  async spawnApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }
    await app.spawning();
    this.state.activeApps.push(app);
  }

  /**
   * Close an app (compress back to seed)
   */
  closeApp(appId: string): void {
    this.state.activeApps = this.state.activeApps.filter((a) => a.id !== appId);
  }

  /**
   * Execute an app action
   */
  async executeAction(
    appId: string,
    actionName: string,
    params?: Record<string, any>
  ): Promise<any> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App ${appId} not found`);

    const action = app.actions.find((a) => a.name === actionName);
    if (!action) throw new Error(`Action ${actionName} not found in ${appId}`);

    return await action.execute(params);
  }

  /**
   * Expand Mini PC (full screen)
   */
  expandMiniPC(): void {
    this.state.uiMode = 'full-screen';
  }

  /**
   * Collapse Mini PC (back to sidebar)
   */
  collapseMiniPC(): void {
    this.state.uiMode = 'collapsed';
  }

  /**
   * Get current Mini PC state
   */
  getState(): MiniPCState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get Mini PC status for Jackie's awareness
   */
  generateStatusForJackie(): string {
    const apps = this.listApps();
    const active = this.state.activeApps;

    return `
MINI PC STATUS
═════════════════════
Available Apps: ${apps.length}
${apps.map((a) => `  • ${a.name} (${a.tier})`).join('\n')}

Active Apps: ${active.length}
${active.map((a) => `  ✓ ${a.name}`).join('\n')}

UI Mode: ${this.state.uiMode}
Global Mode: ${this.state.globalModeActive ? '🔴 ON' : '🟢 OFF'}
    `;
  }
}
