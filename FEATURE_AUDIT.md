# Fleet Feature Audit — what to fold into the main app

Cross-repo audit of the whole `93jessycollin93-del` profile, done alongside the
**eYe App Commander** flagship (`public/app-commander.html`). Goal: catalog every
repo's features/assets and rank what's worth porting into the main app (**PC —
"Jackie's PC"**) and the two other enhancement targets (**eru**, **ocd-jacky-777**).

## The one finding that reframes everything

**The real engine is `jacky` (Python/Flask). None of the frontends are wired to it.**
`ocd-jacky-777`, `eru`, and PC all either simulate telemetry or proxy straight to
cloud LLMs. A grep of `ocd-jacky-777` for the Flask engine (`/api/ask`, `:5000`,
`OLLAMA_HOST`) found **zero references**. Yet `jacky` already exposes real
GPU/CPU/thermal status, situation-aware routing with a visible fallback chain, a
master on/off switch, multi-agent squads, and the ECPS compression suite.

→ **Highest-leverage move: build one small client shim to the `jacky` Flask host,
then multiple "fake" panels across the fleet light up with real data at once.**
The App Commander already does this for `/api/status` + `/api/assessment` + `/api/ask`
(configurable base URL, offline fallback) — it's the reference implementation to
generalize into `lib/jackyClient.ts`.

## Repo map

| Repo | What it is | Role |
|---|---|---|
| **PC** (`jackies-pc`) | Vite/React 19 virtual-desktop OS, ~90 windowed apps, Express `server.ts`, on-device AI, vault/compression subsystem | **Main app / baseline** |
| **jacky** | Python/Flask situation-aware orchestration engine (real telemetry, routing, squads, ECPS, whitelisted shell) | **The real backend** — wire the frontends to this |
| **ocd-jacky-777** | Lovable "Jackie" host shell (TS + shadcn + Supabase). Already embeds the PC OS via iframe (`public/pc-os/`, `PCDesktop.tsx`) and has all 91 Eru pages copied into `src/eru/` | Enhancement target + fusion host |
| **eru** | Base44 super-app: ~90 pages, ~150 entities, ~70 serverless fns; unique standalone `media-converter/` + `router-console/` | Enhancement target + asset source |
| **neweru** | Newer Base44 copy of eru, minus a few labs; **adds** a Base44→Supabase migration kit (`MIGRATION/schema.sql`, `entities-full/`) | Use only for the Supabase schema |
| **fobccc** | Vite/React "Bot Foundry" + live on-chain "Intel" console (real DexScreener feed, explainable scoring) | Asset source |
| **tikkerlive** | TanStack Start + Supabase live-streaming platform (real auth + RLS schema) | Asset source (auth/RLS blueprint) |
| **my-pc-companion** | Empty Lovable starter (blank placeholder) | Nothing to port |
| **cyber-store**, **CYBERNETIC_EMPATH** | README-only stubs | Nothing to port |

## Port shortlist — ranked

Ranked by (real capability × uniqueness ÷ effort). Effort: S ≈ ½ day, M ≈ 1–2 days, L ≈ 3+.

### Wave 1 — wire the real backend (unlocks the most, fastest)
1. **`jacky` client shim** — generalize the App Commander's fetch layer into `lib/jackyClient.ts` (base URL + token + offline fallback). **S.** Everything below depends on it.
2. **Real System Monitor + thermal verdict** — `GET /api/status`, `/api/metrics`, `/api/assessment`. Turns PC's `MissionControlApp`/`SystemMonitor` from mock into live RTX-3090 telemetry. **S.**
3. **"Ask Jackie" with visible fallback chain + master switch** — `POST /api/ask`, `GET/POST /api/control`. Real local→free-cloud→paid routing; upgrades `ModelRouterApp`/`ClaudeAssistantApp`. **M.**
4. **Squad console (multi-agent)** — `/api/squads/*`: coding/security/archivist, single-lead *ask* vs all-members *discuss*, with memory. No frontend equivalent exists. **M.**

### Wave 2 — unique capabilities with real backends
5. **Condenser / ECPS compression suite** — `jacky /api/ecps/*` + `/api/condenser/*` (conversation→seed, benchmark, adversary). Novel flagship app; pairs with the App Commander's Collapse Pipeline panel. **M/L.**
6. **Media Converter** — pair eru's real `media-converter/server.js` (yt-dlp+ffmpeg → MP3/MP4) with the finished Vault UI already in `ocd-jacky-777/src/vault/**`. Backend + frontend both already exist. **M.**
7. **Router Console → PC "remote" app** — eru `router-console/` is an offline-first phone PWA for orchestration + thermal control; reskin as a PC panel. **S/M.**
8. **Safe Terminal / file-ops** — `jacky POST /api/shell` (whitelisted PowerShell) + `tools/*`. A real sandboxed terminal instead of a mock. **M.**

### Wave 3 — polished UX patterns to standardize
9. **Explainable risk-scoring engine** — `fobccc/src/lib/intel/scoring.ts`: 0–100 score with signed factor breakdown. Upgrades PC's `AnomalyAlertApp`/`SelfAuditScannerApp`/`BudgetGuardianApp` from opaque numbers to evidence. Pure, dependency-free. **S.**
10. **Live on-chain Intel console** — `fobccc/src/pages/intel/*` (real DexScreener data, Whales/Liquidity/Anomalies). A genuinely non-simulated data app. **M/L.**
11. **Reinforcement Journal** — `fobccc/src/pages/Journal.tsx`: log emotion↔outcome per decision. Fits the Cybernetic67 "self-reflection" directive. **S/M.**
12. **Lineage graph** — `tikkerlive/src/components/LineageGraph.tsx`: lightweight SVG relationship graph for `FleetAtlasApp`/`AgentTeamConsoleApp`. **S.**
13. **Supabase auth + RLS blueprint** — `tikkerlive/supabase/migrations/*.sql` (roles table, `has_role()` security-definer, per-table RLS, webhook audit log). Reference for any multi-user PC feature. **M.**

## Guidance
- **eru vs neweru:** unique assets (`router-console/`, `media-converter/`, `components/security/`, `components/botstudio/`) live only in **eru**; take the **Supabase schema** from **neweru** if migrating off Base44.
- **Reuse, don't rebuild:** `ocd-jacky-777` already ships the PC embed (`public/pc-os/`) and a `gunit` self-improving agent loop.
- **Shared UI:** shadcn/Radix is duplicated across fobccc/tikkerlive/ocd — consider extracting one shared package for fleet-wide consistency.
- **Skip:** `my-pc-companion`, `cyber-store`, `CYBERNETIC_EMPATH` (empty).

---
*Generated during the App Commander enhancement. Waves are a suggested sequence, not a commitment — each item is independently shippable.*
