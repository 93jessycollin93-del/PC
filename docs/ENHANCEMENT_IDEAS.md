# PC — twenty enhancement moves

Grounded in what this repo already contains. Each entry names the code that
exists today and the change that turns it into something the fleet does not
currently have. Companion document: `my-pc-companion/docs/ENHANCEMENT_IDEAS.md`.

## Fleet correction that came out of the audit

PC and Jackie (`sasjacky777`, forked as `sas-jacky2`) are **connected, not the
same application**. They share zero source files. Jackie carries PC as seven
compiled bundles under `public/pc-os/` and frames them in `PCDesktop.tsx`. The
two desktop *codebases* in the fleet are PC and `my-pc-companion`.

Two findings worth acting on before anything below:

- `public/pc-os/` inside Jackie was last refreshed 2026-07-15. PC's HEAD is
  2026-08-08 — **154 commits of drift**. Every 🪟 row in `PARITY_MATRIX.md` is
  currently overstating what ships. Fix: `npm run build:pc-os`.
- `sas-jacky2` is a GitHub fork, last pushed 2026-07-29. Per `LOVABLE_SYNC.md`
  the repo Lovable actually syncs is `yyb84ycgt6-oss/sasjacky777`. Commits to
  the fork do not reach the Lovable project.

## The twenty

| # | Move | Exists today | The leap |
|---|---|---|---|
| 1 | Embed freshness beacon | The embed drifted 154 commits silently | Stamp commit SHA + build time into the pc-os manifest; Jackie's frame reads it and shows a drift badge |
| 2 | App Commander as intent router | 108 apps behind a name-based launcher | Rank apps by what they *do* using on-device embeddings; open with state pre-filled, offline |
| 3 | One provenance chain | `auditLog.ts`, `provenance/`, `secureSigning.ts` — all per-app | A single signed ledger: app, model, inputs, outputs. Every artefact carries a receipt |
| 4 | Time Machine branches | `timeMachineSnapshots.ts` is linear | Make it a DAG — fork desktop state, try something, merge or discard |
| 5 | Understudy as shadow operator | `understudy/` and `sessionRecorder.ts` run independently | Watch real sessions, detect repeated multi-app workflows, offer them back as approval-gated macros |
| 6 | Model router that learns | `modelRouter.ts` routes on static rules | A bandit over task-type × provider scored on quality-per-dollar with outcome feedback |
| 7 | Speculative model warm-pool | `offlineAiCatalog.ts` loads 21.6 MB cold every time | Predict the next model from the app just opened; warm during idle |
| 8 | Thermal-aware inference governor | The `jacky` bridge streams real GPU/CPU/thermal | Schedule heavy local inference against thermal headroom; downshift model size automatically |
| 9 | Live attack-surface map | Six separate security apps | One exposure graph, one score, one ranked fix queue |
| 10 | Content-addressed pod mesh | `archivePod.ts`, `sas-pod-system/` store opaque blobs | Address by SHA-256, dedup chunks, sync deltas only — the `.lovable/plan.md` seed-pod vision with real integrity |
| 11 | Backroad as universal transport | `backroad.ts` carries the agent lane only | Any app hands it a payload: signed store-and-forward that drains when a route reappears |
| 12 | Executable parity matrix | `PARITY_MATRIX.md` is hand-maintained and has drifted | Per-app capability manifests; CI generates the matrix and fails when a ✅ stops being true |
| 13 | Adversarial review board | `MultiAgentConsensusLab` averages agreement | Proposer / red team / judge, with `CyberSecurityRulebookApp` as the red team's brief |
| 14 | Memory tiers that tier | `MEMORY_MODEL.md` specifies three tiers; `memoryFabric.ts` stores one pool | Promotion/demotion driven by retrieval frequency and explicit pinning |
| 15 | Reproducible bug capsules | `sessionRecorder.ts` records sessions you cannot re-run | Freeze state + events + model calls into a replayable capsule |
| 16 | Capability tokens | `permissions.ts` gates apps; apps still hold ambient reach | Scoped, expiring capabilities per action — the only way 108 apps stay defensible |
| 17 | Typed pipe between apps | `UniversalSaveToolbar.tsx` standardises saving, not interchange | Every app declares import/export shapes; any output feeds any compatible input |
| 18 | Shared windows across two PCs | `bus.ts` already carries every state change | Relay the bus over the jacky bridge with cursor and selection presence |
| 19 | Ink anchored to content | `InkLayer.tsx` strokes float free of what's beneath | Anchor to a cell, a code line, a chart point; survive scroll and re-render |
| 20 | PC-OS as an embeddable SDK | Jackie's embed is a bespoke iframe + copied build | Version it with a `postMessage` API — open app, read state, subscribe to bus. Any Lovable project can then host PC properly |

## Suggested order

1. **#1 and #20** — fix distribution first; everything else is invisible downstream until the embed is trustworthy.
2. **#12** — stop the documentation from drifting again.
3. **#2, #9, #17** — the abundance problems: discovery, trust, composition.
4. **#6, #7, #8** — the capabilities no browser-only sibling can copy, because they need the server and the silicon.
