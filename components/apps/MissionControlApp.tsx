import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Gauge, Cpu, DollarSign, Boxes, Cloud, Radio, Activity, Zap } from 'lucide-react';
import { modelRouter, type ModelProvider } from '../../lib/modelRouter';
import { getPodControlCenter, formatBytes, type PodControlCenter } from '../../src/sas-pod-system/pod-control';
import { isCloudSyncEnabled } from '../../lib/persist';
import { bus, type BusChannel } from '../../lib/bus';

/**
 * Mission Control — live OS observability dashboard.
 *
 * Reads real telemetry from the shared infrastructure: model usage/cost from
 * `modelRouter`, pod state from the SAS pod control center, cloud-sync health
 * from `lib/persist`, device memory from `navigator`, and a live tail of Jackie
 * Bus traffic. No mock data — every tile reflects actual runtime state.
 */

type BusLogEntry = { channel: string; at: number; detail?: string };

// Channels worth tailing in the live event feed.
const WATCHED: BusChannel[] = [
  'launch-app',
  'refresh-desktop',
  'permission-changed',
  'permission-denied',
  'cloud-sync-status',
  'sync-queue-updated',
  'jackie-notification',
  'automation-run',
  'scheduler-run',
];

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  groq: 'text-orange-400',
  gemini: 'text-sky-400',
  deepseek: 'text-violet-400',
  anthropic: 'text-amber-400',
  grok: 'text-emerald-400',
};

export const MissionControlApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [center, setCenter] = useState<PodControlCenter | null>(null);
  const [events, setEvents] = useState<BusLogEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [pendingSync, setPendingSync] = useState<number>(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setCenter(getPodControlCenter());
  }, []);

  // Poll model-router stats (they update on each AI call).
  useEffect(() => {
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  // Re-render when pods change.
  useEffect(() => {
    if (!center) return;
    return center.subscribe(tick);
  }, [center]);

  // Live Jackie Bus tail.
  useEffect(() => {
    const offs = WATCHED.map(channel =>
      bus.on(channel, (payload: unknown) => {
        let detail: string | undefined;
        try {
          detail = payload && typeof payload === 'object' ? JSON.stringify(payload) : String(payload ?? '');
        } catch {
          detail = undefined;
        }
        setEvents(prev => [{ channel, at: Date.now(), detail }, ...prev].slice(0, 40));
        if (channel === 'cloud-sync-status' && payload && typeof payload === 'object') {
          setSyncStatus((payload as { status?: string }).status || 'idle');
        }
        if (channel === 'sync-queue-updated' && payload && typeof payload === 'object') {
          setPendingSync((payload as { pending?: number }).pending || 0);
        }
      }),
    );
    return () => offs.forEach(off => off());
  }, []);

  const stats = modelRouter.getStats();
  const providers = Object.entries(stats) as [ModelProvider, { calls: number; totalTokens: number; totalCost: number }][];
  const totalCalls = providers.reduce((s, [, v]) => s + v.calls, 0);
  const totalTokens = providers.reduce((s, [, v]) => s + v.totalTokens, 0);
  const totalCost = providers.reduce((s, [, v]) => s + v.totalCost, 0);

  const pods = center ? center.getPods() : [];
  const status = center?.getSystemStatus();
  const activePods = pods.filter(p => p.hasActiveInstance).length;

  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const reservedMb = Number(localStorage.getItem('cy_ram_reservation_mb') || 0);
  const cloudOn = isCloudSyncEnabled();
  const uptimeMin = Math.floor((Date.now() - startedAt.current) / 60000);

  const Tile: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }> = ({
    icon,
    label,
    value,
    sub,
    accent = 'text-white',
  }) => (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">{icon}{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Gauge size={16} className="text-sky-400" />
          Mission Control
        </h2>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          live · uptime {uptimeMin}m
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Top KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile icon={<Zap size={11} className="text-emerald-400" />} label="AI Calls" value={String(totalCalls)} sub={`${(totalTokens / 1000).toFixed(1)}k tokens`} />
          <Tile icon={<DollarSign size={11} className="text-amber-400" />} label="Spend" value={`$${totalCost.toFixed(4)}`} sub="all providers" accent={totalCost > 0 ? 'text-amber-300' : 'text-emerald-300'} />
          <Tile icon={<Boxes size={11} className="text-sky-400" />} label="Pods" value={`${activePods}/${pods.length}`} sub="active / total" />
          <Tile icon={<Cloud size={11} className="text-indigo-400" />} label="Cloud Sync" value={cloudOn ? 'on' : 'off'} sub={`${syncStatus}${pendingSync ? ` · ${pendingSync} queued` : ''}`} accent={cloudOn ? 'text-emerald-300' : 'text-zinc-400'} />
        </div>

        {/* Hardware */}
        {status && (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500 mb-2"><Cpu size={11} className="text-lime-400" />Hardware · {status.hardware.name}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><div className="text-zinc-500 text-[10px]">Platform</div><div className="text-white font-semibold">{status.hardware.platform}</div></div>
              <div><div className="text-zinc-500 text-[10px]">CPU threads</div><div className="text-white font-semibold tabular-nums">{status.hardware.cpuCount}</div></div>
              <div><div className="text-zinc-500 text-[10px]">Memory</div><div className="text-white font-semibold">{deviceMemory ? `${deviceMemory} GB` : formatBytes(status.hardware.availableMemory)}{reservedMb ? ` · ${reservedMb}MB held` : ''}</div></div>
              <div><div className="text-zinc-500 text-[10px]">Pod storage</div><div className="text-white font-semibold">{status.activePods.storage}</div></div>
            </div>
          </div>
        )}

        {/* Provider breakdown */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500 mb-2"><Activity size={11} className="text-emerald-400" />Model providers</div>
          {totalCalls === 0 ? (
            <div className="text-xs text-zinc-500 py-2">No model calls yet this session.</div>
          ) : (
            <div className="space-y-1.5">
              {providers
                .filter(([, v]) => v.calls > 0)
                .sort((a, b) => b[1].calls - a[1].calls)
                .map(([provider, v]) => {
                  const pct = totalCalls ? (v.calls / totalCalls) * 100 : 0;
                  return (
                    <div key={provider} className="flex items-center gap-2 text-xs">
                      <div className={`w-20 font-semibold ${PROVIDER_COLORS[provider]}`}>{provider}</div>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-current opacity-70 rounded-full" style={{ width: `${pct}%`, color: 'currentColor' }} />
                      </div>
                      <div className="w-10 text-right tabular-nums text-zinc-400">{v.calls}×</div>
                      <div className="w-16 text-right tabular-nums text-zinc-500">{(v.totalTokens / 1000).toFixed(1)}k</div>
                      <div className="w-16 text-right tabular-nums text-amber-400/80">${v.totalCost.toFixed(4)}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Live event feed */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500 mb-2"><Radio size={11} className="text-sky-400" />Jackie Bus · live</div>
          {events.length === 0 ? (
            <div className="text-xs text-zinc-500 py-2">Listening… interact with the OS to see events (launch an app, toggle a permission).</div>
          ) : (
            <div className="space-y-1 font-mono text-[10px] max-h-52 overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-zinc-600 shrink-0">{new Date(e.at).toLocaleTimeString()}</span>
                  <span className="text-sky-400 shrink-0 w-40 truncate">{e.channel}</span>
                  <span className="text-zinc-500 truncate">{e.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissionControlApp;
