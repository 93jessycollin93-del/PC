/**
 * The online trigger.
 *
 * Drives the REAL bus and the REAL supervision service — the only thing faked
 * is the browser's online event, which cannot be produced otherwise. Deleting
 * the trigger implementation makes these fail.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startOnlineSupervision } from './onlineTrigger';
import { supervisionService } from './supervisionService';
import { bus } from '../../lib/bus';
import type { AuditInput } from './routerAudit';
import type { RouterArtifact } from '../router/types';

const artifact = (): RouterArtifact => ({
  format: 'router-forge',
  version: 1,
  kind: 'nano',
  name: 'demo',
  labels: ['cook', 'tech'],
  model: {},
  trainedOn: { examples: 100, accuracy: 0.95, holdout: true },
});

const brokenFleet = (): AuditInput => ({
  artifacts: [{ id: 'r1', artifact: artifact(), labelRouting: { cook: 'ghost', tech: 'spec-tech' } }],
  members: [{ id: 'spec-tech', domain: 'tech', tier: 'specialist', activeMB: 1 }],
  budgetMB: 120,
});

const cleanFleet = (): AuditInput => ({
  artifacts: [
    { id: 'r1', artifact: artifact(), labelRouting: { cook: 'spec-cook', tech: 'spec-tech' } },
  ],
  members: [
    { id: 'spec-cook', domain: 'cook', tier: 'specialist', activeMB: 1 },
    { id: 'spec-tech', domain: 'tech', tier: 'specialist', activeMB: 1 },
  ],
  budgetMB: 120,
});

describe('online supervision trigger', () => {
  let received: { title: string; level: string }[];
  let stop: () => void = () => {};
  let unsubscribe: () => void = () => {};

  beforeEach(() => {
    supervisionService.reset();
    received = [];
    // Must be released in afterEach: bus.on adds a real window listener, and
    // leaking one per test makes later cases count earlier subscriptions'
    // deliveries and fail for the wrong reason.
    unsubscribe = bus.on('jackie-notification', n =>
      received.push({ title: n.title, level: n.level })
    );
  });
  afterEach(() => {
    stop();
    unsubscribe();
  });

  it('audits and notifies when the account comes online', () => {
    stop = startOnlineSupervision(brokenFleet);
    window.dispatchEvent(new Event('online'));
    expect(received).toHaveLength(1);
    expect(received[0].level).toBe('error');
  });

  it('does not notify twice for an unchanged fleet', () => {
    stop = startOnlineSupervision(brokenFleet);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    expect(received).toHaveLength(1);
  });

  it('notifies again once the fleet is fixed', () => {
    let fleet = brokenFleet;
    stop = startOnlineSupervision(() => fleet());
    window.dispatchEvent(new Event('online'));
    fleet = cleanFleet;
    window.dispatchEvent(new Event('online'));
    expect(received).toHaveLength(2);
    expect(received[1].level).toBe('success');
  });

  it('does not audit on start unless asked', () => {
    stop = startOnlineSupervision(brokenFleet);
    expect(received).toHaveLength(0);
  });

  it('audits on start when explicitly opted in', () => {
    // navigator.onLine is not set by the node shim; opt-in start requires it,
    // so it is provided here rather than assumed.
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    stop = startOnlineSupervision(brokenFleet, { auditOnStart: true });
    expect(received.length).toBeGreaterThan(0);
  });

  it('survives a snapshot that throws rather than breaking on a network event', () => {
    stop = startOnlineSupervision(() => {
      throw new Error('fleet unavailable');
    });
    expect(() => window.dispatchEvent(new Event('online'))).not.toThrow();
    expect(received).toHaveLength(0);
  });

  it('stops listening once unsubscribed', () => {
    const off = startOnlineSupervision(brokenFleet);
    off();
    window.dispatchEvent(new Event('online'));
    expect(received).toHaveLength(0);
  });
});
