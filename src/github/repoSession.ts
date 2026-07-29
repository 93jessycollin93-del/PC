/**
 * GitHub session and offline cache.
 *
 * Two things were missing from the sync app, and both are the same complaint:
 * closing it lost everything.
 *
 *   RESUME. The repo, the folder you were in, and the file you had open lived
 *   in component state, so reopening dropped you back at an empty box. For an
 *   app that is meant to decompress and recompress constantly, losing your
 *   place every time defeats the point.
 *
 *   OFFLINE. Nothing was cached, so a repo you had already browsed was
 *   unreachable with no network — in an app whose premise is that it works
 *   off-grid. Anything fetched is now kept, and the cache is served first when
 *   the network is gone.
 *
 * Cached entries carry the time they were fetched, and staleness is REPORTED
 * rather than hidden: showing week-old file contents as if they were current
 * is worse than saying plainly that this is what was last seen.
 */

export interface CachedListing {
  /** owner/repo */
  repo: string;
  path: string;
  /** Raw GitHub contents payload for this path. */
  nodes: unknown[];
  fetchedAt: number;
}

export interface CachedFile {
  repo: string;
  path: string;
  name: string;
  content: string;
  fetchedAt: number;
}

export interface RepoSession {
  /** Last repo viewed, so reopening resumes rather than restarting. */
  repo: string;
  /** Folder within it. */
  path: string;
  /** File that was open, if any. */
  openFile: string | null;
  updatedAt: number;
}

export interface RecentRepo {
  repo: string;
  lastOpenedAt: number;
  /** How many paths of this repo are cached — a rough "how much works offline". */
  cachedPaths: number;
}

/** Storage this module needs. Injected so it is testable without a browser. */
export interface SessionStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<unknown>;
  remove(key: string): Promise<void>;
}

const SESSION_KEY = 'github:session';
const RECENT_KEY = 'github:recent';
const MAX_RECENT = 12;

const listingKey = (repo: string, path: string) => `github:tree:${repo}:${path || '/'}`;
const fileKey = (repo: string, path: string) => `github:file:${repo}:${path}`;

/** Normalize what someone pastes into owner/repo. */
export function parseRepoInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Order matters: trailing slashes come off FIRST, otherwise a pasted
  // "…/repo.git/" still ends in a slash when the .git rule runs and keeps it.
  const cleaned = trimmed
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  // Accepts a deep URL (owner/repo/tree/main/src) and keeps only owner/repo,
  // because that is what every API call here needs and pasting a deep link is
  // the most common way someone gets here.
  return `${parts[0]}/${parts[1]}`;
}

export class RepoSessionService {
  constructor(private store: SessionStore) {}

  public async loadSession(): Promise<RepoSession | null> {
    return await this.store.get<RepoSession | null>(SESSION_KEY, null);
  }

  /** Called on every navigation, so a close at any moment loses nothing. */
  public async saveSession(session: Omit<RepoSession, 'updatedAt'>): Promise<void> {
    await this.store.set(SESSION_KEY, { ...session, updatedAt: Date.now() });
  }

  public async clearSession(): Promise<void> {
    await this.store.remove(SESSION_KEY);
  }

  public async recentRepos(): Promise<RecentRepo[]> {
    const list = await this.store.get<RecentRepo[]>(RECENT_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  /** Move a repo to the top of the recent list, de-duplicated. */
  public async noteRepoOpened(repo: string): Promise<void> {
    const list = await this.recentRepos();
    const existing = list.find(r => r.repo === repo);
    const rest = list.filter(r => r.repo !== repo);
    const updated: RecentRepo = {
      repo,
      lastOpenedAt: Date.now(),
      cachedPaths: existing?.cachedPaths ?? 0,
    };
    await this.store.set(RECENT_KEY, [updated, ...rest].slice(0, MAX_RECENT));
  }

  public async cacheListing(repo: string, path: string, nodes: unknown[]): Promise<void> {
    await this.store.set(listingKey(repo, path), {
      repo,
      path,
      nodes,
      fetchedAt: Date.now(),
    } satisfies CachedListing);
    const list = await this.recentRepos();
    const entry = list.find(r => r.repo === repo);
    if (entry) {
      entry.cachedPaths += 1;
      await this.store.set(RECENT_KEY, list);
    }
  }

  public async readListing(repo: string, path: string): Promise<CachedListing | null> {
    return await this.store.get<CachedListing | null>(listingKey(repo, path), null);
  }

  public async cacheFile(repo: string, path: string, name: string, content: string): Promise<void> {
    await this.store.set(fileKey(repo, path), {
      repo,
      path,
      name,
      content,
      fetchedAt: Date.now(),
    } satisfies CachedFile);
  }

  public async readFile(repo: string, path: string): Promise<CachedFile | null> {
    return await this.store.get<CachedFile | null>(fileKey(repo, path), null);
  }
}

/** How old a cached entry is, phrased for a person. */
export function describeAge(fetchedAt: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
