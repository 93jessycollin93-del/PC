/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Two providers behind one interface. `TelegramPane` holds a `ChatProvider`
 * and never asks which one it has — that is what lets the identical UI serve a
 * live MTProto account and a private, offline, account-free conversation
 * store. Switching providers is a state change, not a different screen.
 */
import { Api } from 'teleproto';
import { NewMessage } from 'teleproto/events';
import { getClient, toChatMessage, toChatSummary } from './client';
import { safeGetJSON, safeSetJSON, isArray } from '../safeStorage';
import * as sealed from './sealed';
import * as sealedStore from './sealedStore';
import type { ChatMessage, ChatProvider, ChatSummary } from './types';

/* --------------------------------------------------------- sealed messages */

const SEALED_CHATS_KEY = 'pc.telegram.sealed-chats';

/** Chats the user has switched into sealed mode. */
function sealedChats(): string[] {
    const raw = safeGetJSON<unknown>(SEALED_CHATS_KEY, []);
    return isArray(raw) ? (raw as string[]) : [];
}

export function isSealedChat(chatId: string): boolean {
    return sealedChats().includes(chatId);
}

export function setSealedChat(chatId: string, on: boolean): void {
    const current = sealedChats().filter(id => id !== chatId);
    safeSetJSON(SEALED_CHATS_KEY, on ? [...current, chatId] : current);
}

/**
 * Turn a wire message into something the transcript can show.
 *
 * Three outcomes, and they must stay distinguishable: an ordinary message, a
 * decrypted one (marked, so the user knows the difference), and one that
 * failed to decrypt — which is shown as a failure rather than as empty text,
 * because silently rendering nothing hides exactly the case worth noticing.
 */
async function decryptIfSealed(msg: ChatMessage): Promise<ChatMessage> {
    if (!sealed.isSealedWire(msg.text)) return msg;

    try {
        const peer = await sealedStore.getPeer(msg.chatId);
        if (!peer) {
            return { ...msg, text: '[sealed message — no key for this conversation]', sealedState: 'failed' };
        }
        const identity = await sealedStore.getIdentity();
        const plain = await sealed.open(msg.text, identity.privateKey, identity.publicKeyB64, peer.publicKey);
        return { ...msg, text: plain, sealedState: 'decrypted' };
    } catch {
        return { ...msg, text: '[sealed message — could not decrypt]', sealedState: 'failed' };
    }
}

/** Store a peer key that arrived as a handshake; returns true if it was one. */
export async function ingestHandshake(msg: ChatMessage): Promise<boolean> {
    const key = sealed.readHandshake(msg.text);
    if (!key || msg.outgoing) return false;
    await sealedStore.acceptPeer(msg.chatId, key);
    return true;
}

/* --------------------------------------------------------------- telegram */

export const telegramProvider: ChatProvider = {
    id: 'telegram',
    label: 'Telegram',

    isReady() {
        return Boolean(getClient()?.connected);
    },

    async getChats() {
        const client = getClient();
        if (!client) return [];
        const dialogs = await client.getDialogs({ limit: 100 });
        return dialogs
            .map(d => toChatSummary(d as unknown as Parameters<typeof toChatSummary>[0]))
            .filter(c => c.id)
            .sort((a, b) => b.timestamp - a.timestamp);
    },

    async getMessages(chatId, limit = 50) {
        const client = getClient();
        if (!client) return [];
        const messages = await client.getMessages(chatId, { limit });
        // Telegram returns newest-first; the transcript reads oldest-first.
        const normalised = messages
            .filter((m): m is Api.Message => m instanceof Api.Message)
            .map(m => toChatMessage(m, chatId))
            .reverse();

        // Adopt any peer key published in this history before decrypting, so
        // opening a conversation for the first time can read what is already
        // in it rather than needing a fresh handshake.
        for (const m of normalised) await ingestHandshake(m);
        return Promise.all(normalised.map(decryptIfSealed));
    },

    async sendMessage(chatId, text) {
        const client = getClient();
        if (!client) throw new Error('Not connected to Telegram');

        let wire = text;
        let sealedState: ChatMessage['sealedState'];

        if (isSealedChat(chatId)) {
            const peer = await sealedStore.getPeer(chatId);
            if (!peer) {
                // Refuse rather than quietly downgrade. Sending plaintext from
                // a conversation the user believes is encrypted is the worst
                // failure this feature can have.
                throw new Error('No key for this conversation yet — send your key first.');
            }
            const identity = await sealedStore.getIdentity();
            wire = (await sealed.seal(text, identity.publicKeyB64, peer.publicKey)).wire;
            sealedState = 'decrypted';
        }

        const sent = await client.sendMessage(chatId, { message: wire });
        // Show the plaintext locally; the wire carried the ciphertext.
        return { ...toChatMessage(sent as Api.Message, chatId), text, sealedState };
    },

    onNewMessage(cb) {
        const client = getClient();
        if (!client) return () => {};
        const handler = async (event: { message: Api.Message; chatId?: unknown }) => {
            const chatId = String(event.chatId ?? event.message.chatId ?? '');
            if (!chatId) return;
            const msg = toChatMessage(event.message, chatId);
            if (await ingestHandshake(msg)) return;
            cb(await decryptIfSealed(msg));
        };
        client.addEventHandler(handler, new NewMessage({}));
        return () => client.removeEventHandler(handler, new NewMessage({}));
    },
};

/* ------------------------------------------------------------------ local */

const LOCAL_CHATS_KEY = 'pc.chat.local.chats';
const localMsgKey = (id: string) => `pc.chat.local.messages.${id}`;

/** In-process fan-out so an open transcript updates the moment you send. */
const localListeners = new Set<(m: ChatMessage) => void>();

function readLocalChats(): ChatSummary[] {
    const raw = safeGetJSON<unknown>(LOCAL_CHATS_KEY, []);
    return isArray(raw) ? (raw as ChatSummary[]) : [];
}

function readLocalMessages(chatId: string): ChatMessage[] {
    const raw = safeGetJSON<unknown>(localMsgKey(chatId), []);
    return isArray(raw) ? (raw as ChatMessage[]) : [];
}

/**
 * Create a conversation in the local store. Independent of Telegram in every
 * sense — no account, no network, nothing leaves the device.
 */
export function createLocalChat(title: string): ChatSummary {
    const chat: ChatSummary = {
        id: `local-${Date.now().toString(36)}`,
        title: title.trim() || 'Untitled',
        subtitle: 'No messages yet',
        timestamp: Date.now(),
        unread: 0,
        kind: 'user',
        monogram: (title.trim()[0] || '?').toUpperCase(),
    };
    safeSetJSON(LOCAL_CHATS_KEY, [chat, ...readLocalChats()]);
    return chat;
}

export function deleteLocalChat(chatId: string): void {
    safeSetJSON(LOCAL_CHATS_KEY, readLocalChats().filter(c => c.id !== chatId));
    safeSetJSON(localMsgKey(chatId), []);
}

export const localProvider: ChatProvider = {
    id: 'local',
    label: 'Private',

    // Always available: that is the entire point of this provider.
    isReady() {
        return true;
    },

    async getChats() {
        return readLocalChats().sort((a, b) => b.timestamp - a.timestamp);
    },

    async getMessages(chatId) {
        return readLocalMessages(chatId);
    },

    async sendMessage(chatId, text) {
        const msg: ChatMessage = {
            id: `m-${Date.now().toString(36)}`,
            chatId,
            text,
            outgoing: true,
            timestamp: Date.now(),
            senderName: 'You',
        };
        safeSetJSON(localMsgKey(chatId), [...readLocalMessages(chatId), msg]);

        // Keep the chat-list preview honest.
        safeSetJSON(
            LOCAL_CHATS_KEY,
            readLocalChats().map(c =>
                c.id === chatId ? { ...c, subtitle: text.slice(0, 120), timestamp: msg.timestamp } : c,
            ),
        );

        localListeners.forEach(l => l(msg));
        return msg;
    },

    onNewMessage(cb) {
        localListeners.add(cb);
        return () => localListeners.delete(cb);
    },
};

export const PROVIDERS: Record<string, ChatProvider> = {
    telegram: telegramProvider,
    local: localProvider,
};
