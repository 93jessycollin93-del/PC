---
name: Pod control panel vision
description: User's preferred design for the human-facing pod dashboard — status/legibility over visuals. Reference before styling or rebuilding any pod UI.
---

## What the user actually wants
A small (not tiny, not huge) always-accessible control panel for the whole app — conceptually like an "API keys / tools" panel, but for pods instead of integrations. More visible/controllable pods = more capable, more usable to the user.

Core requirement: **colored status dots per pod**, each color meaning something specific and consistent (e.g. red = malfunctioning/needs investigation), so the user can spot a misbehaving pod (e.g. "pod #38 keeps lighting up red") at a glance instead of it silently failing.

## Why
User explicitly said they don't care how the pods themselves look or render — the panel's job is legibility and control, not aesthetics. The goal is accessibility → more tools the user can see/control → more they can build with it.

## How to apply
- When building/refining the pod system, prioritize: consistent status color coding, one panel surfacing all pods' health at once, and quick investigation path from a red dot to the actual problem.
- Do not spend effort on decorative/visual polish of individual pods unless separately requested.
