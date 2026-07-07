import React, { useState } from 'react';
import { Cpu, Terminal, Zap, Code2, Plus, Play, Check } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { Type } from '@google/genai';

export const FunctionCallKitchenApp: React.FC = () => {
    const [userPrompt, setUserPrompt] = useState('Get the weather in Tokyo and set a reminder for 5pm to check it.');
    const [toolsDef, setToolsDef] = useState<string>(
        `[\n  {\n    "name": "get_weather",\n    "description": "Get current weather for a location",\n    "parameters": {\n      "type": "object",\n      "properties": {\n        "location": { "type": "string" }\n      }\n    }\n  },\n  {\n    "name": "set_reminder",\n    "description": "Set a reminder",\n    "parameters": {\n      "type": "object",\n      "properties": {\n        "time": { "type": "string" },\n        "task": { "type": "string" }\n      }\n    }\n  }\n]`
    );
    const [output, setOutput] = useState('// Function call output will appear here');
    const [isRunning, setIsRunning] = useState(false);

    const handleRun = async () => {
        if (!userPrompt.trim() || !toolsDef.trim()) return;
        setIsRunning(true);
        setOutput('// Parsing tool definitions...\n// Requesting model inference...');
        
        try {
            let parsedTools;
            try {
                const rawTools = JSON.parse(toolsDef);
                // Convert JSON representation to GenAI Tool object
                parsedTools = [{
                    functionDeclarations: rawTools.map((t: any) => ({
                        name: t.name,
                        description: t.description,
                        parameters: {
                            type: t.parameters?.type === 'object' ? Type.OBJECT : Type.STRING,
                            properties: Object.fromEntries(
                                Object.entries(t.parameters?.properties || {}).map(([k, v]: [string, any]) => [
                                    k, { type: v.type === 'string' ? Type.STRING : v.type === 'number' ? Type.NUMBER : Type.BOOLEAN }
                                ])
                            )
                        }
                    }))
                }];
            } catch (err) {
                throw new Error("Invalid Tool JSON definition");
            }

            const ai = getAiClient();
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: userPrompt,
                tools: parsedTools,
                config: { temperature: 0.1 }
            });

            // The SDK handles function calls differently in the response
            if (response.functionCalls && response.functionCalls.length > 0) {
                const calls = response.functionCalls.map(call => ({
                    function: call.name,
                    arguments: call.args
                }));
                setOutput(JSON.stringify({
                    status: 'success',
                    reason: 'tool_calls',
                    calls: calls,
                    text: response.text || null
                }, null, 2));
            } else {
                setOutput(JSON.stringify({
                    status: 'success',
                    reason: 'stop',
                    text: response.text
                }, null, 2));
            }
        } catch (error: any) {
            setOutput(`// ERR: Execution failed.\n// ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 flex items-center justify-center">
            <div className="max-w-5xl mx-auto w-full h-[600px] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                
                <div className="bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <Cpu size={16} className="text-red-500" />
                        Function Call Kitchen
                    </h4>
                    <div className="flex gap-2">
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded font-mono border border-red-500/20">Strict Typing</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left: Configuration */}
                    <div className="w-full md:w-[45%] flex flex-col border-r border-zinc-800 bg-zinc-950/30">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase text-red-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <Terminal size={12} /> User Prompt Message
                                </label>
                                <textarea 
                                    value={userPrompt}
                                    onChange={e => setUserPrompt(e.target.value)}
                                    rows={3}
                                    className="w-full bg-[#0d1117] border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 focus:outline-none focus:border-red-500 font-sans resize-none"
                                />
                            </div>

                            <div className="space-y-2 flex-1 flex flex-col">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-mono uppercase text-amber-500 font-bold tracking-wider flex items-center gap-1.5">
                                        <Code2 size={12} /> Tools Schema Definition (JSON)
                                    </label>
                                </div>
                                <textarea 
                                    value={toolsDef}
                                    onChange={e => setToolsDef(e.target.value)}
                                    className="w-full flex-1 bg-[#0d1117] border border-zinc-800 rounded-xl p-3 text-xs text-amber-200 focus:outline-none focus:border-amber-500 font-mono resize-none leading-relaxed"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                            <button 
                                onClick={handleRun}
                                disabled={isRunning || !userPrompt || !toolsDef}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all"
                            >
                                {isRunning ? <Zap className="animate-spin" size={16} /> : <Play size={16} fill="currentColor" />}
                                <span>{isRunning ? 'Executing Inference...' : 'Run Function Call'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Right: Output */}
                    <div className="w-full md:w-[55%] bg-[#0d1117] flex flex-col relative">
                        <div className="bg-[#161b22] border-b border-zinc-800 p-3 px-4 flex items-center justify-between">
                            <span className="text-xs font-mono text-zinc-400 font-bold">Execution Output</span>
                        </div>
                        <pre className="flex-1 p-5 overflow-auto font-mono text-xs text-zinc-300 whitespace-pre leading-relaxed">
                            {output}
                        </pre>
                    </div>
                </div>

            </div>
        </div>
    );
};
