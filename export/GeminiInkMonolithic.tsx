/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GEMINI INK MONOLITHIC STANDALONE MINI-APP
 * Self-contained zero-local-dependency package for mounting inside parent OS architectures.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    MousePointer2, PenLine, Play, Mail, Presentation, Folder, Loader2, 
    FileText, Image as ImageIcon, Gamepad2, Eraser, X, Minus, 
    Square, Grip, Star, Trash2, Inbox, Send, Archive, RotateCcw 
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GoogleGenAI, Tool, Type, Modality } from "@google/genai";

declare global {
    var html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
}

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

export type AppId = 'home' | 'mail' | 'slides' | 'snake' | 'folder' | 'notepad';

export interface DesktopItem {
    id: string;
    name: string;
    type: 'app' | 'folder';
    icon: LucideIcon;
    appId?: AppId;
    contents?: DesktopItem[];
    bgColor?: string;
    notepadInitialContent?: string;
}

export interface Point { x: number; y: number; }
export type Stroke = Point[];

export interface Email {
    id: number;
    from: string;
    subject: string;
    preview: string;
    body: string;
    time: string;
    unread: boolean;
}

export interface OpenWindow {
    id: string;
    item: DesktopItem;
    zIndex: number;
    pos: { x: number, y: number };
    size?: { width: number, height: number };
}

// ============================================================================
// 2. GEMINI CONFIG & TOOL DEFINITIONS
// ============================================================================

const MODEL_NAME = "gemini-3-flash-preview"; 

let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
    if (!aiClient) {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
};

const HOME_TOOLS: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'delete_item',
                description: 'Call this function for EACH item (application or folder) that has an "X" or cross drawn over it. If multiple items are crossed out, call this function multiple times.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['itemName'],
                    properties: {
                        itemName: { type: Type.STRING, description: 'The exact name of the item to delete as seen on screen.' },
                    },
                },
            },
            {
                name: 'explode_folder',
                description: 'Call this when the user draws outward pointing arrows from a folder to "explode" it and show its contents.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['folderName'],
                    properties: {
                        folderName: { type: Type.STRING, description: 'The exact name of the folder to explode as seen on screen.' },
                    },
                },
            },
            {
                name: 'explain_item',
                description: 'Call this when the user draws a question mark "?" over an item (or nearby an item). If it is a folder, it will summarize its contents. If it is a text file, it will summarize its text content.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['itemName'],
                    properties: {
                        itemName: { type: Type.STRING, description: 'The name of the item (app or folder) to explain.' },
                    },
                },
            },
            {
                name: 'change_background',
                description: 'Call this when the user draws a sketch on the empty desktop background (not specifically targeting an app icon), intending to turn that sketch into a new wallpaper. Do NOT call this if the sketch is clearly trying to interact with an existing icon (like crossing it out).',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        sketch_description: { type: Type.STRING, description: 'A short description of what the sketch appears to be, to help generating the wallpaper (e.g., "mountains", "flower", "abstract curves").' },
                    },
                },
            },
        ],
    },
];

const MAIL_TOOLS: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'delete_email',
                description: 'Call this when the user draws a line through (strikes out) or an "X" over an email row in the list to delete it. Call multiple times if multiple emails are struck out.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['subject_text'],
                    properties: {
                        subject_text: { type: Type.STRING, description: 'Distinct text from the subject line of the email.' },
                        sender_text: { type: Type.STRING, description: 'The name of the sender of the email.' },
                    },
                },
            },
            {
                name: 'summarize_email',
                description: 'Call this when the user draws a question mark "?" over email row(s) or highlights them. This will summarize the BODY of the email(s) concisely. CRITICAL: If the gesture covers MULTIPLE emails, you MUST generate MULTIPLE SEPARATE calls to this function, one for EACH email covered by the gesture.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['subject_text'],
                    properties: {
                        subject_text: { type: Type.STRING, description: 'Distinct text from the subject line of the email to summarize.' },
                        sender_text: { type: Type.STRING, description: 'The name of the sender of the email.' },
                    },
                },
            },
        ]
    }
];

const SYSTEM_INSTRUCTION = `You are Gemini Ink, an intelligent assistant. 
The user interacts with the screen by drawing "ink" strokes (white lines) on top of the UI.
Your job is to interpret their intent based on standard symbols and the current active application context.
If the user has drawn multiple distinct symbols (like multiple 'X's on different items), you MUST call the appropriate tool multiple times, once for each distinct user intent.
`;

// ============================================================================
// 3. INTERNAL SUB-COMPONENTS
// ============================================================================

interface DraggableWindowProps {
    id: string;
    title: string;
    icon?: React.ElementType;
    onClose: () => void;
    children: React.ReactNode;
    initialPos?: { x: number; y: number };
    initialSize?: { width: number; height: number };
    zIndex: number;
    onFocus?: () => void;
    isActive?: boolean;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
    id,
    title,
    icon: Icon,
    onClose,
    children,
    initialPos = { x: 50, y: 50 },
    initialSize = { width: 640, height: 480 },
    zIndex,
    onFocus,
    isActive = false
}) => {
    const [pos, setPos] = useState(initialPos);
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const preMaximizeState = useRef({ pos, size });
    
    const dragStartPos = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const windowRef = useRef<HTMLDivElement>(null);

    const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target instanceof Element && e.target.closest('button')) return;
        if (onFocus) onFocus();
        if (isMaximized) return;
        
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        };
    };

    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);

        if (onFocus) onFocus();
        setIsResizing(true);
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height
        };
    };

    const toggleMaximize = () => {
        if (isMaximized) {
            setPos(preMaximizeState.current.pos);
            setSize(preMaximizeState.current.size);
        } else {
            preMaximizeState.current = { pos, size };
            setPos({ x: 0, y: 0 });
        }
        setIsMaximized(!isMaximized);
        if (onFocus) onFocus();
    };

    useEffect(() => {
        const handleGlobalPointerMove = (e: PointerEvent) => {
            if (!isDragging && !isResizing) return;
            e.preventDefault(); 

            if (isDragging) {
                setPos({
                    x: e.clientX - dragStartPos.current.x,
                    y: e.clientY - dragStartPos.current.y
                });
            }
            if (isResizing) {
                setSize({
                    width: Math.max(300, resizeStart.current.width + (e.clientX - resizeStart.current.x)),
                    height: Math.max(200, resizeStart.current.height + (e.clientY - resizeStart.current.y))
                });
            }
        };

        const handleGlobalPointerUp = () => {
             if (isDragging || isResizing) {
                 setIsDragging(false);
                 setIsResizing(false);
             }
        };

        if (isDragging || isResizing) {
            window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
            window.addEventListener('pointerup', handleGlobalPointerUp);
            window.addEventListener('pointercancel', handleGlobalPointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handleGlobalPointerMove);
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            window.removeEventListener('pointercancel', handleGlobalPointerUp);
        };
    }, [isDragging, isResizing]);

    return (
        <div
            ref={windowRef}
            style={!isMaximized ? {
                left: pos.x,
                top: pos.y,
                width: size.width,
                height: size.height,
                zIndex: zIndex
            } : {
                zIndex: zIndex
            }}
            className={`absolute flex flex-col bg-zinc-900 rounded-lg shadow-2xl border ${isActive ? 'border-zinc-600 ring-1 ring-zinc-700' : 'border-zinc-800'} overflow-hidden ${isMaximized ? 'inset-0 rounded-none m-0 h-full w-full' : ''} transition-all duration-75 ease-out touch-none`}
            onPointerDown={() => { if (onFocus) onFocus(); }}
        >
            <div
                onDoubleClick={toggleMaximize}
                onPointerDown={handleHeaderPointerDown}
                className={`bg-zinc-800 border-b border-zinc-700 px-3 py-2 flex items-center justify-between select-none touch-none ${!isMaximized ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
                <div className="flex items-center gap-2 text-zinc-300 font-medium pointer-events-none">
                    {Icon && <Icon size={14} className="text-sky-400 opacity-80" />}
                    <span className="text-xs">{title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                     <button className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors">
                        <Minus size={12} />
                    </button>
                    <button onClick={toggleMaximize} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors">
                        <Square size={10} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-red-500 rounded text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-zinc-950">
                {children}
                {!isActive && <div className="absolute inset-0 bg-transparent" />}
            </div>

            {!isMaximized && (
                <div
                    className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-center justify-center z-10 text-zinc-600 touch-none"
                    onPointerDown={handleResizePointerDown}
                >
                    <Grip size={14} className="-rotate-45 translate-x-1 translate-y-1"/>
                </div>
            )}
        </div>
    );
};

interface InkLayerProps {
    active: boolean;
    strokes: Stroke[];
    setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
    isProcessing: boolean;
}

const InkLayer: React.FC<InkLayerProps> = ({ active, strokes, setStrokes, isProcessing }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const currentStroke = useRef<Stroke>([]);

    const drawSingleStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
        if (stroke.length < 2) return;
        const path = new Path2D();
        path.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
            path.lineTo(stroke[i].x, stroke[i].y);
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'; 
        ctx.stroke(path);

        ctx.lineWidth = 12;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke(path);

        ctx.lineWidth = 7;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke(path);
    };

    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokes.forEach(stroke => drawSingleStroke(ctx, stroke));
        if (isDrawing && currentStroke.current.length > 0) {
            drawSingleStroke(ctx, currentStroke.current);
        }
    }, [strokes, isDrawing]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    renderCanvas();
                }
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [renderCanvas]);

    useEffect(() => {
        if (!isProcessing) renderCanvas();
    }, [strokes, renderCanvas, isProcessing]);

    useEffect(() => {
        if (!isProcessing) return;
        let animationFrameId: number;
        const start = Date.now();
        const animate = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const now = Date.now();
            const pulse = (Math.sin((now - start) / 250) + 1) / 3.33 + 0.4;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.globalAlpha = pulse;
            strokes.forEach(stroke => drawSingleStroke(ctx, stroke));
            ctx.restore();
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();
        return () => {
            cancelAnimationFrame(animationFrameId);
            renderCanvas();
        };
    }, [isProcessing, strokes, renderCanvas]);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!active || isProcessing) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDrawing(true);
        currentStroke.current = [getPoint(e)];
        renderCanvas();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!active || !isDrawing || isProcessing) return;
        const getCoalescedEvents = (evt: any) => typeof evt.getCoalescedEvents === 'function' ? evt.getCoalescedEvents() : [evt];
        const events = getCoalescedEvents(e);
        const rect = canvasRef.current!.getBoundingClientRect();
        for (let i = 0; i < events.length; i++) {
             currentStroke.current.push({
                x: events[i].clientX - rect.left,
                y: events[i].clientY - rect.top
            });
        }
        renderCanvas();
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!active || !isDrawing || isProcessing) return;
        setIsDrawing(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (currentStroke.current.length > 0) {
            setStrokes(prev => [...prev, [...currentStroke.current]]);
        }
        currentStroke.current = [];
    };

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 z-[2000] touch-none ${active && !isProcessing ? 'cursor-crosshair' : 'pointer-events-none'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        />
    );
};

const HomeScreen: React.FC<{ items: (DesktopItem | null)[]; onLaunch: (item: DesktopItem) => void }> = ({ items, onLaunch }) => {
    return (
        <div className="h-full w-full p-8 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-6 content-start justify-items-center overflow-y-auto overscroll-y-contain">
            {items.map((item, index) => {
                if (!item) return <div key={`gap-${index}`} className="w-28 h-[7rem]" />;
                return (
                    <button
                        key={item.id}
                        onClick={() => onLaunch(item)}
                        className="flex flex-col items-center justify-start gap-3 p-2 w-28 rounded-xl hover:bg-white/10 transition-colors group"
                        title={item.name}
                    >
                        <div className={`relative w-20 h-20 ${item.bgColor || 'bg-zinc-700'} rounded-[22px] flex items-center justify-center shadow-[0_4px_8px_-4px_rgba(0,0,0,0.2),inset_0_1px_0.5px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.1)] group-hover:scale-105 transition-transform duration-300 ease-out border-t border-white/10 overflow-hidden`}>
                            <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.15)_0%,_transparent_70%)] pointer-events-none" />
                            <item.icon className="w-10 h-10 text-white relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
                        </div>
                        <span className="text-sm text-white font-medium text-center truncate w-full px-1 drop-shadow-md">
                            {item.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

const FolderView: React.FC<{ folder: DesktopItem }> = ({ folder }) => {
    return (
        <div className="h-full w-full bg-zinc-50 flex flex-col text-zinc-800 p-4 overflow-y-auto overscroll-y-contain">
            <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-zinc-500 font-medium uppercase text-[10px] tracking-wider">
                    <FileText size={14} /> README.txt
                </div>
                <p className="text-zinc-600 text-sm leading-relaxed">
                    This folder contains project assets and documentation. 
                    Ensure all sensitive data is encrypted before sharing.
                </p>
            </div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Contents ({folder.contents?.length || 0})</h3>
            <div className="grid grid-cols-4 gap-2 content-start">
                {folder.contents?.map(item => (
                    <div key={item.id} className="flex flex-col items-center gap-1.5 p-2 hover:bg-zinc-200/50 rounded-lg cursor-pointer transition-colors group">
                        <div className={`relative w-12 h-12 ${item.bgColor || 'bg-zinc-500'} rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform border-t border-white/10 overflow-hidden`}>
                            <item.icon size={24} className="relative z-10" />
                        </div>
                        <span className="text-xs text-center truncate w-full font-medium text-zinc-700">{item.name}</span>
                    </div>
                ))}
                {(!folder.contents || folder.contents.length === 0) && <div className="col-span-full text-zinc-400 italic py-4 text-center text-sm">Empty</div>}
            </div>
        </div>
    );
};

const MailApp: React.FC<{ emails: Email[] }> = ({ emails }) => {
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
    const selectedEmail = emails.find(e => e.id === selectedEmailId);

    useEffect(() => {
        if (selectedEmailId !== null && !selectedEmail) setSelectedEmailId(null);
    }, [emails, selectedEmailId, selectedEmail]);

    return (
        <div className="h-full w-full bg-zinc-950 flex text-zinc-200">
            <div className="w-48 bg-zinc-950 border-r border-zinc-800 flex-shrink-0 overflow-y-auto">
                <div className="p-4 font-bold text-lg flex items-center gap-2 text-blue-400">
                    <Mail size={20} /> Mail
                </div>
                <nav className="flex flex-col gap-1 px-2">
                    <button className="flex items-center gap-3 px-3 py-2 bg-blue-500/20 text-blue-300 rounded-md text-sm font-medium">
                        <Inbox size={16} /> Inbox
                        {emails.filter(e => e.unread).length > 0 && (
                            <span className="ml-auto bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{emails.filter(e => e.unread).length}</span>
                        )}
                    </button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 rounded-md text-sm font-medium"><Star size={16} /> Starred</button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 rounded-md text-sm font-medium"><Send size={16} /> Sent</button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 rounded-md text-sm font-medium"><Archive size={16} /> Archive</button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 rounded-md text-sm font-medium"><Trash2 size={16} /> Trash</button>
                </nav>
            </div>
            <div className={`${selectedEmail ? 'hidden md:block' : 'block'} w-full md:w-80 border-r border-zinc-800 overflow-y-auto bg-zinc-950`}>
                {emails.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500"><p>Inbox is empty</p></div>
                ) : (
                    emails.map(email => (
                        <div key={email.id} onClick={() => setSelectedEmailId(email.id)} className={`p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900 ${selectedEmailId === email.id ? 'bg-blue-900/20' : ''}`}>
                            <div className="flex justify-between items-baseline mb-1">
                                <span className={`font-medium truncate ${email.unread ? 'text-white font-bold' : 'text-zinc-300'}`}>{email.from}</span>
                                <span className="text-xs text-zinc-500 ml-2">{email.time}</span>
                            </div>
                            <div className={`text-sm mb-1 truncate ${email.unread ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>{email.subject}</div>
                            <div className="text-xs text-zinc-500 truncate">{email.preview}</div>
                        </div>
                    ))
                )}
            </div>
            <div className={`${selectedEmail ? 'block' : 'hidden md:block'} flex-1 bg-zinc-950 overflow-y-auto`}>
                {selectedEmail ? (
                    <div className="p-8">
                        <button className="md:hidden mb-4 text-blue-400 text-sm" onClick={() => setSelectedEmailId(null)}>← Back to list</button>
                        <h2 className="text-2xl font-bold mb-4 text-white">{selectedEmail.subject}</h2>
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                            <div><div className="font-medium text-lg text-zinc-200">{selectedEmail.from}</div><div className="text-zinc-500 text-sm">to me</div></div>
                            <div className="text-zinc-500 text-sm">{selectedEmail.time}</div>
                        </div>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{selectedEmail.body}</div>
                    </div>
                ) : <div className="h-full flex items-center justify-center text-zinc-500">Select an email to read</div>}
            </div>
        </div>
    );
};

const NotepadApp: React.FC<{ initialContent?: string }> = ({ initialContent = '' }) => {
    return (
        <div className="h-full w-full bg-zinc-900 text-zinc-300 flex flex-col">
            <textarea className="flex-1 w-full h-full p-4 resize-none border-none focus:outline-none font-mono text-sm bg-transparent" defaultValue={initialContent} spellCheck={false} />
        </div>
    );
};

const SlidesApp: React.FC = () => {
    const [slides, setSlides] = useState([
        { id: 1, src: 'https://picsum.photos/300/200?random=1', x: 50, y: 50, title: 'Q1 Growth' },
        { id: 2, src: 'https://picsum.photos/300/200?random=2', x: 320, y: 80, title: 'Team Photo' },
        { id: 3, src: 'https://picsum.photos/300/200?random=3', x: 150, y: 250, title: 'Product Roadmap' },
    ]);
    const [dragId, setDragId] = useState<number | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const slide = slides.find(s => s.id === id);
        if (!slide) return;
        setDragId(id);
        setOffset({ x: e.clientX - slide.x, y: e.clientY - slide.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragId === null) return;
        setSlides(prev => prev.map(s => s.id === dragId ? { ...s, x: e.clientX - offset.x, y: e.clientY - offset.y } : s));
    };

    return (
        <div className="h-full w-full bg-zinc-100 relative overflow-hidden flex flex-col" onMouseMove={handleMouseMove} onMouseUp={() => setDragId(null)}>
            <div className="bg-white border-b border-zinc-200 px-4 py-2 shrink-0"><h2 className="font-semibold text-zinc-800">Slides Editor</h2></div>
            <div className="flex-1 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-4 overflow-hidden">
                 <p className="text-zinc-400 text-sm absolute top-4 left-4 pointer-events-none select-none">Drag images to arrange slides</p>
                {slides.map((slide) => (
                    <div key={slide.id} style={{ left: slide.x, top: slide.y }} className={`absolute w-52 bg-white shadow-md p-2 rounded cursor-move border ${dragId === slide.id ? 'border-blue-400' : 'border-zinc-200'}`} onMouseDown={(e) => handleMouseDown(e, slide.id)}>
                        <img src={slide.src} alt={slide.title} className="w-full h-28 object-cover rounded-sm pointer-events-none bg-zinc-200" />
                        <p className="text-center text-zinc-700 mt-2 text-xs font-medium">{slide.title}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SnakeGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const state = useRef({
        playerX: 0, playerW: 40, playerH: 20,
        bullets: [] as any[], enemies: [] as any[],
        keys: { left: false, right: false, space: false },
        lastShot: 0, lastSpawn: 0, gameWidth: 0, gameHeight: 0, score: 0, idCounter: 0
    });
    const animationFrameRef = useRef<number | undefined>(undefined);

    const initGame = () => {
        if (!canvasRef.current) return;
        const { width, height } = canvasRef.current;
        state.current.gameWidth = width; state.current.gameHeight = height;
        state.current.playerX = width / 2 - 20;
        state.current.bullets = []; state.current.enemies = [];
        state.current.score = 0; state.current.keys = { left: false, right: false, space: false };
        setScore(0); setGameOver(false); setIsPlaying(true);
    };

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                canvasRef.current.width = clientWidth; canvasRef.current.height = clientHeight;
                state.current.gameWidth = clientWidth; state.current.gameHeight = clientHeight;
                if (state.current.playerX > clientWidth) state.current.playerX = clientWidth / 2 - 20;
            }
        };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 0);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isPlaying) return;
            if (e.code === 'ArrowLeft') state.current.keys.left = true;
            if (e.code === 'ArrowRight') state.current.keys.right = true;
            if (e.code === 'Space') state.current.keys.space = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft') state.current.keys.left = false;
            if (e.code === 'ArrowRight') state.current.keys.right = false;
            if (e.code === 'Space') state.current.keys.space = false;
        };
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [isPlaying]);

    const gameLoop = (timestamp: number) => {
        if (!isPlaying || gameOver) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;
        const s = state.current;
        const { gameWidth: width, gameHeight: height } = s;

        if (s.keys.left) s.playerX = Math.max(0, s.playerX - 7);
        if (s.keys.right) s.playerX = Math.min(width - s.playerW, s.playerX + 7);

        if (s.keys.space && timestamp - s.lastShot > 250) {
            s.bullets.push({ x: s.playerX + s.playerW / 2 - 2, y: height - s.playerH - 20, w: 4, h: 12, id: s.idCounter++ });
            s.lastShot = timestamp;
        }

        for (let i = s.bullets.length - 1; i >= 0; i--) {
            s.bullets[i].y -= 12;
            if (s.bullets[i].y < -20) s.bullets.splice(i, 1);
        }

        if (timestamp - s.lastSpawn > 800) { 
            const size = 30 + Math.random() * 10;
            s.enemies.push({ x: Math.random() * (width - size), y: -size, w: size, h: size, speed: 2 + Math.random() * 2, id: s.idCounter++ });
            s.lastSpawn = timestamp;
        }

        for (let i = s.enemies.length - 1; i >= 0; i--) {
            const e = s.enemies[i];
            e.y += e.speed;
            const pRect = { x: s.playerX, y: height - s.playerH - 10, w: s.playerW, h: s.playerH };
            if (e.x < pRect.x + pRect.w && e.x + e.w > pRect.x && e.y < pRect.y + pRect.h && e.y + e.h > pRect.y) {
                setGameOver(true); setIsPlaying(false); return; 
            }
            if (e.y > height) s.enemies.splice(i, 1);
        }

        for (let i = s.bullets.length - 1; i >= 0; i--) {
            let hit = false;
            for (let j = s.enemies.length - 1; j >= 0; j--) {
                const b = s.bullets[i]; const e = s.enemies[j];
                if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                    s.enemies.splice(j, 1); hit = true; s.score += 100; setScore(s.score); break;
                }
            }
            if (hit) s.bullets.splice(i, 1);
        }

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(s.playerX, height - s.playerH - 10, s.playerW, s.playerH);
        ctx.fillStyle = '#facc15'; s.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
        s.enemies.forEach(e => { ctx.fillStyle = '#4ade80'; ctx.fillRect(e.x, e.y, e.w, e.h); });

        animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        if (isPlaying && !gameOver) animationFrameRef.current = requestAnimationFrame(gameLoop);
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [isPlaying, gameOver]);

    return (
        <div ref={containerRef} className="h-full w-full bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center select-none">
            <canvas ref={canvasRef} className="absolute inset-0 z-0 block" />
            <div className="absolute top-4 left-4 z-10 font-mono text-green-500 font-bold text-xl">SCORE: {score}</div>
            {(!isPlaying || gameOver) && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <div className="text-5xl font-black text-green-400 mb-6">ALIEN DEFENSE</div>
                    {gameOver && <div className="text-3xl text-red-500 font-bold mb-6">GAME OVER</div>}
                    <button onClick={initGame} className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full flex items-center gap-3">
                        <Play size={20} fill="currentColor" /> {gameOver ? "RETRY" : "START GAME"}
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 4. INITIAL SEED DATA
// ============================================================================

const INITIAL_DESKTOP_ITEMS: DesktopItem[] = [
    { id: 'mail', name: 'Mail', type: 'app', icon: Mail, appId: 'mail', bgColor: 'bg-gradient-to-br from-blue-400 to-blue-700' },
    { id: 'slides', name: 'Slides', type: 'app', icon: Presentation, appId: 'slides', bgColor: 'bg-gradient-to-br from-orange-400 to-orange-700' },
    { id: 'snake', name: 'Game', type: 'app', icon: Gamepad2, appId: 'snake', bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-800' },
    { 
        id: 'how_to_use', name: 'how_to_use.txt', type: 'app', icon: FileText, appId: 'notepad', bgColor: 'bg-gradient-to-br from-pink-500 to-pink-700',
        notepadInitialContent: `GEMINI INK - GESTURE GUIDE\n\nNavigate your computer using natural hand-drawn sketches.\n\n1. Delete Item: Draw an "X" over any app icon.\n2. Explode Folder: Draw outward pointing arrows coming out of a folder.\n3. Summarize: Draw a "?" over an item.`
    },
    { 
        id: 'notes', name: 'notes.txt', type: 'app', icon: FileText, appId: 'notepad', bgColor: 'bg-gradient-to-br from-zinc-400 to-zinc-600',
        notepadInitialContent: `TODO LIST:\n- Buy milk, eggs, and bread\n- Finish Cybernetic OS integration`
    },
    { id: 'docs', name: 'Documents', type: 'folder', icon: Folder, bgColor: 'bg-gradient-to-br from-sky-400 to-sky-700', contents: [
        { id: 'doc1', name: 'Report.docx', type: 'app', icon: FileText, bgColor: 'bg-gradient-to-br from-blue-500 to-blue-700' },
        { id: 'img1', name: 'Vacation.png', type: 'app', icon: ImageIcon, bgColor: 'bg-gradient-to-br from-purple-500 to-purple-700' }
    ] }
];

const INITIAL_EMAILS: Email[] = [
    { id: 1, from: 'Thoms M.', subject: 'Project Deadline Updated!', preview: 'We need to push the launch date by two weeks...', body: 'Hi Team,\n\nWe need to push the launch date by two weeks due to pending QA approvals.\n\nThanks,\nBoss', time: '10:45 AM', unread: true },
    { id: 2, from: 'HR Department', subject: 'Annual Leave Policy', preview: 'Please review attached changes...', body: 'Dear Employees,\n\nPlease review attached changes to our leave policy.', time: 'Yesterday', unread: false },
    { id: 3, from: 'Cybernetic System', subject: 'Mount Authorization', preview: 'Sub-container ready for injection...', body: 'System Notice: Gemini Ink OS instance authorized for mounting inside cybernetic parent frame.', time: 'Just now', unread: true }
];

// ============================================================================
// 5. MASTER STANDALONE MINI-APP COMPONENT
// ============================================================================

export const GeminiInkMiniApp: React.FC = () => {
    const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [nextZIndex, setNextZIndex] = useState(100);
    const [inkMode, setInkMode] = useState(false);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [desktopItems, setDesktopItems] = useState<(DesktopItem | null)[]>(INITIAL_DESKTOP_ITEMS);
    const [emails, setEmails] = useState<Email[]>(INITIAL_EMAILS);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState<{ title?: string; message: React.ReactNode } | null>(null);
    const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    // Auto-inject html2canvas if parent Cybernetic OS forgot to put it in index.html
    useEffect(() => {
        if (!window.html2canvas) {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const showToast = (message: React.ReactNode, title?: string, autoDismiss: boolean = true) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setToast({ message, title });
        if (autoDismiss) {
            timeoutRef.current = window.setTimeout(() => setToast(null), 5000);
        }
    };

    const handleLaunch = (item: DesktopItem) => {
        if (inkMode) return;
        if (openWindows.find(w => w.id === item.id)) {
            focusWindow(item.id); return;
        }

        let initialSize = { width: 640, height: 480 };
        if (item.appId === 'mail') initialSize = { width: 800, height: 500 };
        if (item.appId === 'snake') initialSize = { width: 500, height: 550 };
        if (item.appId === 'notepad') initialSize = { width: 400, height: 450 };

        setOpenWindows(prev => [...prev, {
            id: item.id, item, zIndex: nextZIndex,
            pos: { x: 80 + (prev.length * 30), y: 60 + (prev.length * 30) },
            size: initialSize
        }]);
        setNextZIndex(prev => prev + 1);
        setFocusedId(item.id);
    };

    const closeWindow = (id: string) => {
        setOpenWindows(prev => prev.filter(w => w.id !== id));
        if (focusedId === id) setFocusedId(null);
    };

    const focusWindow = (id: string | null) => {
        if (id === null) { setFocusedId(null); return; }
        setFocusedId(id);
        setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w));
        setNextZIndex(prev => prev + 1);
    };

    const deleteItemRecursively = (items: (DesktopItem | null)[], nameToDelete: string, isRoot: boolean = true): { newItems: (DesktopItem | null)[], deleted: boolean } => {
        let deleted = false;
        const mappedItems = items.map(item => {
            if (!item) return null;
            if (item.name.toLowerCase().includes(nameToDelete)) {
                deleted = true; return isRoot ? null : undefined; 
            }
            if (item.type === 'folder' && item.contents) {
                const res = deleteItemRecursively(item.contents as any, nameToDelete, false);
                if (res.deleted) deleted = true;
                return { ...item, contents: res.newItems.filter((i): i is DesktopItem => i !== null && i !== undefined) };
            }
            return item;
        });
        return { newItems: (isRoot ? mappedItems : mappedItems.filter(i => i !== undefined)) as any, deleted };
    };

    const findItemByName = (items: (DesktopItem | null)[], name: string): DesktopItem | undefined => {
        for (const item of items) {
            if (!item) continue;
            if (item.name.toLowerCase().includes(name.toLowerCase())) return item;
            if (item.type === 'folder' && item.contents) {
                const found = findItemByName(item.contents, name);
                if (found) return found;
            }
        }
        return undefined;
    };

    const executeInkAction = async () => {
        if (strokes.length === 0) { showToast("Draw something first!"); return; }
        setIsProcessing(true);

        try {
            const targetEl = containerRef.current || document.body;
            const canvas = await window.html2canvas(targetEl, {
                 ignoreElements: (el) => el.id === 'mini-os-controls',
                 logging: false, useCORS: true, scale: 1 
            });
            const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            const ai = getAiClient();
            
            let activeTools = HOME_TOOLS;
            let contextDesc = 'Desktop Home Screen';
            if (focusedId) {
                const win = openWindows.find(w => w.id === focusedId);
                if (win?.item.appId === 'mail') { activeTools = MAIL_TOOLS; contextDesc = 'Mail App'; }
            }

             const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: `Analyze white ink drawings. Focused on: ${contextDesc}.` }
                ],
                config: { systemInstruction: SYSTEM_INSTRUCTION, tools: activeTools, temperature: 0.1 }
            });

            const calls = response.functionCalls;
            if (calls && calls.length > 0) {
                let workingItems = [...desktopItems];
                let workingEmails = [...emails];
                let itemsChanged = false, emailsChanged = false;
                let msgs: React.ReactNode[] = [];

                for (const call of calls) {
                    const args: any = call.args || {};
                    if (call.name === 'delete_item' && args.itemName) {
                        const { newItems, deleted } = deleteItemRecursively(workingItems, args.itemName.toLowerCase(), true);
                        if (deleted) { workingItems = newItems; itemsChanged = true; msgs.push(<div key={args.itemName}>Deleted {args.itemName}</div>); }
                    } else if (call.name === 'explode_folder' && args.folderName) {
                        const folder = findItemByName(workingItems, args.folderName.toLowerCase());
                        if (folder?.type === 'folder' && folder.contents) {
                            workingItems = workingItems.filter(i => i?.id !== folder.id);
                            workingItems.push(...folder.contents); itemsChanged = true;
                            msgs.push(<div key={folder.id}>Exploded folder {folder.name}</div>);
                        }
                    } else if (call.name === 'explain_item' && args.itemName) {
                        const item = findItemByName(workingItems, args.itemName);
                        if (item) msgs.push(<div key={item.id}>{item.name}: {item.notepadInitialContent ? "Text note recognized" : "Virtual item object."}</div>);
                    } else if (call.name === 'delete_email' && (args.subject_text || args.sender_text)) {
                        const mail = workingEmails.find(e => e.subject.toLowerCase().includes((args.subject_text||'').toLowerCase()));
                        if (mail) { workingEmails = workingEmails.filter(e => e.id !== mail.id); emailsChanged = true; msgs.push(<div key={mail.id}>Deleted email: {mail.subject}</div>); }
                    }
                }

                if (itemsChanged) setDesktopItems(workingItems);
                if (emailsChanged) setEmails(workingEmails);
                if (msgs.length > 0) showToast(<div className="space-y-1">{msgs}</div>, "Ink Actions", false);
                else showToast("Action executed (no UI items matched)");
            } else {
                showToast("Gesture not recognized");
            }
        } catch (e) {
            console.error(e); showToast("AI vision processing failed");
        } finally {
            setIsProcessing(false); setStrokes([]);
        }
    };

    return (
        <div ref={containerRef} className="h-full w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden relative flex flex-col select-none">
            
            {/* Desktop Canvas Area */}
            <div className="flex-1 w-full h-full relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-indigo-950/40">
                <div className="h-full w-full" onMouseDown={() => focusWindow(null)}>
                     <HomeScreen items={desktopItems} onLaunch={handleLaunch} />
                </div>

                {openWindows.map(win => {
                    let content = null;
                    if (win.item.type === 'folder') content = <FolderView folder={win.item} />;
                    else if (win.item.appId === 'mail') content = <MailApp emails={emails} />;
                    else if (win.item.appId === 'slides') content = <SlidesApp />;
                    else if (win.item.appId === 'snake') content = <SnakeGame />;
                    else if (win.item.appId === 'notepad') content = <NotepadApp initialContent={win.item.notepadInitialContent} />;

                    return (
                        <DraggableWindow
                            key={win.id} id={win.id} title={win.item.name} icon={win.item.icon}
                            initialPos={win.pos} initialSize={win.size} zIndex={win.zIndex}
                            isActive={focusedId === win.id} onClose={() => closeWindow(win.id)} onFocus={() => focusWindow(win.id)}
                        >
                            {content}
                        </DraggableWindow>
                    );
                })}

                <InkLayer active={inkMode} strokes={strokes} setStrokes={setStrokes} isProcessing={isProcessing} />

                {toast && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-zinc-800/95 backdrop-blur border border-zinc-700 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-md w-full animate-in fade-in">
                        {toast.title && <div className="font-bold text-sky-400 mb-1">{toast.title}</div>}
                        <div className="text-sm text-zinc-200">{toast.message}</div>
                    </div>
                )}
            </div>

            {/* Embedded OS Toolbar Capsule */}
            <div id="mini-os-controls" className="h-14 bg-zinc-900/90 border-t border-zinc-800 px-6 flex items-center justify-between z-[3000] shrink-0">
                <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>GEMINI_INK_SUB_OS</span>
                </div>

                <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-full border border-zinc-800">
                    <button onClick={() => setInkMode(false)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${!inkMode ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
                        <MousePointer2 size={13} /> Cursor
                    </button>
                    <button onClick={() => setInkMode(true)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${inkMode ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
                        <PenLine size={13} /> Ink
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {inkMode && (
                        <>
                            <button onClick={executeInkAction} disabled={isProcessing || strokes.length === 0} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${strokes.length > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>
                                {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />} Run Gesture
                            </button>
                            <button onClick={() => setStrokes([])} disabled={strokes.length === 0} className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors" title="Clear Ink">
                                <Eraser size={15} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeminiInkMiniApp;
