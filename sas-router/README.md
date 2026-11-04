# SAS Router

One file, no installs. It sends your AI requests to whichever provider is working: Ollama, Groq, Cerebras, OpenRouter, Mistral or Gemini.

- **Failover:** if a provider is rate-limited, out of credits or down, it moves to the next one and sets the failed one aside for a while.
- **Retired models:** each provider has a short list of models. A retired model is skipped for 24h and the next one is tried.
- **Big inputs:** splits them into chunks, then merges the answers.
- **Privacy labels:** `--private` uses your local Ollama only. `--no-train` skips providers whose free tier may train on your prompts.
- **Nothing to break into:** opens no ports and runs no server. Keys come from environment variables, never from code.

```sh
node sas-router.mjs selftest                       # 12 checks, no internet needed
node sas-router.mjs status                         # what's ready, health, usage
GROQ_API_KEY=... node sas-router.mjs ask "Summarize" --file notes.txt
```

Free tiers and model names change. Run `discover` to see what exists today, and pin a model with `<PROVIDER>_MODEL`. The model lists were checked against provider deprecation notices in Nov 2026.
