/**
 * Jackie's Toolbox — Compressed Tool Management System
 * Tools are stored as 40KB seeds, decompressed on-demand
 */

export interface CompressedTool {
  id: string;
  name: string;
  description: string;
  seedSize: string; // e.g., "40 KB"
  expandedSize: string; // e.g., "500 MB"
  category: 'app' | 'module' | 'utility' | 'firmware';
  decompressionTime: string; // e.g., "1-2 seconds"
  dependencies: string[];
  status: 'dormant' | 'cached' | 'active';
  lastUsed?: Date;
}

export interface ToolboxConfig {
  maxCachedTools: number; // How many decompressed tools to keep in memory
  autoDecompressOnUse: boolean; // Auto-decompress when accessed
  compressionRatio: number; // 10:1, 15:1, etc.
}

/**
 * Jackie's Toolbox Manager
 * Compresses tools to seeds, decompresses on-demand
 */
export class JackieToolbox {
  private tools: Map<string, CompressedTool> = new Map();
  private cache: Map<string, any> = new Map();
  private config: ToolboxConfig;

  constructor(config: Partial<ToolboxConfig> = {}) {
    this.config = {
      maxCachedTools: config.maxCachedTools ?? 5,
      autoDecompressOnUse: config.autoDecompressOnUse ?? true,
      compressionRatio: config.compressionRatio ?? 12,
    };

    this.initializeToolbox();
  }

  /**
   * Initialize with default tools
   */
  private initializeToolbox(): void {
    // Mini PC as a compressed tool
    this.tools.set('mini-pc', {
      id: 'mini-pc',
      name: 'Mini PC',
      description: 'App launcher & orchestrator (Eru, Terminal, VSCode, Settings)',
      seedSize: '40 KB',
      expandedSize: '250 MB',
      category: 'app',
      decompressionTime: '500ms',
      dependencies: [],
      status: 'dormant',
    });

    // Eru as a compressed tool
    this.tools.set('eru', {
      id: 'eru',
      name: 'Eru',
      description: 'AI Assistant Pod (Reasoning, Coding, Documentation, Analysis)',
      seedSize: '40 KB',
      expandedSize: '50 MB',
      category: 'app',
      decompressionTime: '1-2 seconds',
      dependencies: ['mini-pc'],
      status: 'dormant',
    });

    // Flipper Zero Firmware Manager as a compressed tool
    this.tools.set('flipper-zero', {
      id: 'flipper-zero',
      name: 'Flipper Zero Firmware Manager',
      description: 'Download, manage, and flash Flipper Zero firmware & apps',
      seedSize: '40 KB',
      expandedSize: '2 GB',
      category: 'firmware',
      decompressionTime: '5-10 seconds',
      dependencies: [],
      status: 'dormant',
    });

    // Pod System module
    this.tools.set('pod-system', {
      id: 'pod-system',
      name: 'Pod System',
      description: 'Infinite-scalable pod orchestration (1TB→100TB+)',
      seedSize: '40 KB',
      expandedSize: '1.5 GB',
      category: 'module',
      decompressionTime: '2-3 seconds',
      dependencies: [],
      status: 'dormant',
    });

    // Terminal as a compressed tool
    this.tools.set('terminal', {
      id: 'terminal',
      name: 'Terminal',
      description: 'Command execution pod',
      seedSize: '40 KB',
      expandedSize: '250 MB',
      category: 'app',
      decompressionTime: '500ms',
      dependencies: ['mini-pc'],
      status: 'dormant',
    });
  }

  /**
   * List all tools in toolbox
   */
  listTools(): CompressedTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by ID
   */
  getTool(toolId: string): CompressedTool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(
    category: 'app' | 'module' | 'utility' | 'firmware'
  ): CompressedTool[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  /**
   * Decompress a tool (activate it)
   */
  async decompressTool(toolId: string): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found in toolbox`);
    }

    // Check if already cached
    if (this.cache.has(toolId)) {
      tool.status = 'cached';
      tool.lastUsed = new Date();
      return this.cache.get(toolId);
    }

    // Simulate decompression
    console.log(`Decompressing ${tool.name} from seed...`);
    tool.status = 'active';
    tool.lastUsed = new Date();

    // Simulate tool data
    const toolData = {
      id: toolId,
      name: tool.name,
      ready: true,
      timestamp: new Date().toISOString(),
    };

    // Cache it
    this.cache.set(toolId, toolData);

    // Evict oldest if cache is full
    if (this.cache.size > this.config.maxCachedTools) {
      const oldest = Array.from(this.tools.values())
        .filter((t) => t.status === 'cached')
        .sort((a, b) => {
          const aTime = a.lastUsed?.getTime() || 0;
          const bTime = b.lastUsed?.getTime() || 0;
          return aTime - bTime;
        })[0];

      if (oldest) {
        this.cache.delete(oldest.id);
        oldest.status = 'dormant';
      }
    }

    return toolData;
  }

  /**
   * Compress a tool (deactivate it, return to seed)
   */
  compressTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      this.cache.delete(toolId);
      tool.status = 'dormant';
    }
  }

  /**
   * Add a custom tool to the toolbox
   */
  addTool(tool: CompressedTool): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Remove a tool from the toolbox
   */
  removeTool(toolId: string): void {
    this.tools.delete(toolId);
    this.cache.delete(toolId);
  }

  /**
   * Get toolbox status for Jackie
   */
  generateStatusForJackie(): string {
    const total = this.tools.size;
    const active = Array.from(this.tools.values()).filter((t) => t.status === 'active').length;
    const cached = Array.from(this.tools.values()).filter((t) => t.status === 'cached').length;
    const dormant = total - active - cached;

    const totalSeedSize = total * 40; // Each seed ~40KB
    const totalStorageUsage = Array.from(this.tools.values())
      .filter((t) => t.status !== 'dormant')
      .reduce((sum, t) => {
        const size = parseFloat(t.expandedSize.split(' ')[0]);
        return sum + size;
      }, 0);

    return `
JACKIE'S TOOLBOX
═════════════════════
Total Tools: ${total}
  🟢 Active: ${active}
  🟡 Cached: ${cached}
  ⚪ Dormant: ${dormant}

Seed Storage: ~${totalSeedSize} KB (zero bytes used)
Active Storage: ${totalStorageUsage.toFixed(2)} MB

Tools:
${Array.from(this.tools.values())
  .map(
    (t) =>
      `  ${t.status === 'active' ? '▶' : t.status === 'cached' ? '◆' : '◯'} ${t.name} (${t.seedSize}/${t.expandedSize})`
  )
  .join('\n')}

Available for decompression: Type "decompress [tool-name]" to activate
    `;
  }
}
