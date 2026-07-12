import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Monitor, Sparkles, Settings as SettingsIcon, Send, Loader2,
  Maximize2, SquareSplitVertical, X, Brain, ChevronDown, Lock, Unlock,
  Palette,
} from 'lucide-react';
import { DesktopItem } from '../types';
import { getAiClient, MODEL_NAME } from '../lib/gemini';
import { createMiniAi, MiniAiContext } from '../src/jackie-core/mini-ai-context';
import {
  JACKIE_BRAINS, JACKIE_PERSONALITIES,
  getActiveBrainId, setActiveBrainId,
  getActivePersonalityId, setActivePersonalityId,
  getBrain,
} from '../src/jackie-core/jackie-brains';
import AnimatedCanvas from '../src/components/backgrounds/AnimatedCanvas';
import type { BackgroundTheme } from '../src/components/backgrounds/AnimatedBackgrounds';
import { BACKGROUND_THEMES } from '../src/components/backgrounds/AnimatedBackgrounds';

/** Screen split for the PC surface behind Jackie. */
export type PcMode = 'closed' | 'full' | 'half';

interface JackieShellProps {
  apps: DesktopItem[];
  /** Launch an app inside the PC (also reveals the PC). */
  onLaunchApp: (app: DesktopItem) => void;
  pcMode: PcMode;
  setPcMode: (m: PcMode) => void;
  /** Open the Eru app. */
  onOpenEru: () => void;
  /** Open the Settings app. */
  onOpenSettings: () => void;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'jackie';
  text: string;
  /** If Jackie proposed launching an app, the item to launch. */
  launch?: DesktopItem;
}

/** Read the Settings code-change lock. Default OFF (locked). */
function codeChangesUnlocked(): boolean {
  try {
    const raw = localStorage.getItem('pc_system_settings');
    if (!raw) return false;
    return JSON.parse(raw).jackieCodeUnlock === true;
  } catch {
    return false;
  }
}


const STORAGE_KEY_THEME = 'jackie:shell-theme';

function loadTheme(): BackgroundTheme {
  if (typeof window === 'undefined') return 'neutron_star';
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored && BACKGROUND_THEMES.some(t => t.id === stored)) return stored as BackgroundTheme;
  } catch { }
  return 'neutron_star';
}

export const JackieShell: React.FC<JackieShellProps> = ({
  apps, onLaunchApp, pcMode, setPcMode, onOpenEru, onOpenSettings,
}) => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [brainId, setBrainId] = useState(getActiveBrainId());
  const [personalityId, setPersonalityId] = useState(getActivePersonalityId());
  const [brainOpen, setBrainOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState<BackgroundTheme>(loadTheme());
  const scrollRef = useRef<HTMLDivElement>(null);

  const brain = getBrain(brainId);
  const personality = JACKIE_PERSONALITIES.find((p) => p.id === personalityId);

  // One mini-AI that routes plain language to the right app on-device (free).
  const router: MiniAiContext = useMemo(
    () =>
      createMiniAi({
        appId: 'jackie-router',
        appPurpose: 'Route the user to the right app in the PC.',
        intents: apps
          .filter(Boolean)
          .map((a) => ({
            id: a.appId || a.id,
            label: a.name,
            triggers: [a.name.toLowerCase(), (a.appId || a.id).replace(/[-_]/g, ' ')],
          })),
      }),
    [apps]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const findApp = (intentId: string): DesktopItem | undefined =>
    apps.find((a) => (a.appId || a.id) === intentId);

  const say = (text: string, extra: Partial<ChatTurn> = {}) =>
    setTurns((t) => [...t, { id: `j-${Date.now()}-${Math.random()}`, role: 'jackie', text, ...extra }]);

  const handleSend = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text }]);
    setInput('');
    setBusy(true);

    try {
      // 1) Try to route to an app locally (free, instant).
      const routed = router.interpret(text);
      const wantsAction = /\b(open|launch|go to|use|start|show|run)\b/i.test(text);

      if (routed.intentId && routed.confidence >= 0.7) {
        const app = findApp(routed.intentId);
        if (app) {
          say(
            `On it — opening ${app.name} in the PC. Tell me what you want to do there and I'll take it from here.`,
            { launch: app }
          );
          onLaunchApp(app);
          setPcMode((m => (m === 'closed' ? 'half' : m))(pcMode));
          setBusy(false);
          return;
        }
      }

      // 2) Ambiguous action → ask a clarifying question instead of guessing.
      if (wantsAction && (!routed.intentId || routed.confidence < 0.7)) {
        const guesses = apps
          .filter((a) => a.name.toLowerCase().split(' ').some((w) => text.toLowerCase().includes(w) && w.length > 3))
          .slice(0, 4)
          .map((a) => a.name);
        if (guesses.length) {
          say(
            `I want to get this exactly right before I act. Did you mean one of these: ${guesses.join(', ')}? ` +
            `Or tell me in your own words and I'll find it.`
          );
        } else {
          say(
            `I hear you want to do something — I just don't want to guess wrong. ` +
            `Which app or outcome do you have in mind? Name it however feels natural and I'll take us there.`
          );
        }
        setBusy(false);
        return;
      }

      // 3) Otherwise Jackie answers directly, staying herself.
      const locked = !codeChangesUnlocked();
      const ai = getAiClient();
      const sys =
        `You are Jackie, the user's primary AI. ${personality?.systemModifier || ''} ` +
        `You orchestrate an OS ("the PC") full of apps and a paired assistant (Eru). ` +
        `The underlying brain right now is "${brain?.label || 'free tier'}". ` +
        (locked
          ? `Code-change mode is LOCKED in Settings, so you may plan and explain code but must not claim to have modified the user's code. `
          : `Code-change mode is UNLOCKED. `) +
        `If the user's intent is unclear, ask a focused clarifying question rather than guessing.`;
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: 'user', parts: [{ text: `${sys}\n\nUser: ${text}` }] }],
      });
      say(response.text?.trim() || 'I’m here — say a little more?');
    } catch (err: any) {
      say(
        `My free brain didn’t answer just now${err?.message ? ` (${err.message})` : ''}. ` +
        `You can switch brains with the ◆ selector, or check API keys in Settings.`
      );
    } finally {
      setBusy(false);
    }
  };

  const locked = !codeChangesUnlocked();

  // Save theme preference
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch { }
  }, [theme]);

  // Height of Jackie's surface depends on the PC split.
  const shellHeightClass =
    pcMode === 'closed' ? 'h-full' : pcMode === 'half' ? 'h-1/2' : 'h-0 pointer-events-none';

  return (
    <>
      {/* Jackie surface — front page. Sits above the PC (desktop) base layer. */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${shellHeightClass} z-[3000] transition-all duration-500 ease-in-out overflow-hidden`}
        style={{ transitionProperty: 'height' }}
      >
        {pcMode !== 'full' && (
          <div className="relative h-full w-full bg-[#04030a] flex flex-col">
            <AnimatedCanvas theme={theme} opacity={0.4} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(circle_at_80%_90%,rgba(236,72,153,0.12),transparent_50%)] pointer-events-none" />

            {/* Top bar: identity + brain/personality + split controls */}
            <div className="relative flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_18px_rgba(139,92,246,0.6)] shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-black tracking-[0.2em] text-sm">JACKIE</div>
                <div className="text-[9px] text-indigo-300/70 truncate">
                  {personality?.label} · {brain?.label}
                </div>
              </div>

              <div className="flex-1" />

              {/* Theme / Brain / personality selector */}
              <button
                onClick={() => setThemeOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-violet-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 transition-colors"
                title="Switch background theme"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Theme</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setBrainOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 transition-colors"
                  title="Switch Jackie's brain & personality"
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Brain</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {themeOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 z-50 shadow-2xl max-h-96 overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Background Theme</div>
                    <div className="grid grid-cols-3 gap-2">
                      {BACKGROUND_THEMES.filter(t => t.id !== 'none').map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setTheme(t.id); setThemeOpen(false); }}
                          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[9px] font-medium transition-all ${
                            theme === t.id
                              ? 'bg-violet-600/40 text-violet-100 border border-violet-500/60'
                              : 'text-zinc-300 hover:bg-white/10 border border-white/5 hover:border-white/20'
                          }`}
                          title={t.label}
                        >
                          <span className="text-lg">{t.icon}</span>
                          <span className="truncate">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {brainOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 z-50 shadow-2xl">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Brain (free-first)</div>
                    <div className="space-y-1 mb-3">
                      {JACKIE_BRAINS.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => { setBrainId(b.id); setActiveBrainId(b.id); }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                            brainId === b.id ? 'bg-indigo-600/30 text-indigo-100 border border-indigo-500/40' : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <span className="truncate">{b.label}</span>
                          <span className={`text-[8px] uppercase font-bold px-1 py-0.5 rounded ${b.tier === 'free' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'}`}>
                            {b.tier}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Personality</div>
                    <div className="space-y-1">
                      {JACKIE_PERSONALITIES.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setPersonalityId(p.id); setActivePersonalityId(p.id); }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            personalityId === p.id ? 'bg-violet-600/30 text-violet-100 border border-violet-500/40' : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          {p.label}
                          <span className="block text-[9px] text-zinc-500">{p.vibe}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Split controls */}
              <button
                onClick={() => setPcMode(pcMode === 'half' ? 'closed' : 'half')}
                className={`p-1.5 rounded-lg border transition-colors ${pcMode === 'half' ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/40' : 'text-zinc-400 hover:text-white bg-white/5 border-white/10'}`}
                title="Half screen (PC on top, Jackie below)"
              >
                <SquareSplitVertical className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPcMode('full')}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 border border-white/10 transition-colors"
                title="Open the PC full screen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Conversation */}
            <div className="relative flex-1 flex flex-col">
              {/* Jump buttons */}
              <div className="absolute right-4 top-2 z-10 flex gap-1">
                <button
                  onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600/50 flex items-center justify-center text-sm font-bold transition-colors"
                  title="Jump to top"
                >
                  ↑
                </button>
                <button
                  onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
                  className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600/50 flex items-center justify-center text-sm font-bold transition-colors"
                  title="Jump to bottom"
                >
                  ↓
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {turns.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.5)] animate-pulse">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-white/90 text-lg font-semibold">Hey — I’m Jackie.</p>
                    <p className="text-indigo-200/60 text-sm max-w-sm mt-1">
                      Tell me what you want in your own words. I’ll take us there, open the PC,
                      pull in Eru or any app — and if I’m not sure, I’ll keep asking until we’re on the same page.
                    </p>
                  </div>
                </div>
              )}
              {turns.map((t) => (
                <div key={t.id} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                      t.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white/5 border border-white/10 text-indigo-50 rounded-bl-sm backdrop-blur-sm'
                    }`}
                  >
                    {t.text}
                    {t.launch && (
                      <button
                        onClick={() => { onLaunchApp(t.launch!); setPcMode(pcMode === 'closed' ? 'half' : pcMode); }}
                        className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 rounded-lg px-2 py-1 transition-colors"
                      >
                        <Monitor className="w-3 h-3" /> Open {t.launch.name}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-indigo-200/80">
                    <Loader2 className="w-4 h-4 animate-spin" /> Jackie is thinking…
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Composer — enhanced spacing to prevent collision */}
            <div className="relative p-4 pb-6 border-t border-white/5 bg-gradient-to-t from-black/40 to-transparent">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); }
                  }}
                  rows={1}
                  placeholder="Tell Jackie what to do…"
                  className="flex-1 resize-none bg-white/8 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-indigo-200/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/80 max-h-32 backdrop-blur-md transition-all"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={busy || !input.trim()}
                  className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:brightness-110 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-indigo-500/50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Minimalist launcher rail — always visible. The two mains (PC, Eru) + Settings. */}
      <div className="absolute top-1/2 -translate-y-1/2 right-3 z-[3500] flex flex-col gap-2.5 pointer-events-auto">
        <RailButton
          label={pcMode === 'closed' ? 'Open PC' : 'PC'}
          active={pcMode !== 'closed'}
          onClick={() => setPcMode(pcMode === 'closed' ? 'half' : pcMode === 'half' ? 'full' : 'closed')}
          gradient="from-slate-700 to-slate-900"
          Icon={Monitor}
        />
        <RailButton
          label="Eru"
          onClick={onOpenEru}
          gradient="from-indigo-500 to-violet-700"
          Icon={Sparkles}
        />
        <RailButton
          label="Settings"
          onClick={onOpenSettings}
          gradient="from-zinc-600 to-zinc-800"
          Icon={SettingsIcon}
        />
        {/* Code-lock status pill */}
        <button
          onClick={onOpenSettings}
          title={locked ? 'Jackie code-changes: LOCKED (tap for Settings)' : 'Jackie code-changes: UNLOCKED'}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-colors ${
            locked ? 'bg-zinc-900/70 border-zinc-700 text-zinc-400' : 'bg-emerald-900/40 border-emerald-600/50 text-emerald-300'
          }`}
        >
          {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>

      {/* When PC is full, a small chip to bring Jackie back */}
      {pcMode === 'full' && (
        <button
          onClick={() => setPcMode('half')}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[3500] flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:brightness-110 transition-all pointer-events-auto"
        >
          <Sparkles className="w-4 h-4" /> Bring Jackie back
        </button>
      )}
    </>
  );
};

const RailButton: React.FC<{
  label: string;
  Icon: React.ElementType;
  gradient: string;
  onClick: () => void;
  active?: boolean;
}> = ({ label, Icon, gradient, onClick, active }) => (
  <button
    onClick={onClick}
    title={label}
    className={`group relative w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${
      active ? 'ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-black' : ''
    }`}
  >
    <Icon className="w-5 h-5 text-white" />
    <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      {label}
    </span>
  </button>
);

export default JackieShell;
