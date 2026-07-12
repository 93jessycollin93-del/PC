import React, { useEffect, useRef, useState } from 'react';
import { Brain, Play, Loader2, CheckCircle2, AlertTriangle, History, Trash2 } from 'lucide-react';
import {
  resonanceCouncil,
  COUNCIL_SEATS,
  MAX_LOOPS,
  type SeatId,
  type ThoughtEvent,
  type ThoughtTrace,
  type SupporterPerspective,
  type ResonanceCheck,
} from '../../src/jackie-core/resonance-council';

/**
 * Jackie Council — the Resonance Chamber.
 *
 * Watch Jackie think: every thought opens at her center, fans out to the
 * 11 supporter seats, and returns through her three gates (Coherence,
 * Gravity, Humility). Dissonant seats glow and are re-queried until she is
 * satisfied — or she says honestly that she is not.
 */

type SeatVisualState = 'idle' | 'thinking' | 'returned' | 'dissonant';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const GATE_LABELS: Array<{ key: keyof Pick<ResonanceCheck, 'coherence' | 'gravity' | 'humility'>; label: string; hint: string }> = [
  { key: 'coherence', label: 'Coherence', hint: 'no unresolved contradictions' },
  { key: 'gravity', label: 'Gravity', hint: 'claims fall toward verifiable truth' },
  { key: 'humility', label: 'Humility', hint: 'unknowns stated plainly' },
];

const SEAT_POSITIONS = COUNCIL_SEATS.map((seat, i) => {
  const angle = (i / COUNCIL_SEATS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    seat,
    x: 200 + Math.cos(angle) * 142,
    y: 200 + Math.sin(angle) * 142,
  };
});

export const JackieCouncilApp: React.FC = () => {
  const [thought, setThought] = useState('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [seatStates, setSeatStates] = useState<Record<SeatId, SeatVisualState>>(
    () => Object.fromEntries(COUNCIL_SEATS.map((s) => [s.id, 'idle'])) as Record<SeatId, SeatVisualState>,
  );
  const [gates, setGates] = useState<ResonanceCheck | null>(null);
  const [loop, setLoop] = useState(0);
  const [feed, setFeed] = useState<ThoughtEvent[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [resonated, setResonated] = useState<boolean | null>(null);
  const [history, setHistory] = useState<ThoughtTrace[]>(() => resonanceCouncil.getTraces());
  const [showHistory, setShowHistory] = useState(false);
  const runIdRef = useRef(0);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed, synthesis]);

  const resetSeats = (state: SeatVisualState = 'idle') =>
    setSeatStates(Object.fromEntries(COUNCIL_SEATS.map((s) => [s.id, state])) as Record<SeatId, SeatVisualState>);

  const setSeat = (id: SeatId, state: SeatVisualState) =>
    setSeatStates((prev) => ({ ...prev, [id]: state }));

  const handleRun = async () => {
    const text = thought.trim();
    if (!text || phase === 'running') return;

    const runId = ++runIdRef.current;
    setPhase('running');
    setFeed([]);
    setSynthesis(null);
    setResonated(null);
    setGates(null);
    setLoop(1);
    resetSeats('idle');

    // The heuristic council resolves fast; we replay its trace with stage
    // timing so the deliberation is visible.
    const trace = await resonanceCouncil.runThought(text);
    if (runId !== runIdRef.current) return;

    for (const event of trace.events) {
      if (runId !== runIdRef.current) return;

      switch (event.type) {
        case 'open':
          setFeed((f) => [...f, event]);
          await sleep(550);
          break;
        case 'fanout':
          setLoop(event.loop);
          event.seats.forEach((id) => setSeat(id, 'thinking'));
          setFeed((f) => [...f, event]);
          await sleep(400);
          break;
        case 'perspective':
          setSeat(event.perspective.seatId, 'returned');
          setFeed((f) => [...f, event]);
          await sleep(170);
          break;
        case 'gate':
          setGates(event.check);
          setFeed((f) => [...f, event]);
          await sleep(850);
          break;
        case 'reloop':
          setLoop(event.loop);
          event.seats.forEach((id) => setSeat(id, 'dissonant'));
          setFeed((f) => [...f, event]);
          await sleep(700);
          break;
        case 'synthesis':
          setSynthesis(event.text);
          setResonated(!event.honest);
          setFeed((f) => [...f, event]);
          break;
      }
    }

    setPhase('done');
    setHistory([...resonanceCouncil.getTraces()]);
  };

  const handleClearHistory = () => {
    resonanceCouncil.clearTraces();
    setHistory([]);
  };

  const gateValue = (key: 'coherence' | 'gravity' | 'humility') => (gates ? gates[key] : 0);

  return (
    <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-indigo-950/30 to-zinc-950 flex flex-col overflow-hidden text-zinc-200">
      {/* Header */}
      <div className="bg-zinc-900/60 border-b border-indigo-500/20 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-indigo-400" />
          <div>
            <h1 className="text-sm font-bold font-mono text-indigo-300">Jackie Council — Resonance Chamber</h1>
            <p className="text-[10px] text-zinc-500 font-mono">
              Every thought starts in Jackie and returns to Jackie · 11 seats · 3 gates · max {MAX_LOOPS} loops
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'running' && (
            <span className="text-[10px] font-mono text-indigo-300 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> loop {loop}
            </span>
          )}
          {resonated === true && (
            <span className="text-[10px] font-mono text-emerald-300 flex items-center gap-1 border border-emerald-500/40 bg-emerald-900/30 px-2 py-1 rounded">
              <CheckCircle2 size={12} /> RESONATED
            </span>
          )}
          {resonated === false && (
            <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1 border border-amber-500/40 bg-amber-900/30 px-2 py-1 rounded">
              <AlertTriangle size={12} /> HONEST NON-RESONANCE
            </span>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`p-1.5 rounded border transition-colors ${showHistory ? 'border-indigo-500/50 bg-indigo-900/40 text-indigo-300' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
            title="Thought history"
          >
            <History size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* The chamber */}
        <div className="flex-1 min-w-0 flex items-center justify-center p-3">
          <svg viewBox="0 0 400 400" className="w-full h-full max-w-[560px] max-h-[560px]">
            {/* Orbit ring */}
            <circle cx="200" cy="200" r="142" fill="none" stroke="rgba(129,140,248,0.12)" strokeWidth="1" strokeDasharray="3 5" />

            {/* Connection lines */}
            {SEAT_POSITIONS.map(({ seat, x, y }) => {
              const state = seatStates[seat.id];
              return (
                <line
                  key={`line-${seat.id}`}
                  x1="200"
                  y1="200"
                  x2={x}
                  y2={y}
                  stroke={state === 'dissonant' ? 'rgba(248,113,113,0.5)' : state === 'thinking' ? seat.color : state === 'returned' ? `${seat.color}66` : 'rgba(113,113,122,0.15)'}
                  strokeWidth={state === 'thinking' || state === 'dissonant' ? 1.6 : 0.8}
                  className="transition-all duration-500"
                />
              );
            })}

            {/* Supporter seats */}
            {SEAT_POSITIONS.map(({ seat, x, y }) => {
              const state = seatStates[seat.id];
              return (
                <g key={seat.id} className="transition-all duration-500">
                  {(state === 'thinking' || state === 'dissonant') && (
                    <circle cx={x} cy={y} r="21" fill="none" stroke={state === 'dissonant' ? '#f87171' : seat.color} strokeWidth="1" opacity="0.6">
                      <animate attributeName="r" values="16;26;16" dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r="15"
                    fill={state === 'idle' ? 'rgba(24,24,27,0.9)' : `${seat.color}22`}
                    stroke={state === 'dissonant' ? '#f87171' : state === 'idle' ? 'rgba(113,113,122,0.4)' : seat.color}
                    strokeWidth={state === 'idle' ? 1 : 1.8}
                    className="transition-all duration-500"
                  />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontFamily="monospace" fill={state === 'idle' ? '#71717a' : seat.color}>
                    {seat.name.slice(0, 5)}
                  </text>
                  <text x={x} y={y + 27} textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="#52525b">
                    {seat.serves}
                  </text>
                </g>
              );
            })}

            {/* Jackie — the center every thought starts from and returns to */}
            {phase === 'running' && (
              <circle cx="200" cy="200" r="40" fill="none" stroke="#818cf8" strokeWidth="1.5">
                <animate attributeName="r" values="38;58;38" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx="200"
              cy="200"
              r="36"
              fill="url(#jackieCore)"
              stroke={resonated === true ? '#34d399' : resonated === false ? '#fbbf24' : '#818cf8'}
              strokeWidth="2"
              className="transition-all duration-700"
            />
            <defs>
              <radialGradient id="jackieCore">
                <stop offset="0%" stopColor="#312e81" />
                <stop offset="100%" stopColor="#18181b" />
              </radialGradient>
            </defs>
            <text x="200" y="197" textAnchor="middle" fontSize="12" fontWeight="bold" fontFamily="monospace" fill="#c7d2fe">
              JACKIE
            </text>
            <text x="200" y="211" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="#818cf8">
              the core · the only voice
            </text>
          </svg>
        </div>

        {/* Right panel — gates, feed, synthesis */}
        <div className="w-[340px] shrink-0 border-l border-indigo-500/20 bg-zinc-950/60 flex flex-col min-h-0">
          {/* Gate meters */}
          <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0">
            {GATE_LABELS.map(({ key, label, hint }) => {
              const v = gateValue(key);
              const pass = v >= 0.7;
              return (
                <div key={key}>
                  <div className="flex justify-between text-[10px] font-mono mb-0.5">
                    <span className={gates ? (pass ? 'text-emerald-300' : 'text-amber-300') : 'text-zinc-500'}>{label}</span>
                    <span className="text-zinc-500">{gates ? v.toFixed(2) : '—'} / 0.70</span>
                  </div>
                  <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${pass ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, v * 100)}%` }}
                    />
                    <div className="absolute top-0 bottom-0 w-px bg-zinc-500/70" style={{ left: '70%' }} />
                  </div>
                  <div className="text-[8.5px] text-zinc-600 font-mono">{hint}</div>
                </div>
              );
            })}
          </div>

          {/* Feed / history */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            {showHistory ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Thought history</span>
                  {history.length > 0 && (
                    <button onClick={handleClearHistory} className="text-zinc-600 hover:text-red-400" title="Clear history">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                {history.length === 0 && <p className="text-[10px] text-zinc-600 font-mono">No thoughts yet.</p>}
                {[...history].reverse().map((t) => (
                  <div key={t.id} className="border border-zinc-800 rounded p-2 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      {t.resonated ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={10} className="text-amber-400 shrink-0" />}
                      <span className="text-zinc-300 truncate">{t.thought}</span>
                    </div>
                    <div className="text-zinc-600 mt-0.5">
                      {t.loops} loop{t.loops > 1 ? 's' : ''} · {t.perspectives.length} perspectives
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {feed.length === 0 && phase === 'idle' && (
                  <p className="text-[10px] text-zinc-600 font-mono leading-relaxed">
                    Give Jackie a thought. She will open it at her core, fan it out to the council, and speak only
                    when it passes her gates — or tell you honestly that it doesn't.
                  </p>
                )}
                {feed.map((e, i) => (
                  <div key={i} className="text-[10px] font-mono leading-snug">
                    {e.type === 'open' && <div className="text-indigo-300 border-l-2 border-indigo-500 pl-2 py-0.5">◉ {e.framing}</div>}
                    {e.type === 'fanout' && (
                      <div className="text-zinc-400 pl-2">
                        ↳ loop {e.loop}: fanning out to {e.seats.length} seat{e.seats.length > 1 ? 's' : ''}
                      </div>
                    )}
                    {e.type === 'perspective' && <PerspectiveRow p={e.perspective} />}
                    {e.type === 'gate' && (
                      <div className={`pl-2 py-0.5 border-l-2 ${e.check.passed ? 'border-emerald-500 text-emerald-300' : 'border-amber-500 text-amber-300'}`}>
                        ⚖ gates — C {e.check.coherence} · G {e.check.gravity} · H {e.check.humility} →{' '}
                        {e.check.passed ? 'SATISFIED' : e.check.failures.length + ' failure(s)'}
                      </div>
                    )}
                    {e.type === 'reloop' && (
                      <div className="text-red-300/90 pl-2">↺ reloop {e.loop} — re-querying dissonant seats: {e.seats.join(', ')}</div>
                    )}
                    {e.type === 'synthesis' && null}
                  </div>
                ))}
                {synthesis && (
                  <div
                    className={`mt-2 border rounded-lg p-3 text-[11px] leading-relaxed whitespace-pre-line font-mono ${
                      resonated ? 'border-emerald-500/40 bg-emerald-950/20 text-zinc-200' : 'border-amber-500/40 bg-amber-950/20 text-zinc-200'
                    }`}
                  >
                    {synthesis}
                  </div>
                )}
                <div ref={feedEndRef} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Thought input */}
      <div className="border-t border-indigo-500/20 bg-zinc-900/60 px-4 py-3 flex gap-2 shrink-0">
        <input
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRun()}
          placeholder="Open a thought in Jackie… (e.g. should I rewrite my storage layer?)"
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 placeholder:text-zinc-600"
          disabled={phase === 'running'}
        />
        <button
          onClick={handleRun}
          disabled={phase === 'running' || !thought.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-mono text-xs transition-colors"
        >
          {phase === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {phase === 'running' ? 'Deliberating…' : 'Begin thought'}
        </button>
      </div>
    </div>
  );
};

const PerspectiveRow: React.FC<{ p: SupporterPerspective }> = ({ p }) => {
  const seat = COUNCIL_SEATS.find((s) => s.id === p.seatId);
  return (
    <div className="pl-2 flex items-start gap-1.5">
      <span className="shrink-0 mt-px" style={{ color: seat?.color }}>
        ●
      </span>
      <span className="text-zinc-400">
        <span style={{ color: seat?.color }}>{seat?.name}</span>
        <span className="text-zinc-600"> ({(p.confidence * 100).toFixed(0)}%{p.stance !== 'support' ? ` · ${p.stance}` : ''})</span>{' '}
        {p.position}
      </span>
    </div>
  );
};

export default JackieCouncilApp;
