/**
 * SAS Pod System — Unified Export
 * Infinite-scalable pod orchestration for AI workloads
 */

export { SASCore, type HardwareProfile, type SystemStatus } from './sas-core';
export { PodFactory } from './pod-factory-infinite';
export {
  HydrationEngine,
  CompressionEngine,
  SpawnEngine,
  PodLifecycleManager,
  PodCommunicationBroker,
} from './pod-system-engine';
export type {
  PodSeed,
  CompressionCodebook,
  PatternSignature,
  ReconstructionRule,
  InferenceRecipe,
  MotherShell,
  PodMetadata,
  InformationLayer,
  PodInstance,
  ReconstructedState,
  PodTask,
  SpawnRules,
  SpawnTrigger,
  MutationRule,
  LifecycleConfig,
  ResourceLimits,
  PodMessage,
  PodCommunicationBroker,
  PodLifecycleManager,
  InfoPointer,
} from './pod-system-design';

export { exampleFatherPod } from './pod-system-design';
