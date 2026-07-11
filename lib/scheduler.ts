/**
 * Universal Scheduler — time-based trigger engine.
 *
 * Schedules any JackieAction on an interval, daily at HH:MM, or once at a
 * point in time. Jobs persist (appStorage 'scheduler') and rehydrate on load;
 * occurrences missed while the OS was closed are skipped forward to the next
 * due time (no catch-up storm). Every firing broadcasts `scheduler-run`.
 */

import { bus } from './bus';
import { runAction, type JackieAction } from './actions';
import { appStorage } from './appStorage';

export type Schedule =
  | { kind: 'interval'; everyMinutes: number }
  | { kind: 'daily'; hh: number; mm: number }
  | { kind: 'once'; atISO: string };

export interface ScheduledJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: Schedule;
  action: JackieAction;
  lastRun?: number;
  nextRun: number;
  runCount: number;
  lastResult?: string;
}

export function describeSchedule(s: Schedule): string {
  switch (s.kind) {
    case 'interval':
      return s.everyMinutes >= 60 && s.everyMinutes % 60 === 0
        ? `every ${s.everyMinutes / 60}h`
        : `every ${s.everyMinutes}m`;
    case 'daily':
      return `daily at ${String(s.hh).padStart(2, '0')}:${String(s.mm).padStart(2, '0')}`;
    case 'once':
      return `once at ${new Date(s.atISO).toLocaleString()}`;
  }
}

function nextOccurrence(s: Schedule, from: number): number {
  switch (s.kind) {
    case 'interval':
      return from + Math.max(1, s.everyMinutes) * 60_000;
    case 'daily': {
      const d = new Date(from);
      d.setHours(s.hh, s.mm, 0, 0);
      if (d.getTime() <= from) d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    case 'once':
      return new Date(s.atISO).getTime();
  }
}

const TICK_MS = 30_000;
const store = appStorage('scheduler');

class SchedulerEngine {
  private jobs: ScheduledJob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.jobs = store.get<ScheduledJob[]>('jobs', []);

    // Skip occurrences missed while the OS was closed: roll nextRun forward.
    const now = Date.now();
    this.jobs.forEach(job => {
      if (job.enabled && job.nextRun <= now && job.schedule.kind !== 'once') {
        job.nextRun = nextOccurrence(job.schedule, now);
      }
    });
    this.persist();

    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    for (const job of this.jobs) {
      if (!job.enabled || job.nextRun > now) continue;

      const result = await runAction(job.action, job.name);

      job.runCount++;
      job.lastRun = now;
      job.lastResult = result.ok ? (result.detail || 'ok') : `failed: ${result.detail}`;
      if (job.schedule.kind === 'once') {
        job.enabled = false; // one-shot complete
      } else {
        job.nextRun = nextOccurrence(job.schedule, now);
      }
      bus.emit('scheduler-run', { jobId: job.id, name: job.name, ok: result.ok, detail: result.detail });
    }
    this.persist();
  }

  private persist(): void {
    store.set('jobs', this.jobs);
    this.listeners.forEach(l => l());
  }

  getJobs(): ScheduledJob[] {
    return this.jobs;
  }

  addJob(name: string, schedule: Schedule, action: JackieAction): ScheduledJob {
    const job: ScheduledJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || 'Untitled job',
      enabled: true,
      schedule,
      action,
      nextRun: nextOccurrence(schedule, Date.now()),
      runCount: 0,
    };
    this.jobs = [...this.jobs, job];
    this.persist();
    return job;
  }

  toggleJob(id: string): void {
    this.jobs = this.jobs.map(j => {
      if (j.id !== id) return j;
      const enabled = !j.enabled;
      // Re-enabling recomputes the next due time from now.
      return { ...j, enabled, nextRun: enabled ? nextOccurrence(j.schedule, Date.now()) : j.nextRun };
    });
    this.persist();
  }

  removeJob(id: string): void {
    this.jobs = this.jobs.filter(j => j.id !== id);
    this.persist();
  }

  /** Fire a job immediately (for testing from the UI); reschedules as usual. */
  async runNow(id: string): Promise<void> {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;
    job.nextRun = 0;
    await this.tick();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const schedulerEngine = new SchedulerEngine();
