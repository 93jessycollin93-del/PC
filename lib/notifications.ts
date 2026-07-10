/**
 * Notification collector — the persistence layer behind the Notification Center.
 *
 * Runs from OS boot (started in App.tsx) so every `jackie-notification` bus
 * event is captured even while the Notification Center app is closed. Stores a
 * bounded timeline in appStorage('notifications') and, when the user enables
 * phone push, forwards warning/error notifications to Telegram via the
 * existing `/api/telegram/send` backend bridge.
 */

import { bus } from './bus';
import { appStorage } from './appStorage';
import { permissions } from './permissions';

export interface StoredNotification {
  id: string;
  at: number;
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  source?: string;
  read: boolean;
}

export interface PushSettings {
  enabled: boolean;
  chatId: string;
}

const LIMIT = 200;
export const notificationStore = appStorage('notifications');

export function getNotifications(): StoredNotification[] {
  return notificationStore.get<StoredNotification[]>('items', []);
}

export function getUnreadCount(): number {
  return getNotifications().filter(n => !n.read).length;
}

export function markAllRead(): void {
  notificationStore.set(
    'items',
    getNotifications().map(n => ({ ...n, read: true })),
  );
}

export function clearNotifications(): void {
  notificationStore.set('items', []);
}

export function getPushSettings(): PushSettings {
  return notificationStore.get<PushSettings>('push', { enabled: false, chatId: '' });
}

export function setPushSettings(settings: PushSettings): void {
  notificationStore.set('push', settings);
  // The telegram action (lib/actions.ts) reads this key too.
  if (settings.chatId) localStorage.setItem('telegram_chat_id', settings.chatId);
}

async function pushToPhone(n: StoredNotification): Promise<void> {
  const settings = getPushSettings();
  if (!settings.enabled) return;
  if (n.level !== 'warning' && n.level !== 'error') return;
  if (!permissions.require('notifications', 'network', 'phone push')) return;
  try {
    await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[Jackie ${n.level.toUpperCase()}] ${n.title}${n.message ? `\n${n.message}` : ''}`,
        chat_id: settings.chatId || undefined,
      }),
    });
  } catch (e) {
    // Push is best-effort; never loop a failure back into the bus.
    console.error('[notifications] Telegram push failed:', e);
  }
}

let started = false;

export function startNotificationCollector(): void {
  if (started) return;
  started = true;
  bus.on('jackie-notification', payload => {
    const item: StoredNotification = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      level: payload.level,
      title: payload.title,
      message: payload.message,
      source: payload.source,
      read: false,
    };
    notificationStore.set('items', [item, ...getNotifications()].slice(0, LIMIT));
    pushToPhone(item);
  });
}
