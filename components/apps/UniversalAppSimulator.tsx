import React, { useState, useEffect, useRef } from 'react';
import { 
    Send, HardDrive, Braces, Eye, ShieldCheck, ClipboardList, DollarSign, Building, Music, 
    Sliders, Video, Palette, Mic, Loader, RefreshCw, PlayCircle, FolderOpen, Users, Trophy, 
    Target, Disc, Map, Sparkles, Volume2, Globe, Check, Plus, AlertTriangle, Play, Pause,
    Database, Shield, HelpCircle, Terminal, Laptop, Settings, Search, ArrowRight, Star,
    Archive, Zap, Cpu, Box, Minus, Square,
    FileText, Smartphone, Download, SkipBack, SkipForward, Link2, Layers
} from 'lucide-react';

interface SimulatorProps {
    appId: string;
    appName: string;
    initialUrl?: string;
}

export const UniversalAppSimulator: React.FC<SimulatorProps> = ({ appId, appName, initialUrl }) => {
    const [mode, setMode] = useState<'simulator' | 'iframe'>('simulator');
    const [urlInput, setUrlInput] = useState(initialUrl || `https://ais-dev-bpnlavv7oycjvturfkgjwa-990435940105.europe-west2.run.app?app=${appId}`);
    const [activeUrl, setActiveUrl] = useState(initialUrl || `https://ais-dev-bpnlavv7oycjvturfkgjwa-990435940105.europe-west2.run.app?app=${appId}`);

    // --- CYBERNETIC67 (Telegram Replica) State ---
    const [telegramMessages, setTelegramMessages] = useState([
        { sender: 'White Rabbit', text: 'Sec audit complete. Codebase is clean.', time: '10:42 AM' },
        { sender: 'System Node', text: 'Sync handshake initialized with origin.', time: '10:43 AM' },
    ]);
    const [telegramInput, setTelegramInput] = useState('');

    // --- BuildVault State ---
    const [builds, setBuilds] = useState([
        { id: 'b1', name: 'v2.5.1-prod', size: '4.2 MB', status: 'deployed', date: 'Just now' },
        { id: 'b2', name: 'v2.5.0-rc3', size: '4.1 MB', status: 'compiled', date: '10 mins ago' },
    ]);
    const [vaultLogs, setVaultLogs] = useState<string[]>(['[VAULT] Ready for uploads.', '[VAULT] Connection status: secure']);

    // --- Prompt to JSON State ---
    const [jsonPrompt, setJsonPrompt] = useState('Create a cyberpunk space explorer profile with inventory');
    const [compiledJson, setCompiledJson] = useState('{\n  "metadata": "Input a prompt to generate structure"\n}');
    const [isCompilingJson, setIsCompilingJson] = useState(false);

    // --- Gemini Agentic Vision State ---
    const [selectedVisionImage, setSelectedVisionImage] = useState('medical_scan');
    const [visionAnalysis, setVisionAnalysis] = useState('Select an image to activate Agentic Vision scanning loop...');
    const [isVisionScanning, setIsVisionScanning] = useState(false);

    // --- Flash UI State ---
    const [flashPrompt, setFlashPrompt] = useState('Generate a premium dark mode contact card');
    const [flashCode, setFlashCode] = useState('// Your component code will compile here');
    const [isGeneratingUi, setIsGeneratingUi] = useState(false);

    // --- AI Data Resolver State ---
    const [resolverTranscript, setResolverTranscript] = useState('User: Bill says payment failed. Bill logs say account active. Database logs say card expired.');
    const [resolvedRecords, setResolvedRecords] = useState('Click resolve to merge conflicting customer records.');

    // --- Function Call Kitchen State ---
    const [kitchenSteps, setKitchenSteps] = useState<string[]>([]);
    const [kitchenActive, setKitchenActive] = useState(false);

    // --- Done & Dusted State ---
    const [chores, setChores] = useState([
        { task: 'Clean GPU server room fan grids', assign: 'Agent01', done: false },
        { task: 'Rotate database credentials', assign: 'White Rabbit', done: true },
        { task: 'Optimize WebGL canvas buffers', assign: 'System Node', done: false },
    ]);

    // --- Budgeted State ---
    const [expenses, setExpenses] = useState([
        { desc: 'Stripe API Webhook pipeline', amount: 45.00, paidBy: 'White Rabbit' },
        { desc: 'Ollama local RAM host nodes', amount: 120.00, paidBy: 'System Node' },
    ]);
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmt, setNewExpenseAmt] = useState('');

    // --- Lyria Studio State ---
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const [lyriaPrompt, setLyriaPrompt] = useState('Heavy retro sci-fi synthwave theme');

    // --- Zenith Chess AI State ---
    const [chessMoves, setChessMoves] = useState<string[]>(['1. e4 e5', '2. Nf3 Nc6']);
    const [aiDifficulty, setAiDifficulty] = useState('Grandmaster AI');

    // --- AI Radio State ---
    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const [radioChannel, setRadioChannel] = useState('Cyber Chiptunes FM');

    // --- Multiplayer Laser Tag State ---
    const [laserScore, setLaserScore] = useState(0);
    const [laserTargets, setLaserTargets] = useState<{ id: number; x: number; y: number }[]>([
        { id: 1, x: 20, y: 30 }, { id: 2, x: 70, y: 50 }, { id: 3, x: 45, y: 80 }
    ]);

    // Handle Telegram message send
    const handleSendTelegram = () => {
        if (!telegramInput.trim()) return;
        setTelegramMessages(prev => [...prev, { sender: 'You', text: telegramInput, time: 'Just now' }]);
        const input = telegramInput;
        setTelegramInput('');
        setTimeout(() => {
            setTelegramMessages(prev => [...prev, { 
                sender: 'White Rabbit', 
                text: `Acknowledged: "${input}". Syncing node telemetry...`, 
                time: 'Just now' 
            }]);
        }, 1000);
    };

    // Compile JSON action
    const handleCompileJson = () => {
        setIsCompilingJson(true);
        setTimeout(() => {
            setCompiledJson(JSON.stringify({
                status: "success",
                timestamp: new Date().toISOString(),
                prompt: jsonPrompt,
                entities: [
                    { name: "Atlas Core", class: "Explorer", level: 95 },
                    { item: "Hyperion Blade", potency: 0.98, energy: "plasma" }
                ],
                directives: ["AUDIT_WORKSPACE", "EXECUTE_SHIELD"]
            }, null, 2));
            setIsCompilingJson(false);
        }, 1200);
    };

    // Vision Analysis action
    const handleVisionScan = () => {
        setIsVisionScanning(true);
        setTimeout(() => {
            if (selectedVisionImage === 'medical_scan') {
                setVisionAnalysis('ANALYSIS RESULT:\n- Modality: MRI Axial brain scan\n- Structural Integrity: 99.4%\n- Recommendation: Cognitive neural link established. No major grid decay detected.');
            } else if (selectedVisionImage === 'satellite_maps') {
                setVisionAnalysis('ANALYSIS RESULT:\n- Location Coordinate: 37.7749° N, 122.4194° W\n- Terrain Classification: Ultra-dense urban workspace\n- Heat Signature: High multi-agent compile activity.');
            } else {
                setVisionAnalysis('ANALYSIS RESULT:\n- Hardware: NVIDIA Hopper architecture board\n- Transistor density: Optimum\n- Logic status: Code audit clean. No credential leak on visual copper.');
            }
            setIsVisionScanning(false);
        }, 1500);
    };

    // Flash UI compile action
    const handleGenerateUi = () => {
        setIsGeneratingUi(true);
        setTimeout(() => {
            setFlashCode(`// Compiled React Component for "${flashPrompt}"\n\nimport React from 'react';\n\nexport default function CompiledUI() {\n  return (\n    <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-xl">\n      <h4 className="text-sm font-bold text-indigo-400">Atlas Core</h4>\n      <p className="text-xs text-zinc-500 mt-1">Prompt: ${flashPrompt}</p>\n      <button className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs text-white rounded-lg font-semibold">\n        Access Portal\n      </button>\n    </div>\n  );\n}`);
            setIsGeneratingUi(false);
        }, 1400);
    };

    // Resolve transcripts
    const handleResolveData = () => {
        setResolvedRecords(JSON.stringify({
            resolvedEntity: "Bill Jefferson",
            uid: "usr_990435",
            primaryRecord: {
                paymentStatus: "ACTIVE",
                resolvedConflict: "Card updated manually from database record",
                mergedLogsCount: 3
            }
        }, null, 2));
    };

    // Simulated Kitchen Actions
    const handleKitchenAction = () => {
        setKitchenActive(true);
        setKitchenSteps(['[KITCHEN] Scanning active appliance nodes...']);
        setTimeout(() => setKitchenSteps(prev => [...prev, '[KITCHEN] Mounting smart toaster. Code: 0x992']), 500);
        setTimeout(() => setKitchenSteps(prev => [...prev, '[KITCHEN] Calibrating stove heater to 180C']), 1000);
        setTimeout(() => setKitchenSteps(prev => [...prev, '[KITCHEN] Tool Call: bake_cake(duration_seconds=300)']), 1500);
        setTimeout(() => setKitchenSteps(prev => [...prev, '[KITCHEN] SUCCESS: Agent finished recipe loop safely.']), 2000);
    };

    return (
        <div className="h-full w-full bg-zinc-950 flex flex-col overflow-hidden select-text">
            {/* Custom Browser Navigation Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between gap-3 shrink-0 select-none">
                <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                        onClick={() => setMode('simulator')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mode === 'simulator' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                    >
                        Simulator Demo
                    </button>
                    <button 
                        onClick={() => setMode('iframe')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mode === 'iframe' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                    >
                        Connect Live URL
                    </button>
                </div>

                <div className="flex-1 max-w-xl flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 text-[11px] font-mono text-zinc-500">
                    <Globe size={11} className="mr-2 text-zinc-600 shrink-0" />
                    <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none text-zinc-300 select-all"
                        placeholder="Enter Live App URL..."
                    />
                    <button 
                        onClick={() => { setActiveUrl(urlInput); setMode('iframe'); }}
                        className="p-1 hover:text-white transition-colors ml-1.5"
                    >
                        <ArrowRight size={11} />
                    </button>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-zinc-500">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span className="hidden sm:inline">SANDBOX_SECURE</span>
                </div>
            </div>

            {/* Main Application frame */}
            <div className="flex-1 min-h-0 relative">
                {mode === 'iframe' ? (
                    activeUrl ? (
                        <iframe
                            src={activeUrl}
                            className="w-full h-full border-none bg-zinc-950"
                            sandbox="allow-scripts allow-forms allow-popups"
                            referrerPolicy="no-referrer"
                            title={appName}
                        />
                    ) : null
                ) : (
                    /* SIMULATED INTERACTIVE WORKSPACES */
                    <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 flex flex-col justify-start">
                        
                        {/* 1. CYBERNETIC67 (Telegram Replica) */}
                        {appId.includes('cybernetic67') && (
                            <div className="max-w-4xl mx-auto w-full flex flex-col h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8.5 h-8.5 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xs text-white">WR</div>
                                        <div>
                                            <h4 className="font-bold text-xs text-white">CYBERNETIC67 Security</h4>
                                            <p className="text-[10px] text-emerald-400">online (White Rabbit bot)</p>
                                        </div>
                                    </div>
                                    <Shield size={16} className="text-indigo-400" />
                                </div>
                                <div className="flex-1 p-4 space-y-3 overflow-y-auto font-sans text-xs">
                                    {telegramMessages.map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-3 rounded-2xl max-w-md ${msg.sender === 'You' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                                                <div className="font-bold text-[9px] text-zinc-400 mb-0.5">{msg.sender}</div>
                                                <div>{msg.text}</div>
                                                <div className="text-[8px] text-zinc-500 text-right mt-1">{msg.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={telegramInput}
                                        onChange={e => setTelegramInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendTelegram()}
                                        placeholder="Broadcast secure message to cybernetic node..."
                                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    />
                                    <button 
                                        onClick={handleSendTelegram}
                                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all shadow-md"
                                    >
                                        <Send size={15} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 2. BuildVault */}
                        {appId.includes('build_vault') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-5 h-[500px]">
                                <div className="md:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                                <HardDrive size={16} className="text-amber-400" />
                                                Active Application BuildVault
                                            </h4>
                                            <span className="text-[9px] font-mono bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-amber-300 rounded">2 Active Builds</span>
                                        </div>

                                        <div className="space-y-2.5">
                                            {builds.map(b => (
                                                <div key={b.id} className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-850 flex items-center justify-between gap-3 text-xs">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                                            <Archive size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-zinc-200 font-mono">{b.name}</div>
                                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Size: {b.size} • Compiled safely</div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded ${b.status === 'deployed' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'}`}>{b.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            const id = `b_${Date.now()}`;
                                            setBuilds(prev => [{ id, name: `v3.0.0-draft-${prev.length + 1}`, size: '4.8 MB', status: 'compiled', date: 'Just now' }, ...prev]);
                                            setVaultLogs(prev => [...prev, `[VAULT] Staging directory bundle compiled successfully: v3.0.0-draft`]);
                                        }}
                                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/10"
                                    >
                                        Upload New Release Build Artifact
                                    </button>
                                </div>

                                <div className="md:col-span-5 bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider mb-2">Vault Audit Logs</span>
                                    <div className="flex-1 bg-black p-3 rounded-xl border border-zinc-900 font-mono text-[10px] text-zinc-400 overflow-y-auto space-y-1 select-all">
                                        {vaultLogs.map((l, idx) => <div key={idx}>{l}</div>)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Prompt to JSON */}
                        {appId.includes('prompt-to-json') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                                        <Braces size={16} className="text-purple-400" />
                                        Prompt to Structured JSON
                                    </h4>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-mono uppercase text-zinc-500">Image/Scene Prompt Description</span>
                                        <textarea 
                                            value={jsonPrompt}
                                            onChange={e => setJsonPrompt(e.target.value)}
                                            rows={4}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 font-mono resize-none"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleCompileJson}
                                        disabled={isCompilingJson || !jsonPrompt.trim()}
                                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/15"
                                    >
                                        {isCompilingJson ? <RefreshCw className="animate-spin" size={13} /> : <Sparkles size={13} />}
                                        <span>{isCompilingJson ? 'Compiling Schema...' : 'Synthesize Detailed JSON'}</span>
                                    </button>
                                </div>

                                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 flex flex-col justify-between h-[340px]">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider block">Compiled JSON Document Output</span>
                                    <pre className="flex-1 bg-black/50 p-4 rounded-xl border border-zinc-900/60 font-mono text-[10.5px] text-purple-300 overflow-auto select-all leading-relaxed whitespace-pre mt-3">
                                        {compiledJson}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* 4. Gemini Agentic Vision */}
                        {appId.includes('agentic-vision') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-5">
                                <div className="md:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                                        <Eye size={16} className="text-cyan-400" />
                                        Agentic Vision Scanner
                                    </h4>
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-mono uppercase text-zinc-500">Select Input Telemetry Asset</span>
                                        <div className="grid grid-cols-1 gap-2 text-xs">
                                            {[
                                                { id: 'medical_scan', label: '🧠 Neural Axial MRI Scan' },
                                                { id: 'satellite_maps', label: '🛰️ Workspace Grid Maps' },
                                                { id: 'silicon_wafer', label: '🔌 Hopper Transistor Layout' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSelectedVisionImage(opt.id)}
                                                    className={`p-3 rounded-xl border text-left transition-all font-semibold ${selectedVisionImage === opt.id ? 'bg-cyan-600/10 border-cyan-500 text-cyan-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-750'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleVisionScan}
                                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-1.5"
                                    >
                                        <Sparkles size={13} className={isVisionScanning ? 'animate-spin' : ''} />
                                        <span>{isVisionScanning ? 'Scanning Telemetry...' : 'Engage Vision Scan'}</span>
                                    </button>
                                </div>

                                <div className="md:col-span-7 bg-zinc-950 border border-zinc-850 rounded-2xl p-5 flex flex-col h-[340px] justify-between">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider block">Annotated Scan Report Viewport</span>
                                    <div className="flex-1 bg-black/60 p-4 rounded-xl border border-zinc-900 font-mono text-[11px] text-emerald-400 overflow-y-auto whitespace-pre-wrap mt-3 leading-relaxed">
                                        {visionAnalysis}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. Flash UI */}
                        {appId.includes('flash-ui') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                                        <Zap size={16} className="text-indigo-400 animate-pulse" />
                                        Flash UI Code Gen Engine
                                    </h4>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-mono uppercase text-zinc-500">Component Design Intent</span>
                                        <textarea 
                                            value={flashPrompt}
                                            onChange={e => setFlashPrompt(e.target.value)}
                                            rows={3}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono resize-none"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleGenerateUi}
                                        disabled={isGeneratingUi || !flashPrompt.trim()}
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10"
                                    >
                                        {isGeneratingUi ? <RefreshCw className="animate-spin" size={13} /> : <Cpu size={13} />}
                                        <span>{isGeneratingUi ? 'Evolving UI Components...' : 'Compile UI Component'}</span>
                                    </button>
                                </div>

                                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 flex flex-col justify-between h-[320px]">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider block">Generated React Code Sandbox</span>
                                    <pre className="flex-1 bg-black/40 p-4 rounded-xl border border-zinc-900 font-mono text-[10.5px] text-zinc-300 overflow-auto select-all whitespace-pre mt-3 leading-relaxed">
                                        {flashCode}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* 6. Remix: Data Resolver */}
                        {appId.includes('data-resolver') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                                        <Database size={16} className="text-emerald-400" />
                                        Data Resolver & Ledger Reconciliation
                                    </h4>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-mono uppercase text-zinc-500">Unstructured Conflict Transcripts</span>
                                        <textarea 
                                            value={resolverTranscript}
                                            onChange={e => setResolverTranscript(e.target.value)}
                                            rows={4}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono resize-none leading-relaxed"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleResolveData}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md"
                                    >
                                        Reconcile & Merge Conflicting Nodes
                                    </button>
                                </div>

                                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 flex flex-col justify-between h-[340px]">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider block">Resolved Clean Database Entry JSON</span>
                                    <pre className="flex-1 bg-black p-4 rounded-xl border border-zinc-900 font-mono text-[10.5px] text-emerald-300 overflow-auto select-all mt-3 whitespace-pre">
                                        {resolvedRecords}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* 7. Function Call Kitchen */}
                        {appId.includes('function-call-kitchen') && (
                            <div className="max-w-4xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                        <Cpu size={16} className="text-amber-500" />
                                        Agentic Function Call Kitchen
                                    </h4>
                                    <span className="text-[9px] font-mono uppercase bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-amber-400 rounded">100 simulated appliances</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button 
                                        onClick={handleKitchenAction}
                                        className="p-4 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-xl text-left space-y-2 group transition-all"
                                    >
                                        <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500 text-lg font-bold group-hover:scale-105 transition-transform">🍞</div>
                                        <div className="font-bold text-xs text-white">Bake Bread Agentic Pipeline</div>
                                        <p className="text-[10px] text-zinc-500">Initiates toast oven parameters and triggers bake_toast() function loop.</p>
                                    </button>

                                    <button 
                                        onClick={handleKitchenAction}
                                        className="p-4 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-xl text-left space-y-2 group transition-all"
                                    >
                                        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-500 text-lg font-bold group-hover:scale-105 transition-transform">🍳</div>
                                        <div className="font-bold text-xs text-white">Stove Temp Controller</div>
                                        <p className="text-[10px] text-zinc-500">Auto calibrates stove induction elements to safe temperatures.</p>
                                    </button>

                                    <button 
                                        onClick={handleKitchenAction}
                                        className="p-4 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-xl text-left space-y-2 group transition-all"
                                    >
                                        <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center text-cyan-500 text-lg font-bold group-hover:scale-105 transition-transform">🍰</div>
                                        <div className="font-bold text-xs text-white">Simulated Kitchen Assistant</div>
                                        <p className="text-[10px] text-zinc-500">Parallel triggers 100 tools via multi-model Gemini function calling.</p>
                                    </button>
                                </div>

                                {kitchenActive && (
                                    <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-850 font-mono text-[10px] text-zinc-400 space-y-1.5 h-[140px] overflow-auto select-all">
                                        {kitchenSteps.map((s, i) => <div key={i}>{s}</div>)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 8. Done & Dusted */}
                        {appId.includes('done-and-dusted') && (
                            <div className="max-w-4xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                        <ClipboardList size={16} className="text-blue-400" />
                                        Done & Dusted - Collaborative Chore Grid
                                    </h4>
                                    <button 
                                        onClick={() => {
                                            const task = prompt('Enter new shared chore task name:');
                                            if (task) {
                                                setChores(prev => [...prev, { task, assign: 'System Node', done: false }]);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition-all"
                                    >
                                        <Plus size={10} />
                                        <span>Add Chore</span>
                                    </button>
                                </div>

                                <div className="space-y-2 text-xs">
                                    {chores.map((chore, idx) => (
                                        <div key={idx} className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 flex items-center justify-between gap-3 group">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => setChores(prev => prev.map((c, i) => i === idx ? { ...c, done: !c.done } : c))}
                                                    className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${chore.done ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-zinc-700 hover:border-zinc-500'}`}
                                                >
                                                    {chore.done && <Check size={11} />}
                                                </button>
                                                <span className={`font-semibold ${chore.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>{chore.task}</span>
                                            </div>
                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 font-bold uppercase">{chore.assign}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 9. Budgeted - Shared Expense Tracker */}
                        {appId.includes('budgeted') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-5">
                                <div className="md:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                                        <DollarSign size={16} className="text-emerald-400" />
                                        Budgeted Ledger Core
                                    </h4>

                                    <div className="space-y-2 text-xs max-h-[180px] overflow-auto">
                                        {expenses.map((e, idx) => (
                                            <div key={idx} className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 flex items-center justify-between text-zinc-300 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-400 font-bold">$</span>
                                                    <span>{e.desc}</span>
                                                </div>
                                                <div className="font-bold text-white">${e.amount.toFixed(2)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <input 
                                            placeholder="Expense item..." 
                                            value={newExpenseDesc} 
                                            onChange={e => setNewExpenseDesc(e.target.value)}
                                            className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-300 focus:outline-none" 
                                        />
                                        <input 
                                            placeholder="Amount ($)..." 
                                            type="number"
                                            value={newExpenseAmt} 
                                            onChange={e => setNewExpenseAmt(e.target.value)}
                                            className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-300 focus:outline-none" 
                                        />
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (!newExpenseDesc || !newExpenseAmt) return;
                                            setExpenses(prev => [...prev, { desc: newExpenseDesc, amount: parseFloat(newExpenseAmt), paidBy: 'You' }]);
                                            setNewExpenseDesc('');
                                            setNewExpenseAmt('');
                                        }}
                                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-xs font-bold shadow-md"
                                    >
                                        Log Expense Node
                                    </button>
                                </div>

                                <div className="md:col-span-5 bg-zinc-950 border border-zinc-850 rounded-2xl p-5 flex flex-col justify-center items-center text-center">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider mb-2">Total Shared Balance</span>
                                    <div className="text-4xl font-black text-white font-mono tracking-tight">
                                        ${expenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-2 font-mono">Calculated safely across database ledger nodes.</p>
                                </div>
                            </div>
                        )}

                        {/* 10. Sky Metropolis */}
                        {appId.includes('sky-metropolis') && (
                            <div className="max-w-4xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                        <Building size={16} className="text-indigo-400" />
                                        Sky Metropolis Simulator
                                    </h4>
                                    <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-emerald-400">MAYOR MODE STATUS: STABLE</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                                        <span className="text-zinc-500 text-[9px] font-mono uppercase">Energy Node Grid</span>
                                        <div className="text-lg font-bold text-white font-mono mt-0.5">99.2%</div>
                                    </div>
                                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                                        <span className="text-zinc-500 text-[9px] font-mono uppercase">Metropolis Population</span>
                                        <div className="text-lg font-bold text-white font-mono mt-0.5">4,812</div>
                                    </div>
                                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                                        <span className="text-zinc-500 text-[9px] font-mono uppercase">Water Infrastructure</span>
                                        <div className="text-lg font-bold text-white font-mono mt-0.5">94.8%</div>
                                    </div>
                                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                                        <span className="text-zinc-500 text-[9px] font-mono uppercase">Eco Index</span>
                                        <div className="text-lg font-bold text-white font-mono mt-0.5">A+</div>
                                    </div>
                                </div>

                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2 text-xs">
                                    <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold">Active Directive from Gemini:</span>
                                    <p className="text-zinc-300 italic leading-relaxed">
                                        "Optimize visual viewport layout in District 5, configure central solar grids to handle high-performance mathematical iterations."
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 11. Lyria Studio & PromptDJ MIDI */}
                        {appId.includes('lyria') && (
                            <div className="max-w-4xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                        <Music size={16} className="text-pink-400 animate-pulse" />
                                        Lyria AI Audio Synthesis Workbench
                                    </h4>
                                    <button 
                                        onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow transition-all ${isMusicPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-pink-600 hover:bg-pink-500'}`}
                                    >
                                        {isMusicPlaying ? <Pause size={12} /> : <Play size={12} />}
                                        <span>{isMusicPlaying ? 'Halt Waveforms' : 'Synthesize Track'}</span>
                                    </button>
                                </div>

                                <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-850 flex flex-col items-center justify-center space-y-4">
                                    <div className="flex items-center gap-1.5 h-14">
                                        {[...Array(14)].map((_, idx) => (
                                            <span 
                                                key={idx} 
                                                className={`w-1.5 bg-gradient-to-t from-pink-500 to-indigo-500 rounded-full transition-all duration-300 ${isMusicPlaying ? 'animate-bounce' : 'h-3'}`}
                                                style={{ 
                                                    height: isMusicPlaying ? `${20 + Math.random() * 35}px` : '8px',
                                                    animationDelay: `${idx * 80}ms`
                                                }}
                                            />
                                        ))}
                                    </div>

                                    <div className="w-full max-w-md space-y-2.5 text-xs text-center">
                                        <span className="text-[9px] font-mono text-zinc-500 uppercase">Input Audio Prompt directive</span>
                                        <input 
                                            value={lyriaPrompt}
                                            onChange={e => setLyriaPrompt(e.target.value)}
                                            className="w-full text-center bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-300 outline-none focus:border-pink-500 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 12. Zenith Chess AI */}
                        {appId.includes('chess') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-5 h-[400px]">
                                <div className="md:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                        <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                            <Trophy size={16} className="text-yellow-400" />
                                            Zenith Chess AI Tournament Node
                                        </h4>
                                        <select 
                                            value={aiDifficulty} 
                                            onChange={e => setAiDifficulty(e.target.value)}
                                            className="bg-zinc-950 border border-zinc-800 rounded text-xs px-2 py-1 text-zinc-300 font-semibold"
                                        >
                                            <option>Grandmaster AI</option>
                                            <option>Expert (Adaptive)</option>
                                            <option>Casual</option>
                                        </select>
                                    </div>

                                    {/* Virtual Chess Grid */}
                                    <div className="grid grid-cols-8 gap-1 aspect-square max-w-[240px] mx-auto my-3 border border-zinc-800 bg-zinc-950 p-1 rounded-xl">
                                        {[...Array(64)].map((_, idx) => {
                                            const row = Math.floor(idx / 8);
                                            const col = idx % 8;
                                            const isDark = (row + col) % 2 === 1;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`w-full aspect-square rounded flex items-center justify-center text-xs font-bold ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-900 text-zinc-500'}`}
                                                >
                                                    {row === 0 && col === 4 && <span className="text-amber-400 font-black">♚</span>}
                                                    {row === 7 && col === 4 && <span className="text-white font-black">♔</span>}
                                                    {row === 1 && <span className="text-amber-500">♟</span>}
                                                    {row === 6 && <span className="text-zinc-200">♙</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="md:col-span-5 bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider mb-2">Move Telemetry Logs</span>
                                    <div className="flex-1 bg-black p-3 rounded-xl border border-zinc-900 font-mono text-[10.5px] text-zinc-400 space-y-1">
                                        {chessMoves.map((m, i) => <div key={i}>{m}</div>)}
                                        <div className="text-emerald-400 animate-pulse mt-2">↳ AI is thinking...</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Additional Custom Apps Mockups */}
                        {appId.includes('prompt-dj-midi') && (
                            <div className="max-w-4xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                                    <Sliders className="text-rose-400" />
                                    <h4 className="font-bold text-white">PromptDJ MIDI Sequencer</h4>
                                </div>
                                <div className="grid grid-cols-8 gap-2">
                                    {Array.from({length: 32}).map((_, i) => (
                                        <div key={i} className={`h-12 rounded bg-zinc-800 border border-zinc-700 ${i % 3 === 0 ? 'bg-rose-500/20 border-rose-500/50' : ''}`}></div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {appId.includes('video-learning') && (
                            <div className="max-w-4xl mx-auto w-full grid grid-cols-3 gap-5">
                                <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-center h-64">
                                    <PlayCircle size={48} className="text-zinc-600" />
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                                    <h4 className="font-bold text-sm text-white">AI Transcript</h4>
                                    <div className="space-y-2 text-xs text-zinc-400">
                                        <p><span className="text-red-400">0:00</span> - Introduction to tensors...</p>
                                        <p><span className="text-red-400">1:15</span> - Matrix multiplication rules...</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('visual-computer') && (
                            <div className="max-w-md mx-auto w-full h-[600px] bg-zinc-900 border-[12px] border-zinc-800 rounded-[3rem] p-2 flex flex-col relative overflow-hidden">
                                <div className="w-32 h-6 bg-zinc-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-3xl z-10"></div>
                                <div className="flex-1 bg-gradient-to-br from-indigo-900 to-black rounded-2xl mt-4 p-4 grid grid-cols-4 gap-4 content-start pt-8">
                                    {Array.from({length: 12}).map((_, i) => (
                                        <div key={i} className="aspect-square bg-white/10 rounded-xl flex items-center justify-center"><Box size={20} className="text-white/50" /></div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {appId.includes('gemini-95') && (
                            <div className="max-w-4xl mx-auto w-full bg-[#008080] p-8 h-[500px]">
                                <div className="bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] p-1 shadow-lg max-w-lg mx-auto">
                                    <div className="bg-[#000080] text-white font-bold px-2 py-1 flex justify-between items-center text-sm">
                                        <span>Gemini Prompt.exe</span>
                                        <div className="flex gap-1"><div className="w-4 h-4 bg-[#c0c0c0] text-black text-xs text-center border-t border-l border-white border-b border-r border-[#808080]">X</div></div>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <p className="text-black text-sm">Enter prompt to bring idea to life:</p>
                                        <input type="text" className="w-full bg-white border-t-2 border-l-2 border-[#808080] border-b-2 border-r-2 border-white px-2 py-1 text-black text-sm" defaultValue="Create a retro styled OS window..." />
                                        <button className="bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] px-4 py-1 text-black text-sm active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white">Generate</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('echoscript') && (
                            <div className="max-w-4xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-8 flex flex-col items-center justify-center min-h-[400px]">
                                <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
                                    <Mic size={48} className="text-orange-500" />
                                </div>
                                <div className="flex items-center gap-1">
                                    {Array.from({length: 20}).map((_, i) => (
                                        <div key={i} className="w-2 bg-orange-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 40 + 10}px`, animationDelay: `${i * 0.1}s` }}></div>
                                    ))}
                                </div>
                                <p className="text-zinc-400 text-sm font-mono text-center">Listening for audio stream... <br/> [Transcribing to text]</p>
                            </div>
                        )}

                        {appId.includes('chat-with-docs') && (
                            <div className="max-w-5xl mx-auto w-full grid grid-cols-2 gap-0 h-[500px] border border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="bg-zinc-950 p-6 flex flex-col items-center justify-center border-r border-zinc-800 relative">
                                    <div className="w-3/4 h-5/6 bg-white/5 border border-white/10 rounded shadow-2xl flex flex-col p-8 space-y-4">
                                        <div className="w-1/2 h-4 bg-zinc-800 rounded"></div>
                                        <div className="w-full h-2 bg-zinc-800 rounded"></div>
                                        <div className="w-5/6 h-2 bg-zinc-800 rounded"></div>
                                        <div className="w-full h-2 bg-zinc-800 rounded"></div>
                                    </div>
                                    <div className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase">PDF Loaded</div>
                                </div>
                                <div className="bg-zinc-900 p-6 flex flex-col justify-between">
                                    <div className="space-y-4 flex flex-col">
                                        <div className="bg-zinc-800 p-3 rounded-lg text-sm text-zinc-200 self-start w-3/4">What does this document say about vector embeddings?</div>
                                        <div className="bg-blue-600/20 border border-blue-500/30 p-3 rounded-lg text-sm text-blue-200 self-end w-3/4">According to page 4, vector embeddings are generated using a 768-dimensional space...</div>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <input type="text" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none" placeholder="Ask a question..." />
                                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg"><Send size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('spinnerevolve') && (
                            <div className="max-w-4xl mx-auto w-full h-[400px] bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center space-y-8">
                                <div className="grid grid-cols-3 gap-8">
                                    <Loader size={48} className="text-amber-500 animate-spin" />
                                    <RefreshCw size={48} className="text-orange-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
                                    <Zap size={48} className="text-yellow-500 animate-bounce" />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-white text-lg">Evolutionary Spinner Generation</h3>
                                    <p className="text-zinc-500 text-sm mt-2">Breeding generation 402... Fitness score: 0.94</p>
                                </div>
                            </div>
                        )}

                        {appId.includes('action-replay') && (
                            <div className="max-w-4xl mx-auto w-full h-[400px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                                <div className="flex-1 bg-black relative flex items-center justify-center">
                                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/20 border border-red-500/50 px-3 py-1 rounded-full backdrop-blur-md">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                        <span className="text-red-500 text-xs font-bold uppercase">REC</span>
                                    </div>
                                </div>
                                <div className="h-20 bg-zinc-950 border-t border-zinc-800 flex items-center justify-center gap-6">
                                    <button className="text-zinc-400 hover:text-white"><Minus size={24} /></button>
                                    <button className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center text-white"><Play size={24} className="ml-1" /></button>
                                    <button className="text-zinc-400 hover:text-white"><Square size={20} /></button>
                                </div>
                            </div>
                        )}

                        {appId.includes('ask-the-manual') && (
                            <div className="max-w-4xl mx-auto w-full h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl flex overflow-hidden">
                                <div className="w-64 bg-zinc-950 border-r border-zinc-800 p-4 space-y-4">
                                    <div className="text-xs font-bold text-teal-500 uppercase tracking-wider mb-2">Manual Index</div>
                                    {['Installation', 'Configuration', 'Troubleshooting', 'API Reference', 'Advanced Tuning'].map((item, i) => (
                                        <div key={i} className="text-sm text-zinc-400 hover:text-white cursor-pointer py-1">{item}</div>
                                    ))}
                                </div>
                                <div className="flex-1 p-8 space-y-6">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                                        <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-teal-500" placeholder="Ask the manual anything..." />
                                    </div>
                                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-6">
                                        <h3 className="text-teal-400 font-bold mb-2">Did you know?</h3>
                                        <p className="text-zinc-300 text-sm leading-relaxed">The manual is powered by semantic search. You don't need to use exact keywords. Just describe the problem you're trying to solve.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('anywhere') && (
                            <div className="max-w-4xl mx-auto w-full h-[400px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative">
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                                    <Box size={120} className="text-sky-500/30" />
                                </div>
                                <div className="absolute bottom-6 right-6 bg-zinc-950/80 backdrop-blur border border-zinc-800 p-4 rounded-xl flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                        <span className="text-red-400 font-bold">X:</span> <span className="text-zinc-300">45.21</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                        <span className="text-green-400 font-bold">Y:</span> <span className="text-zinc-300">12.08</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                        <span className="text-blue-400 font-bold">Z:</span> <span className="text-zinc-300">-8.44</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('drive-explorer') && (
                            <div className="max-w-4xl mx-auto w-full h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex">
                                <div className="w-64 bg-zinc-950 border-r border-zinc-800 p-4 space-y-4">
                                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4">Google Drive</div>
                                    <div className="space-y-2">
                                        {['My Drive', 'Shared with me', 'Recent', 'Starred', 'Trash'].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white cursor-pointer px-2 py-1.5 rounded-lg hover:bg-zinc-800/50">
                                                <FolderOpen size={16} />
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 p-6">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="flex-1 relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                            <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Search in Drive..." />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-4">
                                        {Array.from({length: 8}).map((_, i) => (
                                            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-zinc-800/50 cursor-pointer">
                                                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                                                    <FileText size={24} />
                                                </div>
                                                <span className="text-xs text-zinc-300 text-center line-clamp-2">Project_Proposal_2026.pdf</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('agent-squad') && (
                            <div className="max-w-4xl mx-auto w-full h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
                                <div className="flex items-center gap-4 mb-8 pb-4 border-b border-zinc-800">
                                    <Users size={24} className="text-emerald-500" />
                                    <h2 className="text-lg font-bold text-white">Agent Squad Commander</h2>
                                    <div className="ml-auto flex gap-2">
                                        <button className="bg-emerald-600 text-white px-4 py-1.5 rounded-md text-sm font-semibold">Deploy Squad</button>
                                    </div>
                                </div>
                                <div className="flex-1 grid grid-cols-3 gap-6">
                                    {['Researcher (A1)', 'Coder (A2)', 'Reviewer (A3)'].map((role, i) => (
                                        <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                                <Cpu size={32} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-zinc-200">{role}</h3>
                                                <p className="text-xs text-zinc-500 mt-1">Status: Standby</p>
                                            </div>
                                            <div className="w-full bg-zinc-900 rounded-full h-1 mt-4">
                                                <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${Math.random() * 100}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {appId.includes('phone-wallpaper') && (
                            <div className="max-w-4xl mx-auto w-full h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/40 via-purple-900/20 to-zinc-900 pointer-events-none"></div>
                                <div className="w-[280px] h-[580px] bg-black border-[8px] border-zinc-800 rounded-[3rem] relative overflow-hidden shadow-2xl flex flex-col">
                                    <div className="w-32 h-6 bg-zinc-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-xl z-10"></div>
                                    <div className="flex-1 bg-gradient-to-b from-fuchsia-500 to-indigo-600"></div>
                                    <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-4 px-6">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"><Smartphone className="text-white" /></div>
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"><Download className="text-white" /></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('ai-radio') && (
                            <div className="max-w-md mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
                                <h2 className="text-xl font-black text-orange-500 tracking-widest mb-6">DIY RADIO</h2>
                                <div className="w-48 h-48 rounded-full border-[8px] border-zinc-800 bg-zinc-950 flex items-center justify-center relative shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 absolute center"></div>
                                    <div className="absolute w-full h-1 bg-orange-500/50 origin-left animate-spin" style={{ animationDuration: '4s', animationTimingFunction: 'linear' }}></div>
                                    <Volume2 size={40} className="text-orange-500/30" />
                                </div>
                                <div className="w-full mt-8 space-y-4">
                                    <div className="h-12 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center px-4 overflow-hidden relative">
                                        <div className="text-orange-500 text-xs font-mono whitespace-nowrap animate-[marquee_10s_linear_infinite]">
                                            Now Playing: Cosmic Synthesizer Frequency 432Hz • AI Generated Ambient • 
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center px-4">
                                        <button className="text-zinc-500 hover:text-white"><SkipBack size={24} /></button>
                                        <button className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/20"><Play size={32} className="ml-1" /></button>
                                        <button className="text-zinc-500 hover:text-white"><SkipForward size={24} /></button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('globe-3d') && (
                            <div className="max-w-4xl mx-auto w-full h-[500px] bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center">
                                <div className="w-[400px] h-[400px] rounded-full border border-teal-500/30 relative">
                                    <div className="absolute inset-0 rounded-full border border-teal-500/20" style={{ transform: 'rotateX(60deg)' }}></div>
                                    <div className="absolute inset-0 rounded-full border border-teal-500/20" style={{ transform: 'rotateY(60deg)' }}></div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-teal-500 rounded-full shadow-[0_0_15px_rgba(20,184,166,1)]"></div>
                                    
                                    {/* Random dots on the globe */}
                                    {Array.from({length: 12}).map((_, i) => {
                                        const angle = Math.random() * Math.PI * 2;
                                        const radius = Math.random() * 180;
                                        return (
                                            <div key={i} className="absolute w-1.5 h-1.5 bg-teal-300 rounded-full" 
                                                 style={{ 
                                                     top: `calc(50% + ${Math.sin(angle) * radius}px)`, 
                                                     left: `calc(50% + ${Math.cos(angle) * radius}px)` 
                                                 }} 
                                            />
                                        )
                                    })}
                                </div>
                                <div className="absolute top-6 left-6 text-teal-400 font-mono text-xs space-y-1">
                                    <div>LAT: 45.9128° N</div>
                                    <div>LNG: -12.3918° E</div>
                                    <div>ALT: 400KM</div>
                                </div>
                            </div>
                        )}

                        {appId.includes('iron-men-arcade') && (
                            <div className="max-w-3xl mx-auto w-full bg-zinc-900 border-[8px] border-red-900/50 rounded-[2rem] p-6 shadow-[0_0_40px_rgba(220,38,38,0.2)]">
                                <div className="bg-black border-4 border-zinc-800 rounded-xl h-[400px] relative overflow-hidden flex flex-col items-center justify-center">
                                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-red-600 tracking-tighter italic mb-8" style={{ textShadow: '0 4px 10px rgba(220,38,38,0.5)' }}>
                                        IRON MEN ARCADE
                                    </h1>
                                    <div className="text-white text-xl animate-pulse font-mono mb-12">INSERT COIN</div>
                                    <div className="absolute bottom-4 text-xs font-mono text-zinc-600">© 2026 CYBERNETIC ENTERTAINMENT</div>
                                </div>
                            </div>
                        )}

                        {appId.includes('diy-comic') && (
                            <div className="max-w-4xl mx-auto w-full h-[550px] bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex gap-6">
                                <div className="w-48 space-y-4 shrink-0">
                                    <div className="bg-violet-600 text-white font-bold text-center py-2 rounded-lg text-sm">New Panel</div>
                                    <div className="space-y-2">
                                        <div className="text-xs text-zinc-500 uppercase font-bold pl-1">Characters</div>
                                        {['Hero', 'Villain', 'Sidekick'].map(c => (
                                            <div key={c} className="bg-zinc-950 border border-zinc-800 p-2 rounded text-sm text-zinc-300 hover:border-violet-500 cursor-pointer">{c}</div>
                                        ))}
                                    </div>
                                    <div className="space-y-2 pt-4">
                                        <div className="text-xs text-zinc-500 uppercase font-bold pl-1">Speech Bubbles</div>
                                        <div className="bg-white rounded-[50%] p-4 text-black text-center text-xs font-bold w-full aspect-video flex items-center justify-center border-2 border-black relative">
                                            Text
                                            <div className="absolute -bottom-2 left-4 w-3 h-3 bg-white border-b-2 border-l-2 border-black rotate-45"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white rounded-lg border-4 border-black p-4 relative">
                                    <div className="absolute top-4 left-4 bg-yellow-400 border-2 border-black px-3 py-1 font-bold italic transform -rotate-2">MEANWHILE...</div>
                                    <div className="w-full h-full border-2 border-black border-dashed flex items-center justify-center text-zinc-300">
                                        Drag & Drop assets here
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('link-2-ink') && (
                            <div className="max-w-3xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="h-12 bg-zinc-950 flex items-center px-4 border-b border-zinc-800 gap-4">
                                    <Link2 className="text-cyan-500" size={20} />
                                    <span className="font-bold text-white text-sm">Link 2 Ink</span>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500" placeholder="Paste URL here..." defaultValue="https://example.com/article" />
                                        <button className="bg-cyan-600 text-white px-6 rounded-lg font-bold">Extract</button>
                                    </div>
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl h-64 p-6 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)]"></div>
                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                            <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                                                <Zap className="text-cyan-400" />
                                            </div>
                                            <div>
                                                <p className="text-cyan-400 font-mono text-sm">Processing HTML DOM...</p>
                                                <p className="text-zinc-500 text-xs mt-2">Converting semantics to raw ink representation</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('laser-tag') && (
                            <div className="max-w-4xl mx-auto w-full h-[500px] bg-zinc-950 border border-zinc-800 rounded-2xl p-8 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(220,38,38,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(220,38,38,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                                <div className="relative z-10 flex flex-col items-center h-full">
                                    <div className="flex w-full justify-between items-center mb-12">
                                        <div className="text-red-500 font-mono text-2xl font-bold bg-red-950/50 px-4 py-2 border border-red-900 rounded">04:59</div>
                                        <div className="flex gap-4">
                                            <div className="text-center">
                                                <div className="text-xs text-red-500 uppercase tracking-widest mb-1">Red Team</div>
                                                <div className="text-3xl font-black text-white text-shadow-red">4,250</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xs text-blue-500 uppercase tracking-widest mb-1">Blue Team</div>
                                                <div className="text-3xl font-black text-white text-shadow-blue">3,100</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 flex items-center justify-center w-full">
                                        <div className="relative w-64 h-64 border-2 border-red-500 rounded-full flex items-center justify-center">
                                            <div className="absolute inset-0 border border-red-500 rounded-full animate-ping opacity-20"></div>
                                            <Target size={48} className="text-red-500" />
                                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/50"></div>
                                            <div className="absolute left-1/2 top-0 h-full w-[1px] bg-red-500/50"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {appId.includes('interactive-artifact') && (
                            <div className="max-w-5xl mx-auto w-full h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl flex overflow-hidden">
                                <div className="w-1/3 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col">
                                    <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Layers className="text-emerald-500" size={20} /> Artifact Logic</h2>
                                    <div className="space-y-3 flex-1 overflow-y-auto">
                                        {[
                                            { name: 'State Management', type: 'React' },
                                            { name: 'Data Visualization', type: 'D3.js' },
                                            { name: 'Animation Physics', type: 'Framer' }
                                        ].map((item, i) => (
                                            <div key={i} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
                                                <div className="text-sm font-bold text-zinc-200">{item.name}</div>
                                                <div className="text-xs text-zinc-500 mt-1">{item.type}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-2/3 bg-zinc-100 flex items-center justify-center relative p-8">
                                    <div className="absolute top-4 right-4 bg-black/10 px-3 py-1 rounded text-xs font-mono text-black/60 font-bold">PREVIEW</div>
                                    <div className="w-full max-w-md space-y-6">
                                        <div className="h-8 w-3/4 bg-zinc-300 rounded"></div>
                                        <div className="h-4 w-full bg-zinc-200 rounded"></div>
                                        <div className="h-4 w-5/6 bg-zinc-200 rounded"></div>
                                        <div className="h-32 w-full bg-zinc-300 rounded-lg mt-4 flex items-end p-4 gap-2">
                                            {[40, 70, 45, 90, 65].map((h, i) => (
                                                <div key={i} className="flex-1 bg-emerald-500 rounded-t" style={{ height: `${h}%` }}></div>
                                            ))}
                                        </div>
                                        <button className="bg-emerald-600 text-white w-full py-3 rounded-lg font-bold shadow-lg mt-4">Interact</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fallback general template simulator */}
                        {!appId.includes('cybernetic67') && 
                         !appId.includes('build_vault') && 
                         !appId.includes('prompt-to-json') && 
                         !appId.includes('agentic-vision') && 
                         !appId.includes('flash-ui') && 
                         !appId.includes('data-resolver') && 
                         !appId.includes('function-call-kitchen') && 
                         !appId.includes('done-and-dusted') && 
                         !appId.includes('budgeted') && 
                         !appId.includes('sky-metropolis') && 
                         !appId.includes('lyria') && 
                         !appId.includes('chess') && 
                         !appId.includes('prompt-dj-midi') &&
                         !appId.includes('video-learning') &&
                         !appId.includes('visual-computer') &&
                         !appId.includes('gemini-95') &&
                         !appId.includes('echoscript') &&
                         !appId.includes('chat-with-docs') &&
                         !appId.includes('spinnerevolve') &&
                         !appId.includes('action-replay') &&
                         !appId.includes('ask-the-manual') &&
                         !appId.includes('anywhere') && 
                         !appId.includes('drive-explorer') && 
                         !appId.includes('agent-squad') && 
                         !appId.includes('phone-wallpaper') && 
                         !appId.includes('ai-radio') && 
                         !appId.includes('globe-3d') && 
                         !appId.includes('iron-men-arcade') && 
                         !appId.includes('diy-comic') && 
                         !appId.includes('link-2-ink') && 
                         !appId.includes('laser-tag') && 
                         !appId.includes('interactive-artifact') && (
                            <div className="max-w-3xl mx-auto w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-5 text-center shadow-2xl animate-scaleIn">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-500/20">
                                    {appName.substring(0, 2).toUpperCase()}
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-lg font-bold text-white">{appName} Workspace Simulator</h3>
                                    <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                        This app node is running in standboxed OS host pipelines. You can use the fully connected simulator below, or configure the actual Shared Deployment URL in the address bar above to embed the live iframe.
                                    </p>
                                </div>

                                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-850/60 max-w-md mx-auto space-y-4">
                                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                        <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold">Node Telemetry: ONLINE</span>
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    </div>
                                    <div className="flex justify-around items-center gap-4 text-xs">
                                        <button 
                                            onClick={() => alert(`Synchronizing ${appName} with central ledger...`)}
                                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
                                        >
                                            Trigger Sync Node
                                        </button>
                                        <button 
                                            onClick={() => alert(`Starting JSDoc code generation checklist...`)}
                                            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
                                        >
                                            Generate Document
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 font-mono">ID: {appId} • Sandbox Compile Node 3000</p>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};
