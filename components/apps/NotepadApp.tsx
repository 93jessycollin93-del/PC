/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Save, FolderOpen, Download, History, Check, FileText } from 'lucide-react';
import { getFile, saveFile, getHistory, restoreFromHistory, getRecentFiles } from '../../lib/storage';

interface NotepadAppProps {
    fileId: string;
    initialContent?: string;
}

export const NotepadApp: React.FC<NotepadAppProps> = ({ fileId, initialContent = '' }) => {
    const [content, setContent] = useState(() => getFile(fileId) || initialContent);
    const [autoSave, setAutoSave] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [showRecent, setShowRecent] = useState(false);
    const [recentFiles, setRecentFiles] = useState<{id: string, timestamp: number}[]>([]);
    const [savedToast, setSavedToast] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef(content);

    useEffect(() => {
        contentRef.current = content;
        if (autoSave) {
            const timer = setTimeout(() => {
                saveFile(fileId, content, true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [content, fileId, autoSave]);

    const handleSave = () => {
        saveFile(fileId, content, false);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
    };

    useEffect(() => {
        if (showRecent) {
            setRecentFiles(getRecentFiles());
        }
    }, [showRecent]);
    const handleSaveAs = () => {
        const defaultName = fileId.includes('.') ? fileId : `${fileId}.txt`;
        const fileName = prompt("Save file as:", defaultName) || defaultName;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleOpen = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                setContent(text);
                saveFile(fileId, text, false);
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const historyItems = getHistory(fileId);

    return (
        <div className="h-full w-full bg-zinc-950 text-zinc-200 flex flex-col font-sans select-text relative">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".txt,.md,.json,.js,.ts,.tsx,.csv" 
                className="hidden" 
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-xs select-none">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                        onClick={handleOpen} 
                        className="px-2.5 py-1.5 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 rounded-md flex items-center gap-1.5 transition-colors"
                        title="Open file from disk"
                    >
                        <FolderOpen size={13} className="text-amber-400" />
                        <span>Open</span>
                    </button>

                    <button 
                        onClick={handleSave} 
                        className="px-2.5 py-1.5 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 rounded-md flex items-center gap-1.5 transition-colors"
                        title="Save progress"
                    >
                        {savedToast ? <Check size={13} className="text-emerald-400" /> : <Save size={13} className="text-sky-400" />}
                        <span className={savedToast ? "text-emerald-400 font-medium" : ""}>{savedToast ? "Saved!" : "Save"}</span>
                    </button>

                    <button 
                        onClick={handleSaveAs} 
                        className="px-2.5 py-1.5 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 rounded-md flex items-center gap-1.5 transition-colors"
                        title="Export as text file"
                    >
                        <Download size={13} className="text-purple-400" />
                        <span>Save As</span>
                    </button>

                    <div className="w-px h-4 bg-zinc-800 mx-1" />
                    <button 
                        onClick={() => setShowRecent(!showRecent)} 
                        className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${showRecent ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-300'}`}
                        title="View recently edited files"
                    >
                        <FolderOpen size={13} />
                        <span>Recent</span>
                    </button>
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${showHistory ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-300'}`}
                        title="Restore up to 20 previous versions"
                    >
                        <History size={13} />
                        <span>History ({historyItems.length})</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors" title="Automatically save progress while typing">
                        <input 
                            type="checkbox" 
                            checked={autoSave} 
                            onChange={(e) => setAutoSave(e.target.checked)} 
                            className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span>Auto-Save</span>
                    </label>
                </div>
            </div>

            {/* Recent Files Drawer */}
            {showRecent && (
                <div className="bg-zinc-900 border-b border-zinc-800 p-2 shadow-xl z-20">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-mono flex items-center justify-between">
                        <span>Recent Files</span>
                    </div>
                    {recentFiles.length === 0 ? (
                        <div className="p-3 text-center text-zinc-500 text-xs italic">No recent files found.</div>
                    ) : (
                        recentFiles.map((rf, i) => (
                            <button 
                                key={rf.id} 
                                className="w-full text-left text-xs p-2 rounded hover:bg-zinc-800 flex items-center justify-between group transition-colors"
                                onClick={() => {
                                    const c = getFile(rf.id);
                                    if (c !== null) {
                                        setContent(c);
                                    }
                                    setShowRecent(false);
                                }}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <FileText size={12} className="text-zinc-500" />
                                    <span className="font-mono text-zinc-300">{rf.id}</span>
                                    <span className="text-[10px] text-zinc-500">{new Date(rf.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 font-medium">Open</span>
                            </button>
                        ))
                    )}
                </div>
            )}

            {/* History Drawer */}
            {showHistory && (
                <div className="bg-zinc-900 border-b border-zinc-800 p-2 max-h-48 overflow-y-auto space-y-1 shadow-xl z-20">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-mono flex items-center justify-between">
                        <span>Previous 20 Saved Snapshots</span>
                        <span>Tap to restore</span>
                    </div>
                    {historyItems.length === 0 ? (
                        <div className="p-3 text-center text-zinc-500 text-xs italic">No saved history yet. Type something to create a snapshot!</div>
                    ) : (
                        historyItems.map((h, i) => (
                            <button 
                                key={h.timestamp} 
                                className="w-full text-left text-xs p-2 rounded hover:bg-zinc-800 flex items-center justify-between group transition-colors"
                                onClick={() => {
                                    const restored = restoreFromHistory(fileId, h.timestamp);
                                    if (restored !== null) {
                                        setContent(restored);
                                        setSavedToast(true);
                                        setTimeout(() => setSavedToast(false), 2000);
                                    }
                                    setShowHistory(false);
                                }}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-[10px] text-zinc-500 w-5">{i + 1}.</span>
                                    <span className="font-mono text-zinc-300">{new Date(h.timestamp).toLocaleTimeString()}</span>
                                    <span className="text-zinc-500 truncate text-[11px] max-w-[200px]">({h.content.slice(0, 30)}...)</span>
                                </div>
                                <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 font-medium">Restore</span>
                            </button>
                        ))
                    )}
                </div>
            )}

            {/* Editor Area */}
            <textarea 
                className="flex-1 w-full p-4 resize-none border-none focus:outline-none font-mono text-sm bg-transparent text-zinc-100 placeholder-zinc-600 leading-relaxed overflow-y-auto overscroll-y-contain"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your notes or story here..."
                spellCheck={false}
            />

            {/* Footer Status Bar */}
            <div className="px-3 py-1 bg-zinc-900/60 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-500 flex items-center justify-between shrink-0">
                <span>FILE: {fileId}</span>
                <span>{content.length} chars • {content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
            </div>
        </div>
    );
};