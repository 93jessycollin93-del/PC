import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Code2, BarChart3, Sparkles, Smartphone, Tablet, Monitor, Sun, Moon, Columns2, RefreshCw, Dices } from 'lucide-react';

type Mode = 'design' | 'data' | 'motion';
type Device = 'phone' | 'tablet' | 'desktop';
type Scene = 'constellation' | 'orbit' | 'waves';

interface UIStudioProps {
  onClose: () => void;
}

const DEFAULT_DESIGN_CODE = `<div class="card">
  <div class="badge">PC OS</div>
  <h1>Live UI Studio</h1>
  <p>Edit this code and watch it render instantly — on every device frame.</p>
  <button onclick="this.textContent='Tapped! ' + (++window.n||(window.n=1))">
    Tap me
  </button>
</div>
<style>
  body { display:grid; place-items:center; min-height:95vh; margin:0;
         font-family:-apple-system, system-ui, sans-serif; }
  .card { padding:2rem; border-radius:1.25rem; max-width:320px;
          background:var(--card-bg); color:var(--fg);
          box-shadow:0 10px 40px rgba(0,0,0,.25); text-align:center; }
  .badge { display:inline-block; font-size:.7rem; letter-spacing:.1em;
           padding:.25rem .6rem; border-radius:999px;
           background:#3b82f6; color:#fff; margin-bottom:.75rem; }
  h1 { font-size:1.4rem; margin:.25rem 0; }
  p { opacity:.7; font-size:.9rem; }
  button { margin-top:1rem; padding:.6rem 1.4rem; border:0; cursor:pointer;
           border-radius:.75rem; background:#3b82f6; color:#fff;
           font-size:.9rem; font-weight:600; }
  button:active { transform:scale(.96); }
</style>`;

const DEFAULT_DATA_CODE = `[
  { "label": "Mon", "value": 12 },
  { "label": "Tue", "value": 28 },
  { "label": "Wed", "value": 19 },
  { "label": "Thu", "value": 41 },
  { "label": "Fri", "value": 33 },
  { "label": "Sat", "value": 52 },
  { "label": "Sun", "value": 45 }
]`;

const DEVICE_SIZES: Record<Device, { w: number; label: string }> = {
  phone: { w: 390, label: 'iPhone' },
  tablet: { w: 768, label: 'Tablet' },
  desktop: { w: 1280, label: 'Desktop' },
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

/** Wraps user HTML in a themed document; forwards runtime errors to the parent frame. */
const buildSrcDoc = (code: string, dark: boolean) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --fg:${dark ? '#e2e8f0' : '#0f172a'}; --card-bg:${dark ? '#1e293b' : '#ffffff'}; }
  html { background:${dark ? '#0f172a' : '#f1f5f9'}; color:var(--fg); }
</style>
<script>
  window.onerror = function(msg, src, line) {
    parent.postMessage({ __uistudio: true, msg: String(msg), line: line }, '*');
    return true;
  };
</script></head>
<body>${code}</body></html>`;

interface Particle {
  x: number; y: number; vx: number; vy: number; r: number;
  baseY?: number; phase?: number; orbitR?: number; angle?: number; angVel?: number;
}

export const UIStudio: React.FC<UIStudioProps> = ({ onClose }) => {
  const [mode, setMode] = useState<Mode>('design');

  // — Design state —
  const [designCode, setDesignCode] = useState(DEFAULT_DESIGN_CODE);
  const [renderedCode, setRenderedCode] = useState(DEFAULT_DESIGN_CODE);
  const [device, setDevice] = useState<Device>('phone');
  const [dark, setDark] = useState(true);
  const [splitTheme, setSplitTheme] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // — Data state —
  const [dataCode, setDataCode] = useState(DEFAULT_DATA_CODE);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

  // — Motion state —
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [scene, setScene] = useState<Scene>('constellation');
  const [particleCount, setParticleCount] = useState(70);
  const [speed, setSpeed] = useState(1);
  const [hue, setHue] = useState(215);
  const [linked, setLinked] = useState(true);

  // Debounced live render + error reset
  useEffect(() => {
    const t = setTimeout(() => {
      setRuntimeError(null);
      setRenderedCode(designCode);
    }, 400);
    return () => clearTimeout(t);
  }, [designCode]);

  // Receive runtime errors from the sandboxed preview
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.__uistudio) {
        setRuntimeError(`Line ${e.data.line}: ${e.data.msg}`);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const parsedData = useMemo(() => {
    try {
      const d = JSON.parse(dataCode);
      if (!Array.isArray(d)) return { error: 'JSON must be an array' };
      const rows = d
        .filter((r) => r && typeof r.value === 'number')
        .map((r, i) => ({ label: String(r.label ?? i + 1), value: r.value as number }));
      return rows.length ? { rows } : { error: 'Need objects like {"label":"A","value":10}' };
    } catch {
      return { error: 'Invalid JSON — check commas and quotes' };
    }
  }, [dataCode]);

  const randomizeData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const rows = days.map((label) => ({ label, value: Math.round(5 + Math.random() * 60) }));
    setDataCode(JSON.stringify(rows, null, 2));
  };

  // Motion engine — three scenes, pointer-interactive
  useEffect(() => {
    if (mode !== 'motion') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();

    const W = () => canvas.width;
    const H = () => canvas.height;

    const ps: Particle[] = Array.from({ length: particleCount }, (_, i) => {
      const base: Particle = {
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        r: 1 + Math.random() * 2.5,
      };
      if (scene === 'waves') {
        base.x = (i / particleCount) * W();
        base.baseY = H() / 2;
        base.phase = (i / particleCount) * Math.PI * 4;
      }
      if (scene === 'orbit') {
        base.orbitR = 20 + Math.random() * (Math.min(W(), H()) / 2 - 30);
        base.angle = Math.random() * Math.PI * 2;
        base.angVel = (0.002 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1);
      }
      return base;
    });

    let t = 0;
    let raf = 0;
    const tick = () => {
      t += 0.02 * speed;
      ctx.fillStyle = 'rgba(10, 15, 30, 0.25)';
      ctx.fillRect(0, 0, W(), H());
      const ptr = pointerRef.current;

      for (const p of ps) {
        if (scene === 'constellation') {
          p.x += p.vx * speed;
          p.y += p.vy * speed;
          if (ptr.active) {
            const dx = ptr.x - p.x;
            const dy = ptr.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 160) {
              p.x += (dx / d) * 0.8 * speed;
              p.y += (dy / d) * 0.8 * speed;
            }
          }
          if (p.x < 0 || p.x > W()) p.vx *= -1;
          if (p.y < 0 || p.y > H()) p.vy *= -1;
        } else if (scene === 'orbit') {
          p.angle! += p.angVel! * speed * 3;
          const cx = ptr.active ? ptr.x : W() / 2;
          const cy = ptr.active ? ptr.y : H() / 2;
          p.x = cx + p.orbitR! * Math.cos(p.angle!);
          p.y = cy + p.orbitR! * Math.sin(p.angle!) * 0.6;
        } else {
          // waves
          const amp = ptr.active ? Math.max(20, H() / 2 - Math.abs(ptr.y - H() / 2)) : H() / 5;
          p.y = p.baseY! + Math.sin(t * 2 + p.phase!) * amp * Math.sin(t * 0.3 + p.phase! * 0.5);
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${(hue + (p.phase ?? 0) * 12) % 360}, 85%, 65%)`;
        ctx.fill();
      }

      if (linked && scene !== 'waves') {
        ctx.lineWidth = 0.5;
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const dx = ps[i].x - ps[j].x;
            const dy = ps[i].y - ps[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < 110) {
              ctx.strokeStyle = `hsla(${hue}, 85%, 65%, ${1 - dist / 110})`;
              ctx.beginPath();
              ctx.moveTo(ps[i].x, ps[i].y);
              ctx.lineTo(ps[j].x, ps[j].y);
              ctx.stroke();
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    const setPtr = (x: number, y: number, active: boolean) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = { x: x - rect.left, y: y - rect.top, active };
    };
    const onMouse = (e: MouseEvent) => setPtr(e.clientX, e.clientY, true);
    const onLeave = () => (pointerRef.current.active = false);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) setPtr(e.touches[0].clientX, e.touches[0].clientY, true);
    };
    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchmove', onTouch, { passive: true });
    canvas.addEventListener('touchend', onLeave);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onLeave);
      window.removeEventListener('resize', resize);
    };
  }, [mode, scene, particleCount, speed, hue, linked]);

  const renderChart = useCallback(() => {
    if ('error' in parsedData) {
      return <div className="flex h-full items-center justify-center text-xs text-red-400">{parsedData.error}</div>;
    }
    const rows = parsedData.rows!;
    const values = rows.map((r) => r.value);
    const max = Math.max(...values, 1);
    const total = values.reduce((s, v) => s + v, 0);
    const avg = total / rows.length;
    const W = 420;
    const H = 230;
    const pad = 34;

    const gridLines = [0.25, 0.5, 0.75, 1].map((f) => ({
      y: H - pad - (H - pad * 2) * f,
      v: Math.round(max * f),
    }));

    const stats = (
      <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-slate-400">
        <span>total <b className="text-slate-200">{total}</b></span>
        <span>avg <b className="text-slate-200">{avg.toFixed(1)}</b></span>
        <span>max <b className="text-slate-200">{max}</b></span>
        <span>points <b className="text-slate-200">{rows.length}</b></span>
      </div>
    );

    let chart: React.ReactNode;
    if (chartType === 'bar') {
      const bw = (W - pad * 2) / rows.length;
      chart = (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={pad} y1={g.y} x2={W - pad / 2} y2={g.y} stroke="#334155" strokeWidth={0.5} strokeDasharray="3 4" />
              <text x={pad - 5} y={g.y + 3} textAnchor="end" fontSize="8" fill="#64748b">{g.v}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const h = ((H - pad * 2) * r.value) / max;
            return (
              <g key={i}>
                <rect
                  x={pad + i * bw + bw * 0.12}
                  y={H - pad - h}
                  width={bw * 0.76}
                  height={h}
                  rx={4}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                >
                  <title>{`${r.label}: ${r.value}`}</title>
                </rect>
                <text x={pad + i * bw + bw / 2} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                  {r.label}
                </text>
                <text x={pad + i * bw + bw / 2} y={H - pad - h - 5} textAnchor="middle" fontSize="9" fill="#cbd5e1">
                  {r.value}
                </text>
              </g>
            );
          })}
        </svg>
      );
    } else if (chartType === 'line') {
      const step = (W - pad * 2) / Math.max(rows.length - 1, 1);
      const pts = rows.map((r, i) => ({
        x: pad + i * step,
        y: H - pad - ((H - pad * 2) * r.value) / max,
      }));
      const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
      const area = `${path} L${pts[pts.length - 1].x},${H - pad} L${pts[0].x},${H - pad} Z`;
      chart = (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={pad} y1={g.y} x2={W - pad / 2} y2={g.y} stroke="#334155" strokeWidth={0.5} strokeDasharray="3 4" />
              <text x={pad - 5} y={g.y + 3} textAnchor="end" fontSize="8" fill="#64748b">{g.v}</text>
            </g>
          ))}
          <defs>
            <linearGradient id="uistudio-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#uistudio-grad)" opacity={0.25} />
          <path d={path} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="#0f172a" stroke="#3b82f6" strokeWidth={2}>
                <title>{`${rows[i].label}: ${rows[i].value}`}</title>
              </circle>
              <text x={p.x} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {rows[i].label}
              </text>
            </g>
          ))}
        </svg>
      );
    } else {
      let angle = -Math.PI / 2;
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) / 2 - 26;
      chart = (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {rows.map((r, i) => {
            const slice = (r.value / total) * Math.PI * 2;
            const x1 = cx + R * Math.cos(angle);
            const y1 = cy + R * Math.sin(angle);
            angle += slice;
            const x2 = cx + R * Math.cos(angle);
            const y2 = cy + R * Math.sin(angle);
            const mid = angle - slice / 2;
            const lx = cx + (R + 15) * Math.cos(mid);
            const ly = cy + (R + 15) * Math.sin(mid);
            const pct = ((r.value / total) * 100).toFixed(0);
            return (
              <g key={i}>
                <path
                  d={`M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${slice > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                >
                  <title>{`${r.label}: ${r.value} (${pct}%)`}</title>
                </path>
                <text x={lx} y={ly} textAnchor="middle" fontSize="8" fill="#cbd5e1">
                  {r.label} {pct}%
                </text>
              </g>
            );
          })}
        </svg>
      );
    }

    return (
      <div className="flex h-full flex-col">
        {stats}
        <div className="min-h-0 flex-1">{chart}</div>
      </div>
    );
  }, [parsedData, chartType]);

  const dev = DEVICE_SIZES[device];

  const previewFrame = (isDark: boolean, key: string) => (
    <div
      key={`${key}-${refreshKey}`}
      className={`relative overflow-hidden bg-slate-950 shadow-2xl ${
        device === 'phone'
          ? 'rounded-[2rem] border-[6px] border-slate-700'
          : 'rounded-xl border border-slate-600/60'
      }`}
      style={{ width: '100%', maxWidth: dev.w, height: '100%' }}
    >
      {device === 'phone' && (
        <div className="absolute left-1/2 top-1.5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-slate-700" />
      )}
      <iframe
        title={`preview-${key}`}
        sandbox="allow-scripts"
        srcDoc={buildSrcDoc(renderedCode, isDark)}
        className="h-full w-full border-0"
      />
    </div>
  );

  const tabBtn = (m: Mode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        mode === m ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 font-mono text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {tabBtn('design', <Code2 size={12} />, 'Design')}
          {tabBtn('data', <BarChart3 size={12} />, 'Data')}
          {tabBtn('motion', <Sparkles size={12} />, 'Motion')}
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white">
          <X size={14} />
        </button>
      </div>

      {mode === 'design' && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <textarea
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value)}
            spellCheck={false}
            className="h-40 w-full resize-none border-b border-slate-700/60 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-emerald-300 outline-none md:h-auto md:w-2/5 md:border-b-0 md:border-r"
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-slate-700/60 px-2 py-1">
              {(Object.keys(DEVICE_SIZES) as Device[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  title={DEVICE_SIZES[d].label}
                  className={`rounded p-1 ${device === d ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {d === 'phone' ? <Smartphone size={12} /> : d === 'tablet' ? <Tablet size={12} /> : <Monitor size={12} />}
                </button>
              ))}
              <div className="mx-1 h-4 w-px bg-slate-700" />
              <button
                onClick={() => setDark(!dark)}
                title="Toggle theme"
                className="rounded p-1 text-slate-400 hover:text-slate-200"
              >
                {dark ? <Moon size={12} /> : <Sun size={12} />}
              </button>
              <button
                onClick={() => setSplitTheme(!splitTheme)}
                title="Light + dark side by side"
                className={`rounded p-1 ${splitTheme ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Columns2 size={12} />
              </button>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                title="Re-run preview"
                className="rounded p-1 text-slate-400 hover:text-slate-200"
              >
                <RefreshCw size={12} />
              </button>
              <span className="ml-auto text-[10px] text-slate-500">
                {dev.label}
                {splitTheme ? ' · light + dark' : dark ? ' · dark' : ' · light'}
              </span>
            </div>
            {runtimeError && (
              <div className="border-b border-red-900/50 bg-red-950/40 px-3 py-1 text-[10px] text-red-400">
                ⚠ {runtimeError}
              </div>
            )}
            <div className="flex min-h-0 flex-1 items-stretch justify-center gap-3 overflow-auto bg-slate-900/50 p-3">
              {splitTheme ? (
                <>
                  {previewFrame(false, 'light')}
                  {previewFrame(true, 'dark')}
                </>
              ) : (
                previewFrame(dark, 'single')
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'data' && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <textarea
            value={dataCode}
            onChange={(e) => setDataCode(e.target.value)}
            spellCheck={false}
            className="h-40 w-full resize-none border-b border-slate-700/60 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-cyan-300 outline-none md:h-auto md:w-2/5 md:border-b-0 md:border-r"
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-slate-700/60 px-2 py-1">
              {(['bar', 'line', 'pie'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`rounded px-2 py-0.5 text-[10px] capitalize ${
                    chartType === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={randomizeData}
                title="Random sample data"
                className="rounded p-1 text-slate-400 hover:text-slate-200"
              >
                <Dices size={12} />
              </button>
              <span className="ml-auto text-[10px] text-slate-500">paste JSON on the left · hover for values</span>
            </div>
            <div className="min-h-0 flex-1 p-2">{renderChart()}</div>
          </div>
        </div>
      )}

      {mode === 'motion' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-700/60 px-3 py-1.5 text-[10px] text-slate-400">
            {(['constellation', 'orbit', 'waves'] as Scene[]).map((s) => (
              <button
                key={s}
                onClick={() => setScene(s)}
                className={`rounded px-2 py-0.5 capitalize ${
                  scene === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-slate-700" />
            <label className="flex items-center gap-1.5">
              particles
              <input
                type="range"
                min={10}
                max={150}
                value={particleCount}
                onChange={(e) => setParticleCount(+e.target.value)}
                className="w-16 accent-blue-500"
              />
              {particleCount}
            </label>
            <label className="flex items-center gap-1.5">
              speed
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(+e.target.value)}
                className="w-16 accent-blue-500"
              />
              {speed.toFixed(1)}x
            </label>
            <label className="flex items-center gap-1.5">
              color
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                onChange={(e) => setHue(+e.target.value)}
                className="w-16"
                style={{ accentColor: `hsl(${hue}, 85%, 60%)` }}
              />
            </label>
            {scene !== 'waves' && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} className="accent-blue-500" />
                lines
              </label>
            )}
            <span className="ml-auto text-slate-500">touch the canvas — it responds</span>
          </div>
          <canvas ref={canvasRef} className="min-h-0 w-full flex-1 touch-none bg-[#0a0f1e]" />
        </div>
      )}
    </div>
  );
};
