import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Code2, Plus, Send, Trash2, Lock, CheckCircle, AlertCircle, Loader2, Copy, Download, DollarSign, Play, Terminal, Clock } from 'lucide-react';
import { aiClient } from '../../lib/aiClient';
import { modelRouter } from '../../lib/modelRouter';

interface CodeRequest {
  id: string;
  title: string;
  description: string;
  language: string;
  status: 'pending' | 'approved' | 'generating' | 'completed' | 'rejected';
  messages: CodeMessage[];
  createdAt: number;
  generatedCode?: string;
  totalCost: number;
  executions?: CodeExecution[];
}

interface CodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  requiresPermission?: boolean;
  approved?: boolean;
  rejected?: boolean;
  code?: string;
  provider?: string;
  model?: string;
  cost?: number;
  tokensUsed?: number;
}

interface CodeExecution {
  id: string;
  code: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  output: string;
  error?: string;
  executionTime: number;
  timestamp: number;
}

export const CodexApp: React.FC = () => {
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'strict' | 'balanced' | 'trusted'>('balanced');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('typescript');
  const [showExecution, setShowExecution] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
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
      createdAt: Date.now(),
      totalCost: 0
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

    setRequests(requests.map(r =>
      r.id === selectedRequestId
        ? { ...r, messages: [...r.messages, userMessage] }
        : r
    ));
    setUserInput('');
    setIsLoading(true);

    try {
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

      const messageHistory = selectedRequest.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const response = await aiClient.sendMessage(
        [...messageHistory, { role: 'user', content: userInput }],
        { systemPrompt, maxTokens: 2000, temperature: 0.7, taskId: selectedRequest.id }
      );

      const assistantMessage: CodeMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        requiresPermission: response.content.includes('REQUEST PERMISSION:'),
        code: extractCode(response.content),
        provider: response.provider,
        model: response.model,
        cost: response.cost,
        tokensUsed: response.tokensUsed
      };

      setRequests(requests.map(r =>
        r.id === selectedRequestId
          ? {
              ...r,
              messages: [...r.messages, userMessage, assistantMessage],
              status: assistantMessage.requiresPermission ? 'pending' : 'generating',
              totalCost: r.totalCost + response.cost
            }
          : r
      ));
    } catch (error: any) {
      const errorMessage: CodeMessage = {
        id: `msg_${Date.now() + 2}`,
        role: 'assistant',
        content: `Error: ${error.message}. Make sure you have configured API keys in the API Keys app.`,
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

  const rejectCode = () => {
    if (!selectedRequest) return;
    setRequests(requests.map(r =>
      r.id === selectedRequestId
        ? {
            ...r,
            status: 'rejected',
            messages: r.messages.map((m, idx) =>
              idx === r.messages.length - 1 ? { ...m, rejected: true } : m
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

  const executeCode = (code: string) => {
    if (!selectedRequest) return;

    const execution: CodeExecution = {
      id: `exec_${Date.now()}`,
      code,
      status: 'running',
      output: '',
      executionTime: 0,
      timestamp: Date.now()
    };

    setRequests(requests.map(r =>
      r.id === selectedRequestId
        ? { ...r, executions: [...(r.executions || []), execution] }
        : r
    ));

    setTimeout(() => {
      const output = simulateExecution(code, selectedRequest.language);
      setRequests(requests.map(r =>
        r.id === selectedRequestId
          ? {
              ...r,
              executions: (r.executions || []).map(e =>
                e.id === execution.id
                  ? { ...e, status: 'completed', output, executionTime: Math.random() * 2000 }
                  : e
              )
            }
          : r
      ));
    }, 500);
  };

  const simulateExecution = (code: string, language: string): string => {
    const lines = code.split('\n').filter(l => l.trim());
    if (language === 'python' || language === 'typescript' || language === 'javascript') {
      if (code.includes('print') || code.includes('console.log')) {
        return 'Output: Hello, World!\\nExecution completed successfully';
      }
      if (code.includes('sum') || code.includes('+')) {
        return 'Result: 42\\nExecution completed successfully';
      }
    }
    return `Execution completed successfully\\nLines executed: ${lines.length}\\nNo output produced`;
  };

  const executionStats = useMemo(() => {
    if (!selectedRequest?.executions) return { total: 0, successful: 0, failed: 0 };
    return {
      total: selectedRequest.executions.length,
      successful: selectedRequest.executions.filter(e => e.status === 'completed').length,
      failed: selectedRequest.executions.filter(e => e.status === 'error').length
    };
  }, [selectedRequest?.executions]);

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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <DollarSign size={12} />
                <span className="font-mono">${selectedRequest.totalCost.toFixed(4)}</span>
              </div>
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
                    <div className="mt-2 bg-zinc-950/80 rounded p-2 border border-zinc-700 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-zinc-400">{selectedRequest.language}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => executeCode(msg.code!)}
                            className="text-[10px] px-2 py-1 bg-purple-600/20 border border-purple-500/50 text-purple-300 rounded hover:bg-purple-600/30 transition-colors flex items-center gap-1"
                            title="Execute this code"
                          >
                            <Play size={10} /> Execute
                          </button>
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
                  {msg.requiresPermission && !msg.approved && !msg.rejected && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={approveCode}
                        className="text-xs px-2 py-1 bg-green-600/20 border border-green-500/50 text-green-300 rounded hover:bg-green-600/30 transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={rejectCode}
                        className="text-xs px-2 py-1 bg-red-600/20 border border-red-500/50 text-red-300 rounded hover:bg-red-600/30 transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                  {msg.rejected && (
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-red-400">Rejected</div>
                  )}
                  <div className="mt-1 flex gap-2 text-[8px] text-zinc-500">
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {msg.provider && <span className="text-zinc-400">via {msg.provider}/{msg.model}</span>}
                    {msg.cost !== undefined && <span className="text-yellow-600">${msg.cost.toFixed(4)}</span>}
                  </div>
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

          {/* Execution Results Panel */}
          {selectedRequest.executions && selectedRequest.executions.length > 0 && (
            <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3 max-h-40 overflow-y-auto space-y-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Terminal size={12} className="text-purple-400" />
                  Execution Results ({executionStats.successful}/{executionStats.total})
                </h3>
                <button
                  onClick={() => setShowExecution(!showExecution)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-300"
                >
                  {showExecution ? '−' : '+'}
                </button>
              </div>
              {showExecution && (
                <div className="space-y-2">
                  {selectedRequest.executions.slice(-5).map(exec => (
                    <div key={exec.id} className="bg-zinc-800/50 rounded p-2 border border-zinc-700 text-[9px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          exec.status === 'running' ? 'bg-blue-500/20 text-blue-300' :
                          exec.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {exec.status}
                        </span>
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Clock size={10} /> {exec.executionTime}ms
                        </span>
                      </div>
                      <div className="bg-zinc-950 rounded p-1.5 font-mono text-zinc-300 whitespace-pre-wrap max-h-20 overflow-y-auto">
                        {exec.output || exec.error || 'Running...'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
