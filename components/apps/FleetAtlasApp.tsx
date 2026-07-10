/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fleet Atlas — an interactive "Knowledge Network" of every condenser node in
 * the Cybernetic fleet, rendered as a rotating 3D sphere on a 2D canvas (no
 * heavy WebGL deps, works on the app's React 19 stack). Ported from the
 * standalone `3D-globe` asset: it is the deduplicated map of everything that
 * has been — and is being — incorporated into this machine.
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { X } from 'lucide-react';

type Status = 'working' | 'fixed' | 'scaffolded' | 'pending';

interface RawNode {
    id: string;
    symbol: string;
    spec: string;
    status: Status;
}

const SPEC_COLORS: Record<string, string> = {
    baseline: '#f59e0b',
    emotion: '#ec4899',
    coding: '#3b82f6',
    knowledge: '#8b5cf6',
    memory: '#6366f1',
    language: '#06b6d4',
    streaming: '#10b981',
    relationship: '#f97316',
    security: '#ef4444',
    analysis: '#84cc16',
    orchestration: '#a855f7',
    episodic: '#64748b',
};

// The canonical fleet map (authored in the 3D-globe asset). Each entry is a
// specialized "condenser" — a repo distilled to its role in the network.
const RAW_NODES: RawNode[] = [
    { id: 'neutronknowledge', symbol: '☉', spec: 'baseline', status: 'working' },
    { id: 'quiet-heart-signal', symbol: '♀', spec: 'emotion', status: 'working' },
    { id: 'tension-tamer', symbol: '♂', spec: 'coding', status: 'working' },
    { id: 'apex-intelligence-hub', symbol: '♃', spec: 'knowledge', status: 'scaffolded' },
    { id: 'neutronstar', symbol: '♄', spec: 'memory', status: 'fixed' },
    { id: 'signal-weaver-23', symbol: '☿', spec: 'language', status: 'scaffolded' },
    { id: 'neutron-core-stream', symbol: '♆', spec: 'streaming', status: 'fixed' },
    { id: 'relational-compass', symbol: '♇', spec: 'relationship', status: 'working' },
    { id: 'veil-ops', symbol: '⚶', spec: 'security', status: 'working' },
    { id: 'fobccc', symbol: '⚸', spec: 'analysis', status: 'working' },
    { id: 'bot-squad-dynamics', symbol: '♅', spec: 'orchestration', status: 'working' },
    { id: 'logbook-curator', symbol: '☽', spec: 'episodic', status: 'working' },
    { id: 'signal-refiner', symbol: '☿', spec: 'language', status: 'fixed' },
    { id: 'express-purely', symbol: '♀', spec: 'emotion', status: 'fixed' },
    { id: 'remix-of-jackie-s-compass', symbol: '♇', spec: 'relationship', status: 'fixed' },
    { id: 'deep-cosmos-chat', symbol: '♆', spec: 'streaming', status: 'fixed' },
    { id: 'mind-garden-explorer', symbol: '♃', spec: 'knowledge', status: 'fixed' },
    { id: 'calm-comprehension', symbol: '☽', spec: 'episodic', status: 'fixed' },
    { id: 'star-lingo-flux', symbol: '☿', spec: 'language', status: 'fixed' },
    { id: 'density-weave-core', symbol: '♆', spec: 'streaming', status: 'working' },
    { id: 'signal-star-compress', symbol: '♆', spec: 'streaming', status: 'working' },
    { id: 'signal67', symbol: '♆', spec: 'streaming', status: 'working' },
    { id: 'neutron-dense-ideas', symbol: '♃', spec: 'knowledge', status: 'working' },
    { id: 'core-light-vault', symbol: '♄', spec: 'memory', status: 'working' },
    { id: 'signal-sharpener', symbol: '☿', spec: 'language', status: 'working' },
    { id: 'jacky', symbol: '☉', spec: 'baseline', status: 'working' },
    { id: 'jackie-core-keeper', symbol: '☉', spec: 'baseline', status: 'working' },
    { id: 'ocd-jacky-777', symbol: '♄', spec: 'memory', status: 'working' },
    { id: 'eru', symbol: '♅', spec: 'orchestration', status: 'working' },
    { id: 'neweru', symbol: '♅', spec: 'orchestration', status: 'working' },
    { id: 'jadelounge', symbol: '♇', spec: 'relationship', status: 'working' },
    { id: 'dakura', symbol: '⚶', spec: 'security', status: 'fixed' },
    { id: 'clever-memory-bot', symbol: '♄', spec: 'memory', status: 'working' },
    { id: 'tikkerlive', symbol: '⚸', spec: 'analysis', status: 'working' },
    { id: 'momentum-habit-tracker', symbol: '♂', spec: 'coding', status: 'working' },
    { id: 'telegram-proxy-guide', symbol: '☿', spec: 'language', status: 'working' },
    { id: 'AI-Data-Analist', symbol: '⚸', spec: 'analysis', status: 'scaffolded' },
    { id: '3D-globe', symbol: '♃', spec: 'knowledge', status: 'scaffolded' },
    { id: 'signal-weaver-73', symbol: '☿', spec: 'language', status: 'working' },
    { id: 'cyber-store', symbol: '⚶', spec: 'security', status: 'working' },
    { id: 'PC', symbol: '♅', spec: 'orchestration', status: 'working' },
];

// Distribute nodes on a unit sphere via the fibonacci lattice.
function fibonacciSphere(n: number): [number, number, number][] {
    const pts: [number, number, number][] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
    }
    return pts;
}

interface SphereNode extends RawNode {
    base: [number, number, number];
    color: string;
}

const FleetAtlasApp: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selected, setSelected] = useState<SphereNode | null>(null);
    const [filterSpec, setFilterSpec] = useState<string | null>(null);
    // Live refs so the animation loop always reads current state without restarting.
    const filterRef = useRef<string | null>(null);
    const screenRef = useRef<{ node: SphereNode; x: number; y: number; r: number }[]>([]);

    const nodes: SphereNode[] = useMemo(() => {
        const pos = fibonacciSphere(RAW_NODES.length);
        return RAW_NODES.map((n, i) => ({
            ...n,
            base: pos[i],
            color: SPEC_COLORS[n.spec] || '#94a3b8',
        }));
    }, []);

    const specs = useMemo(
        () => [...new Set(nodes.map((n) => n.spec))].sort(),
        [nodes]
    );

    const edgeCount = useMemo(() => {
        let c = 0;
        for (let i = 0; i < nodes.length; i++)
            for (let j = i + 1; j < nodes.length; j++)
                if (nodes[i].spec === nodes[j].spec) c++;
        return c;
    }, [nodes]);

    useEffect(() => {
        filterRef.current = filterSpec;
    }, [filterSpec]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let raf = 0;
        let angle = 0;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.max(1, rect.width * dpr);
            canvas.height = Math.max(1, rect.height * dpr);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const render = () => {
            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const radius = Math.min(w, h) * 0.36;
            const active = filterRef.current;

            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#05070d';
            ctx.fillRect(0, 0, w, h);

            // Rotate each node around the Y axis, then project.
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const projected = nodes.map((n) => {
                const [x, y, z] = n.base;
                const rx = x * cosA - z * sinA;
                const rz = x * sinA + z * cosA;
                // simple perspective: farther (rz small) => smaller/dimmer
                const depth = (rz + 1.6) / 3.2; // 0..~1
                const scale = 0.55 + depth * 0.9;
                return {
                    n,
                    sx: cx + rx * radius,
                    sy: cy - y * radius,
                    depth,
                    scale,
                    dim: active !== null && n.spec !== active,
                };
            });

            // Edges between same-spec nodes (draw behind nodes).
            for (let i = 0; i < projected.length; i++) {
                const a = projected[i];
                if (a.dim) continue;
                for (let j = i + 1; j < projected.length; j++) {
                    const b = projected[j];
                    if (b.dim) continue;
                    if (a.n.spec !== b.n.spec) continue;
                    ctx.strokeStyle = a.n.color;
                    ctx.globalAlpha = 0.1 * Math.min(a.depth, b.depth);
                    ctx.lineWidth = dpr * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(a.sx, a.sy);
                    ctx.lineTo(b.sx, b.sy);
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;

            // Painter's algorithm: draw far nodes first.
            const order = [...projected].sort((p, q) => p.depth - q.depth);
            const hits: { node: SphereNode; x: number; y: number; r: number }[] = [];
            for (const p of order) {
                const size =
                    (p.n.status === 'working' ? 6 : p.n.status === 'fixed' ? 5.2 : 4) *
                    p.scale *
                    dpr;
                const alpha = p.dim ? 0.08 : 0.35 + p.depth * 0.65;

                // glow
                ctx.globalAlpha = alpha * 0.5;
                ctx.fillStyle = p.n.color;
                ctx.beginPath();
                ctx.arc(p.sx, p.sy, size * 2.2, 0, Math.PI * 2);
                ctx.filter = 'blur(0px)';
                ctx.globalAlpha = alpha * 0.15;
                ctx.fill();

                // diamond (octahedron silhouette)
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(p.sx, p.sy - size);
                ctx.lineTo(p.sx + size, p.sy);
                ctx.lineTo(p.sx, p.sy + size);
                ctx.lineTo(p.sx - size, p.sy);
                ctx.closePath();
                ctx.fillStyle = p.n.color;
                ctx.fill();

                if (!p.dim) {
                    hits.push({ node: p.n, x: p.sx, y: p.sy, r: size * 2.4 });
                }
            }
            ctx.globalAlpha = 1;
            screenRef.current = hits;

            angle += 0.0022;
            raf = requestAnimationFrame(render);
        };
        raf = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [nodes]);

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        let best: { node: SphereNode; d: number } | null = null;
        for (const hit of screenRef.current) {
            const d = Math.hypot(hit.x - mx, hit.y - my);
            if (d <= hit.r && (!best || d < best.d)) best = { node: hit.node, d };
        }
        setSelected(best ? best.node : null);
    };

    return (
        <div className="w-full h-full relative bg-[#05070d] overflow-hidden select-none text-zinc-200">
            <canvas
                ref={canvasRef}
                onClick={handleClick}
                className="w-full h-full block cursor-crosshair"
            />

            {/* Header */}
            <div className="absolute top-4 left-4 pointer-events-none">
                <div className="text-[17px] font-bold tracking-[2px] text-zinc-100">
                    KNOWLEDGE NETWORK
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                    {nodes.length} condensers · {edgeCount} connections · click a node
                </div>
            </div>

            {/* Legend / filter */}
            <div className="absolute top-4 right-4 flex flex-col gap-1 max-h-[85%] overflow-auto pr-1">
                <button
                    onClick={() => setFilterSpec(null)}
                    className="text-[10px] px-2 py-[3px] rounded border border-zinc-700 text-zinc-400 text-left hover:border-zinc-500 transition-colors"
                    style={{ background: filterSpec === null ? '#1e293b' : 'transparent' }}
                >
                    All
                </button>
                {specs.map((spec) => (
                    <button
                        key={spec}
                        onClick={() => setFilterSpec(filterSpec === spec ? null : spec)}
                        className="text-[10px] px-2 py-[3px] rounded text-left transition-colors"
                        style={{
                            border: `1px solid ${SPEC_COLORS[spec]}40`,
                            background:
                                filterSpec === spec ? SPEC_COLORS[spec] + '22' : 'transparent',
                            color: SPEC_COLORS[spec],
                        }}
                    >
                        ● {spec}
                    </button>
                ))}
            </div>

            {/* Selected node panel */}
            {selected && (
                <div
                    className="absolute bottom-6 left-6 rounded-xl p-5 min-w-[260px]"
                    style={{
                        background: '#0f172a',
                        border: `1px solid ${selected.color}40`,
                        boxShadow: `0 0 40px ${selected.color}20`,
                    }}
                >
                    <button
                        onClick={() => setSelected(null)}
                        className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300"
                    >
                        <X size={14} />
                    </button>
                    <div className="text-2xl mb-1" style={{ color: selected.color }}>
                        {selected.symbol}
                    </div>
                    <div className="text-sm font-semibold text-zinc-100 mb-1">
                        {selected.id}
                    </div>
                    <div className="text-[11px] text-zinc-500 mb-2">
                        {selected.spec} condenser
                    </div>
                    <span
                        className="text-[11px] px-2 py-0.5 rounded inline-block"
                        style={{
                            background:
                                selected.status === 'working'
                                    ? '#16a34a22'
                                    : selected.status === 'fixed'
                                    ? '#2563eb22'
                                    : '#78350f22',
                            color:
                                selected.status === 'working'
                                    ? '#4ade80'
                                    : selected.status === 'fixed'
                                    ? '#60a5fa'
                                    : '#fbbf24',
                            border: `1px solid ${
                                selected.status === 'working'
                                    ? '#16a34a'
                                    : selected.status === 'fixed'
                                    ? '#2563eb'
                                    : '#78350f'
                            }40`,
                        }}
                    >
                        {selected.status.toUpperCase()}
                    </span>
                </div>
            )}
        </div>
    );
};

export default FleetAtlasApp;
