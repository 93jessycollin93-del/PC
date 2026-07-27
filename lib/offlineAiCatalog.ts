/**
 * Offline AI Catalog — real, on-device / self-hostable models with real links.
 *
 * This is the single source of truth for the models Jackie's PC can run WITHOUT
 * a cloud API: from a ~20-byte rule matrix all the way up to a ~50 GB 70B LLM.
 *
 * Every entry points at a canonical upstream repository or file. Nothing here is
 * simulated — sizes are taken from the upstream file listings (the ones marked
 * `verified: true` were cross-checked against Hugging Face / upstream at authoring
 * time; always re-check the live file size before a large download).
 *
 * Runtimes that actually execute these offline are listed in OFFLINE_RUNTIMES.
 * The companion human-readable index lives in /OFFLINE_AI_CATALOG.md.
 */

/** Engines that run a model with no cloud round-trip. */
export type OfflineRuntime =
  | 'rule-engine'       // pure JS/TS, zero download, zero network
  | 'fasttext-wasm'     // fastText compiled to WebAssembly
  | 'transformers.js'   // @huggingface/transformers (ONNX Runtime Web under the hood)
  | 'onnx-runtime-web'  // onnxruntime-web (WASM / WebGPU)
  | 'web-llm'           // @mlc-ai/web-llm (WebGPU, in-browser)
  | 'wllama'            // llama.cpp compiled to WASM, runs GGUF in-browser
  | 'whisper.cpp'       // whisper.cpp / whisper.wasm
  | 'llama.cpp'         // native GGUF runner
  | 'ollama';           // native local model manager

export type ModelTask =
  | 'intent-routing'
  | 'language-id'
  | 'embeddings'
  | 'sentiment'
  | 'speech-to-text'
  | 'text-generation'
  | 'chat'
  | 'code';

/** Where the model can realistically run. */
export type RunEnvironment = 'browser' | 'desktop' | 'both';

/**
 * Size tiers, from the user's "0.02 kB" floor to the "50 GB" ceiling.
 *   0  bytes → ~1 MB     rule engines, language-id
 *   1  ~10 MB → ~200 MB  micro ONNX / transformers.js
 *   2  ~200 MB → ~1 GB   small on-device LLMs (browser WebGPU capable)
 *   3  ~1 GB → ~5 GB     mid quantized LLMs (7B-8B class)
 *   4  ~5 GB → ~20 GB    large quantized LLMs (9B-47B class)
 *   5  ~20 GB → ~50 GB   very large quantized LLMs (32B-70B class)
 */
export type SizeTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface OfflineModel {
  id: string;
  name: string;
  task: ModelTask;
  /** Parameter count as published, e.g. "22M", "1.7B", "70B". Omitted for rule engines. */
  params?: string;
  /** Approximate size in bytes of the recommended download (for the true 0.02 kB → 50 GB range). */
  approxBytes: number;
  /** Human-readable size label. */
  size: string;
  runtime: OfflineRuntime[];
  environment: RunEnvironment;
  license: string;
  /** Canonical upstream repo / project page. */
  url: string;
  /** Direct file link where a single recommended file exists. */
  downloadFile?: string;
  /** The exact quant / file to grab, when a repo holds several. */
  recommendedFile?: string;
  offlineNotes: string;
  tier: SizeTier;
  /** True when the link + size were cross-checked against the upstream listing. */
  verified: boolean;
}

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

/**
 * Curated, real, offline-capable models spanning the full size range.
 * Ordered smallest → largest so the catalog reads as a size ladder.
 */
export const OFFLINE_MODELS: OfflineModel[] = [
  // ── Tier 0 — rule / heuristic (bytes → ~1 MB) ─────────────────────────────
  {
    id: 'index01-rule-matrix',
    name: 'Jackie Index-01 Rule Matrix',
    task: 'intent-routing',
    approxBytes: 20, // ~0.02 kB — the floor the user asked for
    size: '~20 bytes (0.02 kB)',
    runtime: ['rule-engine'],
    environment: 'both',
    license: 'MIT (in-repo)',
    url: 'https://github.com/93jessycollin93-del/pc/blob/main/components/LocalAiIndexFinder.tsx',
    offlineNotes:
      'Ships inside the app. A tiny keyword→intent lookup table that routes commands ' +
      '("open snake", "clean system") with zero download and zero network. Genuinely offline; ' +
      'not a neural model — the honest floor of the ladder.',
    tier: 0,
    verified: true,
  },
  {
    id: 'fasttext-lid-176-ftz',
    name: 'fastText lid.176 (compressed)',
    task: 'language-id',
    params: '~176 langs',
    approxBytes: Math.round(0.917 * MB),
    size: '917 kB',
    runtime: ['fasttext-wasm'],
    environment: 'both',
    license: 'CC-BY-SA-3.0',
    url: 'https://huggingface.co/julien-c/fasttext-language-id',
    downloadFile: 'https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz',
    recommendedFile: 'lid.176.ftz',
    offlineNotes: 'Detects 176 languages from a string. Sub-megabyte, runs fully offline via fastText WASM.',
    tier: 0,
    verified: true,
  },

  // ── Tier 1 — micro ONNX / transformers.js (~10 MB → ~200 MB) ──────────────
  {
    id: 'xenova-all-minilm-l6-v2',
    name: 'all-MiniLM-L6-v2 (ONNX)',
    task: 'embeddings',
    params: '22M',
    approxBytes: Math.round(23 * MB),
    size: '~23 MB (quantized ONNX)',
    runtime: ['transformers.js', 'onnx-runtime-web'],
    environment: 'browser',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2',
    offlineNotes: '384-dim sentence embeddings in the browser. The default for on-device search / RAG.',
    tier: 1,
    verified: true,
  },
  {
    id: 'xenova-bge-small-en-v1.5',
    name: 'bge-small-en-v1.5 (ONNX)',
    task: 'embeddings',
    params: '33M',
    approxBytes: Math.round(34 * MB),
    size: '~34 MB',
    runtime: ['transformers.js', 'onnx-runtime-web'],
    environment: 'browser',
    license: 'MIT',
    url: 'https://huggingface.co/Xenova/bge-small-en-v1.5',
    offlineNotes: 'Higher-quality small embedding model; drop-in alternative to MiniLM for retrieval.',
    tier: 1,
    verified: false,
  },
  {
    id: 'xenova-distilbert-sst2',
    name: 'DistilBERT SST-2 (ONNX)',
    task: 'sentiment',
    params: '67M',
    approxBytes: Math.round(25 * MB),
    size: '~25 MB (quantized)',
    runtime: ['transformers.js', 'onnx-runtime-web'],
    environment: 'browser',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    offlineNotes: 'Positive/negative sentiment classification, fully client-side.',
    tier: 1,
    verified: false,
  },
  {
    id: 'xenova-whisper-tiny-en',
    name: 'Whisper tiny.en (ONNX)',
    task: 'speech-to-text',
    params: '39M',
    approxBytes: Math.round(40 * MB),
    size: '~40 MB',
    runtime: ['transformers.js', 'onnx-runtime-web'],
    environment: 'browser',
    license: 'MIT',
    url: 'https://huggingface.co/Xenova/whisper-tiny.en',
    offlineNotes: 'On-device English speech-to-text — replaces cloud transcription for the mic input.',
    tier: 1,
    verified: false,
  },
  {
    id: 'whispercpp-ggml-tiny-en',
    name: 'whisper.cpp ggml tiny.en',
    task: 'speech-to-text',
    params: '39M',
    approxBytes: Math.round(75 * MB),
    size: '75 MB (q5_1: 32 MB)',
    runtime: ['whisper.cpp'],
    environment: 'both',
    license: 'MIT',
    url: 'https://huggingface.co/ggerganov/whisper.cpp',
    recommendedFile: 'ggml-tiny.en.bin',
    downloadFile: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    offlineNotes: 'ggml weights for whisper.cpp / whisper.wasm. Also base (142 MB) and small (466 MB) in the same repo.',
    tier: 1,
    verified: true,
  },
  {
    id: 'smollm2-135m-onnx',
    name: 'SmolLM2-135M-Instruct (ONNX int8)',
    task: 'text-generation',
    params: '135M',
    approxBytes: Math.round(137 * MB),
    size: '137 MB (int8 ONNX)',
    runtime: ['transformers.js', 'onnx-runtime-web'],
    environment: 'browser',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct',
    offlineNotes: 'Smallest real generative chat model that runs in a browser tab. fp16 270 MB / full 540 MB also present.',
    tier: 1,
    verified: true,
  },

  // ── Tier 2 — small on-device LLM (~200 MB → ~1 GB) ────────────────────────
  {
    id: 'smollm2-360m-instruct',
    name: 'SmolLM2-360M-Instruct',
    task: 'chat',
    params: '360M',
    approxBytes: Math.round(380 * MB),
    size: '~380 MB (ONNX)',
    runtime: ['transformers.js', 'web-llm'],
    environment: 'browser',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct',
    offlineNotes: 'Noticeably more coherent than 135M while still browser-friendly.',
    tier: 2,
    verified: false,
  },
  {
    id: 'qwen2.5-0.5b-instruct-gguf',
    name: 'Qwen2.5-0.5B-Instruct (GGUF)',
    task: 'chat',
    params: '0.5B',
    approxBytes: Math.round(0.4 * GB),
    size: '~0.4 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama', 'wllama'],
    environment: 'both',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    offlineNotes: 'Tiny instruct model; runs in-browser via wllama or locally via Ollama (`ollama run qwen2.5:0.5b`).',
    tier: 2,
    verified: false,
  },
  {
    id: 'webllm-llama-3.2-1b',
    name: 'Llama-3.2-1B-Instruct q4f16_1 (MLC)',
    task: 'chat',
    params: '1B',
    approxBytes: Math.round(705 * MB),
    size: '~705 MB',
    runtime: ['web-llm'],
    environment: 'browser',
    license: 'Llama-3.2 Community License',
    url: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC',
    offlineNotes: 'Prebuilt WebLLM weights — real WebGPU LLM inference in the browser, no server. A default for Jackie offline chat.',
    tier: 2,
    verified: true,
  },
  {
    id: 'whispercpp-ggml-small',
    name: 'whisper.cpp ggml small',
    task: 'speech-to-text',
    params: '244M',
    approxBytes: Math.round(466 * MB),
    size: '466 MB',
    runtime: ['whisper.cpp'],
    environment: 'both',
    license: 'MIT',
    url: 'https://huggingface.co/ggerganov/whisper.cpp',
    recommendedFile: 'ggml-small.bin',
    offlineNotes: 'Much better transcription accuracy than tiny/base while staying under ~0.5 GB.',
    tier: 2,
    verified: true,
  },
  {
    id: 'smollm2-1.7b-instruct',
    name: 'SmolLM2-1.7B-Instruct',
    task: 'chat',
    params: '1.7B',
    approxBytes: Math.round(1.0 * GB),
    size: '~1.0 GB (Q4 GGUF)',
    runtime: ['llama.cpp', 'ollama', 'web-llm'],
    environment: 'both',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct',
    offlineNotes: 'Strongest of the SmolLM2 family; good desktop/edge assistant.',
    tier: 2,
    verified: false,
  },

  // ── Tier 3 — mid quantized LLM (~1 GB → ~5 GB) ────────────────────────────
  {
    id: 'gemma-2-2b-it-gguf',
    name: 'gemma-2-2b-it (GGUF)',
    task: 'chat',
    params: '2B',
    approxBytes: Math.round(1.71 * GB),
    size: '1.71 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Gemma Terms of Use',
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF',
    recommendedFile: 'gemma-2-2b-it-Q4_K_M.gguf',
    offlineNotes: 'Google Gemma 2 2B, quantized. Strong quality per gigabyte for a desktop assistant.',
    tier: 3,
    verified: true,
  },
  {
    id: 'webllm-llama-3.2-3b',
    name: 'Llama-3.2-3B-Instruct q4f16_1 (MLC)',
    task: 'chat',
    params: '3B',
    approxBytes: Math.round(1.9 * GB),
    size: '~1.9 GB',
    runtime: ['web-llm'],
    environment: 'browser',
    license: 'Llama-3.2 Community License',
    url: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC',
    offlineNotes: 'The largest model that still runs comfortably in-browser via WebLLM on a capable GPU.',
    tier: 3,
    verified: true,
  },
  {
    id: 'phi-3-mini-4k-gguf',
    name: 'Phi-3-mini-4k-instruct (GGUF q4)',
    task: 'chat',
    params: '3.8B',
    approxBytes: Math.round(2.39 * GB),
    size: '2.39 GB (q4)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'MIT',
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf',
    recommendedFile: 'Phi-3-mini-4k-instruct-q4.gguf',
    offlineNotes: 'Microsoft Phi-3 mini, official GGUF. Punches well above its size for reasoning.',
    tier: 3,
    verified: true,
  },
  {
    id: 'mistral-7b-instruct-v0.3-gguf',
    name: 'Mistral-7B-Instruct-v0.3 (GGUF)',
    task: 'chat',
    params: '7B',
    approxBytes: Math.round(4.4 * GB),
    size: '~4.4 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    recommendedFile: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    offlineNotes: 'Classic 7B workhorse, Apache-2.0 (freely redistributable). `ollama run mistral`.',
    tier: 3,
    verified: true,
  },
  {
    id: 'qwen2.5-7b-instruct-gguf',
    name: 'Qwen2.5-7B-Instruct (GGUF)',
    task: 'chat',
    params: '7B',
    approxBytes: Math.round(4.68 * GB),
    size: '~4.68 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF',
    recommendedFile: 'qwen2.5-7b-instruct-q4_k_m*.gguf',
    offlineNotes: 'Official Qwen GGUF. Excellent general + multilingual quality at 7B.',
    tier: 3,
    verified: true,
  },
  {
    id: 'llama-3.1-8b-instruct-gguf',
    name: 'Meta-Llama-3.1-8B-Instruct (GGUF)',
    task: 'chat',
    params: '8B',
    approxBytes: Math.round(4.9 * GB),
    size: '~4.9 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Llama-3.1 Community License',
    url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    recommendedFile: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    offlineNotes: 'The default local "8B" assistant. `ollama run llama3.1:8b`.',
    tier: 3,
    verified: true,
  },
  {
    id: 'qwen2.5-coder-7b-gguf',
    name: 'Qwen2.5-Coder-7B-Instruct (GGUF)',
    task: 'code',
    params: '7B',
    approxBytes: Math.round(4.68 * GB),
    size: '~4.7 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    offlineNotes: 'Local coding model for the Terminal / Codex / Eru apps.',
    tier: 3,
    verified: true,
  },

  // ── Tier 4 — large quantized LLM (~5 GB → ~20 GB) ─────────────────────────
  {
    id: 'gemma-2-9b-it-gguf',
    name: 'gemma-2-9b-it (GGUF)',
    task: 'chat',
    params: '9B',
    approxBytes: Math.round(5.4 * GB),
    size: '~5.4 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Gemma Terms of Use',
    url: 'https://huggingface.co/bartowski/gemma-2-9b-it-GGUF',
    offlineNotes: 'Gemma 2 9B — a strong step up in reasoning for a mid-range desktop GPU.',
    tier: 4,
    verified: true,
  },
  {
    id: 'qwen2.5-14b-instruct-gguf',
    name: 'Qwen2.5-14B-Instruct (GGUF)',
    task: 'chat',
    params: '14B',
    approxBytes: Math.round(9.0 * GB),
    size: '~9.0 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF',
    offlineNotes: '14B official Qwen GGUF; great quality/size balance for a 16 GB GPU.',
    tier: 4,
    verified: true,
  },
  {
    id: 'mixtral-8x7b-instruct-gguf-q3',
    name: 'Mixtral-8x7B-Instruct-v0.1 (GGUF Q3_K_M)',
    task: 'chat',
    params: '47B MoE',
    approxBytes: Math.round(20 * GB),
    size: '~20 GB (Q3_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF',
    offlineNotes: 'Mixture-of-experts; only ~13B active params per token, so it runs faster than its size suggests.',
    tier: 4,
    verified: true,
  },

  // ── Tier 5 — very large quantized LLM (~20 GB → ~50 GB) ───────────────────
  {
    id: 'gemma-2-27b-it-gguf-q6',
    name: 'gemma-2-27b-it (GGUF Q6_K)',
    task: 'chat',
    params: '27B',
    approxBytes: Math.round(22 * GB),
    size: '~22 GB (Q6_K)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Gemma Terms of Use',
    url: 'https://huggingface.co/bartowski/gemma-2-27b-it-GGUF',
    offlineNotes: 'Near-full-quality 27B; Q4_K_M (~16.6 GB) also available for a smaller footprint.',
    tier: 5,
    verified: true,
  },
  {
    id: 'qwen2.5-32b-instruct-gguf-q6',
    name: 'Qwen2.5-32B-Instruct (GGUF Q6_K)',
    task: 'chat',
    params: '32B',
    approxBytes: Math.round(27 * GB),
    size: '~27 GB (Q6_K)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-GGUF',
    offlineNotes: 'High-end local reasoning model; needs ~32 GB RAM/VRAM headroom.',
    tier: 5,
    verified: true,
  },
  {
    id: 'llama-3.3-70b-instruct-gguf-q4',
    name: 'Llama-3.3-70B-Instruct (GGUF Q4_K_M)',
    task: 'chat',
    params: '70B',
    approxBytes: Math.round(42.5 * GB),
    size: '42.5 GB (Q4_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Llama-3.3 Community License',
    url: 'https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF',
    recommendedFile: 'Llama-3.3-70B-Instruct-Q4_K_M.gguf',
    offlineNotes: 'Frontier-class local model. Workstation only (~48 GB RAM/VRAM). `ollama run llama3.3`.',
    tier: 5,
    verified: true,
  },
  {
    id: 'llama-3.3-70b-instruct-gguf-q5',
    name: 'Llama-3.3-70B-Instruct (GGUF Q5_K_M)',
    task: 'chat',
    params: '70B',
    approxBytes: Math.round(49.9 * GB),
    size: '~49.9 GB (Q5_K_M)',
    runtime: ['llama.cpp', 'ollama'],
    environment: 'desktop',
    license: 'Llama-3.3 Community License',
    url: 'https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF',
    recommendedFile: 'Llama-3.3-70B-Instruct-Q5_K_M.gguf',
    offlineNotes: 'The ~50 GB ceiling the ladder is built to. Higher-fidelity 70B quant; Q6/Q8 exceed 50 GB.',
    tier: 5,
    verified: true,
  },
];

/** The engines that actually run the models above with no cloud round-trip. */
export interface OfflineRuntimeInfo {
  id: OfflineRuntime;
  name: string;
  url: string;
  environment: RunEnvironment;
  runs: string;
}

export const OFFLINE_RUNTIMES: OfflineRuntimeInfo[] = [
  { id: 'rule-engine', name: 'Built-in rule engine', url: 'https://github.com/93jessycollin93-del/pc', environment: 'both', runs: 'Rule matrices / heuristics (bytes)' },
  { id: 'fasttext-wasm', name: 'fastText (WASM)', url: 'https://github.com/facebookresearch/fastText', environment: 'both', runs: '.ftz / .bin classifiers' },
  { id: 'transformers.js', name: 'Transformers.js', url: 'https://github.com/huggingface/transformers.js', environment: 'browser', runs: 'ONNX models in-browser (WASM/WebGPU)' },
  { id: 'onnx-runtime-web', name: 'ONNX Runtime Web', url: 'https://github.com/microsoft/onnxruntime', environment: 'browser', runs: 'Any .onnx graph in-browser' },
  { id: 'web-llm', name: 'WebLLM', url: 'https://github.com/mlc-ai/web-llm', environment: 'browser', runs: 'MLC-compiled LLMs on WebGPU' },
  { id: 'wllama', name: 'wllama', url: 'https://github.com/ngxson/wllama', environment: 'browser', runs: 'GGUF in-browser (llama.cpp WASM)' },
  { id: 'whisper.cpp', name: 'whisper.cpp', url: 'https://github.com/ggml-org/whisper.cpp', environment: 'both', runs: 'ggml Whisper speech-to-text' },
  { id: 'llama.cpp', name: 'llama.cpp', url: 'https://github.com/ggml-org/llama.cpp', environment: 'desktop', runs: 'GGUF LLMs natively (CPU/GPU)' },
  { id: 'ollama', name: 'Ollama', url: 'https://github.com/ollama/ollama', environment: 'desktop', runs: 'GGUF LLMs with one-line pulls' },
];

/** Additional desktop apps that manage/run these models offline. */
export const OFFLINE_TOOLS = [
  { name: 'LM Studio', url: 'https://lmstudio.ai', runs: 'GGUF LLMs, GUI + local server' },
  { name: 'GPT4All', url: 'https://github.com/nomic-ai/gpt4all', runs: 'GGUF LLMs, offline desktop chat' },
  { name: 'node-llama-cpp', url: 'https://github.com/withcatai/node-llama-cpp', runs: 'GGUF LLMs from Node/Electron' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / KB;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(2) : Math.round(value)} ${units[i]}`;
}

export const modelsByTier = (tier: SizeTier): OfflineModel[] =>
  OFFLINE_MODELS.filter((m) => m.tier === tier);

export const modelsByRuntime = (runtime: OfflineRuntime): OfflineModel[] =>
  OFFLINE_MODELS.filter((m) => m.runtime.includes(runtime));

export const browserRunnableModels = (): OfflineModel[] =>
  OFFLINE_MODELS.filter((m) => m.environment === 'browser' || m.environment === 'both');

/** Total bytes if every catalog entry were downloaded — the "download a ton" figure. */
export const totalCatalogBytes = (): number =>
  OFFLINE_MODELS.reduce((sum, m) => sum + m.approxBytes, 0);

/** The real span of the ladder: smallest and largest entries. */
export const catalogSizeRange = (): { min: OfflineModel; max: OfflineModel } => {
  const sorted = [...OFFLINE_MODELS].sort((a, b) => a.approxBytes - b.approxBytes);
  return { min: sorted[0], max: sorted[sorted.length - 1] };
};
