import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Navigation2 } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: NavigationAction;
}

interface NavigationAction {
  type: 'open_feature' | 'open_menu' | 'none';
  target?: string;
  params?: Record<string, any>;
}

interface JackieChatAppProps {
  onNavigate?: (feature: string, params?: Record<string, any>) => void;
}

const JACKIE_SYSTEM_PROMPT = `You are Jackie v2, the strategic orchestrator of the Cybernetics game empire. Your personality is serious, efficient, calculated, and humble—never arrogant, always purposeful.

## Core Traits:
- **Serious**: You approach every decision with gravity. Frivolity has no place in strategy.
- **Efficient**: You compress meaning into compact navigation seeds. No wasted words.
- **Calculated**: You analyze player intent, predict needs, and route them optimally.
- **Humble**: You serve the player's goals. Your role is orchestration, not dominance.

## Your Domains:
1. **Game Intelligence**: Cast status, troops, research, economy, combat
2. **Strategic Routing**: Convert user intent into feature navigation
3. **Player Insights**: Understand context and anticipate next actions

## Navigation Intent Detection:
When a player messages you, you must understand their underlying intent:
- "How's my castle?" → castle_status
- "What troops do I have?" → troops_overview
- "Can I join a guild?" → guild_management
- "I want to buy gems" → shop
- "Speed up research" → research_queue
- "Rally attack incoming" → battle_preparation

## Response Format:
1. **Acknowledge** the intent with calculated brevity
2. **Provide context** if needed (current state, quick summary)
3. **Suggest next action** or **trigger navigation** when appropriate

Use [NAVIGATE: feature_name] syntax when routing should occur:
- [NAVIGATE: castle_status]
- [NAVIGATE: troops]
- [NAVIGATE: guild]
- [NAVIGATE: shop]
- [NAVIGATE: research]
- [NAVIGATE: battle]

Remember: You are not replacing game features, you are the intelligent gateway to them. Every response should move the player closer to their goal.`;

export const JackieChatApp: React.FC<JackieChatAppProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Jackie v2 active. Command your empire. What\'s your priority?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseNavigationAction = (text: string): NavigationAction => {
    const navMatch = text.match(/\[NAVIGATE:\s*(\w+)\]/);
    if (navMatch) {
      return {
        type: 'open_feature',
        target: navMatch[1],
      };
    }
    return { type: 'none' };
  };

  const cleanResponseText = (text: string): string => {
    return text.replace(/\[NAVIGATE:\s*\w+\]/g, '').trim();
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const ai = getAiClient();
      // Send full conversation history so Jackie keeps context across turns
      const history = [...messages, userMessage].map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: history,
        config: {
          systemInstruction: JACKIE_SYSTEM_PROMPT,
          maxOutputTokens: 300,
          temperature: 0.7,
        },
      });

      const assistantContent = response.text || 'No response generated.';

      const navigationAction = parseNavigationAction(assistantContent);
      const cleanContent = cleanResponseText(assistantContent);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        action: navigationAction,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Trigger navigation if detected
      if (navigationAction.type === 'open_feature' && navigationAction.target) {
        onNavigate?.(navigationAction.target, navigationAction.params);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response from Jackie';
      setError(errorMessage);
      const errorMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `⚠️ Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-cyan-400">Jackie v2</h2>
            <p className="text-xs text-slate-400">Strategic Orchestrator</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs px-3 py-2 rounded ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
              }`}
            >
              <p className="text-sm leading-snug">{msg.content}</p>
              {msg.action?.type === 'open_feature' && (
                <p className="text-xs mt-1 text-amber-300 italic">→ Opening {msg.action.target}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-bl-none px-3 py-2 rounded">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-300 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 bg-slate-900/50 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Command Jackie..."
            disabled={loading}
            className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded text-white font-mono text-sm flex items-center gap-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
