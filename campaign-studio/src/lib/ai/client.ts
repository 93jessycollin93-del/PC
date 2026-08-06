import "server-only";

import OpenAI from "openai";

/**
 * Server-only OpenAI access. The `server-only` import above makes any
 * accidental client-side import a build error, which is the enforcement
 * mechanism for the client/server boundary documented in the README.
 */

let client: OpenAI | null = null;

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isMockMode(): boolean {
  return process.env.MOCK_AI === "1";
}

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI(); // reads OPENAI_API_KEY from the environment
  }
  return client;
}
