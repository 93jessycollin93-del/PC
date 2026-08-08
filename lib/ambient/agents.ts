/**
 * Ambient agents — work that happens without being asked.
 *
 * Every AI surface in the PC is reactive: it waits for a prompt. An ambient
 * agent runs on a schedule and leaves its output somewhere you will find it
 * later. That is the difference between a tool you operate and a system that
 * works for you.
 *
 * Runs are anchored to wall-clock time, not to interval ticks. A background
 * tab has its timers throttled, so a tick-counting scheduler silently drifts
 * and an agent set to "every hour" quietly becomes "every few hours".
 * Storing `nextRunAt` and comparing against Date.now() makes a missed window
 * catch up instead of vanishing.
 */
import { safeGetJSON, safeSetJSON } from '../safeStorage';
import { chat } from '../ai/gateway';
import { bus } from '../bus';

export type Cadence = 'every15m' | 'hourly' | 'every6h' | 'daily';

export interface Agent {
    id: string;
    name: string;
    /** What it should do, in plain language. */
    instruction: string;
    cadence: Cadence;
    enabled: boolean;
    /** `provider:model`, or undefined for the automatic chain. */
    model?: string;
    createdAt: number;
    nextRunAt: number;
    lastRunAt?: number;
    lastOk?: boolean;
    lastOutput?: string;
    lastError?: string;
    runs: number;
}

export const CADENCE_MS: Record<Cadence, number> = {
    every15m: 15 * 60_000,
    hourly: 60 * 60_000,
    every6h: 6 * 60 * 60_000,
    daily: 24 * 60 * 60_000,
};

export const CADENCE_LABEL: Record<Cadence, string> = {
    every15m: 'every 15 minutes',
    hourly: 'hourly',
    every6h: 'every 6 hours',
    daily: 'daily',
};

const STORAGE_KEY = 'jackie_ambient_agents_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAgents(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* a broken listener must not stop the scheduler */
        }
    });
}

export function listAgents(): Agent[] {
    return safeGetJSON<Agent[]>(STORAGE_KEY, []);
}

function persist(list: Agent[]): void {
    safeSetJSON(STORAGE_KEY, list, { silent: true });
    notify();
}

export function saveAgent(input: Partial<Agent> & { name: string; instruction: string; cadence: Cadence }): Agent {
    const list = listAgents();
    const existing = input.id ? list.findIndex((a) => a.id === input.id) : -1;
    const agent: Agent = {
        id: input.id || crypto.randomUUID(),
        name: input.name.trim(),
        instruction: input.instruction.trim(),
        cadence: input.cadence,
        enabled: input.enabled ?? true,
        model: input.model,
        createdAt: existing >= 0 ? list[existing].createdAt : Date.now(),
        // A new or re-cadenced agent runs one interval from now, not instantly —
        // saving an agent should not fire a burst of calls.
        nextRunAt: Date.now() + CADENCE_MS[input.cadence],
        lastRunAt: existing >= 0 ? list[existing].lastRunAt : undefined,
        lastOk: existing >= 0 ? list[existing].lastOk : undefined,
        lastOutput: existing >= 0 ? list[existing].lastOutput : undefined,
        lastError: existing >= 0 ? list[existing].lastError : undefined,
        runs: existing >= 0 ? list[existing].runs : 0,
    };
    if (existing >= 0) list[existing] = agent;
    else list.push(agent);
    persist(list);
    return agent;
}

export function deleteAgent(id: string): void {
    persist(listAgents().filter((a) => a.id !== id));
}

export function setEnabled(id: string, enabled: boolean): void {
    persist(
        listAgents().map((a) =>
            a.id === id ? { ...a, enabled, nextRunAt: enabled ? Date.now() + CADENCE_MS[a.cadence] : a.nextRunAt } : a,
        ),
    );
}

/** Run one agent now, regardless of schedule. */
export async function runAgent(id: string): Promise<void> {
    const list = listAgents();
    const agent = list.find((a) => a.id === id);
    if (!agent) return;

    try {
        const res = await chat({
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an ambient agent inside a personal desktop OS. You run unattended on a ' +
                        'schedule, and your output is read later by one person. Be brief and concrete. ' +
                        'If you cannot do something, say so plainly rather than inventing a result.',
                },
                { role: 'user', content: agent.instruction },
            ],
            model: agent.model,
        });
        update(id, {
            lastRunAt: Date.now(),
            lastOk: true,
            lastOutput: res.text,
            lastError: undefined,
            runs: agent.runs + 1,
            nextRunAt: Date.now() + CADENCE_MS[agent.cadence],
        });
        bus.emit('jackie-notification', {
            level: 'info',
            title: `${agent.name} finished`,
            message: res.text.slice(0, 160),
            source: 'ambient',
        });
    } catch (err) {
        update(id, {
            lastRunAt: Date.now(),
            lastOk: false,
            lastError: err instanceof Error ? err.message : 'failed',
            runs: agent.runs + 1,
            // Back off a full interval rather than hammering a failing provider.
            nextRunAt: Date.now() + CADENCE_MS[agent.cadence],
        });
    }
}

function update(id: string, patch: Partial<Agent>): void {
    persist(listAgents().map((a) => (a.id === id ? { ...a, ...patch } : a)));
}

/* ── the scheduler ─────────────────────────────────────────────────────── */

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Start the loop. Checks once a minute — the finest cadence is 15 minutes, so
 * a tighter poll would burn wakeups for no benefit.
 */
export function startScheduler(): void {
    if (timer) return;
    const tick = async () => {
        if (running) return; // never overlap runs
        running = true;
        try {
            const due = listAgents().filter((a) => a.enabled && a.nextRunAt <= Date.now());
            // Sequential on purpose: parallel agents would race for the same
            // rate-limited keys and cool the whole pool at once.
            for (const agent of due) await runAgent(agent.id);
        } finally {
            running = false;
        }
    };
    timer = setInterval(() => void tick(), 60_000);
    void tick();
}

export function stopScheduler(): void {
    if (timer) clearInterval(timer);
    timer = null;
}

export function isSchedulerRunning(): boolean {
    return timer !== null;
}
