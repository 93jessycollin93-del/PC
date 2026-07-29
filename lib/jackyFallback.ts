/**
 * jackyFallback — the real implementation of the 'ollama' fallback slot in
 * aiClient.ts. That slot used to return a canned "not integrated" message
 * regardless of whether a real Jacky box was reachable; this makes it an
 * actual call through jackyClient to the real Flask engine on the user's
 * own GPU, mapped into the same AIResponse shape every other provider
 * returns — idea #05, "your own GPU, from your pocket."
 *
 * Local inference through Jacky has no API cost or token metering the way
 * cloud providers do, so tokensUsed/cost are honestly reported as 0 rather
 * than estimated — that is the actual value of owning the hardware, not an
 * approximation of it.
 */
import { jacky, type JackyAskResult } from './jackyClient';
import type { AIResponse } from './aiClient';

export interface AskJackyOptions {
  /** Injectable so this is testable without mocking the module system —
   *  same pattern as timeTravel.ts's sha256 and provenance.ts's subtle. */
  ask?: (prompt: string, opts?: { task_type?: string }) => Promise<JackyAskResult>;
  now?: () => number;
}

export async function askJackyForFallback(prompt: string, opts: AskJackyOptions = {}): Promise<AIResponse> {
  const ask = opts.ask || jacky.ask;
  const now = opts.now || Date.now;
  const result = await ask(prompt, { task_type: 'general' });
  return {
    content: result.response,
    provider: 'ollama',
    model: result.model || result.engine || 'jacky-local',
    tokensUsed: 0,
    cost: 0,
    timestamp: now(),
  };
}
