import * as React from 'react';

import { bus, notify } from '../kernel/bus';
import { APPS } from '../kernel/registry';
import { useWindows } from '../kernel/windows';
import { basename, dirname, normalizePath, vfs } from '../kernel/vfs';
import type { VfsEntry } from '../kernel/types';

/**
 * A file browser over the VFS.
 *
 * Opening a file launches the editor and publishes the path on the bus — this
 * app never imports the editor, and the editor never imports this one. That
 * indirection is the whole point of the bus.
 */
export default function FilesApp() {
  const { openApp } = useWindows();
  const [dir, setDir] = React.useState('/');
  const [entries, setEntries] = React.useState<VfsEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(true);

  const refresh = React.useCallback(async (target: string) => {
    setBusy(true);
    try {
      setEntries(await vfs().list(target));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh(dir);
  }, [dir, refresh]);

  // Any write anywhere in the system refreshes the view — including writes
  // made from the Terminal, which is the visible proof the two share a VFS.
  React.useEffect(() => bus.on('vfs-changed', () => void refresh(dir)), [dir, refresh]);

  const openEntry = (entry: VfsEntry) => {
    if (entry.kind === 'dir') {
      setDir(entry.path);
      return;
    }
    const editor = APPS.find((app) => app.id === 'editor');
    if (editor) openApp(editor);
    bus.emit('open-file', { path: entry.path });
  };

  const createFile = async () => {
    const name = window.prompt('New file name');
    if (!name) return;
    const target = normalizePath(`${dir}/${name}`);
    try {
      if ((await vfs().read(target)) !== null) {
        notify('warning', 'Files', `${basename(target)} already exists`);
        return;
      }
      await vfs().write(target, '');
      notify('success', 'Files', `Created ${basename(target)}`);
    } catch (cause) {
      notify('error', 'Files', cause instanceof Error ? cause.message : String(cause));
    }
  };

  const createDir = async () => {
    const name = window.prompt('New folder name');
    if (!name) return;
    try {
      await vfs().mkdir(normalizePath(`${dir}/${name}`));
      notify('success', 'Files', `Created ${name}/`);
    } catch (cause) {
      notify('error', 'Files', cause instanceof Error ? cause.message : String(cause));
    }
  };

  const removeEntry = async (entry: VfsEntry) => {
    if (!window.confirm(`Delete ${basename(entry.path)}?`)) return;
    try {
      await vfs().remove(entry.path);
      notify('success', 'Files', `Deleted ${basename(entry.path)}`);
    } catch (cause) {
      notify('error', 'Files', cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="files">
      <div className="files__bar">
        <button className="btn" onClick={() => setDir(dirname(dir))} disabled={dir === '/'}>
          ↑ Up
        </button>
        <code className="files__path">{dir}</code>
        <div className="files__spacer" />
        <button className="btn" onClick={createFile}>
          + File
        </button>
        <button className="btn" onClick={createDir}>
          + Folder
        </button>
      </div>

      {error && <div className="files__error">{error}</div>}

      <div className="files__list">
        {busy && entries.length === 0 && <div className="files__empty">Reading…</div>}
        {!busy && entries.length === 0 && !error && (
          <div className="files__empty">This folder is empty.</div>
        )}
        {entries.map((entry) => (
          <div key={entry.path} className="files__row">
            <button className="files__open" onDoubleClick={() => openEntry(entry)} onClick={() => openEntry(entry)}>
              <span className="files__glyph" aria-hidden="true">
                {entry.kind === 'dir' ? '🗀' : '🗎'}
              </span>
              <span className="files__name">{basename(entry.path)}</span>
              <span className="files__meta">
                {entry.kind === 'dir' ? '—' : `${entry.size} B`}
              </span>
            </button>
            <button
              className="btn btn--danger"
              onClick={() => removeEntry(entry)}
              aria-label={`Delete ${basename(entry.path)}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
