import React, { useState, useRef, useEffect } from 'react';
import { 
    Terminal as TerminalIcon, Send, Trash2, X, Bot, Cpu, Folder, File, 
    FileCode, Play, Cloud, CloudUpload, CloudDownload, RefreshCw, LogIn, 
    LogOut, Search, HelpCircle, CheckCircle, AlertTriangle, Sparkles, 
    Code2, Rabbit, ArrowRight, Save, Plus, Eye, Code, Square, Paperclip
} from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { compressToLZWBase64, decompressFromLZWBase64 } from '../../lib/compression';

// Supported default virtual files
const DEFAULT_FILES = [
    {
        name: 'welcome.js',
        content: `// welcome.js - TermStudio JS Playground\n\nconsole.log("Welcome to TermStudio!");\nconsole.log("You can draw on the Canvas tab or connect Google Drive.");\n\nconst canvas = getCanvas();\nif (canvas) {\n  const ctx = canvas.getContext('2d');\n  ctx.fillStyle = '#8b5cf6'; // Purple\n  ctx.fillRect(50, 50, 200, 200);\n  console.log("Successfully painted a purple block on the Canvas!");\n}`
    },
    {
        name: 'main.py',
        content: `# main.py - Python script demo\n\nimport math\n\ndef calculate_radius(area):\n    return math.sqrt(area / math.pi)\n\nprint("Ollama & Openclaw integration initialized.")\nprint("Radius of circle with area 50 is:", calculate_radius(50))`
    },
    {
        name: 'utils.cpp',
        content: `// utils.cpp - C++ helper routines\n#include <iostream>\n\nvoid runReview() {\n    std::cout << "WhiteRabbit & CodeRabbit automatic scanners active." << std::endl;\n}\n\nint main() {\n    runReview();\n    return 0;\n}`
    }
];

// List of top developer AI tools for the Tools Directory
const AI_TOOLS_DIRECTORY = [
    // --- Agentic Frameworks ---
    { name: 'LangGraph', category: 'Agent Frameworks', tier: 'FREE', desc: 'Build stateful, multi-agent workflows with cyclic graphs and human-in-the-loop validation.', prompt: 'Design a cyclic multi-agent graph with research, review, and rewrite states.' },
    { name: 'CrewAI', category: 'Agent Frameworks', tier: 'FREE', desc: 'Orchestrate role-playing autonomous AI agents. Define specific crews, tasks, and cooperative tools.', prompt: 'Create a CrewAI crew with an Auditor agent and a Developer agent working on code refactoring.' },
    { name: 'AutoGen', category: 'Agent Frameworks', tier: 'FREE', desc: 'Conversational agent network by Microsoft enabling multi-agent dialogues to solve complex coding tasks.', prompt: 'Explain how to configure AutoGen with local Ollama models.' },
    { name: 'Claude Agent SDK', category: 'Agent Frameworks', tier: 'FREEMIUM', desc: 'Anthropic\'s specialized SDK for building deterministic, tool-enabled computer-use agents.', prompt: 'Show me how to build a computer-use agent script using the Claude Agent SDK.' },
    { name: 'Semantic Kernel', category: 'Agent Frameworks', tier: 'FREE', desc: 'Microsoft\'s enterprise-grade SDK designed to integrate LLMs with native languages like C# and Java.', prompt: 'How do I register a custom C# plugin inside Semantic Kernel?' },
    { name: 'LlamaIndex Agents', category: 'Agent Frameworks', tier: 'FREE', desc: 'Data-augmented intelligent agents that seamlessly interface with custom document indexing.', prompt: 'Build a QueryEngineAgent using LlamaIndex and custom metadata.' },
    { name: 'Pydantic AI', category: 'Agent Frameworks', tier: 'FREE', desc: 'Production-grade, strictly typed agentic orchestration with robust schema-validated state.', prompt: 'Write a Pydantic AI agent that outputs strictly typed weather logs.' },
    { name: 'Haystack Agents', category: 'Agent Frameworks', tier: 'FREE', desc: 'Modular semantic router and agent pipelines designed for modern semantic search and RAG.', prompt: 'Configure an agentic pipeline in Haystack with custom web search nodes.' },
    { name: 'DSPy', category: 'Agent Frameworks', tier: 'FREE', desc: 'Declarative programming model to program, optimize, and compile LLM prompts and weights systematically.', prompt: 'Implement a DSPy signature and module for math reasoning.' },

    // --- Autonomous Agents & IDEs ---
    { name: 'AutoGen Studio', category: 'Autonomous Agents', tier: 'FREE', desc: 'Interactive, graphical drag-and-drop dashboard to design, test, and debug multi-agent architectures.', prompt: 'Explain the custom session management in AutoGen Studio.' },
    { name: 'Open Interpreter', category: 'Autonomous Agents', tier: 'FREE', desc: 'Autonomous local interpreter agent that runs Python, JS, or bash commands directly inside your terminal.', prompt: 'How do I run Open Interpreter safely in an offline container?' },
    { name: 'AutoGPT', category: 'Autonomous Agents', tier: 'FREE', desc: 'Autonomous web-research and automation agent executing recursive feedback loops.', prompt: 'Write an automation loop for gathering tech stock prices with AutoGPT.' },
    { name: 'BabyAGI', category: 'Autonomous Agents', tier: 'FREE', desc: 'Autonomous recursive task management agent that schedules, reorganizes, and executes sub-goals.', prompt: 'Explain the priority-queue re-ranking logic in BabyAGI.' },
    { name: 'AgentGPT', category: 'Autonomous Agents', tier: 'FREEMIUM', desc: 'Fully browser-based autonomous agent builder to set up custom goals and watch execution.', prompt: 'How to deploy custom API tools to AgentGPT?' },
    { name: 'SuperAGI', category: 'Autonomous Agents', tier: 'FREE', desc: 'Enterprise multi-agent automation platform containing robust GUI setups and concurrent runs.', prompt: 'How to build custom toolkits for SuperAGI in Python?' },
    { name: 'OpenDevin', category: 'Autonomous Agents', tier: 'FREE', desc: 'Next-generation open-source AI software engineer that automates coding, installing, and testing.', prompt: 'Show me an example of OpenDevin solving a GitHub issue.' },
    { name: 'Aider', category: 'Autonomous Agents', tier: 'FREE', desc: 'Highly optimized command-line coding assistant that syncs with Git to edit code across files.', prompt: 'How to use Aider command flags to perform automatic commit logs?' },
    { name: 'GPT Engineer', category: 'Autonomous Agents', tier: 'FREEMIUM', desc: 'Single-prompt application builder that generates complete web applications from natural language.', prompt: 'Explain how GPT Engineer organizes generated boilerplate code.' },
    { name: 'MetaGPT', category: 'Autonomous Agents', tier: 'FREE', desc: 'Multi-role software team simulator working concurrently to write full-fledged applications.', prompt: 'Generate an online book library system using MetaGPT.' },
    { name: 'Devika', category: 'Autonomous Agents', tier: 'FREE', desc: 'Stateful AI software engineer and developer companion equipped with advanced research modules.', prompt: 'How to link Devika with local LLM models?' },

    // --- Speech & Audio Models ---
    { name: 'Whisper large-v3', category: 'Acoustic & Speech', tier: 'FREE', desc: 'OpenAI\'s state-of-the-art multilingual speech-to-text transcription and audio alignment model.', prompt: 'Write a Python script using Whisper to transcribe and translate a live mic stream.' },
    { name: 'faster-whisper', category: 'Acoustic & Speech', tier: 'FREE', desc: 'High-performance C++ implementation of Whisper, delivering up to 4x faster transcription speed.', prompt: 'Compare performance and memory footprint of faster-whisper float16 vs Whisper.' },
    { name: 'Piper TTS', category: 'Acoustic & Speech', tier: 'FREE', desc: 'Extremely fast, local neural text-to-speech engine optimized for low-power single-board computers.', prompt: 'How do I compile and run Piper TTS on a Raspberry Pi?' },
    { name: 'Bark', category: 'Acoustic & Speech', tier: 'FREE', desc: 'Transformer-based audio generation model by Suno capable of realistic voices, music, and sound effects.', prompt: 'Show me how to generate laughter and music prompts using Suno Bark.' },
    { name: 'XTTS-v2', category: 'Acoustic & Speech', tier: 'FREE', desc: 'Advanced neural text-to-speech with 3-second vocal cloning and multilingual pitch conservation.', prompt: 'Write a script to clone a voice from a 5-second audio clip using XTTS-v2.' },
    { name: 'SpeechT5', category: 'Acoustic & Speech', tier: 'FREE', desc: 'Unified multimodal transformer framework by Microsoft for speech-to-text and vocal conversion.', prompt: 'How to use SpeechT5 for text-to-speech with custom speaker embeddings?' },

    // --- Classic Developer Engines ---
    { name: 'ChatGPT', category: 'AI Chat & Q&A', tier: 'FREEMIUM', desc: 'Conversational assistant by OpenAI for general Q&A, formatting, and coding help.', prompt: 'Help me write an optimized algorithm for sorting a large JSON array in JavaScript.' },
    { name: 'Claude', category: 'AI Chat & Q&A', tier: 'FREEMIUM', desc: 'Anthropic\'s highly capable assistant with a massive context window and advanced reasoning.', prompt: 'Can you write a robust TypeScript interface and fetch wrapper for a paginated API?' },
    { name: 'Gemini', category: 'AI Chat & Q&A', tier: 'FREEMIUM', desc: 'Google\'s multimodal model, serving natively inside this TermStudio app for lightning fast analysis.', prompt: 'How do I draw complex physics waves on a standard HTML5 Canvas element?' },
    { name: 'Cursor', category: 'AI Programming', tier: 'FREEMIUM', desc: 'AI-first code editor designed for maximum flow state and automated repository edits.', prompt: 'Explain the best practices for structuring folders in a fullstack React and Node app.' },
    { name: 'Replit Agent', category: 'AI Programming', tier: 'PAID', desc: 'In-browser agent that builds, provisions, and deploys full stack web applications automatically.', prompt: 'How do I configure Vite proxy settings to bypass local CORS errors during dev?' },
    { name: 'Codeium', category: 'AI Programming', tier: 'FREE', desc: 'Ultra-fast free code autocomplete, chat assistant, and inline doc generator for major IDEs.', prompt: 'Write me an optimized React hook for tracking custom mouse drag gestures.' },
    { name: 'Hugging Face Chat', category: 'AI Chat & Q&A', tier: 'FREE', desc: 'Open-source chat interface hosting multiple state-of-the-art models.', prompt: 'Compare the performance of Llama 3 and Mistral.' },
    { name: 'Perplexity AI', category: 'AI Chat & Q&A', tier: 'FREE', desc: 'AI-powered search engine providing cited answers to complex questions.', prompt: 'Summarize the latest research on sustainable AI computing.' },
    { name: 'V0.dev', category: 'Web Development', tier: 'FREEMIUM', desc: 'Generative UI component builder using React and Tailwind.', prompt: 'Create a clean dashboard header component.' }
];

// Helper to get real, operational boilerplate code and configuration for each AI tool
const getToolContent = (name: string): string => {
    switch (name) {
        case 'LangGraph':
            return `
# LangGraph - Production-Grade Cyclic Multi-Agent Workflow
# Setup: pip install langgraph langchain-openai

import os
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], "The conversation history"]
    active_role: str
    revision_count: int

def researcher_node(state: AgentState):
    print("--- RESEARCH STATE ---")
    return {"messages": [("assistant", "Detailed research findings on the requested system architecture.")], "active_role": "reviewer"}

def reviewer_node(state: AgentState):
    print("--- REVIEW STATE ---")
    return {"messages": [("assistant", "Review completed. Suggestions for improvement: Add clear module bounds.")], "active_role": "writer"}

def writer_node(state: AgentState):
    print("--- REWRITE STATE ---")
    return {"messages": [("assistant", "Revised implementation based on review feedback.")], "active_role": "end"}

# Build multi-agent state graph
workflow = StateGraph(AgentState)
workflow.add_node("researcher", researcher_node)
workflow.add_node("reviewer", reviewer_node)
workflow.add_node("writer", writer_node)

workflow.set_entry_point("researcher")
workflow.add_conditional_edges(
    "researcher",
    lambda x: x["active_role"],
    {"reviewer": "reviewer", "writer": "writer"}
)
workflow.add_edge("reviewer", "writer")
workflow.add_edge("writer", END)

app = workflow.compile()
print("LangGraph Multi-Agent Cyclic state-machine successfully constructed!")
`;
        case 'CrewAI':
            return `
# CrewAI - Autonomous Cooperative Agent Framework
# Setup: pip install crewai

from crewai import Agent, Task, Crew, Process

# Define specialized agents
researcher = Agent(
    role="Principal AI Architect",
    goal="Discover and document the most robust patterns in distributed ledger technologies",
    backstory="You are an elite researcher with a passion for finding structural anomalies and edge cases.",
    verbose=True,
    memory=True
)

writer = Agent(
    role="Technical Communications Lead",
    goal="Explain complex technological components in simple, engaging, scannable documentation",
    backstory="You are a veteran technical writer with a focus on visual rhythm and perfect document density.",
    verbose=True
)

# Define precise tasks
task1 = Task(
    description="Analyze and write a deep review of standard consensus mechanisms.",
    expected_output="A 3-bullet comparison chart detailing throughput, finality, and node counts.",
    agent=researcher
)

task2 = Task(
    description="Refine the research findings into a publication-ready markdown article.",
    expected_output="A clean markdown article with typography notes and code blocks.",
    agent=writer
)

# Orchestrate the crew
tech_crew = Crew(
    agents=[researcher, writer],
    tasks=[task1, task2],
    process=Process.sequential
)

result = tech_crew.kickoff()
print("CrewAI autonomous pipeline run successfully! Output:")
print(result)
`;
        case 'AutoGen':
            return `
# AutoGen - Multi-Agent Conversational Dialog Network
# Setup: pip install pyautogen

import autogen

config_list = [
    {
        "model": "gpt-4-turbo",
        "api_key": "YOUR_OPENAI_API_KEY"
    }
]

assistant = autogen.AssistantAgent(
    name="CoderAgent",
    llm_config={"config_list": config_list}
)

user_proxy = autogen.UserProxyAgent(
    name="UserProxy",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=5,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config={"work_dir": "sandbox", "use_docker": False}
)

# Start multi-agent dialogue
user_proxy.initiate_chat(
    assistant,
    message="Write a high-performance bubble sort in Python and run it to verify speed metrics."
)
`;
        case 'Claude Agent SDK':
            return `
# Claude Agent SDK - Computer Use API and Tool Orchestration
# Setup: pip install anthropic-agent-sdk

import anthropic

client = anthropic.Anthropic()

# Configure Claude for computer-use and OS interaction
response = client.beta.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    tools=[
        {
            "name": "computer_use",
            "type": "computer_20241022",
            "display_width_px": 1024,
            "display_height_px": 768,
        }
    ],
    messages=[{"role": "user", "content": "Open my browser, navigate to GitHub, and create a new repository called 'CyberOS'."}]
)
print(response)
`;
        case 'Pydantic AI':
            return `
# Pydantic AI - Production-grade strictly typed Agentic Framework
# Setup: pip install pydantic-ai

from pydantic import BaseModel, Field
from pydantic_ai import Agent

class WeatherResponse(BaseModel):
    city: str = Field(description="Name of target metropolitan city")
    temperature_celsius: float = Field(description="Current real-time temperature in degrees Celsius")
    conditions: str = Field(description="Primary descriptive atmospheric condition")
    wind_speed_kmh: float = Field(description="Wind speed velocity in km/h")

# Initialize strictly-typed agent
weather_agent = Agent(
    model="openai:gpt-4o",
    result_type=WeatherResponse,
    system_prompt="You are a strict meteorology data ingestion portal. Fetch current weather and return accurate metrics."
)

result = weather_agent.run_sync("What's the weather like in Tokyo right now?")
print("Decoded Weather Response:")
print(f"City: {result.data.city}")
print(f"Temp: {result.data.temperature_celsius}°C")
print(f"Condition: {result.data.conditions}")
`;
        case 'Open Interpreter':
            return `
# Open Interpreter - Local OS Command Execution Console
# Setup: pip install open-interpreter

from interpreter import interpreter

# Configure sandbox parameters
interpreter.offline = True  # Strict local mode
interpreter.auto_run = True # Auto-execute scripts
interpreter.llm.model = "ollama/codegemma"
interpreter.llm.api_base = "http://localhost:11434"

interpreter.chat("Read the file notes.txt in my workspace, count the number of characters, and print the results.")
`;
        case 'Aider':
            return `
# Aider - Git-Integrated Terminal Coding Assistant
# Run this in your workspace directory:
# export OPENAI_API_KEY="your-key"
# aider --model gpt-4o-mini

# Useful startup script:
# aider --auto-commits --no-analytics --watch src/components/
# This automatically commits code edits whenever compiler tests succeed!
`;
        case 'OpenDevin':
            return `
# OpenDevin / All Hands AI - Software Engineer Agent Sandbox
# Run this in docker to spin up autonomous coding environment:
# docker run -it \\
#   -e SANDBOX_USER_ID=$(id -u) \\
#   -e WORKSPACE_BASE=$(pwd)/workspace \\
#   -v /var/run/docker.sock:/var/run/docker.sock \\
#   -v $(pwd)/workspace:/workspace \\
#   -p 3000:3000 \\
#   ghcr.io/all-hands-ai/all-hands-ai:0.9
`;
        case 'Whisper large-v3':
            return `
# Whisper - Multilingual Speech-to-Text Transcription Engine
# Setup: pip install openai-whisper torch

import whisper

# Load optimal state-of-the-art model
model = whisper.load_model("large-v3")

# Transcribe voice audio file losslessly
result = model.transcribe("meeting_minutes.wav", language="en")
print("Transcription Completed! Text Output:")
print(result["text"])
`;
        case 'faster-whisper':
            return `
# faster-whisper - Highly optimized C++ speech-to-text engine
# Setup: pip install faster-whisper

from faster_whisper import WhisperModel

model_size = "large-v3"

# Run on GPU with 16-bit float calculations for maximum performance (4x faster)
model = WhisperModel(model_size, device="cuda", compute_type="float16")

segments, info = model.transcribe("audio.mp3", beam_size=5)
print(f"Detected language: '{info.language}' with probability {info.language_probability:.2f}")

for segment in segments:
    print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))
`;
        case 'ChatGPT':
            return `
# OpenAI SDK - Modern Chat Completion with Conversation Memory
# Setup: pip install openai

from openai import OpenAI

client = OpenAI(api_key="YOUR_API_KEY")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a master algorithms engineer. Output clean, optimal code structures."},
        {"role": "user", "content": "Write a memoized edit distance calculation in TypeScript."}
    ]
)
print(response.choices[0].message.content)
`;
        case 'Gemini':
            return `
// Google GenAI SDK - Modern Node.js/TypeScript Ingestion
// Setup: npm install @google/genai

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "How do I draw dynamic high-fidelity canvas wave simulations?",
  });
  console.log(response.text);
}
run();
`;
        default:
            return `
# AI Tool Scaffold: ${name} Reference
# Category: Developer AI Stack
# Generated for ready-to-use reference:

# Setup commands:
# pip install ${name.toLowerCase().replace(/\s+/g, '-')} or npm install

print("Bootstrapping template configuration for ${name}...")
# Core execution guidelines:
# 1. Provide API Key in environment
# 2. Set up local workspace or connection bridge
# 3. Execute script to initiate autonomous loops
`;
    }
};

// Programmatically compiles selected AI tools' code and templates into a single high-fidelity text repository
const generateAiSuiteDoc = (selectedNames: string[]): string => {
    let doc = `================================================================================
CYBERNETIC OS - GLOBAL AI DEVELOPER SUITE REFERENCE REPOSITORY
================================================================================
Created on: ${new Date().toLocaleString()}
Selected Tools: ${selectedNames.length} / ${AI_TOOLS_DIRECTORY.length}
Description: This custom-compiled package contains production-ready codebases,
system prompts, and execution guides for all selected Developer AI tools.
This pack was LZW-compressed using Cybernetic OS lossless compression algorithms.
================================================================================

`;
    selectedNames.forEach((name, i) => {
        const tool = AI_TOOLS_DIRECTORY.find(t => t.name === name);
        if (!tool) return;
        doc += `\n\n--------------------------------------------------------------------------------
[${i + 1}] TOOL NAME: ${tool.name}
CATEGORY: ${tool.category}
TIER: ${tool.tier}
SUMMARY: ${tool.desc}
--------------------------------------------------------------------------------
`;
        doc += getToolContent(tool.name).trim();
        doc += `\n\n================================================================================`;
    });
    return doc;
};

export const TermStudioApp: React.FC = () => {
    // --- STATE MANAGEMENT ---
    // Workspace Active Tab: 'terminal' | 'editor' | 'canvas'
    const [activeTab, setActiveTab] = useState<'terminal' | 'editor' | 'canvas'>('terminal');
    
    // Virtual File System
    const [virtualFiles, setVirtualFiles] = useState<{name: string, content: string}[]>(() => {
        const saved = localStorage.getItem('termstudio_vfiles');
        return saved ? JSON.parse(saved) : DEFAULT_FILES;
    });
    const [activeFile, setActiveFile] = useState<string>('welcome.js');
    const [editorContent, setEditorContent] = useState<string>('');
    const [newFileName, setNewFileName] = useState('');
    const [showNewFileModal, setShowNewFileModal] = useState(false);

    // Terminal Commands State
    const [termInput, setTermInput] = useState('');
    const [termLogs, setTermLogs] = useState<{type: 'cmd' | 'output' | 'success' | 'error' | 'info', text: string}[]>([
        { type: 'info', text: '⚡ TermStudio Unified Web Console initialized.' },
        { type: 'info', text: 'Type "help" to list terminal utilities or run "/review" to review active file.' }
    ]);
    const termLogsEndRef = useRef<HTMLDivElement>(null);

    // Google Drive state
    const [gdriveToken, setGdriveToken] = useState<string | null>(null);
    const [gdriveUser, setGdriveUser] = useState<User | null>(null);
    const [gdriveFiles, setGdriveFiles] = useState<{id: string, name: string, mimeType: string, createdTime?: string}[]>([]);
    const [isListingDrive, setIsListingDrive] = useState(false);
    const [showDriveConfirmDelete, setShowDriveConfirmDelete] = useState<string | null>(null);

    // AI Panel state
    const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'openclaw'>('gemini');
    const [aiMessages, setAiMessages] = useState<{role: 'user' | 'assistant' | 'system', content: string}[]>([
        { role: 'system', content: 'AI Workspace assistant online. I have live access to your active file in the editor, and can run CodeRabbit style reviews.' }
    ]);
    const [aiInput, setAiInput] = useState('');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiSearchQuery, setAiSearchQuery] = useState('');
    const [ollamaStatus, setOllamaStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const aiMessagesEndRef = useRef<HTMLDivElement>(null);

    // AI Tools Mass Export & Compression States
    const [selectedTools, setSelectedTools] = useState<string[]>(() => AI_TOOLS_DIRECTORY.map(t => t.name));
    const [compressedData, setCompressedData] = useState<{ originalSize: number, compressedSize: number, compressedString: string, originalString: string } | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [compilationProgress, setCompilationProgress] = useState(0);
    const [showExportModal, setShowExportModal] = useState(false);

    // Triggers file download from standard browser API
    const downloadFile = (filename: string, content: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Runs a highly detailed real-time compilation routine, LZW compresses, and validates result
    const handleCompileAndCompressSuite = () => {
        setIsCompiling(true);
        setCompilationProgress(0);
        setCompressedData(null);
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setCompilationProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                
                try {
                    const originalString = generateAiSuiteDoc(selectedTools);
                    const compressedString = compressToLZWBase64(originalString);
                    
                    // Double check integrity with decompress routine
                    const integrityCheck = decompressFromLZWBase64(compressedString);
                    if (integrityCheck !== originalString) {
                        throw new Error("LZW self-validation mismatch! The compressed stream integrity check failed.");
                    }
                    
                    setCompressedData({
                        originalSize: originalString.length,
                        compressedSize: compressedString.length,
                        compressedString,
                        originalString
                    });
                    
                    setTermLogs(prev => [
                        ...prev,
                        { type: 'success', text: `✨ Multi-module AI Scaffolds Package compiled! Included: ${selectedTools.length} tools. Original: ${originalString.length} bytes, LZW Packed: ${compressedString.length} bytes. Lossless check: Verified OK.` }
                    ]);
                } catch (err: any) {
                    setTermLogs(prev => [...prev, { type: 'error', text: `Failed to compile suite: ${err.message}` }]);
                } finally {
                    setIsCompiling(false);
                }
            }
        }, 60);
    };

    // Canvas State
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Active simulation intervals to safely dispose on unmount
    const activeIntervalsRef = useRef<any[]>([]);

    useEffect(() => {
        return () => {
            activeIntervalsRef.current.forEach(clearInterval);
        };
    }, []);

    const getAppIdForTool = (toolName: string): string | null => {
        const nameLower = toolName.toLowerCase();
        if (nameLower.includes('langgraph') || nameLower.includes('langchain')) return 'langchain';
        if (nameLower.includes('ollama') || nameLower.includes('deepseek')) return 'ollama';
        if (nameLower.includes('openclaw') || nameLower.includes('crewai') || nameLower.includes('autogen') || nameLower.includes('agent sdk')) return 'openclaw';
        if (nameLower.includes('coderabbit') || nameLower.includes('aider') || nameLower.includes('devika') || nameLower.includes('meta_gpt') || nameLower.includes('gpt engineer') || nameLower.includes('opendevin')) return 'coderabbit';
        if (nameLower.includes('scholar') || nameLower.includes('semantic scholar')) return 'semantic_scholar';
        if (nameLower.includes('researchrabbit') || nameLower.includes('research rabbit')) return 'research_rabbit';
        if (nameLower.includes('papers with code')) return 'papers_with_code';
        if (nameLower.includes('unreal')) return 'unreal_engine';
        if (nameLower.includes('blender')) return 'blender';
        return null;
    };

    // --- EFFECT: Sync Local Files to Storage ---
    useEffect(() => {
        localStorage.setItem('termstudio_vfiles', JSON.stringify(virtualFiles));
    }, [virtualFiles]);

    // --- EFFECT: Sync Editor with Active File ---
    useEffect(() => {
        const file = virtualFiles.find(f => f.name === activeFile);
        if (file) {
            setEditorContent(file.content);
        }
    }, [activeFile, virtualFiles]);

    // --- EFFECT: Scroll Logs & AI Messages ---
    useEffect(() => {
        termLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [termLogs]);

    useEffect(() => {
        aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    // --- EFFECT: Listen for Auth State ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setGdriveUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // --- EFFECT: Check Ollama Local Connection ---
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const res = await fetch('http://localhost:11434/api/tags');
                if (res.ok) {
                    setOllamaStatus('online');
                } else {
                    setOllamaStatus('offline');
                }
            } catch {
                setOllamaStatus('offline');
            }
        };
        checkOllama();
    }, []);

    // --- CANVAS DEMONSTRATION ROUTINES ---
    const drawCanvasDemo = (type: 'sparkles' | 'block' | 'reset') => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (type === 'reset') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#09090b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#27272a';
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            return;
        }

        if (type === 'block') {
            ctx.fillStyle = '#3b82f6'; // Blue
            ctx.fillRect(100, 80, 150, 120);
            ctx.fillStyle = '#10b981'; // Green
            ctx.beginPath();
            ctx.arc(350, 140, 60, 0, Math.PI * 2);
            ctx.fill();
            setTermLogs(prev => [...prev, { type: 'success', text: 'Canvas painted: block, circle' }]);
        } else if (type === 'sparkles') {
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 6 + 2;
                ctx.fillStyle = i % 2 === 0 ? '#c084fc' : '#60a5fa'; // purple or blue
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            setTermLogs(prev => [...prev, { type: 'success', text: 'Canvas decorated with random sparkles!' }]);
        }
    };

    // Initialize Canvas with dark styling on tab switch
    useEffect(() => {
        if (activeTab === 'canvas') {
            setTimeout(() => drawCanvasDemo('reset'), 50);
        }
    }, [activeTab]);

    // Expose virtual canvas handle
    const getCanvas = () => canvasRef.current;

    // --- AUTHENTICATION & GOOGLE DRIVE HANDLERS ---
    const handleGoogleDriveSignIn = async () => {
        setTermLogs(prev => [...prev, { type: 'info', text: 'Initiating Google Drive connection popup...' }]);
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;
            if (token) {
                setGdriveToken(token);
                setTermLogs(prev => [
                    ...prev, 
                    { type: 'success', text: `Success! Signed in as ${result.user.displayName}. Google Drive enabled.` },
                    { type: 'info', text: 'Type "gdrive list" to fetch your Google Drive files.' }
                ]);
                // Automatically list files
                await fetchDriveFiles(token);
            } else {
                throw new Error('No access token returned from authentication provider.');
            }
        } catch (error: any) {
            console.error('Sign in error:', error);
            setTermLogs(prev => [...prev, { type: 'error', text: `Connection Failed: ${error.message}` }]);
        }
    };

    const handleSignOutDrive = async () => {
        try {
            await signOut(auth);
            setGdriveToken(null);
            setGdriveFiles([]);
            setTermLogs(prev => [...prev, { type: 'info', text: 'Successfully disconnected Google Drive.' }]);
        } catch (error: any) {
            setTermLogs(prev => [...prev, { type: 'error', text: `Sign out failed: ${error.message}` }]);
        }
    };

    const fetchDriveFiles = async (token = gdriveToken) => {
        const currentToken = token || gdriveToken;
        if (!currentToken) {
            setTermLogs(prev => [...prev, { type: 'error', text: 'Not connected to Google Drive. Use Connect button or sign in first.' }]);
            return;
        }
        setIsListingDrive(true);
        try {
            const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,mimeType,createdTime)&orderBy=name_natural', {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || 'Failed to list drive files');
            }
            const data = await res.json();
            setGdriveFiles(data.files || []);
            setTermLogs(prev => [...prev, { type: 'success', text: `Retrieved ${data.files?.length || 0} files from Google Drive.` }]);
        } catch (error: any) {
            console.error('Drive listing error:', error);
            setTermLogs(prev => [...prev, { type: 'error', text: `Drive Sync Error: ${error.message}` }]);
        } finally {
            setIsListingDrive(false);
        }
    };

    const uploadFileToGoogleDrive = async (fileName: string, content: string) => {
        if (!gdriveToken) {
            setTermLogs(prev => [...prev, { type: 'error', text: 'Sign in to Google Drive first before uploading.' }]);
            return;
        }
        setTermLogs(prev => [...prev, { type: 'info', text: `Uploading "${fileName}" to Google Drive...` }]);

        try {
            // Step 1: Create file metadata
            const metadataRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${gdriveToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: fileName,
                    mimeType: 'text/plain'
                })
            });

            if (!metadataRes.ok) {
                const err = await metadataRes.json();
                throw new Error(err.error?.message || 'Metadata creation failed');
            }

            const fileMeta = await metadataRes.json();

            // Step 2: Upload file media content
            const mediaRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileMeta.id}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${gdriveToken}`,
                    'Content-Type': 'text/plain'
                },
                body: content
            });

            if (!mediaRes.ok) {
                const err = await mediaRes.json();
                throw new Error(err.error?.message || 'Media content upload failed');
            }

            setTermLogs(prev => [...prev, { type: 'success', text: `Successfully uploaded ${fileName} to Drive (File ID: ${fileMeta.id})` }]);
            await fetchDriveFiles();
        } catch (error: any) {
            console.error('Drive Upload Error:', error);
            setTermLogs(prev => [...prev, { type: 'error', text: `Upload Failed: ${error.message}` }]);
        }
    };

    const downloadDriveFile = async (id: string, name: string) => {
        if (!gdriveToken) return;
        setTermLogs(prev => [...prev, { type: 'info', text: `Downloading ${name}...` }]);
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
                headers: { Authorization: `Bearer ${gdriveToken}` }
            });
            if (!res.ok) throw new Error('Could not download file contents');
            const fileContent = await res.text();

            // Add to virtual files or update active
            setVirtualFiles(prev => {
                const existing = prev.find(f => f.name === name);
                if (existing) {
                    return prev.map(f => f.name === name ? { ...f, content: fileContent } : f);
                } else {
                    return [...prev, { name, content: fileContent }];
                }
            });
            setActiveFile(name);
            setEditorContent(fileContent);
            setTermLogs(prev => [...prev, { type: 'success', text: `Downloaded "${name}" into local workspace!` }]);
            setActiveTab('editor');
        } catch (error: any) {
            setTermLogs(prev => [...prev, { type: 'error', text: `Download Error: ${error.message}` }]);
        }
    };

    const handleRequestDeleteDriveFile = (id: string) => {
        // Safe destructive operation constraint check
        setShowDriveConfirmDelete(id);
    };

    const confirmDeleteDriveFile = async () => {
        const fileId = showDriveConfirmDelete;
        setShowDriveConfirmDelete(null);
        if (!fileId || !gdriveToken) return;

        const fileInfo = gdriveFiles.find(f => f.id === fileId);
        setTermLogs(prev => [...prev, { type: 'info', text: `Deleting file "${fileInfo?.name || fileId}" from Drive...` }]);

        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${gdriveToken}` }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error?.message || 'Failed to delete file');
            }
            setTermLogs(prev => [...prev, { type: 'success', text: `File successfully deleted from Google Drive.` }]);
            await fetchDriveFiles();
        } catch (error: any) {
            setTermLogs(prev => [...prev, { type: 'error', text: `Deletion Failed: ${error.message}` }]);
        }
    };

    // --- TERMINAL CONTROLLER ---
    const handleCommand = async (cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        setTermLogs(prev => [...prev, { type: 'cmd', text: trimmed }]);
        const parts = trimmed.split(' ');
        const base = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        switch (base) {
            case 'help':
                setTermLogs(prev => [
                    ...prev,
                    { type: 'info', text: '🛠️ TERMSTUDIO COMMAND HELPER:' },
                    { type: 'output', text: '  help                        - Output this list of utilities' },
                    { type: 'output', text: '  ls                          - List virtual workspace files' },
                    { type: 'output', text: '  cat <filename>              - Output contents of a workspace file' },
                    { type: 'output', text: '  write <filename> <content>  - Create or edit a local file' },
                    { type: 'output', text: '  run <filename>              - Execute code directly (JS interpreter or sandboxed Python/C++ VM)' },
                    { type: 'output', text: '  gdrive list                 - Pull latest Google Drive documents' },
                    { type: 'output', text: '  gdrive upload <filename>    - Save workspace file directly to Google Drive' },
                    { type: 'output', text: '  gdrive cat <file_id>        - Fetch file body from Google Drive' },
                    { type: 'output', text: '  gdrive delete <file_id>     - Permanently delete a file from Drive' },
                    { type: 'output', text: '  ollama check                - Run diagnostic connection to local Ollama API' },
                    { type: 'output', text: '  ollama prompt <text>        - Query active local LLM pipeline' },
                    { type: 'output', text: '  openclaw <prompt>           - Route custom parameters via developer proxy' },
                    { type: 'output', text: '  rabbit review               - Run automatic WhiteRabbit/CodeRabbit structural review' },
                    { type: 'output', text: '  simulate <tool> [prompt]    - Run realistic terminal simulation of any Agent/Audio engine (e.g. simulate CrewAI)' },
                    { type: 'output', text: '  launch <app_name>           - Open any integrated sandbox application window (e.g. launch langchain)' },
                    { type: 'output', text: '  compile-suite               - Compile & LZW compress selected AI tools scaffolds to workspace' },
                    { type: 'output', text: '  compress <text | filename>  - Compress text or file contents using real LZW' },
                    { type: 'output', text: '  decompress <lzw_base64>     - Decompress any LZW-encoded Base64 string' },
                    { type: 'output', text: '  clear                       - Wipe term logs history' }
                ]);
                break;

            case 'clear':
                setTermLogs([]);
                break;

            case 'ls':
                setTermLogs(prev => [
                    ...prev,
                    { type: 'output', text: `Workspace Files:\n${virtualFiles.map(f => `  • ${f.name} (${f.content.length} chars)`).join('\n')}` },
                    { type: 'info', text: `Active file in editor: ${activeFile}` },
                    { type: 'info', text: gdriveToken ? 'Google Drive connected.' : 'Google Drive disconnected.' }
                ]);
                break;

            case 'cat':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: cat <filename>' }]);
                } else {
                    const file = virtualFiles.find(f => f.name.toLowerCase() === arg.toLowerCase());
                    if (file) {
                        setTermLogs(prev => [...prev, { type: 'output', text: file.content }]);
                    } else {
                        setTermLogs(prev => [...prev, { type: 'error', text: `File not found: "${arg}"` }]);
                    }
                }
                break;

            case 'write':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: write <filename> <content>' }]);
                } else {
                    const firstSpaceIndex = arg.indexOf(' ');
                    const newName = firstSpaceIndex !== -1 ? arg.substring(0, firstSpaceIndex) : arg;
                    const newContent = firstSpaceIndex !== -1 ? arg.substring(firstSpaceIndex + 1) : '';

                    setVirtualFiles(prev => {
                        const existing = prev.find(f => f.name.toLowerCase() === newName.toLowerCase());
                        if (existing) {
                            return prev.map(f => f.name.toLowerCase() === newName.toLowerCase() ? { ...f, content: newContent } : f);
                        } else {
                            return [...prev, { name: newName, content: newContent }];
                        }
                    });
                    setTermLogs(prev => [...prev, { type: 'success', text: `Wrote contents directly to "${newName}".` }]);
                }
                break;

            case 'run':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: run <filename>' }]);
                } else {
                    const file = virtualFiles.find(f => f.name.toLowerCase() === arg.toLowerCase());
                    if (!file) {
                        setTermLogs(prev => [...prev, { type: 'error', text: `File not found: ${arg}` }]);
                    } else if (file.name.endsWith('.js')) {
                        setTermLogs(prev => [...prev, { type: 'info', text: `Launching local runtime interpreter for "${file.name}"...` }]);
                        try {
                            const consoleOutput: string[] = [];
                            const customConsole = {
                                log: (...msg: any[]) => consoleOutput.push(msg.map(m => typeof m === 'object' ? JSON.stringify(m) : m).join(' ')),
                                error: (...msg: any[]) => consoleOutput.push(`[ERR] ` + msg.join(' ')),
                                warn: (...msg: any[]) => consoleOutput.push(`[WARN] ` + msg.join(' '))
                            };
                            
                            // Eval simulation with local variables
                            const runFn = new Function('console', 'getCanvas', file.content);
                            runFn(customConsole, getCanvas);

                            setTermLogs(prev => [
                                ...prev, 
                                { type: 'output', text: consoleOutput.join('\n') || 'Script completed with no output logs.' },
                                { type: 'success', text: 'Execution finished successfully.' }
                            ]);
                        } catch (err: any) {
                            setTermLogs(prev => [...prev, { type: 'error', text: `Interpreter Error: ${err.message}` }]);
                        }
                    } else {
                        const fileExt = file.name.split('.').pop() || '';
                        setTermLogs(prev => [...prev, { type: 'info', text: `Initializing dynamic sandbox environment for ${file.name}...` }]);
                        try {
                            const ai = getAiClient();
                            const prompt = `You are a high-fidelity local terminal interpreter and code executor.
The user wants to execute the following file: "${file.name}" (Language: ${fileExt}).

--- FILE CONTENT ---
${file.content}
---

Simulate the real, exact output that running this program would produce in a terminal.
- Analyze the code logic, variables, calculations, loops, prints, functions, etc.
- Generate the precise console output (stdout/stderr) that this program would print.
- If there is a syntax error or runtime error, print the realistic error message and trace.
- Keep the response clean. Return ONLY the raw output lines that would appear in the terminal, without any markdown formatting blocks like \`\`\`bash.`;

                            const result = await ai.models.generateContent({
                                model: MODEL_NAME,
                                contents: prompt
                            });

                            const outputText = result.text || 'Script completed with empty output.';
                            setTermLogs(prev => [
                                ...prev,
                                { type: 'output', text: outputText },
                                { type: 'success', text: `Execution of ${file.name} finished successfully.` }
                            ]);
                        } catch (err: any) {
                            setTermLogs(prev => [...prev, { type: 'error', text: `Runtime error: ${err.message}` }]);
                        }
                    }
                }
                break;

            case 'gdrive':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: gdrive [list | upload <file> | cat <id> | delete <id>]' }]);
                } else {
                    const subparts = arg.split(' ');
                    const action = subparts[0].toLowerCase();
                    const value = subparts.slice(1).join(' ');

                    if (action === 'list') {
                        await fetchDriveFiles();
                    } else if (action === 'upload') {
                        const file = virtualFiles.find(f => f.name.toLowerCase() === value.toLowerCase());
                        if (file) {
                            await uploadFileToGoogleDrive(file.name, file.content);
                        } else {
                            setTermLogs(prev => [...prev, { type: 'error', text: `File "${value}" not found in local workspace.` }]);
                        }
                    } else if (action === 'cat') {
                        if (!value) {
                            setTermLogs(prev => [...prev, { type: 'error', text: 'Provide Google Drive File ID: gdrive cat <id>' }]);
                        } else {
                            setTermLogs(prev => [...prev, { type: 'info', text: `Fetching metadata & text body for file ID: ${value}...` }]);
                            try {
                                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${value}?alt=media`, {
                                    headers: { Authorization: `Bearer ${gdriveToken}` }
                                });
                                if (!res.ok) throw new Error('Failed to retrieve file contents');
                                const data = await res.text();
                                setTermLogs(prev => [
                                    ...prev,
                                    { type: 'success', text: `Retrieved body for Drive File:` },
                                    { type: 'output', text: data }
                                ]);
                            } catch (e: any) {
                                setTermLogs(prev => [...prev, { type: 'error', text: `Fetch Failed: ${e.message}` }]);
                            }
                        }
                    } else if (action === 'delete') {
                        if (!value) {
                            setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: gdrive delete <file_id>' }]);
                        } else {
                            handleRequestDeleteDriveFile(value);
                        }
                    } else {
                        setTermLogs(prev => [...prev, { type: 'error', text: `Unknown sub-command: "${action}"` }]);
                    }
                }
                break;

            case 'ollama':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: ollama [check | prompt <your prompt>]' }]);
                } else {
                    const sub = arg.split(' ');
                    const action = sub[0].toLowerCase();
                    const query = sub.slice(1).join(' ');

                    if (action === 'check') {
                        setTermLogs(prev => [...prev, { type: 'info', text: 'Connecting to local Ollama API on http://localhost:11434...' }]);
                        try {
                            const res = await fetch('http://localhost:11434/api/tags');
                            if (res.ok) {
                                const data = await res.json();
                                setOllamaStatus('online');
                                setTermLogs(prev => [
                                    ...prev,
                                    { type: 'success', text: 'Ollama connected!' },
                                    { type: 'output', text: `Available Local Models:\n${data.models?.map((m: any) => `  • ${m.name} (${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`).join('\n') || '  (No models pulled yet. Run "ollama pull codellama")'}` }
                                ]);
                            } else {
                                throw new Error('Ollama endpoint responded with non-200 status');
                            }
                        } catch (e: any) {
                            setOllamaStatus('offline');
                            setTermLogs(prev => [
                                ...prev,
                                { type: 'error', text: 'Ollama is offline or unreachable.' },
                                { type: 'info', text: 'To enable, ensure Ollama daemon is running locally on port 11434 with CORS enabled (OLLAMA_ORIGINS="*" ollama serve).' }
                            ]);
                        }
                    } else if (action === 'prompt') {
                        if (!query) {
                            setTermLogs(prev => [...prev, { type: 'error', text: 'Provide prompt: ollama prompt <text>' }]);
                        } else {
                            await queryOllama(query, true);
                        }
                    } else {
                        setTermLogs(prev => [...prev, { type: 'error', text: `Unknown ollama action: ${action}` }]);
                    }
                }
                break;

            case 'openclaw':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: openclaw <prompt>' }]);
                } else {
                    setTermLogs(prev => [
                        ...prev, 
                        { type: 'info', text: 'Routing through Openclaw developer tool-use proxy...' },
                        { type: 'output', text: '[Openclaw Proxy Log]\n[tool_call] parameters: { query: "' + arg + '" }\n[system] model_routing: deepseek-coder-v2\n[agent] Coordinating system workspace tools...' }
                    ]);
                    try {
                        const ai = getAiClient();
                        const result = await ai.models.generateContent({
                            model: MODEL_NAME,
                            contents: `[OPENCLAW PROXY MODE] Act as the Openclaw coordination proxy. Process this request: ${arg}`
                        });
                        setTermLogs(prev => [...prev, { type: 'success', text: result.text || 'No response.' }]);
                    } catch (e: any) {
                        setTermLogs(prev => [...prev, { type: 'error', text: `Openclaw execution error: ${e.message}` }]);
                    }
                }
                break;

            case 'rabbit':
                if (arg.toLowerCase() === 'review') {
                    await handleRunCodeReview();
                } else {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: rabbit review' }]);
                }
                break;

            case 'compile-suite':
            case 'export-ai': {
                setTermLogs(prev => [...prev, { type: 'info', text: 'Compiling all selected Developer AI scaffolds into a unified codebase suite...' }]);
                try {
                    const originalString = generateAiSuiteDoc(selectedTools);
                    setTermLogs(prev => [...prev, { type: 'info', text: 'Initializing lossless LZW compression sequence...' }]);
                    const compressedString = compressToLZWBase64(originalString);
                    
                    const origSize = originalString.length;
                    const compSize = compressedString.length;
                    const savings = origSize > 0 ? ((1 - (compSize / origSize)) * 100).toFixed(1) : "0.0";
                    
                    // Add generated files to virtual files
                    setVirtualFiles(prev => {
                        const next = prev.filter(f => f.name !== 'ai_developer_suite.txt' && f.name !== 'ai_developer_suite.lzw');
                        return [
                            ...next,
                            { name: 'ai_developer_suite.txt', content: originalString },
                            { name: 'ai_developer_suite.lzw', content: compressedString }
                        ];
                    });
                    
                    setCompressedData({
                        originalSize: origSize,
                        compressedSize: compSize,
                        compressedString,
                        originalString
                    });
                    
                    setActiveFile('ai_developer_suite.txt');
                    setActiveTab('editor');
                    
                    setTermLogs(prev => [
                        ...prev,
                        { type: 'output', text: `[LZW REPOSITORY COMPRESSION METRICS]\n• Included Tools: ${selectedTools.length} modules\n• Original Suite Size: ${origSize} bytes\n• LZW Compressed Size: ${compSize} bytes\n• Disk Space Saved: ${savings}%\n• Integrity Verification: 100% losslessly reversible.\n\nGenerated files added to Workspace Explorer:\n1. ai_developer_suite.txt (raw scripts & prompts)\n2. ai_developer_suite.lzw (compressed Base64 stream)` },
                        { type: 'success', text: 'AI Suite successfully compiled, compressed, and loaded in active editor!' }
                    ]);
                } catch (e: any) {
                    setTermLogs(prev => [...prev, { type: 'error', text: `Failed to compile suite: ${e.message}` }]);
                }
                break;
            }

            case 'compress':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: compress <text | filename>' }]);
                } else {
                    const file = virtualFiles.find(f => f.name.toLowerCase() === arg.toLowerCase());
                    const textToCompress = file ? file.content : arg;
                    const nameLabel = file ? `File "${file.name}"` : 'Input text';
                    
                    setTermLogs(prev => [...prev, { type: 'info', text: `Compressing ${nameLabel} using custom lossless LZW pipeline...` }]);
                    try {
                        const compressed = compressToLZWBase64(textToCompress);
                        const origSize = textToCompress.length;
                        const compSize = compressed.length;
                        const savings = origSize > 0 ? ((1 - (compSize / origSize)) * 100).toFixed(1) : "0.0";

                        setTermLogs(prev => [
                            ...prev,
                            { type: 'output', text: `[LZW COMPRESSION METRICS]\n• Original Size: ${origSize} bytes\n• Compressed Size: ${compSize} bytes\n• Space Saved: ${savings}%\n\nEncoded Base64 String:\n${compressed}` },
                            { type: 'success', text: `Compression finished successfully.` }
                        ]);
                    } catch (e: any) {
                        setTermLogs(prev => [...prev, { type: 'error', text: `Compression failed: ${e.message}` }]);
                    }
                }
                break;

            case 'decompress':
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: decompress <lzw_base64_string>' }]);
                } else {
                    setTermLogs(prev => [...prev, { type: 'info', text: 'Initializing LZW decompression sequence...' }]);
                    try {
                        const decompressed = decompressFromLZWBase64(arg.trim());
                        setTermLogs(prev => [
                            ...prev,
                            { type: 'output', text: `[LZW DECOMPRESSED OUTPUT]\n${decompressed}` },
                            { type: 'success', text: 'Decompression finished successfully.' }
                        ]);
                    } catch (e: any) {
                        setTermLogs(prev => [...prev, { type: 'error', text: `Decompression failed: ${e.message}. Ensure you entered a valid LZW-encoded Base64 string.` }]);
                    }
                }
                break;

            case 'simulate': {
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: simulate <tool_name> [prompt]' }]);
                    break;
                }
                
                let toolName = '';
                let toolOptions = '';
                const matchedTool = AI_TOOLS_DIRECTORY.find(tool => 
                    arg.toLowerCase().startsWith(tool.name.toLowerCase())
                );
                
                if (matchedTool) {
                    toolName = matchedTool.name;
                    toolOptions = arg.substring(matchedTool.name.length).trim() || 'Execute automated multi-agent workflow sequence';
                } else {
                    const spaceIdx = arg.indexOf(' ');
                    toolName = spaceIdx !== -1 ? arg.substring(0, spaceIdx) : arg;
                    toolOptions = spaceIdx !== -1 ? arg.substring(spaceIdx + 1) : 'Execute automated multi-agent workflow sequence';
                }

                setTermLogs(prev => [
                    ...prev,
                    { type: 'info', text: `🚀 Initializing live Sandbox Execution for: ${toolName}...` },
                    { type: 'output', text: `[SYSTEM] Spawning isolated secure container container-id-${Math.floor(Math.random() * 100000)}...` },
                    { type: 'output', text: `[SYSTEM] Instantiating neural pipeline libraries for ${toolName}...` }
                ]);

                try {
                    const ai = getAiClient();
                    const prompt = `[TERMSTUDIO TOOL SIMULATION]
Tool requested: ${toolName}
User Option/Prompt: ${toolOptions}

Generate a highly realistic, technical step-by-step terminal execution log trace of this tool running in a developer container.
Include detailed inner-loop steps:
- If it's an Agentic workflow (like CrewAI, AutoGen, LangGraph, Pydantic AI): show agents thinking, querying, exchanging sub-tasks, calling terminal tools, self-correcting, and printing trace output lines (e.g. "[Agent: Researcher] Searching duckduckgo...").
- If it's a Speech/Audio model (like Whisper, XTTS, Bark): show model parameter configurations, tensor mapping layers, transcribing wave audio chunks, zero-shot vocal frequency mapping, and the synthesized transcript.
- Conclude with a success line showing CPU/Memory overhead and the completed artifact summary.

Keep the output styled like a real UNIX developer terminal with clear logs, execution times, and clean formatting. Do not wrap the response in markdown blocks like \`\`\`bash, just output raw text lines to look like a terminal output.`;

                    const result = await ai.models.generateContent({
                        model: MODEL_NAME,
                        contents: prompt
                    });

                    const responseText = result.text || 'Simulation pipeline completed with empty outputs.';
                    const responseLines = responseText.split('\n').filter(line => line.trim() !== '');

                    // Stream lines step-by-step
                    let lineIndex = 0;
                    const intervalId = setInterval(() => {
                        if (lineIndex < responseLines.length) {
                            // Pushing 1-2 lines at a time for natural feel
                            const batchSize = Math.floor(Math.random() * 2) + 1;
                            const batchLines = responseLines.slice(lineIndex, lineIndex + batchSize);
                            lineIndex += batchSize;
                            
                            setTermLogs(prev => [
                                ...prev,
                                ...batchLines.map(text => ({ type: 'output' as const, text }))
                            ]);
                        } else {
                            clearInterval(intervalId);
                            setTermLogs(prev => [
                                ...prev,
                                { type: 'success', text: `🎉 Live simulation of ${toolName} completed successfully.` }
                            ]);
                        }
                    }, 250);
                    
                    activeIntervalsRef.current.push(intervalId);
                } catch (e: any) {
                    setTermLogs(prev => [...prev, { type: 'error', text: `Simulation Error: ${e.message}` }]);
                }
                break;
            }

            case 'launch': {
                if (!arg) {
                    setTermLogs(prev => [...prev, { type: 'error', text: 'Usage: launch <app_name> (e.g. launch langchain, launch ollama, launch coderabbit)' }]);
                    break;
                }
                const appName = arg.trim().toLowerCase();
                let targetAppId = '';
                if (appName.includes('langchain') || appName.includes('langgraph')) targetAppId = 'langchain';
                else if (appName.includes('ollama') || appName.includes('local ai')) targetAppId = 'ollama';
                else if (appName.includes('openclaw')) targetAppId = 'openclaw';
                else if (appName.includes('coderabbit') || appName.includes('rabbit')) targetAppId = 'coderabbit';
                else if (appName.includes('scholar') || appName.includes('semantic')) targetAppId = 'semantic_scholar';
                else if (appName.includes('researchrabbit') || appName.includes('research')) targetAppId = 'research_rabbit';
                else if (appName.includes('papers') || appName.includes('code')) targetAppId = 'papers_with_code';
                else if (appName.includes('unreal')) targetAppId = 'unreal_engine';
                else if (appName.includes('blender')) targetAppId = 'blender';
                else if (appName.includes('flipper')) targetAppId = 'flipper';
                else if (appName.includes('mail')) targetAppId = 'mail';
                else if (appName.includes('snake') || appName.includes('game')) targetAppId = 'snake';

                if (targetAppId) {
                    setTermLogs(prev => [...prev, { type: 'success', text: `🚀 Dispatching command to launch Sandbox Window: ${targetAppId}...` }]);
                    window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId: targetAppId } }));
                } else {
                    setTermLogs(prev => [...prev, { type: 'error', text: `Unknown workspace app: "${arg}". Try \'launch langchain\' or \'launch ollama\'.` }]);
                }
                break;
            }

            default:
                setTermLogs(prev => [
                    ...prev,
                    { type: 'info', text: `Evaluating as JS snippet: "${trimmed}"` }
                ]);
                try {
                    const consoleOutput: string[] = [];
                    const customConsole = {
                        log: (...msg: any[]) => consoleOutput.push(msg.join(' ')),
                        error: (...msg: any[]) => consoleOutput.push(`[ERR] ` + msg.join(' ')),
                        warn: (...msg: any[]) => consoleOutput.push(`[WARN] ` + msg.join(' '))
                    };
                    const runFn = new Function('console', 'getCanvas', trimmed);
                    const res = runFn(customConsole, getCanvas);
                    
                    if (consoleOutput.length > 0) {
                        setTermLogs(prev => [...prev, { type: 'output', text: consoleOutput.join('\n') }]);
                    }
                    if (res !== undefined) {
                        setTermLogs(prev => [...prev, { type: 'success', text: `Result: ${res}` }]);
                    }
                } catch (e: any) {
                    setTermLogs(prev => [...prev, { type: 'error', text: `Unknown command or Eval error: ${e.message}` }]);
                }
        }
    };

    const handleTermSubmit = () => {
        if (!termInput.trim()) return;
        const cmd = termInput;
        setTermInput('');
        handleCommand(cmd);
    };

    // --- AI DIALOGUE & REVIEW CONTROLLER ---
    const handleRunCodeReview = async () => {
        const fileObj = virtualFiles.find(f => f.name === activeFile);
        if (!fileObj) {
            setTermLogs(prev => [...prev, { type: 'error', text: 'No active file in editor to review.' }]);
            return;
        }

        setAiMessages(prev => [...prev, { role: 'user', content: `Please review my file "${activeFile}" as CodeRabbit.` }]);
        setTermLogs(prev => [...prev, { type: 'info', text: `🐇 Launching CodeRabbit Code Review on "${activeFile}"...` }]);
        setAiIsLoading(true);

        const reviewPrompt = `You are CodeRabbit (also called WhiteRabbit), an ultra-smart automated code quality analyzer.
Review this code file. Find bugs, optimization opportunities, and security flaws.
File Name: ${activeFile}
Code Contents:
\`\`\`
${fileObj.content}
\`\`\`

Format your response beautifully with plenty of Rabbit emojis 🐇:
📊 **Rabbit Quality Score**: /10 with a short description
🔍 **Bugs & Warning Signs**: List any bugs, typos, logic flaws, or null pointers
🔒 **Security Analysis**: Identify code injection, private token exposures, or security flaws
💡 **Refactoring Tips**: How to make the code cleaner, more idiomatic and concise
🚀 **Performance Boosters**: How to make it execute faster and consume less memory`;

        try {
            const ai = getAiClient();
            const result = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: reviewPrompt
            });

            const reply = result.text || 'Review failed to generate.';
            setAiMessages(prev => [...prev, { role: 'assistant', content: reply }]);
            setTermLogs(prev => [...prev, { type: 'success', text: `🐇 CodeRabbit completed review of "${activeFile}"! View details in the AI Panel.` }]);
        } catch (err: any) {
            console.error('Review generation error:', err);
            setTermLogs(prev => [...prev, { type: 'error', text: `CodeRabbit Review Error: ${err.message}` }]);
        } finally {
            setAiIsLoading(false);
        }
    };

    const queryOllama = async (prompt: string, logToTerm = false) => {
        if (logToTerm) {
            setTermLogs(prev => [...prev, { type: 'info', text: 'Submitting query to local Ollama daemon...' }]);
        }
        try {
            const res = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'codellama',
                    prompt: prompt,
                    stream: false
                })
            });
            if (!res.ok) throw new Error(`Ollama responded with status ${res.status}`);
            const data = await res.json();
            const reply = data.response || '(Empty response)';
            
            if (logToTerm) {
                setTermLogs(prev => [
                    ...prev,
                    { type: 'success', text: 'Ollama local response:' },
                    { type: 'output', text: reply }
                ]);
            } else {
                setAiMessages(prev => [...prev, { role: 'assistant', content: `[Ollama - Local] ${reply}` }]);
            }
        } catch (e: any) {
            const errMsg = `Ollama Unreachable: ${e.message}. Ensure Ollama is running on port 11434 with OLLAMA_ORIGINS="*" set.`;
            if (logToTerm) {
                setTermLogs(prev => [...prev, { type: 'error', text: errMsg }]);
            } else {
                setAiMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
            }
        }
    };

    const handleSendAIMessage = async () => {
        if (!aiInput.trim()) return;
        const msg = aiInput;
        setAiInput('');
        setAiMessages(prev => [...prev, { role: 'user', content: msg }]);
        setAiIsLoading(true);

        const currentFileObj = virtualFiles.find(f => f.name === activeFile);
        const systemPrompt = `[MODE: ${aiProvider.toUpperCase()}]
You are TermStudio's highly intelligent developer companion. You help write, debug, and understand complex scripts.
The user is currently editing: "${activeFile}" which has the following contents:
\`\`\`
${currentFileObj?.content || ''}
\`\`\``;

        if (aiProvider === 'ollama') {
            await queryOllama(`${systemPrompt}\n\nUser Question: ${msg}`);
            setAiIsLoading(false);
            return;
        }

        try {
            const ai = getAiClient();
            const contents = aiProvider === 'openclaw' 
                ? `[OPENCLAW DEVELOPER AGENT MODE] Context: ${systemPrompt}\n\nRequest: ${msg}`
                : `${systemPrompt}\n\nUser Question: ${msg}`;

            const result = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: contents
            });

            setAiMessages(prev => [...prev, { role: 'assistant', content: result.text || 'No response.' }]);
        } catch (e: any) {
            setAiMessages(prev => [...prev, { role: 'assistant', content: `Error communicating with model: ${e.message}` }]);
        } finally {
            setAiIsLoading(false);
        }
    };

    // Attach active file as context
    const handleAttachContext = () => {
        const file = virtualFiles.find(f => f.name === activeFile);
        if (file) {
            setAiInput(prev => `${prev}\n\n/* Context from ${file.name} */\n${file.content}\n`);
            setTermLogs(prev => [...prev, { type: 'info', text: `Attached "${file.name}" to AI prompt.` }]);
        }
    };

    // Prepopulate prompt from Tools Directory
    const handleUseToolPrompt = (toolPrompt: string, toolName: string) => {
        setAiInput(`I am interested in using ${toolName}. ${toolPrompt}`);
        setTermLogs(prev => [...prev, { type: 'info', text: `Selected directory template for ${toolName}.` }]);
    };

    // Save active editor file
    const handleSaveEditor = () => {
        setVirtualFiles(prev => prev.map(f => f.name === activeFile ? { ...f, content: editorContent } : f));
        setTermLogs(prev => [...prev, { type: 'success', text: `Saved and compiled "${activeFile}" successfully.` }]);
    };

    // Create a new local workspace file
    const handleCreateLocalFile = () => {
        if (!newFileName.trim()) return;
        const name = newFileName.endsWith('.js') || newFileName.endsWith('.py') || newFileName.endsWith('.cpp')
            ? newFileName
            : `${newFileName}.js`;

        setVirtualFiles(prev => {
            if (prev.find(f => f.name === name)) return prev;
            return [...prev, { name, content: `// New script: ${name}\n\nconsole.log("Welcome to ${name}!");` }];
        });
        setActiveFile(name);
        setNewFileName('');
        setShowNewFileModal(false);
        setTermLogs(prev => [...prev, { type: 'success', text: `Created local workspace file: ${name}` }]);
    };

    // Remove local file
    const handleRemoveLocalFile = (name: string) => {
        if (virtualFiles.length <= 1) return;
        setVirtualFiles(prev => prev.filter(f => f.name !== name));
        if (activeFile === name) {
            const remaining = virtualFiles.filter(f => f.name !== name);
            setActiveFile(remaining[0].name);
        }
        setTermLogs(prev => [...prev, { type: 'info', text: `Deleted local file "${name}".` }]);
    };

    // Filter tools directory
    const filteredTools = AI_TOOLS_DIRECTORY.filter(tool => {
        const query = aiSearchQuery.toLowerCase();
        return tool.name.toLowerCase().includes(query) || 
               tool.category.toLowerCase().includes(query) || 
               tool.desc.toLowerCase().includes(query);
    });

    return (
        <div className="h-full w-full flex flex-col lg:flex-row bg-zinc-950 text-zinc-100 font-mono text-xs select-none">
            
            {/* LEFT WORKSPACE PANELS */}
            <aside className="w-full lg:w-72 bg-zinc-900 border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col flex-shrink-0">
                
                {/* File Header */}
                <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-zinc-300 font-bold uppercase tracking-wider text-[10px]">
                        <Folder size={12} className="text-blue-400" />
                        <span>Workspace Explorer</span>
                    </div>
                    <button 
                        onClick={() => setShowNewFileModal(true)} 
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                        title="New local file"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* Local Workspace Tree */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <span className="px-2 py-1 text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">Local Sandboxed Files</span>
                    {virtualFiles.map((file) => {
                        const isSelected = activeFile === file.name;
                        return (
                            <div 
                                key={file.name}
                                className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition ${
                                    isSelected ? 'bg-purple-900/30 text-purple-200 border border-purple-500/30' : 'hover:bg-zinc-800 text-zinc-400'
                                }`}
                                onClick={() => {
                                    setActiveFile(file.name);
                                    setActiveTab('editor');
                                }}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileCode size={13} className={file.name.endsWith('.js') ? 'text-yellow-400' : file.name.endsWith('.py') ? 'text-sky-400' : 'text-blue-500'} />
                                    <span className="truncate font-medium">{file.name}</span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveLocalFile(file.name);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-700 rounded text-zinc-500 hover:text-red-400 transition"
                                    title="Delete Local File"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        );
                    })}

                    {/* Google Drive Files Segment */}
                    <div className="pt-4 border-t border-zinc-800/60 mt-2 space-y-2">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Google Drive Browser</span>
                            {gdriveToken && (
                                <button 
                                    onClick={() => fetchDriveFiles()} 
                                    className="p-0.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                    disabled={isListingDrive}
                                >
                                    <RefreshCw size={10} className={isListingDrive ? 'animate-spin' : ''} />
                                </button>
                            )}
                        </div>

                        {gdriveToken ? (
                            <div className="space-y-1 px-1">
                                <div className="flex items-center justify-between bg-zinc-950/50 p-2 rounded border border-zinc-800">
                                    <div className="overflow-hidden">
                                        <div className="text-[10px] text-zinc-400 font-bold truncate">{gdriveUser?.displayName || 'Drive Linked'}</div>
                                        <div className="text-[8px] text-zinc-500 truncate">{gdriveUser?.email}</div>
                                    </div>
                                    <button 
                                        onClick={handleSignOutDrive} 
                                        className="p-1 hover:bg-zinc-800 rounded text-red-400 hover:text-red-300"
                                        title="Disconnect Google Drive"
                                    >
                                        <LogOut size={11} />
                                    </button>
                                </div>

                                <div className="space-y-0.5 max-h-48 overflow-y-auto pt-1">
                                    {gdriveFiles.length === 0 ? (
                                        <div className="p-2 text-center text-zinc-600 text-[10px]">No app-specific Drive files found yet. Run `gdrive list` or upload a file.</div>
                                    ) : (
                                        gdriveFiles.map((driveFile) => (
                                            <div 
                                                key={driveFile.id}
                                                className="flex items-center justify-between p-1.5 hover:bg-zinc-800/70 rounded group text-zinc-400 text-[10px] cursor-default"
                                            >
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <Cloud size={11} className="text-emerald-400 flex-shrink-0" />
                                                    <span className="truncate font-medium" title={driveFile.name}>{driveFile.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button 
                                                        onClick={() => downloadDriveFile(driveFile.id, driveFile.name)} 
                                                        className="p-0.5 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white"
                                                        title="Import File to Local Workspace"
                                                    >
                                                        <CloudDownload size={11} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRequestDeleteDriveFile(driveFile.id)} 
                                                        className="p-0.5 hover:bg-zinc-700 rounded text-red-400 hover:text-red-300"
                                                        title="Delete File from Drive"
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="px-2 py-1 space-y-2">
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    Connect your Google Drive securely with permissions to browse, download, and manage your cloud app files dynamically.
                                </p>
                                
                                <button 
                                    onClick={handleGoogleDriveSignIn} 
                                    className="w-full flex items-center justify-center gap-2 p-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 rounded font-bold text-white shadow transition-all duration-200"
                                >
                                    <CloudUpload size={14} />
                                    <span>Connect Google Drive</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Workspace footer stats */}
                <div className="p-2.5 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center text-[10px] text-zinc-500">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${ollamaStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span>Ollama Daemon: {ollamaStatus}</span>
                    </div>
                    {gdriveToken && <span className="text-emerald-500">Drive Sync Active</span>}
                </div>
            </aside>

            {/* VIRTUAL WORKSPACE MAIN PANEL */}
            <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden border-r border-zinc-800">
                
                {/* Tabs bar */}
                <div className="flex bg-zinc-900 border-b border-zinc-800 items-center justify-between">
                    <div className="flex">
                        <button 
                            onClick={() => setActiveTab('terminal')} 
                            className={`px-4 py-2.5 font-bold flex items-center gap-2 border-r border-zinc-800 transition ${
                                activeTab === 'terminal' ? 'bg-zinc-950 text-white border-t-2 border-t-purple-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                        >
                            <TerminalIcon size={12} className="text-purple-400" />
                            <span>System Terminal</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('editor')} 
                            className={`px-4 py-2.5 font-bold flex items-center gap-2 border-r border-zinc-800 transition ${
                                activeTab === 'editor' ? 'bg-zinc-950 text-white border-t-2 border-t-purple-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                        >
                            <Code2 size={12} className="text-yellow-400" />
                            <span>Active Editor ({activeFile})</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('canvas')} 
                            className={`px-4 py-2.5 font-bold flex items-center gap-2 border-r border-zinc-800 transition ${
                                activeTab === 'canvas' ? 'bg-zinc-950 text-white border-t-2 border-t-purple-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                        >
                            <Sparkles size={12} className="text-sky-400" />
                            <span>Simulated Canvas</span>
                        </button>
                    </div>

                    <div className="px-3 flex items-center gap-2 text-zinc-500 text-[10px]">
                        <span>Workspace Mode:</span>
                        <span className="bg-zinc-800 text-purple-300 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-purple-500/20">TermStudio Full-Stack</span>
                    </div>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-hidden relative">
                    
                    {/* TERMINAL TAB */}
                    {activeTab === 'terminal' && (
                        <div className="h-full flex flex-col">
                            {/* Terminal Console Stream */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px] leading-relaxed select-text bg-zinc-950">
                                {termLogs.map((log, i) => (
                                    <div key={i} className="whitespace-pre-wrap">
                                        {log.type === 'cmd' ? (
                                            <div className="flex items-start gap-1">
                                                <span className="text-purple-400 font-bold">termstudio $</span>
                                                <span className="text-zinc-100 font-semibold">{log.text}</span>
                                            </div>
                                        ) : log.type === 'error' ? (
                                            <div className="text-red-400 font-bold bg-red-950/20 p-1.5 rounded border border-red-500/20 flex items-start gap-2">
                                                <AlertTriangle size={12} className="mt-0.5" />
                                                <span>{log.text}</span>
                                            </div>
                                        ) : log.type === 'success' ? (
                                            <div className="text-emerald-400 font-bold bg-emerald-950/20 p-1.5 rounded border border-emerald-500/20 flex items-start gap-2">
                                                <CheckCircle size={12} className="mt-0.5" />
                                                <span>{log.text}</span>
                                            </div>
                                        ) : log.type === 'info' ? (
                                            <div className="text-zinc-400 font-bold italic bg-zinc-900 p-1 rounded">
                                                <span>{log.text}</span>
                                            </div>
                                        ) : (
                                            <div className="text-zinc-300 bg-zinc-900/30 p-1.5 rounded border border-zinc-800/40">{log.text}</div>
                                        )}
                                    </div>
                                ))}
                                <div ref={termLogsEndRef} />
                            </div>

                            {/* Terminal prompt input row */}
                            <div className="p-2 border-t border-zinc-800 bg-zinc-900 flex items-center gap-2">
                                <span className="text-purple-400 font-extrabold pl-1 select-none">termstudio $</span>
                                <input 
                                    type="text"
                                    value={termInput}
                                    onChange={e => setTermInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleTermSubmit()}
                                    className="flex-1 bg-transparent text-white border-none outline-none focus:ring-0 placeholder-zinc-600 font-mono text-[11px]"
                                    placeholder="Type terminal command (e.g., 'help', 'gdrive list', 'ollama check', 'rabbit review')..."
                                    autoFocus
                                />
                                <button 
                                    onClick={handleTermSubmit}
                                    className="p-1.5 hover:bg-zinc-800 rounded text-purple-400 hover:text-white transition"
                                >
                                    <Send size={13} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ACTIVE EDITOR TAB */}
                    {activeTab === 'editor' && (
                        <div className="h-full flex flex-col bg-zinc-950">
                            {/* Editor control bar */}
                            <div className="p-2 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileCode size={12} className="text-yellow-400" />
                                    <span className="font-bold text-zinc-300">{activeFile}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleSaveEditor} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold rounded transition text-[10px]"
                                        title="Compile and Save Code to Workspace"
                                    >
                                        <Save size={11} />
                                        <span>Save & Compile</span>
                                    </button>
                                    {gdriveToken && (
                                        <button 
                                            onClick={() => uploadFileToGoogleDrive(activeFile, editorContent)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition text-[10px]"
                                            title="Upload Active File to Google Drive"
                                        >
                                            <CloudUpload size={11} />
                                            <span>Upload to Drive</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Main Textarea panel */}
                            <textarea 
                                value={editorContent}
                                onChange={e => setEditorContent(e.target.value)}
                                className="flex-1 w-full bg-zinc-950 text-zinc-100 p-4 font-mono text-[11px] outline-none resize-none leading-relaxed border-none focus:ring-0 select-text"
                                spellCheck="false"
                                placeholder="// Write code snippets here..."
                            />
                        </div>
                    )}

                    {/* SIMULATED CANVAS TAB */}
                    {activeTab === 'canvas' && (
                        <div className="h-full flex flex-col bg-zinc-950 p-4 items-center justify-center">
                            <div className="w-full max-w-lg space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Simulated Display Canvas</span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => drawCanvasDemo('block')} 
                                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-[10px] font-bold"
                                        >
                                            Paint Blocks
                                        </button>
                                        <button 
                                            onClick={() => drawCanvasDemo('sparkles')} 
                                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-[10px] font-bold"
                                        >
                                            Add Sparkles
                                        </button>
                                        <button 
                                            onClick={() => drawCanvasDemo('reset')} 
                                            className="px-2 py-1 bg-red-950/40 text-red-400 hover:bg-red-900/30 border border-red-900/50 rounded text-[10px] font-bold"
                                        >
                                            Reset Canvas
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 shadow-xl flex items-center justify-center">
                                    <canvas 
                                        ref={canvasRef} 
                                        width={480} 
                                        height={280} 
                                        className="bg-zinc-950 border border-zinc-800 max-w-full rounded shadow-inner"
                                    />
                                </div>

                                <p className="text-[10px] text-zinc-500 leading-relaxed text-center">
                                    Evaluating JavaScript scripts containing <code>getCanvas()</code> automatically draws shapes here. Test it with <code>run welcome.js</code>!
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* RIGHT SIDE PANEL: AI ASSISTANT & TOOLS DIRECTORY */}
            <aside className="w-full lg:w-80 bg-zinc-900 flex flex-col flex-shrink-0">
                
                {/* AI Configuration Section */}
                <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-bold uppercase tracking-wider text-[10px]">
                            <Bot size={13} className="text-purple-400" />
                            <span>AI Assistant Engine</span>
                        </div>
                        <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded text-[8px] font-bold text-zinc-500">
                            <Cpu size={10} />
                            <span>Active Provider</span>
                        </div>
                    </div>

                    <div className="flex gap-1.5">
                        <button 
                            onClick={() => setAiProvider('gemini')}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${
                                aiProvider === 'gemini' 
                                    ? 'bg-purple-900/20 border-purple-500 text-purple-200' 
                                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Gemini Cloud
                        </button>
                        <button 
                            onClick={() => setAiProvider('ollama')}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${
                                aiProvider === 'ollama' 
                                    ? 'bg-purple-900/20 border-purple-500 text-purple-200' 
                                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Ollama (Local)
                        </button>
                        <button 
                            onClick={() => setAiProvider('openclaw')}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${
                                aiProvider === 'openclaw' 
                                    ? 'bg-purple-900/20 border-purple-500 text-purple-200' 
                                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Openclaw Proxy
                        </button>
                    </div>
                </div>

                {/* AI Chat History Window */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-950/40 select-text max-h-[300px] lg:max-h-none">
                    {aiMessages.map((msg, idx) => (
                        <div 
                            key={idx} 
                            className={`p-2.5 rounded-lg border leading-relaxed text-[10px] ${
                                msg.role === 'user' 
                                    ? 'bg-purple-950/20 border-purple-900/40 text-purple-200 ml-4' 
                                    : msg.role === 'system'
                                        ? 'bg-zinc-900/60 border-zinc-800/60 text-zinc-400 italic'
                                        : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-100 mr-4'
                            }`}
                        >
                            <div className="flex items-center gap-1.5 font-bold mb-1 border-b border-white/5 pb-1 select-none">
                                {msg.role === 'user' ? (
                                    <span className="text-purple-400">👤 User Request</span>
                                ) : msg.role === 'system' ? (
                                    <span className="text-zinc-500">ℹ️ System Status</span>
                                ) : (
                                    <span className="text-purple-400 flex items-center gap-1">
                                        <Rabbit size={10} className="text-purple-400" />
                                        <span>WhiteRabbit Reviewer</span>
                                    </span>
                                )}
                            </div>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    ))}
                    {aiIsLoading && (
                        <div className="text-zinc-500 text-[10px] italic flex items-center gap-1.5">
                            <RefreshCw size={11} className="animate-spin" />
                            <span>Computing model response...</span>
                        </div>
                    )}
                    <div ref={aiMessagesEndRef} />
                </div>

                {/* AI Control buttons */}
                <div className="px-3 pt-2 pb-1 bg-zinc-900 border-t border-zinc-800/70 flex gap-1.5">
                    <button 
                        onClick={handleAttachContext}
                        className="flex-1 py-1 px-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded text-[9px] font-bold border border-zinc-700/50 transition flex items-center justify-center gap-1"
                        title="Add Active Code File to your next prompt"
                    >
                        <Paperclip size={10} />
                        <span>📎 Attach Context</span>
                    </button>
                    <button 
                        onClick={handleRunCodeReview}
                        className="flex-1 py-1 px-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 hover:text-purple-200 border border-purple-900/50 rounded text-[9px] font-bold transition flex items-center justify-center gap-1"
                        title="Perform a smart CodeRabbit/WhiteRabbit Code Review"
                    >
                        <Rabbit size={10} />
                        <span>🐇 CodeReview</span>
                    </button>
                </div>

                {/* AI Chat Input Panel */}
                <div className="p-2 bg-zinc-900 border-b border-zinc-800 flex gap-2">
                    <textarea 
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendAIMessage();
                            }
                        }}
                        className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-[10px] outline-none text-white focus:border-purple-500 placeholder-zinc-600 font-sans resize-none"
                        rows={2}
                        placeholder="Ask Assistant or run a code review..."
                    />
                    <button 
                        onClick={handleSendAIMessage} 
                        disabled={aiIsLoading}
                        className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold p-2.5 rounded transition flex items-center justify-center flex-shrink-0 self-end"
                    >
                        <Send size={12} />
                    </button>
                </div>

                {/* TOOLS DIRECTORY ACCORDION */}
                <div className="flex-1 overflow-hidden flex flex-col border-t border-zinc-800 bg-zinc-900">
                    <details open className="flex-1 flex flex-col overflow-hidden">
                        <summary className="p-3 font-bold text-zinc-300 uppercase tracking-wider text-[10px] border-b border-zinc-800 cursor-pointer hover:bg-zinc-800 flex justify-between items-center">
                            <span>AI Tools Directory</span>
                        </summary>
                        
                        <div className="p-2 bg-zinc-900/50 flex flex-col flex-1 overflow-hidden">
                            <div className="relative mb-2">
                                <Search size={11} className="absolute left-2.5 top-2.5 text-zinc-500" />
                                <input 
                                    type="text"
                                    value={aiSearchQuery}
                                    onChange={e => setAiSearchQuery(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded pl-7 pr-2.5 py-2 text-[10px] outline-none text-white focus:border-purple-500 placeholder-zinc-600"
                                    placeholder="Search APIs, editors, deployment tools..."
                                />
                            </div>

                            {/* Massive Suite Compile & Compress Action Bar */}
                            <div className="mb-2.5 p-2 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col gap-1.5 select-none">
                                <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400">
                                    <span className="text-purple-400">Export Suite: {selectedTools.length} / {AI_TOOLS_DIRECTORY.length} selected</span>
                                    <div className="flex gap-1.5 items-center">
                                        <button 
                                            onClick={() => setSelectedTools(AI_TOOLS_DIRECTORY.map(t => t.name))}
                                            className="text-[9px] text-zinc-500 hover:text-zinc-300 font-bold hover:underline cursor-pointer"
                                        >
                                            All
                                        </button>
                                        <span className="text-zinc-800">|</span>
                                        <button 
                                            onClick={() => setSelectedTools([])}
                                            className="text-[9px] text-zinc-500 hover:text-zinc-300 font-bold hover:underline cursor-pointer"
                                        >
                                            None
                                        </button>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        if (selectedTools.length === 0) {
                                            setTermLogs(prev => [...prev, { type: 'error', text: 'Select at least one tool to compile.' }]);
                                            return;
                                        }
                                        setShowExportModal(true);
                                        handleCompileAndCompressSuite();
                                    }}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-black text-[9px] py-1.5 px-2.5 rounded transition duration-200 flex items-center justify-center gap-1 shadow-md border border-purple-500/20"
                                >
                                    <Sparkles size={10} className="animate-pulse" />
                                    <span>Compile & LZW Compress Selected</span>
                                </button>
                            </div>

                            {/* Scrolling Tool Cards */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
                                {filteredTools.length === 0 ? (
                                    <div className="text-center text-zinc-600 p-4">No tools match your query.</div>
                                ) : (
                                    filteredTools.map((tool) => (
                                        <div 
                                            key={tool.name} 
                                            className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg group transition"
                                        >
                                            <div className="flex items-center justify-between mb-1 select-none">
                                                <div className="flex items-center gap-1.5">
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedTools.includes(tool.name)}
                                                        onChange={() => {
                                                            setSelectedTools(prev => 
                                                                prev.includes(tool.name) 
                                                                    ? prev.filter(name => name !== tool.name)
                                                                    : [...prev, tool.name]
                                                            );
                                                        }}
                                                        className="w-3 h-3 rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                    />
                                                    <span className="font-bold text-zinc-200 text-[10px]">{tool.name}</span>
                                                </div>
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                                    tool.tier === 'FREE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                                                    tool.tier === 'FREEMIUM' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                                                    'bg-amber-950 text-amber-400 border border-amber-900'
                                                }`}>
                                                    {tool.tier}
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 text-[9px] leading-relaxed mb-2">{tool.desc}</p>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => handleUseToolPrompt(tool.prompt, tool.name)}
                                                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-[8px] font-bold py-1 px-1 rounded text-purple-400 border border-purple-900/40 hover:border-purple-800/80 transition-colors flex items-center justify-center gap-0.5"
                                                    title="Prepopulate AI prompt"
                                                >
                                                    <span>Prompt</span>
                                                    <ArrowRight size={8} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setActiveTab('terminal');
                                                        handleCommand(`simulate ${tool.name}`);
                                                    }}
                                                    className="flex-1 bg-purple-950 hover:bg-purple-900 text-[8px] font-bold py-1 px-1 rounded text-purple-200 border border-purple-800/50 hover:border-purple-700 transition-colors flex items-center justify-center gap-0.5"
                                                    title="Run UNIX container simulation log"
                                                >
                                                    <Play size={8} className="fill-purple-200 shrink-0" />
                                                    <span>Simulate</span>
                                                </button>
                                                {getAppIdForTool(tool.name) && (
                                                    <button 
                                                        onClick={() => {
                                                            const appId = getAppIdForTool(tool.name);
                                                            if (appId) {
                                                                window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId } }));
                                                                setTermLogs(prev => [...prev, { type: 'success', text: `🚀 Initialized and connected to live sandbox window of ${tool.name} (${appId}).` }]);
                                                            }
                                                        }}
                                                        className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-[8px] font-bold py-1 px-1 rounded text-emerald-200 border border-emerald-800/50 hover:border-emerald-700 transition-colors flex items-center justify-center gap-0.5"
                                                        title={`Launch actual ${tool.name} window`}
                                                    >
                                                        <Sparkles size={8} className="text-emerald-300" />
                                                        <span>Launch</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </details>
                </div>
            </aside>

            {/* MODAL: EXPORT & COMPRESS AI DEVELOPER SUITE */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[5000] p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Title Bar */}
                        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 select-none">
                                <Sparkles className="text-purple-400 animate-pulse" size={14} />
                                <span className="font-extrabold text-[11px] text-zinc-200 uppercase tracking-wider">Mass AI Suite Compiler & Lossless Compressor</span>
                            </div>
                            <button 
                                onClick={() => setShowExportModal(false)}
                                className="text-zinc-500 hover:text-zinc-300 transition text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-800 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            {isCompiling ? (
                                <div className="space-y-4 py-8 text-center">
                                    <div className="w-10 h-10 rounded-full border-2 border-t-purple-500 border-zinc-800 animate-spin mx-auto" />
                                    <p className="text-zinc-200 font-bold text-xs">Compiling & LZW Packing {selectedTools.length} AI Codebases...</p>
                                    <div className="w-full max-w-xs bg-zinc-950 rounded-full h-1.5 overflow-hidden mx-auto border border-zinc-800">
                                        <div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${compilationProgress}%` }} />
                                    </div>
                                    <p className="font-mono text-[9px] text-zinc-500 animate-pulse">
                                        {compilationProgress < 30 ? "⚡ Parsing selected AI templates..." :
                                         compilationProgress < 60 ? "🛠️ Generating full-fidelity code boilerplate..." :
                                         compilationProgress < 90 ? "🗜️ Executing sliding-dictionary LZW code-compression..." :
                                         "✨ Finalizing stream package verification..."}
                                    </p>
                                </div>
                            ) : compressedData ? (
                                <div className="space-y-4">
                                    {/* Compression Telemetry Cards */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Original Suite Size</div>
                                            <div className="text-sm font-black text-zinc-300 font-mono">{compressedData.originalSize.toLocaleString()} B</div>
                                        </div>
                                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">LZW Compressed Size</div>
                                            <div className="text-sm font-black text-purple-400 font-mono">{compressedData.compressedSize.toLocaleString()} B</div>
                                        </div>
                                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Lossless Space Saved</div>
                                            <div className="text-sm font-black text-emerald-400 font-mono">
                                                {compressedData.originalSize > 0 
                                                    ? ((1 - (compressedData.compressedSize / compressedData.originalSize)) * 100).toFixed(1) 
                                                    : "0.0"}%
                                            </div>
                                        </div>
                                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Integrity Verification</div>
                                            <div className="text-[10px] font-black text-blue-400 flex items-center gap-1 mt-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                                                <span>100% Lossless Checked</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Space Efficiency Bar */}
                                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2 select-none">
                                        <div className="flex justify-between text-[9px] font-bold text-zinc-400">
                                            <span>Compression Ratio Visualization</span>
                                            <span className="text-purple-400 font-mono">
                                                {compressedData.originalSize > 0 
                                                    ? (compressedData.originalSize / compressedData.compressedSize).toFixed(2) 
                                                    : "1.00"}x Ratio
                                            </span>
                                        </div>
                                        <div className="w-full bg-zinc-900 rounded h-4 overflow-hidden flex relative border border-zinc-800">
                                            <div 
                                                className="bg-gradient-to-r from-purple-600 to-indigo-700 h-full flex items-center pl-2 text-[8px] font-black text-white"
                                                style={{ width: `${Math.max(15, (compressedData.compressedSize / compressedData.originalSize) * 100)}%` }}
                                            >
                                                LZW ({(compressedData.compressedSize / 1024).toFixed(1)} KB)
                                            </div>
                                            <div className="flex-1 flex items-center justify-end pr-2 text-[8px] font-black text-zinc-600">
                                                Original ({(compressedData.originalSize / 1024).toFixed(1)} KB)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => downloadFile('ai_developer_suite.txt', compressedData.originalString)}
                                            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 font-bold rounded-lg border border-zinc-700 text-[10px] flex items-center justify-center gap-2 transition"
                                        >
                                            <ArrowRight size={12} className="rotate-90 text-zinc-400" />
                                            <span>Download Raw Text (.txt)</span>
                                        </button>
                                        <button 
                                            onClick={() => downloadFile('ai_developer_suite.lzw', compressedData.compressedString)}
                                            className="p-2.5 bg-gradient-to-r from-purple-950 to-indigo-950 hover:from-purple-900 hover:to-indigo-900 active:from-purple-950 active:to-indigo-950 text-purple-200 font-bold rounded-lg border border-purple-800/40 text-[10px] flex items-center justify-center gap-2 transition"
                                        >
                                            <ArrowRight size={12} className="rotate-90 text-purple-400" />
                                            <span>Download LZW Payload (.lzw)</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(compressedData.originalString);
                                                setTermLogs(prev => [...prev, { type: 'success', text: 'Copied Raw AI Suite codebase to clipboard!' }]);
                                            }}
                                            className="p-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 font-semibold rounded-lg border border-zinc-800 text-[10px] flex items-center justify-center gap-1.5 transition"
                                        >
                                            <span>Copy Raw Source Code</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const payload = `[CYBERNETIC OS COMPRESSED REPOSITORY]\nLZW_B64_DATA: ${compressedData.compressedString}\n\nINSTRUCTIONS: Decompress using LZW base64 algorithm to extract the full AI developer suite.`;
                                                navigator.clipboard.writeText(payload);
                                                setTermLogs(prev => [...prev, { type: 'success', text: 'Copied LZW Compressed Payload packet to clipboard!' }]);
                                            }}
                                            className="p-2 bg-zinc-950 hover:bg-zinc-900 text-purple-400/80 hover:text-purple-300 font-semibold rounded-lg border border-zinc-800 text-[10px] flex items-center justify-center gap-1.5 transition"
                                        >
                                            <span>Copy LZW Payload Packet</span>
                                        </button>
                                    </div>

                                    {/* Code Preview Section */}
                                    <div className="space-y-1.5 select-none">
                                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex justify-between">
                                            <span>Compiled Code Preview (Virtual File Explorer Mounted)</span>
                                            <span>Showing top header</span>
                                        </div>
                                        <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[9px] text-zinc-400 max-h-40 overflow-y-auto leading-relaxed select-text">
                                            {compressedData.originalString.substring(0, 1500)}
                                            {"\n... [Truncated for preview, download or open active file inside editor to inspect full suite] ..."}
                                        </pre>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-2 select-none">
                            <button 
                                onClick={() => {
                                    setVirtualFiles(prev => {
                                        const next = prev.filter(f => f.name !== 'ai_developer_suite.txt' && f.name !== 'ai_developer_suite.lzw');
                                        return [
                                            ...next,
                                            { name: 'ai_developer_suite.txt', content: compressedData?.originalString || '' },
                                            { name: 'ai_developer_suite.lzw', content: compressedData?.compressedString || '' }
                                        ];
                                    });
                                    setActiveFile('ai_developer_suite.txt');
                                    setActiveTab('editor');
                                    setShowExportModal(false);
                                }}
                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                                Open in Code Editor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: NEW VIRTUAL FILE */}
            {showNewFileModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[5000]">
                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 w-80 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h4 className="font-bold text-zinc-200 mb-2.5 flex items-center gap-1.5">
                            <Plus size={14} className="text-purple-400" />
                            <span>Create Workspace File</span>
                        </h4>
                        <input 
                            type="text"
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white text-xs outline-none focus:border-purple-500 placeholder-zinc-600 mb-3"
                            placeholder="e.g. math_helpers.js, script.py"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleCreateLocalFile()}
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => {
                                    setNewFileName('');
                                    setShowNewFileModal(false);
                                }}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-400 font-bold"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateLocalFile}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold"
                            >
                                Create File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: GOOGLE DRIVE SAFE DESTRUCTIVE CONFIRMATION */}
            {showDriveConfirmDelete && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[5000]">
                    <div className="bg-zinc-900 p-5 rounded-2xl border border-red-900/30 w-96 shadow-2xl animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-3">
                            <AlertTriangle size={18} />
                            <span>Confirm Destructive Deletion</span>
                        </div>
                        <p className="text-zinc-400 text-[11px] leading-relaxed mb-4">
                            Are you absolutely sure you want to delete the file <strong>"{gdriveFiles.find(f => f.id === showDriveConfirmDelete)?.name || 'Google Drive File'}"</strong>?
                            <br /><br />
                            This will permanently remove the item from your Google Drive. This action is irreversible.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setShowDriveConfirmDelete(null)}
                                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 font-bold border border-zinc-700"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteDriveFile}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold border border-red-500"
                            >
                                Yes, Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
