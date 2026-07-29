/**
 * Supervision service — runs the audit on a trigger and surfaces the verdict.
 *
 * The intended trigger is "the account came online", so the first thing that
 * happens after reconnecting is being told whether the fleet built while
 * offline is sound. The audit itself is offline and deterministic; coming
 * online is just when a reviewer becomes reachable.
 *
 * The hard requirement here is NOT crying wolf. A monitor that fires on every
 * launch with the same message gets muted, and then it is worse than nothing
 * because its silence no longer means anything. So:
 *   - an identical report is not re-announced;
 *   - an info-only report is never a notification, only a stored briefing;
 *   - a report that got BETTER is announced too, because "you fixed it" is
 *     information the user needs to trust the tool.
 */

import { auditFleet, type AuditInput, type AuditReport } from './routerAudit';
import { renderBriefing, briefingHeadline } from './briefing';

export type SupervisionLevel = 'info' | 'success' | 'warning' | 'error';

export interface SupervisionEvent {
  level: SupervisionLevel;
  title: string;
  message: string;
  /** The full briefing, for a reviewer. Always present, announced or not. */
  briefing: string;
  report: AuditReport;
}

/** Stable signature of a report, so an unchanged fleet stays quiet. */
export function reportSignature(report: AuditReport): string {
  return report.findings
    .map(f => `${f.severity}:${f.code}:${f.subject}`)
    .sort()
    .join('|');
}

function levelFor(report: AuditReport): SupervisionLevel {
  if (report.findings.some(f => f.severity === 'critical')) return 'error';
  if (report.findings.some(f => f.severity === 'warning')) return 'warning';
  return 'info';
}

export class SupervisionService {
  private lastSignature: string | null = null;
  private lastEvent: SupervisionEvent | null = null;
  private now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  /** The most recent briefing, whether or not it was announced. */
  public latest(): SupervisionEvent | null {
    return this.lastEvent;
  }

  /** Forget history, so the next run announces regardless. */
  public reset(): void {
    this.lastSignature = null;
    this.lastEvent = null;
  }

  /**
   * Run an audit for `trigger`. Returns the event to announce, or null when
   * there is nothing worth interrupting the user for. The briefing is stored
   * either way and readable via `latest()`.
   */
  public run(input: AuditInput, trigger: string): SupervisionEvent | null {
    const report = auditFleet(input);
    const signature = reportSignature(report);
    const briefing = renderBriefing(report, {
      trigger,
      at: this.now().toISOString(),
    });

    const previous = this.lastSignature;
    const wasProblematic = previous !== null && previous.length > 0;
    const isClean = report.findings.length === 0;
    const changed = previous !== signature;

    const event: SupervisionEvent = {
      level: levelFor(report),
      title: briefingHeadline(report),
      message: isClean
        ? 'Every router label resolves to a registered member.'
        : `${report.findings.length} finding(s). Open the briefing for the detail.`,
      briefing,
      report,
    };
    this.lastEvent = event;
    this.lastSignature = signature;

    // Unchanged since last time: the user already knows, so stay quiet.
    if (!changed) return null;

    // Newly clean after having had findings — worth saying, because a monitor
    // that only ever reports bad news gives no signal that a fix landed.
    if (isClean) {
      if (!wasProblematic) return null;
      return { ...event, level: 'success', title: 'Router fleet is clean now' };
    }

    // Info-only findings are stored but never interrupt: they are, by
    // definition, not urgent, and this is exactly where alert fatigue starts.
    if (event.level === 'info') return null;

    return event;
  }
}

export const supervisionService = new SupervisionService();
