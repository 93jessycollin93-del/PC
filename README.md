# Jackie's PC

A windowed desktop OS in the browser — the app roster lives in draggable
windows over a shared state layer, with ink gestures, on-device AI, a
vault/compression subsystem, and PWA install.

Reference implementation for the fleet described in `FLEET_PARITY_PLAN.md`;
`PARITY_MATRIX.md` tracks how far the sibling apps have followed.

## Run locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev          # tsx server.ts
```

Set `GEMINI_API_KEY` in `.env.local` before starting. `.env.production.example`
lists what a deployed instance expects.

## Build

```bash
npm run build        # vite build + esbuild bundle of server.ts
npm start            # node dist/server.cjs
npm run lint         # tsc --noEmit
```

Tailwind is compiled into the bundle by PostCSS — see `tailwind.config.js` and
`index.css`. It is not loaded from a CDN, so the PC styles correctly offline.
If you add a directory that ships `className` strings, add it to the `content`
globs in `tailwind.config.js` or its utilities get purged from the build.

## Layout

| Path | Contents |
|---|---|
| `App.tsx` | Window manager, desktop items, app dispatch |
| `components/apps/` | The app roster — one component per window |
| `lib/` | Shared clients: `gemini.ts`, `persist.ts`, `jackyClient.ts`, `ai/`, `engine/` |
| `src/` | `jackie-core/`, `pc-themes/`, `sas-pod-system/`, `components/` |
| `server.ts` | Express host and the `/api/jacky` relay to the Flask engine |
| `jackie-shell/` | Standalone vanilla-JS Jackie prototype (not wired up) |

## SAS Hub upgrade staging

> Start here: [`docs/HANDOFF.md`](docs/HANDOFF.md)

Draft code and planning for SAS Hub upgrade work, staged in this repo rather
than applied to the running system.

| Path | What it is |
|---|---|
| `docs/HANDOFF.md` | Honest status and next-agent handoff |
| `docs/SAS_HUB_PLAN.md` | SAS Hub control-plan draft |
| `src/sas-upgrade/api/control_routes.py` | Draft Flask control routes for later integration |
| `src/sas-upgrade/terminal/` | SAS Workstation Terminal |
| `src/sas-upgrade/flipper/` | Flipper Zero bridge |
| `src/sas-upgrade/mobile/` | Mobile approvals surface |
