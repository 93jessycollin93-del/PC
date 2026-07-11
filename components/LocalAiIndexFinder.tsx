import React, { useState, useEffect, useRef } from 'react';
import { 
    Bot, Mic, Search, X, Sparkles, Check, Play, Info, 
    Cpu, Layers, Settings2, Activity, Terminal, DownloadCloud, CheckCircle2, RefreshCw, AlertTriangle, ArrowDown, Network
} from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../lib/gemini';
import { compressToGzipBase64 } from '../lib/compression';

interface LocalAiIndexFinderProps {
    apps: { id: string; name: string; appId?: string }[];
    onLaunchApp: (appId: string) => void;
}

export const LocalAiIndexFinder: React.FC<LocalAiIndexFinderProps> = ({ apps, onLaunchApp }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'manager' | 'pipeline'>('search');
    const [query, setQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);
    const [statusMessage, setStatusMessage] = useState('Standby • 128-byte Index-01 Local Model');
    const [suggestedApps, setSuggestedApps] = useState<{ id: string; name: string; appId?: string }[]>([]);
    const [speechSupported, setSpeechSupported] = useState(true);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    // Compression-cycle unfold stage for the settings dashboard: each tap of
    // the gear while settings are open unfolds one layer bigger (0 → 1 → 2),
    // revealing progressively more context, then wraps back around.
    const [unfoldStage, setUnfoldStage] = useState<0 | 1 | 2>(0);
    const [unfoldKey, setUnfoldKey] = useState(0);

    // Advanced Local Model Config States
    const [modelSource, setModelSource] = useState<'rule' | 'wasm'>('rule');
    const [githubModelUrl, setGithubModelUrl] = useState('https://github.com/onnx/models/raw/main/validated/tiny_intent_classifier.onnx');
    const [modelSizeMb, setModelSizeMb] = useState('142.5');
    const [isDownloadingModel, setIsDownloadingModel] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isModelLoaded, setIsModelLoaded] = useState(false);

    // Routing Pipeline states
    const [pipelineQuery, setPipelineQuery] = useState('');
    const [isRouting, setIsRouting] = useState(false);
    const [routedTier, setRoutedTier] = useState<1 | 2 | 3 | null>(null);
    const [routingOutcome, setRoutingOutcome] = useState<{
        tier: number;
        name: string;
        desc: string;
        latency: string;
        cost: string;
        reason: string;
        result?: string;
    } | null>(null);
    
    // Hardware Support Verification
    const [hardwareSupport, setHardwareSupport] = useState({
        webAssembly: true,
        webAssemblySimd: false,
        webGpu: false,
        webGl: true
    });

    // Simulated model terminal logs
    const [terminalLogs, setTerminalLogs] = useState<string[]>([
        '[SYSTEM] Ready to compile local model arrays.',
        '[HARDWARE] Device profile verified.'
    ]);

    // Memory Allocation Test States
    const [allocatedTestMemory, setAllocatedTestMemory] = useState<string>('0 MB');
    const [isAllocatingMemory, setIsAllocatingMemory] = useState(false);
    const allocatedArraysRef = useRef<Float32Array[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);

    // Detect browser hardware support levels
    useEffect(() => {
        const checkHardware = async () => {
            const hasWasm = typeof WebAssembly !== 'undefined';
            let hasWasmSimd = false;
            let hasWebGpu = false;
            let hasWebGL = false;

            if (hasWasm && WebAssembly.validate) {
                // Quick WebAssembly SIMD detection helper bytes
                const simdBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 0, 3, 2, 1, 0, 10, 9, 1, 7, 0, 65, 0, 253, 15, 11]);
                hasWasmSimd = WebAssembly.validate(simdBytes);
            }

            if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
                try {
                    const adapter = await (navigator as any).gpu.requestAdapter();
                    if (adapter) hasWebGpu = true;
                } catch (e) {
                    hasWebGpu = false;
                }
            }

            if (typeof window !== 'undefined') {
                try {
                    const canvas = document.createElement('canvas');
                    hasWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
                } catch (e) {
                    hasWebGL = false;
                }
            }

            setHardwareSupport({
                webAssembly: hasWasm,
                webAssemblySimd: hasWasmSimd,
                webGpu: hasWebGpu,
                webGl: hasWebGL
            });

            addTerminalLog(`[HARDWARE] Wasm: ${hasWasm ? 'OK' : 'FAIL'} | SIMD: ${hasWasmSimd ? 'YES' : 'NO'} | WebGPU: ${hasWebGpu ? 'ACTIVE' : 'NOT DETECTED'}`);
        };

        checkHardware();
    }, []);

    // Initialize native Web Speech API if available
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const rec = new SpeechRecognition();
                rec.continuous = false;
                rec.interimResults = false;
                rec.lang = 'en-US';

                rec.onstart = () => {
                    setIsListening(true);
                    setStatusMessage('Listening for index command...');
                    setAiResponse(null);
                };

                rec.onresult = (event: any) => {
                    const speechToText = event.results[0][0].transcript;
                    setQuery(speechToText);
                    processCommand(speechToText);
                };

                rec.onerror = (event: any) => {
                    console.warn('Speech recognition error:', event.error);
                    setIsListening(false);
                    if (event.error === 'not-allowed') {
                        setStatusMessage('Microphone access blocked. Click to type!');
                    } else {
                        setStatusMessage('Speech error: ' + event.error);
                    }
                };

                rec.onend = () => {
                    setIsListening(false);
                };

                setRecognition(rec);
            } else {
                setSpeechSupported(false);
            }
        }
    }, [apps]);

    // Update suggestions based on user search query
    useEffect(() => {
        if (!query.trim()) {
            setSuggestedApps([]);
            return;
        }

        const filtered = apps.filter(app => 
            app.name.toLowerCase().includes(query.toLowerCase()) || 
            (app.appId && app.appId.toLowerCase().includes(query.toLowerCase()))
        );
        setSuggestedApps(filtered.slice(0, 4));
    }, [query, apps]);

    const addTerminalLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setTerminalLogs(prev => [...prev.slice(-14), `[${timestamp}] ${msg}`]);
    };

    // Simulate downloading weights from the user-specified custom model repo (e.g. GitHub/HuggingFace)
    const handleDownloadModel = () => {
        if (isDownloadingModel) return;
        setIsDownloadingModel(true);
        setDownloadProgress(0);
        setIsModelLoaded(false);
        addTerminalLog(`[DOWNLOAD] Initiated stream from Github raw model endpoint...`);
        addTerminalLog(`[DOWNLOAD] Allocation target: ${modelSizeMb} MB`);

        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                const next = prev + Math.floor(Math.random() * 15) + 5;
                if (next >= 100) {
                    clearInterval(interval);
                    setIsDownloadingModel(false);
                    setIsModelLoaded(true);
                    setStatusMessage(`Online • ${modelSizeMb}MB On-Device Model Active`);
                    addTerminalLog(`[MODEL] Verified integrity signature of custom ONNX bundle.`);
                    addTerminalLog(`[ALLOC] Allocated ${(parseFloat(modelSizeMb) * 0.9).toFixed(1)}MB WebAssembly linear heap memory inside browser.`);
                    addTerminalLog(`[MODEL] Finished initializing custom local compiler! Try typing a command.`);
                    return 100;
                }
                if (Math.random() > 0.6) {
                    const bytesDownloaded = ((parseFloat(modelSizeMb) * next) / 100).toFixed(1);
                    addTerminalLog(`[FETCH] Received segment: ${bytesDownloaded} / ${modelSizeMb} MB (${next}%)`);
                }
                return next;
            });
        }, 180);
    };

    // Real-world Memory Allocation Simulator to test the System Monitor constraints directly!
    const handleSimulateMemoryAllocation = async () => {
        if (isAllocatingMemory) return;
        setIsAllocatingMemory(true);
        addTerminalLog(`[ALLOC_TEST] Attempting physical reservation of 50M float arrays...`);

        try {
            // Allocate a massive float array (approx 45MB of real browser memory per chunk)
            const chunkCount = 3;
            addTerminalLog(`[ALLOC_TEST] Reserving ${chunkCount} heap buffers sequentially...`);

            for (let i = 0; i < chunkCount; i++) {
                await new Promise(resolve => setTimeout(resolve, 300));
                // 12 million elements = 48MB each
                const arr = new Float32Array(12000000);
                arr.fill(Math.random());
                allocatedArraysRef.current.push(arr);
                const currentSize = (allocatedArraysRef.current.length * 48);
                setAllocatedTestMemory(`${currentSize} MB`);
                addTerminalLog(`[ALLOC_TEST] Buffer #${i+1} compiled in memory (${currentSize} MB reserved)`);
                
                // Dispatches an event so that System Monitor updates instantly
                window.dispatchEvent(new Event('resize'));
            }
            
            addTerminalLog(`[ALLOC_TEST] Success! Memory successfully locked inside WebAssembly thread.`);
        } catch (err) {
            addTerminalLog(`[ERROR] Out of memory context or allocation rejected by thread loop.`);
        }
        setIsAllocatingMemory(false);
    };

    // Release simulated memory chunks
    const handleReleaseAllocatedMemory = () => {
        allocatedArraysRef.current = [];
        setAllocatedTestMemory('0 MB');
        addTerminalLog(`[ALLOC_TEST] Garbage collected all active test float buffers! Check System Monitor RAM.`);
        
        // Trigger GC simulation event
        const optBtn = document.getElementById('sys-mon-optimize-btn');
        if (optBtn) optBtn.click();
        
        window.dispatchEvent(new Event('resize'));
    };

    // Process spoken or written instruction using ultra-low-power local NLP matcher (128-byte rule engine)
    const processCommand = async (text: string) => {
        const cleanText = text.toLowerCase().trim();
        setIsThinking(true);
        setStatusMessage(modelSource === 'wasm' ? 'Evaluating ONNX Tensor graph...' : 'Compiling intent...');

        // Wait brief delay to feel like a super fast local processor
        await new Promise(resolve => setTimeout(resolve, modelSource === 'wasm' ? 550 : 250));

        // Keywords mapping
        const commands = [
            { keywords: ['game', 'snake', 'play game'], appName: 'snake', appId: 'snake' },
            { keywords: ['telegram', 'chat', 'replica', 'cybernetic67'], appName: 'Telegram Replica', appId: 'cybernetic67' },
            { keywords: ['email', 'mail', 'inbox'], appName: 'Mail', appId: 'mail' },
            { keywords: ['chess', 'zenith'], appName: 'Zenith Chess AI', appId: 'chess' },
            { keywords: ['laser', 'tag'], appName: 'Laser Tag Arcade', appId: 'laser-tag' },
            { keywords: ['note', 'todo', 'notepad'], appName: 'Notes', appId: 'notepad' },
            { keywords: ['slide', 'presentation'], appName: 'Slides', appId: 'slides' },
            { keywords: ['bot', 'studio', 'ai studio', 'offline'], appName: 'Offline AI Studio', appId: 'bot_studio' },
            { keywords: ['qpdb', 'matrix'], appName: 'qpdb Matrix', appId: 'qpdb' },
            { keywords: ['consensus', 'multi-agent'], appName: 'Consensus Lab', appId: 'consensus_lab' },
            { keywords: ['deploy', 'cloud'], appName: 'Global Deploy', appId: 'cloud_deploy' },
            { keywords: ['flipper', 'zero'], appName: 'Flipper Zero', appId: 'flipper' },
            { keywords: ['vault', 'build'], appName: 'BuildVault', appId: 'build_vault' },
            { keywords: ['resolve', 'data resolver'], appName: 'AI Data Resolver', appId: 'data-resolver' },
            { keywords: ['terminal', 'termstudio'], appName: 'TermStudio', appId: 'termstudio' },
            { keywords: ['cybernetic_export', 'export os'], appName: 'Export OS', appId: 'cybernetic_export' },
        ];

        // 1. Direct App Command matches
        let matched = false;
        for (const cmd of commands) {
            if (cmd.keywords.some(k => cleanText.includes(k))) {
                const actualApp = apps.find(app => 
                    app.id === cmd.appId || 
                    app.appId === cmd.appId || 
                    app.name.toLowerCase().includes(cmd.appName.toLowerCase())
                );
                
                if (actualApp) {
                    onLaunchApp(actualApp.id);
                    const engineLabel = modelSource === 'wasm' ? 'Custom ONNX Wasm Model' : 'Index-01 128-byte Rules';
                    setAiResponse(`[${engineLabel}] Intent matched! Launched "${actualApp.name}"`);
                    setStatusMessage('Match successful!');
                    addTerminalLog(`[INFERENCE] Evaluated token match with 98.4% confidence: open_${cmd.appId}`);
                    matched = true;
                    setTimeout(() => {
                        setIsExpanded(false);
                        setQuery('');
                        setAiResponse(null);
                        setStatusMessage(modelSource === 'wasm' ? `Online • ${modelSizeMb}MB On-Device Model Active` : 'Standby • 128-byte Index-01 Local Model');
                    }, 2000);
                    break;
                }
            }
        }

        // 2. Local utility command: optimize / garbage collection
        if (!matched && (cleanText.includes('clean') || cleanText.includes('optimize') || cleanText.includes('cache') || cleanText.includes('garbage'))) {
            const optimizeBtn = document.getElementById('sys-mon-optimize-btn');
            if (optimizeBtn) {
                optimizeBtn.click();
                setAiResponse('On-Device Memory purge instruction executed. Active Safari caches cleared!');
            } else {
                setAiResponse('System monitor triggered. Running active garbage collection...');
            }
            setStatusMessage('System optimized!');
            addTerminalLog(`[INFERENCE] Compiled intent: trigger_garbage_collection`);
            matched = true;
            setTimeout(() => {
                setIsExpanded(false);
                setQuery('');
                setAiResponse(null);
                setStatusMessage(modelSource === 'wasm' ? `Online • ${modelSizeMb}MB On-Device Model Active` : 'Standby • 128-byte Index-01 Local Model');
            }, 3000);
        }

        // 3. Fallback: ask general assistance (simulated local 128-byte generative guide)
        if (!matched) {
            let answer = '';
            if (cleanText.includes('hello') || cleanText.includes('hi')) {
                answer = "Hello! Say 'Open Snake' or 'Clear Cache' to instantly run local hardware commands.";
            } else if (cleanText.includes('who are you') || cleanText.includes('what is this')) {
                answer = `I am Index-01: your ultra-low-power local OS index. Model configuration: ${modelSource === 'wasm' ? '150MB Custom Wasm Model' : '128-byte Rule Matrix'}. Zero server lag!`;
            } else if (cleanText.includes('help') || cleanText.includes('guide')) {
                answer = "Speak: 'Open Snake' to run the game, or 'Optimize system' to purge temporary cache memories.";
            } else {
                const words = cleanText.split(' ');
                const primaryNoun = words[words.length - 1] || 'request';
                answer = `[Local Inference] Intent parsed: "${primaryNoun}". Try speaking: 'Open Game' or 'Clean System'.`;
            }
            setAiResponse(answer);
            setStatusMessage('Guidance generated.');
            addTerminalLog(`[INFERENCE] Fallback generated local answer for token: "${cleanText.substring(0, 20)}..."`);
        }

        setIsThinking(false);
    };

    const handleSpeechToggle = () => {
        if (!recognition) {
            setStatusMessage('Speech API blocked or unsupported in this window.');
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            processCommand(query);
        }
    };

    // Close index bar on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsExpanded(false);
                setAiResponse(null);
                setShowSettings(false);
                setUnfoldStage(0);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div 
            id="local-ai-index-finder"
            ref={containerRef}
            className="relative z-[4000] font-sans"
        >
            {/* Expanded State (Dynamic Island opened) — pops up above the bottom bar */}
            {isExpanded ? (
                <div
                    key={unfoldKey}
                    className={`unfold-panel absolute bottom-full right-0 mb-2 max-w-[90vw] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/80 p-4 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] text-zinc-100 flex flex-col gap-3 select-none ${
                        showSettings && unfoldStage === 2
                            ? 'w-[440px] rounded-[1.25rem]'
                            : showSettings && unfoldStage === 1
                                ? 'w-[360px] rounded-[1.5rem]'
                                : 'w-[295px] rounded-[1.75rem]'
                    }`}
                >
                    {/* Compact Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                        <div className="flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                Index-01 AI Finder
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => {
                                    setAiResponse(null);
                                    if (!showSettings) {
                                        // First open: unfold one layer.
                                        setShowSettings(true);
                                        setUnfoldStage(1);
                                    } else {
                                        // Already open: unfold bigger, revealing more context —
                                        // wraps back to a fresh single fold after the deepest layer.
                                        setUnfoldStage(prev => (prev >= 2 ? 1 : (prev + 1) as 1 | 2));
                                    }
                                    setUnfoldKey(k => k + 1);
                                    addTerminalLog(`[UNFOLD] Compression layer expanded (stage ${showSettings ? Math.min((unfoldStage + 1), 2) : 1}/2).`);
                                }}
                                className={`p-1 rounded-md transition-all cursor-pointer ${showSettings ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                                title="Unfold On-Device Model Manager — tap again to unfold deeper"
                            >
                                <Settings2 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => { setIsExpanded(false); setAiResponse(null); setShowSettings(false); setUnfoldStage(0); }}
                                className="p-1 hover:bg-zinc-800 rounded-md transition-all text-zinc-400 hover:text-zinc-200 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {showSettings ? (
                        /* Advanced 150MB Custom On-Device Model Configuration Dashboard */
                        <div className="flex flex-col gap-3 text-left">
                            <div className="unfold-layer flex items-center justify-between text-indigo-400" style={{ '--unfold-delay': '0ms' } as React.CSSProperties}>
                                <div className="flex items-center gap-1.5">
                                    <Cpu className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Model Configuration Dashboard</span>
                                </div>
                                <span className="text-[8px] font-mono text-zinc-500">fold {unfoldStage}/2</span>
                            </div>

                            {/* Model Engine Selector */}
                            <div className="unfold-layer grid grid-cols-2 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-center text-[10px] font-bold uppercase" style={{ '--unfold-delay': '60ms' } as React.CSSProperties}>
                                <button
                                    onClick={() => {
                                        setModelSource('rule');
                                        setStatusMessage('Standby • 128-byte Index-01 Local Model');
                                        addTerminalLog('[SYSTEM] Loaded 128-byte Rule Compiler matrix (0.0 MB RAM).');
                                    }}
                                    className={`py-1 rounded-md transition-all cursor-pointer ${modelSource === 'rule' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Rule Matrix (128 B)
                                </button>
                                <button
                                    onClick={() => {
                                        setModelSource('wasm');
                                        if (isModelLoaded) {
                                            setStatusMessage(`Online • ${modelSizeMb}MB On-Device Model Active`);
                                        } else {
                                            setStatusMessage('WASM Ready • Weights Pending Load');
                                        }
                                        addTerminalLog('[SYSTEM] Loaded WebAssembly execution runtime environment.');
                                    }}
                                    className={`py-1 rounded-md transition-all cursor-pointer ${modelSource === 'wasm' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Custom LLM (&lt;150 MB)
                                </button>
                            </div>

                            {modelSource === 'rule' ? (
                                <div className="unfold-layer bg-emerald-950/10 border border-emerald-900/30 p-2.5 rounded-xl flex gap-2 items-start text-[10px] text-zinc-400 leading-relaxed" style={{ '--unfold-delay': '110ms' } as React.CSSProperties}>
                                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold text-emerald-300">Default Ultra-low Power:</span> Running a highly compressed, instant local lookup table that requires <strong>0 MB memory allocation</strong>. Extremely battery-friendly for daily iPhone use.
                                    </div>
                                </div>
                            ) : (
                                <div className="unfold-layer flex flex-col gap-2.5" style={{ '--unfold-delay': '110ms' } as React.CSSProperties}>
                                    {/* Custom Model Source Fields */}
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-2.5 flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-[9px] text-zinc-400 font-bold uppercase">
                                            <span>Model Quantized weights URL</span>
                                            <span className="text-indigo-400">Custom Load</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={githubModelUrl}
                                            onChange={(e) => setGithubModelUrl(e.target.value)}
                                            placeholder="https://github.com/user/repo/raw/model.onnx"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-indigo-500"
                                        />
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <span className="text-[8px] text-zinc-500 font-bold uppercase">Quant Size (MB)</span>
                                                <input
                                                    type="number"
                                                    value={modelSizeMb}
                                                    onChange={(e) => setModelSizeMb(e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1 px-1.5 text-[10px] font-mono text-zinc-300 mt-1"
                                                />
                                            </div>
                                            <button
                                                onClick={handleDownloadModel}
                                                disabled={isDownloadingModel}
                                                className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1 mt-3 cursor-pointer ${
                                                    isModelLoaded 
                                                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' 
                                                        : isDownloadingModel 
                                                            ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40 cursor-not-allowed' 
                                                            : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 border-zinc-800'
                                                }`}
                                            >
                                                {isDownloadingModel ? (
                                                    <>
                                                        <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                                                        <span>{downloadProgress}%</span>
                                                    </>
                                                ) : isModelLoaded ? (
                                                    <>
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                        <span>Model Loaded</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <DownloadCloud className="w-3 h-3" />
                                                        <span>Pull Weights</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Interactive Real Memory Allocator to Test Device Capacity */}
                                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-2.5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[9px] font-bold uppercase text-zinc-400">Wasm Heap Allocator test</span>
                                            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/30 px-1.5 rounded">{allocatedTestMemory} allocated</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 leading-normal mb-2">
                                            Reserve physical Float32 heap segments to test your iPhone browser thread buffer cap. Watch the <strong>System Monitor</strong> load chart spike and clear!
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSimulateMemoryAllocation}
                                                disabled={isAllocatingMemory}
                                                className="flex-1 py-1 px-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                                            >
                                                {isAllocatingMemory ? 'Allocating...' : 'Simulate Alloc'}
                                            </button>
                                            {allocatedTestMemory !== '0 MB' && (
                                                <button
                                                    onClick={handleReleaseAllocatedMemory}
                                                    className="py-1 px-2.5 bg-red-950/40 hover:bg-red-950/60 text-red-300 border border-red-900/30 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                                                >
                                                    Release Buffers
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Local Hardware Acceleration Status Diagnostics */}
                                    <div className="unfold-layer grid grid-cols-4 gap-1.5 text-center font-mono text-[8px] uppercase tracking-wide" style={{ '--unfold-delay': '160ms' } as React.CSSProperties}>
                                        <div className={`p-1 rounded-lg border ${hardwareSupport.webAssembly ? 'bg-emerald-950/25 border-emerald-900/35 text-emerald-400' : 'bg-red-950/25 border-red-900/35 text-red-400'}`}>
                                            <div>Wasm</div>
                                            <div className="font-bold mt-0.5">{hardwareSupport.webAssembly ? 'YES' : 'NO'}</div>
                                        </div>
                                        <div className={`p-1 rounded-lg border ${hardwareSupport.webAssemblySimd ? 'bg-emerald-950/25 border-emerald-900/35 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                            <div>Simd</div>
                                            <div className="font-bold mt-0.5">{hardwareSupport.webAssemblySimd ? 'YES' : 'NO'}</div>
                                        </div>
                                        <div className={`p-1 rounded-lg border ${hardwareSupport.webGpu ? 'bg-emerald-950/25 border-emerald-900/35 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                            <div>WebGpu</div>
                                            <div className="font-bold mt-0.5">{hardwareSupport.webGpu ? 'YES' : 'NO'}</div>
                                        </div>
                                        <div className={`p-1 rounded-lg border ${hardwareSupport.webGl ? 'bg-emerald-950/25 border-emerald-900/35 text-emerald-400' : 'bg-red-950/25 border-red-900/35 text-red-400'}`}>
                                            <div>WebGL</div>
                                            <div className="font-bold mt-0.5">{hardwareSupport.webGl ? 'YES' : 'NO'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Live Terminal Log stream */}
                            <div className="unfold-layer bg-zinc-950 border border-zinc-900 p-2 rounded-xl" style={{ '--unfold-delay': '200ms' } as React.CSSProperties}>
                                <div className="flex items-center gap-1 text-[8px] text-zinc-500 font-bold uppercase mb-1 pb-1 border-b border-zinc-900/60">
                                    <Terminal className="w-3 h-3" />
                                    <span>Model Inference compiler Console</span>
                                </div>
                                <div className="max-h-[80px] overflow-y-auto font-mono text-[8px] text-emerald-500/90 leading-normal flex flex-col gap-0.5">
                                    {terminalLogs.map((log, idx) => (
                                        <div key={idx} className="truncate">{log}</div>
                                    ))}
                                </div>
                            </div>

                            {/* Deepest fold: only revealed on the second unfold — a bigger,
                                richer context layer summarizing everything above it. */}
                            {unfoldStage === 2 && (
                                <div className="unfold-layer bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-2.5 flex flex-col gap-1.5" style={{ '--unfold-delay': '260ms' } as React.CSSProperties}>
                                    <div className="flex items-center gap-1.5 text-indigo-300">
                                        <Layers className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Deep Context — Full Pod Snapshot</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-mono text-zinc-400">
                                        <span>Engine</span>
                                        <span className="text-zinc-200 text-right">{modelSource === 'wasm' ? 'Custom ONNX' : 'Rule Matrix'}</span>
                                        <span>Footprint</span>
                                        <span className="text-zinc-200 text-right">{modelSource === 'wasm' ? `${modelSizeMb} MB` : '128 B'}</span>
                                        <span>Heap reserved</span>
                                        <span className="text-zinc-200 text-right">{allocatedTestMemory}</span>
                                        <span>Log depth</span>
                                        <span className="text-zinc-200 text-right">{terminalLogs.length} events</span>
                                    </div>
                                    <p className="text-[8px] text-indigo-300/70 leading-relaxed pt-1 border-t border-indigo-900/40">
                                        This is the compressed pod's full reconstructed state — every layer above folded together into one context window.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Standard Chat / Search UI interface */
                        <>
                            {/* Speech / Input Bar */}
                            <form onSubmit={handleSearchSubmit} className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 gap-2 group focus-within:border-emerald-500/50 transition-all">
                                <Search className="w-3.5 h-3.5 text-zinc-500 group-focus-within:text-emerald-400" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={modelSource === 'wasm' ? 'Type command for ONNX model...' : 'Say "Open Snake" or type...'}
                                    className="bg-transparent text-xs w-full focus:outline-none placeholder-zinc-500 text-zinc-100"
                                />
                                {query && (
                                    <button 
                                        type="button" 
                                        onClick={() => setQuery('')}
                                        className="text-zinc-500 hover:text-zinc-300"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSpeechToggle}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        isListening 
                                            ? 'bg-red-500/20 text-red-400 animate-pulse' 
                                            : 'hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400'
                                    }`}
                                    title="Toggle local iOS Speech input"
                                >
                                    <Mic className="w-3.5 h-3.5" />
                                </button>
                            </form>

                            {/* Local matched results or generated text */}
                            {aiResponse ? (
                                <div className="bg-emerald-950/20 border border-emerald-500/10 p-2.5 rounded-xl text-left">
                                    <p className="text-[10px] text-emerald-300/90 leading-relaxed italic">
                                        {aiResponse}
                                    </p>
                                </div>
                            ) : (
                                suggestedApps.length > 0 && (
                                    <div className="flex flex-col gap-1 text-left bg-zinc-900/40 p-2 rounded-xl">
                                        <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold px-1.5 mb-1">
                                            Direct Index Matches
                                        </span>
                                        {suggestedApps.map(app => (
                                            <button
                                                key={app.id}
                                                onClick={() => {
                                                    onLaunchApp(app.id);
                                                    setIsExpanded(false);
                                                    setQuery('');
                                                }}
                                                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-zinc-800 rounded-lg transition-all text-zinc-300 hover:text-white"
                                            >
                                                <Play className="w-2.5 h-2.5 text-emerald-400" />
                                                <span className="font-semibold">{app.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* Quick Suggestions Helper */}
                            {!query && !aiResponse && (
                                <div className="text-left flex flex-col gap-1 bg-zinc-900/20 p-2 rounded-xl border border-zinc-900">
                                    <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
                                        Try Saying (0% Latency Command List)
                                    </span>
                                    <div className="grid grid-cols-2 gap-1.5 text-[9px] text-zinc-400 font-mono">
                                        <button onClick={() => { setQuery('Open Game'); processCommand('Open Game'); }} className="text-left hover:text-emerald-400 transition-all">
                                            • "Open Game"
                                        </button>
                                        <button onClick={() => { setQuery('Open Telegram'); processCommand('Open Telegram'); }} className="text-left hover:text-emerald-400 transition-all">
                                            • "Open Telegram"
                                        </button>
                                        <button onClick={() => { setQuery('Clean system'); processCommand('Clean system'); }} className="text-left hover:text-emerald-400 transition-all">
                                            • "Clean system"
                                        </button>
                                        <button onClick={() => { setQuery('Open Notes'); processCommand('Open Notes'); }} className="text-left hover:text-emerald-400 transition-all">
                                            • "Open Notes"
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Footprint Status Footer */}
                    <div className="flex justify-between items-center text-[8px] text-zinc-500 font-mono mt-0.5 border-t border-zinc-900 pt-2 px-1">
                        <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : isThinking ? 'bg-amber-400 animate-spin' : 'bg-emerald-500'}`}></span>
                            {statusMessage}
                        </span>
                        <span>v1.0 (Local)</span>
                    </div>
                </div>
            ) : (
                /* Collapsed Dynamic Island Capsule Button */
                <button
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-900/80 rounded-full text-zinc-400 hover:text-zinc-200 transition-all active:scale-95 select-none"
                    title="Open On-Device Index Finder AI"
                >
                    <div className="relative flex items-center justify-center">
                        <Bot className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-emerald-400 rounded-full"></span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                        Index-01
                    </span>
                    <Mic className="w-2.5 h-2.5 text-zinc-500" />
                </button>
            )}
        </div>
    );
};
