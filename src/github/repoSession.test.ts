/**
 * GitHub session and offline cache.
 *
 * Drives the REAL service against an in-memory store. The behaviour under test
 * is that closing the app loses nothing and that a repo browsed once stays
 * readable with no network — the two complaints this module exists for.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RepoSessionService, parseRepoInput, describeAge, type SessionStore } from './repoSession';

function memoryStore(): SessionStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (k, fallback) => (map.has(k) ? (map.get(k) as never) : fallback),
    set: async (k, v) => { map.set(k, v); return v; },
    remove: async k => { map.delete(k); },
  };
}

describe('parsing what someone pastes', () => {
  it('accepts owner/repo', () => {
    expect(parseRepoInput('facebook/react')).toBe('facebook/react');
  });

  it('accepts a full github URL', () => {
    expect(parseRepoInput('https://github.com/facebook/react')).toBe('facebook/react');
  });

  it('accepts a DEEP url and keeps only owner/repo', () => {
    // Pasting a deep link is the most common way someone arrives here, and
    // every API call below needs just the two segments.
    expect(parseRepoInput('https://github.com/facebook/react/tree/main/packages')).toBe(
      'facebook/react'
    );
  });

  it('accepts a .git suffix and trailing slashes', () => {
    expect(parseRepoInput('https://github.com/a/b.git/')).toBe('a/b');
  });

  it('rejects anything without both parts, rather than guessing', () => {
    expect(parseRepoInput('react')).toBeNull();
    expect(parseRepoInput('')).toBeNull();
    expect(parseRepoInput('   ')).toBeNull();
  });
});

describe('resuming exactly where you were', () => {
  let svc: RepoSessionService;
  let store: ReturnType<typeof memoryStore>;
  beforeEach(() => {
    store = memoryStore();
    svc = new RepoSessionService(store);
  });

  it('has no session before anything is opened', async () => {
    expect(await svc.loadSession()).toBeNull();
  });

  it('restores the repo, the folder AND the open file', async () => {
    // Losing the folder and file is what makes reopening feel like starting
    // over even though the repo name came back.
    await svc.saveSession({ repo: 'a/b', path: 'src/lib', openFile: 'src/lib/index.ts' });
    const s = await svc.loadSession();
    expect(s).toMatchObject({ repo: 'a/b', path: 'src/lib', openFile: 'src/lib/index.ts' });
    expect(s!.updatedAt).toBeGreaterThan(0);
  });

  it('overwrites rather than accumulating sessions', async () => {
    await svc.saveSession({ repo: 'a/b', path: '', openFile: null });
    await svc.saveSession({ repo: 'c/d', path: 'x', openFile: null });
    expect((await svc.loadSession())!.repo).toBe('c/d');
  });

  it('clears cleanly', async () => {
    await svc.saveSession({ repo: 'a/b', path: '', openFile: null });
    await svc.clearSession();
    expect(await svc.loadSession()).toBeNull();
  });
});

describe('recent repositories', () => {
  let svc: RepoSessionService;
  beforeEach(() => { svc = new RepoSessionService(memoryStore()); });

  it('starts empty', async () => {
    expect(await svc.recentRepos()).toEqual([]);
  });

  it('puts the most recent first', async () => {
    await svc.noteRepoOpened('a/b');
    await svc.noteRepoOpened('c/d');
    expect((await svc.recentRepos()).map(r => r.repo)).toEqual(['c/d', 'a/b']);
  });

  it('de-duplicates rather than repeating a repo', async () => {
    await svc.noteRepoOpened('a/b');
    await svc.noteRepoOpened('c/d');
    await svc.noteRepoOpened('a/b');
    const list = await svc.recentRepos();
    expect(list.map(r => r.repo)).toEqual(['a/b', 'c/d']);
  });

  it('caps the list so it cannot grow forever', async () => {
    for (let i = 0; i < 30; i++) await svc.noteRepoOpened(`owner/repo${i}`);
    expect((await svc.recentRepos()).length).toBeLessThanOrEqual(12);
  });

  it('remembers how much of a repo is cached, across reopens', async () => {
    await svc.noteRepoOpened('a/b');
    await svc.cacheListing('a/b', '', [{ name: 'src' }]);
    await svc.cacheListing('a/b', 'src', [{ name: 'index.ts' }]);
    await svc.noteRepoOpened('a/b');
    expect((await svc.recentRepos())[0].cachedPaths).toBe(2);
  });
});

describe('a repo browsed once stays readable with no network', () => {
  let svc: RepoSessionService;
  beforeEach(() => { svc = new RepoSessionService(memoryStore()); });

  it('returns nothing for a path never fetched', async () => {
    expect(await svc.readListing('a/b', 'src')).toBeNull();
  });

  it('serves a cached directory listing back', async () => {
    await svc.cacheListing('a/b', 'src', [{ name: 'index.ts', type: 'file' }]);
    const hit = await svc.readListing('a/b', 'src');
    expect(hit!.nodes).toHaveLength(1);
    expect(hit!.fetchedAt).toBeGreaterThan(0);
  });

  it('keeps the root and a subfolder separately', async () => {
    await svc.cacheListing('a/b', '', [{ name: 'root' }]);
    await svc.cacheListing('a/b', 'src', [{ name: 'sub' }]);
    expect((await svc.readListing('a/b', ''))!.nodes).toEqual([{ name: 'root' }]);
    expect((await svc.readListing('a/b', 'src'))!.nodes).toEqual([{ name: 'sub' }]);
  });

  it('does not confuse two repos with the same path', async () => {
    await svc.cacheListing('a/b', 'src', [{ name: 'from-ab' }]);
    await svc.cacheListing('c/d', 'src', [{ name: 'from-cd' }]);
    expect((await svc.readListing('a/b', 'src'))!.nodes).toEqual([{ name: 'from-ab' }]);
  });

  it('serves file contents back verbatim', async () => {
    const content = 'export const x = 1;\n// unicode: sauté 🙂\n';
    await svc.cacheFile('a/b', 'src/x.ts', 'x.ts', content);
    expect((await svc.readFile('a/b', 'src/x.ts'))!.content).toBe(content);
  });
});

describe('staleness is reported, not hidden', () => {
  it('phrases age for a person', () => {
    const now = 1_000_000_000_000;
    expect(describeAge(now - 5_000, now)).toBe('just now');
    expect(describeAge(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(describeAge(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(describeAge(now - 2 * 86_400_000, now)).toBe('2 days ago');
    expect(describeAge(now - 86_400_000, now)).toBe('1 day ago');
  });

  it('never reports a negative age from a clock skew', () => {
    const now = 1_000;
    expect(describeAge(now + 60_000, now)).toBe('just now');
  });
});
