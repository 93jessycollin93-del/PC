import { describe, it, expect } from 'vitest';
import { askJackyForFallback } from './jackyFallback';
import type { JackyAskResult } from './jackyClient';

const fixedNow = () => 123456;

describe('askJackyForFallback', () => {
  it('maps a successful jacky response into the shared AIResponse shape', async () => {
    const ask = async (): Promise<JackyAskResult> => ({ status: 'ok', response: 'The answer is 4.', model: 'llama3:8b' });
    const result = await askJackyForFallback('what is 2+2', { ask, now: fixedNow });
    expect(result).toEqual({
      content: 'The answer is 4.',
      provider: 'ollama',
      model: 'llama3:8b',
      tokensUsed: 0,
      cost: 0,
      timestamp: 123456,
    });
  });

  it('passes the prompt through as a general task', async () => {
    let seen: [string, { task_type?: string } | undefined] | null = null;
    const ask = async (prompt: string, opts?: { task_type?: string }): Promise<JackyAskResult> => {
      seen = [prompt, opts];
      return { status: 'ok', response: 'hi' };
    };
    await askJackyForFallback('hello there', { ask, now: fixedNow });
    expect(seen).toEqual(['hello there', { task_type: 'general' }]);
  });

  it('falls back to the engine name when no model is reported', async () => {
    const ask = async (): Promise<JackyAskResult> => ({ status: 'ok', response: 'x', engine: 'deep-thinker' });
    const result = await askJackyForFallback('q', { ask, now: fixedNow });
    expect(result.model).toBe('deep-thinker');
  });

  it('falls back to a generic label when neither model nor engine is reported', async () => {
    const ask = async (): Promise<JackyAskResult> => ({ status: 'ok', response: 'x' });
    const result = await askJackyForFallback('q', { ask, now: fixedNow });
    expect(result.model).toBe('jacky-local');
  });

  it('always reports zero cost and zero tokens — local inference has no API metering', async () => {
    const ask = async (): Promise<JackyAskResult> => ({ status: 'ok', response: 'x' });
    const result = await askJackyForFallback('q', { ask, now: fixedNow });
    expect(result.cost).toBe(0);
    expect(result.tokensUsed).toBe(0);
  });

  it('propagates a failure instead of masking it with a canned success', async () => {
    const ask = async (): Promise<JackyAskResult> => { throw new Error('jacky /ask → HTTP 503'); };
    let caught: unknown = null;
    try {
      await askJackyForFallback('q', { ask, now: fixedNow });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('jacky /ask → HTTP 503');
  });
});
