/**
 * The system message bus — the shell's IPC.
 *
 * No app imports another app. They publish and subscribe on named channels
 * here, so any app can open without dragging its neighbours into the bundle,
 * and closing one leaves nothing behind but the subscriptions it removed.
 *
 * This is deliberately the same shape as a real IPC boundary: a channel name
 * plus a serialisable payload, no shared object references. When apps later
 * move out of this JS heap and into their own processes (see
 * `docs/ROADMAP.md`), the call sites here do not change — only the transport
 * underneath `emit`/`on` does.
 */

export interface BusChannels {
  'window-opened': { appId: string; windowId: string };
  'window-closed': { appId: string; windowId: string };
  'window-focused': { appId: string; windowId: string };
  'theme-changed': { themeId: string };
  'vfs-changed': { path: string; op: 'write' | 'delete' | 'mkdir' };
  /** "Open this path in an editor." Retained — see `bus.latest`. */
  'open-file': { path: string };
  notification: {
    id: string;
    level: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body?: string;
    timestamp: number;
  };
}

export type ChannelName = keyof BusChannels;

type Handler<K extends ChannelName> = (payload: BusChannels[K]) => void;

const EVENT_PREFIX = 'jackie-os:';

/**
 * A ring buffer of everything that has crossed the bus this session. The
 * System Info app renders it, so "apps only talk through the bus" is an
 * inspectable claim rather than one you take on faith.
 */
const TRACE_LIMIT = 250;
const trace: Array<{ channel: ChannelName; payload: unknown; at: number }> = [];

/**
 * The most recent payload per channel, kept so a subscriber that mounts
 * *after* an emit can still see it. Opening a file needs this: the Files app
 * launches the editor and publishes the path in the same tick, long before the
 * editor's lazy chunk has loaded and subscribed.
 */
const retained = new Map<ChannelName, unknown>();

export const bus = {
  emit<K extends ChannelName>(channel: K, payload: BusChannels[K]): void {
    trace.push({ channel, payload, at: Date.now() });
    if (trace.length > TRACE_LIMIT) trace.shift();
    retained.set(channel, payload);
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EVENT_PREFIX + channel, { detail: payload }));
  },

  /** The last payload seen on a channel, or null if nothing has been sent. */
  latest<K extends ChannelName>(channel: K): BusChannels[K] | null {
    return (retained.get(channel) as BusChannels[K] | undefined) ?? null;
  },

  /** Drops a retained payload once it has been consumed. */
  clearLatest(channel: ChannelName): void {
    retained.delete(channel);
  },

  /** Returns the unsubscribe function — call it from an effect cleanup. */
  on<K extends ChannelName>(channel: K, handler: Handler<K>): () => void {
    if (typeof window === 'undefined') return () => {};
    const listener = (event: Event) => handler((event as CustomEvent).detail as BusChannels[K]);
    window.addEventListener(EVENT_PREFIX + channel, listener);
    return () => window.removeEventListener(EVENT_PREFIX + channel, listener);
  },

  /** Newest last. A copy — callers cannot mutate the trace. */
  history(): ReadonlyArray<{ channel: ChannelName; payload: unknown; at: number }> {
    return trace.slice();
  },
};

/** Convenience wrapper — the one channel nearly every app touches. */
export function notify(
  level: BusChannels['notification']['level'],
  title: string,
  body?: string,
): void {
  bus.emit('notification', {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    level,
    title,
    body,
    timestamp: Date.now(),
  });
}
