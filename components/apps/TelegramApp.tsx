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
import { Send, LogOut, Loader2, Plus, ShieldAlert, KeyRound, MessageSquare, Trash2, Lock, ShieldCheck, Fingerprint } from 'lucide-react';
import * as tg from '../../lib/telegram/client';
import * as vault from '../../lib/telegram/vault';
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
    // Starts on the provider that needs no credentials; an effect promotes it
    // to Telegram once we know a sealed session exists. `hasSession()` is
    // async now, and a Promise is always truthy — reading it synchronously
    // here would silently always pick Telegram.
    const [providerId, setProviderId] = useState<ProviderId>('local');
    const [vaultStatus, setVaultStatus] = useState<vault.VaultStatus | null>(null);
    const [unlockValue, setUnlockValue] = useState('');
    const [sealChoice, setSealChoice] = useState<vault.UnlockMethod>('passkey');
    const [sealValue, setSealValue] = useState('');
    const [sealConfirm, setSealConfirm] = useState('');
    const [pendingSeal, setPendingSeal] = useState(false);
    const [working, setWorking] = useState(false);
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

    const refreshVault = useCallback(async () => {
        const status = await vault.getStatus();
        setVaultStatus(status);
        return status;
    }, []);

    // Vault status drives which panel the Telegram tab shows, so keep it live.
    useEffect(() => vault.subscribeVault(() => void refreshVault()), [refreshVault]);

    useEffect(() => {
        void (async () => {
            // A session written by the pre-vault build is plaintext in
            // localStorage. Move it out on first run, then require sealing.
            if (tg.adoptLegacySession()) {
                setPendingSeal(true);
                setProviderId('telegram');
                setNotice('An unencrypted session from an earlier version was found and removed from storage. Choose how to lock it.');
            }
            const status = await refreshVault();
            if (status.exists) setProviderId('telegram');
        })();
    }, [refreshVault]);

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
            // Authorised but not yet sealed: the session exists only in memory
            // until the user picks a lock, so the app cannot proceed past this.
            if (tg.hasPendingSeal()) setPendingSeal(true);
            await refreshChats();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Sign-in failed');
            setPending(null);
        }
    };

    const doUnlock = async () => {
        setWorking(true);
        setNotice(null);
        try {
            await vault.unseal({ passphrase: unlockValue || undefined });
            setUnlockValue('');
            await tg.connect(authChannel);
            await refreshChats();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Unlock failed');
        } finally {
            setWorking(false);
            void refreshVault();
        }
    };

    const doSeal = async () => {
        if (sealChoice === 'passphrase') {
            if (sealValue.length < 8) return setNotice('Passphrase must be at least 8 characters.');
            if (sealValue !== sealConfirm) return setNotice('Passphrases do not match.');
        }
        setWorking(true);
        setNotice(null);
        try {
            await tg.sealPending({
                method: sealChoice,
                passphrase: sealChoice === 'passphrase' ? sealValue : undefined,
            });
            setSealValue('');
            setSealConfirm('');
            setPendingSeal(false);
            await refreshChats();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Could not seal the session');
        } finally {
            setWorking(false);
            void refreshVault();
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
    const vaultLocked = Boolean(vaultStatus?.exists) && !vaultStatus?.unlocked;
    // Order matters: sealing an authorised session outranks everything, then
    // unlocking an existing vault, then a fresh sign-in.
    const telegramPanel: 'seal' | 'unlock' | 'signin' | null = pendingSeal
        ? 'seal'
        : vaultLocked
          ? 'unlock'
          : !connected
            ? 'signin'
            : null;
    const showTelegramGate = providerId === 'telegram' && telegramPanel !== null;

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
                {providerId === 'telegram' && vaultStatus?.unlocked && (
                    <button
                        onClick={() => vault.lock('manual')}
                        title="Lock the vault — the session leaves memory until you unlock again"
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
                    >
                        <Lock size={13} /> Lock
                    </button>
                )}
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

            {showTelegramGate && telegramPanel === 'seal' ? (
                <SealPanel
                    choice={sealChoice}
                    setChoice={setSealChoice}
                    value={sealValue}
                    setValue={setSealValue}
                    confirm={sealConfirm}
                    setConfirm={setSealConfirm}
                    onSeal={() => void doSeal()}
                    working={working}
                    passkeySupported={vaultStatus?.passkeySupported ?? false}
                />
            ) : showTelegramGate && telegramPanel === 'unlock' ? (
                <UnlockPanel
                    method={vaultStatus?.method ?? 'passphrase'}
                    value={unlockValue}
                    setValue={setUnlockValue}
                    onUnlock={() => void doUnlock()}
                    onWipe={async () => {
                        if (!window.confirm('Erase the sealed session from this device? The account stays signed in at Telegram — use Sign out first to revoke it.')) return;
                        await vault.wipe();
                        setProviderId('local');
                    }}
                    working={working}
                    lockedUntil={vaultStatus?.lockedUntil ?? 0}
                    failedAttempts={vaultStatus?.failedAttempts ?? 0}
                />
            ) : showTelegramGate ? (
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

/* ------------------------------------------------------------------ vault */

const Shell: React.FC<{ title: string; sub: string; icon: React.ReactNode; children: React.ReactNode }> = ({
    title,
    sub,
    icon,
    children,
}) => (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
        <div className="w-full max-w-sm space-y-4">
            <div className="text-center">
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-800">
                    {icon}
                </div>
                <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{sub}</p>
            </div>
            {children}
        </div>
    </div>
);

/** Choose how a freshly authorised session gets locked, before it is stored. */
const SealPanel: React.FC<{
    choice: vault.UnlockMethod;
    setChoice: (m: vault.UnlockMethod) => void;
    value: string;
    setValue: (v: string) => void;
    confirm: string;
    setConfirm: (v: string) => void;
    onSeal: () => void;
    working: boolean;
    passkeySupported: boolean;
}> = p => (
    <Shell
        icon={<ShieldCheck size={20} className="text-white" />}
        title="Lock this session"
        sub="You are signed in. The session is in memory only — close this tab now and it is gone. Choose how to encrypt it before it is written to disk."
    >
        <div className="space-y-2">
            <button
                onClick={() => p.setChoice('passkey')}
                disabled={!p.passkeySupported}
                className={`w-full rounded-lg border p-3 text-left transition-colors disabled:opacity-40 ${
                    p.choice === 'passkey' ? 'border-sky-500 bg-sky-950/40' : 'border-zinc-700 hover:border-zinc-600'
                }`}
            >
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-100">
                    <Fingerprint size={13} /> Passkey
                    <span className="ml-auto rounded bg-emerald-900/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                        Strongest
                    </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    {p.passkeySupported
                        ? 'Face/fingerprint. The key is derived inside the authenticator, so there is no passphrase to phish, guess, or brute-force offline.'
                        : 'Unavailable on this browser or device.'}
                </p>
            </button>
            <button
                onClick={() => p.setChoice('passphrase')}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    p.choice === 'passphrase' ? 'border-sky-500 bg-sky-950/40' : 'border-zinc-700 hover:border-zinc-600'
                }`}
            >
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-100">
                    <KeyRound size={13} /> Passphrase
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    PBKDF2-SHA256, 600,000 iterations. Works everywhere. Its strength is entirely the strength of what you choose.
                </p>
            </button>
        </div>

        {p.choice === 'passphrase' && (
            <div className="space-y-2">
                <input
                    autoFocus
                    type="password"
                    value={p.value}
                    onChange={e => p.setValue(e.target.value)}
                    placeholder="Passphrase (8+ characters)"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-sky-600"
                />
                <input
                    type="password"
                    value={p.confirm}
                    onChange={e => p.setConfirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && p.onSeal()}
                    placeholder="Confirm passphrase"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-sky-600"
                />
            </div>
        )}

        <button
            onClick={p.onSeal}
            disabled={p.working}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
            {p.working && <Loader2 size={13} className="animate-spin" />}
            {p.working ? 'Encrypting…' : 'Encrypt and store'}
        </button>
        <p className="text-center text-[10px] leading-relaxed text-zinc-600">
            There is no recovery. Nothing about this session leaves your device, so nobody — including this app — can reset it for you.
        </p>
    </Shell>
);

/** Unlock an existing sealed session. */
const UnlockPanel: React.FC<{
    method: vault.UnlockMethod;
    value: string;
    setValue: (v: string) => void;
    onUnlock: () => void;
    onWipe: () => void;
    working: boolean;
    lockedUntil: number;
    failedAttempts: number;
}> = p => {
    const throttled = p.lockedUntil > Date.now();
    return (
        <Shell
            icon={<Lock size={20} className="text-white" />}
            title="Unlock Telegram"
            sub={
                p.method === 'passkey'
                    ? 'This session is sealed with a passkey. Confirm with your device to decrypt it.'
                    : 'This session is encrypted on this device. Enter your passphrase to decrypt it.'
            }
        >
            {p.method === 'passphrase' && (
                <input
                    autoFocus
                    type="password"
                    value={p.value}
                    onChange={e => p.setValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !throttled && p.onUnlock()}
                    placeholder="Passphrase"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-sky-600"
                />
            )}
            <button
                onClick={p.onUnlock}
                disabled={p.working || throttled}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
                {p.working && <Loader2 size={13} className="animate-spin" />}
                {p.method === 'passkey' ? 'Unlock with passkey' : 'Unlock'}
            </button>

            {p.failedAttempts > 0 && (
                <p className="text-center text-[11px] text-amber-400">
                    {p.failedAttempts} failed attempt{p.failedAttempts === 1 ? '' : 's'}
                    {throttled && ` — locked until ${new Date(p.lockedUntil).toLocaleTimeString()}`}
                </p>
            )}

            <button
                onClick={p.onWipe}
                className="w-full text-center text-[10px] text-zinc-600 underline hover:text-rose-400"
            >
                Forget this session on this device
            </button>
        </Shell>
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
