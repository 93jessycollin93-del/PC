/**
 * Pod Control Center — bridges the real SAS pod backend to the UI.
 *
 * One SASCore instance owns the pod registry, lifecycle manager and
 * communication broker; this controller drives them and emits change events
 * so React panels can render truthful pod state. Everything here is local
 * and deterministic — no external AI calls.
 */

import { SASCore } from './sas-core';
import { runPodTask } from './pod-system-engine';
import type { PodMetadata, PodSeed, PodTask } from './pod-system-design';

const STORAGE_KEY = 'sas_pod_control_v1';

export interface PodAttachment {
  windowId: string;
  windowTitle: string;
}

/** Persisted per-pod config (runtime state lives in the registry, not here). */
interface StoredPodRecord {
  podId: string;
  name: string;
  tierId: string;
  wordBudget: number;
  attachedTo?: PodAttachment;
  createdAt: number;
}

/** Snapshot of one pod for rendering — read-only view over real state. */
export interface PodView {
  podId: string;
  name: string;
  tierId: string;
  tierSize: number;
  state: PodMetadata['state'];
  wordBudget: number;
  attachedTo?: PodAttachment;
  lastError?: string;
  task?: PodTask;
  hasActiveInstance: boolean;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[unitIdx]}`;
}

export class PodControlCenter {
  private sasCore: SASCore;
  private records = new Map<string, StoredPodRecord>();
  private lastErrors = new Map<string, string>();
  private listeners = new Set<() => void>();
  private podCounter = 0;

  constructor() {
    this.sasCore = new SASCore();
    this.restore();
  }

  // --------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  // --------------------------------------------------------------------
  // Reads
  // --------------------------------------------------------------------

  listTiers() {
    return this.sasCore.listPodTiers();
  }

  getSystemStatus() {
    return this.sasCore.getStatus();
  }

  getPods(): PodView[] {
    const registry = this.sasCore.getMotherShell().podRegistry;
    const views: PodView[] = [];

    for (const record of this.records.values()) {
      const meta = registry.get(record.podId);
      if (!meta) continue;
      const instance = meta.activeInstances[0];
      views.push({
        podId: record.podId,
        name: record.name,
        tierId: record.tierId,
        tierSize: this.tierSize(record.tierId),
        state: meta.state,
        wordBudget: meta.seed.wordBudget ?? record.wordBudget,
        attachedTo: record.attachedTo,
        lastError: this.lastErrors.get(record.podId),
        task: instance?.currentTask,
        hasActiveInstance: !!instance,
      });
    }

    return views.sort((a, b) => a.name.localeCompare(b.name));
  }

  private tierSize(tierId: string): number {
    const tier = this.listTiers().find((t) => t.id === tierId);
    return tier?.size ?? 0;
  }

  // --------------------------------------------------------------------
  // Build / remove
  // --------------------------------------------------------------------

  async buildPod(name: string, tierId: string, wordBudget: number): Promise<string> {
    const trimmed = name.trim();
    const podName = trimmed || `pod-${++this.podCounter}`;
    const budget = Math.max(1, Math.floor(wordBudget));

    // Real capacity + tier check — throws on unknown tier or insufficient storage.
    await this.sasCore.spawnPod(tierId, 1);

    const podId = `pcp-${tierId}-${Date.now()}`;
    this.registerPod({ podId, name: podName, tierId, wordBudget: budget, createdAt: Date.now() });
    this.persist();
    this.emit();
    return podId;
  }

  removePod(podId: string): void {
    this.sasCore.getMotherShell().podRegistry.delete(podId);
    this.records.delete(podId);
    this.lastErrors.delete(podId);
    this.persist();
    this.emit();
  }

  private registerPod(record: StoredPodRecord): void {
    const seed = this.makeSeed(record);
    const meta: PodMetadata = {
      podId: record.podId,
      podName: record.name,
      seed,
      state: 'dormant',
      lastActiveTime: new Date(record.createdAt),
      spawnedCount: 0,
      activeInstances: [],
    };
    this.sasCore.getMotherShell().podRegistry.set(record.podId, meta);
    this.records.set(record.podId, record);
  }

  /**
   * Build a minimal valid seed for a control-panel pod. The seed reconstructs
   * a real text-processing capability through the real hydration engine
   * (it loads the sas-core-context information layer, which exists in the
   * mother shell). No random spawn triggers — fully deterministic.
   */
  private makeSeed(record: StoredPodRecord): PodSeed {
    return {
      id: record.podId,
      fingerprint: `pod-control-${record.tierId}`,
      sizeBytes: Math.min(40000, this.tierSize(record.tierId) || 40000),
      wordBudget: record.wordBudget,
      codebook: {
        patterns: [],
        symbolMap: new Map(),
        reconstructionRules: [
          {
            pattern: 'text-processing',
            rule: 'local word-budget text processor',
            priority: 1,
          },
          {
            pattern: 'word-budget-enforcement',
            rule: `cap task output at ${record.wordBudget} words`,
            priority: 2,
          },
        ],
        inferenceRecipe: {
          steps: ['load-codebook', 'fetch-context', 'ready'],
          contextRequirements: new Map([['text-processing', ['sas-core-context']]]),
          fallbacks: [],
        },
      },
      spawnRules: { triggers: [], maxChildren: 0, mutationRules: [] },
      infoPointers: [
        { layerId: 'sas-core-context', required: true, loadSize: 'sample', cache: true },
      ],
      lifecycle: {
        maxActiveDuration: 300000,
        idleTimeout: 120000,
        resourceLimits: {
          maxMemory: this.tierSize(record.tierId) || 40000,
          maxCPU: 1000,
          maxInstances: 1,
        },
        targetSeedSize: 40000,
      },
    };
  }

  // --------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------

  async hydratePod(podId: string): Promise<void> {
    const meta = this.sasCore.getMotherShell().podRegistry.get(podId);
    if (!meta) throw new Error(`Pod ${podId} not found`);
    if (meta.state === 'active' || meta.state === 'hydrating') return;

    meta.state = 'hydrating';
    this.lastErrors.delete(podId);
    this.emit();

    try {
      const shell = this.sasCore.getMotherShell();
      const instance = await shell.lifecycleManager.hydrate(meta.seed);
      meta.activeInstances = [instance];
      meta.state = 'active';
      meta.lastActiveTime = new Date();
    } catch (e: any) {
      meta.state = 'dormant';
      meta.activeInstances = [];
      this.lastErrors.set(podId, e?.message || 'Hydration failed');
    }
    this.emit();
  }

  async restPod(podId: string): Promise<void> {
    const meta = this.sasCore.getMotherShell().podRegistry.get(podId);
    if (!meta) throw new Error(`Pod ${podId} not found`);
    const instance = meta.activeInstances[0];
    if (!instance) return;

    meta.state = 'compressing';
    this.emit();

    try {
      const shell = this.sasCore.getMotherShell();
      const compressedSeed = await shell.lifecycleManager.rest(instance);
      meta.seed = compressedSeed; // wordBudget survives — compression spreads the seed
      meta.activeInstances = [];
      meta.state = 'dormant';
    } catch (e: any) {
      meta.state = 'active';
      this.lastErrors.set(podId, e?.message || 'Compression failed');
    }
    this.emit();
  }

  // --------------------------------------------------------------------
  // Tasks
  // --------------------------------------------------------------------

  async runTask(podId: string, input: string): Promise<PodTask> {
    const meta = this.sasCore.getMotherShell().podRegistry.get(podId);
    if (!meta) throw new Error(`Pod ${podId} not found`);

    if (!meta.activeInstances[0]) {
      await this.hydratePod(podId);
    }
    const instance = meta.activeInstances[0];
    if (!instance) {
      throw new Error(this.lastErrors.get(podId) || 'Pod could not hydrate');
    }

    const pending = runPodTask(instance, input, meta.seed.wordBudget);
    this.emit(); // task is now 'running' on the real instance
    const task = await pending;

    if (task.status === 'failed') {
      this.lastErrors.set(podId, task.result?.error || 'Task failed');
    } else {
      this.lastErrors.delete(podId);
      meta.lastActiveTime = new Date();
    }
    this.emit();
    return task;
  }

  setWordBudget(podId: string, wordBudget: number): void {
    const meta = this.sasCore.getMotherShell().podRegistry.get(podId);
    const record = this.records.get(podId);
    if (!meta || !record) return;
    const budget = Math.max(1, Math.floor(wordBudget));
    meta.seed.wordBudget = budget;
    record.wordBudget = budget;
    this.persist();
    this.emit();
  }

  // --------------------------------------------------------------------
  // Attachments
  // --------------------------------------------------------------------

  attachPod(podId: string, windowId: string, windowTitle: string): void {
    const record = this.records.get(podId);
    if (!record) return;
    record.attachedTo = { windowId, windowTitle };
    this.persist();

    // Announce over the real comms broker + a DOM event apps can hook into.
    this.sasCore.getMotherShell().communicationBroker.broadcast({
      fromPodId: podId,
      toPodId: windowId,
      type: 'broadcast',
      payload: { kind: 'pod-attached', podId, windowId, windowTitle },
      timestamp: new Date(),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pod-attached', { detail: { podId, windowId, windowTitle } })
      );
    }
    this.emit();
  }

  detachPod(podId: string): void {
    const record = this.records.get(podId);
    if (!record || !record.attachedTo) return;
    const { windowId } = record.attachedTo;
    record.attachedTo = undefined;
    this.persist();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pod-detached', { detail: { podId, windowId } })
      );
    }
    this.emit();
  }

  /** Pods currently attached to the given window/app — for app-side hooks. */
  getPodsForWindow(windowId: string): PodView[] {
    return this.getPods().filter((p) => p.attachedTo?.windowId === windowId);
  }

  // --------------------------------------------------------------------
  // Persistence — config only; runtime state resets to dormant on reload
  // --------------------------------------------------------------------

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.records.values()]));
    } catch {}
  }

  private restore(): void {
    let saved: StoredPodRecord[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {}

    for (const record of saved) {
      if (!record?.podId || !record?.tierId) continue;
      // Re-account the pod in the factory so footprint matches the registry.
      // spawnPod is async — surface restore failures on the pod, not as crashes.
      this.sasCore.spawnPod(record.tierId, 1).catch((e: any) => {
        this.lastErrors.set(record.podId, e?.message || 'Restore failed');
        this.emit();
      });
      this.registerPod(record);
    }
    this.podCounter = this.records.size;
  }
}

let _center: PodControlCenter | null = null;

/** Lazy singleton — SASCore boots on first panel open, not at import time. */
export function getPodControlCenter(): PodControlCenter {
  if (!_center) {
    _center = new PodControlCenter();
  }
  return _center;
}
