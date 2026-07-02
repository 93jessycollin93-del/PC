# HANDOFF — SAS Hub "Hands" Upgrade

*Read this first. It is written to be true, not impressive. ~5 min read.*

## The goal in one line
SAS Hub shows status but has almost no controls. The job is to give it **hands** — toggles, sliders, and inputs in the dashboard that actually change the running system.

## Where the real app is (IMPORTANT)
- **Real app:** `93jessycollin93-del/jacky` (private). Python 3.11 + Flask/Waitress PWA, runs on Windows at `E:\AI\Jacky\`, exposed via Cloudflare tunnel.
- **This repo (`PC`) is a staging area only.** It exists because the session that wrote the code could not access `jacky`. Nothing here runs on its own.

## What actually exists right now
| Item | State |
|---|---|
| `src/sas-upgrade/api/control_routes.py` (313 lines) | **Draft, untested.** Flask route handlers, reviewed but never executed. |
| `docs/SIRIUS_INTEGRATION_PLAN.md` | Planning notes. |
| `README.md` | Untouched Gemini template — ignore it. |

`control_routes.py` assumes `app`, `squad_mgr`, `CONFIG_PATH`, `CloudClient` already exist (they live in `jacky`, not here). **Do not blind-paste it.**

## Routes drafted (all in control_routes.py)
- Bots: `POST /api/bots/<name>/toggle`, `GET|POST /api/bots/<name>/config`
- Models: `GET /api/models`, `POST /api/models/select`, `POST /api/models/clear-force`, `POST /api/models/pull`
- Cloud: `GET|POST /api/cloud/priority`, `POST /api/cloud/<provider>/toggle`, `POST /api/cloud/<provider>/test`
- Resources: `GET|POST /api/resources/limits`
- Integrations: `GET /api/integrations`, `POST /api/integrations/<name>/toggle`, `POST /api/integrations/<name>/test`
- Routing: `GET|POST /api/routing/override`
- Logs: `GET /api/logs` (+ `log_api_call()` helper)

## The one thing that unblocks everything
Start a new session **scoped to the `jacky` repo.** You cannot do real work from the `PC` repo.

## Step-by-step for the next agent
1. **Open `jacky/jacky_api.py`.** Find where `app`, `squad_mgr`, and the config path are defined. Match those names.
2. **Port the routes** from `control_routes.py` into `jacky_api.py`, adapting names to the real objects. Reuse the existing `_load_config`/`_save_config` pattern if `jacky` already has one — don't duplicate it.
3. **Add a `resource_limits` block to `config.json`** with safe defaults (`cpu_cap_percent: 75`, `gpu_temp_max: 80`, `burst_enabled: true`).
4. **Run it:** `python serve.py`, then hit each route and confirm it returns JSON before building any UI.
5. **Only then** build dashboard controls in `sas_ui/dashboard.html` that call the verified routes.
6. Wire routing_override / forced_model into the actual routing logic (`jacky_core.py` / `situation_assessor.py`) — the routes only *store* these values; something must *read* them.

## Verification (none has been done yet — you must do it)
- `POST /api/bots/<name>/toggle` → `GET /api/bots` reflects the change.
- `POST /api/models/select` → next `/api/ask` uses the forced model.
- `POST /api/resources/limits` → `resource_policy.py` honors the new cap.
- `POST /api/routing/override {"mode":"local_only"}` → cloud is never called.

If a route fails, fix the draft — expect some fixes.

## Not started (future work)
- Dashboard HTML controls (the actual buttons/sliders).
- Flipper Zero bridge (`flipper_bridge.py`) + routes + panel — needs `pyserial`/`bleak`, unstarted.
- Multi-user roles (viewer/operator/admin).

## Honest status
One untested backend draft exists. Everything else is planned. Next concrete step: a `jacky`-scoped session to integrate and run the routes.
