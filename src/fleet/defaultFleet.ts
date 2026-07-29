/**
 * The app's actual fleet — defined once, shared by everything that needs it.
 *
 * Previously FleetApp built its own FleetService while the supervision trigger
 * audited a different, empty one. The audit therefore reported every router
 * label as dangling: two criticals that were artefacts of the split, not real
 * defects. A supervision tool whose first act is a false alarm teaches the user
 * to ignore it, so the fix is one fleet rather than a louder warning.
 */

import { FleetService, type RegisterOptions } from './fleetService';
import { fleetService } from './fleetService';
import type { AuditInput } from '../supervision/routerAudit';
import type { RouterArtifact } from '../router/types';
import demoRouterFixture from '../router/router-fixture-v1.json';

/** Domains the starter specialists cover. */
export const DEFAULT_DOMAINS = [
  'physics', 'calculus', 'chemistry', 'biology', 'history', 'geography',
  'music', 'metaphor', 'law', 'finance', 'medicine', 'cooking',
] as const;

/** The demo artifact's labels, and which member each one means. */
export const DEMO_LABEL_ROUTING: Record<string, string> = {
  cook: 'spec-cooking',
  tech: 'spec-physics',
};

/** Fleet-wide RAM ceiling, shared by the app and the audit. */
export const DEFAULT_BUDGET_MB = 120;

function members(): RegisterOptions[] {
  return [
    { id: 'jacky', domain: 'general', tier: 'coordinator' },
    ...DEFAULT_DOMAINS.map(d => ({
      id: `spec-${d}`,
      domain: d,
      tier: 'specialist' as const,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `assistant-${i + 1}`,
      domain: 'reasoning',
      tier: 'assistant' as const,
    })),
  ];
}

/** Populate a fleet. Idempotent — registering the same id twice replaces it. */
export function seedFleet(fleet: FleetService = fleetService): FleetService {
  for (const m of members()) fleet.register(m);
  return fleet;
}

/** The shared instance, seeded on first import. */
export const defaultFleet = seedFleet(fleetService);

/**
 * The audit's view of the live fleet. Reading the real members is the whole
 * point: an audit of a fleet nobody uses proves nothing.
 */
export function fleetAuditSnapshot(fleet: FleetService = defaultFleet): AuditInput {
  return {
    artifacts: [
      {
        id: 'demo',
        artifact: demoRouterFixture.artifacts.nano as unknown as RouterArtifact,
        labelRouting: DEMO_LABEL_ROUTING,
      },
    ],
    members: fleet.list(),
    budgetMB: DEFAULT_BUDGET_MB,
  };
}
