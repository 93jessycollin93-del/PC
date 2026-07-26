# Jackie shell — standalone chat prototype

A self-contained, vanilla-JS Jackie chat interface. No build step, no
framework, no dependency on the React PC app that surrounds it. It came from
the `yyb84ycgt6-oss/PC` fork, where it was added by the "Integrate Jackie
visual reference" and "Polish Jackie visual shell" commits.

## Status: unwired

**This prototype has no HTML entry point.** `src/app.js` binds to elements with
the ids `composer`, `message`, `chat`, `welcome`, `energy` and `energyValue`,
but no page in the repository declares them — the root `index.html` belongs to
the React PC app. It was never reachable in the fork either.

It is preserved here, intact and in its own directory, so the design work isn't
lost. To bring it up you need an `index.html` that provides those ids and loads
`src/app.js` as a module alongside `styles.css`.

## What's here

| File | Role |
|---|---|
| `src/app.js` | Composer, chat rendering, thread state |
| `src/memory.js` | Rolling 12-entry conversation memory in `localStorage` |
| `src/purposeGraph.js` | Matches a message against prior goals by shared words |
| `src/balanceTuner.js` | Maps a 1–5 energy dial to response length and warmth |
| `src/jackiePrompt.js` | Jackie's system prompt |
| `src/markdown.js` | Small HTML-escaping markdown renderer |
| `styles.css` | Full visual design — serif display type, gold/violet accents |
| `server.js` | Static file server plus a stubbed `POST /api/chat` |

`server.js` returns a canned reply rather than calling a model; the comment in
it marks where a real provider call belongs. It is a separate server from the
PC app's `server.ts` and does not run as part of `npm run dev`.
