import { describe, it, expect } from 'vitest';
import { buildBriefing, attachBriefing, analyzeHandoff, DEFAULT_MAX_CHARS } from './handoffBriefing';
import type { AIMessage } from './types';

const convo = (n: number): AIMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    role: (i % 2 ? 'assistant' : 'user') as AIMessage['role'],
    content: `Turn ${i}: ${'context '.repeat(15)}`,
  }));

const base = {
  fromProvider: 'groq' as const,
  toProvider: 'gemini' as const,
  reason: 'quota_approaching' as const,
};

describe('fitting the incoming model context window', () => {
  // Overflowing the budget is the failure that breaks the handoff outright,
  // so it is checked by measurement across a spread of sizes.
  it.each([120, 300, 600, 1200, 2400, 5000])('never exceeds a %i char budget', (maxChars) => {
    const out = buildBriefing({ ...base, messages: convo(40), maxChars });
    expect(out.length).toBeLessThanOrEqual(maxChars);
    expect(out.length).toBeGreaterThan(0);
  });

  it('stays within the default when no budget is given', () => {
    expect(buildBriefing({ ...base, messages: convo(40) }).length)
      .toBeLessThanOrEqual(DEFAULT_MAX_CHARS);
  });

  it('keeps the latest user message even when squeezed', () => {
    // That message is the thing the incoming model has to answer; dropping it
    // to save room would defeat the entire handoff.
    const messages = [...convo(30), { role: 'user' as const, content: 'UNIQUEMARKER ship the webhook' }];
    for (const maxChars of [300, 600, 1500]) {
      expect(buildBriefing({ ...base, messages, maxChars })).toContain('UNIQUEMARKER');
    }
  });
});

describe('telling the new model why it is here', () => {
  it('names both the outgoing and incoming provider', () => {
    const out = buildBriefing({ ...base, messages: convo(6) });
    expect(out).toContain('groq');
    expect(out).toContain('gemini');
  });

  it('words each cause differently, so the reason is actionable', () => {
    const reasons = [
      'quota_approaching', 'rate_limited', 'provider_error',
      'provider_unhealthy', 'cost_optimization', 'manual_switch',
    ] as const;
    const texts = reasons.map(reason => buildBriefing({ ...base, reason, messages: convo(6) }));
    expect(new Set(texts).size).toBe(reasons.length);
  });

  it('says nothing failed when the switch was pre-emptive', () => {
    // A model told "the previous one errored" may distrust and redo good work.
    const out = buildBriefing({ ...base, reason: 'quota_approaching', messages: convo(6) });
    expect(out).toMatch(/quota|usage limit/i);
    expect(out).not.toMatch(/errored mid-flight/i);
  });

  it('instructs it to continue rather than start over', () => {
    expect(buildBriefing({ ...base, messages: convo(6) })).toMatch(/not start over|Continue from/i);
  });

  it('is deterministic, so the same handoff never varies', () => {
    const messages = convo(10);
    expect(buildBriefing({ ...base, messages })).toBe(buildBriefing({ ...base, messages }));
  });
});

describe('unfinished work', () => {
  it('flags a question that was never answered', () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'Where does the retry live?' },
      { role: 'assistant', content: 'In the client.' },
      { role: 'user', content: 'Can you write the webhook handler?' },
    ];
    expect(buildBriefing({ ...base, messages })).toMatch(/unfinished|unanswered|never answered/i);
  });

  it('flags a reply that was cut off mid-thought', () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'Show the handler.' },
      { role: 'assistant', content: 'Sure:\n```ts\nexport async function handle(evt) {' },
    ];
    expect(buildBriefing({ ...base, messages })).toMatch(/cut off|truncat/i);
  });

  it('says nothing when the conversation ended cleanly', () => {
    // The false positive matters: a spurious "finish this" makes the new model
    // invent work that was already done.
    const messages: AIMessage[] = [
      { role: 'user', content: 'Thanks, that is all.' },
      { role: 'assistant', content: 'Happy to help. The migration is complete.' },
    ];
    expect(analyzeHandoff(messages).unfinishedKind).toBe('none');
  });
});

describe('safety of the caller data', () => {
  it('never mutates the messages it is given', () => {
    const messages = convo(5);
    const snapshot = JSON.stringify(messages);
    buildBriefing({ ...base, messages });
    attachBriefing({ ...base, messages });
    expect(JSON.stringify(messages)).toBe(snapshot);
  });

  it('returns a new array with the briefing first', () => {
    const messages = convo(4);
    const attached = attachBriefing({ ...base, messages });
    expect(attached).not.toBe(messages);
    expect(attached[0].role).toBe('system');
    expect(attached).toHaveLength(messages.length + 1);
  });

  it.each([
    ['an empty conversation', [] as AIMessage[]],
    ['a single user message', [{ role: 'user', content: 'hi' }] as AIMessage[]],
    ['empty content', [{ role: 'user', content: '' }] as AIMessage[]],
  ])('handles %s without throwing', (_label, messages) => {
    expect(() => buildBriefing({ ...base, messages })).not.toThrow();
  });
});
