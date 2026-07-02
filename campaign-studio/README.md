# Campaign Concept Studio

A full-stack studio for marketing teams. Enter a short campaign brief — audience, product
details, tone, and channels — and get back a complete concept package:

- **Campaign concept** — name, tagline, key message, and rationale
- **3 copy variants** (A/B/C) — headline + body pairs with per-channel "best fit" notes
- **Launch checklist** — grouped by phase (Prep → Build → Launch → Measure)
- **Campaign artwork** — image prompts and generated images in three aspect ratios

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, and the
**OpenAI Responses API** (structured text output + the `image_generation` tool —
no legacy Completions or Chat Completions code).

---

## Prerequisites

- Node.js 20.9+ (Node 22/24 recommended)
- An OpenAI API key with access to `gpt-5.5` and GPT Image models
  (image generation may require [organization verification](https://help.openai.com/en/articles/10910291-api-organization-verification))

## Install

```bash
cd campaign-studio
npm install
```

## Environment setup

Copy the template and add your key:

```bash
cp .env.example .env.local
```

| Variable         | Required | Description                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | Yes*     | Server-side OpenAI key. Never exposed to the browser.                       |
| `MOCK_AI`        | No       | Set to `1` to run without a key: canned concept data + SVG placeholder art. |

\* Not required when `MOCK_AI=1`.

`.env.local` is gitignored; only `.env.example` is committed.

## Run

```bash
npm run dev        # http://localhost:3000
```

Keyless demo mode (no OpenAI calls, useful for UI work and CI):

```bash
MOCK_AI=1 npm run dev          # macOS/Linux
$env:MOCK_AI="1"; npm run dev  # Windows PowerShell
```

## Build & production

```bash
npm run build
npm start
```

`npm run lint` runs ESLint.

---

## Client/server boundary

All OpenAI calls happen **server-side only**. The browser never sees the API key.

```
Browser (React client components)
  │  POST /api/generate   { brief, audience, product, tone, channels }
  │  POST /api/image      { prompt, aspect }        ← one call per image, in parallel
  ▼
Next.js Route Handlers (Node runtime)
  ├─ src/app/api/generate/route.ts   → responses.parse() + zodTextFormat (structured output)
  └─ src/app/api/image/route.ts      → responses.create() + image_generation tool
        ▼
     src/lib/ai/client.ts            → OpenAI SDK client (import "server-only")
```

Enforcement:

- `src/lib/ai/client.ts` and `src/lib/ai/errors.ts` import `"server-only"` — any accidental
  client import fails the build.
- Client components (`src/components/*`) only ever call the two internal API routes.
- Shared modules (`src/lib/schemas.ts`, `options.ts`, `types.ts`, `ai/config.ts`) are pure
  data/validation code, safe on either side.
- Requests are validated with zod on the server before any OpenAI call; errors are returned
  as `{ error: { code, message } }` with proper status codes.

## Deployment

Any Node-capable host works. For **Vercel**:

1. Import the repo, set the project root to `campaign-studio/`.
2. Add `OPENAI_API_KEY` in Project Settings → Environment Variables.
3. Deploy. The routes export `maxDuration` (60s generate / 120s image) — allowed on
   Hobby/Pro with fluid compute; adjust if your plan caps function duration lower.

For self-hosting: `npm run build && npm start` behind a reverse proxy, with
`OPENAI_API_KEY` in the process environment.

---

## Validation plan

**1. Keyless UI walkthrough (mock mode)** — run with `MOCK_AI=1` and verify:

- Empty state renders (pasteboard with registration marks)
- Submitting an empty form shows inline validation on all four required fields
- Valid submit → loading board (IN PRODUCTION stamp, skeletons, cycling status)
- Ready board: proof bar (channel chips + job №), concept, 3 variants, phased checklist,
  3 aspect-correct images, collapsible image-prompt list
- Image failure isolation: block `/api/image` (devtools request blocking) → each slot shows
  its own "Render failed" slip + **Re-run plate**; retry recovers the slot without
  regenerating the text package

**2. Server contract tests** — POST bad payloads to `/api/generate` (missing fields, wrong
enum casing) and expect `400 invalid_brief`; valid payloads return the full package shape
(zod-parsed structured output, so malformed model output is caught server-side).

**3. Live-key smoke test** — unset `MOCK_AI`, set a real key, run one brief end-to-end.
Check latency (concept ~10–30s, images ~30–90s), image relevance to prompts, and that
`revisedPrompt` comes back on images.

**4. Later hardening** — add an eval set of 5–10 briefs across tones/channels and score
concept faithfulness; add rate limiting on the API routes before public exposure.

## Where to tune models, prompts, and image settings

Every OpenAI knob lives in one object — `aiConfig` in `src/lib/ai/config.ts`:

| What                                            | Where                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Text model, reasoning effort, verbosity          | `aiConfig.text` (`model`, `reasoningEffort`, `verbosity`)        |
| Image model, quality, format, sizes per aspect   | `aiConfig.image` (`toolModel`, `quality`, `outputFormat`, `outputCompression`, `sizes`) |
| Max images rendered per job (cost guard)         | `aiConfig.maxImagePrompts`                                       |
| System instructions & brief → prompt builders    | `src/lib/ai/prompts.ts`                                          |
| Output shape (variants count, checklist phases)  | `src/lib/schemas.ts` (`conceptPackageSchema`) — the UI renders whatever the schema allows |
| Tone/channel/aspect option lists                 | `src/lib/options.ts`                                             |

Examples: swap `text.model` to a mini-class model to cut cost while testing; raise
`text.reasoningEffort` from `"low"` to `"medium"`/`"high"` for deeper strategy (only if
evals show it helps); set `image.quality: "high"` for final-grade art (slower, costlier);
ask for 5 copy variants by updating the `.describe()` counts on `conceptPackageSchema` and
the instruction text in `prompts.ts` (strict structured outputs enforce shape; counts are
steered by the schema descriptions + instructions). The config file's doc comment covers
each knob in more detail.
