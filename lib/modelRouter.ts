/**
 * Intelligent AI Model Router
 * Routes queries to the most cost-effective capable provider
 * Priority: Groq (free) → Gemini (free tier) → DeepSeek (cheap) → Anthropic (fallback)
 */

export type ModelProvider = 'groq' | 'gemini' | 'deepseek' | 'anthropic';
export type ModelCapability = 'chat' | 'code' | 'analysis' | 'vision';

interface ModelConfig {
  provider: ModelProvider;
  model: string;
  capabilities: ModelCapability[];
  costPer1kTokens: number; // in USD
  speedRating: number; // 1-10
  maxTokens: number;
}

interface RoutingDecision {
  provider: ModelProvider;
  model: string;
  estimatedCost: number;
  reason: string;
}

interface APIKey {
  provider: ModelProvider;
  key: string;
  active: boolean;
}

// Model configurations
const MODEL_REGISTRY: Record<ModelProvider, ModelConfig[]> = {
  groq: [
    {
      provider: 'groq',
      model: 'mixtral-8x7b-32768',
      capabilities: ['chat', 'code', 'analysis'],
      costPer1kTokens: 0, // Free tier
      speedRating: 9,
      maxTokens: 32768,
    },
    {
      provider: 'groq',
      model: 'llama2-70b-4096',
      capabilities: ['chat', 'code', 'analysis'],
      costPer1kTokens: 0,
      speedRating: 8,
      maxTokens: 4096,
    },
  ],
  gemini: [
    {
      provider: 'gemini',
      model: 'gemini-pro',
      capabilities: ['chat', 'code', 'analysis'],
      costPer1kTokens: 0, // Free tier
      speedRating: 7,
      maxTokens: 32768,
    },
  ],
  deepseek: [
    {
      provider: 'deepseek',
      model: 'deepseek-chat',
      capabilities: ['chat', 'code', 'analysis'],
      costPer1kTokens: 0.0007, // Cheap
      speedRating: 8,
      maxTokens: 4096,
    },
  ],
  anthropic: [
    {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      capabilities: ['chat', 'code', 'analysis'],
      costPer1kTokens: 0.00025,
      speedRating: 6,
      maxTokens: 200000,
    },
  ],
};

class ModelRouter {
  private apiKeys: Map<ModelProvider, string> = new Map();
  private costTracker: Map<string, number> = new Map(); // task_id -> cost
  private usageStats: Map<ModelProvider, { calls: number; totalTokens: number; totalCost: number }> = new Map();

  constructor() {
    this.loadAPIKeys();
    this.initializeStats();
  }

  private loadAPIKeys(): void {
    // Load from localStorage (settings)
    const savedKeys = localStorage.getItem('model_router_keys');
    if (savedKeys) {
      try {
        const keys = JSON.parse(savedKeys) as APIKey[];
        keys.forEach(k => {
          if (k.active) {
            this.apiKeys.set(k.provider, k.key);
          }
        });
      } catch (e) {
        console.error('Failed to load API keys:', e);
      }
    }
  }

  private initializeStats(): void {
    Object.keys(MODEL_REGISTRY).forEach(provider => {
      this.usageStats.set(provider as ModelProvider, { calls: 0, totalTokens: 0, totalCost: 0 });
    });
  }

  /**
   * Route a query to the best available model
   */
  public route(
    query: string,
    capabilities: ModelCapability[] = ['chat'],
    maxTokens = 2000,
    taskId?: string
  ): RoutingDecision {
    // Find all compatible models
    const compatible: ModelConfig[] = [];
    Object.values(MODEL_REGISTRY).forEach(models => {
      models.forEach(m => {
        const hasRequiredCapabilities = capabilities.every(cap => m.capabilities.includes(cap));
        if (hasRequiredCapabilities && m.maxTokens >= maxTokens) {
          compatible.push(m);
        }
      });
    });

    if (compatible.length === 0) {
      throw new Error(`No model available for capabilities: ${capabilities.join(', ')}`);
    }

    // Sort by: (1) API key available, (2) cost, (3) speed
    const scored = compatible
      .map(model => {
        const hasKey = this.apiKeys.has(model.provider);
        const estimatedCost = (maxTokens / 1000) * model.costPer1kTokens;
        const score = hasKey ? 100 : -100; // API key availability is critical
        const costScore = -estimatedCost * 1000; // Prefer cheaper
        const speedScore = model.speedRating * 5; // Prefer faster
        return { model, score: score + costScore + speedScore, estimatedCost };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const reason = this.apiKeys.has(best.model.provider)
      ? `Using ${best.model.provider}/${best.model.model} (free tier, speed: ${best.model.speedRating}/10)`
      : `${best.model.provider} selected but no API key configured`;

    if (taskId) {
      this.costTracker.set(taskId, best.estimatedCost);
    }

    return {
      provider: best.model.provider,
      model: best.model.model,
      estimatedCost: best.estimatedCost,
      reason,
    };
  }

  /**
   * Record actual usage (called after API response)
   */
  public recordUsage(provider: ModelProvider, tokensUsed: number, actualCost: number): void {
    const stats = this.usageStats.get(provider);
    if (stats) {
      stats.calls++;
      stats.totalTokens += tokensUsed;
      stats.totalCost += actualCost;
      this.usageStats.set(provider, stats);
      localStorage.setItem('model_router_stats', JSON.stringify(Array.from(this.usageStats.entries())));
    }
  }

  /**
   * Get cost for a completed task
   */
  public getTaskCost(taskId: string): number {
    return this.costTracker.get(taskId) || 0;
  }

  /**
   * Get usage statistics
   */
  public getStats(): Record<ModelProvider, { calls: number; totalTokens: number; totalCost: number }> {
    const result: Record<ModelProvider, any> = {};
    this.usageStats.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }

  /**
   * Set API key for a provider
   */
  public setAPIKey(provider: ModelProvider, key: string): void {
    if (key) {
      this.apiKeys.set(provider, key);
      this.persistAPIKeys();
    }
  }

  /**
   * Get all configured API keys (masked)
   */
  public getConfiguredProviders(): { provider: ModelProvider; hasKey: boolean }[] {
    return Object.keys(MODEL_REGISTRY).map(p => ({
      provider: p as ModelProvider,
      hasKey: this.apiKeys.has(p as ModelProvider),
    }));
  }

  private persistAPIKeys(): void {
    const keys: APIKey[] = [];
    this.apiKeys.forEach((key, provider) => {
      keys.push({ provider, key, active: true });
    });
    localStorage.setItem('model_router_keys', JSON.stringify(keys));
  }
}

export const modelRouter = new ModelRouter();
