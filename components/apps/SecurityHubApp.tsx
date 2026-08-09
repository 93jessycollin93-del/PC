/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Security — fifteen security tools behind one icon.
 *
 * Same construction as the Agents hub: every section is an existing,
 * unmodified app, lazily imported. Nothing was merged and nothing moved.
 *
 * Security is the cluster where scattering hurt most. Fifteen launcher rows
 * meant "is this machine in good shape?" had fifteen possible answers and no
 * obvious place to start, so in practice people opened none of them. The
 * order below is a route through that question rather than an alphabet:
 *
 *   Posture   Where do I stand right now.
 *   Find      What is wrong that I have not noticed.
 *   Watch     What changed, and who did it.
 *   Protect   Keys, secrets, and what leaves the machine.
 *
 * ADDING A SECTION
 * ----------------
 * One entry, pointing at the component where it already lives. Do NOT move
 * code here.
 */
import React from 'react';
import {
    Activity, AlertTriangle, BookLock, Bug, Eye, FileClock, FileSearch,
    Fingerprint, KeyRound, Lock, PackageSearch, ScrollText, ShieldAlert,
    ShieldCheck, Video,
} from 'lucide-react';
import { AppHub, type HubSection } from '../AppHub';

/** Shared with the Agents hub in spirit; kept local so neither hub can break the other. */
function section(
    loader: () => Promise<Record<string, unknown>>,
    exportName: string,
): HubSection['Component'] {
    return React.lazy(async () => {
        const mod = await loader();
        const Component = (mod[exportName] ?? mod.default) as React.ComponentType;
        if (!Component) throw new Error(`Security hub: ${exportName} exports no component`);
        return { default: Component };
    });
}

const SECTIONS: HubSection[] = [
    // ── Posture ─────────────────────────────────────────────────────────
    {
        id: 'center',
        label: 'Security Center',
        icon: ShieldCheck,
        blurb: 'Vault state, permissions, and recent denials at a glance.',
        Component: section(() => import('./SecurityCenterApp'), 'SecurityCenterApp'),
    },
    {
        id: 'rulebook',
        label: 'Rulebook',
        icon: BookLock,
        blurb: 'The practices this machine is meant to follow.',
        Component: section(() => import('./CyberSecurityRulebookApp'), 'CyberSecurityRulebookApp'),
    },

    // ── Find ────────────────────────────────────────────────────────────
    {
        id: 'audit-scan',
        label: 'Self Audit',
        icon: FileSearch,
        blurb: 'Scan this install for its own weak spots.',
        Component: section(() => import('./SelfAuditScannerApp'), 'SelfAuditScannerApp'),
    },
    {
        id: 'cve',
        label: 'CVE Checker',
        icon: PackageSearch,
        blurb: 'Known vulnerabilities in what this app depends on.',
        Component: section(() => import('./DependencyCVECheckerApp'), 'DependencyCVECheckerApp'),
    },
    {
        id: 'hygiene',
        label: 'Secrets Hygiene',
        icon: Bug,
        blurb: 'Keys in the wrong place, and how long they have been there.',
        Component: section(() => import('./SecretsHygieneApp'), 'SecretsHygieneApp'),
    },
    {
        id: 'anomaly',
        label: 'Anomaly Alerts',
        icon: AlertTriangle,
        blurb: 'Behaviour that does not match the usual pattern.',
        Component: section(() => import('./AnomalyAlertApp'), 'AnomalyAlertApp'),
    },

    // ── Watch ───────────────────────────────────────────────────────────
    {
        id: 'events',
        label: 'Event Log',
        icon: ScrollText,
        blurb: 'Security events as they happen.',
        Component: section(() => import('./SecurityEventLogApp'), 'SecurityEventLogApp'),
    },
    {
        id: 'audit-trail',
        label: 'Audit Trail',
        icon: FileClock,
        blurb: 'What was done, when, and by which part of the app.',
        Component: section(() => import('./AuditTrailApp'), 'AuditTrailApp'),
    },
    {
        id: 'integrity',
        label: 'Integrity Monitor',
        icon: Fingerprint,
        blurb: 'Files and state that changed when they should not have.',
        Component: section(() => import('./IntegrityMonitorApp'), 'IntegrityMonitorApp'),
    },
    {
        id: 'recorder',
        label: 'Session Recorder',
        icon: Video,
        blurb: 'Replay a session to see exactly what happened.',
        Component: section(() => import('./SessionRecorderApp'), 'SessionRecorderApp'),
    },
    {
        id: 'build-vault',
        label: 'Build Vault',
        icon: Activity,
        blurb: 'Provenance for what this build is made of.',
        Component: section(() => import('./BuildVaultApp'), 'BuildVaultApp'),
    },

    // ── Protect ─────────────────────────────────────────────────────────
    {
        id: 'secrets',
        label: 'Secrets Vault',
        icon: KeyRound,
        blurb: 'Encrypted storage for keys and tokens.',
        Component: section(() => import('./SecretsVaultApp'), 'SecretsVaultApp'),
    },
    {
        id: 'data-vault',
        label: 'Data Vault',
        icon: Lock,
        blurb: 'Encrypted storage for documents and records.',
        Component: section(() => import('./DataVaultApp'), 'DataVaultApp'),
    },
    {
        id: 'redaction',
        label: 'Redaction',
        icon: Eye,
        blurb: 'Strip sensitive text before it leaves the machine.',
        Component: section(() => import('./DataRedactionApp'), 'DataRedactionApp'),
    },
    {
        id: 'permissions',
        label: 'Permission Broker',
        icon: ShieldAlert,
        blurb: 'What each part of the app is allowed to reach.',
        Component: section(() => import('./PermissionBrokerApp'), 'PermissionBrokerApp'),
    },
];

export const SecurityHubApp: React.FC = () => (
    <AppHub
        title="Security"
        subtitle="Posture, findings, history, protection."
        sections={SECTIONS}
        initialId="center"
    />
);

export default SecurityHubApp;
