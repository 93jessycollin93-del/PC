/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo } from 'react';

// Animated "vibe coding" desktop background: drifting code columns,
// Jackie chat bubbles fading in/out, and a glowing terminal grid.
// Pure CSS animations — zero runtime cost beyond compositing.

const CODE_SNIPPETS = [
    'const jackie = new Orchestrator();',
    'await jackie.route(intent);',
    'if (castle.underAttack) rally();',
    '> deploying strategy...',
    'troops.train({ tier: 4 });',
    'research.queue("t4_infantry");',
    'guild.sync() // 98 members',
    'compress(meaning) => seed',
    'navigate(seed) => feature',
    'shield.activate(hours: 24);',
    'economy.collect(delta);',
    '> intent detected: shop',
    'jackie.delegate(minibot, task);',
    'memory.recall(context);',
    'battle.calculate(odds);',
    '> compression cycle: OK',
    'timers.next() // 00:42:17',
    'might += building.upgrade();',
];

const JACKIE_LINES = [
    'Jackie: Command received. Executing.',
    'Jackie: Castle status — optimal.',
    'Jackie: Routing you to research.',
    'Jackie: Threat analyzed. Shield advised.',
    'Jackie: Efficiency is the only path.',
    'Jackie: Priorities calculated.',
];

interface CodeColumn {
    left: string;
    duration: number;
    delay: number;
    lines: string[];
    opacity: number;
}

const buildColumns = (count: number): CodeColumn[] => {
    const cols: CodeColumn[] = [];
    for (let i = 0; i < count; i++) {
        const lines: string[] = [];
        for (let j = 0; j < 10; j++) {
            lines.push(CODE_SNIPPETS[(i * 7 + j * 3) % CODE_SNIPPETS.length]);
        }
        cols.push({
            left: `${(i * 100) / count + 2}%`,
            duration: 28 + (i % 5) * 9,
            delay: -(i * 7),
            lines,
            opacity: 0.10 + (i % 3) * 0.05,
        });
    }
    return cols;
};

export const JackieVibeBackground: React.FC = () => {
    const columns = useMemo(() => buildColumns(6), []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
            {/* Deep terminal base */}
            <div className="absolute inset-0 bg-[#05080f]" />

            {/* Glowing radial ambience — cyan core, purple edges */}
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse at 50% 110%, rgba(34,211,238,0.18) 0%, transparent 55%), radial-gradient(circle at 15% 20%, rgba(139,92,246,0.12) 0%, transparent 40%), radial-gradient(circle at 85% 30%, rgba(59,130,246,0.10) 0%, transparent 40%)'
            }} />

            {/* Perspective grid floor */}
            <div className="absolute inset-x-0 bottom-0 h-1/2" style={{
                backgroundImage: 'linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
                transform: 'perspective(600px) rotateX(60deg)',
                transformOrigin: 'bottom',
                maskImage: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            }} />

            {/* Drifting code columns */}
            {columns.map((col, i) => (
                <div
                    key={i}
                    className="absolute top-0 font-mono text-xs leading-loose whitespace-nowrap"
                    style={{
                        left: col.left,
                        opacity: col.opacity,
                        color: i % 2 === 0 ? '#22d3ee' : '#818cf8',
                        animation: `vibeScroll ${col.duration}s linear infinite`,
                        animationDelay: `${col.delay}s`,
                    }}
                >
                    {[...col.lines, ...col.lines].map((line, j) => (
                        <div key={j}>{line}</div>
                    ))}
                </div>
            ))}

            {/* Jackie chat bubbles fading in and out */}
            {JACKIE_LINES.map((line, i) => (
                <div
                    key={line}
                    className="absolute font-mono text-[11px] px-3 py-1.5 rounded-xl rounded-bl-none border border-cyan-500/20 bg-cyan-950/40 text-cyan-300/70 backdrop-blur-[1px]"
                    style={{
                        left: `${8 + (i % 3) * 30}%`,
                        top: `${12 + (i % 4) * 18}%`,
                        animation: `vibeBubble 18s ease-in-out infinite`,
                        animationDelay: `${i * 3}s`,
                        opacity: 0,
                    }}
                >
                    {line}
                </div>
            ))}

            {/* Slow scanline sweep across the whole desktop */}
            <div className="absolute inset-x-0 h-32" style={{
                background: 'linear-gradient(to bottom, transparent, rgba(34,211,238,0.05), transparent)',
                animation: 'vibeScanline 9s linear infinite',
            }} />

            {/* Vignette to keep icons readable */}
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,8,15,0.55) 100%)'
            }} />

            <style>{`
                @keyframes vibeScroll {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
                @keyframes vibeBubble {
                    0%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
                    8%, 22% { opacity: 1; transform: translateY(0) scale(1); }
                    30% { opacity: 0; transform: translateY(-8px) scale(0.98); }
                }
                @keyframes vibeScanline {
                    0% { top: -10%; }
                    100% { top: 110%; }
                }
            `}</style>
        </div>
    );
};
