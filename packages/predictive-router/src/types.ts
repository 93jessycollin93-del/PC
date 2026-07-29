/**
 * Shared types for the predictive router package.
 *
 * Provider is a plain string, not a fixed union. A library that names a
 * closed set of AI providers stops being a library the moment a caller adds
 * one — the whole point of extracting this out of Jackie's PC is that it
 * should work for anyone's provider list, not just groq/gemini/deepseek.
 */

export type Provider = string;

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
