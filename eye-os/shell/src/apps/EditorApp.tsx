import * as React from 'react';

import { bus, notify } from '../kernel/bus';
import { vfs } from '../kernel/vfs';

/**
 * A plain text editor.
 *
 * It learns which file to open from the bus, both ways: a retained payload
 * covers the case where Files published the path before this chunk finished
 * loading, and a live subscription covers every open after that.
 */
export default function EditorApp() {
  const [path, setPath] = React.useState('/home/notes.txt');
  const [text, setText] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [status, setStatus] = React.useState('');

  const load = React.useCallback(async (target: string) => {
    try {
      const contents = await vfs().read(target);
      setText(contents ?? '');
      setPath(target);
      setDirty(false);
      setStatus(contents === null ? 'New file' : `Loaded ${contents.length} B`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  React.useEffect(() => {
    const pending = bus.latest('open-file');
    if (pending) {
      bus.clearLatest('open-file');
      void load(pending.path);
    } else {
      void load(path);
    }
    // Deliberately once, on mount: later opens arrive on the subscription
    // below, and re-running this would discard unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(
    () =>
      bus.on('open-file', (payload) => {
        bus.clearLatest('open-file');
        void load(payload.path);
      }),
    [load],
  );

  const save = React.useCallback(async () => {
    try {
      await vfs().write(path, text);
      setDirty(false);
      setStatus(`Saved ${text.length} B`);
      notify('success', 'Editor', `Saved ${path}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus(message);
      notify('error', 'Editor', message);
    }
  }, [path, text]);

  // Ctrl/Cmd-S saves, as everywhere else.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div className="editor" onKeyDown={onKeyDown}>
      <div className="editor__bar">
        <input
          className="input editor__path"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          spellCheck={false}
          aria-label="File path"
        />
        <button className="btn" onClick={() => void load(path)}>
          Open
        </button>
        <button className="btn btn--accent" onClick={() => void save()}>
          Save
        </button>
      </div>
      <textarea
        className="editor__area"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setDirty(true);
        }}
        spellCheck={false}
        aria-label="File contents"
      />
      <div className="editor__status">
        <span>{dirty ? '● unsaved' : '○ saved'}</span>
        <span className="editor__status-msg">{status}</span>
      </div>
    </div>
  );
}
