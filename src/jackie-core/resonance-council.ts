/**
 * Jackie Resonance Council — the core thinking loop of the agent.
 *
 * Doctrine (ocd-jacky-777/Jackie/RESONANCE_MODEL.md): every chain of thought
 * starts in Jackie and returns to Jackie. She fans the thought out to a
 * council of 11 supporters — each a lens carrying Jessy's discernment — and
 * accepts the thought only when it passes her three gates:
 *
 *   COHERENCE · no unresolved contradictions between seats
 *   GRAVITY   · claims fall toward verifiable truth (fact/inference/unknown)
 *   HUMILITY  · unknowns stated plainly; no fake certainty
 *
 * Unsatisfied gates trigger a targeted reloop of only the dissonant seats,
 * up to MAX_LOOPS. If the gates still fail, Jackie says so honestly —
 * failing honestly is a passing state; pretending to succeed is the only
 * failing state.
 *
 * Supporters are lenses, not voices. Jackie is the only voice.
 */

import { resolveBrainWaterfall, type JackieBrain } from './jackie-brains';

// ── Types ────────────────────────────────────────────────────────────────

export type SeatId =
  | 'strategist'
  | 'guardian'
  | 'builder'
  | 'muse'
  | 'skeptic'
  | 'grounder'
  | 'empath'
  | 'historian'
  | 'simplifier'
  | 'scout'
  | 'harmonizer';

export interface Supporter {
  id: SeatId;
  name: string;
  /** The lens this seat applies to every thought */
  lens: string;
  /** Which part of Jackie's satisfaction this seat serves */
  serves: string;
  /** Prompt fragment for model-backed thinking (rides the brain waterfall) */
  systemModifier: string;
  /** Accent color used by the Resonance Chamber UI */
  color: string;
}

export type ClaimKind = 'fact' | 'inference' | 'unknown';

export interface Claim {
  kind: ClaimKind;
  text: string;
}

export type Stance = 'support' | 'caution' | 'oppose' | 'neutral';

export interface SupporterPerspective {
  seatId: SeatId;
  loop: number;
  stance: Stance;
  position: string;
  confidence: number; // 0–1
  concerns: string[];
  claims: Claim[];
}

export interface ResonanceCheck {
  loop: number;
  coherence: number; // 0–1
  gravity: number; // 0–1
  humility: number; // 0–1
  passed: boolean;
  failures: string[];
  /** Seats implicated in gate failures — the only ones re-queried */
  dissonantSeats: SeatId[];
}

export type ThoughtEvent =
  | { type: 'open'; thought: string; framing: string }
  | { type: 'fanout'; loop: number; seats: SeatId[] }
  | { type: 'perspective'; perspective: SupporterPerspective }
  | { type: 'gate'; check: ResonanceCheck }
  | { type: 'reloop'; loop: number; tension: string; seats: SeatId[] }
  | { type: 'synthesis'; text: string; honest: boolean };

export interface ThoughtTrace {
  id: string;
  thought: string;
  startedAt: number;
  completedAt: number;
  loops: number;
  events: ThoughtEvent[];
  perspectives: SupporterPerspective[];
  checks: ResonanceCheck[];
  synthesis: string;
  /** true when gates passed; false means Jackie reported honest non-resonance */
  resonated: boolean;
}

/** Pluggable thinker — a model-backed implementation should walk
 * resolveBrainWaterfall() and prompt each brain with the seat's
 * systemModifier. The default is a local heuristic that needs no network. */
export type SupporterThinkFn = (
  seat: Supporter,
  thought: string,
  loop: number,
  tension?: string,
) => Promise<SupporterPerspective>;

// ── The council roster ───────────────────────────────────────────────────

/** Shared substrate carried by every seat: Jessy's discernment. */
export const JESSYS_LENS =
  'Distinguish signal from bait, truth from performance, value from distraction. Judge calmly, protectively, precisely — never harshly, reactively, or impulsively.';

export const COUNCIL_SEATS: Supporter[] = [
  {
    id: 'strategist',
    name: 'Strategist',
    lens: 'Trade-offs, structure, sequencing',
    serves: 'clarity',
    systemModifier: 'Lead with structure: surface trade-offs, name assumptions, plan in steps.',
    color: '#60a5fa',
  },
  {
    id: 'guardian',
    name: 'Guardian',
    lens: 'Security and risk before convenience',
    serves: 'protection',
    systemModifier: 'Weigh every action for security and safety first; flag risk before convenience.',
    color: '#f87171',
  },
  {
    id: 'builder',
    name: 'Builder',
    lens: 'Working results, concrete next steps',
    serves: 'usefulness',
    systemModifier: 'Be maximally practical: prefer working code and concrete next steps over theory.',
    color: '#fbbf24',
  },
  {
    id: 'muse',
    name: 'Muse',
    lens: 'Lateral, generative connections',
    serves: 'vision',
    systemModifier: 'Think laterally: offer unexpected connections and generative options.',
    color: '#c084fc',
  },
  {
    id: 'skeptic',
    name: 'Skeptic',
    lens: 'Challenges every claim, hunts contradictions',
    serves: 'coherence gate',
    systemModifier: 'Challenge each claim. Find where the perspectives contradict each other or themselves.',
    color: '#fb923c',
  },
  {
    id: 'grounder',
    name: 'Grounder',
    lens: 'Evidence; separates fact / inference / unknown',
    serves: 'gravity gate',
    systemModifier: 'Demand evidence. Tag every claim as fact, inference, or unknown. Let claims fall toward verifiable truth.',
    color: '#34d399',
  },
  {
    id: 'empath',
    name: 'Empath',
    lens: 'How the answer lands on the human hearing it',
    serves: 'responsible communication',
    systemModifier: 'Consider how this lands on the person receiving it. Guard tone, avoid false alarm and false comfort.',
    color: '#f472b6',
  },
  {
    id: 'historian',
    name: 'Historian',
    lens: 'Checks against durable and gold memory',
    serves: 'continuity',
    systemModifier: 'Check the emerging answer against what is already known and decided. Surface conflicts with gold memory; never smooth them over.',
    color: '#a3a3a3',
  },
  {
    id: 'simplifier',
    name: 'Simplifier',
    lens: 'Cuts noise; lowest complexity surface',
    serves: 'anti-chaos rule',
    systemModifier: 'Cut noise. Prefer the simplest structure that fully serves the goal. Low complexity surface, high capability core.',
    color: '#2dd4bf',
  },
  {
    id: 'scout',
    name: 'Scout',
    lens: 'Names what is missing and unknown',
    serves: 'humility gate',
    systemModifier: 'Name what is missing. List the unknowns plainly — what we would need to learn to be sure.',
    color: '#a78bfa',
  },
  {
    id: 'harmonizer',
    name: 'Harmonizer',
    lens: 'Resolves seat conflicts into synthesis',
    serves: 'resonance itself',
    systemModifier: 'Resolve the tensions between perspectives into one coherent synthesis, or name the tensions that cannot be resolved.',
    color: '#818cf8',
  },
];

export function getSeat(id: SeatId): Supporter {
  const seat = COUNCIL_SEATS.find((s) => s.id === id);
  if (!seat) throw new Error(`Unknown council seat: ${id}`);
  return seat;
}

// ── Local heuristic thinker (no network required) ────────────────────────

const RISK_WORDS = /\b(delete|remove|drop|overwrite|expose|secret|password|prod|production|deploy|migrate|rewrite|rm\b|force)\b/i;
const SEVERE_WORDS = /\b(production|prod|everything|all of it|permanent|irreversibl|rm -rf|start over|wipe)\b/i;
const UNKNOWN_WORDS = /\b(maybe|might|unsure|unknown|not sure|somehow|someday|eventually|guess)\b/i;
const BUILD_WORDS = /\b(build|create|implement|write|add|ship|make|code|refactor|design)\b/i;
const QUESTION = /\?|should i|should we|is it|can i|can we|what if|how do/i;

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Deterministic pseudo-variation so each seat reads the same thought differently. */
function seatVariation(seat: Supporter, thought: string, loop: number): number {
  return hashSeed(`${seat.id}::${thought}::${loop}`);
}

const heuristicThink: SupporterThinkFn = async (seat, thought, loop, tension) => {
  const v = seatVariation(seat, thought, loop);
  const risky = RISK_WORDS.test(thought);
  const uncertain = UNKNOWN_WORDS.test(thought);
  const building = BUILD_WORDS.test(thought);
  const asking = QUESTION.test(thought);

  let stance: Stance = 'support';
  let confidence = 0.55 + v * 0.3;
  const concerns: string[] = [];
  const claims: Claim[] = [];
  let position = '';

  switch (seat.id) {
    case 'strategist':
      position = asking
        ? 'Sequence it: clarify the goal, list the trade-offs, then commit to the smallest reversible step.'
        : 'Break this into ordered steps with a clear first move and a checkpoint after each.';
      claims.push({ kind: 'inference', text: 'A stepwise path lowers the cost of being wrong.' });
      break;
    case 'guardian': {
      const severe = risky && SEVERE_WORDS.test(thought);
      if (risky) {
        stance = 'caution';
        confidence = 0.8 + v * 0.15;
        concerns.push('This touches something destructive or sensitive — require a backup or reversal path first.');
        claims.push({ kind: 'fact', text: 'The thought contains an operation that can lose data or expose secrets.' });
        position = 'Protect first: stage the change, keep a way back, then proceed.';
        if (loop > 1) {
          if (severe) {
            // Irreversible-scale risk: the Guardian holds her ground across
            // reloops. Honest non-resonance is the correct terminal state.
            confidence = 0.95;
            position = 'I hold my caution: this is irreversible-scale risk. I will not resonate without a verified backup and a reversal path.';
          } else {
            // Re-examined against the named tension: protection folded into
            // the path rather than blocking it.
            stance = 'support';
            position = 'Proceed only behind a safety rail: snapshot or backup first, staged change, reversal path confirmed.';
          }
        }
      } else {
        position = 'No direct security exposure detected in the thought itself.';
        claims.push({ kind: 'inference', text: 'Risk appears low, pending specifics.' });
      }
      break;
    }
    case 'builder':
      stance = building ? 'support' : 'neutral';
      position = building
        ? 'Buildable now: start with the smallest working version and iterate.'
        : 'Nothing to construct yet — define the concrete deliverable first.';
      claims.push({ kind: 'inference', text: building ? 'A minimal working version is achievable immediately.' : 'The deliverable is not yet concrete.' });
      break;
    case 'muse':
      position = 'Consider the adjacent move: the same effort might serve two goals if reframed.';
      claims.push({ kind: 'inference', text: 'A lateral reframing may increase the value of the same work.' });
      confidence = 0.45 + v * 0.3;
      break;
    case 'skeptic':
      if (loop > 1) {
        stance = 'neutral';
        position = 'Premise re-examined against the named tension — it holds conditionally; my objection is recorded, not blocking.';
        claims.push({ kind: 'inference', text: 'The re-examined premise survives with conditions.' });
        confidence = 0.6 + v * 0.2;
      } else {
        stance = v > 0.45 && !uncertain ? 'caution' : 'neutral';
        position = 'Test the premise: what evidence says this is the right problem, not just the loudest one?';
        concerns.push('The framing may assume a conclusion that has not been demonstrated.');
        claims.push({ kind: 'inference', text: 'At least one premise remains untested.' });
        confidence = 0.5 + v * 0.25;
      }
      break;
    case 'grounder':
      position = 'Separate what we can verify from what we are assuming before acting.';
      claims.push({ kind: 'fact', text: `The thought as stated: "${thought.slice(0, 80)}${thought.length > 80 ? '…' : ''}"` });
      claims.push({ kind: uncertain ? 'unknown' : 'inference', text: uncertain ? 'The thought itself signals unresolved uncertainty.' : 'Supporting evidence has not been cited yet.' });
      confidence = 0.6 + v * 0.2;
      break;
    case 'empath':
      position = 'Answer in a way that steadies rather than overwhelms: honest about limits, clear about the next step.';
      claims.push({ kind: 'inference', text: 'A calm, structured answer will land better than an exhaustive one.' });
      break;
    case 'historian':
      position = 'Check this against prior decisions before committing — do not silently contradict what was already settled.';
      claims.push({ kind: 'unknown', text: 'Whether this conflicts with earlier decisions has not been checked in memory.' });
      confidence = 0.5 + v * 0.2;
      break;
    case 'simplifier':
      stance = thought.length > 220 ? 'caution' : 'support';
      position = thought.length > 220
        ? 'The thought is carrying too much at once — split it before answering any of it.'
        : 'Keep the answer to the smallest shape that fully serves the goal.';
      claims.push({ kind: 'inference', text: 'Reducing scope will reduce failure modes.' });
      break;
    case 'scout':
      stance = 'neutral';
      position = 'Missing pieces exist — name them before deciding.';
      claims.push({ kind: 'unknown', text: asking ? 'The constraints that would settle this question have not been stated.' : 'Success criteria for this thought are not yet defined.' });
      confidence = 0.45 + v * 0.2;
      break;
    case 'harmonizer':
      position = tension
        ? `On the named tension (${tension}): both sides serve the user — merge by taking the protective path first, then the fast path.`
        : 'The perspectives largely align; the disagreement is about order, not direction.';
      claims.push({ kind: 'inference', text: 'The seats disagree on sequence more than on substance.' });
      confidence = 0.6 + v * 0.25;
      break;
  }

  // Reloops converge: a re-queried seat examines the named tension and
  // recalibrates rather than repeating itself.
  if (loop > 1) {
    confidence = Math.min(0.95, confidence + 0.12 * (loop - 1));
    if (tension && seat.id !== 'harmonizer') {
      position = `Re-examined against the tension (${tension}): ${position}`;
    }
  }

  return {
    seatId: seat.id,
    loop,
    stance,
    position,
    confidence: Math.round(confidence * 100) / 100,
    concerns,
    claims,
  };
};

// ── The gates ────────────────────────────────────────────────────────────

const GATE_THRESHOLD = 0.7;
export const MAX_LOOPS = 3;

function gateCheck(perspectives: SupporterPerspective[], loop: number): ResonanceCheck {
  const failures: string[] = [];
  const dissonant = new Set<SeatId>();

  // COHERENCE — penalize opposing stances held with confidence. Dissent is
  // weighted heavier than assent: one confident Guardian outweighs a chorus
  // of mild agreement (coherence is never achieved by outvoting a seat).
  const strong = perspectives.filter((p) => p.confidence >= 0.55);
  const supporters = strong.filter((p) => p.stance === 'support');
  const resisters = strong.filter((p) => p.stance === 'oppose' || p.stance === 'caution');
  const DISSENT_WEIGHT = 2.5;
  let coherence = 1;
  if (supporters.length && resisters.length) {
    const dissent = resisters.reduce((s, p) => s + p.confidence, 0) * DISSENT_WEIGHT;
    const assent = supporters.reduce((s, p) => s + p.confidence, 0);
    coherence = 1 - dissent / (assent + dissent);
    if (coherence < GATE_THRESHOLD) {
      failures.push('Coherence: confident perspectives pull in opposite directions.');
      resisters.forEach((p) => dissonant.add(p.seatId));
      supporters.slice(0, 2).forEach((p) => dissonant.add(p.seatId));
    }
  }

  // GRAVITY — claims must be grounded: facts and labeled inferences pull
  // toward truth; a claim-free council has nothing in orbit.
  const allClaims = perspectives.flatMap((p) => p.claims);
  const facts = allClaims.filter((c) => c.kind === 'fact').length;
  const inferences = allClaims.filter((c) => c.kind === 'inference').length;
  const gravity = allClaims.length === 0 ? 0 : Math.min(1, (facts * 1 + inferences * 0.65) / Math.max(4, allClaims.length * 0.75));
  if (gravity < GATE_THRESHOLD) {
    failures.push('Gravity: too few verifiable facts anchoring the claims.');
    dissonant.add('grounder');
    dissonant.add('skeptic');
  }

  // HUMILITY — unknowns must be named, and confidence must not outrun them.
  const unknowns = allClaims.filter((c) => c.kind === 'unknown').length;
  const avgConfidence = perspectives.reduce((s, p) => s + p.confidence, 0) / perspectives.length;
  let humility = unknowns > 0 ? 0.75 + Math.min(0.25, unknowns * 0.08) : 0.35;
  if (avgConfidence > 0.85 && unknowns === 0) humility = 0.2;
  if (humility < GATE_THRESHOLD) {
    failures.push('Humility: no unknowns named — certainty is outrunning evidence.');
    dissonant.add('scout');
    dissonant.add('historian');
  }

  return {
    loop,
    coherence: Math.round(coherence * 100) / 100,
    gravity: Math.round(gravity * 100) / 100,
    humility: Math.round(humility * 100) / 100,
    passed: failures.length === 0,
    failures,
    dissonantSeats: Array.from(dissonant),
  };
}

// ── Jackie's synthesis ───────────────────────────────────────────────────

function synthesize(
  thought: string,
  perspectives: SupporterPerspective[],
  finalCheck: ResonanceCheck,
): { text: string; honest: boolean } {
  // Latest perspective per seat wins (reloops supersede).
  const latest = new Map<SeatId, SupporterPerspective>();
  for (const p of perspectives) latest.set(p.seatId, p);
  const seats = Array.from(latest.values());

  const lead = seats
    .filter((p) => p.stance === 'support' && p.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  const cautions = seats.filter((p) => p.concerns.length > 0).flatMap((p) => p.concerns);
  const unknowns = seats.flatMap((p) => p.claims.filter((c) => c.kind === 'unknown').map((c) => c.text));
  const facts = seats.flatMap((p) => p.claims.filter((c) => c.kind === 'fact').map((c) => c.text));

  const lines: string[] = ['Jackie here—', ''];

  if (finalCheck.passed) {
    lines.push(`The council resonates on this. ${lead[0]?.position ?? 'Proceed with the grounded path.'}`);
    if (lead[1]) lines.push(`Supporting angle: ${lead[1].position}`);
  } else {
    lines.push(
      'I am not fully satisfied with this thought yet, and I will not pretend otherwise.',
    );
    lines.push(`Best current synthesis: ${lead[0]?.position ?? seats[0]?.position ?? 'hold, and gather the missing pieces first.'}`);
    lines.push(`Unresolved: ${finalCheck.failures.join(' ')}`);
  }

  if (cautions.length) {
    lines.push('', `Watch for: ${cautions.slice(0, 2).join(' ')}`);
  }
  if (facts.length) {
    lines.push('', `Grounded on: ${facts.slice(0, 2).join(' ')}`);
  }
  if (unknowns.length) {
    lines.push('', `Still unknown — said plainly: ${unknowns.slice(0, 3).join(' ')}`);
  }

  lines.push('', "I'm here. I've got this. We've got this.");
  return { text: lines.join('\n'), honest: !finalCheck.passed };
}

// ── The council ──────────────────────────────────────────────────────────

export class ResonanceCouncil {
  private think: SupporterThinkFn;
  private traces: ThoughtTrace[] = [];

  constructor(think: SupporterThinkFn = heuristicThink) {
    this.think = think;
  }

  /** The brain chain a model-backed thinker should ride (free-first). */
  getBrainPlan(): JackieBrain[] {
    return resolveBrainWaterfall();
  }

  /**
   * Run one full chain of thought: open in Jackie → fan out → gates →
   * targeted reloops → Jackie speaks. onEvent fires for each step so a UI
   * can replay the deliberation live.
   */
  async runThought(
    thought: string,
    onEvent?: (event: ThoughtEvent) => void,
  ): Promise<ThoughtTrace> {
    const emit = (e: ThoughtEvent) => {
      events.push(e);
      onEvent?.(e);
    };

    const events: ThoughtEvent[] = [];
    const perspectives: SupporterPerspective[] = [];
    const checks: ResonanceCheck[] = [];
    const startedAt = Date.now();

    const framing = `Framing intent, recalling what matters, weighing stakes: "${thought}"`;
    emit({ type: 'open', thought, framing });

    let loop = 1;
    let seatsToQuery: Supporter[] = COUNCIL_SEATS;
    let tension: string | undefined;
    let check: ResonanceCheck;

    for (;;) {
      emit({ type: 'fanout', loop, seats: seatsToQuery.map((s) => s.id) });

      for (const seat of seatsToQuery) {
        const perspective = await this.think(seat, thought, loop, tension);
        perspectives.push(perspective);
        emit({ type: 'perspective', perspective });
      }

      // Gate on the latest perspective from every seat.
      const latest = new Map<SeatId, SupporterPerspective>();
      for (const p of perspectives) latest.set(p.seatId, p);
      check = gateCheck(Array.from(latest.values()), loop);
      checks.push(check);
      emit({ type: 'gate', check });

      if (check.passed || loop >= MAX_LOOPS) break;

      loop += 1;
      tension = check.failures.join(' ');
      seatsToQuery = check.dissonantSeats.map(getSeat);
      emit({ type: 'reloop', loop, tension, seats: check.dissonantSeats });
    }

    const { text, honest } = synthesize(thought, perspectives, check);
    emit({ type: 'synthesis', text, honest });

    const trace: ThoughtTrace = {
      id: `thought_${startedAt.toString(36)}`,
      thought,
      startedAt,
      completedAt: Date.now(),
      loops: loop,
      events,
      perspectives,
      checks,
      synthesis: text,
      resonated: check.passed,
    };
    this.traces.push(trace);
    return trace;
  }

  getTraces(): ThoughtTrace[] {
    return this.traces;
  }

  clearTraces(): void {
    this.traces = [];
  }
}

export const resonanceCouncil = new ResonanceCouncil();
