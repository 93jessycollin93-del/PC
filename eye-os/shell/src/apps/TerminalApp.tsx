import * as React from 'react';

import { notify } from '../kernel/bus';
import { basename, dirname, normalizePath, vfs } from '../kernel/vfs';

/**
 * A shell over the VFS. The commands are real: they call the same interface
 * the Files app and the editor call, so anything written here is immediately
 * visible there (and on disk, when the host backend is active).
 */

interface Line {
  kind: 'input' | 'output' | 'error';
  text: string;
}

const HELP = `Commands
  ls [dir]           list a directory
  cd <dir>           change directory
  pwd                print working directory
  cat <file>         print a file
  write <file> <…>   write text to a file (overwrites)
  append <file> <…>  append a line to a file
  mkdir <dir>        create a directory
  rm <path>          remove a file
  echo <…>           print text
  df                 which storage backend is mounted
  clear              clear the screen
  help               this list`;

export default function TerminalApp() {
  const [cwd, setCwd] = React.useState('/home');
  const [lines, setLines] = React.useState<Line[]>([
    { kind: 'output', text: `${vfs().backend} mounted. Type "help".` },
  ]);
  const [input, setInput] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Keep the newest line in view as output accumulates.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const resolve = React.useCallback(
    (path: string) => normalizePath(path.startsWith('/') ? path : `${cwd}/${path}`),
    [cwd],
  );

  const run = React.useCallback(
    async (raw: string): Promise<Line[]> => {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      const [command, ...args] = trimmed.split(/\s+/);
      const rest = trimmed.slice(command.length).trim();
      const fs = vfs();

      switch (command) {
        case 'help':
          return [{ kind: 'output', text: HELP }];

        case 'pwd':
          return [{ kind: 'output', text: cwd }];

        case 'df':
          return [
            {
              kind: 'output',
              text: `${fs.backend}\ndurable: ${fs.durable ? 'yes — survives reboot' : 'no — lives in the browser profile'}`,
            },
          ];

        case 'echo':
          return [{ kind: 'output', text: rest }];

        case 'clear':
          setLines([]);
          return [];

        case 'cd': {
          const target = resolve(args[0] ?? '/home');
          const entries = await fs.list(dirname(target));
          const found = entries.find((e) => e.path === target && e.kind === 'dir');
          if (!found && target !== '/') {
            return [{ kind: 'error', text: `cd: no such directory: ${target}` }];
          }
          setCwd(target);
          return [];
        }

        case 'ls': {
          const target = resolve(args[0] ?? '.');
          const entries = await fs.list(target);
          if (entries.length === 0) return [{ kind: 'output', text: '(empty)' }];
          return [
            {
              kind: 'output',
              text: entries
                .map(
                  (e) =>
                    `${e.kind === 'dir' ? 'd' : '-'}  ${String(e.size).padStart(7)}  ${basename(e.path)}${e.kind === 'dir' ? '/' : ''}`,
                )
                .join('\n'),
            },
          ];
        }

        case 'cat': {
          if (!args[0]) return [{ kind: 'error', text: 'cat: missing operand' }];
          const contents = await fs.read(resolve(args[0]));
          return contents === null
            ? [{ kind: 'error', text: `cat: no such file: ${resolve(args[0])}` }]
            : [{ kind: 'output', text: contents }];
        }

        case 'write':
        case 'append': {
          if (!args[0]) return [{ kind: 'error', text: `${command}: missing operand` }];
          const target = resolve(args[0]);
          const body = rest.slice(args[0].length).trim();
          const existing = command === 'append' ? ((await fs.read(target)) ?? '') : '';
          const next = command === 'append' && existing ? `${existing}\n${body}` : body;
          await fs.write(target, next);
          return [{ kind: 'output', text: `wrote ${next.length} bytes to ${target}` }];
        }

        case 'mkdir': {
          if (!args[0]) return [{ kind: 'error', text: 'mkdir: missing operand' }];
          await fs.mkdir(resolve(args[0]));
          return [{ kind: 'output', text: `created ${resolve(args[0])}` }];
        }

        case 'rm': {
          if (!args[0]) return [{ kind: 'error', text: 'rm: missing operand' }];
          await fs.remove(resolve(args[0]));
          return [{ kind: 'output', text: `removed ${resolve(args[0])}` }];
        }

        default:
          return [{ kind: 'error', text: `${command}: command not found` }];
      }
    },
    [cwd, resolve],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const entered = input;
    setInput('');
    setHistoryIndex(null);
    if (entered.trim()) setHistory((prev) => [...prev, entered]);
    setLines((prev) => [...prev, { kind: 'input', text: `${cwd} $ ${entered}` }]);
    try {
      const output = await run(entered);
      if (output.length) setLines((prev) => [...prev, ...output]);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setLines((prev) => [...prev, { kind: 'error', text }]);
      notify('error', 'Terminal', text);
    }
  };

  // Up/Down walk the command history, as in any shell.
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (history.length === 0) return;
    event.preventDefault();
    const next =
      event.key === 'ArrowUp'
        ? Math.max(0, (historyIndex ?? history.length) - 1)
        : Math.min(history.length, (historyIndex ?? history.length) + 1);
    setHistoryIndex(next);
    setInput(next >= history.length ? '' : history[next]);
  };

  return (
    <div className="term" onClick={() => inputRef.current?.focus()}>
      <div className="term__scroll" ref={scrollRef}>
        {lines.map((line, index) => (
          <pre key={index} className={`term__line term__line--${line.kind}`}>
            {line.text}
          </pre>
        ))}
      </div>
      <form className="term__prompt" onSubmit={submit}>
        <span className="term__cwd">{cwd} $</span>
        <input
          ref={inputRef}
          className="term__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoFocus
          aria-label="Terminal input"
        />
      </form>
    </div>
  );
}
