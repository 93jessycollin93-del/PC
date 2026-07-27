import axios, { AxiosError } from "axios";
import { LLMRequest, LLMResponse, ProviderUsageStats, RouterConfig, InferenceResult } from "./types";
import { providers, defaultFallbackOrder } from "./providers";

export class LLMRouter {
  private config: RouterConfig;
  private usageStats: Map<string, ProviderUsageStats> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  private healthCheckIntervalMs = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<RouterConfig>) {
    this.config = {
      providers: Object.values(providers),
      fallbackOrder: defaultFallbackOrder,
      maxRetries: config?.maxRetries ?? 3,
      timeoutMs: config?.timeoutMs ?? 30000,
      trackUsage: config?.trackUsage ?? true,
    };

    this.initializeUsageStats();
  }

  private initializeUsageStats(): void {
    this.config.fallbackOrder.forEach((providerName) => {
      this.usageStats.set(providerName, {
        provider: providerName,
        requestsToday: 0,
        tokensUsedToday: 0,
        costToday: 0,
        status: "available",
      });
    });
  }

  async inferWithFallback(request: LLMRequest): Promise<InferenceResult> {
    const triedProviders: string[] = [];
    let lastError: Error | null = null;

    for (const providerName of this.config.fallbackOrder) {
      const provider = providers[providerName];
      if (!provider || !provider.isActive) {
        continue;
      }

      // Check rate limits
      const stats = this.usageStats.get(providerName);
      if (stats && stats.status === "rate_limited") {
        continue;
      }

      triedProviders.push(providerName);

      try {
        const result = await this.callProvider(providerName, provider, request);

        if (this.config.trackUsage) {
          this.trackUsage(providerName, request, result);
        }

        return {
          success: true,
          data: result,
          triedProviders,
          usedProvider: providerName,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error
        if (error instanceof AxiosError && error.response?.status === 429) {
          const stats = this.usageStats.get(providerName);
          if (stats) {
            stats.status = "rate_limited";
          }
        }

        continue;
      }
    }

    return {
      success: false,
      error: lastError?.message ?? "All providers exhausted",
      triedProviders,
      usedProvider: "",
    };
  }

  private async callProvider(
    providerName: string,
    provider: any,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    switch (providerName) {
      case "ollama":
        return this.callOllama(provider, request, startTime);
      case "groq":
        return this.callGroq(provider, request, startTime);
      case "mistral":
        return this.callMistral(provider, request, startTime);
      case "gemini":
        return this.callGemini(provider, request, startTime);
      case "cerebras":
        return this.callCerebras(provider, request, startTime);
      case "cohere":
        return this.callCohere(provider, request, startTime);
      case "githubModels":
        return this.callGitHubModels(provider, request, startTime);
      case "cloudflareAI":
        return this.callCloudflareAI(provider, request, startTime);
      case "anthropic":
        return this.callAnthropic(provider, request, startTime);
      case "openai":
        return this.callOpenAI(provider, request, startTime);
      case "openrouter":
        return this.callOpenRouter(provider, request, startTime);
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  private async callOllama(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/api/generate`,
      {
        model: request.model,
        prompt: request.messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
        stream: false,
        temperature: request.temperature ?? 0.7,
      },
      { timeout: this.config.timeoutMs }
    );

    const content = response.data.response;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "ollama",
      tokensUsed: response.data.prompt_eval_count + response.data.eval_count || 0,
      latencyMs,
    };
  }

  private async callGroq(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.choices[0].message.content;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "groq",
      tokensUsed:
        response.data.usage.prompt_tokens + response.data.usage.completion_tokens || 0,
      latencyMs,
    };
  }

  private async callMistral(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.choices[0].message.content;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "mistral",
      tokensUsed:
        response.data.usage.prompt_tokens + response.data.usage.completion_tokens || 0,
      latencyMs,
    };
  }

  private async callGemini(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/models/${request.model}:generateContent`,
      {
        contents: request.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 2048,
          topP: request.topP ?? 0.95,
        },
      },
      {
        params: { key: provider.apiKey },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    const latencyMs = Date.now() - startTime;
    const usageData = response.data.usageMetadata;

    return {
      content,
      model: request.model,
      provider: "gemini",
      tokensUsed: (usageData?.promptTokenCount ?? 0) + (usageData?.candidatesTokenCount ?? 0),
      latencyMs,
    };
  }

  private async callCerebras(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.choices[0].message.content;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "cerebras",
      tokensUsed:
        response.data.usage.prompt_tokens + response.data.usage.completion_tokens || 0,
      latencyMs,
    };
  }

  private async callCohere(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat`,
      {
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.text;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "cohere",
      tokensUsed: (response.data.usage?.input_tokens ?? 0) + (response.data.usage?.output_tokens ?? 0),
      latencyMs,
    };
  }

  private async callGitHubModels(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.choices[0].message.content;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "githubModels",
      tokensUsed:
        response.data.usage.prompt_tokens + response.data.usage.completion_tokens || 0,
      latencyMs,
    };
  }

  private async callCloudflareAI(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID not set");
    }

    const response = await axios.post(
      `${provider.baseUrl}/${accountId}/ai/run/${request.model}`,
      {
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.result?.response ?? response.data.result;
    const latencyMs = Date.now() - startTime;

    return {
      content: String(content),
      model: request.model,
      provider: "cloudflareAI",
      tokensUsed: 0, // Cloudflare doesn't provide token counts
      latencyMs,
    };
  }

  private async callAnthropic(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/messages`,
      {
        model: request.model,
        max_tokens: request.maxTokens ?? 2048,
        messages: request.messages.map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
      },
      {
        headers: { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.content[0].text;
    const latencyMs = Date.now() - startTime;
    const cost = this.calculateAnthropicCost(
      request.model,
      response.data.usage.input_tokens,
      response.data.usage.output_tokens
    );

    return {
      content,
      model: request.model,
      provider: "anthropic",
      tokensUsed: response.data.usage.input_tokens + response.data.usage.output_tokens,
      cost,
      latencyMs,
    };
  }

  private async callOpenAI(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        top_p: request.topP ?? 1,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.choices[0].message.content;
    const latencyMs = Date.now() - startTime;
    const cost = this.calculateOpenAICost(
      request.model,
      response.data.usage.prompt_tokens,
      response.data.usage.completion_tokens
    );

    return {
      content,
      model: request.model,
      provider: "openai",
      tokensUsed: response.data.usage.prompt_tokens + response.data.usage.completion_tokens,
      cost,
      latencyMs,
    };
  }

  private async callOpenRouter(
    provider: any,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        timeout: this.config.timeoutMs,
      }
    );

    const content = response.data.choices[0].message.content;
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: request.model,
      provider: "openrouter",
      tokensUsed: response.data.usage.prompt_tokens + response.data.usage.completion_tokens || 0,
      latencyMs,
    };
  }

  private calculateAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, [number, number]> = {
      "claude-opus-4": [0.015, 0.075],
      "claude-sonnet-4": [0.003, 0.015],
      "claude-haiku-3": [0.00025, 0.00125],
    };

    const [inputCost, outputCost] = costs[model] ?? [0.003, 0.015];
    return (inputTokens * inputCost + outputTokens * outputCost) / 1000000;
  }

  private calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, [number, number]> = {
      "gpt-4-turbo": [0.01, 0.03],
      "gpt-4o": [0.005, 0.015],
      "gpt-4o-mini": [0.00015, 0.0006],
    };

    const [inputCost, outputCost] = costs[model] ?? [0.01, 0.03];
    return (inputTokens * inputCost + outputTokens * outputCost) / 1000000;
  }

  private trackUsage(
    providerName: string,
    request: LLMRequest,
    response: LLMResponse
  ): void {
    const stats = this.usageStats.get(providerName);
    if (!stats) return;

    stats.requestsToday += 1;
    stats.tokensUsedToday += response.tokensUsed;
    stats.costToday += response.cost ?? 0;
    stats.lastRequestAt = new Date();
  }

  async getProviderStatus(): Promise<Map<string, ProviderUsageStats>> {
    const now = Date.now();

    for (const [providerName, lastCheck] of this.lastHealthCheck) {
      if (now - lastCheck > this.healthCheckIntervalMs) {
        await this.healthCheckProvider(providerName);
      }
    }

    return this.usageStats;
  }

  private async healthCheckProvider(providerName: string): Promise<void> {
    const provider = providers[providerName];
    if (!provider) return;

    const stats = this.usageStats.get(providerName);
    if (!stats) return;

    try {
      // Simple health check: try to call with minimal request
      const testRequest: LLMRequest = {
        model: provider.models[0],
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 10,
      };

      const result = await Promise.race([
        this.callProvider(providerName, provider, testRequest),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Health check timeout")), 5000)
        ),
      ]);

      stats.status = "available";
    } catch (error) {
      const err = error as AxiosError;
      if (err.response?.status === 429) {
        stats.status = "rate_limited";
      } else {
        stats.status = "error";
      }
    }

    this.lastHealthCheck.set(providerName, Date.now());
  }

  getUsageStats(): Map<string, ProviderUsageStats> {
    return this.usageStats;
  }

  resetDailyStats(): void {
    this.usageStats.forEach((stats) => {
      stats.requestsToday = 0;
      stats.tokensUsedToday = 0;
      stats.costToday = 0;
    });
  }
}
