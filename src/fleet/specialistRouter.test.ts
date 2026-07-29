/**
 * Artifact-backed specialist routing.
 *
 * Drives the REAL registry and the REAL nano runtime against the shared golden
 * fixture — no mocked classifier, so deleting the runtime fails these. The
 * invariant under test is the one the whole fleet design rests on: a dormant
 * specialist holds nothing, and waking is the only thing that costs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fixture from '../router/router-fixture-v1.json';
import { SpecialistRouterRegistry } from './specialistRouter';
import { FleetService } from './fleetService';

const NANO = fixture.artifacts.nano;
// The fixture's nano router labels text as 'cook' or 'tech'.
const ROUTING = { cook: 'spec-cooking', tech: 'spec-tech' };

describe('specialist router registry', () => {
  let reg: SpecialistRouterRegistry;
  beforeEach(() => {
    reg = new SpecialistRouterRegistry();
  });

  it('attaches a real artifact and reports its labels', () => {
    const artifact = reg.attach('r1', NANO, ROUTING);
    expect(artifact.kind).toBe('nano');
    expect(reg.list()[0].labels).toEqual(['cook', 'tech']);
  });

  it('refuses a label with no fleet member — a silent dead end at route time', () => {
    expect(() => reg.attach('r1', NANO, { cook: 'spec-cooking' })).toThrow(/tech/);
  });

  it('refuses a malformed file with a message safe to show the user', () => {
    expect(() => reg.attach('r1', { nope: true }, ROUTING)).toThrow();
  });

  it('refuses an embed router, which would need a resident embedding model', () => {
    // That dependency is exactly what this tier exists to avoid, so it is
    // rejected up front rather than failing later with no network.
    expect(() => reg.attach('r1', fixture.artifacts.embed, { cook: 'a', tech: 'b' })).toThrow(
      /nano/i
    );
  });

  it('holds nothing until woken, and routes once awake', () => {
    reg.attach('r1', NANO, ROUTING);
    expect(reg.isAwake('r1')).toBe(false);
    // Dormant deliberately returns undefined rather than auto-waking: waking
    // costs RAM, and only the residency planner may approve that.
    expect(reg.route('r1', 'the container crashes on boot')).toBeUndefined();

    expect(reg.wake('r1')).toBe(true);
    const routed = reg.route('r1', 'the container crashes on boot with a kernel error');
    expect(routed).toBeDefined();
    expect(routed!.memberId).toBe('spec-tech');
    expect(routed!.label).toBe('tech');
  });

  it('classifies a cooking question to the cooking member', () => {
    reg.attach('r1', NANO, ROUTING);
    reg.wake('r1');
    const routed = reg.route('r1', 'how long do I let the dough rise overnight');
    expect(routed!.memberId).toBe('spec-cooking');
  });

  it('drops the compiled matrix on sleep, so dormancy is actually free', () => {
    reg.attach('r1', NANO, ROUTING);
    reg.wake('r1');
    expect(reg.sleep('r1')).toBe(true);
    expect(reg.isAwake('r1')).toBe(false);
    expect(reg.route('r1', 'anything at all')).toBeUndefined();
  });

  it('re-waking is idempotent', () => {
    reg.attach('r1', NANO, ROUTING);
    expect(reg.wake('r1')).toBe(true);
    expect(reg.wake('r1')).toBe(true);
    expect(reg.list()[0].compiled).toBe(true);
  });

  it('detaches everything, leaving no compiled remnant', () => {
    reg.attach('r1', NANO, ROUTING);
    reg.wake('r1');
    expect(reg.detach('r1')).toBe(true);
    expect(reg.list()).toEqual([]);
    expect(reg.isAwake('r1')).toBe(false);
  });

  it('reports honestly on an unknown artifact instead of pretending', () => {
    expect(reg.wake('nope')).toBe(false);
    expect(reg.route('nope', 'text')).toBeUndefined();
    expect(reg.classify('nope', 'text')).toBeUndefined();
  });

  it('exposes the score breakdown for the UI', () => {
    reg.attach('r1', NANO, ROUTING);
    reg.wake('r1');
    const scores = reg.classify('r1', 'saute the onions')!.scores;
    expect(Object.keys(scores).sort()).toEqual(['cook', 'tech']);
  });
});

describe('fleet + artifact together', () => {
  it('classifies a question and hands it to the member the fleet can afford', () => {
    // The cross-layer path: artifact decides WHO, fleet decides whether the
    // device can afford to wake them. Neither alone proves the wiring works.
    const fleet = new FleetService({ budgetMB: 60, maxAwakeAssistants: 5 });
    fleet.register({ id: 'jacky', domain: 'general', tier: 'coordinator', activeMB: 40 });
    fleet.register({ id: 'spec-tech', domain: 'tech', tier: 'specialist', activeMB: 1 });
    fleet.register({ id: 'spec-cooking', domain: 'cooking', tier: 'specialist', activeMB: 1 });

    const reg = new SpecialistRouterRegistry();
    reg.attach('r1', NANO, ROUTING);
    reg.wake('r1');

    const routed = reg.route('r1', 'my gpu driver keeps crashing')!;
    expect(routed.memberId).toBe('spec-tech');

    expect(fleet.currentMB()).toBe(0);
    expect(fleet.wake(routed.memberId)).toBe(true);
    expect(fleet.currentMB()).toBe(1);
    fleet.sleep(routed.memberId);
    expect(fleet.currentMB()).toBe(0);
  });
});
