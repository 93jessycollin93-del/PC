import { describe, it, expect } from 'vitest';
import { TimeTravel, type DesktopSnapshot } from './timeTravel';

const freshStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
};

const snap = (ids: (string | null)[], wallpaper: string | null = null): DesktopSnapshot => ({
  desktopItemIds: ids,
  desktopVisibility: {},
  wallpaperUrl: wallpaper,
});

function at(start = 1_000_000) {
  let now = start;
  return {
    tt: new TimeTravel({ now: () => now, storage: freshStore() }),
    advance: (ms: number) => { now += ms; },
  };
}

describe('chaining commits', () => {
  it('links each commit to the one before it', async () => {
    const { tt } = at();
    const first = await tt.commit('created qpdb', snap(['qpdb']));
    const second = await tt.commit('created a folder', snap(['qpdb', 'folder-1']));
    expect(first.parentHash).toBe('');
    expect(second.parentHash).toBe(first.hash);
  });

  it('orders history oldest first', async () => {
    const { tt } = at();
    await tt.commit('one', snap(['a']));
    await tt.commit('two', snap(['a', 'b']));
    await tt.commit('three', snap(['a', 'b', 'c']));
    const history = await tt.getHistory();
    expect(history.map(c => c.label)).toEqual(['one', 'two', 'three']);
  });

  it('starts empty with no commits made', async () => {
    expect(await at().tt.getHistory()).toEqual([]);
  });
});

describe('proving the log has not been edited after the fact', () => {
  it('verifies a clean, untouched chain', async () => {
    const { tt } = at();
    await tt.commit('one', snap(['a']));
    await tt.commit('two', snap(['a', 'b']));
    const result = await tt.verifyIntegrity();
    expect(result.ok).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it('catches a commit whose content was altered after being written', async () => {
    // This is the property the whole module exists for: not that commits
    // exist, but that they can prove they were not silently rewritten.
    const store = freshStore();
    const tt = new TimeTravel({ now: () => 1, storage: store });
    await tt.commit('one', snap(['a']));
    const target = await tt.commit('two', snap(['a', 'b']));

    // Simulate tampering: edit the persisted commit's snapshot directly,
    // the way a corrupted disk or a hand edit would.
    const raw = JSON.parse(store.getItem('pc_time_travel_v1')!);
    raw.commits[target.id].snapshot.desktopItemIds.push('injected');
    store.setItem('pc_time_travel_v1', JSON.stringify(raw));

    const fresh = new TimeTravel({ now: () => 1, storage: store });
    const result = await fresh.verifyIntegrity();
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(target.id);
  });

  it('still catches a tampered root commit, even though its own parent link is the trusted baseline', async () => {
    // The root's parentHash is intentionally trusted as-is (that is what
    // makes a pruned or forked log's first commit verify). This proves that
    // trust does not extend to the commit's CONTENT: editing the root's
    // snapshot without a matching hash recompute is still caught, because
    // the hash is checked independently of whether the parent link is.
    const store = freshStore();
    const tt = new TimeTravel({ now: () => 1, storage: store });
    const root = await tt.commit('one', snap(['a']));

    const raw = JSON.parse(store.getItem('pc_time_travel_v1')!);
    raw.commits[root.id].snapshot.desktopItemIds = ['tampered'];
    store.setItem('pc_time_travel_v1', JSON.stringify(raw));

    const fresh = new TimeTravel({ now: () => 1, storage: store });
    const result = await fresh.verifyIntegrity();
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(root.id);
  });

  it('catches a broken parent link even if the tampered commit itself looks internally consistent', async () => {
    const store = freshStore();
    const tt = new TimeTravel({ now: () => 1, storage: store });
    await tt.commit('one', snap(['a']));
    await tt.commit('two', snap(['a', 'b']));
    const three = await tt.commit('three', snap(['a', 'b', 'c']));

    // Point commit three at a fabricated parent hash. Its own hash still
    // matches its own content, so only the chain link exposes the tamper.
    const raw = JSON.parse(store.getItem('pc_time_travel_v1')!);
    raw.commits[three.id].parentHash = 'fabricated0000';
    store.setItem('pc_time_travel_v1', JSON.stringify(raw));

    const fresh = new TimeTravel({ now: () => 1, storage: store });
    const result = await fresh.verifyIntegrity();
    expect(result.ok).toBe(false);
  });
});

describe('replaying to a point in history', () => {
  it('returns the exact snapshot recorded at that commit', async () => {
    const { tt } = at();
    const c1 = await tt.commit('one', snap(['a']));
    await tt.commit('two', snap(['a', 'b']));
    const replayed = await tt.replayTo(c1.id);
    expect(replayed).toEqual(snap(['a']));
  });

  it('returns null for an id that does not exist', async () => {
    expect(await at().tt.replayTo('no-such-commit')).toBeNull();
  });
});

describe('forking', () => {
  it('creates a branch that continues independently from the fork point', async () => {
    const { tt } = at();
    const c1 = await tt.commit('one', snap(['a']));
    await tt.commit('two on main', snap(['a', 'b']));

    const branch = await tt.fork(c1.id, 'Experiment');
    expect(branch.forkedFrom).toEqual({ branchId: 'main', commitId: c1.id });

    await tt.commit('three on the fork', snap(['a', 'x']));

    const forkHistory = await tt.getHistory(branch.id);
    expect(forkHistory.map(c => c.label)).toEqual(['one', 'three on the fork']);

    const mainHistory = await tt.getHistory('main');
    expect(mainHistory.map(c => c.label)).toEqual(['one', 'two on main']);
  });

  it('switches current branch on fork, so the next commit lands there', async () => {
    const { tt } = at();
    const c1 = await tt.commit('one', snap(['a']));
    await tt.fork(c1.id, 'Side quest');
    expect((await tt.currentBranch()).name).toBe('Side quest');
  });

  it('refuses to fork from a commit that does not exist', async () => {
    await expect(at().tt.fork('ghost', 'X')).rejects.toThrow();
  });

  it('a forked branch still verifies, since its first link is treated as its own root', async () => {
    const { tt } = at();
    const c1 = await tt.commit('one', snap(['a']));
    const branch = await tt.fork(c1.id, 'Experiment');
    await tt.commit('two', snap(['a', 'y']));
    const result = await tt.verifyIntegrity(branch.id);
    expect(result.ok).toBe(true);
  });

  it('lists every branch that has been created', async () => {
    const { tt } = at();
    const c1 = await tt.commit('one', snap(['a']));
    await tt.fork(c1.id, 'A');
    await tt.switchBranch('main');
    await tt.fork(c1.id, 'B');
    const names = (await tt.listBranches()).map(b => b.name).sort();
    expect(names).toEqual(['A', 'B', 'Main']);
  });
});

describe('persistence', () => {
  it('survives across instances sharing a store', async () => {
    const store = freshStore();
    const first = new TimeTravel({ now: () => 1, storage: store });
    await first.commit('one', snap(['a']));

    const second = new TimeTravel({ now: () => 2, storage: store });
    const history = await second.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].label).toBe('one');
  });

  it('starts clean on corrupt storage instead of throwing during boot', async () => {
    const store = freshStore();
    store.setItem('pc_time_travel_v1', '{{{ not json');
    const tt = new TimeTravel({ now: () => 1, storage: store });
    await expect(tt.getHistory()).resolves.toEqual([]);
  });

  it('ignores a payload of an unknown version rather than trusting a shape it does not recognise', async () => {
    const store = freshStore();
    store.setItem('pc_time_travel_v1', JSON.stringify({ v: 99, commits: {}, branches: {} }));
    const tt = new TimeTravel({ now: () => 1, storage: store });
    expect(await tt.getHistory()).toEqual([]);
  });
});

describe('exportState / importState — idea #06 whole-desktop bundling', () => {
  it('exports the exact state a second instance would import', async () => {
    const { tt } = at();
    await tt.commit('one', snap(['a']));
    await tt.commit('two', snap(['a', 'b']));

    const raw = await tt.exportState();

    const fresh = new TimeTravel({ now: () => 999, storage: freshStore() });
    await fresh.importState(raw);
    const history = await fresh.getHistory();
    expect(history.map(c => c.label)).toEqual(['one', 'two']);
  });

  it('imported history still verifies — importing does not weaken the chain', async () => {
    const { tt } = at();
    await tt.commit('one', snap(['a']));
    const raw = await tt.exportState();

    const fresh = new TimeTravel({ now: () => 1, storage: freshStore() });
    await fresh.importState(raw);
    expect((await fresh.verifyIntegrity()).ok).toBe(true);
  });

  it('a fresh instance with nothing committed yet still exports a valid (empty) state', async () => {
    const tt = new TimeTravel({ now: () => 1, storage: freshStore() });
    const raw = await tt.exportState();
    const parsed = JSON.parse(raw);
    expect(parsed.v).toBe(1);
    expect(parsed.commits).toEqual({});
  });

  it('replaces the whole log on import, not merges with what was already there', async () => {
    const donor = new TimeTravel({ now: () => 1, storage: freshStore() });
    await donor.commit('donor commit', snap(['x']));
    const raw = await donor.exportState();

    const receiver = new TimeTravel({ now: () => 1, storage: freshStore() });
    await receiver.commit('receiver commit', snap(['y']));
    await receiver.importState(raw);

    const history = await receiver.getHistory();
    expect(history.map(c => c.label)).toEqual(['donor commit']);
  });

  it('starts fresh rather than throwing on an unparseable import', async () => {
    const tt = new TimeTravel({ now: () => 1, storage: freshStore() });
    await expect(tt.importState('{{{ not json')).resolves.toBeUndefined();
    expect(await tt.getHistory()).toEqual([]);
  });

  it('persists the imported state so a later instance sharing storage sees it too', async () => {
    const store = freshStore();
    const donor = new TimeTravel({ now: () => 1, storage: freshStore() });
    await donor.commit('one', snap(['a']));
    const raw = await donor.exportState();

    const receiver = new TimeTravel({ now: () => 1, storage: store });
    await receiver.importState(raw);

    const another = new TimeTravel({ now: () => 2, storage: store });
    expect((await another.getHistory()).map(c => c.label)).toEqual(['one']);
  });
});

describe('bounding the log', () => {
  it('drops the oldest commits once the cap is passed, and the remaining chain still verifies', async () => {
    const { tt } = at();
    const capped = new TimeTravel({ now: () => 1, storage: (tt as any).storage, maxCommitsPerBranch: 3, storageKey: 'capped' });
    for (let i = 0; i < 6; i++) {
      await capped.commit(`commit ${i}`, snap([`item-${i}`]));
    }
    const history = await capped.getHistory();
    expect(history).toHaveLength(3);
    expect(history.map(c => c.label)).toEqual(['commit 3', 'commit 4', 'commit 5']);
    expect((await capped.verifyIntegrity()).ok).toBe(true);
  });
});
