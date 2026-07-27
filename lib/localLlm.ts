/**
 * Real local LLM runtime — Transformers.js (ONNX Runtime Web under the hood).
 *
 * Loads and runs an actual on-device model with real download progress and
 * real generated text — no `Math.random()` progress bars, no canned output.
 * Model choice matches lib/offlineAiCatalog.ts's Tier 1 entry
 * ("smollm2-135m-onnx"), so the catalog and the runtime agree on what's real.
 *
 * Upstream progress_callback fields are sometimes partially absent
 * (huggingface/transformers.js#1401), so every field here is read defensively.
 */
import { pipeline, type TextGenerationPipeline } from '@huggingface/transformers';

export interface LocalModelProgress {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
  /** 0-100 when the runtime reports it; undefined otherwise (never fabricated). */
  progress?: number;
}

export const DEFAULT_LOCAL_MODEL_ID = 'HuggingFaceTB/SmolLM2-135M-Instruct';

let activePipeline: TextGenerationPipeline | null = null;
let activeModelId: string | null = null;
let loadingPromise: Promise<void> | null = null;

export function isLocalModelLoaded(modelId: string = DEFAULT_LOCAL_MODEL_ID): boolean {
  return activePipeline !== null && activeModelId === modelId;
}

/** Load (downloading on first use) a real ONNX text-generation model in-browser. */
export async function loadLocalModel(
  modelId: string = DEFAULT_LOCAL_MODEL_ID,
  onProgress?: (p: LocalModelProgress) => void
): Promise<void> {
  if (isLocalModelLoaded(modelId)) return;
  if (loadingPromise && activeModelId === modelId) return loadingPromise;

  activeModelId = modelId;
  loadingPromise = (async () => {
    const pipe = await pipeline('text-generation', modelId, {
      progress_callback: (info: any) => {
        if (!onProgress) return;
        onProgress({
          status: info?.status,
          file: info?.file,
          loaded: typeof info?.loaded === 'number' ? info.loaded : undefined,
          total: typeof info?.total === 'number' ? info.total : undefined,
          progress: typeof info?.progress === 'number' ? info.progress : undefined,
        });
      },
    });
    activePipeline = pipe as unknown as TextGenerationPipeline;
  })();

  try {
    await loadingPromise;
  } catch (err) {
    activeModelId = null;
    throw err;
  } finally {
    loadingPromise = null;
  }
}

export function unloadLocalModel(): void {
  activePipeline = null;
  activeModelId = null;
}

/** Generate real text from the currently loaded local model. Throws if none is loaded. */
export async function generateLocally(prompt: string, maxNewTokens = 128): Promise<string> {
  if (!activePipeline) throw new Error('No local model loaded yet — call loadLocalModel() first.');
  const output: any = await activePipeline(prompt, {
    max_new_tokens: maxNewTokens,
    temperature: 0.7,
    do_sample: true,
  });
  const first = Array.isArray(output) ? output[0] : output;
  const text: unknown = first?.generated_text;
  if (typeof text !== 'string') return '';
  // transformers.js text-generation echoes the prompt back; return only the continuation.
  return text.startsWith(prompt) ? text.slice(prompt.length).trim() : text.trim();
}
