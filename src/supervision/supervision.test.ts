/**
 * Router audit and reviewer briefing.
 *
 * These drive the REAL audit over REAL fleet/artifact shapes and assert the
 * findings a careless configuration would actually produce. The failure mode
 * being guarded is an audit that returns "healthy" for a fleet that silently
 * drops questions — so every check has a case that must trip it.
 */
import { describe, it, expect } from 'vitest';
import { auditFleet, type AuditInput } from './routerAudit';
import { renderBriefing, briefingHeadline } from './briefing';
import type { RouterArtifact } from '../router/types';
import type { FleetMember } from '../fleet/types';

const artifact = (o: Partial<RouterArtifact> & { name: string }): RouterArtifact => ({
  format: 'router-forge',
  version: 1,
  kind: 'nano',
  labels: o.labels ?? ['cook', 'tech'],
  model: {},
  trainedOn: o.trainedOn ?? { examples: 100, accuracy: 0.95, holdout: true },
  ...o,
});

const member = (id: string, o: Partial<FleetMember> = {}): FleetMember => ({
  id,
  domain: o.domain ?? id,
  tier: o.tier ?? 'specialist',
  activeMB: o.activeMB ?? 1,
  pinned: o.pinned,
});

const healthy = (): AuditInput => ({
  artifacts: [
    {
      id: 'r1',
      artifact: artifact({ name: 'demo' }),
      labelRouting: { cook: 'spec-cook', tech: 'spec-tech' },
    },
  ],
  members: [member('spec-cook'), member('spec-tech')],
  budgetMB: 120,
});

describe('audit finds what a careless fleet gets wrong', () => {
  it('reports a clean fleet as healthy with no findings', () => {
    const report = auditFleet(healthy());
    expect(report.findings).toEqual([]);
    expect(report.healthy).toBe(true);
  });

  it('catches a label with no member — questions dropped silently', () => {
    const input = healthy();
    input.artifacts[0].labelRouting = { cook: 'spec-cook' };
    const report = auditFleet(input);
    expect(report.healthy).toBe(false);
    expect(report.findings.map(f => f.code)).toContain('unmapped-label');
  });

  it('catches a route to a member that was never registered', () => {
    const input = healthy();
    input.artifacts[0].labelRouting.tech = 'ghost';
    const report = auditFleet(input);
    expect(report.healthy).toBe(false);
    expect(report.findings.map(f => f.code)).toContain('dangling-member');
  });

  it('catches two routers disagreeing about where a label goes', () => {
    const input = healthy();
    input.artifacts.push({
      id: 'r2',
      artifact: artifact({ name: 'other' }),
      labelRouting: { cook: 'spec-tech', tech: 'spec-tech' },
    });
    expect(auditFleet(input).findings.map(f => f.code)).toContain('conflicting-route');
  });

  it('catches a member too large to ever wake', () => {
    const input = healthy();
    input.members.push(member('whale', { activeMB: 500 }));
    const report = auditFleet(input);
    expect(report.healthy).toBe(false);
    expect(report.findings.map(f => f.code)).toContain('exceeds-budget');
  });

  it('catches pinned members consuming the entire budget', () => {
    // The nastiest version: everything looks registered, but nothing else can
    // ever be woken because the pinned set alone is over budget.
    const input = healthy();
    input.members.push(member('coord', { tier: 'coordinator', activeMB: 200, pinned: true }));
    const report = auditFleet(input);
    expect(report.findings.map(f => f.code)).toContain('pinned-over-budget');
    expect(report.healthy).toBe(false);
  });

  it('flags a router with no training record', () => {
    const input = healthy();
    input.artifacts[0].artifact = { ...artifact({ name: 'x' }), trainedOn: undefined };
    expect(auditFleet(input).findings.map(f => f.code)).toContain('no-training-record');
  });

  it('flags low accuracy, because a confident wrong route is worse than none', () => {
    const input = healthy();
    input.artifacts[0].artifact = artifact({
      name: 'x',
      trainedOn: { examples: 100, accuracy: 0.4, holdout: true },
    });
    expect(auditFleet(input).findings.map(f => f.code)).toContain('low-accuracy');
  });

  it('flags an accuracy measured without a holdout as unreliable', () => {
    const input = healthy();
    input.artifacts[0].artifact = artifact({
      name: 'x',
      trainedOn: { examples: 100, accuracy: 0.99, holdout: false },
    });
    expect(auditFleet(input).findings.map(f => f.code)).toContain('no-holdout');
  });

  it('flags too few examples per label', () => {
    const input = healthy();
    input.artifacts[0].artifact = artifact({
      name: 'x',
      trainedOn: { examples: 4, accuracy: 0.9, holdout: true },
    });
    expect(auditFleet(input).findings.map(f => f.code)).toContain('thin-training-data');
  });

  it('catches a single-label router that decides nothing', () => {
    const input = healthy();
    input.artifacts[0].artifact = artifact({ name: 'x', labels: ['only'] });
    input.artifacts[0].labelRouting = { only: 'spec-cook' };
    const report = auditFleet(input);
    expect(report.findings.map(f => f.code)).toContain('degenerate-router');
    expect(report.healthy).toBe(false);
  });

  it('notes a specialist no router can reach', () => {
    const input = healthy();
    input.members.push(member('spec-orphan'));
    const report = auditFleet(input);
    expect(report.findings.map(f => f.code)).toContain('unreachable-specialist');
    // Informational only: reachable by exact domain, so routing is not broken.
    expect(report.healthy).toBe(true);
  });

  it('orders findings with critical first', () => {
    const input = healthy();
    input.artifacts[0].labelRouting = { cook: 'ghost' };
    input.members.push(member('spec-orphan'));
    const codes = auditFleet(input).findings.map(f => f.severity);
    expect(codes[0]).toBe('critical');
  });
});

describe('reviewer briefing', () => {
  const ctx = { trigger: 'account came online', at: '2026-07-29T13:00:00Z' };

  it('states plainly when routing is broken', () => {
    const input = healthy();
    input.artifacts[0].labelRouting = { cook: 'ghost' };
    const text = renderBriefing(auditFleet(input), ctx);
    expect(text).toContain('Routing is broken right now');
    expect(text).toContain('dangling-member');
  });

  it('reports a clean fleet without inventing work', () => {
    const text = renderBriefing(auditFleet(healthy()), ctx);
    expect(text).toContain('No findings');
  });

  it('always says what it did NOT check', () => {
    // A reviewer who assumes the audit was exhaustive approves things nobody
    // looked at, so this section is not optional.
    const text = renderBriefing(auditFleet(healthy()), ctx);
    expect(text).toContain('What this audit did not check');
    expect(text).toMatch(/do not treat a clean audit as evidence/i);
  });

  it('does not pre-decide the fix', () => {
    const input = healthy();
    input.artifacts[0].labelRouting = { cook: 'ghost' };
    const text = renderBriefing(auditFleet(input), ctx);
    expect(text).toMatch(/deliberately does not pick a fix/i);
  });

  it('renders the same briefing for the same report, so runs can be diffed', () => {
    const a = renderBriefing(auditFleet(healthy()), ctx);
    const b = renderBriefing(auditFleet(healthy()), ctx);
    expect(a).toBe(b);
  });

  it('headlines the severity honestly for a notification', () => {
    expect(briefingHeadline(auditFleet(healthy()))).toMatch(/clean/i);
    const broken = healthy();
    broken.artifacts[0].labelRouting = { cook: 'ghost' };
    expect(briefingHeadline(auditFleet(broken))).toMatch(/dropping questions/i);
  });
});

describe('headline does not overstate severity', () => {
  it('calls info-only findings notes, not warnings', () => {
    // Regression: this previously read "0 warning(s) — answer quality at
    // risk", which is both self-contradictory and alarmist. A supervision
    // tool that cries wolf gets ignored exactly when it matters.
    const input: AuditInput = {
      artifacts: [
        {
          id: 'r1',
          artifact: artifact({ name: 'demo' }),
          labelRouting: { cook: 'spec-cook', tech: 'spec-tech' },
        },
      ],
      members: [member('spec-cook'), member('spec-tech'), member('spec-orphan')],
      budgetMB: 120,
    };
    const report = auditFleet(input);
    expect(report.findings.every(f => f.severity === 'info')).toBe(true);
    const headline = briefingHeadline(report);
    expect(headline).toMatch(/note\(s\)/);
    expect(headline).not.toMatch(/0 warning/);
    expect(headline).toMatch(/nothing urgent/);
  });
});
