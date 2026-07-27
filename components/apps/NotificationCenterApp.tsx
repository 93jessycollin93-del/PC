import React, { useEffect, useReducer, useState } from 'react';
import { Bell, Trash2, CheckCheck, Smartphone, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  notificationStore,
  getNotifications,
  getUnreadCount,
  markAllRead,
  clearNotifications,
  getPushSettings,
  setPushSettings,
  type StoredNotification,
} from '../../lib/notifications';

/**
 * Notification Center — the unified timeline for every `jackie-notification`
 * bus event (permission denials, automation runs, agent completions, sync
 * issues…), collected in the background by lib/notifications.ts so nothing is
 * missed while this window is closed. Includes opt-in phone push via the
 * backend Telegram bridge for warning/error level events.
 */

type LevelFilter = 'all' | StoredNotification['level'];

const LEVEL_META: Record<StoredNotification['level'], { icon: React.ReactNode; cls: string }> = {
  info: { icon: <Info size={13} />, cls: 'text-sky-400' },
  success: { icon: <CheckCircle2 size={13} />, cls: 'text-emerald-400' },
  warning: { icon: <AlertTriangle size={13} />, cls: 'text-amber-400' },
  error: { icon: <XCircle size={13} />, cls: 'text-red-400' },
};

function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(at).toLocaleDateString();
}

export const NotificationCenterApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [push, setPush] = useState(getPushSettings());

  // Re-render when the collector writes new notifications.
  useEffect(() => notificationStore.subscribe(tick), []);

  const all = getNotifications();
  const items = filter === 'all' ? all : all.filter(n => n.level === filter);
  const unread = getUnreadCount();

  const counts: Record<LevelFilter, number> = {
    all: all.length,
    info: all.filter(n => n.level === 'info').length,
    success: all.filter(n => n.level === 'success').length,
    warning: all.filter(n => n.level === 'warning').length,
    error: all.filter(n => n.level === 'error').length,
  };

  const updatePush = (next: typeof push) => {
    setPush(next);
    setPushSettings(next);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Bell size={16} className="text-rose-400" />
          Notification Center
          {unread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">{unread}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={markAllRead} className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1" title="Mark all read">
            <CheckCheck size={13} /> Read all
          </button>
          <button onClick={clearNotifications} className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1" title="Clear all">
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Phone push settings */}
      <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Smartphone size={13} className="text-rose-400" /> Push to phone (Telegram)
        </span>
        <button
          onClick={() => updatePush({ ...push, enabled: !push.enabled })}
          className={`relative w-9 h-5 rounded-full transition-colors ${push.enabled ? 'bg-rose-500' : 'bg-zinc-700'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${push.enabled ? 'left-4' : 'left-0.5'}`} />
        </button>
        {push.enabled && (
          <input
            value={push.chatId}
            onChange={e => updatePush({ ...push, chatId: e.target.value })}
            placeholder="Telegram chat_id"
            className="px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-rose-500 outline-none w-40"
          />
        )}
        <span className="text-[10px] text-zinc-600">warning + error levels only · needs TELEGRAM_BOT_TOKEN on the server</span>
      </div>

      {/* Filter chips */}
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-1.5">
        {(['all', 'info', 'success', 'warning', 'error'] as LevelFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
              filter === f ? 'bg-rose-600/30 border border-rose-500/50 text-rose-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f} {counts[f] > 0 && <span className="opacity-60">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No notifications{filter !== 'all' ? ` at ${filter} level` : ''} yet.
            <br />
            Permission denials, automation runs, and system events will land here.
          </div>
        ) : (
          items.map(n => {
            const meta = LEVEL_META[n.level];
            return (
              <div
                key={n.id}
                className={`border rounded-lg p-3 flex items-start gap-3 ${
                  n.read ? 'bg-zinc-900/40 border-zinc-800/70' : 'bg-zinc-900/80 border-zinc-700'
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${meta.cls}`}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${n.read ? 'text-zinc-400' : 'text-white font-semibold'}`}>{n.title}</div>
                  {n.message && <div className="text-[11px] text-zinc-500 mt-0.5 break-words">{n.message}</div>}
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {timeAgo(n.at)}
                    {n.source ? ` · ${n.source}` : ''}
                  </div>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationCenterApp;
