/**
 * The reviewer briefing.
 *
 * Turns an audit report into a compact, self-contained handover: what was
 * checked, what is wrong, what it will cost the user, and what the reviewer is
 * being asked to decide. Written to be read by a capable model OR by a person —
 * a briefing only one of them can act on is a briefing that rots.
 *
 * Deliberate constraints, because this text is what a reviewer acts on:
 *  - It never invents a fix. The audit reports facts; choosing the change is
 *    the reviewer's job, and pre-filling an answer biases it.
 *  - It states what was NOT checked. A reviewer who assumes the audit was
 *    exhaustive will approve things nobody looked at.
 *  - It stays honest about severity rather than softening, since the whole
 *    point is catching what the author could not see themselves.
 */

import type { AuditReport, Finding, Severity } from './routerAudit';

export interface BriefingContext {
  /** Why the review was triggered — e.g. 'account came online'. */
  trigger: string;
  /** ISO timestamp of the audit. */
  at: string;
  /** What the reviewer is permitted to change, stated plainly. */
  scope?: string;
}

const SEVERITY_HEADING: Record<Severity, string> = {
  critical: 'Critical — breaks routing now',
  warning: 'Warning — degrades answers quietly',
  info: 'Info — worth knowing, not urgent',
};

/** Checks this audit does NOT perform, stated so nobody assumes otherwise. */
const NOT_CHECKED = [
  'whether a router\'s labels mean what their names suggest',
  'whether the training data was representative of real questions',
  'whether a confident answer is actually correct',
  'anything about the content a member produces once it is reached',
];

function group(findings: Finding[], severity: Severity): Finding[] {
  return findings.filter(f => f.severity === severity);
}

/**
 * Render the briefing as Markdown. Stable output for the same report, so it can
 * be diffed between runs to see what changed rather than re-read in full.
 */
export function renderBriefing(report: AuditReport, ctx: BriefingContext): string {
  const lines: string[] = [];

  lines.push('# Router fleet review');
  lines.push('');
  lines.push(`Triggered by: ${ctx.trigger}`);
  lines.push(`Audited at: ${ctx.at}`);
  lines.push(
    `Checked ${report.checkedArtifacts} router artifact(s) across ${report.checkedMembers} fleet member(s).`
  );
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('No findings. Every router label resolves to a registered member, ');
    lines.push('every member fits the budget, and no two routers disagree on a label.');
  } else {
    lines.push(
      `**${report.findings.length} finding(s).** ` +
        (report.healthy
          ? 'Nothing critical — routing works, but the items below will cost answer quality.'
          : 'Routing is broken right now; the critical items below drop questions silently.')
    );
    lines.push('');

    for (const severity of ['critical', 'warning', 'info'] as Severity[]) {
      const items = group(report.findings, severity);
      if (items.length === 0) continue;
      lines.push(`## ${SEVERITY_HEADING[severity]}`);
      lines.push('');
      for (const f of items) {
        lines.push(`- **${f.subject}** (\`${f.code}\`) — ${f.summary}`);
        lines.push(`  - Consequence: ${f.consequence}`);
      }
      lines.push('');
    }
  }

  lines.push('## What this audit did not check');
  lines.push('');
  for (const item of NOT_CHECKED) lines.push(`- ${item}`);
  lines.push('');
  lines.push(
    'These need judgement rather than a rule, which is what the review is for. ' +
      'Do not treat a clean audit as evidence that the routers are sensible.'
  );
  lines.push('');

  lines.push('## What is being asked');
  lines.push('');
  lines.push(
    ctx.scope ??
      'Decide which findings to act on and propose the change. The audit reports facts only; ' +
        'it deliberately does not pick a fix, so nothing here is pre-decided.'
  );

  return lines.join('\n');
}

/** A one-line status for a notification, where the full briefing will not fit. */
export function briefingHeadline(report: AuditReport): string {
  const critical = report.findings.filter(f => f.severity === 'critical').length;
  const warnings = report.findings.filter(f => f.severity === 'warning').length;
  const info = report.findings.filter(f => f.severity === 'info').length;

  if (report.findings.length === 0) return 'Router fleet clean — no findings';
  if (critical > 0) {
    return `Router fleet: ${critical} critical, ${warnings} warning(s) — routing is dropping questions`;
  }
  if (warnings > 0) {
    return `Router fleet: ${warnings} warning(s) — routing works, answer quality at risk`;
  }
  // Info-only. Saying "0 warnings — quality at risk" would overstate the
  // severity of findings that are, by definition, not urgent — and a
  // supervision tool that cries wolf gets ignored exactly when it matters.
  return `Router fleet: ${info} note(s) — routing works, nothing urgent`;
}
