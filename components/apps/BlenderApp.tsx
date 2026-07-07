import React, { useState, useEffect, useRef } from 'react';
import { Circle, Sparkles, Loader2, Play, Terminal, HelpCircle, Clipboard, Check, Code, Settings, Eye, RefreshCw, Compass } from 'lucide-react';
import { getAiClient } from '../../lib/gemini';

interface Vertex3D {
    x: number;
    y: number;
    z: number;
}

interface Edge3D {
    v1: number;
    v2: number;
}

export const BlenderApp: React.FC = () => {
    const [prompt, setPrompt] = useState('Create a procedural spiral staircase');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [copied, setCopied] = useState(false);

    // Interactive 3D Viewport State
    const [vertices, setVertices] = useState<Vertex3D[]>([]);
    const [edges, setEdges] = useState<Edge3D[]>([]);
    const [rotation, setRotation] = useState({ x: 0.5, y: 0.5 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedMesh, setSelectedMesh] = useState<'staircase' | 'donut' | 'asteroid' | 'solar'>('staircase');

    // Precompile/generate vertex geometries for our presets
    const generateStaircase = () => {
        const verts: Vertex3D[] = [];
        const edgs: Edge3D[] = [];
        const steps = 18;
        const radius = 3.0;
        const heightStep = 0.35;
        const width = 1.2;

        for (let i = 0; i < steps; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = Math.cos(angle) * radius;
            const y1 = i * heightStep - 3;
            const z1 = Math.sin(angle) * radius;

            const x2 = Math.cos(angle) * (radius - width);
            const y2 = i * heightStep - 3;
            const z2 = Math.sin(angle) * (radius - width);

            verts.push({ x: x1, y: y1, z: z1 });
            verts.push({ x: x2, y: y2, z: z2 });

            const idx = i * 2;
            // Step platform edge
            edgs.push({ v1: idx, v2: idx + 1 });
            if (i > 0) {
                // Connect step heights (outer/inner risers)
                edgs.push({ v1: idx, v2: idx - 2 });
                edgs.push({ v1: idx + 1, v2: idx - 1 });
            }
        }
        setVertices(verts);
        setEdges(edgs);
    };

    const generateDonut = () => {
        const verts: Vertex3D[] = [];
        const edgs: Edge3D[] = [];
        const rMajor = 2.5;
        const rMinor = 0.8;
        const segmentsMajor = 16;
        const segmentsMinor = 12;

        for (let i = 0; i < segmentsMajor; i++) {
            const theta = (i * 2 * Math.PI) / segmentsMajor;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);

            for (let j = 0; j < segmentsMinor; j++) {
                const phi = (j * 2 * Math.PI) / segmentsMinor;
                const cosP = Math.cos(phi);
                const sinP = Math.sin(phi);

                const x = (rMajor + rMinor * cosP) * cosT;
                const y = rMinor * sinP;
                const z = (rMajor + rMinor * cosP) * sinT;

                verts.push({ x, y, z });

                const currIdx = i * segmentsMinor + j;
                const nextJ = (j + 1) % segmentsMinor;
                const nextI = (i + 1) % segmentsMajor;

                edgs.push({ v1: currIdx, v2: i * segmentsMinor + nextJ });
                edgs.push({ v1: currIdx, v2: nextI * segmentsMinor + j });
            }
        }
        setVertices(verts);
        setEdges(edgs);
    };

    const generateAsteroid = () => {
        const verts: Vertex3D[] = [];
        const edgs: Edge3D[] = [];
        const uSegs = 10;
        const vSegs = 10;
        const r = 2.2;

        for (let i = 0; i <= uSegs; i++) {
            const theta = (i * Math.PI) / uSegs;
            const sinT = Math.sin(theta);
            const cosT = Math.cos(theta);

            for (let j = 0; j < vSegs; j++) {
                const phi = (j * 2 * Math.PI) / vSegs;
                const sinP = Math.sin(phi);
                const cosP = Math.cos(phi);

                // Add random displacement mapping to simulate asteroid craters
                const noise = 1 + 0.3 * Math.sin(theta * 6) * Math.cos(phi * 4) + 0.15 * Math.cos(phi * 8);
                const currentR = r * noise;

                const x = currentR * sinT * cosP;
                const y = currentR * cosT;
                const z = currentR * sinT * sinP;

                verts.push({ x, y, z });

                const curr = i * vSegs + j;
                const nextV = (j + 1) % vSegs;
                const nextU = (i + 1) * vSegs + j;

                if (i < uSegs) {
                    edgs.push({ v1: curr, v2: i * vSegs + nextV });
                    edgs.push({ v1: curr, v2: nextU });
                }
            }
        }
        setVertices(verts);
        setEdges(edgs);
    };

    const generateSolarSystem = () => {
        const verts: Vertex3D[] = [];
        const edgs: Edge3D[] = [];

        // Center Sun (Sphere)
        const addSphere = (cx: number, cy: number, cz: number, r: number, startIdx: number) => {
            const u = 6;
            const v = 6;
            for (let i = 0; i <= u; i++) {
                const theta = (i * Math.PI) / u;
                for (let j = 0; j < v; j++) {
                    const phi = (j * 2 * Math.PI) / v;
                    const x = cx + r * Math.sin(theta) * Math.cos(phi);
                    const y = cy + r * Math.cos(theta);
                    const z = cz + r * Math.sin(theta) * Math.sin(phi);
                    verts.push({ x, y, z });

                    const curr = startIdx + i * v + j;
                    const nextV = (j + 1) % v;
                    const nextU = startIdx + (i + 1) * v + j;
                    if (i < u) {
                        edgs.push({ v1: curr, v2: startIdx + i * v + nextV });
                        edgs.push({ v1: curr, v2: nextU });
                    }
                }
            }
        };

        // Sun
        addSphere(0, 0, 0, 1.2, 0);

        // Orbit ring
        const numRingVerts = 24;
        const ringRad = 3.2;
        const ringStart = verts.length;
        for (let i = 0; i < numRingVerts; i++) {
            const angle = (i * 2 * Math.PI) / numRingVerts;
            verts.push({
                x: Math.cos(angle) * ringRad,
                y: 0,
                z: Math.sin(angle) * ringRad
            });
            edgs.push({
                v1: ringStart + i,
                v2: ringStart + ((i + 1) % numRingVerts)
            });
        }

        // Small planet on orbit
        addSphere(ringRad, 0, 0, 0.4, verts.length);

        setVertices(verts);
        setEdges(edgs);
    };

    useEffect(() => {
        if (selectedMesh === 'staircase') generateStaircase();
        if (selectedMesh === 'donut') generateDonut();
        if (selectedMesh === 'asteroid') generateAsteroid();
        if (selectedMesh === 'solar') generateSolarSystem();
    }, [selectedMesh]);

    // Canvas Perspective Rendering loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animFrameId: number;

        const render3D = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#f59e0b'; // Blender Yellow/Orange
            ctx.lineWidth = 1;

            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const scale = 50;

            // Rotation matrix setup
            const cosX = Math.cos(rotation.x);
            const sinX = Math.sin(rotation.x);
            const cosY = Math.cos(rotation.y);
            const sinY = Math.sin(rotation.y);

            const projected: { x: number, y: number }[] = [];

            // Project 3D coordinates to 2D
            vertices.forEach(v => {
                // Rotate around Y-axis
                let x1 = v.x * cosY - v.z * sinY;
                let z1 = v.x * sinY + v.z * cosY;

                // Rotate around X-axis
                let y2 = v.y * cosX - z1 * sinX;
                let z2 = v.y * sinX + z1 * cosX;

                // Simple perspective projection with Z-depth offset
                const depth = 6.0;
                const perspective = scale / (z2 + depth);

                const px = cx + x1 * scale * perspective;
                const py = cy + y2 * scale * perspective;

                projected.push({ x: px, y: py });
            });

            // Draw Wireframe Edges
            edges.forEach(e => {
                const p1 = projected[e.v1];
                const p2 = projected[e.v2];
                if (p1 && p2) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });

            // Draw mesh vertices
            ctx.fillStyle = '#ffffff';
            projected.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, 2 * Math.PI);
                ctx.fill();
            });

            // Slowly auto rotate if not dragging
            if (!isDragging) {
                setRotation(r => ({ ...r, y: r.y + 0.005 }));
            }
        };

        const tick = () => {
            render3D();
            animFrameId = requestAnimationFrame(tick);
        };

        tick();

        return () => cancelAnimationFrame(animFrameId);
    }, [vertices, edges, rotation, isDragging]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        dragStart.current = { x: e.clientX, y: e.clientY };

        setRotation(prev => ({
            x: prev.x + dy * 0.01,
            y: prev.y + dx * 0.01
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleGenerateScript = async () => {
        setIsLoading(true);
        try {
            const ai = getAiClient();
            const meshPrompts = {
                staircase: 'Write a Blender Python (bpy) script that procedurally creates a rotating spiral staircase of 18 steps with accurate geometry spacing.',
                donut: 'Write a Blender Python (bpy) script to programmatically model a parametric torus (donut) with dynamic scaling of segments and materials.',
                asteroid: 'Write a Blender Python (bpy) script that generates a highly deformed procedural asteroid mesh utilizing displacement modifiers and Cycles material textures.',
                solar: 'Write a Blender Python (bpy) script that adds nested rotating spheres and orbital rings representing a dynamic procedural solar system setup.'
            };

            const meshPrompt = meshPrompts[selectedMesh];

            const promptPayload = `You are a Principal Blender Technical Director & Elite Python Developer.
${meshPrompt}.
Please write a highly optimized, fully written, clean bpy script containing proper imports, mesh creation math, and material assignments.

Return ONLY the code block. DO NOT write conversational intro/outro text.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: promptPayload,
            });

            setGeneratedCode(res.text || '');
        } catch (e) {
            console.error(e);
            setGeneratedCode('# Error synthesizing Blender python script. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                    <Circle className="text-amber-500 fill-amber-500/20" size={16} />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-amber-500">Blender AI Scripting Console</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedMesh}
                        onChange={e => setSelectedMesh(e.target.value as any)}
                        className="bg-zinc-950 border border-zinc-800 px-3 py-1 rounded text-xs font-mono text-zinc-300 outline-none focus:border-amber-500"
                    >
                        <option value="staircase">Procedural Spiral Staircase</option>
                        <option value="donut">Torus Knot / Donut</option>
                        <option value="asteroid">Asteroid (Deformed Mesh)</option>
                        <option value="solar">Solar System Simulator</option>
                    </select>
                    <button
                        onClick={handleGenerateScript}
                        disabled={isLoading}
                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-55 text-white text-xs font-mono font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        Compile Script
                    </button>
                </div>
            </div>

            {/* Main Interactive Screen */}
            <div className="flex-1 flex min-h-0">
                {/* 3D Viewport Area */}
                <div className="flex-1 relative bg-zinc-900/10 border-r border-zinc-800 flex flex-col items-center justify-center">
                    <div className="absolute top-3 left-3 bg-zinc-950/85 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[10px] font-mono z-10 flex items-center gap-1.5">
                        <Compass size={12} className="text-amber-500 animate-spin" />
                        <span>Blender 3D Viewport (Drag to Rotate Wireframe)</span>
                    </div>

                    <canvas
                        ref={canvasRef}
                        width={450}
                        height={400}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        className="cursor-grab active:cursor-grabbing max-w-full"
                    />
                </div>

                {/* Script Code Window */}
                <div className="w-96 flex flex-col min-h-0 bg-zinc-900/30">
                    <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                            <Code size={12} />
                            <span>Script Editor (bpy)</span>
                        </div>
                        {generatedCode && (
                            <button
                                onClick={copyToClipboard}
                                className="text-zinc-400 hover:text-zinc-200"
                                title="Copy Script"
                            >
                                {copied ? <Check size={13} className="text-green-400" /> : <Clipboard size={13} />}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 p-4 overflow-auto font-mono text-[11px] bg-zinc-950 text-amber-300 relative">
                        {isLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 text-zinc-500">
                                <Loader2 size={24} className="animate-spin text-amber-500 mb-2" />
                                <span>Synthesizing custom Python mesh generator...</span>
                            </div>
                        ) : generatedCode ? (
                            <pre className="whitespace-pre-wrap">{generatedCode}</pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center p-6">
                                <Sparkles size={20} className="mb-2 text-zinc-700" />
                                <p className="max-w-xs leading-relaxed text-[11px]">Choose a 3D geometry preset and compile script to write the Python bpy pipeline scripts.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
