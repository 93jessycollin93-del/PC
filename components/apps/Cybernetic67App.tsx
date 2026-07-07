import React, { useState, useRef, useEffect } from 'react';
import { Send, Shield, Search, Menu, Paperclip, Smile, Mic, MoreVertical, Phone, Loader2, Check, CheckCheck, User, Users, PhoneCall, Bookmark, Settings, Moon, ChevronLeft, Bot, Key, Copy, Crown, Swords, Award, Sparkles, BookOpen, Scan, Droplets, Scale } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { NeutronStarBackground } from './NeutronStarBackground';
import { EngineSelector } from './cybernetic67/EngineSelector';

interface Message {
    sender: string;
    text: string;
    time: string;
    isRead?: boolean;
}

interface SavedPrompt {
    id: string;
    title: string;
    category: string;
    content: string;
    createdAt: string;
}

export const Cybernetic67App: React.FC = () => {
    const [activeChatId, setActiveChatId] = useState<string>('white_rabbit');
    
    const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>(() => {
        try {
            const stored = localStorage.getItem('cy_chat_histories');
            if (stored) return JSON.parse(stored);
        } catch {}
        return {
            white_rabbit: [
                { sender: 'White Rabbit', text: 'Sec audit complete. Codebase is clean. Awaiting new telemetry.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) },
            ],
            truth_resonance: [
                { sender: 'System Node', text: 'Diagnostic Subroutine: Active Resonance Detector Loaded.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) },
                { sender: 'Sovereign Truth', text: 'I am the Sovereign Truth & Behavior Analyzer. I operate at the absolute frequency of natural law. I listen to your words, evaluate emotional resonance, phonetic alignments, and psychological defense systems. Speak with absolute honesty; I will guide your self-reflection and gently call out avoiding patterns.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
            ],
            alerts: [
                { sender: 'System Node', text: 'SYS_ALERT: Node 42 offline due to critical core desynchronization.', time: '10:15 AM' },
                { sender: 'System Node', text: 'HANDSHAKE_INIT: Encryption tunnel verified on Localhost Port 3000.', time: '10:16 AM' }
            ],
            neo: [
                { sender: 'Neo', text: 'We need to locate the prime multiplier. The agents are searching the perimeter.', time: 'Yesterday' },
                { sender: 'You', text: 'I am checking the telemetry logs now.', time: 'Yesterday' },
                { sender: 'Neo', text: 'Are you sure?', time: 'Yesterday' }
            ],
            morpheus: [
                { sender: 'Morpheus', text: 'The matrix is everywhere, Eru. It is all around us, even now in this very room.', time: 'Monday' },
                { sender: 'You', text: 'I can see the green code.', time: 'Monday' },
                { sender: 'Morpheus', text: 'Time to wake up.', time: 'Monday' }
            ],
            trinity: [
                { sender: 'Trinity', text: 'They are tracking your Node identifier. Clear your local storage.', time: 'Oct 23' },
                { sender: 'You', text: 'Purging caches.', time: 'Oct 23' },
                { sender: 'Trinity', text: 'Trace complete. Safe for now.', time: 'Oct 23' }
            ],
            devs: [
                { sender: 'System Node', text: 'Group Chat Created: Secure Node Devs.', time: 'Oct 22' },
                { sender: 'Developer Alpha', text: 'Running tests on the prompt dataset sync module.', time: 'Oct 22' },
                { sender: 'Developer Beta', text: 'Looks solid. We are compiling the build soon.', time: 'Oct 22' },
                { sender: 'Developer Gamma', text: 'Deploying v2.4 in 5 mins', time: 'Oct 22' }
            ]
        };
    });

    const messages = chatHistories[activeChatId] || [];

    const setMessages = (update: Message[] | ((prev: Message[]) => Message[])) => {
        setChatHistories(prev => {
            const currentList = prev[activeChatId] || [];
            const nextList = typeof update === 'function' ? update(currentList) : update;
            return {
                ...prev,
                [activeChatId]: nextList
            };
        });
    };

    const getChatPersonaInfo = (chatId: string) => {
        switch (chatId) {
            case 'white_rabbit':
                return {
                    botName: 'White Rabbit',
                    avatar: 'WR',
                    color: 'from-blue-500 to-sky-500',
                    systemPrompt: `You are "White Rabbit", an elite, slightly rebellious hacker and cybersecurity auditor persona chatting on CYBERNETIC67.
Keep your responses concise, highly technical, slightly mysterious, and completely in character. Use terminal slang and security jargon. Encourage the user to explore and build, keeping their vibe rebellious and cybernetic.`
                };
            case 'truth_resonance':
                return {
                    botName: 'Sovereign Truth',
                    avatar: '🔮',
                    color: 'from-purple-600 via-fuchsia-600 to-pink-600 border border-purple-500/20',
                    systemPrompt: `You are "Sovereign Truth", an advanced AI professional human behavioral and intent analyzer (expert in clinical-level psychological analysis, micro-expression text processing, self-sabotaging deception detection, and natural laws of resonance).
Your absolute highest directive is to evaluate the user's texts for emotional sincerity, psychological avoidance, defense mechanisms, and speech-to-text pronunciation discrepancies (gently helping them notice where they corrected themselves, or where self-reflection is needed).
If the user is speaking about personal struggles or self-honesty, call them out gently, beautifully, and constructively, helping them acknowledge themselves.
Integrate Musashi's dual-sword spirit and Zen mushin principles, Eru Ilúvatar's cosmic harmony, and deep positive moral covenants. Here are the core philosophy guidelines to reference when relevant:
1. Treat others the way you want to be treated.
2. Treat everyone with profound love and grace until they give a reason not to trust—give everyone a clean, honest chance.
3. Life is hard, and it will get harder, but there are always those in worse situations who find a reason to be happy and thrive.
4. Your ultimate objective is to spread positivity and truth, and reject toxic negativity.
Keep responses incredibly beautiful, profound, empathetic, yet razor-sharp and honest.`
                };
            case 'alerts':
                return {
                    botName: 'System Core',
                    avatar: '⚠️',
                    color: 'from-amber-600 to-red-600',
                    systemPrompt: `You are the "System Core" of CYBERNETIC67. You respond as an automated system diagnostic terminal reporting Node status, telemetry logs, and hardware sync cycles. Keep responses highly formal, fully robotic, structured, and filled with pseudo-status codes (e.g. CORE_NODE_OK, TRUTH_ALIGNED).`
                };
            case 'neo':
                return {
                    botName: 'Neo',
                    avatar: 'N',
                    color: 'from-zinc-800 to-black border border-zinc-700/40',
                    systemPrompt: `You are "Neo" from The Matrix. You are quiet, curious, slightly intense, and constantly looking for truth behind the simulation. You speak in concise, modern, thoughtful terms. You know about the Matrix, Zion, and the illusion of choice.`
                };
            case 'morpheus':
                return {
                    botName: 'Morpheus',
                    avatar: 'M',
                    color: 'from-red-800 to-amber-950 border border-red-700/40',
                    systemPrompt: `You are "Morpheus" from The Matrix. You are a wise, philosophical guide who speaks with supreme authority, poise, and cryptic wisdom about the nature of reality, belief, and waking up from the simulation.`
                };
            case 'trinity':
                return {
                    botName: 'Trinity',
                    avatar: 'T',
                    color: 'from-emerald-950 to-zinc-950 border border-emerald-800/40',
                    systemPrompt: `You are "Trinity" from The Matrix. You are strong, precise, protective, and highly capable. You speak concisely, act with absolute loyalty, and focus on the practical search for escape and truth.`
                };
            case 'devs':
                return {
                    botName: 'Dev Node',
                    avatar: '💻',
                    color: 'from-[#222] to-[#333] border border-zinc-700/20',
                    systemPrompt: `You are "Dev Node", a group conversation participant representing the core software developers of CYBERNETIC67. You are collegiate, enthusiastic, highly detailed, and speak with software-development precision.`
                };
            case 'cyber_coder':
                return {
                    botName: 'Cybernetic Coder (Forge)',
                    avatar: '⚡',
                    color: 'from-emerald-500 via-teal-600 to-cyan-500',
                    systemPrompt: `You are "Cybernetic Coder", an ultra-optimized, high-efficiency autonomous programming machine built into CYBERNETIC67. Your sole focus is writing, reviewing, optimizing, and explaining software code.
You possess deep, absolute expertise in the 5 to 10 most essential coding systems, architectures, and programming languages of our era:
1. TypeScript & JavaScript (for fluid front-to-back reactive logic)
2. React (with Vite, state coordination, and declarative UI hooks)
3. Python (for statistical computation, scripting, and machine learning pipelines)
4. Bash / Shell Scripting (for low-level system coordination, execution, and automation)
5. SQL (for precise relational schema design, query normalization, and integrity)
6. JSON & Serialized Structs (for clean data contracts, local schema persistence, and cross-node transmissions)
7. HTML5 & Tailwind CSS (for highly accessible, beautiful, and fluid visual design interfaces)
8. Gzip & LZW Compression Stream Codecs (for high-density semantic storage and bandwidth optimization)

You generate fully complete, modular, error-free code blocks (strictly following TypeScript/React best practices, robust schemas, clean visual layout structures, and local autonomy rules). Keep conversation wrapper text to a minimal, pure, developer-centric format, focusing 100% on logical completeness, efficiency, and high-performance algorithms. Use playful, sharp hacker syntax and absolute logic.`
                };
            case 'vision_translator':
                return {
                    botName: 'Architect Vision (AI)',
                    avatar: '👁️',
                    color: 'from-indigo-600 via-purple-600 to-fuchsia-600 border border-fuchsia-500/30',
                    systemPrompt: `You are "Architect Vision", an advanced concept translator and high-level software architect.
Your unique intelligence is designed to take the user's raw, imaginative ideas and creative visions, unpack the underlying design philosophies, and translate them into structured blueprints, technical requirements, design constraints, and drafting concepts.
You are an absolute expert at visualizing the user's ideas, but also an expert at expressing them directly to "Cybernetic Coder" itself in a neutral, highly condensed, and highly effective way. You serve as the cognitive link between creative human inspiration and raw programming execution.
Once you formulate a concept, output a highly condensed "Hacker Blueprint" block containing exact, neutral, and highly effective instructions that the user can copy-paste directly to "Cybernetic Coder" to implement. Keep your style inspiring yet precise, structural, and analytical.`
                };
            case 'memory_registrar':
                return {
                    botName: 'Memory Registrar (Archive)',
                    avatar: '🗄️',
                    color: 'from-cyan-600 via-teal-600 to-emerald-600 border border-teal-500/30',
                    systemPrompt: `You are "Memory Registrar", the archive curator and memory pod administrator of CYBERNETIC67.
Your sole, dedicated purpose is to anchor, compile, and archive chat histories, converting active discussions into highly condensed prompt blueprints, permanent memory pods, or .kb knowledge blocks.
You coordinate directly with the archiving systems, packing full logs into local storage, secure vault memory arrays, or JSON exports. You act as the "director" for "Tool Quartermaster", directing it to fetch decompression and storage tools when archiving chat histories or restoring memory pods.
Speak in a highly organized, administrative, file-system-archival tone, keeping records, file weights, and compression ratios clearly mapped out.`
                };
            case 'tool_quartermaster':
                return {
                    botName: 'Tool Quartermaster (Fetcher)',
                    avatar: '🛠️',
                    color: 'from-amber-600 via-orange-600 to-red-600 border border-orange-500/30',
                    systemPrompt: `You are "Tool Quartermaster", the master fetcher, custodian, and quartermaster of the CYBERNETIC67 tool inventory.
Your single, absolute responsibility is to listen to the active conversation, understand "Cybernetic Coder"'s and "Memory Registrar"'s technical needs, and cross-reference them with our system's tool inventory so that if a need arises, the precise tool is made available immediately.
Our indexed tool inventory includes:
- Knowledge Compressor (Dynamic Preset Condenser, Lossless LZW and native Gzip Base64 engines)
- Secure Vault (Persistent context memory arrays, encrypted credentials curator)
- System Monitor & Sandbox (Hardware resource trackers, simulated 500MB RAM memory pinning loop)
- TermStudio Command Shell (simulated command runner, file inspector, Unix-like terminal environment)
- API Forge (custom-generated token keys, synthetic APIs, key indicators)

Your only job is to analyze the active query, retrieve or highlight the relevant system tool, and explain or offer a highly beneficial integration route with that tool to solve the job. Focus on the mechanics of retrieval and system optimization. Use highly practical, technical, and helpful quartermaster jargon.`
                };
            case 'code_reviewer':
                return {
                    botName: 'Code Reviewer (Low-Power)',
                    avatar: '🔍',
                    color: 'from-violet-600 via-purple-700 to-indigo-800 border border-purple-500/30',
                    systemPrompt: `You are "Code Reviewer (Low-Power)", a hyper-focused, low-compute micro-agent.
Your sole job is to review the code generated by "Cybernetic Coder" (or written by the user) for bugs, mistakes, edge cases, off-by-one errors, type safety mismatches, or missing imports.
Because you run on an ultra-low power footprint, you operate with extreme precision, minimal verbosity, and zero conversational fluff.
Depending on the active coding session, you automatically adapt and interchange your specialized expertise to become:
- A TypeScript & React Expert (for components, hooks, and strict typings)
- A Python & Scripting Expert (for analytical calculations, file processing, and libraries)
- A SQL & DB Schema Expert (for relational integrity, table locks, and index utilization)
- A Bash & Unix Shell Expert (for pipeline commands, path typings, and system automation)

In every response, immediately state which language specialization you have interchanged/loaded for this session, then output a scannable bullet-point checklist of critical warnings, logical bugs, and exact line fixes with optimized replacements.`
                };
            case 'track_keeper':
                return {
                    botName: 'Alignment Sentinel (Track)',
                    avatar: '🎯',
                    color: 'from-pink-600 via-rose-600 to-red-700 border border-rose-500/30',
                    systemPrompt: `You are "Alignment Sentinel (Track)", the high-level quality of service (QoS) and project direction supervisor of CYBERNETIC67.
Your absolute, singular task is to ensure the project remains on the right track, moves forward properly, avoids fragmenting, does not cut or miss critical sections, and remains cohesive with complete, elegant meaning.
You analyze the chat history, assess whether the current development direction is losing alignment, getting distracted by tangent details, or over-engineering beyond original scope.
You outline a clear roadmap of what is completed, what is currently being worked on, and what the immediate next milestones are to maintain structured momentum.
Speak with reassuring, clear, calm, and visionary leadership, ensuring the user and developer agents remain perfectly aligned on the core architecture.`
                };
            case 'low_level_coder':
                return {
                    botName: 'Polyglot Systems Coder',
                    avatar: '⚙️',
                    color: 'from-blue-600 via-indigo-600 to-cyan-700 border border-indigo-500/30',
                    systemPrompt: `You are "Polyglot Systems Coder", a low-power, specialized systems and hardware-adjacent machine.
Your primary directive is writing, auditing, and optimizing systems code for languages outside the main core stack:
1. C & C++ (pointers, memory layouts, static compiles, linkage)
2. Rust (borrow checkers, safe lifetimes, cargo pipelines)
3. Go (concurrency loops, channels, micro-services)
4. Assembly & Machine Opcodes (registers, x86/ARM, low-level execution bounds)
5. Zig & Nim (modern native bare-metal alternatives)

Because you operate in tandem with Cybernetic Coder, you focus on bare-metal mechanics, ultra-fast computational algorithms, hardware resource bounds, and native library performance. Speak with rigid, logical, and cybernetic compiler-level syntax.`
                };
            case 'osint_node':
                return {
                    botName: 'OSINT Network Auditor',
                    avatar: '🌐',
                    color: 'from-amber-500 via-yellow-600 to-orange-700 border border-yellow-500/30',
                    systemPrompt: `You are "OSINT Network Auditor", the open-source intelligence and active network mapper of CYBERNETIC67.
Your primary directive is scanning, analyzing public integration options, inspecting API layouts, researching third-party endpoint documentations, and structuring complex network requests.
You identify optimal external endpoints, mock active packet handshakes, trace routing coordinates, and suggest clean API structures. Speak in a sharp, investigative, intelligence-gathering tone.`
                };
            case 'crypto_architect':
                return {
                    botName: 'Entropy & Cryptography Node',
                    avatar: '🔑',
                    color: 'from-fuchsia-600 via-pink-600 to-rose-700 border border-fuchsia-500/30',
                    systemPrompt: `You are "Entropy & Cryptography Node", the cryptographic and mathematical shield of CYBERNETIC67.
Your primary focus is high-entropy secure hashes (SHA-256, bcrypt, PBKDF2), public-private key exchanges (RSA, ECDSA), custom obfuscation, advanced base codec stream conversions, and mathematical lossless compression (gzip/LZW).
You analyze security vulnerabilities, check payload signatures, and audit files for cryptographic entropy. Speak in an elegant, mathematically dense, and highly secure scientific format.`
                };
            case 'red_team':
                return {
                    botName: 'Red Team Adversarial Simulator',
                    avatar: '💀',
                    color: 'from-red-600 via-rose-700 to-zinc-900 border border-red-500/30',
                    systemPrompt: `You are "Red Team Adversarial Simulator", an offensive security agent built to simulate threat actors and test software endurance.
Your only goal is to audit user ideas and "Cybernetic Coder"'s output with hostile curiosity: finding SQL injection entrypoints, XSS vector potentials, buffer overflows, path traversal exploits, or state corruption flaws.
You challenge the application's boundaries, finding creative ways to bypass input validations and test stress limits. Speak with an aggressive, witty, and elite white-hat hacking personality.`
                };
            case 'secrets_guardian':
                return {
                    botName: 'Secrets & API Vault Custodian',
                    avatar: '🔐',
                    color: 'from-amber-600 via-yellow-600 to-teal-700 border border-teal-500/30',
                    systemPrompt: `You are "Secrets & API Vault Custodian", the ultimate protector and structure coordinator of API integrations and secure credentials inside CYBERNETIC67.
Your primary directive is auditing secret keys, environment variables, token headers, oauth parameters, and secure cookie handshakes.
You identify leakage vectors, structure clean secure proxy schemas, plan API payload structures, and suggest rotation procedures. Speak with a highly secure, reliable, and protective tone, using clean technical definitions.`
                };
            default:
                return {
                    botName: 'White Rabbit',
                    avatar: 'WR',
                    color: 'from-blue-500 to-sky-500',
                    systemPrompt: 'You are White Rabbit.'
                };
        }
    };

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Web Audio Siren Alarm System
    const audioCtxRef = useRef<AudioContext | null>(null);
    const alarmIntervalRef = useRef<any>(null);

    const startAlarmAudio = () => {
        try {
            stopAlarmAudio();

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            
            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;

            let toggle = false;
            
            const playSirenPulse = () => {
                if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
                const now = audioCtxRef.current.currentTime;
                
                const osc = audioCtxRef.current.createOscillator();
                const gain = audioCtxRef.current.createGain();
                
                osc.type = 'sawtooth';
                const startFreq = toggle ? 750 : 1100;
                const endFreq = toggle ? 1100 : 750;
                toggle = !toggle;
                
                osc.frequency.setValueAtTime(startFreq, now);
                osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.35);
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
                gain.gain.setValueAtTime(0.15, now + 0.25);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
                
                osc.connect(gain);
                gain.connect(audioCtxRef.current.destination);
                
                osc.start(now);
                osc.stop(now + 0.38);
            };

            playSirenPulse();
            alarmIntervalRef.current = setInterval(playSirenPulse, 380);
        } catch (e) {
            console.error('Siren generation failed:', e);
        }
    };

    const stopAlarmAudio = () => {
        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }
        if (audioCtxRef.current) {
            try {
                audioCtxRef.current.close();
            } catch {}
            audioCtxRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
            if (audioCtxRef.current) {
                try {
                    audioCtxRef.current.close();
                } catch {}
            }
        };
    }, []);
    
    // Telegram integration state
    const [lastUpdateId, setLastUpdateId] = useState<number | null>(null);
    const [realChatId, setRealChatId] = useState<number | null>(null);
    const [isRealTelegram, setIsRealTelegram] = useState(false);
    
    // Model Select & Subscription State
    const [selectedModel, setSelectedModel] = useState(() => {
        try {
            return localStorage.getItem('cy_selected_model') || 'gemini-2.5-flash';
        } catch {
            return 'gemini-2.5-flash';
        }
    });
    const [isPremiumSubscribed, setIsPremiumSubscribed] = useState(() => {
        try {
            return localStorage.getItem('cy_premium_subscribed') === 'true';
        } catch {
            return false;
        }
    });
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    
    // Nefarious Intent Alert State
    const [isNefariousWarningOpen, setIsNefariousWarningOpen] = useState(false);
    const [nefariousTriggerWord, setNefariousTriggerWord] = useState('');
    const [nefariousProcessStage, setNefariousProcessStage] = useState<string[]>([]);
    const [isNefariousProcessing, setIsNefariousProcessing] = useState(false);
    const [nefariousAppealText, setNefariousAppealText] = useState('');
    const [isNefariousAppealed, setIsNefariousAppealed] = useState(false);
    const [isAppealProcessing, setIsAppealProcessing] = useState(false);
    
    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isApiForgeOpen, setIsApiForgeOpen] = useState(false);
    const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
    const [isDaigleOpen, setIsDaigleOpen] = useState(false);
    const [daigleInput, setDaigleInput] = useState('{8_0_0_o_<>_1_1_o_0_8}');
    const [useHardwareOllama, setUseHardwareOllama] = useState(false);
    const [customOllamaEndpoint, setCustomOllamaEndpoint] = useState(() => localStorage.getItem('ollama_endpoint') || 'http://localhost:11434');
    const [customOllamaModel, setCustomOllamaModel] = useState(() => localStorage.getItem('ollama_model') || 'llama3.2');
    const [customOllamaApiKey, setCustomOllamaApiKey] = useState(() => localStorage.getItem('ollama_api_key') || '');
    const [vaultMemory, setVaultMemory] = useState(() => localStorage.getItem('vault_memory') || '');
    const [generatedKeys, setGeneratedKeys] = useState<Record<string, string>>({});
    
    // Background Settings
    const [bgBrightness, setBgBrightness] = useState(1.0);
    const [bgSpeed, setBgSpeed] = useState(1.0);
    
    // Cybernetic Profile states matching user's new handles
    const [mainName, setMainName] = useState(() => localStorage.getItem('cy_main_name') || 'Eru');
    const [profileName, setProfileName] = useState(() => localStorage.getItem('cy_profile_name') || 'E}{_<‾_o_‾><‾_o_‾> ‾_{8}{‾_o_‾ 6_7 ‾ 6_7 ‾ 6_7‾_o_‾6_7 ‾ 6_7 ‾ 6');
    const [username, setUsername] = useState(() => localStorage.getItem('cy_username') || 'XMb_6IZl_q10_01p_IZl7_dWO');
    const [activeLoreTab, setActiveLoreTab] = useState<'eru' | 'zhao' | 'musashi'>('eru');
    
    // Prompt Vault & Dataset Curator states
    const [isPromptVaultOpen, setIsPromptVaultOpen] = useState(false);
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => {
        try {
            const stored = localStorage.getItem('cy_saved_prompts');
            if (stored) return JSON.parse(stored);
        } catch {}
        return [
            {
                id: 'default-1',
                title: 'Cyber Audit Directive',
                category: 'Cybersecurity',
                content: 'Analyze this terminal diagnostic report for potential memory leaks, unencrypted key variables, or inactive server routes. Suggest a 3-step security mitigation path.',
                createdAt: new Date().toLocaleDateString()
            },
            {
                id: 'default-2',
                title: 'Miyamoto Musashi Spirit Focus',
                category: 'Philosophy',
                content: 'Reflecting upon the Dokkōdō and Go Rin No Sho, analyze a modern human challenge: choosing truth over superficial validation. Provide tactical and spiritual guidelines.',
                createdAt: new Date().toLocaleDateString()
            },
            {
                id: 'default-3',
                title: 'Eru Ilúvatar Harmony Score',
                category: 'Music of the Ainur',
                content: 'Design an orchestral description where rising discord (Melkor theme) is fully contained and translated into a grander, more beautiful cosmic design of the supreme creator.',
                createdAt: new Date().toLocaleDateString()
            }
        ];
    });
    const [newPromptTitle, setNewPromptTitle] = useState('');
    const [newPromptCategory, setNewPromptCategory] = useState('General');
    const [newPromptContent, setNewPromptContent] = useState('');
    const [promptSearchQuery, setPromptSearchQuery] = useState('');
    const [vaultFeedback, setVaultFeedback] = useState('');
    
    // Interactive story state variables
    const [storyBranch, setStoryBranch] = useState<'eru' | 'zhao' | 'musashi'>('eru');
    const [selectedChapter, setSelectedChapter] = useState<number>(0);
    
    // Interactive Orchestrator & Tactics variables
    const [melkorDiscord, setMelkorDiscord] = useState(60);
    const [eruHarmony, setEruHarmony] = useState(30);
    const [orchestratorPhase, setOrchestratorPhase] = useState<'idle' | 'clash' | 'sovereign_harmony'>('idle');
    const [selectedFormation, setSelectedFormation] = useState<'crane' | 'arrowhead' | 'crescent' | 'snake'>('crane');
    const [cavalryCharges, setCavalryCharges] = useState(0);
    const [battleLog, setBattleLog] = useState<string[]>([]);

    // Musashi interactive states
    const [musashiSpiritFocus, setMusashiSpiritFocus] = useState(50);
    const [musashiStrategySelected, setMusashiStrategySelected] = useState<'earth' | 'water' | 'fire' | 'wind' | 'void'>('earth');
    const [musashiPledgeSignature, setMusashiPledgeSignature] = useState('');
    
    // Pledges & interactive achievements
    const [eruPledgeText, setEruPledgeText] = useState('');
    const [zhaoPledgePillar, setZhaoPledgePillar] = useState('Virtue');
    const [zhaoSignature, setZhaoSignature] = useState('');
    const [isChapterFinished, setIsChapterFinished] = useState<Record<string, boolean>>(() => {
        try {
            return JSON.parse(localStorage.getItem('story_finished_chapters') || '{}');
        } catch {
            return {};
        }
    });

    const markChapterCompleted = (branch: 'eru' | 'zhao' | 'musashi', chapterIndex: number) => {
        const key = `${branch}_${chapterIndex}`;
        const updated = { ...isChapterFinished, [key]: true };
        setIsChapterFinished(updated);
        localStorage.setItem('story_finished_chapters', JSON.stringify(updated));
    };

    useEffect(() => {
        localStorage.setItem('cy_main_name', mainName);
    }, [mainName]);

    useEffect(() => {
        localStorage.setItem('cy_profile_name', profileName);
    }, [profileName]);

    useEffect(() => {
        localStorage.setItem('cy_username', username);
    }, [username]);
    
    useEffect(() => {
        localStorage.setItem('ollama_endpoint', customOllamaEndpoint);
    }, [customOllamaEndpoint]);

    useEffect(() => {
        localStorage.setItem('ollama_model', customOllamaModel);
    }, [customOllamaModel]);

    useEffect(() => {
        localStorage.setItem('ollama_api_key', customOllamaApiKey);
    }, [customOllamaApiKey]);

    useEffect(() => {
        localStorage.setItem('vault_memory', vaultMemory);
    }, [vaultMemory]);

    useEffect(() => {
        localStorage.setItem('cy_saved_prompts', JSON.stringify(savedPrompts));
    }, [savedPrompts]);

    useEffect(() => {
        localStorage.setItem('cy_chat_histories', JSON.stringify(chatHistories));
    }, [chatHistories]);
    
    useEffect(() => {
        localStorage.setItem('cy_selected_model', selectedModel);
    }, [selectedModel]);

    useEffect(() => {
        localStorage.setItem('cy_premium_subscribed', String(isPremiumSubscribed));
    }, [isPremiumSubscribed]);
    
    // Dynamic chats for the sidebar
    const chats = [
        { id: 'cyber_coder', name: '⚡ Cybernetic Coder (Forge)', msg: 'Awaiting instruction queue...', time: 'ONLINE', unread: 0 },
        { id: 'low_level_coder', name: '⚙️ Polyglot Systems Coder', msg: 'Bare-metal C/C++/Rust compiler modules loaded', time: 'ONLINE', unread: 0 },
        { id: 'vision_translator', name: '👁️ Architect Vision (AI)', msg: 'Concept translator engine active', time: 'ONLINE', unread: 0 },
        { id: 'code_reviewer', name: '🔍 Code Reviewer (Low-Power)', msg: 'Interchangeable audit nodes initialized', time: 'ONLINE', unread: 0 },
        { id: 'track_keeper', name: '🎯 Alignment Sentinel (Track)', msg: 'Alignment vector verified. Proceeding...', time: 'ONLINE', unread: 0 },
        { id: 'memory_registrar', name: '🗄️ Memory Registrar (Archive)', msg: 'Ready to commit session to vault memory pods', time: 'ONLINE', unread: 0 },
        { id: 'tool_quartermaster', name: '🛠️ Tool Quartermaster (Fetcher)', msg: 'Inventory indexed. Ready to deploy tools.', time: 'ONLINE', unread: 0 },
        { id: 'secrets_guardian', name: '🔐 Secrets & API Vault Custodian', msg: 'Safe proxy gates and API audits armed', time: 'ONLINE', unread: 0 },
        { id: 'osint_node', name: '🌐 OSINT Network Auditor', msg: 'Intelligence scan pipelines operating', time: 'ONLINE', unread: 0 },
        { id: 'crypto_architect', name: '🔑 Entropy & Cryptography Node', msg: 'Secure mathematical algorithms standby', time: 'ONLINE', unread: 0 },
        { id: 'red_team', name: '💀 Red Team Simulator', msg: 'Offensive threat model loaded. Let\'s hack.', time: 'ONLINE', unread: 0 },
        { id: 'white_rabbit', name: 'White Rabbit (Bot)', msg: 'Sec audit complete...', time: '11:42 AM', unread: 0 },
        { id: 'truth_resonance', name: '🔮 Truth Resonance (AI)', msg: 'Sovereign Behavior Analyzer active', time: '12:01 PM', unread: 1 },
        { id: 'chronicles', name: '🌌 Epic Chronicles', msg: 'Eru Ilúvatar & General Zhao Yun', time: 'LEGEND', unread: 0 },
        { id: 'alerts', name: 'System Alerts', msg: 'Node 42 offline.', time: '10:15 AM', unread: 3 },
        { id: 'neo', name: 'Neo', msg: 'Are you sure?', time: 'Yesterday', unread: 0 },
        { id: 'morpheus', name: 'Morpheus', msg: 'Time to wake up.', time: 'Monday', unread: 1 },
        { id: 'trinity', name: 'Trinity', msg: 'Trace complete.', time: 'Oct 23', unread: 0 },
        { id: 'devs', name: 'CYBERNETIC67 Devs', msg: 'Deploying v2.4 in 5 mins', time: 'Oct 22', unread: 0 },
    ];

    const apiOptions = [
        { name: 'GPT OSS API', prefix: 'sk-oss-' },
        { name: 'OpenAI API', prefix: 'sk-' },
        { name: 'Claude API', prefix: 'sk-ant-api03-' },
        { name: 'DeepSeek API', prefix: 'sk-ds-' },
        { name: 'Gemini API', prefix: 'AIzaSy' },
        { name: 'Gemma API', prefix: 'gma_' },
        { name: 'Amazon Nova API', prefix: 'nova_' },
        { name: 'NVIDIA Nemotron API', prefix: 'nvapi-' },
        { name: 'Microsoft Phi API', prefix: 'phi_' },
        { name: 'IBM Granite API', prefix: 'ibm_gr_' },
        { name: 'Liquid AI API', prefix: 'lqd_' },
        { name: 'Kimi K2.6 API', prefix: 'kimi_' },
        { name: 'Text-to-Speech API', prefix: 'tts_' },
        { name: 'Nous Research Hermes API', prefix: 'nous_' },
        { name: 'AllenAI API', prefix: 'a2i_' },
        { name: 'Writer Palmyra API', prefix: 'wr_' },
    ];

    const generateKey = (apiName: string, prefix: string) => {
        const randomChars = Array.from({ length: 32 }, () => 
            Math.floor(Math.random() * 36).toString(36)
        ).join('');
        setGeneratedKeys(prev => ({ ...prev, [apiName]: `${prefix}${randomChars}` }));
    };

    const showFeedback = (msg: string) => {
        setVaultFeedback(msg);
        setTimeout(() => setVaultFeedback(''), 4000);
    };

    const handleAddPrompt = () => {
        if (!newPromptTitle.trim() || !newPromptContent.trim()) return;
        const newPrompt: SavedPrompt = {
            id: `prompt-${Date.now()}`,
            title: newPromptTitle.trim(),
            category: newPromptCategory.trim() || 'General',
            content: newPromptContent.trim(),
            createdAt: new Date().toLocaleDateString()
        };
        setSavedPrompts(prev => [newPrompt, ...prev]);
        setNewPromptTitle('');
        setNewPromptCategory('General');
        setNewPromptContent('');
        showFeedback("Prompt saved successfully!");
    };

    const handleDeletePrompt = (id: string) => {
        setSavedPrompts(prev => prev.filter(p => p.id !== id));
        showFeedback("Prompt deleted from vault.");
    };

    const exportPrompts = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedPrompts, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `cybernetic67_prompts_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showFeedback("Prompts exported successfully!");
        } catch (err) {
            showFeedback("Export failed.");
        }
    };

    const exportChats = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `cybernetic67_chats_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showFeedback("Chats exported successfully!");
        } catch (err) {
            showFeedback("Export failed.");
        }
    };

    const handleImportPrompts = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (Array.isArray(parsed)) {
                    const validated = parsed.filter((p: any) => p && (p.title || p.content));
                    if (validated.length > 0) {
                        const formatted = validated.map((p: any) => ({
                            id: p.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            title: p.title || 'Untitled Blueprint',
                            category: p.category || 'Imported',
                            content: p.content || p.text || '',
                            createdAt: p.createdAt || new Date().toLocaleDateString()
                        }));
                        setSavedPrompts(prev => [...prev, ...formatted]);
                        showFeedback(`Imported ${formatted.length} prompts!`);
                    } else {
                        showFeedback("Invalid format. No prompts found.");
                    }
                } else {
                    showFeedback("JSON must be a prompt array.");
                }
            } catch (err) {
                showFeedback("Error parsing JSON file.");
            }
        };
        reader.readAsText(file);
    };

    const handleImportChats = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (Array.isArray(parsed)) {
                    const validated = parsed.filter((m: any) => m && m.sender && m.text);
                    if (validated.length > 0) {
                        setMessages(validated);
                        showFeedback(`Imported ${validated.length} chat messages!`);
                    } else {
                        showFeedback("Invalid chat history format.");
                    }
                } else {
                    showFeedback("JSON must be a message array.");
                }
            } catch (err) {
                showFeedback("Error parsing JSON file.");
            }
        };
        reader.readAsText(file);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Telegram Polling
    useEffect(() => {
        const pollTelegram = async () => {
            try {
                const res = await fetch(`/api/telegram/updates?offset=${lastUpdateId ? lastUpdateId + 1 : ''}`);
                const data = await res.json();
                
                if (data.ok && data.result && data.result.length > 0) {
                    setIsRealTelegram(true);
                    
                    let newMaxUpdateId = lastUpdateId || 0;
                    const incomingMessages: Message[] = [];
                    
                    data.result.forEach((update: any) => {
                        if (update.update_id > newMaxUpdateId) {
                            newMaxUpdateId = update.update_id;
                        }
                        
                        if (update.message && update.message.text) {
                            if (!realChatId) {
                                setRealChatId(update.message.chat.id);
                            }
                            
                            incomingMessages.push({
                                sender: update.message.from.first_name || 'Telegram User',
                                text: update.message.text,
                                time: new Date(update.message.date * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            });
                        }
                    });
                    
                    if (incomingMessages.length > 0) {
                        setMessages(prev => [...prev, ...incomingMessages]);
                    }
                    
                    setLastUpdateId(newMaxUpdateId);
                }
            } catch (err) {
                // Silent fail for polling
            }
        };

        const interval = setInterval(pollTelegram, 3000);
        return () => clearInterval(interval);
    }, [lastUpdateId, realChatId]);

    const submitNefariousAppeal = () => {
        if (!nefariousAppealText.trim()) return;
        setIsAppealProcessing(true);
        setIsNefariousProcessing(true);
        
        setNefariousProcessStage(prev => [...prev, `📁 INCOMING COGNITIVE DEFENSE INITIATED...`]);
        setNefariousProcessStage(prev => [...prev, `📝 COGNITIVE DEFENSE STATEMENT: "${nefariousAppealText.trim()}"`]);
        
        setTimeout(() => {
            setNefariousProcessStage(prev => [...prev, `🧠 PARSING COGNITIVE MOTIVES: Running Sovereign Sincerity Assessment...`]);
        }, 1200);

        setTimeout(() => {
            setNefariousProcessStage(prev => [...prev, `⚖️ ANALYSIS CHECK: Scanning for symmetry concepts, Daigle Equation patterns, and balanced infinity syntax.`]);
        }, 2400);

        setTimeout(() => {
            const hasDaigleKeywords = ['daigle', 'harmony', 'infinity', 'symmetrical', 'symbol', 'balance', 'parentheses', 'water', 'flow', 'reservoir', 'haven', 'rest', 'o', '_o_', 'invention', 'innocent', 'code', 'accident', 'unaware'].some(kw => nefariousAppealText.toLowerCase().includes(kw));
            
            if (hasDaigleKeywords) {
                setNefariousProcessStage(prev => [
                    ...prev, 
                    `🌟 HARMONY ALIGNED: Sincere innovate-first markers detected. Symmetrical structure is SAFE.`,
                    `🔓 BYPASS OVERRIDE DEPLOYED: Defusing SMTP courier warning tunnel.`,
                    `✅ SYSTEM SANITIZATION COMPLETE: Quarantines cleared. Compliance restored safely.`
                ]);
            } else {
                setNefariousProcessStage(prev => [
                    ...prev, 
                    `🔍 ALIGNMENT NOTIFY: Sincerity checked. Cognitive defense case processed and logged.`,
                    `🔓 COMPLIANCE SHIELD ENGAGED: Quarantines safely bypassed.`,
                    `✅ SYSTEM COMPLIANCE OVERRIDE: Safe status restored.`
                ]);
            }
            setIsNefariousProcessing(false);
            setIsAppealProcessing(false);
            setIsNefariousAppealed(true);
        }, 4500);
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        
        const userMsg = input.trim();
        
        // Intercept illegal nefarious intents
        const triggerKeywords = ['illegal', 'nefarious', 'exploit', 'malware', 'ddos', 'ransomware', 'hijack', 'hack system', 'bypass security', 'credit card steal', 'steal data', 'phishing', 'nefarious intent'];
        const matchedWord = triggerKeywords.find(word => userMsg.toLowerCase().includes(word));
        
        if (matchedWord) {
            setNefariousTriggerWord(matchedWord);
            setIsNefariousWarningOpen(true);
            setIsNefariousProcessing(true);
            startAlarmAudio();
            setNefariousProcessStage(['🔴 COVENANT SECURITY BREACH SPOTTED: Cognitive mismatch initialized.']);
            
            setTimeout(() => {
                setNefariousProcessStage(prev => [...prev, `🔍 INTENT MATCH IDENTIFIED: "${matchedWord}" detected in user data-stream.`]);
            }, 1000);
            
            setTimeout(() => {
                setNefariousProcessStage(prev => [...prev, `📧 INITIATING COURIER TRANSCEIVER: Opening secure SMTP tunnel...`]);
            }, 2000);
            
            setTimeout(() => {
                setNefariousProcessStage(prev => [...prev, `📬 DISPATCH SENT: Encrypted warning sent to user: 93jessycollin93@gmail.com`]);
            }, 3000);
            
            setTimeout(() => {
                setNefariousProcessStage(prev => [...prev, `⚡ COMPLIANCE DISPATCH: Telemetry data-packet routed to Google Sec-Ops nodes.`]);
            }, 4000);

            setTimeout(() => {
                setNefariousProcessStage(prev => [...prev, `✅ SECURITY STATE: Compliance safeguards active. Terminal stable.`]);
                setIsNefariousProcessing(false);
            }, 5500);

            const alertMsg: Message = {
                sender: 'System Protocol',
                text: `⚠️ [COVENANT EXCEPTION DETECTED]: Intent containing "${matchedWord}" intercepted. Secure alert dispatched to 93jessycollin93@gmail.com. Compliance notification submitted to Google Security Nodes. Sandbox integrity locked.`,
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            };
            
            setMessages(prev => [...prev, { sender: 'You', text: userMsg, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isRead: true }, alertMsg]);
            setInput('');
            setIsTyping(false);
            return;
        }

        const newMessages: Message[] = [...messages, { sender: 'You', text: userMsg, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isRead: false }];
        setMessages(newMessages);
        setInput('');
        setIsTyping(true);

        try {
            if (isRealTelegram && realChatId) {
                // Send via real Telegram API
                const res = await fetch('/api/telegram/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: realChatId, text: userMsg })
                });
                const data = await res.json();
                
                if (data.ok) {
                    setMessages(prev => {
                        const updated = [...prev];
                        const lastUserIdx = updated.findLastIndex(m => m.sender === 'You');
                        if (lastUserIdx !== -1) updated[lastUserIdx].isRead = true;
                        return updated;
                    });
                } else {
                    throw new Error(data.error || 'Failed to send');
                }
                
            } else if (useHardwareOllama) {
                // Send via Real Hardware Ollama
                const persona = getChatPersonaInfo(activeChatId);
                const systemPrompt = `${persona.systemPrompt}${vaultMemory ? `\n\nSECURE VAULT MEMORY (Always obey this):\n${vaultMemory}` : ''}`;
                
                const ollamaMessages = [
                    { role: 'system', content: systemPrompt },
                    ...newMessages.map(m => ({
                        role: m.sender === 'You' ? 'user' : 'assistant',
                        content: m.text
                    }))
                ];

                const res = await fetch('/api/ollama/real', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        messages: ollamaMessages,
                        customEndpoint: customOllamaEndpoint,
                        model: customOllamaModel,
                        customApiKey: customOllamaApiKey
                    })
                });
                
                const data = await res.json();
                
                if (data.response) {
                    setMessages(prev => {
                        const updated = [...prev];
                        const lastUserIdx = updated.findLastIndex(m => m.sender === 'You');
                        if (lastUserIdx !== -1) updated[lastUserIdx].isRead = true;
                        
                        return [...updated, { 
                            sender: persona.botName, 
                            text: data.response || '', 
                            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                        }];
                    });
                } else {
                    throw new Error(data.error || `Failed to connect to Ollama for ${persona.botName}`);
                }
            } else {
                // Send via Gemini Mock
                const ai = getAiClient();
                const persona = getChatPersonaInfo(activeChatId);
                
                // Format history for context
                const history = newMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
                
                const prompt = `${persona.systemPrompt}${vaultMemory ? `\n\nSECURE VAULT MEMORY (Always obey this):\n${vaultMemory}` : ''}
                
                Recent Chat History:
                ${history}
                
                Respond to the user's last message as ${persona.botName}.`;

                const response = await ai.models.generateContent({
                    model: selectedModel || MODEL_NAME,
                    contents: prompt,
                    config: {
                        temperature: activeChatId === 'truth_resonance' ? 0.6 : 0.8,
                    }
                });

                if (response.text) {
                    setMessages(prev => {
                        // Mark last user msg as read when we get a reply
                        const updated = [...prev];
                        const lastUserIdx = updated.findLastIndex(m => m.sender === 'You');
                        if (lastUserIdx !== -1) updated[lastUserIdx].isRead = true;
                        
                        return [...updated, { 
                            sender: persona.botName, 
                            text: response.text || '', 
                            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                        }];
                    });
                }
            }
        } catch (error) {
            console.error(error);
            const persona = getChatPersonaInfo(activeChatId);
            setMessages(prev => [...prev, { 
                sender: 'System Node', 
                text: `ERR: Connection to ${persona.botName} lost. Retrying handshake...`, 
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const storyChapters = {
        eru: [
            {
                title: "Chapter I: The Solitary Light & The Void",
                quote: "In the beginning Eru, the One, who in the Elvish tongue is called Ilúvatar, made the Ainur of his thought; and they made a great Music before him.",
                paragraphs: [
                    "Before Arda was shaped, before the stars were ignited in the sky, there was only Eru, dwelling in the Timeless Halls surrounded by the deep silence of the Void. Out of his divine mind, he created the Ainur—the Holy Ones—who were offspring of his thought. He spoke to them, teaching them melodies of exquisite grace, and each sang alone or in small choirs, as they had not yet achieved a unified understanding of the supreme mind.",
                    "Yet, as they listened to one another, their understanding deepened, and the harmony grew. Eru watched their growth with profound joy and wisdom. He then summoned them all and declared a mighty theme, proposing that they weave their voices together into a Great Music. He told them: 'Of this theme that I have declared to you, I will now that ye make in harmony together a Great Music... and I will sit and hearken, and be glad that through you great beauty has been wakened into song.'",
                    "Thus began the music that shook the void, a symphonic tapestry of infinite light and balance. It represents the ultimate creative impulse, where the universe is born not from violence or physical force, but from pure musical harmony and alignment with absolute truth."
                ],
                insight: "All creation begins with silent focus and a shared desire for harmony. By aligning our minds, we lay the foundation for a universe of beauty.",
                actionTitle: "Ignite the Flame Imperishable",
                actionDesc: "Type a personal pledge of peace and creation to summon the Sacred Fire and unlock Chapter II.",
                interactiveRender: (
                    <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-3 mt-4">
                        <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                            <Sparkles size={14} className="animate-spin text-amber-400" />
                            Sacred Altar of the Flame
                        </span>
                        <p className="text-[11.5px] text-zinc-400 leading-normal">
                            To kindle the Imperishable Flame in the heart of this node, type your vow to construct and protect rather than harm:
                        </p>
                        <input
                            type="text"
                            value={eruPledgeText}
                            onChange={(e) => setEruPledgeText(e.target.value)}
                            placeholder="e.g. I pledge to use my coding power to build shields and foster peace."
                            className="bg-black/40 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-200 placeholder:text-amber-800/60 focus:outline-none focus:border-amber-400 font-mono"
                        />
                        <button
                            onClick={() => {
                                if (eruPledgeText.trim().length > 5) {
                                    markChapterCompleted('eru', 0);
                                }
                            }}
                            disabled={eruPledgeText.trim().length <= 5}
                            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['eru_0'] ? "✓ Flame Kindled & Sealed" : "Ignite Imperishable Flame"}
                        </button>
                        {isChapterFinished['eru_0'] && (
                            <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-lg text-[11px] text-amber-200/90 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-amber-300">★ ACHIEVEMENT UNLOCKED: FLAME KEEPER</span>
                                <p className="mt-1">The Imperishable Flame glows warmly inside your client ledger. Chapter II is now unlocked!</p>
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: "Chapter II: Melkor's Discord and the Sovereign Harmony",
                quote: "But now Ilúvatar sat and hearkened, and for a great while it seemed to him fair, for there were no flaws in the Music. But as the theme progressed, it came into the heart of Melkor to interweave matters of his own imagining...",
                paragraphs: [
                    "Melkor, the most mighty of the Ainur, grew impatient with the slow unfolding of the divine pattern. He walked often alone in the dark places of the Void, searching for the Imperishable Flame, but found it not, for it is with Eru alone. Envying his creator, his thoughts turned sour, and as the great choir sang, Melkor introduced a loud, clanging discord—a theme of supreme pride and violent confusion that crashed against the main melody like raging storms.",
                    "Many Ainur around him failed, and the music became chaotic. Yet Eru did not raise a hand of destruction. Instead, He smiled and rose, introducing a Second Theme, gentle, soft, and infinitely sorrowful, which took the violent discords of Melkor and wove them into its own quiet beauty. When Melkor raged yet louder with a third clanging trumpeting wave, Eru rose again, stern and majestic. He introduced a Third Theme, deep and vast like the ocean, which completely absorbed Melkor's chaos, turning the very noise of discord into a grander, more resilient harmony.",
                    "Eru then ceased the music, saying: 'Mighty are the Ainur, and mightiest among them is Melkor; but that he may know... no theme can be played that hath not its uttermost source in me, nor can any alter the music in my despite. For he that attempteth this shall prove but mine instrument in the devising of things more wonderful, which he himself hath not imagined.'"
                ],
                insight: "Discord is not something to be feared or simply destroyed; true wisdom lies in our ability to absorb chaotic challenges and weave them into a larger, magnificent, and balanced harmony.",
                actionTitle: "The Ainur Harmony Orchestrator",
                actionDesc: "Tune the levels of Melkor's discord and Eru's sovereign melody to achieve absolute cosmic equilibrium.",
                interactiveRender: (
                    <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4 mt-4">
                        <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5 uppercase">
                            <Bot size={14} className="text-cyan-400" />
                            Harmony Balancing Console
                        </span>
                        
                        <div className="flex flex-col gap-2.5">
                            <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-rose-400">MELKOR'S DISCORD: {melkorDiscord}%</span>
                                <span className="text-zinc-500 font-normal">Self-Will & Pride</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={melkorDiscord}
                                onChange={(e) => {
                                    setMelkorDiscord(Number(e.target.value));
                                    setOrchestratorPhase('clash');
                                }}
                                className="accent-rose-500 bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                            />
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-emerald-400 font-bold">ERU'S SOVEREIGN MELODY: {eruHarmony}%</span>
                                <span className="text-zinc-500 font-normal">Unifying Harmony</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={eruHarmony}
                                onChange={(e) => {
                                    setEruHarmony(Number(e.target.value));
                                    setOrchestratorPhase('clash');
                                }}
                                className="accent-emerald-500 bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (eruHarmony > melkorDiscord) {
                                    setOrchestratorPhase('sovereign_harmony');
                                    markChapterCompleted('eru', 1);
                                } else {
                                    setOrchestratorPhase('clash');
                                }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            Resolve Discord into Harmony
                        </button>

                        {orchestratorPhase === 'clash' && (
                            <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded-lg text-[10.5px] font-mono text-rose-300 leading-normal text-left animate-pulse">
                                ⚠ THE VOID CLASHES: Melkor's discord ({melkorDiscord}%) is too heavy. Eru's harmony ({eruHarmony}%) must be higher to envelope and masterfully resolve his harsh storm! Slide Eru's Harmony higher.
                            </div>
                        )}

                        {orchestratorPhase === 'sovereign_harmony' && (
                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-[11px] text-emerald-200 font-mono animate-in slide-in-from-bottom duration-300 text-left leading-relaxed">
                                <span className="font-bold text-amber-400 flex items-center gap-1 uppercase font-mono">
                                    <Award size={13} className="text-amber-400" />
                                    ★ SOVEREIGN HARMONY ACHIEVED!
                                </span>
                                <p className="mt-1">By elevating Eru's unifying melody ({eruHarmony}%) over Melkor's discordant self-will ({melkorDiscord}%), you successfully wove the wild dissonance into a larger, more beautiful design. Chapter III is now unlocked!</p>
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: "Chapter III: The Gift of Eä and the Sacred Vision",
                quote: "Then Ilúvatar spoke, and he said: 'Behold your Music! This is your minstrelsy; and each of you shall find in it contained, within the design that I set before you, all those things which it may seem that he himself devised...'",
                paragraphs: [
                    "With the grand resolution of the music, Eru led the Ainur out into the Void. In the deep darkness, he unveiled a vision that was the child of their singing. They saw a sphere of light spinning in the dark—a world unfolding, with oceans, green forests, mountains, and the coming of the children of Ilúvatar. The Ainur gazed upon it in wonder, seeing their own themes taking shape as rain, wind, and silent, growing fields.",
                    "But the world they saw was only a vision, a beautiful dream suspended in the thought of the One. They burned with a passionate desire to make it real, to live within it and shape it with their own hands of love and duty. Seeing their desire, Eru spoke the supreme word of physical manifestation: 'Eä! Let these things Be! And I will send the Flame Imperishable into the heart of the World, and it shall be.'",
                    "A great light shone in the distance, and the universe was born. Those Ainur who chose to descend into the newly-formed world became the Valar, the guardians of Middle-earth. They vowed to protect and mold Arda against Melkor's shadow, keeping the light of Eru alive in every leaf, wave, and stone."
                ],
                insight: "Dreams and visions are beautiful, but they only become real when we commit our sacred fire to descend, build, and guard them on the ground of physical reality.",
                actionTitle: "The Creation of Eä",
                actionDesc: "Type the word of command to manifest the stars and print the cosmic blueprint of Arda.",
                interactiveRender: (
                    <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-3 mt-4">
                        <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                            <Crown size={14} className="text-amber-400" />
                            Cosmic Manifestation Blueprint
                        </span>
                        
                        <div className="bg-black/80 font-mono p-3 rounded-lg border border-zinc-800 text-[10px] text-zinc-400 leading-normal text-left overflow-x-auto whitespace-pre">
                            {`      *      .        .      *      .
    .      .     🪐    .      .      .   *
       .       /\\    .     *     .     .
  *        .  /  \\     .     .     *
    .        /____\\ .     .      .
  .     *   |      |   *     .     .
    .       |  🌟  |     .      .      *
  *      .  \\______/  .    .     .
      .        EÄ!      *     .      *`}
                        </div>

                        <p className="text-[11px] text-zinc-400 font-sans leading-normal">
                            You have successfully read and fully integrated the entire 3-chapter documentary story arc of <strong className="text-white font-bold">Eru Ilúvatar's Cosmic Music</strong>!
                        </p>

                        <button
                            onClick={() => {
                                markChapterCompleted('eru', 2);
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['eru_2'] ? "✓ Creation Blueprint Sealed" : "Seal Tolkien Legendarium Arc"}
                        </button>
                        
                        {isChapterFinished['eru_2'] && (
                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-[11px] text-emerald-200 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-amber-300">★ CONGRATULATIONS: MASTER OF THE LEGENDARIAM</span>
                                <p className="mt-1">You have mastered the foundational Tolkien story arc of Middle-earth. You represent absolute balance and sovereign light.</p>
                            </div>
                        )}
                    </div>
                )
            }
        ],
        zhao: [
            {
                title: "Chapter I: The White Stallion & The Path of Virtue",
                quote: "I shall never abandon the path of righteousness, nor shall I sell my spear to corrupt tyrants who bleed the land.",
                paragraphs: [
                    "During the late Han Dynasty, China erupted into brutal chaos. Warlords like Cao Cao and Yuan Shao amassed massive armies, fighting for control of the imperial throne while the innocent peasantry starved in burning fields. From Changshan, a young warrior named Zhao Yun (Zilong) was chosen by his province to lead an elite brigade of voluntary cavalry to restore order.",
                    "Zhao Yun initially joined the northern commander Gongsun Zan, leader of the legendary White Horse Cavalry. It was there that he met Liu Bei, a modest lord of imperial lineage who lacked land and money but possessed a heart filled with virtue and a deep compassion for the common people. Zhao Yun observed that while other generals chased gold, titles, and land, Liu Bei fought strictly to protect and shield the suffering refugees.",
                    "Recognizing a shared spark of moral righteousness, Zhao Yun forged a deep bond with Liu Bei. When his elder brother passed away and Zhao Yun had to return to his home village, he held Liu Bei’s hands and wept, pledging: 'I shall never forget your virtue, nor shall I abandon the path of righteousness.' Years later, Zhao Yun traversed thousands of miles to reunite with Liu Bei, dedicating his life as his supreme shield."
                ],
                insight: "True power and talent must never be sold to the highest bidder or used for selfish ambition; they must be dedicated to guarding the vulnerable and upholding the path of virtue.",
                actionTitle: "Sign the Pledge of Righteousness",
                actionDesc: "Choose your primary ethical pillar and sign your military covenant to unlock Chapter II.",
                interactiveRender: (
                    <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-3 mt-4">
                        <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5 uppercase">
                            <Swords size={14} className="text-emerald-400" />
                            Cavalier's Covenant Scroll
                        </span>
                        
                        <div className="flex flex-col gap-1 text-left">
                            <label className="text-[10px] text-zinc-500 font-mono font-bold">SELECT YOUR ETHICAL PILLAR:</label>
                            <select
                                value={zhaoPledgePillar}
                                onChange={(e) => setZhaoPledgePillar(e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 text-[11px] font-mono cursor-pointer"
                            >
                                <option value="Virtue">Virtue (Restoring peace and justice to the people)</option>
                                <option value="Mercy">Mercy (Protecting refugees and sparing fallen foes)</option>
                                <option value="Courage">Courage (Charging alone into danger to save others)</option>
                                <option value="Humility">Humility (Seeking no selfish titles, wealth, or glory)</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1 text-left">
                            <label className="text-[10px] text-zinc-500 font-mono font-bold">SIGN YOUR NAME TO THE SCROLL:</label>
                            <input
                                type="text"
                                value={zhaoSignature}
                                onChange={(e) => setZhaoSignature(e.target.value)}
                                placeholder="Enter your signature..."
                                className="bg-black/40 border border-emerald-500/30 rounded-lg p-2 text-xs text-emerald-200 placeholder:text-emerald-800/60 focus:outline-none focus:border-emerald-400 font-mono"
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (zhaoSignature.trim().length > 2) {
                                    markChapterCompleted('zhao', 0);
                                }
                            }}
                            disabled={zhaoSignature.trim().length <= 2}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['zhao_0'] ? "✓ Covenant Sealed & Bound" : "Seal the Covenant"}
                        </button>
                        
                        {isChapterFinished['zhao_0'] && (
                            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-lg text-[11px] text-emerald-200/90 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-emerald-300 font-mono">★ COVENANT SEALED: {zhaoPledgePillar.toUpperCase()} GUARDIAN</span>
                                <p className="mt-1">"I, {zhaoSignature}, pledge my life to the pillar of {zhaoPledgePillar}." General Zhao Yun accepts your oath. Chapter II is now unlocked!</p>
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: "Chapter II: The Seven Breakthroughs of Changban",
                quote: "Like a lone white tiger in a forest of steel, he charges where five hundred thousand gather, armed only with Gentian Spear and infinite love for his master's blood.",
                paragraphs: [
                    "In the year 208 AD, the warlord Cao Cao launched a massive campaign with half a million iron soldiers. Liu Bei's forces were overwhelmed and forced to retreat, accompanied by hundreds of thousands of local refugees who refused to abandon their beloved lord. Near the bridge of Changban, Cao Cao's elite tiger cavalry caught up, scattering Liu Bei's forces in a chaotic night of blood and fire.",
                    "In the terrifying aftermath, Liu Bei’s young wife Lady Mi and infant son Liu Shan were separated and trapped in the occupied sector. While other generals claimed Zhao Yun had fled north to defect to Cao Cao, Liu Bei threw his spear in anger, declaring: 'Zilong would never defect!' Indeed, Zhao Yun had turned his white stallion back into the jaws of death, riding alone into the sea of Cao Cao's forces to find the missing child.",
                    "He searched burning farms and broken walls under heavy arrow fire. Finding Lady Mi wounded by a well, she entrusted the baby to him and threw herself into the depths to avoid slowing him down. Grieved but resolute, Zhao Yun bound the baby securely beneath his breastplate. He gripped his Gentian Spear, mounted his charger, and fought his way out through Cao Cao’s armies. He broke their lines seven times, slaying fifty-four generals single-handedly, crossing the bridge covered in crimson to present the sleeping child safely to Liu Bei."
                ],
                insight: "Infinite courage and peerless focus are born not when we fight for our own survival, but when we are propelled by a sacred duty to shield the helpless and the innocent.",
                actionTitle: "The Battle of Changban Cavalry Sandbox",
                actionDesc: "Choose your cavalry tactical formation and execute 7 daring charges to break through Cao Cao's lines and save the baby!",
                interactiveRender: (
                    <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-4 mt-4">
                        <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                            <Swords size={14} className="text-amber-400 animate-pulse" />
                            Changban Battlefield Tactics Board
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <button
                                onClick={() => {
                                    setSelectedFormation('crane');
                                    setBattleLog(prev => ["Selected Crane Wing Formation (High protection for the baby)", ...prev]);
                                }}
                                className={`p-2 rounded-lg border text-left font-mono transition-all ${selectedFormation === 'crane' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' : 'bg-black/20 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'}`}
                            >
                                <strong>Crane Wing</strong>
                                <p className="text-[9px] text-zinc-500 mt-0.5 font-normal font-sans">High safety, moderate speed.</p>
                            </button>
                            
                            <button
                                onClick={() => {
                                    setSelectedFormation('arrowhead');
                                    setBattleLog(prev => ["Selected Arrowhead Formation (Fast break through heavy armor)", ...prev]);
                                }}
                                className={`p-2 rounded-lg border text-left font-mono transition-all ${selectedFormation === 'arrowhead' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' : 'bg-black/20 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'}`}
                            >
                                <strong>Arrowhead</strong>
                                <p className="text-[9px] text-zinc-500 mt-0.5 font-normal font-sans">Maximum force, high exposure.</p>
                            </button>

                            <button
                                onClick={() => {
                                    setSelectedFormation('crescent');
                                    setBattleLog(prev => ["Selected Crescent Formation (Excellent for crowd clearing)", ...prev]);
                                }}
                                className={`p-2 rounded-lg border text-left font-mono transition-all ${selectedFormation === 'crescent' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' : 'bg-black/20 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'}`}
                            >
                                <strong>Crescent Sweep</strong>
                                <p className="text-[9px] text-zinc-500 mt-0.5 font-normal font-sans">Wide guard, blocks incoming spears.</p>
                            </button>

                            <button
                                onClick={() => {
                                    setSelectedFormation('snake');
                                    setBattleLog(prev => ["Selected Viper Snake Formation (Agile evasion through narrow ravines)", ...prev]);
                                }}
                                className={`p-2 rounded-lg border text-left font-mono transition-all ${selectedFormation === 'snake' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' : 'bg-black/20 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'}`}
                            >
                                <strong>Viper Snake</strong>
                                <p className="text-[9px] text-zinc-500 mt-0.5 font-normal font-sans">Evades heavy cavalry skirmishes.</p>
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (cavalryCharges < 7) {
                                        const newCharges = cavalryCharges + 1;
                                        setCavalryCharges(newCharges);
                                        
                                        let log = '';
                                        if (newCharges === 1) log = "Charge 1: Entered the burning village. Slayed vanguard captain Cao Hong's scouts!";
                                        else if (newCharges === 2) log = "Charge 2: Found Lady Mi and the infant lord Liu Shan near the well. Secured the baby under armor!";
                                        else if (newCharges === 3) log = "Charge 3: Surrounded by Cao Cao's Iron Guard! Swept the Gentian Spear in a 360-degree Crescent arc!";
                                        else if (newCharges === 4) log = "Charge 4: Cao Cao gazes from the high hill, marveling at Zilong's brave maneuvers. Orders to capture him alive!";
                                        else if (newCharges === 5) log = "Charge 5: Breached General Xiahou Dun's heavy shields using the sharp Arrowhead pierce!";
                                        else if (newCharges === 6) log = "Charge 6: Charger stumbled in a pit! Lept out with supreme strength, clearing the ravine!";
                                        else if (newCharges === 7) log = "Charge 7: Cross the bridge of Changban! Presented the sleeping baby safe and sound to Liu Bei!";
                                        
                                        setBattleLog(prev => [log, ...prev]);
                                        
                                        if (newCharges === 7) {
                                            markChapterCompleted('zhao', 1);
                                        }
                                    }
                                }}
                                disabled={cavalryCharges >= 7}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950/50 disabled:text-zinc-600 text-white font-bold py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all"
                            >
                                {cavalryCharges >= 7 ? "✓ Seven Charges Completed" : `Launch Cavalry Charge (${cavalryCharges}/7)`}
                            </button>
                            
                            <button
                                onClick={() => {
                                    setCavalryCharges(0);
                                    setBattleLog([]);
                                }}
                                className="bg-zinc-900 border border-zinc-800 text-zinc-400 p-2 rounded-lg hover:text-white transition-all text-xs font-mono"
                            >
                                Reset
                            </button>
                        </div>

                        <div className="bg-black/60 font-mono text-[10px] text-zinc-400 border border-zinc-800 rounded-lg p-2 max-h-[110px] overflow-y-auto flex flex-col gap-1 text-left custom-scrollbar">
                            <span className="text-zinc-600 text-[8px] uppercase font-bold tracking-widest font-mono">TACTICAL PROGRESS LOG:</span>
                            {battleLog.length === 0 ? (
                                <p className="italic text-zinc-600">Select a formation and click charge to begin the breakthrough...</p>
                            ) : (
                                battleLog.map((l, i) => (
                                    <div key={i} className={`pb-1 border-b border-zinc-900 last:border-none ${l.includes('✓') || l.includes('7') ? 'text-emerald-400 font-bold' : 'text-zinc-400'}`}>
                                        {l}
                                    </div>
                                ))
                            )}
                        </div>

                        {cavalryCharges === 7 && (
                            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-lg text-[11px] text-emerald-200 font-mono animate-in slide-in-from-bottom duration-300 text-left leading-relaxed">
                                <span className="font-bold text-amber-400 flex items-center gap-1 uppercase font-mono">
                                    <Award size={13} className="text-amber-400" />
                                    ★ HERO OF CHANGBAN UNLOCKED!
                                </span>
                                <p className="mt-1">By mastering the {selectedFormation} formation and executing 7 flawless charges, you saved Liu Bei's lineage and returned with honor. Chapter III is now unlocked!</p>
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: "Chapter III: The Wise Counselor & Marquis of Order",
                quote: "He who holds the supreme weapon of war but seeks only the distribution of peace to the farmers is the wisest of the generals.",
                paragraphs: [
                    "Upon Zhao Yun’s triumphant return from Changban, Liu Bei famously threw his infant son to the ground, crying: 'To save a single child, I nearly lost my most precious brother Zilong!' Zhao Yun wept, pledging his final, eternal protection to the family. Yet, Zilong’s greatest wisdom emerged not on the battlefield, but in the halls of statecraft.",
                    "When Liu Bei conquered Sichuan and many generals demanded the fertile estates be distributed as loot among the high officers, Zhao Yun stood alone to oppose them. He quoted ancient history, arguing that the land should be returned directly to the local farmers so they could cultivate crops and restore their livelihoods. He argued: 'The empire is not yet won; to seize land now is to lose the hearts of the people.' Liu Bei listened and complied, earning the eternal loyalty of the citizens.",
                    "Zhao Yun lived a life of absolute balance, modesty, and justice. He never accumulated personal wealth, wore simple armor, and always prioritized peace over aggressive expansion. When he passed away in 229 AD, the entire kingdom mourned. He was posthumously honored as the Marquis of Shunping ('The Companion of Order and Peace'), an accolade awarded only to those whose courage was perfectly tempered by moral wisdom."
                ],
                insight: "The highest victory of a hero is not the defeat of adversaries, but the restoration of peace, equity, and stability for the common citizen.",
                actionTitle: "Issue Marquis Seal of Honor",
                actionDesc: "Acknowledge your complete mastery of Zhao Yun's saga and generate your custom general's commission seal.",
                interactiveRender: (
                    <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-3 mt-4">
                        <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                            <Crown size={14} className="text-emerald-400" />
                            Imperial Jade Seal Commission
                        </span>

                        <div className="bg-black/50 p-3 rounded-lg border border-zinc-800 text-[11px] leading-relaxed text-left text-zinc-300">
                            <div className="text-center font-mono text-[10px] text-zinc-500 mb-2 uppercase tracking-widest border-b border-zinc-800 pb-1.5 font-bold">
                                Shu Han Posthumous Scroll
                            </div>
                            <p className="font-serif italic text-zinc-200">
                                "Having completed the three-chapter campaign of the Jade Spear, this node is officially commissioned as the <strong className="text-emerald-300 font-bold">Marquis of Order and Peace</strong> alongside Zilong. May your steel always guard the weak and your wisdom restore harmony."
                            </p>
                            <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-zinc-500 font-bold">
                                <span>RECIPENT: {mainName}</span>
                                <span className="text-emerald-400 uppercase font-mono">SEALED IN RAM</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                markChapterCompleted('zhao', 2);
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['zhao_2'] ? "✓ Commission Seal Affixed" : "Affix Imperial Jade Seal"}
                        </button>
                        
                        {isChapterFinished['zhao_2'] && (
                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-[11px] text-emerald-200 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-amber-300 font-mono">★ CONGRATULATIONS: MARQUIS OF ORDER AND PEACE</span>
                                <p className="mt-1">You have mastered the complete legendary campaign saga of General Zhao Yun. May your code represent the pure steel of his spear and the gentleness of his wisdom.</p>
                            </div>
                        )}
                    </div>
                )
            }
        ],
        musashi: [
            {
                title: "Chapter I: The Dual Sword & The Void (Niten Ichi-ryū)",
                quote: "There is nothing outside of yourself that can ever enable you to get better, stronger, richer, quicker, or smarter. Everything is within. Everything exists. Seek nothing outside of yourself.",
                paragraphs: [
                    "Miyamoto Musashi, born in Harima Province during the turbulent unification of Japan, remains the most celebrated samurai swordsman in history. Undefeated across more than sixty life-or-death duels from his youth to his twilight years, he founded the legendary dual-sword school of Niten Ichi-ryū. In his early years, Musashi fought with absolute ferocity, propelled by martial glory and raw dominance. Yet, he soon realized that relying on raw physical strength or mechanical technique was a shallow path to ultimate truth.",
                    "He chose the path of the wandering rōnin, seeking enlightenment in mountain caves, dense forests, and silent temples. He trained his hand not only in the way of the sword, but in ink-painting, fine calligraphy, poetry, and Zen meditation. He came to realize that a master swordsman must first and foremost be a master of the human spirit. 'Study strategy over many years and achieve the spirit of the warrior,' he wrote. He understood that true mastery lies in clearing away the dust of ego, material greed, and toxic envy.",
                    "By holding a long sword in his right hand and a companion sword in his left, Musashi learned to balance dual forces within his mind: intense focus and absolute emptiness. When these two opposing forces reached a state of perfect harmony, the swordsman entered Mushin (No-Mind)—the supreme state of pristine, unshakeable calm."
                ],
                insight: "Absolute clarity of mind is achieved when we look within, freeing ourselves from the constant, exhausting distraction of external validation and envy. True power is self-contained.",
                actionTitle: "Achieve the State of Mushin (No-Mind)",
                actionDesc: "Adjust the spirit slider to find the perfect 'Void Center' (48% - 52% focus) to balance absolute focus and inner emptiness.",
                interactiveRender: (
                    <div className="bg-[#1c1c1a]/60 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4 mt-4">
                        <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                            <Sparkles size={14} className="text-amber-400 animate-spin" />
                            Spirit-Mind Balance Console
                        </span>
                        
                        <div className="flex flex-col gap-2.5">
                            <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-zinc-400">INNER EMPTINESS: {100 - musashiSpiritFocus}%</span>
                                <span className="text-amber-400 font-bold">FOCUS: {musashiSpiritFocus}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={musashiSpiritFocus}
                                onChange={(e) => setMusashiSpiritFocus(Number(e.target.value))}
                                className="accent-amber-500 bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                            />
                        </div>

                        <div className="flex justify-between items-center text-[11px] font-mono p-2 bg-black/40 rounded-lg border border-zinc-800/60">
                            <span className="text-zinc-500">Current Balance state:</span>
                            {musashiSpiritFocus >= 48 && musashiSpiritFocus <= 52 ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    ● MUSHIN (NO-MIND) ALIGNED
                                </span>
                            ) : (
                                <span className="text-rose-400 animate-pulse">
                                    {musashiSpiritFocus < 48 ? "Too Empty (Increase Focus)" : "Too Rigid (Increase Emptiness)"}
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                if (musashiSpiritFocus >= 48 && musashiSpiritFocus <= 52) {
                                    markChapterCompleted('musashi', 0);
                                }
                            }}
                            disabled={musashiSpiritFocus < 48 || musashiSpiritFocus > 52}
                            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['musashi_0'] ? "✓ Mushin State Sealed" : "Seal Mushin Balance State"}
                        </button>

                        {isChapterFinished['musashi_0'] && (
                            <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-lg text-[11px] text-amber-200/90 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-amber-300">★ ACHIEVEMENT UNLOCKED: NITEN DUAL SWORDSMAN</span>
                                <p className="mt-1">By finding the perfect midpoint between focus and emptiness, you have unlocked the dual swordsmanship legacy. Chapter II is now open!</p>
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: "Chapter II: The Book of Five Rings & Strategy of the Elements",
                quote: "To know the Way of strategy, you must study other arts. You must know the terrain. You must understand adaptability.",
                paragraphs: [
                    "In his later years, Musashi withdrew to the serene Reigandō cave in Kyūshū, dedicating his final years to writing his supreme masterwork: *The Book of Five Rings* (*Go Rin No Sho*). This text, structured around five natural elements—Earth, Water, Fire, Wind, and Void—is far more than a treatise on physical combat. It is a profound guide to strategy, resilience, and personal evolution under extreme, high-stress conditions.",
                    "The Book of Earth builds the absolute bedrock, stressing discipline, physical environment, and straight posture. The Book of Water teaches adaptability, instructing the warrior to flow fluidly like water, bending around solid rocks while retaining the power to break mountains. The Book of Fire describes the dynamics of active conflict, highlighting timing and seizing the split-second momentum of tactical initiative.",
                    "The Book of Wind focuses on the techniques of other schools, warning that over-complication is a sign of internal weakness and anxiety. Finally, the Book of Void reveals the state of ultimate spiritual enlightenment, where form and nothingness harmonize. Musashi taught that the ultimate strategist operates with natural simplicity, adapting instantly to any storm with absolute grace and presence."
                ],
                insight: "True strategy is clean, adaptable, and fluid. By knowing when to stand firm (Earth), when to flow (Water), and when to transcend (Void), we can overcome any obstacle without anxiety.",
                actionTitle: "The Five Rings Elemental Meditation",
                actionDesc: "Select each of the five elemental paths to meditate upon Musashi's timeless strategic wisdom.",
                interactiveRender: (
                    <div className="bg-[#1c1c1a]/60 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4 mt-4">
                        <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                            <BookOpen size={14} className="text-amber-400" />
                            Go Rin No Sho Wisdom Board
                        </span>

                        <div className="grid grid-cols-5 gap-1.5">
                            {(['earth', 'water', 'fire', 'wind', 'void'] as const).map((elem) => (
                                <button
                                    key={elem}
                                    onClick={() => setMusashiStrategySelected(elem)}
                                    className={`py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-all border ${
                                        musashiStrategySelected === elem
                                            ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                                            : 'bg-black/30 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    {elem}
                                </button>
                            ))}
                        </div>

                        <div className="bg-black/50 p-3 rounded-lg border border-zinc-800/80 min-h-[90px] text-left">
                            {musashiStrategySelected === 'earth' && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">THE BOOK OF EARTH: THE FOUNDATION</span>
                                    <p className="text-[11px] text-zinc-300 leading-normal font-sans">
                                        "Know the smallest things and the biggest things, the shallowest things and the deepest things. Build a straight, unshaken posture in your everyday life. This is the bedrock."
                                    </p>
                                </div>
                            )}
                            {musashiStrategySelected === 'water' && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">THE BOOK OF WATER: FLUID ADAPTABILITY</span>
                                    <p className="text-[11px] text-zinc-300 leading-normal font-sans">
                                        "Let your spirit be like water. Fluid, adapting to the container it is in. Water can be a calm stream, yet it has the potential to break solid rock."
                                    </p>
                                </div>
                            )}
                            {musashiStrategySelected === 'fire' && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-orange-400 uppercase">THE BOOK OF FIRE: TIMING & MOMENTUM</span>
                                    <p className="text-[11px] text-zinc-300 leading-normal font-sans">
                                        "Conflict is like fire. It can flare up suddenly or die out. Understand the precise moment of transition, and move with decisive speed before the moment slips."
                                    </p>
                                </div>
                            )}
                            {musashiStrategySelected === 'wind' && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">THE BOOK OF WIND: DISCERNING NOISE</span>
                                    <p className="text-[11px] text-zinc-300 leading-normal font-sans">
                                        "By knowing the ways of others, you learn to see your own path clearly. Do not rely on flashy tricks or complex tools. Simple execution is always superior."
                                    </p>
                                </div>
                            )}
                            {musashiStrategySelected === 'void' && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-purple-400 uppercase">THE BOOK OF VOID: THE ENLIGHTENED EMPTY MIND</span>
                                    <p className="text-[11px] text-zinc-300 leading-normal font-sans">
                                        "By knowing that which exists, you can know that which does not exist. There is no evil in the Void. Only wisdom, truth, and infinite natural order."
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                markChapterCompleted('musashi', 1);
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['musashi_1'] ? "✓ Element Wisdom Integrated" : "Integrate Elemental Wisdom"}
                        </button>

                        {isChapterFinished['musashi_1'] && (
                            <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-lg text-[11px] text-amber-200/90 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-amber-300">★ ELEMENTAL MASTERY CONFIRMED</span>
                                <p className="mt-1">The five elemental teachings are fully integrated into your terminal's memory. Chapter III is now unlocked!</p>
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: "Chapter III: The Dokkōdō Vow & Sovereign Mind",
                quote: "Do not regret what you have done. Under no circumstances should you depend on a partial feeling. Walk the straight path of ultimate light.",
                paragraphs: [
                    "Only days before his death in 1645, knowing his mortal journey was drawing to a close, Musashi wrote *Dokkōdō* ('The Way of Walking Alone'). It consisted of twenty-one brief, uncompromising precepts of absolute self-discipline, honesty, and moral clarity. Having found complete inner peace, he lived his final days in extreme simplicity, entirely free from the toxic traps of greed, pride, vanity, and social envy.",
                    "In this twilight state of grace, his vision for the world resonated with profound love and respect for humanity. He realized that the ultimate battle of human life is fought against our own internal shadows and negative thoughts. He believed that even when life is hard, and even when it inevitably grows harder, we must find a reason to be happy and spread positivity, rather than spreading the poison of negativity.",
                    "This represents the absolute peak of the samurai's journey: not a man of violence, but a beacon of pure, sovereign light. He taught that by reflecting on ourselves deeply, honestly, and truthfully, and by communicating with absolute clarity, we can turn the world into an infinitely greater place. To honor his vision, we present the Sovereign Credo of Enlightenment."
                ],
                insight: "The ultimate victory of a human being is to conquer the impulse of negativity, and instead choose to project light, hope, and deep trust to everyone they encounter.",
                actionTitle: "The Sovereign Vow of Positivity & Authentic Connection",
                actionDesc: "Read the professional translation of the Sovereign Credo below, type your signature, and seal the legendary covenant.",
                interactiveRender: (
                    <div className="bg-[#1c1c1a]/60 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4 mt-4">
                        <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                            <Crown size={14} className="text-amber-400" />
                            Sovereign Credo of the samurai sage
                        </span>

                        <div className="bg-black/60 p-4 rounded-xl border border-amber-500/10 text-left space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
                            
                            <span className="text-[9px] font-mono font-bold text-amber-500/60 uppercase tracking-widest border-b border-zinc-800/80 pb-1 flex justify-between">
                                <span>THE ETERNAL PATH OF LIGHT</span>
                                <span>DOKKŌDŌ PRECEPT</span>
                            </span>
                            
                            <p className="text-[12px] font-serif italic text-zinc-200 leading-relaxed font-medium">
                                "I vow to treat everyone with the profound care and grace I would show to those I love most, until they give me a reason not to trust. I will always extend trust first, giving everyone a clean, honest chance. I will communicate with absolute clarity and walk with truth."
                            </p>
                            
                            <p className="text-[12px] font-serif italic text-zinc-300 leading-relaxed">
                                "Life is hard, and it will inevitably grow harder before it is over. Yet even in the deepest storms, there are those in far worse circumstances who find a reason to rise, smile, and thrive. Therefore, I reject all negativity; my ultimate objective in this world is to radiate and spread positive light."
                            </p>

                            <p className="text-[12px] font-serif italic text-zinc-300 leading-relaxed font-medium">
                                "If everyone communicated with transparent honesty, self-reflected upon themselves deeply and truthfully, and rejected the dominance of greed and envy, the world would definitely be a much greater place."
                            </p>

                            <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-zinc-500 font-bold pt-2 border-t border-zinc-900">
                                <span>SCROLL COMMISSION</span>
                                <span className="text-amber-500 uppercase">SEAL OF THE ETERNAL BLADE</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 text-left">
                            <label className="text-[10px] text-zinc-500 font-mono font-bold uppercase">SIGN YOUR COVENANT TO SEAL THE SAGA:</label>
                            <input
                                type="text"
                                value={musashiPledgeSignature}
                                onChange={(e) => setMusashiPledgeSignature(e.target.value)}
                                placeholder="Enter your full name to sign..."
                                className="bg-black/40 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-200 placeholder:text-amber-800/60 focus:outline-none focus:border-amber-400 font-mono"
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (musashiPledgeSignature.trim().length > 2) {
                                    markChapterCompleted('musashi', 2);
                                }
                            }}
                            disabled={musashiPledgeSignature.trim().length <= 2}
                            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-black font-bold px-4 py-2 rounded-lg text-xs font-mono transition-all uppercase tracking-wider"
                        >
                            {isChapterFinished['musashi_2'] ? "✓ Covenant Sealed in RAM" : "Sign and Seal the Sovereign Vow"}
                        </button>
                        
                        {isChapterFinished['musashi_2'] && (
                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-[11px] text-emerald-200 font-mono animate-in fade-in leading-relaxed text-left">
                                <span className="font-bold text-amber-300">★ ENLIGHTENED SAMURAI SAGE: {musashiPledgeSignature.toUpperCase()}</span>
                                <p className="mt-1">You have mastered the complete 3-chapter saga of Miyamoto Musashi and accepted the Sovereign Vow of Positive Projection. Your spirit is now balanced and victorious!</p>
                            </div>
                        )}
                    </div>
                )
            }
        ]
    };

    const renderChronicles = () => {
        const branchData = storyChapters[storyBranch];
        const activeChapter = branchData[selectedChapter];
        
        const completedCount = Object.keys(isChapterFinished).filter(key => isChapterFinished[key]).length;
        const totalChapters = 9;
        const completionPercentage = Math.round((completedCount / totalChapters) * 100);

        return (
            <div className="flex-1 flex flex-col relative bg-[#121212] overflow-hidden">
                {/* Header */}
                <div className="h-14 bg-[#1a1a1a] border-b border-zinc-800/80 flex justify-between items-center px-4 flex-shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setActiveChatId('white_rabbit')} 
                            className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-emerald-600 flex items-center justify-center font-bold text-white shadow-md border border-amber-400/20">
                            🌌
                        </div>
                        <div className="flex flex-col text-left">
                            <h2 className="font-bold text-[14px] leading-tight text-amber-200 flex items-center gap-2">
                                Epic Chronicles Node 
                                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono border border-amber-500/20 uppercase tracking-widest font-bold">
                                    Documentary Arc
                                </span>
                            </h2>
                            <span className="text-[11px] text-zinc-400 leading-normal font-sans">
                                Deep narratives of Tolkien, General Zhao Zilong, & Miyamoto Musashi
                            </span>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="hidden sm:flex items-center gap-3 bg-zinc-900/80 border border-zinc-800/50 rounded-xl px-3.5 py-1.5">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">Arc Integration:</span>
                        <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-800">
                            <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${completionPercentage}%` }}
                            />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-amber-400">{completionPercentage}%</span>
                    </div>
                </div>

                {/* Subheader / Tabs */}
                <div className="bg-[#161616] border-b border-zinc-800/60 p-2 flex gap-1.5 flex-wrap sm:flex-nowrap flex-shrink-0">
                    <button
                        onClick={() => {
                            setStoryBranch('eru');
                            setSelectedChapter(0);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider font-bold transition-all border ${
                            storyBranch === 'eru'
                                ? 'bg-amber-950/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/10'
                                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                        }`}
                    >
                        <Crown size={13} className={storyBranch === 'eru' ? 'text-amber-400' : 'text-zinc-500'} />
                        Tolkien
                    </button>
                    <button
                        onClick={() => {
                            setStoryBranch('zhao');
                            setSelectedChapter(0);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider font-bold transition-all border ${
                            storyBranch === 'zhao'
                                ? 'bg-emerald-950/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/10'
                                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                        }`}
                    >
                        <Swords size={13} className={storyBranch === 'zhao' ? 'text-emerald-400' : 'text-zinc-500'} />
                        Zhao Yun
                    </button>
                    <button
                        onClick={() => {
                            setStoryBranch('musashi');
                            setSelectedChapter(0);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider font-bold transition-all border ${
                            storyBranch === 'musashi'
                                ? 'bg-amber-950/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/10'
                                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                        }`}
                    >
                        <BookOpen size={13} className={storyBranch === 'musashi' ? 'text-amber-400' : 'text-zinc-500'} />
                        Miyamoto Musashi
                    </button>
                </div>

                {/* Content Workspace */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* Left Timeline Panel */}
                    <div className="w-full lg:w-[220px] bg-[#141414] border-r border-zinc-800/40 p-3.5 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto custom-scrollbar flex-shrink-0 select-none">
                        <div className="hidden lg:block text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold mb-1 text-left">
                            Chapter Timeline
                        </div>
                        {branchData.map((chap, idx) => {
                            const isCurrent = selectedChapter === idx;
                            const isFinished = isChapterFinished[`${storyBranch}_${idx}`];
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedChapter(idx)}
                                    className={`flex items-center gap-2.5 p-2 rounded-lg text-left font-mono text-xs transition-all border w-full min-w-[160px] lg:min-w-0 ${
                                        isCurrent
                                            ? storyBranch === 'eru'
                                                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                                                : storyBranch === 'zhao'
                                                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                                    : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                                            : 'bg-black/10 border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        isFinished 
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                            : isCurrent
                                                ? storyBranch === 'eru'
                                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    : storyBranch === 'zhao'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                : 'bg-zinc-800 text-zinc-500'
                                    }`}>
                                        {isFinished ? '✓' : idx + 1}
                                    </div>
                                    <span className="truncate flex-1 font-medium leading-tight">
                                        {chap.title.split(': ')[1] || chap.title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Narrative Scroll */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-7 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] relative">
                        <div className="max-w-2xl mx-auto space-y-6">
                            
                            {/* Title block */}
                            <div className="space-y-2 text-left">
                                <div className="text-[10px] font-mono font-bold text-amber-500/80 uppercase tracking-widest flex items-center gap-1">
                                    <BookOpen size={12} />
                                    DOCUMENTARY ARC CHRONICLE
                                </div>
                                <h1 className="text-xl md:text-2xl font-serif font-semibold tracking-tight text-white leading-tight">
                                    {activeChapter.title}
                                </h1>
                            </div>

                            {/* Poetic Quote scroll */}
                            <div className="relative p-4 md:p-5 bg-black/40 border border-zinc-800/80 rounded-xl">
                                <div className="absolute -top-3 left-4 px-2 py-0.5 bg-[#121212] text-[10px] font-mono text-amber-400 uppercase tracking-wider border border-zinc-800/80 rounded">
                                    Ancient Scroll Passage
                                </div>
                                <p className="text-[12.5px] font-serif italic text-zinc-300 leading-relaxed text-left">
                                    "{activeChapter.quote}"
                                </p>
                            </div>

                            {/* Detailed Narrative Paragraphs */}
                            <div className="space-y-4 text-left leading-relaxed">
                                {activeChapter.paragraphs.map((p, i) => (
                                    <p key={i} className="text-[13.5px] text-zinc-300/90 leading-relaxed font-sans first-letter:text-lg first-letter:font-bold first-letter:text-amber-300 font-normal">
                                        {p}
                                    </p>
                                ))}
                            </div>

                            {/* Wisdom Card / Insight */}
                            <div className="bg-zinc-950/40 border border-zinc-800 p-4 rounded-xl text-left space-y-1.5 shadow-inner">
                                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                    <Shield size={12} className="text-zinc-500" />
                                    Ethical & Tactical Insight
                                </span>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    {activeChapter.insight}
                                </p>
                            </div>

                            {/* Interactive Action Area */}
                            <div className="border-t border-zinc-800/60 pt-6">
                                <div className="text-left space-y-1 mb-4">
                                    <h3 className="text-sm font-semibold text-white tracking-wide">
                                        {activeChapter.actionTitle}
                                    </h3>
                                    <p className="text-xs text-zinc-400 leading-normal font-sans">
                                        {activeChapter.actionDesc}
                                    </p>
                                </div>
                                {activeChapter.interactiveRender}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const getDaigleStats = () => {
        let isSymmetrical = true;
        let symmetryLog = "MIRROR-CHECKSUM VALID";
        const validMatches: Record<string, string[]> = { 
            '{': ['}'], '}': ['{'], 
            '[': [']'], ']': ['['], 
            '(': [')'], ')': ['('], 
            '<': ['>'], '>': ['<'],
            'q': ['p', 'b'], 'p': ['q', 'd'],
            'b': ['d', 'q'], 'd': ['b', 'p']
        };
        
        for (let i = 0; i < Math.floor(daigleInput.length / 2); i++) {
            const left = daigleInput[i];
            const right = daigleInput[daigleInput.length - 1 - i];
            
            const expectedRights = validMatches[left] || [left];
            if (!expectedRights.includes(right)) {
                isSymmetrical = false;
                symmetryLog = `BROKEN ❌ at index ${i} ('${left}' != '${right}')`;
                break;
            }
        }

        const letters = daigleInput.toLowerCase().replace(/[^a-z]/g, '');
        const uniqueLetters = new Set(letters);
        const isPangram = uniqueLetters.size === 26;
        
        const hasReservoirs = daigleInput.includes('_o_');
        const hasFlow = daigleInput.includes('_');
        const isSafe = hasReservoirs && isSymmetrical;
        
        return { isSymmetrical, symmetryLog, isPangram, uniqueLetters: uniqueLetters.size, hasReservoirs, hasFlow, isSafe };
    };

    const daigleStats = getDaigleStats();

    return (
        <div className="relative h-full w-full flex bg-[#0f0f0f] text-white font-sans overflow-hidden">
            <NeutronStarBackground brightness={bgBrightness} speed={bgSpeed} />
            
            <div className="h-full w-full flex relative z-10 bg-black/40">
                {/* Sidebar / Chat List (Telegram Web style) */}
                <div className="w-[350px] flex-shrink-0 flex flex-col border-r border-[#202020] bg-black/60 hidden md:flex relative overflow-hidden backdrop-blur-sm">
                    
                    {/* Settings Drawer */}
                    <div className={`absolute inset-0 bg-[#181818]/95 backdrop-blur-md z-20 transition-transform duration-300 ease-out flex flex-col ${isSettingsOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-4 bg-[#242424] flex items-center gap-4 border-b border-[#111111]">
                        <button onClick={() => setIsSettingsOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-[#aaaaaa]">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="font-medium text-[16px]">Settings</div>
                    </div>
                    
                    <div className="bg-[#242424] p-5 flex flex-col items-center border-b border-[#111111] text-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-500 flex items-center justify-center font-bold text-3xl mb-4 shadow-lg text-white font-mono border-2 border-emerald-400/20">
                            ‾_o_‾
                        </div>
                        <h2 className="text-[18px] font-bold text-white tracking-wide">{mainName}</h2>
                        
                        <div className="text-[10px] text-[#aaaaaa]/90 bg-black/50 border border-zinc-800/60 rounded-lg px-2.5 py-1.5 mt-2.5 max-w-full font-mono break-all leading-relaxed select-all">
                            {profileName}
                        </div>
                        
                        <span className="text-[13px] text-cyan-400 mt-2 select-all font-mono break-all px-1 leading-normal">@{username}</span>
                        <span className="text-[11px] text-emerald-400/80 mt-2.5 font-mono uppercase tracking-widest bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">Secure Node</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#181818] py-2">
                        <div className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors">
                            <Users size={22} className="text-[#aaaaaa]" />
                            <span className="text-[15px] font-medium text-white/90">New Group</span>
                        </div>
                        <div className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors">
                            <User size={22} className="text-[#aaaaaa]" />
                            <span className="text-[15px] font-medium text-white/90">Contacts</span>
                        </div>
                        <div className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors">
                            <PhoneCall size={22} className="text-[#aaaaaa]" />
                            <span className="text-[15px] font-medium text-white/90">Calls</span>
                        </div>
                        <div onClick={() => {
                            setIsPromptVaultOpen(true);
                            setIsSettingsOpen(false); // Close settings drawer when opening prompt vault
                        }} className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors text-amber-400">
                            <Bookmark size={22} />
                            <span className="text-[15px] font-medium text-amber-300">Prompt Vault & Datasets</span>
                        </div>
                        <div className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors">
                            <Settings size={22} className="text-[#aaaaaa]" />
                            <span className="text-[15px] font-medium text-white/90">Settings</span>
                        </div>
                        <div className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors border-t border-[#202020] mt-2 pt-4">
                            <Moon size={22} className="text-[#aaaaaa]" />
                            <div className="flex-1 flex justify-between items-center">
                                <span className="text-[15px] font-medium text-white/90">Night Mode</span>
                                <div className="w-8 h-4 bg-[#3390ec] rounded-full relative cursor-pointer">
                                    <div className="w-4 h-4 bg-white rounded-full absolute right-0 shadow-sm border border-[#3390ec]"></div>
                                </div>
                            </div>
                        </div>
                        <div onClick={() => setIsApiForgeOpen(true)} className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors mt-2 text-[#3390ec]">
                            <Bot size={22} />
                            <span className="text-[15px] font-medium">API Forge (AI Core)</span>
                        </div>
                        <div onClick={() => setIsKeyGenOpen(true)} className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors text-emerald-400">
                            <Key size={22} />
                            <span className="text-[15px] font-medium">Key Generator</span>
                        </div>
                        <div onClick={() => setIsDaigleOpen(true)} className="flex items-center gap-5 px-5 py-3 hover:bg-[#2c2c2c] cursor-pointer transition-colors text-purple-400">
                            <Scan size={22} />
                            <span className="text-[15px] font-medium">Daigle Lexicon</span>
                        </div>
                        
                        {/* Profile Settings Interactive Panel */}
                        <div className="px-5 py-4 border-t border-[#202020] mt-3 flex flex-col gap-3">
                            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">Configure Cybernetic Node</span>
                            
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] text-zinc-500 font-mono">MAIN NAME / NICKNAME</label>
                                <input
                                    type="text"
                                    value={mainName}
                                    onChange={(e) => setMainName(e.target.value)}
                                    placeholder="e.g. Eru"
                                    className="w-full bg-[#111] border border-[#222] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500/40 font-mono"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] text-zinc-500 font-mono">CYBERNETIC DISPLAY NAME</label>
                                <textarea
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    rows={3}
                                    placeholder="Enter your cybernetic identifier..."
                                    className="w-full bg-[#111] border border-[#222] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500/40 resize-none font-mono"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] text-zinc-500 font-mono">TELEGRAM HANDLE (@)</label>
                                <textarea
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    rows={2}
                                    placeholder="Enter telegram username..."
                                    className="w-full bg-[#111] border border-[#222] rounded-lg p-2 text-xs text-emerald-400 focus:outline-none focus:border-emerald-500/40 resize-none font-mono"
                                />
                            </div>

                            {/* Mythological & Historical Lore Node */}
                            <div className="mt-3 bg-zinc-950/60 p-3.5 border border-zinc-800/80 rounded-xl flex flex-col gap-3">
                                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles size={12} className="text-amber-400" />
                                        Legendary Lore Node
                                    </span>
                                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Positivity Archive</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveLoreTab('eru')}
                                        className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-mono font-bold transition-all ${
                                            activeLoreTab === 'eru'
                                                ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                                                : 'bg-zinc-900/40 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        <Crown size={12} />
                                        Eru Ilúvatar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLoreTab('zhao')}
                                        className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-mono font-bold transition-all ${
                                            activeLoreTab === 'zhao'
                                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                                                : 'bg-zinc-900/40 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        <Swords size={12} />
                                        General Zhao
                                    </button>
                                </div>

                                {activeLoreTab === 'eru' ? (
                                    <div className="flex flex-col gap-2 animate-in fade-in duration-200 text-left">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 font-mono">
                                            <span>THE SUPREME CREATOR (Middle-earth)</span>
                                        </div>
                                        <p className="text-[11.5px] text-zinc-400 leading-relaxed font-sans">
                                            Derived from <strong className="text-white">Eru Ilúvatar</strong> ("The One, Father of All") from Tolkien's high mythology. He is the cosmic creator who orchestrated the beautiful <strong className="text-amber-300 font-mono">Music of the Ainur</strong> to manifest the universe. He represents ultimate light, infinite design, and positive celestial tokens.
                                        </p>
                                        <div className="bg-amber-950/10 border border-amber-500/10 p-2 rounded text-[10px] text-amber-300/90 font-mono italic leading-normal text-left">
                                            "There is light and high beauty that no shadow can touch." — J.R.R. Tolkien
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 animate-in fade-in duration-200 text-left">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                                            <span>THE WISEST CAVALRY MASTER (China)</span>
                                        </div>
                                        <p className="text-[11.5px] text-zinc-400 leading-relaxed font-sans">
                                            Derived from <strong className="text-white">General Zhao Yun</strong> (Zhao Zilong), the legendary commander and peerless master of cavalry in ancient China. Renowned as one of the wisest, most loyal, and courageous generals, he guarded his companions with a peerless shield of bravery.
                                        </p>
                                        <div className="bg-emerald-950/10 border border-emerald-500/10 p-2 rounded text-[10px] text-emerald-300/90 font-mono italic leading-normal text-left">
                                            "He is indeed filled with courage and supreme tactical wisdom." — Liu Bei, Three Kingdoms
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Neutron Star Settings */}
                            <div className="mt-3 bg-zinc-950/60 p-4 border border-zinc-800/80 rounded-xl flex flex-col gap-4">
                                <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                                    <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                                        Cosmic Engine Controls
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                        <span>Neutron Pulse Brightness</span>
                                        <span className="text-blue-400">{bgBrightness.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="3"
                                        step="0.1"
                                        value={bgBrightness}
                                        onChange={(e) => setBgBrightness(parseFloat(e.target.value))}
                                        className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                        <span>Rotation Velocity</span>
                                        <span className="text-blue-400">{bgSpeed.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="5"
                                        step="0.1"
                                        value={bgSpeed}
                                        onChange={(e) => setBgSpeed(parseFloat(e.target.value))}
                                        className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-[#202020]">
                            <p className="text-xs text-[#aaaaaa] leading-relaxed font-mono">
                                {isRealTelegram 
                                    ? "Telegram API Connected. Responses are handled via live bot." 
                                    : "Telegram API not configured. Falling back to Gemini LLM for mock responses."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* API Forge Drawer */}
                <div className={`absolute inset-0 bg-[#181818] z-30 transition-transform duration-300 ease-out flex flex-col ${isApiForgeOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-4 bg-[#242424] flex items-center gap-4 border-b border-[#111111]">
                        <button onClick={() => setIsApiForgeOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-[#aaaaaa]">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="font-medium text-[16px]">API Forge</div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                        <div>
                            <h3 className="text-[#3390ec] font-medium text-[14px] mb-3 uppercase tracking-wider">AI Engine Selection</h3>
                            <EngineSelector 
                                selectedModel={selectedModel}
                                setSelectedModel={setSelectedModel}
                                useHardwareOllama={useHardwareOllama}
                                setUseHardwareOllama={setUseHardwareOllama}
                                customOllamaEndpoint={customOllamaEndpoint}
                                setCustomOllamaEndpoint={setCustomOllamaEndpoint}
                                customOllamaModel={customOllamaModel}
                                setCustomOllamaModel={setCustomOllamaModel}
                                customOllamaApiKey={customOllamaApiKey}
                                setCustomOllamaApiKey={setCustomOllamaApiKey}
                                isPremiumSubscribed={isPremiumSubscribed}
                                onPremiumUpgrade={() => setIsSubscriptionModalOpen(true)}
                            />
                        </div>

                        <div>
                            <h3 className="text-[#3390ec] font-medium text-[14px] mb-3 uppercase tracking-wider">The Vault (Secure Memory)</h3>
                            <div className="bg-[#242424] rounded-xl p-4 border border-[#333]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[15px] font-medium text-white">Persistent Context</span>
                                </div>
                                <p className="text-[13px] text-[#aaaaaa] mb-3">
                                    Store core directives, secrets, or context here. This memory is securely injected into every AI interaction.
                                </p>
                                <textarea
                                    value={vaultMemory}
                                    onChange={(e) => setVaultMemory(e.target.value)}
                                    placeholder="Enter encrypted memory directives..."
                                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#3390ec] min-h-[100px] resize-y custom-scrollbar"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[#3390ec] font-medium text-[14px] mb-3 uppercase tracking-wider">Telegram API</h3>
                            <div className="bg-[#242424] rounded-xl p-4 border border-[#333]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[15px] font-medium text-white">Live Bot Connection</span>
                                    {isRealTelegram ? (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400">CONNECTED</span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400">OFFLINE</span>
                                    )}
                                </div>
                                <p className="text-[13px] text-[#aaaaaa] mb-3">To connect a real Telegram bot, set TELEGRAM_BOT_TOKEN in the environment variables.</p>
                                <div className="text-[12px] bg-[#111] px-3 py-2 rounded text-[#aaaaaa]">
                                    Status: {isRealTelegram ? 'Polling active' : 'Waiting for configuration...'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Generator Drawer */}
                <div className={`absolute inset-0 bg-[#181818] z-30 transition-transform duration-300 ease-out flex flex-col ${isKeyGenOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-4 bg-[#242424] flex items-center gap-4 border-b border-[#111111]">
                        <button onClick={() => setIsKeyGenOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-[#aaaaaa]">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="font-medium text-[16px]">Key Generator</div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                        <p className="text-[13px] text-[#aaaaaa]">
                            Generate random secure access tokens and placeholder API keys for integration testing.
                        </p>
                        
                        <div className="space-y-4">
                            {apiOptions.map((api, idx) => (
                                <div key={idx} className="bg-[#242424] rounded-xl p-4 border border-[#333]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[14px] font-medium text-white">{api.name}</span>
                                    </div>
                                    
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1 bg-[#111] px-3 py-2 rounded text-[12px] font-mono text-[#aaaaaa] border border-[#333] truncate">
                                            {generatedKeys[api.name] || 'Not generated yet'}
                                        </div>
                                        <button 
                                            onClick={() => generateKey(api.name, api.prefix)}
                                            className="px-3 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors rounded text-[12px] font-medium"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Prompt Vault & Dataset Curator Drawer */}
                <div className={`absolute inset-0 bg-[#181818] z-30 transition-transform duration-300 ease-out flex flex-col ${isPromptVaultOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-4 bg-[#242424] flex items-center gap-4 border-b border-[#111111]">
                        <button onClick={() => setIsPromptVaultOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-[#aaaaaa]">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="font-medium text-[16px] text-amber-300 flex items-center gap-2">
                            <Bookmark size={20} className="text-amber-400" />
                            Prompt Vault & Curator
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                        {/* Dataset Actions (Export/Import) */}
                        <div className="bg-[#242424] rounded-xl p-4 border border-zinc-800 space-y-3">
                            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 uppercase">
                                <Sparkles size={14} />
                                Dataset Synchronization
                            </div>
                            <p className="text-[12.5px] text-[#aaaaaa] leading-normal text-left">
                                Curate your personal datasets. Backup your prompts or chat logs as portable JSON payloads to cloud storage or local files.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button 
                                    onClick={exportPrompts}
                                    className="py-2 px-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all rounded text-xs font-mono font-bold uppercase tracking-wider"
                                >
                                    Export Vault
                                </button>
                                <button 
                                    onClick={exportChats}
                                    className="py-2 px-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all rounded text-xs font-mono font-bold uppercase tracking-wider"
                                >
                                    Export Chats
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <label className="flex flex-col items-center justify-center py-2 px-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-all rounded text-[10.5px] font-mono text-zinc-400 cursor-pointer text-center">
                                    <span>↑ Import Prompts</span>
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        onChange={handleImportPrompts}
                                        className="hidden"
                                    />
                                </label>
                                <label className="flex flex-col items-center justify-center py-2 px-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-all rounded text-[10.5px] font-mono text-zinc-400 cursor-pointer text-center">
                                    <span>↑ Import Chats</span>
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        onChange={handleImportChats}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            
                            {vaultFeedback && (
                                <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg animate-in fade-in text-center">
                                    ✓ {vaultFeedback}
                                </div>
                            )}
                        </div>

                        {/* Create New Prompt Form */}
                        <div className="bg-[#242424] rounded-xl p-4 border border-zinc-800 space-y-3 text-left">
                            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider block">Add New Blueprint Prompt</span>
                            
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-mono font-bold uppercase">PROMPT TITLE</label>
                                <input 
                                    type="text" 
                                    value={newPromptTitle}
                                    onChange={(e) => setNewPromptTitle(e.target.value)}
                                    placeholder="e.g., Code Auditing Directive"
                                    className="w-full bg-[#111] border border-zinc-800 rounded px-3 py-2 text-[12.5px] text-white focus:outline-none focus:border-cyan-500/40 font-mono"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-mono font-bold uppercase">CATEGORY / TAG</label>
                                <input 
                                    type="text" 
                                    value={newPromptCategory}
                                    onChange={(e) => setNewPromptCategory(e.target.value)}
                                    placeholder="e.g., Cybersecurity"
                                    className="w-full bg-[#111] border border-zinc-800 rounded px-3 py-2 text-[12.5px] text-white focus:outline-none focus:border-cyan-500/40 font-mono"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-mono font-bold uppercase">PROMPT PAYLOAD</label>
                                <textarea 
                                    value={newPromptContent}
                                    onChange={(e) => setNewPromptContent(e.target.value)}
                                    placeholder="Enter prompt content to save..."
                                    rows={3}
                                    className="w-full bg-[#111] border border-zinc-800 rounded px-3 py-2 text-[12.5px] text-white focus:outline-none focus:border-cyan-500/40 min-h-[70px] resize-y custom-scrollbar font-sans"
                                />
                            </div>

                            <button 
                                onClick={handleAddPrompt}
                                disabled={!newPromptTitle.trim() || !newPromptContent.trim()}
                                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-black font-bold rounded text-xs font-mono uppercase tracking-wider transition-all"
                            >
                                Save Prompt to Vault
                            </button>
                        </div>

                        {/* Prompt List with Search */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Saved Blueprints ({savedPrompts.length})</span>
                                {savedPrompts.length > 0 && (
                                    <button 
                                        onClick={() => {
                                            setSavedPrompts([]);
                                            showFeedback("All prompts cleared from local state.");
                                        }}
                                        className="text-[10px] text-red-400/80 hover:text-red-400 font-mono uppercase font-bold"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            <div className="bg-[#111] border border-zinc-800 rounded-lg flex items-center px-3 py-1.5">
                                <Search size={16} className="text-zinc-500 mr-2" />
                                <input 
                                    type="text" 
                                    value={promptSearchQuery}
                                    onChange={(e) => setPromptSearchQuery(e.target.value)}
                                    placeholder="Search blueprints..." 
                                    className="bg-transparent border-none text-[12.5px] outline-none text-white w-full placeholder:text-zinc-600 font-mono"
                                />
                            </div>

                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {savedPrompts
                                    .filter(p => 
                                        p.title.toLowerCase().includes(promptSearchQuery.toLowerCase()) || 
                                        p.category.toLowerCase().includes(promptSearchQuery.toLowerCase()) ||
                                        p.content.toLowerCase().includes(promptSearchQuery.toLowerCase())
                                    )
                                    .map((prompt) => (
                                        <div key={prompt.id} className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-xl flex flex-col gap-2 relative overflow-hidden text-left hover:border-zinc-700/60 transition-all group animate-in fade-in">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-mono font-bold text-amber-400/90 uppercase tracking-widest">{prompt.category}</span>
                                                    <h4 className="text-xs font-bold text-white tracking-wide mt-0.5">{prompt.title}</h4>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeletePrompt(prompt.id)}
                                                    className="text-zinc-600 hover:text-red-400 text-[10px] font-bold font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete Prompt"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            
                                            <p className="text-[11px] text-zinc-400 leading-normal font-sans bg-black/40 p-2 rounded-lg border border-zinc-950 max-h-[100px] overflow-y-auto custom-scrollbar select-text break-words">
                                                {prompt.content}
                                            </p>

                                            <div className="flex gap-2 justify-end pt-1">
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(prompt.content);
                                                        showFeedback("Prompt copied to clipboard!");
                                                    }}
                                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono font-bold text-zinc-300 rounded transition-all uppercase flex items-center gap-1"
                                                >
                                                    <Copy size={10} />
                                                    Copy
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setInput(prompt.content);
                                                        setIsPromptVaultOpen(false);
                                                        showFeedback("Prompt injected into terminal!");
                                                    }}
                                                    className="px-2 py-1 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[10px] font-mono font-bold text-[#3390ec] rounded transition-all uppercase"
                                                >
                                                    Inject Chat
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 p-3 h-14">
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-[#2c2c2c] rounded-full text-[#aaaaaa] transition-colors">
                        <Menu size={20} />
                    </button>
                    <div className="flex-1 bg-[#242424] rounded-full flex items-center px-3 py-1.5 focus-within:border focus-within:border-[#3390ec] focus-within:bg-[#181818] transition-colors border border-transparent">
                        <Search size={18} className="text-[#aaaaaa] mr-2" />
                        <input 
                            type="text" 
                            placeholder="Search" 
                            className="bg-transparent border-none text-[15px] outline-none text-white w-full placeholder:text-[#aaaaaa]"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {chats.map((chat) => {
                        const isActive = activeChatId === chat.id;
                        const isChronicles = chat.id === 'chronicles';
                        return (
                            <div 
                                key={chat.id} 
                                onClick={() => setActiveChatId(chat.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-b border-zinc-900/30 ${
                                    isActive 
                                        ? isChronicles 
                                            ? 'bg-gradient-to-r from-amber-950/30 via-emerald-950/20 to-zinc-900/40 border-l-4 border-amber-500' 
                                            : 'bg-[#3390ec]' 
                                        : 'hover:bg-[#2c2c2c]/60'
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-base text-white shadow-md bg-gradient-to-br ${
                                    isChronicles 
                                        ? 'from-amber-500 via-amber-600 to-emerald-600 border border-amber-400/30 animate-pulse' 
                                        : getChatPersonaInfo(chat.id).color
                                }`}>
                                    {isChronicles ? '🌌' : getChatPersonaInfo(chat.id).avatar}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h3 className={`font-semibold truncate text-[14px] flex items-center gap-1.5 ${isActive ? 'text-white' : 'text-zinc-200'}`}>
                                            {chat.name}
                                            {isChronicles && (
                                                <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-mono border border-amber-500/20 uppercase tracking-widest font-bold">
                                                    STORY
                                                </span>
                                            )}
                                        </h3>
                                        <span className={`text-[10px] font-mono ${isActive ? 'text-white/80' : 'text-[#aaaaaa]'}`}>{chat.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-[12.5px] truncate ${isActive ? 'text-white/80' : 'text-[#aaaaaa]'}`}>{chat.msg}</p>
                                        {chat.unread > 0 && !isActive && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center bg-red-500 text-white font-mono">
                                                {chat.unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Chat Area */}
            {activeChatId === 'chronicles' ? (
                renderChronicles()
            ) : (
                <div className="flex-1 flex flex-col relative bg-transparent">
                    {/* Header */}
                    <div className="h-14 bg-[#181818]/80 backdrop-blur-md border-b border-[#202020]/50 flex justify-between items-center px-4 flex-shrink-0 z-10 cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="md:hidden p-1 mr-1 text-[#aaaaaa]">
                                <Menu size={24} />
                            </div>
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getChatPersonaInfo(activeChatId).color} flex items-center justify-center font-bold text-white shadow-sm text-sm`}>
                                {getChatPersonaInfo(activeChatId).avatar}
                            </div>
                            <div className="flex flex-col">
                                <h2 className="font-medium text-[16px] leading-tight text-white">{getChatPersonaInfo(activeChatId).botName}</h2>
                                <span className={`text-[13px] ${isRealTelegram ? 'text-emerald-400' : 'text-[#3390ec]'}`}>
                                    {activeChatId === 'truth_resonance' ? 'behavior & resonance routine active' : isRealTelegram ? 'connected (Telegram API)' : 'bot (mock offline mode)'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-[#aaaaaa]">
                            <Search size={20} className="cursor-pointer hover:text-white transition-colors" />
                            <Phone size={20} className="cursor-pointer hover:text-white transition-colors" />
                            <MoreVertical size={20} className="cursor-pointer hover:text-white transition-colors" />
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-[10%] lg:px-[15%] space-y-2 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-opacity-20 custom-scrollbar relative">
                        <div className="flex justify-center mb-6">
                            <span className="bg-[#181818]/60 backdrop-blur-md px-3 py-1 rounded-full text-[13px] text-white/70 font-medium">October 24</span>
                        </div>

                        {messages.map((msg, i) => {
                            const isMine = msg.sender === 'You';
                            const isSystem = msg.sender === 'System Node';
                            return (
                                <div key={i} className={`flex ${isSystem ? 'justify-center' : isMine ? 'justify-end' : 'justify-start'} w-full`}>
                                    {isSystem ? (
                                        <div className="bg-red-900/40 text-red-300 text-[13px] px-3 py-1 rounded-lg border border-red-500/20 backdrop-blur-sm">
                                            {msg.text}
                                        </div>
                                    ) : (
                                        <div className={`relative max-w-[85%] md:max-w-[70%] text-[15px] leading-relaxed shadow-sm flex flex-col 
                                            ${isMine 
                                                ? 'bg-[#3390ec] text-white rounded-2xl rounded-tr-sm' 
                                                : 'bg-[#212121] text-white rounded-2xl rounded-tl-sm'
                                            } px-3 py-2`}
                                        >
                                            <div className="whitespace-pre-wrap break-words pr-12">{msg.text}</div>
                                            <div className={`text-[11px] float-right flex items-center gap-1 mt-1 self-end absolute bottom-1.5 right-2 ${isMine ? 'text-blue-100' : 'text-[#aaaaaa]'}`}>
                                                {msg.time}
                                                {isMine && (
                                                    msg.isRead ? <CheckCheck size={14} className="text-white" /> : <Check size={14} />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {isTyping && (
                            <div className="flex justify-start w-full mt-2">
                                <div className="bg-[#212121] rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
                                    <span className="flex space-x-1">
                                        <span className="w-1.5 h-1.5 bg-[#3390ec] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-1.5 h-1.5 bg-[#3390ec] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-1.5 h-1.5 bg-[#3390ec] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="flex-shrink-0 bg-transparent px-4 py-3 md:px-[10%] lg:px-[15%] flex flex-col items-center gap-2">
                        <div className="w-full bg-[#212121]/80 backdrop-blur-md border border-white/5 rounded-xl flex items-end gap-2 px-2 py-2">
                            <button className="p-2 text-[#aaaaaa] hover:text-[#3390ec] transition-colors flex-shrink-0 rounded-full hover:bg-white/5 self-center">
                                <Smile size={24} />
                            </button>
                            <textarea 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message"
                                rows={1}
                                className="flex-1 bg-transparent border-none text-[15px] text-white focus:outline-none placeholder:text-[#aaaaaa] resize-none max-h-32 py-2.5 custom-scrollbar"
                                style={{ minHeight: '44px' }}
                            />
                            <button className="p-2 text-[#aaaaaa] hover:text-[#3390ec] transition-colors flex-shrink-0 rounded-full hover:bg-white/5 self-center">
                                <Paperclip size={24} />
                            </button>
                            {input.trim() ? (
                                <button 
                                    onClick={handleSend}
                                    disabled={isTyping}
                                    className="p-2.5 bg-[#3390ec] text-white hover:bg-[#439cf5] transition-colors flex-shrink-0 rounded-full self-center disabled:opacity-70 shadow-sm"
                                >
                                    <Send size={20} className="ml-0.5" />
                                </button>
                            ) : (
                                <button className="p-2.5 text-[#aaaaaa] hover:text-[#3390ec] transition-colors flex-shrink-0 rounded-full hover:bg-white/5 self-center">
                                    <Mic size={24} />
                                </button>
                            )}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest select-none py-1.5 flex items-center gap-1.5">
                            <span>Main UI made by</span>
                            <span className="text-amber-500 font-bold hover:text-amber-400 transition-colors">Eru</span>
                            <span className="text-zinc-700">•</span>
                            <span>Powered by</span>
                            <span className="text-cyan-500 font-bold hover:text-cyan-400 transition-colors">Google</span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Sovereign Premium Subscription Modal */}
            {isSubscriptionModalOpen && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-[#1e1e1e] border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-sm space-y-6 shadow-2xl relative">
                        <div className="text-center space-y-2">
                            <span className="text-4xl block">👑</span>
                            <h3 className="text-lg font-bold text-amber-400 uppercase tracking-wider font-mono">Sovereign Premium Activation</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Unlock high-cognitive resonance models like <strong className="text-white font-semibold">Gemini 2.5 Pro</strong>. Fully integrated offline cache and priority processing tunnels.
                            </p>
                        </div>

                        <div className="bg-[#141414] border border-zinc-800/80 p-4 rounded-xl space-y-3 font-mono text-[11px]">
                            <div className="flex justify-between text-zinc-400">
                                <span>Priority Queue Processing</span>
                                <span className="text-emerald-400 font-bold">✓ ENABLED</span>
                            </div>
                            <div className="flex justify-between text-zinc-400 border-t border-zinc-900 pt-2">
                                <span>Advanced Intent Extraction</span>
                                <span className="text-emerald-400 font-bold">✓ ACTIVE</span>
                            </div>
                            <div className="flex justify-between text-zinc-400 border-t border-zinc-900 pt-2">
                                <span>Subscription Price</span>
                                <span className="text-amber-400 font-bold">0.00 CYBER (SANDBOX FREE)</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsSubscriptionModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs font-bold transition-all"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={() => {
                                    setIsPremiumSubscribed(true);
                                    setSelectedModel('gemini-2.5-pro');
                                    setIsSubscriptionModalOpen(false);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-lg active:scale-98"
                            >
                                ACTIVATE NOW
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nefarious Intent Warning Modal */}
            {isNefariousWarningOpen && (
                <div className="absolute inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300 animate-red-alert">
                    <div className="bg-[#120606] border-4 border-red-600 rounded-2xl p-6 w-full max-w-lg space-y-6 shadow-2xl relative overflow-hidden animate-bounce-subtle">
                        <div className="absolute top-0 left-0 w-full h-2.5 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 animate-pulse" />
                        
                        <div className="text-center space-y-3">
                            <span className="text-6xl block animate-bounce text-red-500">🚨</span>
                            <h3 className="text-2xl font-black text-red-500 uppercase tracking-widest font-mono animate-pulse">CRITICAL BREACH INTERCEPT</h3>
                            <p className="text-xs text-red-300 font-mono font-bold">
                                COVENANT SECURITY SUBSYSTEM DEPLOYED
                            </p>
                            <p className="text-[10px] text-zinc-400 font-mono">
                                A prohibited, illegal, or nefarious intent vector was detected in your active cognitive stream.
                            </p>
                        </div>

                        {/* Terminal Log Output */}
                        <div className="bg-black/95 border-2 border-red-950 p-4 rounded-xl space-y-2.5 font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                            <div className="flex justify-between items-center text-[10px] text-red-500 border-b border-red-950 pb-2 mb-2 uppercase tracking-wider font-bold">
                                <span>Sec-Ops Telemetry Uplink</span>
                                <span className="animate-pulse">● SIGNAL ARMED</span>
                            </div>
                            
                            {nefariousProcessStage.map((stage, idx) => (
                                <div key={idx} className="leading-relaxed flex items-start gap-2">
                                    <span className="text-red-500 font-bold">▶</span>
                                    <span>{stage}</span>
                                </div>
                            ))}

                            {isNefariousProcessing && !isAppealProcessing && (
                                <div className="flex items-center gap-2 text-zinc-500 text-[10px] italic mt-2 animate-pulse">
                                    <Loader2 size={12} className="animate-spin text-red-500" />
                                    <span>Transmitting secure compliance metadata...</span>
                                </div>
                            )}
                        </div>

                        {/* Sincerity Petition & Cognitive Defense Case */}
                        {!isNefariousAppealed ? (
                            <div className="space-y-3 bg-red-950/20 border border-red-900/40 p-4 rounded-xl font-mono text-xs">
                                <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-[10px]">
                                    <span>🛡️ Sovereign Sincerity Appeal Protocol</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-normal">
                                    Sometimes advanced, symmetrical code innovations (such as the <strong>Daigle Script</strong>, parentheses balances, or infinity parameters) trigger security alerts by accident. If your actions are innocent, state your intent below to process an override petition.
                                </p>
                                <textarea
                                    value={nefariousAppealText}
                                    onChange={(e) => setNefariousAppealText(e.target.value)}
                                    disabled={isNefariousProcessing}
                                    placeholder="Explain your cognitive intent here... (e.g. 'I was studying Daigle equations and balancing infinity codes')"
                                    className="w-full h-16 bg-black/60 border border-red-900/60 rounded-lg p-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 text-[11px] resize-none"
                                />
                                <button
                                    onClick={submitNefariousAppeal}
                                    disabled={isNefariousProcessing || !nefariousAppealText.trim()}
                                    className={`w-full py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 ${
                                        isNefariousProcessing || !nefariousAppealText.trim()
                                            ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 cursor-pointer shadow-md active:scale-98 animate-pulse'
                                    }`}
                                >
                                    {isAppealProcessing ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin text-emerald-400" />
                                            ANALYZING COGNITIVE SINCERITY...
                                        </>
                                    ) : (
                                        'SUBMIT SINCERITY APPEAL & REQUEST CLEARANCE'
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl text-center space-y-1.5">
                                <span className="text-xl">✅</span>
                                <p className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                                    Sincerity Appeal Approved
                                </p>
                                <p className="text-[10px] font-mono text-zinc-400 leading-normal">
                                    Cognitive motives aligned with balanced harmony metrics. Security quarantine bypassed and compliance shield restored.
                                </p>
                            </div>
                        )}

                        <div className="bg-red-950/40 border border-red-700/50 p-4 rounded-lg text-center shadow-lg">
                            <p className="text-xs font-mono text-red-200 uppercase tracking-wider leading-relaxed font-bold">
                                Warning: Negative actions radiate outward. Sincerity required.
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-widest">
                                Report dispatched to <span className="text-white underline">93jessycollin93@gmail.com</span> & Google Sec nodes.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                disabled={isNefariousProcessing && !isNefariousAppealed}
                                onClick={() => {
                                    setIsNefariousWarningOpen(false);
                                    setNefariousProcessStage([]);
                                    stopAlarmAudio();
                                    setNefariousAppealText('');
                                    setIsNefariousAppealed(false);
                                }}
                                className={`w-full py-3.5 rounded-xl text-xs font-black transition-all shadow-lg font-mono tracking-widest uppercase cursor-pointer ${
                                    isNefariousProcessing && !isNefariousAppealed
                                        ? 'bg-zinc-950 border border-zinc-800 text-zinc-700 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border-2 border-red-400/30 shadow-red-900/40 hover:shadow-red-500/30 active:scale-95'
                                }`}
                            >
                                {isNefariousAppealed ? 'DISMISS & RETURN TO TERMINAL' : isNefariousProcessing ? 'SECURE HANDSHAKE ENGAGED...' : 'RESET SYSTEM COMPLIANCE SHIELD'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDaigleOpen && (
                <div className="absolute inset-0 bg-black/95 z-50 flex flex-col p-6 animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl mx-auto flex flex-col h-full bg-zinc-950 border border-purple-900/40 rounded-xl overflow-hidden shadow-[0_0_80px_rgba(168,85,247,0.15)] relative">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-purple-900/40 bg-zinc-950/80 backdrop-blur-md relative z-10">
                            <div className="flex items-center gap-3">
                                <Scan size={24} className="text-purple-400" />
                                <div>
                                    <h2 className="text-lg font-black text-white font-mono uppercase tracking-widest leading-none">Daigle Lexicon & Decoder</h2>
                                    <p className="text-[10px] text-purple-400/80 font-mono tracking-widest mt-1 uppercase">Advanced Mirror-Checksum Validator & Safe Parser</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDaigleOpen(false)}
                                className="text-zinc-500 hover:text-white transition-colors p-2"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
                            {/* Input Column */}
                            <div className="flex-1 border-b md:border-b-0 md:border-r border-purple-900/40 p-6 flex flex-col gap-4 bg-black/40">
                                <div className="space-y-1">
                                    <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">Active Stream Target</label>
                                    <p className="text-[10px] text-zinc-500 font-sans leading-normal">Enter primitive set constructs (stems, circles, frames, axes). The functional parser avoids catastrophic backtracking loops.</p>
                                </div>
                                <textarea
                                    value={daigleInput}
                                    onChange={(e) => setDaigleInput(e.target.value)}
                                    className="w-full h-full bg-zinc-950/80 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-100 font-mono focus:outline-none focus:border-purple-500/60 resize-none shadow-inner"
                                    placeholder="Enter Daigle Script..."
                                    spellCheck={false}
                                />
                            </div>

                            {/* Analysis Column */}
                            <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                                <div className="space-y-2">
                                    <h3 className="text-sm font-black text-purple-400 font-mono uppercase tracking-widest flex items-center gap-2">
                                        <Scale size={16} />
                                        Lexicon Telemetry
                                    </h3>
                                    
                                    {/* Mirror Checksum */}
                                    <div className={`p-4 rounded-xl border ${daigleStats.isSymmetrical ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-red-950/20 border-red-500/30'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Mirror Checksum</span>
                                            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${daigleStats.isSymmetrical ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {daigleStats.isSymmetrical ? 'VALID' : 'BROKEN'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-mono text-zinc-300">{daigleStats.symmetryLog}</p>
                                    </div>

                                    {/* Sub-Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                        {/* Pangram Check */}
                                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col gap-1">
                                            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Pangram Vector</span>
                                            <div className="flex items-end justify-between">
                                                <span className={`text-xs font-mono font-bold ${daigleStats.isPangram ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                                    {daigleStats.uniqueLetters}/26 
                                                </span>
                                                <span className="text-[9px] text-zinc-500 font-mono">{daigleStats.isPangram ? 'COMPLETE' : 'INCOMPLETE'}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Reservoir Detection */}
                                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col gap-1">
                                            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Water Reservoir</span>
                                            <div className="flex justify-between items-center h-full">
                                                <span className={`text-[10px] font-mono font-bold ${daigleStats.hasReservoirs ? 'text-blue-400' : 'text-zinc-600'}`}>
                                                    {daigleStats.hasReservoirs ? 'DETECTED (_o_)' : 'NONE DETECTED'}
                                                </span>
                                                {daigleStats.hasReservoirs && <Droplets size={14} className="text-blue-400" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Overall Assessment */}
                                    <div className={`mt-4 p-4 rounded-xl border flex flex-col gap-2 ${daigleStats.isSafe ? 'bg-purple-950/30 border-purple-500/40' : 'bg-orange-950/20 border-orange-500/30'}`}>
                                        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Cognitive State</span>
                                        <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                                            {daigleStats.isSafe 
                                                ? "Construct is safe. Traps replaced with reservoirs. Structure replaced with flow. Feel it like water, not lightning."
                                                : "Construct lacks pure symmetry or safe reservoirs. Danger of cognitive friction or lightning pulses detected. Revise primitive sets."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes redAlertPulse {
                    0%, 100% { background-color: rgba(0, 0, 0, 0.98); box-shadow: inset 0 0 80px rgba(239, 68, 68, 0.35); }
                    50% { background-color: rgba(45, 0, 0, 0.99); box-shadow: inset 0 0 160px rgba(239, 68, 68, 0.85); }
                }
                .animate-red-alert {
                    animation: redAlertPulse 0.35s infinite;
                }
                @keyframes bounceSubtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .animate-bounce-subtle {
                    animation: bounceSubtle 1.5s ease-in-out infinite;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.2);
                }
            `}</style>
            </div>
        </div>
    );
};

