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

## Bootable USB

`boot/` builds a live Linux image that boots a machine straight into this app,
full-screen, with no desktop or browser chrome behind it. The host's own disk is
never touched.

```bash
sudo ./boot/build-iso.sh                 # -> boot/out/jackies-pc.iso
./boot/scripts/test-qemu.sh              # try it in a VM first
sudo ./boot/scripts/write-usb.sh boot/out/jackies-pc.iso /dev/sdX
```

To be exact about what that is: this app is not an operating system and has no
kernel of its own. The image is a minimal Ubuntu whose only job is to run this
app in a WebKitGTK kiosk, so the *experience* is "boots from USB" while the
*implementation* is Linux running one app. That distinction is what the
troubleshooting steps in [`boot/README.md`](boot/README.md) are built around.

Note that the image firewalls port 5000 to loopback. `server.ts` binds
`0.0.0.0` and `requireAuth()` passes everything through when `JACKIE_API_TOKEN`
is unset, so without that rule `/api/shell/exec` would be reachable by anyone on
the same network. See the security note in `boot/README.md`.

## Layout

| Path | Contents |
|---|---|
| `App.tsx` | Window manager, desktop items, app dispatch |
| `boot/` | Live-USB image build system (see `boot/README.md`) |
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
