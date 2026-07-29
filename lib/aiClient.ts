/**
 * Unified AI Client
 * Abstracts provider differences, handles streaming, errors, cost tracking
 */

import { modelRouter, ModelProvider } from './modelRouter';
import { permissions } from './permissions';
import { budgetGuardian } from './budgetGuardian';
import { fallbackOrchestrator } from './fallbackOrchestrator';
import { secretsVault } from './secretsVault';
import { QuotaLedger, buildBriefing } from '../packages/predictive-router/src';
import { PC_PROVIDER_LIMITS } from './providerLimits';
import { askJackyForFallback } from './jackyFallback';

// This app's configured instance of the standalone package. The package
// ships no opinion about provider names or limits — PC_PROVIDER_LIMITS is
// where this specific app states what it knows.
const quotaLedger = new QuotaLedger({ limits: PC_PROVIDER_LIMITS });

/** Providers that cost money — gated behind the `spend` capability. */
const PAID_PROVIDERS: ModelProvider[] = ['grok', 'deepseek', 'anthropic'];

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: ModelProvider;
  model: string;
  tokensUsed: number;
  cost: number;
  timestamp: number;
}

class AIClient {
  /**
   * Retrieve an API key from vault (if initialized and unlocked) with fallback to localStorage
   */
  private async getApiKey(keyName: string): Promise<string> {
    if (secretsVault.isInitialized()) {
      const vaultKey = await secretsVault.getSecret(keyName, 'aiClient');
      if (vaultKey) return vaultKey;
    }
    const localStorageKey = localStorage.getItem(keyName);
    if (localStorageKey) return localStorageKey;
    throw new Error(`API key "${keyName}" not found in vault or localStorage`);
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(
    messages: AIMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      taskId?: string;
      /** App/agent identity used by the Permission Broker (defaults to 'system'). */
      scope?: string;
    } = {}
  ): Promise<AIResponse> {
    const maxTokens = options.maxTokens || 2000;
    const temperature = options.temperature || 0.7;
    const scope = options.scope || 'system';

    // Capability gate: is this app/agent allowed to call a model at all?
    if (!permissions.require(scope, 'model_access', 'aiClient.sendMessage')) {
      throw new Error(`Model access is disabled for "${scope}" in the Permission Broker.`);
    }

    // Route to best provider
    const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const routing = modelRouter.route(lastUserText, ['chat'], maxTokens, options.taskId);

    // Capability gate: block paid providers when spend is revoked for this scope.
    if (PAID_PROVIDERS.includes(routing.provider) && !permissions.require(scope, 'spend', routing.provider)) {
      throw new Error(`Paid provider "${routing.provider}" is blocked for "${scope}" (spend disabled).`);
    }

    // Budget gate: check if spending this estimated cost would exceed budget
    if (!budgetGuardian.canSpend(scope, routing.estimatedCost)) {
      throw new Error(`Budget limit would be exceeded for "${scope}" (estimated cost: $${routing.estimatedCost.toFixed(4)}). Current month spend: $${budgetGuardian.getCurrentSpend(scope).toFixed(2)}`);
    }

    // Budget gate: auto-stop if enabled and would exceed cap
    if (budgetGuardian.isAutoStopActive(scope, routing.estimatedCost)) {
      throw new Error(`Auto-stop active for "${scope}" — monthly budget exceeded.`);
    }

    // Predictive handoff. The catch block below is the REACTIVE path — it
    // only learns a provider is spent by failing a request first. quotaLedger
    // forecasts from the recent consumption rate, so this switches while
    // headroom still remains and the user never eats the failed call.
    let handoffBriefing: string | null = null;
    if ((routing.provider as string) !== 'ollama' &&
        quotaLedger.shouldPreemptivelySwitch(routing.provider as ModelProvider)) {
      // Cost tiers, mirroring fallbackOrchestrator.getFallback: spend nothing
      // if a free provider can take the work. Ranking purely by headroom would
      // hand off to a paid provider first, since "unlimited" always wins.
      const TIERS: ModelProvider[][] = [['groq', 'gemini'], ['deepseek'], ['anthropic', 'grok']];
      let target: ModelProvider | undefined;
      for (const tier of TIERS) {
        const healthy = tier.filter(p => p !== routing.provider && fallbackOrchestrator.isProviderHealthy(p));
        // Within a tier, the one with the most room to spare wins.
        // The package works over generic string providers; this is the
        // boundary where its result narrows back to PC's own provider type.
        const ranked = quotaLedger.nextInLine(routing.provider as ModelProvider, healthy)
          .filter(p => !quotaLedger.shouldPreemptivelySwitch(p)) as ModelProvider[];
        if (ranked.length) { target = ranked[0]; break; }
      }
      if (target) {
        // Tell the incoming model it is taking over and why, so it continues
        // the work rather than starting cold.
        handoffBriefing = buildBriefing({
          messages,
          fromProvider: routing.provider as ModelProvider,
          toProvider: target,
          reason: 'quota_approaching',
        });
        console.log(`[AIClient] Pre-emptive handoff ${routing.provider} -> ${target} (quota forecast)`);
        routing.provider = target;
        // Only the groq branch reads routing.model; keep it valid for the new
        // provider, using the same default the reactive fallback path uses.
        if (target === 'groq') routing.model = 'mixtral-8x7b-32768';
      }
    }

    console.log(`[AIClient] Routing to ${routing.provider}/${routing.model}: ${routing.reason}`);

    // Build the full message list
    const allMessages: AIMessage[] = [];
    if (options.systemPrompt) {
      allMessages.push({ role: 'system', content: options.systemPrompt });
    }
    if (handoffBriefing) {
      allMessages.push({ role: 'system', content: handoffBriefing });
    }
    allMessages.push(...messages);

    try {
      let response: AIResponse;

      if ((routing.provider as ModelProvider | 'ollama') === 'ollama') {
        // The local box as a PRIMARY route, not just a post-failure fallback.
        // Without this branch a local routing decision fell through to the
        // "Unknown provider" throw below, so local-first could never work
        // even once the router was able to choose it.
        response = await askJackyForFallback(lastUserText);
      } else if (routing.provider === 'grok') {
        response = await this.callGrok(allMessages, maxTokens, temperature);
      } else if (routing.provider === 'groq') {
        response = await this.callGroq(allMessages, maxTokens, temperature, routing.model);
      } else if (routing.provider === 'gemini') {
        response = await this.callGemini(allMessages, maxTokens, temperature);
      } else if (routing.provider === 'deepseek') {
        response = await this.callDeepSeek(allMessages, maxTokens, temperature);
      } else if (routing.provider === 'anthropic') {
        response = await this.callAnthropic(allMessages, maxTokens, temperature);
      } else {
        throw new Error(`Unknown provider: ${routing.provider}`);
      }

      // Track usage
      modelRouter.recordUsage(routing.provider, response.tokensUsed, response.cost);

      // Feed the forecast. Without this the predictive check above has no
      // consumption history to reason about and never fires.
      if ((routing.provider as string) !== 'ollama') {
        quotaLedger.record(routing.provider as ModelProvider, { tokens: response.tokensUsed });
      }

      // Track budget spend
      budgetGuardian.recordSpend(scope, routing.provider, response.cost);

      // Mark provider as healthy (recovery)
      if ((routing.provider as ModelProvider | 'ollama') !== 'ollama') {
        fallbackOrchestrator.markProviderUp(routing.provider as ModelProvider);
      }

      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AIClient] Error calling ${routing.provider}:`, errorMsg);

      // Mark provider as down for future requests. This now includes the local
      // box: since it can be the PRIMARY route, a local failure has to be
      // recorded, otherwise getFallback below sees it as healthy and hands the
      // same dead box straight back instead of cascading to the cloud. The
      // 30s checkJackyHealth loop restores it as soon as the box returns.
      fallbackOrchestrator.markProviderDown(routing.provider as ModelProvider, errorMsg);

      // Try to get a fallback provider and retry. "Local first, and if local
      // is not there, carry on" — being offline-preferred must never mean
      // being stranded when the box is down but the network is fine.
      {
        const fallback = fallbackOrchestrator.getFallback(routing.provider as ModelProvider);
        if (fallback && fallback !== routing.provider) {
          console.log(`[AIClient] Attempting fallback to ${fallback}`);
          try {
            let fallbackResponse: AIResponse;

            if (fallback === 'ollama') {
              // A real call through jackyClient to the user's own GPU box —
              // idea #05. Throws the same way every other branch here does
              // when it fails, so a jacky miss falls through to the
              // `throw error` at the bottom exactly like a failed cloud
              // fallback would, instead of always claiming success.
              fallbackResponse = await askJackyForFallback(lastUserText);
            } else if (fallback === 'grok') {
              fallbackResponse = await this.callGrok(allMessages, maxTokens, temperature);
            } else if (fallback === 'groq') {
              fallbackResponse = await this.callGroq(allMessages, maxTokens, temperature, 'mixtral-8x7b-32768');
            } else if (fallback === 'gemini') {
              fallbackResponse = await this.callGemini(allMessages, maxTokens, temperature);
            } else if (fallback === 'deepseek') {
              fallbackResponse = await this.callDeepSeek(allMessages, maxTokens, temperature);
            } else if (fallback === 'anthropic') {
              fallbackResponse = await this.callAnthropic(allMessages, maxTokens, temperature);
            } else {
              throw new Error(`Unknown fallback provider: ${fallback}`);
            }

            // Track fallback usage
            modelRouter.recordUsage(fallback as ModelProvider, fallbackResponse.tokensUsed, fallbackResponse.cost);
            budgetGuardian.recordSpend(scope, fallback as ModelProvider, fallbackResponse.cost);

            console.log(`[AIClient] Fallback to ${fallback} succeeded`);
            return fallbackResponse;
          } catch (fallbackError) {
            console.error(`[AIClient] Fallback to ${fallback} also failed:`, fallbackError);
          }
        }
      }

      throw error;
    }
  }

  private async callGrok(
    messages: AIMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    const apiKey = await this.getApiKey('grok_api_key');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Grok API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    const estimatedCost = (tokensUsed / 1000) * 0.0012;

    return {
      content,
      provider: 'grok',
      model: 'grok-2-1212',
      tokensUsed,
      cost: estimatedCost,
      timestamp: Date.now(),
    };
  }

  private async callGroq(
    messages: AIMessage[],
    maxTokens: number,
    temperature: number,
    model: string
  ): Promise<AIResponse> {
    const apiKey = await this.getApiKey('groq_api_key');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    return {
      content,
      provider: 'groq',
      model,
      tokensUsed,
      cost: 0, // Groq free tier
      timestamp: Date.now(),
    };
  }

  private async callGemini(
    messages: AIMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    const apiKey = await this.getApiKey('gemini_api_key');

    // Convert to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    return {
      content,
      provider: 'gemini',
      model: 'gemini-pro',
      tokensUsed,
      cost: 0, // Gemini free tier
      timestamp: Date.now(),
    };
  }

  private async callDeepSeek(
    messages: AIMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    const apiKey = await this.getApiKey('deepseek_api_key');

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DeepSeek API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    const estimatedCost = (tokensUsed / 1000) * 0.0007;

    return {
      content,
      provider: 'deepseek',
      model: 'deepseek-chat',
      tokensUsed,
      cost: estimatedCost,
      timestamp: Date.now(),
    };
  }

  private async callAnthropic(
    messages: AIMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    const apiKey = await this.getApiKey('anthropic_api_key');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        temperature,
        system: messages.find(m => m.role === 'system')?.content,
        messages: messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role,
            content: m.content,
          })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    const estimatedCost = (tokensUsed / 1000) * 0.00025;

    return {
      content,
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      tokensUsed,
      cost: estimatedCost,
      timestamp: Date.now(),
    };
  }
}

export const aiClient = new AIClient();
