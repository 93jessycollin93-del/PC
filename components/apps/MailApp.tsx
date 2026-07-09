/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { Mail, Star, Trash2, Inbox, Send, Archive, ArchiveRestore, RotateCcw } from 'lucide-react';
import { Email } from '../../types';

interface MailAppProps {
    emails: Email[];
}

type Folder = 'inbox' | 'starred' | 'sent' | 'archive' | 'trash';

export const MailApp: React.FC<MailAppProps> = ({ emails }) => {
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
    const [folder, setFolder] = useState<Folder>('inbox');

    // Folder membership + read state kept locally so we never mutate the shared
    // (persisted) email list or its type.
    const [starred, setStarred] = useState<Set<number>>(new Set());
    const [archived, setArchived] = useState<Set<number>>(new Set());
    const [trashed, setTrashed] = useState<Set<number>>(new Set());
    const [readIds, setReadIds] = useState<Set<number>>(new Set());

    const isUnread = (e: Email) => e.unread && !readIds.has(e.id);

    const toggle = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) =>
        setter(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const visible = useMemo(() => {
        switch (folder) {
            case 'starred':
                return emails.filter(e => starred.has(e.id) && !trashed.has(e.id));
            case 'archive':
                return emails.filter(e => archived.has(e.id) && !trashed.has(e.id));
            case 'trash':
                return emails.filter(e => trashed.has(e.id));
            case 'sent':
                return [];
            case 'inbox':
            default:
                return emails.filter(e => !archived.has(e.id) && !trashed.has(e.id));
        }
    }, [emails, folder, starred, archived, trashed]);

    const selectedEmail = visible.find(e => e.id === selectedEmailId);

    React.useEffect(() => {
        if (selectedEmailId !== null && !selectedEmail) setSelectedEmailId(null);
    }, [visible, selectedEmailId, selectedEmail]);

    const openEmail = (id: number) => {
        setSelectedEmailId(id);
        setReadIds(prev => new Set(prev).add(id));
    };

    const inboxUnread = emails.filter(e => isUnread(e) && !archived.has(e.id) && !trashed.has(e.id)).length;

    const FOLDERS: { id: Folder; label: string; icon: React.ElementType; count?: number }[] = [
        { id: 'inbox', label: 'Inbox', icon: Inbox, count: inboxUnread },
        { id: 'starred', label: 'Starred', icon: Star, count: emails.filter(e => starred.has(e.id) && !trashed.has(e.id)).length },
        { id: 'sent', label: 'Sent', icon: Send },
        { id: 'archive', label: 'Archive', icon: Archive, count: emails.filter(e => archived.has(e.id) && !trashed.has(e.id)).length },
        { id: 'trash', label: 'Trash', icon: Trash2, count: trashed.size },
    ];

    return (
        <div className="h-full w-full bg-zinc-950 flex text-zinc-200">
            {/* Sidebar */}
            <div className="w-48 bg-zinc-950 border-r border-zinc-800 flex-shrink-0 overflow-y-auto overscroll-y-contain">
                <div className="p-4 font-bold text-lg flex items-center gap-2 text-blue-400">
                    <Mail size={20} /> Mail
                </div>
                <nav className="flex flex-col gap-1 px-2">
                    {FOLDERS.map(f => {
                        const Icon = f.icon;
                        const active = folder === f.id;
                        return (
                            <button
                                key={f.id}
                                onClick={() => { setFolder(f.id); setSelectedEmailId(null); }}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    active ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                }`}
                            >
                                <Icon size={16} /> {f.label}
                                {!!f.count && f.count > 0 && (
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${active ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-200'}`}>
                                        {f.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Email List */}
            <div className={`${selectedEmail ? 'hidden md:block' : 'block'} w-full md:w-80 border-r border-zinc-800 overflow-y-auto overscroll-y-contain bg-zinc-950`}>
                {visible.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                        <Inbox size={48} className="mb-4 opacity-20" />
                        <p>{folder === 'sent' ? 'No sent mail' : folder === 'trash' ? 'Trash is empty' : `${folder[0].toUpperCase()}${folder.slice(1)} is empty`}</p>
                    </div>
                ) : (
                    visible.map(email => (
                        <div
                            key={email.id}
                            onClick={() => openEmail(email.id)}
                            className={`group p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors ${selectedEmailId === email.id ? 'bg-blue-900/20' : ''}`}
                        >
                            <div className="flex justify-between items-baseline mb-1">
                                <span className={`font-medium truncate ${isUnread(email) ? 'text-white font-bold' : 'text-zinc-300'}`}>{email.from}</span>
                                <span className="text-xs text-zinc-500 flex-shrink-0 ml-2">{email.time}</span>
                            </div>
                            <div className={`text-sm mb-1 truncate ${isUnread(email) ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>{email.subject}</div>
                            <div className="text-xs text-zinc-500 truncate">{email.preview}</div>
                            {/* Hover quick actions */}
                            <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggle(setStarred, email.id); }}
                                    title={starred.has(email.id) ? 'Unstar' : 'Star'}
                                    className={`p-1 rounded ${starred.has(email.id) ? 'text-amber-400' : 'text-zinc-500 hover:text-amber-400'}`}
                                >
                                    <Star size={13} fill={starred.has(email.id) ? 'currentColor' : 'none'} />
                                </button>
                                {folder === 'trash' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggle(setTrashed, email.id); }}
                                        title="Restore"
                                        className="p-1 rounded text-zinc-500 hover:text-emerald-400"
                                    >
                                        <RotateCcw size={13} />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggle(setArchived, email.id); }}
                                            title={archived.has(email.id) ? 'Unarchive' : 'Archive'}
                                            className="p-1 rounded text-zinc-500 hover:text-blue-400"
                                        >
                                            {archived.has(email.id) ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggle(setTrashed, email.id); }}
                                            title="Move to Trash"
                                            className="p-1 rounded text-zinc-500 hover:text-red-400"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Email View */}
            <div className={`${selectedEmail ? 'block' : 'hidden md:block'} flex-1 bg-zinc-950 overflow-y-auto overscroll-y-contain`}>
                {selectedEmail ? (
                    <div className="p-8">
                        <button className="md:hidden mb-4 text-blue-400 text-sm" onClick={() => setSelectedEmailId(null)}>
                            ← Back to list
                        </button>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h2 className="text-2xl font-bold text-white">{selectedEmail.subject}</h2>
                            <div className="flex gap-1 flex-shrink-0">
                                <button
                                    onClick={() => toggle(setStarred, selectedEmail.id)}
                                    title={starred.has(selectedEmail.id) ? 'Unstar' : 'Star'}
                                    className={`p-2 rounded-lg transition-colors ${starred.has(selectedEmail.id) ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-800'}`}
                                >
                                    <Star size={16} fill={starred.has(selectedEmail.id) ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                    onClick={() => { toggle(setArchived, selectedEmail.id); setSelectedEmailId(null); }}
                                    title="Archive"
                                    className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                                >
                                    <Archive size={16} />
                                </button>
                                <button
                                    onClick={() => { toggle(setTrashed, selectedEmail.id); setSelectedEmailId(null); }}
                                    title="Delete"
                                    className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                            <div>
                                <div className="font-medium text-lg text-zinc-200">{selectedEmail.from}</div>
                                <div className="text-zinc-500 text-sm">to me</div>
                            </div>
                            <div className="text-zinc-500 text-sm">{selectedEmail.time}</div>
                        </div>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {selectedEmail.body}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500">
                        {visible.length > 0 ? "Select an email to read" : "No emails"}
                    </div>
                )}
            </div>
        </div>
    );
};
