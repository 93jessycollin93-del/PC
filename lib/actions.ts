/**
 * Shared action model for the automation engine and scheduler.
 *
 * An action is a small, serializable "thing Jackie can do on your behalf":
 * open an app, post a notification, run an AI prompt through the router, or
 * push a Telegram message via the backend bridge. Both trigger engines
 * (lib/automation.ts, lib/scheduler.ts) execute actions through `runAction`,
 * so permission gating and failure reporting live in exactly one place.
 */

import { bus } from './bus';
import { aiClient } from './aiClient';
import { permissions } from './permissions';

export type JackieAction =
  | { type: 'launch_app'; appId: string }
  | { type: 'notify'; level: 'info' | 'success' | 'warning' | 'error'; title: string; message?: string }
  | { type: 'ai_prompt'; prompt: string; notifyResult: boolean }
  | { type: 'telegram'; text: string };

export const ACTION_TYPES: { id: JackieAction['type']; label: string }[] = [
  { id: 'launch_app', label: 'Open an app' },
  { id: 'notify', label: 'Post a notification' },
  { id: 'ai_prompt', label: 'Run an AI prompt' },
  { id: 'telegram', label: 'Send Telegram message' },
];

export interface ActionResult {
  ok: boolean;
  detail?: string;
}

/**
 * Validate and sanitize an action to prevent injection attacks (Phase B step 19).
 * Returns a sanitized action or null if validation fails.
 */
export function validateAction(action: any): JackieAction | null {
  if (!action || typeof action !== 'object') return null;

  const type = action.type;
  if (!type || typeof type !== 'string') return null;

  // Cap all string fields at 5000 chars
  const maxLen = 5000;

  switch (type) {
    case 'launch_app': {
      const appId = String(action.appId || '').slice(0, 200);
      // Allow only alphanumeric, dash, underscore in app IDs
      if (!appId.match(/^[a-zA-Z0-9_-]+$/)) return null;
      return { type: 'launch_app', appId };
    }

    case 'notify': {
      const level = action.level;
      if (!['info', 'success', 'warning', 'error'].includes(level)) return null;
      const title = String(action.title || '').slice(0, 200);
      const message = action.message ? String(action.message).slice(0, maxLen) : undefined;
      if (!title) return null;
      return { type: 'notify', level, title, message };
    }

    case 'ai_prompt': {
      const prompt = String(action.prompt || '').slice(0, maxLen);
      if (!prompt) return null;
      return { type: 'ai_prompt', prompt, notifyResult: Boolean(action.notifyResult) };
    }

    case 'telegram': {
      const text = String(action.text || '').slice(0, maxLen);
      if (!text) return null;
      return { type: 'telegram', text };
    }

    default:
      return null;
  }
}

/** One-line human description of an action, for list UIs and run logs. */
export function describeAction(action: JackieAction): string {
  switch (action.type) {
    case 'launch_app':
      return `Open app "${action.appId}"`;
    case 'notify':
      return `Notify: ${action.title}`;
    case 'ai_prompt':
      return `AI prompt: "${action.prompt.slice(0, 60)}${action.prompt.length > 60 ? '…' : ''}"`;
    case 'telegram':
      return `Telegram: "${action.text.slice(0, 60)}${action.text.length > 60 ? '…' : ''}"`;
  }
}

/**
 * Execute an action. `sourceLabel` names who fired it (rule/job name) so
 * denials and failures are traceable in the Notification Center.
 */
export async function runAction(action: JackieAction, sourceLabel: string): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'launch_app': {
        bus.emit('launch-app', { appId: action.appId });
        return { ok: true, detail: `launched ${action.appId}` };
      }

      case 'notify': {
        bus.emit('jackie-notification', {
          level: action.level,
          title: action.title,
          message: action.message,
          source: sourceLabel,
        });
        return { ok: true };
      }

      case 'ai_prompt': {
        if (!permissions.require('automation', 'model_access', sourceLabel)) {
          return { ok: false, detail: 'blocked: model_access revoked for automation' };
        }
        const res = await aiClient.sendMessage([{ role: 'user', content: action.prompt }], {
          scope: 'automation',
        });
        if (action.notifyResult) {
          bus.emit('jackie-notification', {
            level: 'info',
            title: `AI result — ${sourceLabel}`,
            message: res.content.slice(0, 500),
            source: 'automation',
          });
        }
        return { ok: true, detail: `${res.provider} · ${res.tokensUsed} tokens` };
      }

      case 'telegram': {
        if (!permissions.require('automation', 'network', sourceLabel)) {
          return { ok: false, detail: 'blocked: network revoked for automation' };
        }
        const chatId = localStorage.getItem('telegram_chat_id') || undefined;
        const resp = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: action.text, chat_id: chatId }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          return { ok: false, detail: data.error || `HTTP ${resp.status}` };
        }
        return { ok: true, detail: 'sent' };
      }
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    bus.emit('jackie-notification', {
      level: 'error',
      title: `Action failed — ${sourceLabel}`,
      message: detail,
      source: 'automation',
    });
    return { ok: false, detail };
  }
}
