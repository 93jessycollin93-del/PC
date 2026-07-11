import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { scanForSecrets, redactSecrets, type SecretMatch } from '../../lib/secretScanner';

export const DataRedactionApp: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [matches, setMatches] = useState<SecretMatch[]>([]);
  const [showRedacted, setShowRedacted] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleScan = () => {
    const detected = scanForSecrets(input);
    setMatches(detected);

    if (detected.length > 0) {
      const redacted = redactSecrets(input);
      setOutput(redacted);
    } else {
      setOutput(input);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadRedacted = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redacted-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-red-500/20 text-red-400',
      medium: 'bg-amber-500/20 text-amber-400',
      low: 'bg-blue-500/20 text-blue-400',
    };
    return colors[confidence];
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      api_key: 'bg-red-500/20 text-red-400',
      token: 'bg-orange-500/20 text-orange-400',
      pii: 'bg-amber-500/20 text-amber-400',
      entropy_high: 'bg-purple-500/20 text-purple-400',
    };
    return colors[type] || 'bg-zinc-700/20 text-zinc-400';
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-amber-950/30 to-zinc-950 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Eye className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold">Data Redaction</h1>
        </div>
        <p className="text-zinc-400">Scan and redact secrets (API keys, tokens, PII) from text</p>
      </div>

      {/* Scan Section */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6 shrink-0">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-zinc-400 mb-2">Paste text to scan</p>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste chat history, notes, or config with potential secrets…"
              className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded p-3 text-sm text-white focus:border-sky-500 outline-none resize-none"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={!input.trim()}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-medium transition-all"
          >
            Scan for Secrets
          </button>
        </div>
      </div>

      {/* Results */}
      {matches.length > 0 && (
        <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6 space-y-4 flex-1 overflow-auto">
          {/* Detected Secrets Summary */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="font-bold text-red-300">
                {matches.length} potential secret{matches.length !== 1 ? 's' : ''} detected
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                <span className="text-red-400 font-bold">
                  {matches.filter(m => m.type === 'api_key').length}
                </span>{' '}
                API keys · {' '}
                <span className="text-orange-400 font-bold">
                  {matches.filter(m => m.type === 'token').length}
                </span>{' '}
                tokens · {' '}
                <span className="text-amber-400 font-bold">
                  {matches.filter(m => m.type === 'pii').length}
                </span>{' '}
                PII entries
              </p>
            </div>
          </div>

          {/* Detected Matches */}
          <div>
            <p className="text-sm font-bold text-zinc-300 mb-3">Detected matches:</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {matches.map((match, idx) => (
                <div key={idx} className="bg-zinc-900/50 border border-zinc-700 rounded p-2 text-xs">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-zinc-300 truncate">
                      {match.match.slice(0, 40)}{match.match.length > 40 ? '…' : ''}
                    </span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeBadge(match.type)}`}>
                        {match.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${confidenceBadge(match.confidence)}`}>
                        {match.confidence}
                      </span>
                    </div>
                  </div>
                  <p className="text-zinc-500">Position: {match.start}–{match.end}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Output Section */}
      {output && (
        <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6 space-y-3 flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-zinc-300">
              {showRedacted ? 'Redacted output' : 'Original input'}
            </p>
            <button
              onClick={() => setShowRedacted(!showRedacted)}
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 flex items-center gap-1"
            >
              {showRedacted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {showRedacted ? 'Show original' : 'Show redacted'}
            </button>
          </div>
          <textarea
            value={showRedacted ? output : input}
            readOnly
            className="w-full h-40 bg-zinc-950 border border-zinc-700 rounded p-3 text-sm text-white font-mono resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={downloadRedacted}
              className="flex-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!output && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-zinc-400">Paste text and click "Scan for Secrets" to begin</p>
            <p className="text-xs text-zinc-500 mt-2">Detects: API keys, tokens, emails, phone numbers, high-entropy strings</p>
          </div>
        </div>
      )}
    </div>
  );
};
