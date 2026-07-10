<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# PC

This repository contains the AI Studio app plus staging work for SAS Hub upgrades.

View the app in AI Studio: https://ai.studio/apps/29eeb369-088f-4ccd-bda6-77e53eccb448

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local`
3. Start the app: `npm run dev`

## SAS Hub upgrade staging

> Start here: [`docs/HANDOFF.md`](docs/HANDOFF.md)

This repo also holds draft code and planning for SAS Hub upgrade work.

| Path | What it is |
|---|---|
| `docs/HANDOFF.md` | Honest status and next-agent handoff |
| `docs/SAS_HUB_PLAN.md` | SAS Hub control-plan draft |
| `src/sas-upgrade/api/control_routes.py` | Draft Flask control routes for later integration |

