import React, { useState, useEffect, useReducer } from 'react';
import { Brain, Search, Trash2, Link2, Download, Plus } from 'lucide-react';
import { memoryFabric, type MemoryEntry } from '../../lib/memoryFabric';

export const MemoryFabricApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState(memoryFabric.getStats());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryEntry[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refreshMemories = () => {
    setMemories(memoryFabric.getAll());
    setStats(memoryFabric.getStats());
  };

  useEffect(() => {
    refreshMemories();
  }, []);

  const handleSearch = () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setResults(memoryFabric.recall(query, 20));
    tick();
  };

  const handleRemember = () => {
    if (!title.trim() || !content.trim()) return;
    const tags = tagsInput
      .split(/[,\s]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
    memoryFabric.remember(title, content, selectedType || 'fact', tags);
    setTitle('');
    setContent('');
    setTagsInput('');
    setSelectedType(null);
    refreshMemories();
    tick();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this memory?')) return;
    memoryFabric.forget(id);
    refreshMemories();
    tick();
  };

  const handleExport = () => {
    const json = memoryFabric.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memories-${Date.now()}.json`;
    a.click();
  };

  const displayMemories = selectedTag
    ? memoryFabric.recallByTag(selectedTag)
    : results.length > 0
      ? results
      : memories;

  const typeColors: Record<string, string> = {
    decision: 'text-amber-400 bg-amber-900/20',
    learning: 'text-cyan-400 bg-cyan-900/20',
    fact: 'text-green-400 bg-green-900/20',
    context: 'text-purple-400 bg-purple-900/20',
    conversation: 'text-blue-400 bg-blue-900/20',
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          Memory Fabric
        </h2>
        <button
          onClick={handleExport}
          className="p-1 hover:bg-zinc-800 rounded"
          title="Export memories"
        >
          <Download size={14} className="text-zinc-500 hover:text-purple-400" />
        </button>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 shrink-0">
        <div className="grid grid-cols-5 gap-2 text-xs">
          <div>
            <div className="text-zinc-600">Total</div>
            <div className="text-white font-bold">{stats.total}</div>
          </div>
          <div>
            <div className="text-zinc-600">Decisions</div>
            <div className="text-amber-400 font-bold">{stats.byType.decision}</div>
          </div>
          <div>
            <div className="text-zinc-600">Learnings</div>
            <div className="text-cyan-400 font-bold">{stats.byType.learning}</div>
          </div>
          <div>
            <div className="text-zinc-600">Facts</div>
            <div className="text-green-400 font-bold">{stats.byType.fact}</div>
          </div>
          <div>
            <div className="text-zinc-600">Top Tags</div>
            <div className="text-purple-400 text-[10px] font-mono">
              {stats.topTags.slice(0, 2).join(', ') || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* New memory form */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={14} className="text-purple-400" />
            <h3 className="font-bold text-white">Store Memory</h3>
          </div>
          <div className="space-y-2">
            <input
              placeholder="Memory title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
            />
            <textarea
              placeholder="Content / Context"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none resize-none h-16"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedType || ''}
                onChange={e => setSelectedType(e.target.value || null)}
                className="px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
              >
                <option value="">Type (auto: fact)</option>
                <option value="decision">Decision</option>
                <option value="learning">Learning</option>
                <option value="fact">Fact</option>
                <option value="context">Context</option>
                <option value="conversation">Conversation</option>
              </select>
              <input
                placeholder="Tags (comma-separated)"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                className="px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
              />
            </div>
            <button
              onClick={handleRemember}
              className="w-full px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm"
            >
              Store Memory
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
          <div className="flex gap-2">
            <input
              placeholder="Search memories..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-purple-500 outline-none"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              <Search size={14} />
            </button>
          </div>
        </div>

        {/* Filters / Tags */}
        {stats.topTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  selectedTag === tag
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Memories */}
        {displayMemories.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10">
            No memories yet. Store memories to recall them later, or search to find related insights.
          </div>
        ) : (
          <div className="space-y-2">
            {displayMemories.map(mem => (
              <div
                key={mem.id}
                className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 hover:border-zinc-600"
              >
                <button
                  onClick={() => setExpandedId(expandedId === mem.id ? null : mem.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            typeColors[mem.type]
                          }`}
                        >
                          {mem.type.charAt(0).toUpperCase() + mem.type.slice(1)}
                        </span>
                        <div className="font-bold text-white text-sm line-clamp-1">
                          {mem.title}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {new Date(mem.timestamp).toLocaleString()}
                      </div>
                      {mem.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {mem.tags.map(tag => (
                            <span key={tag} className="px-1 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-400">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                      {mem.accessCount || 0} recalls
                    </span>
                  </div>
                </button>

                {/* Expanded */}
                {expandedId === mem.id && (
                  <div className="border-t border-zinc-700 mt-2 pt-2 space-y-2">
                    <div className="text-xs text-zinc-300 line-clamp-6">{mem.content}</div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(mem.id)}
                        className="flex-1 px-2 py-1 rounded text-xs bg-red-900/50 hover:bg-red-900 text-red-300 font-bold"
                      >
                        <Trash2 size={11} className="inline mr-1" /> Delete
                      </button>
                      {mem.relatedEntries && mem.relatedEntries.length > 0 && (
                        <button
                          className="px-2 py-1 rounded text-xs bg-zinc-700 text-zinc-300 font-bold"
                        >
                          <Link2 size={11} /> {mem.relatedEntries.length} linked
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Store decisions, learnings, facts, and context for later recall</div>
        <div>• Search finds memories by title, content, and tags with relevance ranking</div>
        <div>• Recent memories and frequently accessed memories rank higher</div>
        <div>• Link related memories to build knowledge graphs</div>
      </div>
    </div>
  );
};

export default MemoryFabricApp;
