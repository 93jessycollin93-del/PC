---
name: Two pod task executors kept side by side
description: Why pod-system-engine.ts has both runPodTask and runPodTaskBudgeted, and how to decide between them later.
---

## Background
Two task executors were built independently for the SAS pod system in the same session window: one by the main agent (for the pod-chain `Conductor`), one by Claude on a separate branch (for the `PodControlPanel`/`PodControlCenter`). Both are real, local, deterministic, zero-cost — no simulation, no external AI calls. They were not deduplicated into one; the user asked to keep both as comparable assets rather than throwing either away.

- `runPodTask(instance, task)` — keyword-frequency + summary analysis, budget derived from `reconstructedState.capabilities.length`. Used by `Conductor` for the pod-chain hand-off (needs a `.summary` string).
- `runPodTaskBudgeted(instance, input, wordBudget?)` — straight word-count truncation, budget derived from `deriveWordBudget(seed)` or `seed.wordBudget`. Used by `PodControlCenter`/`PodControlPanel` (needs a structured `PodTaskResult` with wordsIn/wordsOut/truncated).

**Why:** rather than picking a winner immediately, the user wants both kept so they can be compared later, and possibly rewritten if one is clearly better — Claude's variant was built on a stronger backing model, so it may be worth a closer look when there's time.

**How to apply:** if asked to unify pod task execution, compare these two before deleting either; check which callers (Conductor vs PodControlPanel) would need to change and whether a shared interface can serve both use cases before removing one.
