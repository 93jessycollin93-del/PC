/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { Mail, Star, Trash2, Inbox, Send, Archive } from 'lucide-react';
import { Email } from '../../types';

interface MailAppProps {
    emails: Email[];
}

export const MailApp: React.FC<MailAppProps> = ({ emails }) => {
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
    const selectedEmail = emails.find(e => e.id === selectedEmailId);

    // If the selected email was deleted, deselect it
    React.useEffect(() => {
        if (selectedEmailId !== null && !selectedEmail) {
            setSelectedEmailId(null);
        }
    }, [emails, selectedEmailId, selectedEmail]);

    return (
        <div className="h-full w-full bg-zinc-950 flex text-zinc-200">
            {/* Sidebar */}
            <div className="w-48 bg-zinc-950 border-r border-zinc-800 flex-shrink-0 overflow-y-auto overscroll-y-contain">
                <div className="p-4 font-bold text-lg flex items-center gap-2 text-blue-400">
                    <Mail size={20} /> Mail
                </div>
                <nav className="flex flex-col gap-1 px-2">
                    <button className="flex items-center gap-3 px-3 py-2 bg-blue-500/20 text-blue-300 rounded-md text-sm font-medium">
                        <Inbox size={16} /> Inbox
                        {emails.filter(e => e.unread).length > 0 && (
                            <span className="ml-auto bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {emails.filter(e => e.unread).length}
                            </span>
                        )}
                    </button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-md text-sm font-medium transition-colors">
                        <Star size={16} /> Starred
                    </button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-md text-sm font-medium transition-colors">
                        <Send size={16} /> Sent
                    </button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-md text-sm font-medium transition-colors">
                        <Archive size={16} /> Archive
                    </button>
                    <button className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-md text-sm font-medium transition-colors">
                        <Trash2 size={16} /> Trash
                    </button>
                </nav>
            </div>

            {/* Email List */}
            <div className={`${selectedEmail ? 'hidden md:block' : 'block'} w-full md:w-80 border-r border-zinc-800 overflow-y-auto overscroll-y-contain bg-zinc-950`}>
                {emails.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                        <Inbox size={48} className="mb-4 opacity-20" />
                        <p>Inbox is empty</p>
                    </div>
                ) : (
                    emails.map(email => (
                        <div
                            key={email.id}
                            onClick={() => setSelectedEmailId(email.id)}
                            className={`p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors ${selectedEmailId === email.id ? 'bg-blue-900/20' : ''}`}
                        >
                            <div className="flex justify-between items-baseline mb-1">
                                <span className={`font-medium truncate ${email.unread ? 'text-white font-bold' : 'text-zinc-300'}`}>{email.from}</span>
                                <span className="text-xs text-zinc-500 flex-shrink-0 ml-2">{email.time}</span>
                            </div>
                            <div className={`text-sm mb-1 truncate ${email.unread ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>{email.subject}</div>
                            <div className="text-xs text-zinc-500 truncate">{email.preview}</div>
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
                        <h2 className="text-2xl font-bold mb-4 text-white">{selectedEmail.subject}</h2>
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
                        {emails.length > 0 ? "Select an email to read" : "No emails"}
                    </div>
                )}
            </div>
        </div>
    );
};