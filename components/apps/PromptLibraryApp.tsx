import React, { useEffect, useReducer, useState } from 'react';
import { Plus, BookOpen, Trash2, Copy, TrendingUp, Download, Upload, Edit2 } from 'lucide-react';
import { promptLibrary, type PromptTemplate } from '../../lib/promptLibrary';
import { appStorage } from '../../lib/appStorage';

/**
 * Prompt Library — centralized versioned prompt store with A/B testing
 */

interface UIState {
  tab: 'browse' | 'create' | 'compare';
  selectedPromptId?: string;
  selectedCategoryFilter?: string;
}

export const PromptLibraryApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [uiState, setUiState] = useState<UIState>({ tab: 'browse' });
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);

  // Create form
  const [createName, setCreateName] = useState('');
  const [createText, setCreateText] = useState('');
  const [createCategory, setCreateCategory] = useState('chat');
  const [createDesc, setCreateDesc] = useState('');

  // Version form
  const [versionText, setVersionText] = useState('');
  const [versionNotes, setVersionNotes] = useState('');

  const categories = ['chat', 'analysis', 'code', 'creative', 'research', 'business'];

  const refreshPrompts = () => {
    setPrompts(promptLibrary.listPrompts());
  };

  useEffect(() => {
    const storage = appStorage('prompt-library');
    const unsub = storage.subscribe(refreshPrompts);
    refreshPrompts();
    return unsub;
  }, []);

  const handleCreatePrompt = () => {
    if (!createName.trim() || !createText.trim()) return;
    promptLibrary.createPrompt(createName, createText, createCategory, {
      description: createDesc || undefined,
    });
    setCreateName('');
    setCreateText('');
    setCreateCategory('chat');
    setCreateDesc('');
    refreshPrompts();
    tick();
  };

  const handleCreateVersion = (promptId: string) => {
    if (!versionText.trim()) return;
    promptLibrary.createVersion(promptId, versionText, versionNotes);
    setVersionText('');
    setVersionNotes('');
    setUiState({ ...uiState, selectedPromptId: undefined });
    refreshPrompts();
    tick();
  };

  const handleSwitchVersion = (promptId: string, versionId: string) => {
    promptLibrary.switchVersion(promptId, versionId);
    refreshPrompts();
    tick();
  };

  const handleDeletePrompt = (id: string) => {
    if (!confirm('Delete this prompt?')) return;
    promptLibrary.deletePrompt(id);
    refreshPrompts();
    tick();
  };

  const handleRecordQuality = (promptId: string, score: number) => {
    promptLibrary.recordUsage(promptId, score, 100, 500); // Demo values
    refreshPrompts();
    tick();
  };

  const handleExport = () => {
    const json = promptLibrary.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-${Date.now()}.json`;
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const count = promptLibrary.import(text);
      if (count > 0) {
        refreshPrompts();
        tick();
      }
    };
    input.click();
  };

  const filteredPrompts = uiState.selectedCategoryFilter
    ? prompts.filter(p => p.category === uiState.selectedCategoryFilter)
    : prompts;

  const selectedPrompt = uiState.selectedPromptId
    ? prompts.find(p => p.id === uiState.selectedPromptId)
    : null;

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <BookOpen size={16} className="text-amber-400" />
          Prompt Library
        </h2>
        <div className="flex gap-1">
          <button
            onClick={handleExport}
            className="p-1.5 hover:bg-zinc-800 rounded"
            title="Export prompts"
          >
            <Download size={14} className="text-zinc-500 hover:text-amber-400" />
          </button>
          <button
            onClick={handleImport}
            className="p-1.5 hover:bg-zinc-800 rounded"
            title="Import prompts"
          >
            <Upload size={14} className="text-zinc-500 hover:text-amber-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 flex gap-4 shrink-0">
        {['browse', 'create', 'compare'].map(tab => (
          <button
            key={tab}
            onClick={() => setUiState({ ...uiState, tab: tab as any })}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition ${
              uiState.tab === tab
                ? 'text-amber-400 border-amber-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Browse tab */}
        {uiState.tab === 'browse' && (
          <div className="space-y-4">
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setUiState({ ...uiState, selectedCategoryFilter: undefined })}
                className={`px-3 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
                  !uiState.selectedCategoryFilter
                    ? 'bg-amber-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setUiState({ ...uiState, selectedCategoryFilter: cat })}
                  className={`px-3 py-1 rounded text-xs whitespace-nowrap font-bold transition ${
                    uiState.selectedCategoryFilter === cat
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Prompts list */}
            {filteredPrompts.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-10">
                No prompts yet. Create one to get started.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredPrompts.map(prompt => {
                  const score = promptLibrary.getQualityScore(prompt.id);
                  return (
                    <div
                      key={prompt.id}
                      className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 space-y-2 hover:border-zinc-600"
                    >
                      <div
                        onClick={() => setUiState({ ...uiState, selectedPromptId: prompt.id })}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-bold text-white hover:text-amber-300">{prompt.name}</div>
                            <div className="text-xs text-zinc-500">{prompt.category}</div>
                            {prompt.description && (
                              <div className="text-xs text-zinc-400 mt-1">{prompt.description}</div>
                            )}
                          </div>
                          {score > 0 && (
                            <div className="text-right">
                              <div className="text-xs font-mono font-bold text-emerald-400">
                                {score.toFixed(1)}
                              </div>
                              <div className="text-[10px] text-zinc-600">quality</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preview of current version */}
                      <div className="text-xs text-zinc-400 bg-zinc-950 p-2 rounded line-clamp-2 font-mono">
                        {promptLibrary.getPromptText(prompt.id)?.slice(0, 100)}...
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2 border-t border-zinc-800">
                        <button
                          onClick={() => setUiState({ ...uiState, selectedPromptId: prompt.id })}
                          className="flex-1 px-2 py-1 rounded text-xs bg-amber-900/50 hover:bg-amber-900 text-amber-300 font-semibold border border-amber-800"
                        >
                          Edit Versions
                        </button>
                        <button
                          onClick={() => handleRecordQuality(prompt.id, 8)}
                          className="p-1 rounded hover:bg-zinc-800"
                          title="Rate quality (8/10)"
                        >
                          <TrendingUp size={12} className="text-zinc-500 hover:text-emerald-400" />
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="p-1 rounded hover:bg-zinc-800"
                          title="Delete"
                        >
                          <Trash2 size={12} className="text-zinc-600 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected prompt details */}
            {selectedPrompt && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-white text-lg">{selectedPrompt.name}</h3>
                    <button
                      onClick={() => setUiState({ ...uiState, selectedPromptId: undefined })}
                      className="text-zinc-500 hover:text-white text-2xl"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Versions */}
                  <div className="space-y-3 mb-4">
                    <h4 className="text-xs font-bold text-zinc-400">Versions</h4>
                    {selectedPrompt.versions.map(v => (
                      <div
                        key={v.id}
                        className={`border rounded p-2 text-xs space-y-1 ${
                          v.id === selectedPrompt.currentVersionId
                            ? 'bg-amber-900/20 border-amber-700'
                            : 'bg-zinc-950 border-zinc-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-mono font-bold">{v.id}</div>
                          {v.id !== selectedPrompt.currentVersionId && (
                            <button
                              onClick={() => handleSwitchVersion(selectedPrompt.id, v.id)}
                              className="px-2 py-0.5 rounded text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold"
                            >
                              Switch
                            </button>
                          )}
                        </div>
                        {v.notes && <div className="text-zinc-500">{v.notes}</div>}
                        <div className="font-mono text-zinc-400 line-clamp-2">{v.text}</div>
                        <div className="text-[10px] text-zinc-600">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add new version */}
                  <div className="space-y-2 border-t border-zinc-700 pt-4">
                    <h4 className="text-xs font-bold text-zinc-400">Create A/B Variant</h4>
                    <textarea
                      placeholder="New prompt text"
                      value={versionText}
                      onChange={e => setVersionText(e.target.value)}
                      className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none resize-none h-20"
                    />
                    <input
                      placeholder="Notes (e.g., 'more concise')"
                      value={versionNotes}
                      onChange={e => setVersionNotes(e.target.value)}
                      className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none"
                    />
                    <button
                      onClick={() => handleCreateVersion(selectedPrompt.id)}
                      className="w-full px-2 py-1 rounded text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold"
                    >
                      Create Version
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create tab */}
        {uiState.tab === 'create' && (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Plus size={14} className="text-amber-400" />
              <h3 className="font-bold text-white">New Prompt</h3>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Prompt name (e.g., 'Code Reviewer')"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none"
              />
              <select
                value={createCategory}
                onChange={e => setCreateCategory(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                placeholder="Description (optional)"
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none"
              />
              <textarea
                placeholder="Prompt text..."
                value={createText}
                onChange={e => setCreateText(e.target.value)}
                className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none resize-none h-32"
              />
              <button
                onClick={handleCreatePrompt}
                className="w-full px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm"
              >
                Create Prompt
              </button>
            </div>
          </div>
        )}

        {/* Compare tab */}
        {uiState.tab === 'compare' && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Compare prompt versions by quality, cost, and efficiency scores.
            </p>
            {prompts.length === 0 ? (
              <div className="text-xs text-zinc-500">No prompts to compare.</div>
            ) : (
              <div className="space-y-4">
                {prompts.map(prompt => {
                  const comparison = promptLibrary.compareVersions(prompt.id);
                  if (comparison.versions.length === 0) return null;

                  return (
                    <div
                      key={prompt.id}
                      className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3"
                    >
                      <div className="font-bold text-white mb-2">{prompt.name}</div>
                      <div className="space-y-1 text-xs">
                        {comparison.versions.map(v => (
                          <div
                            key={v.id}
                            className={`flex justify-between items-center p-1.5 rounded ${
                              v.id === prompt.currentVersionId
                                ? 'bg-amber-900/30 border border-amber-700'
                                : 'bg-zinc-800'
                            }`}
                          >
                            <span className="font-mono font-bold">{v.id}</span>
                            <div className="flex gap-4 text-zinc-400">
                              <span>Quality: {v.qualityScore.toFixed(1)}</span>
                              <span>Cost: {v.avgCost.toFixed(0)}</span>
                              <span className="text-emerald-400">Eff: {v.efficiency.toFixed(0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600">
        <div>• All prompts stored locally and synced via export/import</div>
        <div>• Track quality scores and cost metrics per prompt</div>
        <div>• A/B test variants and compare efficiency</div>
      </div>
    </div>
  );
};

export default PromptLibraryApp;
