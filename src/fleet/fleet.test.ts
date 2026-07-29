/**
 * Fleet residency and routing.
 *
 * These drive the REAL service and assert the RAM state a device would actually
 * feel (`currentMB`, who is awake), never that a planner "was called". The bug
 * this style exists to catch: a caller that consults the budget and then loads
 * anyway. Asserting the gate ran passes straight over that; asserting the
 * consequence does not.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FleetService } from './fleetService';
import { planWake, selectSleepVictim, totalActiveMB } from './residency';
import type { AwakeMember, FleetMember } from './types';

const member = (o: Partial<FleetMember> & { id: string }): FleetMember => ({
  domain: o.domain ?? o.id,
  tier: o.tier ?? 'specialist',
  activeMB: o.activeMB ?? 1,
  pinned: o.pinned,
  id: o.id,
});
const awakeMember = (o: Partial<AwakeMember> & { id: string }): AwakeMember => ({
  ...member(o),
  lastUsedAt: o.lastUsedAt ?? 0,
});

describe('residency planning', () => {
  it('costs nothing to re-wake someone already awake', () => {
    const awake = [awakeMember({ id: 'a', activeMB: 10 })];
    const plan = planWake(awake, member({ id: 'a', activeMB: 10 }), 20);
    expect(plan.fits).toBe(true);
    expect(plan.evict).toEqual([]);
  });

  it('evicts the lowest tier first, then least-recently-used', () => {
    const awake = [
      awakeMember({ id: 'assistant-old', tier: 'assistant', activeMB: 10, lastUsedAt: 1 }),
      awakeMember({ id: 'spec-new', tier: 'specialist', activeMB: 10, lastUsedAt: 9 }),
      awakeMember({ id: 'spec-old', tier: 'specialist', activeMB: 10, lastUsedAt: 2 }),
    ];
    const plan = planWake(awake, member({ id: 'in', activeMB: 10 }), 30);
    // Specialists go before assistants; among specialists, the stalest first.
    expect(plan.evict[0].id).toBe('spec-old');
  });

  it('never evicts a pinned member', () => {
    const awake = [awakeMember({ id: 'coord', tier: 'coordinator', activeMB: 40, pinned: true })];
    const plan = planWake(awake, member({ id: 'in', activeMB: 40 }), 50);
    expect(plan.fits).toBe(false);
    expect(plan.evict).toEqual([]);
    expect(plan.reason).toMatch(/pinned|in-use/i);
  });

  it('says plainly when a member alone exceeds the whole budget', () => {
    const plan = planWake([], member({ id: 'huge', activeMB: 500 }), 120);
    expect(plan.fits).toBe(false);
    expect(plan.evict).toEqual([]);
    expect(plan.reason).toContain('500');
  });

  it('returns no victim when everything left is pinned', () => {
    const awake = [awakeMember({ id: 'p', pinned: true })];
    expect(selectSleepVictim(awake, member({ id: 'x' }), () => false)).toBeUndefined();
  });

  it('sums only what is awake', () => {
    expect(totalActiveMB([awakeMember({ id: 'a', activeMB: 3 }), awakeMember({ id: 'b', activeMB: 4 })])).toBe(7);
  });
});

describe('fleet service', () => {
  let fleet: FleetService;
  let clock: number;

  beforeEach(() => {
    clock = 0;
    fleet = new FleetService({ budgetMB: 60, maxAwakeAssistants: 5 }, () => ++clock);
    fleet.register({ id: 'jacky', domain: 'general', tier: 'coordinator', activeMB: 40 });
    for (const d of ['physics', 'calculus', 'metaphor']) {
      fleet.register({ id: `spec-${d}`, domain: d, tier: 'specialist', activeMB: 1 });
    }
    for (let i = 0; i < 5; i++) {
      fleet.register({ id: `asst-${i}`, domain: 'reasoning', tier: 'assistant', activeMB: 10 });
    }
  });

  it('a dormant specialist costs nothing until it is asked to think', () => {
    // The whole premise: 50-100 specialists are affordable because idle is 0.
    expect(fleet.isAwake('spec-physics')).toBe(false);
    const before = fleet.currentMB();
    fleet.wake('spec-physics');
    expect(fleet.currentMB()).toBe(before + 1);
    fleet.sleep('spec-physics');
    expect(fleet.currentMB()).toBe(before);
  });

  it('routes a question to the specialist that claims the domain', () => {
    expect(fleet.routeTo('physics')?.id).toBe('spec-physics');
    expect(fleet.routeTo('PHYSICS')?.id).toBe('spec-physics');
  });

  it('falls back to the coordinator when no specialist claims the domain', () => {
    expect(fleet.routeTo('underwater basket weaving')?.id).toBe('jacky');
  });

  it('keeps the coordinator warm — it is never put to sleep', () => {
    fleet.wake('jacky');
    expect(fleet.sleep('jacky')).toBe(false);
    fleet.sleepAll();
    expect(fleet.isAwake('jacky')).toBe(true);
  });

  it('holds peak RAM to what the device really had to carry, not the sum of participants', () => {
    fleet.wake('jacky'); // pinned, 40 of the 60 budget
    const outcome = fleet.ask('physics', { assistants: 2 });
    expect(outcome.error).toBeUndefined();
    // 5 members took part (1 specialist + 2 assistants + coordinator hops), but
    // each slept after its step, so peak stays far below their total.
    expect(outcome.peakMB).toBeLessThanOrEqual(60);
    expect(outcome.steps.length).toBeGreaterThan(1);
  });

  it('caps concurrently awake assistants, sleeping the stalest to admit a new one', () => {
    for (let i = 0; i < 5; i++) expect(fleet.wake(`asst-${i}`)).toBe(true);
    // Budget is 60 and each assistant is 10, so all five fit; a sixth would
    // exceed the count cap rather than the RAM cap.
    fleet.register({ id: 'asst-5', domain: 'reasoning', tier: 'assistant', activeMB: 10 });
    expect(fleet.wake('asst-5')).toBe(true);
    const awakeAssistants = fleet.listAwake().filter(m => m.tier === 'assistant');
    expect(awakeAssistants.length).toBeLessThanOrEqual(5);
    expect(awakeAssistants.some(m => m.id === 'asst-0')).toBe(false);
  });

  it('refuses to wake past the budget AND leaves nothing woken when it refuses', () => {
    // The exact defect this design guards: consulting the budget then loading
    // anyway. A refusal must leave RAM unchanged.
    fleet.wake('jacky'); // 40 pinned
    fleet.register({ id: 'whale', domain: 'x', tier: 'assistant', activeMB: 100 });
    const before = fleet.currentMB();
    expect(fleet.wake('whale')).toBe(false);
    expect(fleet.isAwake('whale')).toBe(false);
    expect(fleet.currentMB()).toBe(before);
  });

  it('reports why a wake failed instead of just refusing', () => {
    fleet.wake('jacky');
    fleet.register({ id: 'whale', domain: 'x', tier: 'assistant', activeMB: 100 });
    expect(fleet.previewWake('whale')?.reason).toBeTruthy();
  });

  it('surfaces an error rather than half-running a question it cannot afford', () => {
    const tiny = new FleetService({ budgetMB: 5, maxAwakeAssistants: 5 }, () => ++clock);
    tiny.register({ id: 'coord', domain: 'general', tier: 'coordinator', activeMB: 40 });
    const outcome = tiny.ask('anything');
    expect(outcome.error).toBeTruthy();
    expect(tiny.currentMB()).toBe(0);
  });

  it('re-waking refreshes recency without spending extra RAM', () => {
    fleet.wake('spec-physics');
    const mb = fleet.currentMB();
    expect(fleet.wake('spec-physics')).toBe(true);
    expect(fleet.currentMB()).toBe(mb);
  });

  it('reports an unknown member honestly rather than pretending', () => {
    expect(fleet.wake('nobody')).toBe(false);
    expect(fleet.previewWake('nobody')).toBeUndefined();
  });

  it('scales to a large fleet because dormant members are free', () => {
    const big = new FleetService({ budgetMB: 60, maxAwakeAssistants: 5 }, () => ++clock);
    for (let i = 0; i < 100; i++) {
      big.register({ id: `s${i}`, domain: `d${i}`, tier: 'specialist', activeMB: 1 });
    }
    expect(big.list()).toHaveLength(100);
    // 100 registered specialists, zero RAM, because none is thinking.
    expect(big.currentMB()).toBe(0);
    expect(big.wake('s42')).toBe(true);
    expect(big.currentMB()).toBe(1);
  });
});

describe('the app fleet and the audit see the same thing', () => {
  it('audits the LIVE fleet, so a real member list is checked', async () => {
    // Regression: the supervision trigger audited a separate, empty fleet, so
    // every router label read as dangling — two criticals that were artefacts
    // of the split rather than real defects. A monitor whose first act is a
    // false alarm teaches the user to ignore it.
    const { fleetAuditSnapshot, defaultFleet, DEMO_LABEL_ROUTING } = await import('./defaultFleet');
    const snapshot = fleetAuditSnapshot();

    expect(snapshot.members.length).toBeGreaterThan(0);
    expect(snapshot.members).toEqual(defaultFleet.list());

    // Every label the demo artifact can emit resolves to a registered member.
    const ids = new Set(snapshot.members.map(m => m.id));
    for (const target of Object.values(DEMO_LABEL_ROUTING)) {
      expect(ids.has(target)).toBe(true);
    }
  });

  it('reports the seeded fleet as free of critical findings', async () => {
    const { fleetAuditSnapshot } = await import('./defaultFleet');
    const { auditFleet } = await import('../supervision/routerAudit');
    const report = auditFleet(fleetAuditSnapshot());
    expect(report.findings.filter(f => f.severity === 'critical')).toEqual([]);
    expect(report.healthy).toBe(true);
  });
});
