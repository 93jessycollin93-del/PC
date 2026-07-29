import React, { useCallback, useMemo, useState } from 'react';
import { Search, FileText, Plus, Trash2, WifiOff } from 'lucide-react';
import { knowledgeService } from '../../src/knowledge/knowledgeService';
import type { ScoredChunk } from '../../src/knowledge/keywordIndex';

/**
 * Knowledge — search your own documents with no network and no model.
 *
 * A thin View over KnowledgeService: it holds no retrieval logic and makes no
 * decision about which search tier runs. It dispatches intents (add, remove,
 * search) and renders what the service reports back, including which tier
 * actually answered.
 */
export const KnowledgeApp: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScoredChunk[]>([]);
  const [mode, setMode] = useState<'keyword' | 'semantic'>('keyword');
  const [searched, setSearched] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [adding, setAdding] = useState(false);
  const [docVersion, setDocVersion] = useState(0);

  const documents = useMemo(() => knowledgeService.listDocuments(), [docVersion]);

  const runSearch = useCallback((q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const outcome = knowledgeService.search(q, 8);
    setResults(outcome.results);
    setMode(outcome.mode);
    setSearched(true);
  }, []);

  const addDocument = () => {
    if (!title.trim() || !body.trim()) return;
    knowledgeService.addDocument(
      { id: `doc-${Date.now()}`, title: title.trim(), source: 'manual' },
      body
    );
    setTitle('');
    setBody('');
    setAdding(false);
    setDocVersion(v => v + 1);
    if (query.trim()) runSearch(query);
  };

  const removeDocument = (id: string) => {
    knowledgeService.removeDocument(id);
    setDocVersion(v => v + 1);
    if (query.trim()) runSearch(query);
  };

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 text-zinc-200">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0">
        <Search size={15} className="text-zinc-500 shrink-0" />
        <input
          value={query}
          onChange={e => runSearch(e.target.value)}
          placeholder="Search your documents…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-600 py-1"
        />
        <button
          onClick={() => setAdding(a => !a)}
          title="Add a document"
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* The tier that answered is stated plainly rather than implied — with no
          model resident this is keyword search, and pretending otherwise would
          misrepresent the result quality. */}
      <div className="px-3 py-1.5 border-b border-zinc-800/60 flex items-center gap-1.5 text-[11px] text-zinc-500 shrink-0">
        <WifiOff size={11} />
        {mode === 'semantic'
          ? 'Semantic search — an embedding model is loaded'
          : 'Keyword search — works with no network and no model'}
      </div>

      {adding && (
        <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm outline-none placeholder-zinc-600"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Paste or type the document text…"
            rows={5}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm outline-none placeholder-zinc-600 resize-none"
          />
          <button
            onClick={addDocument}
            disabled={!title.trim() || !body.trim()}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-sm"
          >
            Add document
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {searched ? (
          results.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              Nothing in your documents matches that
            </div>
          ) : (
            results.map(r => (
              <div key={r.chunk.id} className="px-3 py-2.5 border-b border-zinc-800/60">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText size={11} className="text-zinc-600 shrink-0" />
                  <span className="text-[11px] text-zinc-500 truncate">
                    {knowledgeService.listDocuments().find(d => d.id === r.chunk.docId)?.title ||
                      r.chunk.docId}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 leading-snug whitespace-pre-wrap">
                  {r.chunk.content}
                </p>
              </div>
            ))
          )
        ) : documents.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No documents yet. Add one and it becomes searchable offline.
          </div>
        ) : (
          documents.map(d => (
            <div
              key={d.id}
              className="px-3 py-2.5 border-b border-zinc-800/60 flex items-center gap-2"
            >
              <FileText size={14} className="text-zinc-600 shrink-0" />
              <span className="flex-1 text-sm truncate">{d.title}</span>
              <button
                onClick={() => removeDocument(d.id)}
                title="Remove"
                className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KnowledgeApp;
