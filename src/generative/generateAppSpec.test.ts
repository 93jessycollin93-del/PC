import { describe, it, expect } from 'vitest';
import { generateAppSpec } from './generateAppSpec';

const fixedNow = () => 1_000_000;

describe('classifying a description into an app kind', () => {
  it('recognizes a timer request', () => {
    const spec = generateAppSpec('make a timer', { now: fixedNow });
    expect(spec.kind).toBe('timer');
  });

  it('recognizes a countdown as a timer', () => {
    expect(generateAppSpec('30 minute countdown', { now: fixedNow }).kind).toBe('timer');
  });

  it('recognizes a flashcards request', () => {
    expect(generateAppSpec('flashcards for spanish vocab', { now: fixedNow }).kind).toBe('flashcards');
  });

  it('recognizes a quiz as flashcards', () => {
    expect(generateAppSpec('a quiz to study for the exam', { now: fixedNow }).kind).toBe('flashcards');
  });

  it('recognizes a checklist request', () => {
    expect(generateAppSpec('packing list for the trip', { now: fixedNow }).kind).toBe('checklist');
  });

  it('recognizes a to-do list as a checklist', () => {
    expect(generateAppSpec('todo list for today', { now: fixedNow }).kind).toBe('checklist');
  });

  it('recognizes a counter request', () => {
    expect(generateAppSpec('a click counter', { now: fixedNow }).kind).toBe('counter');
  });

  it('falls back to notes for anything unrecognized', () => {
    expect(generateAppSpec('my thoughts on the meeting today', { now: fixedNow }).kind).toBe('notes');
  });

  it('produces a stable, non-empty id every time', () => {
    const spec = generateAppSpec('anything', { now: fixedNow });
    expect(spec.id).toBeTruthy();
    expect(spec.v).toBe(1);
  });

  it('is deterministic: the same description classifies the same way twice', () => {
    const a = generateAppSpec('grocery checklist: milk, eggs', { now: fixedNow });
    const b = generateAppSpec('grocery checklist: milk, eggs', { now: fixedNow });
    expect(a.kind).toBe(b.kind);
    expect(a.name).toBe(b.name);
  });
});

describe('timer extraction', () => {
  it('reads an explicit minute duration', () => {
    const spec = generateAppSpec('25 minute timer for pomodoro', { now: fixedNow });
    if (spec.kind !== 'timer') throw new Error('expected timer');
    expect(spec.config.durationSeconds).toBe(25 * 60);
  });

  it('reads an explicit second duration', () => {
    const spec = generateAppSpec('90 second timer', { now: fixedNow });
    if (spec.kind !== 'timer') throw new Error('expected timer');
    expect(spec.config.durationSeconds).toBe(90);
  });

  it('reads an hour duration', () => {
    const spec = generateAppSpec('2 hour timer', { now: fixedNow });
    if (spec.kind !== 'timer') throw new Error('expected timer');
    expect(spec.config.durationSeconds).toBe(7200);
  });

  it('defaults to five minutes when no duration is stated', () => {
    const spec = generateAppSpec('timer', { now: fixedNow });
    if (spec.kind !== 'timer') throw new Error('expected timer');
    expect(spec.config.durationSeconds).toBe(300);
  });
});

describe('checklist extraction', () => {
  it('splits items after a colon on commas', () => {
    const spec = generateAppSpec('Grocery list: milk, eggs, bread', { now: fixedNow });
    if (spec.kind !== 'checklist') throw new Error('expected checklist');
    expect(spec.config.title).toBe('Grocery list');
    expect(spec.config.items).toEqual(['milk', 'eggs', 'bread']);
  });

  it('falls back to starter items when no colon is present', () => {
    const spec = generateAppSpec('packing list', { now: fixedNow });
    if (spec.kind !== 'checklist') throw new Error('expected checklist');
    expect(spec.config.items.length).toBeGreaterThan(0);
  });

  it('falls back to starter items when the colon has nothing after it', () => {
    const spec = generateAppSpec('todo list:', { now: fixedNow });
    if (spec.kind !== 'checklist') throw new Error('expected checklist');
    expect(spec.config.items).toEqual(['First item', 'Second item']);
  });
});

describe('flashcards extraction', () => {
  it('parses colon-separated front/back pairs joined by semicolons', () => {
    const spec = generateAppSpec('flashcards: hola = hello; adios = goodbye', { now: fixedNow });
    if (spec.kind !== 'flashcards') throw new Error('expected flashcards');
    expect(spec.config.cards).toEqual([
      { front: 'hola', back: 'hello' },
      { front: 'adios', back: 'goodbye' },
    ]);
  });

  it('parses dash-separated pairs', () => {
    const spec = generateAppSpec('flashcards: hola - hello', { now: fixedNow });
    if (spec.kind !== 'flashcards') throw new Error('expected flashcards');
    expect(spec.config.cards).toEqual([{ front: 'hola', back: 'hello' }]);
  });

  it('falls back to a starter card when nothing parses', () => {
    const spec = generateAppSpec('flashcards for the exam', { now: fixedNow });
    if (spec.kind !== 'flashcards') throw new Error('expected flashcards');
    expect(spec.config.cards).toEqual([{ front: 'Edit me', back: 'Double-click to flip' }]);
  });
});

describe('counter extraction', () => {
  it('reads a starting value', () => {
    const spec = generateAppSpec('counter starting at 10', { now: fixedNow });
    if (spec.kind !== 'counter') throw new Error('expected counter');
    expect(spec.config.initial).toBe(10);
  });

  it('reads a step size', () => {
    const spec = generateAppSpec('counter step 5', { now: fixedNow });
    if (spec.kind !== 'counter') throw new Error('expected counter');
    expect(spec.config.step).toBe(5);
  });

  it('defaults to step 1 and initial 0', () => {
    const spec = generateAppSpec('a simple tally', { now: fixedNow });
    if (spec.kind !== 'counter') throw new Error('expected counter');
    expect(spec.config.step).toBe(1);
    expect(spec.config.initial).toBe(0);
  });
});

describe('notes fallback', () => {
  it('keeps the full description as the note content', () => {
    const spec = generateAppSpec('remember to call mom on friday', { now: fixedNow });
    if (spec.kind !== 'notes') throw new Error('expected notes');
    expect(spec.config.initialContent).toBe('remember to call mom on friday');
  });
});

describe('name derivation', () => {
  it('strips a leading imperative verb', () => {
    const spec = generateAppSpec('make a counter for pushups', { now: fixedNow });
    expect(spec.name.toLowerCase()).not.toMatch(/^make /);
  });

  it('truncates a very long description to a reasonable icon label', () => {
    const spec = generateAppSpec('a'.repeat(80), { now: fixedNow });
    expect(spec.name.length).toBeLessThanOrEqual(40);
  });

  it('never produces an empty name', () => {
    const spec = generateAppSpec('   ', { now: fixedNow });
    expect(spec.name.length).toBeGreaterThan(0);
  });
});
