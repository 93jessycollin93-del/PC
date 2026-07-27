/**
 * Conductor — automatic sequential pod orchestration
 *
 * Runs a chain of pods one at a time on a single input:
 * hydrate pod -> execute a real task -> compress it back down -> hand its
 * condensed result to the next pod in the chain -> repeat -> compile a
 * final answer from every pod's condensed result.
 *
 * Nothing here is simulated: hydration/compression/task execution all call
 * the real engines already used elsewhere in this package. There is no
 * external model call and no cost — this composes the existing free,
 * deterministic `runPodTask` analysis across multiple pods in sequence.
 */

import type { MotherShell, PodSeed, PodTask } from './pod-system-design';
import { PodLifecycleManager, runPodTask } from './pod-system-engine';

export interface ConductorStepResult {
  podId: string;
  instanceId: string;
  input: string;
  summary: string;
  raw: Awaited<ReturnType<typeof runPodTask>>;
  durationMs: number;
}

export interface ConductorRunResult {
  steps: ConductorStepResult[];
  finalAnswer: string;
  totalDurationMs: number;
}

/**
 * Only one pod is ever hydrated (active) at a time. Every pod before it in
 * the chain has already been compressed back to a dormant seed by the time
 * the next one opens.
 */
export class Conductor {
  private manager: PodLifecycleManager;

  constructor(private motherShell: MotherShell) {
    this.manager = new PodLifecycleManager(motherShell);
  }

  /**
   * Run a chain of pod seeds sequentially against one original input.
   * Each pod receives the previous pod's condensed summary appended to the
   * original input, not the previous pod's raw internal state — this is
   * the "condensed reasoning hand-off" the chain concept calls for.
   */
  async run(chain: PodSeed[], originalInput: string): Promise<ConductorRunResult> {
    if (chain.length === 0) {
      throw new Error('Conductor.run requires at least one pod in the chain');
    }

    const started = Date.now();
    const steps: ConductorStepResult[] = [];
    let carriedContext = originalInput;

    for (const seed of chain) {
      const stepStart = Date.now();

      // Open: hydrate this pod only. No other pod is active right now.
      const instance = await this.manager.hydrate(seed);

      try {
        const task: PodTask = {
          id: `${seed.id}-${stepStart}`,
          description: carriedContext,
          status: 'queued',
        };

        await this.manager.executeTask(instance, task);

        if (instance.currentTask?.status !== 'complete') {
          throw new Error(
            `Conductor chain halted: pod ${seed.id} did not complete (status=${instance.currentTask?.status}) — ${JSON.stringify(
              instance.currentTask?.result
            )}`
          );
        }

        const raw = instance.currentTask.result as Awaited<ReturnType<typeof runPodTask>>;
        if (!raw || typeof raw.summary !== 'string') {
          throw new Error(
            `Conductor chain halted: pod ${seed.id} returned an unexpected result shape`
          );
        }

        steps.push({
          podId: seed.id,
          instanceId: instance.instanceId,
          input: carriedContext,
          summary: raw.summary,
          raw,
          durationMs: Date.now() - stepStart,
        });

        // Hand off condensed reasoning, not raw state, to the next pod.
        carriedContext = `${originalInput}\n\n[Prior pod (${seed.id}) found]: ${raw.summary}`;
      } finally {
        // Close: always compress this pod back to a dormant seed before
        // the next one opens, even if it failed — never leave an active
        // instance lingering.
        await this.manager.rest(instance);
      }
    }

    const finalAnswer = this.compile(originalInput, steps);

    return {
      steps,
      finalAnswer,
      totalDurationMs: Date.now() - started,
    };
  }

  /**
   * The "center" compiler step: combine every pod's condensed summary into
   * one final answer. This stays open conceptually only in the sense that
   * it runs last — it does not hydrate a pod of its own here, it just
   * merges what already ran. A real compiler pod can replace this later.
   */
  private compile(originalInput: string, steps: ConductorStepResult[]): string {
    if (steps.length === 0) return 'No pods ran.';

    const lines = steps.map(
      (s, i) => `${i + 1}. [${s.podId}] ${s.summary}`
    );

    return [
      `Chain of ${steps.length} pod(s) processed: "${originalInput.slice(0, 80)}${
        originalInput.length > 80 ? '…' : ''
      }"`,
      ...lines,
    ].join('\n');
  }
}
