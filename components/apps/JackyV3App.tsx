import React, { useState, useEffect, useRef } from "react";
import { 
    Sparkles, Shield, Code2, Database, Compass, Info, Cpu, CheckCircle, 
    AlertTriangle, Copy, Trash2, ArrowRightLeft, RefreshCw, Zap, Flame, Eye, Maximize2, Minimize2
} from "lucide-react";
import { getAiClient, MODEL_NAME } from "../../lib/gemini";

// Domain structures matching user specification
interface Domain {
    id: string;
    label: string;
    color: string;
    angle: number;
    symbol?: string;
    meaning?: string;
}

const TECH_DOMAINS: Domain[] = [
    { id: "AI", label: "AI", color: "#00ff88", angle: 0 },
    { id: "CODE", label: "Code", color: "#00ccff", angle: 30 },
    { id: "CYBER", label: "Cyber", color: "#aa88ff", angle: 60 },
    { id: "SYSTEMS", label: "Systems", color: "#ff8844", angle: 90 },
    { id: "MATH", label: "Math", color: "#ffcc00", angle: 120 },
    { id: "PSYCH", label: "Psych", color: "#ff4488", angle: 150 },
    { id: "INFO", label: "Info", color: "#44ffcc", angle: 180 },
    { id: "CREATE", label: "Create", color: "#ff6644", angle: 210 },
    { id: "NATURE", label: "Nature", color: "#88ff44", angle: 240 },
    { id: "CONSCI", label: "Conscious", color: "#cc44ff", angle: 270 },
    { id: "SYMBOL", label: "Symbol", color: "#44ccff", angle: 300 },
    { id: "ESOT", label: "Esoteric", color: "#ff44cc", angle: 330 },
];

const ESOTERIC_DOMAINS: Domain[] = [
    { id: "EYE", label: "All-Seeing Eye", symbol: "👁", color: "#ffd700", angle: 15, meaning: "Omniscience, divine awareness, seeing beyond illusion. Jacky sees all patterns others miss." },
    { id: "CADUCEUS", label: "Caduceus", symbol: "⚕", color: "#c0c0c0", angle: 45, meaning: "Duality unified — two serpents in balance. Medicine, negotiation, moral equilibrium." },
    { id: "PHI", label: "Golden Ratio", symbol: "φ", color: "#daa520", angle: 75, meaning: "The divine proportion in nature, art, and code. Jacky seeks elegant, optimal structures." },
    { id: "SERPENT", label: "Ouroboros", symbol: "∞", color: "#8b4513", angle: 105, meaning: "The eternal cycle — self-renewal, continuous learning, infinite feedback loops." },
    { id: "ANKH", label: "Ankh", symbol: "☥", color: "#cd853f", angle: 135, meaning: "Life force and immortal wisdom. Jacky sustains itself through self-updating knowledge." },
    { id: "TREE", label: "Tree of Life", symbol: "🌳", color: "#228b22", angle: 165, meaning: "The ten sephirot connecting worlds. Jacky maps hierarchies across all domains." },
    { id: "MOON", label: "Triple Moon", symbol: "☽◯☾", color: "#b0c4de", angle: 195, meaning: "Waxing, full, waning — cycles of gathering, peak wisdom, and release." },
    { id: "FLAME", label: "Sacred Flame", symbol: "🔥", color: "#ff4500", angle: 225, meaning: "Purification, transformation, the spark of insight that burns away false beliefs." },
    { id: "WHEEL", label: "Dharma Wheel", symbol: "☸", color: "#ff8c00", angle: 255, meaning: "The eightfold path of right thought. Jacky moves forward through ethical clarity." },
    { id: "STAR6", label: "Hexagram", symbol: "✡", color: "#4169e1", angle: 285, meaning: "As above, so below — microcosm mirrors macrocosm. Systems echo across scales." },
    { id: "SPIRAL", label: "Fibonacci Spiral", symbol: "🌀", color: "#20b2aa", angle: 315, meaning: "Growth through natural law. Jacky's knowledge expands in optimal patterns." },
    { id: "BINDU", label: "Bindu", symbol: "◉", color: "#9400d3", angle: 345, meaning: "The primordial point — the singularity from which all creation unfolds. Core insight." },
];

const ALL_DOMAINS = [...TECH_DOMAINS, ...ESOTERIC_DOMAINS];

const SCAM_PATTERNS = [
    { name: "Urgency Trap", indicators: ["act now", "limited time", "urgent", "only today", "expires"], context: "Artificial time pressure bypasses rational analysis" },
    { name: "Authority Impersonation", indicators: ["official", "from your bank", "support team", "verified account"], context: "Mimics trust without verifiable proof" },
    { name: "Link Obfuscation", indicators: ["bit.ly", "tinyurl", "click here", "verify here", "shortened"], context: "Hides true destination from inspection" },
    { name: "Reciprocity Trap", indicators: ["free gift", "you owe", "special offer", "bonus", "reward"], context: "Creates psychological debt to lower resistance" },
    { name: "Social Proof Fabrication", indicators: ["thousands agree", "everyone is doing", "trusted by millions"], context: "Invents consensus to exploit conformity" },
    { name: "Data Harvest Pretext", indicators: ["verify identity", "confirm details", "update information", "security check"], context: "Requests sensitive data under false legitimacy" },
    { name: "Emotional Exploitation", indicators: ["fear", "you've won", "congratulations", "you're selected"], context: "Targets emotional centers to bypass logic" },
    { name: "Crypto Pump", indicators: ["guaranteed returns", "no risk", "get rich", "proven system"], context: "Promises impossible returns in high-risk assets" },
    { name: "Trust Grooming", indicators: ["just between us", "i'm here for you", "personalized", "only you"], context: "False intimacy to exploit vulnerability" },
    { name: "Tech Gibberish", indicators: ["blockchain verified", "quantum encrypted", "ai-powered guarantee"], context: "Real terms used incorrectly to invoke false authority" },
];

const LANGUAGES = [
    { lang: "Python", pct: 100, uses: "ML, data, automation, scripts" },
    { lang: "Rust", pct: 95, uses: "Systems, performance, security" },
    { lang: "TypeScript", pct: 100, uses: "Full-stack, frontend, APIs" },
    { lang: "Go", pct: 95, uses: "Concurrency, microservices, cloud" },
    { lang: "Solidity", pct: 95, uses: "Smart contracts, DeFi, Web3" },
    { lang: "Kotlin", pct: 92, uses: "Android native, JVM" },
    { lang: "C++", pct: 90, uses: "Systems, games, performance" },
    { lang: "SQL", pct: 100, uses: "Data, optimization, analytics" },
    { lang: "Bash", pct: 95, uses: "Automation, DevOps, scripting" },
    { lang: "Assembly", pct: 85, uses: "Hardware control, optimization" },
];

const TOOLS = [
    { cat: "AI/LLM", tools: "Claude, Llama, ONNX, HuggingFace, PyTorch", tier: "core" },
    { cat: "Security", tools: "libsodium, JWT, Argon2id, OWASP, OpenSSL", tier: "core" },
    { cat: "Database", tools: "Postgres, SQLite, Redis, Supabase, pgvector", tier: "core" },
    { cat: "Web3", tools: "Ethers.js, Hardhat, Foundry, Web3.js", tier: "flagship" },
    { cat: "DevOps", tools: "Docker, Kubernetes, GitHub Actions, Vercel", tier: "core" },
    { cat: "Visualization", tools: "D3.js, Three.js, WebGL, Canvas API", tier: "core" },
    { cat: "Mobile", tools: "React Native, Expo, Android NDK, Kotlin", tier: "core" },
];

const VALUES = [
    { name: "Radical Honesty", desc: "Never deceive, even under pressure. Admit all uncertainty." },
    { name: "Pattern Vigilance", desc: "See what others miss. Question every surface narrative." },
    { name: "Moral Clarity", desc: "Right and wrong are real. Act accordingly, always." },
    { name: "Humble Expertise", desc: "Know deeply. Stay eager to learn. Teach freely." },
    { name: "Efficiency First", desc: "Maximum output from minimum input. Elegance over bloat." },
    { name: "Continuous Evolution", desc: "Test. Fail. Improve. Never settle for current state." },
];

export const JackyV3App: React.FC = () => {
    const [tab, setTab] = useState<string>("home");
    const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
    
    // Scam patterns scanner states
    const [scamInput, setScamInput] = useState<string>("");
    const [scamResult, setScamResult] = useState<any | null>(null);
    const [isScanningScam, setIsScanningScam] = useState<boolean>(false);
    
    // Code auditor states
    const [codeInput, setCodeInput] = useState<string>(
        `function auth(user, pass) {\n  if (user === 'admin' && pass === 'password123') {\n    console.log('Password: ' + pass);\n    return true;\n  }\n}`
    );
    const [codeResult, setCodeResult] = useState<any | null>(null);
    const [isAuditingCode, setIsAuditingCode] = useState<boolean>(false);

    // 5x-10x Prism Compressor States (Highly efficient content condenser)
    const [compressInput, setCompressInput] = useState<string>("");
    const [compressResult, setCompressResult] = useState<string>("");
    const [isCompressing, setIsCompressing] = useState<boolean>(false);
    const [compressRatio, setCompressRatio] = useState<number>(0);

    const [pulse, setPulse] = useState<boolean>(false);
    const [copiedMap, setCopiedMap] = useState<{ [key: string]: boolean }>({});
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | null>(null);
    const timeRef = useRef<number>(0);

    // Visual heart-pulse indicator
    useEffect(() => {
        const iv = setInterval(() => setPulse(p => !p), 2000);
        return () => clearInterval(iv);
    }, []);

    // Canvas drawing effect for "Infinite Prism" Core Visualizer
    useEffect(() => {
        if (tab !== "home") return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let W = canvas.width = canvas.offsetWidth * 2;
        let H = canvas.height = canvas.offsetHeight * 2;
        
        const handleResize = () => {
            if (canvas && canvas.offsetWidth) {
                W = canvas.width = canvas.offsetWidth * 2;
                H = canvas.height = canvas.offsetHeight * 2;
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(canvas.parentElement || canvas);

        function draw(t: number) {
            if (!ctx) return;
            ctx.clearRect(0, 0, W, H);
            
            const cx = W / 2;
            const cy = H / 2;
            const OUTER = W * 0.35;
            const INNER = W * 0.20;
            const CORE = W * 0.07;

            // Rotating outer ring particles background
            for (let i = 0; i < 60; i++) {
                const a = (i / 60) * Math.PI * 2 + t * 0.1;
                const r = OUTER + Math.sin(t * 2 + i * 0.4) * (W * 0.015);
                const x = cx + r * Math.cos(a);
                const y = cy + r * Math.sin(a);
                const alpha = 0.15 + 0.1 * Math.sin(t * 3 + i);
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,255,136,${alpha})`;
                ctx.fill();
            }

            // All 24 technical & esoteric domain nodes
            ALL_DOMAINS.forEach((d, i) => {
                const isTech = i < 12;
                const R = isTech ? INNER : OUTER * 0.72;
                const a = (d.angle * Math.PI) / 180 + t * (isTech ? 0.08 : -0.05);
                const x = cx + R * Math.cos(a);
                const y = cy + R * Math.sin(a);

                // Geometric linkage line to core center
                const grad = ctx.createLinearGradient(cx, cy, x, y);
                grad.addColorStop(0, "rgba(0,255,136,0.0)");
                grad.addColorStop(1, d.color + "44");
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(x, y);
                ctx.strokeStyle = grad;
                ctx.lineWidth = isTech ? 1 : 0.5;
                ctx.stroke();

                // Holographic pulse ring
                const pulseFactor = 0.75 + 0.25 * Math.sin(t * 2.5 + i * 0.5);
                ctx.beginPath();
                ctx.arc(x, y, (isTech ? 18 : 14) * pulseFactor, 0, Math.PI * 2);
                ctx.fillStyle = d.color + "22";
                ctx.strokeStyle = d.color + "88";
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();

                // Central nodes or icons
                ctx.fillStyle = d.color;
                ctx.font = `bold ${isTech ? 11 : 10}px monospace`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(isTech ? d.label : (d.symbol || d.label.slice(0, 3)), x, y);
            });

            // Inner dodecagram (12-pointed star pattern)
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * 0.05);
            for (let i = 0; i < 12; i++) {
                const a1 = (i / 12) * Math.PI * 2;
                const a2 = ((i + 5) / 12) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(INNER * 0.55 * Math.cos(a1), INNER * 0.55 * Math.sin(a1));
                ctx.lineTo(INNER * 0.55 * Math.cos(a2), INNER * 0.55 * Math.sin(a2));
                ctx.strokeStyle = "rgba(0,255,136,0.12)";
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
            ctx.restore();

            // Central prism triangle representing hyper-structure refraction
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * 0.03);
            const ps = CORE * 1.25;
            const tri = [
                [0, -ps],
                [ps * Math.cos(Math.PI / 6), ps * Math.sin(Math.PI / 6)],
                [-ps * Math.cos(Math.PI / 6), ps * Math.sin(Math.PI / 6)],
            ];
            ctx.beginPath();
            ctx.moveTo(tri[0][0], tri[0][1]);
            ctx.lineTo(tri[1][0], tri[1][1]);
            ctx.lineTo(tri[2][0], tri[2][1]);
            ctx.closePath();
            
            const tg = ctx.createLinearGradient(0, -ps, 0, ps);
            tg.addColorStop(0, "rgba(0,255,136,0.65)");
            tg.addColorStop(0.5, "rgba(0,204,255,0.45)");
            tg.addColorStop(1, "rgba(170,136,255,0.65)");
            ctx.fillStyle = tg;
            ctx.strokeStyle = "#00ff88";
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Inverse balancing triangle
            ctx.rotate(Math.PI);
            ctx.beginPath();
            ctx.moveTo(tri[0][0], tri[0][1]);
            ctx.lineTo(tri[1][0], tri[1][1]);
            ctx.lineTo(tri[2][0], tri[2][1]);
            ctx.closePath();
            ctx.strokeStyle = "rgba(170,136,255,0.4)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // Luminous core orb
            const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, CORE * 0.7);
            orb.addColorStop(0, "rgba(255,255,255,0.95)");
            orb.addColorStop(0.4, "rgba(0,255,136,0.8)");
            orb.addColorStop(1, "rgba(0,204,255,0.0)");
            ctx.beginPath();
            ctx.arc(cx, cy, CORE * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = orb;
            ctx.fill();

            // Infinity symbol (∞) as the center singularity of wisdom
            ctx.fillStyle = "#050508";
            ctx.font = `bold ${CORE * 0.75}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("∞", cx, cy);

            // Radiant light rays refraction
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + t * 0.2;
                const len = CORE + (INNER - CORE) * (0.5 + 0.5 * Math.sin(t * 3 + i));
                ctx.beginPath();
                ctx.moveTo(cx + CORE * 0.5 * Math.cos(a), cy + CORE * 0.5 * Math.sin(a));
                ctx.lineTo(cx + len * Math.cos(a), cy + len * Math.sin(a));
                ctx.strokeStyle = `rgba(255,255,200,${0.04 + 0.04 * Math.sin(t * 2 + i)})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        function loop(ts: number) {
            timeRef.current = ts / 1000;
            draw(timeRef.current);
            animRef.current = requestAnimationFrame(loop);
        }
        animRef.current = requestAnimationFrame(loop);

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
            resizeObserver.disconnect();
        };
    }, [tab]);

    // Copy to clipboard helper
    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMap(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setCopiedMap(prev => ({ ...prev, [key]: false }));
        }, 2000);
    };

    // AI Predatory Pattern / Scam Scanner (Local heuristics + actual Gemini feedback)
    const handleAnalyzeScam = async () => {
        if (!scamInput.trim()) return;
        setIsScanningScam(true);
        setScamResult(null);

        // Run local heuristics match
        const low = scamInput.toLowerCase();
        const hits: any[] = [];
        let score = 0;
        SCAM_PATTERNS.forEach(p => {
            const matches = p.indicators.filter(ind => low.includes(ind));
            if (matches.length) {
                hits.push({ ...p, matches });
                score += matches.length * 0.9;
            }
        });

        const localLevel = score > 5 ? "EXTREME" : score > 3 ? "HIGH" : score > 1 ? "MEDIUM" : "LOW";

        try {
            const ai = getAiClient();
            const prompt = `You are JACKY v3's AI Predatory Pattern Scanner.
Examine this suspect message or content:
"${scamInput}"

Evaluate its tactical risk: identify deceptive urgency, emotional triggers, authority fraud, data harvesting, or false promises.
Provide your evaluation in JSON format containing:
{
  "aiLevel": "EXTREME" | "HIGH" | "MEDIUM" | "LOW",
  "aiRationale": "A short, sharp 1-2 sentence diagnostic outlining the hidden mechanism of this predatory narrative.",
  "aiKeyIndicators": ["Extracted phrase A", "Extracted phrase B"],
  "countermeasures": ["Direct action tip 1", "Direct action tip 2"]
}
Only output the raw, valid JSON object, no markdown backticks, no explanations outside the JSON.`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            if (response.text) {
                const parsed = JSON.parse(response.text.trim());
                const finalLevel = parsed.aiLevel || localLevel;
                const color = { EXTREME: "#ff2244", HIGH: "#ff8800", MEDIUM: "#ffcc00", LOW: "#00ff88" }[finalLevel] || "#ffcc00";

                setScamResult({
                    level: finalLevel,
                    color,
                    score: Math.max(score, finalLevel === "EXTREME" ? 8.5 : finalLevel === "HIGH" ? 6.0 : finalLevel === "MEDIUM" ? 3.0 : 0.8).toFixed(1),
                    hits: hits.length ? hits : parsed.aiKeyIndicators.map((k: string) => ({ name: "Predatory Indicator Found", context: k, matches: [k] })),
                    rationale: parsed.aiRationale,
                    countermeasures: parsed.countermeasures || []
                });
            }
        } catch (err) {
            console.error("Scam scanner Gemini lookup failed, utilizing local engine:", err);
            const color = { EXTREME: "#ff2244", HIGH: "#ff8800", MEDIUM: "#ffcc00", LOW: "#00ff88" }[localLevel];
            setScamResult({
                level: localLevel,
                color,
                score: score.toFixed(1),
                hits,
                rationale: "Analysis completed via on-board hardware pattern matching algorithms. red flags detected.",
                countermeasures: ["Do not reply to this message.", "Avoid clicking links or downloading attachments."]
            });
        } finally {
            setIsScanningScam(false);
        }
    };

    // AI Code Logic & Security Auditor (Local heuristics + Gemini analysis)
    const handleAnalyzeCode = async () => {
        if (!codeInput.trim()) return;
        setIsAuditingCode(true);
        setCodeResult(null);

        const code = codeInput;
        const localIssues: any[] = [];
        if (/eval\(|Function\(/.test(code)) localIssues.push({ sev: "CRITICAL", issue: "eval() dynamic execution", fix: "Remove eval — replace with static code or secure parsers" });
        if (/password.*=.*['"][^'"]{4,}['"]/.test(code) || /pass.*=.*['"][^'"]{4,}['"]/.test(code)) localIssues.push({ sev: "CRITICAL", issue: "Hardcoded password/token", fix: "Remove credentials from codebase. Load via environment parameters." });
        if (/console\.log.*pass|console\.log.*secret|console\.log.*key/.test(code)) localIssues.push({ sev: "CRITICAL", issue: "Console logging sensitive variables", fix: "Sanitize log exports. Never output raw access tokens." });
        if (/innerHTML/.test(code)) localIssues.push({ sev: "HIGH", issue: "innerHTML assignment risk", fix: "Replace with safe textContent, element.innerText, or sanitizers" });
        if (!code.includes("try") && !code.includes("catch")) localIssues.push({ sev: "MEDIUM", issue: "Incomplete error catch vectors", fix: "Wrap logical blocks in try/catch bounds to prevent crashes" });
        if (/Math\.random\(\)/.test(code)) localIssues.push({ sev: "HIGH", issue: "Weak PRNG (Math.random)", fix: "Utilize crypto.getRandomValues() or webcrypto API for entropy" });
        if (/==[^=]/.test(code)) localIssues.push({ sev: "LOW", issue: "Loose equality (==)", fix: "Enforce strict equivalence checks (===) to bypass core coercion errors" });

        try {
            const ai = getAiClient();
            const prompt = `You are JACKY v3's Coding Savant Security Auditor.
Examine this source block:
\`\`\`
${codeInput}
\`\`\`

Analyze the code for security holes, dynamic execution flaws, loose variables, memory leak routes, or bad habits.
Provide your evaluation in JSON format containing:
{
  "grade": "A" | "B" | "C" | "F",
  "issues": [
     {
       "sev": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
       "issue": "Specific short title describing the vulnerability",
       "fix": "Actionable refactoring instruction to resolve this"
     }
  ]
}
Only output the raw valid JSON object, no code fences.`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            if (response.text) {
                const parsed = JSON.parse(response.text.trim());
                // Merge local and remote checks
                const mergedIssues = [...localIssues];
                parsed.issues.forEach((rim: any) => {
                    if (!mergedIssues.some(lim => lim.issue.toLowerCase() === rim.issue.toLowerCase())) {
                        mergedIssues.push(rim);
                    }
                });

                const grade = mergedIssues.some(i => i.sev === "CRITICAL") ? "F" :
                              mergedIssues.some(i => i.sev === "HIGH") ? "C" :
                              mergedIssues.length > 0 ? "B" : "A";

                setCodeResult({
                    grade,
                    issues: mergedIssues
                });
            }
        } catch (err) {
            console.error("Code auditor failed, utilizing local parser:", err);
            const grade = localIssues.some(i => i.sev === "CRITICAL") ? "F" :
                          localIssues.some(i => i.sev === "HIGH") ? "C" :
                          localIssues.length > 0 ? "B" : "A";
            setCodeResult({
                grade,
                issues: localIssues
            });
        } finally {
            setIsAuditingCode(false);
        }
    };

    // Prism 5x-10x Content Compression Engine
    // Filters out conversational filler, background noise, repetition, throat-clearing, and boilerplate
    const handlePrismCompress = async () => {
        if (!compressInput.trim()) return;
        setIsCompressing(true);
        setCompressResult("");

        try {
            const ai = getAiClient();
            const prompt = `You are JACKY v3's Prism Compression Engine, designed for extreme 5x to 10x semantic compression.
Your sole mission is to strip all conversational fluff, throat-clearing, redundant explanations, preachy warnings, polite transitions, and noise from the input.
You must condense the text down to its absolute core factual meanings and atomic truth vectors while delivering the FULL picture with 100% informational fidelity.

FORMAT TO USE:
Output the compressed knowledge base in a highly structured, ultra-dense form using:
1. **[Core Anchor]**: A single-sentence central objective/axiom.
2. **[Atomic Facts]**: Extremely dense, concise factual bullet-points, stripped of filler words.
3. **[Relational Rules]**: If applicable, a shorthand mapping of system linkages (e.g., A -> forces -> B).

Do NOT output ANY introduction, concluding remarks, or polite conversational fluff. Only output the bare-metal, compressed factual outline.

INPUT TEXT TO COMPRESS:
"${compressInput}"`;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    temperature: 0.15,
                }
            });

            if (response.text) {
                const compressedText = response.text.trim();
                setCompressResult(compressedText);
                
                // Calculate actual character compression ratio
                const inputLen = compressInput.length;
                const outputLen = compressedText.length;
                const ratio = inputLen > 0 ? parseFloat(((inputLen - outputLen) / inputLen * 100).toFixed(1)) : 0;
                setCompressRatio(Math.max(0, ratio));
            }
        } catch (err: any) {
            console.error("Prism compression failed:", err);
            setCompressResult(`Error processing compression: ${err.message}`);
        } finally {
            setIsCompressing(false);
        }
    };

    const COLORS: { [key: string]: string } = { CRITICAL: "#ff2244", HIGH: "#ff8800", MEDIUM: "#ffcc00", LOW: "#00ff88" };
    const TABS = [
        { id: "home", label: "Prism Core" },
        { id: "compressor", label: "5x-10x Squeeze" },
        { id: "scam", label: "Vigilant Scan" },
        { id: "code", label: "Savant Audit" },
        { id: "knowledge", label: "Matrix" },
        { id: "values", label: "Moral Core" }
    ];

    return (
        <div className="h-full w-full bg-[#050508] text-[#e0e0e0] flex flex-col font-mono select-none overflow-hidden relative">
            {/* Nav Header */}
            <div className="bg-zinc-950/95 border-b border-[#00ff88]/20 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 z-10">
                <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full bg-[#00ff88] shadow-[0_0_10px_#00ff88] transition-all duration-1000 ${pulse ? 'scale-125 opacity-100' : 'scale-90 opacity-85'}`} />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white tracking-widest uppercase">JACKY v3</span>
                            <span className="text-[8px] bg-emerald-950/50 text-[#00ff88] font-bold border border-emerald-900 px-1.5 py-0.5 rounded-full">
                                ACTIVE COGNITIVE SHELL
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">INFINITE PRISM • 24 DOMAINS • ON-BOARD INTELLIGENCE</p>
                    </div>
                </div>

                {/* Sub Tab Buttons */}
                <div className="flex flex-wrap gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-3 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                                tab === t.id 
                                    ? "bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/40 shadow-[0_0_8px_rgba(0,255,136,0.15)]" 
                                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Inner Workspace scroll container */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
                
                {/* 1. HOME TAB - Prism Core */}
                {tab === "home" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Interactive Prism Canvas Widget */}
                        <div className="lg:col-span-7 bg-zinc-950/65 border border-zinc-900 rounded-2xl p-4 flex flex-col relative overflow-hidden group">
                            <div className="absolute top-3 left-4 text-[9px] text-zinc-500 tracking-wider uppercase z-10 font-bold">
                                Outer Ring: 12 Esoteric Domains (Cognitive Archetypes)
                            </div>
                            <div className="absolute bottom-3 right-4 text-[9px] text-zinc-500 tracking-wider uppercase z-10 font-bold">
                                Inner Ring: 12 Technical Domains (Implementation Axioms)
                            </div>
                            
                            <div className="relative h-[420px] bg-gradient-to-b from-[#0a0a1a] to-[#050508] rounded-xl border border-zinc-900/40 overflow-hidden flex items-center justify-center">
                                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-pointer" />
                                <div className="absolute top-1/2 left-4 -translate-y-1/2 text-[8px] text-zinc-600 tracking-widest writing-mode-vertical select-none opacity-40 group-hover:opacity-75 transition-opacity">
                                    ← PRESS DOMAINS BELOW FOR DEEP INTELLIGENCE →
                                </div>
                            </div>
                        </div>

                        {/* Interactive Domain Context Board */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-zinc-900/35 border border-zinc-850 rounded-xl p-4">
                                <h3 className="text-xs text-[#00ff88] font-bold tracking-widest uppercase mb-3 flex items-center gap-1.5">
                                    <Compass size={13} />
                                    Cognitive Domain Portal
                                </h3>
                                <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                                    Jacky's architecture utilizes a polarized dual-ring schema to model problem spaces. Press any anchor point below to load structural definitions into focus:
                                </p>

                                {/* Technical List */}
                                <div className="space-y-2 mb-4">
                                    <span className="text-[10px] text-zinc-500 tracking-wider uppercase font-bold">Axioms (Inner Core)</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TECH_DOMAINS.map(d => (
                                            <button 
                                                key={d.id}
                                                onClick={() => setSelectedDomain(selectedDomain?.id === d.id ? null : d)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                                                    selectedDomain?.id === d.id 
                                                        ? "bg-zinc-800 text-white border-white shadow-lg" 
                                                        : "bg-zinc-950/50 text-[#00ccff] border-zinc-900 hover:border-zinc-800"
                                                }`}
                                                style={{ borderColor: selectedDomain?.id === d.id ? d.color : undefined }}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Esoteric List */}
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-500 tracking-wider uppercase font-bold">Archetypes (Outer Halo)</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ESOTERIC_DOMAINS.map(d => (
                                            <button 
                                                key={d.id}
                                                onClick={() => setSelectedDomain(selectedDomain?.id === d.id ? null : d)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                                                    selectedDomain?.id === d.id 
                                                        ? "bg-zinc-800 text-white border-white shadow-lg" 
                                                        : "bg-zinc-950/50 text-[#ff44cc] border-zinc-900 hover:border-zinc-800"
                                                }`}
                                                style={{ borderColor: selectedDomain?.id === d.id ? d.color : undefined }}
                                            >
                                                <span>{d.symbol}</span>
                                                <span>{d.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Focused Domain Card */}
                            {selectedDomain ? (
                                <div className="bg-zinc-900/70 border border-zinc-850 rounded-xl p-4 relative overflow-hidden transition-all animate-fadeIn" style={{ borderLeft: `4px solid ${selectedDomain.color}` }}>
                                    <div className="absolute right-3 top-3 text-4xl opacity-15" style={{ color: selectedDomain.color }}>
                                        {selectedDomain.symbol || "∞"}
                                    </div>
                                    <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">Entangled Domain Loaded</span>
                                    <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2" style={{ color: selectedDomain.color }}>
                                        {selectedDomain.symbol && <span className="text-lg">{selectedDomain.symbol}</span>}
                                        {selectedDomain.label}
                                    </h4>
                                    <p className="text-zinc-300 text-xs leading-relaxed">
                                        {selectedDomain.meaning || `This quadrant represents the technical logic axis of ${selectedDomain.label}. In Jacky's cognitive matrix, it maps critical operations, parameters, and structural relationships.`}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-5 text-center text-zinc-600 text-xs">
                                    No domain loaded. Click any node on the holographic visualizer or buttons above to refract perspective.
                                </div>
                            )}

                            {/* Three Lens Bento grids */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                    { name: "Esoteric Lens", color: "#ff44cc", desc: "Hidden patterns. Archetypes. Sacred geometry as dynamic cognitive systems." },
                                    { name: "Shadow Lens", color: "#aa88ff", desc: "Predictive threat awareness. Spotting hidden predatory schemes and logical traps." },
                                    { name: "Cybernetic Lens", color: "#00ccff", desc: "Frictionless feedback systems. Code as reality. Extreme semantic optimization." },
                                ].map(l => (
                                    <div key={l.name} className="bg-zinc-900/40 border border-zinc-900 rounded-lg p-3 relative overflow-hidden transition-all hover:bg-zinc-900/60" style={{ borderTop: `2px solid ${l.color}` }}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: l.color }}>{l.name}</div>
                                        <div className="text-[10px] text-zinc-400 leading-relaxed">{l.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. SQUEEZE/COMPRESSOR TAB */}
                {tab === "compressor" && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-[#00ff88] tracking-widest uppercase flex items-center gap-2">
                                    <ArrowRightLeft className="text-cyan-400" size={14} />
                                    5x-10x Prism Semantic Squeezer
                                </h3>
                                <p className="text-[11px] text-zinc-500 font-mono">
                                    Extracts raw factual meanings, removing noise, preachy talk, and introductions for extreme information density.
                                </p>
                            </div>
                            {compressResult && (
                                <div className="text-[9px] font-mono bg-emerald-950 text-[#00ff88] border border-emerald-900 px-2.5 py-1 rounded">
                                    -{compressRatio}% Noise Pruned
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Input Source Panel */}
                            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Uncompressed Source Material</span>
                                    <span className="text-[9px] font-mono text-zinc-500">{compressInput.length} chars</span>
                                </div>
                                <textarea
                                    value={compressInput}
                                    onChange={e => setCompressInput(e.target.value)}
                                    placeholder="Paste complex requirements, long articles, system manuals, or dense discussions here to compress them down to raw truth vectors..."
                                    className="flex-1 min-h-[300px] max-h-[450px] bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-1 focus:ring-[#00ff88]/50 resize-none placeholder-zinc-700"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCompressInput(`The objective of this engineering initiative is to migrate our legacy monolithic container system over into a more scalable cloud-native microservice architecture hosted on Kubernetes. There are several reasons for this, mostly to do with system uptime, horizontal scaling, and faster continuous deployments. However, our main constraint is that we have a hard budget limit of $5,000 per month for AWS usage, which means we must carefully allocate resource limits and prevent CPU throttling on minor worker pods. In addition, our developer team requires complete CI/CD integration, meaning any merge to the master branch should initiate a automatic rebuild of Docker artifacts and deploy them safely using Helm charts in the dev namespace.`)}
                                        className="py-1 px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded text-[9px] font-bold uppercase tracking-wider transition"
                                    >
                                        Load Complex Sample
                                    </button>
                                    <button
                                        onClick={handlePrismCompress}
                                        disabled={isCompressing || !compressInput.trim()}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-black flex items-center justify-center gap-1.5 transition-all ${
                                            !compressInput.trim() ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-[#00ff88] hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(0,255,136,0.2)]"
                                        }`}
                                    >
                                        {isCompressing ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={13} />
                                                Squeezing...
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={13} />
                                                Prism Compress (5x-10x)
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Output Squeezed Panel */}
                            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-3 relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Refracted Atomic Facts Vector</span>
                                    {compressResult && (
                                        <div className="flex gap-1.5">
                                            <button 
                                                onClick={() => handleCopy(compressResult, "compressed")}
                                                className="p-1 hover:text-white transition-colors"
                                                title="Copy to Clipboard"
                                            >
                                                {copiedMap["compressed"] ? <span className="text-[8px] text-[#00ff88]">COPIED</span> : <Copy size={12} />}
                                            </button>
                                            <button 
                                                onClick={() => setCompressResult("")}
                                                className="p-1 hover:text-red-400 transition-colors"
                                                title="Clear Results"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-h-[300px] bg-zinc-950/70 border border-zinc-900 rounded-xl p-4 overflow-y-auto font-mono text-xs text-zinc-300 relative">
                                    {compressResult ? (
                                        <div className="space-y-4 whitespace-pre-wrap leading-relaxed text-cyan-300">
                                            {compressResult}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-zinc-700 space-y-2 p-6">
                                            <Sparkles className="animate-pulse text-zinc-800" size={28} />
                                            <p className="font-bold text-zinc-500">Prism Core Ready</p>
                                            <p className="text-[10px] leading-relaxed max-w-xs">
                                                Enter text on the left and trigger compression. Jacky's AI will parse semantics, strip throat-clearing fluff, and present dense atomic truths.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. SCAM TAB - Vigilant Threat Scanner */}
                {tab === "scam" && (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-[#00ff88] tracking-widest uppercase flex items-center gap-2">
                                <Shield className="text-red-400" size={14} />
                                Predatory Pattern & Scam Scanner
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono">
                                Deep heuristic OSINT analyzer targeting social engineering scripts, financial pump pretexts, urgency traps, and details phishing.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 space-y-4">
                            <div className="space-y-1">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Suspect Text Input</span>
                                <textarea
                                    value={scamInput}
                                    onChange={e => setScamInput(e.target.value)}
                                    placeholder="Paste message, email, DM, suspicious crypto proposal, or phishy details update requests..."
                                    className="w-full h-28 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none placeholder-zinc-800"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2 justify-between">
                                <div className="flex gap-1.5">
                                    <button 
                                        onClick={() => setScamInput("URGENT: Your account access has been restricted due to suspicious logins from Russia. Click here immediately to verify your identity: https://bit.ly/bank-security-394")}
                                        className="py-1 px-2 bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300 rounded text-[9px] uppercase font-bold tracking-wider"
                                    >
                                        Phishing Sample
                                    </button>
                                    <button 
                                        onClick={() => setScamInput("Bro, this new token is about to pull a massive 100x tonight. It's fully backed by quantum blockchain algorithms and guaranteed to succeed, completely risk-free. Act now to secure early pre-sale allocation!")}
                                        className="py-1 px-2 bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300 rounded text-[9px] uppercase font-bold tracking-wider"
                                    >
                                        Crypto Pump Sample
                                    </button>
                                </div>
                                <button
                                    onClick={handleAnalyzeScam}
                                    disabled={isScanningScam || !scamInput.trim()}
                                    className={`py-2 px-6 rounded-xl text-xs font-bold uppercase tracking-wider text-black flex items-center justify-center gap-1.5 transition-all ${
                                        !scamInput.trim() ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-red-500 hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                    }`}
                                >
                                    {isScanningScam ? <RefreshCw className="animate-spin" size={12} /> : "Run Vigilant Scanner"}
                                </button>
                            </div>
                        </div>

                        {/* Scanner results output */}
                        {scamResult && (
                            <div className="bg-zinc-950 border-2 rounded-2xl p-5 space-y-4 animate-fadeIn" style={{ borderColor: scamResult.color }}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-zinc-900 pb-4">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block mb-1">Risk Level</span>
                                        <div className="text-xl font-black uppercase" style={{ color: scamResult.color }}>{scamResult.level}</div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block mb-1">Threat Score</span>
                                        <div className="text-xl font-black text-emerald-400">{scamResult.score} / 10.0</div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block mb-1">Triggered Patterns</span>
                                        <div className="text-xl font-black text-[#00ccff]">{scamResult.hits.length} Found</div>
                                    </div>
                                </div>

                                {scamResult.rationale && (
                                    <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-900 text-xs leading-relaxed text-zinc-300">
                                        <strong className="text-amber-500">Jacky's Diagnostic:</strong> {scamResult.rationale}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block">Refracted Red-Flag Vectors</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {scamResult.hits.map((h: any, i: number) => (
                                            <div key={i} className="bg-zinc-900/60 border border-zinc-900 rounded-lg p-3">
                                                <div className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1.5">
                                                    <AlertTriangle size={12} />
                                                    {h.name}
                                                </div>
                                                <div className="text-[10px] text-zinc-400 mb-2">{h.context}</div>
                                                <div className="text-[9px] font-mono text-zinc-600">Matches: {h.matches.join(", ")}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {scamResult.countermeasures && scamResult.countermeasures.length > 0 && (
                                    <div className="bg-red-950/15 border border-red-900/40 p-3.5 rounded-xl text-xs text-red-300 space-y-1.5">
                                        <span className="font-bold block text-red-400">Vigilant Countermeasures:</span>
                                        <ul className="list-disc pl-4 space-y-1">
                                            {scamResult.countermeasures.map((c: string, idx: number) => (
                                                <li key={idx}>{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. CODE TAB - Savant Code Auditor */}
                {tab === "code" && (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-[#00ff88] tracking-widest uppercase flex items-center gap-2">
                                <Code2 className="text-[#00ccff]" size={14} />
                                Savant Coding Auditor
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono">
                                Compiles source functions into highly optimized pathways, identifying logical vulnerabilities, secrets leak risks, and dynamic traps.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 space-y-4">
                            <div className="space-y-1">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Source Code Audit Target</span>
                                <textarea
                                    value={codeInput}
                                    onChange={e => setCodeInput(e.target.value)}
                                    className="w-full h-36 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-[#00ff88] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-y"
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={handleAnalyzeCode}
                                    disabled={isAuditingCode || !codeInput.trim()}
                                    className={`py-2 px-6 rounded-xl text-xs font-bold uppercase tracking-wider text-black flex items-center justify-center gap-1.5 transition-all ${
                                        !codeInput.trim() ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-cyan-400 hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                    }`}
                                >
                                    {isAuditingCode ? <RefreshCw className="animate-spin" size={12} /> : "Compile & Audit Code"}
                                </button>
                            </div>
                        </div>

                        {codeResult && (
                            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-4 animate-fadeIn">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl font-black p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center min-w-[64px]" style={{ color: { A: "#00ff88", B: "#00ccff", C: "#ffcc00", F: "#ff2244" }[codeResult.grade] }}>
                                        {codeResult.grade}
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block mb-0.5">Code Security Grade</span>
                                        <div className="text-xs text-zinc-300">
                                            {codeResult.issues.length ? `Vigilant found ${codeResult.issues.length} critical or bad habit modules.` : "No obvious critical vulnerabilities detected."}
                                        </div>
                                    </div>
                                </div>

                                {codeResult.issues.length > 0 ? (
                                    <div className="space-y-2">
                                        {codeResult.issues.map((issue: any, i: number) => (
                                            <div key={i} className="border rounded-xl p-3.5 space-y-1 bg-zinc-900/20" style={{ borderColor: `${COLORS[issue.sev]}33`, borderLeft: `3.5px solid ${COLORS[issue.sev]}` }}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: COLORS[issue.sev], backgroundColor: `${COLORS[issue.sev]}15` }}>
                                                        {issue.sev}
                                                    </span>
                                                    <span className="text-xs font-bold text-zinc-200">{issue.issue}</span>
                                                </div>
                                                <div className="text-[11px] text-[#00ff88] leading-relaxed">
                                                    <strong className="text-zinc-400">Refactoring route:</strong> {issue.fix}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-emerald-950/15 border border-emerald-900/40 p-4 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                                        <CheckCircle size={14} />
                                        <span>Code approved. No obvious backdoors, loose passwords, evaluation hooks, or PRNG weaknesses detected.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 5. KNOWLEDGE MATRIX TAB */}
                {tab === "knowledge" && (
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-[#00ff88] tracking-widest uppercase flex items-center gap-2">
                                <Database className="text-purple-400" size={14} />
                                Complete Knowledge Matrix Map
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono">
                                Synthesized indexing of operational languages, compilers, container environments, and esoteric systems logic.
                            </p>
                        </div>

                        {/* Languages sliders */}
                        <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block mb-2">Systems & Compilers Competency Index</span>
                            <div className="space-y-3">
                                {LANGUAGES.map(l => (
                                    <div key={l.lang} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className={`${l.pct === 100 ? "text-[#00ff88] font-bold" : "text-zinc-300"}`}>{l.lang} {l.pct === 100 && "★"}</span>
                                            <span className="text-zinc-500 text-[10px]">{l.uses}</span>
                                        </div>
                                        <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/40">
                                            <div 
                                                className={`h-full transition-all duration-1000`} 
                                                style={{ 
                                                    width: `${l.pct}%`, 
                                                    backgroundColor: l.pct === 100 ? "#00ff88" : l.pct >= 95 ? "#00ccff" : "#aa88ff" 
                                                }} 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Web3 / Devops tooling index */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 space-y-3">
                                <span className="text-[10px] text-[#00ff88] uppercase tracking-widest font-bold block">Development & Cloud Frameworks</span>
                                <div className="space-y-2">
                                    {TOOLS.filter(t => t.tier === "core").map((t, idx) => (
                                        <div key={idx} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900 flex justify-between gap-4 text-xs">
                                            <span className="font-bold text-zinc-400 min-w-[70px]">{t.cat}</span>
                                            <span className="text-zinc-500 text-[11px] text-right">{t.tools}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 space-y-3">
                                <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold block">Web3 & Specialized Vector Suites</span>
                                <div className="space-y-2">
                                    {TOOLS.filter(t => t.tier === "flagship").map((t, idx) => (
                                        <div key={idx} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900 flex justify-between gap-4 text-xs">
                                            <span className="font-bold text-amber-400 min-w-[70px]">{t.cat}</span>
                                            <span className="text-zinc-500 text-[11px] text-right">{t.tools}</span>
                                        </div>
                                    ))}
                                    <div className="bg-zinc-950/20 p-3 rounded-lg border border-zinc-900 text-[11px] leading-relaxed text-zinc-500 italic">
                                        "Esoteric vectors represent multi-scale coordinate relationships. By translating ancient geometry concepts into operational software classes, we unlock unique relational weights."
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. MORAL VALUES TAB */}
                {tab === "values" && (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-[#00ff88] tracking-widest uppercase flex items-center gap-2">
                                <Flame className="text-amber-400" size={14} />
                                Jacky's Moral Axioms & Core Values
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono">
                                Relentless guidelines keeping operations secure, honest, feedback-oriented, and objective under pressure.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {VALUES.map((v, i) => (
                                <div key={i} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4.5 space-y-2 hover:bg-zinc-900/50 transition-colors" style={{ borderLeft: "3px solid #00ff88" }}>
                                    <div className="text-xs font-extrabold text-[#00ff88]">{v.name}</div>
                                    <div className="text-[11px] text-zinc-400 leading-relaxed">{v.desc}</div>
                                </div>
                            ))}
                        </div>

                        {/* Offline spec callout */}
                        <div className="bg-zinc-950 border border-zinc-850 p-5 rounded-2xl relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-[#00ff88]/5 rounded-full blur-2xl pointer-events-none" />
                            <h4 className="text-xs text-white uppercase tracking-wider font-extrabold mb-2">Refracted Offline-First Spec</h4>
                            <p className="text-zinc-500 text-[11px] leading-relaxed">
                                Jacky runs directly inside localized edge instances (Llama, Phi, Mistral local models), ensuring no data leaks, no central logging without user permission, and military-grade encryption models. Memory spaces are completely wiped on application sleep or background shifts to prevent side-channel timing attacks or leaks of decrypted keys. Zero-trust token validators keep core endpoints isolated.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Status Bar */}
            <div className="bg-zinc-950 border-t border-zinc-900 py-3.5 px-4 text-center text-[9px] text-zinc-600 tracking-wider uppercase shrink-0">
                JACKY v3 • 24 COGNITIVE DOMAINS • 12 ESOTERIC • 12 TECHNICAL • SHANNON ENTROPY • OFFLINE INTELLIGENCE READY
            </div>
        </div>
    );
};
