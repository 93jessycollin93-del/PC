import React, { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, User, FileText, ChevronRight, Zap, RefreshCw, Bot, MessageSquare, Send } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

interface ResearchPaper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    abstract: string;
    url: string;
}

export const SemanticScholarApp: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<ResearchPaper[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPaper, setSelectedPaper] = useState<ResearchPaper | null>(null);
    const [summary, setSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);

    // Chat companion state
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: "🎓 Hello! I am your Semantic Scholar Research Assistant. Search for academic papers, and I will help you analyze, summarize, and explore related work!" }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsLoading(true);
        setResults([]);
        setSelectedPaper(null);
        setSummary('');

        try {
            const ai = getAiClient();
            const prompt = `[RESEARCH_SEARCH]
User is searching for: "${searchQuery}"
Simulate a Semantic Scholar search result. Return a JSON list of 3-5 relevant academic papers.
Schema: [ { "id": "string", "title": "string", "authors": ["string"], "year": number, "abstract": "string", "url": "string" } ]
Return ONLY the raw JSON.`;

            const res = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                tools: [{ googleSearch: {} }],
            });

            const text = res.text || '[]';
            const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const papers = JSON.parse(cleanJsonStr) as ResearchPaper[];
            setResults(papers);
        } catch (e) {
            console.error(e);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSummarize = async (paper: ResearchPaper) => {
        setSelectedPaper(paper);
        setIsSummarizing(true);
        setSummary('');

        try {
            const ai = getAiClient();
            const prompt = `[RESEARCH_SUMMARY]
Summarize this academic paper:
Title: ${paper.title}
Abstract: ${paper.abstract}

Focus on: 1. Core contribution, 2. Methodology, 3. Significance. Keep it concise.`;

            const res = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                tools: [{ googleSearch: {} }],
            });
            setSummary(res.text || 'Could not summarize.');
        } catch (e) {
            console.error(e);
        } finally {
            setIsSummarizing(false);
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
            const context = selectedPaper ? `Context: Analyzing paper "${selectedPaper.title}"` : 'No paper selected.';
            const prompt = `[RESEARCH_CHAT]
You are a Research Assistant. ${context}. User message: ${msg}`;
            
            const res = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                tools: [{ googleSearch: {} }]
            });

            setChatMessages(prev => [...prev, { role: 'assistant', content: res.text || '...' }]);
        } catch (e: any) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-400" />
                    <h2 className="font-bold text-xs uppercase tracking-wider">Semantic Scholar AI</h2>
                </div>
                <div className="flex gap-2">
                    <input 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search research papers..."
                        className="bg-zinc-950 border border-zinc-800 px-3 py-1 rounded text-xs outline-none focus:border-blue-500 w-64"
                    />
                    <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs font-bold text-white flex items-center gap-1.5 transition-all">
                        {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                        Search
                    </button>
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                <div className="w-1/2 overflow-auto p-4 border-r border-zinc-800 space-y-3">
                    {results.map(paper => (
                        <div key={paper.id} className="border border-zinc-800 p-3 rounded-lg hover:border-zinc-700 cursor-pointer transition-all" onClick={() => handleSummarize(paper)}>
                            <h3 className="font-bold text-sm text-blue-400 mb-1">{paper.title}</h3>
                            <div className="text-xs text-zinc-500 mb-2">{paper.authors.join(', ')} • {paper.year}</div>
                            <p className="text-[11px] text-zinc-400 line-clamp-2">{paper.abstract}</p>
                        </div>
                    ))}
                </div>
                <div className="w-1/2 flex flex-col min-h-0 bg-zinc-900/20">
                    {selectedPaper ? (
                        <div className="flex-1 flex flex-col p-4 overflow-auto">
                            <h3 className="font-bold text-lg text-white mb-1">{selectedPaper.title}</h3>
                            <a href={selectedPaper.url} target="_blank" className="text-xs text-blue-400 underline mb-4">View on Semantic Scholar</a>
                            
                            <div className="flex-1 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 overflow-auto">
                                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Paper Summary</div>
                                {isSummarizing ? (
                                    <div className="text-xs text-zinc-500 animate-pulse">Analyzing paper...</div>
                                ) : (
                                    <div className="text-sm text-zinc-300 leading-relaxed">{summary}</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">Select a paper to analyze.</div>
                    )}
                    
                    <div className="border-t border-zinc-800 p-4 shrink-0">
                        <div className="h-40 overflow-auto mb-2 space-y-2 pr-1 font-mono text-[10px]">
                            {chatMessages.map((m, i) => (
                                <div key={i} className={m.role === 'user' ? 'text-blue-300' : 'text-zinc-400'}>
                                    <span className="font-bold">{m.role === 'user' ? 'You: ' : 'AI: '}</span>
                                    {m.content}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2">
                            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-xs" placeholder="Ask questions about this paper..." disabled={chatLoading} />
                            <button onClick={handleSendChat} className="bg-blue-600 p-2 rounded"><Send size={14} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
