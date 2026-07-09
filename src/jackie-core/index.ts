/**
 * Jackie Core — Unified exports for the complete Jackie system
 */

// System Context & State
export { buildJackieSystemContext, updateRuntimeState } from './system-context';
export type { RuntimeState, ActivePodInfo, InformationLayerStatus } from './system-context';

// Runtime Management
export { RuntimeStateManager } from './runtime-state-manager';

// Command Planning
export { CommandPlanner } from './command-planner';
export type {
  CommandPlan,
  CommandAction,
  ResourceCost,
  CommandRisk,
} from './command-planner';

// Personality & Voice
export { JACKIE_PERSONALITY, JACKIE_RESPONSE_TEMPLATES, generateExecutionPreamble, JACKIE_SIGN_OFF } from './jackie-personality';

// Mini PC Integration
export { MiniPCManager } from './mini-pc-integration';
export type { MiniPCApp, AppAction, MiniPCState } from './mini-pc-integration';

// Eru Integration
export { EruIntegration } from './eru-integration';
export type { EruTask, EruCapability } from './eru-integration';

// Jackie Seed Tool (deployable version)
export { JackieSeedTool, createJackie, askJackie } from './jackie-seed-tool';
export type { JackieSeedConfig, JackieToolResponse } from './jackie-seed-tool';

// Jackie Toolbox (standard version)
export { JackieToolbox } from './jackie-toolbox';
export type { CompressedTool, ToolboxConfig } from './jackie-toolbox';

// Jackie Toolbox Premium (production-grade)
export { JackieToolboxPremium } from './jackie-toolbox-premium';
export type {
  CompressedToolSpec,
  ToolboxMetrics,
  ToolCategory,
  ToolStatus,
  ToolMetadata,
} from './jackie-toolbox-premium';

// Flipper Zero Firmware Manager
export { FlipperZeroManager } from './flipper-zero-firmware';
export type { FlipperApp, FlipperFirmware, FlipperToolLink } from './flipper-zero-firmware';
