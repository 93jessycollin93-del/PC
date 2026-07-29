/**
 * Wires the supervision audit to "the account came online".
 *
 * Kept apart from SupervisionService so that service stays pure and testable:
 * this file owns the browser event and the bus, the service owns the decision
 * about whether anything is worth saying.
 *
 * Only announces on the offline→online transition, not on every launch. The
 * moment a reviewer becomes reachable is the useful moment; repeating on each
 * start is how a monitor gets muted.
 */

import { bus } from '../../lib/bus';
import { supervisionService } from './supervisionService';
import type { AuditInput } from './routerAudit';

/** Supplies the current fleet at trigger time, so the audit is never stale. */
export type FleetSnapshot = () => AuditInput;

export interface OnlineTriggerOptions {
  /** Run once immediately if already online. Off by default — see above. */
  auditOnStart?: boolean;
}

/**
 * Start listening. Returns an unsubscribe function.
 *
 * Safe to call when `window` is absent (tests, SSR): it becomes a no-op rather
 * than throwing, so a caller never has to guard the environment itself.
 */
export function startOnlineSupervision(
  snapshot: FleetSnapshot,
  options: OnlineTriggerOptions = {}
): () => void {
  if (typeof window === 'undefined') return () => {};

  const audit = (trigger: string) => {
    let input: AuditInput;
    try {
      input = snapshot();
    } catch {
      // A broken snapshot must not take down the app on a network event.
      return;
    }
    const event = supervisionService.run(input, trigger);
    if (!event) return;
    bus.emit('jackie-notification', {
      level: event.level,
      title: event.title,
      message: event.message,
      source: 'router-supervision',
    });
  };

  const onOnline = () => audit('account came online');
  window.addEventListener('online', onOnline);

  if (options.auditOnStart && navigator.onLine) {
    audit('app started while online');
  }

  return () => window.removeEventListener('online', onOnline);
}
