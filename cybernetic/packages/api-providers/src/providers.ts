/**
 * LLM Provider configurations
 * Free-tier + paid providers for fallback routing
 */

import { LLMProvider } from "./types";

export const providers: Record<string, LLMProvider> = {
  // ===== LOCAL =====
  ollama: {
    name: "Ollama",
    baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434",
    models: ["llama2", "mistral", "neural-chat", "dolphin-mixtral"],
    isLocal: true,
    isActive: true,
    rateLimit: { requestsPerMinute: 1000 }, // unlimited locally
  },

  // ===== FREE TIER (No credit card) =====
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    models: [
      "llama-3.1-405b-reasoning",
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma-7b-it",
    ],
    isActive: !!process.env.GROQ_API_KEY,
    rateLimit: { requestsPerMinute: 30, tokensPerDay: 14400000 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free tier
  },

  mistral: {
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    apiKey: process.env.MISTRAL_API_KEY,
    models: [
      "mistral-medium-3.5",
      "mistral-small-4",
      "mistral-large-3",
      "mistral-nemo-12b",
      "codestral",
    ],
    isActive: !!process.env.MISTRAL_API_KEY,
    rateLimit: { requestsPerMinute: 60, tokensPerDay: 1000000000 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free experiment plan
  },

  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: process.env.GOOGLE_API_KEY,
    models: [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ],
    isActive: !!process.env.GOOGLE_API_KEY,
    rateLimit: { requestsPerMinute: 15, tokensPerDay: 1500000 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free tier
  },

  cerebras: {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    apiKey: process.env.CEREBRAS_API_KEY,
    models: ["gpt-oss-120b", "zai-glm-4.7"],
    isActive: !!process.env.CEREBRAS_API_KEY,
    rateLimit: { requestsPerMinute: 30, tokensPerDay: 1000000 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free tier
  },

  cohere: {
    name: "Cohere",
    baseUrl: "https://api.cohere.com/v2",
    apiKey: process.env.COHERE_API_KEY,
    models: ["command-a-plus", "command-a", "command-r-plus", "command-r"],
    isActive: !!process.env.COHERE_API_KEY,
    rateLimit: { requestsPerMinute: 20 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free trial
  },

  githubModels: {
    name: "GitHub Models",
    baseUrl: "https://models.github.ai/inference",
    apiKey: process.env.GITHUB_TOKEN,
    models: ["gpt-4o", "gpt-4-turbo", "llama-3.1-70b", "mistral-small", "o1-mini"],
    isActive: !!process.env.GITHUB_TOKEN,
    rateLimit: { requestsPerMinute: 10 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free prototyping
  },

  cloudflareAI: {
    name: "Cloudflare Workers AI",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts",
    apiKey: process.env.CLOUDFLARE_API_KEY,
    models: [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-4-scout-17b-16e-instruct",
      "@cf/mistralai/mistral-small-3.1-24b-instruct",
      "@cf/google/gemma-4-26b-a4b-it",
    ],
    isActive: !!process.env.CLOUDFLARE_API_KEY,
    rateLimit: { requestsPerMinute: 100 },
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 }, // Free tier
  },

  // ===== PAID (Fallback if free tiers exhausted) =====
  anthropic: {
    name: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com",
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: ["claude-opus-4", "claude-sonnet-4", "claude-haiku-3"],
    isActive: !!process.env.ANTHROPIC_API_KEY,
    rateLimit: { requestsPerMinute: 50 },
    cost: { inputPerMillionTokens: 3, outputPerMillionTokens: 15 }, // Pay per token
  },

  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    models: ["gpt-4-turbo", "gpt-4o", "gpt-4o-mini"],
    isActive: !!process.env.OPENAI_API_KEY,
    rateLimit: { requestsPerMinute: 90 },
    cost: { inputPerMillionTokens: 5, outputPerMillionTokens: 15 },
  },

  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    models: [
      "openai/gpt-4-turbo",
      "meta-llama/llama-3.1-70b",
      "mistralai/mistral-large",
      "cohere/command-r-plus",
    ],
    isActive: !!process.env.OPENROUTER_API_KEY,
    rateLimit: { requestsPerMinute: 60 },
    cost: { inputPerMillionTokens: 1.5, outputPerMillionTokens: 3 }, // Varies by model
  },
};

/**
 * Default fallback order
 * Try free tiers first, then paid, then local as last resort
 */
export const defaultFallbackOrder: string[] = [
  // Local first (no cost, no rate limits for development)
  "ollama",

  // Free tier APIs (priority by speed/quality)
  "groq", // Ultra-fast
  "mistral", // Fast + flexible
  "cerebras", // Very fast
  "gemini", // High quality
  "githubModels", // High quality
  "cohere", // Stable
  "cloudflareAI", // Redundancy

  // Paid APIs (only if all free tiers exhausted)
  "anthropic",
  "openrouter",
  "openai",
];

/**
 * Get active providers for a given model type
 */
export function getProvidersForModel(modelPattern: string): LLMProvider[] {
  return Object.values(providers)
    .filter((p) => p.isActive)
    .filter((p) =>
      p.models.some((m) => m.toLowerCase().includes(modelPattern.toLowerCase()))
    );
}

/**
 * Get provider by name
 */
export function getProvider(name: string): LLMProvider | undefined {
  return providers[name.toLowerCase()];
}
