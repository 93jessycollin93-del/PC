import { describe, it, expect } from 'vitest';
import { loadGeneratedAppState, saveGeneratedAppState } from './generatedAppState';

const freshStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
};

describe('generated app runtime state', () => {
  it('returns null when nothing has been saved yet', () => {
    expect(loadGeneratedAppState('item-1', freshStore())).toBeNull();
  });

  it('round-trips whatever shape of state a runner saves', () => {
    const store = freshStore();
    saveGeneratedAppState('item-1', { checked: { a: true, b: false } }, store);
    expect(loadGeneratedAppState<{ checked: Record<string, boolean> }>('item-1', store))
      .toEqual({ checked: { a: true, b: false } });
  });

  it('keeps two different items independent', () => {
    const store = freshStore();
    saveGeneratedAppState('item-1', { value: 1 }, store);
    saveGeneratedAppState('item-2', { value: 2 }, store);
    expect(loadGeneratedAppState('item-1', store)).toEqual({ value: 1 });
    expect(loadGeneratedAppState('item-2', store)).toEqual({ value: 2 });
  });

  it('overwrites previous state for the same item on the next save', () => {
    const store = freshStore();
    saveGeneratedAppState('item-1', { value: 1 }, store);
    saveGeneratedAppState('item-1', { value: 99 }, store);
    expect(loadGeneratedAppState('item-1', store)).toEqual({ value: 99 });
  });

  it('starts clean rather than throwing when stored state is corrupt', () => {
    const store = freshStore();
    store.setItem('pc_generated_app_state_v1:item-1', '{{{ not json');
    expect(loadGeneratedAppState('item-1', store)).toBeNull();
  });

  it('returns null when there is no storage available at all', () => {
    expect(loadGeneratedAppState('item-1', null)).toBeNull();
  });

  it('does not throw when saving with no storage available', () => {
    expect(() => saveGeneratedAppState('item-1', { value: 1 }, null)).not.toThrow();
  });
});
