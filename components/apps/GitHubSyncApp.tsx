import React, { useCallback, useEffect, useState } from 'react';
import { RepoSessionService, parseRepoInput, describeAge, type RecentRepo } from '../../src/github/repoSession';
import { PodService, createIndexedDeepStore } from '../../src/storage/podService';
import { Github, Folder, File, Download, Search, AlertCircle } from 'lucide-react';

interface GitHubNode {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
}

/** Sessions and cached trees live in the pods, so a large repo listing lands
 *  in the deep pod instead of consuming the small synchronous one. */
const sessions = new RepoSessionService(new PodService(createIndexedDeepStore()));

export const GitHubSyncApp: React.FC = () => {
    const [repoInput, setRepoInput] = useState('');
    const [recent, setRecent] = useState<RecentRepo[]>([]);
    /** Set when what is on screen came from cache rather than the network. */
    const [servedFrom, setServedFrom] = useState<{ at: number; reason: 'resumed' | 'offline' } | null>(null);
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState<GitHubNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState('');
    const [viewingFile, setViewingFile] = useState<{name: string, content: string} | null>(null);

    /** Resume exactly where the app was closed, and load the recent list.
     *  Without this, reopening drops you at an empty box even though the work
     *  of getting there was already done. */
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const [session, recents] = await Promise.all([
                sessions.loadSession(),
                sessions.recentRepos(),
            ]);
            if (cancelled) return;
            setRecent(recents);
            if (!session) return;
            setRepoInput(session.repo);
            const cached = await sessions.readListing(session.repo, session.path);
            if (cancelled || !cached) return;
            setFiles(cached.nodes as GitHubNode[]);
            setCurrentPath(session.path);
            setServedFrom({ at: cached.fetchedAt, reason: 'resumed' });
        })();
        return () => { cancelled = true; };
    }, []);

    const fetchRepo = async (path: string = '') => {
        if (!repoInput) return;
        // Accepts a pasted URL, a deep link, or owner/repo — all resolved in
        // one place rather than by an inline replace that misses the cases.
        const ownerRepo = parseRepoInput(repoInput);
        if (!ownerRepo) {
            setError('Invalid format. Use owner/repo (e.g., octocat/Hello-World)');
            return;
        }
        setLoading(true);
        setError(null);
        setViewingFile(null);
        setServedFrom(null);
        try {
            const headers: Record<string, string> = {
                'Accept': 'application/vnd.github.v3+json'
            };
            if (token) {
                headers['Authorization'] = `token ${token}`;
            }

            const response = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
                headers
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Repository or path not found.");
                if (response.status === 403) throw new Error("API rate limit exceeded. Try adding a personal access token.");
                throw new Error(`GitHub API Error: ${response.statusText}`);
            }

            const data = await response.json();
            const nodes = Array.isArray(data) ? data : [data];
            setFiles(nodes);
            setCurrentPath(path);
            // Cache and record on every successful navigation, so closing at
            // any moment loses nothing and this path stays readable offline.
            await sessions.cacheListing(ownerRepo, path, nodes);
            await sessions.noteRepoOpened(ownerRepo);
            await sessions.saveSession({ repo: ownerRepo, path, openFile: null });
            setRecent(await sessions.recentRepos());
        } catch (err: any) {
            // The network failing is exactly when a cache earns its keep. Fall
            // back to what was last seen and SAY it is cached, rather than
            // showing old contents as if they were current.
            const cached = await sessions.readListing(ownerRepo, path);
            if (cached) {
                setFiles(cached.nodes as GitHubNode[]);
                setCurrentPath(path);
                setServedFrom({ at: cached.fetchedAt, reason: 'offline' });
                setError(null);
            } else {
                setError(err.message);
                setFiles([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileClick = async (file: GitHubNode) => {
        if (file.type === 'dir') {
            fetchRepo(file.path);
        } else if (file.type === 'file') {
             if (!file.download_url) {
                  setError("Cannot download this file.");
                  return;
             }
             setLoading(true);
             setError(null);
             try {
                 const headers: Record<string, string> = {};
                 if (token) {
                     headers['Authorization'] = `token ${token}`;
                 }
                 const res = await fetch(file.download_url, { headers });
                 if (!res.ok) throw new Error("Failed to fetch file content");
                 const text = await res.text();
                 setViewingFile({ name: file.name, content: text });
                 const repo = parseRepoInput(repoInput);
                 if (repo) {
                     await sessions.cacheFile(repo, file.path, file.name, text);
                     await sessions.saveSession({ repo, path: currentPath, openFile: file.path });
                 }
             } catch (err: any) {
                 // Same rule as directories: serve what was last seen and label
                 // it, rather than failing on a file already read once.
                 const repo = parseRepoInput(repoInput);
                 const cached = repo ? await sessions.readFile(repo, file.path) : null;
                 if (cached) {
                     setViewingFile({ name: cached.name, content: cached.content });
                     setServedFrom({ at: cached.fetchedAt, reason: 'offline' });
                     setError(null);
                 } else {
                     setError(err.message);
                 }
             } finally {
                 setLoading(false);
             }
        }
    };

    const navigateUp = () => {
         if (!currentPath) return;
         const parts = currentPath.split('/');
         parts.pop();
         fetchRepo(parts.join('/'));
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-zinc-300 font-mono text-sm border-0">
             {/* Header */}
             <div className="flex items-center gap-2 p-3 bg-zinc-950 border-b border-zinc-800">
                 <Github size={18} className="text-zinc-400" />
                 <h2 className="text-zinc-100 font-bold uppercase tracking-wider">GitHub Sync</h2>
             </div>

             {/* Controls */}
             <div className="p-3 border-b border-zinc-800 flex flex-col gap-3 bg-zinc-900/50">
                 <div className="flex gap-2">
                     <input 
                         type="text" 
                         placeholder="owner/repo (e.g. facebook/react)" 
                         value={repoInput}
                         onChange={e => setRepoInput(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && fetchRepo('')}
                         className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded focus:outline-none focus:border-indigo-500 text-zinc-100 transition-colors placeholder:text-zinc-700"
                     />
                     <button 
                         onClick={() => fetchRepo('')}
                         disabled={loading || !repoInput}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                     >
                         <Search size={16} /> Pull
                     </button>
                 </div>
                 <div className="flex gap-2 items-center">
                      <input 
                         type="password" 
                         placeholder="Personal Access Token (optional, for rate limits / private repos)" 
                         value={token}
                         onChange={e => setToken(e.target.value)}
                         className="w-full bg-zinc-950 border border-zinc-800 p-1.5 px-2 rounded text-xs focus:outline-none focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-700"
                     />
                 </div>
             </div>

             {servedFrom && (
                 <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-300/90">
                     {servedFrom.reason === 'resumed'
                         ? `Restored from your last session — fetched ${describeAge(servedFrom.at)}. Pull to refresh.`
                         : `No network. Showing what was last fetched ${describeAge(servedFrom.at)}.`}
                 </div>
             )}

             {recent.length > 0 && (
                 <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/30">
                     <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Recent</div>
                     <div className="flex flex-wrap gap-1.5">
                         {recent.slice(0, 8).map(r => (
                             <button
                                 key={r.repo}
                                 onClick={() => { setRepoInput(r.repo); void fetchRepo(''); }}
                                 title={`${r.cachedPaths} folder(s) available offline`}
                                 className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300"
                             >
                                 {r.repo}
                                 {r.cachedPaths > 0 && (
                                     <span className="ml-1 text-zinc-600">{r.cachedPaths}</span>
                                 )}
                             </button>
                         ))}
                     </div>
                 </div>
             )}

             {/* Content Area */}
             <div className="flex-1 overflow-hidden relative flex flex-col bg-zinc-900">
                 {loading && (
                     <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm z-10 flex items-center justify-center">
                         <div className="animate-pulse text-indigo-400 font-bold uppercase tracking-widest text-xs">Syncing Repository...</div>
                     </div>
                 )}

                 {error && (
                     <div className="m-3 p-3 bg-red-950/50 border border-red-900/50 text-red-400 rounded flex items-center gap-2 shadow-sm text-xs">
                         <AlertCircle size={16} className="shrink-0" /> {error}
                     </div>
                 )}

                 {!viewingFile ? (
                     <div className="flex-1 overflow-auto p-2">
                         {currentPath && (
                             <div 
                                 onClick={navigateUp}
                                 className="flex items-center gap-3 p-2 hover:bg-zinc-800/80 rounded cursor-pointer text-zinc-400 mb-1 transition-colors"
                             >
                                 <Folder size={16} /> <span className="font-bold">..</span>
                             </div>
                         )}
                         {files.map(file => (
                             <div 
                                 key={file.sha}
                                 onClick={() => handleFileClick(file)}
                                 className="flex items-center justify-between p-2 hover:bg-zinc-800/80 rounded cursor-pointer group transition-colors"
                             >
                                 <div className="flex items-center gap-3 text-zinc-200">
                                     {file.type === 'dir' ? (
                                         <Folder size={16} className="text-indigo-400" />
                                     ) : (
                                         <File size={16} className="text-zinc-500" />
                                     )}
                                     <span>{file.name}</span>
                                 </div>
                                 {file.type === 'file' && (
                                     <Download size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                 )}
                             </div>
                         ))}
                         {files.length === 0 && !loading && !error && repoInput && (
                             <div className="p-4 text-zinc-500 text-center text-xs uppercase tracking-widest mt-8">No files found.</div>
                         )}
                         {files.length === 0 && !loading && !error && !repoInput && (
                             <div className="p-8 text-zinc-600 text-center flex flex-col items-center gap-6 mt-12">
                                 <Github size={64} className="opacity-10" />
                                 <div className="max-w-xs leading-relaxed">Enter a repository name above to explore and pull source files directly into the workspace memory.</div>
                             </div>
                         )}
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col h-full overflow-hidden">
                         <div className="p-2 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shadow-sm z-10">
                             <div className="text-zinc-300 font-bold truncate pr-4 flex items-center gap-2 text-xs">
                                 <File size={14} className="text-zinc-500" />
                                 {viewingFile.name}
                             </div>
                             <button 
                                 onClick={() => setViewingFile(null)}
                                 className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded transition-colors text-white font-bold"
                             >
                                 Close
                             </button>
                         </div>
                         <div className="flex-1 overflow-auto bg-black p-4">
                             <pre className="text-xs text-zinc-300 font-mono leading-relaxed">
                                 <code>{viewingFile.content}</code>
                             </pre>
                         </div>
                     </div>
                 )}
             </div>
        </div>
    );
};
