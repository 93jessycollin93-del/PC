import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { getSyncQueue } from '../lib/idb';
import { isCloudSyncEnabled, setCloudSyncEnabled, forceCloudSync } from '../lib/persist';

export const SyncStatusIndicator: React.FC = () => {
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [syncQueueLength, setSyncQueueLength] = useState<number>(0);
    const [cloudSyncStatus, setCloudSyncStatus] = useState<'syncing' | 'ready' | 'offline' | 'disabled'>(
        isCloudSyncEnabled() ? 'offline' : 'disabled'
    );
    const [syncEnabled, setSyncEnabled] = useState<boolean>(isCloudSyncEnabled());
    const [isForcing, setIsForcing] = useState<boolean>(false);
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
            const customEvent = e as CustomEvent<'syncing' | 'ready' | 'offline' | 'disabled'>;
            if (customEvent.detail) {
                setCloudSyncStatus(customEvent.detail);
            }
        };

        window.addEventListener('cloud-sync-status', handleCloudSyncStatus);

        // Listen for the toggle changing (e.g. from another tab/component)
        const handleCloudSyncEnabledChanged = (e: Event) => {
            const customEvent = e as CustomEvent<boolean>;
            setSyncEnabled(!!customEvent.detail);
        };
        window.addEventListener('cloud-sync-enabled-changed', handleCloudSyncEnabledChanged);

        // Failsafe polling every 4 seconds
        const intervalId = setInterval(fetchSyncQueue, 4000);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
            window.removeEventListener('sync-queue-updated', handleSyncQueueUpdated);
            window.removeEventListener('cloud-sync-status', handleCloudSyncStatus);
            window.removeEventListener('cloud-sync-enabled-changed', handleCloudSyncEnabledChanged);
            clearInterval(intervalId);
        };
    }, []);

    const handleToggleSync = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = !syncEnabled;
        setSyncEnabled(next);
        setCloudSyncEnabled(next);
    };

    const handleForceSync = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!syncEnabled || isForcing) return;
        setIsForcing(true);
        try {
            await forceCloudSync();
        } finally {
            setIsForcing(false);
        }
    };

    // Determine aggregate state
    // Cloud sync turned off entirely: never treat this as "offline trouble", it's intentional.
    // Otherwise 'Offline Cache Syncing' covers no network, a pending local queue, or a
    // cloud save that's actively uploading ('syncing') or currently unreachable ('offline').
    const isDisabledMode = !syncEnabled;
    const isOfflineMode = !isDisabledMode && (!isOnline || syncQueueLength > 0 || cloudSyncStatus === 'offline' || cloudSyncStatus === 'syncing');

    const statusLabel = isDisabledMode ? 'Local Only' : isOfflineMode ? 'Offline Cache Syncing' : 'Cloud Sync Ready';

    return (
        <div 
            className="relative pointer-events-auto select-none"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div 
                id="sync-status-badge"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-md transition-all duration-300 ${
                    isDisabledMode
                        ? 'bg-zinc-900/60 text-zinc-400 border-zinc-700/40 hover:bg-zinc-900/80'
                        : isOfflineMode 
                        ? 'bg-amber-950/45 text-amber-300 border-amber-800/40 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:bg-amber-950/60' 
                        : 'bg-zinc-900/60 text-emerald-400 border-emerald-800/30 hover:bg-zinc-900/80 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                }`}
            >
                {/* Status Dot / Icon */}
                <div className="relative flex h-2 w-2">
                    {isDisabledMode ? (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500"></span>
                    ) : isOfflineMode ? (
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
                {isDisabledMode ? (
                    <CloudOff className="w-3.5 h-3.5 text-zinc-500" />
                ) : isOfflineMode ? (
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
                                isDisabledMode
                                    ? 'text-zinc-500'
                                    : cloudSyncStatus === 'syncing' 
                                    ? 'text-amber-400 animate-pulse' 
                                    : cloudSyncStatus === 'offline' || !isOnline
                                        ? 'text-zinc-400' 
                                        : 'text-emerald-400'
                             }`}>
                                {isDisabledMode
                                    ? 'Off'
                                    : cloudSyncStatus === 'syncing' 
                                    ? 'Saving...' 
                                    : cloudSyncStatus === 'offline' || !isOnline
                                        ? 'Reconnecting (30s)' 
                                        : 'Up to date (5m)'}
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-zinc-800 flex flex-col gap-2">
                        <button
                            id="sync-toggle-button"
                            onClick={handleToggleSync}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                syncEnabled
                                    ? 'bg-emerald-950/50 text-emerald-300 hover:bg-emerald-950/70 border border-emerald-800/40'
                                    : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 border border-zinc-700/40'
                            }`}
                        >
                            <span>Cloud Sync</span>
                            <span className={`px-2 py-0.5 rounded-full ${syncEnabled ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-600 text-zinc-200'}`}>
                                {syncEnabled ? 'ON' : 'OFF'}
                            </span>
                        </button>
                        {syncEnabled && (
                            <button
                                id="sync-force-button"
                                onClick={handleForceSync}
                                disabled={isForcing}
                                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 border border-zinc-700/40 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${isForcing ? 'animate-spin' : ''}`} />
                                {isForcing ? 'Syncing...' : 'Force Sync Now'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
