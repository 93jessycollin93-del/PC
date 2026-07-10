/**
 * Unified AI Client
 * Abstracts provider differences, handles streaming, errors, cost tracking
 */

import { modelRouter, ModelProvider } from './modelRouter';
import { permissions } from './permissions';
import { budgetGuardian } from './budgetGuardian';
import { fallbackOrchestrator } from './fallbackOrchestrator';

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
    const routing = modelRouter.route(messages.map(message => message.content).join('\n'), ['chat'], maxTokens, options.taskId);

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

    console.log(`[AIClient] Routing to ${routing.provider}/${routing.model}: ${routing.reason}`);

    // Build the full message list
    const allMessages: AIMessage[] = [];
    if (options.systemPrompt) {
      allMessages.push({ role: 'system', content: options.systemPrompt });
    }
    allMessages.push(...messages);

    try {
      let response: AIResponse;

      if (routing.provider === 'grok') {
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

      // Track budget spend
      budgetGuardian.recordSpend(scope, routing.provider, response.cost);

      // Mark provider as healthy (recovery)
      if (routing.provider !== 'ollama') {
        fallbackOrchestrator.markProviderUp(routing.provider as ModelProvider);
      }

      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AIClient] Error calling ${routing.provider}:`, errorMsg);

      // Mark provider as down for future requests
      if (routing.provider !== 'ollama') {
        fallbackOrchestrator.markProviderDown(routing.provider as ModelProvider, errorMsg);
      }

      // Try to get a fallback provider and retry
      if (routing.provider !== 'ollama') {
        const fallback = fallbackOrchestrator.getFallback(routing.provider as ModelProvider);
        if (fallback && fallback !== routing.provider) {
          console.log(`[AIClient] Attempting fallback to ${fallback}`);
          try {
            let fallbackResponse: AIResponse;

            if (fallback === 'ollama') {
              // Local Ollama fallback — return a safe degraded response
              return {
                content: '[Offline Mode] Cloud providers unavailable. Local Ollama not integrated for direct calls. Try again when cloud is available.',
                provider: 'groq', // Mark as groq (free alternative)
                model: 'offline-fallback',
                tokensUsed: 0,
                cost: 0,
                timestamp: Date.now(),
              };
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
    const apiKey = localStorage.getItem('grok_api_key');
    if (!apiKey) {
      throw new Error('Grok API key not configured');
    }

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
    const apiKey = localStorage.getItem('groq_api_key');
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

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
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

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
    const apiKey = localStorage.getItem('deepseek_api_key');
    if (!apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

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
    const apiKey = localStorage.getItem('anthropic_api_key');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

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
