/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Telegram — a real MTProto client on your own account, plus a private local
 * conversation store, rendered by the same list/transcript/composer. The
 * provider toggle in the header swaps the data source underneath a UI that
 * does not know the difference.
 *
 * Distinct from `Cybernetic67App` ("Telegram Replica"), which drives the same
 * visual language from the Bot API and can only see what a bot was added to.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, LogOut, Loader2, Plus, ShieldAlert, KeyRound, MessageSquare, Trash2 } from 'lucide-react';
import * as tg from '../../lib/telegram/client';
import { PROVIDERS, createLocalChat, deleteLocalChat } from '../../lib/telegram/provider';
import type { AuthPrompt, ChatMessage, ChatSummary, ConnectionState, ProviderId } from '../../lib/telegram/types';

/** A promise the sign-in flow parks on until the user submits the field. */
interface PendingPrompt {
    kind: AuthPrompt;
    hint?: string;
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
}

const PROMPT_COPY: Record<AuthPrompt, { label: string; placeholder: string; help: string }> = {
    phone: {
        label: 'Phone number',
        placeholder: '+1 555 000 1234',
        help: 'Include the country code. Telegram sends a login code to your other devices.',
    },
    code: {
        label: 'Login code',
        placeholder: '12345',
        help: 'Check your Telegram app on another device, or your SMS.',
    },
    password: {
        label: 'Two-step password',
        placeholder: 'Your cloud password',
        help: 'This account has two-step verification enabled.',
    },
};

export const TelegramApp: React.FC = () => {
    const [providerId, setProviderId] = useState<ProviderId>(() => (tg.hasSession() ? 'telegram' : 'local'));
    const [conn, setConn] = useState<ConnectionState>(tg.getState());
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const [pending, setPending] = useState<PendingPrompt | null>(null);
    const [promptValue, setPromptValue] = useState('');

    const [apiId, setApiId] = useState('');
    const [apiHash, setApiHash] = useState('');
    const [needsCreds, setNeedsCreds] = useState(() => !tg.loadCredentials());

    const transcriptRef = useRef<HTMLDivElement>(null);
    const provider = PROVIDERS[providerId];

    useEffect(() => tg.subscribe(setConn), []);

    /* ----------------------------------------------------------- data load */

    const refreshChats = useCallback(async () => {
        if (!provider.isReady()) {
            setChats([]);
            return;
        }
        try {
            setChats(await provider.getChats());
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Could not load chats');
        }
    }, [provider]);

    useEffect(() => {
        setActiveId(null);
        setMessages([]);
        void refreshChats();
    }, [refreshChats]);

    useEffect(() => {
        if (!activeId) return;
        let cancelled = false;
        setBusy(true);
        provider
            .getMessages(activeId)
            .then(m => {
                if (!cancelled) setMessages(m);
            })
            .catch(err => setNotice(err instanceof Error ? err.message : 'Could not load messages'))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [activeId, provider]);

    // Live updates. Re-subscribes when the provider changes so the Telegram
    // event handler is torn down rather than leaking across a toggle.
    useEffect(() => {
        if (!provider.isReady()) return;
        return provider.onNewMessage(msg => {
            setMessages(prev => (msg.chatId === activeId && !prev.some(p => p.id === msg.id) ? [...prev, msg] : prev));
            void refreshChats();
        });
    }, [provider, activeId, refreshChats]);

    useEffect(() => {
        transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
    }, [messages]);

    /* -------------------------------------------------------------- actions */

    const authChannel = {
        request: (kind: AuthPrompt, hint?: string) =>
            new Promise<string>((resolve, reject) => {
                setPromptValue('');
                setPending({ kind, hint, resolve, reject });
            }),
    };

    const submitPrompt = () => {
        if (!pending || !promptValue.trim()) return;
        pending.resolve(promptValue.trim());
        setPending(null);
        setPromptValue('');
    };

    const beginSignIn = async () => {
        setNotice(null);
        try {
            await tg.connect(authChannel);
            setProviderId('telegram');
            await refreshChats();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Sign-in failed');
            setPending(null);
        }
    };

    const saveCreds = () => {
        const id = Number(apiId.trim());
        if (!id || !apiHash.trim()) {
            setNotice('Both api_id and api_hash are required.');
            return;
        }
        tg.saveCredentials({ apiId: id, apiHash: apiHash.trim() });
        setNeedsCreds(false);
        setNotice(null);
    };

    const send = async () => {
        const text = draft.trim();
        if (!text || !activeId) return;
        setDraft('');
        try {
            const sent = await provider.sendMessage(activeId, text);
            setMessages(prev => (prev.some(p => p.id === sent.id) ? prev : [...prev, sent]));
            void refreshChats();
        } catch (err) {
            setMessages(prev => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    chatId: activeId,
                    text,
                    outgoing: true,
                    timestamp: Date.now(),
                    senderName: 'You',
                    error: err instanceof Error ? err.message : 'Failed to send',
                },
            ]);
        }
    };

    const newLocalChat = () => {
        const title = window.prompt('Name this conversation');
        if (!title) return;
        createLocalChat(title);
        void refreshChats();
    };

    const removeLocalChat = (id: string) => {
        deleteLocalChat(id);
        if (activeId === id) {
            setActiveId(null);
            setMessages([]);
        }
        void refreshChats();
    };

    /* ----------------------------------------------------------------- view */

    const connected = conn.status === 'connected';
    const showTelegramGate = providerId === 'telegram' && !connected;

    return (
        <div className="flex h-full flex-col bg-zinc-950 text-zinc-200">
            {/* header */}
            <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2">
                <div className="flex rounded-md border border-zinc-700 p-0.5">
                    {(['telegram', 'local'] as ProviderId[]).map(id => (
                        <button
                            key={id}
                            onClick={() => setProviderId(id)}
                            className={`rounded px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                                providerId === id ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {PROVIDERS[id].label}
                        </button>
                    ))}
                </div>
                <div className="min-w-0 flex-1 truncate text-[11px] font-mono text-zinc-500">
                    {providerId === 'telegram'
                        ? connected
                            ? `${conn.user.name}${conn.user.phone ? ` · ${conn.user.phone}` : ''}`
                            : 'Not signed in'
                        : 'On this device only — no account, no network'}
                </div>
                {providerId === 'telegram' && connected && (
                    <button
                        onClick={() => void tg.signOut()}
                        title="Sign out and revoke this session"
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
                    >
                        <LogOut size={13} /> Sign out
                    </button>
                )}
            </div>

            {notice && (
                <div className="flex items-start gap-2 border-b border-amber-900/50 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-300">
                    <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                    <span className="flex-1">{notice}</span>
                    <button onClick={() => setNotice(null)} className="text-amber-500 hover:text-amber-200">
                        ✕
                    </button>
                </div>
            )}

            {showTelegramGate ? (
                <SignInPanel
                    conn={conn}
                    needsCreds={needsCreds}
                    apiId={apiId}
                    apiHash={apiHash}
                    setApiId={setApiId}
                    setApiHash={setApiHash}
                    saveCreds={saveCreds}
                    beginSignIn={beginSignIn}
                    pending={pending}
                    promptValue={promptValue}
                    setPromptValue={setPromptValue}
                    submitPrompt={submitPrompt}
                    onEditCreds={() => setNeedsCreds(true)}
                />
            ) : (
                <div className="flex min-h-0 flex-1">
                    {/* chat list */}
                    <div className="flex w-56 shrink-0 flex-col border-r border-zinc-800">
                        {providerId === 'local' && (
                            <button
                                onClick={newLocalChat}
                                className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-[11px] text-sky-400 hover:bg-zinc-900"
                            >
                                <Plus size={13} /> New conversation
                            </button>
                        )}
                        <div className="flex-1 overflow-y-auto">
                            {chats.length === 0 && (
                                <p className="px-3 py-6 text-center text-[11px] text-zinc-600">
                                    {providerId === 'local' ? 'No conversations yet.' : 'No chats loaded.'}
                                </p>
                            )}
                            {chats.map(c => (
                                <div
                                    key={c.id}
                                    className={`group flex cursor-pointer items-center gap-2 border-b border-zinc-900 px-2.5 py-2 ${
                                        activeId === c.id ? 'bg-zinc-800/70' : 'hover:bg-zinc-900'
                                    }`}
                                    onClick={() => setActiveId(c.id)}
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-sky-900 text-[11px] font-semibold text-white">
                                        {c.monogram}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-zinc-200">{c.title}</p>
                                        <p className="truncate text-[10px] text-zinc-500">{c.subtitle}</p>
                                    </div>
                                    {c.unread > 0 && (
                                        <span className="rounded-full bg-sky-600 px-1.5 text-[9px] font-semibold text-white">
                                            {c.unread}
                                        </span>
                                    )}
                                    {providerId === 'local' && (
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                removeLocalChat(c.id);
                                            }}
                                            className="hidden text-zinc-600 hover:text-rose-400 group-hover:block"
                                            title="Delete conversation"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* transcript */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        {!activeId ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-zinc-600">
                                <MessageSquare size={28} />
                                <p className="text-xs">Select a conversation</p>
                            </div>
                        ) : (
                            <>
                                <div ref={transcriptRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                                    {busy && (
                                        <div className="flex justify-center py-4 text-zinc-600">
                                            <Loader2 size={16} className="animate-spin" />
                                        </div>
                                    )}
                                    {messages.map(m => (
                                        <div key={m.id} className={`flex ${m.outgoing ? 'justify-end' : 'justify-start'}`}>
                                            <div
                                                className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-xs ${
                                                    m.error
                                                        ? 'bg-rose-950 text-rose-200 ring-1 ring-rose-800'
                                                        : m.outgoing
                                                          ? 'bg-sky-700 text-white'
                                                          : 'bg-zinc-800 text-zinc-200'
                                                }`}
                                            >
                                                {!m.outgoing && (
                                                    <p className="mb-0.5 text-[10px] font-semibold text-sky-400">
                                                        {m.senderName}
                                                    </p>
                                                )}
                                                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                                                <p className="mt-0.5 text-right text-[9px] opacity-60">
                                                    {m.error
                                                        ? `Failed — ${m.error}`
                                                        : new Date(m.timestamp).toLocaleTimeString([], {
                                                              hour: '2-digit',
                                                              minute: '2-digit',
                                                          })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 border-t border-zinc-800 p-2">
                                    <input
                                        value={draft}
                                        onChange={e => setDraft(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void send())}
                                        placeholder="Write a message…"
                                        className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-600"
                                    />
                                    <button
                                        onClick={() => void send()}
                                        disabled={!draft.trim()}
                                        className="rounded-md bg-sky-600 p-1.5 text-white disabled:opacity-40"
                                        title="Send"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* --------------------------------------------------------------- sign-in */

const SignInPanel: React.FC<{
    conn: ConnectionState;
    needsCreds: boolean;
    apiId: string;
    apiHash: string;
    setApiId: (v: string) => void;
    setApiHash: (v: string) => void;
    saveCreds: () => void;
    beginSignIn: () => void;
    pending: PendingPrompt | null;
    promptValue: string;
    setPromptValue: (v: string) => void;
    submitPrompt: () => void;
    onEditCreds: () => void;
}> = props => {
    const copy = props.pending ? PROMPT_COPY[props.pending.kind] : null;

    return (
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
            <div className="w-full max-w-sm space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-800">
                        <Send size={20} className="text-white" />
                    </div>
                    <h2 className="text-sm font-semibold text-zinc-100">Sign in to Telegram</h2>
                    <p className="mt-1 text-[11px] text-zinc-500">
                        Your own account over MTProto — not a bot. Your session stays on this device.
                    </p>
                </div>

                {props.needsCreds ? (
                    <div className="space-y-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                            <KeyRound size={12} /> Application keys
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-500">
                            Create these once at <span className="text-sky-400">my.telegram.org</span> → API development
                            tools. They identify the app, and are stored on this device only.
                        </p>
                        <input
                            value={props.apiId}
                            onChange={e => props.setApiId(e.target.value)}
                            placeholder="api_id (numeric)"
                            inputMode="numeric"
                            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-sky-600"
                        />
                        <input
                            value={props.apiHash}
                            onChange={e => props.setApiHash(e.target.value)}
                            placeholder="api_hash"
                            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-sky-600"
                        />
                        <button
                            onClick={props.saveCreds}
                            className="w-full rounded bg-sky-600 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                        >
                            Save keys
                        </button>
                    </div>
                ) : props.pending && copy ? (
                    <div className="space-y-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5">
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                            {copy.label}
                        </label>
                        <input
                            autoFocus
                            type={props.pending.kind === 'password' ? 'password' : 'text'}
                            value={props.promptValue}
                            onChange={e => props.setPromptValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && props.submitPrompt()}
                            placeholder={copy.placeholder}
                            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-sky-600"
                        />
                        <p className="text-[11px] text-zinc-500">
                            {props.pending.hint ? `Hint: ${props.pending.hint}` : copy.help}
                        </p>
                        <button
                            onClick={props.submitPrompt}
                            className="w-full rounded bg-sky-600 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                        >
                            Continue
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={props.beginSignIn}
                        disabled={props.conn.status === 'connecting'}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                    >
                        {props.conn.status === 'connecting' && <Loader2 size={13} className="animate-spin" />}
                        {props.conn.status === 'connecting' ? 'Connecting…' : 'Sign in with phone number'}
                    </button>
                )}

                {conn_error(props.conn) && (
                    <p className="rounded border border-rose-900 bg-rose-950/50 px-2.5 py-1.5 text-[11px] text-rose-300">
                        {conn_error(props.conn)}
                    </p>
                )}

                {!props.needsCreds && (
                    <button
                        onClick={props.onEditCreds}
                        className="w-full text-center text-[10px] text-zinc-600 underline hover:text-zinc-400"
                    >
                        Change application keys
                    </button>
                )}

                <p className="rounded border border-zinc-800 bg-zinc-900/40 px-2.5 py-2 text-[10px] leading-relaxed text-zinc-500">
                    <ShieldAlert size={11} className="mr-1 inline text-amber-500" />
                    A Telegram session is a full account credential. Sign out here rather than clearing browser data —
                    that revokes it at Telegram instead of leaving it live on their servers.
                </p>
            </div>
        </div>
    );
};

const conn_error = (c: ConnectionState): string | null => (c.status === 'error' ? c.message : null);
