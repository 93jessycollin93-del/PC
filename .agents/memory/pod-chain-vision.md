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

## How to apply
- This is not yet scoped into a buildable plan (model sizing, which 50 domains, how "condensed reasoning" is serialized between pods, RAM ceiling enforcement mechanism are all open). Do not start implementing without a follow-up scoping conversation — user said "we'll think about it" more than once.
- Distinct from the existing Jackie per-app mini-AI / pod-registry system already in the codebase; this chain concept is a separate, bigger idea for one unified reasoning pipeline, not per-window helpers.
