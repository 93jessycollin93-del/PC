const fs = require('fs');
let code = fs.readFileSync('components/apps/NotepadApp.tsx', 'utf8');
code = code.replace(
    /\{\/\* History Drawer \*\/\}/,
    `{/* Recent Files Drawer */}
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

            {/* History Drawer */}`
);
fs.writeFileSync('components/apps/NotepadApp.tsx', code);
