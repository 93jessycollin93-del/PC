---
name: Mock/simulation removal pass
description: Where "real mode only, no simulation toggle" behavior lives and what stayed a deliberate scope cut.
---

- Real mode is the only mode across the PC's apps (not the pod system, not LocalAiIndexFinder — those were out of scope). No app should have a mock/real toggle; if real behavior isn't possible in-browser (raw ICMP, NIC config, OS process control, live `top`), show an honest "not available" message instead of fabricating output.
- `server.ts` gained real endpoints other apps now depend on: `/api/shell/exec` (whitelisted commands via `execFile`, cwd restricted to the workspace, args blocked from containing `..`), `/api/build/run` (runs the real `npm run build`), `/api/health/providers` (live reachability checks for Gemini/Groq/DeepSeek/Anthropic). `/api/ollama/tags` only returns real data if `OLLAMA_ENDPOINT` is set; otherwise it honestly reports no local models instead of a hardcoded catalog.
- **Why:** user explicitly wants no fake/simulated behavior anywhere, and no on/off simulation toggle — "real is the only mode."
- **How to apply:** when adding a new PC app or feature, prefer wiring to real infra already present (this container's shell, Gemini client, Firestore) over simulating; if something is genuinely impossible in a browser sandbox, say so rather than faking success.
- Scope cut (not yet confirmed with user): AiTermApp's virtual home-directory filesystem (README.md, notes.txt, `.zshrc` etc. browsed via `ls`/`cd`/`cat`) was left as a stylized sandbox rather than wired to the real filesystem, to keep scope manageable.
- Per user instruction, apps that are fundamentally games (Snake, Chess, etc.) are skipped entirely from any future real-ification passes — don't spend time on fake game logic.
