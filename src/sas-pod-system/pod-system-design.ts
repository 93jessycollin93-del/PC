/**
 * Pod System Design — Type definitions and architecture contracts
 * Defines the complete data model for infinite-scalable pod orchestration
 */

// ============================================================================
// CORE POD TYPES
// ============================================================================

export interface PodSeed {
  id: string;
  fingerprint: string; // unique identifier for this seed type
  sizeBytes: number; // compressed size (typically 40 kB target)

  codebook: CompressionCodebook; // patterns + reconstruction rules
  spawnRules: SpawnRules; // when/how to spawn children
  infoPointers: InfoPointer[]; // which information layers to load
  lifecycle: LifecycleConfig; // sleep/wake/rest configuration
}

// ============================================================================
// COMPRESSION & RECONSTRUCTION
// ============================================================================

export interface CompressionCodebook {
  patterns: PatternSignature[]; // high-frequency patterns extracted from execution
  symbolMap: Map<string, number>; // token → symbol ID mapping
  reconstructionRules: ReconstructionRule[]; // how to expand symbols back to capabilities
  inferenceRecipe: InferenceRecipe; // steps to rebuild full capability from seed
}

export interface PatternSignature {
  id: string;
  hash: string; // content hash
  frequency: number; // how often this pattern appears
  examples: string[]; // concrete examples
}

export interface ReconstructionRule {
  pattern: string;
  rule: string; // instructions for expanding this pattern
  priority: number; // execution order
}

export interface InferenceRecipe {
  steps: string[]; // ordered steps to reconstruct state
  contextRequirements: Map<string, string[]>; // step → required info layers
  fallbacks: FallbackStrategy[]; // what to do if info layers unavailable
}

export interface FallbackStrategy {
  condition: string;
  action: string;
}

// ============================================================================
// SPAWN RULES & MUTATIONS
// ============================================================================

export interface SpawnRules {
  triggers: SpawnTrigger[]; // conditions that trigger spawning
  maxChildren: number; // maximum child pods allowed
  mutationRules: MutationRule[]; // how children differ from parent
}

export interface SpawnTrigger {
  type: 'load-threshold' | 'context-need' | 'specialization' | 'replication';
  condition: () => boolean; // evaluated at runtime
  priority: number;
}

export interface MutationRule {
  aspect: string; // what aspect mutates (specialization, memory, focus)
  mutationFn: (seed: PodSeed) => PodSeed; // how the child seed differs
  trigger: SpawnTrigger; // when this mutation applies
}

// ============================================================================
// INFORMATION LAYERS (Shared Context / Soil)
// ============================================================================

export interface InformationLayer {
  id: string;
  name: string;
  scope: 'all' | 'category' | 'specific'; // who can access it
  type: 'context' | 'knowledge' | 'config' | 'cache';
  dataPath: string; // where the data lives (file, URL, DB)
  sizeBytes: number; // uncompressed size
}

export interface InfoPointer {
  layerId: string;
  required: boolean; // must load or can skip
  loadSize: 'sample' | 'full'; // sample for hydration, full for execution
  cache: boolean; // keep in memory after loading
}

// ============================================================================
// MOTHER SHELL — Central Orchestrator
// ============================================================================

export interface MotherShell {
  podRegistry: Map<string, PodMetadata>; // all known pods (active + dormant)
  informationLayers: InformationLayer[]; // shared context
  lifecycleManager: PodLifecycleManager; // orchestrates pod lifecycle
  communicationBroker: PodCommunicationBroker; // pod-to-pod messaging
}

export interface PodMetadata {
  podId: string;
  podName: string;
  seed: PodSeed; // the dormant blueprint
  state: 'dormant' | 'hydrating' | 'active' | 'resting' | 'compressing';
  lastActiveTime: Date;
  spawnedCount: number; // total children spawned
  activeInstances: PodInstance[]; // currently active instances
}

// ============================================================================
// ACTIVE POD INSTANCE (Expanded from Seed)
// ============================================================================

export interface PodInstance {
  instanceId: string;
  seed: PodSeed;
  reconstructedState: ReconstructedState; // expanded capabilities
  currentTask?: PodTask;
  loadedLayers: Map<string, any>; // cached information layers
  childPods: PodInstance[]; // spawned children
  createdAt: Date;
  lastExecutedAt: Date;
}

export interface ReconstructedState {
  capabilities: string[]; // what this pod can do (expanded from codebook)
  memory: Map<string, any>; // working memory during execution
  executionContext: any; // runtime state
}

export interface PodTask {
  id: string;
  description: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  result?: any;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// LIFECYCLE MANAGEMENT
// ============================================================================

export interface LifecycleConfig {
  maxActiveDuration: number; // milliseconds before forced rest
  idleTimeout: number; // milliseconds before dormancy
  resourceLimits: ResourceLimits;
  targetSeedSize: number; // goal size after compression
}

export interface ResourceLimits {
  maxMemory: number; // bytes
  maxCPU: number; // millicores
  maxInstances: number; // concurrent children
}

// ============================================================================
// POD-TO-POD COMMUNICATION
// ============================================================================

export interface PodMessage {
  fromPodId: string;
  toPodId: string;
  type: 'request' | 'response' | 'broadcast';
  payload: any;
  timestamp: Date;
}

export interface PodCommunicationBroker {
  send(msg: PodMessage): Promise<void>;
  broadcast(msg: PodMessage): Promise<void>;
  subscribe(podId: string, handler: (msg: PodMessage) => void): void;
}

// ============================================================================
// LIFECYCLE MANAGERS (Service Interfaces)
// ============================================================================

export interface PodLifecycleManager {
  hydrate(seed: PodSeed): Promise<PodInstance>;
  rest(instance: PodInstance): Promise<PodSeed>;
  spawn(instance: PodInstance): Promise<PodInstance[]>;
}

// ============================================================================
// EXAMPLE: Father Pod (40 kB Reasoning Seed)
// ============================================================================

export const exampleFatherPod: PodSeed = {
  id: 'father-001-reasoning',
  fingerprint: 'reasoning-v1-qwen32b',
  sizeBytes: 39875, // Just under 40 kB

  codebook: {
    patterns: [
      {
        id: 'reasoning-thought',
        hash: 'abc123',
        frequency: 1200,
        examples: ['<think>', '<reason>', 'therefore'],
      },
      {
        id: 'logical-deduction',
        hash: 'def456',
        frequency: 800,
        examples: ['if', 'then', 'because'],
      },
    ],
    symbolMap: new Map([
      ['<think>', 0],
      ['<reason>', 1],
      ['if', 2],
    ]),
    reconstructionRules: [
      {
        pattern: 'thought_token',
        rule: 'expand with context layer "reasoning-context"',
        priority: 1,
      },
      {
        pattern: 'deduction_token',
        rule: 'apply logical inference rules',
        priority: 2,
      },
    ],
    inferenceRecipe: {
      steps: [
        'load-codebook',
        'fetch-context',
        'initialize-reasoning-state',
        'run-inference-loop',
      ],
      contextRequirements: new Map([
        ['fetch-context', ['reasoning-context']],
      ]),
      fallbacks: [
        {
          condition: 'reasoning-context-unavailable',
          action: 'use-base-reasoning-only',
        },
      ],
    },
  },

  spawnRules: {
    triggers: [
      {
        type: 'load-threshold',
        condition: () => Math.random() > 0.6,
        priority: 1,
      },
    ],
    maxChildren: 2,
    mutationRules: [
      {
        aspect: 'specialization',
        mutationFn: (seed) => ({
          ...seed,
          id: `${seed.id}-specialist-${Date.now()}`,
          fingerprint: 'reasoning-specialist',
        }),
        trigger: {
          type: 'specialization',
          condition: () => true,
          priority: 1,
        },
      },
    ],
  },

  infoPointers: [
    {
      layerId: 'reasoning-context',
      required: true,
      loadSize: 'sample',
      cache: true,
    },
  ],

  lifecycle: {
    maxActiveDuration: 60000,
    idleTimeout: 30000,
    resourceLimits: {
      maxMemory: 512000000,
      maxCPU: 1000,
      maxInstances: 2,
    },
    targetSeedSize: 40000,
  },
};
