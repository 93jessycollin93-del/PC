# Getting PC into Lovable

Two Lovable projects carry PC, and they take it differently. Picking the wrong
one costs you an app, so start here.

| Lovable project | GitHub repo | What PC is there | How to update it |
|---|---|---|---|
| **Jackie** — `sasjacky777.lovable.app` | `yyb84ycgt6-oss/sasjacky777` | The whole PC build embedded under `public/pc-os/`, framed at `/pc` | **Refresh the embed** (below) |
| **My PC Companion** — `eyeeru.lovable.app` | `yyb84ycgt6-oss/my-pc-companion` | The app itself | The sync workflow (below) |

Neither path spends a Lovable credit. Lovable's AI agent is never asked to do
anything — it just pulls finished code from GitHub.

## About the token

Both paths need a **GitHub personal access token** — made on github.com, free,
unlimited, and unrelated to Lovable credits. An empty Lovable balance does not
block any of this.

---

## Path A — refreshing the PC inside Jackie (`sasjacky777`)

**Use this one to answer "the PC in my app is missing updates."**

Jackie is its own app: 28 pages, 32 Supabase edge functions, its own auth and
theme. It does not need to become PC — it already *contains* PC. `PCDesktop.tsx`
iframes `/pc-os/index.html`, and the entire PC build ships under
`public/pc-os/`. So the PC in Jackie is only ever as current as that directory.

Do **not** point the sync workflow at `sasjacky777`. That replaces the whole
repo and would destroy the pages and edge functions.

### From a phone

Actions → **Refresh PC inside Jackie** → Run workflow. It rebuilds the PC,
swaps the embed, **builds Jackie to prove the embed did not break it**, and
pushes. Set the branch to `SAS-JACKY` to publish directly, or leave it as
`pc-os-refresh` to look first.

That build check is not ceremony. The embed carries a 21.6 MB on-device AI
wasm, and Jackie's `vite-plugin-pwa` fails outright on files over its per-file
precache limit — a broken Lovable preview, repairable only by spending credits.

### By hand

```bash
# in the PC repo
npm run build:pc-os                       # builds with base=/pc-os/, patches manifest

# in the Jackie repo
rm -rf public/pc-os && mkdir -p public/pc-os
cp -a <PC>/dist/. public/pc-os/           # the dot matters — .vite/ must come too
npm run build                             # confirm it still builds
```

Then commit on a branch, push, and merge it. Lovable pulls `SAS-JACKY`.

Three things the build gets right that a hand-copy does not:

- **`--base=/pc-os/`** — a default build writes `/assets/...`, which 404s under
  the sub-path.
- **`.vite/manifest.json`** — apps are code-split, and their chunks are not
  referenced by `index.html`. `sw.js` reads this manifest to precache them, so
  without it an app you have never opened cannot open offline.
- **`start_url` / `scope`** — patched to `/pc-os/`. Left at `/`, installing the
  PC from its own tab launches Jackie's root instead of the PC.

`sw.js` and `index.tsx` are already sub-path aware, so nothing else needs
touching.

### Checking it before you merge

Serve the directory and boot it:

```bash
cd <jackie>/public && python3 -m http.server 8899
# then open http://localhost:8899/pc-os/index.html
```

The desktop should render styled. If it comes up unstyled, the build lost its
compiled Tailwind — that is the failure mode this whole path exists to prevent.

---

## Path B — sending PC wholesale to its own Lovable project

For `my-pc-companion`, where PC *is* the app.

**Lovable will not import a repo you point it at.** It creates its own repo,
pushes its edits up, and pulls commits back down. Only that last direction is
usable from outside, so the way in is to put the code into the repo Lovable
already made.

### Setup, once

1. github.com → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
   - Repository access: **only** the destination repo
   - Permissions: **Contents → Read and write**
2. In **this** repo → Settings → Secrets and variables → Actions → New
   repository secret, named `LOVABLE_SYNC_TOKEN`.

The token is only ever read into the git remote URL inside the run, never
printed, so it cannot leak into the run log.

### Each time

1. Actions → **Send code to Lovable** → **Run workflow**.
2. Leave the defaults (branch `pc-import`, overwrite off).
3. The run **builds first** and sends nothing if the build fails — you cannot
   strand a broken tree on the far side.
4. Merge `pc-import` into the destination's default branch. Lovable pulls it.

### What does not work over there

PC serves its own Express host (`server.ts`), and the frontend calls it at
same-origin `/api/*`. Lovable hosts a frontend plus Supabase edge functions —
there is no Express, so those routes 404:

| Route | Apps |
|---|---|
| `/api/gemini/generate` | Gemini-backed AI, Agent Builder |
| `/api/jacky/*` | Mission Control, Ask Jackie — these fall back offline by design |
| `/api/ollama/*` | On-Device Models |
| `/api/term-fs/*`, `/api/shell` | ai-term, terminal file ops |
| `/api/telegram/send` | notifications, actions |
| `/api/build/run` | Cloud Deploy |
| `/api/health/providers` | fallback orchestrator |

Everything browser-only — window manager, desktop, themes, storage/pods,
compression and vault, games — works unchanged.

Closing that gap means porting those routes to Supabase edge functions. Jackie
already has 32 of them, including `jacky-proxy`; that is the Wave 1 work in
`FLEET_PARITY_PLAN.md`, and a separate job from either sync.

## Related

- `FLEET_PARITY_PLAN.md` — strategy across PC / Eru / Jackie
- `PARITY_MATRIX.md` — per-capability status
- `scripts/build-pc-os-embed.mjs` — the embed build
- `.github/workflows/refresh-pc-in-jackie.yml` — Path A, automated
- `.github/workflows/sync-to-lovable.yml` — Path B, the wholesale sync
