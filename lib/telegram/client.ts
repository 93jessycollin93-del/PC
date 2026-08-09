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
 * CREDENTIAL HANDLING
 * -------------------
 * `session.save()` returns a string that IS the account: read everything, send
 * as you, no expiry. It is never written to localStorage. It lives sealed in
 * `vault.ts` — AES-256-GCM in a separate IndexedDB, key derived per unlock
 * from a passkey or passphrase and held non-extractable, auto-locking on idle.
 * Read that file's header for what this does and does not defend against.
 *
 * `signOut()` calls auth.logOut before wiping, so the session dies at Telegram
 * too. Clearing browser data alone leaves a live session on their servers.
 */
import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { PromisedWebSockets } from 'teleproto/extensions';
import { safeGetJSON, safeSetJSON, isObject } from '../safeStorage';
import * as vault from './vault';
import type { AuthChannel, ChatMessage, ChatSummary, ConnectionState, TelegramCredentials } from './types';

const CREDS_KEY = 'pc.telegram.credentials';

let client: TelegramClient | null = null;
/**
 * A freshly authorised session string awaiting the user's choice of lock.
 * Held in memory only, and cleared the moment it is sealed or abandoned — it
 * is never written anywhere in this state.
 */
let pendingSeal: string | null = null;
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

/** A sealed session exists on this device (it may still be locked). */
export async function hasSession(): Promise<boolean> {
    return (await vault.getStatus()).exists;
}

/** Unlocked and ready to connect without another prompt. */
export function isUnlocked(): boolean {
    return vault.isUnlocked();
}

/** True when a login just completed and the session still needs sealing. */
export function hasPendingSeal(): boolean {
    return pendingSeal !== null;
}

/**
 * Seal the session produced by the last successful login. Until this is
 * called the account survives only in memory: closing the tab loses it, which
 * is the correct failure direction for a credential.
 */
export async function sealPending(opts: {
    method: vault.UnlockMethod;
    passphrase?: string;
}): Promise<void> {
    if (!pendingSeal) throw new Error('Nothing to seal.');
    await vault.seal(pendingSeal, opts);
    pendingSeal = null;
}

export function discardPending(): void {
    pendingSeal = null;
}

/**
 * Move a session written by the pre-vault build out of localStorage. Returns
 * true when one was found, in which case it is now pending and the caller must
 * seal it. The plaintext copy is removed either way.
 */
export function adoptLegacySession(): boolean {
    const legacy = vault.takeLegacyPlaintextSession();
    if (!legacy) return false;
    pendingSeal = legacy;
    return true;
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

    // Only ever the in-memory plaintext; null while the vault is locked, which
    // sends the caller back through unlock rather than starting a fresh login.
    const saved = vault.getUnsealed() ?? '';
    const session = new StringSession(saved);

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
        // otherwise leave an unusable string behind that blocks the next
        // attempt. Sealing is the caller's move (it needs a passkey or
        // passphrase), so hand the string back through `pendingSeal` rather
        // than writing plaintext anywhere.
        pendingSeal = client.session.save() as unknown as string;
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
        await vault.wipe();
        setState({ status: 'disconnected' });
    }
}

/* ------------------------------------------------------------ authorisations */

export interface DeviceSession {
    hash: string;
    /** True for the session this app is using; it cannot revoke itself here. */
    current: boolean;
    deviceModel: string;
    platform: string;
    appName: string;
    country: string;
    ip: string;
    lastActive: number;
    created: number;
}

/**
 * Every login that currently holds your account.
 *
 * This is the single most useful security screen a messenger has, and it is
 * the one that catches a stolen session — which is precisely the failure the
 * local vault cannot prevent once a credential has already leaked.
 */
export async function listDevices(): Promise<DeviceSession[]> {
    const c = getClient();
    if (!c) throw new Error('Not connected to Telegram');
    const res = (await c.invoke(new Api.account.GetAuthorizations())) as Api.account.Authorizations;
    return res.authorizations.map(a => ({
        hash: String(a.hash),
        current: Boolean(a.current),
        deviceModel: a.deviceModel || 'Unknown device',
        platform: a.platform || '',
        appName: a.appName || '',
        country: a.country || '',
        ip: a.ip || '',
        lastActive: (a.dateActive ?? 0) * 1000,
        created: (a.dateCreated ?? 0) * 1000,
    }));
}

/** Kill one other login. Telegram refuses to revoke the current session. */
export async function revokeDevice(hash: string): Promise<void> {
    const c = getClient();
    if (!c) throw new Error('Not connected to Telegram');
    await c.invoke(new Api.account.ResetAuthorization({ hash: BigInt(hash) as unknown as bigInt.BigInteger }));
}

/** Kill every login except this one. The move after a device is lost. */
export async function revokeAllOtherDevices(): Promise<void> {
    const c = getClient();
    if (!c) throw new Error('Not connected to Telegram');
    await c.invoke(new Api.auth.ResetAuthorizations());
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
