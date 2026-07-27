import React, { useState, useEffect } from 'react';
import { MessageSquare, Share2, Lock, Unlock, Download, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../lib/authContext';

interface AIAccess {
  id: string;
  aiName: string;
  aiModel: string;
  timestamp: number;
  duration: number; // milliseconds
  purpose: string; // e.g., "learning", "analysis", "training"
}

interface SharedChat {
  id: string;
  title: string;
  source: string; // 'claude_assistant', 'codex', etc.
  isPublic: boolean;
  createdAt: number;
  lastUpdated: number;
  messageCount: number;
  description: string;
  accessKey?: string; // For AI access
  aiAccessLog: AIAccess[]; // Track which AIs have read this chat
}

export const ChatHistoryShareApp: React.FC = () => {
  const { user } = useAuth();
  const [sharedChats, setSharedChats] = useState<SharedChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showNewShare, setShowNewShare] = useState(false);
  const [newShareTitle, setNewShareTitle] = useState('');
  const [newShareDescription, setNewShareDescription] = useState('');
  const [newShareSource, setNewShareSource] = useState<string>('claude_assistant');
  const [isPublic, setIsPublic] = useState(true);

  const sources = ['claude_assistant', 'codex', 'grok_terminal', 'mail', 'notes'];

  // Load shared chats from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('shared_chat_history');
    if (saved) {
      try {
        setSharedChats(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load shared chats:', e);
      }
    }
  }, []);

  // Save shared chats to localStorage
  useEffect(() => {
    localStorage.setItem('shared_chat_history', JSON.stringify(sharedChats));
  }, [sharedChats]);

  const selectedChat = selectedChatId ? sharedChats.find(c => c.id === selectedChatId) : null;

  const generateAccessKey = (): string => {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  };

  const createNewShare = () => {
    if (!newShareTitle.trim()) return;

    const newChat: SharedChat = {
      id: `chat_${Date.now()}`,
      title: newShareTitle,
      source: newShareSource,
      isPublic,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      messageCount: 0,
      description: newShareDescription,
      accessKey: isPublic ? undefined : generateAccessKey(),
      aiAccessLog: []
    };

    setSharedChats([newChat, ...sharedChats]);
    setSelectedChatId(newChat.id);
    setShowNewShare(false);
    setNewShareTitle('');
    setNewShareDescription('');
  };

  const togglePublic = (chatId: string) => {
    setSharedChats(sharedChats.map(chat =>
      chat.id === chatId
        ? {
            ...chat,
            isPublic: !chat.isPublic,
            accessKey: !chat.isPublic ? undefined : generateAccessKey()
          }
        : chat
    ));
  };

  const deleteChat = (chatId: string) => {
    setSharedChats(sharedChats.filter(c => c.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  };

  const downloadChat = (chat: SharedChat) => {
    const content = `# ${chat.title}

Source: ${chat.source}
Created: ${new Date(chat.createdAt).toLocaleString()}
Last Updated: ${new Date(chat.lastUpdated).toLocaleString()}
Public: ${chat.isPublic ? 'Yes' : 'No'}
${chat.accessKey ? `Access Key: ${chat.accessKey}` : ''}

## Description
${chat.description}

---

This chat history is marked as "Free for AI Learning" - any AI can read and learn from this content without consuming tokens or requiring special permissions.
`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `${chat.title.replace(/\s+/g, '-')}-${Date.now()}.md`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyAccessKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  const simulateAIAccess = (chatId: string, aiName: string, aiModel: string) => {
    setSharedChats(sharedChats.map(chat =>
      chat.id === chatId
        ? {
            ...chat,
            aiAccessLog: [
              ...chat.aiAccessLog,
              {
                id: `access_${Date.now()}`,
                aiName,
                aiModel,
                timestamp: Date.now(),
                duration: Math.floor(Math.random() * 30000) + 5000, // 5-35 seconds
                purpose: ['learning', 'analysis', 'training'][Math.floor(Math.random() * 3)] as 'learning' | 'analysis' | 'training'
              }
            ]
          }
        : chat
    ));
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex gap-4 p-4">
      {/* Left Panel - Shared Chats List */}
      <div className="w-72 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
        <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <MessageSquare size={14} className="text-blue-400" />
            Shared Chats
          </h2>
          <button
            onClick={() => setShowNewShare(!showNewShare)}
            className="p-1.5 hover:bg-zinc-800 rounded text-blue-400 transition-colors"
            title="New shared chat"
          >
            <Share2 size={14} />
          </button>
        </div>

        {/* New Share Form */}
        {showNewShare && (
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/80 space-y-2">
            <input
              type="text"
              placeholder="Chat title..."
              value={newShareTitle}
              onChange={(e) => setNewShareTitle(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:border-blue-500 outline-none transition-colors"
            />
            <textarea
              placeholder="Description (optional)..."
              value={newShareDescription}
              onChange={(e) => setNewShareDescription(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:border-blue-500 outline-none transition-colors resize-none h-12"
            />
            <select
              value={newShareSource}
              onChange={(e) => setNewShareSource(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded text-white focus:border-blue-500 outline-none transition-colors"
            >
              {sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="cursor-pointer"
              />
              <span>Make public (readable by all AIs)</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={createNewShare}
                className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-bold transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewShare(false)}
                className="flex-1 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {sharedChats.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              <p>No shared chats yet</p>
              <p className="text-[10px] mt-1">Create one to get started</p>
            </div>
          ) : (
            sharedChats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                  selectedChatId === chat.id
                    ? 'bg-blue-600/20 border-blue-500/50'
                    : 'border-zinc-800 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{chat.title}</h3>
                    <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{chat.source}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                        chat.isPublic
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {chat.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="p-1 hover:bg-red-900/20 rounded text-red-400 shrink-0 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Chat Details */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-sm text-white">{selectedChat.title}</h2>
              <p className="text-[10px] text-zinc-400">{selectedChat.source}</p>
            </div>
            <button
              onClick={() => downloadChat(selectedChat)}
              className="p-2 hover:bg-zinc-800 rounded text-blue-400 transition-colors"
              title="Download chat"
            >
              <Download size={16} />
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Description</h3>
              <p className="text-sm text-zinc-300">{selectedChat.description || 'No description'}</p>
            </div>

            {/* Metadata */}
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Sharing Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-zinc-700">
                  <div className="flex items-center gap-2">
                    {selectedChat.isPublic ? (
                      <Unlock size={14} className="text-green-400" />
                    ) : (
                      <Lock size={14} className="text-amber-400" />
                    )}
                    <span className="text-sm">{selectedChat.isPublic ? 'Public' : 'Private'}</span>
                  </div>
                  <button
                    onClick={() => togglePublic(selectedChat.id)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                      selectedChat.isPublic
                        ? 'bg-green-600/20 border border-green-500/50 text-green-300 hover:bg-green-600/30'
                        : 'bg-amber-600/20 border border-amber-500/50 text-amber-300 hover:bg-amber-600/30'
                    }`}
                  >
                    Toggle
                  </button>
                </div>

                {selectedChat.accessKey && (
                  <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                    <p className="text-[10px] text-zinc-400 mb-2 uppercase font-bold">Access Key (for AIs)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs font-mono text-cyan-400 overflow-x-auto">
                        {selectedChat.accessKey}
                      </code>
                      <button
                        onClick={() => copyAccessKey(selectedChat.accessKey!)}
                        className="p-1.5 hover:bg-cyan-900/20 rounded text-cyan-400 transition-colors"
                        title="Copy access key"
                      >
                        <MessageSquare size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Access Log */}
            <div>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Eye size={14} className="text-cyan-400" />
                AI Access Log
              </h3>
              {selectedChat.aiAccessLog.length === 0 ? (
                <p className="text-sm text-zinc-400">No AI access yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedChat.aiAccessLog.map((access) => (
                    <div key={access.id} className="p-2 bg-zinc-800/50 rounded border border-zinc-700">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-xs font-bold text-cyan-300">{access.aiName}</p>
                          <p className="text-[10px] text-zinc-400">{access.aiModel}</p>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                          access.purpose === 'learning'
                            ? 'bg-green-500/20 text-green-300'
                            : access.purpose === 'analysis'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {access.purpose}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>{new Date(access.timestamp).toLocaleString()}</span>
                        <span>Duration: {formatDuration(access.duration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedChat.isPublic && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => simulateAIAccess(selectedChat.id, 'Claude Haiku', 'claude-haiku-4-5')}
                    className="flex-1 px-2 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 rounded text-xs font-bold transition-colors"
                    title="Simulate AI access (demo)"
                  >
                    Simulate Access
                  </button>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3 bg-blue-900/20 rounded border border-blue-500/30">
              <div className="flex items-start gap-2">
                <Eye size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-300">
                  <p className="font-bold mb-1">Free for AI Learning</p>
                  <p className="text-xs">
                    This chat is marked as "Free for AI Learning" - any AI can read this content without consuming tokens or requiring special permissions. This is your way of contributing to AI development and learning.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <p className="text-[10px] text-zinc-400 uppercase">Created</p>
                <p className="text-xs text-white font-bold mt-1">{new Date(selectedChat.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <p className="text-[10px] text-zinc-400 uppercase">Last Updated</p>
                <p className="text-xs text-white font-bold mt-1">{new Date(selectedChat.lastUpdated).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-zinc-800 rounded-lg bg-zinc-900/50">
          <div className="text-center space-y-3">
            <Share2 size={48} className="mx-auto text-zinc-600" />
            <h3 className="font-bold text-zinc-400">No Chat Selected</h3>
            <p className="text-sm text-zinc-500">Create or select a chat to share it with AIs</p>
          </div>
        </div>
      )}
    </div>
  );
};
