import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Cpu, Send, Plus, Trash2, Cloud, HardDrive, Loader2, Zap, Activity,
    MessageSquare, ChevronRight, RefreshCw, Wrench, Circle, Scissors,
    Shield, Save, Search, AlertTriangle, Archive, Settings, Rocket, X, Sparkles
} from 'lucide-react';
import { Type } from '@google/genai';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

/**
 * FUSION — Phase 4
 * "One brain, many hands." A single conversational surface that routes to a
 * local brain (Ollama hardware) first and falls back to the cloud (Gemini)
 * automatically. Three calm zones: Memory · Conversation · Live Canvas.
 *
 * Phase 1: shell + one real routed chat + unified vault.
 * Phase 2: tool bus — compress / scan_threat / save_to_vault / recall.
 * Phase 3: reach beyond the window — send_telegram + background run_task + settings.
 * Phase 4 (this): AUTONOMOUS INVOKE — with Auto on (cloud route), the model
 *   decides for itself when to call a tool via Gemini function-calling. Every
 *   call is announced in the chat and rendered in the canvas, so the machine's
 *   choices stay visible and human-comprehensible.
 */

type Brain = 'local' | 'cloud';

interface FMessage {
    role: 'user' | 'assistant';
    content: string;
    brain?: Brain;
    fellBack?: boolean;
    error?: boolean;
    tool?: string;
    ts: number;
}

interface FConversation {
    id: string;
    title: string;
    messages: FMessage[];
    createdAt: number;
}

interface VaultArtifact {
    id: string;
    kind: 'note' | 'compression' | 'scan' | 'task' | 'telegram';
    title: string;
    content: string;
    createdAt: number;
}

interface FVault {
    version: 3;
    conversations: FConversation[];
    artifacts: VaultArtifact[];
    activeId: string | null;
    preferLocal: boolean;
    autoTools: boolean;
    ollamaEndpoint: string;
    ollamaModel: string;
    telegramChatId: string;
}

interface TaskItem {
    id: string;
    prompt: string;
    status: 'running' | 'done' | 'failed';
    startTs: number;
    endTs?: number;
    brain?: Brain;
    error?: string;
}

const VAULT_KEY = 'fusion_vault_v1';

const SYSTEM_PROMPT = `You are the unified intelligence of a local-first developer OS — one mind speaking for the whole machine. You are direct, warm, and technically deep with zero fluff. Lead with the answer; add depth only when it earns its place, so a human is never overwhelmed. You are offline-first and privacy-respecting. You have real tools on your bus: compress, scan_threat, save_to_vault, recall, send_telegram, run_task. When a request clearly maps to a tool, call it; otherwise just answer. Only send_telegram when the user explicitly asks to message Telegram. Keep the human oriented at all times.`;

// Gemini function-calling declarations (Phase 4 — cloud route only).
const FUSION_TOOLS = [{
    functionDeclarations: [
        { name: 'compress', description: 'Compress/condense text to its core meaning, stripping filler. Use when the user asks to summarize, condense, shorten, or squeeze text.', parameters: { type: Type.OBJECT, required: ['text'], properties: { text: { type: Type.STRING, description: 'The text to compress' } } } },
        { name: 'scan_threat', description: 'Audit a message for scams, phishing, or social engineering. Use when the user asks whether a message is a scam, safe, or legit.', parameters: { type: Type.OBJECT, required: ['text'], properties: { text: { type: Type.STRING, description: 'The suspicious message to scan' } } } },
        { name: 'save_to_vault', description: 'Save a note or snippet to the persistent vault memory. Use when the user says remember/save/note this.', parameters: { type: Type.OBJECT, required: ['text'], properties: { text: { type: Type.STRING, description: 'The content to save' } } } },
        { name: 'recall', description: 'Search the vault memory for saved items. Use when the user asks what they saved, or to recall/find something in memory.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'Search query; empty for recent items' } } } },
        { name: 'send_telegram', description: "Send a message to the user's real Telegram chat. Use ONLY when the user explicitly asks to send/text/message something to Telegram.", parameters: { type: Type.OBJECT, required: ['text'], properties: { text: { type: Type.STRING, description: 'The message text to send' } } } },
        { name: 'run_task', description: 'Dispatch a longer task to run in the background without blocking the chat. Use for multi-step generation the user wants to fire off.', parameters: { type: Type.OBJECT, required: ['prompt'], properties: { prompt: { type: Type.STRING, description: 'The task instruction' } } } },
    ],
}];

const SCAM_PATTERNS = [
    { name: 'Urgency Trap', indicators: ['act now', 'limited time', 'urgent', 'only today', 'expires'], context: 'Artificial time pressure bypasses rational analysis' },
    { name: 'Authority Impersonation', indicators: ['official', 'from your bank', 'support team', 'verified account'], context: 'Mimics trust without verifiable proof' },
    { name: 'Link Obfuscation', indicators: ['bit.ly', 'tinyurl', 'click here', 'verify here', 'shortened'], context: 'Hides true destination from inspection' },
    { name: 'Reciprocity Trap', indicators: ['free gift', 'you owe', 'special offer', 'bonus', 'reward'], context: 'Creates psychological debt to lower resistance' },
    { name: 'Social Proof Fabrication', indicators: ['thousands agree', 'everyone is doing', 'trusted by millions'], context: 'Invents consensus to exploit conformity' },
    { name: 'Data Harvest Pretext', indicators: ['verify identity', 'confirm details', 'update information', 'security check'], context: 'Requests sensitive data under false legitimacy' },
    { name: 'Emotional Exploitation', indicators: ['you\'ve won', 'congratulations', 'you\'re selected', 'winner'], context: 'Targets emotional centers to bypass logic' },
    { name: 'Crypto Pump', indicators: ['guaranteed returns', 'no risk', 'get rich', 'proven system', '100x', 'risk-free'], context: 'Promises impossible returns in high-risk assets' },
];
const LEVEL_COLOR: Record<string, string> = { EXTREME: '#f0596a', HIGH: '#f08a3a', MEDIUM: '#f0b429', LOW: '#4ade80' };

const COMPRESS_PROMPT = (text: string) => `You are a semantic compression engine. Strip all conversational fluff, throat-clearing, redundant explanation, preachy warnings, and noise. Condense to absolute core meaning at 100% informational fidelity. Output ONLY the compressed result as tight structured bullets — no intro, no closing remarks.

INPUT:
"${text}"`;

const SCAN_PROMPT = (text: string) => `You are a predatory-pattern / scam scanner. Examine this message:
"${text}"

Return ONLY a raw JSON object, no markdown:
{
  "aiLevel": "EXTREME" | "HIGH" | "MEDIUM" | "LOW",
  "aiRationale": "1-2 sentence diagnostic of the hidden mechanism",
  "countermeasures": ["direct tip 1", "direct tip 2"]
}`;

const TASK_PROMPT = (prompt: string) => `You are executing a background task for a builder. Complete it fully and return only the finished result — no preamble, no "here is".

TASK:
${prompt}`;

const newConversation = (): FConversation => ({
    id: `c_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    title: 'New session',
    messages: [],
    createdAt: Date.now(),
});

const defaultVault = (): FVault => {
    const c = newConversation();
    return {
        version: 3,
        conversations: [c],
        artifacts: [],
        activeId: c.id,
        preferLocal: false,
        autoTools: false,
        ollamaEndpoint: 'http://localhost:11434',
        ollamaModel: 'llama3.2',
        telegramChatId: '',
    };
};

const loadVault = (): FVault => {
    try {
        const raw = localStorage.getItem(VAULT_KEY);
        if (!raw) return defaultVault();
        const parsed = JSON.parse(raw);
        if (!parsed.conversations || parsed.conversations.length === 0) return defaultVault();
        return { ...defaultVault(), ...parsed, artifacts: parsed.artifacts || [] };
    } catch {
        return defaultVault();
    }
};

interface RouteInfo {
    brain: Brain | null;
    fellBack: boolean;
    latencyMs: number | null;
    chars: number | null;
    note: string;
}

type ToolResult =
    | { tool: 'compress'; inChars: number; outChars: number; ratioPct: number; text: string; ts: number }
    | { tool: 'scan'; level: string; score: string; hits: { name: string; context: string }[]; rationale: string; countermeasures: string[]; ts: number }
    | { tool: 'vault'; action: 'saved' | 'search'; entries: VaultArtifact[]; query?: string; ts: number }
    | { tool: 'telegram'; ok: boolean; detail: string; text: string; ts: number }
    | { tool: 'task'; prompt: string; result: string; brain: Brain; elapsedS: number; ts: number };

export const FusionApp: React.FC = () => {
    const [vault, setVault] = useState<FVault>(loadVault);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<'idle' | 'routing' | 'thinking'>('idle');
    const [route, setRoute] = useState<RouteInfo>({ brain: null, fellBack: false, latencyMs: null, chars: null, note: 'Awaiting first transmission.' });
    const [toolBusy, setToolBusy] = useState<string | null>(null);
    const [toolResult, setToolResult] = useState<ToolResult | null>(null);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [showSettings, setShowSettings] = useState(false);

    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        try { localStorage.setItem(VAULT_KEY, JSON.stringify(vault)); }
        catch (e) { console.warn('Fusion vault save failed:', e); }
    }, [vault]);

    const active = vault.conversations.find(c => c.id === vault.activeId) || vault.conversations[0];

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [active?.messages.length, busy, toolBusy]);

    // --- vault mutations -----------------------------------------------------
    const patchConv = useCallback((convId: string, mut: (c: FConversation) => FConversation) => {
        setVault(v => ({ ...v, conversations: v.conversations.map(c => (c.id === convId ? mut(c) : c)) }));
    }, []);

    const pushMsgTo = useCallback((convId: string, m: FMessage) => {
        patchConv(convId, c => ({
            ...c,
            title: c.messages.length === 0 && m.role === 'user' ? m.content.slice(0, 42) : c.title,
            messages: [...c.messages, m],
        }));
    }, [patchConv]);

    const pushMsg = useCallback((m: FMessage) => {
        if (active) pushMsgTo(active.id, m);
    }, [active, pushMsgTo]);

    const createSession = () => {
        const c = newConversation();
        setVault(v => ({ ...v, conversations: [c, ...v.conversations], activeId: c.id }));
        setRoute(r => ({ ...r, note: 'New session opened.' }));
    };
    const selectSession = (id: string) => setVault(v => ({ ...v, activeId: id }));
    const deleteSession = (id: string) => {
        setVault(v => {
            const remaining = v.conversations.filter(c => c.id !== id);
            if (remaining.length === 0) {
                const c = newConversation();
                return { ...v, conversations: [c], activeId: c.id };
            }
            return { ...v, conversations: remaining, activeId: v.activeId === id ? remaining[0].id : v.activeId };
        });
    };
    const setPreferLocal = (preferLocal: boolean) => setVault(v => ({ ...v, preferLocal }));
    const toggleAuto = () => setVault(v => ({ ...v, autoTools: !v.autoTools }));
    const addArtifact = (a: VaultArtifact) => setVault(v => ({ ...v, artifacts: [a, ...v.artifacts].slice(0, 200) }));

    // --- model calls ---------------------------------------------------------
    const historyToContents = (history: FMessage[]) =>
        `${SYSTEM_PROMPT}\n\n` + history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + `\nAssistant:`;

    const callCloud = async (history: FMessage[]): Promise<string> => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: historyToContents(history), config: { temperature: 0.7 } });
        const text = (response.text || '').trim();
        if (!text) throw new Error('Empty cloud response');
        return text;
    };
    const callLocal = async (history: FMessage[]): Promise<string> => {
        const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history.map(m => ({ role: m.role, content: m.content }))];
        const res = await fetch('/api/ollama/real', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, customEndpoint: vault.ollamaEndpoint, model: vault.ollamaModel }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.response) throw new Error(data.error || `Local brain unreachable (${res.status})`);
        return String(data.response).trim();
    };

    const askModel = async (prompt: string, temperature = 0.2): Promise<{ text: string; brain: Brain }> => {
        if (vault.preferLocal) {
            try {
                const res = await fetch('/api/ollama/real', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], customEndpoint: vault.ollamaEndpoint, model: vault.ollamaModel, options: { temperature } }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.response) return { text: String(data.response).trim(), brain: 'local' };
            } catch { /* fall through to cloud */ }
        }
        const ai = getAiClient();
        const r = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt, config: { temperature } });
        return { text: (r.text || '').trim(), brain: 'cloud' };
    };

    // --- TOOL EXECUTORS (pure side-effects; return a one-line summary) --------
    const execCompress = async (text: string): Promise<string> => {
        if (!text.trim()) return 'No text was provided to compress.';
        const { text: out } = await askModel(COMPRESS_PROMPT(text), 0.15);
        const inChars = text.length, outChars = out.length;
        const ratioPct = inChars > 0 ? Math.max(0, Math.round(((inChars - outChars) / inChars) * 100)) : 0;
        setToolResult({ tool: 'compress', inChars, outChars, ratioPct, text: out, ts: Date.now() });
        addArtifact({ id: `a_${Date.now()}`, kind: 'compression', title: text.slice(0, 40), content: out, createdAt: Date.now() });
        return `Compressed ${inChars.toLocaleString()} → ${outChars.toLocaleString()} chars (−${ratioPct}%).`;
    };

    const execScan = async (text: string): Promise<string> => {
        if (!text.trim()) return 'No message was provided to scan.';
        const low = text.toLowerCase();
        const hits: { name: string; context: string }[] = [];
        let score = 0;
        SCAM_PATTERNS.forEach(p => {
            const m = p.indicators.filter(i => low.includes(i));
            if (m.length) { hits.push({ name: p.name, context: p.context }); score += m.length * 0.9; }
        });
        let level = score > 5 ? 'EXTREME' : score > 3 ? 'HIGH' : score > 1 ? 'MEDIUM' : 'LOW';
        let rationale = 'On-board pattern matching flagged the vectors above.';
        let countermeasures = ['Do not reply or click any links.', 'Verify the sender through an independent channel.'];
        try {
            const { text: out } = await askModel(SCAN_PROMPT(text), 0.1);
            const jsonMatch = out.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.aiLevel) level = parsed.aiLevel;
                if (parsed.aiRationale) rationale = parsed.aiRationale;
                if (Array.isArray(parsed.countermeasures) && parsed.countermeasures.length) countermeasures = parsed.countermeasures;
            }
        } catch { /* keep local-only result */ }
        const scoreStr = (level === 'EXTREME' ? Math.max(score, 8.5) : level === 'HIGH' ? Math.max(score, 6) : level === 'MEDIUM' ? Math.max(score, 3) : Math.max(score, 0.5)).toFixed(1);
        setToolResult({ tool: 'scan', level, score: scoreStr, hits: hits.length ? hits : [{ name: 'No known pattern matched', context: 'Model judgement only — stay alert.' }], rationale, countermeasures, ts: Date.now() });
        addArtifact({ id: `a_${Date.now()}`, kind: 'scan', title: `Scan: ${text.slice(0, 32)}`, content: `${level} (${scoreStr}/10) — ${rationale}`, createdAt: Date.now() });
        return `Threat level ${level} (${scoreStr}/10). ${rationale}`;
    };

    const execSave = (text: string): string => {
        if (!text.trim()) return 'Nothing to save.';
        const art: VaultArtifact = { id: `a_${Date.now()}`, kind: 'note', title: text.slice(0, 42), content: text, createdAt: Date.now() };
        addArtifact(art);
        setToolResult({ tool: 'vault', action: 'saved', entries: [art], ts: Date.now() });
        return `Saved "${art.title}" to the vault.`;
    };

    const execRecall = (query: string): string => {
        const q = query.trim().toLowerCase();
        const entries = q ? vault.artifacts.filter(a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)) : vault.artifacts.slice(0, 10);
        setToolResult({ tool: 'vault', action: 'search', entries, query, ts: Date.now() });
        return entries.length ? `Found ${entries.length} vault ${entries.length === 1 ? 'entry' : 'entries'}.` : `No vault entries match "${query}".`;
    };

    const execTelegram = async (text: string): Promise<string> => {
        if (!text.trim()) return 'No message text to send.';
        if (!vault.telegramChatId.trim()) { setShowSettings(true); return 'No Telegram chat ID is configured — Settings opened for the user to add it.'; }
        try {
            const res = await fetch('/api/telegram/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: vault.telegramChatId, text }),
            });
            const data = await res.json().catch(() => ({}));
            const ok = res.ok && data.ok !== false && !data.error;
            const detail = ok ? 'Delivered' : (data.description || data.error || `HTTP ${res.status}`);
            setToolResult({ tool: 'telegram', ok, detail, text, ts: Date.now() });
            if (ok) addArtifact({ id: `a_${Date.now()}`, kind: 'telegram', title: `Telegram: ${text.slice(0, 32)}`, content: text, createdAt: Date.now() });
            return ok ? 'Message delivered to Telegram.' : `Telegram send failed: ${detail}.`;
        } catch (err: any) {
            setToolResult({ tool: 'telegram', ok: false, detail: err?.message || 'network error', text, ts: Date.now() });
            return `Telegram send failed: ${err?.message || 'network error'}.`;
        }
    };

    const execTask = (prompt: string, convId: string): string => {
        if (!prompt.trim()) return 'No task instruction provided.';
        const id = `t_${Date.now()}_${Math.floor(Math.random() * 999)}`;
        const startTs = Date.now();
        setTasks(prev => [{ id, prompt, status: 'running' as const, startTs }, ...prev].slice(0, 20));
        askModel(TASK_PROMPT(prompt), 0.5)
            .then(({ text: out, brain }) => {
                const endTs = Date.now();
                const elapsedS = Math.max(0, Math.round((endTs - startTs) / 1000));
                setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done', endTs, brain } : t));
                addArtifact({ id: `a_${Date.now()}`, kind: 'task', title: `Task: ${prompt.slice(0, 34)}`, content: out, createdAt: Date.now() });
                setToolResult({ tool: 'task', prompt, result: out, brain, elapsedS, ts: Date.now() });
                pushMsgTo(convId, { role: 'assistant', content: `✅ Task #${id.slice(-4)} complete (${elapsedS}s · ${brain}):\n\n${out}`, tool: 'run_task', ts: Date.now() });
            })
            .catch((err: any) => {
                setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'failed', endTs: Date.now(), error: String(err?.message || err) } : t));
                pushMsgTo(convId, { role: 'assistant', content: `⚠️ Task #${id.slice(-4)} failed: ${err?.message || 'unknown error'}.`, error: true, tool: 'run_task', ts: Date.now() });
            });
        return `Task #${id.slice(-4)} dispatched to the background.`;
    };

    const dispatchExec = async (name: string, args: any, convId: string): Promise<string> => {
        switch (name) {
            case 'compress': return await execCompress(String(args?.text || ''));
            case 'scan_threat': return await execScan(String(args?.text || ''));
            case 'save_to_vault': return execSave(String(args?.text || ''));
            case 'recall': return execRecall(String(args?.query || ''));
            case 'send_telegram': return await execTelegram(String(args?.text || ''));
            case 'run_task': return execTask(String(args?.prompt || ''), convId);
            default: return `Unknown tool: ${name}`;
        }
    };

    // --- chip / slash tool wrappers (explicit invocation) --------------------
    const runChipTool = async (tool: string, text: string, busyKey: string) => {
        if (busy || toolBusy) return;
        const convId = active?.id || '';
        pushMsg({ role: 'user', content: text || '(all recent)', tool: busyKey, ts: Date.now() });
        // run_task is fire-and-forget; others show the busy state
        if (tool === 'run_task') {
            const summary = execTask(text, convId);
            pushMsg({ role: 'assistant', content: `${summary} Keep working — I'll drop the result here when it lands.`, tool: busyKey, ts: Date.now() });
            return;
        }
        setToolBusy(busyKey);
        try {
            const summary = await dispatchExec(tool, tool === 'recall' ? { query: text } : tool === 'run_task' ? { prompt: text } : { text }, convId);
            pushMsg({ role: 'assistant', content: `${summary} Result in the canvas →`, tool: busyKey, ts: Date.now() });
        } catch (err: any) {
            pushMsg({ role: 'assistant', content: `⚠️ ${tool} failed: ${err?.message || 'unknown error'}.`, error: true, tool: busyKey, ts: Date.now() });
        } finally { setToolBusy(null); }
    };

    const CHIP_MAP: Record<string, { tool: string; busyKey: string }> = {
        compress: { tool: 'compress', busyKey: 'compress' },
        scan: { tool: 'scan_threat', busyKey: 'scan_threat' },
        save: { tool: 'save_to_vault', busyKey: 'save_to_vault' },
        recall: { tool: 'recall', busyKey: 'recall' },
        telegram: { tool: 'send_telegram', busyKey: 'send_telegram' },
        task: { tool: 'run_task', busyKey: 'run_task' },
    };

    const runToolFromInput = (chip: string) => {
        const text = input.trim();
        if (!text && chip !== 'recall') { setRoute(r => ({ ...r, note: 'Type text in the box first, then pick a tool.' })); return; }
        setInput('');
        const m = CHIP_MAP[chip];
        runChipTool(m.tool, text, m.busyKey);
    };

    // --- autonomous cloud turn (Phase 4) -------------------------------------
    const sendAuto = async (history: FMessage[], convId: string) => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: historyToContents(history), config: { temperature: 0.7, tools: FUSION_TOOLS } });
        const calls: any[] = response.functionCalls || [];

        if (calls.length) {
            const results: string[] = [];
            for (const fc of calls) {
                pushMsgTo(convId, { role: 'assistant', content: `Reaching for ${fc.name}…`, tool: fc.name, ts: Date.now() });
                const summary = await dispatchExec(fc.name, fc.args || {}, convId);
                results.push(`${fc.name}: ${summary}`);
            }
            // brief natural-language wrap-up that references what the tools found
            let finalText = '';
            try {
                const followContents = `${SYSTEM_PROMPT}\n\n${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\n\n[You autonomously invoked tools. Results:]\n${results.join('\n')}\n\nGive the user a brief, warm final answer referencing what happened. Do not repeat raw tool output verbatim.`;
                const f = await ai.models.generateContent({ model: MODEL_NAME, contents: followContents, config: { temperature: 0.7 } });
                finalText = (f.text || '').trim();
            } catch { /* summaries already posted */ }
            if (finalText) pushMsgTo(convId, { role: 'assistant', content: finalText, brain: 'cloud', ts: Date.now() });
            setRoute({ brain: 'cloud', fellBack: false, latencyMs: null, chars: finalText.length || null, note: `Auto: invoked ${calls.length} tool${calls.length > 1 ? 's' : ''}.` });
            return;
        }

        const text = (response.text || '').trim() || 'No response.';
        pushMsgTo(convId, { role: 'assistant', content: text, brain: 'cloud', ts: Date.now() });
        setRoute({ brain: 'cloud', fellBack: false, latencyMs: null, chars: text.length, note: 'Auto: answered directly (no tool needed).' });
    };

    // --- chat send -----------------------------------------------------------
    const send = async () => {
        const raw = input.trim();
        if (!raw || busy || toolBusy) return;

        const slash = raw.match(/^\/(compress|scan|save|recall|telegram|task)\s*([\s\S]*)$/i);
        if (slash) {
            const cmd = slash[1].toLowerCase();
            const arg = slash[2].trim();
            if (cmd !== 'recall' && !arg) { setRoute(r => ({ ...r, note: `/${cmd} needs text after it.` })); return; }
            setInput('');
            const m = CHIP_MAP[cmd];
            runChipTool(m.tool, arg, m.busyKey);
            return;
        }

        const userMsg: FMessage = { role: 'user', content: raw, ts: Date.now() };
        const convId = active?.id || '';
        const historyForModel = [...(active?.messages || []), userMsg];
        pushMsg(userMsg);
        setInput('');
        setBusy(true);
        setStatus('thinking');
        const useAuto = vault.autoTools && !vault.preferLocal;
        setRoute(r => ({ ...r, note: useAuto ? 'Auto: deciding whether to use a tool…' : vault.preferLocal ? 'Reaching for local brain…' : 'Routing to cloud…' }));

        const t0 = performance.now();
        try {
            if (useAuto) {
                await sendAuto(historyForModel, convId);
            } else {
                let replyText = '', brain: Brain = 'cloud', fellBack = false;
                if (vault.preferLocal) {
                    try { replyText = await callLocal(historyForModel); brain = 'local'; }
                    catch { fellBack = true; setRoute(r => ({ ...r, note: 'Local unavailable → falling back to cloud.' })); replyText = await callCloud(historyForModel); brain = 'cloud'; }
                } else { replyText = await callCloud(historyForModel); brain = 'cloud'; }
                pushMsgTo(convId, { role: 'assistant', content: replyText, brain, fellBack, ts: Date.now() });
                setRoute({ brain, fellBack, latencyMs: null, chars: replyText.length, note: fellBack ? 'Answered by cloud after local fallback.' : brain === 'local' ? 'Answered by local hardware.' : 'Answered by cloud.' });
            }
        } catch (err: any) {
            pushMsgTo(convId, { role: 'assistant', content: `⚠️ Both brains are unreachable right now. ${err?.message || 'Unknown routing error.'}\n\nCheck that the dev server is running, and that GEMINI_API_KEY (cloud) or OLLAMA_ENDPOINT (local) is configured.`, error: true, ts: Date.now() });
            setRoute({ brain: null, fellBack: false, latencyMs: null, chars: null, note: 'Routing failed — no brain answered.' });
        } finally {
            setBusy(false); setStatus('idle');
            const latencyMs = Math.round(performance.now() - t0);
            setRoute(r => ({ ...r, latencyMs }));
        }
    };

    const statusColor = status === 'idle' ? 'text-emerald-400' : 'text-amber-400';
    const statusLabel = status === 'idle' ? 'Idle' : status === 'routing' ? 'Routing' : 'Thinking';
    const runningTasks = tasks.filter(t => t.status === 'running').length;
    const autoActive = vault.autoTools && !vault.preferLocal;

    const TOOL_CHIPS: { key: string; label: string; icon: React.ReactNode; busyKey: string }[] = [
        { key: 'compress', label: 'Compress', icon: <Scissors size={12} />, busyKey: 'compress' },
        { key: 'scan', label: 'Scan', icon: <Shield size={12} />, busyKey: 'scan_threat' },
        { key: 'save', label: 'Save', icon: <Save size={12} />, busyKey: 'save_to_vault' },
        { key: 'recall', label: 'Recall', icon: <Search size={12} />, busyKey: 'recall' },
        { key: 'telegram', label: 'Telegram', icon: <Send size={12} />, busyKey: 'send_telegram' },
        { key: 'task', label: 'Run', icon: <Rocket size={12} />, busyKey: 'run_task' },
    ];

    return (
        <div className="relative h-full w-full flex flex-col bg-[#0a0e14] text-[#c9d1dc] font-sans select-none overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#232c3a] bg-[#0c1119]">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg grid place-items-center bg-gradient-to-br from-teal-500/20 to-teal-900/10 border border-teal-500/40 text-teal-300"><Cpu size={16} /></div>
                    <div className="leading-tight">
                        <div className="text-[13px] font-bold tracking-wide text-white">FUSION</div>
                        <div className="text-[9px] font-mono tracking-[0.22em] uppercase text-[#74808f]">One Brain · Many Hands</div>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <button onClick={toggleAuto} title={vault.preferLocal ? 'Autonomous tool use runs on the cloud route' : 'Let the AI decide when to use a tool'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition ${autoActive ? 'bg-teal-500/15 border-teal-500/50 text-teal-200' : vault.autoTools ? 'bg-[#0a0e14] border-[#232c3a] text-[#74808f]' : 'bg-[#0a0e14] border-[#232c3a] text-[#74808f] hover:text-[#c9d1dc]'}`}>
                        <Sparkles size={12} className={autoActive ? 'text-teal-300' : ''} /> Auto {vault.autoTools ? 'on' : 'off'}
                    </button>
                    <div className="flex items-center rounded-lg border border-[#232c3a] bg-[#0a0e14] p-0.5 text-[11px] font-mono">
                        <button onClick={() => setPreferLocal(true)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${vault.preferLocal ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'text-[#74808f] border border-transparent hover:text-[#c9d1dc]'}`} title="Prefer local hardware (Ollama), fall back to cloud"><HardDrive size={12} /> Local</button>
                        <button onClick={() => setPreferLocal(false)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${!vault.preferLocal ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40' : 'text-[#74808f] border border-transparent hover:text-[#c9d1dc]'}`} title="Use cloud (Gemini)"><Cloud size={12} /> Cloud</button>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <Circle size={8} className={`${statusColor} fill-current ${status !== 'idle' ? 'animate-pulse' : ''}`} />
                        <span className={statusColor}>{statusLabel}</span>
                    </div>
                    <button onClick={() => setShowSettings(s => !s)} className={`w-7 h-7 grid place-items-center rounded-md border transition ${showSettings ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'border-[#232c3a] text-[#74808f] hover:text-[#c9d1dc]'}`} title="Settings"><Settings size={14} /></button>
                </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
                <div className="absolute right-3 top-14 z-30 w-72 rounded-xl border border-[#232c3a] bg-[#0c1119] shadow-2xl shadow-black/60 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300">Settings</span>
                        <button onClick={() => setShowSettings(false)} className="text-[#74808f] hover:text-white"><X size={14} /></button>
                    </div>
                    <SettingField label="Local · Ollama endpoint" value={vault.ollamaEndpoint} placeholder="http://localhost:11434" onChange={val => setVault(v => ({ ...v, ollamaEndpoint: val }))} />
                    <SettingField label="Local · model" value={vault.ollamaModel} placeholder="llama3.2" onChange={val => setVault(v => ({ ...v, ollamaModel: val }))} />
                    <SettingField label="Telegram chat ID" value={vault.telegramChatId} placeholder="e.g. 123456789" onChange={val => setVault(v => ({ ...v, telegramChatId: val }))} />
                    <p className="text-[9px] text-[#4a5566] leading-snug">Bot token is server-side (TELEGRAM_BOT_TOKEN). Auto-invoke uses the cloud route. Saved to your local vault instantly.</p>
                </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr_246px] max-[720px]:grid-cols-1 max-[720px]:overflow-y-auto">
                {/* ZONE 1 — MEMORY */}
                <aside className="min-h-0 flex flex-col border-r border-[#232c3a] bg-[#0b0f16] max-[720px]:border-r-0 max-[720px]:border-b">
                    <div className="flex items-center justify-between px-3 py-2 shrink-0">
                        <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#74808f]">Memory</span>
                        <button onClick={createSession} className="w-6 h-6 grid place-items-center rounded-md border border-[#232c3a] text-teal-300 hover:bg-teal-500/10 hover:border-teal-500/40 transition" title="New session"><Plus size={13} /></button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1 max-[720px]:max-h-40">
                        {vault.conversations.map(c => {
                            const isActive = c.id === vault.activeId;
                            return (
                                <div key={c.id} onClick={() => selectSession(c.id)} className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer border transition ${isActive ? 'bg-teal-500/10 border-teal-500/40 text-white' : 'border-transparent text-[#9aa6b4] hover:bg-[#131a24] hover:border-[#232c3a]'}`}>
                                    <MessageSquare size={12} className={isActive ? 'text-teal-300' : 'text-[#4a5566]'} />
                                    <span className="flex-1 truncate text-[12px]">{c.title || 'New session'}</span>
                                    <button onClick={(e) => { e.stopPropagation(); deleteSession(c.id); }} className="opacity-0 group-hover:opacity-100 text-[#4a5566] hover:text-rose-400 transition" title="Delete session"><Trash2 size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                    <div className="shrink-0 px-3 py-2 border-t border-[#232c3a] flex items-center gap-1.5 text-[9px] font-mono text-[#4a5566]">
                        <Archive size={10} /> {vault.artifacts.length} vault · {vault.conversations.length} session{vault.conversations.length === 1 ? '' : 's'}
                    </div>
                </aside>

                {/* ZONE 2 — CONVERSATION */}
                <section className="min-h-0 flex flex-col bg-[#0a0e14] max-[720px]:min-h-[60vh]">
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                        {(!active || active.messages.length === 0) && (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6">
                                <div className="w-12 h-12 rounded-2xl grid place-items-center bg-teal-500/10 border border-teal-500/30 text-teal-300"><Zap size={22} /></div>
                                <div className="text-[15px] font-semibold text-white">Talk to the machine.</div>
                                <p className="text-[12px] text-[#74808f] max-w-xs leading-relaxed">One mind for the whole OS. Ask anything, reach for a hand below, or flip <span className="text-teal-300">Auto on</span> to let the machine choose its own tools. Results land in the canvas.</p>
                            </div>
                        )}

                        {active?.messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed border ${m.role === 'user' ? 'bg-teal-500/10 border-teal-500/30 text-teal-50' : m.error ? 'bg-rose-950/30 border-rose-800/50 text-rose-200' : 'bg-[#111721] border-[#232c3a] text-[#c9d1dc]'}`}>
                                    {m.tool && (
                                        <div className="flex items-center gap-1.5 mb-1 text-[9px] font-mono uppercase tracking-wider text-teal-400/80"><Wrench size={9} /> {m.tool}</div>
                                    )}
                                    {m.role === 'assistant' && !m.error && !m.tool && (
                                        <div className="flex items-center gap-1.5 mb-1 text-[9px] font-mono uppercase tracking-wider text-[#74808f]">
                                            {m.brain === 'local' ? <HardDrive size={9} className="text-emerald-400" /> : <Cloud size={9} className="text-amber-400" />}
                                            <span>{m.brain === 'local' ? 'Local' : 'Cloud'}</span>
                                            {m.fellBack && <span className="text-amber-500/80">· fallback</span>}
                                        </div>
                                    )}
                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                </div>
                            </div>
                        ))}

                        {(busy || toolBusy) && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl px-4 py-2.5 bg-[#111721] border border-[#232c3a] text-[12px] text-teal-300 flex items-center gap-2">
                                    <Loader2 size={13} className="animate-spin" />
                                    <span className="font-mono">{toolBusy ? `Running ${toolBusy}…` : route.note}</span>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* tool chips */}
                    <div className="shrink-0 px-3 pt-2 flex flex-wrap gap-1.5 border-t border-[#232c3a] bg-[#0c1119]">
                        {TOOL_CHIPS.map(t => (
                            <button key={t.key} onClick={() => runToolFromInput(t.key)} disabled={!!toolBusy || busy}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition disabled:opacity-40 ${toolBusy === t.busyKey ? 'bg-teal-500/20 border-teal-500/50 text-teal-200' : 'bg-[#0a0e14] border-[#232c3a] text-[#9aa6b4] hover:border-teal-500/40 hover:text-teal-300'}`}
                                title={`Run ${t.key} on the text in the box`}>
                                {toolBusy === t.busyKey ? <Loader2 size={12} className="animate-spin" /> : t.icon}{t.label}
                            </button>
                        ))}
                    </div>

                    {/* input */}
                    <div className="shrink-0 p-3 pt-2 flex items-end gap-2 bg-[#0c1119]">
                        <textarea value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            rows={1} placeholder={autoActive ? 'Ask the machine — it will pick its own tools…' : 'Ask the machine…  or /compress /scan /save /recall /telegram /task'}
                            disabled={busy}
                            className="flex-1 resize-none bg-[#0a0e14] border border-[#232c3a] focus:border-teal-500/50 rounded-xl px-3.5 py-2.5 text-[13px] text-[#e6ebf1] placeholder-[#4a5566] outline-none transition-colors max-h-32" />
                        <button onClick={send} disabled={busy || !!toolBusy || !input.trim()} className="shrink-0 h-[42px] w-[42px] grid place-items-center rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-[#1a2129] disabled:text-[#4a5566] text-[#04231f] transition" title="Send">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </section>

                {/* ZONE 3 — LIVE CANVAS */}
                <aside className="min-h-0 flex flex-col border-l border-[#232c3a] bg-[#0b0f16] overflow-y-auto max-[720px]:border-l-0 max-[720px]:border-t">
                    <div className="px-3 py-2 shrink-0"><span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#74808f]">Live Canvas</span></div>
                    <div className="px-3 pb-3 space-y-3">
                        {toolResult && <ToolResultCard result={toolResult} />}

                        {tasks.length > 0 && (
                            <div className="rounded-xl border border-[#232c3a] bg-[#0a0e14] p-3">
                                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-[#74808f] mb-2">
                                    <Rocket size={11} className="text-teal-300" /> Task queue
                                    {runningTasks > 0 && <span className="ml-auto text-[8px] text-amber-400">{runningTasks} running</span>}
                                </div>
                                <div className="space-y-1.5">
                                    {tasks.slice(0, 6).map(t => {
                                        const color = t.status === 'running' ? '#f0b429' : t.status === 'done' ? '#4ade80' : '#f0596a';
                                        const elapsed = t.endTs ? `${Math.max(0, Math.round((t.endTs - t.startTs) / 1000))}s` : 'running…';
                                        return (
                                            <div key={t.id} className="flex items-center gap-2 text-[10px]">
                                                <Circle size={7} className={`fill-current ${t.status === 'running' ? 'animate-pulse' : ''}`} style={{ color }} />
                                                <span className="flex-1 truncate text-[#c9d1dc]">{t.prompt}</span>
                                                <span className="font-mono text-[9px]" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className={`rounded-xl border p-3 ${vault.preferLocal ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider mb-1.5">
                                {vault.preferLocal ? <HardDrive size={11} className="text-emerald-400" /> : <Cloud size={11} className="text-amber-400" />}
                                <span className={vault.preferLocal ? 'text-emerald-300' : 'text-amber-300'}>{vault.preferLocal ? 'Primary · Local' : 'Primary · Cloud'}</span>
                                {autoActive && <span className="ml-auto flex items-center gap-1 text-teal-300 text-[8px]"><Sparkles size={9} /> auto</span>}
                            </div>
                            <div className="text-[12px] text-white font-medium">{vault.preferLocal ? vault.ollamaModel : MODEL_NAME}</div>
                            <div className="text-[10px] font-mono text-[#74808f] mt-0.5 truncate">{vault.preferLocal ? vault.ollamaEndpoint : '/api/gemini/generate'}</div>
                            {vault.preferLocal && <div className="text-[9px] font-mono text-[#4a5566] mt-1.5 flex items-center gap-1"><RefreshCw size={9} /> auto-fallback → cloud</div>}
                        </div>

                        <div className="rounded-xl border border-[#232c3a] bg-[#0a0e14] p-3">
                            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-[#74808f] mb-2"><Activity size={11} className="text-teal-300" /> Last exchange</div>
                            <div className="space-y-1.5 text-[11px] font-mono">
                                <Telemetry label="Answered by" value={route.brain ? (route.brain === 'local' ? 'Local' : 'Cloud') : '—'} />
                                <Telemetry label="Latency" value={route.latencyMs != null ? `${route.latencyMs} ms` : '—'} />
                                <Telemetry label="Response" value={route.chars != null ? `${route.chars} chars` : '—'} />
                                <Telemetry label="Fallback" value={route.fellBack ? 'yes' : 'no'} valueClass={route.fellBack ? 'text-amber-400' : 'text-[#c9d1dc]'} />
                            </div>
                            <div className="mt-2 pt-2 border-t border-[#1a212d] text-[10px] text-[#74808f] leading-snug">{route.note}</div>
                        </div>

                        <div className="rounded-xl border border-[#232c3a] bg-[#0a0e14] p-3">
                            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-[#74808f] mb-2"><Wrench size={11} className="text-teal-300" /> Tool bus <span className="ml-auto text-[8px] text-emerald-400">● 6 live</span></div>
                            <div className="space-y-1">
                                {[{ n: 'compress', l: 'JackyV3' }, { n: 'scan_threat', l: 'JackyV3' }, { n: 'save_to_vault', l: 'Cybernetic67' }, { n: 'recall', l: 'vault' }, { n: 'send_telegram', l: 'server.ts' }, { n: 'run_task', l: 'SuperSayen' }].map(t => (
                                    <div key={t.n} className="flex items-center gap-2 py-1">
                                        <ChevronRight size={11} className="text-teal-400" />
                                        <span className="text-[11px] font-mono text-[#c9d1dc]">{t.n}</span>
                                        <span className="ml-auto text-[9px] text-[#4a5566]">{t.l}</span>
                                    </div>
                                ))}
                                <div className={`flex items-center gap-2 py-1 ${autoActive ? '' : 'opacity-45'}`}>
                                    <ChevronRight size={11} className={autoActive ? 'text-teal-400' : 'text-[#4a5566]'} />
                                    <span className={`text-[11px] font-mono ${autoActive ? 'text-teal-200' : 'text-[#9aa6b4]'}`}>autonomous invoke</span>
                                    <span className="ml-auto text-[9px]" style={{ color: autoActive ? '#4ade80' : '#4a5566' }}>{autoActive ? '● on' : 'Auto off'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

const ToolResultCard: React.FC<{ result: ToolResult }> = ({ result }) => {
    if (result.tool === 'compress') {
        return (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-teal-300 mb-2"><Scissors size={11} /> Compression · −{result.ratioPct}%</div>
                <div className="text-[9px] font-mono text-[#74808f] mb-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{result.inChars.toLocaleString()} → {result.outChars.toLocaleString()} chars</div>
                <div className="text-[11px] leading-relaxed text-[#c9d1dc] whitespace-pre-wrap max-h-56 overflow-y-auto bg-[#0a0e14] rounded-lg border border-[#1a212d] p-2.5 select-text">{result.text}</div>
            </div>
        );
    }
    if (result.tool === 'scan') {
        const color = LEVEL_COLOR[result.level] || '#f0b429';
        return (
            <div className="rounded-xl border p-3" style={{ borderColor: `${color}55`, background: `${color}0f` }}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider" style={{ color }}><Shield size={11} /> Threat scan</div>
                    <span className="text-[9px] font-mono" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{result.score}/10</span>
                </div>
                <div className="text-lg font-bold mb-1" style={{ color }}>{result.level}</div>
                <div className="text-[11px] text-[#c9d1dc] leading-snug mb-2">{result.rationale}</div>
                <div className="space-y-1 mb-2">
                    {result.hits.map((h, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px]">
                            <AlertTriangle size={10} className="mt-0.5 shrink-0" style={{ color }} />
                            <span className="text-[#9aa6b4]"><b className="text-[#c9d1dc]">{h.name}</b> — {h.context}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t border-[#1a212d] pt-2 space-y-0.5">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#74808f] mb-1">Countermeasures</div>
                    {result.countermeasures.map((c, i) => (<div key={i} className="text-[10px] text-[#c9d1dc]">• {c}</div>))}
                </div>
            </div>
        );
    }
    if (result.tool === 'telegram') {
        const color = result.ok ? '#4ade80' : '#f0596a';
        return (
            <div className="rounded-xl border p-3" style={{ borderColor: `${color}55`, background: `${color}0f` }}>
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color }}><Send size={11} /> Telegram · {result.ok ? 'sent' : 'failed'}</div>
                <div className="text-[11px] text-[#c9d1dc] leading-snug bg-[#0a0e14] rounded-lg border border-[#1a212d] p-2 mb-1.5 select-text whitespace-pre-wrap">{result.text}</div>
                <div className="text-[10px] font-mono" style={{ color }}>{result.detail}</div>
            </div>
        );
    }
    if (result.tool === 'task') {
        return (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-teal-300"><Rocket size={11} /> Task complete</div>
                    <span className="text-[9px] font-mono text-[#74808f]" style={{ fontVariantNumeric: 'tabular-nums' }}>{result.elapsedS}s · {result.brain}</span>
                </div>
                <div className="text-[10px] text-[#74808f] mb-1.5 italic">{result.prompt}</div>
                <div className="text-[11px] leading-relaxed text-[#c9d1dc] whitespace-pre-wrap max-h-56 overflow-y-auto bg-[#0a0e14] rounded-lg border border-[#1a212d] p-2.5 select-text">{result.result}</div>
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-teal-300 mb-2">
                <Archive size={11} /> {result.action === 'saved' ? 'Saved to vault' : `Recall${result.query ? `: “${result.query}”` : ''}`} · {result.entries.length}
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {result.entries.length === 0 && <div className="text-[10px] text-[#74808f]">No matching vault entries.</div>}
                {result.entries.map(a => (
                    <div key={a.id} className="bg-[#0a0e14] rounded-lg border border-[#1a212d] p-2 select-text">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[8px] font-mono uppercase px-1 py-0.5 rounded border border-[#232c3a] text-[#74808f]">{a.kind}</span>
                            <span className="text-[11px] text-[#c9d1dc] font-medium truncate">{a.title}</span>
                        </div>
                        <div className="text-[10px] text-[#74808f] leading-snug line-clamp-3 whitespace-pre-wrap">{a.content.slice(0, 220)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingField: React.FC<{ label: string; value: string; placeholder: string; onChange: (v: string) => void }> = ({ label, value, placeholder, onChange }) => (
    <label className="block space-y-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[#74808f]">{label}</span>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-[#0a0e14] border border-[#232c3a] focus:border-teal-500/50 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-[#e6ebf1] placeholder-[#4a5566] outline-none transition-colors" />
    </label>
);

const Telemetry: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="flex items-center justify-between">
        <span className="text-[#74808f]">{label}</span>
        <span className={valueClass || 'text-[#c9d1dc]'} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
);
