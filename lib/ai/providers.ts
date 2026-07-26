/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Free AI provider registry for the micro-router.
// Ollama runs locally (data sovereignty first); cloud free tiers are optional
// fallbacks. No API keys live in code — they are supplied at runtime by the
// user and held in memory only.

export type TaskKind = 'reasoning' | 'coding' | 'lightweight' | 'vision' | 'embedding';

export interface AiProvider {
  id: string;
  name: string;
  kind: 'local' | 'free-cloud' | 'proxy';
  baseUrl: string;
  /** Preferred model per task kind. */
  models: Partial<Record<TaskKind, string>>;
  /** True if requests need a user-supplied key (never stored in code). */
  requiresKey: boolean;
  priority: number; // lower = tried first
}

export const OLLAMA: AiProvider = {
  id: 'ollama',
  name: 'Ollama (Local Sovereign)',
  kind: 'local',
  baseUrl: 'http://localhost:11434',
  models: {
    reasoning: 'deepseek-r1:14b',
    coding: 'qwen2.5-coder:7b',
    lightweight: 'llama3.2:3b',
    vision: 'llava:7b',
    embedding: 'nomic-embed-text',
  },
  requiresKey: false,
  priority: 0,
};

export const GEMINI_PROXY: AiProvider = {
  id: 'gemini-proxy',
  name: 'Gemini (server proxy)',
  kind: 'proxy',
  baseUrl: '/api/gemini/generate',
  models: {
    reasoning: 'gemini-3-flash-preview',
    coding: 'gemini-3-flash-preview',
    lightweight: 'gemini-3-flash-preview',
    vision: 'gemini-3-flash-preview',
  },
  requiresKey: false,
  priority: 1,
};

export const OPENROUTER_FREE: AiProvider = {
  id: 'openrouter-free',
  name: 'OpenRouter (free models)',
  kind: 'free-cloud',
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  models: {
    reasoning: 'deepseek/deepseek-r1:free',
    coding: 'qwen/qwen-2.5-coder-32b-instruct:free',
    lightweight: 'meta-llama/llama-3.2-3b-instruct:free',
  },
  requiresKey: true,
  priority: 2,
};

export const GROQ_FREE: AiProvider = {
  id: 'groq-free',
  name: 'Groq (free tier)',
  kind: 'free-cloud',
  baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
  models: {
    reasoning: 'llama-3.3-70b-versatile',
    coding: 'llama-3.3-70b-versatile',
    lightweight: 'llama-3.1-8b-instant',
  },
  requiresKey: true,
  priority: 3,
};

export const HUGGINGFACE_FREE: AiProvider = {
  id: 'huggingface-free',
  name: 'Hugging Face Inference (free)',
  kind: 'free-cloud',
  baseUrl: 'https://api-inference.huggingface.co/models',
  models: {
    reasoning: 'Qwen/QwQ-32B',
    coding: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    lightweight: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
  },
  requiresKey: true,
  priority: 4,
};

export const PROVIDERS: AiProvider[] = [
  OLLAMA,
  GEMINI_PROXY,
  OPENROUTER_FREE,
  GROQ_FREE,
  HUGGINGFACE_FREE,
].sort((a, b) => a.priority - b.priority);
