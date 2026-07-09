import React, { useState, useRef, useEffect } from 'react';
import { Bot, Plus, Send, Trash2, Lock, CheckCircle, AlertCircle, Loader2, Settings, History, MoreVertical, DollarSign } from 'lucide-react';
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

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'rejected';
  messages: Message[];
  createdAt: number;
  totalCost: number;
}

export const ClaudeAssistantApp: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'strict' | 'balanced' | 'trusted'>('balanced');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load tasks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('claude_assistant_tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load tasks:', e);
      }
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem('claude_assistant_tasks', JSON.stringify(tasks));
  }, [tasks]);

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
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex gap-4 p-4">
      {/* Left Panel - Task List */}
      <div className="w-64 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
        <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <Bot size={14} className="text-blue-400" />
            My Tasks
          </h2>
          <button
            onClick={createNewTask}
            className="p-1.5 hover:bg-zinc-800 rounded text-blue-400"
            title="New task"
          >
            <Plus size={14} />
          </button>
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
                    ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
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

        {/* Task List */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              <p>No tasks yet</p>
              <p className="text-[10px] mt-1">Create one to get started</p>
            </div>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                  selectedTaskId === task.id
                    ? 'bg-blue-600/20 border-blue-500/50'
                    : 'border-zinc-800 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{task.title}</h3>
                    <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{task.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        task.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                        task.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                        task.status === 'executing' ? 'bg-blue-500/20 text-blue-300' :
                        task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(task.id);
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

      {/* Right Panel - Chat */}
      {selectedTask ? (
        <div className="flex-1 flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-sm text-white">{selectedTask.title}</h2>
              <p className="text-[10px] text-zinc-400">{selectedTask.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <DollarSign size={12} />
                <span className="font-mono">${selectedTask.totalCost.toFixed(4)}</span>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
                selectedTask.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                selectedTask.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                selectedTask.status === 'executing' ? 'bg-blue-500/20 text-blue-300' :
                selectedTask.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {selectedTask.status}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedTask.messages.map((msg, idx) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600/20 border border-blue-500/50 text-blue-100'
                      : 'bg-zinc-800/50 border border-zinc-700 text-zinc-300'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.requiresPermission && !msg.approved && !msg.rejected && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={approveAction}
                        className="text-xs px-2 py-1 bg-green-600/20 border border-green-500/50 text-green-300 rounded hover:bg-green-600/30 transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={rejectAction}
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
                  <Loader2 size={16} className="animate-spin text-blue-400" />
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
                placeholder="Describe your task or ask for help..."
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-zinc-800 rounded-lg bg-zinc-900/50">
          <div className="text-center space-y-3">
            <Bot size={48} className="mx-auto text-zinc-600" />
            <h3 className="font-bold text-zinc-400">No Task Selected</h3>
            <p className="text-sm text-zinc-500">Create or select a task to get started</p>
          </div>
        </div>
      )}
    </div>
  );
};
