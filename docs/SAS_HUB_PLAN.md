# SAS Hub Upgrade Plan — Give It "Hands"

> Supersedes the earlier "Sirius Security AI Router" plan, which was based on a
> wrong assumption (that this repo was a Gemini app to build from scratch).

## Context
**SAS Hub already exists** as a working system in `93jessycollin93-del/jacky`:
- Python 3.11 + Flask/Waitress, installable PWA dashboard
- Runs Ollama locally with cloud fallback (Groq → Gemini → OpenRouter)
- 10 AI bots with squad routing, GPU thermal monitoring, situation assessment
- Exposed via Cloudflare tunnel; runs on Windows at `E:\AI\Jacky\`

**The real problem (user's words): "I only have eyes, I have no hands."**
The dashboard *shows* status but offers almost no controls to *act*. This plan adds
the inputs, toggles, and panels to manipulate the system from the UI.

## What SAS Hub already has
- Backend: `jacky_api.py`, `jacky_core.py`, `serve.py`, `ollama_client.py`,
  `cloud_router.py`, `cloud_client.py`, `squad_manager.py`, `situation_assessor.py`,
  `resource_policy.py`, `data_collector.py`, `secrets_loader.py`, `config.json`
- Frontend (`sas_ui/`): `dashboard.html`, `chat.html`, `condenser.html`
- Endpoints: `/api/ask`, `/api/control`, `/api/assessment`, `/api/bots`,
  `/api/status`, `/api/config`, `/api/task`, `/api/shell`, `/api/collector/start`,
  `/api/condenser/compress`

## What's missing (the "hands")
Per-bot enable/disable, manual model forcing, cloud provider reordering, integration
toggles, resource sliders, collector controls, config editor, routing override,
log viewer — and (later) Flipper Zero integration.

## Plan
### Priority 1 — Dashboard controls
Integrate the drafted routes (`src/sas-upgrade/api/control_routes.py`) into
`jacky_api.py`, then build matching UI panels in `sas_ui/dashboard.html`:
bot toggles, model selector + pull, cloud priority, resource sliders, integration
switches, routing override, log viewer.

**Critical:** the routes only *store* values like `forced_model` and
`routing_override`. Logic in `jacky_core.py` / `situation_assessor.py` must be
updated to *read* them, or the controls will look wired but do nothing.

### Priority 2 — Flipper Zero (later)
`flipper_bridge.py` (USB via `pyserial`, BLE via `bleak`) + routes
(`/api/flipper/status|test|results`) + a dashboard panel. Route AI analysis of
results through the existing `/api/ask`.

### Priority 3 — Multi-user (later)
Extend token auth to roles: viewer (eyes only), operator (hands), admin (full config).

## Tech constraints
Keep Python 3.11 + Flask + Waitress + vanilla HTML/JS + Ollama. No rewrite.

## Verification
Run `python serve.py` in `jacky`, then confirm each new route returns JSON and that
toggles actually change behavior (see `docs/HANDOFF.md` for the exact checks).
