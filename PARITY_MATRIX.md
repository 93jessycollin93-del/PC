# Parity Matrix — PC → Eru → Jackie

Living tracker for the Fleet Parity Plan. PC is the reference; this maps every PC
capability to its status in **Eru** (Base44) and **Jackie** (`sasjacky777`,
Lovable/Supabase). Update the cells as each wave lands.

**Legend** — ❌ not present · 🔶 partial / different impl · ✅ native parity ·
🪟 available via the PC embed in Jackie (`public/pc-os/`, not yet native) · — n/a

> Baseline from `FEATURE_AUDIT.md`. Jackie already embeds the whole PC OS and holds
> the Eru pages, so many of its cells start at 🪟/🔶 rather than ❌. Eru is its own
> large Base44 app, so several domains start 🔶 (its own take exists) rather than ❌.

> **🪟 is only as good as the embed.** Every 🪟 cell below is served by the PC build
> sitting in Jackie's `public/pc-os/`, and that copy had drifted far behind this
> repo — it predated Tailwind moving out of the CDN, and shipped none of the
> code-split app chunks, so several 🪟 cells were in truth ❌. It is current again
> and reproducible: `npm run build:pc-os`, or the **Refresh PC inside Jackie**
> workflow. Before trusting a 🪟, check the embed is current. See `LOVABLE_SYNC.md`.

## Wave 1 + 2 — real backend bridge & native live surfaces (merged ✅)

| Capability | PC | Eru | Jackie |
|---|---|---|---|
| jacky bridge (status/assessment/ask/control/models/bots/squads) | ✅ `lib/jackyClient.ts` + `/api/jacky` proxy | ✅ `base44/functions/jackyProxy` | ✅ `supabase/functions/jacky-proxy` |
| Live System Monitor (real GPU/CPU/RAM/thermal) | ✅ App Commander proxy mode | ✅ native `/jacky-live` | ✅ native `/jacky-live` |
| Ask Jackie w/ situation-aware routing | ✅ App Commander console (proxy) | ✅ `/jacky-live` | ✅ `/jacky-live` |
| Squad console (coding/security/archivist) | 🔶 client ready → surface next | ❌ | ❌ |
| MissionControl (native PC React wiring) | 🔶 next PC piece → `jackyClient` | — | — |

> **Go live:** set `JACKY_API_BASE` (+ optional `JACKY_API_TOKEN`) in each app's env/secrets.
> PC's App Commander adds a **Same-origin proxy** link mode (⚙, top-right) that needs zero
> client config when the page is served by PC's server.

## AI / agents / models

| PC app | PC | Eru | Jackie |
|---|---|---|---|
| ModelRouter (`components/apps/ModelRouterApp.tsx`) | ✅ | 🔶 `AILab`/`invokeExternalModel` | 🔶 `jackie-orchestrate` edge fn |
| OnDeviceModels (`lib/offlineAiCatalog.ts`) | ✅ | ❌ | 🪟 |
| Claude / Grok / Codex assistants | ✅ | 🔶 `JackieAI` | 🔶 `jackie-chat` |
| SmallAgentFleet / AgentBuilder / AgentOrchestration | ✅ | 🔶 `BotFarm`/`AgentOperations` | 🔶 `gunit-*` loop |
| KnowledgeCompressor (`lib/compression.ts`) | ✅ | ❌ | 🪟 |
| MultiAgentConsensus / CrossAiLab | ✅ | ❌ | ❌ |
| PromptLibrary / PromptToJson / FunctionCallKitchen | ✅ | ❌ | ❌ |
| Ollama manager | ✅ | ❌ (use jacky bridge) | 🔶 `jackie-ollama` |

## Security / vault / secrets

| PC app | PC | Eru | Jackie |
|---|---|---|---|
| SecretsVault / SecretsHygiene (`lib/secretsVault.ts`) | ✅ | 🔶 `components/security` | 🔶 `Vault.tsx` |
| SecurityCenter / SecurityEventLog / SelfAuditScanner | ✅ | 🔶 `SecurityCommandCenter` | 🔶 `sentinel/` (mock data) |
| PermissionBroker (`lib/permissions.ts`) | ✅ | ❌ | ❌ (adopt tikkerlive RLS `has_role`) |
| AuditTrail (`lib/auditLog.ts`) | ✅ | 🔶 | ❌ |
| DependencyCVEChecker / AnomalyAlert | ✅ | 🔶 `ComplianceCenter` | ❌ |
| App Commander vault (AES-GCM boxes) | ✅ shared `app-commander.html` | ✅ (shared file) | ✅ (shared file) |

## Data / knowledge / storage

| PC app | PC | Eru | Jackie |
|---|---|---|---|
| DataPods / PodSystem (`src/sas-pod-system/`) | ✅ | ❌ | 🔶 `lib/pods/` |
| KnowledgeCompressor / ECPS suite | ✅ | ❌ | 🪟 (wire jacky `/api/ecps/*`) |
| TimeMachine snapshots (`lib/timeMachineSnapshots.ts`) | ✅ | ❌ | ❌ |
| Archiver (`lib/compression/ecps-codec.js`) | ✅ | ❌ | ❌ |
| MemoryFabric (`lib/memoryFabric.ts`) | ✅ | 🔶 `indexBotSemanticMemory` fn | 🔶 `jackie_memory` table |
| Research apps (SemanticScholar/PapersWithCode/ResearchRabbit) | ✅ | ❌ | ❌ |

## Infra / cost / ops

| PC app | PC | Eru | Jackie |
|---|---|---|---|
| MissionControl / FleetAtlas | ✅ | 🔶 `router-console` | 🔶 `SphereCommand`/`SentinelBoard` |
| BudgetGuardian / CostAnalytics (`lib/budgetGuardian.ts`) | ✅ | 🔶 `Economy`/`Portfolio` | ❌ |
| GitHubSync / CodeRabbit | ✅ | ❌ | ❌ |
| CloudDeploy / CloudInfrastructure | ✅ | ❌ | ❌ |
| AppHealthMonitor / Automation (`lib/automation.ts`) | ✅ | 🔶 `BotAutomations` | ❌ |
| Media Converter (yt-dlp/ffmpeg) | ❌ (port from eru) | ✅ `media-converter/` (backend) | 🔶 `src/vault/**` (UI, needs backend) |

## Devices / creative / games / system shell

| PC app | PC | Eru | Jackie |
|---|---|---|---|
| Home / Settings / Notifications / Automation / Voice / Clipboard | ✅ | 🔶 (Base44 pages) | 🔶 (shadcn pages) |
| SuperSayen (Web MIDI/audio) / Flipper Zero | ✅ | ❌ | 🪟 |
| Blender / Unreal integrations | ✅ | ❌ | ❌ |
| Games (Chess/Snake/LaserTag/IronMen) | ✅ | ❌ | 🔶 `game/` (own 4X/idle) |
| Slides / FlashUI / TermStudio | ✅ | ❌ | 🔶 `Sandbox`/`Design` |
| Theme registry (`src/pc-themes/*`) | ✅ | ❌ (adopt shared token kit) | ❌ (adopt shared token kit) |

## Best-of-fleet to fold into ALL three (from the audit)

| Feature | Source | PC | Eru | Jackie |
|---|---|---|---|---|
| Explainable risk scoring | `fobccc/src/lib/intel/scoring.ts` | ❌ | ❌ | ❌ |
| Live on-chain Intel console (DexScreener) | `fobccc/src/pages/intel/*` | ❌ | ❌ | ❌ |
| Reinforcement Journal (emotion↔outcome) | `fobccc/src/pages/Journal.tsx` | ❌ | ❌ | ❌ |
| Lineage graph (SVG relationships) | `tikkerlive/src/components/LineageGraph.tsx` | ❌ | ❌ | ❌ |
| Supabase auth + RLS blueprint | `tikkerlive/supabase/migrations/*.sql` | — | — | 🔶 (extend existing) |

---

### How to use this tracker
- Flip a cell to ✅ only when the capability is **native** on that platform (not just
  reachable via the PC embed 🪟).
- Prefer wiring to the real backend (`jackyClient` / the platform proxies) over
  re-simulating — see Wave 1 row.
- Pull unique assets from **eru** (`router-console/`, `media-converter/`,
  `components/security/`, `components/botstudio/`); take the Supabase schema from
  **neweru** (`MIGRATION/`).

_Companion docs: `FLEET_PARITY_PLAN.md` (strategy), `FEATURE_AUDIT.md` (source catalog)._
