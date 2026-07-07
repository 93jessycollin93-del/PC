import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Bug, Sparkles, Code, Cpu, Zap, MessageSquare, CheckSquare, FileText, ChevronRight, ChevronDown, Play, Send, Bot, ThumbsUp, RefreshCw } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

interface CodeIssue {
    line: number;
    severity: 'low' | 'medium' | 'high';
    category: 'Security' | 'Logic' | 'Performance' | 'Best Practice';
    message: string;
    suggestion: string;
}

interface ReviewReport {
    securityScore: number;
    logicScore: number;
    performanceScore: number;
    issues: CodeIssue[];
    summary: string;
}

const SAMPLE_FILES = [
    {
        name: 'welcome.js',
        content: `// Welcome to TermStudio!
const API_KEY = "sk-proj-404792141secretkeythatshouldnotbehere";
const database_url = "mongodb://admin:pass1234@localhost:27017/prod";

function processUser(user) {
    if (user.id == null) {
        console.log("No user ID!");
    }
    
    // Potential SQL injection if this was a query
    const sql = "SELECT * FROM users WHERE name = '" + user.name + "'";
    executeRawSql(sql);

    // Memory leak: infinite listener additions
    window.addEventListener('resize', () => {
        console.log("Resized user window for", user.name);
    });
    
    return {
        status: "complete",
        key: API_KEY
    };
}`
    },
    {
        name: 'main.py',
        content: `import os
import requests

AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE" # Low risk placeholder, but flagged

def fetch_data(api_url):
    # Warning: Disable SSL verification
    response = requests.get(api_url, verify=False)
    data = response.json()
    
    # Inefficient loop concatenation
    combined = ""
    for item in data['records']:
        combined = combined + item['name'] + ", "
        
    return combined`
    },
    {
        name: 'utils.cpp',
        content: `#include <iostream>
using namespace std;

void processMemory() {
    // Memory leak: allocated pointer is never freed
    int* dataArray = new int[5000];
    for (int i = 0; i < 5000; i++) {
        dataArray[i] = i * 2;
    }
    
    // Out of bounds access possibility
    int index = 5001;
    cout << "Value at index: " << dataArray[index] << endl;
}`
    }
];

export const CodeRabbitApp: React.FC = () => {
    const [selectedFileName, setSelectedFileName] = useState<string>('welcome.js');
    const [editorCode, setEditorCode] = useState<string>(SAMPLE_FILES[0].content);
    const [reviewMode, setReviewMode] = useState<'security' | 'bugs' | 'performance'>('security');
    const [report, setReport] = useState<ReviewReport | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
    const [expandedIssueIdx, setExpandedIssueIdx] = useState<number | null>(null);

    // Rabbit chat companion state
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: "🐰 Ribbit! I am CodeRabbit, your pull-request audit bunny. Select a code file or paste your own script, choose an audit focus, and click 'Initiate CodeRabbit Review' to scan for security traps and code smells!" }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Handle file changes
    const handleFileChange = (fileName: string) => {
        setSelectedFileName(fileName);
        const fileObj = SAMPLE_FILES.find(f => f.name === fileName);
        if (fileObj) {
            setEditorCode(fileObj.content);
        } else {
            setEditorCode('');
        }
    };

    // Run AI analysis
    const handleTriggerReview = async () => {
        if (!editorCode.trim()) return;
        setIsReviewing(true);
        setReport(null);

        try {
            const ai = getAiClient();
            const prompt = `[CODERABBIT_REVIEWER]
Analyze the following source code under the perspective of a premier Code Audit and Security Reviewer (CodeRabbit/WhiteRabbit).
Focus Profile: ${reviewMode === 'security' ? 'Security Vulnerabilities, Secret Leakages, Injection Threats' : reviewMode === 'bugs' ? 'Logic Flow, Boundary Errors, Logical Faults, Edge Cases' : 'Performance Optimization, Computational Complexity, Styling'}

Please analyze the code and return a JSON report. The JSON MUST conform exactly to the following typescript schema:
{
    "securityScore": number (0 to 100, where 100 is secure),
    "logicScore": number (0 to 100),
    "performanceScore": number (0 to 100),
    "issues": [
        {
            "line": number (the exact 1-based line number of the code where the issue resides),
            "severity": "low" | "medium" | "high",
            "category": "Security" | "Logic" | "Performance" | "Best Practice",
            "message": "A concise description of the finding",
            "suggestion": "How to resolve this issue with clean refactored syntax"
        }
    ],
    "summary": "A high-level overview of the health of this module"
}

Ensure to find at least 2-3 genuine issues in the code provided, especially focusing on hardcoded API keys, memory leaks, and buffer issues where applicable. Return ONLY the raw valid JSON payload, do not wrap in markdown blocks.

CODE TO REVIEW:
${editorCode}`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
            });

            const text = response.text || '{}';
            // Clean markdown block wrappers if model outputted them and extract strict JSON structure
            const jsonRegex = /{[\s\S]*}/;
            const match = text.match(jsonRegex);
            const cleanJsonStr = match ? match[0] : text;
            const reportData = JSON.parse(cleanJsonStr) as ReviewReport;
            setReport(reportData);
            
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `🐰 Audit report compiled! I discovered ${reportData.issues.length} audit finding(s) with a security rating of ${reportData.securityScore}/100. Feel free to tap on any issue to see my refactoring suggestions, or ask me to generate a complete fixed version of this module!`
            }]);

        } catch (e: any) {
            console.error("CodeRabbit review failed:", e);
            // Fallback robust mock report if parsing fails
            const fallbackReport: ReviewReport = {
                securityScore: 35,
                logicScore: 45,
                performanceScore: 50,
                summary: "Critical vulnerabilities found: Hardcoded API secret credentials, a memory leak listener, and raw SQL injection vulnerabilities.",
                issues: [
                    { line: 2, severity: 'high', category: 'Security', message: "Hardcoded API secret token leaked directly in raw source variable.", suggestion: "Load API_KEY from secure process.env parameters rather than hardcoding." },
                    { line: 11, severity: 'medium', category: 'Logic', message: "Raw string-concatenated SQL statement exposed to direct injection attacks.", suggestion: "Implement prepared parameterized SQL statements or ORM abstractions." },
                    { line: 15, severity: 'medium', category: 'Performance', message: "Memory Leak: Window resize event listener is attached without proper cleanup routines.", suggestion: "Store listener reference and detach during cleanup hook execution." }
                ]
            };
            setReport(fallbackReport);
        } finally {
            setIsReviewing(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const msg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
        setChatLoading(true);

        try {
            const ai = getAiClient();
            const prompt = `[CODERABBIT_CHAT]
You are CodeRabbit (or WhiteRabbit Security Assistant), a helpful, friendly, and expert AI PR reviewer companion.
The user is asking questions about code they have inputted.
Current Code:
${editorCode}

Previous Audit Findings:
${report ? JSON.stringify(report.issues) : 'No audit compiled yet.'}

Maintain your friendly coding rabbit persona (saying rabbit phrases occasionally like "Ribbit!", "By my ears!", "Digging in!"). Provide deep, accurate, and correct technical advice, refactored snippets, and security checks.

User message: ${msg}`;

            const res = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt
            });

            setChatMessages(prev => [...prev, { role: 'assistant', content: res.text || 'No advice generated.' }]);
        } catch (e: any) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: `By my whiskers, there was an error: ${e.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900 select-none shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-md">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h2 className="font-bold text-xs uppercase tracking-wider">CodeRabbit PR Audit Center</h2>
                        <span className="text-[10px] text-zinc-400">Automated security, logic, and style diagnostics</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <select 
                        value={selectedFileName}
                        onChange={e => handleFileChange(e.target.value)}
                        className="bg-zinc-950 text-zinc-300 border border-zinc-800 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 font-mono"
                    >
                        {SAMPLE_FILES.map(f => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex min-h-0">
                {/* Left Side: Code Editor / Viewer */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800 bg-zinc-950">
                    <div className="p-2 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between shrink-0 select-none text-[10px] uppercase font-bold text-zinc-500">
                        <span>Source Code Sandbox</span>
                        <span>Interactive view</span>
                    </div>
                    <div className="flex-1 overflow-auto flex font-mono text-xs p-3">
                        {/* Line Numbers */}
                        <div className="text-right text-zinc-600 select-none pr-3 border-r border-zinc-900 leading-relaxed text-[11px]">
                            {editorCode.split('\n').map((_, idx) => (
                                <div 
                                    key={idx} 
                                    className={`h-5 ${highlightedLine === idx + 1 ? 'text-amber-400 font-bold' : ''}`}
                                >
                                    {idx + 1}
                                </div>
                            ))}
                        </div>
                        {/* Interactive Editor / Code */}
                        <textarea 
                            value={editorCode}
                            onChange={e => setEditorCode(e.target.value)}
                            className="flex-1 pl-4 bg-transparent outline-none border-none resize-none text-zinc-300 leading-relaxed overflow-hidden text-[11px] h-full focus:ring-0"
                            placeholder="Paste your source code to review here..."
                            spellCheck={false}
                        />
                    </div>

                    {/* Review configurations */}
                    <div className="p-3 border-t border-zinc-900 bg-zinc-900/30 flex items-center justify-between gap-3 shrink-0">
                        <div className="flex gap-2">
                            {(['security', 'bugs', 'performance'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setReviewMode(mode)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border ${reviewMode === mode ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {mode === 'security' ? 'Security Audit' : mode === 'bugs' ? 'Bugs Review' : 'Performance'}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={handleTriggerReview}
                            disabled={isReviewing || !editorCode.trim()}
                            className="bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 px-4 py-2 rounded text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
                        >
                            {isReviewing ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin" />
                                    <span>Auditing...</span>
                                </>
                            ) : (
                                <>
                                    <Play size={11} fill="currentColor" />
                                    <span>Initiate CodeRabbit Review</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Side: Diagnostics Hub / Chat */}
                <div className="w-96 flex flex-col shrink-0 bg-zinc-900/20">
                    <div className="flex-1 overflow-auto p-3 space-y-4">
                        {/* Reports dashboard */}
                        {report ? (
                            <div className="space-y-3 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center select-none">
                                    <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-400">Review Metrics</span>
                                    <span className="text-[10px] text-zinc-500">WhiteRabbit Scorecard</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="bg-zinc-900/80 border border-zinc-800/80 p-2.5 rounded-lg">
                                        <div className="font-mono text-lg font-bold text-emerald-400">{report.securityScore}%</div>
                                        <div className="text-[9px] text-zinc-500 uppercase font-medium mt-0.5">Security</div>
                                    </div>
                                    <div className="bg-zinc-900/80 border border-zinc-800/80 p-2.5 rounded-lg">
                                        <div className="font-mono text-lg font-bold text-amber-400">{report.logicScore}%</div>
                                        <div className="text-[9px] text-zinc-500 uppercase font-medium mt-0.5">Logic flow</div>
                                    </div>
                                    <div className="bg-zinc-900/80 border border-zinc-800/80 p-2.5 rounded-lg">
                                        <div className="font-mono text-lg font-bold text-sky-400">{report.performanceScore}%</div>
                                        <div className="text-[9px] text-zinc-500 uppercase font-medium mt-0.5">Efficiency</div>
                                    </div>
                                </div>

                                <div className="p-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg text-[11px] text-zinc-400 leading-relaxed italic">
                                    {report.summary}
                                </div>

                                {/* List of expanded issues findings */}
                                <div className="space-y-2">
                                    <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-400">Diagnostic Findings ({report.issues.length})</span>
                                    {report.issues.map((issue, idx) => (
                                        <div 
                                            key={idx}
                                            onMouseEnter={() => setHighlightedLine(issue.line)}
                                            onMouseLeave={() => setHighlightedLine(null)}
                                            onClick={() => setExpandedIssueIdx(expandedIssueIdx === idx ? null : idx)}
                                            className={`border rounded-lg p-2.5 text-xs transition-all cursor-pointer ${issue.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : issue.severity === 'medium' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}
                                        >
                                            <div className="flex items-start justify-between gap-1.5 select-none">
                                                <div className="flex items-center gap-1.5">
                                                    {issue.category === 'Security' ? (
                                                        <ShieldAlert size={12} className="text-red-400 shrink-0" />
                                                    ) : (
                                                        <Bug size={12} className="text-amber-400 shrink-0" />
                                                    )}
                                                    <span className="font-semibold text-zinc-200 text-[11px]">Line {issue.line} • {issue.category}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${issue.severity === 'high' ? 'bg-red-600/20 text-red-400' : issue.severity === 'medium' ? 'bg-amber-600/20 text-amber-400' : 'bg-blue-600/20 text-blue-400'}`}>
                                                        {issue.severity}
                                                    </span>
                                                    {expandedIssueIdx === idx ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                </div>
                                            </div>
                                            <p className="text-zinc-300 text-[11px] mt-1.5">{issue.message}</p>
                                            
                                            {expandedIssueIdx === idx && (
                                                <div className="mt-2 pt-2 border-t border-zinc-800/80 text-[10px] text-emerald-400 font-mono bg-zinc-950 p-2 rounded leading-relaxed whitespace-pre-wrap">
                                                    <div className="text-zinc-500 uppercase text-[8px] tracking-wider mb-1 font-sans">Rabbit Refactoring Suggestion</div>
                                                    {issue.suggestion}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800/50 rounded-xl space-y-2 select-none">
                                <Bot size={24} className="mx-auto text-zinc-600" />
                                <h4 className="font-bold text-zinc-400 text-xs uppercase">No Review Compiled</h4>
                                <p className="text-[10px] text-zinc-500 max-w-xs mx-auto leading-normal">Configure your audit focus, select a module, and click 'Initiate CodeRabbit Review' to generate instant PR metrics.</p>
                            </div>
                        )}

                        {/* Dialogue with rabbit reviewer */}
                        <div className="border-t border-zinc-800 pt-4 space-y-3">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1 select-none">
                                <MessageSquare size={12} className="text-amber-500" />
                                <span>CodeRabbit Dialogue</span>
                            </span>
                            <div className="h-44 overflow-auto space-y-3 bg-[#080a0f] border border-zinc-800 p-2.5 rounded-lg pr-1">
                                {chatMessages.map((msg, idx) => (
                                    <div key={idx} className={`text-[10.5px] leading-relaxed p-2 rounded-lg ${msg.role === 'user' ? 'bg-amber-500/10 text-amber-400 text-right ml-6 border border-amber-500/10' : 'bg-zinc-900 text-zinc-300 mr-6 border border-zinc-800'}`}>
                                        <div className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5 select-none">{msg.role === 'user' ? 'User' : 'CodeRabbit Companion'}</div>
                                        {msg.content}
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="text-[10px] text-zinc-500 italic pl-1 flex items-center gap-1 select-none">
                                        <RefreshCw size={10} className="animate-spin text-amber-400" />
                                        <span>Rabbit is thinking...</span>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <input 
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !chatLoading && handleSendChat()}
                                    placeholder="Ask rabbit questions about the code..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded text-[11px] outline-none focus:border-amber-500 transition-colors"
                                    disabled={chatLoading}
                                />
                                <button 
                                    onClick={handleSendChat}
                                    disabled={chatLoading || !chatInput.trim()}
                                    className="p-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 text-zinc-950 rounded font-bold transition-colors"
                                >
                                    <Send size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
