import React, { useState, useRef, useEffect } from 'react';
import { Code2, Plus, Send, Trash2, Lock, CheckCircle, AlertCircle, Loader2, Copy, Download } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { useAuth } from '../../lib/authContext';

interface CodeRequest {
  id: string;
  title: string;
  description: string;
  language: string;
  status: 'pending' | 'approved' | 'generating' | 'completed' | 'rejected';
  messages: CodeMessage[];
  createdAt: number;
  generatedCode?: string;
}

interface CodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  requiresPermission?: boolean;
  approved?: boolean;
  code?: string;
}

export const CodexApp: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'strict' | 'balanced' | 'trusted'>('balanced');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('typescript');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const languages = [
    'typescript', 'javascript', 'python', 'go', 'rust', 'java',
    'cpp', 'c', 'csharp', 'php', 'ruby', 'sql', 'html', 'css', 'bash'
  ];

  // Load requests from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('codex_requests');
    if (saved) {
      try {
        setRequests(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load requests:', e);
      }
    }
  }, []);

  // Save requests to localStorage
  useEffect(() => {
    localStorage.setItem('codex_requests', JSON.stringify(requests));
  }, [requests]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedRequestId, requests]);

  const selectedRequest = selectedRequestId ? requests.find(r => r.id === selectedRequestId) : null;

  const createNewRequest = () => {
    const newRequest: CodeRequest = {
      id: `req_${Date.now()}`,
      title: 'New Code Request',
      description: 'Describe what code you need...',
      language: selectedLanguage,
      status: 'pending',
      messages: [
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Hello! I'm Codex, your AI code generation assistant. I can help you write, fix, and optimize code across multiple languages. Each code generation requires your approval to maintain security and control.

**Permission Levels:**
🔒 **Strict** - Requires approval for every code snippet
⚖️ **Balanced** - Auto-approve simple snippets, ask for complex ones
✓ **Trusted** - Fast-track for frequently-used patterns

Selected Language: ${selectedLanguage.toUpperCase()}

What code would you like me to help you with?`,
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now()
    };
    setRequests([newRequest, ...requests]);
    setSelectedRequestId(newRequest.id);
  };

  const deleteRequest = (requestId: string) => {
    setRequests(requests.filter(r => r.id !== requestId));
    if (selectedRequestId === requestId) {
      setSelectedRequestId(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !selectedRequest) return;

    const userMessage: CodeMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    };

    // Add user message
    setRequests(requests.map(r =>
      r.id === selectedRequestId
        ? { ...r, messages: [...r.messages, userMessage] }
        : r
    ));
    setUserInput('');
    setIsLoading(true);

    try {
      const ai = getAiClient();
      const requestContext = selectedRequest.messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const systemPrompt = `You are Codex, an expert code generation AI assistant integrated into the PC OS desktop environment.

**Important Constraints:**
1. You NEVER generate code without explicit user permission
2. You ALWAYS ask for permission before executing/generating code snippets
3. You explain what code you will write and why
4. You respect the user's permission level: ${permissionMode}
5. You provide clean, production-ready code with comments
6. Target language: ${selectedRequest.language.toUpperCase()}

When generating code:
- Explain what the code does in simple terms
- Say "REQUEST PERMISSION:" followed by a brief description of the code
- Wait for user approval before providing the code
- After approval, provide complete, working code with examples
- Include error handling and best practices

Always format code in markdown code blocks with the language identifier.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        system: systemPrompt,
        contents: [...requestContext, { role: 'user', content: userInput }]
      });

      const assistantMessage: CodeMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.text || 'I encountered an error processing your request.',
        timestamp: Date.now(),
        requiresPermission: response.text?.includes('REQUEST PERMISSION:') || false,
        code: extractCode(response.text || '')
      };

      setRequests(requests.map(r =>
        r.id === selectedRequestId
          ? {
              ...r,
              messages: [...r.messages, userMessage, assistantMessage],
              status: assistantMessage.requiresPermission ? 'pending' : 'generating'
            }
          : r
      ));
    } catch (error: any) {
      const errorMessage: CodeMessage = {
        id: `msg_${Date.now() + 2}`,
        role: 'assistant',
        content: `I encountered an error: ${error.message}. Please try again.`,
        timestamp: Date.now()
      };

      setRequests(requests.map(r =>
        r.id === selectedRequestId
          ? { ...r, messages: [...r.messages, userMessage, errorMessage] }
          : r
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const extractCode = (text: string): string | undefined => {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/;
    const match = text.match(codeBlockRegex);
    return match ? match[1] : undefined;
  };

  const approveCode = () => {
    if (!selectedRequest) return;
    setRequests(requests.map(r =>
      r.id === selectedRequestId
        ? {
            ...r,
            status: 'approved',
            messages: r.messages.map((m, idx) =>
              idx === r.messages.length - 1 ? { ...m, approved: true } : m
            )
          }
        : r
    ));
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const downloadCode = (code: string, filename?: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(code));
    element.setAttribute('download', filename || `code.${selectedRequest?.language || 'txt'}`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex gap-4 p-4">
      {/* Left Panel - Request List */}
      <div className="w-64 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
        <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <Code2 size={14} className="text-emerald-400" />
            Code Requests
          </h2>
          <button
            onClick={createNewRequest}
            className="p-1.5 hover:bg-zinc-800 rounded text-emerald-400"
            title="New request"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Language Selector */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/50 space-y-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Language</span>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-emerald-500/50 focus:border-emerald-500 outline-none transition-colors"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {/* Permission Settings */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/50 space-y-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Permission Level</span>
          <div className="space-y-1.5">
            {(['strict', 'balanced', 'trusted'] as const).map(level => (
              <button
                key={level}
                onClick={() => setPermissionMode(level)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                  permissionMode === level
                    ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-300'
                    : 'border border-zinc-800 text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {level === 'strict' && <Lock size={12} />}
                  {level === 'balanced' && <AlertCircle size={12} />}
                  {level === 'trusted' && <CheckCircle size={12} />}
                  <span className="capitalize">{level}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {requests.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              <p>No requests yet</p>
              <p className="text-[10px] mt-1">Create one to get started</p>
            </div>
          ) : (
            requests.map(request => (
              <div
                key={request.id}
                onClick={() => setSelectedRequestId(request.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                  selectedRequestId === request.id
                    ? 'bg-emerald-600/20 border-emerald-500/50'
                    : 'border-zinc-800 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{request.title}</h3>
                    <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{request.language}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        request.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                        request.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                        request.status === 'generating' ? 'bg-emerald-500/20 text-emerald-300' :
                        request.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRequest(request.id);
                    }}
                    className="p-1 hover:bg-red-900/20 rounded text-red-400 shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Chat & Code */}
      {selectedRequest ? (
        <div className="flex-1 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-sm text-white">{selectedRequest.title}</h2>
              <p className="text-[10px] text-zinc-400">{selectedRequest.language}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
                selectedRequest.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                selectedRequest.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                selectedRequest.status === 'generating' ? 'bg-emerald-500/20 text-emerald-300' :
                selectedRequest.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {selectedRequest.status}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedRequest.messages.map((msg, idx) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-2xl px-4 py-2.5 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-100'
                      : 'bg-zinc-800/50 border border-zinc-700 text-zinc-300'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.code && (
                    <div className="mt-2 bg-zinc-950/80 rounded p-2 border border-zinc-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-zinc-400">{selectedRequest.language}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyToClipboard(msg.code!)}
                            className="text-[10px] px-2 py-1 bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 rounded hover:bg-emerald-600/30 transition-colors flex items-center gap-1"
                          >
                            <Copy size={10} /> Copy
                          </button>
                          <button
                            onClick={() => downloadCode(msg.code!, `code.${selectedRequest.language}`)}
                            className="text-[10px] px-2 py-1 bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded hover:bg-blue-600/30 transition-colors flex items-center gap-1"
                          >
                            <Download size={10} /> Download
                          </button>
                        </div>
                      </div>
                      <pre className="text-[11px] text-zinc-300 overflow-x-auto"><code>{msg.code}</code></pre>
                    </div>
                  )}
                  {msg.requiresPermission && !msg.approved && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={approveCode}
                        className="text-xs px-2 py-1 bg-green-600/20 border border-green-500/50 text-green-300 rounded hover:bg-green-600/30 transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="text-xs px-2 py-1 bg-red-600/20 border border-red-500/50 text-red-300 rounded hover:bg-red-600/30 transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                  <span className="text-[8px] text-zinc-500 mt-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <Loader2 size={16} className="animate-spin text-emerald-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="h-20 border-t border-zinc-800 bg-zinc-900 px-4 py-3 flex gap-2 shrink-0">
            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Describe what code you need..."
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-zinc-800 rounded-lg bg-zinc-900/50">
          <div className="text-center space-y-3">
            <Code2 size={48} className="mx-auto text-zinc-600" />
            <h3 className="font-bold text-zinc-400">No Request Selected</h3>
            <p className="text-sm text-zinc-500">Create or select a request to get started</p>
          </div>
        </div>
      )}
    </div>
  );
};
