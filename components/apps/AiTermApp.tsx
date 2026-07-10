import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ToggleLeft, ToggleRight, Laptop, Smartphone, HelpCircle, RefreshCw } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

// Real home-directory filesystem client. Files really live on this
// container's disk (server-side, under data/aiterm-fs) — nothing here is
// simulated. Access is gated by a real on/off switch you control (the
// "Real FS Access" toggle in the header) plus a shared client token, so
// only this terminal and Jackie's mini-PC integration (when Jackie's
// global mode is on) can reach it.
const TERM_FS_TOKEN = 'jackie-term-fs-v1';
const termFsHeaders = { 'Content-Type': 'application/json', 'x-term-fs-token': TERM_FS_TOKEN };

const termFsList = async (relPath: string) => {
    const resp = await fetch(`/api/term-fs/list?path=${encodeURIComponent(relPath)}`, { headers: termFsHeaders });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'list failed');
    return data.entries as { name: string; isDir: boolean; size: number }[];
};
const termFsRead = async (relPath: string) => {
    const resp = await fetch(`/api/term-fs/read?path=${encodeURIComponent(relPath)}`, { headers: termFsHeaders });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'read failed');
    return data.content as string;
};
const termFsWrite = async (relPath: string, content?: string, mkdir?: boolean) => {
    const resp = await fetch('/api/term-fs/write', { method: 'POST', headers: termFsHeaders, body: JSON.stringify({ path: relPath, content, mkdir }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'write failed');
};
const termFsRm = async (relPath: string) => {
    const resp = await fetch('/api/term-fs/rm', { method: 'POST', headers: termFsHeaders, body: JSON.stringify({ path: relPath }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'rm failed');
};
const termFsStat = async (relPath: string): Promise<'dir' | 'file' | null> => {
    if (relPath === '' || relPath === '.') return 'dir';
    try {
        await termFsList(relPath);
        return 'dir';
    } catch {
        try {
            await termFsRead(relPath);
            return 'file';
        } catch {
            return null;
        }
    }
};

const cmdList = [
    'ls', 'pwd', 'cd', 'cat', 'echo', 'mkdir', 'touch', 'rm', 'clear', 'uname', 'whoami', 'date', 'ps',
    'top', 'neofetch', 'git', 'docker', 'kubectl', 'python3', 'node', 'curl',
    'ping', 'ifconfig', 'history', 'help', 'kill', 'df',
    // Real, app-aware system commands (operate on live browser/device state)
    'apps', 'open', 'launch', 'start', 'engage', 'run', 'sync', 'storage',
    'mem', 'free', 'net', 'wifi'
];

// Hardcoded program registry for the mini-PC shell. `open <name>` and the AI
// intent router resolve against these to launch real apps via the same
// 'launch-app' event the desktop uses.
interface PcApp { cmd: string; appId: string; name: string; aliases: string[]; }
const PC_APPS: PcApp[] = [
    { cmd: 'notepad', appId: 'notepad', name: 'Notepad', aliases: ['note', 'notes', 'notepad', 'text', 'editor'] },
    { cmd: 'mail', appId: 'mail', name: 'Mail', aliases: ['mail', 'email', 'inbox'] },
    { cmd: 'termstudio', appId: 'termstudio', name: 'TermStudio', aliases: ['termstudio', 'term studio'] },
    { cmd: 'flipper', appId: 'flipper', name: 'Flipper Zero', aliases: ['flipper', 'flipper zero'] },
    { cmd: 'chess', appId: 'chess', name: 'Zenith Chess', aliases: ['chess'] },
    { cmd: 'snake', appId: 'snake', name: 'Snake', aliases: ['snake', 'game'] },
    { cmd: 'ollama', appId: 'ollama', name: 'Local AI (Ollama)', aliases: ['ollama', 'local ai'] },
    { cmd: 'pods', appId: 'data_pods', name: 'Data Pods Vault', aliases: ['pods', 'vault', 'data pods'] },
    { cmd: 'github', appId: 'github_sync', name: 'GitHub Sync', aliases: ['github', 'git sync', 'repo'] },
    { cmd: 'compressor', appId: 'knowledge_compressor', name: 'Knowledge Condenser', aliases: ['compress', 'compressor', 'condenser', 'condense'] },
    { cmd: 'cyber', appId: 'cyber_rulebook', name: 'Cyber Codex', aliases: ['cyber', 'codex', 'security', 'rulebook'] },
    { cmd: 'export', appId: 'cybernetic_export', name: 'Export OS', aliases: ['export', 'backup os'] },
    { cmd: 'llm', appId: 'llm_environment', name: 'LLM Studio', aliases: ['llm', 'llm studio', 'model studio'] },
    { cmd: 'atlas', appId: 'fleet_atlas', name: 'Fleet Atlas', aliases: ['atlas', 'fleet', 'globe', 'network map'] },
];

const fmtBytes = (bytes: number): string => {
    if (!bytes || bytes < 1) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
};

const resolveApp = (text: string): PcApp | undefined => {
    const q = text.toLowerCase().trim();
    if (!q) return undefined;
    return PC_APPS.find(a => a.cmd === q || a.aliases.some(x => q.includes(x)));
};

// The entire "brain" of the low-footprint copilot: a deterministic, offline
// intent router that knows only this machine's actions. Returns a real shell
// command string, or null to fall back to the cloud translator.
const resolveLocalIntent = (query: string): string | null => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    if (/^(sync|back ?up|push)\b/.test(q) || /(sync|backup).*(cloud|vault|now)/.test(q)) return 'sync';
    if (/(cloud|connect).*(sign|login|account|auth)/.test(q) || /connect.*cloud/.test(q)) return 'sync';
    if (/(storage|disk|space|footprint|vault size|how much.*(used|stored|space))/.test(q)) return 'storage';
    if (/(wi-?fi|network|online|offline|internet|connection|signal)/.test(q)) return 'net';
    if (/(memory|ram|heap)/.test(q)) return 'mem';
    if (/^(clear|reset)\b/.test(q)) return 'clear';
    const m = q.match(/(?:open|launch|start|engage|run|go to|show|bring up)\s+(.+)/);
    if (m) { const hit = resolveApp(m[1]); if (hit) return `open ${hit.cmd}`; }
    const bare = resolveApp(q);
    if (bare) return `open ${bare.cmd}`;
    return null;
};

interface LogLine {
    id: string;
    html?: string;
    text?: string;
    type: 'input' | 'out' | 'err' | 'ai' | 'welcome' | 'info';
    prompt?: string;
    rawCmd?: string;
}

export const AiTermApp: React.FC = () => {
    const [cwd, setCwd] = useState('/home/expert');
    const [aiEnabled, setAiEnabled] = useState(true);
    const [deviceMode, setDeviceMode] = useState<'phone' | 'fullscreen'>('phone');
    const [history, setHistory] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ai-term-history');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [histIdx, setHistIdx] = useState(0);
    const [termInput, setTermInput] = useState('');
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [battery, setBattery] = useState('87%');
    const [currentTime, setCurrentTime] = useState('9:41');
    const [isThinking, setIsThinking] = useState(false);

    const outputRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update battery and time dynamically
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const interval = setInterval(updateTime, 30000);

        // Real battery reading via the Battery Status API where supported.
        const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; addEventListener: (e: string, cb: () => void) => void }> };
        if (nav.getBattery) {
            nav.getBattery().then(bat => {
                const update = () => setBattery(`${Math.round(bat.level * 100)}%`);
                update();
                bat.addEventListener('levelchange', update);
            }).catch(() => setBattery('n/a'));
        } else {
            setBattery('n/a');
        }

        return () => clearInterval(interval);
    }, []);

    // Setup welcome messages
    useEffect(() => {
        setLogs([
            {
                id: 'welcome-logo',
                type: 'welcome',
                text: `ai-term v1.2.0 — expert mode\n■ kernel 6.5.0-ai • arm64 • secure enclave\n■ AI copilot active • local history\n\nType help for commands.\nTry: ai: show me hidden files`
            }
        ]);
    }, []);

    // Scroll to bottom on log updates
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [logs, isThinking]);

    // Save history
    useEffect(() => {
        try {
            localStorage.setItem('ai-term-history', JSON.stringify(history));
        } catch {}
        setHistIdx(history.length);
    }, [history]);

    const [fsAccessEnabled, setFsAccessEnabled] = useState(true);

    // Load the real access-control switch from the server on mount.
    useEffect(() => {
        fetch('/api/term-fs/access', { headers: termFsHeaders }).then(r => r.json()).then(d => setFsAccessEnabled(!!d.enabled)).catch(() => {});
    }, []);

    const toggleFsAccess = async () => {
        const next = !fsAccessEnabled;
        try {
            const resp = await fetch('/api/term-fs/access', { method: 'POST', headers: termFsHeaders, body: JSON.stringify({ enabled: next }) });
            const data = await resp.json();
            setFsAccessEnabled(!!data.enabled);
            addLine(`Real filesystem access turned ${data.enabled ? 'ON' : 'OFF'}.`, 'info');
        } catch (e: any) {
            addLine(`Failed to toggle filesystem access: ${e.message}`, 'err');
        }
    };

    // Virtual "/home/expert" is the display root; strip it to get the real
    // relative path on disk under the sandboxed server-side fs root.
    const toRel = (p: string) => p.replace(/^\/home\/expert\/?/, '');

    const normalizePath = (p: string) => {
        const out: string[] = [];
        p.split('/').forEach(s => {
            if (!s || s === '.') return;
            if (s === '..') out.pop();
            else out.push(s);
        });
        return '/' + out.join('');
    };

    const resolvePath = (p: string) => {
        if (!p || p === '~') return '/home/expert';
        if (p.startsWith('~')) return normalizePath('/home/expert/' + p.slice(1));
        if (p.startsWith('/')) return normalizePath(p);
        return normalizePath(cwd + '/' + p);
    };

    const isKnown = (line: string) => {
        const t = line.trim().split(/\s+/)[0];
        return cmdList.includes(t) || ['git', 'docker', 'kubectl'].includes(t);
    };

    const addLine = (text: string, type: 'input' | 'out' | 'err' | 'ai' | 'welcome' | 'info' = 'out', html?: string) => {
        const id = Math.random().toString(36).substring(7);
        setLogs(prev => [...prev, { id, text, type, html }]);
    };

    const parseArgs = (line: string): string[] => {
        const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
        const out: string[] = [];
        let m;
        while ((m = re.exec(line)) !== null) {
            out.push(m[1] || m[2] || m[0]);
        }
        return out;
    };

    const translateLocalFallback = (q: string): string | null => {
        const s = q.toLowerCase();
        if ((s.includes('hidden') || s.includes('dot')) && s.includes('file')) return 'ls -la';
        if (s.includes('my ip') || (s.includes('what') && s.includes('ip')) || s.includes('public ip')) return 'curl ifconfig.me';
        if (s.includes('kill') && s.includes('node')) return 'kill $(pgrep node)';
        if (s.includes('docker') && (s.includes('container') || s.includes('ps'))) return 'docker ps';
        if (s.includes('process')) return s.includes('all') ? 'ps aux' : 'ps';
        if (s.includes('pod') || s.includes('kubernetes') || s.includes('k8s')) return 'kubectl get pods';
        if (s.includes('where') && (s.includes('am') || s.includes('directory'))) return 'pwd';
        if (s.includes('go home') || s === 'home') return 'cd ~';
        if (s.includes('list') && s.includes('file')) return 'ls -la';
        if (s.includes('clear')) return 'clear';
        if (s.includes('disk')) return 'df -h';
        if (s.includes('network') || s.includes('ipconfig') || s.includes('interfaces')) return 'ifconfig';
        if (s.includes('git status')) return 'git status';
        if (s.includes('git log')) return 'git log';
        if (s.includes('date') || s.includes('time')) return 'date';
        if (s.includes('readme')) return 'cat README.md';
        if (s.includes('ping')) return 'ping google.com';
        if (s.startsWith('show ') || s.startsWith('open ')) {
            const m = s.match(/(readme|notes|zshrc)/);
            if (m) return `cat ${m[1] === 'zshrc' ? '.zshrc' : m[1].toUpperCase() + '.md'}`;
        }
        return null;
    };

    const queryGeminiTranslator = async (query: string): Promise<string> => {
        try {
            const ai = getAiClient();
            const prompt = `You are an expert command translator for 'ai-term', a real in-browser unix-like shell that proxies several commands to a real backend and the real Battery/Storage/Network browser APIs.
Given the natural language request: "${query}", translate it into ONE appropriate UNIX command from the supported list:
Supported commands:
- \`ls\` or \`ls -la\` or \`ls -la <path>\`
- \`pwd\`
- \`cd <dir>\` (available subdirectories: home, etc, var, tmp, projects, projects/ai-term, projects/model-server, or back '..')
- \`cat <file>\` (available files: README.md, notes.txt, .zshrc, hosts, index.html, terminal.js, Dockerfile, server.py)
- \`echo <text>\`
- \`clear\`
- \`uname\` or \`uname -a\`
- \`whoami\`
- \`date\`
- \`ps\` or \`ps aux\`
- \`top\`
- \`neofetch\`
- \`git status\`
- \`git log\`
- \`docker ps\`
- \`kubectl get pods\`
- \`python3\`
- \`node\`
- \`curl <url>\`
- \`ping <host>\`
- \`ifconfig\`
- \`history\`
- \`df -h\`
- \`kill <process>\`

Return ONLY the raw command string to run (e.g. 'ls -la') with no explanations, no markdown formatting (no backticks), and no other text. If it cannot be mapped reasonably to these utilities, return 'help'.`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.1,
                }
            });
            
            const translated = response.text ? response.text.trim().replace(/`/g, '') : 'help';
            return translated;
        } catch (err) {
            console.error('Gemini translation error:', err);
            // Fall back to local pattern mapping
            return translateLocalFallback(query) || 'help';
        }
    };

    const handleExecuteCommand = async (raw: string) => {
        const inputLine = raw.trim();
        if (!inputLine) return;

        // Add to input logs
        const promptDisplay = `expert@ai-term:${cwd.replace('/home/expert', '~')}$`;
        const id = Math.random().toString(36).substring(7);
        setLogs(prev => [...prev, { id, text: raw, type: 'input', prompt: promptDisplay }]);

        // History sync
        setHistory(prev => {
            const next = [...prev, inputLine];
            if (next.length > 100) next.shift();
            return next;
        });

        const tokens = parseArgs(inputLine);
        const cmd = tokens[0];
        const args = tokens.slice(1);

        // Core AI routing
        if (inputLine.startsWith('ai:')) {
            const query = inputLine.slice(3).trim();
            await runAiTranslation(query);
            return;
        }

        if (aiEnabled && !isKnown(inputLine)) {
            await runAiTranslation(inputLine);
            return;
        }

        await executeCoreCommand(cmd, args, inputLine);
    };

    const runAiTranslation = async (query: string) => {
        // Low-footprint copilot: try the offline app-intent router first. It
        // knows only this machine's actions (launch/sync/storage/network), so
        // the common "open notepad", "sync to cloud", "how much space" tasks
        // resolve instantly with zero network and zero model cost.
        const localIntent = resolveLocalIntent(query);
        if (localIntent) {
            addLine(`copilot → ${localIntent}`, 'ai');
            const t = parseArgs(localIntent);
            await executeCoreCommand(t[0], t.slice(1), localIntent);
            return;
        }

        setIsThinking(true);
        const translated = await queryGeminiTranslator(query);
        setIsThinking(false);

        if (!translated || translated === 'help') {
            addLine(`AI → (no match)`, 'ai');
            addLine(`I couldn't confidently map: "${query}". Try typing "help" for a list of available utilities.`, 'err');
            return;
        }

        addLine(`AI → ${translated}`, 'ai');

        // Execute the translated command
        const tokens = parseArgs(translated);
        await executeCoreCommand(tokens[0], tokens.slice(1), translated);
    };

    const executeCoreCommand = async (cmd: string, args: string[], rawLine: string) => {
        const cmdLower = cmd.toLowerCase();

        switch (cmdLower) {
            case 'clear':
                setLogs([]);
                break;
            case 'help':
                addLine(`AI-TERM COMMANDS

REAL SYSTEM (live device data)
  apps                    list installed programs
  open <name>             launch a program (aliases: launch/start/engage/run)
  sync                    connect to cloud & sync the vault
  storage                 real vault footprint vs quota
  mem                     real JS heap + cores + device RAM
  net                     real network status / connection
  neofetch                real device readout

SHELL
  ls, pwd, cd <dir>, cat <file>, echo <text>, clear, history
  uname [-a], whoami, date, ps [aux], top
  git status, git log, docker ps, kubectl get pods
  python3, node, curl <url>, ping <host>, ifconfig, df, kill

AI CO-PILOT (offline-first, app-only)
  ai: <instruction>       plain English → an action
  Toggle AI top-right. When ON, plain English auto-runs.

  Examples (resolve offline, no model):
   ai: open notepad              → open notepad
   ai: sync to the cloud         → sync
   ai: how much space am I using → storage
   ai: am I online              → net

SHORTCUTS
  ↑/↓   history    Tab   autocomplete
  Ctrl+L clear     Ctrl+C cancel
  Shift+Enter multiline`, 'welcome');
                break;

            case 'apps':
                addLine('Installed programs (open <name>):\n  ' + PC_APPS.map(a => a.cmd).join('   '));
                break;

            case 'open':
            case 'launch':
            case 'start':
            case 'engage':
            case 'run': {
                const hit = resolveApp(args.join(' '));
                if (!hit) {
                    addLine(`${cmdLower}: unknown program "${args.join(' ')}". Type "apps" to list programs.`, 'err');
                    break;
                }
                window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId: hit.appId } }));
                addLine(`Launching ${hit.name}…`, 'ai');
                break;
            }

            case 'sync': {
                // Real: open the cloud sync program (which performs the actual push/pull).
                window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId: 'github_sync' } }));
                addLine(navigator.onLine
                    ? 'Cloud link online → opening Sync.'
                    : 'Offline — opening Sync; it will push once a connection returns.', navigator.onLine ? 'ai' : 'err');
                break;
            }

            case 'storage': {
                if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
                    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
                    const pct = quota ? ((usage / quota) * 100).toFixed(1) : '0';
                    addLine(`Vault footprint (real):\n  used    ${fmtBytes(usage)}\n  quota   ${fmtBytes(quota)}\n  usage   ${pct}%`);
                } else {
                    addLine('storage: Storage API unavailable in this browser', 'err');
                }
                break;
            }

            case 'mem':
            case 'free': {
                const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
                const cores = navigator.hardwareConcurrency || '?';
                const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
                if (perfMem) {
                    addLine(`Memory (real JS heap):\n  used    ${fmtBytes(perfMem.usedJSHeapSize)}\n  limit   ${fmtBytes(perfMem.jsHeapSizeLimit)}\n  cores   ${cores}${dm ? `\n  device  ${dm} GB` : ''}`);
                } else {
                    addLine(`Cores: ${cores}${dm ? ` · Device memory: ${dm} GB` : ''}\n(JS heap metrics unavailable in this browser)`);
                }
                break;
            }

            case 'net':
            case 'wifi': {
                const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection;
                addLine(`Network (real):\n  status    ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}${conn ? `\n  type      ${conn.effectiveType || '?'}\n  downlink  ${conn.downlink ?? '?'} Mbps\n  rtt       ${conn.rtt ?? '?'} ms` : ''}`);
                break;
            }

            case 'ls': {
                if (!fsAccessEnabled) {
                    addLine('ls: real filesystem access is turned off. Toggle "Real FS" in the header to enable it.', 'err');
                    break;
                }
                try {
                    const entries = await termFsList(toRel(cwd));
                    const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
                    const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
                    let list = showAll ? entries : entries.filter(n => !n.name.startsWith('.'));
                    list.sort((a, b) => a.name.localeCompare(b.name));
                    if (long) {
                        const lines = [`total ${list.length}`];
                        list.forEach(e => {
                            lines.push(`${e.isDir ? 'drwxr-xr-x' : '-rw-r--r--'} 1 expert staff  ${e.size} — ${e.name}`);
                        });
                        addLine(lines.join('\n'));
                    } else {
                        addLine(list.map(e => e.name).join('  '));
                    }
                } catch (e: any) {
                    addLine(`ls: ${e.message}`, 'err');
                }
                break;
            }

            case 'pwd':
                addLine(cwd);
                break;

            case 'cd': {
                if (!fsAccessEnabled) {
                    addLine('cd: real filesystem access is turned off. Toggle "Real FS" in the header to enable it.', 'err');
                    break;
                }
                const target = args[0] || '~';
                const np = resolvePath(target);
                const kind = await termFsStat(toRel(np));
                if (kind !== 'dir') {
                    addLine(`cd: no such directory: ${target}`, 'err');
                } else {
                    setCwd(np);
                }
                break;
            }

            case 'mkdir': {
                if (!fsAccessEnabled) {
                    addLine('mkdir: real filesystem access is turned off.', 'err');
                    break;
                }
                if (!args[0]) { addLine('mkdir: missing directory name', 'err'); break; }
                try {
                    await termFsWrite(toRel(resolvePath(args[0])), undefined, true);
                    addLine('');
                } catch (e: any) {
                    addLine(`mkdir: ${e.message}`, 'err');
                }
                break;
            }

            case 'touch': {
                if (!fsAccessEnabled) {
                    addLine('touch: real filesystem access is turned off.', 'err');
                    break;
                }
                if (!args[0]) { addLine('touch: missing file name', 'err'); break; }
                try {
                    await termFsWrite(toRel(resolvePath(args[0])), '');
                    addLine('');
                } catch (e: any) {
                    addLine(`touch: ${e.message}`, 'err');
                }
                break;
            }

            case 'rm': {
                if (!fsAccessEnabled) {
                    addLine('rm: real filesystem access is turned off.', 'err');
                    break;
                }
                if (!args[0]) { addLine('rm: missing operand', 'err'); break; }
                try {
                    await termFsRm(toRel(resolvePath(args[args.length - 1])));
                    addLine('');
                } catch (e: any) {
                    addLine(`rm: ${e.message}`, 'err');
                }
                break;
            }

            case 'cat': {
                if (!fsAccessEnabled) {
                    addLine('cat: real filesystem access is turned off. Toggle "Real FS" in the header to enable it.', 'err');
                    break;
                }
                if (!args[0]) {
                    addLine('cat: missing file', 'err');
                    break;
                }
                const p = resolvePath(args[0]);
                try {
                    const content = await termFsRead(toRel(p));
                    addLine(content);
                } catch {
                    addLine(`cat: ${args[0]}: No such file or is a directory`, 'err');
                }
                break;
            }

            case 'echo': {
                const joined = args.join(' ');
                const redirMatch = joined.match(/^(.*?)\s*(>>|>)\s*(\S+)$/);
                if (redirMatch && fsAccessEnabled) {
                    const [, textPart, op, filePart] = redirMatch;
                    const text = textPart.replace(/^["']|["']$/g, '');
                    try {
                        let finalContent = text + '\n';
                        if (op === '>>') {
                            try { finalContent = (await termFsRead(toRel(resolvePath(filePart)))) + text + '\n'; } catch { /* file may not exist yet */ }
                        }
                        await termFsWrite(toRel(resolvePath(filePart)), finalContent);
                        addLine('');
                    } catch (e: any) {
                        addLine(`echo: ${e.message}`, 'err');
                    }
                } else if (redirMatch && !fsAccessEnabled) {
                    addLine('echo: real filesystem access is turned off, cannot write file.', 'err');
                } else {
                    addLine(joined.replace(/^["']|["']$/g, ''));
                }
                break;
            }

            case 'uname':
            case 'whoami':
            case 'date':
            case 'ps':
            case 'df': {
                // Real command executed server-side in this container via /api/shell/exec.
                try {
                    const resp = await fetch('/api/shell/exec', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cmd, args, cwd }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) {
                        addLine(`${cmd}: ${data.error || 'command failed'}`, 'err');
                    } else if (data.error) {
                        addLine(data.stderr || `${cmd}: command failed`, 'err');
                    } else {
                        addLine((data.stdout || data.stderr || '').replace(/\n$/, ''));
                    }
                } catch (e: any) {
                    addLine(`${cmd}: real shell backend unreachable (${e.message})`, 'err');
                }
                break;
            }

            case 'top':
                addLine('top: not available — this browser terminal cannot show a live real-time process table. Try "ps" for a real one-shot process snapshot of this container.', 'err');
                break;

            case 'neofetch': {
                // Real device readout from the browser environment.
                const cores = navigator.hardwareConcurrency || '?';
                const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
                const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
                const screen = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '?';
                const langs = navigator.language || '?';
                const plat = (navigator as unknown as { platform?: string }).platform || 'web';
                let vault = 'n/a';
                if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
                    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
                    vault = `${fmtBytes(usage)} / ${fmtBytes(quota)}`;
                }
                addLine(`
      .:'       ${navigator.onLine ? 'online' : 'offline'}@cybernetic-pc
     ::::.      ---------------
    :::::::     OS: Cybernetic67 V-OS (web)
   ::::::::     Platform: ${plat}
   ::::::::     Cores: ${cores}${dm ? ` · Device RAM: ${dm} GB` : ''}
    :::::::     JS Heap: ${perfMem ? `${fmtBytes(perfMem.usedJSHeapSize)} / ${fmtBytes(perfMem.jsHeapSizeLimit)}` : 'n/a'}
     '::::'     Vault: ${vault}
       ''       Display: ${screen} · Locale: ${langs}
                Shell: ai-term (real)`);
                break;
            }

            case 'git':
            case 'docker': {
                // Real command executed server-side; honest error if the tool/repo
                // isn't actually present in this container (no fabricated output).
                try {
                    const resp = await fetch('/api/shell/exec', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cmd, args, cwd }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) {
                        addLine(`${cmd}: ${data.error || 'command failed'}`, 'err');
                    } else if (data.error) {
                        addLine(data.stderr || `${cmd}: command failed`, 'err');
                    } else {
                        addLine((data.stdout || data.stderr || '').replace(/\n$/, ''));
                    }
                } catch (e: any) {
                    addLine(`${cmd}: real shell backend unreachable (${e.message})`, 'err');
                }
                break;
            }

            case 'kubectl':
                addLine('kubectl: not available — no Kubernetes cluster is connected to this environment.', 'err');
                break;

            case 'python3':
                addLine('python3: not installed in this container', 'err');
                break;

            case 'node':
                addLine('node: not exposed to this browser shell — the backend runs Node, but this terminal cannot query its version', 'err');
                break;

            case 'curl': {
                const url = args[0] || '';
                if (!url) { addLine('curl: missing URL', 'err'); break; }
                try {
                    // Real fetch. Will honestly fail with a CORS/network error for
                    // most cross-origin targets — that's real browser behavior, not fakery.
                    const r = await fetch(url);
                    const text = await r.text();
                    addLine(text.slice(0, 4000));
                } catch (e: any) {
                    addLine(`curl: (real) request failed — ${e.message} (likely blocked by CORS from a browser context)`, 'err');
                }
                break;
            }

            case 'ping':
                addLine('ping: not available — browsers cannot send raw ICMP packets. Try "net" for real connection info.', 'err');
                break;

            case 'ifconfig':
                addLine('ifconfig: not available — browsers cannot read real network interface details. Try "net" for real connection info.', 'err');
                break;

            case 'history':
                addLine(history.map((h, i) => ` ${String(i + 1).padStart(3)}  ${h}`).join('\n'));
                break;

            case 'kill':
                addLine('kill: not available — this browser terminal has no OS process control.', 'err');
                break;

            default:
                addLine(`zsh: command not found: ${cmd}`, 'err');
                break;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const val = termInput;
            setTermInput('');
            handleExecuteCommand(val);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (histIdx > 0) {
                const newIdx = histIdx - 1;
                setHistIdx(newIdx);
                setTermInput(history[newIdx] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx < history.length - 1) {
                const newIdx = histIdx + 1;
                setHistIdx(newIdx);
                setTermInput(history[newIdx] || '');
            } else {
                setHistIdx(history.length);
                setTermInput('');
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            // Autocomplete
            const parts = termInput.split(/\s+/);
            const last = parts[parts.length - 1] || '';
            if (parts.length === 1) {
                const matches = cmdList.filter(c => c.startsWith(last));
                if (matches.length === 1) {
                    setTermInput(matches[0] + ' ');
                } else if (matches.length > 1) {
                    addLine(matches.join('  '));
                }
            } else if (fsAccessEnabled) {
                // Autocomplete real files in cwd
                termFsList(toRel(cwd)).then(entries => {
                    const matches = entries.filter(f => f.name.startsWith(last));
                    if (matches.length === 1) {
                        parts[parts.length - 1] = matches[0].name;
                        setTermInput(parts.join(' ') + ' ');
                    } else if (matches.length > 1) {
                        addLine(matches.map(m => m.name).join('  '));
                    }
                }).catch(() => {});
            }
        } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault();
            setLogs([]);
        } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            addLine('^C', 'out');
            setTermInput('');
        }
    };

    const toggleAi = () => {
        setAiEnabled(prev => !prev);
        const nextState = !aiEnabled;
        const msg = nextState ? 'AI control enabled' : 'AI control disabled';
        addLine(msg, 'ai');
    };

    return (
        <div className="h-full w-full bg-[#070709] text-[#00ff65] overflow-hidden flex flex-col font-sans select-none relative">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes crt-flicker {
                    0%, 97%, 100% { opacity: 1; }
                    98% { opacity: 0.97; }
                    99% { opacity: 0.985; }
                }
                .crt-screen::before {
                    content: " ";
                    display: block;
                    position: absolute;
                    top: 0; left: 0; bottom: 0; right: 0;
                    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
                    z-index: 20;
                    background-size: 100% 2px, 3px 100%;
                    pointer-events: none;
                }
                .crt-screen {
                    animation: crt-flicker 0.15s infinite;
                }
                .glow-text {
                    text-shadow: 0 0 4px rgba(0, 255, 101, 0.6), 0 0 10px rgba(0, 255, 101, 0.2);
                }
                .glow-blue {
                    text-shadow: 0 0 6px rgba(125, 249, 255, 0.7), 0 0 14px rgba(125, 249, 255, 0.3);
                }
                .glow-red {
                    text-shadow: 0 0 6px rgba(255, 95, 86, 0.6), 0 0 12px rgba(255, 95, 86, 0.2);
                }
                .pulse-dots i {
                    width: 3.5px;
                    height: 3.5px;
                    background: #00ff65;
                    border-radius: 50%;
                    display: inline-block;
                    animation: dot-pulse 1.1s infinite;
                    box-shadow: 0 0 4px #00ff65;
                }
                .pulse-dots i:nth-child(2) { animation-delay: 0.15s; }
                .pulse-dots i:nth-child(3) { animation-delay: 0.3s; }
                @keyframes dot-pulse {
                    0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1.15); }
                }
            `}} />

            {/* Application Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-900 shrink-0 select-none">
                <div className="flex items-center gap-2">
                    <TerminalIcon size={14} className="text-[#00ff65]" />
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-400">ai-term OS Emulator</span>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* View mode buttons */}
                    <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                        <button 
                            onClick={() => setDeviceMode('phone')}
                            className={`p-1.5 rounded-md flex items-center gap-1.5 transition-all text-[10px] font-mono ${deviceMode === 'phone' ? 'bg-zinc-800 text-[#00ff65] border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Interactive Phone Device Layout"
                        >
                            <Smartphone size={12} />
                            <span>Phone Mock</span>
                        </button>
                        <button 
                            onClick={() => setDeviceMode('fullscreen')}
                            className={`p-1.5 rounded-md flex items-center gap-1.5 transition-all text-[10px] font-mono ${deviceMode === 'fullscreen' ? 'bg-zinc-800 text-[#00ff65] border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Full Screen Window Layout"
                        >
                            <Laptop size={12} />
                            <span>Full Window</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Inner Workspace View */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-radial-gradient">
                {deviceMode === 'phone' ? (
                    /* PHONE WRAPPER & SHELL */
                    <div className="phone-wrapper p-4 flex items-center justify-center h-full w-full max-h-[92vh]">
                        <div className="phone w-[370px] h-[760px] bg-black rounded-[48px] border-[10px] border-[#121218] shadow-[0_0_0_1px_#000,0_0_0_2px_#1a1f1a_inset,0_30px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(0,255,101,0.06)] relative overflow-hidden flex flex-col">
                            {/* Physical Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160px] h-[28px] bg-black border-b-r-2xl border-b-l-2xl rounded-b-2xl z-40 shadow-inner" />
                            
                            {/* Device Content */}
                            <div className="flex-1 flex flex-col overflow-hidden relative crt-screen">
                                {/* iOS Status Bar */}
                                <div className="h-[42px] pt-4 px-6 flex items-center justify-between text-[10px] font-mono text-[#00ff65] border-b border-emerald-950/20 backdrop-blur-md z-30 bg-gradient-to-b from-emerald-950/10 to-transparent">
                                    <span className="opacity-90 select-none font-bold">ai-term • expert</span>
                                    <div className="flex items-center gap-2 select-none">
                                        <button 
                                            onClick={toggleAi} 
                                            className={`text-[8px] tracking-wide border rounded px-1.5 py-0.5 leading-none transition-all ${aiEnabled ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400 font-bold' : 'border-zinc-800 text-zinc-500'}`}
                                        >
                                            AI {aiEnabled ? 'ON' : 'OFF'}
                                        </button>
                                        <button
                                            onClick={toggleFsAccess}
                                            title="Real filesystem access — only this terminal and Jackie (when global mode is on) can use it"
                                            className={`text-[8px] tracking-wide border rounded px-1.5 py-0.5 leading-none transition-all ${fsAccessEnabled ? 'bg-blue-950/30 border-blue-500 text-blue-400 font-bold' : 'border-zinc-800 text-zinc-500'}`}
                                        >
                                            FS {fsAccessEnabled ? 'ON' : 'OFF'}
                                        </button>
                                        <span className="tracking-tighter font-bold">●●●</span>
                                        <span>{battery}</span>
                                        <span className="font-bold">{currentTime}</span>
                                    </div>
                                </div>

                                {/* Interactive Terminal Area */}
                                <div 
                                    className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed flex flex-col"
                                    onClick={() => textareaRef.current?.focus()}
                                    ref={outputRef}
                                >
                                    {/* Command Outputs */}
                                    <div className="space-y-1">
                                        {logs.map((log) => {
                                            if (log.type === 'input') {
                                                return (
                                                    <div key={log.id} className="text-zinc-300">
                                                        <span className="text-emerald-500/80 mr-2">{log.prompt}</span>
                                                        <span className="glow-text text-emerald-300 font-bold">{log.text}</span>
                                                    </div>
                                                );
                                            } else if (log.type === 'err') {
                                                return (
                                                    <div key={log.id} className="text-red-500 glow-red whitespace-pre-wrap">
                                                        {log.text}
                                                    </div>
                                                );
                                            } else if (log.type === 'ai') {
                                                return (
                                                    <div key={log.id} className="text-cyan-400 glow-blue whitespace-pre-wrap font-bold">
                                                        {log.text}
                                                    </div>
                                                );
                                            } else if (log.type === 'welcome') {
                                                return (
                                                    <pre key={log.id} className="text-emerald-400/90 whitespace-pre-wrap font-sans font-medium">
                                                        {log.text}
                                                    </pre>
                                                );
                                            } else {
                                                return (
                                                    <div key={log.id} className="text-[#00ff65] glow-text whitespace-pre-wrap">
                                                        {log.text}
                                                    </div>
                                                );
                                            }
                                        })}

                                        {isThinking && (
                                            <div className="text-cyan-400 glow-blue flex items-center gap-1.5">
                                                <span>[AI Thinking]</span>
                                                <span className="pulse-dots inline-flex gap-0.5">
                                                    <i />
                                                    <i />
                                                    <i />
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Terminal Prompt Input Line */}
                                    <div className="flex items-start gap-1.5 mt-2 shrink-0">
                                        <span className="text-[#00ff65] opacity-90 select-none">expert@ai-term:~$:</span>
                                        <textarea
                                            ref={textareaRef}
                                            value={termInput}
                                            onChange={(e) => setTermInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            spellCheck={false}
                                            autoCapitalize="off"
                                            autoComplete="off"
                                            autoCorrect="off"
                                            rows={1}
                                            className="flex-1 bg-transparent border-none outline-none text-[#00ff65] font-mono text-[13px] leading-relaxed resize-none p-0 overflow-hidden glow-text focus:ring-0 focus:outline-none"
                                            placeholder="..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* FULLSCREEN TERMINAL VIEW */
                    <div className="crt-screen w-full h-full p-6 flex flex-col font-mono text-sm overflow-hidden select-text relative">
                        {/* Custom background grids */}
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/5 via-transparent to-black pointer-events-none" />

                        {/* Top System Status Line */}
                        <div className="flex justify-between items-center text-xs text-zinc-500 border-b border-emerald-950/30 pb-2 mb-4">
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                                <span>ONLINE • AI CO-PILOT {aiEnabled ? 'ACTIVE' : 'STANDBY'}</span>
                            </span>
                            <span>CURRENT DIRECTORY: <strong className="text-emerald-400">{cwd}</strong></span>
                            <span>BATTERY: {battery} • {currentTime}</span>
                        </div>

                        {/* Logs and Command output list */}
                        <div 
                            className="flex-1 overflow-y-auto space-y-1.5 px-2 py-1 flex flex-col"
                            onClick={() => textareaRef.current?.focus()}
                            ref={outputRef}
                        >
                            {logs.map((log) => {
                                if (log.type === 'input') {
                                    return (
                                        <div key={log.id} className="text-zinc-300">
                                            <span className="text-emerald-500/80 mr-2 font-bold">{log.prompt}</span>
                                            <span className="glow-text text-emerald-300 font-bold">{log.text}</span>
                                        </div>
                                    );
                                } else if (log.type === 'err') {
                                    return (
                                        <div key={log.id} className="text-red-500 glow-red whitespace-pre-wrap font-bold">
                                            {log.text}
                                        </div>
                                    );
                                } else if (log.type === 'ai') {
                                    return (
                                        <div key={log.id} className="text-cyan-400 glow-blue whitespace-pre-wrap font-bold">
                                            {log.text}
                                        </div>
                                    );
                                } else if (log.type === 'welcome') {
                                    return (
                                        <pre key={log.id} className="text-emerald-400/90 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950/40 p-3 rounded border border-emerald-950/10">
                                            {log.text}
                                        </pre>
                                    );
                                } else {
                                    return (
                                        <div key={log.id} className="text-[#00ff65] glow-text whitespace-pre-wrap">
                                            {log.text}
                                        </div>
                                    );
                                }
                            })}

                            {isThinking && (
                                <div className="text-cyan-400 glow-blue flex items-center gap-1.5 font-bold">
                                    <span>[AI Translating command]</span>
                                    <span className="pulse-dots inline-flex gap-0.5">
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                </div>
                            )}

                            {/* Prompt Input Line */}
                            <div className="flex items-start gap-2 mt-3 shrink-0">
                                <span className="text-[#00ff65] font-bold select-none">expert@ai-term:{cwd.replace('/home/expert', '~')}$</span>
                                <textarea
                                    ref={textareaRef}
                                    value={termInput}
                                    onChange={(e) => setTermInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    spellCheck={false}
                                    autoCapitalize="off"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    rows={1}
                                    className="flex-1 bg-transparent border-none outline-none text-[#00ff65] font-mono text-sm leading-relaxed resize-none p-0 overflow-hidden glow-text focus:ring-0 focus:outline-none"
                                    placeholder="Type a Unix command or ask AI to perform a task (e.g., 'ai: list hidden files')..."
                                />
                            </div>
                        </div>

                        {/* Status bar */}
                        <div className="flex justify-between items-center text-[10px] text-zinc-600 border-t border-emerald-950/20 pt-2 shrink-0 mt-2">
                            <span>ai-term OS v1.2.0 (amd64-linux)</span>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={toggleAi}
                                    className={`flex items-center gap-1 hover:text-emerald-400 transition-colors ${aiEnabled ? 'text-emerald-500 font-bold' : 'text-zinc-600'}`}
                                >
                                    <span>AI INTEGRATION:</span>
                                    <span>{aiEnabled ? 'ENABLED' : 'DISABLED'}</span>
                                </button>
                                <span>Type 'help' for support</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
