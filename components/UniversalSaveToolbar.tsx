/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Save, FolderOpen, Download, History, Check } from 'lucide-react';
import { saveFile, getHistory, restoreFromHistory } from '../lib/storage';

interface UniversalSaveToolbarProps {
    fileId: string;
    content: string;
    onUpdate: (newContent: string) => void;
    fileExtension?: string;
    theme?: 'dark' | 'light';
}

export const UniversalSaveToolbar: React.FC<UniversalSaveToolbarProps> = ({
    fileId,
    content,
    onUpdate,
    fileExtension = '.txt',
    theme = 'dark'
}) => {
    const [autoSave, setAutoSave] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [savedToast, setSavedToast] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-save debounce effect
    useEffect(() => {
        if (!autoSave || content === undefined || content === null) return;
        const timer = setTimeout(() => {
            saveFile(fileId, content, true);
        }, 1000);
        return () => clearTimeout(timer);
    }, [content, fileId, autoSave]);

    const handleSave = () => {
        if (content === undefined || content === null) return;
        saveFile(fileId, content, false);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
    };

    const handleSaveAs = () => {
        const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const defaultName = fileId.includes('.') ? fileId : `${cleanId}${fileExtension}`;
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
                onUpdate(text);
                saveFile(fileId, text, false);
                setSavedToast(true);
                setTimeout(() => setSavedToast(false), 2000);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const historyItems = getHistory(fileId);

    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-zinc-800 border-zinc-700 text-zinc-100';
    const drawerBg = isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 border-zinc-700';

    return (
        <div className="flex flex-col shrink-0 font-sans select-none relative z-20 w-full">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".txt,.md,.json,.js,.ts,.tsx,.csv,.docx" 
                className="hidden" 
            />

            {/* Main Toolbar */}
            <div className={`flex items-center justify-between px-3 py-2 border-b text-xs ${bgClass}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                        onClick={handleOpen} 
                        className="px-2.5 py-1 hover:bg-white/10 active:bg-white/20 rounded flex items-center gap-1.5 transition-colors"
                        title="Open file from disk"
                    >
                        <FolderOpen size={13} className="text-amber-400" />
                        <span>Open</span>
                    </button>

                    <button 
                        onClick={handleSave} 
                        className="px-2.5 py-1 hover:bg-white/10 active:bg-white/20 rounded flex items-center gap-1.5 transition-colors"
                        title="Save progress (maintains 20 history versions)"
                    >
                        {savedToast ? <Check size={13} className="text-emerald-400" /> : <Save size={13} className="text-sky-400" />}
                        <span className={savedToast ? "text-emerald-400 font-medium" : ""}>{savedToast ? "Saved!" : "Save"}</span>
                    </button>

                    <button 
                        onClick={handleSaveAs} 
                        className="px-2.5 py-1 hover:bg-white/10 active:bg-white/20 rounded flex items-center gap-1.5 transition-colors"
                        title="Export as file"
                    >
                        <Download size={13} className="text-purple-400" />
                        <span>Save As</span>
                    </button>

                    <div className="w-px h-3.5 bg-white/20 mx-1" />

                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${showHistory ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`}
                        title="Restore up to 20 previous versions"
                    >
                        <History size={13} />
                        <span>History ({historyItems.length})</span>
                    </button>
                </div>

                <div className="flex items-center gap-2 ml-2">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors text-[11px]" title="Automatically save progress while typing">
                        <input 
                            type="checkbox" 
                            checked={autoSave} 
                            onChange={(e) => setAutoSave(e.target.checked)} 
                            className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                        />
                        <span>Auto-Save</span>
                    </label>
                </div>
            </div>

            {/* History Dropdown Drawer */}
            {showHistory && (
                <div className={`border-b p-2 max-h-48 overflow-y-auto space-y-1 shadow-2xl absolute top-full left-0 right-0 ${drawerBg}`}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-mono flex items-center justify-between">
                        <span>Previous 20 Saved Snapshots ({fileId})</span>
                        <span>Click to restore</span>
                    </div>
                    {historyItems.length === 0 ? (
                        <div className="p-3 text-center text-zinc-500 text-xs italic">No saved snapshots yet. Make a change to auto-save!</div>
                    ) : (
                        historyItems.map((h, i) => (
                            <button 
                                key={h.timestamp} 
                                className="w-full text-left text-xs p-2 rounded hover:bg-white/10 flex items-center justify-between group transition-colors text-zinc-200"
                                onClick={() => {
                                    const restored = restoreFromHistory(fileId, h.timestamp);
                                    if (restored !== null) {
                                        onUpdate(restored);
                                        setSavedToast(true);
                                        setTimeout(() => setSavedToast(false), 2000);
                                    }
                                    setShowHistory(false);
                                }}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-[10px] text-zinc-500 w-5">{i + 1}.</span>
                                    <span className="font-mono text-indigo-300 font-medium">{new Date(h.timestamp).toLocaleTimeString()}</span>
                                    <span className="text-zinc-400 truncate text-[11px] max-w-[240px]">({h.content.slice(0, 40).replace(/\n/g, ' ')}...)</span>
                                </div>
                                <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 font-medium px-1.5 py-0.5 bg-emerald-500/10 rounded">Restore</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
