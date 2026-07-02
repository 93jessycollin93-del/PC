# PC — SAS Hub Upgrade (staging repo)

> **Start here → [`docs/HANDOFF.md`](docs/HANDOFF.md)**

This repository is a **staging area**, not a runnable app. It holds draft code and
planning for upgrading **SAS Hub** — the real application that lives in the private
`93jessycollin93-del/jacky` repo (Python 3.11 + Flask/Waitress PWA).

## What's here
| Path | What it is |
|---|---|
| `docs/HANDOFF.md` | **Read first.** Honest status + step-by-step for the next agent. |
| `docs/SAS_HUB_PLAN.md` | The corrected plan: give SAS Hub "hands" (dashboard controls). |
| `src/sas-upgrade/api/control_routes.py` | Draft Flask control routes (untested — must be integrated into `jacky`). |

## The goal in one line
SAS Hub can *see* (status dashboard) but can't *act*. Add controls — toggles,
sliders, inputs — that change the running system.

## Important
Nothing here runs on its own. Real work happens in a session scoped to the
`jacky` repo. See `docs/HANDOFF.md`.
