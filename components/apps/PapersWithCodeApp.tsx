import React, { useState, useEffect } from 'react';
import { Code2, Search, Loader2, GitFork, BookOpen, Star, Sparkles, ChevronRight, BarChart3, HelpCircle, Terminal, Clipboard, Check } from 'lucide-react';
import { getAiClient } from '../../lib/gemini';

interface MLPaper {
    id: string;
    title: string;
    abstract: string;
    authors: string[];
    year: number;
    stars: number;
    repo: string;
    framework: 'PyTorch' | 'JAX' | 'TensorFlow';
}

interface LeaderboardEntry {
    rank: number;
    model: string;
    score: string;
    params: string;
    extra: string;
}

export const PapersWithCodeApp: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('LoRA: Low-Rank Adaptation');
    const [papers, setPapers] = useState<MLPaper[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPaper, setSelectedPaper] = useState<MLPaper | null>(null);
    const [activeTab, setActiveTab] = useState<'papers' | 'leaderboards'>('papers');
    const [selectedCategory, setSelectedCategory] = useState<'text' | 'vision' | 'audio'>('text');
    
    // AI Code Generation State
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [selectedFramework, setSelectedFramework] = useState<'pytorch' | 'jax'>('pytorch');
    const [copied, setCopied] = useState(false);

    const leaderboards: Record<'text' | 'vision' | 'audio', { task: string, metric: string, entries: LeaderboardEntry[] }> = {
        text: {
            task: 'MMLU (Massive Multitask Language Understanding)',
            metric: 'Average 5-shot Accuracy (%)',
            entries: [
                { rank: 1, model: 'Gemini 3.5 Pro Ultra', score: '91.8%', params: 'MoE', extra: 'SOTA / Reasoning Enabled' },
                { rank: 2, model: 'GPT-4o', score: '88.7%', params: 'Dense', extra: 'Multimodal foundation' },
                { rank: 3, model: 'Claude 3.5 Sonnet', score: '88.3%', params: 'Dense', extra: 'Excellent coding proficiency' },
                { rank: 4, model: 'Llama 3.1 405B', score: '86.1%', params: '405B', extra: 'Leading open-source weight LLM' },
                { rank: 5, model: 'Mixtral 8x22B', score: '77.8%', params: '141B MoE', extra: 'High token efficiency' }
            ]
        },
        vision: {
            task: 'ImageNet-1k Image Classification',
            metric: 'Top-1 Accuracy (%)',
            entries: [
                { rank: 1, model: 'ViT-e (Vision Transformer Extra)', score: '91.2%', params: '1.8B', extra: 'Supervised pre-training' },
                { rank: 2, model: 'Florence-2', score: '89.6%', params: '230M', extra: 'Efficient unified vision model' },
                { rank: 3, model: 'Swin-v2 Large', score: '89.0%', params: '197M', extra: 'Hierarchical vision shift-window' },
                { rank: 4, model: 'ConvNeXt V2 Huge', score: '88.9%', params: '650M', extra: 'Pure ConvNet baseline' },
                { rank: 5, model: 'ResNet-152 (Baseline)', score: '78.5%', params: '60M', extra: 'Classic residual connections' }
            ]
        },
        audio: {
            task: 'LibriSpeech Automatic Speech Recognition',
            metric: 'Word Error Rate (WER) - lower is better',
            entries: [
                { rank: 1, model: 'Whisper-v3 Large', score: '1.8%', params: '1.5B', extra: 'Zero-shot robust generalist' },
                { rank: 2, model: 'SeamlessM4T v2', score: '2.1%', params: '1.2B', extra: 'Unified translation system' },
                { rank: 3, model: 'Conformer CTC Large', score: '2.4%', params: '120M', extra: 'Efficient speech processing' },
                { rank: 4, model: 'wav2vec 2.0 Large', score: '2.8%', params: '317M', extra: 'Self-supervised speech acoustic' },
                { rank: 5, model: 'DeepSpeech 2', score: '4.9%', params: '45M', extra: 'End-to-end deep recurrent network' }
            ]
        }
    };

    useEffect(() => {
        // Initial mock papers for LoRA search on startup
        const initialPapers: MLPaper[] = [
            {
                id: 'p1',
                title: 'LoRA: Low-Rank Adaptation of Large Language Models',
                authors: ['Edward J. Hu', 'Yuying Shen', 'Phillip Wallis', 'Zeyuan Allen-Zhu'],
                year: 2021,
                stars: 12400,
                repo: 'https://github.com/microsoft/LoRA',
                framework: 'PyTorch',
                abstract: 'An important paradigm of natural language processing consists of large-scale pre-training on general domain data and adaptation to specific tasks. We propose Low-Rank Adaptation (LoRA), which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters.'
            },
            {
                id: 'p2',
                title: 'QLoRA: Efficient Finetuning of Quantized LLMs',
                authors: ['Tim Dettmers', 'Artidoro Pagnoni', 'Ari Holtzman', 'Luke Zettlemoyer'],
                year: 2023,
                stars: 8400,
                repo: 'https://github.com/artidoro/qlora',
                framework: 'PyTorch',
                abstract: 'We present QLoRA, an efficient finetuning approach that reduces memory usage enough to finetune a 65B parameter model on a single 48GB GPU while preserving full 16-bit finetuning task performance. QLoRA backpropagates gradients through a frozen, 4-bit quantized pretrained language model into Low Rank Adapters.'
            }
        ];
        setPapers(initialPapers);
        setSelectedPaper(initialPapers[0]);
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsLoading(true);
        setGeneratedCode('');
        try {
            const ai = getAiClient();
            const prompt = `You are an AI Machine Learning expert database, styled like Papers With Code.
The user is searching for paper details and repos for: "${searchQuery}".
Generate exactly 2 highly relevant ML research papers, both with an accurate/realistic title, authors, year, abstract, github stars count (integer between 500 and 15000), a realistic GitHub repository URL, and the core implementation framework ('PyTorch' or 'JAX' or 'TensorFlow').

Respond in raw JSON format. DO NOT use markdown code blocks or wrapper tags. Ensure the JSON schema is exactly:
[
  {
    "id": "string",
    "title": "string",
    "abstract": "string",
    "authors": ["string", "string"],
    "year": 2023,
    "stars": 4500,
    "repo": "https://github.com/example/repo",
    "framework": "PyTorch"
  }
]`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt
            });

            const text = res.text || '[]';
            const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJsonStr);
            setPapers(parsed);
            if (parsed.length > 0) {
                setSelectedPaper(parsed[0]);
            }
        } catch (e) {
            console.error('Error fetching Papers With Code:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateCode = async (framework: 'pytorch' | 'jax') => {
        if (!selectedPaper) return;
        setIsGeneratingCode(true);
        setSelectedFramework(framework);
        try {
            const ai = getAiClient();
            const prompt = `You are an elite deep learning engineer. Write a clean, highly optimized, and thoroughly commented implementation of the main module/concept from the research paper: "${selectedPaper.title}".
Implement this using ${framework === 'pytorch' ? 'PyTorch (torch.nn.Module)' : 'JAX / Equinox (or Flax/Haiku)'}.
Provide only the implementation in a single python file. Include a forward pass and a quick test example with random tensors at the bottom of the script.

Return ONLY the code block. DO NOT write conversational intro/outro text.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt
            });

            setGeneratedCode(res.text || 'Code generation failed.');
        } catch (e) {
            console.error('Error generating AI code:', e);
            setGeneratedCode('# Error compiling model implementation. Try again.');
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
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                    <Code2 className="text-sky-400" size={18} />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-sky-400">Papers With Code AI</span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search model architectures or layers..."
                        className="bg-zinc-950 border border-zinc-800 text-xs px-3 py-1.5 rounded-md outline-none focus:border-sky-500 transition-colors w-64 text-zinc-200"
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-55 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                        Search ML
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
                <button
                    onClick={() => setActiveTab('papers')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${activeTab === 'papers' ? 'border-sky-500 text-sky-400 bg-sky-500/5' : 'border-transparent hover:text-zinc-200'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <BookOpen size={13} />
                        Paper Implementations
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('leaderboards')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${activeTab === 'leaderboards' ? 'border-sky-500 text-sky-400 bg-sky-500/5' : 'border-transparent hover:text-zinc-200'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <BarChart3 size={13} />
                        SOTA Leaderboards
                    </div>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex min-h-0">
                {activeTab === 'papers' ? (
                    <div className="flex-1 flex min-h-0">
                        {/* Paper List */}
                        <div className="w-1/3 border-r border-zinc-800 p-4 overflow-auto space-y-3 shrink-0">
                            <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider mb-2">Search Results</h3>
                            {papers.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedPaper(p);
                                        setGeneratedCode('');
                                    }}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedPaper?.id === p.id ? 'bg-sky-500/10 border-sky-500/40 text-sky-300' : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 text-zinc-300'}`}
                                >
                                    <h4 className="font-bold text-xs leading-snug line-clamp-2">{p.title}</h4>
                                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2">
                                        <span>{p.authors[0]} ({p.year})</span>
                                        <div className="flex items-center gap-1 text-amber-500">
                                            <Star size={10} fill="currentColor" />
                                            <span>{(p.stars / 1000).toFixed(1)}k</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Paper Details and Code Generation */}
                        <div className="flex-1 flex flex-col min-h-0 p-4 bg-zinc-950">
                            {selectedPaper ? (
                                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                                    {/* Paper Info */}
                                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="font-bold text-base text-zinc-100">{selectedPaper.title}</h3>
                                                <p className="text-xs text-zinc-400 mt-1">Authors: {selectedPaper.authors.join(', ')} • ({selectedPaper.year})</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <a
                                                    href={selectedPaper.repo}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
                                                >
                                                    <GitFork size={12} />
                                                    GitHub
                                                </a>
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-300 mt-3 leading-relaxed">{selectedPaper.abstract}</p>
                                    </div>

                                    {/* Code Generation Panel */}
                                    <div className="flex-1 flex flex-col min-h-0 bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                                        <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                                <Terminal size={12} />
                                                <span className="font-mono">Interactive Code Companion</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleGenerateCode('pytorch')}
                                                    disabled={isGeneratingCode}
                                                    className={`px-3 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${selectedFramework === 'pytorch' && generatedCode ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                                >
                                                    PyTorch Module
                                                </button>
                                                <button
                                                    onClick={() => handleGenerateCode('jax')}
                                                    disabled={isGeneratingCode}
                                                    className={`px-3 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${selectedFramework === 'jax' && generatedCode ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                                >
                                                    JAX Module
                                                </button>
                                                {generatedCode && (
                                                    <button
                                                        onClick={copyToClipboard}
                                                        className="text-zinc-400 hover:text-zinc-200 p-1"
                                                        title="Copy Code"
                                                    >
                                                        {copied ? <Check size={14} className="text-green-400" /> : <Clipboard size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 p-3 overflow-auto font-mono text-[11px] bg-zinc-950 text-emerald-400 relative">
                                            {isGeneratingCode ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 text-zinc-500 z-10">
                                                    <Loader2 size={24} className="animate-spin text-sky-500 mb-2" />
                                                    <span>Formulating clean deep learning layer code...</span>
                                                </div>
                                            ) : generatedCode ? (
                                                <pre className="whitespace-pre-wrap">{generatedCode}</pre>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                                                    <Sparkles size={20} className="mb-2 text-zinc-700" />
                                                    <p className="max-w-xs leading-relaxed text-xs">Choose PyTorch or JAX above to generate the precise neural network layers for this model.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">Search and select an ML paper to examine its architecture and code.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Leaderboards View
                    <div className="flex-1 flex min-h-0 bg-zinc-950">
                        {/* Task Selectors */}
                        <div className="w-64 border-r border-zinc-800 p-4 space-y-2 shrink-0">
                            <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Tasks / Milestones</h3>
                            <button
                                onClick={() => setSelectedCategory('text')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedCategory === 'text' ? 'bg-sky-500/10 text-sky-400 font-bold border-l-4 border-sky-500' : 'hover:bg-zinc-900 text-zinc-400'}`}
                            >
                                Massive Multitask Q&A
                            </button>
                            <button
                                onClick={() => setSelectedCategory('vision')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedCategory === 'vision' ? 'bg-sky-500/10 text-sky-400 font-bold border-l-4 border-sky-500' : 'hover:bg-zinc-900 text-zinc-400'}`}
                            >
                                Image Classification (SOTA)
                            </button>
                            <button
                                onClick={() => setSelectedCategory('audio')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedCategory === 'audio' ? 'bg-sky-500/10 text-sky-400 font-bold border-l-4 border-sky-500' : 'hover:bg-zinc-900 text-zinc-400'}`}
                            >
                                Speech-to-Text Recognition
                            </button>
                        </div>

                        {/* Leaderboard Grid */}
                        <div className="flex-1 p-6 overflow-auto space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-zinc-100">{leaderboards[selectedCategory].task}</h3>
                                <p className="text-xs text-zinc-400 mt-0.5">Primary Evaluation Metric: <span className="text-sky-400 font-semibold font-mono">{leaderboards[selectedCategory].metric}</span></p>
                            </div>

                            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden mt-4">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-zinc-800 bg-zinc-900 font-mono text-zinc-400 text-[10px] uppercase">
                                            <th className="p-3 text-center w-12">Rank</th>
                                            <th className="p-3">Model Name</th>
                                            <th className="p-3">Evaluation Score</th>
                                            <th className="p-3">Parameters</th>
                                            <th className="p-3">Key Paradigm / Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 font-sans text-zinc-300">
                                        {leaderboards[selectedCategory].entries.map(e => (
                                            <tr key={e.rank} className="hover:bg-zinc-900/40 transition-colors">
                                                <td className="p-3 text-center font-mono font-bold text-sky-400">{e.rank}</td>
                                                <td className="p-3 font-semibold text-zinc-100">{e.model}</td>
                                                <td className="p-3 font-mono font-bold text-emerald-400">{e.score}</td>
                                                <td className="p-3 text-zinc-400 font-mono">{e.params}</td>
                                                <td className="p-3 text-zinc-400 text-[11px]">{e.extra}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
