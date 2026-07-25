/**
 * jackyClient — the shared bridge to the real Jacky Flask engine.
 *
 * Wave 1 of the Fleet Parity Plan. Every "live" surface (System Monitor,
 * Ask Jackie, routing badges, squads) reads through this one typed client so
 * the frontends stop faking telemetry and talk to the real box.
 *
 * By default it calls the SAME-ORIGIN proxy at `/api/jacky/*` (see the
 * `/api/jacky` route in server.ts), which forwards to `JACKY_API_BASE/api/*`
 * server-side — that keeps the token off the client and dodges CORS.
 *
 * For a standalone page (no proxy) point it straight at a jacky host:
 *   configureJacky({ base: 'https://sas.example.com/api', token: '…' })
 * i.e. the base must include the trailing `/api` in direct mode; in proxy
 * mode the default base `/api/jacky` already maps to the engine's `/api`.
 *
 * Response shapes mirror jacky_api.py (/api/status, /api/assessment,
 * /api/ask, /api/control, /api/models, /api/bots, /api/squads/*).
 */

export interface JackyGpu {
  available: boolean;
  temp_c?: number;
  load_percent?: number;
  mem_used_mb?: number;
  mem_total_mb?: number;
  max_temp_c?: number;
  thermal_margin?: number;
  headroom_c?: number;
  safe_to_use?: boolean;
}

export interface JackyStatus {
  status: string;
  cpu: number;
  memory: number;
  disk_free?: string;
  disk_used_percent?: number;
  temps?: Record<string, unknown>;
  gpu: JackyGpu;
  timestamp: string;
}

export interface JackyAssessment {
  level?: string;
  badge?: string;
  safe_to_run_local?: boolean;
  reason?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface JackyAskResult {
  status: string;
  engine?: string;
  route?: string;
  model?: string;
  specialty?: string;
  response: string;
  why?: string;
  latency_s?: number;
  thinking_mode?: string;
  fallback_chain?: Array<Record<string, unknown>>;
  assessment?: JackyAssessment;
  timestamp?: string;
}

export interface JackyControl {
  active: boolean;
  thinking_mode: string;
  valid_modes?: string[];
  timestamp?: string;
}

export interface JackyBot {
  name: string;
  key: string;
  model?: string;
  provider?: string;
  cost?: string;
  status?: string;
}

export type ThinkingMode = 'fast' | 'balanced' | 'deep';

export interface JackyConfig {
  /** Base URL. Proxy mode: '/api/jacky' (default). Direct mode: 'https://host/api'. */
  base: string;
  /** Optional bearer token; ignored in proxy mode (the server injects its own). */
  token?: string;
  timeoutMs: number;
}

const DEFAULT_CONFIG: JackyConfig = { base: '/api/jacky', token: undefined, timeoutMs: 8000 };

let config: JackyConfig = { ...DEFAULT_CONFIG };

/** Merge configuration. Trailing slashes on `base` are normalized away. */
export function configureJacky(patch: Partial<JackyConfig>): void {
  const next = { ...config, ...patch };
  next.base = (patch.base ?? config.base).replace(/\/+$/, '');
  config = next;
}

export function getJackyConfig(): JackyConfig {
  return { ...config };
}

/** True when a base URL is set (always true with the default proxy base). */
export function isJackyConfigured(): boolean {
  return Boolean(config.base);
}

export class JackyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'JackyError';
    this.status = status;
  }
}

function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  let url = `${config.base}${p}`;
  if (config.token) {
    url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(config.token)}`;
  }
  return url;
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), config.timeoutMs) : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`;
  try {
    const res = await fetch(buildUrl(path), {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller?.signal,
      cache: 'no-store',
      mode: 'cors',
    });
    if (!res.ok) throw new JackyError(`jacky ${path} → HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof JackyError) throw err;
    throw new JackyError(`jacky ${path} unreachable: ${(err as Error)?.message ?? err}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Typed calls onto the jacky engine. Each throws JackyError on failure so
 * callers can fall back to an offline/demo state (see app-commander.html).
 */
export const jacky = {
  /** Live CPU/RAM/GPU/disk telemetry. */
  getStatus: () => request<JackyStatus>('/status'),
  /** Situation verdict (safe_for_local / escalate) + short badge. */
  getAssessment: () => request<JackyAssessment>('/assessment'),
  /** Situation-aware routed inference with a visible fallback chain. */
  ask: (prompt: string, opts?: { task_type?: string; mode?: ThinkingMode }) =>
    request<JackyAskResult>('/ask', {
      method: 'POST',
      body: { prompt, task_type: opts?.task_type ?? 'general', mode: opts?.mode },
    }),
  /** Read the master runtime controls (active switch + thinking mode). */
  getControl: () => request<JackyControl>('/control'),
  /** Set the master runtime controls. */
  setControl: (patch: Partial<Pick<JackyControl, 'active' | 'thinking_mode'>>) =>
    request<JackyControl>('/control', { method: 'POST', body: patch }),
  /** Local Ollama roster (online vs downloading). */
  listModels: () => request<Record<string, unknown>>('/models'),
  /** Named cloud backup bots. */
  listBots: () => request<{ bots: JackyBot[] }>('/bots'),
  /** Ask a squad's lead (coding | security | archivist), with memory. */
  askSquad: (squad: string, prompt: string) =>
    request<Record<string, unknown>>(`/squads/${encodeURIComponent(squad)}/ask`, {
      method: 'POST',
      body: { prompt },
    }),
  /** Have every member of a squad reply to the prompt. */
  discussSquad: (squad: string, prompt: string) =>
    request<Record<string, unknown>>(`/squads/${encodeURIComponent(squad)}/discuss`, {
      method: 'POST',
      body: { prompt },
    }),
};
