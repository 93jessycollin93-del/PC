import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, SkipForward, HelpCircle, ChevronRight, Plus, Trash2, Cpu, Activity, Info, Sparkles, RefreshCw, Layers, Check, Copy } from 'lucide-react';
import { OkseSandbox } from './OkseSandbox';

// Data representation for QPDB Visual Computer AST
export interface QpdbNode {
    id: string;
    type: 'pod' | 'atom' | 'link';
    value: string; // character for atom/link
    bracketType?: 'curly' | 'square' | 'angle';
    children?: QpdbNode[];
    active?: boolean;
}

// Convert string into AST
export function parseQpdb(str: string, parentId = 'root'): QpdbNode[] {
    const nodes: QpdbNode[] = [];
    let i = 0;
    let indexCounter = 0;

    const generateId = (type: string, val: string) => 
        `${parentId}_${type}_${val}_${indexCounter++}_${Math.random().toString(36).substring(2, 5)}`;

    while (i < str.length) {
        const char = str[i];
        
        if (char === '{' || char === '[' || char === '<') {
            const closeChar = char === '{' ? '}' : char === '[' ? ']' : '>';
            // Find matching closing bracket with nesting safety
            let depth = 1;
            let j = i + 1;
            while (j < str.length && depth > 0) {
                if (str[j] === char) depth++;
                else if (str[j] === closeChar) depth--;
                j++;
            }
            const innerContent = str.slice(i + 1, j - 1);
            const bracketType = char === '{' ? 'curly' : char === '[' ? 'square' : 'angle';
            const podId = generateId('pod', bracketType);
            
            nodes.push({
                id: podId,
                type: 'pod',
                value: char + closeChar,
                bracketType,
                children: parseQpdb(innerContent, podId)
            });
            i = j;
        } else if (char === '-' || char === '~' || char === '=') {
            nodes.push({
                id: generateId('link', char),
                type: 'link',
                value: char
            });
            i++;
        } else if (/\s/.test(char)) {
            i++; // skip whitespace
        } else {
            // It's a single character atom
            nodes.push({
                id: generateId('atom', char),
                type: 'atom',
                value: char,
                active: char !== '0' // By default '0' is inactive, others active
            });
            i++;
        }
    }
    return nodes;
}

// Serialize AST back to string
export function serializeQpdb(nodes: QpdbNode[]): string {
    return nodes.map(node => {
        if (node.type === 'pod') {
            const open = node.bracketType === 'curly' ? '{' : node.bracketType === 'square' ? '[' : '<';
            const close = node.bracketType === 'curly' ? '}' : node.bracketType === 'square' ? ']' : '>';
            return open + serializeQpdb(node.children || []) + close;
        }
        return node.value;
    }).join('');
}

// Find a node recursively by ID
function findNodeById(nodes: QpdbNode[], id: string): QpdbNode | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

// Find and update a node recursively in the AST
function updateNodeInAst(nodes: QpdbNode[], id: string, updater: (node: QpdbNode) => QpdbNode): QpdbNode[] {
    return nodes.map(node => {
        if (node.id === id) {
            return updater(node);
        }
        if (node.children) {
            return {
                ...node,
                children: updateNodeInAst(node.children, id, updater)
            };
        }
        return node;
    });
}

// Find and delete a node recursively in the AST
function deleteNodeFromAst(nodes: QpdbNode[], id: string): QpdbNode[] {
    return nodes.filter(node => node.id !== id).map(node => {
        if (node.children) {
            return {
                ...node,
                children: deleteNodeFromAst(node.children, id)
            };
        }
        return node;
    });
}

// Map characters to 8 stem orientations
const STEM_ANGLES: Record<string, number> = {
    'm': 0,
    '>': 0,
    'q': 45,
    '\\': 45,
    'i': 90,
    'v': 90,
    'p': 135,
    'w': 180,
    '<': 180,
    'b': 225,
    'l': 270,
    '^': 270,
    'd': 315,
    '/': 315,
};

// Help symbols information
const SYMBOL_DOCS = [
    { char: '0', desc: 'Atom: Inactive / Off state (0)' },
    { char: 'o / O', desc: 'Atom: Active state (1) without orientation' },
    { char: 'q', desc: 'Atom: Orientation Down-Right (45°)' },
    { char: 'p', desc: 'Atom: Orientation Down-Left (135°)' },
    { char: 'd', desc: 'Atom: Orientation Up-Right (315°)' },
    { char: 'b', desc: 'Atom: Orientation Up-Left (225°)' },
    { char: 'i / v', desc: 'Atom: Orientation Down (90°)' },
    { char: 'l / ^', desc: 'Atom: Orientation Up (270°)' },
    { char: 'w / <', desc: 'Atom: Orientation Left (180°)' },
    { char: 'm / >', desc: 'Atom: Orientation Right (0°)' },
    { char: '~', desc: 'Link: Wave channel / transition oscillator' },
    { char: '-', desc: 'Link: Core linear connection synapse' },
    { char: '{...}', desc: 'Pod: Grouping / Nested execution envelope' },
];

// Pre-built templates
const TEMPLATES = [
    {
        name: 'Master Pod (User Invention)',
        code: '[}<0><0>~{WMEZ3E}-<><>-{qlipwmdoxbjcqlipwmdoxb}-<><>-{/\/\\/\/ZXKO}~<0><0>{]'
    },
    {
        name: '4-Bit State Ring',
        code: '{q-p-d-b}'
    },
    {
        name: 'Neural Oscillator Loop',
        code: '~{WMEZ3E}~[qlipwmdoxb]~'
    },
    {
        name: 'Interlinked Gate Cells',
        code: '<0>-{qpdb}-<1>-{dbqp}'
    }
];

export const PodSystemApp: React.FC = () => {
    // We pre-populate with the user's magnificent invented string!
    const [codeStr, setCodeStr] = useState('[}<0><0>~{WMEZ3E}-<><>-{qlipwmdoxbjcqlipwmdoxb}-<><>-{/\/\\/\/ZXKO}~<0><0>{]');
    const [ast, setAst] = useState<QpdbNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'visual' | 'okse' | 'docs'>('visual');
    const [copied, setCopied] = useState(false);

    // Simulation states
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [speedMs, setSpeedMs] = useState(500);
    const [simLog, setSimLog] = useState<string[]>(['Visual Computer initialized. Waiting for execution...']);
    
    // Flat array of executable atoms/links for step-by-step playback
    const flatExecutableNodes = useMemo(() => {
        const result: QpdbNode[] = [];
        const traverse = (nodes: QpdbNode[]) => {
            for (const node of nodes) {
                if (node.type === 'atom' || node.type === 'link') {
                    result.push(node);
                }
                if (node.children) {
                    traverse(node.children);
                }
            }
        };
        traverse(ast);
        return result;
    }, [ast]);

    // Parse the code string whenever it changes externally
    useEffect(() => {
        setAst(parseQpdb(codeStr));
    }, [codeStr]);

    // Handle simulation playback loop
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentStepIndex(prev => {
                    const next = prev + 1;
                    if (next >= flatExecutableNodes.length) {
                        setIsPlaying(false);
                        setSimLog(l => [...l, 'Signal cycle completed.']);
                        return -1;
                    }
                    const activeNode = flatExecutableNodes[next];
                    // Generate unique logical description based on node type & value
                    let desc = '';
                    if (activeNode.type === 'atom') {
                        const angle = STEM_ANGLES[activeNode.value];
                        const dir = angle !== undefined ? `${angle}°` : 'Off';
                        desc = `Pulsing Atom '${activeNode.value}' at ${dir} state.`;
                    } else {
                        desc = `Crossing Connector link '${activeNode.value}' - routing power wave.`;
                    }
                    setSimLog(l => [...l.slice(-15), desc]);
                    return next;
                });
            }, speedMs);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying, flatExecutableNodes, speedMs]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(codeStr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const loadTemplate = (code: string) => {
        setCodeStr(code);
        setCurrentStepIndex(-1);
        setIsPlaying(false);
        setSelectedNodeId(null);
        setSimLog(['Loaded template. Sandbox ready.']);
    };

    // Update state of selected atom/link
    const updateSelectedNodeValue = (newValue: string) => {
        if (!selectedNodeId) return;
        const updatedAst = updateNodeInAst(ast, selectedNodeId, (node) => ({
            ...node,
            value: newValue,
            active: newValue !== '0'
        }));
        setAst(updatedAst);
        setCodeStr(serializeQpdb(updatedAst));
    };

    // Delete selected atom/link
    const deleteSelectedNode = () => {
        if (!selectedNodeId) return;
        const updatedAst = deleteNodeFromAst(ast, selectedNodeId);
        setAst(updatedAst);
        setCodeStr(serializeQpdb(updatedAst));
        setSelectedNodeId(null);
    };

    // Toggle active state of selected node
    const toggleSelectedActive = () => {
        if (!selectedNodeId) return;
        const updatedAst = updateNodeInAst(ast, selectedNodeId, (node) => ({
            ...node,
            active: !node.active
        }));
        setAst(updatedAst);
        setCodeStr(serializeQpdb(updatedAst));
    };

    // Retrieve active selection
    const selectedNode = useMemo(() => {
        if (!selectedNodeId) return null;
        return findNodeById(ast, selectedNodeId);
    }, [ast, selectedNodeId]);

    return (
        <div className="h-full w-full bg-[#0a0a0c] text-zinc-100 font-mono flex flex-col overflow-hidden text-xs md:text-sm">
            {/* Header / Brand Banner */}
            <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Cpu className="text-indigo-400 animate-pulse" size={20} />
                    </div>
                    <div>
                        <h1 className="font-extrabold tracking-tight text-white flex items-center gap-1.5">
                            QPDB-V4 Visual Computer <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">Active</span>
                        </h1>
                        <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Circle-Stem Orientation Engine • Stacking Space Groupings</p>
                    </div>
                </div>
                
                {/* Navigation Tabs */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                    <button 
                        onClick={() => setActiveTab('visual')} 
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'visual' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Active Canvas
                    </button>
                    <button 
                        onClick={() => setActiveTab('okse')} 
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'okse' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Daigle OKSE Sandbox
                    </button>
                    <button 
                        onClick={() => setActiveTab('docs')} 
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'docs' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Theory & Specs
                    </button>
                </div>
            </div>

            {/* Quick Templates Bar */}
            <div className="shrink-0 bg-zinc-900/40 border-b border-zinc-800/40 px-4 py-2 overflow-x-auto no-scrollbar flex gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1 mr-2 shrink-0"><Sparkles size={12} /> Templates:</span>
                {TEMPLATES.map((t, idx) => (
                    <button 
                        key={idx} 
                        onClick={() => loadTemplate(t.code)}
                        className="px-2.5 py-1 bg-zinc-950 hover:bg-indigo-950/40 border border-zinc-800 hover:border-indigo-500/30 rounded-full text-[10px] text-zinc-400 hover:text-indigo-300 transition-all shrink-0 font-medium"
                    >
                        {t.name}
                    </button>
                ))}
            </div>

            {activeTab === 'visual' ? (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {/* Sandbox View / Canvas Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-800/50 p-4">
                        {/* Interactive Code Editor & Controls */}
                        <div className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-4 mb-4 shadow-inner space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Activity size={12} /> Live Compiler Stream</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleCopyCode} 
                                        className="text-zinc-500 hover:text-white p-1 hover:bg-zinc-800 rounded transition-colors"
                                        title="Copy Compiled Code"
                                    >
                                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                            
                            <textarea 
                                value={codeStr}
                                onChange={e => setCodeStr(e.target.value)}
                                placeholder="Input QPDB Code..."
                                className="w-full h-16 bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs md:text-sm font-mono focus:outline-none focus:border-indigo-500 text-indigo-400 leading-relaxed resize-none overflow-y-auto"
                            />

                            {/* Signal Flow Simulator Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/50">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                    >
                                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                        {isPlaying ? 'Pause Sig' : 'Pulse Signal'}
                                    </button>
                                    
                                    <button 
                                        onClick={() => {
                                            setIsPlaying(false);
                                            setCurrentStepIndex(-1);
                                            setSimLog(['Reset system registers. Waiting for trigger...']);
                                        }}
                                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Reset State"
                                    >
                                        <RotateCcw size={14} />
                                    </button>

                                    <button 
                                        onClick={() => {
                                            setIsPlaying(false);
                                            setCurrentStepIndex(prev => {
                                                const next = (prev + 1) % flatExecutableNodes.length;
                                                return next;
                                            });
                                        }}
                                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Step Forward"
                                    >
                                        <SkipForward size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500">Speed:</span>
                                    <select 
                                        value={speedMs}
                                        onChange={e => setSpeedMs(Number(e.target.value))}
                                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 font-mono"
                                    >
                                        <option value={1000}>1.0s (Slow)</option>
                                        <option value={500}>0.5s (Norm)</option>
                                        <option value={200}>0.2s (Fast)</option>
                                        <option value={50}>0.05s (Pulse)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Visual Canvas containing Recursive Rendered Pod Structure */}
                        <div className="flex-1 bg-zinc-950 rounded-2xl border border-zinc-800/60 overflow-auto p-6 flex flex-col justify-center items-center shadow-inner relative min-h-[300px]">
                            {/* Ambient grid overlay */}
                            <div className="absolute inset-0 bg-[radial-gradient(#1c1917_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
                            
                            {ast.length === 0 ? (
                                <div className="text-center text-zinc-600 py-10 font-sans z-10">
                                    <Info className="mx-auto mb-2 opacity-50" size={24} />
                                    <p className="text-sm">No structures compiled.</p>
                                    <p className="text-xs mt-1">Start typing bracketed pods or atoms above.</p>
                                </div>
                            ) : (
                                <div className="w-full flex flex-wrap justify-center gap-6 p-4 z-10 select-none">
                                    <QpdbListRenderer 
                                        nodes={ast} 
                                        currentStepIndex={currentStepIndex}
                                        flatNodes={flatExecutableNodes}
                                        selectedNodeId={selectedNodeId}
                                        onNodeClick={(id) => setSelectedNodeId(id === selectedNodeId ? null : id)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Inspector / Simulator Log Panel */}
                    <div className="w-full md:w-80 shrink-0 bg-zinc-950 border-t md:border-t-0 border-zinc-800 flex flex-col overflow-hidden max-h-[350px] md:max-h-none">
                        {/* Selection Editor */}
                        <div className="p-4 border-b border-zinc-800 bg-zinc-900/40">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Layers size={12} /> Node Inspector</span>
                            {selectedNode ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-white uppercase tracking-wider">
                                            {selectedNode.type === 'atom' ? `Atom (${selectedNode.value})` : selectedNode.type === 'link' ? `Synapse (${selectedNode.value})` : 'Pod Capsule'}
                                        </span>
                                        <button 
                                            onClick={deleteSelectedNode}
                                            className="text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors hover:bg-red-500/10 px-2 py-1 rounded"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    {selectedNode.type === 'atom' && (
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-[10px] text-zinc-500 block mb-1">State Bit</span>
                                                <button 
                                                    onClick={toggleSelectedActive}
                                                    className={`w-full py-1.5 rounded-lg border text-xs font-bold transition-all ${selectedNode.active ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}
                                                >
                                                    {selectedNode.active ? '1 - ACTIVE / ON' : '0 - INACTIVE / OFF'}
                                                </button>
                                            </div>

                                            <div>
                                                <span className="text-[10px] text-zinc-500 block mb-1.5">Rotational Position (8 States)</span>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    {['m', 'q', 'i', 'p', 'w', 'b', 'l', 'd'].map((char) => (
                                                        <button 
                                                            key={char}
                                                            onClick={() => updateSelectedNodeValue(char)}
                                                            className={`py-2 rounded border text-xs font-mono transition-all ${selectedNode.value === char ? 'bg-indigo-600 border-indigo-400 text-white font-black' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'}`}
                                                        >
                                                            {char}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] text-zinc-500 block mb-1">Custom Character / Value</span>
                                                <input 
                                                    type="text" 
                                                    maxLength={1}
                                                    value={selectedNode.value}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val) updateSelectedNodeValue(val);
                                                    }}
                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-mono text-center"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.type === 'link' && (
                                        <div className="space-y-3">
                                            <span className="text-[10px] text-zinc-500 block">Link Oscillator Type</span>
                                            <div className="flex gap-2">
                                                {['-', '~', '='].map(c => (
                                                    <button 
                                                        key={c}
                                                        onClick={() => updateSelectedNodeValue(c)}
                                                        className={`flex-1 py-1.5 rounded border text-xs font-mono transition-all ${selectedNode.value === c ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                                                    >
                                                        {c === '-' ? 'Core (-)' : c === '~' ? 'Osc (~)' : 'Link (=)'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-zinc-500 flex flex-col items-center gap-1.5">
                                    <Info size={18} className="opacity-40" />
                                    <p className="text-[11px]">Select any element in the active canvas to inspect or rotate its states.</p>
                                </div>
                            )}
                        </div>

                        {/* Live Register/Simulator Console Log */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 p-4">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Simulated CPU Register Log</span>
                            <div className="flex-1 bg-zinc-900/60 border border-zinc-900 rounded-xl p-3 font-mono text-[10px] overflow-y-auto space-y-1.5 leading-relaxed text-zinc-400">
                                {simLog.map((log, idx) => (
                                    <div key={idx} className="border-l-2 border-indigo-500/30 pl-2">
                                        <span className="text-zinc-600">[{idx}]</span> {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'okse' ? (
                <OkseSandbox />
            ) : (
                /* Theory & Specifications Tab */
                <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">The Concept: qpdb Visual Computation</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                            A computer architecture designed around mechanical and visual representation rather than hidden binary gates. 
                            Information is physically laid out in 2D Space using basic symmetry, sequence structures, and nested bounding walls.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 4 Pillars */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                            <h3 className="font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-2"><Cpu size={16} className="text-emerald-400" /> Architectural Pillars</h3>
                            <div className="space-y-3 font-sans text-xs text-zinc-400">
                                <div>
                                    <strong className="text-zinc-200">1. On/Off States:</strong>
                                    <p className="mt-0.5">The circle acts as the 1-bit atomic state. A basic closed container.</p>
                                </div>
                                <div>
                                    <strong className="text-zinc-200">2. Orientation (+ Position):</strong>
                                    <p className="mt-0.5">The stem gives the circle angular direction, encoding up to 8 states (0° to 315°), dramatically increasing data density.</p>
                                </div>
                                <div>
                                    <strong className="text-zinc-200">3. Sequencing (Chaining):</strong>
                                    <p className="mt-0.5">Atoms are chained in logical series (e.g., <code className="text-indigo-400 font-mono text-xs">qpdb</code>). Linear instruction arrays.</p>
                                </div>
                                <div>
                                    <strong className="text-zinc-200">4. Stacking (2D Grouping / Pods):</strong>
                                    <p className="mt-0.5">Enclosing chains inside pods (brackets like <code className="text-indigo-400 font-mono text-xs">{"{}"}</code> or <code className="text-indigo-400 font-mono text-xs">{"[]"}</code>) clusters operations inside safe isolated scopes.</p>
                                </div>
                            </div>
                        </div>

                        {/* Symbol Dictionary */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                            <h3 className="font-bold text-white border-b border-zinc-800 pb-2">Synapse Alphabet</h3>
                            <div className="space-y-2 h-64 overflow-y-auto no-scrollbar">
                                {SYMBOL_DOCS.map((doc, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-1 border-b border-zinc-800/40 text-xs">
                                        <span className="font-bold font-mono text-indigo-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 shrink-0">{doc.char}</span>
                                        <span className="text-zinc-400 font-sans text-right">{doc.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Recursive Component to Render Nesting of Pods and Atoms
interface ListRendererProps {
    nodes: QpdbNode[];
    currentStepIndex: number;
    flatNodes: QpdbNode[];
    selectedNodeId: string | null;
    onNodeClick: (id: string) => void;
}

const QpdbListRenderer: React.FC<ListRendererProps> = ({ nodes, currentStepIndex, flatNodes, selectedNodeId, onNodeClick }) => {
    return (
        <>
            {nodes.map((node) => {
                if (node.type === 'pod') {
                    const colorClasses = 
                        node.bracketType === 'curly' ? 'border-indigo-500/50 bg-indigo-950/5' :
                        node.bracketType === 'square' ? 'border-purple-500/50 bg-purple-950/5' :
                        'border-emerald-500/50 bg-emerald-950/5';
                    
                    const titleText = 
                        node.bracketType === 'curly' ? 'Curly Pod' :
                        node.bracketType === 'square' ? 'Square Capsule' :
                        'Angle Cell';

                    return (
                        <div 
                            key={node.id} 
                            className={`flex flex-col rounded-2xl border ${colorClasses} p-3 min-w-[140px] max-w-full shadow-lg border-dashed animate-in zoom-in-95 duration-200 relative`}
                        >
                            <span className="absolute -top-2.5 left-3 text-[8px] font-black uppercase tracking-wider bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800/80 text-zinc-500">
                                {titleText}
                            </span>
                            <div className="flex flex-wrap items-center gap-3 justify-center pt-2">
                                <QpdbListRenderer 
                                    nodes={node.children || []} 
                                    currentStepIndex={currentStepIndex}
                                    flatNodes={flatNodes}
                                    selectedNodeId={selectedNodeId}
                                    onNodeClick={onNodeClick}
                                />
                            </div>
                        </div>
                    );
                }

                if (node.type === 'link') {
                    const stepIdx = flatNodes.findIndex(n => n.id === node.id);
                    const isExecuting = stepIdx !== -1 && stepIdx === currentStepIndex;

                    return (
                        <div 
                            key={node.id}
                            onClick={() => onNodeClick(node.id)}
                            className={`cursor-pointer transition-all shrink-0 flex items-center justify-center p-1 rounded hover:bg-zinc-800/50 ${
                                selectedNodeId === node.id ? 'ring-1 ring-indigo-500' : ''
                            } ${isExecuting ? 'text-green-400 scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            <QpdbLinkIcon char={node.value} isExecuting={isExecuting} />
                        </div>
                    );
                }

                // Default is single Atom
                const stepIdx = flatNodes.findIndex(n => n.id === node.id);
                const isExecuting = stepIdx !== -1 && stepIdx === currentStepIndex;

                return (
                    <div 
                        key={node.id}
                        onClick={() => onNodeClick(node.id)}
                        className={`cursor-pointer transition-all shrink-0 ${
                            selectedNodeId === node.id ? 'scale-105 ring-2 ring-indigo-500/50 rounded-xl bg-zinc-900/80' : ''
                        }`}
                    >
                        <QpdbAtomIcon 
                            char={node.value} 
                            active={node.active} 
                            isExecuting={isExecuting} 
                        />
                    </div>
                );
            })}
        </>
    );
};

// Renders the precise geometric glyph
interface AtomIconProps {
    char: string;
    active?: boolean;
    isExecuting: boolean;
}

const QpdbAtomIcon: React.FC<AtomIconProps> = ({ char, active, isExecuting }) => {
    const angle = STEM_ANGLES[char.toLowerCase()];
    
    // Calculate polar coordinate boundary endpoints
    const getStemCoords = (angleDeg: number | undefined) => {
        if (angleDeg === undefined) return null;
        // Standard geometric layout clockwise
        const rad = (angleDeg * Math.PI) / 180;
        const x1 = 24 + 10 * Math.cos(rad);
        const y1 = 24 + 10 * Math.sin(rad);
        const x2 = 24 + 22 * Math.cos(rad);
        const y2 = 24 + 22 * Math.sin(rad);
        return { x1, y1, x2, y2 };
    };

    const stem = getStemCoords(angle);

    // Color theme calculations
    const glowClasses = isExecuting 
        ? 'stroke-green-400 filter drop-shadow-[0_0_4px_rgba(74,222,128,0.8)]' 
        : active 
        ? 'stroke-indigo-400 filter drop-shadow-[0_0_3px_rgba(129,140,248,0.5)]' 
        : 'stroke-zinc-700';

    const circleFill = isExecuting 
        ? 'fill-green-950/40' 
        : active 
        ? 'fill-indigo-950/20' 
        : 'fill-zinc-950/60';

    return (
        <div className="relative group flex flex-col items-center gap-1">
            <svg width="48" height="48" viewBox="0 0 48 48" className="transition-all hover:scale-110 duration-150">
                {/* Outer Glow Ring */}
                {isExecuting && (
                    <circle cx="24" cy="24" r="14" className="stroke-green-400/20 fill-none stroke-[3] animate-ping" />
                )}
                
                {/* Main Atom Circle */}
                <circle 
                    cx="24" 
                    cy="24" 
                    r="10" 
                    className={`stroke-[2.5] transition-all duration-300 ${glowClasses} ${circleFill}`} 
                />

                {/* Optional Internal Central Bit Core */}
                {active && (
                    <circle cx="24" cy="24" r="3" className={isExecuting ? 'fill-green-400' : 'fill-indigo-400'} />
                )}

                {/* Rotational stem line */}
                {stem && (
                    <line 
                        x1={stem.x1} 
                        y1={stem.y1} 
                        x2={stem.x2} 
                        y2={stem.y2} 
                        className={`stroke-[2.5] stroke-linecap-round transition-all duration-300 ${glowClasses}`}
                    />
                )}

                {/* Custom geometric decorations for other characters if present */}
                {char === 'o' || char === 'O' ? (
                    <circle cx="24" cy="24" r="14" className={`stroke-[1.5] stroke-dashed ${glowClasses} fill-none opacity-30`} />
                ) : null}
            </svg>
            <span className={`text-[8px] font-bold ${isExecuting ? 'text-green-400' : active ? 'text-indigo-400' : 'text-zinc-600'}`}>{char}</span>
        </div>
    );
};

// Renders connecting synapse routes
interface LinkIconProps {
    char: string;
    isExecuting: boolean;
}

const QpdbLinkIcon: React.FC<LinkIconProps> = ({ char, isExecuting }) => {
    const strokeClass = isExecuting 
        ? 'stroke-green-400 filter drop-shadow-[0_0_3px_rgba(74,222,128,0.8)]' 
        : 'stroke-zinc-700 group-hover:stroke-zinc-500';

    return (
        <div className="group flex items-center justify-center h-12 w-8">
            <svg width="32" height="48" viewBox="0 0 32 48" className="transition-all">
                {char === '~' ? (
                    /* Sine Oscillator wave shape */
                    <path 
                        d="M 2 24 Q 8 10, 16 24 T 30 24" 
                        fill="none" 
                        className={`stroke-[2] stroke-linecap-round ${strokeClass}`} 
                    />
                ) : char === '=' ? (
                    /* Double Connection bridge */
                    <>
                        <line x1="2" y1="21" x2="30" y2="21" className={`stroke-[2] ${strokeClass}`} />
                        <line x1="2" y1="27" x2="30" y2="27" className={`stroke-[2] ${strokeClass}`} />
                    </>
                ) : (
                    /* Core linear synapse line */
                    <line 
                        x1="2" 
                        y1="24" 
                        x2="30" 
                        y2="24" 
                        className={`stroke-[2] stroke-linecap-round ${strokeClass}`} 
                    />
                )}
            </svg>
        </div>
    );
};
