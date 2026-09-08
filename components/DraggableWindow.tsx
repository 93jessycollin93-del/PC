/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Grip, ExternalLink } from 'lucide-react';
import { usePCThemeOptional } from '../src/pc-themes/PCThemeContext';
import { PCWindowControls } from '../src/pc-themes/components/PCWindowChrome';

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
    onBoundsChange?: (pos: {x: number, y: number}, size: {width: number, height: number}) => void;
    isActive?: boolean;
    url?: string;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
    id,
    title,
    icon: Icon,
    onClose,
    children,
    initialPos = { x: 50, y: 50 },
    initialSize = { width: 960, height: 600 },
    zIndex,
    onFocus,
    onBoundsChange,
    isActive = false,
    url
}) => {
    const [pos, setPos] = useState(initialPos);
    const [size, setSize] = useState(initialSize);
    
    // Add refs to avoid stale closures in event listeners
    const posRef = useRef(pos);
    const sizeRef = useRef(size);
    useEffect(() => { posRef.current = pos; }, [pos]);
    useEffect(() => { sizeRef.current = size; }, [size]);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const preMaximizeState = useRef({ pos, size });
    
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const effectiveMaximized = isMaximized || isMobile;

    const dragStartPos = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const windowRef = useRef<HTMLDivElement>(null);

    // PC theme system: purely visual. `themed` is false for the default
    // cosmic-jackie theme (or if the provider is absent), in which case the
    // original chrome below renders unchanged. Drag/resize/maximize/close
    // logic is shared by both paths — themes cannot alter behavior.
    const pcTheme = usePCThemeOptional();
    const themed = !!pcTheme && !pcTheme.isDefault;
    const pcControls = pcTheme?.theme.window.controls ?? 'fluent';

    const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Ignore if clicking window control buttons
        if (e.target instanceof Element && e.target.closest('button')) return;
        
        if (onFocus) onFocus();
        if (effectiveMaximized) return;
        
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

            // Critical for touch devices: prevent native scrolling while dragging/resizing
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

        const handleGlobalPointerUp = (e: PointerEvent) => {
             if (isDragging || isResizing) {
                 setIsDragging(false);
                 setIsResizing(false);
                 if (onBoundsChange) {
                     onBoundsChange(posRef.current, sizeRef.current);
                 }
             }
        };

        if (isDragging || isResizing) {
            // Use active: true for immediate response if supported, though typically default for pointer events
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
            style={!effectiveMaximized ? {
                left: pos.x,
                top: pos.y,
                width: size.width,
                height: size.height,
                zIndex: zIndex
            } : {
                zIndex: zIndex
            }}
            className={
                themed
                    ? `pc-window ${isActive ? 'pc-window-active' : ''} absolute flex flex-col overflow-hidden ${effectiveMaximized ? 'inset-0 !rounded-none m-0 h-full w-full' : ''} transition-all duration-75 ease-out touch-none`
                    : `absolute flex flex-col bg-zinc-900 rounded-lg shadow-2xl border ${isActive ? 'border-zinc-600 ring-1 ring-zinc-700' : 'border-zinc-800'} overflow-hidden ${effectiveMaximized ? 'inset-0 rounded-none m-0 h-full w-full' : ''} transition-all duration-75 ease-out touch-none`
            }
            onPointerDown={() => { if (onFocus) onFocus(); }}
        >
            {/* Window Header */}
            {themed ? (
                /* Era window chrome — same handlers, same state machine;
                   only paint + control glyphs change per theme family. */
                <div
                    onDoubleClick={toggleMaximize}
                    onPointerDown={handleHeaderPointerDown}
                    className={`pc-titlebar ${isActive ? 'pc-titlebar-active' : 'pc-titlebar-inactive'} flex items-center justify-between gap-2 select-none touch-none shrink-0 ${!effectiveMaximized ? 'cursor-grab active:cursor-grabbing' : ''} ${effectiveMaximized && isMobile ? 'pt-4' : ''}`}
                >
                    {/* macOS/Unity-style themes put controls on the LEFT and
                        center the title; Windows keeps title-left/controls-right. */}
                    {pcTheme!.theme.window.controlsSide === 'left' && (
                        <PCWindowControls
                            controls={pcControls}
                            url={url}
                            hideMaximize={isMobile}
                            onToggleMaximize={toggleMaximize}
                            onClose={onClose}
                        />
                    )}
                    <div className={`flex items-center gap-1.5 font-medium pointer-events-none min-w-0 flex-1 ${pcTheme!.theme.window.controlsSide === 'left' ? 'justify-center pr-10' : ''}`}>
                        {pcTheme!.theme.window.showTitleIcon && Icon && <Icon size={13} className="opacity-90 shrink-0" />}
                        <span className="truncate">{title}</span>
                    </div>
                    {pcTheme!.theme.window.controlsSide !== 'left' && (
                        <PCWindowControls
                            controls={pcControls}
                            url={url}
                            hideMaximize={isMobile}
                            onToggleMaximize={toggleMaximize}
                            onClose={onClose}
                        />
                    )}
                </div>
            ) : (
            <div
                onDoubleClick={toggleMaximize}
                onPointerDown={handleHeaderPointerDown}
                className={`bg-zinc-800 border-b border-zinc-700 px-3 py-2 flex items-center justify-between select-none touch-none ${!effectiveMaximized ? 'cursor-grab active:cursor-grabbing' : ''} ${effectiveMaximized && isMobile ? 'pt-4' : ''}`}
            >
                <div className="flex items-center gap-2 text-zinc-300 font-medium pointer-events-none">
                    {Icon && <Icon size={14} className="text-os-accent opacity-80" />}
                    <span className="text-xs">{title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                     {/* Window Controls */}
                     {url && (
                        <button
                            onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors mr-1"
                            title="Open in new tab"
                        >
                            <ExternalLink size={12} />
                        </button>
                     )}
                     <button className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors">
                        <Minus size={12} />
                    </button>
                    <button onClick={toggleMaximize} className={`p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors ${isMobile ? 'hidden' : ''}`}>
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
            )}

            {/* Window Content */}
            <div className={`flex-1 overflow-hidden relative ${themed ? 'pc-window-content' : 'bg-os-bg'} ${effectiveMaximized && isMobile ? 'pb-20' : ''}`}>
                {children}
                 {/* Overlay to catch events when not active */}
                {!isActive && <div className="absolute inset-0 bg-transparent" />}
            </div>

            {/* Resize Handle */}
            {!effectiveMaximized && (
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