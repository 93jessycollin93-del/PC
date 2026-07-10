/**
 * Offline Model Fallback Orchestrator
 * Graceful degradation when cloud providers fail — routes to local Ollama or cheaper alternatives
 */

import { modelRouter, type ModelProvider } from './modelRouter';
import { bus } from './bus';

export interface ProviderHealth {
  provider: ModelProvider | 'ollama';
  ok: boolean;
  lastCheck: number;
  detail?: string;
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_CACHE_TTL = 60000; // 1 minute

class FallbackOrchestrator {
  private healthCache: Map<ModelProvider | 'ollama', ProviderHealth> = new Map();
  private lastFullCheck = 0;
  private checkInProgress = false;

  constructor() {
    this.initializeHealthCache();
    this.startHealthCheckLoop();
  }

  private initializeHealthCache(): void {
    const providers: (ModelProvider | 'ollama')[] = ['groq', 'gemini', 'deepseek', 'anthropic', 'grok', 'ollama'];
    providers.forEach(p => {
      this.healthCache.set(p, {
        provider: p,
        ok: true, // optimistic initial state
        lastCheck: Date.now(),
      });
    });
  }

  private startHealthCheckLoop(): void {
    // Run health checks periodically in the background
    const interval = setInterval(() => {
      this.checkProviderHealth().catch(e => {
        console.error('[FallbackOrchestrator] Health check error:', e);
      });
    }, HEALTH_CHECK_INTERVAL);

    // Cleanup on unload if needed
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => clearInterval(interval));
    }
  }

  /**
   * Check health of all cloud providers via the backend endpoint
   */
  private async checkProviderHealth(): Promise<void> {
    if (this.checkInProgress) return;
    this.checkInProgress = true;

    try {
      // Check if backends are cached and still valid
      const now = Date.now();
      if (now - this.lastFullCheck < HEALTH_CACHE_TTL) {
        return;
      }

      const apiKeys: Record<string, string> = {};
      // Load API keys from localStorage if available
      ['groq_api_key', 'deepseek_api_key', 'anthropic_api_key', 'grok_api_key'].forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          apiKeys[key.replace('_api_key', '')] = value;
        }
      });

      const response = await fetch('/api/health/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: apiKeys }),
      });

      if (!response.ok) {
        // Backend is down, assume all providers are down
        this.markAllProvidersDown('Backend unreachable');
        return;
      }

      const results = await response.json() as Record<string, { ok: boolean; detail?: string }>;

      // Update cache with results
      Object.entries(results).forEach(([provider, status]) => {
        const p = provider as ModelProvider;
        this.healthCache.set(p, {
          provider: p,
          ok: status.ok,
          lastCheck: Date.now(),
          detail: status.detail,
        });

        // Notify if status changed
        if (status.ok) {
          console.log(`[FallbackOrchestrator] ${p} is UP`);
        } else {
          console.log(`[FallbackOrchestrator] ${p} is DOWN: ${status.detail}`);
          bus.emit('jackie-notification', {
            level: 'warning',
            title: `Provider ${p} offline`,
            message: status.detail || 'API unreachable. Using fallback.',
            source: 'fallback-orchestrator',
          });
        }
      });

      this.lastFullCheck = Date.now();
    } finally {
      this.checkInProgress = false;
    }
  }

  private markAllProvidersDown(reason: string): void {
    const providers: ModelProvider[] = ['groq', 'gemini', 'deepseek', 'anthropic', 'grok'];
    providers.forEach(p => {
      this.healthCache.set(p, {
        provider: p,
        ok: false,
        lastCheck: Date.now(),
        detail: reason,
      });
    });
  }

  /**
   * Check if a specific provider is healthy (or assume ok if not yet checked)
   */
  public isProviderHealthy(provider: ModelProvider | 'ollama'): boolean {
    const health = this.healthCache.get(provider);
    return health?.ok ?? true; // optimistic default
  }

  /**
   * Get the best available fallback provider for a given primary provider
   * Returns the provider to use, or null if none available
   */
  public getFallback(primaryProvider: ModelProvider): ModelProvider | 'ollama' | null {
    // Check if primary is healthy
    if (this.isProviderHealthy(primaryProvider)) {
      return primaryProvider;
    }

    console.log(`[FallbackOrchestrator] Primary provider ${primaryProvider} is down, selecting fallback`);

    // Free providers in order of preference
    const freeProviders: ModelProvider[] = ['groq', 'gemini'];
    for (const p of freeProviders) {
      if (this.isProviderHealthy(p)) {
        console.log(`[FallbackOrchestrator] Falling back to ${p}`);
        return p;
      }
    }

    // Cheap providers
    const cheapProviders: ModelProvider[] = ['deepseek'];
    for (const p of cheapProviders) {
      if (this.isProviderHealthy(p)) {
        console.log(`[FallbackOrchestrator] Falling back to cheap provider ${p}`);
        return p;
      }
    }

    // Last resort: local Ollama (if configured)
    if (this.isProviderHealthy('ollama')) {
      console.log(`[FallbackOrchestrator] All cloud providers down, falling back to local Ollama`);
      return 'ollama';
    }

    // Everything is down
    console.error(`[FallbackOrchestrator] All providers are down!`);
    return null;
  }

  /**
   * Get current health status of all providers
   */
  public getAllHealth(): ProviderHealth[] {
    return Array.from(this.healthCache.values());
  }

  /**
   * Get health for a specific provider
   */
  public getHealth(provider: ModelProvider | 'ollama'): ProviderHealth | undefined {
    return this.healthCache.get(provider);
  }

  /**
   * Force an immediate health check
   */
  public async forceHealthCheck(): Promise<void> {
    this.lastFullCheck = 0; // Reset cache TTL
    await this.checkProviderHealth();
  }

  /**
   * Mark a provider as down manually (e.g., after a failed request)
   */
  public markProviderDown(provider: ModelProvider, reason: string): void {
    this.healthCache.set(provider, {
      provider,
      ok: false,
      lastCheck: Date.now(),
      detail: reason,
    });
    console.warn(`[FallbackOrchestrator] Marked ${provider} as DOWN: ${reason}`);
    bus.emit('jackie-notification', {
      level: 'warning',
      title: `Provider ${provider} failed`,
      message: reason,
      source: 'fallback-orchestrator',
    });
  }

  /**
   * Mark a provider as up (recovery signal)
   */
  public markProviderUp(provider: ModelProvider): void {
    this.healthCache.set(provider, {
      provider,
      ok: true,
      lastCheck: Date.now(),
    });
    console.log(`[FallbackOrchestrator] Recovered ${provider}`);
    bus.emit('jackie-notification', {
      level: 'success',
      title: `Provider ${provider} recovered`,
      message: 'Service is back online.',
      source: 'fallback-orchestrator',
    });
  }
}

export const fallbackOrchestrator = new FallbackOrchestrator();
