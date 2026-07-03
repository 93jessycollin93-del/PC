/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Grip } from 'lucide-react';

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

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
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
        // Ignore if clicking window control buttons
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
            {/* Window Header */}
            <div
                onDoubleClick={toggleMaximize}
                onPointerDown={handleHeaderPointerDown}
                className={`bg-zinc-800 border-b border-zinc-700 px-3 py-2 flex items-center justify-between select-none touch-none ${!isMaximized ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
                <div className="flex items-center gap-2 text-zinc-300 font-medium pointer-events-none">
                    {Icon && <Icon size={14} className="text-os-accent opacity-80" />}
                    <span className="text-xs">{title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                     {/* Window Controls */}
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

            {/* Window Content */}
            <div className="flex-1 overflow-hidden relative bg-os-bg">
                {children}
                 {/* Overlay to catch events when not active */}
                {!isActive && <div className="absolute inset-0 bg-transparent" />}
            </div>

            {/* Resize Handle */}
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