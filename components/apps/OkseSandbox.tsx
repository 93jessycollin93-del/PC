import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Layers, Play, RotateCcw, HelpCircle, ChevronRight, Binary, Cpu, 
    Activity, Info, Sparkles, RefreshCw, Check, Copy, Scan, Eye, 
    Code, ArrowRight, AlertCircle, HardDrive, Compass, BookOpen
} from 'lucide-react';

const CELL = 64;
const CENTER = CELL / 2; // 32
const RAY_LEN = 20;
const CIRCLE_R = 10;
const STEM_W = 3;
const COLS = 8;
const DARK_THRESHOLD = 128;

// Get tip coordinate relative to cell center
function getTip(orient: number) {
    const angleRad = (orient * 45 * Math.PI) / 180;
    return {
        tx: CENTER + RAY_LEN * Math.cos(angleRad),
        ty: CENTER + RAY_LEN * Math.sin(angleRad),
        angleDeg: orient * 45
    };
}

// Convert string to bytes and then to 4-bit nibbles
function textToNibbles(text: string): number[] {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const nibbles: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        nibbles.push((b >> 4) & 0xF); // high nibble
        nibbles.push(b & 0xF);        // low nibble
    }
    return nibbles;
}

// Convert 4-bit nibbles back to bytes and then to string
function nibblesToText(nibbles: number[]): string {
    const bytes: number[] = [];
    for (let i = 0; i < nibbles.length - 1; i += 2) {
        bytes.push((nibbles[i] << 4) | nibbles[i + 1]);
    }
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(new Uint8Array(bytes));
}

// Decode a nibble from state: bit 0 = circle, bits 1-3 = orientation
function glyphToNibble(orient: number, hasCircle: boolean): number {
    return ((orient & 0x7) << 1) | (hasCircle ? 1 : 0);
}

// Split nibble into circle presence and orientation direction
function nibbleToGlyph(n: number) {
    return {
        circle: (n & 1) === 1,
        orient: (n >> 1) & 0x7
    };
}

interface ScanStepLog {
    cellIndex: number;
    rayInk: number[];
    bestOrient: number;
    circleInk: number;
    circlePresent: boolean;
    decodedNibble: number;
}

export const OkseSandbox: React.FC = () => {
    const [inputText, setInputText] = useState('ALISON');
    const [scanSpeed, setScanSpeed] = useState(250); // ms per cell step
    const [isScanning, setIsScanning] = useState(false);
    const [scanIndex, setScanIndex] = useState<number | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [decodedResult, setDecodedResult] = useState('');
    const [isMatched, setIsMatched] = useState<boolean | null>(null);
    const [scanDetails, setScanDetails] = useState<ScanStepLog[]>([]);
    const [copied, setCopied] = useState(false);
    const [showOverlay, setShowOverlay] = useState(true);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const scannerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Compute source nibbles
    const sourceNibbles = useMemo(() => {
        return textToNibbles(inputText);
    }, [inputText]);

    // Rows count for canvas
    const rowCount = Math.max(1, Math.ceil(sourceNibbles.length / COLS));
    const canvasWidth = COLS * CELL;
    const canvasHeight = rowCount * CELL;

    // Redraw/Render Glyphs on Canvas whenever text changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Clear canvas with solid white background (as required by the decoder pixel algorithm)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Render each glyph
        sourceNibbles.forEach((nibble, i) => {
            const { circle, orient } = nibbleToGlyph(nibble);
            const ox = (i % COLS) * CELL;
            const oy = Math.floor(i / COLS) * CELL;

            const cx = ox + CENTER;
            const cy = oy + CENTER;
            const { tx, ty } = getTip(orient);
            const worldTx = ox + tx;
            const worldTy = oy + ty;

            // 1. Draw cell guide boundary (light gray outline)
            ctx.strokeStyle = '#c8c8c8';
            ctx.lineWidth = 1;
            ctx.strokeRect(ox, oy, CELL - 1, CELL - 1);

            // 2. Draw stem ray (asymmetric solid black line)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = STEM_W;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(worldTx, worldTy);
            ctx.stroke();

            // 3. Draw circle at tip if present (solid black circle)
            if (circle) {
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(worldTx, worldTy, CIRCLE_R, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }, [sourceNibbles, canvasWidth, canvasHeight]);

    // Helper: measure ink density along a ray for orientation `orient`
    const getInkAlongRay = (px: Uint8ClampedArray, ox: number, oy: number, orient: number): number => {
        const { tx, ty } = getTip(orient);
        let total = 0;
        for (let s = 1; s <= 20; s++) {
            const f = s / 20.0;
            const x = Math.round(ox + CENTER + (tx - CENTER) * f);
            const y = Math.round(oy + CENTER + (ty - CENTER) * f);
            
            // Boundary safety
            if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
                const idx = (y * canvasWidth + x) * 4;
                const gray = (px[idx] + px[idx + 1] + px[idx + 2]) / 3;
                if (gray < DARK_THRESHOLD) {
                    total++;
                }
            }
        }
        return total;
    };

    // Helper: check if a circle is present at the tip of orientation `orient`
    const checkCirclePresent = (px: Uint8ClampedArray, ox: number, oy: number, orient: number): { present: boolean; count: number } => {
        const { tx, ty } = getTip(orient);
        const worldTx = ox + tx;
        const worldTy = oy + ty;
        let darkCount = 0;
        const r = CIRCLE_R;

        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                if (dx * dx + dy * dy <= r * r) {
                    const x = Math.round(worldTx + dx);
                    const y = Math.round(worldTy + dy);
                    if (x >= ox && x < ox + CELL && y >= oy && y < oy + CELL) {
                        const idx = (y * canvasWidth + x) * 4;
                        const gray = (px[idx] + px[idx + 1] + px[idx + 2]) / 3;
                        if (gray < DARK_THRESHOLD) {
                            darkCount++;
                        }
                    }
                }
            }
        }
        const limit = Math.PI * r * r * 0.5; // ~157 dark pixels needed out of ~314
        return {
            present: darkCount > limit,
            count: darkCount
        };
    };

    // Run direct, instantaneous decode
    const handleInstantDecode = () => {
        if (isScanning) {
            cancelScan();
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const px = imgData.data;

        const recoveredNibbles: number[] = [];
        const steps: ScanStepLog[] = [];
        const logLines: string[] = ['--- INSTANT ENCODE-DECODE ROUNDTRIP ---'];

        sourceNibbles.forEach((_, i) => {
            const ox = (i % COLS) * CELL;
            const oy = Math.floor(i / COLS) * CELL;

            // 1. Scan 8 orientation rays to find stem direction
            const rayInks: number[] = [];
            for (let o = 0; o < 8; o++) {
                rayInks.push(getInkAlongRay(px, ox, oy, o));
            }
            let bestOrient = 0;
            let maxInk = -1;
            for (let o = 0; o < 8; o++) {
                if (rayInks[o] > maxInk) {
                    maxInk = rayInks[o];
                    bestOrient = o;
                }
            }

            // 2. Check for circle presence at tip of selected ray
            const circleRes = checkCirclePresent(px, ox, oy, bestOrient);

            // 3. Reconstruct nibble
            const nibble = glyphToNibble(bestOrient, circleRes.present);
            recoveredNibbles.push(nibble);

            steps.push({
                cellIndex: i,
                rayInk: rayInks,
                bestOrient,
                circleInk: circleRes.count,
                circlePresent: circleRes.present,
                decodedNibble: nibble
            });

            logLines.push(`Glyph ${i}: Stem Orientation = ${bestOrient} (${bestOrient * 45}°), Circle = ${circleRes.present ? 'ON' : 'OFF'} [Nibble: 0x${nibble.toString(16).toUpperCase()}]`);
        });

        const recoveredText = nibblesToText(recoveredNibbles);
        setScanDetails(steps);
        setDecodedResult(recoveredText);
        const matched = recoveredText === inputText;
        setIsMatched(matched);
        logLines.push(`\nResult: Decoded "${recoveredText}" from ${sourceNibbles.length} glyphs.`);
        logLines.push(matched ? 'SUCCESS ✅ Round-trip exact match verified.' : 'FAIL ❌ Mismatch in round-trip conversion.');
        setLogs(logLines);
    };

    // Animate active scanner
    const handleAnimateScan = () => {
        if (isScanning) {
            cancelScan();
            return;
        }

        setIsScanning(true);
        setScanIndex(0);
        setDecodedResult('');
        setIsMatched(null);
        setScanDetails([]);
        setLogs(['Starting Optical Pixel Decoder scan...', 'Shared context codebook: D4 Dihedral Symmetry (8 rotations x 2 mirror states) + Binary presence.']);

        let currentIndex = 0;
        const recoveredNibbles: number[] = [];
        const steps: ScanStepLog[] = [];
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const px = imgData.data;

        const interval = setInterval(() => {
            if (currentIndex >= sourceNibbles.length) {
                // Done!
                clearInterval(interval);
                setIsScanning(false);
                setScanIndex(null);

                const finalResult = nibblesToText(recoveredNibbles);
                setDecodedResult(finalResult);
                const matched = finalResult === inputText;
                setIsMatched(matched);
                setLogs(l => [
                    ...l, 
                    `\nScan complete! Entire viewport optical-read completed.`,
                    `Recovered bytes converted back to text: "${finalResult}"`,
                    matched 
                        ? `SUCCESS ✅ Decoded output perfectly matches source input "${inputText}". The Daigle Equation holds!` 
                        : `ERROR ❌ Reconstructed text does not match input. Check calibration thresholds.`
                ]);
                return;
            }

            setScanIndex(currentIndex);
            const ox = (currentIndex % COLS) * CELL;
            const oy = Math.floor(currentIndex / COLS) * CELL;

            // 1. Scan 8 orientation rays
            const rayInks: number[] = [];
            for (let o = 0; o < 8; o++) {
                rayInks.push(getInkAlongRay(px, ox, oy, o));
            }
            let bestOrient = 0;
            let maxInk = -1;
            for (let o = 0; o < 8; o++) {
                if (rayInks[o] > maxInk) {
                    maxInk = rayInks[o];
                    bestOrient = o;
                }
            }

            // 2. Check for circle presence at selected tip
            const circleRes = checkCirclePresent(px, ox, oy, bestOrient);

            // 3. Assemble nibble
            const nibble = glyphToNibble(bestOrient, circleRes.present);
            recoveredNibbles.push(nibble);

            const newStep: ScanStepLog = {
                cellIndex: currentIndex,
                rayInk: rayInks,
                bestOrient,
                circleInk: circleRes.count,
                circlePresent: circleRes.present,
                decodedNibble: nibble
            };
            steps.push(newStep);
            setScanDetails([...steps]);

            // Formulate terminal description
            const orientDeg = bestOrient * 45;
            const angleLabel = `${orientDeg}° (${getOrientationLabel(bestOrient)})`;
            setLogs(l => [
                ...l,
                `[Cell ${currentIndex.toString().padStart(2, '0')}] Scanning 8 orientation rays...`,
                `-> Max ink along Ray ${bestOrient} (Sum: ${maxInk}px) at ${angleLabel}`,
                `-> Inspecting tip boundary (Radius: 10px) for circle bit...`,
                `-> Tip ink count: ${circleRes.count}px / 314px (${((circleRes.count / 314) * 100).toFixed(1)}% density) -> ${circleRes.present ? 'CIRCLE PRESENT ✅' : 'EMPTY ❌'}`,
                `-> Decoded Nibble value: 0x${nibble.toString(16).toUpperCase()} (bits: ${nibble.toString(2).padStart(4, '0')})`,
                `----------------------------------------------------`
            ]);

            currentIndex++;
        }, scanSpeed);

        scannerIntervalRef.current = interval;
    };

    const cancelScan = () => {
        if (scannerIntervalRef.current) {
            clearInterval(scannerIntervalRef.current);
            scannerIntervalRef.current = null;
        }
        setIsScanning(false);
        setScanIndex(null);
        setLogs(l => [...l, 'Decoder scan canceled by user.']);
    };

    const handleCopyOriginalCode = () => {
        navigator.clipboard.writeText(inputText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Map orientation index 0-7 to relative label
    const getOrientationLabel = (o: number): string => {
        const labels = ['Up', 'Up-Right', 'Right', 'Down-Right', 'Down', 'Down-Left', 'Left', 'Up-Left'];
        return labels[o] || 'Unknown';
    };

    // Render transparent debug scanner markers over the visual grid
    const renderOverlayGrid = () => {
        if (!showOverlay) return null;

        return (
            <div 
                className="absolute inset-0 pointer-events-none select-none"
                style={{ width: canvasWidth, height: canvasHeight }}
            >
                {sourceNibbles.map((_, i) => {
                    const ox = (i % COLS) * CELL;
                    const oy = Math.floor(i / COLS) * CELL;
                    const isScanningCell = scanIndex === i;
                    const stepLog = scanDetails[i];

                    return (
                        <div 
                            key={i}
                            className="absolute border border-zinc-800/10 transition-all duration-100"
                            style={{
                                left: ox,
                                top: oy,
                                width: CELL,
                                height: CELL,
                                backgroundColor: isScanningCell ? 'rgba(56, 189, 248, 0.15)' : 'transparent'
                            }}
                        >
                            {/* Scanning pulse indicator */}
                            {isScanningCell && (
                                <div className="absolute inset-0 border-2 border-sky-400 animate-pulse flex items-center justify-center">
                                    <div className="text-[8px] font-black text-sky-400 bg-zinc-950/90 px-1 rounded">
                                        SCAN
                                    </div>
                                    <div className="absolute h-0.5 w-full bg-sky-400 top-1/2 -translate-y-1/2 animate-bounce" />
                                </div>
                            )}

                            {/* Render detected orientation vector */}
                            {stepLog && (
                                <svg className="absolute inset-0 w-full h-full">
                                    {/* All scanned candidate rays in translucent white */}
                                    {isScanningCell && Array.from({ length: 8 }).map((_, rIdx) => {
                                        const { tx, ty } = getTip(rIdx);
                                        return (
                                            <line 
                                                key={rIdx}
                                                x1={CENTER}
                                                y1={CENTER}
                                                x2={tx}
                                                y2={ty}
                                                className="stroke-sky-400/30 stroke-[1]"
                                            />
                                        );
                                    })}

                                    {/* Selected vector highlighted */}
                                    {(() => {
                                        const { tx, ty } = getTip(stepLog.bestOrient);
                                        return (
                                            <>
                                                {/* Direction line */}
                                                <line 
                                                    x1={CENTER}
                                                    y1={CENTER}
                                                    x2={tx}
                                                    y2={ty}
                                                    className="stroke-emerald-400 stroke-[2] drop-shadow-[0_0_2px_rgba(52,211,153,1)]"
                                                />
                                                {/* Circle tip scan circle boundary */}
                                                <circle 
                                                    cx={tx}
                                                    cy={ty}
                                                    r={CIRCLE_R}
                                                    className={`fill-none stroke-[1.5] ${stepLog.circlePresent ? 'stroke-emerald-400 fill-emerald-500/10' : 'stroke-red-400/50'}`}
                                                />
                                            </>
                                        );
                                    })()}
                                </svg>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Pangram check to test Daigle's complete atom alphabet requirements
    const pangramStatus = useMemo(() => {
        const lower = inputText.toLowerCase();
        const hasQ = lower.includes('q');
        const hasP = lower.includes('p');
        const hasD = lower.includes('d');
        const hasB = lower.includes('b');
        const hasO = lower.includes('o');
        const hasL = lower.includes('l');
        const hasI = lower.includes('i');
        const hasX = lower.includes('x');

        const score = [hasQ, hasP, hasD, hasB, hasO, hasL, hasI, hasX].filter(Boolean).length;
        return {
            hasQ, hasP, hasD, hasB, hasO, hasL, hasI, hasX,
            score,
            complete: score === 8
        };
    }, [inputText]);

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Interactive Workspace Panel */}
            <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-6 border-r border-zinc-800/60 max-w-full md:max-w-[65%] shrink-0">
                
                {/* Visual Header Explanation */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-3 shadow-sm">
                    <h2 className="text-sm font-extrabold text-indigo-400 flex items-center gap-2 tracking-tight uppercase">
                        <Compass className="text-indigo-400 animate-spin-slow" size={16} />
                        The Daigle Equation: Orientation-Keyed Symbol Encoding
                    </h2>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                        Conceived by Daigle, OKSE is a <strong>machine-decoded symbolic compression scheme</strong>. 
                        It takes advantage of the fact that <strong>b, d, p, q</strong> represent the exact same glyph (a circle + a stem) 
                        rotated and mirrored in 2D space. By anchoring an asymmetric ray at the center of each cell and checking 8 radial orientations, 
                        we compress 4 bits of binary state directly into a single mark (8 orientation states × 2 circle presence states = 16 values = 1 nibble).
                    </p>
                </div>

                {/* Main Interactive Controls Card */}
                <div className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-4 shadow-inner space-y-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Code size={12} /> Encode Pipeline Inputs
                    </span>

                    <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 block font-sans">Enter Text String to Encapsulate into Marks:</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value.replace(/[^ -~]/g, ''))} // keep printable ASCII
                                disabled={isScanning}
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs md:text-sm text-indigo-400 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                placeholder="e.g. ALISON or qlipdoxb"
                            />
                            
                            {/* Canonical Pangram quick-fill */}
                            <button
                                onClick={() => setInputText('qlipdoxb')}
                                disabled={isScanning}
                                className="px-3 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-xl text-[10px] text-zinc-400 transition-all font-sans shrink-0 disabled:opacity-50"
                                title="Load official test word containing all primitives"
                            >
                                Test Pangram
                            </button>
                        </div>
                    </div>

                    {/* Bit Packing Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2 text-center">
                            <span className="text-[9px] text-zinc-500 block">Source Characters</span>
                            <span className="text-xs font-bold text-white font-mono">{inputText.length} chars</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2 text-center">
                            <span className="text-[9px] text-zinc-500 block">Raw Bytes</span>
                            <span className="text-xs font-bold text-white font-mono">{inputText.length} bytes</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2 text-center">
                            <span className="text-[9px] text-zinc-500 block">Total Glyphs</span>
                            <span className="text-xs font-bold text-indigo-400 font-mono">{sourceNibbles.length} marks</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2 text-center">
                            <span className="text-[9px] text-zinc-500 block">OKSE Compressed</span>
                            <span className="text-xs font-bold text-emerald-400 font-mono">{sourceNibbles.length * 4} bits</span>
                        </div>
                    </div>

                    {/* Scanning & Decoding controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/50">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAnimateScan}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isScanning ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                            >
                                <Scan size={12} className={isScanning ? 'animate-spin' : ''} />
                                {isScanning ? 'Halt Optical Scan' : 'Run Interactive Scan'}
                            </button>

                            <button
                                onClick={handleInstantDecode}
                                disabled={isScanning}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                            >
                                <Play size={12} />
                                Instant Decode
                            </button>
                        </div>

                        {/* Scan settings */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-500">Overlay:</span>
                                <button 
                                    onClick={() => setShowOverlay(!showOverlay)}
                                    className={`px-2 py-0.5 rounded text-[10px] transition-all font-bold ${showOverlay ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'}`}
                                >
                                    {showOverlay ? 'Vectors On' : 'Vectors Off'}
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-500">Speed:</span>
                                <select 
                                    value={scanSpeed}
                                    onChange={e => setScanSpeed(Number(e.target.value))}
                                    disabled={isScanning}
                                    className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono focus:outline-none"
                                >
                                    <option value={500}>0.5s</option>
                                    <option value={250}>0.25s</option>
                                    <option value={100}>0.1s</option>
                                    <option value={30}>0.03s</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Real-time Rendered Symbol Grid */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={12} /> Optical Canvas Viewport
                        </span>
                        <span className="text-[9px] text-zinc-500 font-sans">
                            Physical backing scale: exact 64x64 pixel cells
                        </span>
                    </div>

                    <div className="bg-zinc-950 rounded-2xl border border-zinc-800/60 overflow-auto p-8 flex flex-col justify-center items-center shadow-inner relative min-h-[220px]">
                        {/* Interactive decorative retro scan lines */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent bg-[size:100%_4px] pointer-events-none" />

                        {/* Outer Canvas Container */}
                        <div className="relative border-4 border-zinc-900 rounded-lg p-2 bg-white shadow-2xl transition-all duration-300">
                            {/* Target Frame Graphics */}
                            <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-indigo-500" />
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-indigo-500" />
                            <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-indigo-500" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-indigo-500" />

                            <canvas 
                                ref={canvasRef}
                                width={canvasWidth}
                                height={canvasHeight}
                                className="block max-w-full rounded"
                            />

                            {/* Render interactive vector debugging overlays */}
                            {renderOverlayGrid()}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-zinc-500 font-sans">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-0.5 bg-zinc-400" />
                                <span>Radial Stem (8 angles of D₄)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-700" />
                                <span>Circle Presence bit (at Tip)</span>
                            </div>
                            {showOverlay && (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-0.5 bg-emerald-400" />
                                        <span>Optical Vector Lock</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full border border-dashed border-emerald-400" />
                                        <span>Check Circle Zone</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pangram Periodic Table of Primitives */}
                <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen size={12} className="text-indigo-400" />
                            Pangram Verification: Daigle Primitive Set
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                            {pangramStatus.score} / 8 Primitives found
                        </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                        The test word <strong>qlipdoxb</strong> is a perfect pangram containing every core primitive in the language. 
                        It encodes in exactly 32 bits (4 bytes). Write it in the inputs above to trigger a full system validation!
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { char: 'q', desc: 'Down-Right Stem', state: pangramStatus.hasQ },
                            { char: 'p', desc: 'Down-Left Stem', state: pangramStatus.hasP },
                            { char: 'd', desc: 'Up-Right Stem', state: pangramStatus.hasD },
                            { char: 'b', desc: 'Up-Left Stem', state: pangramStatus.hasB },
                            { char: 'o', desc: 'Naked Circle (no stem)', state: pangramStatus.hasO },
                            { char: 'l', desc: 'Empty Stem (no circle)', state: pangramStatus.hasL },
                            { char: 'i', desc: 'Adjacency Stem (circle beside)', state: pangramStatus.hasI },
                            { char: 'x', desc: 'Double Axis Crossed Frame', state: pangramStatus.hasX },
                        ].map((p, idx) => (
                            <div 
                                key={idx} 
                                className={`p-2 rounded-xl border flex items-center justify-between text-[11px] transition-all ${
                                    p.state 
                                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' 
                                        : 'bg-zinc-950/40 border-zinc-900 text-zinc-600'
                                }`}
                            >
                                <div className="flex flex-col">
                                    <span className="font-sans text-[9px] text-zinc-500 uppercase">Primitive</span>
                                    <span className="font-bold font-mono">{p.desc}</span>
                                </div>
                                <span className={`font-mono text-xs font-black px-1.5 py-0.5 rounded ${p.state ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-900 text-zinc-700'}`}>
                                    {p.char}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Simulated Live Grayscale Optical Scanner Console */}
            <div className="flex-1 flex flex-col bg-[#050507] overflow-hidden max-h-[350px] md:max-h-none">
                
                {/* Decode Result Banner */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950 shrink-0 space-y-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity size={12} className="text-emerald-400" />
                        Round-Trip Status Output
                    </span>

                    {decodedResult ? (
                        <div className={`p-3 rounded-xl border flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-300 ${
                            isMatched ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-zinc-400 font-sans uppercase">Decoded String</span>
                                <span className={`text-[9px] uppercase font-black font-sans px-2 py-0.5 rounded ${
                                    isMatched ? 'bg-emerald-500 text-zinc-950' : 'bg-red-500 text-zinc-950'
                                }`}>
                                    {isMatched ? 'PASS ✅ MATCH' : 'FAIL ❌ MISMATCH'}
                                </span>
                            </div>

                            <div className="font-mono text-lg font-black text-white break-all">
                                "{decodedResult}"
                            </div>

                            <span className="text-[9px] text-zinc-400 font-sans leading-relaxed">
                                The engine retrieved raw grayscale bytes directly from canvas canvas-pixels, matched directions via ray integration, and decoded them successfully.
                            </span>
                        </div>
                    ) : (
                        <div className="p-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/10 text-center py-6 text-zinc-500 flex flex-col items-center gap-1.5 font-sans text-xs">
                            <Info size={16} className="text-zinc-600" />
                            <span>No scan run yet. Write some text or a pangram, then click "Run Interactive Scan" or "Instant Decode" to read backing pixels.</span>
                        </div>
                    )}
                </div>

                {/* Simulated Laser Ray Register Log */}
                <div className="flex-1 flex flex-col overflow-hidden p-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2 font-mono">
                        Hardware Pixel Reading Registers
                    </span>
                    
                    <div className="flex-1 bg-zinc-950/80 border border-zinc-900 rounded-xl p-3 font-mono text-[10px] overflow-y-auto space-y-1.5 leading-relaxed text-zinc-400 shadow-inner">
                        {logs.map((log, idx) => (
                            <div key={idx} className={`border-l-2 pl-2 ${
                                log.includes('SUCCESS') ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 py-1' :
                                log.includes('ERROR') || log.includes('FAIL') ? 'border-red-500 text-red-400 bg-red-500/5 py-1' :
                                log.startsWith('Glyph') || log.startsWith('[Cell') ? 'border-indigo-500/30 text-indigo-300' :
                                'border-zinc-800 text-zinc-500'
                            }`}>
                                <span className="text-zinc-700">[{idx.toString().padStart(2, '0')}]</span> {log}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
