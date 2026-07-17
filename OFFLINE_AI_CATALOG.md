# Jackie's PC — Offline AI Catalog

**Real, on-device / self-hostable AI. No cloud, no keys, no round-trips.**

Every model below runs **offline** once downloaded. The ladder spans the full range you
asked for — from a **~20-byte (0.02 kB) rule matrix** up to a **~50 GB 70B LLM** — and each
row links to a **canonical upstream repository or file**. Nothing here is simulated.

> **Authenticity note.** Sizes come from the upstream file listings. Entries marked ✅ were
> cross-checked against Hugging Face / upstream at authoring time (2026‑07‑12). Always confirm
> the live file size before a large pull. This catalog is the human-readable twin of the typed
> source of truth in [`lib/offlineAiCatalog.ts`](lib/offlineAiCatalog.ts), which the app consumes.

---

## How to read this

| Column | Meaning |
| --- | --- |
| **Size** | Recommended download (quantized where relevant) |
| **Runs on** | The offline engine that executes it (see [Runtimes](#offline-runtimes)) |
| **Where** | 🌐 browser · 🖥️ desktop · ⚙️ both |
| **License** | What you may redistribute (matters for "download a ton to my cloud") |
| ✅ | Link + size verified against upstream at authoring time |

---

## Tier 0 — Rule / heuristic · **bytes → ~1 MB**

The honest floor of the ladder. These are not neural networks — they are tiny, real, and run with zero network.

| Model | Task | Size | Runs on | Where | License | Link |
| --- | --- | --- | --- | --- | --- | --- |
| **Jackie Index-01 Rule Matrix** | intent routing | **~20 B (0.02 kB)** ✅ | rule engine | ⚙️ | MIT (in-repo) | [`LocalAiIndexFinder.tsx`](components/LocalAiIndexFinder.tsx) |
| **fastText lid.176 (compressed)** | language ID (176 langs) | **917 kB** ✅ | fastText WASM | ⚙️ | CC‑BY‑SA‑3.0 | [repo](https://huggingface.co/julien-c/fasttext-language-id) · [.ftz](https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz) |

## Tier 1 — Micro ONNX / Transformers.js · **~10 MB → ~200 MB**

Real neural models that run **in a browser tab** via WebAssembly / WebGPU.

| Model | Task | Size | Runs on | Where | License | Link |
| --- | --- | --- | --- | --- | --- | --- |
| **all-MiniLM-L6-v2** (ONNX) | embeddings (384-d) | ~23 MB ✅ | Transformers.js | 🌐 | Apache‑2.0 | [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) |
| **bge-small-en-v1.5** (ONNX) | embeddings | ~34 MB | Transformers.js | 🌐 | MIT | [Xenova/bge-small-en-v1.5](https://huggingface.co/Xenova/bge-small-en-v1.5) |
| **DistilBERT SST-2** (ONNX) | sentiment | ~25 MB | Transformers.js | 🌐 | Apache‑2.0 | [Xenova/distilbert-sst-2](https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english) |
| **Whisper tiny.en** (ONNX) | speech→text | ~40 MB | Transformers.js | 🌐 | MIT | [Xenova/whisper-tiny.en](https://huggingface.co/Xenova/whisper-tiny.en) |
| **whisper.cpp ggml tiny.en** | speech→text | 75 MB (q5_1: 32 MB) ✅ | whisper.cpp | ⚙️ | MIT | [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) |
| **SmolLM2-135M-Instruct** (ONNX int8) | text generation | 137 MB ✅ | Transformers.js | 🌐 | Apache‑2.0 | [HuggingFaceTB/SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) |

## Tier 2 — Small on-device LLM · **~200 MB → ~1 GB**

The smallest **real chat models**. WebLLM entries run in-browser on WebGPU.

| Model | Task | Size | Runs on | Where | License | Link |
| --- | --- | --- | --- | --- | --- | --- |
| **SmolLM2-360M-Instruct** | chat | ~380 MB | Transformers.js / WebLLM | 🌐 | Apache‑2.0 | [HuggingFaceTB/SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) |
| **Qwen2.5-0.5B-Instruct** (GGUF) | chat | ~0.4 GB | wllama / Ollama | ⚙️ | Apache‑2.0 | [Qwen/Qwen2.5-0.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) |
| **Llama-3.2-1B-Instruct** (MLC) | chat | ~705 MB ✅ | WebLLM | 🌐 | Llama‑3.2 | [mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC](https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC) |
| **whisper.cpp ggml small** | speech→text | 466 MB ✅ | whisper.cpp | ⚙️ | MIT | [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) |
| **SmolLM2-1.7B-Instruct** | chat | ~1.0 GB | llama.cpp / Ollama | ⚙️ | Apache‑2.0 | [HuggingFaceTB/SmolLM2-1.7B-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct) |

## Tier 3 — Mid quantized LLM · **~1 GB → ~5 GB**

The 2B–8B sweet spot: capable local assistants for a normal machine.

| Model | Task | Size | Runs on | Where | License | Link |
| --- | --- | --- | --- | --- | --- | --- |
| **gemma-2-2b-it** (GGUF) | chat | 1.71 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Gemma | [bartowski/gemma-2-2b-it-GGUF](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF) |
| **Llama-3.2-3B-Instruct** (MLC) | chat | ~1.9 GB ✅ | WebLLM | 🌐 | Llama‑3.2 | [mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC](https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC) |
| **Phi-3-mini-4k-instruct** (GGUF q4) | chat | 2.39 GB ✅ | llama.cpp / Ollama | 🖥️ | MIT | [microsoft/Phi-3-mini-4k-instruct-gguf](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf) |
| **Mistral-7B-Instruct-v0.3** (GGUF) | chat | ~4.4 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Apache‑2.0 | [bartowski/Mistral-7B-Instruct-v0.3-GGUF](https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF) |
| **Qwen2.5-7B-Instruct** (GGUF) | chat | ~4.68 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Apache‑2.0 | [Qwen/Qwen2.5-7B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) |
| **Meta-Llama-3.1-8B-Instruct** (GGUF) | chat | ~4.9 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Llama‑3.1 | [bartowski/Meta-Llama-3.1-8B-Instruct-GGUF](https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF) |
| **Qwen2.5-Coder-7B-Instruct** (GGUF) | code | ~4.7 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Apache‑2.0 | [Qwen/Qwen2.5-Coder-7B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF) |

## Tier 4 — Large quantized LLM · **~5 GB → ~20 GB**

9B–47B class. Needs a real GPU or a lot of RAM.

| Model | Task | Size | Runs on | Where | License | Link |
| --- | --- | --- | --- | --- | --- | --- |
| **gemma-2-9b-it** (GGUF) | chat | ~5.4 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Gemma | [bartowski/gemma-2-9b-it-GGUF](https://huggingface.co/bartowski/gemma-2-9b-it-GGUF) |
| **Qwen2.5-14B-Instruct** (GGUF) | chat | ~9.0 GB (Q4_K_M) ✅ | llama.cpp / Ollama | 🖥️ | Apache‑2.0 | [Qwen/Qwen2.5-14B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF) |
| **Mixtral-8x7B-Instruct-v0.1** (GGUF Q3_K_M) | chat | ~20 GB ✅ | llama.cpp / Ollama | 🖥️ | Apache‑2.0 | [TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF](https://huggingface.co/TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF) |

## Tier 5 — Very large quantized LLM · **~20 GB → ~50 GB (the ceiling)**

32B–70B class. Workstation territory. This is the top of the ladder you asked for.

| Model | Task | Size | Runs on | Where | License | Link |
| --- | --- | --- | --- | --- | --- | --- |
| **gemma-2-27b-it** (GGUF Q6_K) | chat | ~22 GB (Q4_K_M: ~16.6 GB) ✅ | llama.cpp / Ollama | 🖥️ | Gemma | [bartowski/gemma-2-27b-it-GGUF](https://huggingface.co/bartowski/gemma-2-27b-it-GGUF) |
| **Qwen2.5-32B-Instruct** (GGUF Q6_K) | chat | ~27 GB ✅ | llama.cpp / Ollama | 🖥️ | Apache‑2.0 | [Qwen/Qwen2.5-32B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-GGUF) |
| **Llama-3.3-70B-Instruct** (GGUF Q4_K_M) | chat | **42.5 GB** ✅ | llama.cpp / Ollama | 🖥️ | Llama‑3.3 | [bartowski/Llama-3.3-70B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF) |
| **Llama-3.3-70B-Instruct** (GGUF Q5_K_M) | chat | **~49.9 GB** ✅ | llama.cpp / Ollama | 🖥️ | Llama‑3.3 | [bartowski/Llama-3.3-70B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF) |

> The 70B **Q5_K_M** (~49.9 GB) is the intentional ceiling. Q6/Q8 quants of 70B exceed 50 GB.

---

## Offline runtimes

You need one of these engines to actually run a model with no cloud. Pick by where you want it to run.

| Runtime | Runs | Where | Link |
| --- | --- | --- | --- |
| **Transformers.js** | ONNX models in-browser (WASM/WebGPU) | 🌐 | https://github.com/huggingface/transformers.js |
| **ONNX Runtime Web** | any `.onnx` graph in-browser | 🌐 | https://github.com/microsoft/onnxruntime |
| **WebLLM** | MLC-compiled LLMs on WebGPU | 🌐 | https://github.com/mlc-ai/web-llm |
| **wllama** | GGUF in-browser (llama.cpp → WASM) | 🌐 | https://github.com/ngxson/wllama |
| **whisper.cpp** | ggml Whisper speech-to-text | ⚙️ | https://github.com/ggml-org/whisper.cpp |
| **llama.cpp** | GGUF LLMs natively (CPU/GPU) | 🖥️ | https://github.com/ggml-org/llama.cpp |
| **Ollama** | GGUF LLMs with one-line pulls | 🖥️ | https://github.com/ollama/ollama |
| **fastText** | `.ftz` / `.bin` classifiers | ⚙️ | https://github.com/facebookresearch/fastText |

**Desktop managers:** [LM Studio](https://lmstudio.ai) · [GPT4All](https://github.com/nomic-ai/gpt4all) · [node-llama-cpp](https://github.com/withcatai/node-llama-cpp)

---

## The size ladder at a glance

```
0.02 kB  ▏ Jackie Index-01 rule matrix        (rule engine, in-app)
 917 kB  ▏ fastText lid.176                    (language ID)
  23 MB  ▎ all-MiniLM-L6-v2                     (browser embeddings)
 137 MB  ▍ SmolLM2-135M                         (browser text-gen)
 705 MB  ▋ Llama-3.2-1B  (WebLLM)               (browser chat)
2.39 GB  █▍ Phi-3-mini-4k                        (desktop chat)
4.9 GB   ██▊ Llama-3.1-8B                         (desktop chat)
  20 GB  ██████████ Mixtral-8x7B (Q3)             (workstation)
42.5 GB  ██████████████████████ Llama-3.3-70B (Q4) (workstation)
~50 GB   ████████████████████████ Llama-3.3-70B (Q5) ← ceiling
```

---

## Next step (your call)

You said you'll have me **download a ton of these to your cloud** — this catalog is the link list to
pick from **first**. When you're ready, tell me **which tiers / models** and **which cloud bucket**,
and I'll fetch them there. Wiring these real models into the app's on-device finder (replacing the
current simulated "model download") is tracked separately as part of the de‑simulation work.
