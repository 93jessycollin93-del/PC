import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { getSyncQueue } from '../lib/idb';

export const SyncStatusIndicator: React.FC = () => {
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [syncQueueLength, setSyncQueueLength] = useState<number>(0);
    const [cloudSyncStatus, setCloudSyncStatus] = useState<'syncing' | 'ready' | 'offline'>('ready');
    const [showTooltip, setShowTooltip] = useState<boolean>(false);

    // Initial fetch and setup event listeners
    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOnline(navigator.onLine);
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Fetch initial sync queue length
        const fetchSyncQueue = async () => {
            try {
                const queue = await getSyncQueue();
                setSyncQueueLength(queue.length);
            } catch (err) {
                console.warn('Failed to fetch sync queue', err);
            }
        };

        fetchSyncQueue();

        // Listen for sync-queue-updated custom event
        const handleSyncQueueUpdated = () => {
            fetchSyncQueue();
        };

        window.addEventListener('sync-queue-updated', handleSyncQueueUpdated);

        // Listen for cloud-sync-status custom event
        const handleCloudSyncStatus = (e: Event) => {
            const customEvent = e as CustomEvent<'syncing' | 'ready' | 'offline'>;
            if (customEvent.detail) {
                setCloudSyncStatus(customEvent.detail);
            }
        };

        window.addEventListener('cloud-sync-status', handleCloudSyncStatus);

        // Failsafe polling every 4 seconds
        const intervalId = setInterval(fetchSyncQueue, 4000);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
            window.removeEventListener('sync-queue-updated', handleSyncQueueUpdated);
            window.removeEventListener('cloud-sync-status', handleCloudSyncStatus);
            clearInterval(intervalId);
        };
    }, []);

    // Determine aggregate state
    // We display 'Offline Cache Syncing' if we are offline, if there are pending items in IndexedDB SyncQueue, 
    // or if the cloud save is currently actively uploading ('syncing') or failed ('offline').
    // Otherwise, we display 'Cloud Sync Ready'.
    const isOfflineMode = !isOnline || syncQueueLength > 0 || cloudSyncStatus === 'offline' || cloudSyncStatus === 'syncing';

    const statusLabel = isOfflineMode ? 'Offline Cache Syncing' : 'Cloud Sync Ready';

    return (
        <div 
            className="relative pointer-events-auto select-none"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div 
                id="sync-status-badge"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-md transition-all duration-300 ${
                    isOfflineMode 
                        ? 'bg-amber-950/45 text-amber-300 border-amber-800/40 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:bg-amber-950/60' 
                        : 'bg-zinc-900/60 text-emerald-400 border-emerald-800/30 hover:bg-zinc-900/80 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                }`}
            >
                {/* Status Dot / Icon */}
                <div className="relative flex h-2 w-2">
                    {isOfflineMode ? (
                        <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </>
                    ) : (
                        <>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </>
                    )}
                </div>

                {/* Animated Icon */}
                {isOfflineMode ? (
                    cloudSyncStatus === 'syncing' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : !isOnline ? (
                        <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                        <RefreshCw className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                    )
                ) : (
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                )}

                {/* Label */}
                <span className="tracking-tight select-none">
                    {statusLabel}
                </span>
            </div>

            {/* Micro-Tooltip with Rich Details */}
            {showTooltip && (
                <div 
                    id="sync-status-tooltip"
                    className="absolute right-0 top-full mt-2 w-56 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3.5 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150"
                >
                    <h4 className="text-zinc-200 text-[11px] font-bold uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1.5">
                        Sync Diagnostics
                    </h4>
                    <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Network:</span>
                            <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Local Cache:</span>
                            <span className={`font-semibold ${syncQueueLength > 0 ? 'text-amber-400' : 'text-zinc-300'}`}>
                                {syncQueueLength === 1 ? '1 transaction' : `${syncQueueLength} transactions`}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Cloud Sync:</span>
                            <span className={`font-semibold ${
                                cloudSyncStatus === 'syncing' 
                                    ? 'text-amber-400 animate-pulse' 
                                    : cloudSyncStatus === 'offline' || !isOnline
                                        ? 'text-zinc-400' 
                                        : 'text-emerald-400'
                             }`}>
                                {cloudSyncStatus === 'syncing' 
                                    ? 'Saving...' 
                                    : cloudSyncStatus === 'offline' || !isOnline
                                        ? 'Paused' 
                                        : 'Up to date'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
