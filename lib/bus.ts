/**
 * Jackie Bus — typed pub/sub event bus.
 *
 * Formalizes the ad-hoc `window.dispatchEvent(new CustomEvent(...))` pattern that
 * is scattered across App.tsx and the apps into one typed channel registry.
 *
 * It is a thin, backward-compatible layer over `window` CustomEvents: `emit`
 * dispatches a real CustomEvent and `on` subscribes to it, so existing raw
 * dispatchers (e.g. `window.dispatchEvent(new CustomEvent('launch-app', ...))`)
 * and raw listeners keep interoperating with bus subscribers — no big-bang
 * migration required.
 */

import type { AppId } from '../types';

/**
 * The catalog of known channels and the shape of their payloads.
 * Add new channels here so every producer/consumer stays type-checked.
 */
export interface BusChannels {
  /** Open an app anywhere in the OS. */
  'launch-app': { appId: AppId | string };
  /** Ask the desktop to re-read its item list (after adding/removing apps). */
  'refresh-desktop': void;
  /** Hardware/gesture "back" request. */
  'global-back-request': void;
  /** Cloud-sync lifecycle updates from lib/persist.ts. */
  'cloud-sync-status': { status: 'idle' | 'syncing' | 'error'; message?: string };
  /** Cloud-sync enable toggle changed. */
  'cloud-sync-enabled-changed': { enabled: boolean };
  /** Offline sync queue changed (lib/idb.ts). */
  'sync-queue-updated': { pending: number };
  /** A capability grant was changed in the Permission Broker. */
  'permission-changed': { scope: string; capability: string; granted: boolean };
  /** A capability check was denied — surfaced for the Notification Center. */
  'permission-denied': { scope: string; capability: string; detail?: string };
  /** A user-facing notification for the Activity/Notification Center. */
  'jackie-notification': {
    level: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    source?: string;
  };
  /** An automation rule fired (lib/automation.ts). */
  'automation-run': { ruleId: string; name: string; ok: boolean; detail?: string };
  /** A scheduled job fired (lib/scheduler.ts). */
  'scheduler-run': { jobId: string; name: string; ok: boolean; detail?: string };
  'restore-workspace-profile': { profile: unknown };
  'app-error': { appId?: string; error?: string; detail?: string; timestamp?: number };
  'app-reset': { appId: string; timestamp: number };
  'activity-retry': { activityId: string; retryCount: number };
  'pod-message': unknown;
  'team-execution-started': unknown;
  'agent-message': unknown;
  'task-status-changed': { taskId: string; phase: string; executionId?: string };
  'clipboard-copied': { dataType?: string; sourceApp?: string; destinationApp?: string; length?: number; text?: string; timestamp?: number };
  'clipboard-pasted': { dataType?: string; sourceApp?: string; destinationApp?: string; length?: number; text?: string; timestamp?: number };
  'voice-state-changed': { state: string };
  'voice-transcript': { interim?: string; final?: string; transcript?: string; confidence?: number };
  'voice-error': { error: string };
  'voice-woken': { transcript: string; confidence?: number };
  'voice-dictate': { text: string };
  'automation-trigger': { ruleId: string };
  'voice-command-executed': { command?: string; commandId?: string; keyword?: string; intent?: string; transcript?: string; ok?: boolean };
}

export type BusChannel = keyof BusChannels;

type Handler<K extends BusChannel> = (payload: BusChannels[K]) => void;

const WRAPPED = Symbol('jackie-bus-wrapped');

interface WrappedListener extends EventListener {
  [WRAPPED]?: unknown;
}

/**
 * Emit an event on a channel. Delivers to bus subscribers AND any legacy
 * `window.addEventListener(channel, ...)` listeners.
 */
export function emit<K extends BusChannel>(
  channel: K,
  ...args: BusChannels[K] extends void ? [] : [BusChannels[K]]
): void {
  if (typeof window === 'undefined') return;
  const detail = (args.length > 0 ? args[0] : undefined) as BusChannels[K];
  window.dispatchEvent(new CustomEvent(channel, { detail }));
}

/**
 * Subscribe to a channel. Returns an unsubscribe function.
 * Also catches legacy raw CustomEvents dispatched with the same name.
 */
export function on<K extends BusChannel>(channel: K, handler: Handler<K>): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener: WrappedListener = (event: Event) => {
    const detail = (event as CustomEvent).detail as BusChannels[K];
    handler(detail);
  };
  listener[WRAPPED] = handler;
  window.addEventListener(channel, listener);
  return () => window.removeEventListener(channel, listener);
}

/** Subscribe to a channel for a single emission, then auto-unsubscribe. */
export function once<K extends BusChannel>(channel: K, handler: Handler<K>): () => void {
  const off = on(channel, payload => {
    off();
    handler(payload);
  });
  return off;
}

/** Namespaced surface for ergonomic imports: `import { bus } from './bus'`. */
export const bus = { emit, on, once };
export default bus;
