import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, Plus, Send, Trash2, Lock, CheckCircle, AlertCircle, Loader2, Settings, History, MoreVertical, DollarSign, Brain, Wrench, Tag, Search, Lightbulb, Copy } from 'lucide-react';
import { aiClient } from '../../lib/aiClient';
import { modelRouter } from '../../lib/modelRouter';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  requiresPermission?: boolean;
  approved?: boolean;
  rejected?: boolean;
  provider?: string;
  model?: string;
  cost?: number;
  tokensUsed?: number;
}

interface MemoryEntry {
  id: string;
  taskId: string;
  summary: string;
  keyTopics: string[];
  timestamp: number;
  relevanceScore?: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'rejected';
  messages: Message[];
  createdAt: number;
  totalCost: number;
  tags?: string[];
  tools?: string[];
  contextNotes?: string;
  memories?: string[];
}

const AVAILABLE_TOOLS = ['Web Search', 'Code Analysis', 'File Operations', 'Data Processing', 'API Integration', 'Database Query'];

export const ClaudeAssistantApp: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'strict' | 'balanced' | 'trusted'>('balanced');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [showMemory, setShowMemory] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTag, setNewTag] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load tasks and memories from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('claude_assistant_tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load tasks:', e);
      }
    }
    const savedMemories = localStorage.getItem('claude_assistant_memories');
    if (savedMemories) {
      try {
        setMemories(JSON.parse(savedMemories));
      } catch (e) {
        console.error('Failed to load memories:', e);
      }
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem('claude_assistant_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Save memories to localStorage
  useEffect(() => {
    localStorage.setItem('claude_assistant_memories', JSON.stringify(memories));
  }, [memories]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTaskId, tasks]);

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  const createNewTask = () => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      title: 'New Assistant Task',
      description: 'Describe what you need help with...',
      status: 'pending',
      messages: [
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Hello! I'm Claude, your PC OS Assistant. I'm here to help with your tasks, but I require your explicit permission for each action. This keeps you in control and ensures all AI operations are transparent and authorized.

**Permission Levels:**
🔒 **Strict** - Requires approval for every action
⚖️ **Balanced** - Auto-approve minor tasks, ask for complex ones
✓ **Trusted** - Fast-track for frequently-used operations

What would you like help with today?`,
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now(),
      totalCost: 0
    };
    setTasks([newTask, ...tasks]);
    setSelectedTaskId(newTask.id);
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  const createMemoryFromTask = (task: Task) => {
    const content = task.messages.map(m => m.content).join(' ');
    const words = content.split(/\s+/);
    const keyTopics = words
      .filter(w => w.length > 5)
      .reduce((acc: string[], word) => {
        if (!acc.includes(word) && acc.length < 5) acc.push(word);
        return acc;
      }, []);

    const memory: MemoryEntry = {
      id: `mem_${Date.now()}`,
      taskId: task.id,
      summary: task.description,
      keyTopics,
      timestamp: task.createdAt
    };

    setMemories([memory, ...memories]);
    setTasks(tasks.map(t =>
      t.id === task.id
        ? { ...t, memories: [...(t.memories || []), memory.id] }
        : t
    ));
  };

  const getRelevantMemories = (taskId: string): MemoryEntry[] => {
    return memories.filter(m => m.taskId !== taskId);
  };

  const toggleTaskTool = (taskId: string, tool: string) => {
    setTasks(tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            tools: t.tools?.includes(tool)
              ? t.tools.filter(x => x !== tool)
              : [...(t.tools || []), tool]
          }
        : t
    ));
  };

  const addTaskTag = (taskId: string, tag: string) => {
    if (!tag.trim()) return;
    setTasks(tasks.map(t =>
      t.id === taskId && !t.tags?.includes(tag)
        ? { ...t, tags: [...(t.tags || []), tag] }
        : t
    ));
  };

  const removeTaskTag = (taskId: string, tag: string) => {
    setTasks(tasks.map(t =>
      t.id === taskId
        ? { ...t, tags: t.tags?.filter(x => x !== tag) }
        : t
    ));
  };

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !selectedTask) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    };

    setTasks(tasks.map(t =>
      t.id === selectedTaskId
        ? { ...t, messages: [...t.messages, userMessage] }
        : t
    ));
    setUserInput('');
    setIsLoading(true);

    try {
      const relevantMemories = getRelevantMemories(selectedTaskId!);
      const toolsInfo = selectedTask.tools?.length
        ? `Available tools for this task: ${selectedTask.tools.join(', ')}`
        : '';
      const contextInfo = selectedTask.contextNotes
        ? `Context notes: ${selectedTask.contextNotes}`
        : '';
      const memoryContext = relevantMemories.length
        ? `Related past conversations: ${relevantMemories.slice(0, 3).map(m => m.summary).join('; ')}`
        : '';

      const systemPrompt = `You are Claude, an AI assistant integrated into the PC OS desktop environment.

**Important Constraints:**
1. You NEVER perform actions without explicit user permission
2. You ALWAYS ask for permission before executing tasks
3. You explain what action you would take and why
4. You respect the user's permission level setting: ${permissionMode}
5. You provide clear, actionable guidance

When suggesting an action:
- Explain what you'll do in simple terms
- Say "REQUEST PERMISSION:" followed by the specific action
- Wait for user approval before proceeding
- After approval, execute the task and report results

${toolsInfo}
${contextInfo}
${memoryContext}

You operate within these apps: AgentBuilder, SmallAgentFleet, ModelRouter, CloudInfrastructure, and all other desktop apps.`;

      const messageHistory = selectedTask.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const response = await aiClient.sendMessage(
        [...messageHistory, { role: 'user', content: userInput }],
        { systemPrompt, maxTokens: 2000, temperature: 0.7, taskId: selectedTask.id }
      );

      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        requiresPermission: response.content.includes('REQUEST PERMISSION:'),
        provider: response.provider,
        model: response.model,
        cost: response.cost,
        tokensUsed: response.tokensUsed
      };

      setTasks(tasks.map(t =>
        t.id === selectedTaskId
          ? {
              ...t,
              messages: [...t.messages, userMessage, assistantMessage],
              status: assistantMessage.requiresPermission ? 'pending' : 'executing',
              totalCost: t.totalCost + response.cost
            }
          : t
      ));
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg_${Date.now() + 2}`,
        role: 'assistant',
        content: `Error: ${error.message}. Make sure you have configured API keys in the API Keys app.`,
        timestamp: Date.now()
      };

      setTasks(tasks.map(t =>
        t.id === selectedTaskId
          ? { ...t, messages: [...t.messages, userMessage, errorMessage] }
          : t
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const approveAction = () => {
    if (!selectedTask) return;
    setTasks(tasks.map(t =>
      t.id === selectedTaskId
        ? {
            ...t,
            status: 'approved',
            messages: t.messages.map((m, idx) =>
              idx === t.messages.length - 1 ? { ...m, approved: true } : m
            )
          }
        : t
    ));
  };

  const rejectAction = () => {
    if (!selectedTask) return;
    setTasks(tasks.map(t =>
      t.id === selectedTaskId
        ? {
            ...t,
            status: 'rejected',
            messages: t.messages.map((m, idx) =>
              idx === t.messages.length - 1 ? { ...m, rejected: true } : m
            )
          }
        : t
    ));
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex gap-3 p-3">
      {/* Left Panel - Task List */}
      <div className="w-56 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
        <div className="h-12 border-b border-zinc-800 bg-zinc-900 px-3 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-xs text-white flex items-center gap-2">
            <Bot size={13} className="text-blue-400" />
            Tasks
          </h2>
          <button
            onClick={createNewTask}
            className="p-1 hover:bg-zinc-800 rounded text-blue-400"
            title="New task"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-blue-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Permission Settings */}
        <div className="p-2 border-b border-zinc-800 bg-zinc-950/50 space-y-1.5 shrink-0">
          <span className="text-[9px] font-bold text-zinc-500 uppercase">Permission</span>
          <div className="space-y-1">
            {(['strict', 'balanced', 'trusted'] as const).map(level => (
              <button
                key={level}
                onClick={() => setPermissionMode(level)}
                className={`w-full text-left px-2 py-1 text-[10px] rounded transition-colors ${
                  permissionMode === level
                    ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                    : 'border border-zinc-800 text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {level === 'strict' && <Lock size={11} />}
                  {level === 'balanced' && <AlertCircle size={11} />}
                  {level === 'trusted' && <CheckCircle size={11} />}
                  <span className="capitalize">{level}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-[10px]">
              <p>{searchQuery ? 'No tasks match' : 'No tasks yet'}</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`p-2 rounded-lg cursor-pointer transition-all border text-[10px] ${
                  selectedTaskId === task.id
                    ? 'bg-blue-600/20 border-blue-500/50'
                    : 'border-zinc-800 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[11px] font-bold text-white truncate">{task.title}</h3>
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {task.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[8px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className={`inline-block text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 ${
                      task.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                      task.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                      task.status === 'executing' ? 'bg-blue-500/20 text-blue-300' :
                      task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    className="p-0.5 hover:bg-red-900/20 rounded text-red-400 shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Chat */}
      {selectedTask ? (
        <div className="flex-1 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
          {/* Header */}
          <div className="h-12 border-b border-zinc-800 bg-zinc-900 px-3 flex items-center justify-between gap-2 shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-xs text-white">{selectedTask.title}</h2>
              <p className="text-[9px] text-zinc-400 line-clamp-1">{selectedTask.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 text-[9px] text-zinc-400">
                <DollarSign size={11} />
                <span className="font-mono">${selectedTask.totalCost.toFixed(4)}</span>
              </div>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                selectedTask.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                selectedTask.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                selectedTask.status === 'executing' ? 'bg-blue-500/20 text-blue-300' :
                selectedTask.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {selectedTask.status}
              </span>
              <button
                onClick={() => setShowMemory(!showMemory)}
                className={`p-1.5 rounded transition-colors ${showMemory ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-zinc-800 text-zinc-400'}`}
                title="Memory & context"
              >
                <Brain size={12} />
              </button>
              <button
                onClick={() => setShowTools(!showTools)}
                className={`p-1.5 rounded transition-colors ${showTools ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-zinc-800 text-zinc-400'}`}
                title="Tools & integrations"
              >
                <Wrench size={12} />
              </button>
            </div>
          </div>

          {/* Memory & Tools Panels */}
          {(showMemory || showTools) && (
            <div className="border-b border-zinc-800 bg-zinc-900 p-3 space-y-3 max-h-40 overflow-y-auto">
              {showMemory && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Brain size={11} /> Memory Context
                  </h4>
                  {getRelevantMemories(selectedTaskId!).length > 0 ? (
                    <div className="space-y-1.5">
                      {getRelevantMemories(selectedTaskId!).slice(0, 3).map(mem => (
                        <div key={mem.id} className="p-2 rounded bg-zinc-800/50 border border-zinc-700 text-[9px] text-zinc-300">
                          <p className="font-semibold text-zinc-200">{mem.summary}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {mem.keyTopics.map(topic => (
                              <span key={topic} className="px-1 py-0.5 bg-zinc-700 rounded text-[8px] text-zinc-400">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-zinc-500">No related memories yet</p>
                  )}
                  {selectedTask.contextNotes && (
                    <div className="p-2 rounded bg-amber-900/20 border border-amber-700/30 text-[9px] text-amber-200">
                      <p className="font-semibold">Notes:</p>
                      <p>{selectedTask.contextNotes}</p>
                    </div>
                  )}
                </div>
              )}
              {showTools && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                    <Wrench size={11} /> Tools & Integrations
                  </h4>
                  <div className="space-y-1">
                    {AVAILABLE_TOOLS.map(tool => (
                      <button
                        key={tool}
                        onClick={() => toggleTaskTool(selectedTaskId!, tool)}
                        className={`w-full text-left px-2 py-1.5 text-[9px] rounded border transition-colors ${
                          selectedTask.tools?.includes(tool)
                            ? 'bg-green-500/20 border-green-500/50 text-green-300'
                            : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-zinc-300'
                        }`}
                      >
                        {selectedTask.tools?.includes(tool) ? '✓ ' : '• '}{tool}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {selectedTask.messages.map((msg, idx) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-sm px-3 py-2 rounded-lg text-[10px] ${
                    msg.role === 'user'
                      ? 'bg-blue-600/20 border border-blue-500/50 text-blue-100'
                      : 'bg-zinc-800/50 border border-zinc-700 text-zinc-300'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.requiresPermission && !msg.approved && !msg.rejected && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={approveAction}
                        className="text-[8px] px-1.5 py-1 bg-green-600/20 border border-green-500/50 text-green-300 rounded hover:bg-green-600/30 transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={rejectAction}
                        className="text-[8px] px-1.5 py-1 bg-red-600/20 border border-red-500/50 text-red-300 rounded hover:bg-red-600/30 transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                  {msg.rejected && (
                    <div className="mt-2 text-[8px] font-bold uppercase tracking-wider text-red-400">Rejected</div>
                  )}
                  <div className="mt-1 flex gap-1.5 text-[8px] text-zinc-500 flex-wrap">
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {msg.provider && <span className="text-zinc-400">via {msg.provider}</span>}
                    {msg.cost !== undefined && <span className="text-yellow-600">${msg.cost.toFixed(4)}</span>}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Tags & Context */}
          <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 space-y-2 shrink-0">
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                <Tag size={11} /> Tags
              </div>
              <div className="flex gap-1 flex-wrap">
                {selectedTask.tags?.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-[8px] font-semibold">
                    {tag}
                    <button
                      onClick={() => removeTaskTag(selectedTaskId!, tag)}
                      className="ml-1 hover:text-purple-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addTaskTag(selectedTaskId!, newTag);
                      setNewTag('');
                    }
                  }}
                  placeholder="Add tag..."
                  className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[9px] text-zinc-300 focus:border-purple-500 outline-none transition-colors"
                />
                <button
                  onClick={() => {
                    addTaskTag(selectedTaskId!, newTag);
                    setNewTag('');
                  }}
                  className="px-2 py-1 bg-purple-600/20 border border-purple-500/50 text-purple-300 rounded text-[8px] hover:bg-purple-600/30 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 flex gap-2 shrink-0">
            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Ask or describe your task..."
                className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:border-blue-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Send size={12} />
              </button>
              <button
                type="button"
                onClick={() => createMemoryFromTask(selectedTask)}
                className="px-2 py-1.5 bg-blue-600/20 border border-blue-500/50 text-blue-300 hover:bg-blue-600/30 text-xs rounded-lg transition-colors flex items-center gap-1"
                title="Save to memory"
              >
                <Brain size={11} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-zinc-800 rounded-lg bg-zinc-900/50">
          <div className="text-center space-y-3">
            <Bot size={40} className="mx-auto text-zinc-600" />
            <h3 className="font-bold text-zinc-400 text-sm">No Task Selected</h3>
            <p className="text-xs text-zinc-500">Create or select a task to get started</p>
          </div>
        </div>
      )}
    </div>
  );
};
