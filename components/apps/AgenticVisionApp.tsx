import React, { useState, useRef } from 'react';
import { Eye, Upload, Image as ImageIcon, Crosshair, Sparkles, Loader2 } from 'lucide-react';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

export const AgenticVisionApp: React.FC = () => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Analyze this image and detail all security or structural anomalies.');
    const [analysis, setAnalysis] = useState('Select an image and enter a prompt to begin Agentic Vision scanning...');
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setImageSrc(event.target.result as string);
                    setAnalysis('Image loaded. Ready for scan.');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleScan = async () => {
        if (!imageSrc || !prompt.trim()) return;
        setIsScanning(true);
        setAnalysis('Initiating deep neural scan...\nExtracting visual features...\nWaiting for model response...');

        try {
            const ai = getAiClient();
            
            // Extract base64 part
            const base64Data = imageSrc.split(',')[1];
            const mimeType = imageSrc.split(',')[0].split(':')[1].split(';')[0];

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [
                    prompt,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    }
                ]
            });

            setAnalysis(response.text || 'Scan completed with no significant findings.');
        } catch (error: any) {
            console.error("Vision Error:", error);
            setAnalysis(`ERR: Scan failed. ${error.message}`);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 flex items-center justify-center">
            <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                
                {/* Left Panel - Image Upload/Preview */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                    <div className="bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
                        <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            <Eye size={16} className="text-cyan-400" />
                            Agentic Vision Scanner
                        </h4>
                    </div>
                    
                    <div className="flex-1 p-6 flex flex-col items-center justify-center relative">
                        {imageSrc ? (
                            <div className="relative w-full h-full flex items-center justify-center group">
                                <img src={imageSrc} alt="Target" className="max-w-full max-h-full object-contain rounded-lg border border-zinc-700 shadow-xl" />
                                {isScanning && (
                                    <div className="absolute inset-0 bg-cyan-500/10 border-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)] rounded-lg flex items-center justify-center pointer-events-none overflow-hidden">
                                        <div className="w-full h-1 bg-cyan-400 absolute top-0 animate-scan shadow-[0_0_10px_#22d3ee]"></div>
                                        <Crosshair size={48} className="text-cyan-400 animate-pulse opacity-50" />
                                    </div>
                                )}
                                <button 
                                    onClick={() => setImageSrc(null)}
                                    className="absolute top-2 right-2 bg-black/60 hover:bg-black p-2 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2Icon />
                                </button>
                            </div>
                        ) : (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-full border-2 border-dashed border-zinc-700 hover:border-cyan-500 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:text-cyan-400 cursor-pointer transition-colors bg-zinc-950/50"
                            >
                                <Upload size={48} className="mb-4 opacity-50" />
                                <p className="font-bold">Upload Target Image</p>
                                <p className="text-xs mt-2 text-zinc-600">JPEG, PNG, WEBP supported</p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload}
                        />
                    </div>
                </div>

                {/* Right Panel - Analysis & Control */}
                <div className="flex flex-col gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col p-5 shadow-2xl">
                        <div className="space-y-2 mb-4">
                            <label className="text-xs font-mono uppercase text-zinc-500 font-bold tracking-wider">Scan Directive</label>
                            <textarea 
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                rows={3}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 font-sans resize-none transition-colors"
                            />
                        </div>
                        <button 
                            onClick={handleScan}
                            disabled={isScanning || !imageSrc || !prompt.trim()}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
                        >
                            {isScanning ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                            <span>{isScanning ? 'Executing Scan...' : 'Initiate Analysis'}</span>
                        </button>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl flex-1 p-5 flex flex-col shadow-xl">
                        <h5 className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider mb-3">Diagnostic Output</h5>
                        <div className="flex-1 bg-black/40 border border-zinc-800/60 rounded-xl p-4 overflow-auto font-mono text-xs text-cyan-100/90 whitespace-pre-wrap leading-relaxed shadow-inner">
                            {analysis}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Trash Icon extracted for simplicity
const Trash2Icon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);
