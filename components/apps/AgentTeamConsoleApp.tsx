import React, { useEffect, useReducer, useState } from 'react';
import { Users, Play, StopCircle, Send, Zap } from 'lucide-react';
import { agentTeamOrchestrator, type AgentRole } from '../../lib/agentTeamOrchestrator';

/**
 * Agent Team Console — monitor multi-agent orchestration
 */

const AGENT_ROLES: AgentRole[] = ['researcher', 'analyzer', 'coder', 'qa', 'reviewer'];
const AGENT_COLORS: Record<AgentRole, string> = {
  researcher: 'text-blue-400 bg-blue-900/20',
  analyzer: 'text-purple-400 bg-purple-900/20',
  coder: 'text-green-400 bg-green-900/20',
  qa: 'text-yellow-400 bg-yellow-900/20',
  reviewer: 'text-orange-400 bg-orange-900/20',
};

export const AgentTeamConsoleApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [executions, setExecutions] = useState(agentTeamOrchestrator.getExecutions());
  const [currentExecution, setCurrentExecution] = useState(agentTeamOrchestrator.getCurrentExecution());
  const [selectedRoles, setSelectedRoles] = useState<Set<AgentRole>>(new Set(['researcher', 'analyzer', 'coder']));
  const [goal, setGoal] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentRole | null>(null);

  const refreshState = () => {
    setExecutions(agentTeamOrchestrator.getExecutions());
    const current = agentTeamOrchestrator.getCurrentExecution();
    setCurrentExecution(current);
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStartExecution = () => {
    if (!goal.trim() || selectedRoles.size === 0) return;

    const roles = Array.from(selectedRoles);
    agentTeamOrchestrator.startTeamExecution(`Team-${Date.now()}`, goal, roles);
    setGoal('');
    refreshState();
    tick();
  };

  const handleToggleRole = (role: AgentRole) => {
    const next = new Set(selectedRoles);
    if (next.has(role)) {
      next.delete(role);
    } else {
      next.add(role);
    }
    setSelectedRoles(next);
  };

  const handleSendMessage = () => {
    if (!currentExecution || !selectedAgent || !messageText.trim()) return;

    agentTeamOrchestrator.sendMessage(selectedAgent, undefined, 'task', messageText);
    setMessageText('');
    refreshState();
    tick();
  };

  const timeline = currentExecution ? agentTeamOrchestrator.getTimeline(currentExecution.id) : [];
  const stats = currentExecution ? agentTeamOrchestrator.getStats(currentExecution.id) : null;

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Users size={16} className="text-pink-400" />
          Agent Team Console
          {currentExecution && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-pink-900/50 text-pink-300 text-xs">
              Active
            </span>
          )}
        </h2>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!currentExecution ? (
          // Start screen
          <div className="max-w-2xl space-y-4">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
              <h3 className="font-bold text-white mb-3">Start Team Execution</h3>

              {/* Goal */}
              <div className="mb-4">
                <label className="text-xs text-zinc-500 block mb-1">Goal</label>
                <textarea
                  placeholder="e.g., Analyze competitor pricing and write comparison report"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-pink-500 outline-none resize-none h-16"
                />
              </div>

              {/* Team composition */}
              <div className="mb-4">
                <label className="text-xs text-zinc-500 block mb-2">Team Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {AGENT_ROLES.map(role => (
                    <button
                      key={role}
                      onClick={() => handleToggleRole(role)}
                      className={`px-3 py-2 rounded text-xs font-bold transition ${
                        selectedRoles.has(role)
                          ? `${AGENT_COLORS[role]} border border-current`
                          : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                      }`}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartExecution}
                className="w-full px-3 py-2 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                <Play size={16} /> Start Execution
              </button>
            </div>
          </div>
        ) : (
          // Execution screen
          <div className="space-y-4">
            {/* Status */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white">{currentExecution.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{currentExecution.goal}</p>
                </div>
                <button
                  onClick={() => {
                    // In a real implementation, would cancel execution
                    setCurrentExecution(null);
                    refreshState();
                  }}
                  className="p-1 hover:bg-zinc-800 rounded"
                  title="End execution"
                >
                  <StopCircle size={14} className="text-red-400" />
                </button>
              </div>

              {stats && (
                <div className="grid grid-cols-4 gap-2 text-[10px] mb-3">
                  <div>
                    <span className="text-zinc-600">Tasks</span>
                    <div className="text-white font-bold">{stats.total}</div>
                  </div>
                  <div>
                    <span className="text-emerald-600">Done</span>
                    <div className="text-emerald-400 font-bold">{stats.completed}</div>
                  </div>
                  <div>
                    <span className="text-red-600">Failed</span>
                    <div className="text-red-400 font-bold">{stats.failed}</div>
                  </div>
                  <div>
                    <span className="text-zinc-600">Msg</span>
                    <div className="text-white font-bold">{stats.messageCount}</div>
                  </div>
                </div>
              )}

              {/* Tasks */}
              <div className="space-y-2">
                {currentExecution.tasks.map(task => (
                  <div key={task.id} className={`border rounded p-2 text-xs ${AGENT_COLORS[task.role]}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold capitalize">{task.role}</span>
                      <span className="text-[10px] opacity-75">
                        {task.phase === 'pending' && '⏳'}
                        {task.phase === 'running' && '▶️'}
                        {task.phase === 'completed' && '✅'}
                        {task.phase === 'failed' && '❌'}
                        {task.phase === 'waiting' && '⏸️'}
                      </span>
                    </div>
                    {task.output && <div className="text-[9px] line-clamp-2 opacity-75 mt-1">{task.output}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Message timeline */}
            {timeline.length > 0 && (
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
                <h4 className="text-xs font-bold text-zinc-400 mb-2">Message Timeline</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {timeline.slice(-10).map(msg => (
                    <div key={msg.id} className={`border-l-2 border-pink-600 pl-2 py-1 text-[10px]`}>
                      <div className="font-mono text-zinc-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-pink-300">
                        <span className="font-bold">{msg.fromAgent}</span>
                        {msg.toAgent && <span className=" text-zinc-600"> → {msg.toAgent}</span>}
                      </div>
                      <div className="text-zinc-400 line-clamp-2">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send message */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
              <label className="text-xs text-zinc-500 block mb-2">Send Message As Agent</label>
              <select
                value={selectedAgent || ''}
                onChange={e => setSelectedAgent((e.target.value as AgentRole) || null)}
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-pink-500 outline-none mb-2"
              >
                <option value="">Select agent...</option>
                {currentExecution.tasks.map(task => (
                  <option key={task.id} value={task.role}>
                    {task.role}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  placeholder="Message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-pink-500 outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3 py-1.5 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600 space-y-1">
        <div>• Coordinates multi-agent task chains with message routing</div>
        <div>• Each agent processes input and produces output for the next</div>
        <div>• Timeline shows all inter-agent communication</div>
        <div>• Execution history persisted for replay and analysis</div>
      </div>
    </div>
  );
};

export default AgentTeamConsoleApp;
