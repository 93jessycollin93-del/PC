# SAS Workstation Terminal — ready-to-apply patch

Three files, fully built (not drafts to write from scratch):

| File | Destination in `jacky` | What it does |
|---|---|---|
| `terminal.html` | `sas_ui/terminal.html` | The full page: file explorer, tabbed editor, terminal, AI sidebar. Already wired to SAS's `/api/ask` and `/api/shell`. |
| `terminal_route.py` | paste into `jacky_api.py` | Adds `GET /terminal`. Two variants included (`send_from_directory` vs `render_template`) — keep whichever matches how `dashboard.html` is already served, delete the other. |
| `dashboard_nav_link.html` | paste into `sas_ui/dashboard.html` | One `<a>` tag — adds a "Workstation" nav link to `/terminal`. |

## Apply (on the PC, in the `jacky` repo)
```
copy terminal.html  → sas_ui/terminal.html
open jacky_api.py   → paste the matching option from terminal_route.py near the dashboard route
open dashboard.html → paste dashboard_nav_link.html into the nav area
```

## What's already wired in `terminal.html` (no further coding needed for these)
- `SAS.USE_SAS_ROUTING = true` — AI chat calls `POST /api/ask` with
  `{prompt, task_type:"code"}`, reading `response`/`reply`/`answer`/`text` from
  whichever field the endpoint returns. Flip the flag to `false` to bypass SAS
  and hit Ollama directly at `:11434` instead (kept as a fallback path).
- `sh <cmd>` / `!<cmd>` in the terminal — POSTs to `/api/shell`, prints
  `stdout`/`stderr`. The JS sandbox (plain typed code) remains the default;
  this is opt-in.
- Auth — `SAS.authHeaders()` reads `window.SAS_AUTH_TOKEN` first, then
  `localStorage.sas_token`. **Check this matches how `dashboard.html`
  authenticates** — if it uses a different mechanism (cookie session, a
  different header name), edit `SAS.authHeaders()` in `terminal.html` — it's
  the only place auth is applied, by design.
- Header has a "Dashboard" link back to `/dashboard`, and the AI sidebar shows
  a small badge (`via SAS /api/ask` or `direct Ollama`) so it's visually
  obvious which path is active while testing.

## Verify (run these, don't just eyeball the code)
1. `python serve.py` → open `http://localhost:<port>/terminal`.
2. Editor + file tree load; type `help` in the terminal.
3. AI sidebar: send a prompt → confirm SAS server logs show a squad/model was
   picked (proves it went through `/api/ask`, not direct Ollama).
4. Terminal: `sh echo hello` → prints `hello` (confirms `/api/shell` wiring
   and that the existing whitelist still applies — try a non-whitelisted
   command too, confirm it's still blocked).
5. Kill network access → AI + terminal still work via local Ollama fallback
   path if `USE_SAS_ROUTING` is flipped off, or via SAS's own local routing
   if left on. Confirms offline-first.

## Explicitly not in this patch
Flipper Zero integration (deprioritized — "only a tool"), multi-model squads
at scale, training/fine-tuning, model compression research. Those are later,
separate phases — see `docs/SAS_HUB_PLAN.md` and the plan file's "Category
Map" for where they'll eventually live.
