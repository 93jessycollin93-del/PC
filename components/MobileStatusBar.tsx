import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { SystemMonitor } from './SystemMonitor';

interface MobileStatusBarProps {
    openWindows: Array<{ id: string; title: string }>;
    onFocusWindow: (id: string | null) => void;
}

export const MobileStatusBar: React.FC<MobileStatusBarProps> = ({ openWindows, onFocusWindow }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [screenSize, setScreenSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
    });

    React.useEffect(() => {
        const handleResize = () => {
            setScreenSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = screenSize.width < 768;
    const isLandscape = screenSize.width > screenSize.height;

    if (!isMobile && !isLandscape) {
        // Desktop view: show all status indicators
        return (
            <div className="absolute top-4 right-4 z-[3990] flex items-center gap-2">
                <SyncStatusIndicator />
                <SystemMonitor openWindows={openWindows} onFocusWindow={onFocusWindow} />
            </div>
        );
    }

    // Mobile/Landscape: show compact or collapsible version
    return (
        <div className="absolute top-4 right-4 z-[3990]">
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
        </div>
    );
};
