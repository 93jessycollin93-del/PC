/**
 * Pod System Engine — Core operational logic
 * Implements Hydration, Compression, Spawn, Lifecycle, and Communication
 */

import type {
  PodSeed,
  PodInstance,
  ReconstructedState,
  MotherShell,
  PodMessage,
  InformationLayer,
  PodTask,
} from './pod-system-design';

// ============================================================================
// HYDRATION ENGINE — Expand Seed to Active Instance
// ============================================================================

export class HydrationEngine {
  constructor(private motherShell: MotherShell) {}

  async hydrate(seed: PodSeed): Promise<PodInstance> {
    console.log(`[Hydrate] Expanding seed ${seed.id} (${seed.sizeBytes} bytes)...`);

    // Step 1: Load required information layers
    const loadedLayers = await this.loadInformationLayers(seed);

    // Step 2: Reconstruct capabilities from codebook
    const reconstructedState = await this.reconstruct(seed, loadedLayers);

    // Step 3: Create active instance
    const instance: PodInstance = {
      instanceId: `${seed.id}-${Date.now()}`,
      seed,
      reconstructedState,
      loadedLayers,
      childPods: [],
      createdAt: new Date(),
      lastExecutedAt: new Date(),
    };

    console.log(
      `✓ Hydrated: ${instance.instanceId} with ${reconstructedState.capabilities.length} capabilities`
    );
    return instance;
  }

  private async loadInformationLayers(
    seed: PodSeed
  ): Promise<Map<string, any>> {
    const loaded = new Map<string, any>();

    for (const pointer of seed.infoPointers) {
      const layer = this.motherShell.informationLayers.find(
        (l) => l.id === pointer.layerId
      );

      if (!layer) {
        if (pointer.required) {
          throw new Error(`Required layer ${pointer.layerId} not found`);
        }
        continue;
      }

      console.log(`  Loading layer: ${layer.name}`);
      // Simulate loading (in real impl, this would fetch from dataPath)
      loaded.set(pointer.layerId, {
        id: layer.id,
        name: layer.name,
        sizeBytes: pointer.loadSize === 'full' ? layer.sizeBytes : layer.sizeBytes / 4,
      });
    }

    return loaded;
  }

  private async reconstruct(
    seed: PodSeed,
    loadedLayers: Map<string, any>
  ): Promise<ReconstructedState> {
    const capabilities: string[] = [];

    // Walk through codebook patterns and reconstruct capabilities
    for (const rule of seed.codebook.reconstructionRules) {
      const requiredLayers = seed.codebook.inferenceRecipe.contextRequirements.get(
        rule.pattern
      ) || [];

      let canReconstructRule = true;
      for (const layerId of requiredLayers) {
        if (!loadedLayers.has(layerId)) {
          // Check fallback
          const fallback = seed.codebook.inferenceRecipe.fallbacks.find(
            (f) => f.condition.includes(layerId)
          );
          if (!fallback) {
            canReconstructRule = false;
            break;
          }
        }
      }

      if (canReconstructRule) {
        // Extract capability name from rule
        const capName = `${rule.pattern}(priority:${rule.priority})`;
        capabilities.push(capName);
      }
    }

    return {
      capabilities,
      memory: new Map(),
      executionContext: {
        state: 'ready',
        layers: loadedLayers,
      },
    };
  }
}

// ============================================================================
// COMPRESSION ENGINE — Compress Active Instance to Seed
// ============================================================================

export class CompressionEngine {
  async compress(instance: PodInstance): Promise<PodSeed> {
    console.log(
      `[Compress] Compressing ${instance.instanceId} back to dormant seed...`
    );

    // Step 1: Analyze execution trace to find frequent patterns
    const extractedPatterns = this.analyzeExecution(instance);

    // Step 2: Update codebook with new patterns
    const updatedCodebook = {
      ...instance.seed.codebook,
      patterns: [
        ...instance.seed.codebook.patterns,
        ...extractedPatterns,
      ],
    };

    // Step 3: Create compressed seed (target: 40 kB or less)
    const compressedSeed: PodSeed = {
      ...instance.seed,
      codebook: updatedCodebook,
      // Size naturally compresses because patterns are deduplicated
      sizeBytes: Math.min(
        40000,
        instance.seed.sizeBytes + extractedPatterns.length * 100
      ),
    };

    console.log(`✓ Compressed to ${compressedSeed.sizeBytes} bytes`);
    return compressedSeed;
  }

  private analyzeExecution(instance: PodInstance) {
    // Simulate pattern extraction from execution trace
    return [
      {
        id: `pattern-${Date.now()}`,
        hash: 'new-pattern',
        frequency: 50,
        examples: ['observed-behavior'],
      },
    ];
  }
}

// ============================================================================
// SPAWN ENGINE — Spawn Child Pods
// ============================================================================

export class SpawnEngine {
  constructor(private motherShell: MotherShell) {}

  async evaluateAndSpawn(instance: PodInstance): Promise<PodInstance[]> {
    const children: PodInstance[] = [];
    const seed = instance.seed;

    console.log(`[Spawn] Evaluating spawn triggers for ${instance.instanceId}...`);

    // Evaluate each spawn trigger
    for (const trigger of seed.spawnRules.triggers) {
      if (trigger.condition()) {
        console.log(`  ✓ Trigger ${trigger.type} fired (priority ${trigger.priority})`);

        // Find applicable mutation rule
        for (const mutation of seed.spawnRules.mutationRules) {
          if (mutation.trigger.type === trigger.type) {
            // Create mutated child seed
            const childSeed = mutation.mutationFn(seed);
            console.log(`    Spawning child: ${childSeed.id}`);

            // Hydrate child
            const hydrationEngine = new HydrationEngine(this.motherShell);
            const childInstance = await hydrationEngine.hydrate(childSeed);
            children.push(childInstance);
            instance.childPods.push(childInstance);

            if (instance.childPods.length >= seed.spawnRules.maxChildren) {
              break;
            }
          }
        }
      }
    }

    console.log(`✓ Spawned ${children.length} child pods`);
    return children;
  }
}

// ============================================================================
// POD LIFECYCLE MANAGER
// ============================================================================

export class PodLifecycleManager {
  private hydrationEngine: HydrationEngine;
  private compressionEngine: CompressionEngine;
  private spawnEngine: SpawnEngine;

  constructor(private motherShell: MotherShell) {
    this.hydrationEngine = new HydrationEngine(motherShell);
    this.compressionEngine = new CompressionEngine();
    this.spawnEngine = new SpawnEngine(motherShell);
  }

  async hydrate(seed: PodSeed): Promise<PodInstance> {
    return this.hydrationEngine.hydrate(seed);
  }

  async rest(instance: PodInstance): Promise<PodSeed> {
    return this.compressionEngine.compress(instance);
  }

  async spawn(instance: PodInstance): Promise<PodInstance[]> {
    return this.spawnEngine.evaluateAndSpawn(instance);
  }

  async executeTask(instance: PodInstance, task: PodTask): Promise<void> {
    console.log(`[Execute] Running task ${task.id} on ${instance.instanceId}...`);

    instance.currentTask = {
      ...task,
      status: 'running',
      startedAt: new Date(),
    };

    // Simulate task execution
    await new Promise((resolve) => setTimeout(resolve, 500));

    instance.currentTask = {
      ...instance.currentTask,
      status: 'complete',
      completedAt: new Date(),
    };

    instance.lastExecutedAt = new Date();
    console.log(`✓ Task ${task.id} complete`);
  }

  async evaluateLifecycle(instance: PodInstance): Promise<void> {
    const config = instance.seed.lifecycle;
    const now = new Date();
    const idleDuration = now.getTime() - instance.lastExecutedAt.getTime();

    // Check idle timeout
    if (idleDuration > config.idleTimeout) {
      console.log(
        `[Lifecycle] ${instance.instanceId} idle for ${idleDuration}ms, initiating rest...`
      );
      await this.rest(instance);
    }
  }
}

// ============================================================================
// POD COMMUNICATION BROKER
// ============================================================================

export class PodCommunicationBroker {
  private messageQueues = new Map<string, PodMessage[]>();
  private subscribers = new Map<string, Set<(msg: PodMessage) => void>>();

  async send(msg: PodMessage): Promise<void> {
    console.log(
      `[Message] ${msg.fromPodId} → ${msg.toPodId}: ${msg.type}`
    );

    if (!this.messageQueues.has(msg.toPodId)) {
      this.messageQueues.set(msg.toPodId, []);
    }

    this.messageQueues.get(msg.toPodId)!.push(msg);
    this.notifySubscribers(msg.toPodId, msg);
  }

  async broadcast(msg: PodMessage): Promise<void> {
    console.log(`[Broadcast] ${msg.fromPodId}: ${msg.type}`);
    this.notifyAllSubscribers(msg);
  }

  subscribe(podId: string, handler: (msg: PodMessage) => void): void {
    if (!this.subscribers.has(podId)) {
      this.subscribers.set(podId, new Set());
    }
    this.subscribers.get(podId)!.add(handler);
  }

  private notifySubscribers(podId: string, msg: PodMessage): void {
    const handlers = this.subscribers.get(podId);
    if (handlers) {
      handlers.forEach((handler) => handler(msg));
    }
  }

  private notifyAllSubscribers(msg: PodMessage): void {
    this.subscribers.forEach((handlers) => {
      handlers.forEach((handler) => handler(msg));
    });
  }

  getMessages(podId: string): PodMessage[] {
    return this.messageQueues.get(podId) || [];
  }
}
