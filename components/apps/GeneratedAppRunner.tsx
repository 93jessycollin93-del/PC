/**
 * GeneratedAppRunner — the one hand-written renderer every generated app
 * runs through. A generator (src/generative/generateAppSpec.ts) only ever
 * produces a GeneratedAppSpec, never code, so this switch over `kind` is
 * the entire "sandbox": there is nothing here that executes anything the
 * spec supplied, only data driving a fixed set of real, working UIs.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Minus, RotateCcw, Play, Pause, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import type {
  GeneratedAppSpec, CounterConfig, ChecklistConfig, TimerConfig, FlashcardsConfig, NotesConfig,
} from '../../src/generative/appSpec';
import { loadGeneratedAppState, saveGeneratedAppState } from '../../src/generative/generatedAppState';

interface GeneratedAppRunnerProps {
  itemId: string;
  spec: GeneratedAppSpec;
}

const shell = 'h-full w-full bg-zinc-950 text-zinc-100 flex flex-col';
const header = 'px-4 py-3 border-b border-zinc-800 flex items-center gap-2';
const body = 'flex-1 overflow-y-auto p-4';

const CounterRunner: React.FC<{ itemId: string; config: CounterConfig }> = ({ itemId, config }) => {
  const [value, setValue] = useState(() => loadGeneratedAppState<{ value: number }>(itemId)?.value ?? config.initial);
  useEffect(() => { saveGeneratedAppState(itemId, { value }); }, [itemId, value]);

  return (
    <div className={shell}>
      <div className={header}><Sparkles size={15} className="text-amber-400" /><span className="text-sm font-medium">{config.label}</span></div>
      <div className={body + ' flex flex-col items-center justify-center gap-6'}>
        <div className="text-6xl font-mono tabular-nums">{value}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setValue(v => v - config.step)} className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700" aria-label="Decrease">
            <Minus size={20} />
          </button>
          <button onClick={() => setValue(config.initial)} className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700" aria-label="Reset">
            <RotateCcw size={16} />
          </button>
          <button onClick={() => setValue(v => v + config.step)} className="p-3 rounded-full bg-amber-600 hover:bg-amber-500 text-black" aria-label="Increase">
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ChecklistRunner: React.FC<{ itemId: string; config: ChecklistConfig }> = ({ itemId, config }) => {
  const [checked, setChecked] = useState<Record<number, boolean>>(
    () => loadGeneratedAppState<Record<number, boolean>>(itemId) ?? {},
  );
  useEffect(() => { saveGeneratedAppState(itemId, checked); }, [itemId, checked]);
  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className={shell}>
      <div className={header}>
        <Sparkles size={15} className="text-amber-400" />
        <span className="text-sm font-medium">{config.title}</span>
        <span className="ml-auto text-xs text-zinc-500">{doneCount}/{config.items.length}</span>
      </div>
      <div className={body}>
        <ul className="space-y-2">
          {config.items.map((item, i) => (
            <li key={i}>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className={checked[i] ? 'line-through text-zinc-500' : 'text-zinc-200'}>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const TimerRunner: React.FC<{ itemId: string; config: TimerConfig }> = ({ itemId, config }) => {
  const [remaining, setRemaining] = useState(config.durationSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) { setRunning(false); return; }
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [running, remaining]);

  return (
    <div className={shell}>
      <div className={header}><Sparkles size={15} className="text-amber-400" /><span className="text-sm font-medium">{config.label}</span></div>
      <div className={body + ' flex flex-col items-center justify-center gap-6'}>
        <div className="text-6xl font-mono tabular-nums">{formatTime(remaining)}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning(r => !r)}
            disabled={remaining <= 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black disabled:opacity-40"
          >
            {running ? <Pause size={16} /> : <Play size={16} />} {running ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={() => { setRunning(false); setRemaining(config.durationSeconds); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};

const FlashcardsRunner: React.FC<{ itemId: string; config: FlashcardsConfig }> = ({ config }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = config.cards[index];

  return (
    <div className={shell}>
      <div className={header}>
        <Sparkles size={15} className="text-amber-400" />
        <span className="text-sm font-medium">{config.title}</span>
        <span className="ml-auto text-xs text-zinc-500">{index + 1}/{config.cards.length}</span>
      </div>
      <div className={body + ' flex flex-col items-center justify-center gap-6'}>
        <button
          onClick={() => setFlipped(f => !f)}
          className="w-full max-w-sm min-h-[140px] rounded-xl border border-zinc-700 bg-zinc-900 hover:border-amber-500/50 flex items-center justify-center p-6 text-center text-lg"
        >
          {flipped ? card.back : card.front}
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setIndex(i => (i - 1 + config.cards.length) % config.cards.length); setFlipped(false); }}
            className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700"
            aria-label="Previous card"
          >
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setFlipped(f => !f)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs">
            <RefreshCw size={13} /> Flip
          </button>
          <button
            onClick={() => { setIndex(i => (i + 1) % config.cards.length); setFlipped(false); }}
            className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700"
            aria-label="Next card"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const NotesRunner: React.FC<{ itemId: string; config: NotesConfig }> = ({ itemId, config }) => {
  const [content, setContent] = useState(() => loadGeneratedAppState<{ content: string }>(itemId)?.content ?? config.initialContent);
  useEffect(() => { saveGeneratedAppState(itemId, { content }); }, [itemId, content]);

  return (
    <div className={shell}>
      <div className={header}><Sparkles size={15} className="text-amber-400" /><span className="text-sm font-medium">{config.title}</span></div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        className="flex-1 bg-transparent p-4 text-sm text-zinc-200 resize-none outline-none font-mono"
        placeholder="Start typing…"
      />
    </div>
  );
};

export const GeneratedAppRunner: React.FC<GeneratedAppRunnerProps> = ({ itemId, spec }) => {
  switch (spec.kind) {
    case 'counter': return <CounterRunner itemId={itemId} config={spec.config} />;
    case 'checklist': return <ChecklistRunner itemId={itemId} config={spec.config} />;
    case 'timer': return <TimerRunner itemId={itemId} config={spec.config} />;
    case 'flashcards': return <FlashcardsRunner itemId={itemId} config={spec.config} />;
    case 'notes': return <NotesRunner itemId={itemId} config={spec.config} />;
    default: {
      // Exhaustiveness guard: a new GeneratedAppKind without a case here is a
      // build-time error via this line, not a silent blank window at runtime.
      const _exhaustive: never = spec;
      return _exhaustive;
    }
  }
};
