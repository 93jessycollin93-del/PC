import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { SystemMonitor } from './SystemMonitor';
import { useViewport } from '../src/desktop/useViewport';
import { FloatingWidget } from './FloatingWidget';

interface MobileStatusBarProps {
    openWindows: Array<{ id: string; title: string }>;
    onFocusWindow: (id: string | null) => void;
}

export const MobileStatusBar: React.FC<MobileStatusBarProps> = ({ openWindows, onFocusWindow }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // Shared with the window chrome, so both agree on where mobile begins.
    // This used to compute its own `< 768` while DraggableWindow used
    // `<= 768`, and at exactly 768px the two rendered contradictory UIs.
    const { isMobile, isLandscape } = useViewport();

    if (!isMobile && !isLandscape) {
        // Desktop view: show all status indicators
        return (
            <FloatingWidget
                id="status-cluster"
                className="absolute top-4 right-4 z-[3990] flex items-center gap-2"
                title="Drag to move · reset in System Settings"
            >
                <SyncStatusIndicator />
                <SystemMonitor openWindows={openWindows} onFocusWindow={onFocusWindow} />
            </FloatingWidget>
        );
    }

    // Mobile/Landscape: show compact or collapsible version
    return (
        <FloatingWidget
            id="status-cluster"
            className="absolute top-4 right-4 z-[3990]"
            title="Drag to move · reset in System Settings"
        >
            {isExpanded ? (
                <div className="bg-zinc-900/90 backdrop-blur-xl rounded-lg border border-zinc-700/50 p-3 flex flex-col gap-3 shadow-lg">
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="self-end text-zinc-400 hover:text-zinc-200"
                    >
                        <ChevronUp size={16} />
                    </button>
                    <SyncStatusIndicator />
                    <SystemMonitor openWindows={openWindows} onFocusWindow={onFocusWindow} />
                </div>
            ) : (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="bg-zinc-900/90 backdrop-blur-xl rounded-lg border border-zinc-700/50 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title="Show status"
                >
                    <ChevronDown size={18} />
                </button>
            )}
        </FloatingWidget>
    );
};
