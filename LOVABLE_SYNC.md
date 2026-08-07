# Getting PC into Lovable

How to make the Lovable app hold what this repo holds, from a phone, without
spending Lovable credits.

## The one thing to understand first

**Lovable will not import a repo you point it at.** It creates its own GitHub
repo, pushes its edits up to it, and pulls commits back down. Only that last
direction is usable from outside. So the way in is: put this code into the repo
Lovable already made, and let Lovable pull it.

Destination for this project:

```
93jessycollin93-del/momentum-habit-tracker
```

That is the GitHub repo the Lovable project syncs with. Lovable reads its
**default branch**.

## About the token

The sync needs a **GitHub personal access token** — created on github.com, free,
unlimited, and completely unrelated to Lovable credits. Having no credits left
on the Lovable account does not block this. Nothing in this path spends a
credit, because Lovable's AI agent is never asked to do anything; it just pulls
finished code.

You need the token once. After that, syncing is two taps.

## Setup, once

1. On github.com → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
   - Repository access: **only** `93jessycollin93-del/momentum-habit-tracker`
   - Permissions: **Contents → Read and write**
   - Copy the token (it is shown once).
2. In **this** repo → Settings → Secrets and variables → Actions → New
   repository secret.
   - Name: `LOVABLE_SYNC_TOKEN`
   - Value: the token you just copied.

The token is only ever read into the git remote URL inside the run, never
printed, so it cannot leak into the run log.

## Each time you want to push PC over

1. This repo → **Actions** → **Send code to Lovable** → **Run workflow**.
2. Leave the defaults (destination is prefilled, branch `pc-import`,
   overwrite off).
3. Wait. The run **builds the app first** and refuses to send anything if the
   build fails — you cannot end up with a broken repo on the far side that
   costs credits to repair.
4. When it finishes, open the link it prints and merge `pc-import` into the
   destination's default branch.
5. Lovable pulls it down on its own.

Step 4 is deliberate: the push lands on a branch, so you get to look before
anything the Lovable project serves actually changes.

## What lands, and what it does over there

The build is a plain Vite + React 19 + Tailwind SPA — verified building clean at
97 app components, `dist/index.html` plus assets. Everything that runs purely in
the browser works on Lovable unchanged: the window manager, desktop, themes,
storage/pods, compression and vault subsystems, games, notepad, and the offline
paths.

**What will not work as-is:** this repo serves its own Express host
(`server.ts`) and the frontend calls it at same-origin `/api/*`. Lovable hosts a
frontend plus Supabase edge functions — there is no Express there, so those
routes 404. Affected:

| Route | Apps that use it |
|---|---|
| `/api/gemini/generate` | Gemini-backed AI, Agent Builder |
| `/api/jacky/*` (`status`, `assessment`, `ask`, `control`, `squads`, `bots`, `models`) | Mission Control, App Commander, Ask Jackie — these have an offline fallback and degrade rather than break |
| `/api/ollama/*` | On-Device Models / Model Store |
| `/api/term-fs/*`, `/api/shell` | ai-term, terminal file ops |
| `/api/telegram/send` | notifications, actions |
| `/api/build/run` | Cloud Deploy |
| `/api/health/providers` | fallback orchestrator |
| `/api/flipper/*`, `/api/security/*` | Flipper Zero, security surfaces |

Those surfaces will render but return errors on the calls, except the `jacky`
ones, which already fall back offline by design (`lib/jackyClient.ts`,
`lib/jackyFallback.ts`).

Closing that gap properly means porting those routes to Supabase edge functions
in the Lovable project — that is the Wave 1 work in `FLEET_PARITY_PLAN.md`, and
it is a separate job from this sync.

## Two things worth knowing before you merge

- **The destination currently holds a different app.** That repo is the Momentum
  Habit Tracker project (TanStack Start). PC is Vite. Merging replaces what the
  Lovable project builds. That is the intent here — just be aware it is not
  additive, and the habit tracker is what gets replaced.
- **Stacks differ.** The Lovable project is configured as TanStack Start; this
  tree is Vite. Lovable builds from `package.json`, so a Vite tree is buildable,
  but the first pull is the moment to check the preview. If it does not come up,
  the branch you merged is the thing to revert — the pre-merge branch step above
  exists exactly so that stays easy.

## Related

- `FLEET_PARITY_PLAN.md` — the strategy across PC / Eru / Jackie
- `PARITY_MATRIX.md` — per-capability status tracker
- `.github/workflows/sync-to-lovable.yml` — the workflow itself
