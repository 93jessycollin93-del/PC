import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Power, ChevronDown, ChevronUp, X, AlertTriangle, Check } from 'lucide-react';

interface GlobalTerminalProps {
    onStateChange?: (isActive: boolean) => void;
}

export const GlobalTerminal: React.FC<GlobalTerminalProps> = ({ onStateChange }) => {
    const [isActive, setIsActive] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [showWarning, setShowWarning] = useState(false);
    const [warningType, setWarningType] = useState<'enable' | 'disable'>('enable');
    const [output, setOutput] = useState<Array<{ type: 'input' | 'output' | 'system'; text: string }>>([
        { type: 'system', text: 'Global Terminal System Ready' },
        { type: 'system', text: 'Press the power icon to activate terminal access globally' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const outputEndRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [output]);

    const handleTogglePower = () => {
        setWarningType(isActive ? 'disable' : 'enable');
        setShowWarning(true);
    };

    const handleConfirmToggle = () => {
        const newState = !isActive;
        setIsActive(newState);
        onStateChange?.(newState);

        if (newState) {
            setOutput(prev => [...prev,
                { type: 'system', text: '⚠️  TERMINAL ACTIVATED - Global access enabled' },
                { type: 'system', text: 'Type "help" for available commands' }
            ]);
            setIsMinimized(false);
        } else {
            setOutput(prev => [...prev,
                { type: 'system', text: '⚠️  TERMINAL DEACTIVATED - Global access disabled' }
            ]);
        }

        setShowWarning(false);
    };

    const handleCancel = () => {
        setShowWarning(false);
    };

    const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !inputValue.trim()) return;

        const raw = inputValue.trim();
        const cmd = raw.toLowerCase();
        setOutput(prev => [...prev, { type: 'input', text: `$ ${inputValue}` }]);

        // Simple command simulation
        let response = '';
        switch (cmd) {
            case 'help':
                response = 'Available commands: help, status, clear, apps, info, exit';
                break;
            case 'status':
                response = `Terminal Status: ${isActive ? 'ACTIVE' : 'INACTIVE'}\nGlobal Access: ${isActive ? 'ENABLED' : 'DISABLED'}\nUptime: healthy`;
                break;
            case 'clear':
                setOutput([{ type: 'system', text: 'Global Terminal System Ready' }]);
                setInputValue('');
                return;
            case 'apps':
                response = 'Connected Apps: AiTerm, TermStudio, BotStudio, Cybernetic67\nActivation: Press power icon to route commands';
                break;
            case 'info':
                response = 'Global Terminal v1.0\nPlatform: VisualOS\nAccess Level: SYSTEM\nConnections: Active (5)';
                break;
            case 'exit':
                // Only the uppercase form confirms. Compare the raw input, since
                // `cmd` has already been lowercased and would swallow it.
                if (raw === 'EXIT') {
                    handleTogglePower();
                    setInputValue('');
                    return;
                }
                response = 'Type EXIT (uppercase) to confirm deactivation';
                break;
            default:
                response = `Command not recognized: "${cmd}". Type "help" for available commands.`;
        }

        setOutput(prev => [...prev, { type: 'output', text: response }]);
        setInputValue('');
    };

    return (
        <>
            {/* Global Terminal Widget */}
            <div
                ref={terminalRef}
                className={`fixed z-[9999] transition-all duration-300 ${
                    isMinimized ? 'bottom-4 right-4' : 'bottom-4 right-4 w-96 h-96'
                }`}
            >
                {/* Minimized State */}
                {isMinimized && (
                    <button
                        onClick={() => setIsMinimized(false)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                            isActive
                                ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'bg-zinc-900/40 border-zinc-500/30 text-zinc-400 hover:bg-zinc-900/60'
                        }`}
                    >
                        <TerminalIcon size={18} />
                        <span className="text-sm font-mono">Terminal</span>
                        {isActive && <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
                    </button>
                )}

                {/* Expanded State */}
                {!isMinimized && (
                    <div className="bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl flex flex-col h-full overflow-hidden">
                        {/* Header */}
                        <div className="bg-zinc-900 border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TerminalIcon size={18} className={isActive ? 'text-emerald-400' : 'text-zinc-500'} />
                                <span className="text-sm font-mono text-zinc-300">Global Terminal</span>
                                {isActive && <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse ml-2" />}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleTogglePower}
                                    className={`p-1 rounded transition-all ${
                                        isActive
                                            ? 'text-red-400 hover:bg-red-500/20'
                                            : 'text-zinc-500 hover:bg-zinc-700/50'
                                    }`}
                                    title={isActive ? 'Deactivate Terminal' : 'Activate Terminal'}
                                >
                                    <Power size={16} />
                                </button>
                                <button
                                    onClick={() => setIsMinimized(true)}
                                    className="p-1 rounded text-zinc-500 hover:bg-zinc-700/50 transition-all"
                                >
                                    <ChevronDown size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setIsMinimized(true);
                                        setOutput([{ type: 'system', text: 'Global Terminal System Ready' }]);
                                    }}
                                    className="p-1 rounded text-zinc-500 hover:bg-zinc-700/50 transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Output Area */}
                        <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 font-mono text-sm">
                            {output.map((line, idx) => (
                                <div key={idx} className="mb-1">
                                    {line.type === 'input' && (
                                        <span className="text-cyan-400">{line.text}</span>
                                    )}
                                    {line.type === 'output' && (
                                        <span className="text-zinc-300 whitespace-pre-wrap">{line.text}</span>
                                    )}
                                    {line.type === 'system' && (
                                        <span className="text-emerald-400">{line.text}</span>
                                    )}
                                </div>
                            ))}
                            <div ref={outputEndRef} />
                        </div>

                        {/* Input Area */}
                        {isActive && (
                            <div className="bg-zinc-900 border-t border-zinc-700 px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-sm">$</span>
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleCommand}
                                        autoFocus
                                        className="flex-1 bg-transparent text-zinc-100 font-mono text-sm outline-none placeholder-zinc-600"
                                        placeholder="Type command..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* Status Bar */}
                        {!isActive && (
                            <div className="bg-zinc-900 border-t border-zinc-700 px-4 py-2 text-xs text-zinc-500">
                                Press power icon to activate global terminal access
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="text-amber-500" size={24} />
                            <h3 className="text-lg font-semibold text-white">
                                {warningType === 'enable' ? 'Enable Global Terminal?' : 'Disable Global Terminal?'}
                            </h3>
                        </div>

                        <p className="text-zinc-300 text-sm mb-6">
                            {warningType === 'enable'
                                ? 'Enabling global terminal will allow system-wide command access across all applications. Terminal commands will be routed globally and may affect system behavior. Proceed?'
                                : 'Disabling global terminal will disconnect all active global access points and prevent system-wide command execution. This action is immediate and irreversible until re-enabled.'
                            }
                        </p>

                        <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3 mb-6 text-xs text-zinc-400 font-mono">
                            {warningType === 'enable'
                                ? '⚠️ Global access will be ACTIVATED\n• All apps connected\n• Full system routing enabled\n• Logging active'
                                : '⚠️ Global access will be DEACTIVATED\n• All apps disconnected\n• Routing disabled\n• Local instances remain'
                            }
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmToggle}
                                className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
                                    warningType === 'enable'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                            >
                                <Check size={16} />
                                {warningType === 'enable' ? 'Activate' : 'Deactivate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
