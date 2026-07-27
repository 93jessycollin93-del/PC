/**
 * AI Studio Integration Module
 * Specialized LLM integration for Google Gemini and AI-powered workflows
 */

export { default as GeminiBridge } from './gemini-bridge';
export type { GeminiConfig, GeminiMessage, GeminiResponse, ContentPart } from './gemini-bridge';

export { default as StudioOrchestrator } from './studio-orchestrator';
export type { StudioTask, StudioConfig } from './studio-orchestrator';

export { useStudio } from './useStudio';
export type { UseStudioReturn } from './useStudio';

// Re-export for convenience
export * from './gemini-bridge';
export * from './studio-orchestrator';
