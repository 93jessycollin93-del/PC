/**
 * Provider Handoff Briefing
 * When a router swaps providers mid-conversation the incoming model gets raw history and
 * no idea it is a replacement. This builds the note the outgoing side leaves behind so the
 * new model continues the work instead of starting cold.
 *
 * Pure and deterministic: no clock, no randomness, no I/O. Timestamps arrive as a parameter.
 */

import type { AIMessage, Provider } from './types';

/** Realistic causes for a mid-conversation swap. Wording of the briefing turns on this. */
export type HandoffReason =
  | 'quota_approaching'
  | 'rate_limited'
  | 'provider_error'
  | 'provider_unhealthy'
  | 'cost_optimization'
  | 'manual_switch';

export type UnfinishedKind = 'none' | 'unanswered_user' | 'truncated_assistant';

export interface BriefingInput {
  messages: AIMessage[];
  fromProvider: Provider;
  toProvider: Provider;
  reason: HandoffReason;
  /** Hard ceiling on the returned string. Provider context windows differ wildly. */
  maxChars?: number;
  /** Optional operator/orchestrator note, e.g. the raw provider error text. */
  detail?: string;
  /** Caller supplies the clock so the module stays deterministic. */
  timestamp?: number;
}

/** Flat result shape on purpose: many consuming apps compile with strict:false,
 *  where discriminated-union narrowing does not work. */
export interface HandoffAnalysis {
  messageCount: number;
  lastRole: string;
  latestUserText: string;
  latestUserIndex: number;
  unfinished: boolean;
  unfinishedKind: UnfinishedKind;
  /** Full instruction. Dropped first when the budget is tight. */
  unfinishedNote: string;
  /** Cheap version that survives even a very small budget. */
  unfinishedShort: string;
}

export const DEFAULT_MAX_CHARS = 2400;

/** Newest turns carry the continuity, so they stay verbatim while older ones collapse. */
const RECENT_VERBATIM_TURNS = 6;
const VERBATIM_CHAR_CAP = 400;
const CONDENSED_CHAR_CAP = 140;

const REASON_ORDER: HandoffReason[] = [
  'quota_approaching',
  'rate_limited',
  'provider_error',
  'provider_unhealthy',
  'cost_optimization',
  'manual_switch',
];

const REASON_LABEL: Record<HandoffReason, string> = {
  quota_approaching: 'quota or usage limit approaching',
  rate_limited: 'rate limited',
  provider_error: 'provider error',
  provider_unhealthy: 'provider marked unhealthy',
  cost_optimization: 'cost optimization',
  manual_switch: 'manual switch by the operator',
};

/**
 * What the incoming model should actually do about each cause. "Errored" and "hit its quota"
 * demand different behaviour, so these must not collapse into one generic sentence.
 */
const REASON_GUIDANCE: Record<HandoffReason, string> = {
  quota_approaching:
    'Nothing failed. The previous model was close to its quota, so the work above is complete and trustworthy. Keep answers efficient.',
  rate_limited:
    'The previous model was rate limited and its last call did not land. Assume the final request went unanswered and handle it yourself.',
  provider_error:
    'The previous model errored mid-flight. Treat its last output as possibly incomplete: check it before building on it.',
  provider_unhealthy:
    'Health checks marked the previous provider as failing or unreachable. Its recent output may be partial or stale, so verify before relying on it.',
  cost_optimization:
    'No failure occurred. The switch is a cost decision, so hold the same depth and quality the previous model was giving.',
  manual_switch:
    'The operator switched models by hand. No failure occurred. Honour any conventions or promises already agreed above.',
};

interface Section {
  order: number;
  header: string;
  items: string[];
  /** Oldest items are shed first when the budget is tight. */
  shrinkable: boolean;
  dropped: number;
  omitLabel: string;
}

function makeSection(
  order: number,
  header: string,
  items: string[],
  shrinkable = false,
  omitLabel = ''
): Section {
  return { order, header, items, shrinkable, dropped: 0, omitLabel };
}

/** Collapse whitespace and cut to a hard length. Multi-line content wrecks a compact brief. */
function clip(text: string, max: number): string {
  const flat = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (max <= 0) return '';
  if (flat.length <= max) return flat;
  if (max <= 3) return flat.slice(0, max);
  return flat.slice(0, max - 3).trimEnd() + '...';
}

/**
 * Heuristic for a reply that was cut off: an unclosed code fence, empty text, or an ending
 * that is not sentence-final. Better to over-report than to let the new model restart the job.
 */
function looksTruncated(text: string): boolean {
  const t = String(text == null ? '' : text).trim();
  if (!t) return true;
  const fences = t.match(/```/g);
  if (fences && fences.length % 2 === 1) return true;
  return !/[.!?)\]}"'`]$/.test(t);
}

function isKnownReason(reason: HandoffReason): boolean {
  return REASON_ORDER.indexOf(reason) !== -1;
}

function normalizeBudget(maxChars: number | undefined): number {
  const n = Number(maxChars);
  if (!isFinite(n) || n <= 0) return DEFAULT_MAX_CHARS;
  return Math.floor(n);
}

function renderSection(section: Section): string {
  const lines: string[] = [];
  if (section.header) lines.push(section.header);
  if (section.dropped > 0 && section.omitLabel) {
    lines.push(`- [${section.dropped} ${section.omitLabel} omitted to fit the context budget]`);
  }
  for (const item of section.items) lines.push(item);
  return lines.join('\n');
}

function render(sections: Section[]): string {
  return sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(renderSection)
    .filter(text => text.length > 0)
    .join('\n');
}

/** Drop the oldest item, keeping the omission visible. Returns null when nothing is left to shed. */
function shrink(section: Section): Section | null {
  if (!section.shrinkable || section.items.length === 0) return null;
  return {
    ...section,
    items: section.items.slice(1),
    dropped: section.dropped + 1,
  };
}

/**
 * Inspect the tail of the conversation for work the incoming model must finish rather than redo.
 */
export function analyzeHandoff(messages: AIMessage[]): HandoffAnalysis {
  const list = Array.isArray(messages) ? messages : [];
  const analysis: HandoffAnalysis = {
    messageCount: list.length,
    lastRole: '',
    latestUserText: '',
    latestUserIndex: -1,
    unfinished: false,
    unfinishedKind: 'none',
    unfinishedNote: '',
    unfinishedShort: '',
  };

  if (list.length === 0) return analysis;

  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] && list[i].role === 'user') {
      analysis.latestUserIndex = i;
      analysis.latestUserText = String(list[i].content == null ? '' : list[i].content);
      break;
    }
  }

  const last = list[list.length - 1] || { role: '', content: '' };
  analysis.lastRole = String(last.role || '');

  if (analysis.lastRole === 'user') {
    const text = String(last.content == null ? '' : last.content);
    const isQuestion = text.trim().slice(-1) === '?';
    analysis.unfinished = true;
    analysis.unfinishedKind = 'unanswered_user';
    analysis.unfinishedNote = isQuestion
      ? 'The user asked a question that was never answered. Answer it directly as your first act.'
      : 'The user made a request that was never answered. Fulfil it as your first act.';
    analysis.unfinishedShort = isQuestion
      ? 'the last user question was never answered'
      : 'the last user request was never fulfilled';
    return analysis;
  }

  if (analysis.lastRole === 'assistant' && looksTruncated(last.content)) {
    analysis.unfinished = true;
    analysis.unfinishedKind = 'truncated_assistant';
    analysis.unfinishedNote =
      'The previous reply is cut off mid-thought. Continue from where it stops, do not restart the answer or repeat what is already there.';
    analysis.unfinishedShort = 'the previous reply is cut off mid-thought';
    return analysis;
  }

  return analysis;
}

/** Short cause line. Cheap enough to keep even at a tiny budget. */
export function reasonLabel(reason: HandoffReason): string {
  return REASON_LABEL[isKnownReason(reason) ? reason : 'manual_switch'];
}

/** What the incoming model should do about that cause. Dropped before the conversation is. */
export function reasonGuidance(reason: HandoffReason): string {
  return REASON_GUIDANCE[isKnownReason(reason) ? reason : 'manual_switch'];
}

/** Cause plus guidance in one sentence. Exported so UIs can show the same wording. */
export function describeReason(
  reason: HandoffReason,
  fromProvider: Provider,
  detail?: string
): string {
  const from = String(fromProvider || 'the previous provider');
  const note = detail ? ` Reported detail: ${clip(detail, 200)}` : '';
  return `Switch cause: ${from} - ${reasonLabel(reason)}. ${reasonGuidance(reason)}${note}`;
}

/**
 * Build the briefing to prepend as system context for the incoming model.
 * The return value is guaranteed to be at most maxChars, measured on the final string.
 */
export function buildBriefing(input: BriefingInput): string {
  const src = input || ({} as BriefingInput);
  const messages = Array.isArray(src.messages) ? src.messages : [];
  const budget = normalizeBudget(src.maxChars);
  const analysis = analyzeHandoff(messages);
  const from = String(src.fromProvider || 'an unknown provider');
  const to = String(src.toProvider || 'a new provider');
  const reason = isKnownReason(src.reason) ? src.reason : 'manual_switch';

  // Framing is tiered: a short core that always survives, plus expansions that yield to the
  // conversation itself. Otherwise boilerplate eats a small budget and the real content is lost.
  const essentials: Section[] = [];

  essentials.push(
    makeSection(0, '', [
      '[HANDOFF BRIEFING]',
      `You are ${to}, continuing a conversation ${from} was handling. Do not start over.`,
    ])
  );

  essentials.push(makeSection(20, '', [`Switch cause: ${from} - ${reasonLabel(reason)}.`]));

  // An unanswered user turn is already announced by the latest-message label below, so only
  // the truncated-reply case needs its own always-on line.
  const shortNote =
    analysis.unfinishedKind === 'truncated_assistant'
      ? makeSection(30, '', [`Unfinished: ${analysis.unfinishedShort}.`])
      : null;
  if (shortNote) essentials.push(shortNote);

  // The latest user turn is what the model must answer, so it outranks every framing expansion.
  const hasUser = analysis.latestUserIndex >= 0;
  const userLabel =
    analysis.unfinishedKind === 'unanswered_user'
      ? 'Latest user message (UNANSWERED, respond to this):'
      : 'Latest user message (what the work is about):';

  let userClip = VERBATIM_CHAR_CAP;
  const userSection = makeSection(60, '', []);
  const applyUser = (chars: number): void => {
    userSection.items = hasUser ? [userLabel, `user: ${clip(analysis.latestUserText, chars)}`] : [];
  };
  applyUser(userClip);
  if (hasUser) essentials.push(userSection);

  let essentialText = render(essentials);
  if (essentialText.length > budget && hasUser) {
    const overhead = essentialText.length - clip(analysis.latestUserText, userClip).length;
    userClip = budget - overhead;
    applyUser(userClip > 0 ? userClip : 0);
    essentialText = render(essentials);
  }
  if (essentialText.length > budget) {
    return essentialText.slice(0, budget);
  }

  const chosen = essentials.slice();

  // The full instruction replaces the short line rather than joining it, so the brief never
  // states the same problem twice.
  if (analysis.unfinished) {
    const fullNote = makeSection(30, '', [`Unfinished work: ${analysis.unfinishedNote}`]);
    const withoutShort = chosen.filter(section => section !== shortNote);
    if (render(withoutShort.concat([fullNote])).length <= budget) {
      chosen.length = 0;
      for (const section of withoutShort) chosen.push(section);
      chosen.push(fullNote);
    }
  }

  // Fitted in this order. Everything here is worth having and none of it is worth losing the
  // pending user request over.
  const optionals: Section[] = [];

  optionals.push(makeSection(25, '', [reasonGuidance(reason)]));

  if (src.detail) {
    optionals.push(makeSection(26, '', [`Reported detail: ${clip(src.detail, 200)}`]));
  }

  optionals.push(
    makeSection(70, '', [
      'Continue from here. Do not greet, re-introduce yourself, announce the model change, or restate the plan.',
    ])
  );

  const stamp = isFinite(Number(src.timestamp))
    ? ` Handoff at ${new Date(Number(src.timestamp)).toISOString()}.`
    : '';
  optionals.push(
    makeSection(10, '', [`Conversation so far: ${analysis.messageCount} message(s).${stamp}`])
  );

  const historyIdx: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (i !== analysis.latestUserIndex) historyIdx.push(i);
  }
  const recentIdx = historyIdx.slice(-RECENT_VERBATIM_TURNS);
  const olderIdx = historyIdx.slice(0, historyIdx.length - recentIdx.length);

  if (recentIdx.length > 0) {
    optionals.push(
      makeSection(
        50,
        'Recent exchange (verbatim, oldest first):',
        recentIdx.map(i => `${messages[i].role}: ${clip(messages[i].content, VERBATIM_CHAR_CAP)}`),
        true,
        'older verbatim turns'
      )
    );
  }

  if (olderIdx.length > 0) {
    optionals.push(
      makeSection(
        40,
        'Established earlier (condensed, oldest first):',
        olderIdx.map(i => `- ${messages[i].role}: ${clip(messages[i].content, CONDENSED_CHAR_CAP)}`),
        true,
        'earlier messages'
      )
    );
  }

  // Fit by measurement, not estimate: each candidate is rendered against what is already committed.
  for (const optional of optionals) {
    let candidate: Section | null = optional;
    while (candidate) {
      if (render(chosen.concat([candidate])).length <= budget) {
        chosen.push(candidate);
        break;
      }
      candidate = shrink(candidate);
    }
  }

  const out = render(chosen);
  return out.length > budget ? out.slice(0, budget) : out;
}

/**
 * Prepend the briefing as a system message. Returns a new array; the input is untouched.
 */
export function attachBriefing(input: BriefingInput): AIMessage[] {
  const messages = Array.isArray(input && input.messages) ? input.messages : [];
  const briefing = buildBriefing(input);
  if (!briefing) return messages.slice();
  const system: AIMessage = { role: 'system', content: briefing };
  return [system].concat(messages.slice());
}
