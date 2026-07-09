/**
 * Type definitions for LLM provider system
 */

export interface LLMProvider {
  name: string;
  baseUrl: string;
  models: string[];
  apiKey?: string;
  isLocal?: boolean;
  isActive: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerDay?: number;
  };
  cost?: {
    inputPerMillionTokens: number;
    outputPerMillionTokens: number;
  };
}

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: number;
  cost?: number;
  latencyMs: number;
}

export interface ProviderUsageStats {
  provider: string;
  requestsToday: number;
  tokensUsedToday: number;
  costToday: number;
  lastRequestAt?: Date;
  status: "available" | "rate_limited" | "error" | "inactive";
}

export interface RouterConfig {
  providers: LLMProvider[];
  fallbackOrder: string[]; // Order to try providers
  maxRetries: number;
  timeoutMs: number;
  trackUsage: boolean;
}

export interface InferenceResult {
  success: boolean;
  data?: LLMResponse;
  error?: string;
  triedProviders: string[];
  usedProvider: string;
}
