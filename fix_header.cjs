const fs = require('fs');
let code = fs.readFileSync('components/apps/NotepadApp.tsx', 'utf8');
code = code.replace(/<div className="w-px h-4 bg-zinc-800 mx-1" \/>[\s\S]*?<span>History \(\{historyItems\.length\}\)<\/span>\s*<\/button>/, `<div className="w-px h-4 bg-zinc-800 mx-1" />
                    <button 
                        onClick={() => setShowRecent(!showRecent)} 
                        className={\`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors \${showRecent ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-300'}\`}
                        title="View recently edited files"
                    >
                        <FolderOpen size={13} />
                        <span>Recent</span>
                    </button>
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={\`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors \${showHistory ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-300'}\`}
                        title="Restore up to 20 previous versions"
                    >
                        <History size={13} />
                        <span>History ({historyItems.length})</span>
                    </button>`);
fs.writeFileSync('components/apps/NotepadApp.tsx', code);
