/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The shape the chat UI renders. Deliberately NOT teleproto's types: the
 * Telegram provider and the local provider both normalise into these, which is
 * the whole reason one UI can render either without knowing which is attached.
 */

export type ProviderId = 'telegram' | 'local';

export interface ChatSummary {
    /** Stable within a provider; opaque to the UI. */
    id: string;
    title: string;
    /** Preview line under the title in the chat list. */
    subtitle: string;
    /** Epoch ms of the last activity, for sorting. */
    timestamp: number;
    unread: number;
    /** 'user' | 'group' | 'channel' — drives the avatar glyph. */
    kind: 'user' | 'group' | 'channel';
    /** Two-letter monogram when there is no photo. */
    monogram: string;
}

export interface ChatMessage {
    id: string;
    chatId: string;
    text: string;
    /** True when the signed-in account authored it. */
    outgoing: boolean;
    timestamp: number;
    senderName: string;
    /** Set when the message failed to send, so the UI can show a retry. */
    error?: string;
}

/**
 * One interface, two implementations. The pane holds a ChatProvider and never
 * branches on which one it has.
 */
export interface ChatProvider {
    id: ProviderId;
    label: string;
    /** False until the provider can actually serve data (Telegram needs auth). */
    isReady(): boolean;
    getChats(): Promise<ChatSummary[]>;
    getMessages(chatId: string, limit?: number): Promise<ChatMessage[]>;
    sendMessage(chatId: string, text: string): Promise<ChatMessage>;
    /** Returns an unsubscribe function. */
    onNewMessage(cb: (msg: ChatMessage) => void): () => void;
}

/** What the client asks the UI for during sign-in. */
export type AuthPrompt = 'phone' | 'code' | 'password';

export interface AuthChannel {
    /**
     * Resolve with the user's input, or reject to abort sign-in.
     * `hint` carries the 2FA password hint when Telegram supplies one.
     */
    request(kind: AuthPrompt, hint?: string): Promise<string>;
}

export interface TelegramCredentials {
    apiId: number;
    apiHash: string;
}

export type ConnectionState =
    | { status: 'disconnected' }
    | { status: 'connecting' }
    | { status: 'authenticating'; prompt: AuthPrompt; hint?: string }
    | { status: 'connected'; user: { id: string; name: string; phone?: string } }
    | { status: 'error'; message: string };
