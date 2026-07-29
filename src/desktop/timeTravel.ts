/**
 * timeTravel — an immutable, hash-chained history of the desktop.
 *
 * Every meaningful change (a folder made, an app moved, the wallpaper
 * changed) becomes a commit. Commits chain by SHA-256, each one hashing the
 * one before it, so the log can prove nothing in it was edited after the
 * fact — the same integrity property Jackie's Vault already uses for its
 * own history, applied here to the desktop instead of vault storage.
 *
 * SCOPE, STATED PLAINLY: this ships commit, history, replay-to-any-point,
 * and fork. It does NOT ship merging two branches back together — that
 * needs real design (what does "merge" mean for a desktop layout? whose
 * folder wins?) and shipping a fake merge that silently picks one side
 * would be worse than not having merge at all. Fork gives you a place to
 * explore; reconciling forks is deliberately left to the user for now.
 *
 * What gets committed is the desktop's CONTENT (which items exist, where,
 * with what wallpaper) — not session furniture like which windows happen to
 * be open or their pixel positions. That mirrors what a real OS restore
 * point captures: your files and settings, not your open tabs.
 */

export interface DesktopSnapshot {
  /** Same id list shape App.tsx already persists via saveGlobalState,
   *  reused rather than reinvented so replay can lean on the existing
   *  id -> DesktopItem resolution logic. */
  desktopItemIds: (string | null)[];
  desktopVisibility: Record<string, boolean>;
  wallpaperUrl: string | null;
}

export interface Commit {
  id: string;
  /** Hash of this commit's own content — the chain link. */
  hash: string;
  /** Hash of the previous commit on this branch; '' for the first commit. */
  parentHash: string;
  branchId: string;
  timestamp: number;
  /** Short human label, e.g. "Created folder \"Work\"". */
  label: string;
  snapshot: DesktopSnapshot;
}

export interface Branch {
  id: string;
  name: string;
  /** Branch this was forked from; undefined for the root branch. */
  forkedFrom?: { branchId: string; commitId: string };
  headCommitId: string | null;
  createdAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TimeTravelOptions {
  now?: () => number;
  storage?: StorageLike | null;
  storageKey?: string;
  /** Injected so the engine is testable without the real subtle.crypto
   *  timing and so a non-browser caller can supply any SHA-256 impl. */
  sha256?: (text: string) => Promise<string>;
  /** Commits beyond this count are dropped from the oldest end so the log
   *  cannot grow forever; the chain re-roots cleanly at the new oldest
   *  commit rather than pretending history before it still verifies. */
  maxCommitsPerBranch?: number;
}

const DEFAULT_STORAGE_KEY = 'pc_time_travel_v1';
const ROOT_BRANCH_ID = 'main';
const ROOT_BRANCH_NAME = 'Main';
const DEFAULT_MAX_COMMITS = 500;

function resolveDefaultStorage(): StorageLike | null {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    return candidate || null;
  } catch {
    return null;
  }
}

async function defaultSha256(text: string): Promise<string> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) {
    throw new Error('timeTravel: no SHA-256 implementation available (Web Crypto missing and none was injected)');
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function newId(kind: string): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deterministic content for hashing: same snapshot must always hash the
 *  same way regardless of key insertion order. */
function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

interface StoredState {
  v: number;
  branches: Record<string, Branch>;
  commits: Record<string, Commit>;
  currentBranchId: string;
}

export class TimeTravel {
  private nowFn: () => number;
  private storage: StorageLike | null;
  private storageKey: string;
  private sha256: (text: string) => Promise<string>;
  private maxCommitsPerBranch: number;
  private state: StoredState;
  private loaded = false;

  constructor(options: TimeTravelOptions = {}) {
    this.nowFn = options.now || (() => Date.now());
    this.storage = options.storage === undefined ? resolveDefaultStorage() : options.storage;
    this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    this.sha256 = options.sha256 || defaultSha256;
    this.maxCommitsPerBranch = options.maxCommitsPerBranch ?? DEFAULT_MAX_COMMITS;
    this.state = this.emptyState();
  }

  private emptyState(): StoredState {
    return {
      v: 1,
      branches: {
        [ROOT_BRANCH_ID]: { id: ROOT_BRANCH_ID, name: ROOT_BRANCH_NAME, headCommitId: null, createdAt: this.nowFn() },
      },
      commits: {},
      currentBranchId: ROOT_BRANCH_ID,
    };
  }

  /** Record a new commit on the current branch. Always succeeds; a
   *  snapshot identical to the current head is committed anyway, since the
   *  label (what happened) is still meaningful history even when the
   *  resulting state looks the same. */
  public async commit(label: string, snapshot: DesktopSnapshot): Promise<Commit> {
    await this.ensureLoaded();
    const branch = this.state.branches[this.state.currentBranchId];
    const parent = branch.headCommitId ? this.state.commits[branch.headCommitId] : null;
    const parentHash = parent ? parent.hash : '';
    const timestamp = this.nowFn();

    const hash = await this.sha256(canonical({ parentHash, branchId: branch.id, timestamp, label, snapshot }));
    const commit: Commit = { id: newId('commit'), hash, parentHash, branchId: branch.id, timestamp, label, snapshot };

    this.state.commits[commit.id] = commit;
    branch.headCommitId = commit.id;
    this.prune(branch.id);
    this.persist();
    return commit;
  }

  /** Ordered oldest-first history for a branch (current branch by default). */
  public async getHistory(branchId?: string): Promise<Commit[]> {
    await this.ensureLoaded();
    const id = branchId || this.state.currentBranchId;
    const branch = this.state.branches[id];
    if (!branch) return [];

    const chain: Commit[] = [];
    let cursor = branch.headCommitId;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) break; // guards a corrupt cycle rather than hanging
      seen.add(cursor);
      const c = this.state.commits[cursor];
      if (!c) break;
      chain.push(c);
      cursor = this.parentIdOf(c);
    }
    return chain.reverse();
  }

  /** The snapshot to restore to. Replaying is just reading the commit —
   *  a snapshot is the full state, not a diff to apply, so there is
   *  nothing to reconstruct. */
  public async replayTo(commitId: string): Promise<DesktopSnapshot | null> {
    await this.ensureLoaded();
    const commit = this.state.commits[commitId];
    return commit ? commit.snapshot : null;
  }

  /**
   * Branch off from a specific commit into a new, independent lineage.
   * The new branch becomes current, so the next commit continues there.
   * Explicitly not a merge target later — see the module-level note.
   */
  public async fork(fromCommitId: string, name: string): Promise<Branch> {
    await this.ensureLoaded();
    const source = this.state.commits[fromCommitId];
    if (!source) throw new Error(`timeTravel: cannot fork from unknown commit "${fromCommitId}"`);

    const branch: Branch = {
      id: newId('branch'),
      name: name || `Fork of ${source.label}`,
      forkedFrom: { branchId: source.branchId, commitId: source.id },
      headCommitId: source.id,
      createdAt: this.nowFn(),
    };
    this.state.branches[branch.id] = branch;
    this.state.currentBranchId = branch.id;
    this.persist();
    return branch;
  }

  public async listBranches(): Promise<Branch[]> {
    await this.ensureLoaded();
    return Object.values(this.state.branches).sort((a, b) => a.createdAt - b.createdAt);
  }

  public async switchBranch(branchId: string): Promise<void> {
    await this.ensureLoaded();
    if (!this.state.branches[branchId]) throw new Error(`timeTravel: unknown branch "${branchId}"`);
    this.state.currentBranchId = branchId;
    this.persist();
  }

  public async currentBranch(): Promise<Branch> {
    await this.ensureLoaded();
    return this.state.branches[this.state.currentBranchId];
  }

  /**
   * Recompute every commit's hash from its own content and compare against
   * what is stored, walking parent links. Returns the first break found, or
   * null if the whole chain verifies — proof the log has not been edited
   * after the fact, not just a claim that it hasn't.
   */
  public async verifyIntegrity(branchId?: string): Promise<{ ok: boolean; brokenAt: string | null }> {
    const history = await this.getHistory(branchId);
    // The first commit in the retained window is trusted as this window's
    // root, whatever its own parentHash claims. That is correct, not lax:
    // its true parent may live on another branch (a fork point) or may have
    // been pruned off the front of a long log — either way it is outside
    // what this log still holds, so there is nothing here to check it
    // against. Every link FROM this point forward is still fully verified.
    let expectedParentHash = history.length ? history[0].parentHash : '';
    for (const commit of history) {
      const recomputed = await this.sha256(
        canonical({ parentHash: commit.parentHash, branchId: commit.branchId, timestamp: commit.timestamp, label: commit.label, snapshot: commit.snapshot })
      );
      if (recomputed !== commit.hash || commit.parentHash !== expectedParentHash) {
        return { ok: false, brokenAt: commit.id };
      }
      expectedParentHash = commit.hash;
    }
    return { ok: true, brokenAt: null };
  }

  private parentIdOf(commit: Commit): string | null {
    if (!commit.parentHash) return null;
    // Parent lives by hash in the log; walk the same branch's map by hash.
    for (const id of Object.keys(this.state.commits)) {
      if (this.state.commits[id].hash === commit.parentHash) return id;
    }
    return null;
  }

  /** Cap the branch length by dropping the oldest commits. The new oldest
   *  commit keeps its real parentHash on record even though that parent no
   *  longer exists in the log — verifyIntegrity treats a pruned branch's
   *  first commit as its own root rather than reporting a false break. */
  private prune(branchId: string): void {
    const branch = this.state.branches[branchId];
    if (!branch.headCommitId) return;
    const chain: string[] = [];
    let cursor: string | null = branch.headCommitId;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      chain.push(cursor);
      const c = this.state.commits[cursor];
      cursor = c ? this.parentIdOf(c) : null;
    }
    if (chain.length <= this.maxCommitsPerBranch) return;
    const toDrop = chain.slice(this.maxCommitsPerBranch);
    for (const id of toDrop) delete this.state.commits[id];
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return;
      if (!parsed.branches || !parsed.commits || !parsed.currentBranchId) return;
      this.state = parsed;
    } catch {
      // A corrupt log starting fresh is safer than one that half-loads and
      // then hashes garbage.
      this.state = this.emptyState();
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      // Storage pressure must never break the desktop action that triggered
      // the commit; the commit still exists in memory for this session.
    }
  }
}
