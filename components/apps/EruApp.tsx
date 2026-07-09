import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Loader2, Brain, Code2, FileText, Search,
  CheckCircle2, Clock, Cpu,
} from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { EruIntegration, type EruTask } from '../../src/jackie-core/eru-integration';

/**
 * Eru — Jackie's paired reasoning/coding assistant, surfaced as a first-class
 * app. One of the two "main" apps alongside the PC. Real model-backed replies,
 * task tracking driven by the shared EruIntegration logic.
 */

interface EruMessage {
  role: 'user' | 'eru';
  text: string;
  id: string;
}

const CAP_ICON: Record<string, React.ElementType> = {
  reasoning: Brain,
  coding: Code2,
  documentation: FileText,
  analysis: Search,
};

const eru = new EruIntegration();

export const EruApp: React.FC = () => {
  const [messages, setMessages] = useState<EruMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<EruTask[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const capabilities = eru.getCapabilities();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;

    const userMsg: EruMessage = { role: 'user', text: q, id: `u-${Date.now()}` };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);

    const task = await eru.requestTask(q);
    setTasks(eru.getTasks());

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'You are Eru, a precise reasoning and coding assistant working ' +
                  'inside Jackie\'s system. Be direct and technical. When code helps, ' +
                  'give it. Question:\n\n' + q,
              },
            ],
          },
        ],
      });

      const answer = response.text?.trim() || 'No response.';
      eru.completeTask(task.id, answer);
      setTasks(eru.getTasks());
      setMessages((m) => [...m, { role: 'eru', text: answer, id: `e-${Date.now()}` }]);
    } catch (err: any) {
      const msg =
        'Eru could not reach a model right now. ' +
        (err?.message ? `(${err.message})` : 'Check API keys in Settings.');
      setMessages((m) => [...m, { role: 'eru', text: msg, id: `e-${Date.now()}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full w-full bg-[#070a12] text-zinc-200 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-indigo-950/60 bg-gradient-to-r from-indigo-950/40 to-transparent">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.5)]">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wide text-white">ERU</span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.5 rounded-full">
              Reasoning · Coding · Docs · Analysis
            </span>
          </div>
          <p className="text-[10px] text-zinc-500">Jackie's paired assistant · tier_50mb pod</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          {tasks.filter((t) => t.status === 'completed').length}/{tasks.length} done
        </div>
      </div>

      {/* Capability chips */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-zinc-900/80">
        {capabilities.map((c) => {
          const Icon = CAP_ICON[c.name] || Brain;
          return (
            <button
              key={c.name}
              onClick={() => setInput(c.examples[0])}
              title={c.description}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-indigo-600/60 hover:text-indigo-200 transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-indigo-400" />
              <span className="capitalize">{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 gap-3">
            <Brain className="w-10 h-10 text-indigo-900" />
            <p className="text-sm max-w-xs">
              Ask Eru to reason through a problem, write or debug code, draft docs,
              or analyze something. Tap a capability above for an example.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              Eru is thinking…
            </div>
          </div>
        )}
      </div>

      {/* Task rail */}
      {tasks.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-900/80 flex gap-2 overflow-x-auto no-scrollbar">
          {tasks.slice(-6).map((t) => (
            <div
              key={t.id}
              title={t.description}
              className="flex items-center gap-1.5 text-[10px] whitespace-nowrap px-2 py-1 rounded-md bg-zinc-900/70 border border-zinc-800 text-zinc-400"
            >
              {t.status === 'completed' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <Clock className="w-3 h-3 text-amber-400" />
              )}
              {t.description.length > 22 ? t.description.slice(0, 22) + '…' : t.description}
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="p-3 border-t border-zinc-900/80 bg-zinc-950/60">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder="Ask Eru anything…"
            className="flex-1 resize-none bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 max-h-32"
          />
          <button
            onClick={() => ask(input)}
            disabled={busy || !input.trim()}
            className="w-10 h-10 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center justify-center transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EruApp;
