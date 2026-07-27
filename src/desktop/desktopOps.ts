/**
 * desktopOps — every desktop mutation, as pure functions over item arrays.
 *
 * No React, no DOM: the menu and the App shell dispatch intents here and
 * render the result, so the rules (naming, ordering, what a folder is)
 * live in exactly one place and can be tested without a browser.
 *
 * Icons are React components and are NOT JSON-serializable, so anything
 * persisted stores an `iconName` and resolves it back through the shared
 * iconMap on load — the same contract getMergedDesktopItems already uses
 * for custom apps.
 */
import { DesktopItem } from '../../types';

export type DesktopList = (DesktopItem | null)[];

/** localStorage key for items the user created (folders, documents). */
export const USER_ITEMS_KEY = 'sas_user_desktop_items';

/** Shape actually written to storage — icons flattened to a name. */
interface StoredItem {
  id: string;
  name: string;
  type: 'app' | 'folder';
  iconName: string;
  bgColor?: string;
  appId?: string;
  notepadInitialContent?: string;
  contents?: StoredItem[];
}

const toStored = (item: DesktopItem): StoredItem => ({
  id: item.id,
  name: item.name,
  type: item.type,
  iconName: item.iconName || (item.type === 'folder' ? 'Folder' : 'Globe'),
  bgColor: item.bgColor,
  appId: item.appId,
  notepadInitialContent: item.notepadInitialContent,
  contents: item.contents?.map(toStored),
});

const fromStored = (
  stored: StoredItem,
  resolveIcon: (name: string) => DesktopItem['icon'],
): DesktopItem => ({
  id: stored.id,
  name: stored.name,
  type: stored.type,
  icon: resolveIcon(stored.iconName),
  iconName: stored.iconName,
  bgColor: stored.bgColor,
  appId: stored.appId,
  notepadInitialContent: stored.notepadInitialContent,
  contents: stored.contents?.map((c) => fromStored(c, resolveIcon)),
});

/** Read back everything the user made. Never throws — a corrupt entry
 *  costs the user their custom items, so failing loud on boot is worse
 *  than starting empty. */
export function loadUserItems(
  resolveIcon: (name: string) => DesktopItem['icon'],
): DesktopItem[] {
  try {
    const raw = localStorage.getItem(USER_ITEMS_KEY);
    if (!raw) return [];
    const parsed: StoredItem[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => fromStored(s, resolveIcon));
  } catch (e) {
    console.error('desktopOps: could not read saved desktop items', e);
    return [];
  }
}

/** Persist the user-created subset of a desktop list. Items that came from
 *  the built-in catalog are excluded — those are re-merged from source. */
export function saveUserItems(items: DesktopList): void {
  try {
    const mine = items.filter(
      (i): i is DesktopItem => !!i && isUserCreated(i),
    );
    localStorage.setItem(USER_ITEMS_KEY, JSON.stringify(mine.map(toStored)));
  } catch (e) {
    console.error('desktopOps: could not save desktop items', e);
  }
}

/** User-created ids carry a prefix so they're distinguishable from catalog
 *  entries without keeping a second registry in sync. */
const USER_PREFIX = 'user-';
export const isUserCreated = (item: DesktopItem): boolean =>
  item.id.startsWith(USER_PREFIX);

const newId = (kind: string) =>
  `${USER_PREFIX}${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * "New Folder", "New Folder (2)", "New Folder (3)" — the same
 * disambiguation a real file manager does, so creating several in a row
 * doesn't produce duplicates the user can't tell apart.
 */
export function uniqueName(base: string, siblings: DesktopList): string {
  const taken = new Set(
    siblings.filter(Boolean).map((i) => i!.name.toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})`;
}

export function createFolder(
  items: DesktopList,
  icon: DesktopItem['icon'],
  name?: string,
): { items: DesktopList; created: DesktopItem } {
  const created: DesktopItem = {
    id: newId('folder'),
    name: uniqueName(name?.trim() || 'New Folder', items),
    type: 'folder',
    icon,
    iconName: 'Folder',
    bgColor: 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 border border-amber-400/30',
    contents: [],
  };
  return { items: [...items, created], created };
}

export function createTextDocument(
  items: DesktopList,
  icon: DesktopItem['icon'],
  name?: string,
): { items: DesktopList; created: DesktopItem } {
  const created: DesktopItem = {
    id: newId('doc'),
    name: uniqueName(name?.trim() || 'New Document', items),
    type: 'app',
    appId: 'notepad',
    icon,
    iconName: 'Layers',
    bgColor: 'bg-gradient-to-br from-sky-600 via-blue-700 to-zinc-900 border border-sky-500/30',
    notepadInitialContent: '',
  };
  return { items: [...items, created], created };
}

/** Rename in place. Returns the list unchanged if the name is blank or the
 *  item is gone, so a cancelled prompt can call this safely. */
export function renameItem(
  items: DesktopList,
  id: string,
  nextName: string,
): DesktopList {
  const trimmed = nextName.trim();
  if (!trimmed) return items;
  return items.map((i) => (i && i.id === id ? { ...i, name: trimmed } : i));
}

/**
 * Remove an item. Root positions collapse to null rather than shifting, to
 * preserve the grid layout the user arranged — the same "locked grid"
 * behavior the existing delete-by-name path already relies on.
 */
export function deleteItem(items: DesktopList, id: string): DesktopList {
  return items.map((i) => (i && i.id === id ? null : i));
}

export type SortKey = 'name' | 'type';

/** Sort visible items, dropping the layout gaps (a real desktop's "sort by"
 *  compacts too). Folders lead in type order, matching file managers. */
export function sortItems(items: DesktopList, key: SortKey): DesktopList {
  const present = items.filter((i): i is DesktopItem => !!i);
  const sorted = [...present].sort((a, b) => {
    if (key === 'type' && a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
  return sorted;
}

/** Move an item into a folder (the payoff of having folders at all). */
export function moveIntoFolder(
  items: DesktopList,
  itemId: string,
  folderId: string,
): DesktopList {
  const moving = items.find((i) => i && i.id === itemId);
  if (!moving || itemId === folderId) return items;
  return items
    .map((i) => {
      if (!i) return i;
      if (i.id === folderId && i.type === 'folder') {
        return { ...i, contents: [...(i.contents || []), moving] };
      }
      return i;
    })
    .map((i) => (i && i.id === itemId ? null : i));
}

/** Duplicate — "Copy" then "Paste" of the same item, as one step. */
export function duplicateItem(
  items: DesktopList,
  source: DesktopItem,
): { items: DesktopList; created: DesktopItem } {
  const created: DesktopItem = {
    ...source,
    id: newId(source.type),
    name: uniqueName(`${source.name} copy`, items),
    contents: source.contents ? [...source.contents] : undefined,
  };
  return { items: [...items, created], created };
}
