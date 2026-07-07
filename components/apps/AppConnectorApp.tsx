import React, { useState, useEffect } from 'react';
import { 
    Globe, Link2, Monitor, Shield, Cpu, Activity, Database, Sparkles, 
    MessageSquare, Terminal, Layers, Zap, Folder, HardDrive, Smartphone, 
    Radio, Box, Circle, Plus, Trash2, ExternalLink, HelpCircle, ShieldCheck,
    Search, Download, Check, Settings, Laptop, Info
} from 'lucide-react';

// Shared Icon Map to serialize/deserialize icons to/from localStorage
export const iconMap: Record<string, any> = {
    Globe, Link2, Monitor, Shield, Cpu, Activity, Database, Sparkles, 
    MessageSquare, Terminal, Layers, Zap, Folder, HardDrive, Smartphone, 
    Radio, Box, Circle, Laptop
};

// Preset dynamic backgrounds matching the OS aesthetic
export const gradientPresets = [
    { name: 'Neon Emerald', class: 'bg-gradient-to-br from-emerald-500 via-emerald-700 to-emerald-950 border border-emerald-500/30' },
    { name: 'Cyber Obsidian', class: 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-teal-950 border border-teal-500/20 shadow-md' },
    { name: 'Plum Magic', class: 'bg-gradient-to-br from-purple-600 via-pink-600 to-amber-500' },
    { name: 'Vaporwave Blue', class: 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700' },
    { name: 'Solar Amber', class: 'bg-gradient-to-br from-amber-500 to-orange-700' },
    { name: 'Crimson Threat', class: 'bg-gradient-to-br from-red-600 to-red-950 border border-red-500/20' },
    { name: 'Prism Sky', class: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500' },
    { name: 'Cosmic Slate', class: 'bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600/30' }
];

interface CustomAppInfo {
    id: string;
    name: string;
    url: string;
    iconName: string;
    bgColor: string;
}

interface PresetApp {
    name: string;
    description: string;
    iconName: string;
    bgColor: string;
    suggestedSlug: string;
}

// Exact apps found in Jessy's AI Studio account dashboard
const REMIX_PRESET_CATALOG: PresetApp[] = [
    {
        name: "CYBERNETIC67",
        description: "A high-fidelity replica of the Telegram UI built with React and Tailwind CSS.",
        iconName: "MessageSquare",
        bgColor: "bg-gradient-to-br from-blue-600 via-sky-700 to-indigo-950 border border-sky-500/30",
        suggestedSlug: "cybernetic67"
    },
    {
        name: "Remix: Prompt to JSON",
        description: "Gemini 3.1 takes your short image prompts and transforms them into detailed JSONs.",
        iconName: "Sparkles",
        bgColor: "bg-gradient-to-br from-purple-600 via-indigo-700 to-zinc-950 border border-purple-500/30",
        suggestedSlug: "prompt-to-json"
    },
    {
        name: "Remix: Gemini Agentic Vision",
        description: "Explore the thinking-with-images feature of Gemini 3.0 Flash Preview.",
        iconName: "Monitor",
        bgColor: "bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-700",
        suggestedSlug: "agentic-vision"
    },
    {
        name: "Remix: Flash UI",
        description: "Put Gemini 3 Flash's creativity and coding abilities to the test. Rapidly generate UI.",
        iconName: "Zap",
        bgColor: "bg-gradient-to-br from-blue-700 via-slate-800 to-indigo-950",
        suggestedSlug: "flash-ui"
    },
    {
        name: "Remix: Data Resolver",
        description: "Gemini 3 Flash quickly redirects through synthetic customer data and chat transcripts.",
        iconName: "Database",
        bgColor: "bg-gradient-to-br from-zinc-900 via-slate-800 to-emerald-950 border border-emerald-500/20",
        suggestedSlug: "data-resolver"
    },
    {
        name: "Remix: Function Call Kitchen",
        description: "Gemini 3 Flash controls 100 tools in a simulated kitchen.",
        iconName: "Cpu",
        bgColor: "bg-gradient-to-br from-amber-500 to-orange-700",
        suggestedSlug: "function-call-kitchen"
    },
    {
        name: "Remix: Done & Dusted",
        description: "A collaborative family chore management app with role-based permissions.",
        iconName: "Shield",
        bgColor: "bg-gradient-to-br from-blue-500 to-blue-800",
        suggestedSlug: "done-and-dusted"
    },
    {
        name: "Remix: Budgeted - Shared Expense Tracker",
        description: "A collaborative budget and expense tracker for households, trips, and personal use.",
        iconName: "Activity",
        bgColor: "bg-gradient-to-br from-emerald-500 via-emerald-700 to-emerald-950 border border-emerald-500/30",
        suggestedSlug: "budgeted"
    },
    {
        name: "Remix: Sky Metropolis",
        description: "Manage a virtual metropolis and fulfill tasks provided by Gemini.",
        iconName: "Globe",
        bgColor: "bg-gradient-to-br from-purple-600 via-pink-600 to-amber-500",
        suggestedSlug: "sky-metropolis"
    },
    {
        name: "Remix: Lyria Studio",
        description: "An elegant music generation playground app. Instantly turn prompts into complete songs.",
        iconName: "Radio",
        bgColor: "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500",
        suggestedSlug: "lyria-studio"
    },
    {
        name: "Remix: PromptDJ MIDI",
        description: "Control real time music with a MIDI controller.",
        iconName: "Box",
        bgColor: "bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600/30",
        suggestedSlug: "promptdj-midi"
    },
    {
        name: "Remix: Video to Learning App",
        description: "Instantly convert any YouTube video into an interactive learning app, coded by Gemini.",
        iconName: "Link2",
        bgColor: "bg-gradient-to-br from-red-600 to-red-950 border border-red-500/20",
        suggestedSlug: "video-learning"
    },
    {
        name: "Remix: Visual Computer",
        description: "Use your pen to control a virtual OS. Create AI wallpapers and summarize emails.",
        iconName: "Smartphone",
        bgColor: "bg-gradient-to-br from-orange-500 to-orange-800",
        suggestedSlug: "visual-computer"
    },
    {
        name: "Flipper Zero Emulator",
        description: "An advanced multi-tool hardware emulator for Sub-GHz, NFC, RFID, and Bluetooth sniffing/spoofing.",
        iconName: "Cpu",
        bgColor: "bg-gradient-to-br from-orange-600 via-zinc-800 to-zinc-950 border border-orange-500/20",
        suggestedSlug: "flipper"
    },
    {
        name: "TermStudio Terminal",
        description: "Advanced multi-tab sandbox UNIX shell emulator with AI pipeline compilation and scripting nodes.",
        iconName: "Terminal",
        bgColor: "bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-700/30",
        suggestedSlug: "termstudio"
    },
    {
        name: "ai-term Workspace",
        description: "Interactive real-time terminal coupled with live AI models for workflow generation and automation.",
        iconName: "Terminal",
        bgColor: "bg-gradient-to-br from-[#121c24] to-[#04080e] border border-cyan-500/35",
        suggestedSlug: "aiterm"
    },
    {
        name: "JACKY v3",
        description: "Supercharged agentic orchestration engine for parallel multi-model autonomous decision loops.",
        iconName: "Zap",
        bgColor: "bg-gradient-to-br from-indigo-900 via-zinc-900 to-zinc-950 border border-indigo-500/30",
        suggestedSlug: "jacky_v3"
    },
    {
        name: "Knowledge Condenser",
        description: "High-end ultra-fast LZW file compressor to pack, encode, and synchronize codebase packages.",
        iconName: "Layers",
        bgColor: "bg-gradient-to-br from-teal-600 via-zinc-900 to-zinc-950 border border-teal-500/30",
        suggestedSlug: "knowledge_compressor"
    },
    {
        name: "SuperSayen AI",
        description: "Visual computer commander unit syncing local droids with positive energy frequencies.",
        iconName: "Monitor",
        bgColor: "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/30",
        suggestedSlug: "supersayen"
    },
    {
        name: "Local AI Forge (Ollama)",
        description: "Self-hosted local LLM orchestrator running Qwen, Llama, and Mistral models offline.",
        iconName: "Cpu",
        bgColor: "bg-gradient-to-br from-purple-800 via-zinc-900 to-zinc-950 border border-purple-500/30",
        suggestedSlug: "ollama"
    },
    {
        name: "OpenClaw Agent Workspace",
        description: "Autonomous agent execution pipeline for code optimization and static security analysis.",
        iconName: "Globe",
        bgColor: "bg-gradient-to-br from-indigo-700 to-zinc-950 border border-indigo-500/30",
        suggestedSlug: "openclaw"
    },
    {
        name: "CodeRabbit AI Reviewer",
        description: "Expert pull request review companion to audit codebase styling, vulnerabilities, and leaks.",
        iconName: "MessageSquare",
        bgColor: "bg-gradient-to-br from-emerald-600 via-zinc-900 to-zinc-950 border border-emerald-500/30",
        suggestedSlug: "coderabbit"
    },
    {
        name: "Semantic Scholar AI",
        description: "Instant paper summary engine to search, parse, and review global academic knowledge.",
        iconName: "Globe",
        bgColor: "bg-gradient-to-br from-blue-700 via-zinc-900 to-zinc-950 border border-blue-500/30",
        suggestedSlug: "semantic_scholar"
    },
    {
        name: "Research Rabbit",
        description: "Academic mapping pipeline to explore connections, authors, and citation webs.",
        iconName: "Activity",
        bgColor: "bg-gradient-to-br from-emerald-700 to-zinc-950 border border-emerald-500/30",
        suggestedSlug: "research_rabbit"
    },
    {
        name: "Papers with Code",
        description: "Track state-of-the-art machine learning models with open-source code implementation pipelines.",
        iconName: "Database",
        bgColor: "bg-gradient-to-br from-cyan-600 via-zinc-900 to-zinc-950 border border-cyan-500/30",
        suggestedSlug: "papers_with_code"
    },
    {
        name: "LangChain App Builder",
        description: "Visual node chains and prompt flow engineering pipeline for multi-agent chains.",
        iconName: "Link2",
        bgColor: "bg-gradient-to-br from-indigo-600 to-zinc-950 border border-indigo-500/30",
        suggestedSlug: "langchain"
    },
    {
        name: "Unreal Engine App",
        description: "Virtual viewport rendering 3D shaders, real-time lighting pipelines, and visual effects.",
        iconName: "Monitor",
        bgColor: "bg-gradient-to-br from-red-700 via-zinc-900 to-zinc-950 border border-red-500/30",
        suggestedSlug: "unreal_engine"
    },
    {
        name: "Blender 3D Render App",
        description: "3D scene editor with real-time meshes, material editing, and raytracing rendering pipelines.",
        iconName: "Box",
        bgColor: "bg-gradient-to-br from-orange-600 via-zinc-900 to-zinc-950 border border-orange-500/30",
        suggestedSlug: "blender"
    },
    {
        name: "Mail App Client",
        description: "Standard email client sandbox to securely scan inbox, drafts, and archives.",
        iconName: "MessageSquare",
        bgColor: "bg-gradient-to-br from-blue-600 via-zinc-900 to-zinc-950 border border-blue-500/30",
        suggestedSlug: "mail"
    },
    {
        name: "Slides App Builder",
        description: "Elegant visual presentation slides builder with automated formatting options.",
        iconName: "Laptop",
        bgColor: "bg-gradient-to-br from-amber-600 via-zinc-900 to-zinc-950 border border-amber-500/30",
        suggestedSlug: "slides"
    },
    {
        name: "Snake Game Simulator",
        description: "Retro grid gaming engine with score tracking and canvas performance optimization.",
        iconName: "Zap",
        bgColor: "bg-gradient-to-br from-emerald-700 to-zinc-950 border border-emerald-500/20",
        suggestedSlug: "snake"
    },
    {
        name: "Notepad Client",
        description: "Quick clean scratchpad editor with auto-saving to local storage.",
        iconName: "Folder",
        bgColor: "bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600/30",
        suggestedSlug: "notepad"
    },
    {
        name: "Cybernetic Export Hub",
        description: "Injects Gemini Ink Monolithic canvas and CYBERNETIC OS environment variables.",
        iconName: "Sparkles",
        bgColor: "bg-gradient-to-br from-purple-700 to-zinc-950 border border-purple-500/30",
        suggestedSlug: "cybernetic_export"
    },
    {
        name: "GitHub Sync Pipeline",
        description: "Continuous version control synchronization to deploy staging directories.",
        iconName: "Globe",
        bgColor: "bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-600/30",
        suggestedSlug: "github_sync"
    }
];

export const AppConnectorApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'catalog' | 'mounted' | 'manual'>('catalog');
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [selectedIconName, setSelectedIconName] = useState('Globe');
    const [selectedBg, setSelectedBg] = useState(gradientPresets[0].class);
    const [customApps, setCustomApps] = useState<CustomAppInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
    const [installingPreset, setInstallingPreset] = useState<PresetApp | null>(null);
    const [presetUrl, setPresetUrl] = useState('');

    // Load custom apps on mount
    useEffect(() => {
        const saved = localStorage.getItem('sas_custom_apps');
        if (saved) {
            try {
                setCustomApps(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load custom apps list", e);
            }
        }
    }, []);

    const showMessage = (text: string, isError: boolean = false) => {
        setMessage({ text, isError });
        setTimeout(() => setMessage(null), 4000);
    };

    const currentBaseUrl = window.location.origin;

    const handleMountApp = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            showMessage("Please provide a valid application name.", true);
            return;
        }

        if (!url.trim() || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            showMessage("Please provide a valid URL starting with http:// or https://", true);
            return;
        }

        const newApp: CustomAppInfo = {
            id: `custom_${Date.now()}`,
            name: name.trim(),
            url: url.trim(),
            iconName: selectedIconName,
            bgColor: selectedBg
        };

        const updated = [...customApps, newApp];
        setCustomApps(updated);
        localStorage.setItem('sas_custom_apps', JSON.stringify(updated));

        // Dispatch dynamic desktop reload event
        window.dispatchEvent(new CustomEvent('refresh-desktop'));

        // Reset & Redirect
        setName('');
        setUrl('');
        setActiveTab('mounted');
        showMessage(`"${newApp.name}" successfully integrated!`);
    };

    const handleInstallPreset = (e: React.FormEvent) => {
        e.preventDefault();
        if (!installingPreset) return;

        if (!presetUrl.trim() || (!presetUrl.startsWith('http://') && !presetUrl.startsWith('https://'))) {
            showMessage("Please enter a valid URL.", true);
            return;
        }

        const newApp: CustomAppInfo = {
            id: `custom_${Date.now()}`,
            name: installingPreset.name,
            url: presetUrl.trim(),
            iconName: installingPreset.iconName,
            bgColor: installingPreset.bgColor
        };

        const updated = [...customApps, newApp];
        setCustomApps(updated);
        localStorage.setItem('sas_custom_apps', JSON.stringify(updated));

        // Dispatch reload event
        window.dispatchEvent(new CustomEvent('refresh-desktop'));

        setInstallingPreset(null);
        setPresetUrl('');
        setActiveTab('mounted');
        showMessage(`"${newApp.name}" successfully integrated into SAS operating environment!`);
    };

    const handleUnmountApp = (id: string, appName: string) => {
        const updated = customApps.filter(app => app.id !== id);
        setCustomApps(updated);
        localStorage.setItem('sas_custom_apps', JSON.stringify(updated));

        window.dispatchEvent(new CustomEvent('refresh-desktop'));
        showMessage(`"${appName}" unmounted from workspace.`);
    };

    const filteredCatalog = REMIX_PRESET_CATALOG.filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isInstalled = (presetName: string) => {
        return customApps.some(app => app.name === presetName);
    };

    const SelectedIconComponent = iconMap[selectedIconName] || Globe;

    return (
        <div className="h-full w-full bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden select-text">
            {/* Header Area */}
            <div className="bg-gradient-to-br from-indigo-950/50 via-zinc-900 to-zinc-950 border-b border-zinc-800 p-5 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                            <Layers size={22} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                                SAS Application Connector
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 rounded-full">Active Host</span>
                            </h2>
                            <p className="text-xs text-zinc-400">Compile, sandbox, and overlay your external AI Studio applets onto the active desktop grid.</p>
                        </div>
                    </div>

                    {/* Quick navigation tabs */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl shrink-0">
                        <button 
                            onClick={() => { setActiveTab('catalog'); setInstallingPreset(null); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Remix Store Hub
                        </button>
                        <button 
                            onClick={() => { setActiveTab('mounted'); setInstallingPreset(null); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${activeTab === 'mounted' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Mounted ({customApps.length})
                            {customApps.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                            )}
                        </button>
                        <button 
                            onClick={() => { setActiveTab('manual'); setInstallingPreset(null); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'manual' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Custom Mount
                        </button>
                    </div>
                </div>

                {/* Toast Message banner */}
                {message && (
                    <div className={`mt-4 p-3 rounded-xl border text-xs font-medium transition-all animate-fadeIn ${message.isError ? 'bg-red-950/40 border-red-500/30 text-red-400' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Inner Content Workspace */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {installingPreset ? (
                    /* Preset Installer Screen */
                    <div className="max-w-2xl mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-scaleIn">
                        <div className="flex items-start gap-4 pb-5 border-b border-zinc-800">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${installingPreset.bgColor}`}>
                                {React.createElement(iconMap[installingPreset.iconName] || Globe, { className: "w-7 h-7 text-white" })}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-white">{installingPreset.name}</h3>
                                <p className="text-xs text-zinc-400 leading-relaxed">{installingPreset.description}</p>
                            </div>
                        </div>

                        <form onSubmit={handleInstallPreset} className="mt-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                                    <span>Deployment URL / Target Endpoint</span>
                                    <span className="text-zinc-600 text-[10px]">Must begin with http/https</span>
                                </label>
                                <input 
                                    type="text"
                                    required
                                    placeholder="https://ais-pre-bpnlavv7oycjvturfkgjwa-990435940105.europe-west2.run.app"
                                    value={presetUrl}
                                    onChange={(e) => setPresetUrl(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-500"
                                />
                                <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2">
                                    <Info size={14} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Need help finding your app's URL?</p>
                                        <p className="mt-1 opacity-80 leading-relaxed">
                                            Go to your AI Studio dashboard, click on the app card, and copy its <strong>Shared App URL</strong> or <strong>Development App URL</strong> from the browser address bar. Your current base domain is: <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">{currentBaseUrl}</code>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setInstallingPreset(null)}
                                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <Download size={14} />
                                    Mount to SAS Hub Desktop
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <>
                        {/* Tab 1: Remix Preset Hub Store */}
                        {activeTab === 'catalog' && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                            <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                                            Available Remix Preset Catalog
                                        </h3>
                                        <p className="text-[11px] text-zinc-500">Quick-mount sibling applications configured to fit flawlessly into the system grid.</p>
                                    </div>

                                    {/* Search input */}
                                    <div className="relative max-w-xs w-full">
                                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                        <input 
                                            type="text"
                                            placeholder="Search presets..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-zinc-600 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredCatalog.map((preset) => {
                                        const PresetIcon = iconMap[preset.iconName] || Globe;
                                        const alreadyMounted = isInstalled(preset.name);

                                        return (
                                            <div 
                                                key={preset.name} 
                                                className="bg-zinc-900/35 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all hover:-translate-y-0.5 hover:shadow-xl group"
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${preset.bgColor}`}>
                                                        <PresetIcon size={20} className="text-white" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                                                            {preset.name}
                                                            {alreadyMounted && (
                                                                <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-mono">Mounted</span>
                                                            )}
                                                        </h4>
                                                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">{preset.description}</p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setInstallingPreset(preset);
                                                        setPresetUrl(window.location.origin + '?app=' + preset.suggestedSlug);
                                                    }}
                                                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${alreadyMounted ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white shadow-sm'}`}
                                                >
                                                    {alreadyMounted ? <Check size={12} /> : <Download size={12} />}
                                                    {alreadyMounted ? 'Mount Additional Copy' : 'Mount Application'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Installed Apps List */}
                        {activeTab === 'mounted' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <Laptop size={16} className="text-emerald-400" />
                                    Active Integrated Workspace Interfaces
                                </h3>
                                {customApps.length === 0 ? (
                                    <div className="py-12 text-center space-y-3 border border-dashed border-zinc-800 rounded-2xl">
                                        <HelpCircle size={36} className="mx-auto text-zinc-700" />
                                        <h4 className="text-xs font-bold text-zinc-400">No Mounted Applications</h4>
                                        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                                            Integrate custom or preset apps to populate your SAS Mini-PC workspace launcher grid instantly.
                                        </p>
                                        <button 
                                            onClick={() => setActiveTab('catalog')}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl"
                                        >
                                            Browse Remix Catalog
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {customApps.map((app) => {
                                            const AppIcon = iconMap[app.iconName] || Globe;
                                            return (
                                                <div key={app.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md shrink-0 ${app.bgColor}`}>
                                                            <AppIcon size={20} className="text-white" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-white truncate">{app.name}</div>
                                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">{app.url}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <a 
                                                            href={app.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                                            title="Direct Access"
                                                        >
                                                            <ExternalLink size={15} />
                                                        </a>
                                                        <button
                                                            onClick={() => handleUnmountApp(app.id, app.name)}
                                                            className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                                                            title="Unmount App"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 3: Custom Manual Mount Form */}
                        {activeTab === 'manual' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                <form onSubmit={handleMountApp} className="lg:col-span-7 space-y-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                                    <h3 className="font-bold text-sm text-white flex items-center gap-2 pb-2 border-b border-zinc-800">
                                        <Plus size={16} className="text-indigo-400" />
                                        Manual Endpoint Configuration
                                    </h3>

                                    {/* Inputs */}
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">App Interface Title</label>
                                            <input 
                                                type="text"
                                                required
                                                placeholder="e.g. My Custom App"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-255 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">IFrame Target URL</label>
                                            <input 
                                                type="text"
                                                required
                                                placeholder="https://example.com"
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-255 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Icon Selection */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Select Icon Badge</label>
                                        <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                                            {Object.keys(iconMap).map((iconName) => {
                                                const IconComp = iconMap[iconName];
                                                const isSelected = selectedIconName === iconName;
                                                return (
                                                    <button
                                                        key={iconName}
                                                        type="button"
                                                        onClick={() => setSelectedIconName(iconName)}
                                                        className={`p-2 rounded-xl border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md' : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                                        title={iconName}
                                                    >
                                                        <IconComp size={15} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Background Gradients */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Launcher Button Gradient Theme</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                            {gradientPresets.map((preset) => {
                                                const isSelected = selectedBg === preset.class;
                                                return (
                                                    <button
                                                        key={preset.name}
                                                        type="button"
                                                        onClick={() => setSelectedBg(preset.class)}
                                                        className={`h-7 rounded-lg relative overflow-hidden transition-all ${preset.class} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-900' : 'opacity-85 hover:opacity-100'}`}
                                                        title={preset.name}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Mount Application Interface
                                    </button>
                                </form>

                                {/* Preview Sidebar */}
                                <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col items-center justify-center space-y-4">
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 self-start">Grid Presentation Preview</div>
                                    <div className="flex flex-col items-center justify-center gap-2.5 p-4 w-28 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                                        <div className={`relative w-16 h-16 ${selectedBg} rounded-2xl flex items-center justify-center shadow-lg overflow-hidden`}>
                                            <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.1)_0%,_transparent_65%)] pointer-events-none" />
                                            <SelectedIconComponent className="w-8 h-8 text-white" />
                                        </div>
                                        <span className="text-[11px] text-white font-medium text-center truncate w-full">
                                            {name.trim() || 'Custom App'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Shield Check banner */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex items-center gap-2.5 text-[11px] text-zinc-500 shrink-0">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <p>
                    All multi-agent applications run in standard sandboxed iframes. If you run into "Redirect Notice" warnings inside the frame, use the **popout icon** in the window toolbar to access the app in a dedicated tab.
                </p>
            </div>
        </div>
    );
};
