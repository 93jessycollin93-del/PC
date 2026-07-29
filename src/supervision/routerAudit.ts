/**
 * Router audit — deterministic checks over a hand-built fleet.
 *
 * The point: someone experimenting with their own routers should be told what
 * is wrong BEFORE it quietly degrades the app, and told it without needing a
 * model to be reachable. Every check here is pure and offline; none of them
 * requires an opinion.
 *
 * What this deliberately does NOT do is decide what to change. It reports
 * findings and hands a briefing to a reviewer (a person, or a capable model) to
 * judge. That split matters: facts a machine can verify stay verifiable, and
 * judgement stays with something that can actually reason about intent.
 */

import type { RouterArtifact } from '../router/types';
import type { FleetMember } from '../fleet/types';

export type Severity = 'critical' | 'warning' | 'info';

export interface Finding {
  severity: Severity;
  /** Stable machine-readable kind, for grouping and for tests. */
  code: string;
  /** One sentence stating the defect. */
  summary: string;
  /** What actually goes wrong, concretely. */
  consequence: string;
  /** Which router or member this concerns. */
  subject: string;
}

export interface AuditInput {
  artifacts: { id: string; artifact: RouterArtifact; labelRouting: Record<string, string> }[];
  members: FleetMember[];
  /** Total RAM the fleet may occupy. */
  budgetMB: number;
}

export interface AuditReport {
  findings: Finding[];
  checkedArtifacts: number;
  checkedMembers: number;
  /** True when nothing critical was found. */
  healthy: boolean;
}

/** Labels pointing at a member that does not exist — a dead end at route time. */
function checkDanglingRoutes(input: AuditInput): Finding[] {
  const memberIds = new Set(input.members.map(m => m.id));
  const findings: Finding[] = [];
  for (const { id, artifact, labelRouting } of input.artifacts) {
    for (const label of artifact.labels) {
      const target = labelRouting[label];
      if (!target) {
        findings.push({
          severity: 'critical',
          code: 'unmapped-label',
          subject: `${id}:${label}`,
          summary: `Router '${id}' can output '${label}' but nothing maps that label to a member.`,
          consequence:
            'Questions classified as this label are dropped silently — the user sees no answer and no error.',
        });
      } else if (!memberIds.has(target)) {
        findings.push({
          severity: 'critical',
          code: 'dangling-member',
          subject: `${id}:${label}`,
          summary: `Router '${id}' routes '${label}' to member '${target}', which is not registered.`,
          consequence: 'The route resolves to nothing, so the question is lost at dispatch.',
        });
      }
    }
  }
  return findings;
}

/** Two routers claiming the same label, sending it to different members. */
function checkConflictingRoutes(input: AuditInput): Finding[] {
  const byLabel = new Map<string, Map<string, string[]>>();
  for (const { id, labelRouting } of input.artifacts) {
    for (const [label, target] of Object.entries(labelRouting)) {
      if (!byLabel.has(label)) byLabel.set(label, new Map());
      const targets = byLabel.get(label) as Map<string, string[]>;
      targets.set(target, [...(targets.get(target) ?? []), id]);
    }
  }
  const findings: Finding[] = [];
  for (const [label, targets] of byLabel) {
    if (targets.size > 1) {
      findings.push({
        severity: 'warning',
        code: 'conflicting-route',
        subject: label,
        summary: `Label '${label}' is routed to ${targets.size} different members by different routers.`,
        consequence:
          'Which member answers depends on which router ran, so the same question can get different handling run to run.',
      });
    }
  }
  return findings;
}

/** A member no router can ever reach. */
function checkUnreachableMembers(input: AuditInput): Finding[] {
  const reachable = new Set<string>();
  for (const { labelRouting } of input.artifacts) {
    for (const target of Object.values(labelRouting)) reachable.add(target);
  }
  return input.members
    .filter(m => m.tier === 'specialist' && !reachable.has(m.id))
    .map(m => ({
      severity: 'info' as Severity,
      code: 'unreachable-specialist',
      subject: m.id,
      summary: `Specialist '${m.id}' (${m.domain}) is not the target of any router label.`,
      consequence:
        'It can only be reached by an exact domain match, so a question phrased naturally will never get to it.',
    }));
}

/** A member that cannot fit the budget even alone. */
function checkBudgetFit(input: AuditInput): Finding[] {
  const findings: Finding[] = [];
  for (const m of input.members) {
    if (m.activeMB > input.budgetMB) {
      findings.push({
        severity: 'critical',
        code: 'exceeds-budget',
        subject: m.id,
        summary: `Member '${m.id}' needs ${m.activeMB} MB but the fleet budget is ${input.budgetMB} MB.`,
        consequence: 'It can never be woken, so any question routed to it fails no matter what else sleeps.',
      });
    }
  }
  const pinnedMB = input.members.filter(m => m.pinned).reduce((s, m) => s + m.activeMB, 0);
  if (pinnedMB > input.budgetMB) {
    findings.push({
      severity: 'critical',
      code: 'pinned-over-budget',
      subject: 'fleet',
      summary: `Pinned members total ${pinnedMB} MB, over the ${input.budgetMB} MB budget.`,
      consequence: 'Nothing else can ever be woken, because pinned members cannot be evicted to make room.',
    });
  }
  return findings;
}

/** Artifacts whose reported training looks too weak to trust in routing. */
function checkTrainingQuality(input: AuditInput): Finding[] {
  const findings: Finding[] = [];
  for (const { id, artifact } of input.artifacts) {
    const trained = artifact.trainedOn;
    if (!trained) {
      findings.push({
        severity: 'warning',
        code: 'no-training-record',
        subject: id,
        summary: `Router '${id}' reports no training record.`,
        consequence: 'There is no way to tell whether it learned anything or is routing near-randomly.',
      });
      continue;
    }
    if (trained.accuracy !== null && trained.accuracy < 0.7) {
      findings.push({
        severity: 'warning',
        code: 'low-accuracy',
        subject: id,
        summary: `Router '${id}' reports ${Math.round(trained.accuracy * 100)}% accuracy.`,
        consequence:
          'It will misroute often, and a confident wrong route is worse than no route because nothing signals the error.',
      });
    }
    if (!trained.holdout) {
      findings.push({
        severity: 'warning',
        code: 'no-holdout',
        subject: id,
        summary: `Router '${id}' was scored without a holdout set.`,
        consequence: 'Its accuracy is measured on data it trained on, so the number is optimistic and unreliable.',
      });
    }
    if (trained.examples < artifact.labels.length * 5) {
      findings.push({
        severity: 'warning',
        code: 'thin-training-data',
        subject: id,
        summary: `Router '${id}' trained on ${trained.examples} examples for ${artifact.labels.length} labels.`,
        consequence: 'Too few examples per label to generalise; it will latch onto surface wording.',
      });
    }
  }
  return findings;
}

/** A router with only one label cannot discriminate at all. */
function checkDegenerateRouters(input: AuditInput): Finding[] {
  return input.artifacts
    .filter(a => a.artifact.labels.length < 2)
    .map(a => ({
      severity: 'critical' as Severity,
      code: 'degenerate-router',
      subject: a.id,
      summary: `Router '${a.id}' has ${a.artifact.labels.length} label(s).`,
      consequence: 'It returns the same answer for every input, so it adds cost without making any decision.',
    }));
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Run every check. Pure: same fleet in, same report out. */
export function auditFleet(input: AuditInput): AuditReport {
  const findings = [
    ...checkDanglingRoutes(input),
    ...checkConflictingRoutes(input),
    ...checkBudgetFit(input),
    ...checkTrainingQuality(input),
    ...checkDegenerateRouters(input),
    ...checkUnreachableMembers(input),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    findings,
    checkedArtifacts: input.artifacts.length,
    checkedMembers: input.members.length,
    healthy: !findings.some(f => f.severity === 'critical'),
  };
}
