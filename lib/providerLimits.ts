/**
 * This PC's declared rate limits for @offgrid/predictive-router.
 *
 * The package itself ships no opinion about any provider's numbers — a
 * router library that hardcodes "Groq allows 30 requests/min" stops being a
 * library the moment that changes. This is where Jackie's PC states what it
 * actually knows, so it lives beside the app's own provider roster
 * (ModelProvider in modelRouter.ts) rather than inside the reusable package.
 *
 * Public free-tier figures where documented; anything undocumented is left
 * out entirely, which the ledger treats as unlimited rather than guessed.
 * Correct a wrong number at runtime with quotaLedger.setLimits(), no
 * redeploy required.
 */
import type { QuotaLedgerOptions } from '../packages/predictive-router/src';
import type { ModelProvider } from './modelRouter';

export const PC_PROVIDER_LIMITS: Record<ModelProvider, QuotaLedgerOptions['limits'][string]> = {
  groq: { requestsPerMinute: 30, tokensPerMinute: 6000, requestsPerDay: 14400, tokensPerDay: 500000 },
  gemini: { requestsPerMinute: 15, tokensPerMinute: 1000000, requestsPerDay: 1500, tokensPerDay: null },
  deepseek: { requestsPerMinute: 60, tokensPerMinute: null, requestsPerDay: null, tokensPerDay: null },
  anthropic: { requestsPerMinute: 50, tokensPerMinute: 40000, requestsPerDay: null, tokensPerDay: null },
  grok: { requestsPerMinute: null, tokensPerMinute: null, requestsPerDay: null, tokensPerDay: null },
  ollama: { requestsPerMinute: null, tokensPerMinute: null, requestsPerDay: null, tokensPerDay: null },
};
