/**
 * The virtual filesystem.
 *
 * This is the seam that makes the shell portable between "a tab" and "a
 * booted machine". Apps only ever call the `Vfs` interface; they never touch
 * `localStorage` and never issue a `fetch` for storage. Swapping the backend
 * therefore changes where every file in the system lives without editing a
 * single app.
 *
 * Two backends ship:
 *
 *   LocalStorageBackend — the browser fallback. Everything lives under one
 *     key prefix, is capped by the origin's storage quota (typically ~5MB),
 *     and dies with the profile. Fine for a demo in a tab, not a filesystem.
 *
 *   HostBackend — talks to the host agent over HTTP on loopback (see
 *     `image/overlay/opt/eye-os/bin/eye-hostd`). On a booted image this
 *     is a real directory on a real disk: no quota, survives reboot, and is
 *     readable by anything else on the machine.
 *
 * `openVfs()` probes for the host agent once at boot and falls back. That
 * probe is the entire difference between the two environments.
 */
import type { VfsEntry } from './types';
import { bus } from './bus';

export interface Vfs {
  /** Human-readable backend name, surfaced in System Info. */
  readonly backend: string;
  /** True when files outlive the browser profile. */
  readonly durable: boolean;
  read(path: string): Promise<string | null>;
  write(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(dir: string): Promise<VfsEntry[]>;
  mkdir(dir: string): Promise<void>;
}

/** Collapses `.`/`..`, strips duplicate slashes, always returns an absolute path. */
export function normalizePath(path: string): string {
  const absolute = path.startsWith('/') ? path : `/${path}`;
  const out: string[] = [];
  for (const segment of absolute.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return `/${out.join('/')}`;
}

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const cut = normalized.lastIndexOf('/');
  return cut <= 0 ? '/' : normalized.slice(0, cut);
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1) || '/';
}

// ---------------------------------------------------------------------------
// Browser backend
// ---------------------------------------------------------------------------

const PREFIX = 'eye-os:vfs:';

interface StoredFile {
  contents: string;
  modified: number;
}

/**
 * Directories are stored as explicit marker entries rather than inferred from
 * file paths, so an empty directory survives a reload — the same reason a
 * real filesystem has inodes for directories.
 */
class LocalStorageBackend implements Vfs {
  readonly backend = 'localStorage (browser)';
  readonly durable = false;

  private key(path: string): string {
    return PREFIX + normalizePath(path);
  }

  async read(path: string): Promise<string | null> {
    const raw = localStorage.getItem(this.key(path));
    if (raw === null) return null;
    try {
      return (JSON.parse(raw) as StoredFile).contents;
    } catch {
      return null;
    }
  }

  async write(path: string, contents: string): Promise<void> {
    const normalized = normalizePath(path);
    const record: StoredFile = { contents, modified: Date.now() };
    try {
      localStorage.setItem(this.key(normalized), JSON.stringify(record));
    } catch {
      throw new Error('Out of browser storage quota — boot the disk image for a real filesystem.');
    }
    await this.mkdir(dirname(normalized));
    bus.emit('vfs-changed', { path: normalized, op: 'write' });
  }

  async remove(path: string): Promise<void> {
    const normalized = normalizePath(path);
    localStorage.removeItem(this.key(normalized));
    localStorage.removeItem(`${PREFIX}dir:${normalized}`);
    bus.emit('vfs-changed', { path: normalized, op: 'delete' });
  }

  async mkdir(dir: string): Promise<void> {
    const normalized = normalizePath(dir);
    if (normalized === '/') return;
    const marker = `${PREFIX}dir:${normalized}`;
    // Already present means its parents are too, so this short-circuit both
    // ends the recursion early and keeps a plain `write` from republishing a
    // mkdir event for every directory on the way to the root.
    if (localStorage.getItem(marker) !== null) return;
    localStorage.setItem(marker, String(Date.now()));
    await this.mkdir(dirname(normalized));
    bus.emit('vfs-changed', { path: normalized, op: 'mkdir' });
  }

  async list(dir: string): Promise<VfsEntry[]> {
    const base = normalizePath(dir);
    const scope = base === '/' ? '/' : `${base}/`;
    const entries = new Map<string, VfsEntry>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;

      const isDirMarker = key.startsWith(`${PREFIX}dir:`);
      const path = isDirMarker ? key.slice(`${PREFIX}dir:`.length) : key.slice(PREFIX.length);
      if (path === base || !path.startsWith(scope)) continue;

      // Only direct children: anything deeper is represented by its ancestor.
      const rest = path.slice(scope.length);
      const slash = rest.indexOf('/');
      const childName = slash === -1 ? rest : rest.slice(0, slash);
      if (!childName) continue;
      const childPath = normalizePath(`${scope}${childName}`);
      const isDir = slash !== -1 || isDirMarker;

      const existing = entries.get(childPath);
      if (existing && existing.kind === 'dir') continue;

      let size = 0;
      let modified = 0;
      if (!isDir) {
        try {
          const record = JSON.parse(localStorage.getItem(key) ?? '{}') as StoredFile;
          size = record.contents?.length ?? 0;
          modified = record.modified ?? 0;
        } catch {
          /* unreadable entry — reported as an empty file rather than hidden */
        }
      }
      entries.set(childPath, { path: childPath, kind: isDir ? 'dir' : 'file', size, modified });
    }

    return [...entries.values()].sort(
      (a, b) => (a.kind === b.kind ? 0 : a.kind === 'dir' ? -1 : 1) || a.path.localeCompare(b.path),
    );
  }
}

// ---------------------------------------------------------------------------
// Host backend
// ---------------------------------------------------------------------------

const HOST_BASE = '/api/fs';

async function hostRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(HOST_BASE + path, init);
  if (!response.ok) {
    throw new Error(`host filesystem error ${response.status}: ${await response.text()}`);
  }
  return response;
}

class HostBackend implements Vfs {
  readonly backend = 'host filesystem (/var/lib/eye-os/files)';
  readonly durable = true;

  async read(path: string): Promise<string | null> {
    const response = await fetch(`${HOST_BASE}/read?path=${encodeURIComponent(normalizePath(path))}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`host filesystem error ${response.status}`);
    return response.text();
  }

  async write(path: string, contents: string): Promise<void> {
    const normalized = normalizePath(path);
    await hostRequest(`/write?path=${encodeURIComponent(normalized)}`, {
      method: 'PUT',
      body: contents,
    });
    bus.emit('vfs-changed', { path: normalized, op: 'write' });
  }

  async remove(path: string): Promise<void> {
    const normalized = normalizePath(path);
    await hostRequest(`/remove?path=${encodeURIComponent(normalized)}`, { method: 'DELETE' });
    bus.emit('vfs-changed', { path: normalized, op: 'delete' });
  }

  async mkdir(dir: string): Promise<void> {
    const normalized = normalizePath(dir);
    await hostRequest(`/mkdir?path=${encodeURIComponent(normalized)}`, { method: 'POST' });
    bus.emit('vfs-changed', { path: normalized, op: 'mkdir' });
  }

  async list(dir: string): Promise<VfsEntry[]> {
    const response = await hostRequest(`/list?path=${encodeURIComponent(normalizePath(dir))}`);
    return (await response.json()) as VfsEntry[];
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

let active: Vfs | null = null;

/**
 * Picks a backend once per boot. The host agent answers `/api/fs/health` only
 * when it is actually serving a directory, so a failed probe means "running in
 * a plain browser" and not "the disk is broken".
 */
export async function openVfs(): Promise<Vfs> {
  if (active) return active;
  try {
    const response = await fetch(`${HOST_BASE}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    active = response.ok ? new HostBackend() : new LocalStorageBackend();
  } catch {
    active = new LocalStorageBackend();
  }
  return active;
}

/** Throws if called before `openVfs()` has resolved — boot order is a bug, not a fallback. */
export function vfs(): Vfs {
  if (!active) throw new Error('VFS used before openVfs() resolved');
  return active;
}
