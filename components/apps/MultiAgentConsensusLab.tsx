import React, { useState, useEffect, useRef } from 'react';
import { 
    Cpu, Sparkles, Terminal, Settings, Copy, Check, Server, 
    Network, Zap, Sliders, ChevronRight, Play, Database, 
    AlertCircle, RefreshCw, BarChart2, Code, Trash2, HelpCircle 
} from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

interface AgentModel {
    id: string;
    name: string;
    provider: string;
    cost: string;
    speed: string;
    role: 'researcher' | 'coder' | 'general' | 'reasoning';
    isActive: boolean;
}

const DEFAULT_AGENTS: AgentModel[] = [
    { id: 'groq-llama', name: 'Llama 3.3 70B (Speculative)', provider: 'Groq', cost: '$0 (Free)', speed: '120 tok/s', role: 'general', isActive: true },
    { id: 'gemini-flash', name: 'Gemini 1.5 Flash', provider: 'Google AI Studio', cost: '$0 (Free)', speed: '85 tok/s', role: 'researcher', isActive: true },
    { id: 'together-llama-8b', name: 'Llama 3.1 8B Instruct', provider: 'Together AI', cost: '$0 (Free)', speed: '95 tok/s', role: 'general', isActive: true },
    { id: 'openrouter-qwen', name: 'Qwen 2.5 72B Instruct', provider: 'OpenRouter', cost: '$0 (Free)', speed: '45 tok/s', role: 'coder', isActive: true },
    { id: 'cloudflare-llama', name: 'Llama 3.2 3B', provider: 'Cloudflare Workers', cost: '$0 (Free)', speed: '110 tok/s', role: 'researcher', isActive: true },
    { id: 'cohere-command', name: 'Command R+', provider: 'Cohere', cost: '$0 (Free)', speed: '55 tok/s', role: 'researcher', isActive: true },
    { id: 'deepseek-v3', name: 'DeepSeek V3 (distilled)', provider: 'Together AI', cost: '$0 (Free)', speed: '75 tok/s', role: 'reasoning', isActive: true },
    { id: 'huggingface-phi', name: 'Phi-3.5 MoE', provider: 'HuggingFace', cost: '$0 (Free)', speed: '60 tok/s', role: 'coder', isActive: true }
];

export const MultiAgentConsensusLab: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'arena' | 'router' | 'provisioner' | 'code'>('arena');
    const [prompt, setPrompt] = useState('Why does dynamic context routing save money in multi-agent workflows?');
    const [isSimulating, setIsSimulating] = useState(false);
    const [selectedRole, setSelectedRole] = useState<'general' | 'coder' | 'researcher'>('general');
    
    // Model parallel run outputs
    const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
    const [modelOutputs, setModelOutputs] = useState<{
        id: string;
        name: string;
        provider: string;
        response: string;
        latency: number;
        status: 'pending' | 'success' | 'failed';
        score?: number;
        isWinner?: boolean;
    }[]>([]);
    const [judgeVerdict, setJudgeVerdict] = useState<string>('');
    const [winningModelId, setWinningModelId] = useState<string>('');

    // Dynamic Router simulation state
    const [routerInput, setRouterInput] = useState('Build a fast route controller');
    const [estTokens, setEstTokens] = useState(0);
    const [selectedBucket, setSelectedBucket] = useState<'tiny' | 'medium' | 'large'>('tiny');
    const [bucketCtx, setBucketCtx] = useState(16);
    const [bucketMaxTokens, setBucketMaxTokens] = useState(4);
    const [bucketSystemNote, setBucketSystemNote] = useState('Answer in 1-3 words max.');

    // Provisioner State
    const [vmType, setVmType] = useState<'cpu' | 'l4'>('l4');
    const [instanceName, setInstanceName] = useState('agent-brain-l4');
    const [selectedModels, setSelectedModels] = useState<string[]>(['llama3.1:8b', 'phi3:3.8b']);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    // Keep track of characters & tokens
    useEffect(() => {
        const est = Math.ceil(routerInput.length / 3);
        setEstTokens(est);
        if (est < 12) {
            setSelectedBucket('tiny');
            setBucketCtx(16);
            setBucketMaxTokens(4);
            setBucketSystemNote("Answer in 1-3 words max.");
        } else if (est < 50) {
            setSelectedBucket('medium');
            setBucketCtx(64);
            setBucketMaxTokens(40);
            setBucketSystemNote("Answer in 1 sentence max.");
        } else {
            setSelectedBucket('large');
            setBucketCtx(128);
            setBucketMaxTokens(100);
            setBucketSystemNote("Be concise. Max 2 sentences.");
        }
    }, [routerInput]);

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStates(prev => ({ ...prev, [id]: true }));
        setTimeout(() => {
            setCopiedStates(prev => ({ ...prev, [id]: false }));
        }, 2000);
    };

    const runConsensusSimulation = async () => {
        if (!prompt.trim()) return;
        setIsSimulating(true);
        setSimulationLogs([]);
        setModelOutputs([]);
        setJudgeVerdict('');
        setWinningModelId('');

        // Step 1: Initialize Logs
        const appendLog = (msg: string) => setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        
        appendLog(`🚀 Initiating Multi-Agent Consensus Arena run...`);
        appendLog(`🔍 Analyzing prompt length: ${prompt.length} chars (~${Math.ceil(prompt.length / 3.5)} tokens).`);
        
        // Setup initial empty states for all active models
        const activeModels = DEFAULT_AGENTS.filter(m => m.isActive);
        const initialOutputs = activeModels.map(m => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
            response: '',
            latency: 0,
            status: 'pending' as const
        }));
        setModelOutputs(initialOutputs);

        await new Promise(r => setTimeout(r, 400));
        appendLog(`⚡ Spinning up 8 provider instances concurrently inside free-tier clusters...`);
        
        // Emulate API call or fetch actual Gemini mock parallel queries
        const runQuery = async (model: AgentModel, index: number) => {
            const start = Date.now();
            await new Promise(r => setTimeout(r, 600 + index * 200 + Math.random() * 500));
            
            try {
                const ai = getAiClient();
                const systemPrompt = `You are simulated inside a Multi-Agent Consensus sandbox. Act as the following LLM: ${model.name} by ${model.provider}. 
Role requirement: ${model.role === 'coder' ? 'Respond highly technically with focused syntax.' : model.role === 'reasoning' ? 'Think systematically.' : 'Provide a direct concise answer.'}
Prompt: ${prompt}`;

                const result = await ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: systemPrompt,
                    config: {
                        temperature: 0.7,
                        maxOutputTokens: 150
                    }
                });

                const end = Date.now();
                const latency = end - start;
                const text = result.text?.trim() || "No response yielded.";

                setModelOutputs(prev => prev.map(o => o.id === model.id ? {
                    ...o,
                    response: text,
                    latency,
                    status: 'success',
                    score: Math.floor(82 + Math.random() * 15)
                } : o));

                appendLog(`✅ ${model.provider} [${model.name}] completed execution in ${latency}ms.`);
            } catch (err: any) {
                setModelOutputs(prev => prev.map(o => o.id === model.id ? {
                    ...o,
                    response: `Simulation network error: ${err.message}`,
                    latency: Date.now() - start,
                    status: 'failed'
                } : o));
                appendLog(`❌ ${model.provider} [${model.name}] execution failed.`);
            }
        };

        // Fire all parallel executions
        await Promise.all(activeModels.map((m, idx) => runQuery(m, idx)));

        appendLog(`🗳️ All parallel nodes resolved. Initiating consensus scoring by Gemini Flash (Consensus Judge)...`);
        await new Promise(r => setTimeout(r, 800));

        // Use Gemini Flash to act as the master Judge, read all simulated agent answers, and pick/synthesize the ultimate response.
        try {
            const ai = getAiClient();
            const compiledAnswers = modelOutputs
                .filter(o => o.status === 'success')
                .map(o => `Provider: ${o.provider} (${o.name})\nAnswer:\n${o.response}\n---`)
                .join('\n\n');

            const judgePrompt = `You are the Master Consensus Judge. You have been fed the user's prompt: "${prompt}", along with 8 parallel free LLM responses:
${compiledAnswers}

Analyze which answer is the most accurate, balanced, complete, and contains the highest clarity/best technical syntax. 
Select one clear winner. Provide:
1. "Winner": Identify the Provider & Model that won.
2. "Consensus Synthesis": Give a polished, masterfully written, cohesive synthesis of the best points of the top responses.
3. "Brief Reasoning": 1-2 sentence explanation of why this model won.`;

            const judgeResult = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: judgePrompt,
                config: { temperature: 0.2 }
            });

            const verdict = judgeResult.text || "Consensus failed to converge.";
            setJudgeVerdict(verdict);

            // Determine winner from text
            const lowerVerdict = verdict.toLowerCase();
            const winningModel = activeModels.find(m => lowerVerdict.includes(m.provider.toLowerCase()) || lowerVerdict.includes(m.name.toLowerCase())) || activeModels[0];
            
            setWinningModelId(winningModel.id);
            setModelOutputs(prev => prev.map(o => o.id === winningModel.id ? { ...o, isWinner: true, score: 99 } : o));
            appendLog(`🏆 Consensus unified successfully! Winner chosen: ${winningModel.provider} (${winningModel.name}).`);
        } catch (err: any) {
            setJudgeVerdict(`Master Judge exception: ${err.message}`);
            appendLog(`⚠️ Consensus consolidation failed. Yielding raw votes list.`);
        } finally {
            setIsSimulating(false);
        }
    };

    // Code generators
    const routerCodeJS = `// ⚡ Multi-Model Dynamic Context & Budget Router
function routeQuery(userPrompt, modelId = 'llama3-8b-instruct') {
    // Rough token count mapping (3-4 characters per token)
    const estTokens = Math.ceil(userPrompt.length / 3);
    
    let n_ctx = 128;
    let max_new_tokens = 100;
    let system_note = "Be concise. Max 2 sentences.";
    
    if (estTokens < 12) {
        n_ctx = 16;
        max_new_tokens = 4;
        system_note = "Answer in 1-3 words max.";
    } else if (estTokens < 50) {
        n_ctx = 64;
        max_new_tokens = 40;
        system_note = "Answer in 1 sentence max.";
    }

    return {
        model: modelId,
        prompt: system_note + "\\n\\nUser: " + userPrompt + "\\nAssistant:",
        params: {
            n_ctx: n_ctx,
            max_tokens: max_new_tokens,
            temperature: 0.1,
            stop: ["User:", "\\n\\n"]
        },
        metadata: { est_prompt_tokens: estTokens, ctx_allocated: n_ctx }
    };
}`;

    const agentParallelJS = `// 🗳️ Multi-Agent 8-Model Parallel Consensus Core
const PROVIDERS = [
  { name: 'Groq', model: 'llama3-70b-8192', url: 'https://api.groq.com/openai/v1/chat/completions' },
  { name: 'Together', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', url: 'https://api.together.xyz/v1/chat/completions' },
  { name: 'OpenRouter', model: 'google/gemini-flash-1.5', url: 'https://openrouter.ai/api/v1/chat/completions' },
  { name: 'Cloudflare', model: '@cf/meta/llama-3-8b-instruct', url: 'https://api.cloudflare.com/client/v4/accounts/YOUR_ID/ai/run' }
];

async function runParallelAgents(userPrompt) {
  console.log("🚀 Dispersing prompt to parallel nodes...");
  
  const promises = PROVIDERS.map(async (provider) => {
    const start = Date.now();
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + process.env[provider.name.toUpperCase() + '_API_KEY'],
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 150
        })
      });
      const data = await response.json();
      return {
        provider: provider.name,
        text: data.choices[0].message.content,
        latency: Date.now() - start,
        success: true
      };
    } catch (err) {
      return { provider: provider.name, error: err.message, success: false };
    }
  });

  const results = await Promise.all(promises);
  
  // Feed all outputs to the Consensus Judge
  const judgeResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ 
        role: 'system', 
        content: 'Read all parallel answers. Synthesize the most accurate, balanced, and perfect consensus answer.' 
      }, { 
        role: 'user', 
        content: JSON.stringify(results) 
      }]
    })
  });
  
  return judgeResponse.json();
}`;

    const getGcpCommand = () => {
        if (vmType === 'cpu') {
            return `gcloud compute instances create ${instanceName} \\
  --machine-type=e2-standard-4 \\
  --image-family=ubuntu-2204-lts \\
  --image-project=ubuntu-os-cloud \\
  --metadata=startup-script='curl -fsSL https://ollama.com/install.sh | sh && ollama serve & sleep 5 && ${selectedModels.map(m => `ollama pull ${m}`).join(' && ')}'`;
        } else {
            return `gcloud compute instances create ${instanceName} \\
  --machine-type=g2-standard-4 \\
  --accelerator=type=nvidia-l4,count=1 \\
  --maintenance-policy=TERMINATE \\
  --image-family=ubuntu-2204-lts \\
  --image-project=ubuntu-os-cloud \\
  --metadata=startup-script='curl -fsSL https://ollama.com/install.sh | sh && ollama serve & sleep 5 && ${selectedModels.map(m => `ollama pull ${m}`).join(' && ')}'`;
        }
    };

    return (
        <div id="multi-agent-consensus-lab" className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800/80 overflow-hidden">
            {/* Top Navigation & Status */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/60 select-none shrink-0 gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg shadow-inner">
                        <Network size={18} className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="font-bold text-xs tracking-wider uppercase text-zinc-200">Multi-Agent Consensus Lab</h2>
                        <p className="text-[10px] text-zinc-400">8-Model Parallel Voting Engine & Budget-Friendly Dynamic Router Simulator</p>
                    </div>
                </div>
                
                {/* Sub-Tabs Control */}
                <div className="flex bg-zinc-950 p-0.5 border border-zinc-800 rounded-lg text-[11px] font-semibold w-full md:w-auto overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveSection('arena')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all ${activeSection === 'arena' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Zap size={12} />
                        Consensus Arena
                    </button>
                    <button 
                        onClick={() => setActiveSection('router')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all ${activeSection === 'router' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Sliders size={12} />
                        Dynamic Router
                    </button>
                    <button 
                        onClick={() => setActiveSection('provisioner')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all ${activeSection === 'provisioner' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Server size={12} />
                        Node Provisioner
                    </button>
                    <button 
                        onClick={() => setActiveSection('code')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all ${activeSection === 'code' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Code size={12} />
                        Blueprint Code
                    </button>
                </div>
            </div>

            {/* Main Application Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 select-text space-y-5">
                
                {activeSection === 'arena' && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                        {/* Prompt controller */}
                        <div className="xl:col-span-5 space-y-4">
                            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4.5 space-y-3.5">
                                <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles size={13} className="text-yellow-400" />
                                    Parallel Dispersion Controller
                                </h3>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    Disperse a single prompt across up to 8 free API nodes concurrently, score each weight path, and leverage a central Master Judge to reach high-fidelity consensus.
                                </p>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-zinc-400 font-bold font-mono">GLOBAL AGENT DISPERSION PROMPT</label>
                                    <textarea 
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        rows={4}
                                        placeholder="Type prompt to send to all models..."
                                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded font-mono text-xs text-zinc-300 outline-none focus:border-indigo-500 resize-none leading-relaxed"
                                    />
                                </div>

                                <button 
                                    onClick={runConsensusSimulation}
                                    disabled={isSimulating || !prompt.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs"
                                >
                                    <Play size={14} className={isSimulating ? 'animate-spin' : ''} />
                                    <span>{isSimulating ? 'Parallel Consensus Dispersing...' : 'Disperse to Parallel Agent Pool'}</span>
                                </button>
                            </div>

                            {/* Simulation logs console */}
                            <div className="bg-black border border-zinc-800/80 rounded-xl p-4 flex flex-col h-[220px]">
                                <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider block mb-2">Dispersion Telemetry Logs</span>
                                <div className="flex-1 overflow-auto font-mono text-[9.5px] text-zinc-400 space-y-1.5 pr-1 leading-relaxed">
                                    {simulationLogs.length === 0 ? (
                                        <span className="text-zinc-600 italic">Disperse prompt to spin up the cluster and view logs.</span>
                                    ) : (
                                        simulationLogs.map((log, idx) => (
                                            <div key={idx} className={log.includes('✅') ? 'text-emerald-400' : log.includes('🏆') ? 'text-yellow-400 font-bold' : log.includes('🚀') ? 'text-indigo-400' : 'text-zinc-500'}>
                                                {log}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Concurrent Response Blocks */}
                        <div className="xl:col-span-7 space-y-4">
                            <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-xl p-4">
                                <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider block mb-3">Concurrently Querying Pool</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {modelOutputs.length === 0 ? (
                                        DEFAULT_AGENTS.map(agent => (
                                            <div key={agent.id} className="bg-zinc-900/40 border border-zinc-800 p-3 rounded-lg flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-bold text-zinc-300">{agent.name}</div>
                                                    <div className="text-[9px] text-zinc-500">{agent.provider} • {agent.speed}</div>
                                                </div>
                                                <span className="text-[9px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">Idle</span>
                                            </div>
                                        ))
                                    ) : (
                                        modelOutputs.map(out => (
                                            <div key={out.id} className={`p-3 rounded-lg border transition-all ${
                                                out.isWinner 
                                                    ? 'bg-yellow-950/20 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.1)]' 
                                                    : out.status === 'success' 
                                                        ? 'bg-zinc-900/50 border-zinc-800' 
                                                        : out.status === 'failed'
                                                            ? 'bg-red-950/10 border-red-500/20'
                                                            : 'bg-zinc-900/20 border-zinc-800/40 animate-pulse'
                                            }`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div>
                                                        <div className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                                                            {out.name}
                                                            {out.isWinner && <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1 rounded border border-yellow-500/20">WINNER</span>}
                                                        </div>
                                                        <div className="text-[9px] text-zinc-500">{out.provider}</div>
                                                    </div>
                                                    <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded ${
                                                        out.status === 'success' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/10' :
                                                        out.status === 'failed' ? 'bg-red-950/40 text-red-400 border border-red-500/10' : 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/10'
                                                    }`}>
                                                        {out.status === 'success' ? `${out.latency}ms` : out.status === 'failed' ? 'Failed' : 'Sieving...'}
                                                    </span>
                                                </div>
                                                {out.response ? (
                                                    <p className="text-[10px] text-zinc-400 line-clamp-3 select-text bg-black/35 p-1.5 rounded font-mono border border-zinc-900">
                                                        {out.response}
                                                    </p>
                                                ) : (
                                                    <div className="h-10 bg-zinc-950/40 rounded flex items-center justify-center">
                                                        <span className="text-[9px] text-zinc-600 font-mono">waiting for concurrent stream...</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Consolidated Consensus Output */}
                            {judgeVerdict && (
                                <div className="bg-gradient-to-br from-indigo-950/30 via-purple-950/10 to-zinc-950 border border-indigo-500/30 rounded-xl p-5 shadow-xl select-text relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3">
                                        <button 
                                            onClick={() => handleCopy('consensus-output', judgeVerdict)}
                                            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                                            title="Copy Consensus"
                                        >
                                            {copiedStates['consensus-output'] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        </button>
                                    </div>

                                    <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                                        <Sparkles size={14} className="text-yellow-400" />
                                        Consensus Judge Verdict & Unified Response
                                    </h3>
                                    <div className="text-[11px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap bg-black/40 border border-zinc-900/60 p-4 rounded-lg shadow-inner max-h-[350px] overflow-y-auto">
                                        {judgeVerdict}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeSection === 'router' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start select-text">
                        {/* Controller Column */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4.5 space-y-4">
                                <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sliders size={13} className="text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
                                    Router Query Engine Simulator
                                </h3>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    Test how the dynamic router handles context token budgets on-the-fly. Enter some text and see how the token estimator allocates memory and limits response run-ons based on string density.
                                </p>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-zinc-400 font-bold font-mono">USER TRIAL PROMPT</label>
                                    <input 
                                        type="text"
                                        value={routerInput}
                                        onChange={e => setRouterInput(e.target.value)}
                                        placeholder="e.g. Build a fast API gateway"
                                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded font-mono text-xs text-zinc-300 outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                                        <span>Character Length:</span>
                                        <span className="text-indigo-400">{routerInput.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                                        <span>Estimated Token Count (~4 chars):</span>
                                        <span className="text-indigo-400 font-bold">{estTokens}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Code Snippet visualizer */}
                            <div className="bg-[#05070a] border border-zinc-900 rounded-xl p-4 select-all">
                                <div className="flex justify-between items-center mb-2.5">
                                    <span className="text-[9px] font-bold font-mono text-zinc-500 uppercase">Live Router Code Logic</span>
                                    <button 
                                        onClick={() => handleCopy('router-logic', routerCodeJS)}
                                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 transition-colors"
                                    >
                                        {copiedStates['router-logic'] ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                    </button>
                                </div>
                                <pre className="text-[9.5px] font-mono text-zinc-400 leading-relaxed overflow-x-auto whitespace-pre">
                                    {routerCodeJS}
                                </pre>
                            </div>
                        </div>

                        {/* Visual Bucket Mapping Column */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-xl p-4 space-y-4">
                                <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider block">Context Window Bucket Allocations</h3>
                                
                                <div className="space-y-3">
                                    {/* Tiny Bucket */}
                                    <div className={`p-4 rounded-xl border transition-all ${selectedBucket === 'tiny' ? 'bg-indigo-950/15 border-indigo-500 shadow-md shadow-indigo-500/5' : 'bg-zinc-900/30 border-zinc-800/60 opacity-60'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${selectedBucket === 'tiny' ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
                                                <span className="text-xs font-bold text-zinc-200">Tiny Context Bucket (&lt; 12 tokens)</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-indigo-400 font-bold">16 Context / 4 Max Tokens</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mb-2 font-mono">System Note: "Answer in 1-3 words max."</p>
                                        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 h-full transition-all" style={{ width: selectedBucket === 'tiny' ? '100%' : '0%' }}></div>
                                        </div>
                                    </div>

                                    {/* Medium Bucket */}
                                    <div className={`p-4 rounded-xl border transition-all ${selectedBucket === 'medium' ? 'bg-indigo-950/15 border-indigo-500 shadow-md shadow-indigo-500/5' : 'bg-zinc-900/30 border-zinc-800/60 opacity-60'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${selectedBucket === 'medium' ? 'bg-amber-400 animate-ping' : 'bg-zinc-600'}`} />
                                                <span className="text-xs font-bold text-zinc-200">Medium Context Bucket (&lt; 50 tokens)</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-indigo-400 font-bold">64 Context / 40 Max Tokens</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mb-2 font-mono">System Note: "Answer in 1 sentence max."</p>
                                        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full transition-all" style={{ width: selectedBucket === 'medium' ? '100%' : '0%' }}></div>
                                        </div>
                                    </div>

                                    {/* Large Bucket */}
                                    <div className={`p-4 rounded-xl border transition-all ${selectedBucket === 'large' ? 'bg-indigo-950/15 border-indigo-500 shadow-md shadow-indigo-500/5' : 'bg-zinc-900/30 border-zinc-800/60 opacity-60'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${selectedBucket === 'large' ? 'bg-indigo-400 animate-ping' : 'bg-zinc-600'}`} />
                                                <span className="text-xs font-bold text-zinc-200">Dense Context Bucket (&gt;= 50 tokens)</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-indigo-400 font-bold">128 Context / 100 Max Tokens</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mb-2 font-mono">System Note: "Be concise. Max 2 sentences."</p>
                                        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-indigo-500 h-full transition-all" style={{ width: selectedBucket === 'large' ? '100%' : '0%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Live simulation result */}
                            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-3.5">
                                <h4 className="text-xs font-bold text-zinc-300 font-mono uppercase">Estimated Router Dispatch Parameters</h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="bg-black/40 p-3 rounded border border-zinc-900">
                                        <div className="text-[10px] text-zinc-500 mb-0.5">ALLOCATED N_CTX</div>
                                        <span className="text-lg font-bold text-indigo-400 font-mono">{bucketCtx}</span>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded border border-zinc-900">
                                        <div className="text-[10px] text-zinc-500 mb-0.5">MAX OUTPUT TOKENS</div>
                                        <span className="text-lg font-bold text-indigo-400 font-mono">{bucketMaxTokens}</span>
                                    </div>
                                    <div className="col-span-2 bg-black/40 p-3 rounded border border-zinc-900">
                                        <div className="text-[10px] text-zinc-500 mb-1">SYSTEM CONTROLLER MODIFIER</div>
                                        <p className="font-mono text-zinc-300 text-[11px] leading-relaxed italic">"{bucketSystemNote}"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'provisioner' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start select-text">
                        {/* Instance configuration form */}
                        <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4.5 space-y-4">
                            <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Server size={13} className="text-yellow-400" />
                                GCP Compute Instance Configurer
                            </h3>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                                Customize VM options to stand up your own Ollama server. Provision local models onto a cheap CPU node or a dedicated high-performance L4 GPU node.
                            </p>

                            <div className="space-y-1.5">
                                <span className="text-[10px] text-zinc-400 font-bold font-mono">INSTANCE TYPE</span>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => { setVmType('cpu'); setInstanceName('agent-cpu'); }}
                                        className={`flex-1 py-2 rounded-lg font-semibold border text-xs text-center transition-all ${
                                            vmType === 'cpu' 
                                                ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                    >
                                        Cheap CPU (3B models)
                                    </button>
                                    <button 
                                        onClick={() => { setVmType('l4'); setInstanceName('agent-l4'); }}
                                        className={`flex-1 py-2 rounded-lg font-semibold border text-xs text-center transition-all ${
                                            vmType === 'l4' 
                                                ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                    >
                                        L4 GPU (8B Brains)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-zinc-400 font-bold font-mono">INSTANCE ID / NAME</label>
                                <input 
                                    type="text"
                                    value={instanceName}
                                    onChange={e => setInstanceName(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded font-mono text-xs text-zinc-300 outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[10px] text-zinc-400 font-bold font-mono">AUTO-PULL OLLAMA MODELS</span>
                                <div className="space-y-2 max-h-[140px] overflow-y-auto border border-zinc-800 p-2.5 rounded bg-zinc-950 text-xs">
                                    {['llama3.2:3b', 'llama3.1:8b', 'phi3:3.8b', 'qwen2.5:0.5b', 'gemma2:2b'].map(model => (
                                        <label key={model} className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white font-mono text-[11px]">
                                            <input 
                                                type="checkbox"
                                                checked={selectedModels.includes(model)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedModels(prev => [...prev, model]);
                                                    else setSelectedModels(prev => prev.filter(m => m !== model));
                                                }}
                                                className="rounded bg-zinc-900 border-zinc-800 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            {model}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* CLI Output Command Column */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-xl p-4.5 space-y-4 select-all">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">Ready-to-Run gcloud Provisioning Script</h3>
                                    <button 
                                        onClick={() => handleCopy('gcp-cli', getGcpCommand())}
                                        className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                                        title="Copy Command"
                                    >
                                        {copiedStates['gcp-cli'] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>

                                <div className="bg-[#05070a] border border-zinc-900 p-4 rounded-lg relative font-mono text-zinc-300 text-[10.5px] leading-relaxed overflow-x-auto whitespace-pre leading-normal">
                                    {getGcpCommand()}
                                </div>

                                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2.5 text-xs text-zinc-400">
                                    <h4 className="font-bold text-[10px] text-zinc-300 uppercase tracking-wider font-mono">Infrastructure Overview & Pricing</h4>
                                    <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                                        <div>
                                            <span className="text-zinc-500">Instance type:</span><br />
                                            <span className="text-indigo-400 font-bold">{vmType === 'cpu' ? 'e2-standard-4 (4 vCPU / 16 GB)' : 'g2-standard-4 (4 vCPU / 16 GB)'}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500">GPU accelerator:</span><br />
                                            <span className="text-indigo-400 font-bold">{vmType === 'cpu' ? 'None (CPU Core)' : 'NVIDIA L4 (24GB VRAM)'}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500">Estimated Cost:</span><br />
                                            <span className="text-emerald-400 font-bold">{vmType === 'cpu' ? '~$0.04 / hour' : '~$0.28 / hour'}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500">Recommended for:</span><br />
                                            <span className="text-indigo-400 font-bold">{vmType === 'cpu' ? 'Tiny 3B models & agents' : 'Heavier 8B-14B brains'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'code' && (
                    <div className="space-y-4 select-text">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Dynamic Router script */}
                            <div className="bg-[#05070a] border border-zinc-900 rounded-xl p-4.5 space-y-3">
                                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                                    <span className="text-xs font-bold text-zinc-300 font-mono flex items-center gap-1.5">
                                        <Code size={13} className="text-indigo-400" />
                                        Dynamic Context Router
                                    </span>
                                    <button 
                                        onClick={() => handleCopy('exp-router', routerCodeJS)}
                                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 transition-colors"
                                    >
                                        {copiedStates['exp-router'] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                                <pre className="text-[10px] font-mono text-zinc-400 leading-relaxed overflow-x-auto whitespace-pre">
                                    {routerCodeJS}
                                </pre>
                            </div>

                            {/* Parallel Agent script */}
                            <div className="bg-[#05070a] border border-zinc-900 rounded-xl p-4.5 space-y-3">
                                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                                    <span className="text-xs font-bold text-zinc-300 font-mono flex items-center gap-1.5">
                                        <Network size={13} className="text-indigo-400" />
                                        8-Model Parallel Voting
                                    </span>
                                    <button 
                                        onClick={() => handleCopy('exp-parallel', agentParallelJS)}
                                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 transition-colors"
                                    >
                                        {copiedStates['exp-parallel'] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                                <pre className="text-[10px] font-mono text-zinc-400 leading-relaxed overflow-x-auto whitespace-pre">
                                    {agentParallelJS}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
