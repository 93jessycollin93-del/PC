# @offgrid/predictive-router

Predictive quota forecasting and handoff briefing for multi-provider AI routing.

Most failover is reactive: call a provider, watch it fail, catch the error, try
the next one. That means every rate limit costs the user one failed request.
This package answers a different question — **is this provider about to run out,
based on how fast it's actually being used right now** — so you can switch
*before* the failure, and hand the incoming model a briefing instead of raw
history so it continues the work instead of starting cold.

Framework-agnostic. No React, no DOM, no network calls. Two pieces:

## `QuotaLedger` — forecast exhaustion from the consumption rate

```ts
import { QuotaLedger } from '@offgrid/predictive-router';

const ledger = new QuotaLedger({
  limits: {
    groq: { requestsPerMinute: 30, tokensPerMinute: 6000, requestsPerDay: 14400, tokensPerDay: null },
    gemini: { requestsPerMinute: 15, tokensPerMinute: null, requestsPerDay: 1500, tokensPerDay: null },
  },
});

// After every completed call, successful or not:
ledger.record('groq', { tokens: response.tokensUsed });

// Before dispatching the next one:
if (ledger.shouldPreemptivelySwitch('groq')) {
  const target = ledger.nextInLine('groq', ['gemini', 'deepseek'])[0];
  // target has the most headroom right now — switch to it before groq fails.
}
```

`shouldPreemptivelySwitch` fires on the **rate**, not just the running total. Ten
requests burned in two seconds and ten burned over a minute forecast very
differently, even though the count is identical — the fast burn is heading for
the wall, the slow one isn't. This is what makes the switch a decision made in
advance rather than a scramble triggered by a 429.

Limits are declared, not observed. Nothing here guesses a provider's real rate
limit; you pass what you know, and `setLimits()` corrects it at runtime without
a redeploy when a real response tells you otherwise. A provider with no
declared limit is treated as unlimited rather than assumed to be constrained.

## `buildBriefing` — tell the next model it's taking over, and why

```ts
import { buildBriefing } from '@offgrid/predictive-router';

const briefing = buildBriefing({
  messages,                    // the conversation so far
  fromProvider: 'groq',
  toProvider: 'gemini',
  reason: 'quota_approaching', // or rate_limited / provider_error / provider_unhealthy / cost_optimization / manual_switch
  maxChars: 2400,              // hard ceiling — different providers have very different context windows
});
```

The result is guaranteed to fit `maxChars`, measured on the final string, not
estimated. It always keeps the most recent user message (that's what the
incoming model has to answer), flags unfinished work — an unanswered question,
a reply that looks cut off mid-sentence — so the new model finishes rather than
restarts, and words the cause differently depending on `reason`: "the previous
model errored" reads very differently to a model than "the previous model was
just being efficient with its quota."

Pure and deterministic. Same input, same output — no clock, no randomness, no
I/O. If you need a timestamp in the briefing, pass one.

## Why two separate pieces

`QuotaLedger` decides *whether* and *who*. `buildBriefing` decides *what to
say*. They compose but don't depend on each other, so you can use the
forecasting without the briefing (e.g. just to power a status dashboard) or the
briefing without the forecasting (e.g. a manually-triggered switch).

## Design choices worth knowing about

- **Provider is a plain string**, not a fixed union. A router library that
  hardcodes a provider list stops being a library the moment you add one it's
  never heard of.
- **Usage is bucketed into 10-second slots**, and a slot counts in full while it
  overlaps the rolling window — so a burst stays visible slightly longer than
  strictly accurate. This over-counts on purpose: it's the safe side to err on
  for a switch decision.
- **`localStorage` is used by default when available**, so forecasts survive a
  reload; pass `storage: null` to stay in memory, or your own `StorageLike` to
  persist somewhere else (this is how it's tested — an injected fake store and
  an injected clock, so nothing here depends on wall-clock time or the DOM).
