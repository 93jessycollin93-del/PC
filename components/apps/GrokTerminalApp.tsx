import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Trash2, Download, Copy, DollarSign } from 'lucide-react';
import { aiClient } from '../../lib/aiClient';
import { modelRouter } from '../../lib/modelRouter';

interface TerminalCommand {
  id: string;
  prompt: string;
  response: string;
  timestamp: number;
  type: 'test' | 'query' | 'code' | 'analysis';
  provider?: string;
  model?: string;
  cost?: number;
  tokensUsed?: number;
  totalCost?: number;
}

export const GrokTerminalApp: React.FC = () => {
  const [commands, setCommands] = useState<TerminalCommand[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [commandType, setCommandType] = useState<'test' | 'query' | 'code' | 'analysis'>('query');
  const [totalCost, setTotalCost] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Load commands from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('grok_terminal_history');
    if (saved) {
      try {
        setCommands(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save commands to localStorage
  useEffect(() => {
    localStorage.setItem('grok_terminal_history', JSON.stringify(commands));
  }, [commands]);

  // Auto-scroll to latest
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands]);

  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const prompt = input;
    setInput('');
    setIsLoading(true);

    try {
      const systemPrompts: Record<string, string> = {
        'test': `You are Grok running in testing mode. Analyze the provided test case or scenario and provide specific findings, results, and recommendations. Be direct and technical.`,
        'query': `You are Grok, an AI assistant focused on providing direct, factual answers. Answer the user's query comprehensively. Be concise and specific.`,
        'code': `You are Grok, a code analysis expert. Analyze, optimize, or generate code as requested. Provide working, production-ready solutions with explanations.`,
        'analysis': `You are Grok, specialized in deep analysis. Provide thorough analysis of the given topic, identifying patterns, implications, and insights.`
      };

      const response = await aiClient.sendMessage(
        [{ role: 'user', content: prompt }],
        { systemPrompt: systemPrompts[commandType], maxTokens: 2000, temperature: 0.7, taskId: `grok_${Date.now()}` }
      );

      const newCommand: TerminalCommand = {
        id: `cmd_${Date.now()}`,
        prompt,
        response: response.content,
        timestamp: Date.now(),
        type: commandType,
        provider: response.provider,
        model: response.model,
        cost: response.cost,
        tokensUsed: response.tokensUsed,
        totalCost: totalCost + response.cost
      };

      setCommands([...commands, newCommand]);
      setTotalCost(totalCost + response.cost);
    } catch (error: any) {
      const errorCommand: TerminalCommand = {
        id: `cmd_${Date.now()}`,
        prompt,
        response: `ERROR: ${error.message}. Make sure you have configured API keys in the API Keys app.`,
        timestamp: Date.now(),
        type: commandType
      };
      setCommands([...commands, errorCommand]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('Clear all terminal history?')) {
      setCommands([]);
    }
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadLog = () => {
    const log = commands
      .map(cmd => `[${new Date(cmd.timestamp).toLocaleTimeString()}] [${cmd.type.toUpperCase()}]\n$ ${cmd.prompt}\n\n${cmd.response}\n\n---\n`)
      .join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(log));
    element.setAttribute('download', `grok-terminal-${Date.now()}.log`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-green-400 font-mono flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-green-900/50 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-green-500" />
          <span className="text-sm font-bold text-white">Grok Terminal</span>
          <span className="text-[10px] text-green-600/70 ml-2">Testing & Analysis Mode</span>
        </div>
        <div className="flex items-center gap-3">
          {totalCost > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-green-400">
              <DollarSign size={12} />
              <span className="font-mono">${totalCost.toFixed(4)}</span>
            </div>
          )}
          {commands.length > 0 && (
            <>
              <button
                onClick={downloadLog}
                className="p-1.5 hover:bg-green-900/20 rounded text-green-400 transition-colors"
                title="Download log"
              >
                <Download size={14} />
              </button>
              <button
                onClick={clearHistory}
                className="p-1.5 hover:bg-red-900/20 rounded text-red-400 transition-colors"
                title="Clear history"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Command Type Selector */}
      <div className="h-10 border-b border-green-900/50 bg-zinc-900/50 px-4 flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-green-600/70 uppercase">Mode:</span>
        {(['test', 'query', 'code', 'analysis'] as const).map(type => (
          <button
            key={type}
            onClick={() => setCommandType(type)}
            className={`px-2 py-1 text-xs rounded font-bold transition-colors ${
              commandType === type
                ? 'bg-green-600/30 border border-green-500/50 text-green-300'
                : 'border border-green-900/30 text-green-600 hover:text-green-400'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/80">
        {commands.length === 0 ? (
          <div className="text-center text-green-600/50 text-sm py-8">
            <p>Grok Terminal Ready</p>
            <p className="text-[10px] mt-2">Enter a command to begin testing and analysis</p>
          </div>
        ) : (
          commands.map(cmd => (
            <div key={cmd.id} className="space-y-1 text-sm">
              <div className="flex items-center gap-2 text-green-600/70 text-[10px]">
                <span>[{new Date(cmd.timestamp).toLocaleTimeString()}] [{cmd.type.toUpperCase()}]</span>
                {cmd.provider && <span className="text-green-500">via {cmd.provider}/{cmd.model}</span>}
                {cmd.cost !== undefined && <span className="text-yellow-600">${cmd.cost.toFixed(4)}</span>}
              </div>
              <div className="text-green-400">$ {cmd.prompt}</div>
              <div className="bg-zinc-900/50 border border-green-900/30 rounded p-2 mt-2 relative group">
                <pre className="text-green-300 text-[11px] whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {cmd.response}
                </pre>
                <button
                  onClick={() => copyOutput(cmd.response)}
                  className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 bg-green-900/50 hover:bg-green-900/70 rounded transition-all text-green-400"
                  title="Copy output"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Input */}
      <div className="h-20 border-t border-green-900/50 bg-zinc-900 px-4 py-3 flex gap-2 shrink-0">
        <form onSubmit={executeCommand} className="flex-1 flex gap-2 items-end">
          <div className="flex-1">
            <div className="text-green-600/70 text-[10px] mb-1">$</div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Enter ${commandType} command...`}
              className="w-full px-3 py-2 bg-zinc-950 border border-green-900/50 rounded text-green-400 focus:border-green-500 outline-none transition-colors font-mono text-sm placeholder-green-600/50"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-green-900/30 hover:bg-green-900/50 disabled:bg-zinc-800 border border-green-500/30 hover:border-green-500/50 text-green-400 font-bold rounded transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <Send size={14} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
