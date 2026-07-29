/**
 * generatedAppState — the mutable runtime state a generated app accumulates
 * (a checked-off item, a counter's current value), kept separate from the
 * GeneratedAppSpec it was created from.
 *
 * The split matters for export/import: the spec is the portable definition
 * that travels in an exported file, while this state is local-device data,
 * same as how NotepadApp separates `notepadInitialContent` (portable) from
 * `getFile(fileId)` (local, lib/storage.ts). Keyed by the desktop item's
 * stable id, not the window id, so state survives closing and reopening the
 * window — a re-imported copy of the same app (which gets a fresh item id
 * on import, like every other item type) starts from the spec's defaults
 * rather than inheriting another device's runtime state, which is correct:
 * nothing about "what you last had checked off" should be able to travel
 * inside a file someone else opens.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY_PREFIX = 'pc_generated_app_state_v1:';

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage || null;
  } catch {
    return null;
  }
}

export function loadGeneratedAppState<T>(itemId: string, storage?: StorageLike | null): T | null {
  const s = resolveStorage(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(KEY_PREFIX + itemId);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveGeneratedAppState<T>(itemId: string, state: T, storage?: StorageLike | null): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(KEY_PREFIX + itemId, JSON.stringify(state));
  } catch {
    // Storage pressure must not crash the app the user is actively using;
    // the state just lives only in memory for the rest of this session.
  }
}
