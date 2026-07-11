import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Minus, Maximize2, Minimize2, X, Mic, MicOff, Archive, Save } from 'lucide-react';
import { getFile, saveFile } from '../lib/storage';
import { organizeAndArchiveNote } from '../lib/archivePod';

// A real, persistent sticky notepad that floats above every app window.
// It is mounted once in App.tsx (not per-window) so it stays put while you
// switch between Jackie and anything else in the OS. Content is saved for
// real via lib/storage (same mechanism as NotepadApp). Voice capture uses
// the real browser Speech Recognition API: say "take note" (or "note that")
// followed by what you want written down, and it's appended. Saying "save"
// or "archive that" files the current note into the real archive-pod vault
// (same IndexedDB store DataPods uses), tagged with its source so notes
// never mix between sources.

type WidgetState = 'minimized' | 'compact' | 'fullscreen';
const FILE_ID = 'sticky-notepad.txt';
const NOTE_TRIGGERS = ['take note', 'note that', 'jot down'];
const SAVE_TRIGGERS = ['save that', 'archive that', 'save note', 'archive note'];

type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: any) => void) | null;
    onerror: ((e: any) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};

export const StickyNotepadWidget: React.FC = () => {
    const [state, setState] = useState<WidgetState>(() => (localStorage.getItem('sticky-notepad-state') as WidgetState) || 'minimized');
    const [content, setContent] = useState(() => getFile(FILE_ID) || '');
    const [size, setSize] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sticky-notepad-size') || '') || { w: 300, h: 340 }; }
        catch { return { w: 300, h: 340 }; }
    });
    const [listening, setListening] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<string>('');
    const [savedFlash, setSavedFlash] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

    useEffect(() => { localStorage.setItem('sticky-notepad-state', state); }, [state]);
    useEffect(() => { localStorage.setItem('sticky-notepad-size', JSON.stringify(size)); }, [size]);

    // Real autosave, same pattern as NotepadApp.
    useEffect(() => {
        const t = setTimeout(() => saveFile(FILE_ID, content, true), 800);
        return () => clearTimeout(t);
    }, [content]);

    const speak = useCallback((text: string) => {
        try {
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1.1;
            window.speechSynthesis.speak(u);
        } catch { /* speech synthesis unsupported — fail silently, text feedback still shown */ }
    }, []);

    const appendNote = useCallback((text: string) => {
        setContent(prev => (prev ? prev + '\n' : '') + `[${new Date().toLocaleTimeString()}] ${text}`);
        setVoiceStatus('noted');
        speak('noted');
        setTimeout(() => setVoiceStatus(''), 1500);
    }, [speak]);

    const archiveCurrentNote = useCallback(async () => {
        if (!content.trim()) {
            setVoiceStatus('error');
            speak('error, nothing to save');
            setTimeout(() => setVoiceStatus(''), 1500);
            return;
        }
        try {
            await organizeAndArchiveNote('sticky-notepad', content);
            setSavedFlash(true);
            setVoiceStatus('archived');
            speak('saved');
            setTimeout(() => { setSavedFlash(false); setVoiceStatus(''); }, 1500);
        } catch {
            setVoiceStatus('error');
            speak('error');
            setTimeout(() => setVoiceStatus(''), 1500);
        }
    }, [content, speak]);

    const handleTranscript = useCallback((raw: string) => {
        const lower = raw.trim().toLowerCase();
        if (!lower) return;
        const saveHit = SAVE_TRIGGERS.find(t => lower.includes(t));
        if (saveHit) { archiveCurrentNote(); return; }
        const noteHit = NOTE_TRIGGERS.find(t => lower.includes(t));
        if (noteHit) {
            const idx = lower.indexOf(noteHit);
            const after = raw.slice(idx + noteHit.length).replace(/^[,:\s]+/, '');
            if (after) appendNote(after);
            else setVoiceStatus('error');
            return;
        }
        // Unrecognized command — stay silent rather than guessing.
    }, [appendNote, archiveCurrentNote]);

    const toggleListening = useCallback(() => {
        const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setVoiceStatus('error');
            speak('error, voice not supported');
            setTimeout(() => setVoiceStatus(''), 1500);
            return;
        }
        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }
        const rec: SpeechRecognitionLike = new SR();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.onresult = (e: any) => {
            const last = e.results[e.results.length - 1];
            if (last?.isFinal) handleTranscript(last[0].transcript);
        };
        rec.onerror = () => { setListening(false); };
        rec.onend = () => { setListening(false); };
        recognitionRef.current = rec;
        rec.start();
        setListening(true);
    }, [listening, handleTranscript, speak]);

    useEffect(() => () => recognitionRef.current?.stop(), []);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
        const onMove = (ev: MouseEvent) => {
            if (!resizingRef.current) return;
            const dx = ev.clientX - resizingRef.current.startX;
            const dy = ev.clientY - resizingRef.current.startY;
            setSize({
                w: Math.max(240, Math.min(800, resizingRef.current.startW + dx)),
                h: Math.max(200, Math.min(700, resizingRef.current.startH + dy)),
            });
        };
        const onUp = () => {
            resizingRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    if (state === 'minimized') {
        return (
            <button
                onClick={() => setState('compact')}
                className="fixed bottom-4 right-4 z-[999999] w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-900/40 flex items-center justify-center transition-all"
                title="Open sticky notepad"
            >
                <FileText size={18} className="text-zinc-900" />
            </button>
        );
    }

    const fullscreen = state === 'fullscreen';
    const style: React.CSSProperties = fullscreen
        ? { top: 0, left: 0, right: 0, bottom: 0 }
        : { bottom: 16, right: 16, width: size.w, height: size.h };

    return (
        <div
            className="fixed z-[999999] bg-zinc-900 border border-amber-700/40 rounded-lg shadow-2xl flex flex-col overflow-hidden text-zinc-100 font-sans"
            style={style}
        >
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-950/30 border-b border-amber-800/30 select-none">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <FileText size={13} />
                    <span>Sticky Notes</span>
                    {voiceStatus && <span className="text-[10px] font-mono text-emerald-400 ml-1">{voiceStatus}</span>}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleListening}
                        title={listening ? 'Stop listening' : 'Say "take note ..." or "save that"'}
                        className={`p-1 rounded hover:bg-zinc-800 ${listening ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}
                    >
                        {listening ? <Mic size={13} /> : <MicOff size={13} />}
                    </button>
                    <button onClick={archiveCurrentNote} title="Archive to pod" className={`p-1 rounded hover:bg-zinc-800 ${savedFlash ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        <Archive size={13} />
                    </button>
                    <button onClick={() => saveFile(FILE_ID, content, false)} title="Save" className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
                        <Save size={13} />
                    </button>
                    <button onClick={() => setState(fullscreen ? 'compact' : 'fullscreen')} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
                        {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                    <button onClick={() => setState('minimized')} title="Minimize" className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
                        <Minus size={13} />
                    </button>
                </div>
            </div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full p-3 bg-transparent resize-none outline-none text-sm leading-relaxed font-mono placeholder-zinc-600"
                placeholder='Type here, or say "take note ..." — say "save that" to archive.'
                spellCheck={false}
            />
            <div className="px-2.5 py-1 text-[10px] font-mono text-zinc-500 border-t border-zinc-800 flex items-center justify-between">
                <span>{content.length} chars</span>
                <span>autosaved</span>
            </div>
            {!fullscreen && (
                <div
                    onMouseDown={startResize}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-50 hover:opacity-100"
                    style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(251,191,36,0.6) 50%)' }}
                />
            )}
        </div>
    );
};
