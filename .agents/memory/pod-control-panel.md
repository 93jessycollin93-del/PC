---
name: Pod control panel vision
description: User's preferred design for the human-facing pod dashboard — status/legibility over visuals. Reference before styling or rebuilding any pod UI.
---

## What the user actually wants
A small (not tiny, not huge) always-accessible control panel for the whole app — conceptually like an "API keys / tools" panel, but for pods instead of integrations. More visible/controllable pods = more capable, more usable to the user.

Core requirement: **colored status dots per pod**, each color meaning something specific and consistent (e.g. red = malfunctioning/needs investigation), so the user can spot a misbehaving pod (e.g. "pod #38 keeps lighting up red") at a glance instead of it silently failing.

## Why
User explicitly said they don't care how the pods themselves look or render — the panel's job is legibility and control, not aesthetics. The goal is accessibility → more tools the user can see/control → more they can build with it.

## Pod builder (refined 2026-07-10)
The panel isn't just status — it's also where the user builds/configures pods:
- Pick which underlying AI/model powers a pod.
- Per-pod settings: input/output word limits, context size, and a **compression value tied to that limit** — e.g. a pod capped at 20 words should only decompress the minimal knowledge slice it needs, not its full model "baggage." Smaller allowed context = smaller active footprint.
- Pods should be attachable/reusable across apps — e.g. drop a small coding-agent pod at the bottom of any screen, not locked to one fixed assistant. User loved the earlier mini-AI-at-bottom-of-screen UI with its open/compress animation, but was explicit that the animation/visual excitement is not the point.
- **Function over form, repeated point:** pods must be real and functional in code — actually calling a model, actually enforcing limits/compression — not simulated for show. The user does not need or want to watch/understand the mechanism visually; they care that it's genuinely working underneath.

## How to apply
- When building/refining the pod system, prioritize: consistent status color coding, one panel surfacing all pods' health at once, and quick investigation path from a red dot to the actual problem.
- Do not spend effort on decorative/visual polish of individual pods unless separately requested — build the real underlying behavior (model calls, word/context limits, compression) first.
