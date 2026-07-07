import React, { useState, useEffect } from 'react';
import { 
    Cpu, Database, Sparkles, Binary, CheckCircle, AlertCircle, Copy, 
    Download, Upload, RefreshCw, Zap, BookOpen, Layers, LineChart, 
    HelpCircle, Eye, ChevronRight, FileText, Share2, CornerDownRight,
    Lock, Unlock, Flame, Activity
} from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { compressToLZWBase64, decompressFromLZWBase64, compressToGzipBase64, decompressFromGzipBase64 } from '../../lib/compression';

// Interface for Knowledge Condenser Presets
interface CondenserPreset {
    id: string;
    name: string;
    category: 'semantic' | 'logical' | 'cybernetic' | 'cognitive';
    mathFormula: string;
    description: string;
    instruction: string;
    efficiencyRating: string;
}

// 30 Advanced Knowledge Condensers catalog
const CONDENSER_PRESETS: CondenserPreset[] = [
    {
        id: 'gist_core',
        name: 'Executive Gist Core',
        category: 'semantic',
        mathFormula: 'G(x) = \\lim_{n \\to k} S(x_n)',
        description: 'Distills paragraphs into single-sentence semantic anchors with maximal contextual retention.',
        instruction: 'Condense the text down to its absolute core message in exactly one or two dense, punchy sentences. Retain critical proper nouns and outcomes. Absolutely no introductions or polite phrasing.',
        efficiencyRating: '85-95%'
    },
    {
        id: 'first_principles',
        name: 'First-Principles Decomposer',
        category: 'logical',
        mathFormula: 'F_p(X) = \\{ a \\in X \\mid \\forall b, b \\not\\vdash a \\}',
        description: 'Deconstructs arguments into fundamental axioms, truths, and derived logical statements.',
        instruction: 'Deconstruct this information into its fundamental constituent axioms (self-evident truths) and logical deductions. Present them as numbered axioms [A1, A2] and derived conclusions [C1, C2] representing the core reasoning chain.',
        efficiencyRating: '75-80%'
    },
    {
        id: 'taxonomic_ontology',
        name: 'Taxonomic Ontology Matrix',
        category: 'cognitive',
        mathFormula: 'T(C) = \\langle C, \\le, R \\rangle',
        description: 'Groups ideas, technologies, or subjects into high-density hierarchical definitions.',
        instruction: 'Structure the text content into a strict nested taxonomical tree. Use clean indentation and prefix relationships with taxonomy parent-child roles (e.g., Domain -> Family -> Class -> Concept) to define structural boundaries.',
        efficiencyRating: '70-75%'
    },
    {
        id: 'token_sparsifier',
        name: 'RAG Token Sparsifier',
        category: 'cybernetic',
        mathFormula: 'S(t) = \\{ w_i \\in t \\mid I(w_i) > \\theta \\}',
        description: 'Filters conversational fluff, adjectives, and lexical stop-words to output bare-metal keywords.',
        instruction: 'Act as a RAG vector context sparsifier. Strips out all conversational filler, preachy transitions, polite adjectives, and generic adverbs. Re-write the text as high-density structured keyword-fact pairings containing only high-information value terms.',
        efficiencyRating: '90-95%'
    },
    {
        id: 'shannon_entropy_filter',
        name: 'Shannon Entropy Filter',
        category: 'cybernetic',
        mathFormula: 'H(X) = -\\sum P(x_i) \\log_2 P(x_i)',
        description: 'Identifies high-entropy informational sequences while discarding repetitive lexical chains.',
        instruction: 'Analyze the text as a source of information. Identify the statements or elements that present the highest novel informational density (highest entropy). Output ONLY those high-entropy fact vectors, omitting repetitive, standard background assumptions.',
        efficiencyRating: '80-85%'
    },
    {
        id: 'system_prompt_builder',
        name: 'Claude XML Prompt Builder',
        category: 'cognitive',
        mathFormula: 'P_{opt}(S) = \\psi(S) \\otimes XML_{tags}',
        description: 'Translates long guidelines or procedures into optimized, tagged XML prompts for LLMs.',
        instruction: 'Convert these guidelines/rules into a highly structured, production-ready system prompt for an LLM. Wrap distinct operational boundaries in XML tags (e.g. <context>, <rules>, <output_schema>). Make it dense and highly authoritative.',
        efficiencyRating: '65-75%'
    },
    {
        id: 'feynman_reducer',
        name: 'Feynman Explainer Reducer',
        category: 'semantic',
        mathFormula: 'F_e(J) = \\phi(J) \\to S_{simple}',
        description: 'Translates specialized jargon into ultra-clear, high-impact analogies.',
        instruction: 'De-jargonize the content completely. Translate complex technical terminology into simple, elegant, high-impact visual analogies (the "Feynman technique"). Explain the concept to a complete beginner using 60% fewer words while preserving the absolute core mechanics.',
        efficiencyRating: '80-88%'
    },
    {
        id: 'cyber_auditor',
        name: 'OSINT Cyber-Auditor Digest',
        category: 'cybernetic',
        mathFormula: 'A(s) = \\{ IP, Domain, CVE \\}',
        description: 'Extracts systems metadata, CVE descriptors, network identifiers, and IPs.',
        instruction: 'Extract all systems metadata, network indicators (IPs, CIDRs, domains, hashes), protocol descriptors, and CVE/security references. Organize them into a strict cybernetic audit list with short threat indicators.',
        efficiencyRating: '90-92%'
    },
    {
        id: 'cognitive_map',
        name: 'Node-Edge Cognitive Map',
        category: 'cognitive',
        mathFormula: 'G = (V, E)',
        description: 'Structures semantic connections into a clean graph of nodes and relational edges.',
        instruction: 'Map the semantic connections of this text into a clean relational graph represented as text-based Nodes (V) and directed Edges (E). Format: "Node A -> (relation) -> Node B" to represent cognitive linkages.',
        efficiencyRating: '75-82%'
    },
    {
        id: 'fact_densifier',
        name: 'Heuristic Fact-Densifier',
        category: 'logical',
        mathFormula: 'D_{fact} = \\frac{F_{unique}}{W_{count}}',
        description: 'Cross-references and merges overlapping statements to minimize logical redundancy.',
        instruction: 'Parse the input text. Cross-reference all claims and facts. Merge overlapping or related statements into unified, extremely dense "atomic truth statements". Eliminate all redundant phrasing and fluff.',
        efficiencyRating: '82-88%'
    },
    {
        id: 'code_boilerplate_stripper',
        name: 'Code-Boilerplate Stripper',
        category: 'logical',
        mathFormula: 'C_{raw} = C_{full} \\setminus C_{boilerplate}',
        description: 'Compresses source files down to core algorithmic pathways, stripping trivial imports.',
        instruction: 'Review the provided code or technical outline. Strip away trivial standard imports, boilerplate class declarations, getters/setters, and generic comments. Retain and optimize ONLY the core algorithmic state transitions or business logic blocks.',
        efficiencyRating: '88-93%'
    },
    {
        id: 'swot_vectorizer',
        name: 'SWOT Vectorizer',
        category: 'semantic',
        mathFormula: 'S(x) = \\{S, W, O, T\\}',
        description: 'Restructures descriptions into an immediate, high-fidelity strategic quadrant.',
        instruction: 'Analyze this narrative and restructure it into a highly focused, dense Strategic SWOT Matrix. Provide exactly 3 bullet-points for Strengths, Weaknesses, Opportunities, and Threats, highlighting core technical or strategic realities.',
        efficiencyRating: '78-85%'
    },
    {
        id: 'dialectic_core',
        name: 'Socratic Dialectic Core',
        category: 'logical',
        mathFormula: 'D(t) = T \\oplus A \\to S',
        description: 'Isolates the core arguments: Thesis, Antithesis, and resulting Synthesis.',
        instruction: 'Analyze the debates, claims, or text. Extract the "Thesis" (the primary claim), the "Antithesis" (the core counterarguments or constraints), and reconcile them into a dense, advanced "Synthesis" summarizing the path forward.',
        efficiencyRating: '85-90%'
    },
    {
        id: 'chronological_sequencer',
        name: 'Chronological Timeline Sequencer',
        category: 'cognitive',
        mathFormula: 'T_{seq} = \\{ t_i \\mid t_i \\le t_{i+1} \\}',
        description: 'Converts unstructured logs or narratives into sequential timestamped vectors.',
        instruction: 'Reorganize this text into a strict, sequentially ordered timeline. Map events, milestones, or timestamps chronologically from earliest to latest, with high-density bullet descriptions of what occurred.',
        efficiencyRating: '80-87%'
    },
    {
        id: 'dijkstra_pruner',
        name: 'Dijkstra Decision Pruner',
        category: 'logical',
        mathFormula: 'P_{path}(x) = \\min(Cost(x))',
        description: 'Analyzes logical paths in the text and prunes dead, speculative, or conversational branches.',
        instruction: 'Examine the decision-making narrative or instructions. Identify the absolute optimal "critical path" to the objective. Prune away all speculative options, defensive caveats, and dead-end logic branches, returning ONLY the high-efficiency roadmap.',
        efficiencyRating: '84-89%'
    },
    {
        id: 'hofstadter_map',
        name: 'Hofstadter Loop Map',
        category: 'cognitive',
        mathFormula: 'L_{self} = \\{ f(f(x)) \\to x \\}',
        description: 'Exposes recursive loops, nested dependencies, and self-references.',
        instruction: 'Map out the self-referencing feedback loops, recursive properties, or nested dependencies in the text. Highlight how variables or components affect each other cyclically in a clean, structured outline.',
        efficiencyRating: '70-78%'
    },
    {
        id: 'leibniz_characteristica',
        name: 'Leibniz Characteristica Core',
        category: 'logical',
        mathFormula: 'C(a) = \\prod p_i^{a_i}',
        description: 'Maps predicates and attributes into mathematical logic values.',
        instruction: 'Map the subject and predicates of this text into precise, logical attributes. List each primary entity and define its absolute logical properties, conditions, and operations as structured boolean characteristics.',
        efficiencyRating: '74-82%'
    },
    {
        id: 'pareto_extractor',
        name: 'Pareto 80/20 Key Extractor',
        category: 'semantic',
        mathFormula: 'P(80) \\propto V(20)',
        description: 'Strips away the 80% conversational fluff to yield the 20% high-leverage data.',
        instruction: 'Extract the high-impact "20%" core facts or ideas that generate 80% of the value of this text. Represent them as highly concentrated bullet points, and scrap the remaining 80% explanatory bulk entirely.',
        efficiencyRating: '85-92%'
    },
    {
        id: 'anharmonic_filter',
        name: 'Anharmonic Padding Filter',
        category: 'semantic',
        mathFormula: 'F_{pad}(t) = t \\setminus \\sum Noise',
        description: 'Eliminates throat-clearing statements, polite introductions, and conversational fluff.',
        instruction: 'Perform an anharmonic filter: strip out all intros ("Sure, I can help", "As an AI..."), throat-clearing sentences, background summaries, polite conclusions, and standard filler. Return ONLY the structural core content.',
        efficiencyRating: '92-97%'
    },
    {
        id: 'cybernetic_feedback',
        name: 'Cybernetic Feedback Loop Mapper',
        category: 'cybernetic',
        mathFormula: 'F_{back} = \\Delta Input \\times Gain',
        description: 'Extracts systems cause-and-effect as closed loops with positive/negative indicators.',
        instruction: 'Parse the system description. Construct a list of feedback loops. Identify the inputs, sensors, outputs, and gain vectors, classifying them as (+) Positive Reinforcing or (-) Negative Stabilizing loops.',
        efficiencyRating: '76-84%'
    },
    {
        id: 'boolean_truth_reducer',
        name: 'Boolean Truth Reducer',
        category: 'logical',
        mathFormula: 'f(A, B, C) \\to Q_{min}',
        description: 'Converts procedural condition scripts into minimized boolean instructions.',
        instruction: 'Review the conditional instructions, rules, or procedural steps. Simplify them down to their absolute minimal logical conditions. Express the flow as clean, pseudo-code Boolean logic statements (e.g. IF A AND (B OR NOT C) THEN DO X).',
        efficiencyRating: '82-90%'
    },
    {
        id: 'zipf_law_parser',
        name: 'Zipf-Law Vocabulary Parser',
        category: 'semantic',
        mathFormula: 'f(r) = \\frac{C}{r^s}',
        description: 'Ranks and filters words based on rank-frequency, pruning extreme outliers to maximize impact.',
        instruction: 'Filter the vocabulary of this text based on rank-frequency. Replace redundant or overly simple filler verbs and nouns with highly specific, single semantic terms. Synthesize the text using highly targeted, dense vocabulary.',
        efficiencyRating: '80-86%'
    },
    {
        id: 'mece_divider',
        name: 'MECE Division Synthesizer',
        category: 'cognitive',
        mathFormula: 'S = \\bigcup S_i, S_i \\cap S_j = \\emptyset',
        description: 'Partitions complex topics into Mutually Exclusive and Collectively Exhaustive categories.',
        instruction: 'Divide the entire information of this document into distinct categories that are strictly MECE (Mutually Exclusive, Collectively Exhaustive). Ensure there is absolutely no overlap between categories, yet they cover the whole text.',
        efficiencyRating: '78-84%'
    },
    {
        id: 'entropy_maxima',
        name: 'Information Density Maxima',
        category: 'cybernetic',
        mathFormula: 'M_D = \\max \\left(\\frac{I}{W}\\right)',
        description: 'Calculates and outputs the absolute mathematical limit of meaning per character.',
        instruction: 'Compress this text to its absolute theoretical mathematical limit of density. Eliminate spacing, helper verbs, and punctuation where possible to form a highly optimized, raw semantic packet of data that remains humanly decipherable.',
        efficiencyRating: '92-96%'
    },
    {
        id: 'superposition_mapper',
        name: 'Superposition State Mapper',
        category: 'cognitive',
        mathFormula: '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle',
        description: 'Structures claims into co-existing alternate hypotheses with weight margins.',
        instruction: 'Analyze the speculative claims or data. Map them as a "Quantum Superposition" of multiple competing theories or states. List each hypothesis and allocate an informational weight percentage (e.g., State A: 40% vs State B: 60%) based on text evidence.',
        efficiencyRating: '72-80%'
    },
    {
        id: 'godel_completeness_finder',
        name: 'Gödelian Incompleteness Finder',
        category: 'logical',
        mathFormula: 'G \\vdash \\neg Con(T)',
        description: 'Extracts unstated assumptions, logical contradictions, and limits of the text.',
        instruction: 'Analyze this document. Instead of summarizing what is there, extract the "Incompleteness": what is left unstated, what underlying assumptions are unproved, and where are the inherent logical contradictions or boundaries of the claim.',
        efficiencyRating: '70-76%'
    },
    {
        id: 'semantic_vector_block',
        name: 'Vectorized Semantic Context',
        category: 'semantic',
        mathFormula: '\\vec{v} = \\sum w_i \\vec{e}_i',
        description: 'Transforms multi-turn explanations into a singular, vectorized high-dimensional chunk.',
        instruction: 'Compile all content into a singular, tightly structured vector-style semantic chunk. Structure key concepts as dimension coordinates with direct, rich value assignments. Perfect for direct feeding into high-efficiency embeddings.',
        efficiencyRating: '88-94%'
    },
    {
        id: 'cybernetic_gain_shifter',
        name: 'Cybernetic Shifter',
        category: 'cybernetic',
        mathFormula: 'G_{shift} = \\frac{A}{1 + A\\beta}',
        description: 'Modulates explanation gain to output dense operational parameters.',
        instruction: 'Convert this descriptive content into a highly detailed set of strict operational parameters, configurations, and tuning thresholds. Translate generic prose into specific operational values.',
        efficiencyRating: '80-85%'
    },
    {
        id: 'axiom_assembler',
        name: 'Axiomatic Assembler',
        category: 'logical',
        mathFormula: '\\mathcal{A} = \\{ \\alpha_1, \\alpha_2, ... \\}',
        description: 'Compiles technical assertions into mathematically sound operational axioms.',
        instruction: 'Synthesize the claims or instructions into a set of mathematically rigid axiomatic rules. Express each rule with strict logical quantifiers and absolute assertions that can be used for automated system validation.',
        efficiencyRating: '76-83%'
    },
    {
        id: 'quantum_entangler',
        name: 'Semantic Entangler Matrix',
        category: 'cognitive',
        mathFormula: 'E(\\rho) = -\\text{Tr}(\\rho \\log_2 \\rho)',
        description: 'Exposes non-local semantic links where concepts in separate sections are entangled.',
        instruction: 'Review the text. Map out "semantic entanglement": cross-references and dependencies between non-adjacent concepts or systems in different sections of the document. Show how changes in Module A inevitably force state changes in Module B.',
        efficiencyRating: '74-81%'
    }
];

export const KnowledgeCompressorApp: React.FC = () => {
    // Tab Management: 'compress' | 'condensers' | 'analytics' | 'decompress'
    const [activeTab, setActiveTab] = useState<'compress' | 'condensers' | 'analytics' | 'decompress'>('compress');
    
    // Core states
    const [rawContent, setRawContent] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState('gist_core');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'semantic' | 'logical' | 'cybernetic' | 'cognitive'>('all');
    
    // Condense execution state
    const [condensedContent, setCondensedContent] = useState('');
    const [isCondensing, setIsCondensing] = useState(false);
    const [condenseRatio, setCondenseRatio] = useState(0); // Semantic reduction %
    
    // Squeeze (LZW/GZIP) states
    const [compressionMode, setCompressionMode] = useState<'lzw' | 'gzip'>('lzw');
    const [isSqueezing, setIsSqueezing] = useState(false);
    const [lzwBase64, setLzwBase64] = useState('');
    const [lzwRatio, setLzwRatio] = useState(0); // LZW reduction %
    const [entropyMetric, setEntropyMetric] = useState(0);
    const [vocabDensity, setVocabDensity] = useState(0);
    const [combinedDensity, setCombinedDensity] = useState(0);
    
    // Decompress State
    const [decompressInput, setDecompressInput] = useState('');
    const [decompressedContent, setDecompressedContent] = useState('');
    const [isDecompressing, setIsDecompressing] = useState(false);
    const [decompressStatus, setDecompressStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Virtual Files integration from local storage
    const [vFiles, setVFiles] = useState<{name: string, content: string}[]>([]);
    const [copiedMap, setCopiedMap] = useState<{ [key: string]: boolean }>({});

    // Load virtual files on mount
    useEffect(() => {
        const saved = localStorage.getItem('termstudio_vfiles');
        if (saved) {
            try {
                setVFiles(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse termstudio vfiles', e);
            }
        }
    }, []);

    const selectedPreset = CONDENSER_PRESETS.find(p => p.id === selectedPresetId) || CONDENSER_PRESETS[0];

    // Helper: Calculate Shannon Entropy
    const calculateShannonEntropy = (text: string): number => {
        if (!text) return 0;
        const freqs: { [key: string]: number } = {};
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            freqs[char] = (freqs[char] || 0) + 1;
        }
        let entropy = 0;
        const len = text.length;
        for (const char in freqs) {
            const p = freqs[char] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    };

    // Helper: Calculate Vocab Density
    const calculateVocabDensity = (text: string): number => {
        if (!text) return 0;
        const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');
        const words = cleaned.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return 0;
        const uniqueWords = new Set(words);
        return uniqueWords.size / words.length;
    };

    // Execute semantic condensation via actual Gemini API
    const handleCondense = async () => {
        if (!rawContent.trim()) return;
        
        setIsCondensing(true);
        setCondensedContent('');
        setLzwBase64('');
        
        try {
            const ai = getAiClient();
            
            const promptText = `
SYSTEM INSTRUCTION: You are an elite Quantum Knowledge Condenser mathematical utility. 
Your core objective is to execute the following mathematical/semantic filter model on the user's input content:
FILTER NAME: ${selectedPreset.name}
EQUATION SCHEMA: ${selectedPreset.mathFormula}
FILTER DESCRIPTION: ${selectedPreset.description}
FILTER OPERATIONAL INSTRUCTIONS: ${selectedPreset.instruction}

Your output must be absolutely pristine, containing ONLY the final condensed high-density semantic structure.
Do not write conversational introductions ("Sure, I compressed this for you"), do not write helpful advice or polite warnings.
Return bare-metal, maximally condensed, informative raw data containing high-entropy concepts.

USER INPUT TO CONDENSE:
${rawContent}
`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [{ text: promptText }],
                config: {
                    temperature: 0.15,
                }
            });

            const condensedResult = response.text || '';
            setCondensedContent(condensedResult);
            
            // Calculate ratios
            const rawLen = rawContent.length;
            const condLen = condensedResult.length;
            const reduction = rawLen > 0 ? ((rawLen - condLen) / rawLen) * 100 : 0;
            setCondenseRatio(Math.max(0, parseFloat(reduction.toFixed(1))));

            // Update stats
            const entropy = calculateShannonEntropy(condensedResult);
            const vocabDens = calculateVocabDensity(condensedResult);
            setEntropyMetric(entropy);
            setVocabDensity(vocabDens);
            
            // Global Density Metric: Entropy * vocabulary density coefficient
            const globDens = entropy * (vocabDens * 1.5);
            setCombinedDensity(parseFloat(globDens.toFixed(2)));

            // Switch to show calculations
            setActiveTab('analytics');
            
        } catch (err: any) {
            console.error('Condense error:', err);
            setCondensedContent(`Error processing semantic condensation: ${err.message}`);
        } finally {
            setIsCondensing(false);
        }
    };

    // Squeeze the condensed text using lossless compression (LZW or native Gzip)
    const handleSqueeze = async () => {
        if (!condensedContent) return;
        setIsSqueezing(true);
        
        try {
            let squeezed = '';
            if (compressionMode === 'gzip') {
                squeezed = await compressToGzipBase64(condensedContent);
            } else {
                squeezed = compressToLZWBase64(condensedContent);
            }
            setLzwBase64(squeezed);
            
            const origLen = condensedContent.length;
            const squeezedLen = squeezed.length;
            const reduction = origLen > 0 ? ((origLen - squeezedLen) / origLen) * 100 : 0;
            setLzwRatio(Math.max(0, parseFloat(reduction.toFixed(1))));
            
        } catch (err) {
            console.error('Compression failed', err);
        } finally {
            setIsSqueezing(false);
        }
    };

    // Decompress packed block back to readable text
    const handleDecompress = async () => {
        if (!decompressInput.trim()) return;
        setIsDecompressing(true);
        setDecompressStatus('idle');
        setErrorMessage('');
        
        try {
            let expanded = '';
            const cleanedInput = decompressInput.trim();
            // Automatically detect Gzip base64 (typically starts with 'H4sI') or use active compressionMode
            if (cleanedInput.startsWith('H4sI') || compressionMode === 'gzip') {
                expanded = await decompressFromGzipBase64(cleanedInput);
            } else {
                expanded = decompressFromLZWBase64(cleanedInput);
            }
            setDecompressedContent(expanded);
            setDecompressStatus('success');
        } catch (err: any) {
            console.error(err);
            // Fallback: if the user passed LZW but was in Gzip mode, or vice versa, try fallback decompression
            try {
                const fallbackExpanded = decompressFromLZWBase64(decompressInput.trim());
                setDecompressedContent(fallbackExpanded);
                setDecompressStatus('success');
                return;
            } catch (fallbackErr) {
                console.error('Fallback decompression also failed:', fallbackErr);
            }
            setDecompressStatus('error');
            setErrorMessage(err.message || 'Stream decoding failed. Invalid Base64 or corrupted codes.');
        } finally {
            setIsDecompressing(false);
        }
    };

    // Load file from TermStudio workspace
    const loadWorkspaceFile = (filename: string, content: string) => {
        setRawContent(content);
        setActiveTab('compress');
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMap(prev => ({ ...prev, [label]: true }));
        setTimeout(() => {
            setCopiedMap(prev => ({ ...prev, [label]: false }));
        }, 2000);
    };

    const downloadAsFile = (filename: string, text: string) => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Filtered Presets based on UI category selection
    const filteredPresets = CONDENSER_PRESETS.filter(p => {
        if (categoryFilter === 'all') return true;
        return p.category === categoryFilter;
    });

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden text-sm">
            
            {/* Top Hub Bar - High contrast dark tech */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                        <Binary className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                            Quantum Knowledge Condenser
                            <span className="text-[10px] uppercase tracking-widest font-mono bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">
                                Offline Core
                            </span>
                        </h2>
                        <p className="text-xs text-zinc-400 font-mono">Maximum Meaning, Zero Fluff noise • Shannon Entropy Engine</p>
                    </div>
                </div>

                {/* Main Tabs */}
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button 
                        onClick={() => setActiveTab('compress')} 
                        className={`px-3 py-1.5 rounded-md font-mono text-xs transition-all flex items-center gap-1.5 ${activeTab === 'compress' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        Condense & Squeeze
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')} 
                        className={`px-3 py-1.5 rounded-md font-mono text-xs transition-all flex items-center gap-1.5 ${activeTab === 'analytics' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <LineChart className="w-3.5 h-3.5 text-emerald-400" />
                        Calculated Analytics
                    </button>
                    <button 
                        onClick={() => setActiveTab('decompress')} 
                        className={`px-3 py-1.5 rounded-md font-mono text-xs transition-all flex items-center gap-1.5 ${activeTab === 'decompress' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Unlock className="w-3.5 h-3.5 text-purple-400" />
                        Extract Block
                    </button>
                    <button 
                        onClick={() => setActiveTab('condensers')} 
                        className={`px-3 py-1.5 rounded-md font-mono text-xs transition-all flex items-center gap-1.5 ${activeTab === 'condensers' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Library ({CONDENSER_PRESETS.length})
                    </button>
                </div>
            </div>

            {/* Main Application Area */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* CONDENSE & SQUEEZE TAB */}
                {activeTab === 'compress' && (
                    <div className="flex-1 flex overflow-hidden">
                        
                        {/* Left Side: Presets catalog selection */}
                        <div className="w-[20rem] bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-zinc-800">
                                <h3 className="font-mono text-xs text-zinc-400 uppercase tracking-wider mb-2">Condenser Presets</h3>
                                <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                                    <button 
                                        onClick={() => setCategoryFilter('all')}
                                        className={`py-1 text-[10px] font-mono rounded ${categoryFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                                    >
                                        All
                                    </button>
                                    <button 
                                        onClick={() => setCategoryFilter('semantic')}
                                        className={`py-1 text-[10px] font-mono rounded ${categoryFilter === 'semantic' ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400'}`}
                                    >
                                        Semantic
                                    </button>
                                    <button 
                                        onClick={() => setCategoryFilter('logical')}
                                        className={`py-1 text-[10px] font-mono rounded ${categoryFilter === 'logical' ? 'bg-zinc-800 text-purple-400' : 'text-zinc-400'}`}
                                    >
                                        Logical
                                    </button>
                                    <button 
                                        onClick={() => setCategoryFilter('cybernetic')}
                                        className={`py-1 text-[10px] font-mono rounded ${categoryFilter === 'cybernetic' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400'}`}
                                    >
                                        Cyber
                                    </button>
                                </div>
                            </div>

                            {/* Catalog list */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {filteredPresets.map(preset => {
                                    const isSelected = selectedPresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => setSelectedPresetId(preset.id)}
                                            className={`w-full text-left p-2.5 rounded-lg transition-all border flex flex-col gap-1 ${
                                                isSelected 
                                                    ? 'bg-gradient-to-r from-zinc-800 to-zinc-850 border-zinc-700 shadow-md ring-1 ring-cyan-500/20' 
                                                    : 'bg-zinc-950/40 border-transparent hover:bg-zinc-900/50 hover:border-zinc-800'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className={`font-semibold tracking-tight ${isSelected ? 'text-cyan-400' : 'text-zinc-200'}`}>
                                                    {preset.name}
                                                </span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950 font-mono border border-zinc-800 text-zinc-500">
                                                    {preset.efficiencyRating}
                                                </span>
                                            </div>
                                            <p className="text-zinc-400 text-[11px] leading-snug line-clamp-2">
                                                {preset.description}
                                            </p>
                                            <code className="text-[10px] text-zinc-500 font-mono mt-1 opacity-75 truncate">
                                                {preset.mathFormula}
                                            </code>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Side: Interactive Input / Output Areas */}
                        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6 bg-zinc-950">
                            
                            {/* Selected model overview */}
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-purple-600/5 rounded-bl-full pointer-events-none" />
                                <div className="space-y-1 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs uppercase font-mono tracking-widest bg-cyan-950 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
                                            ACTIVE EQUATION MODEL
                                        </span>
                                        <span className="text-xs text-zinc-500 font-mono">
                                            {selectedPreset.category.toUpperCase()} Presets
                                        </span>
                                    </div>
                                    <h4 className="text-lg font-bold text-white">{selectedPreset.name}</h4>
                                    <p className="text-zinc-400 text-xs leading-relaxed">{selectedPreset.description}</p>
                                    <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-850 inline-block mt-2">
                                        <code className="text-xs font-mono text-purple-400">{selectedPreset.mathFormula}</code>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                    <button
                                        onClick={handleCondense}
                                        disabled={isCondensing || !rawContent.trim()}
                                        className={`px-5 py-3 rounded-xl font-bold tracking-tight text-white flex items-center justify-center gap-2 transition-all ${
                                            !rawContent.trim() 
                                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                                : isCondensing 
                                                    ? 'bg-zinc-850 text-zinc-400 cursor-wait'
                                                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:scale-[1.02] shadow-[0_4px_12px_rgba(6,182,212,0.15)]'
                                        }`}
                                    >
                                        {isCondensing ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                                                Filtering Jargon...
                                            </>
                                        ) : (
                                            <>
                                                <Cpu className="w-4 h-4 text-cyan-300" />
                                                Condense Content
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Raw Input and virtual files */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="font-mono text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-cyan-400" />
                                            Source Raw Content
                                        </label>
                                        <span className="text-[10px] font-mono text-zinc-500">
                                            {rawContent.length} bytes
                                        </span>
                                    </div>
                                    <textarea
                                        value={rawContent}
                                        onChange={(e) => setRawContent(e.target.value)}
                                        placeholder="Paste source guidelines, system requirements, dense technical logs, or long conversational threads to run maximum meaning extraction..."
                                        className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none placeholder-zinc-600"
                                    />
                                    
                                    {/* Virtual file loader list */}
                                    {vFiles.length > 0 && (
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-mono text-zinc-500 uppercase">Load Workspace Documents</span>
                                            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                                                {vFiles.map((f, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => loadWorkspaceFile(f.name, f.content)}
                                                        className="text-[11px] font-mono bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-zinc-300 shrink-0"
                                                    >
                                                        <FileText className="w-3 h-3 text-purple-400" />
                                                        {f.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Outputs */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="font-mono text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                            Condensed Semantic Output
                                        </label>
                                        {condensedContent && (
                                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
                                                -{condenseRatio}% Fluff Reduced
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative h-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-y-auto font-mono text-xs text-zinc-300">
                                        {condensedContent ? (
                                            <pre className="whitespace-pre-wrap">{condensedContent}</pre>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center px-4 space-y-2">
                                                <Activity className="w-8 h-8 text-zinc-700 animate-pulse" />
                                                <p>No condensed outputs generated yet.</p>
                                                <p className="text-[11px]">Select a preset from the left panel and click "Condense Content" to strip conversational noise.</p>
                                            </div>
                                        )}
                                        {condensedContent && (
                                            <button 
                                                onClick={() => handleCopy(condensedContent, 'condensed')}
                                                className="absolute right-3 top-3 p-1.5 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                                                title="Copy Content"
                                            >
                                                {copiedMap['condensed'] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>

                                    {/* Action items for condensed content */}
                                    {condensedContent && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between bg-zinc-950/60 p-1.5 rounded-xl border border-zinc-850/60">
                                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider pl-2">Lossless Engine Selection</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setCompressionMode('lzw')}
                                                        className={`px-3 py-1 text-[10px] font-mono rounded-lg transition-all ${compressionMode === 'lzw' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                    >
                                                        LZW
                                                    </button>
                                                    <button
                                                        onClick={() => setCompressionMode('gzip')}
                                                        className={`px-3 py-1 text-[10px] font-mono rounded-lg transition-all ${compressionMode === 'gzip' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                    >
                                                        GZIP (Native)
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleSqueeze}
                                                    disabled={isSqueezing}
                                                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
                                                >
                                                    {isSqueezing ? (
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Flame className="w-3.5 h-3.5 text-amber-300" />
                                                    )}
                                                    Squeeze Lossless {compressionMode.toUpperCase()} Block
                                                </button>
                                                <button
                                                    onClick={() => downloadAsFile(`${selectedPreset.id}_condensed.txt`, condensedContent)}
                                                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 px-4 py-2.5 rounded-xl text-zinc-300 font-semibold text-xs flex items-center gap-1.5"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    Export TXT
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* LZW Base64 block results */}
                            {lzwBase64 && (
                                <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">STAGE 2 MATHEMATICAL COMPRESSION</span>
                                                <h5 className="font-bold text-white text-xs">Lossless {compressionMode.toUpperCase()} Base64 Code Block</h5>
                                            </div>
                                        </div>
                                        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
                                            -{lzwRatio}% Code-Space Saved
                                        </span>
                                    </div>

                                    <div className="relative">
                                        <textarea
                                            readOnly
                                            value={lzwBase64}
                                            className="w-full h-24 bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-[11px] font-mono text-zinc-400 focus:outline-none resize-none"
                                        />
                                        <div className="absolute right-3 top-3 flex items-center gap-1.5">
                                            <button 
                                                onClick={() => handleCopy(lzwBase64, 'lzw')}
                                                className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                                                title="Copy Base64 String"
                                            >
                                                {copiedMap['lzw'] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                            <button 
                                                onClick={() => downloadAsFile(`${selectedPreset.id}_squeezed.kb`, lzwBase64)}
                                                className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                                                title="Download as .kb file"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-zinc-400 leading-normal font-mono bg-zinc-950/50 p-3 rounded-xl border border-zinc-900 flex items-center gap-2">
                                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        Your packed block is completely lossless! It can be parsed, synchronized, or reverse decompressed inside the "Extract Block" tab or any compatible LZW virtual system.
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>
                )}

                {/* CALCULATED ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6 bg-zinc-950">
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Stat 1 */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                                <div className="p-3 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-900">
                                    <Binary className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Shannon Entropy</span>
                                    <p className="text-xl font-bold font-mono text-white">
                                        {entropyMetric > 0 ? entropyMetric.toFixed(4) : '0.0000'} <span className="text-xs text-cyan-400">bits</span>
                                    </p>
                                </div>
                            </div>
                            {/* Stat 2 */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                                <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-900">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Vocab Density</span>
                                    <p className="text-xl font-bold font-mono text-white">
                                        {vocabDensity > 0 ? (vocabDensity * 100).toFixed(1) : '0.0'}%
                                    </p>
                                </div>
                            </div>
                            {/* Stat 3 */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                                <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-900">
                                    <LineChart className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Global Meaning Ratio</span>
                                    <p className="text-xl font-bold font-mono text-white">
                                        {combinedDensity > 0 ? combinedDensity : '0.00'} <span className="text-xs text-emerald-400">D</span>
                                    </p>
                                </div>
                            </div>
                            {/* Stat 4 */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                                <div className="p-3 bg-amber-950 text-amber-400 rounded-xl border border-amber-900">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Global Savings</span>
                                    <p className="text-xl font-bold font-mono text-white">
                                        {condenseRatio > 0 ? (100 - (100 - condenseRatio) * (1 - lzwRatio/100)).toFixed(1) : '0.0'}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Compression Calculation Equations Visualizer */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Analytical Equations */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                                <h4 className="font-bold text-white text-sm uppercase tracking-wide border-b border-zinc-800 pb-3 flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-cyan-400" />
                                    Mathematical Equations & Calculation Methods
                                </h4>
                                
                                <div className="space-y-4">
                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-white font-mono">1. Shannon Entropy Formula</span>
                                            <code className="text-[10px] text-zinc-500 font-mono">bits / character</code>
                                        </div>
                                        <div className="bg-zinc-900/60 p-2 rounded-lg text-center font-mono text-sm text-cyan-400">
                                            {"H(X) = - \\sum_{i=1}^n P(x_i) \\log_2 P(x_i)"}
                                        </div>
                                        <p className="text-zinc-400 text-xs leading-relaxed">
                                            Shannon entropy measures the informational unpredictability of character strings. Repetitive text has low entropy, while optimized, noise-free content approaches maximal entropy limits.
                                        </p>
                                    </div>

                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-white font-mono">2. Dynamic Content Density Ratio (D)</span>
                                            <code className="text-[10px] text-zinc-500 font-mono">D_coefficient</code>
                                        </div>
                                        <div className="bg-zinc-900/60 p-2 rounded-lg text-center font-mono text-sm text-purple-400">
                                            {"D = H(X) \\times \\left( \\frac{\\text{Unique Words}}{\\text{Total Words}} \\times 1.5 \\right)"}
                                        </div>
                                        <p className="text-zinc-400 text-xs leading-relaxed">
                                            Measures semantic efficiency by factoring raw character entropy against lexical diversity coefficient. Highlights rich meaning without redundant descriptions.
                                        </p>
                                    </div>

                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-white font-mono">3. LZW Lossless Compression Factor (C)</span>
                                            <code className="text-[10px] text-zinc-500 font-mono">Dictionary Mapping</code>
                                        </div>
                                        <div className="bg-zinc-900/60 p-2 rounded-lg text-center font-mono text-sm text-emerald-400">
                                            {"C_{ratio} = \\frac{\\text{Raw Output Size}}{\\text{LZW Squeezed Size}}"}
                                        </div>
                                        <p className="text-zinc-400 text-xs leading-relaxed">
                                            Lossless LZW maps recurring multi-character phrases into single 16-bit indexes dynamically compiled in a base dictionary, preserving absolute semantic integrity.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Live calculations chart visualizer */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-white text-sm uppercase tracking-wide border-b border-zinc-800 pb-3 flex items-center gap-2">
                                        <LineChart className="w-4 h-4 text-emerald-400" />
                                        Entropy & Density Distribution Graph
                                    </h4>
                                    
                                    <div className="h-48 w-full bg-zinc-950 rounded-xl border border-zinc-850 relative p-4 flex items-end">
                                        {/* Simple SVG Graph representing entropy levels */}
                                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                            {/* Grid lines */}
                                            <line x1="0" y1="20" x2="100" y2="20" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2" />
                                            <line x1="0" y1="50" x2="100" y2="50" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2" />
                                            <line x1="0" y1="80" x2="100" y2="80" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2" />
                                            
                                            {/* Curves or bars based on entropy */}
                                            {entropyMetric > 0 ? (
                                                <>
                                                    <path 
                                                        d={`M 0 100 Q 25 ${100 - (entropyMetric*10)} 50 ${100 - (vocabDensity*100)} T 100 ${100 - (combinedDensity * 12)}`} 
                                                        fill="none" 
                                                        stroke="url(#graphGrad)" 
                                                        strokeWidth="2" 
                                                    />
                                                    <circle cx="50" cy={100 - (vocabDensity*100)} r="4" fill="#a855f7" />
                                                    <circle cx="100" cy={100 - (combinedDensity * 12)} r="4" fill="#06b6d4" />
                                                </>
                                            ) : (
                                                <path d="M 0 95 C 30 95, 40 95, 100 95" fill="none" stroke="#3f3f46" strokeWidth="1.5" />
                                            )}

                                            {/* Definitions */}
                                            <defs>
                                                <linearGradient id="graphGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#06b6d4" />
                                                    <stop offset="50%" stopColor="#a855f7" />
                                                    <stop offset="100%" stopColor="#10b981" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        
                                        {/* Overlay labels */}
                                        <div className="absolute top-3 left-4 text-[9px] font-mono text-zinc-500">Max Entropy Limits</div>
                                        <div className="absolute bottom-3 right-4 text-[9px] font-mono text-zinc-500">Compression Core</div>
                                    </div>

                                    {/* Metrics summary */}
                                    <div className="space-y-3 font-mono text-xs">
                                        <div className="flex justify-between items-center text-zinc-400">
                                            <span>Original Character Volume:</span>
                                            <span className="text-white font-semibold">{rawContent.length} bytes</span>
                                        </div>
                                        <div className="flex justify-between items-center text-zinc-400 border-t border-zinc-800/40 pt-2">
                                            <span>Post Semantic Filter (Condense):</span>
                                            <span className="text-cyan-400 font-semibold">{condensedContent.length} bytes</span>
                                        </div>
                                        <div className="flex justify-between items-center text-zinc-400 border-t border-zinc-800/40 pt-2">
                                            <span>Lossless {compressionMode.toUpperCase()} Base64 Payload:</span>
                                            <span className="text-emerald-400 font-semibold">{lzwBase64.length || 'N/A'} bytes</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setActiveTab('compress')}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 font-bold py-2.5 rounded-xl transition-all font-mono text-xs mt-4"
                                >
                                    ← Back to Compression Workstation
                                </button>
                            </div>

                        </div>

                    </div>
                )}

                {/* EXTRACT & DECOMPRESS TAB */}
                {activeTab === 'decompress' && (
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6 bg-zinc-950">
                        
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-purple-400 font-mono">
                                    <Unlock className="w-3.5 h-3.5" />
                                    REVERSE EXTRACTION PROCESS
                                </div>
                                <h4 className="text-lg font-bold text-white">Reverse Lossless Decompression Station</h4>
                                <p className="text-zinc-400 text-xs leading-relaxed">
                                    Input your Base64-packed LZW or GZIP strings or `.kb` blocks to reverse-map index nodes back to full semantic streams.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Input Compressed Block */}
                            <div className="flex flex-col gap-2">
                                <label className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
                                    Enter Compressed LZW or GZIP Base64 Code
                                </label>
                                <textarea
                                    value={decompressInput}
                                    onChange={(e) => setDecompressInput(e.target.value)}
                                    placeholder="Paste compressed base64 string here (e.g. from a .kb block file)..."
                                    className="h-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none placeholder-zinc-700"
                                />
                                
                                <button
                                    onClick={handleDecompress}
                                    disabled={isDecompressing || !decompressInput.trim()}
                                    className={`w-full py-3 rounded-xl font-bold text-xs tracking-tight text-white flex items-center justify-center gap-2 transition-all ${
                                        !decompressInput.trim() 
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                            : isDecompressing 
                                                ? 'bg-zinc-850 text-zinc-400 cursor-wait'
                                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.01] shadow-[0_4px_12px_rgba(168,85,247,0.15)]'
                                    }`}
                                >
                                    {isDecompressing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Decoding stream indexes...
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="w-4 h-4" />
                                            Reverse Extract & Decompress
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Output Extracted Content */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
                                        Decompressed Output
                                    </label>
                                    {decompressStatus === 'success' && (
                                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
                                            100% Fully Restored (Lossless)
                                        </span>
                                    )}
                                </div>

                                <div className="relative h-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-y-auto font-mono text-xs text-zinc-300">
                                    {decompressStatus === 'success' && decompressedContent ? (
                                        <pre className="whitespace-pre-wrap">{decompressedContent}</pre>
                                    ) : decompressStatus === 'error' ? (
                                        <div className="h-full flex flex-col items-center justify-center text-red-400 text-center px-4 space-y-2">
                                            <AlertCircle className="w-8 h-8 text-red-500" />
                                            <p className="font-bold">Decompression Failed</p>
                                            <p className="text-[11px] text-zinc-500">{errorMessage}</p>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center px-4 space-y-2">
                                            <HelpCircle className="w-8 h-8 text-zinc-700" />
                                            <p>Awaiting decompression stream execution...</p>
                                        </div>
                                    )}
                                    
                                    {decompressStatus === 'success' && decompressedContent && (
                                        <button 
                                            onClick={() => handleCopy(decompressedContent, 'decompressed')}
                                            className="absolute right-3 top-3 p-1.5 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                                            title="Copy Content"
                                        >
                                            {copiedMap['decompressed'] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                </div>

                                {decompressStatus === 'success' && decompressedContent && (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                // Save to TermStudio files in localStorage
                                                const filename = `restored_block_${Date.now().toString().slice(-4)}.txt`;
                                                const updated = [...vFiles, { name: filename, content: decompressedContent }];
                                                localStorage.setItem('termstudio_vfiles', JSON.stringify(updated));
                                                setVFiles(updated);
                                                alert(`Saved restored block to virtual file system as "${filename}"!`);
                                            }}
                                            className="flex-1 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <Database className="w-3.5 h-3.5 text-purple-400" />
                                            Import to TermStudio files
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>

                    </div>
                )}

                {/* LIBRARY TAB */}
                {activeTab === 'condensers' && (
                    <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
                        <div className="max-w-5xl mx-auto space-y-6">
                            
                            <div className="text-center space-y-2 max-w-2xl mx-auto">
                                <h3 className="text-xl font-extrabold text-white">The 30 Quantum Knowledge Condensers Catalog</h3>
                                <p className="text-xs text-zinc-400">
                                    Our modular algorithms filter specialized contexts down to core truths by evaluating high-entropy vectors and lexical frequencies.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {CONDENSER_PRESETS.map((preset, index) => (
                                    <div 
                                        key={preset.id}
                                        className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition-all group"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-start justify-between">
                                                <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/30">
                                                    {preset.category}
                                                </span>
                                                <span className="text-[10px] font-mono text-zinc-500">
                                                    #{index + 1}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-white group-hover:text-cyan-300 transition-colors text-sm">
                                                {preset.name}
                                            </h4>
                                            <p className="text-zinc-400 text-xs leading-relaxed">
                                                {preset.description}
                                            </p>
                                        </div>

                                        <div className="pt-4 border-t border-zinc-800/60 mt-4 space-y-3">
                                            <div className="bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-900 overflow-x-auto">
                                                <code className="text-[10px] font-mono text-purple-400 block whitespace-nowrap">
                                                    {preset.mathFormula}
                                                </code>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                                                <span>Ratio: <span className="text-emerald-400">{preset.efficiencyRating}</span></span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedPresetId(preset.id);
                                                        setActiveTab('compress');
                                                    }}
                                                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                                                >
                                                    Deploy Filter
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
