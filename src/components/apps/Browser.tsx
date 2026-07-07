import React, { useState } from 'react';
import { X, Search, RotateCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { useToast } from '../../lib/toastContext';

interface BrowserProps {
  onClose: () => void;
}

const BROWSER_SERVICE_URL = process.env.REACT_APP_BROWSER_SERVICE_URL || 'https://browser-service-xyz.run.app';

export const Browser: React.FC<BrowserProps> = ({ onClose }) => {
  const [url, setUrl] = useState('https://example.com');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { successToast, errorToast, infoToast } = useToast();

  const renderPage = async (pageUrl: string) => {
    if (!pageUrl.startsWith('http')) {
      pageUrl = 'https://' + pageUrl;
    }

    setLoading(true);
    infoToast('Rendering page...', 'Using cloud browser service');

    try {
      const response = await fetch(`${BROWSER_SERVICE_URL}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: pageUrl,
          width: 1024,
          height: 768,
          timeout: 15000,
        }),
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setScreenshot(data.screenshot);
        setUrl(pageUrl);
        successToast('Page rendered', pageUrl);
      } else {
        throw new Error(data.message || 'Render failed');
      }
    } catch (error) {
      errorToast('Render failed', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    infoToast('Searching...', searchQuery);

    try {
      const response = await fetch(`${BROWSER_SERVICE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, timeout: 15000 }),
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setScreenshot(data.screenshot);
        setUrl(data.searchUrl);
        successToast('Search results loaded');
      } else {
        throw new Error(data.message || 'Search failed');
      }
    } catch (error) {
      errorToast('Search failed', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700/50 overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Toolbar */}
      <div className="bg-zinc-800 border-b border-zinc-700/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScreenshot(null)}
            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={() => renderPage(url)}
            disabled={loading}
            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RotateCw size={16} />
          </button>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && renderPage(url)}
            placeholder="Enter URL..."
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => renderPage(url)}
            disabled={loading}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-sm text-white transition-colors disabled:opacity-50"
          >
            Go
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-900/20 rounded text-red-400 hover:text-red-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the web..."
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-white transition-colors disabled:opacity-50"
          >
            <Search size={16} />
          </button>
        </form>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-zinc-950 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm text-zinc-400">Rendering...</div>
            </div>
          </div>
        )}
        {screenshot ? (
          <img
            src={screenshot}
            alt="Web page screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-4xl opacity-20">🌐</div>
              <div className="text-zinc-500 text-sm">Enter a URL or search to begin</div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-zinc-800 border-t border-zinc-700/50 px-3 py-1 text-xs text-zinc-500">
        {screenshot ? `Loaded: ${url}` : 'Ready'}
      </div>
    </div>
  );
};
