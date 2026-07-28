import { describe, it, expect, beforeEach } from 'vitest';
import {
  uniqueName, createFolder, createTextDocument, renameItem, deleteItem,
  sortItems, moveIntoFolder, duplicateItem, serializeForExport, exportFilename,
  parseImport, saveUserItems, loadUserItems, isUserCreated, USER_ITEMS_KEY,
  EXPORT_FORMAT,
} from './desktopOps';
import type { DesktopItem } from '../../types';

// Icons are React components at runtime; the ops layer only ever stores and
// passes them through, so a marked stand-in is enough and keeps these tests
// free of React.
const Icon: any = Object.assign(() => null, { displayName: 'Layers' });
const PlainIcon: any = () => null;

const app = (id: string, name: string): DesktopItem =>
  ({ id, name, type: 'app', icon: PlainIcon, appId: id });
const folder = (id: string, name: string, contents: DesktopItem[] = []): DesktopItem =>
  ({ id, name, type: 'folder', icon: PlainIcon, contents });

beforeEach(() => localStorage.clear());

describe('uniqueName', () => {
  it('leaves a free name alone', () => {
    expect(uniqueName('New Folder', [app('a', 'Mail')])).toBe('New Folder');
  });

  it('disambiguates like a file manager instead of duplicating', () => {
    const items = [app('a', 'New Folder'), app('b', 'New Folder (2)')];
    expect(uniqueName('New Folder', items)).toBe('New Folder (3)');
  });

  it('compares case-insensitively, since two names differing only by case read as the same', () => {
    expect(uniqueName('new folder', [app('a', 'New Folder')])).toBe('new folder (2)');
  });

  it('ignores layout gaps', () => {
    expect(uniqueName('X', [null, null])).toBe('X');
  });
});

describe('createFolder / createTextDocument', () => {
  it('creates a folder that is empty, user-owned, and appended', () => {
    const { items, created } = createFolder([app('a', 'Mail')], Icon);
    expect(created.type).toBe('folder');
    expect(created.contents).toEqual([]);
    expect(isUserCreated(created)).toBe(true);
    expect(items).toHaveLength(2);
    expect(items[1]).toBe(created);
  });

  it('does not collide when several are made in a row', () => {
    let list: (DesktopItem | null)[] = [];
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = createFolder(list, Icon);
      list = r.items;
      names.push(r.created.name);
    }
    expect(new Set(names).size).toBe(3);
  });

  it('makes a text document that opens in the notepad', () => {
    const { created } = createTextDocument([], Icon);
    expect(created.appId).toBe('notepad');
    expect(created.notepadInitialContent).toBe('');
  });

  it('honors an explicit name', () => {
    expect(createFolder([], Icon, '  Projects  ').created.name).toBe('Projects');
  });
});

describe('renameItem', () => {
  const items = [app('a', 'Mail'), app('b', 'Notes')];

  it('renames the target and leaves the rest alone', () => {
    const next = renameItem(items, 'a', 'Inbox');
    expect(next[0]!.name).toBe('Inbox');
    expect(next[1]!.name).toBe('Notes');
  });

  it('refuses a blank name, so a cancelled prompt is a no-op', () => {
    expect(renameItem(items, 'a', '   ')).toBe(items);
  });

  it('trims', () => {
    expect(renameItem(items, 'a', '  Inbox  ')[0]!.name).toBe('Inbox');
  });
});

describe('deleteItem', () => {
  it('leaves a null in place rather than shifting, preserving the arranged grid', () => {
    const next = deleteItem([app('a', 'A'), app('b', 'B'), app('c', 'C')], 'b');
    expect(next).toHaveLength(3);
    expect(next[1]).toBeNull();
    expect(next[2]!.id).toBe('c');
  });
});

describe('sortItems', () => {
  const items = [app('c', 'Cherry'), folder('f', 'Zebra folder'), null, app('a', 'apple')];

  it('sorts by name case-insensitively and drops gaps', () => {
    const sorted = sortItems(items, 'name').map(i => i!.name);
    expect(sorted).toEqual(['apple', 'Cherry', 'Zebra folder']);
  });

  it('puts folders first when sorting by type, as file managers do', () => {
    expect(sortItems(items, 'type')[0]!.type).toBe('folder');
  });

  it('orders numerically so 10 follows 9', () => {
    const nums = [app('b', 'Item 10'), app('a', 'Item 9')];
    expect(sortItems(nums, 'name').map(i => i!.name)).toEqual(['Item 9', 'Item 10']);
  });
});

describe('moveIntoFolder', () => {
  it('puts the item inside and clears its old slot', () => {
    const next = moveIntoFolder([app('a', 'Mail'), folder('f', 'Docs')], 'a', 'f');
    const target = next.find(i => i?.id === 'f')!;
    expect(target.contents).toHaveLength(1);
    expect(target.contents![0].id).toBe('a');
    expect(next.find(i => i?.id === 'a')).toBeUndefined();
  });

  it('refuses to move a folder into itself', () => {
    const items = [folder('f', 'Docs')];
    expect(moveIntoFolder(items, 'f', 'f')).toBe(items);
  });

  it('is a no-op when the item is gone', () => {
    const items = [folder('f', 'Docs')];
    expect(moveIntoFolder(items, 'missing', 'f')).toBe(items);
  });
});

describe('duplicateItem', () => {
  it('copies with a new id and a non-colliding name', () => {
    const src = app('a', 'Mail');
    const { created } = duplicateItem([src], src);
    expect(created.id).not.toBe(src.id);
    expect(created.name).toBe('Mail copy');
    expect(isUserCreated(created)).toBe(true);
  });

  it('does not share the contents array with the original', () => {
    const src = folder('f', 'Docs', [app('a', 'A')]);
    const { created } = duplicateItem([src], src);
    created.contents!.push(app('b', 'B'));
    expect(src.contents).toHaveLength(1);
  });
});

describe('export / import round trip', () => {
  it('writes a versioned envelope', () => {
    const parsed = JSON.parse(serializeForExport(app('a', 'Mail')));
    expect(parsed.format).toBe(EXPORT_FORMAT);
    expect(parsed.version).toBe(1);
    expect(parsed.item.name).toBe('Mail');
  });

  it('recovers the icon name from the component, so an export keeps its look', () => {
    // Built-in items carry the icon but no iconName; without the displayName
    // fallback they come back wearing a generic default.
    const parsed = JSON.parse(serializeForExport({ ...app('a', 'Mail'), icon: Icon }));
    expect(parsed.item.iconName).toBe('Layers');
  });

  it('produces a filename that is safe on every OS', () => {
    expect(exportFilename(app('a', 'My App: v2/final'))).toBe('my-app-v2-final.pcapp.json');
  });

  it('round-trips a folder with its contents', () => {
    const src = folder('f', 'Docs', [app('a', 'A'), app('b', 'B')]);
    const result = parseImport(serializeForExport(src), [], () => PlainIcon);
    expect(result.ok).toBe(true);
    expect(result.item!.contents).toHaveLength(2);
    expect(result.item!.contents![0].name).toBe('A');
  });

  it('gives the import a fresh id so re-importing does not collide', () => {
    const src = app('a', 'Mail');
    const text = serializeForExport(src);
    const first = parseImport(text, [src], () => PlainIcon);
    expect(first.item!.id).not.toBe('a');
    expect(first.item!.name).toBe('Mail (2)');
  });

  it('reports bad input instead of throwing, since the file is user-chosen', () => {
    expect(parseImport('not json', [], () => PlainIcon).ok).toBe(false);
    expect(parseImport('{"format":"something-else"}', [], () => PlainIcon).ok).toBe(false);
    expect(parseImport(JSON.stringify({ format: EXPORT_FORMAT, version: 1 }), [], () => PlainIcon).ok).toBe(false);
  });

  it('refuses an export newer than it understands rather than guessing', () => {
    const future = JSON.stringify({ format: EXPORT_FORMAT, version: 99, item: { name: 'X', type: 'app' } });
    const result = parseImport(future, [], () => PlainIcon);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/99/);
  });
});

describe('persistence', () => {
  it('saves only user-created items, since built-ins are re-merged from source', () => {
    const { items } = createFolder([app('builtin', 'Mail')], Icon);
    saveUserItems(items);
    const loaded = loadUserItems(() => PlainIcon);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].type).toBe('folder');
  });

  it('survives a reload with the folder intact', () => {
    const { items, created } = createFolder([], Icon, 'Work');
    saveUserItems(items);
    const loaded = loadUserItems(() => PlainIcon);
    expect(loaded[0].name).toBe('Work');
    expect(loaded[0].id).toBe(created.id);
  });

  it('starts empty on corrupt storage instead of breaking the boot', () => {
    localStorage.setItem(USER_ITEMS_KEY, '{{{ not json');
    expect(loadUserItems(() => PlainIcon)).toEqual([]);
  });

  it('ignores a payload of the wrong shape', () => {
    localStorage.setItem(USER_ITEMS_KEY, '{"not":"an array"}');
    expect(loadUserItems(() => PlainIcon)).toEqual([]);
  });
});
