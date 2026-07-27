import React, { useState, useEffect, useRef } from 'react';
import { Settings, Edit2, X, Plus, Pencil, MousePointer2, LayoutGrid, Eraser, Loader2, Play, Bot, Terminal, Gamepad2, Layout, ArrowLeft, Move, Pin, Monitor } from 'lucide-react';
import { DesktopItem } from '../types';

interface FloatingNavProps {
    apps: DesktopItem[];
    onLaunchApp: (app: DesktopItem) => void;
    inkMode: boolean;
    toggleInkMode: () => void;
    onClearInk?: () => void;
    onExecuteInk?: () => void;
    hasInk?: boolean;
    isProcessing?: boolean;
    onBack?: () => void;
    desktopVisibility?: Record<string, boolean>;
    onToggleDesktopVisibility?: (appId: string) => void;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({ apps, onLaunchApp, inkMode, toggleInkMode, onClearInk, onExecuteInk, hasInk, isProcessing, onBack, desktopVisibility, onToggleDesktopVisibility }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        const handleGlobalBackRequest = (e: Event) => {
            const customEvent = e as CustomEvent;

            // If in edit mode, exit edit mode first
            if (isEditMode) {
                e.preventDefault();
                setIsEditMode(false);
                return;
            }

            // If a category is selected, go back to categories grid
            if (selectedCategory) {
                e.preventDefault();
                setSelectedCategory(null);
                return;
            }

            // If expanded (but no category selected), close the library
            if (isExpanded) {
                e.preventDefault();
                setIsExpanded(false);
                setIsEditMode(false);
            }
        };

        window.addEventListener('global-back-request', handleGlobalBackRequest);
        return () => window.removeEventListener('global-back-request', handleGlobalBackRequest);
    }, [isExpanded, isEditMode, selectedCategory]);

    const CATEGORIES = [
        { id: 'ai', name: 'AI & Research', icon: Bot, color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' },
        { id: 'dev', name: 'Dev & System', icon: Terminal, color: 'text-indigo-400', bg: 'bg-indigo-500/20 border-indigo-500/30' },
        { id: 'games', name: 'Games & 3D', icon: Gamepad2, color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
        { id: 'utils', name: 'Apps & Utils', icon: Layout, color: 'text-pink-400', bg: 'bg-pink-500/20 border-pink-500/30' }
    ];

    const getCategoryForApp = (app: DesktopItem): string => {
        const id = app.appId || app.id;
        const aiApps = ['pod_system', 'bot_studio', 'jacky', 'knowledge_compressor', 'supersayen', 'ollama', 'semantic_scholar', 'research_rabbit', 'papers_with_code', 'langchain', 'agentic-vision', 'data-resolver', 'prompt-to-json'];
        const devApps = ['cloud_deploy', 'app_connector', 'flipper', 'termstudio', 'aiterm', 'openclaw', 'coderabbit', 'github_sync', 'cybernetic_export', 'build_vault', 'function-call-kitchen', 'flash-ui', 'data_pods'];
        const gamesApps = ['unreal_engine', 'blender', 'snake', 'chess', 'iron-men-arcade', 'laser-tag'];
        if (aiApps.includes(id)) return 'ai';
        if (devApps.includes(id)) return 'dev';
        if (gamesApps.includes(id)) return 'games';
        return 'utils';
    };
    
    // Load pinned apps from localStorage or default
    const [pinnedAppIds, setPinnedAppIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('pinnedApps');
        if (saved) return JSON.parse(saved);
        // Default pinned apps
        return ['jacky', 'mail', 'slides'];
    });

    useEffect(() => {
        localStorage.setItem('pinnedApps', JSON.stringify(pinnedAppIds));
    }, [pinnedAppIds]);

    const handleTogglePin = (appId: string) => {
        setPinnedAppIds(prev => 
            prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
        );
    };

    const pinnedApps = pinnedAppIds.map(id => apps.find(a => a.id === id)).filter(Boolean) as DesktopItem[];

    // Position dragging state
    const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
        const saved = localStorage.getItem('nav_position_v1');
        return saved ? JSON.parse(saved) : null;
    });

    const [isDragging, setIsDragging] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);

    const navRef = useRef<HTMLDivElement>(null);
    const holdTimeoutRef = useRef<any>(null);
    const holdIntervalRef = useRef<any>(null);
    const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Only trigger on primary pointer click/touch
        if (e.button !== 0) return;
        
        setIsHolding(true);
        setHoldProgress(0);
        
        const startX = e.clientX;
        const startY = e.clientY;
        
        holdTimeoutRef.current = setTimeout(() => {
            setIsHolding(false);
            setHoldProgress(0);
            setIsDragging(true);
            
            if (navigator.vibrate) {
                try { navigator.vibrate(50); } catch (err) {}
            }
            
            if (navRef.current) {
                const rect = navRef.current.getBoundingClientRect();
                dragStartOffsetRef.current = {
                    x: startX - rect.left,
                    y: startY - rect.top
                };
                setPosition({ x: rect.left, y: rect.top });
            }
        }, 1500);

        const startTime = Date.now();
        holdIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / 1500) * 100, 100);
            setHoldProgress(progress);
            if (progress >= 100) {
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
            }
        }, 30);
    };

    const handlePointerUp = () => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
        setIsHolding(false);
        setHoldProgress(0);
    };

    const handlePointerLeave = () => {
        if (!isDragging) {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current);
                holdTimeoutRef.current = null;
            }
            if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current);
                holdIntervalRef.current = null;
            }
            setIsHolding(false);
            setHoldProgress(0);
        }
    };

    const handleDoubleClick = () => {
        setPosition(null);
        localStorage.removeItem('nav_position_v1');
    };

    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e: PointerEvent) => {
            const newX = e.clientX - dragStartOffsetRef.current.x;
            const newY = e.clientY - dragStartOffsetRef.current.y;
            
            // Constraint bounds to stay on-screen
            const boundedX = Math.max(10, Math.min(newX, window.innerWidth - 150));
            const boundedY = Math.max(10, Math.min(newY, window.innerHeight - 50));
            
            const newPos = { x: boundedX, y: boundedY };
            setPosition(newPos);
            localStorage.setItem('nav_position_v1', JSON.stringify(newPos));
        };

        const handleGlobalPointerUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handleGlobalPointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handleGlobalPointerUp);
        };
    }, [isDragging]);

    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        };
    }, []);

    const getLibraryPanelStyle = () => {
        if (!position) return undefined;
        const x = Math.max(16, Math.min(position.x - 50, window.innerWidth - 400));
        let y = position.y + 60;
        if (position.y > window.innerHeight - 400) {
            y = position.y - 420;
        }
        return {
            position: 'fixed' as const,
            left: `${x}px`,
            top: `${y}px`,
            margin: 0,
            transform: 'none',
            maxHeight: '80vh',
            overflowY: 'auto' as const
        };
    };

    return (
        <>
            {/* The Floating Nav Bar */}
            <div 
                ref={navRef}
                style={position ? {
                    position: 'fixed',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    margin: 0,
                    transform: 'none',
                    zIndex: 4000,
                    transition: isDragging ? 'none' : 'all 0.2s ease-out'
                } : undefined}
                className={`flex flex-row items-center gap-1.5 bg-zinc-950/70 backdrop-blur-2xl border ${isDragging ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-[1.01]' : 'border-zinc-800/50'} py-1 px-2.5 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-auto select-none transition-all duration-200`}
            >
                {/* Drag Handle Move Button */}
                <div 
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                    onDoubleClick={handleDoubleClick}
                    className="relative flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
                >
                    <button
                        type="button"
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isDragging 
                                ? 'bg-indigo-600 text-white scale-105 shadow-[0_0_10px_rgba(99,102,241,0.5)]' 
                                : isHolding 
                                    ? 'bg-zinc-800 text-zinc-200 scale-95' 
                                    : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
                        }`}
                        title="Press and hold 1.5s to drag (Double-click to reset)"
                    >
                        <Move className={`w-3.5 h-3.5 ${isDragging ? 'animate-pulse' : ''}`} />
                    </button>
                    
                    {/* Progress Ring */}
                    {isHolding && (
                        <svg className="absolute inset-0 w-7 h-7 -rotate-90 pointer-events-none">
                            <circle
                                cx="14"
                                cy="14"
                                r="12"
                                stroke="rgba(99, 102, 241, 0.2)"
                                strokeWidth="1.5"
                                fill="transparent"
                            />
                            <circle
                                cx="14"
                                cy="14"
                                r="12"
                                stroke="#6366f1"
                                strokeWidth="1.5"
                                fill="transparent"
                                strokeDasharray={`${2 * Math.PI * 12}`}
                                strokeDashoffset={`${2 * Math.PI * 12 * (1 - holdProgress / 100)}`}
                                strokeLinecap="round"
                                className="transition-all duration-75"
                            />
                        </svg>
                    )}
                </div>

                <div className="h-4 w-px bg-zinc-800/80 mx-0.5 shrink-0"></div>

                {/* Global Back / Close Button */}
                <div className="relative group">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all active:scale-90"
                        title="Global Back / Close Active Window"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">
                        Global Back / Close
                    </div>
                </div>

                <div className="h-4 w-px bg-zinc-800/80 mx-0.5 shrink-0"></div>
                
                {/* Apps */}
                <div className="flex flex-row gap-1.5 max-w-[40vw] sm:max-w-[50vw] md:max-w-none overflow-x-auto no-scrollbar py-0.5">
                    {pinnedApps.map(app => {
                        const Icon = app.icon;
                        return (
                            <button
                                key={`pinned-${app.id}`}
                                onClick={() => onLaunchApp(app)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center ${app.bgColor} hover:scale-110 transition-transform shadow-md relative group`}
                                title={app.name}
                            >
                                <Icon className="w-3.5 h-3.5 text-white" />
                                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">
                                    {app.name}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="h-4 w-px bg-zinc-800/80 mx-0.5 shrink-0"></div>

                {/* Ink Toggle */}
                <div className="relative group">
                    <button
                        onClick={toggleInkMode}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            inkMode ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.5)]' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
                        }`}
                        title={inkMode ? "Switch to Pointer" : "Switch to Ink"}
                    >
                        {inkMode ? <Pencil className="w-3.5 h-3.5" /> : <MousePointer2 className="w-3.5 h-3.5" />}
                    </button>
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">
                        {inkMode ? "Disable Ink" : "Enable Ink"}
                    </div>
                </div>

                {inkMode && hasInk && (
                    <div className="flex flex-row gap-1 items-center">
                        <div className="relative group">
                            <button
                                onClick={onExecuteInk}
                                disabled={isProcessing}
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                                    isProcessing ? 'bg-zinc-700 text-zinc-400 cursor-wait' : 'bg-green-950/50 text-green-400 hover:bg-green-900/50'
                                }`}
                                title="Execute Ink Action"
                            >
                                {isProcessing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
                            </button>
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">
                                Execute Action
                            </div>
                        </div>

                        <div className="relative group">
                            <button
                                onClick={onClearInk}
                                className="w-5 h-5 rounded-full flex items-center justify-center bg-red-950/50 text-red-400 hover:bg-red-900/50 transition-colors"
                            >
                                <Eraser className="w-2.5 h-2.5" />
                            </button>
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">
                                Clear Ink
                            </div>
                        </div>
                    </div>
                )}

                <div className="h-4 w-px bg-zinc-800/80 mx-0.5 shrink-0"></div>

                {/* Expand / Library Toggle */}
                <div className="relative group">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isExpanded ? 'bg-zinc-700 text-white' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
                        }`}
                        title="App Library"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">
                        App Library
                    </div>
                </div>
            </div>

            {/* Mobile-friendly Backdrop when Expanded on Mobile */}
            {isExpanded && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[3990] md:hidden pointer-events-auto"
                    onClick={() => { setIsExpanded(false); setIsEditMode(false); setSelectedCategory(null); }}
                />
            )}

            {/* App Library Panel - Perfectly Responsive Overlay */}
            {isExpanded && (
                <div 
                    style={getLibraryPanelStyle()}
                    className="fixed z-[4000] 
                        left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                        md:left-auto md:right-4 md:top-20 md:translate-x-0 md:translate-y-0
                        w-[calc(100vw-32px)] md:w-[380px] max-w-[380px] 
                        bg-zinc-950/85 backdrop-blur-3xl border border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex flex-row justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            {selectedCategory && (
                                <button 
                                    onClick={() => setSelectedCategory(null)}
                                    className="p-1.5 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div>
                                <h3 className="text-white font-medium text-lg">
                                    {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : 'App Library'}
                                </h3>
                                {isEditMode && (
                                    <p className="text-[10px] md:text-xs text-zinc-400 mt-1 leading-tight flex flex-wrap items-center gap-1">
                                        Click app to toggle <span className="text-emerald-400 font-extrabold">Desktop Screen</span> • Click <Pin className="w-2.5 h-2.5 inline text-indigo-400" /> to toggle <span className="text-indigo-400 font-extrabold">Dock Pin</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {selectedCategory && (
                                <button 
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    className={`p-2 rounded-xl transition-colors ${isEditMode ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}
                                    title="Customize Layout"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                            <button 
                                onClick={() => { setIsExpanded(false); setIsEditMode(false); setSelectedCategory(null); }}
                                className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 transition-colors border border-transparent"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {!selectedCategory ? (
                        <div className="grid grid-cols-2 gap-4">
                            {CATEGORIES.map(category => {
                                const CatIcon = category.icon;
                                const count = apps.filter(a => getCategoryForApp(a) === category.id).length;
                                return (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        className="flex flex-col items-start p-4 md:p-5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 hover:border-zinc-700 transition-all text-left group"
                                    >
                                        <div className={`p-3 rounded-xl ${category.bg} border mb-4 group-hover:scale-110 transition-transform`}>
                                            <CatIcon className={`w-6 h-6 ${category.color}`} />
                                        </div>
                                        <h4 className="text-zinc-200 font-medium text-sm md:text-base">{category.name}</h4>
                                        <p className="text-xs text-zinc-500 mt-1">{count} apps</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-y-6 gap-x-2 max-h-[50vh] md:max-h-[60vh] overflow-y-auto no-scrollbar pb-2">
                            {apps.filter(app => getCategoryForApp(app) === selectedCategory).map(app => {
                                const Icon = app.icon;
                                const isPinned = pinnedAppIds.includes(app.id);
                                const isDesktopVisible = desktopVisibility?.[app.id] !== false;
                                return (
                                    <div key={`lib-${app.id}`} className="flex flex-col items-center gap-2 group relative">
                                        <div className="relative">
                                            <button
                                                onClick={() => {
                                                    if (isEditMode) {
                                                        onToggleDesktopVisibility?.(app.id);
                                                    } else {
                                                        onLaunchApp(app);
                                                        setIsExpanded(false);
                                                        setSelectedCategory(null);
                                                    }
                                                }}
                                                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${app.bgColor} transition-all ${isEditMode ? 'hover:scale-105' : 'hover:scale-110'} shadow-lg ${
                                                    isEditMode && !isDesktopVisible ? 'opacity-35 grayscale-[30%]' : 'opacity-100'
                                                } ${
                                                    isEditMode && isDesktopVisible ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-950 scale-105' : ''
                                                }`}
                                            >
                                                <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                                            </button>
                                            
                                            {isEditMode && (
                                                <>
                                                    {/* Top-Right: Toggle Dock Pin */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleTogglePin(app.id);
                                                        }}
                                                        className={`absolute -top-1.5 -right-1.5 w-5 h-5 md:w-6 md:h-6 rounded-full border border-zinc-800 flex items-center justify-center shadow-md transition-all active:scale-90 hover:scale-110 z-20 ${
                                                            isPinned ? 'bg-indigo-600 text-white' : 'bg-zinc-800/95 text-zinc-400 hover:text-white'
                                                        }`}
                                                        title={isPinned ? "Unpin from dock" : "Pin to dock"}
                                                    >
                                                        <Pin className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                    </button>

                                                    {/* Top-Left: Toggle Desktop Visibility */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onToggleDesktopVisibility?.(app.id);
                                                        }}
                                                        className={`absolute -top-1.5 -left-1.5 w-5 h-5 md:w-6 md:h-6 rounded-full border border-zinc-800 flex items-center justify-center shadow-md transition-all active:scale-90 hover:scale-110 z-20 ${
                                                            isDesktopVisible ? 'bg-emerald-600 text-white' : 'bg-zinc-800/95 text-zinc-400 hover:text-white'
                                                        }`}
                                                        title={isDesktopVisible ? "Hide from desktop" : "Show on desktop"}
                                                    >
                                                        <Monitor className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <span className="text-[10px] md:text-[11px] text-zinc-400 text-center leading-tight line-clamp-2 w-16 group-hover:text-zinc-200 transition-colors">
                                            {app.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
