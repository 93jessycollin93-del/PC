---
name: App functionality audit backlog
description: User wants a future full pass over every app in the OS to verify real functionality vs simulated/fake behavior; also a UI-fix scoping preference.
---

## What to do (not yet started, no date set)
Go through every app/desktop item in the OS one by one and verify each does what it's advertised to do with real logic — not a `Math.random()` or `setTimeout` simulation dressed up as a feature. This mirrors the same real-vs-fake audit already done for the pod system this session (see pod-chain-vision.md): several apps were built during an earlier "Google AI Studio" phase that the user says started producing lower-quality, more superficial results after the first 10-15 apps.

**Why:** user has been burned before by apps that look/feel functional but are hollow underneath ("it's just like a game, doesn't even work"). They explicitly want function over form checked project-wide, eventually.

**How to apply:** When asked to start this audit, go app-by-app (there's a `desktopItems` list in `App.tsx` enumerating them), for each one identify what it claims to do, then check the actual implementation for real logic vs fabricated/simulated output, and report/fix findings — same method already proven on `PodSystemApp.tsx` (fake) vs `DataPodsApp.tsx` (real) this session.

## Scoping preference: fix UI issues per-instance, not globally
When a UI clutter/layout issue is found in one app (e.g. floating widgets overlapping a chat composer), do NOT proactively sweep all other apps for the same pattern. The user prefers to flag instances one at a time as they personally notice them, since many apps are one-off and a global sweep would likely be wasted effort.
