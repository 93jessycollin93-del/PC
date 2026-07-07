import React, { useState, useMemo } from 'react';
import { Layers, Play, RefreshCw, Sparkles, Circle, ArrowRight, HelpCircle, ChevronRight, Binary, Info, Code, Cpu, Database, Network } from 'lucide-react';

// Character to 8-State Direction mapping
// We map characters used in stems to physical 8-state directions (0-7, where 0 is Up, clockwise to 7 is Up-Left)
const CHAR_TO_DIRECTION: Record<string, number> = {
    // 0: Up (↑)
    'i': 0, 'l': 0, '1': 0, 'I': 0, '|': 0,
    // 1: Up-Right (↗)
    'd': 1, '7': 1, '/': 1, 'v': 1, 'V': 1,
    // 2: Right (→)
    'e': 2, 'E': 2, '-': 2, 'c': 2, 'C': 2,
    // 3: Down-Right (↘)
    'q': 3, '3': 3, 'z': 3, 'Z': 3,
    // 4: Down (↓)
    'j': 4, 't': 4, 'T': 4, 'y': 4, 'Y': 4,
    // 5: Down-Left (↙)
    'p': 5, '5': 5, 'w': 5, 'W': 5,
    // 6: Left (←)
    'x': 6, 'X': 6, '<': 6, 'o': 6, 'O': 6,
    // 7: Up-Left (↖)
    'b': 7, '9': 7, 'm': 7, 'M': 7, '\\': 7,
};

const DIRECTION_TO_LABEL: Record<number, { angle: number; arrow: string; label: string }> = {
    0: { angle: 0, arrow: '↑', label: 'Up' },
    1: { angle: 45, arrow: '↗', label: 'Up-Right' },
    2: { angle: 90, arrow: '→', label: 'Right' },
    3: { angle: 135, arrow: '↘', label: 'Down-Right' },
    4: { angle: 180, arrow: '↓', label: 'Down' },
    5: { angle: 225, arrow: '↙', label: 'Down-Left' },
    6: { angle: 270, arrow: '←', label: 'Left' },
    7: { angle: 315, arrow: '↖', label: 'Up-Left' },
};

interface ParsedElement {
    type: 'atom' | 'sequence' | 'stack_separator' | 'group_boundary';
    raw: string;
    isActive?: boolean;
    chars?: { char: string; direction: number; label: string }[];
}

export const QpdbApp: React.FC = () => {
    // Loaded with the user's specific new version string
    const [code, setCode] = useState('[}<0><0>~{WMEZ3E}-<><>-{qlipwmdoxbjcqlipwmdoxb}-<><>-{/\/\\/\/ZXKO}~<0><0>{]');
    const [parsed, setParsed] = useState<ParsedElement[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
    const [selectedNodeIndex, setSelectedNodeIndex] = useState<{ elementIdx: number; nodeIdx: number } | null>(null);
    const [activeCompassDir, setActiveCompassDir] = useState<number | null>(null);

    // Initial parse of the preloaded code
    React.useEffect(() => {
        handleParse();
    }, []);

    const handleParse = () => {
        setIsParsing(true);
        setTimeout(() => {
            const result: ParsedElement[] = [];
            let i = 0;
            const str = code.trim();

            while (i < str.length) {
                // Group/Stack boundary characters
                if (str.startsWith('[}', i)) {
                    result.push({ type: 'group_boundary', raw: '[}' });
                    i += 2;
                } else if (str.startsWith('{]', i)) {
                    result.push({ type: 'group_boundary', raw: '{]' });
                    i += 2;
                } else if (str[i] === '-' || str[i] === '~') {
                    result.push({ type: 'stack_separator', raw: str[i] });
                    i++;
                }
                // Atoms (e.g. <0> or <>)
                else if (str.startsWith('<0>', i)) {
                    result.push({ type: 'atom', raw: '<0>', isActive: true });
                    i += 3;
                } else if (str.startsWith('<>', i)) {
                    result.push({ type: 'atom', raw: '<>', isActive: false });
                    i += 2;
                }
                // Sequences (e.g. {WMEZ3E})
                else if (str[i] === '{') {
                    let endIdx = str.indexOf('}', i);
                    if (endIdx === -1) {
                        result.push({ type: 'group_boundary', raw: '{' });
                        i++;
                    } else {
                        const rawSeq = str.substring(i, endIdx + 1);
                        const seqContent = str.substring(i + 1, endIdx);
                        const chars = seqContent.split('').map(char => {
                            const direction = CHAR_TO_DIRECTION[char.toLowerCase()] ?? Math.floor(Math.random() * 8);
                            return {
                                char,
                                direction,
                                label: DIRECTION_TO_LABEL[direction].label
                            };
                        });
                        result.push({ type: 'sequence', raw: rawSeq, chars });
                        i = endIdx + 1;
                    }
                } else {
                    // Raw character
                    result.push({ type: 'sequence', raw: str[i], chars: [{ char: str[i], direction: Math.floor(Math.random() * 8), label: 'Fallback' }] });
                    i++;
                }
            }
            setParsed(result);
            setIsParsing(false);
            setSelectedElementIndex(null);
            setSelectedNodeIndex(null);
        }, 350);
    };

    // Calculate decodes of sequence elements to showcase physical state value
    const decodedBytes = useMemo(() => {
        return parsed.map(el => {
            if (el.type === 'sequence' && el.chars) {
                // Sum the bits representation (3 bits per stem orientation)
                let bitsString = el.chars.map(c => c.direction.toString(2).padStart(3, '0')).join('');
                // Pack into standard 8-bit bytes
                const bytes: string[] = [];
                for (let k = 0; k < bitsString.length; k += 8) {
                    const chunk = bitsString.substring(k, k + 8);
                    if (chunk.length > 0) {
                        const byteValue = parseInt(chunk.padEnd(8, '0'), 2);
                        // Make readable text or hex
                        if (byteValue >= 32 && byteValue <= 126) {
                            bytes.push(String.fromCharCode(byteValue));
                        } else {
                            bytes.push(`0x${byteValue.toString(16).toUpperCase()}`);
                        }
                    }
                }
                return {
                    bitsCount: bitsString.length,
                    representation: bytes.join(' '),
                    rawBits: bitsString
                };
            }
            return null;
        });
    }, [parsed]);

    const handleRunSimulation = () => {
        setIsSimulating(true);
        setTimeout(() => {
            setIsSimulating(false);
        }, 2000);
    };

    const handleGenerateWithAi = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiGenerating(true);
        try {
            const systemPrompt = `You are a high-level visual systems computer compiler. You convert human intents, configurations, or instructions into the 'qpdb' visual glyph system.
The qpdb format guidelines:
- Atom (On/Off): '<0>' is an active/filled atom (on). '<>' is an empty/inactive atom (off).
- Sequence (Chaining): Strings inside curly braces '{...}' represent sequential chains. Characters inside must represent stems/directions.
  Valid directional characters:
  - Up: i, l, 1
  - Up-Right: d, 7, /
  - Right: e, E, -
  - Down-Right: q, 3, z
  - Down: j, t, T
  - Down-Left: p, w, W
  - Left: x, X, <
  - Up-Left: b, m, \ \
- Stacking (2D Groups):
  - Brackets '[}' and '{]' represent boundaries of a stacked pod group.
  - Dash '-' and tilde '~' represent transitions or stack level separators.

Provide ONLY the valid qpdb code inside the '[}' and '{]' boundaries, responding with absolutely zero introductory or explanatory text. Example:
[}<0><0>~{WMEZ3E}-<><>-{qlipwmdoxbjcqlipwmdoxb}-<><>-{/\/\\/\/ZXKO}~<0><0>{]`;

            const res = await fetch('/api/gemini/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-3.5-flash',
                    contents: aiPrompt,
                    config: {
                        systemInstruction: systemPrompt,
                        temperature: 0.4
                    }
                })
            });
            const data = await res.json();
            if (data.response) {
                // Find and extract qpdb string matching pattern
                const match = data.response.match(/\[\}[\s\S]*?\{\]/);
                if (match) {
                    setCode(match[0].trim());
                    setAiPrompt('');
                } else {
                    setCode(data.response.trim());
                }
                setTimeout(() => {
                    handleParse();
                }, 100);
            }
        } catch (error) {
            console.error("AI Generation error:", error);
        } finally {
            setIsAiGenerating(false);
        }
    };

    // Preset options matching different core states
    const PRESETS = [
        {
            name: "User Core Pod",
            desc: "The multi-stack visual telemetry payload",
            value: "[}<0><0>~{WMEZ3E}-<><>-{qlipwmdoxbjcqlipwmdoxb}-<><>-{/\/\\/\/ZXKO}~<0><0>{]"
        },
        {
            name: "Quantum Handshake",
            desc: "Alternating active atoms and dynamic positions",
            value: "[}<0>-{qpdbqpdb}-{><0>{]"
        },
        {
            name: "Orthogonal Field",
            desc: "Strictly vertical stems and spatial group stack",
            value: "[}<0><0><0>~{iiii}-<><><>~{oooo}-{]"
        }
    ];

    // Radial calculation for drawing stems in SVG
    const getStemCoords = (dir: number, centerX: number, centerY: number, length: number) => {
        const info = DIRECTION_TO_LABEL[dir] || DIRECTION_TO_LABEL[0];
        // Subtract 90 degrees so 0 is facing straight Up (↑)
        const rad = ((info.angle - 90) * Math.PI) / 180;
        return {
            x2: centerX + length * Math.cos(rad),
            y2: centerY + length * Math.sin(rad)
        };
    };

    return (
        <div className="h-full w-full bg-[#050608] text-[#a9b2c3] font-mono flex flex-col overflow-hidden select-none">
            {/* Top Diagnostic Title Bar */}
            <div className="h-12 border-b border-[#141822] bg-[#090b11] px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Layers size={16} className="text-amber-500 animate-pulse" />
                    <span className="text-xs font-black uppercase text-[#e2e8f0] tracking-widest">qpdb // Quantum Pod-State Matrix</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#52607a]">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ENGINE ACTIVE</span>
                    <span>v2.1.0-COMPRESSED</span>
                </div>
            </div>

            {/* Main Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* Left Area: Controls, Composer, Code, AI, Theory */}
                <div className="w-[45%] border-r border-[#141822] bg-[#080a0f] flex flex-col overflow-y-auto custom-scrollbar p-5 space-y-6">
                    
                    {/* Source Code Section */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#e2e8f0] font-black uppercase tracking-wider flex items-center gap-1.5"><Code size={12} className="text-amber-500" /> State Stream Code</span>
                            <span className="text-[10px] text-[#52607a] font-mono">Length: {code.length} chars</span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="flex-1 bg-[#0b0e14] border border-[#1b2332] rounded-md px-3 py-2 text-xs text-[#63e2b7] font-mono focus:outline-none focus:border-amber-500/50"
                                placeholder="Enter qpdb glyph payload..."
                            />
                            <button
                                onClick={handleParse}
                                disabled={isParsing}
                                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold rounded-md text-xs transition-colors shrink-0 flex items-center gap-1.5"
                            >
                                <RefreshCw size={12} className={isParsing ? "animate-spin" : ""} /> Parse
                            </button>
                        </div>
                    </div>

                    {/* Presets List */}
                    <div className="space-y-2">
                        <span className="text-[10px] text-[#8e9bb4] font-black uppercase tracking-wider">State Presets</span>
                        <div className="grid grid-cols-1 gap-2">
                            {PRESETS.map((p, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setCode(p.value);
                                        setTimeout(() => handleParse(), 50);
                                    }}
                                    className="w-full text-left p-2.5 bg-[#0b0e14]/50 border border-[#141822] hover:border-amber-500/30 hover:bg-[#0b0e14] rounded-md transition-all group"
                                >
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-[#e2e8f0] group-hover:text-amber-400 transition-colors">{p.name}</span>
                                        <ArrowRight size={10} className="text-[#3b4861] group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    <p className="text-[10px] text-[#52607a] mt-0.5">{p.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Composer UI */}
                    <div className="p-4 bg-[#0a0d14] border border-[#141822] rounded-lg space-y-3.5">
                        <div className="flex items-center gap-2 border-b border-[#141822] pb-2">
                            <Binary size={14} className="text-amber-400" />
                            <span className="text-[11px] font-black uppercase text-[#e2e8f0] tracking-wider">Atom Compass Orientation (Level 2)</span>
                        </div>
                        <p className="text-[10px] text-[#52607a] leading-relaxed">
                            A single active atom <span className="text-amber-400">&lt;0&gt;</span> paired with its orientation stem represents 8 discrete angle states (1 bit + 3 bits of orientation metadata). Click any angle on the compass to highlight matching nodes in the parsed sequence.
                        </p>

                        <div className="flex items-center justify-around py-2">
                            {/* Radial Compass Dial */}
                            <div className="relative w-32 h-32 border border-[#1b2332] rounded-full flex items-center justify-center bg-[#07090d]">
                                <div className="absolute w-24 h-24 border border-dashed border-[#141822] rounded-full" />
                                <div className="absolute w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                </div>

                                {/* Orientation Points */}
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((dir) => {
                                    const info = DIRECTION_TO_LABEL[dir];
                                    const rad = ((info.angle - 90) * Math.PI) / 180;
                                    const x = 50 + 40 * Math.cos(rad);
                                    const y = 50 + 40 * Math.sin(rad);

                                    return (
                                        <button
                                            key={dir}
                                            onClick={() => setActiveCompassDir(activeCompassDir === dir ? null : dir)}
                                            style={{ left: `${x}%`, top: `${y}%` }}
                                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[9px] font-bold font-mono transition-all flex items-center justify-center border ${
                                                activeCompassDir === dir
                                                    ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] scale-110'
                                                    : 'bg-[#0b0e14] text-[#52607a] border-[#1b2332] hover:text-[#e2e8f0] hover:border-amber-500/40'
                                            }`}
                                        >
                                            {info.arrow}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Compass Legend */}
                            <div className="space-y-1.5 text-[10px]">
                                <div className="text-[#8e9bb4] font-bold">Selected Vector Details</div>
                                {activeCompassDir !== null ? (
                                    <div className="space-y-1 text-amber-400">
                                        <div className="font-bold flex items-center gap-1 text-xs">
                                            <span className="text-sm">{DIRECTION_TO_LABEL[activeCompassDir].arrow}</span>
                                            {DIRECTION_TO_LABEL[activeCompassDir].label} (State {activeCompassDir})
                                        </div>
                                        <div className="text-[9px] text-[#52607a]">Angle: {DIRECTION_TO_LABEL[activeCompassDir].angle}°</div>
                                        <div className="text-[9px] text-[#52607a] max-w-[12rem] leading-snug">
                                            Characters mapping to this angle: {Object.entries(CHAR_TO_DIRECTION)
                                                .filter(([_, v]) => v === activeCompassDir)
                                                .map(([k]) => `'${k}'`)
                                                .join(', ')}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[#3b4861] italic">Select compass state to analyze vectors...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Prompt Intent compiler */}
                    <div className="p-4 bg-[#0a0d14]/60 border border-[#141822] rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#e2e8f0] font-black uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={12} className="text-amber-500" /> Compile Intent with AI</span>
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1 text-[8px] font-bold uppercase tracking-widest">GEMINI CORE</span>
                        </div>
                        <p className="text-[10px] text-[#52607a] leading-relaxed">
                            Provide high-level configurations or actions, and let the AI compile them into a multi-layered stacked pod string.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                className="flex-1 bg-[#0b0e14] border border-[#1b2332] rounded-md px-3 py-2 text-xs text-[#a9b2c3] placeholder:text-[#3b4861] focus:outline-none focus:border-amber-500/50"
                                placeholder="e.g., 'Core storage allocated 30%, network channel 4 open'"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleGenerateWithAi();
                                }}
                            />
                            <button
                                onClick={handleGenerateWithAi}
                                disabled={isAiGenerating || !aiPrompt.trim()}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-[#1b2332] disabled:text-[#3b4861] text-black font-bold rounded-md text-xs transition-colors shrink-0 flex items-center gap-1"
                            >
                                {isAiGenerating ? "Compiling..." : "Generate"}
                            </button>
                        </div>
                    </div>

                    {/* Theoretical Explanation Block */}
                    <div className="space-y-3 pt-2 border-t border-[#141822]">
                        <span className="text-[11px] text-[#e2e8f0] font-black uppercase tracking-wider flex items-center gap-1.5"><Info size={13} className="text-amber-500" /> qpdb Paradigm Definition</span>
                        
                        <div className="grid grid-cols-1 gap-3 text-[10px] text-[#52607a] leading-relaxed">
                            <div className="p-3 bg-[#0a0d14]/30 rounded-lg border border-[#141822]">
                                <div className="text-[#8e9bb4] font-black uppercase mb-1">1. Atom (On/Off)</div>
                                <p>The atomic unit of information (1 bit), modeled as a circle state. Active <span className="text-amber-400">&lt;0&gt;</span> contains presence, whereas empty <span className="text-zinc-500">&lt;&gt;</span> outlines physical storage capacity with no state loaded.</p>
                            </div>
                            <div className="p-3 bg-[#0a0d14]/30 rounded-lg border border-[#141822]">
                                <div className="text-[#8e9bb4] font-black uppercase mb-1">2. Position & Stem Orientation</div>
                                <p>Extending the atom, the stem projects in one of 8 directions around the cell center, representing 8 states (orientation value). Highly dense data representation utilizing physical coordinate geometry.</p>
                            </div>
                            <div className="p-3 bg-[#0a0d14]/30 rounded-lg border border-[#141822]">
                                <div className="text-[#8e9bb4] font-black uppercase mb-1">3. Sequence Chain ($8^n$)</div>
                                <p>Chaining the active elements sequentially. Stacking nodes next to each other creates exponential state expansion (<span className="text-amber-400">8ⁿ</span> possibilities). Extrapolates deep data pathways with few tokens.</p>
                            </div>
                            <div className="p-3 bg-[#0a0d14]/30 rounded-lg border border-[#141822]">
                                <div className="text-[#8e9bb4] font-black uppercase mb-1">4. Stacking & 2D Pods</div>
                                <p>Stacking sequences vertically or horizontally in 2D coordinate blocks (separated by dashes/tildes). Creates fully structured functional Pod models for robust local indexing.</p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Area: Interactive Visual Stage & Node Inspector */}
                <div className="flex-1 bg-[#06080d] flex flex-col overflow-hidden relative">
                    
                    {/* Visualizer Header */}
                    <div className="h-10 border-b border-[#141822] px-4 flex items-center justify-between bg-[#080b10] shrink-0">
                        <span className="text-[10px] text-[#8e9bb4] font-black uppercase tracking-wider flex items-center gap-1.5"><Layers size={12} className="text-amber-500" /> Active Visual Matrix</span>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRunSimulation}
                                disabled={isSimulating}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black font-extrabold rounded text-[10px] uppercase tracking-wider transition-all flex items-center gap-1"
                            >
                                <Play size={10} className={isSimulating ? "animate-pulse" : ""} /> {isSimulating ? "Transmitting..." : "Transmit Pod State"}
                            </button>
                        </div>
                    </div>

                    {/* SVG Viewport Stage */}
                    <div className="flex-1 p-6 flex items-center justify-center overflow-auto relative">
                        {/* Matrix Grid Lines backdrop */}
                        <div className="absolute inset-0 bg-[radial-gradient(#141822_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                        {isParsing ? (
                            <div className="flex flex-col items-center gap-2 text-xs text-[#52607a]">
                                <RefreshCw className="animate-spin text-amber-500" size={20} />
                                Compiling pod layers...
                            </div>
                        ) : parsed.length === 0 ? (
                            <div className="text-xs text-[#3b4861] italic">No visual elements loaded.</div>
                        ) : (
                            <div className="relative border border-[#141822] bg-[#07090d]/80 rounded-xl p-8 shadow-2xl flex flex-col items-center max-w-full">
                                
                                {/* 2D Stack Pod Outline container */}
                                <div className="absolute inset-0 border border-amber-500/20 rounded-xl pointer-events-none" />
                                <div className="absolute -top-3 left-4 bg-[#07090d] px-2 text-[8px] font-bold text-amber-400/80 uppercase tracking-widest border border-amber-500/20 rounded">
                                    STACK CORE GROUP
                                </div>

                                {/* Stack Layers */}
                                <div className="space-y-8 flex flex-col items-center w-full">
                                    {parsed.map((el, elIdx) => {
                                        // Ignore boundary characters in vertical stacking, but render them beautifully
                                        if (el.type === 'group_boundary') return null;
                                        if (el.type === 'stack_separator') {
                                            return (
                                                <div key={elIdx} className="w-full flex items-center justify-center py-1">
                                                    <div className="h-[1px] bg-gradient-to-r from-transparent via-[#1c2435] to-transparent flex-1" />
                                                    <span className="mx-3 text-[9px] font-mono font-bold text-[#3b4861] uppercase tracking-widest">
                                                        {el.raw === '~' ? 'LAYER SPLIT (~)' : 'TRANSITION (-)'}
                                                    </span>
                                                    <div className="h-[1px] bg-gradient-to-r from-transparent via-[#1c2435] to-transparent flex-1" />
                                                </div>
                                            );
                                        }

                                        // Render Atom elements
                                        if (el.type === 'atom') {
                                            const isAtomActive = el.isActive;
                                            const isElementSelected = selectedElementIndex === elIdx;

                                            return (
                                                <div
                                                    key={elIdx}
                                                    onClick={() => {
                                                        setSelectedElementIndex(isElementSelected ? null : elIdx);
                                                        setSelectedNodeIndex(null);
                                                    }}
                                                    className={`cursor-pointer group flex flex-col items-center p-3 rounded-lg border transition-all ${
                                                        isElementSelected
                                                            ? 'bg-amber-500/5 border-amber-500/50'
                                                            : 'bg-[#090c12]/40 border-[#141822] hover:border-amber-500/20'
                                                    }`}
                                                >
                                                    <svg width="40" height="40" className="overflow-visible">
                                                        <circle
                                                            cx="20"
                                                            cy="20"
                                                            r="14"
                                                            fill="none"
                                                            stroke={isAtomActive ? "#f59e0b" : "#3b4861"}
                                                            strokeWidth="2"
                                                            strokeDasharray={isAtomActive ? "none" : "3,3"}
                                                            className="transition-all"
                                                        />
                                                        {isAtomActive && (
                                                            <circle
                                                                cx="20"
                                                                cy="20"
                                                                r="6"
                                                                fill="#f59e0b"
                                                                className="animate-pulse"
                                                            />
                                                        )}
                                                    </svg>
                                                    <span className="text-[9px] text-[#52607a] font-mono mt-1 uppercase font-bold tracking-wider">
                                                        {isAtomActive ? "ACTIVE ATOM" : "EMPTY CAPACITY"}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        // Render Sequence Chains
                                        if (el.type === 'sequence' && el.chars) {
                                            const isElementSelected = selectedElementIndex === elIdx;

                                            return (
                                                <div
                                                    key={elIdx}
                                                    className={`w-full flex flex-col items-center p-4 rounded-lg border transition-all ${
                                                        isElementSelected
                                                            ? 'bg-amber-500/5 border-amber-500/30'
                                                            : 'bg-[#090c12]/20 border-transparent hover:border-[#141822]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1 border-b border-[#141822] pb-1.5 mb-3 w-full justify-between">
                                                        <span className="text-[9px] font-black text-[#52607a] uppercase tracking-wider flex items-center gap-1.5">
                                                            <Network size={12} className="text-amber-500" /> Sequence Chain ({el.chars.length} Stems)
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedElementIndex(isElementSelected ? null : elIdx);
                                                                setSelectedNodeIndex(null);
                                                            }}
                                                            className="text-[9px] text-amber-500/70 hover:text-amber-400 font-bold uppercase underline"
                                                        >
                                                            {isElementSelected ? "Deselect" : "Select Layer"}
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center justify-center gap-6 py-2">
                                                        {el.chars.map((node, nodeIdx) => {
                                                            const isNodeSelected = selectedNodeIndex?.elementIdx === elIdx && selectedNodeIndex?.nodeIdx === nodeIdx;
                                                            const isMatchedByCompass = activeCompassDir !== null && node.direction === activeCompassDir;

                                                            // Radial coordinate setup for stems
                                                            const radius = 18;
                                                            const strokeColor = isNodeSelected
                                                                ? '#f59e0b'
                                                                : isMatchedByCompass
                                                                ? '#10b981'
                                                                : '#63e2b7';

                                                            const stemCoords = getStemCoords(node.direction, 25, 25, radius + 10);

                                                            return (
                                                                <div
                                                                    key={nodeIdx}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedNodeIndex(isNodeSelected ? null : { elementIdx: elIdx, nodeIdx });
                                                                        setSelectedElementIndex(null);
                                                                    }}
                                                                    className={`relative p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col items-center ${
                                                                        isNodeSelected
                                                                            ? 'bg-amber-500/10 border-amber-400'
                                                                            : isMatchedByCompass
                                                                            ? 'bg-emerald-500/10 border-emerald-400 scale-105'
                                                                            : 'bg-[#07090d] border-[#1b2332] hover:border-amber-500/30'
                                                                    }`}
                                                                >
                                                                    {/* Direction indicators */}
                                                                    <svg width="50" height="50" className="overflow-visible">
                                                                        {/* Outer circle atom contour */}
                                                                        <circle
                                                                            cx="25"
                                                                            cy="25"
                                                                            r={radius}
                                                                            fill="none"
                                                                            stroke={strokeColor}
                                                                            strokeWidth="2"
                                                                            className="transition-colors"
                                                                        />
                                                                        {/* Center tiny atom nucleus */}
                                                                        <circle cx="25" cy="25" r="3" fill={strokeColor} />
                                                                        {/* Orientation Stem */}
                                                                        <line
                                                                            x1="25"
                                                                            y1="25"
                                                                            x2={stemCoords.x2}
                                                                            y2={stemCoords.y2}
                                                                            stroke={strokeColor}
                                                                            strokeWidth="3.5"
                                                                            strokeLinecap="round"
                                                                            className="transition-colors"
                                                                        />
                                                                    </svg>
                                                                    
                                                                    {/* Char indicator badge */}
                                                                    <span className={`text-[10px] font-bold font-mono mt-2 px-1.5 py-0.5 rounded ${
                                                                        isNodeSelected
                                                                            ? 'bg-amber-500 text-black'
                                                                            : isMatchedByCompass
                                                                            ? 'bg-emerald-500 text-black animate-pulse'
                                                                            : 'bg-[#0b0e14] text-[#a9b2c3]'
                                                                    }`}>
                                                                        {node.char}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>

                                {/* Transmission Scan Overlay */}
                                {isSimulating && (
                                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-[bounce_2s_infinite]" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Dynamic Inspector Node / Selected Element Panel */}
                    <div className="h-44 border-t border-[#141822] bg-[#07090d] p-4 flex flex-col justify-between shrink-0 relative">
                        
                        {/* Selected Node Details */}
                        {selectedNodeIndex !== null ? (
                            (() => {
                                const el = parsed[selectedNodeIndex.elementIdx];
                                if (!el || el.type !== 'sequence' || !el.chars) return null;
                                const node = el.chars[selectedNodeIndex.nodeIdx];
                                return (
                                    <div className="flex-1 flex gap-6 items-start">
                                        <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-xl shrink-0">
                                            {node.char}
                                        </div>
                                        <div className="flex-1 grid grid-cols-3 gap-4 text-xs">
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-[#52607a] uppercase font-bold">Element Class</span>
                                                <div className="text-[#e2e8f0] font-bold flex items-center gap-1.5"><Network size={12} className="text-amber-400" /> Sequence Node</div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-[#52607a] uppercase font-bold">Vector Direction</span>
                                                <div className="text-[#63e2b7] font-bold">{DIRECTION_TO_LABEL[node.direction].arrow} {node.label} (State {node.direction})</div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-[#52607a] uppercase font-bold">Binary Payload</span>
                                                <div className="text-amber-400 font-mono font-bold">{node.direction.toString(2).padStart(3, '0')} (3 bits)</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : selectedElementIndex !== null ? (
                            (() => {
                                const el = parsed[selectedElementIndex];
                                if (!el) return null;
                                return (
                                    <div className="flex-1 flex gap-6 items-start">
                                        <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono text-xs shrink-0 font-bold uppercase">
                                            {el.type === 'atom' ? 'ATOM' : 'SEQ'}
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-[#52607a] uppercase font-bold">State Key</span>
                                                <div className="text-[#e2e8f0] font-mono font-bold">{el.raw}</div>
                                            </div>
                                            {el.type === 'sequence' && decodedBytes[selectedElementIndex] && (
                                                <div className="space-y-1 col-span-2">
                                                    <span className="text-[9px] text-[#52607a] uppercase font-bold">Decoded State value</span>
                                                    <div className="text-[#63e2b7] font-mono font-bold flex gap-4">
                                                        <span>Hex/ASCII: {decodedBytes[selectedElementIndex]?.representation}</span>
                                                        <span className="text-[10px] text-[#52607a]">Raw binary: {decodedBytes[selectedElementIndex]?.rawBits}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {el.type === 'atom' && (
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-[#52607a] uppercase font-bold">Atom Status</span>
                                                    <div className="text-amber-400 font-bold">{el.isActive ? "ON (Filled/1)" : "OFF (Shell/0)"}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="flex-1 flex flex-col justify-center items-center text-[#52607a] text-xs py-4 text-center">
                                <Info size={16} className="mb-1 text-[#3b4861]" />
                                <span>No node selected. Click on any atom or sequence node to inspect its discrete state value.</span>
                            </div>
                        )}

                        {/* Status bar inside bottom inspector */}
                        <div className="h-6 border-t border-[#141822]/50 flex items-center justify-between text-[8px] font-mono text-[#52607a] pt-2">
                            <span>TOTAL ATOMS: {parsed.filter(e => e.type === 'atom').length}</span>
                            <span>TOTAL STEMS: {parsed.reduce((acc, el) => acc + (el.chars?.length || 0), 0)}</span>
                            <span>COMPILATION: {isSimulating ? "TRANSMITTING TELEMETRY..." : "IDLE"}</span>
                        </div>
                    </div>

                </div>

            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #141822;
                    border-radius: 10px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #1c2435;
                }
            `}</style>
        </div>
    );
};
