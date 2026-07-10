import React, { useState, useEffect, useRef } from 'react';
import { Rabbit, Search, Loader2, BookOpen, Share2, Plus, Trash2, Network, FileText, ChevronRight, Download, Sparkles } from 'lucide-react';
import { getAiClient } from '../../lib/gemini';

interface PaperNode {
    id: string;
    title: string;
    authors: string[];
    year: number;
    abstract: string;
    citations: number;
    x: number;
    y: number;
    group: 'seed' | 'similar' | 'citation';
}

interface PaperConnection {
    source: string;
    target: string;
}

export const ResearchRabbitApp: React.FC = () => {
    const [query, setQuery] = useState('Attention Is All You Need');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPaper, setSelectedPaper] = useState<PaperNode | null>(null);
    const [papers, setPapers] = useState<PaperNode[]>([]);
    const [connections, setConnections] = useState<PaperConnection[]>([]);
    const [collection, setCollection] = useState<PaperNode[]>([]);
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const [reviewMarkdown, setReviewMarkdown] = useState('');
    const [tab, setTab] = useState<'graph' | 'collection' | 'review'>('graph');

    // Load initial demonstration set
    useEffect(() => {
        const demoPapers: PaperNode[] = [
            {
                id: '1',
                title: 'Attention Is All You Need',
                authors: ['A. Vaswani', 'N. Shazeer', 'N. Parmar', 'J. Uszkoreit'],
                year: 2017,
                abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
                citations: 112000,
                x: 300,
                y: 200,
                group: 'seed'
            },
            {
                id: '2',
                title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
                authors: ['J. Devlin', 'M. Chang', 'K. Lee', 'K. Toutanova'],
                year: 2018,
                abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers...',
                citations: 62000,
                x: 180,
                y: 120,
                group: 'similar'
            },
            {
                id: '3',
                title: 'Language Models are Few-Shot Learners (GPT-3)',
                authors: ['T. Brown', 'B. Mann', 'N. Ryder', 'M. Subbiah'],
                year: 2020,
                abstract: 'We demonstrate that scaling up language models greatly improves few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art...',
                citations: 34000,
                x: 420,
                y: 100,
                group: 'similar'
            },
            {
                id: '4',
                title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale (ViT)',
                authors: ['A. Dosovitskiy', 'L. Beyer', 'A. Kolesnikov'],
                year: 2020,
                abstract: 'While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited...',
                citations: 28000,
                x: 150,
                y: 280,
                group: 'citation'
            },
            {
                id: '5',
                title: 'LLaMA: Open and Efficient Foundation Language Models',
                authors: ['H. Touvron', 'T. Lavril', 'G. Izacard'],
                year: 2023,
                abstract: 'We introduce LLaMA, a collection of foundation language models ranging from 7B to 65B parameters...',
                citations: 8200,
                x: 450,
                y: 280,
                group: 'citation'
            }
        ];

        const demoConnections: PaperConnection[] = [
            { source: '1', target: '2' },
            { source: '1', target: '3' },
            { source: '1', target: '4' },
            { source: '1', target: '5' },
            { source: '2', target: '3' },
            { source: '3', target: '5' }
        ];

        setPapers(demoPapers);
        setConnections(demoConnections);
        setSelectedPaper(demoPapers[0]);
    }, []);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setReviewMarkdown('');
        try {
            const ai = getAiClient();
            const prompt = `You are an AI academic search engine. The user is researching the topic: "${query}".
Generate a detailed list of exactly 5 highly-relevant, realistic research papers related to this query.
One should be the central 'seed' paper, and the other 4 should be closely related papers that cite or are cited by it.
Provide your response as a valid JSON array of objects.

JSON format:
[
  {
    "id": "unique_string",
    "title": "Full Academic Title",
    "authors": ["Author 1", "Author 2"],
    "year": 2024,
    "abstract": "A compelling, accurate-sounding 2-3 sentence abstract of the research paper.",
    "citations": 1250,
    "group": "seed" or "similar" or "citation"
  }
]

Ensure the JSON is strictly valid, with no markdown formatting around it (do NOT wrap in \`\`\`json). Just return the raw JSON array.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
            });

            const text = res.text || '[]';
            const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed: any[] = JSON.parse(cleanJsonStr);

            // Lay out the nodes visually in a circular/star pattern
            const centers = [
                { x: 300, y: 200 }, // Center seed
                { x: 150, y: 110 },
                { x: 450, y: 110 },
                { x: 140, y: 290 },
                { x: 460, y: 290 }
            ];

            const nodes: PaperNode[] = parsed.map((p, idx) => ({
                ...p,
                x: centers[idx % centers.length].x,
                y: centers[idx % centers.length].y,
            }));

            // Generate structured links from center seed (index 0) to other papers, plus some secondary links
            const newConnections: PaperConnection[] = [
                { source: nodes[0].id, target: nodes[1].id },
                { source: nodes[0].id, target: nodes[2].id },
                { source: nodes[0].id, target: nodes[3].id },
                { source: nodes[0].id, target: nodes[4].id },
                { source: nodes[1].id, target: nodes[2].id },
                { source: nodes[3].id, target: nodes[4].id }
            ];

            setPapers(nodes);
            setConnections(newConnections);
            setSelectedPaper(nodes[0]);
        } catch (err) {
            console.error('Error generating ResearchRabbit network:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const addToCollection = (paper: PaperNode) => {
        if (!collection.some(item => item.id === paper.id)) {
            setCollection([...collection, paper]);
        }
    };

    const removeFromCollection = (id: string) => {
        setCollection(collection.filter(item => item.id !== id));
    };

    const generateLiteratureReview = async () => {
        if (collection.length === 0) return;
        setIsGeneratingReview(true);
        setTab('review');
        try {
            const ai = getAiClient();
            const papersDesc = collection.map((p, index) => 
                `[${index + 1}] "${p.title}" by ${p.authors.join(', ')} (${p.year})\nAbstract: ${p.abstract}`
            ).join('\n\n');

            const prompt = `You are an AI research synthesist. Create a professional, highly informative Literature Review summarizing and connecting the following curated research papers:

${papersDesc}

Format the literature review in elegant GitHub-Flavored Markdown.
Include:
1. Executive Summary
2. Core Themes & Commonalities (how the papers build on or relate to each other)
3. Methodological Approaches
4. Key Innovations and Milestones
5. Future Frontiers & Open Questions

Ensure it reads like a high-quality academic synthesis.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
            });

            setReviewMarkdown(res.text || 'Unable to generate synthesis.');
        } catch (err) {
            console.error('Error generating literature review:', err);
            setReviewMarkdown('Failed to compile literature review. Please try again.');
        } finally {
            setIsGeneratingReview(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                    <Rabbit className="text-orange-500 animate-pulse" size={20} />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-orange-400">ResearchRabbit AI</span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search papers or research topics..."
                        className="bg-zinc-950 border border-zinc-800 text-xs px-3 py-1.5 rounded-md outline-none focus:border-orange-500 transition-colors w-64 text-zinc-200"
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-55 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                        Search Network
                    </button>
                </div>
            </div>

            {/* Sub-Header Navigation */}
            <div className="flex bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
                <button
                    onClick={() => setTab('graph')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${tab === 'graph' ? 'border-orange-500 text-orange-400 bg-orange-500/5' : 'border-transparent hover:text-zinc-200'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <Network size={13} />
                        Interactive Discovery Graph
                    </div>
                </button>
                <button
                    onClick={() => setTab('collection')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${tab === 'collection' ? 'border-orange-500 text-orange-400 bg-orange-500/5' : 'border-transparent hover:text-zinc-200'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <BookOpen size={13} />
                        My Collection ({collection.length})
                    </div>
                </button>
                <button
                    onClick={() => setTab('review')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${tab === 'review' ? 'border-orange-500 text-orange-400 bg-orange-500/5' : 'border-transparent hover:text-zinc-200'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <FileText size={13} />
                        AI Synthesis Brief
                    </div>
                </button>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex min-h-0 bg-zinc-950">
                {tab === 'graph' && (
                    <div className="flex-1 flex min-h-0">
                        {/* Interactive Graph Area */}
                        <div className="flex-1 relative flex flex-col border-r border-zinc-800 bg-zinc-900/10">
                            <div className="absolute top-3 left-3 bg-zinc-950/85 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[11px] font-mono z-10 flex gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
                                    <span>Seed Paper</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                                    <span>Similar Work</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                                    <span>Co-Citations</span>
                                </div>
                            </div>

                            <svg className="w-full h-full select-none" viewBox="0 0 600 400">
                                <defs>
                                    <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3f3f46" />
                                    </marker>
                                </defs>

                                {/* Connections */}
                                {connections.map((conn, idx) => {
                                    const sourceNode = papers.find(p => p.id === conn.source);
                                    const targetNode = papers.find(p => p.id === conn.target);
                                    if (!sourceNode || !targetNode) return null;
                                    const isHighlighted = (selectedPaper?.id === sourceNode.id || selectedPaper?.id === targetNode.id);
                                    return (
                                        <line
                                            key={idx}
                                            x1={sourceNode.x}
                                            y1={sourceNode.y}
                                            x2={targetNode.x}
                                            y2={targetNode.y}
                                            stroke={isHighlighted ? '#f97316' : '#27272a'}
                                            strokeWidth={isHighlighted ? 2 : 1}
                                            strokeDasharray={isHighlighted ? '0' : '4 4'}
                                        />
                                    );
                                })}

                                {/* Nodes */}
                                {papers.map(p => {
                                    const isSelected = selectedPaper?.id === p.id;
                                    const nodeColor = p.group === 'seed' ? 'fill-orange-500' : p.group === 'similar' ? 'fill-blue-500' : 'fill-teal-500';
                                    const pulseColor = p.group === 'seed' ? 'stroke-orange-500/30' : p.group === 'similar' ? 'stroke-blue-500/30' : 'stroke-teal-500/30';

                                    return (
                                        <g key={p.id} className="cursor-pointer" onClick={() => setSelectedPaper(p)}>
                                            {isSelected && (
                                                <circle cx={p.x} cy={p.y} r={16} className={`${pulseColor} animate-ping`} strokeWidth={3} fill="none" />
                                            )}
                                            <circle
                                                cx={p.x}
                                                cy={p.y}
                                                r={isSelected ? 10 : 7}
                                                className={`${nodeColor} hover:opacity-80 transition-all`}
                                            />
                                            <text
                                                x={p.x}
                                                y={p.y + 22}
                                                textAnchor="middle"
                                                className="fill-zinc-400 font-mono text-[9px] pointer-events-none select-none font-bold"
                                            >
                                                {p.authors[0]} ({p.year})
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        {/* Node Detail Side Panel */}
                        <div className="w-80 flex flex-col min-h-0 bg-zinc-900/40 p-4 overflow-auto shrink-0">
                            {selectedPaper ? (
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div>
                                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${selectedPaper.group === 'seed' ? 'bg-orange-500/10 text-orange-400' : selectedPaper.group === 'similar' ? 'bg-blue-500/10 text-blue-400' : 'bg-teal-500/10 text-teal-400'}`}>
                                            {selectedPaper.group === 'seed' ? 'Seed Paper' : selectedPaper.group === 'similar' ? 'Similar Work' : 'Cited Connection'}
                                        </span>
                                        <h3 className="font-bold text-sm text-zinc-100 mt-2 leading-snug">{selectedPaper.title}</h3>
                                        <p className="text-xs text-zinc-400 mt-1">{selectedPaper.authors.join(', ')}</p>
                                        <p className="text-[11px] font-mono text-zinc-500 mt-1">Published: {selectedPaper.year} • Citations: {selectedPaper.citations.toLocaleString()}</p>
                                    </div>

                                    <div className="flex-1 border-t border-zinc-800 pt-3">
                                        <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-1.5">Abstract</h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed max-h-48 overflow-auto">{selectedPaper.abstract}</p>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-zinc-800">
                                        <button
                                            onClick={() => addToCollection(selectedPaper)}
                                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-bold py-2 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Plus size={14} />
                                            Add to Collection
                                        </button>
                                        <button
                                            onClick={() => {
                                                setQuery(selectedPaper.title);
                                                handleSearch();
                                            }}
                                            className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs font-mono font-bold py-2 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Network size={14} />
                                            Explode this Seed
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600">
                                    <BookOpen size={24} className="mb-2 text-zinc-700" />
                                    <p className="text-xs">Click a node to view metadata and AI intelligence.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'collection' && (
                    <div className="flex-1 p-6 overflow-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-100">My Curated Research Collection</h3>
                                <p className="text-xs text-zinc-400">Assemble papers to auto-compile a unified literature synthesis and citation mapping.</p>
                            </div>
                            {collection.length > 0 && (
                                <button
                                    onClick={generateLiteratureReview}
                                    className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Sparkles size={14} />
                                    Generate AI Synthesis Brief
                                </button>
                            )}
                        </div>

                        {collection.length === 0 ? (
                            <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 max-w-lg mx-auto mt-8">
                                <Rabbit size={32} className="mx-auto mb-3 text-zinc-700" />
                                <h4 className="font-bold text-sm text-zinc-300">Your collection is empty</h4>
                                <p className="text-xs mt-1">Explore the interactive discovery graph and click "Add to Collection" on highly-relevant papers.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {collection.map(p => (
                                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
                                        <div>
                                            <div className="flex items-start justify-between gap-4">
                                                <h4 className="font-bold text-sm text-zinc-200 leading-snug">{p.title}</h4>
                                                <button
                                                    onClick={() => removeFromCollection(p.id)}
                                                    className="text-zinc-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-1">{p.authors.join(', ')}</p>
                                            <p className="text-[11px] font-mono text-zinc-500 mt-1">Year: {p.year} • Citations: {p.citations.toLocaleString()}</p>
                                            <p className="text-xs text-zinc-300 mt-3 leading-relaxed line-clamp-3">{p.abstract}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'review' && (
                    <div className="flex-1 flex flex-col min-h-0 p-6">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-100">AI Literature Synthesis Brief</h3>
                                <p className="text-xs text-zinc-400">Cohesive evaluation of your curated research papers compiled via Gemini.</p>
                            </div>
                            {collection.length > 0 && (
                                <button
                                    onClick={generateLiteratureReview}
                                    disabled={isGeneratingReview}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-55 cursor-pointer"
                                >
                                    <Plus size={13} />
                                    Regenerate Report
                                </button>
                            )}
                        </div>

                        <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 overflow-auto">
                            {isGeneratingReview ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                    <Loader2 size={24} className="animate-spin text-orange-500 mb-2" />
                                    <p className="text-xs font-mono">Synthesizing contributions & mapping paradigms...</p>
                                </div>
                            ) : reviewMarkdown ? (
                                <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed space-y-4 font-sans">
                                    {reviewMarkdown.split('\n').map((line, idx) => {
                                        if (line.startsWith('# ')) return <h1 key={idx} className="text-xl font-bold text-orange-400 pt-4 pb-1 border-b border-zinc-800">{line.replace('# ', '')}</h1>;
                                        if (line.startsWith('## ')) return <h2 key={idx} className="text-lg font-bold text-zinc-200 pt-3 pb-1">{line.replace('## ', '')}</h2>;
                                        if (line.startsWith('### ')) return <h3 key={idx} className="text-sm font-bold text-zinc-300 pt-2">{line.replace('### ', '')}</h3>;
                                        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={idx} className="ml-4 list-disc text-xs">{line.substring(2)}</li>;
                                        if (/^\d+\.\s/.test(line)) return <li key={idx} className="ml-4 list-decimal text-xs">{line.replace(/^\d+\.\s/, '')}</li>;
                                        return <p key={idx} className="text-xs text-zinc-300 leading-relaxed">{line}</p>;
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center max-w-sm mx-auto">
                                    <FileText size={24} className="mb-2 text-zinc-700" />
                                    <p className="text-xs">Select "My Collection" tab, compile some papers, then hit "Generate AI Synthesis Brief".</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
