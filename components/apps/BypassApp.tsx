import React, { useCallback, useEffect, useState } from 'react';
import { GitBranch, Circle, Radio, Trash2, HardDrive } from 'lucide-react';
import { bypass, type BypassEvent, type ChannelStats } from '../../lib/bypass';
import { measureQuota, requestPersistence, formatBytes, type QuotaReport } from '../../src/storage/quota';

/**
 * Bypass — look at the line everything connects to.
 *
 * Shows every channel, who is listening, what has travelled, and the two
 * conditions worth knowing: a channel firing with nobody listening (a message
 * into the void) and a channel wired up but never used.
 *
 * A thin View. It records nothing itself and holds no channel list; the
 * recorder owns both.
 */
export const BypassApp: React.FC = () => {
  const [channels, setChannels] = useState<ChannelStats[]>([]);
  const [events, setEvents] = useState<BypassEvent[]>([]);
  const [recording, setRecording] = useState(bypass.isRecording());
  const [quota, setQuota] = useState<QuotaReport | null>(null);
  const [persistNote, setPersistNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setChannels(bypass.channels());
    setEvents(bypass.recent(40));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    void measureQuota().then(setQuota);
  }, []);

  const toggleRecording = () => {
    if (bypass.isRecording()) bypass.stop();
    else bypass.start();
    setRecording(bypass.isRecording());
    refresh();
  };

  const askPersistence = async () => {
    const granted = await requestPersistence();
    // Reported honestly: the browser is allowed to refuse, and pretending
    // otherwise would be a promise the user pays for later.
    setPersistNote(
      granted
        ? 'Granted. This origin will not be evicted under disk pressure.'
        : 'The browser declined for now. It may grant this later as the app is used more.'
    );
    setQuota(await measureQuota());
  };

  const unheard = new Set(bypass.unheardChannels());
  const silent = new Set(bypass.silentChannels());

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200">
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch size={15} className="text-emerald-400 shrink-0" />
          <span className="text-sm flex-1">Bypass</span>
          <button
            onClick={toggleRecording}
            className={`px-2 py-0.5 rounded text-[11px] ${
              recording ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {recording ? 'Recording' : 'Record'}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          {channels.length} channels. No app imports another — everything travels here.
        </p>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800 shrink-0 text-[11px]">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <HardDrive size={12} className="shrink-0" />
          {quota === null && <span>Measuring storage…</span>}
          {quota && !quota.supported && <span>This browser will not report a storage quota.</span>}
          {quota && quota.supported && (
            <span>
              {formatBytes(quota.availableBytes)} free of {formatBytes(quota.quotaBytes)}
              {quota.persistent ? ' · protected from eviction' : ' · not yet protected'}
            </span>
          )}
          {quota && quota.supported && !quota.persistent && (
            <button
              onClick={askPersistence}
              className="ml-auto px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shrink-0"
            >
              Protect
            </button>
          )}
        </div>
        {persistNote && <div className="text-zinc-500 mt-1">{persistNote}</div>}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-600">
          Channels
        </div>
        {channels.map(c => (
          <div key={c.channel} className="px-3 py-1.5 border-b border-zinc-800/40 flex items-center gap-2">
            <Circle
              size={7}
              className={
                unheard.has(c.channel)
                  ? 'text-amber-400 shrink-0'
                  : silent.has(c.channel)
                    ? 'text-zinc-700 shrink-0'
                    : 'text-emerald-400 shrink-0'
              }
              fill="currentColor"
            />
            <span className="flex-1 min-w-0 text-[12px] text-zinc-300 truncate font-mono">{c.channel}</span>
            <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
              {c.listeners} listening · {c.emitted} sent
            </span>
          </div>
        ))}

        {events.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
              <Radio size={10} /> Recent traffic
              <button
                onClick={() => {
                  bypass.clear();
                  refresh();
                }}
                className="ml-auto text-zinc-600 hover:text-zinc-400"
                title="Clear"
              >
                <Trash2 size={11} />
              </button>
            </div>
            {events.map((e, i) => (
              <div key={`${e.at}-${i}`} className="px-3 py-1 border-b border-zinc-800/40 flex items-center gap-2">
                <span className="flex-1 min-w-0 text-[11px] text-zinc-400 truncate font-mono">{e.channel}</span>
                <span className="text-[10px] text-zinc-600 shrink-0 font-mono">{e.shape}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default BypassApp;
