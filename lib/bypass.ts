/**
 * The bypass — the single line every part of this app connects to.
 *
 * The architecture already works this way: no app imports another. They emit
 * and listen on the Jackie Bus, and each one is a separate lazy chunk. So any
 * app can open without dragging the rest in, and closing one leaves nothing
 * behind. That is the "everything shut off except one or two" property, and it
 * is a consequence of the wiring rather than a feature bolted on.
 *
 * Two things were missing, and this file is both:
 *
 *   SEEING IT. A spine you cannot inspect is indistinguishable from tangled
 *   wiring that happens to work. This records who emits, who listens, and what
 *   has actually travelled, so the connections can be looked at instead of
 *   taken on faith.
 *
 *   KEEPING IT. Nothing stopped an app from importing another directly, which
 *   would quietly reattach two things that are supposed to be independent. The
 *   companion test walks components/apps and fails if one imports another —
 *   the check that keeps the bypass true as the app grows.
 *
 * Recording is off in production by default: the point is inspection during
 * development, not a permanent tap on every message.
 */

import type { BusChannel } from './bus';

export interface BypassEvent {
  channel: string;
  at: number;
  /** Best-effort description of the payload. Never the payload itself —
   *  messages can carry secrets, and a debug panel is a bad place for them. */
  shape: string;
}

export interface ChannelStats {
  channel: string;
  emitted: number;
  listeners: number;
  lastAt: number | null;
}

/** Describe a payload without retaining it. */
function describe(payload: unknown): string {
  if (payload === undefined) return 'void';
  if (payload === null) return 'null';
  if (Array.isArray(payload)) return `array(${payload.length})`;
  const t = typeof payload;
  if (t !== 'object') return t;
  const keys = Object.keys(payload as object);
  return keys.length ? `{${keys.slice(0, 6).join(', ')}${keys.length > 6 ? ', …' : ''}}` : '{}';
}

const MAX_EVENTS = 200;

class BypassRecorder {
  private events: BypassEvent[] = [];
  private emitted = new Map<string, number>();
  private listeners = new Map<string, number>();
  private recording = false;

  public start(): void {
    this.recording = true;
  }
  public stop(): void {
    this.recording = false;
  }
  public isRecording(): boolean {
    return this.recording;
  }

  public noteEmit(channel: string, payload: unknown): void {
    this.emitted.set(channel, (this.emitted.get(channel) ?? 0) + 1);
    if (!this.recording) return;
    this.events.push({ channel, at: Date.now(), shape: describe(payload) });
    // Bounded so a long session cannot grow without limit; the tail is the
    // part anyone debugging actually wants.
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }

  public noteSubscribe(channel: string): void {
    this.listeners.set(channel, (this.listeners.get(channel) ?? 0) + 1);
  }

  public noteUnsubscribe(channel: string): void {
    const n = this.listeners.get(channel) ?? 0;
    // Never below zero: an unsubscribe called twice would otherwise make the
    // count nonsense and the panel misleading.
    this.listeners.set(channel, Math.max(0, n - 1));
  }

  /** Every channel that has ever emitted or been listened to. */
  public channels(): ChannelStats[] {
    const names = new Set<string>([...this.emitted.keys(), ...this.listeners.keys()]);
    return [...names]
      .map(channel => {
        const last = [...this.events].reverse().find(e => e.channel === channel);
        return {
          channel,
          emitted: this.emitted.get(channel) ?? 0,
          listeners: this.listeners.get(channel) ?? 0,
          lastAt: last ? last.at : null,
        };
      })
      .sort((a, b) => b.emitted - a.emitted || a.channel.localeCompare(b.channel));
  }

  /** Channels with listeners but no traffic — wired up and never used. */
  public silentChannels(): string[] {
    return this.channels()
      .filter(c => c.listeners > 0 && c.emitted === 0)
      .map(c => c.channel);
  }

  /** Channels that fired with nobody listening — a message into the void. */
  public unheardChannels(): string[] {
    return this.channels()
      .filter(c => c.emitted > 0 && c.listeners === 0)
      .map(c => c.channel);
  }

  public recent(limit = 50): BypassEvent[] {
    return this.events.slice(-limit).reverse();
  }

  public clear(): void {
    this.events = [];
  }

  /** Full reset, for tests. */
  public reset(): void {
    this.events = [];
    this.emitted.clear();
    this.listeners.clear();
    this.recording = false;
  }
}

export const bypass = new BypassRecorder();

/** Typed helper so callers keep channel-name checking. */
export function noteEmit<K extends BusChannel>(channel: K, payload: unknown): void {
  bypass.noteEmit(channel, payload);
}
