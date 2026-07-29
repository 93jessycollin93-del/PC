/**
 * Supervision triggering.
 *
 * The behaviour under test is when the service stays QUIET, not just when it
 * fires. A monitor that announces the same thing on every launch gets muted,
 * and a muted monitor is worse than none because its silence stops meaning
 * anything. Each quiet case here is therefore a real assertion, not an omission.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SupervisionService, reportSignature } from './supervisionService';
import { auditFleet, type AuditInput } from './routerAudit';
import type { RouterArtifact } from '../router/types';
import type { FleetMember } from '../fleet/types';

const artifact = (o: Partial<RouterArtifact> = {}): RouterArtifact => ({
  format: 'router-forge',
  version: 1,
  kind: 'nano',
  name: 'demo',
  labels: ['cook', 'tech'],
  model: {},
  trainedOn: { examples: 100, accuracy: 0.95, holdout: true },
  ...o,
});

const member = (id: string, o: Partial<FleetMember> = {}): FleetMember => ({
  id,
  domain: o.domain ?? id,
  tier: o.tier ?? 'specialist',
  activeMB: o.activeMB ?? 1,
  pinned: o.pinned,
});

const clean = (): AuditInput => ({
  artifacts: [
    { id: 'r1', artifact: artifact(), labelRouting: { cook: 'spec-cook', tech: 'spec-tech' } },
  ],
  members: [member('spec-cook'), member('spec-tech')],
  budgetMB: 120,
});

const broken = (): AuditInput => {
  const input = clean();
  input.artifacts[0].labelRouting = { cook: 'ghost', tech: 'spec-tech' };
  return input;
};

const warned = (): AuditInput => {
  const input = clean();
  input.artifacts[0].artifact = artifact({
    trainedOn: { examples: 100, accuracy: 0.4, holdout: true },
  });
  return input;
};

const infoOnly = (): AuditInput => {
  const input = clean();
  input.members.push(member('spec-orphan'));
  return input;
};

describe('supervision triggering', () => {
  let svc: SupervisionService;
  beforeEach(() => {
    svc = new SupervisionService(() => new Date('2026-07-29T13:00:00Z'));
  });

  it('announces a broken fleet the first time it is seen', () => {
    const event = svc.run(broken(), 'account came online');
    expect(event).not.toBeNull();
    expect(event!.level).toBe('error');
    expect(event!.briefing).toContain('dangling-member');
  });

  it('stays quiet when nothing changed since last run', () => {
    expect(svc.run(broken(), 'first')).not.toBeNull();
    // Same fleet, same findings — the user already knows. Announcing again is
    // how a monitor trains its user to ignore it.
    expect(svc.run(broken(), 'second')).toBeNull();
  });

  it('announces again once the findings actually change', () => {
    svc.run(broken(), 'first');
    const changed = svc.run(warned(), 'second');
    expect(changed).not.toBeNull();
    expect(changed!.level).toBe('warning');
  });

  it('says so when a previously broken fleet becomes clean', () => {
    // A monitor that only reports bad news gives no signal that a fix landed,
    // so the user never learns whether their change worked.
    svc.run(broken(), 'first');
    const fixed = svc.run(clean(), 'second');
    expect(fixed).not.toBeNull();
    expect(fixed!.level).toBe('success');
    expect(fixed!.title).toMatch(/clean now/i);
  });

  it('never announces a clean fleet that was already clean', () => {
    expect(svc.run(clean(), 'first')).toBeNull();
    expect(svc.run(clean(), 'second')).toBeNull();
  });

  it('never interrupts for info-only findings, but still stores the briefing', () => {
    const event = svc.run(infoOnly(), 'account came online');
    expect(event).toBeNull();
    // Stored, so a reviewer can still read it on demand.
    expect(svc.latest()).not.toBeNull();
    expect(svc.latest()!.report.findings.length).toBeGreaterThan(0);
    expect(svc.latest()!.briefing).toContain('unreachable-specialist');
  });

  it('always keeps the latest briefing, announced or not', () => {
    svc.run(clean(), 'first');
    expect(svc.latest()!.briefing).toContain('No findings');
  });

  it('carries the trigger into the briefing so the reason is recorded', () => {
    svc.run(broken(), 'account came online');
    expect(svc.latest()!.briefing).toContain('account came online');
  });

  it('announces again after a reset', () => {
    svc.run(broken(), 'first');
    expect(svc.run(broken(), 'second')).toBeNull();
    svc.reset();
    expect(svc.run(broken(), 'third')).not.toBeNull();
  });
});

describe('report signature', () => {
  it('is identical for the same findings regardless of ordering', () => {
    const a = reportSignature(auditFleet(broken()));
    const b = reportSignature(auditFleet(broken()));
    expect(a).toBe(b);
  });

  it('differs when the findings differ', () => {
    expect(reportSignature(auditFleet(broken()))).not.toBe(
      reportSignature(auditFleet(warned()))
    );
  });

  it('is empty for a clean report', () => {
    expect(reportSignature(auditFleet(clean()))).toBe('');
  });
});
