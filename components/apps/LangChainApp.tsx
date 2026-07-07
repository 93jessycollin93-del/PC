import React, { useState } from 'react';
import { Network, Plus, Trash2, Play, Terminal, Code, Settings, Sparkles, Loader2, Clipboard, Check, ChevronDown, CheckSquare } from 'lucide-react';
import { getAiClient } from '../../lib/gemini';

interface WorkflowNode {
    id: string;
    type: 'input' | 'prompt' | 'llm' | 'tool' | 'output';
    title: string;
    config: Record<string, string>;
}

export const LangChainApp: React.FC = () => {
    const [nodes, setNodes] = useState<WorkflowNode[]>([
        { id: '1', type: 'input', title: 'User Input Query', config: { variable: 'question', placeholder: 'Describe quantum entanglement in simple terms.' } },
        { id: '2', type: 'prompt', title: 'Prompt Template', config: { template: 'You are an elite research mentor. Given the query: {question}, explain it using a friendly, highly descriptive analogy appropriate for university undergraduates.' } },
        { id: '3', type: 'llm', title: 'LLM Model Core', config: { model: 'gemini-3.5-flash', temperature: '0.7', stream: 'true' } },
        { id: '4', type: 'tool', title: 'Google Search Tool', config: { enabled: 'true', max_results: '3' } },
        { id: '5', type: 'output', title: 'String Output Parser', config: { format: 'markdown' } }
    ]);

    const [testInput, setTestInput] = useState('How do neural networks learn?');
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationLog, setSimulationLog] = useState<string[]>([]);
    const [simulationOutput, setSimulationOutput] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [codeLanguage, setCodeLanguage] = useState<'python' | 'typescript'>('python');
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const addNode = (type: 'prompt' | 'llm' | 'tool' | 'output') => {
        const titles = {
            prompt: 'Prompt Template Block',
            llm: 'Custom LLM Node',
            tool: 'Dynamic Helper Tool',
            output: 'Custom Output Parser'
        };

        const configs = {
            prompt: { template: 'Explain the following topic: {topic}' },
            llm: { model: 'gemini-3.5-flash', temperature: '0.2' },
            tool: { name: 'Python Executer', enabled: 'true' },
            output: { format: 'json' }
        };

        const newNode: WorkflowNode = {
            id: Date.now().toString(),
            type,
            title: titles[type],
            config: configs[type]
        };
        setNodes([...nodes, newNode]);
    };

    const removeNode = (id: string) => {
        setNodes(nodes.filter(n => n.id !== id));
    };

    const updateNodeConfig = (id: string, key: string, value: string) => {
        setNodes(nodes.map(n => {
            if (n.id === id) {
                return { ...n, config: { ...n.config, [key]: value } };
            }
            return n;
        }));
    };

    const runSimulation = async () => {
        setIsSimulating(true);
        setSimulationLog([]);
        setSimulationOutput('');

        const log = (msg: string) => {
            setSimulationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        };

        try {
            log('Initializing LangChain Runnable Sequence...');
            await new Promise(r => setTimeout(r, 800));

            log(`Formatting inputs with variable: "${testInput}"`);
            const promptNode = nodes.find(n => n.type === 'prompt');
            const template = promptNode?.config.template || 'Explain: {topic}';
            const formattedPrompt = template.replace('{question}', testInput).replace('{topic}', testInput);
            log(`Formatted Prompt payload: "${formattedPrompt.substring(0, 50)}..."`);
            await new Promise(r => setTimeout(r, 1000));

            const toolNode = nodes.find(n => n.type === 'tool');
            if (toolNode && toolNode.config.enabled === 'true') {
                log(`Executing agentic search tool grounding matching context...`);
                await new Promise(r => setTimeout(r, 1200));
            }

            log('Querying generative core via LangChain expression language (LCEL)...');
            const ai = getAiClient();
            const prompt = `You are a LangChain Workflow simulation runner.
Below is the execution state of our chain:
- User Input: "${testInput}"
- Constructed Prompt Template: "${formattedPrompt}"
- Enabled Tools: ${toolNode ? 'Google Search' : 'None'}

Please execute this instructions chain and output the response. At the very top, give a 1-sentence analytical commentary explaining what you are doing, then follow with the synthesized output.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
            });

            log('Response streaming completed.');
            log('Parsing output using StringOutputParser...');
            setSimulationOutput(res.text || 'Simulated chain completed successfully.');
        } catch (e) {
            log('Error: Chain execution failed.');
            console.error(e);
        } finally {
            setIsSimulating(false);
        }
    };

    const handleGenerateCode = async (lang: 'python' | 'typescript') => {
        setIsGeneratingCode(true);
        setCodeLanguage(lang);
        try {
            const ai = getAiClient();
            const nodesStr = JSON.stringify(nodes, null, 2);
            const prompt = `You are an expert software architect. Given this LangChain flow description:
${nodesStr}

Generate a robust, production-ready, fully written ${lang === 'python' ? 'Python (using langchain_core / langchain_google_genai LCEL syntax)' : 'TypeScript (using @langchain/core LCEL syntax)'} script that builds and runs this workflow chain.
Include all correct module imports, prompt formatting, tool binding, and LLM configuration.

Return ONLY the code block. DO NOT write conversational intro/outro text.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
            });

            setGeneratedCode(res.text || '');
        } catch (e) {
            console.error(e);
            setGeneratedCode('# Error synthesizing LangChain implementation.');
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full flex bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Left side: Flowchart Visual Editor */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-800">
                {/* Visual Editor Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
                    <div className="flex items-center gap-2">
                        <Network className="text-emerald-400" size={18} />
                        <span className="font-mono font-bold text-xs uppercase tracking-wider text-emerald-400">LangChain LCEL Editor</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => addNode('prompt')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                            + Prompt Template
                        </button>
                        <button
                            onClick={() => addNode('llm')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                            + LLM Core
                        </button>
                        <button
                            onClick={() => addNode('tool')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                            + Tool Node
                        </button>
                    </div>
                </div>

                {/* Workflow Canvas (Linear Pipeline blocks with connection lines) */}
                <div className="flex-1 p-6 overflow-auto space-y-4 bg-zinc-900/10">
                    {nodes.map((node, index) => (
                        <div key={node.id} className="relative">
                            {index > 0 && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-zinc-800 flex items-center justify-center">
                                    <ChevronDown size={10} className="text-zinc-600 mt-2" />
                                </div>
                            )}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg hover:border-zinc-700 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${node.type === 'input' ? 'bg-blue-400' : node.type === 'prompt' ? 'bg-amber-400' : node.type === 'llm' ? 'bg-purple-400' : node.type === 'tool' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                        <h4 className="font-bold text-xs font-mono text-zinc-200">{node.title}</h4>
                                    </div>
                                    {node.type !== 'input' && node.type !== 'output' && (
                                        <button
                                            onClick={() => removeNode(node.id)}
                                            className="text-zinc-500 hover:text-red-400 p-1"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* Custom Config Inputs */}
                                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                                    {node.type === 'input' && (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={node.config.variable || ''}
                                                onChange={e => updateNodeConfig(node.id, 'variable', e.target.value)}
                                                placeholder="variable name"
                                                className="bg-zinc-950 border border-zinc-800 p-1 rounded font-mono text-[10px] text-zinc-300 w-24"
                                            />
                                            <span className="text-zinc-500 font-mono mt-0.5">Input Variable</span>
                                        </div>
                                    )}
                                    {node.type === 'prompt' && (
                                        <textarea
                                            value={node.config.template || ''}
                                            onChange={e => updateNodeConfig(node.id, 'template', e.target.value)}
                                            rows={2}
                                            placeholder="Prompt Template content..."
                                            className="bg-zinc-950 border border-zinc-800 p-2 rounded text-zinc-300 w-full outline-none focus:border-emerald-500 text-[11px]"
                                        />
                                    )}
                                    {node.type === 'llm' && (
                                        <div className="flex gap-4">
                                            <select
                                                value={node.config.model || 'gemini-3.5-flash'}
                                                onChange={e => updateNodeConfig(node.id, 'model', e.target.value)}
                                                className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded text-zinc-300 text-[10px] outline-none"
                                            >
                                                <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                                                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                                            </select>
                                            <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                                                <span>Temp:</span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="1"
                                                    value={node.config.temperature || '0.7'}
                                                    onChange={e => updateNodeConfig(node.id, 'temperature', e.target.value)}
                                                    className="bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded w-12 text-center"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {node.type === 'tool' && (
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-1.5 text-zinc-400 text-[11px] cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={node.config.enabled === 'true'}
                                                    onChange={e => updateNodeConfig(node.id, 'enabled', e.target.checked ? 'true' : 'false')}
                                                    className="rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500 bg-zinc-950"
                                                />
                                                <span>Enable Grounded Searches</span>
                                            </label>
                                        </div>
                                    )}
                                    {node.type === 'output' && (
                                        <span className="text-zinc-500 font-mono text-[10px]">Configured to output parsed structured Markdown blocks</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right side: Execution Simulator and Code Generator */}
            <div className="w-96 flex flex-col min-h-0 bg-zinc-900/40">
                {/* Control/Action Toggles */}
                <div className="flex border-b border-zinc-800 bg-zinc-900 shrink-0 text-xs">
                    <button
                        onClick={() => runSimulation()}
                        className="flex-1 py-2 px-3 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 border-r border-zinc-800 text-emerald-400 font-mono font-bold cursor-pointer"
                    >
                        <Play size={12} />
                        Run Simulator
                    </button>
                    <button
                        onClick={() => handleGenerateCode('python')}
                        className="flex-1 py-2 px-3 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 text-zinc-300 font-mono font-bold cursor-pointer"
                    >
                        <Code size={12} />
                        Gen Code
                    </button>
                </div>

                {/* Sub panels */}
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4 overflow-auto">
                    {/* Input Field for Simulator */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 shrink-0">
                        <label className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Simulator Test Input</label>
                        <input
                            type="text"
                            value={testInput}
                            onChange={e => setTestInput(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded w-full p-1.5 text-xs mt-1 outline-none focus:border-emerald-500 text-zinc-200"
                            placeholder="Input topic or query..."
                        />
                    </div>

                    {/* Simulation logs */}
                    {simulationLog.length > 0 && (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 h-48 flex flex-col min-h-0">
                            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold shrink-0 mb-1.5">Runtime Logs</span>
                            <div className="flex-1 overflow-auto font-mono text-[10px] text-zinc-400 space-y-1 pr-1">
                                {simulationLog.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Output Viewer / Code Generator */}
                    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
                            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold">
                                {generatedCode ? 'Generated LCEL Script' : 'Synthesized Output'}
                            </span>
                            {generatedCode && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleGenerateCode(codeLanguage === 'python' ? 'typescript' : 'python')}
                                        className="text-[10px] font-mono text-emerald-400 hover:underline cursor-pointer"
                                    >
                                        Switch to {codeLanguage === 'python' ? 'TypeScript' : 'Python'}
                                    </button>
                                    <button onClick={copyToClipboard} className="text-zinc-400 hover:text-zinc-200">
                                        {copied ? <Check size={12} className="text-green-400" /> : <Clipboard size={12} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 p-4 overflow-auto text-xs leading-relaxed text-zinc-300 font-mono">
                            {isSimulating ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                                    <Loader2 size={24} className="animate-spin text-emerald-500 mb-2" />
                                    <span>Simulating token propagation...</span>
                                </div>
                            ) : isGeneratingCode ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                                    <Loader2 size={24} className="animate-spin text-emerald-500 mb-2" />
                                    <span>Generating LCEL executable file...</span>
                                </div>
                            ) : generatedCode ? (
                                <pre className="text-[10px] text-emerald-400 whitespace-pre-wrap">{generatedCode}</pre>
                            ) : simulationOutput ? (
                                <div className="text-zinc-300 font-sans space-y-2">
                                    {simulationOutput.split('\n').map((para, i) => (
                                        <p key={i}>{para}</p>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                                    <Sparkles size={20} className="mb-2 text-zinc-700" />
                                    <p className="max-w-xs leading-relaxed text-[11px]">Hit "Run Simulator" or "Gen Code" above to check execution and compile code.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
