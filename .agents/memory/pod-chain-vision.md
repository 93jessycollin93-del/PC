---
name: 50-agent pod chain concept
description: User's long-term architectural vision for a large chain/ring of tiny expert AIs feeding one compiled answer. Design-stage only as of 2026-07-10 — not implemented.
---

## The concept
A ring/sphere of ~50 small "pods," each a distinct area of expertise. A request enters the ring and passes through pods **one at a time** (sequential chain, not parallel) — each pod:
1. Decompresses into active memory only while it's its turn (never all 50 at once).
2. Does its analysis using at most ~1GB RAM while active (hard ceiling: never over 1.5GB, prefer ≤1GB).
3. Passes a condensed summary of its reasoning to the next pod in the chain, not the raw analysis.
4. Idle pods stay at rest, likely 1–5MB footprint each.

At the end of the chain, a central "compiler" pod combines everything into one logical, comprehensive, fact-grounded answer — described by the user as pods arranged like a sphere with the compiler at the center.

## Why
User wants this to feel deliberate/serious, not decorative — explicitly said "this is all real serious and it needs to be done to the highest extent."

## Sizing target (refined 2026-07-10)
User wants the core set of chain pods to total roughly 250–500MB combined when accounting for compression (idle pods are just a compressed "seed"). Sequential activation mechanic: asking a question opens pod 1, it analyzes and triggers opening pod 2, etc., closing each behind it; only the central compiler pod stays open persistently. Purely conceptual/metaphorical framing from the user (sphere, "beautiful") — the requirement underneath is real functional sequential activation with real compression/decompression, not a visual show.

## Orchestration should be automatic, not user-managed (refined 2026-07-10)
User does not want to personally operate the pod system — it should be a built-in app feature, invisible in daily use. Preferred mechanism: a tiny "conductor" pod (~1MB or less) whose only job is orchestration — on app open it initiates the "mother pod," then commands the rest of the chain to open/close in the right order and knows how pods link to each other. The user is open to either this conductor pod OR a simpler self-running mechanism ("like a little battery") — the requirement is that pod sequencing works automatically, not that a conductor pod specifically must exist.

## Existing real scaffold found (2026-07-10)
`src/sas-pod-system/` already has a genuinely working orchestrator (`SASCore`, `PodFactory`, `PodLifecycleManager`, `PodCommunicationBroker`) — hardware detection, tiered pod spawning (5MB/50MB/500MB/1GB+), and hydrate/rest lifecycle all run for real. What was previously stubbed: `executeTask` used a fake `setTimeout`; the `PodSystemApp.tsx` dashboard is 100% `Math.random()` simulation with no real pod behind it. `DataPodsApp.tsx` is a genuine exception — it does real compression (`fflate`) and real IndexedDB storage.
Fixed: `executeTask` now calls a real deterministic task processor (`runPodTask` in `pod-system-engine.ts`) that analyzes real input text (word/char counts, keyword frequency), gated by a capability-derived word budget — zero-cost, no external API, matching the user's "free AIs only" preference. A real model call (e.g. Gemini) can be swapped in later once the user adds their own API key themselves — they were explicit they'll wire their own keys when ready, not to request costs on their behalf.

## How to apply
- This is not yet scoped into a buildable plan (model sizing, which 50 domains, how "condensed reasoning" is serialized between pods, RAM ceiling enforcement mechanism are all open). Do not start implementing without a follow-up scoping conversation — user said "we'll think about it" more than once.
- Distinct from the existing Jackie per-app mini-AI / pod-registry system already in the codebase; this chain concept is a separate, bigger idea for one unified reasoning pipeline, not per-window helpers.
