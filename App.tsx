/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, PenLine, Play, Mail, Presentation, Folder, Loader2, FileText, Image as ImageIcon, Gamepad2, Eraser, Terminal, X } from 'lucide-react';
import { Modality } from "@google/genai";
import { AppId, DesktopItem, Stroke, Email } from './types';
import { HomeScreen } from './components/apps/HomeScreen';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './lib/authContext';
import { MailApp } from './components/apps/MailApp';
import { SlidesApp } from './components/apps/SlidesApp';
import { IronMenArcadeApp } from './components/apps/IronMenArcadeApp';
import { ZenithChessApp } from './components/apps/ZenithChessApp';
import { LaserTagApp } from './components/apps/LaserTagApp';
import { SnakeGame } from './components/apps/SnakeGame';
import { FolderView } from './components/apps/FolderView';
import { DraggableWindow } from './components/DraggableWindow';
import { InkLayer } from './components/InkLayer';
import { FloatingNav } from './components/FloatingNav';
import { getAiClient, HOME_TOOLS, MAIL_TOOLS, MODEL_NAME, SYSTEM_INSTRUCTION } from './lib/gemini';
import { NotepadApp } from './components/apps/NotepadApp';
import { CyberneticExportApp } from './components/apps/CyberneticExportApp';
import { GitHubSyncApp } from './components/apps/GitHubSyncApp';
import { FlipperZeroApp } from './components/apps/FlipperZeroApp';
import { TermStudioApp } from './components/apps/TermStudioApp';
import { OllamaApp } from './components/apps/OllamaApp';
import { CloudInfrastructureApp } from './components/apps/CloudInfrastructureApp';
import { OpenClawApp } from './components/apps/OpenClawApp';
import { CodeRabbitApp } from './components/apps/CodeRabbitApp';
import { SemanticScholarApp } from './components/apps/SemanticScholarApp';
import { ResearchRabbitApp } from './components/apps/ResearchRabbitApp';
import { PapersWithCodeApp } from './components/apps/PapersWithCodeApp';
import { LangChainApp } from './components/apps/LangChainApp';
import { UnrealEngineApp } from './components/apps/UnrealEngineApp';
import { BlenderApp } from './components/apps/BlenderApp';
import { KnowledgeCompressorApp } from './components/apps/KnowledgeCompressorApp';
import { SuperSayenApp } from './components/apps/SuperSayenApp';
import { DataPodsApp } from './components/apps/DataPodsApp';
import { AiTermApp } from './components/apps/AiTermApp';
import { JackyV3App } from './components/apps/JackyV3App';
import FleetAtlasApp from './components/apps/FleetAtlasApp';
import { LlmEnvironmentApp } from './components/apps/LlmEnvironmentApp';
import { SmallAgentFleetApp } from './components/apps/SmallAgentFleetApp';
import { ModelRouterApp } from './components/apps/ModelRouterApp';
import { AgentBuilderApp } from './components/apps/AgentBuilderApp';
import { ClaudeAssistantApp } from './components/apps/ClaudeAssistantApp';
import { CodexApp } from './components/apps/CodexApp';
import { GrokTerminalApp } from './components/apps/GrokTerminalApp';
import { ChatHistoryShareApp } from './components/apps/ChatHistoryShareApp';
import { SystemSettingsApp } from './components/apps/SystemSettingsApp';
import { ArchiverApp } from './components/apps/ArchiverApp';
import { APIKeysApp } from './components/apps/APIKeysApp';
import { Footer } from './components/Footer';
import { AuthButton } from './components/AuthButton';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import { SystemMonitor } from './components/SystemMonitor';
import { LocalAiIndexFinder } from './components/LocalAiIndexFinder';
import { AppConnectorApp, iconMap } from './components/apps/AppConnectorApp';
import { Share2, Cloud, Github, Radio, Cpu, Network, Sparkles, BookOpen, Rabbit, Code2, Circle, Box, Binary, Flame, Compass, Layers, Globe, Send, HardDrive, Braces, Eye, Zap, Database, ChefHat, ClipboardList, DollarSign, Building, Music, Sliders, Video, Smartphone, Palette, Mic, MessageSquare, RefreshCw, PlayCircle, Search, FolderOpen, Users, Trophy, Volume2, Link2, Target, Disc, Bot, ShieldAlert, MoreVertical, Archive, Key } from 'lucide-react';
import { Cybernetic67App } from './components/apps/Cybernetic67App';
import { PromptToJsonApp } from './components/apps/PromptToJsonApp';
import { BuildVaultApp } from './components/apps/BuildVaultApp';
import { AiDataResolverApp } from './components/apps/AiDataResolverApp';
import { FunctionCallKitchenApp } from './components/apps/FunctionCallKitchenApp';
import { FlashUiApp } from './components/apps/FlashUiApp';
import { AgenticVisionApp } from './components/apps/AgenticVisionApp';
import { UniversalAppSimulator } from './components/apps/UniversalAppSimulator';
import { PodSystemApp } from './components/apps/PodSystemApp';
import { CloudDeployApp } from './components/apps/CloudDeployApp';
import { BotStudioApp } from './components/apps/BotStudioApp';
import { QpdbApp } from './components/apps/QpdbApp';
import { MultiAgentConsensusLab } from './components/apps/MultiAgentConsensusLab';
import { CyberSecurityRulebookApp } from './components/apps/CyberSecurityRulebookApp';
import { CrossAiLabApp } from './components/apps/CrossAiLabApp';
import { Terminal as TerminalApp } from './src/components/apps/Terminal';
import { UIStudio } from './src/components/apps/UIStudio';
import { saveGlobalState, loadGlobalState } from './lib/persist';
import { ToastProvider } from './lib/toastContext';
import { MobileStatusBar } from './components/MobileStatusBar';
import { PodControlPanel } from './components/PodControlPanel';
import { EruApp } from './components/apps/EruApp';
import { JackieShell, type PcMode } from './components/JackieShell';
import { ToolRegistryApp } from './components/apps/ToolRegistryApp';
import { AgentOrchestrationDashboard } from './components/apps/AgentOrchestrationDashboard';

const INITIAL_DESKTOP_ITEMS: DesktopItem[] = [
    { id: 'qpdb', name: 'qpdb Matrix', type: 'app', icon: Layers, appId: 'qpdb', bgColor: 'bg-gradient-to-br from-amber-600 via-rose-700 to-zinc-950 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' },
    { id: 'consensus_lab', name: 'Consensus Lab', type: 'app', icon: Network, appId: 'consensus_lab', bgColor: 'bg-gradient-to-br from-indigo-600 via-purple-700 to-zinc-950 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
    { id: 'cloud_deploy', name: 'Global Deploy', type: 'app', icon: Cloud, appId: 'cloud_deploy', bgColor: 'bg-gradient-to-br from-blue-600 via-indigo-800 to-zinc-950 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' },
    { id: 'pod_system', name: 'Semantic Pod', type: 'app', icon: Layers, appId: 'pod_system', bgColor: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-950 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
    { id: 'app_connector', name: 'App Connector', type: 'app', icon: Layers, appId: 'app_connector', bgColor: 'bg-gradient-to-br from-indigo-600 via-indigo-850 to-zinc-950 border border-indigo-500/30' },
    { id: 'flipper', name: 'Flipper Zero', type: 'app', icon: Radio, appId: 'flipper', bgColor: 'bg-gradient-to-br from-orange-500 to-orange-800' },
    { id: 'termstudio', name: 'TermStudio', type: 'app', icon: Terminal, appId: 'termstudio', bgColor: 'bg-gradient-to-br from-purple-500 to-purple-800' },
    { id: 'bot_studio', name: 'Offline AI Studio', type: 'app', icon: Bot, appId: 'bot_studio', bgColor: 'bg-gradient-to-br from-emerald-600 to-teal-900 border border-emerald-500/30 shadow-md' },
    { id: 'aiterm', name: 'ai-term', type: 'app', icon: Terminal, appId: 'aiterm', bgColor: 'bg-gradient-to-br from-emerald-500 via-emerald-700 to-emerald-950' },
    { id: 'jacky_v3', name: 'JACKY v3', type: 'app', icon: Compass, appId: 'jacky', bgColor: 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 border border-emerald-500/20 shadow-md' },
    { id: 'eru', name: 'Eru', type: 'app', icon: Sparkles, appId: 'eru', bgColor: 'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-700 border border-indigo-400/30 shadow-[0_0_15px_rgba(139,92,246,0.4)]' },
    { id: 'knowledge_compressor', name: 'Knowledge Condenser', type: 'app', icon: Binary, appId: 'knowledge_compressor', bgColor: 'bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-700' },
    { id: 'supersayen', name: 'SuperSayen AI', type: 'app', icon: Flame, appId: 'supersayen', bgColor: 'bg-gradient-to-br from-purple-600 via-pink-600 to-amber-500' },
    { id: 'ollama', name: 'Local AI (Ollama)', type: 'app', icon: Cpu, appId: 'ollama', bgColor: 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-900' },
    { id: 'small_agent_fleet', name: 'Small Agent Fleet', type: 'app', icon: Bot, appId: 'small_agent_fleet', bgColor: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-950 border border-emerald-500/30 shadow-md' },
    { id: 'model_router', name: 'Model Router', type: 'app', icon: Network, appId: 'model_router', bgColor: 'bg-gradient-to-br from-lime-500 via-emerald-600 to-teal-900 border border-lime-400/30 shadow-md' },
    { id: 'cloud_infrastructure', name: 'Cloud Infrastructure', type: 'app', icon: Cloud, appId: 'cloud_infrastructure', bgColor: 'bg-gradient-to-br from-sky-600 via-cyan-600 to-blue-900 border border-sky-400/30 shadow-md' },
    { id: 'agent_builder', name: 'Agent Builder', type: 'app', icon: Bot, appId: 'agent_builder', bgColor: 'bg-gradient-to-br from-purple-600 via-violet-600 to-purple-950 border border-purple-400/30 shadow-md' },
    { id: 'claude_assistant', name: 'Claude Assistant', type: 'app', icon: Bot, appId: 'claude_assistant', bgColor: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 border border-indigo-400/30 shadow-md' },
    { id: 'codex', name: 'Codex', type: 'app', icon: Code2, appId: 'codex', bgColor: 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-950 border border-emerald-400/30 shadow-md' },
    { id: 'grok_terminal', name: 'Grok Terminal', type: 'app', icon: Terminal, appId: 'grok_terminal', bgColor: 'bg-gradient-to-br from-green-900 via-emerald-950 to-zinc-950 border border-green-500/30 shadow-md' },
    { id: 'chat_history_share', name: 'Chat Share', type: 'app', icon: Share2, appId: 'chat_history_share', bgColor: 'bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-900 border border-cyan-400/30 shadow-md' },
    { id: 'archiver', name: 'Archiver AI', type: 'app', icon: Archive, appId: 'archiver', bgColor: 'bg-gradient-to-br from-purple-600 via-indigo-700 to-zinc-950 border border-purple-400/30 shadow-md' },
    { id: 'api_keys', name: 'API Keys', type: 'app', icon: Key, appId: 'api_keys', bgColor: 'bg-gradient-to-br from-yellow-600 via-amber-700 to-zinc-950 border border-yellow-500/30 shadow-md' },
    { id: 'system_settings', name: 'Settings', type: 'app', icon: Sliders, appId: 'system_settings', bgColor: 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 border border-purple-400/30 shadow-md' },
    { id: 'tool_registry', name: 'Tool Registry', type: 'app', icon: Star, appId: 'tool_registry', bgColor: 'bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 border border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]' },
    { id: 'agent_orchestration', name: 'Agent Orchestration', type: 'app', icon: Users, appId: 'agent_orchestration', bgColor: 'bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 border border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' },
    { id: 'openclaw', name: 'OpenClaw Hub', type: 'app', icon: Network, appId: 'openclaw', bgColor: 'bg-gradient-to-br from-blue-700 via-slate-800 to-indigo-950' },
    { id: 'coderabbit', name: 'CodeRabbit AI', type: 'app', icon: Sparkles, appId: 'coderabbit', bgColor: 'bg-gradient-to-br from-amber-500 to-orange-700' },
    { id: 'semantic_scholar', name: 'Semantic Scholar', type: 'app', icon: BookOpen, appId: 'semantic_scholar', bgColor: 'bg-gradient-to-br from-blue-500 to-blue-800' },
    { id: 'research_rabbit', name: 'ResearchRabbit AI', type: 'app', icon: Rabbit, appId: 'research_rabbit', bgColor: 'bg-gradient-to-br from-orange-400 to-orange-800' },
    { id: 'papers_with_code', name: 'Papers With Code', type: 'app', icon: Code2, appId: 'papers_with_code', bgColor: 'bg-gradient-to-br from-sky-500 to-sky-800' },
    { id: 'langchain', name: 'LangChain AI', type: 'app', icon: Network, appId: 'langchain', bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-800' },
    { id: 'unreal_engine', name: 'Unreal Engine AI', type: 'app', icon: Box, appId: 'unreal_engine', bgColor: 'bg-gradient-to-br from-purple-500 to-purple-800' },
    { id: 'blender', name: 'Blender AI', type: 'app', icon: Circle, appId: 'blender', bgColor: 'bg-gradient-to-br from-amber-500 to-amber-800' },
    { id: 'github_sync', name: 'GitHub Sync', type: 'app', icon: Github, appId: 'github_sync', bgColor: 'bg-gradient-to-br from-zinc-700 to-zinc-900' },
    { id: 'export_os', name: 'Export OS', type: 'app', icon: Share2, appId: 'cybernetic_export', bgColor: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500' },
    { id: 'mail', name: 'Mail', type: 'app', icon: Mail, appId: 'mail', bgColor: 'bg-gradient-to-br from-blue-400 to-blue-700' },
    { id: 'slides', name: 'Slides', type: 'app', icon: Presentation, appId: 'slides', bgColor: 'bg-gradient-to-br from-orange-400 to-orange-700' },
    { id: 'snake', name: 'Game', type: 'app', icon: Gamepad2, appId: 'snake', bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-800' },
    
    // --- Jessy's 33 Custom Applications ---
    { id: 'cyber_rulebook', name: 'Cyber Codex', type: 'app', icon: ShieldAlert, appId: 'cyber_rulebook', bgColor: 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-rose-950 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]' },
    { id: 'data_pods', name: 'Data Pods Vault', type: 'app', icon: Database, appId: 'data_pods', bgColor: 'bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-900 border border-cyan-400/20' },
    { id: 'cybernetic67', name: 'Telegram Replica', type: 'app', icon: Send, appId: 'cybernetic67', bgColor: 'bg-gradient-to-br from-blue-500 via-sky-600 to-sky-900 border border-sky-400/20' },
    { id: 'build_vault', name: 'BuildVault', type: 'app', icon: HardDrive, appId: 'build_vault', bgColor: 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-900 border border-amber-400/20' },
    { id: 'prompt_to_json', name: 'Prompt to JSON', type: 'app', icon: Braces, appId: 'prompt-to-json', bgColor: 'bg-gradient-to-br from-purple-500 via-purple-650 to-indigo-900 border border-purple-400/20' },
    { id: 'agentic_vision', name: 'Gemini Agentic Vision', type: 'app', icon: Eye, appId: 'agentic-vision', bgColor: 'bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-900 border border-cyan-400/20' },
    { id: 'flash_ui', name: 'Flash UI', type: 'app', icon: Zap, appId: 'flash-ui', bgColor: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 border border-indigo-400/20' },
    { id: 'data_resolver', name: 'AI Data Resolver', type: 'app', icon: Database, appId: 'data-resolver', bgColor: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-900 border border-emerald-400/20' },
    { id: 'function_call_kitchen', name: 'Function Call Kitchen', type: 'app', icon: Cpu, appId: 'function-call-kitchen', bgColor: 'bg-gradient-to-br from-red-500 via-amber-600 to-orange-800 border border-red-400/20' },
    { id: 'zenith_chess', name: 'Zenith Chess AI', type: 'app', icon: Trophy, appId: 'chess', bgColor: 'bg-gradient-to-br from-yellow-500 via-amber-600 to-yellow-950 border border-yellow-400/20' },
    { id: 'iron_men_arcade', name: 'Iron Men Arcade', type: 'app', icon: Gamepad2, appId: 'iron-men-arcade', bgColor: 'bg-gradient-to-br from-rose-600 via-red-600 to-yellow-600 border border-rose-500/20' },
    { id: 'laser_tag', name: 'Laser Tag Arcade', type: 'app', icon: Target, appId: 'laser-tag', bgColor: 'bg-gradient-to-br from-red-600 via-orange-600 to-zinc-950 border border-red-500/20' },
    { id: 'fleet_atlas', name: 'Fleet Atlas', type: 'app', icon: Globe, appId: 'fleet_atlas', bgColor: 'bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.4)]' },
    { id: 'llm_environment', name: 'LLM Studio', type: 'app', icon: Sparkles, appId: 'llm_environment', bgColor: 'bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-700' },
    { id: 'cross_ai_lab', name: 'Cross-AI Lab', type: 'app', icon: Bot, appId: 'cross_ai_lab', bgColor: 'bg-gradient-to-br from-violet-600 via-purple-700 to-pink-700 border border-violet-400/40 shadow-[0_0_15px_rgba(139,92,246,0.3)]' },
    { id: 'terminal', name: 'Opus Terminal', type: 'app', icon: Terminal, appId: 'terminal', bgColor: 'bg-gradient-to-br from-slate-800 via-blue-900/30 to-slate-900 border border-slate-600/50 shadow-[0_0_20px_rgba(51,65,85,0.4)]' },
    { id: 'ui_studio', name: 'UI Studio', type: 'app', icon: Palette, appId: 'ui_studio', bgColor: 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-950 border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)]' },
    {
        id: 'how_to_use', 
        name: 'how_to_use.txt', 
        type: 'app', 
        icon: FileText, 
        appId: 'notepad', 
        bgColor: 'bg-gradient-to-br from-pink-500 to-pink-700',
        notepadInitialContent: `GEMINI INK - GESTURE GUIDE

Navigate your computer using natural hand-drawn sketches.

GLOBAL / DESKTOP
----------------
1. Delete Item: 
   Draw an "X" or a cross over any app icon or folder to delete it.

2. Explode Folder: 
   Draw outward pointing arrows coming out of a folder to "explode" it and reveal its contents on the desktop.

3. Get Info / Summarize: 
   Draw a question mark "?" over an item.
   - If it's a folder, it lists contents.
   - If it's a text file, it reads and summarizes the text.

4. Generate Wallpaper: 
   Draw a sketch on the empty background (mountains, flowers, abstract shapes) to generate a new AI wallpaper based on your drawing.

MAIL APP
--------
1. Delete Email: 
   Draw a horizontal line (strike-through) or an "X" over an email row.

2. Summarize Email: 
   Draw a question mark "?" over an email row or highlight it to get a one-sentence summary of the email body.

TIPS
----
- Ensure your ink contrasts with the background.
- Distinct shapes work best.`
    },
    { 
        id: 'notes', 
        name: 'notes.txt', 
        type: 'app', 
        icon: FileText, 
        appId: 'notepad', 
        bgColor: 'bg-gradient-to-br from-zinc-400 to-zinc-600',
        notepadInitialContent: `TODO LIST:
- Buy milk, eggs, and bread
- Call mom on weekend
- Finish Gemini Ink demo
- Schedule dentist appointment
- Water the plants

RANDOM THOUGHTS:
The universe is vast and full of mysteries. 
Why do cats purr? 
Is time travel possible?`
    },
    { 
        id: 'project_specs', 
        name: 'novel.txt', 
        type: 'app', 
        icon: FileText, 
        appId: 'notepad', 
        bgColor: 'bg-gradient-to-br from-indigo-400 to-indigo-600',
        notepadInitialContent: `THE BOND

Elara lived in a small cottage at the edge of the Whispering Woods, a place where the trees murmured secrets to those willing to listen. Her only companion was Barnaby, a scruffy terrier mix with one ear that stood at attention and another that flopped lazily over his brow. 

They were a pair, Elara and Barnaby. Where she went, he trotted behind, his nails clicking a familiar rhythm on the cobblestones of the village or sinking silently into the moss of the forest floor. He was her shadow, her confidant, and her anchor in a world that often felt too large and too loud.

One bitter winter evening, a storm rolled in, fierce and howling. The wind rattled the windowpanes like an angry spirit demanding entry. Elara sat by the hearth, knitting a scarf, while Barnaby dozed at her feet, chasing dream-rabbits with twitching paws. Suddenly, the power cut, plunging the cottage into darkness.

Barnaby was up in an instant. He didn't whine. He simply pressed his warm flank against Elara's leg, a sturdy, living presence in the void. He guided her, step by step, to the kitchen where the candles were kept, his low woof signaling obstacles she couldn't see. 

As they sat together by candlelight, the storm raging outside, Elara buried her face in his fur. He smelled of pine needles and rain. "You're a good boy, Barnaby," she whispered. He licked her hand, a rough, wet sandpaper kiss that said, clearer than any words, "I am here. We are safe."

Years passed, and Barnaby's muzzle turned gray. His walks became slower, his naps longer. But the look in his eyes—that adoration, that absolute, unwavering trust—never dimmed. And when the day came that he could no longer stand, Elara sat with him on the floor, holding his paw as he drifted away. 

The cottage felt empty afterwards, the silence deafening. But sometimes, when the wind blew through the Whispering Woods, Elara could swear she heard the click-click-click of nails on the floorboards, and felt a phantom warmth against her leg, reminding her that love, once given, never truly leaves.`
    },
    { id: 'docs', name: 'Documents', type: 'folder', icon: Folder, bgColor: 'bg-gradient-to-br from-sky-400 to-sky-700', contents: [
        { id: 'doc1', name: 'Report.docx', type: 'app', icon: FileText, bgColor: 'bg-gradient-to-br from-blue-500 to-blue-700' },
        { id: 'img1', name: 'Vacation.png', type: 'app', icon: ImageIcon, bgColor: 'bg-gradient-to-br from-purple-500 to-purple-700' }
    ] },
    { id: 'projects', name: 'Projects', type: 'folder', icon: Folder, bgColor: 'bg-gradient-to-br from-indigo-400 to-indigo-700', contents: [
        { id: 'p1', name: 'Gemini_Demo.ts', type: 'app', icon: FileText, bgColor: 'bg-gradient-to-br from-cyan-500 to-cyan-700' }
    ]}
];

const INITIAL_EMAILS: Email[] = [
    { id: 1, from: 'Thoms M.', subject: 'Project Deadline Updated!', preview: 'We need to push the launch date by two weeks due to...', body: 'Hi Team,\n\nWe need to push the launch date by two weeks due to pending QA approvals. Please update your roadmaps accordingly.\n\nThanks,\nBoss', time: '10:45 AM', unread: true },
    { id: 2, from: 'HR Department', subject: 'Annual Leave Policy', preview: 'Please review the attached changes to our annual leave policy...', body: 'Dear Employees,\n\nPlease review the attached changes to our annual leave policy effective next month. The main change concerns rollover days.\n\nRegards,\nHR', time: 'Yesterday', unread: false },
    { id: 3, from: 'Newsletter', subject: 'Tech Trends 2024', preview: 'Top 10 AI trends you need to watch out for this year...', body: 'Welcome to this week\'s newsletter! Here are the Top 10 AI trends:\n1. Multimodal Models\n2. Agentic AI\n3. ... [Click to read more]', time: 'Yesterday', unread: false },
    { id: 4, from: 'Jane', subject: 'Dinner on Sunday?', preview: 'Are you still coming over for dinner this weekend? Let me know...', body: 'Hi honey,\n\nAre you still coming over for dinner this weekend? Dad is making his famous lasagna. Let me know if you can make it!\n\nLove,\nMom', time: 'Oct 5', unread: false },
    { id: 5, from: 'Service Alert', subject: 'Downtime Scheduled', preview: 'Maintenance window scheduled for this Saturday 2AM-4AM EST...', body: 'System Notice:\n\nMaintenance window scheduled for this Saturday 2AM-4AM EST. All services will be unavailable during this time.', time: 'Oct 4', unread: true },
    { id: 6, from: 'Online Store', subject: 'Your order has shipped!', preview: 'Good news! Your recent order #123456789 has been shipped...', body: 'Hi there,\n\nYour order #123456789 has shipped via Ground Delivery. It should arrive by Friday.\n\nTrack your package: [Link]', time: 'Oct 3', unread: false },
    { id: 7, from: 'Bank', subject: 'Statement Available', preview: 'Your electronic statement for September is now available...', body: 'Dear Customer,\n\nYour Sep 2023 statement is available online. Log in to view it securely.', time: 'Oct 1', unread: false },
    { id: 8, from: 'Streaming Service', subject: 'New Arrivals this Month', preview: 'Check out what\'s new: The Galactic Saga, Mystery Manor...', body: 'Ready for the weekend? Here are the hottest new shows and movies added this month!', time: 'Sep 28', unread: false },
    { id: 9, from: 'Recruiter', subject: 'Job Opportunity - Senior Dev', preview: 'I came across your profile and thought you might be a good fit...', body: 'Hello,\n\nI\'m recruiting for a Senior Developer role at a fast-growing startup. Are you open to new opportunities?', time: 'Sep 25', unread: false },
    { id: 10, from: 'Gym', subject: 'Membership Renewal', preview: 'Your annual membership is due for renewal next month...', body: 'Hi Member,\n\nJust a friendly reminder that your membership expires in 30 days. Renew now to lock in current rates!', time: 'Sep 20', unread: false },
    { id: 11, from: 'Utility Co', subject: 'Bill is Ready', preview: 'Your electric bill for August is $145.32...', body: 'Your bill is ready to view and pay. Total amount due: $145.32. Due date: Oct 15.', time: 'Sep 15', unread: false },
    { id: 12, from: 'Travel Agent', subject: 'Flight Confirmation: NYC to LON', preview: 'Booking Ref: ABCDEF. See attached itinerary...', body: 'Thank you for booking with us. Your flight to London is confirmed. Please find your e-tickets attached.', time: 'Sep 10', unread: false },
    { id: 13, from: 'Team Lead', subject: 'Code Review Reminder', preview: 'Please review PR #456 before EOD today...', body: 'Hey,\n\nCan you take a look at PR #456 when you get a chance? We need to merge it before the release cut.', time: 'Sep 9', unread: false },
    { id: 14, from: 'Security', subject: 'Password Expiry Notice', preview: 'Your corporate account password will expire in 5 days...', body: 'Automated Notice:\n\nYour password will expire in 5 days. Please change it via the self-service portal to avoid being locked out.', time: 'Sep 5', unread: false },
    { id: 15, from: 'Coffee Shop', subject: 'Free Birthday Drink!', preview: 'Happy Birthday month! Come in for a free drink on us...', body: 'Happy Birthday! Pop in anytime this month and show this email for a free tall beverage of your choice.', time: 'Sep 1', unread: false },
];

interface OpenWindow {
    id: string;
    item: DesktopItem;
    zIndex: number;
    pos: { x: number, y: number };
    size?: { width: number, height: number };
}

const getMergedDesktopItems = (): (DesktopItem | null)[] => {
    const saved = localStorage.getItem('sas_custom_apps');
    let customList: DesktopItem[] = [];
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            customList = parsed.map((app: any) => ({
                id: app.id,
                name: app.name,
                type: 'app',
                icon: iconMap[app.iconName] || Globe,
                appId: app.id,
                bgColor: app.bgColor,
                url: app.url,
                iconName: app.iconName
            }));
        } catch (e) {
            console.error("Failed to parse custom apps", e);
        }
    }
    return [...INITIAL_DESKTOP_ITEMS, ...customList];
};

export const App: React.FC = () => {
    // Auth temporarily disabled - will re-enable later
    // const { user, loading, isAuthenticated } = useAuth();

    const globalState = loadGlobalState();

    // Process desktop items: merge initial, custom, and apply deletions/explosions
    let initialDesktopItems = getMergedDesktopItems();
    if (globalState?.desktopItemIds) {
        const allItemsMap = new Map<string, DesktopItem>();
        const populateMap = (items: (DesktopItem | null)[]) => {
            for (const item of items) {
                if (item) {
                    allItemsMap.set(item.id, item);
                    if (item.type === 'folder' && item.contents) {
                        populateMap(item.contents);
                    }
                }
            }
        };
        populateMap(initialDesktopItems);
        const restoredItems = globalState.desktopItemIds.map((id: string | null) => id ? (allItemsMap.get(id) || null) : null);
        
        const restoredItemIds = new Set(globalState.desktopItemIds.filter(Boolean));
        const newRootItems = initialDesktopItems.filter(item => item && !restoredItemIds.has(item.id));
        
        initialDesktopItems = [...restoredItems, ...newRootItems];
    }

    const [desktopItems, setDesktopItems] = useState<(DesktopItem | null)[]>(initialDesktopItems);
    
    // Process open windows
    let initialWindows: OpenWindow[] = [];
    if (globalState?.openWindows) {
        initialWindows = globalState.openWindows.map((sw: any) => {
            let item: DesktopItem | undefined | null = null;
            // search at root
            item = initialDesktopItems.find(d => d?.id === sw.itemId);
            // search in folders
            if (!item) {
                for (const d of initialDesktopItems) {
                    if (d?.type === 'folder' && d.contents) {
                        const found = d.contents.find(c => c.id === sw.itemId);
                        if (found) { item = found; break; }
                    }
                }
            }
            if (!item) return null;
            return { ...sw, item };
        }).filter(Boolean);
    }

    const [openWindows, setOpenWindows] = useState<OpenWindow[]>(initialWindows);
    const [focusedId, setFocusedId] = useState<string | null>(globalState?.focusedId || null);
    const [nextZIndex, setNextZIndex] = useState(globalState?.nextZIndex || 100);
    const [inkMode, setInkMode] = useState(false);
    const [showInkToolbar, setShowInkToolbar] = useState(false);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [emails, setEmails] = useState<Email[]>(globalState?.emails || INITIAL_EMAILS);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState<{ title?: string; message: React.ReactNode } | null>(null);
    const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(globalState?.wallpaperUrl || null);
    // Jackie front-page shell: 'closed' = Jackie full screen (front page),
    // 'half' = PC on top / Jackie below, 'full' = PC full screen.
    const [pcMode, setPcMode] = useState<PcMode>('closed');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [desktopVisibility, setDesktopVisibility] = useState<Record<string, boolean>>(() => {
        if (globalState?.desktopVisibility) {
            return globalState.desktopVisibility;
        }
        const saved = localStorage.getItem('desktop_visibility_v1');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(e);
            }
        }
        const initialMap: Record<string, boolean> = {};
        INITIAL_DESKTOP_ITEMS.forEach(item => {
            if (item) {
                initialMap[item.id] = ['qpdb', 'consensus_lab', 'data_pods', 'how_to_use'].includes(item.id);
            }
        });
        return initialMap;
    });

    useEffect(() => {
        localStorage.setItem('desktop_visibility_v1', JSON.stringify(desktopVisibility));
    }, [desktopVisibility]);

    useEffect(() => {
        const desktopItemIds = desktopItems.map(item => item ? item.id : null);
        saveGlobalState({
            openWindows: openWindows.map(w => ({ id: w.id, itemId: w.item.id, zIndex: w.zIndex, pos: w.pos, size: w.size })),
            focusedId,
            nextZIndex,
            emails,
            wallpaperUrl,
            desktopItemIds,
            desktopVisibility
        });
    }, [openWindows, focusedId, nextZIndex, emails, wallpaperUrl, desktopItems, desktopVisibility]);

    const showToast = (message: React.ReactNode, title?: string, autoDismiss: boolean = true) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setToast({ message, title });
        if (autoDismiss) {
            timeoutRef.current = setTimeout(() => {
                setToast(null);
                timeoutRef.current = null;
            }, 6000);
        }
    };

    const handleLaunch = (item: DesktopItem) => {
        if (inkMode) return;
        
        if (openWindows.find(w => w.id === item.id)) {
            focusWindow(item.id);
            return;
        }

        let initialSize = { width: 960, height: 600 };
        if (item.appId === 'app_connector') initialSize = { width: 950, height: 620 };
        if (item.url) initialSize = { width: 950, height: 650 };
        if (item.appId === 'mail') initialSize = { width: 800, height: 600 };
        if (item.appId === 'aiterm') initialSize = { width: 450, height: 840 };
        if (item.appId === 'snake') initialSize = { width: 500, height: 550 };
        if (item.appId === 'notepad') initialSize = { width: 400, height: 500 };
        if (item.appId === 'cybernetic_export') initialSize = { width: 580, height: 620 };
        if (item.appId === 'ollama') initialSize = { width: 750, height: 550 };
        if (item.appId === 'openclaw') initialSize = { width: 850, height: 600 };
        if (item.appId === 'coderabbit') initialSize = { width: 900, height: 620 };
        if (item.appId === 'semantic_scholar') initialSize = { width: 900, height: 620 };
        if (item.appId === 'research_rabbit') initialSize = { width: 800, height: 500 };
        if (item.appId === 'papers_with_code') initialSize = { width: 800, height: 500 };
        if (item.appId === 'langchain') initialSize = { width: 800, height: 500 };
        if (item.appId === 'unreal_engine') initialSize = { width: 800, height: 500 };
        if (item.appId === 'blender') initialSize = { width: 800, height: 500 };
        if (item.appId === 'knowledge_compressor') initialSize = { width: 1000, height: 680 };
        if (item.appId === 'supersayen') initialSize = { width: 1020, height: 700 };
        if (item.appId === 'jacky') initialSize = { width: 1020, height: 700 };
        if (item.appId === 'fleet_atlas') initialSize = { width: 900, height: 640 };
        if (item.appId === 'llm_environment') initialSize = { width: 440, height: 760 };
        if (item.appId === 'terminal') initialSize = { width: 700, height: 500 };
        if (item.appId === 'ui_studio') initialSize = { width: 960, height: 620 };
        if (item.appId === 'cross_ai_lab') initialSize = { width: 1000, height: 700 };

        setOpenWindows(prev => [...prev, {
            id: item.id,
            item: item,
            zIndex: nextZIndex,
            pos: { x: 100 + (prev.length * 30), y: 80 + (prev.length * 30) },
            size: initialSize
        }]);
        setNextZIndex(prev => prev + 1);
        setFocusedId(item.id);
    };

    useEffect(() => {
        const handleRefresh = () => {
            setDesktopItems(getMergedDesktopItems());
        };
        window.addEventListener('refresh-desktop', handleRefresh);
        return () => {
            window.removeEventListener('refresh-desktop', handleRefresh);
        };
    }, []);

    useEffect(() => {
        const handleLaunchAppEvent = (e: Event) => {
            const customEvent = e as CustomEvent<{ appId: AppId | string }>;
            if (customEvent.detail && customEvent.detail.appId) {
                const item = desktopItems.find(d => d && d.appId === customEvent.detail.appId);
                if (item) {
                    handleLaunch(item);
                }
            }
        };
        window.addEventListener('launch-app', handleLaunchAppEvent);
        return () => {
            window.removeEventListener('launch-app', handleLaunchAppEvent);
        };
    }, [openWindows, nextZIndex, focusedId, inkMode, desktopItems]);

    // Global shell hotkey: backtick (`) opens the ai-term terminal from
    // anywhere, like a real mini-PC drop-down console — unless the user is
    // typing into a field.
    useEffect(() => {
        const handleHotkey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = !!target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            );
            if (e.key === '`' && !typing) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId: 'aiterm' } }));
            }
        };
        window.addEventListener('keydown', handleHotkey);
        return () => window.removeEventListener('keydown', handleHotkey);
    }, []);

    const closeWindow = (id: string) => {
        setOpenWindows(prev => prev.filter(w => w.id !== id));
        if (focusedId === id) setFocusedId(null);
    };

    const focusWindow = (id: string | null) => {
        if (id === null) {
            setFocusedId(null);
            return;
        }
        setFocusedId(id);
        setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w));
        setNextZIndex(prev => prev + 1);
    };

    const handleGlobalBack = () => {
        // Dispatch custom request event so active apps can intercept and handle internal back navigations
        const backEvent = new CustomEvent('global-back-request', { 
            cancelable: true, 
            detail: { focusedId } 
        });
        const isDefaultPrevented = !window.dispatchEvent(backEvent);
        if (isDefaultPrevented) {
            return; // Internal back navigation was handled by the active app
        }

        if (focusedId) {
            closeWindow(focusedId);
        } else if (openWindows.length > 0) {
            // Find window with highest zIndex
            const sorted = [...openWindows].sort((a, b) => b.zIndex - a.zIndex);
            const topWindow = sorted[0];
            if (topWindow) {
                closeWindow(topWindow.id);
            }
        }
    };

    const deleteItemRecursively = (items: (DesktopItem | null)[], nameToDelete: string, isRoot: boolean = true): { newItems: (DesktopItem | null)[], deleted: boolean } => {
        let deleted = false;
        
        const mappedItems = items.map(item => {
            if (!item) return null; // Propagate existing gaps

            if (item.name.toLowerCase().includes(nameToDelete)) {
                deleted = true;
                // If root, return null to "lock" the grid gap. 
                // If not root, return undefined to mark for filtering (standard OS folder behavior).
                return isRoot ? null : undefined; 
            }
            
            if (item.type === 'folder' && item.contents) {
                // Recurse, passing isRoot=false to enable standard shifting inside folders.
                // We cast contents to (DesktopItem | null)[] to satisfy the recursive call type, 
                // though standard folders currently don't have nulls.
                const result = deleteItemRecursively(item.contents as (DesktopItem | null)[], nameToDelete, false);
                if (result.deleted) deleted = true;
                
                // Filter out any 'undefined' returned from non-root recursive calls to maintain contiguous lists in folders.
                const newContents = result.newItems.filter((i): i is DesktopItem => i !== null && i !== undefined);
                return { ...item, contents: newContents };
            }
            return item;
        });

        // If we are not at root, we need to actually remove the items we marked with 'undefined'.
        // At root, we keep 'null's to lock the grid.
        const finalItems = isRoot ? mappedItems : mappedItems.filter(i => i !== undefined);

        return { newItems: finalItems as (DesktopItem | null)[], deleted };
    };

    const findItemByName = (items: (DesktopItem | null)[], name: string): DesktopItem | undefined => {
        for (const item of items) {
            if (!item) continue;
            if (item.name.toLowerCase().includes(name.toLowerCase())) {
                return item;
            }
            if (item.type === 'folder' && item.contents) {
                const found = findItemByName(item.contents, name);
                if (found) return found;
            }
        }
        return undefined;
    };

    const findEmailInList = (emailList: Email[], subjectQuery?: string, senderQuery?: string) => {
         const sQuery = subjectQuery?.toLowerCase() || '';
         const fQuery = senderQuery?.toLowerCase() || '';
         
         return emailList.find(e => {
             const subjectMatch = sQuery && e.subject.toLowerCase().includes(sQuery);
             const senderMatch = fQuery && e.from.toLowerCase().includes(fQuery);
             if (sQuery && fQuery) return subjectMatch && senderMatch;
             return subjectMatch || senderMatch;
         });
    };

    const getSketchImage = (currentStrokes: Stroke[]) => {
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Fill black background for high contrast input to the model
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw white strokes
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        currentStrokes.forEach(stroke => {
            if (stroke.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            ctx.stroke();
        });
        
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    };

    const executeInkAction = async () => {
        if (strokes.length === 0) {
            showToast("Draw something first!", undefined, true);
            return;
        }

        setIsProcessing(true);
        try {
            const canvas = await html2canvas(document.body, {
                 ignoreElements: (element) => element.id === 'control-bar',
                 logging: false,
                 useCORS: true,
                 scale: 1 
            });
            const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

            const ai = getAiClient();
            
            let activeTools = HOME_TOOLS;
            let contextDescription = 'Desktop (Home Screen)';

            if (focusedId) {
                const focusedWindow = openWindows.find(w => w.id === focusedId);
                if (focusedWindow?.item.appId === 'mail') {
                    activeTools = MAIL_TOOLS;
                    contextDescription = 'Mail App';
                }
            }

             const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: `Analyze the white ink drawings. The user is currently focused on: ${contextDescription}.` }
                ],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: activeTools,
                    temperature: 0.1,
                }
            });

            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                let actionTaken = false;
                let workingDesktopItems = [...desktopItems];
                let workingEmails = [...emails];
                let desktopItemsChanged = false;
                let emailsChanged = false;
                let messages: React.ReactNode[] = [];
                let isSummary = false;

                for (const call of functionCalls) {
                    console.log('Tool call:', call.name, call.args);
                    const args = call.args as any;

                    if (call.name === 'delete_item' && args.itemName) {
                        const itemName = args.itemName.toLowerCase();
                        const { newItems, deleted } = deleteItemRecursively(workingDesktopItems, itemName, true);
                        if (deleted) {
                            workingDesktopItems = newItems;
                            desktopItemsChanged = true;
                            messages.push(<div key={`del-${args.itemName}`}>Deleted {args.itemName}</div>);
                            actionTaken = true;
                        }
                    } else if (call.name === 'explode_folder' && args.folderName) {
                        const folderName = args.folderName.toLowerCase();
                        const folder = findItemByName(workingDesktopItems, folderName);

                        if (folder && folder.type === 'folder' && folder.contents) {
                            workingDesktopItems = workingDesktopItems.filter(i => i?.id !== folder.id);
                            workingDesktopItems.push(...folder.contents);
                            desktopItemsChanged = true;
                            messages.push(<div key={`exp-${folder.id}`}>Exploded {folder.name}</div>);
                            actionTaken = true;
                        }
                    } else if (call.name === 'explain_item' && args.itemName) {
                        const item = findItemByName(workingDesktopItems, args.itemName);
                        if (item) {
                            if (item.type === 'folder') {
                                const contentCount = item.contents?.length || 0;
                                const contentNames = item.contents?.map(i => i.name).join(', ') || 'nothing';
                                messages.push(
                                    <div key={`expl-${item.id}`}>
                                        <span className="font-extrabold text-white text-3xl underline decoration-sky-500/50">{item.name}</span> contains {contentCount} items: {contentNames}.
                                    </div>
                                );
                                isSummary = true;
                            } else if (item.notepadInitialContent) {
                                showToast(`Reading ${item.name}...`, undefined, true);
                                try {
                                    const summaryResponse = await ai.models.generateContent({
                                        model: 'gemini-3-flash-preview',
                                        contents: `Summarize this in one sentence: ${item.notepadInitialContent}`,
                                    });
                                    messages.push(
                                        <div key={`expl-${item.id}`}>
                                            <span className="font-extrabold text-white text-3xl underline decoration-sky-500/50">{item.name}</span>: {summaryResponse.text}
                                        </div>
                                    );
                                    isSummary = true;
                                } catch (e) {
                                    console.error("Summary failed", e);
                                    messages.push(<div key={`err-${item.id}`}>Could not read {item.name}.</div>);
                                }
                            } else {
                                 messages.push(<div key={`expl-${item.id}`}>{item.name} is an application.</div>);
                            }
                            actionTaken = true;
                        }
                    } else if (call.name === 'change_background') {
                        showToast("Dreaming up new wallpaper...", undefined, true);
                        const sketchBase64 = getSketchImage(strokes);
                        if (sketchBase64) {
                             try {
                                 // Call gemini-2.5-flash-image to generate wallpaper from sketch
                                 const imgResponse = await ai.models.generateContent({
                                    model: 'gemini-2.5-flash-image',
                                    contents: [
                                        { inlineData: { mimeType: 'image/jpeg', data: sketchBase64 } },
                                        { text: `Generate an aesthetically pleasing, realistic looking wallpaper based on this sketch. The final image should align well spatially with the original trace, as if the sketch was a guideline, but REMOVE all the actual sketch lines from the final output. ${args.sketch_description ? `It looks like: ${args.sketch_description}` : ''}` }
                                    ],
                                    config: {
                                        responseModalities: [Modality.IMAGE],
                                    }
                                });
                                
                                const candidates = imgResponse.candidates;
                                if (candidates && candidates[0]?.content?.parts) {
                                    for (const part of candidates[0].content.parts) {
                                        if (part.inlineData && part.inlineData.data) {
                                             setWallpaperUrl(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
                                             messages.push(<div key="wp-ok">Wallpaper updated!</div>);
                                             actionTaken = true;
                                             break;
                                        }
                                    }
                                }
                                if (!actionTaken) messages.push(<div key="wp-fail">Failed to generate wallpaper.</div>);

                             } catch (err) {
                                 console.error("Wallpaper generation error", err);
                                 messages.push(<div key="wp-err">Error generating wallpaper.</div>);
                             }
                        }
                    } 
                    else if (call.name === 'delete_email' && (args.subject_text || args.sender_text)) {
                         const emailToDelete = findEmailInList(workingEmails, args.subject_text, args.sender_text);
                         if (emailToDelete) {
                             workingEmails = workingEmails.filter(e => e.id !== emailToDelete.id);
                             emailsChanged = true;
                             messages.push(<div key={`del-mail-${emailToDelete.id}`}>Deleted email from {emailToDelete.from}</div>);
                             actionTaken = true;
                         }
                    } else if (call.name === 'summarize_email' && (args.subject_text || args.sender_text)) {
                        const emailToSummarize = findEmailInList(workingEmails, args.subject_text, args.sender_text);
                        if (emailToSummarize) {
                            showToast(`Summarizing email from ${emailToSummarize.from}...`, undefined, true);
                            try {
                                const summaryResponse = await ai.models.generateContent({
                                    model: 'gemini-3-flash-preview',
                                    contents: `Summarize the body of this email in one concise sentence.
From: ${emailToSummarize.from}
Subject: ${emailToSummarize.subject}
Body: ${emailToSummarize.body}`,
                                });
                                messages.push(
                                    <div key={`sum-mail-${emailToSummarize.id}`}>
                                        <span className="font-extrabold text-white text-3xl underline decoration-sky-500/50">Summary ({emailToSummarize.from})</span>: {summaryResponse.text}
                                    </div>
                                );
                                actionTaken = true;
                                isSummary = true;
                            } catch (e) {
                                console.error("Email summary failed", e);
                                messages.push(<div key={`sum-err-${emailToSummarize.id}`}>Could not summarize email from {emailToSummarize.from}.</div>);
                            }
                        }
                    }
                }

                if (desktopItemsChanged) {
                    setDesktopItems(workingDesktopItems);
                    setOpenWindows(prev => prev.filter(w => findItemByName(workingDesktopItems, w.item.name)));
                }
                if (emailsChanged) {
                    setEmails(workingEmails);
                }

                if (messages.length > 0) {
                    // Result toast - Persistent (autoDismiss=false)
                    showToast(<div className="flex flex-col gap-3">{messages}</div>, isSummary ? "Summary" : undefined, false);
                } else if (!actionTaken) {
                     showToast("Action not matched to any item.", undefined, true);
                }

            } else {
                 showToast("No action recognized.", undefined, true);
            }

        } catch (e) {
            console.error("Gemini Error:", e);
            showToast("Error processing.", undefined, true);
        } finally {
            setIsProcessing(false);
            setStrokes([]);
        }
    };

    // Reduced padding for buttons (p-5 -> p-4)
    const buttonBaseClasses = "relative overflow-hidden p-4 rounded-full transition-all duration-300 border-t border-white/5 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.1)] active:scale-95";
    const glossOverlay = <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.15)_0%,_transparent_60%)] pointer-events-none" />;

    // Reduced icon size (34 -> 28)
    const ICON_SIZE = 28;

    const handleGlobalPointerDown = (e: React.PointerEvent) => {
        if (toast) {
            const target = e.target as HTMLElement;
            if (!target.closest('.toast-card')) {
                setToast(null);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            }
        }
    };

    return (
        <div 
            className="h-full w-full bg-black text-os-text font-sans overflow-hidden relative" 
            onPointerDownCapture={handleGlobalPointerDown}
        >
            {/* Float-centered on-device AI Index Finder capsule */}
            <LocalAiIndexFinder 
                apps={desktopItems.filter(Boolean) as any[]}
                onLaunchApp={(id) => {
                    const item = desktopItems.find(d => d && d.id === id);
                    if (item) handleLaunch(item);
                }}
            />

            <MobileStatusBar
                openWindows={openWindows.map(w => ({ id: w.id, title: w.item.name }))}
                onFocusWindow={focusWindow}
            />

            {/* Pod Control Panel — always accessible, in Jackie and PC modes alike */}
            <PodControlPanel
                openWindows={openWindows.map(w => ({ id: w.id, title: w.item.name }))}
            />

            {/* The app-library menu lives inside the PC — hidden on Jackie's front page */}
            {pcMode !== 'closed' && (
                <FloatingNav
                    apps={desktopItems.filter(Boolean) as DesktopItem[]}
                    onLaunchApp={handleLaunch}
                    inkMode={inkMode}
                    toggleInkMode={() => setInkMode(!inkMode)}
                    onClearInk={() => setStrokes([])}
                    onExecuteInk={executeInkAction}
                    hasInk={strokes.length > 0}
                    isProcessing={isProcessing}
                    onBack={handleGlobalBack}
                    desktopVisibility={desktopVisibility}
                    onToggleDesktopVisibility={(appId) => {
                        setDesktopVisibility(prev => ({
                            ...prev,
                            [appId]: prev[appId] === false ? true : false
                        }));
                    }}
                />
            )}

            {/* Jackie — the front page. Sits over the PC (desktop) base layer. */}
            <JackieShell
                apps={desktopItems.filter(Boolean) as DesktopItem[]}
                onLaunchApp={handleLaunch}
                pcMode={pcMode}
                setPcMode={setPcMode}
                onOpenEru={() => {
                    const eru = (desktopItems.filter(Boolean) as DesktopItem[]).find(d => d.appId === 'eru');
                    if (eru) handleLaunch(eru);
                    setPcMode(prev => (prev === 'closed' ? 'half' : prev));
                }}
                onOpenSettings={() => {
                    const settings = (desktopItems.filter(Boolean) as DesktopItem[]).find(d => d.appId === 'system_settings');
                    if (settings) handleLaunch(settings);
                    setPcMode(prev => (prev === 'closed' ? 'half' : prev));
                }}
            />

            {/* Desktop Area with Dynamic Background */}
            <div 
                className="h-full w-full relative overflow-hidden bg-zinc-900 transition-all duration-1000 ease-in-out"
                style={{
                    backgroundImage: wallpaperUrl 
                       ? `url(${wallpaperUrl})` 
                       : 'radial-gradient(circle at 50% 120%, rgba(120, 119, 198, 0.25) 0%, transparent 50%), radial-gradient(circle at 10% 100%, rgba(56, 189, 248, 0.2) 0%, transparent 30%), radial-gradient(circle at 90% 100%, rgba(236, 72, 153, 0.2) 0%, transparent 30%), radial-gradient(circle at 30% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 20%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            >
                
                {/* Background Home Screen (Clicking it focuses desktop) */}
                <div className="h-full w-full" onMouseDown={() => focusWindow(null)}>
                     <HomeScreen 
                         items={desktopItems.filter(item => item && desktopVisibility[item.id] !== false)} 
                         onLaunch={handleLaunch} 
                     />
                </div>

                {/* Windows */}
                {openWindows.map(win => {
                    let content = null;
                    if (win.item.type === 'folder') content = <FolderView folder={win.item} />;
                    else if (win.item.appId === 'mail') content = <MailApp emails={emails} />;
                    else if (win.item.appId === 'slides') content = <SlidesApp />;
                    else if (win.item.appId === 'snake') content = <SnakeGame />;
                    else if (win.item.appId === 'iron-men-arcade') content = <IronMenArcadeApp />;
                    else if (win.item.appId === 'chess') content = <ZenithChessApp />;
                    else if (win.item.appId === 'laser-tag') content = <LaserTagApp />;
                    else if (win.item.appId === 'notepad') content = <NotepadApp fileId={win.id} initialContent={win.item.notepadInitialContent} />;
                    else if (win.item.appId === 'cybernetic_export') content = <CyberneticExportApp />;
                    else if (win.item.appId === 'github_sync') content = <GitHubSyncApp />;
                    else if (win.item.appId === 'flipper') content = <FlipperZeroApp />;
                    else if (win.item.appId === 'termstudio') content = <TermStudioApp />;
                    else if (win.item.appId === 'aiterm') content = <AiTermApp />;
                    else if (win.item.appId === 'ollama') content = <OllamaApp />;
                    else if (win.item.appId === 'openclaw') content = <OpenClawApp />;
                    else if (win.item.appId === 'coderabbit') content = <CodeRabbitApp />;
                    else if (win.item.appId === 'semantic_scholar') content = <SemanticScholarApp />;
                    else if (win.item.appId === 'research_rabbit') content = <ResearchRabbitApp />;
                    else if (win.item.appId === 'papers_with_code') content = <PapersWithCodeApp />;
                    else if (win.item.appId === 'langchain') content = <LangChainApp />;
                    else if (win.item.appId === 'unreal_engine') content = <UnrealEngineApp />;
                    else if (win.item.appId === 'blender') content = <BlenderApp />;
                    else if (win.item.appId === 'knowledge_compressor') content = <KnowledgeCompressorApp />;
                    else if (win.item.appId === 'supersayen') content = <SuperSayenApp />;
                    else if (win.item.appId === 'data_pods') content = <DataPodsApp />;
                    else if (win.item.appId === 'jacky') content = <JackyV3App />;
                    else if (win.item.appId === 'eru') content = <EruApp />;
                    else if (win.item.appId === 'app_connector') content = <AppConnectorApp />;
                    else if (win.item.appId === 'cybernetic67') content = <Cybernetic67App />;
                    else if (win.item.appId === 'prompt-to-json') content = <PromptToJsonApp />;
                    else if (win.item.appId === 'build_vault') content = <BuildVaultApp />;
                    else if (win.item.appId === 'flash-ui') content = <FlashUiApp />;
                    else if (win.item.appId === 'data-resolver') content = <AiDataResolverApp />;
                    else if (win.item.appId === 'function-call-kitchen') content = <FunctionCallKitchenApp />;
                    else if (win.item.appId === 'agentic-vision') content = <AgenticVisionApp />;
                    else if (win.item.appId === 'pod_system') content = <PodSystemApp />;
                    else if (win.item.appId === 'qpdb') content = <QpdbApp />;
                    else if (win.item.appId === 'consensus_lab') content = <MultiAgentConsensusLab />;
                    else if (win.item.appId === 'cloud_deploy') content = <CloudDeployApp />;
                    else if (win.item.appId === 'bot_studio') content = <BotStudioApp />;
                    else if (win.item.appId === 'cyber_rulebook') content = <CyberSecurityRulebookApp />;
                    else if (win.item.appId === 'fleet_atlas') content = <FleetAtlasApp />;
                    else if (win.item.appId === 'llm_environment') content = <LlmEnvironmentApp />;
                    else if (win.item.appId === 'ollama') content = <OllamaApp />;
                    else if (win.item.appId === 'small_agent_fleet') content = <SmallAgentFleetApp />;
                    else if (win.item.appId === 'model_router') content = <ModelRouterApp />;
                    else if (win.item.appId === 'cloud_infrastructure') content = <CloudInfrastructureApp />;
                    else if (win.item.appId === 'agent_builder') content = <AgentBuilderApp />;
                    else if (win.item.appId === 'claude_assistant') content = <ClaudeAssistantApp />;
                    else if (win.item.appId === 'codex') content = <CodexApp />;
                    else if (win.item.appId === 'grok_terminal') content = <GrokTerminalApp />;
                    else if (win.item.appId === 'chat_history_share') content = <ChatHistoryShareApp />;
                    else if (win.item.appId === 'archiver') content = <ArchiverApp />;
                    else if (win.item.appId === 'api_keys') content = <APIKeysApp />;
                    else if (win.item.appId === 'tool_registry') content = <ToolRegistryApp />;
                    else if (win.item.appId === 'agent_orchestration') content = <AgentOrchestrationDashboard />;
                    else if (win.item.appId === 'system_settings') content = <SystemSettingsApp />;
                    else if (win.item.appId === 'cross_ai_lab') content = <CrossAiLabApp />;
                    else if (win.item.appId === 'terminal') content = <TerminalApp onClose={() => closeWindow(win.id)} />;
                    else if (win.item.appId === 'ui_studio') content = <UIStudio onClose={() => closeWindow(win.id)} />;
                    else if (win.item.appId) content = <UniversalAppSimulator appId={win.item.appId} appName={win.item.name} initialUrl={win.item.url} />;
                    else if (win.item.url) content = (
                        <iframe 
                            src={win.item.url} 
                            className="w-full h-full border-none bg-zinc-950" 
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups" 
                            referrerPolicy="no-referrer"
                            title={win.item.name}
                        />
                    );

                    return (
                        <DraggableWindow
                            key={win.id}
                            id={win.id}
                            title={win.item.name}
                            icon={win.item.icon}
                            initialPos={win.pos}
                            initialSize={win.size}
                            zIndex={win.zIndex}
                            isActive={focusedId === win.id}
                            onClose={() => closeWindow(win.id)}
                            onFocus={() => focusWindow(win.id)}
                            onBoundsChange={(pos, size) => {
                                setOpenWindows(prev => prev.map(w => w.id === win.id ? { ...w, pos, size } : w));
                            }}
                            url={win.item.url}
                        >
                            {content}
                        </DraggableWindow>
                    );
                })}

                <InkLayer active={inkMode} strokes={strokes} setStrokes={setStrokes} isProcessing={isProcessing} />

                {toast && (
                    // Notification Card
                    <div className={`toast-card absolute bottom-36 left-1/2 -translate-x-1/2 bg-zinc-800/95 backdrop-blur-xl text-white px-8 py-6 rounded-[2rem] shadow-3xl z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-300 border border-zinc-700/50 pointer-events-auto flex flex-col gap-2 transition-all ${toast.title === 'Summary' ? 'w-[60rem] max-w-[95vw]' : 'max-w-lg w-full'}`}>
                        {toast.title ? (
                            <>
                                <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-1">
                                     <span className="relative flex h-3 w-3 flex-shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                                    </span>
                                    <h3 className={`${toast.title === 'Summary' ? 'text-5xl' : 'text-2xl'} font-bold text-sky-400 tracking-tight`}>{toast.title}</h3>
                                </div>
                                <div className={`text-zinc-200 leading-normal whitespace-pre-wrap ${toast.title === 'Summary' ? 'text-2xl' : 'text-base'}`}>
                                    {toast.message}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-start gap-4">
                                <span className="relative flex h-4 w-4 mt-1 flex-shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
                                </span>
                                <span className="leading-relaxed flex-1 text-base font-medium whitespace-pre-wrap">{toast.message}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
};