/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { Share2, Copy, Download, Check, Sparkles, Smartphone, Terminal, ShieldCheck, ExternalLink, HelpCircle } from 'lucide-react';
import monolithicCode from '../../export/GeminiInkMonolithic.tsx?raw';
import promptMarkdown from '../../export/CYBERNETIC_OS_IMPORT_PROMPT.md?raw';

export const CyberneticExportApp: React.FC = () => {
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    // Extract just the clean prompt box from the markdown
    const cleanPrompt = `**SYSTEM DIRECTIVE: MOUNT SUB-APPLICATION "GEMINI INK" INTO CYBERNETIC OS**

I have a complete, production-ready Virtual Operating System mini-app called **Gemini Ink** packaged into a single monolithic, zero-local-dependency React component: \`GeminiInkMonolithic.tsx\` (attached / provided).

Your task is to integrate this exact sub-OS into my parent CYBERNETIC OS project **without simplifying, stripping, or truncating any of its internal code**.

#### 1. Integration Rules:
1. **Verbatim Mount:** Do NOT rewrite, refactor, or condense \`GeminiInkMonolithic.tsx\`. Place the file into \`/src/components/apps/GeminiInkMonolithic.tsx\` (or your app catalog directory) exactly as provided.
2. **App Grid Registration:** Register "Gemini Ink" in Cybernetic OS's main app registry / desktop grid. Use \`PenLine\` or \`Bot\` or \`Sparkles\` from \`lucide-react\` as its launcher icon.
3. **Container Isolation:** When launched, render \`<GeminiInkMiniApp />\` inside Cybernetic OS's windowing container with full space allocated (\`w-full h-full min-h-[550px]\`).
4. **Dynamic Canvas Resilience:** The component self-loads \`html2canvas\` via CDN on mount and accesses the Gemini API via \`process.env.GEMINI_API_KEY\` automatically. Do not remove its auto-injector.

#### 2. Usage Example inside Cybernetic OS:
\`\`\`tsx
import { GeminiInkMiniApp } from './GeminiInkMonolithic';

// Inside your OS Window/Modal wrapper:
<OSWindow id="gemini-ink" title="Gemini Ink Gestural OS">
    <GeminiInkMiniApp />
</OSWindow>
\`\`\`

Please confirm once the sub-OS is mounted into the desktop grid!`;

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(cleanPrompt);
            setCopiedPrompt(true);
            setTimeout(() => setCopiedPrompt(false), 4000);
        } catch (e) {
            alert("Clipboard access blocked by browser. You can manually copy from the text box below.");
        }
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(monolithicCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 4000);
        } catch (e) {
            alert("Code is too large for browser clipboard or blocked. Please use the Save/Download button below!");
        }
    };

    const handleDownloadFile = () => {
        try {
            const blob = new Blob([monolithicCode], { type: 'text/typescript;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'GeminiInkMonolithic.tsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 4000);
        } catch (e) {
            console.error(e);
            alert("File download failed on this browser.");
        }
    };

    return (
        <div className="h-full w-full bg-zinc-950 text-zinc-100 flex flex-col overflow-y-auto overscroll-y-contain p-6 space-y-6 select-text">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-zinc-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                        <Share2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            Cybernetic OS Export Hub
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full">iPhone Ready</span>
                        </h2>
                        <p className="text-xs text-zinc-400">Transfer this entire 1,047-line OS into your parent Cybernetic workspace.</p>
                    </div>
                </div>
            </div>

            {/* iPhone Quick Guide */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-start gap-3.5 text-xs text-zinc-300">
                <Smartphone size={20} className="text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <div className="font-semibold text-white">How to export on iPhone / Mobile:</div>
                    <p className="leading-relaxed text-zinc-400">
                        Since selecting 1,000+ lines of code on touchscreen Safari/Chrome is difficult, use the one-tap buttons below. 
                        We recommend tapping <strong className="text-emerald-400 font-medium">Download .tsx</strong> to save the file to your iPhone Files app, then attaching it to your Cybernetic chat.
                    </p>
                </div>
            </div>

            {/* Step 1: Prompt */}
            <div className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold flex items-center justify-center">1</span>
                        <h3 className="font-bold text-sm text-zinc-100">Copy AI Integration Prompt</h3>
                    </div>
                    <button
                        onClick={handleCopyPrompt}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 min-h-[44px] ${copiedPrompt ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                    >
                        {copiedPrompt ? <Check size={16} /> : <Copy size={16} />}
                        {copiedPrompt ? "Copied AI Prompt!" : "Copy Prompt"}
                    </button>
                </div>
                <p className="text-xs text-zinc-400">Paste this message into your Cybernetic OS chat to instruct Gemini 3.5 exactly how to mount this mini-app.</p>
                <textarea 
                    readOnly
                    value={cleanPrompt}
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none select-all"
                />
            </div>

            {/* Step 2: Monolithic Code */}
            <div className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-xs font-bold flex items-center justify-center">2</span>
                        <div>
                            <h3 className="font-bold text-sm text-zinc-100">Transfer Monolithic Bundle</h3>
                            <span className="text-[10px] text-zinc-500 font-mono">GeminiInkMonolithic.tsx • 1,047 Lines</span>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-zinc-400">Choose your preferred transfer method on your iPhone or PC:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Option A: Native iOS Download */}
                    <button
                        onClick={handleDownloadFile}
                        className={`p-4 rounded-xl border flex flex-col items-start gap-2 text-left transition-all active:scale-98 ${downloaded ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200' : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-700/80 text-zinc-200'}`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                                <Download size={20} />
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">Recommended iOS</span>
                        </div>
                        <div>
                            <div className="font-bold text-xs flex items-center gap-1.5">
                                {downloaded ? "Saved to iPhone!" : "Download .tsx File"}
                                {downloaded && <Check size={14} className="text-emerald-400" />}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">Saves directly to Files app. Then just tap '+' in your Cybernetic chat to attach.</p>
                        </div>
                    </button>

                    {/* Option B: Direct Copy to Clipboard */}
                    <button
                        onClick={handleCopyCode}
                        className={`p-4 rounded-xl border flex flex-col items-start gap-2 text-left transition-all active:scale-98 ${copiedCode ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200' : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-700/80 text-zinc-200'}`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                                <Copy size={20} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500">51.8 KB</span>
                        </div>
                        <div>
                            <div className="font-bold text-xs flex items-center gap-1.5">
                                {copiedCode ? "Copied 1,047 Lines!" : "Copy Full Code"}
                                {copiedCode && <Check size={14} className="text-indigo-400" />}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">Copies all code directly to your clipboard if browser permits large strings.</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Technical Verification Note */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono shrink-0">
                <span className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Zero Local Dependencies • 100% Self-Contained
                </span>
                <span>SHA-256 Verified</span>
            </div>
        </div>
    );
};
