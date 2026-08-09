/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Telegram MTProto client — real user accounts over a phone number, not a bot
 * token. This is the difference between Cybernetic67App (a faithful Telegram
 * *replica* driven by the Bot API, which can only ever see chats a bot was
 * added to) and this: your actual account, your actual dialogs.
 *
 * WHY IT RUNS IN THE BROWSER, NOT IN server.ts
 * --------------------------------------------
 * MTProto over WebSocket is exactly how Telegram's own Web K/Z clients work,
 * and it is the only option that survives PC's distribution model: the same
 * build is served standalone AND frozen into Jackie's `public/pc-os/` as
 * static files behind an iframe, where there is no Express process to call.
 * A server-side client would work in one of those and silently not the other.
 *
 * CREDENTIAL WARNING — READ BEFORE EXTENDING
 * -----------------------------------------
 * `session.save()` returns a string that IS the account. Anyone holding it can
 * read and send everything, and it does not expire on its own. It is persisted
 * here through `safeStorage` (origin-scoped localStorage), which means:
 *   - any code running on this origin can read it, including apps compiled by
 *     The Forge / GeneratedAppRunner;
 *   - it survives until `signOut()` revokes it server-side.
 * `signOut()` calls auth.logOut so the session dies at Telegram too — clearing
 * storage alone would leave a live session stranded on their servers.
 * The upgrade path is `lib/secretsVault.ts` (AES-GCM under a master password);
 * it is deliberately not wired in yet because it would put a password prompt in
 * front of first run. See docs/TELEGRAM.md.
 */
import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { PromisedWebSockets } from 'teleproto/extensions';
import { safeGetJSON, safeSetJSON, safeRemove, isObject } from '../safeStorage';
import type { AuthChannel, ChatMessage, ChatSummary, ConnectionState, TelegramCredentials } from './types';

const SESSION_KEY = 'pc.telegram.session';
const CREDS_KEY = 'pc.telegram.credentials';

let client: TelegramClient | null = null;
let listeners = new Set<(s: ConnectionState) => void>();
let state: ConnectionState = { status: 'disconnected' };

function setState(next: ConnectionState): void {
    state = next;
    listeners.forEach(l => l(next));
}

export function getState(): ConnectionState {
    return state;
}

export function subscribe(cb: (s: ConnectionState) => void): () => void {
    listeners.add(cb);
    cb(state);
    return () => listeners.delete(cb);
}

export function getClient(): TelegramClient | null {
    return client;
}

/* ------------------------------------------------------------------ creds */

/**
 * api_id / api_hash come from https://my.telegram.org → API development tools,
 * once, per person. They identify the *application*, so they are entered in the
 * app and stored locally rather than committed — see `.env.example` for the
 * build-time fallback used in development.
 */
export function loadCredentials(): TelegramCredentials | null {
    const raw = safeGetJSON<unknown>(CREDS_KEY, null as unknown);
    if (isObject(raw) && typeof raw.apiId === 'number' && typeof raw.apiHash === 'string' && raw.apiHash) {
        return { apiId: raw.apiId, apiHash: raw.apiHash };
    }
    // Development fallback; absent in the deployed build unless the env var was set.
    const envId = Number((import.meta as { env?: Record<string, string> }).env?.VITE_TELEGRAM_API_ID);
    const envHash = (import.meta as { env?: Record<string, string> }).env?.VITE_TELEGRAM_API_HASH;
    if (envId && envHash) return { apiId: envId, apiHash: envHash };
    return null;
}

export function saveCredentials(creds: TelegramCredentials): void {
    safeSetJSON(CREDS_KEY, creds);
}

export function hasSession(): boolean {
    return Boolean(safeGetJSON<string>(SESSION_KEY, ''));
}

/* ----------------------------------------------------------------- connect */

/**
 * Connect, running the phone → code → (optional) 2FA flow through `channel`
 * when there is no stored session. Resolves once the account is authorised.
 */
export async function connect(channel: AuthChannel): Promise<TelegramClient> {
    if (client?.connected) return client;

    const creds = loadCredentials();
    if (!creds) {
        const message = 'No api_id / api_hash yet — add them in Settings to sign in.';
        setState({ status: 'error', message });
        throw new Error(message);
    }

    setState({ status: 'connecting' });

    const saved = safeGetJSON<string>(SESSION_KEY, '');
    const session = new StringSession(saved || '');

    client = new TelegramClient(session, creds.apiId, creds.apiHash, {
        connectionRetries: 5,
        // Required in the browser: MTProto rides a WebSocket, there is no raw
        // TCP. Handing over the WebSocket factory also makes the client pick
        // the obfuscated-over-WSS connection instead of the Node TCP default.
        networkSocket: PromisedWebSockets,
    });

    try {
        await client.start({
            phoneNumber: async () => {
                setState({ status: 'authenticating', prompt: 'phone' });
                return channel.request('phone');
            },
            phoneCode: async () => {
                setState({ status: 'authenticating', prompt: 'code' });
                return channel.request('code');
            },
            password: async (hint?: string) => {
                setState({ status: 'authenticating', prompt: 'password', hint });
                return channel.request('password', hint);
            },
            onError: async err => {
                // Resolving false keeps start() retrying the current step rather
                // than tearing the whole flow down on a mistyped code.
                console.error('[telegram] auth step failed', err);
                return false;
            },
        });

        // Persist only after start() resolves — a half-finished login would
        // otherwise leave an unusable string behind that blocks the next attempt.
        safeSetJSON(SESSION_KEY, client.session.save() as unknown as string);
        client.setParseMode('html');

        const me = (await client.getMe()) as Api.User;
        setState({
            status: 'connected',
            user: {
                id: String(me.id),
                name: [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || 'Telegram',
                phone: me.phone,
            },
        });
        return client;
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setState({ status: 'error', message });
        client = null;
        throw err;
    }
}

/**
 * Revoke server-side, then wipe locally. Order matters: clearing storage first
 * would strand a session that is still valid on Telegram's servers.
 */
export async function signOut(): Promise<void> {
    try {
        if (client?.connected) {
            await client.invoke(new Api.auth.LogOut());
        }
    } catch (err) {
        console.error('[telegram] logout failed; wiping locally anyway', err);
    } finally {
        try {
            await client?.disconnect();
        } catch {
            /* already gone */
        }
        client = null;
        safeRemove(SESSION_KEY);
        setState({ status: 'disconnected' });
    }
}

/* -------------------------------------------------------------- normalise */

function monogramOf(title: string): string {
    const parts = title.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** teleproto Dialog → the UI's ChatSummary. */
export function toChatSummary(dialog: {
    id?: unknown;
    title?: string;
    name?: string;
    unreadCount?: number;
    isChannel?: boolean;
    isGroup?: boolean;
    message?: { message?: string; date?: number };
}): ChatSummary {
    const title = dialog.title || dialog.name || 'Unknown';
    return {
        id: String(dialog.id ?? ''),
        title,
        subtitle: dialog.message?.message?.slice(0, 120) || 'No messages yet',
        timestamp: (dialog.message?.date ?? 0) * 1000,
        unread: dialog.unreadCount ?? 0,
        kind: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : 'user',
        monogram: monogramOf(title),
    };
}

/** teleproto Message → the UI's ChatMessage. */
export function toChatMessage(msg: Api.Message, chatId: string): ChatMessage {
    const sender = msg.sender as Api.User | undefined;
    return {
        id: String(msg.id),
        chatId,
        text: msg.message || '',
        outgoing: Boolean(msg.out),
        timestamp: (msg.date ?? 0) * 1000,
        senderName:
            [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') ||
            sender?.username ||
            (msg.out ? 'You' : 'Unknown'),
    };
}
