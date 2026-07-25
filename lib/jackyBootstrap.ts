/**
 * Wires the shared `jackyClient` to PC's own platform.
 *
 * `jackyClient.ts` is byte-identical in all four fleet repos, so it carries no
 * knowledge of PC's Express server. This file is the seam: it points the client
 * at the `/api/jacky` relay in `server.ts`, which holds JACKY_API_BASE and
 * JACKY_API_TOKEN server-side and forwards only allowlisted engine paths.
 *
 * Going through the relay rather than straight at the engine means the engine
 * needs no CORS headers, and its token never reaches the browser bundle — the
 * same arrangement Eru and Jackie use with their serverless proxies.
 *
 * Import once, as early as possible — `index.tsx`:
 *
 *     import './lib/jackyBootstrap';
 *
 * Idempotent, so a stray second import is harmless.
 */

import { jackyClient } from './jackyClient';

/** Relay route hosted by `server.ts`. */
const RELAY_PATH = '/api/jacky';

/**
 * PC's own API token, which `requireAuth` in server.ts checks. Read per request
 * rather than captured, so pasting a token into Settings takes effect without a
 * reload. Same localStorage key the Self-Audit Scanner reports on.
 */
function pcAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('jackie_api_token');
    return token ? { 'x-jackie-token': token } : {};
  } catch {
    return {};
  }
}

let wired = false;

export function bootstrapJacky() {
  if (wired) return jackyClient;
  wired = true;

  jackyClient.setProxyInvoker(async (path, init) => {
    const res = await fetch(RELAY_PATH, {
      // Always POST: the envelope form carries the engine's intended method, so
      // one request shape covers both reads and writes.
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...pcAuthHeaders() },
      cache: 'no-store',
      body: JSON.stringify({ path, method: init.method, body: init.body }),
    });

    const data = await res.json().catch(() => ({ error: `Relay returned HTTP ${res.status}` }));
    // The relay reports engine-level failures in the payload; surface them as
    // thrown errors so jackyClient flips the link state rather than handing a
    // bad payload to a dashboard.
    if (!res.ok || (data && typeof data === 'object' && 'error' in data && data.error)) {
      throw new Error(String((data as { error?: unknown })?.error ?? `HTTP ${res.status}`));
    }
    return data;
  });

  return jackyClient;
}

export default bootstrapJacky();
