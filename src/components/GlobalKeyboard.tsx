import React, { useRef, useEffect } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../core/appStore';

type KeyAction = 'character' | 'backspace' | 'delete' | 'enter' | 'tab' | 'space' | 'shift' | 'ctrl' | 'alt' | 'cmd' | 'arrow_up' | 'arrow_down' | 'arrow_left' | 'arrow_right';

interface Key {
  label: string;
  action: KeyAction;
  value: string;
  wide?: boolean;
  color?: string;
}

const KEYBOARD_LAYOUTS = {
  default: [
    // Row 1: Numbers & Symbols
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
    // Row 2: QWERTY Top
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
    // Row 3: ASDF Middle
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\'', '\\'],
    // Row 4: ZXCV Bottom
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
  ] as const,
  terminal: [
    // Terminal symbols
    ['|', '&', '&&', '||', '>', '>>', '<', '<<', ';', '`'],
    ['/dev/null', 'cd', 'ls', 'pwd', 'cat', 'echo', 'grep', 'sed', 'awk', 'find'],
    ['git add', 'git commit', 'git push', 'git pull', 'git status', 'git log'],
    ['sudo', 'chmod', '755', '644', 'mkdir', 'rm', 'mv', 'cp', 'tar', 'zip'],
    ['curl', 'wget', 'ssh', 'scp', 'ssh-keygen', 'docker', 'npm', 'pip', 'python'],
  ] as const,
  coding: [
    ['{', '}', '[', ']', '(', ')', '<', '>', '$', '%'],
    ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch'],
    ['class', 'import', 'export', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this'],
    ['=>', '===', '!==', '!', '?', ':', '...', '++', '--', '+='],
    ['@', '#', '$', '%', '^', '&', '*', '=', '~', '|'],
  ] as const,
  special: [
    ['Ctrl+C', 'Ctrl+D', 'Ctrl+Z', 'Ctrl+L', 'Ctrl+A', 'Ctrl+E', 'Ctrl+U', 'Ctrl+K'],
    ['Ctrl+V', 'Ctrl+X', 'Ctrl+C', '↑', '↓', '←', '→', 'Tab'],
    ['Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Enter', 'Backspace'],
    ['!', '@', '#', '$', '%', '^', '&', '*'],
    ['emoji', 'paste', 'copy', 'undo', 'redo'],
  ] as const,
};

type LayoutKey = keyof typeof KEYBOARD_LAYOUTS;

export const GlobalKeyboard: React.FC = () => {
  const {
    keyboardOpen,
    keyboardLayout,
    keyboardPosition,
    shiftActive,
    setKeyboardOpen,
    setKeyboardLayout,
    setKeyboardPosition,
    setShiftActive,
  } = useAppStore();

  const dotRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!keyboardOpen || !dotRef.current) return;
    const rect = dotRef.current.getBoundingClientRect();
    const wouldObstruct = rect.left < 200 && rect.top < 100;
    setKeyboardPosition(wouldObstruct ? 'top-right' : 'top-left');
  }, [keyboardOpen, setKeyboardPosition]);

  const handleKeyPress = (key: string, action: KeyAction) => {
    const input = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    switch (action) {
      case 'character':
        input.value += shiftActive ? key.toUpperCase() : key.toLowerCase();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (shiftActive) setShiftActive(false);
        break;
      case 'backspace':
        input.value = input.value.slice(0, -1);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      case 'delete':
        const pos = input.selectionStart || 0;
        input.value = input.value.slice(0, pos) + input.value.slice(pos + 1);
        break;
      case 'enter':
        input.value += '\n';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      case 'tab':
        input.value += '\t';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      case 'space':
        input.value += ' ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      case 'shift':
        setShiftActive(!shiftActive);
        break;
      case 'ctrl':
      case 'alt':
      case 'cmd':
        // Send keyboard event for modifiers
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: action === 'ctrl' ? 'Control' : action === 'alt' ? 'Alt' : 'Meta',
          code: action === 'ctrl' ? 'ControlLeft' : action === 'alt' ? 'AltLeft' : 'MetaLeft',
        }));
        break;
      case 'arrow_up':
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' }));
        break;
      case 'arrow_down':
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown' }));
        break;
      case 'arrow_left':
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft' }));
        break;
      case 'arrow_right':
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight' }));
        break;
    }
  };

  const getLayout = () => KEYBOARD_LAYOUTS[currentLayout];

  return (
    <>
      {/* Tiny launcher dot */}
      <button
        ref={dotRef}
        onClick={() => setKeyboardOpen(!keyboardOpen)}
        className={`fixed ${keyboardPosition === 'top-left' ? 'top-2 left-2' : 'top-2 right-2'} w-2 h-2 rounded-full z-[5000] transition-all ${
          keyboardOpen ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-zinc-600 hover:bg-zinc-500'
        }`}
        title="Mobile Keyboard"
      />

      {/* Keyboard panel */}
      {keyboardOpen && (
        <div
          ref={containerRef}
          className="fixed bottom-0 left-0 right-0 z-[4999] bg-zinc-900 border-t border-white/10 shadow-2xl transition-all duration-300 ease-out"
          style={{ height: '32vh', maxHeight: '400px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-zinc-950">
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
              <span className="text-indigo-400">{keyboardLayout}</span>
              <span>{shiftActive ? '⇧' : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setKeyboardOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Layout tabs */}
          <div className="flex gap-1 px-2 py-1 bg-zinc-900/50 border-b border-white/5 overflow-x-auto">
            {(['default', 'terminal', 'coding', 'special'] as LayoutKey[]).map((layout) => (
              <button
                key={layout}
                onClick={() => setKeyboardLayout(layout)}
                className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors flex-shrink-0 ${
                  keyboardLayout === layout
                    ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/50'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-transparent'
                }`}
              >
                {layout === 'default' ? '⌨' : layout === 'terminal' ? '$ ' : layout === 'coding' ? '{ }' : '⚙'}
              </button>
            ))}
          </div>

          {/* Keys */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {getLayout().map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1 justify-center">
                {(row as any[]).map((keyData, colIdx) => {
                  const key = typeof keyData === 'string' ? keyData : keyData;
                  const isModifier = ['shift', 'ctrl', 'alt', 'cmd', 'enter', 'backspace', 'delete', 'tab'].some(m =>
                    key.toLowerCase().includes(m)
                  );
                  const isArrow = key.includes('↑') || key.includes('↓') || key.includes('←') || key.includes('→');
                  const isTerminal = key.startsWith('/') || key.includes('git') || key.includes('sudo') || key.includes('docker');

                  return (
                    <button
                      key={`${rowIdx}-${colIdx}`}
                      onMouseDown={() => {
                        let action: KeyAction = 'character';
                        if (key === 'Backspace') action = 'backspace';
                        else if (key === 'Delete') action = 'delete';
                        else if (key === 'Enter') action = 'enter';
                        else if (key === 'Tab') action = 'tab';
                        else if (key.length > 1 && !isArrow && !isModifier && !isTerminal) action = 'character';
                        else if (key.toLowerCase().includes('shift')) action = 'shift';
                        else if (key.toLowerCase().includes('ctrl')) action = 'ctrl';
                        else if (key.toLowerCase().includes('alt')) action = 'alt';
                        else if (key.includes('↑')) action = 'arrow_up';
                        else if (key.includes('↓')) action = 'arrow_down';
                        else if (key.includes('←')) action = 'arrow_left';
                        else if (key.includes('→')) action = 'arrow_right';
                        handleKeyPress(key, action);
                      }}
                      className={`px-2 py-1.5 rounded text-[10px] font-mono font-semibold transition-all flex-shrink-0 ${
                        key.length > 8 ? 'text-[8px] px-1.5' : ''
                      } ${
                        isModifier
                          ? 'bg-red-900/40 text-red-200 border border-red-500/30 hover:bg-red-800/50'
                          : isTerminal
                          ? 'bg-green-900/40 text-green-200 border border-green-500/30 hover:bg-green-800/50'
                          : isArrow
                          ? 'bg-blue-900/40 text-blue-200 border border-blue-500/30 hover:bg-blue-800/50'
                          : 'bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700'
                      } ${shiftActive && key === 'Shift' ? 'ring-2 ring-yellow-400' : ''}`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Space bar & common actions */}
            <div className="flex gap-1 justify-center pt-1">
              <button
                onMouseDown={() => handleKeyPress(' ', 'space')}
                className="flex-1 max-w-xs px-3 py-2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 transition-all"
              >
                space
              </button>
              <button
                onMouseDown={() => handleKeyPress('\n', 'enter')}
                className="px-3 py-2 rounded text-[10px] font-mono bg-indigo-900/40 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-800/50 transition-all"
              >
                ↵
              </button>
              <button
                onMouseDown={() => handleKeyPress('', 'backspace')}
                className="px-3 py-2 rounded text-[10px] font-mono bg-red-900/40 text-red-200 border border-red-500/30 hover:bg-red-800/50 transition-all"
              >
                ⌫
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalKeyboard;
