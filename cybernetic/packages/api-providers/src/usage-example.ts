/**
 * Example: Using the LLMRouter in the Orchestration System
 *
 * This shows how agents call the unified router for inference,
 * with automatic fallback, usage tracking, and cost optimization.
 */

import { LLMRouter } from "./router";
import { LLMRequest } from "./types";

export async function exampleAgentInference() {
  // Initialize router once at startup
  const router = new LLMRouter({
    maxRetries: 3,
    timeoutMs: 30000,
    trackUsage: true,
  });

  // Agent makes inference request without caring about provider
  const request: LLMRequest = {
    model: "mistral-7b", // Router will find matching provider
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant",
      },
      {
        role: "user",
        content: "Summarize the benefits of distributed systems",
      },
    ],
    temperature: 0.7,
    maxTokens: 500,
  };

  // Call with automatic fallback: ollama → groq → mistral → ... → anthropic
  const result = await router.inferWithFallback(request);

  if (result.success) {
    console.log(`✓ Inference completed via ${result.usedProvider}`);
    console.log(`Content: ${result.data?.content}`);
    console.log(`Tokens used: ${result.data?.tokensUsed}`);
    console.log(`Latency: ${result.data?.latencyMs}ms`);
    console.log(`Cost: $${result.data?.cost ?? 0}`);
  } else {
    console.error(`✗ Failed after ${result.triedProviders.length} providers`);
    console.error(`Error: ${result.error}`);
    console.error(`Tried: ${result.triedProviders.join(", ")}`);
  }
}

export async function exampleUsageTracking() {
  const router = new LLMRouter({ trackUsage: true });

  // Simulate multiple inferences
  for (let i = 0; i < 3; i++) {
    await router.inferWithFallback({
      model: "llama2",
      messages: [{ role: "user", content: `Query ${i + 1}` }],
    });
  }

  // View daily usage stats
  const stats = router.getUsageStats();
  let totalCost = 0;
  let totalTokens = 0;

  stats.forEach((stat, provider) => {
    console.log(`${provider}: ${stat.requestsToday} requests, ${stat.tokensUsedToday} tokens, $${stat.costToday.toFixed(4)}`);
    totalCost += stat.costToday;
    totalTokens += stat.tokensUsedToday;
  });

  console.log(`---`);
  console.log(`Total: ${totalTokens} tokens, $${totalCost.toFixed(4)}`);

  // Reset at end of day
  router.resetDailyStats();
}

export async function exampleHealthMonitoring() {
  const router = new LLMRouter();

  // Check health of all providers
  const status = await router.getProviderStatus();

  console.log("Provider Health Status:");
  status.forEach((stat, provider) => {
    const statusIcon =
      stat.status === "available"
        ? "✓"
        : stat.status === "rate_limited"
          ? "⚠"
          : "✗";
    console.log(`${statusIcon} ${provider}: ${stat.status}`);
  });
}

export async function exampleEconomyMode() {
  // For cost-sensitive deployments, prioritize free/local providers
  const router = new LLMRouter({
    trackUsage: true,
    timeoutMs: 20000, // Shorter timeout for fast providers
  });

  const request: LLMRequest = {
    model: "llama2",
    messages: [
      {
        role: "user",
        content: "Explain quantum computing in simple terms",
      },
    ],
  };

  // Will try: ollama (local, $0) → groq (free) → mistral (free) → ... → paid
  const result = await router.inferWithFallback(request);

  if (result.success) {
    console.log(`Used provider: ${result.usedProvider} (cost: $${result.data?.cost ?? 0})`);
  }
}
