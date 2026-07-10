import React, { useState, useMemo } from 'react';
import { Search, Download, ExternalLink, Copy, Check, ChevronDown, Filter, Star } from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
  pricing: string;
  url: string;
  docs: string;
  features: string[];
  setupTime: string;
  requiresKey: boolean;
  apiKeyField?: string;
  rating?: number;
}

const TOOLS_DATABASE: Tool[] = [
  // AI/LLM
  { id: 'groq', name: 'Groq', category: 'AI/LLM', type: 'API', description: 'High-speed LLM inference platform', pricing: 'Free', url: 'https://groq.com', docs: 'https://console.groq.com/docs', features: ['Mixtral', 'Llama 2', 'Ultra-fast inference'], setupTime: '5 min', requiresKey: true, apiKeyField: 'GROQ_API_KEY', rating: 5 },
  { id: 'ollama', name: 'Ollama', category: 'AI/LLM', type: 'Local', description: 'Run LLMs locally with simple setup', pricing: 'Free', url: 'https://ollama.ai', docs: 'https://github.com/ollama/ollama', features: ['Local execution', 'No internet needed', 'Multiple models'], setupTime: '10 min', requiresKey: false, rating: 5 },
  { id: 'openrouter', name: 'OpenRouter', category: 'AI/LLM', type: 'API', description: 'Unified API for multiple LLM providers', pricing: 'Free tier + pay-as-you-go', url: 'https://openrouter.ai', docs: 'https://openrouter.ai/docs', features: ['Multiple models', 'Cost aggregation', 'Fallback routing'], setupTime: '5 min', requiresKey: true, apiKeyField: 'OPENROUTER_API_KEY', rating: 4.5 },
  { id: 'gemini', name: 'Google Gemini', category: 'AI/LLM', type: 'API', description: 'Google\'s multimodal AI API', pricing: 'Free tier', url: 'https://ai.google.dev', docs: 'https://ai.google.dev/docs', features: ['Multimodal', 'Vision', 'Text generation'], setupTime: '5 min', requiresKey: true, apiKeyField: 'GEMINI_API_KEY', rating: 4.5 },
  { id: 'huggingface', name: 'HuggingFace', category: 'AI/LLM', type: 'Platform', description: 'AI model hub and inference API', pricing: 'Free + paid', url: 'https://huggingface.co', docs: 'https://huggingface.co/docs', features: ['Model hub', 'Inference API', 'Transformers'], setupTime: '10 min', requiresKey: true, apiKeyField: 'HF_TOKEN', rating: 5 },
  { id: 'together', name: 'Together AI', category: 'AI/LLM', type: 'API', description: 'Open-source model API platform', pricing: 'Free trial + usage-based', url: 'https://www.together.ai', docs: 'https://www.together.ai/documentation', features: ['Multiple OSS models', 'Fast inference', 'Low cost'], setupTime: '5 min', requiresKey: true, apiKeyField: 'TOGETHER_API_KEY', rating: 4.5 },
  { id: 'grok', name: 'Grok', category: 'AI/LLM', type: 'API', description: 'xAI\'s powerful reasoning model', pricing: 'Paid API', url: 'https://x.ai', docs: 'https://docs.x.ai', features: ['Advanced reasoning', 'Real-time info', 'Code understanding'], setupTime: '5 min', requiresKey: true, apiKeyField: 'GROK_API_KEY', rating: 4.5 },
  { id: 'deepseek', name: 'DeepSeek', category: 'AI/LLM', type: 'API', description: 'Cost-effective LLM inference', pricing: 'Very cheap', url: 'https://www.deepseek.com', docs: 'https://platform.deepseek.com/api-docs', features: ['Low cost', 'Multiple models', 'Good performance'], setupTime: '5 min', requiresKey: true, apiKeyField: 'DEEPSEEK_API_KEY', rating: 4 },

  // Dev Tools
  { id: 'eslint', name: 'ESLint', category: 'Dev Tools', type: 'Linter', description: 'JavaScript code quality tool', pricing: 'Free', url: 'https://eslint.org', docs: 'https://eslint.org/docs', features: ['Code linting', 'Configurable rules', 'Auto-fix'], setupTime: '5 min', requiresKey: false, rating: 5 },
  { id: 'prettier', name: 'Prettier', category: 'Dev Tools', type: 'Formatter', description: 'Opinionated code formatter', pricing: 'Free', url: 'https://prettier.io', docs: 'https://prettier.io/docs', features: ['Auto formatting', 'Language support', 'IDE integration'], setupTime: '2 min', requiresKey: false, rating: 5 },
  { id: 'jest', name: 'Jest', category: 'Dev Tools', type: 'Testing', description: 'JavaScript testing framework', pricing: 'Free', url: 'https://jestjs.io', docs: 'https://jestjs.io/docs/getting-started', features: ['Unit testing', 'Snapshot testing', 'Coverage'], setupTime: '5 min', requiresKey: false, rating: 5 },
  { id: 'typescript', name: 'TypeScript', category: 'Dev Tools', type: 'Language', description: 'Typed JavaScript superset', pricing: 'Free', url: 'https://www.typescriptlang.org', docs: 'https://www.typescriptlang.org/docs', features: ['Type safety', 'IDE support', 'Compilation'], setupTime: '10 min', requiresKey: false, rating: 5 },
  { id: 'docker', name: 'Docker', category: 'Dev Tools', type: 'Containerization', description: 'Container platform', pricing: 'Free + paid', url: 'https://www.docker.com', docs: 'https://docs.docker.com', features: ['Containerization', 'Compose', 'Registry'], setupTime: '20 min', requiresKey: false, rating: 5 },
  { id: 'git', name: 'Git', category: 'Dev Tools', type: 'VCS', description: 'Version control system', pricing: 'Free', url: 'https://git-scm.com', docs: 'https://git-scm.com/doc', features: ['Distributed VCS', 'Branching', 'Merging'], setupTime: '5 min', requiresKey: false, rating: 5 },
  { id: 'vscode', name: 'VS Code', category: 'Dev Tools', type: 'Editor', description: 'Lightweight code editor', pricing: 'Free', url: 'https://code.visualstudio.com', docs: 'https://code.visualstudio.com/docs', features: ['Debugging', 'Extensions', 'Git integration'], setupTime: '10 min', requiresKey: false, rating: 5 },
  { id: 'nodejs', name: 'Node.js', category: 'Dev Tools', type: 'Runtime', description: 'JavaScript runtime', pricing: 'Free', url: 'https://nodejs.org', docs: 'https://nodejs.org/docs', features: ['Server-side JS', 'npm ecosystem', 'Event-driven'], setupTime: '10 min', requiresKey: false, rating: 5 },
  { id: 'webpack', name: 'Webpack', category: 'Dev Tools', type: 'Bundler', description: 'Module bundler for JavaScript', pricing: 'Free', url: 'https://webpack.js.org', docs: 'https://webpack.js.org/concepts', features: ['Bundling', 'Code splitting', 'Plugins'], setupTime: '15 min', requiresKey: false, rating: 4.5 },

  // Data Science
  { id: 'pandas', name: 'Pandas', category: 'Data Science', type: 'Library', description: 'Python data manipulation library', pricing: 'Free', url: 'https://pandas.pydata.org', docs: 'https://pandas.pydata.org/docs', features: ['DataFrames', 'CSV/Excel support', 'Data cleaning'], setupTime: '5 min', requiresKey: false, rating: 5 },
  { id: 'numpy', name: 'NumPy', category: 'Data Science', type: 'Library', description: 'Numerical computing library', pricing: 'Free', url: 'https://numpy.org', docs: 'https://numpy.org/doc', features: ['Arrays', 'Linear algebra', 'Math functions'], setupTime: '5 min', requiresKey: false, rating: 5 },
  { id: 'matplotlib', name: 'Matplotlib', category: 'Data Science', type: 'Visualization', description: 'Python plotting library', pricing: 'Free', url: 'https://matplotlib.org', docs: 'https://matplotlib.org/stable/contents.html', features: ['Charts', 'Plots', 'Animations'], setupTime: '5 min', requiresKey: false, rating: 4.5 },
  { id: 'duckdb', name: 'DuckDB', category: 'Data Science', type: 'Database', description: 'In-process SQL database', pricing: 'Free', url: 'https://duckdb.org', docs: 'https://duckdb.org/docs', features: ['SQL queries', 'CSV/Parquet support', 'Fast analytics'], setupTime: '5 min', requiresKey: false, rating: 5 },
  { id: 'scikit-learn', name: 'Scikit-learn', category: 'Data Science', type: 'ML', description: 'Machine learning library', pricing: 'Free', url: 'https://scikit-learn.org', docs: 'https://scikit-learn.org/stable', features: ['Classification', 'Regression', 'Clustering'], setupTime: '10 min', requiresKey: false, rating: 5 },

  // Cloud/Infrastructure
  { id: 'aws-cli', name: 'AWS CLI', category: 'Cloud/Infra', type: 'CLI', description: 'Amazon Web Services CLI', pricing: 'Free', url: 'https://aws.amazon.com/cli', docs: 'https://docs.aws.amazon.com/cli', features: ['Cloud management', 'Scripting', 'Automation'], setupTime: '10 min', requiresKey: true, apiKeyField: 'AWS_ACCESS_KEY_ID', rating: 4.5 },
  { id: 'terraform', name: 'Terraform', category: 'Cloud/Infra', type: 'IaC', description: 'Infrastructure as code tool', pricing: 'Free', url: 'https://www.terraform.io', docs: 'https://www.terraform.io/docs', features: ['IaC', 'Multi-cloud', 'State management'], setupTime: '15 min', requiresKey: false, rating: 5 },
  { id: 'kubernetes', name: 'Kubernetes', category: 'Cloud/Infra', type: 'Orchestration', description: 'Container orchestration platform', pricing: 'Free', url: 'https://kubernetes.io', docs: 'https://kubernetes.io/docs', features: ['Container orchestration', 'Auto-scaling', 'Self-healing'], setupTime: '30 min', requiresKey: false, rating: 4.5 },

  // Database
  { id: 'postgresql', name: 'PostgreSQL', category: 'Database', type: 'RDBMS', description: 'Advanced open-source database', pricing: 'Free', url: 'https://www.postgresql.org', docs: 'https://www.postgresql.org/docs', features: ['SQL', 'ACID compliance', 'Extensions'], setupTime: '10 min', requiresKey: false, rating: 5 },
  { id: 'mongodb', name: 'MongoDB', category: 'Database', type: 'NoSQL', description: 'Document database', pricing: 'Free + paid', url: 'https://www.mongodb.com', docs: 'https://docs.mongodb.com', features: ['Document storage', 'Flexible schema', 'Indexing'], setupTime: '10 min', requiresKey: false, rating: 4.5 },
  { id: 'redis', name: 'Redis', category: 'Database', type: 'Cache', description: 'In-memory data store', pricing: 'Free', url: 'https://redis.io', docs: 'https://redis.io/documentation', features: ['Caching', 'Sessions', 'Real-time data'], setupTime: '5 min', requiresKey: false, rating: 5 },
];

interface CategoryInfo {
  name: string;
  color: string;
  count: number;
}

export const ToolRegistryApp: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    TOOLS_DATABASE.forEach(tool => {
      cats.set(tool.category, (cats.get(tool.category) || 0) + 1);
    });
    return Array.from(cats.entries()).map(([name, count]) => ({ name, count }));
  }, []);

  const filteredTools = useMemo(() => {
    return TOOLS_DATABASE.filter(tool => {
      const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || tool.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleCopyUrl = (url: string, toolId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(toolId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApiKeySave = (toolId: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [toolId]: key }));
    localStorage.setItem(`tool_api_key_${toolId}`, key);
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'AI/LLM': 'from-purple-500 to-pink-500',
      'Dev Tools': 'from-blue-500 to-cyan-500',
      'Data Science': 'from-green-500 to-emerald-500',
      'Cloud/Infra': 'from-orange-500 to-red-500',
      'Database': 'from-indigo-500 to-blue-500',
      'Media': 'from-yellow-500 to-orange-500',
      'Search': 'from-red-500 to-pink-500',
    };
    return colors[category] || 'from-gray-500 to-slate-500';
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Star size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Tool Registry</h1>
          </div>
          <p className="text-slate-400">Discover, setup, and integrate 100+ free tools and APIs</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search tools by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white placeholder-slate-400 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none transition"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full font-medium transition flex items-center gap-2 ${
                selectedCategory === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Filter size={16} /> All ({TOOLS_DATABASE.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  selectedCategory === cat.name
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {filteredTools.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-lg">No tools found matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map(tool => (
                <div
                  key={tool.id}
                  className="bg-slate-700 border border-slate-600 rounded-lg hover:border-slate-500 transition overflow-hidden flex flex-col"
                >
                  {/* Tool Header */}
                  <div className={`bg-gradient-to-r ${getCategoryColor(tool.category)} p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{tool.name}</h3>
                          {tool.rating && (
                            <div className="flex items-center gap-1 text-yellow-300">
                              <Star size={14} className="fill-current" />
                              <span className="text-xs font-bold">{tool.rating}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-white/80 mt-1">{tool.type}</p>
                      </div>
                      <span className="px-2 py-1 bg-white/20 rounded text-xs font-semibold text-white whitespace-nowrap ml-2">
                        {tool.pricing}
                      </span>
                    </div>
                  </div>

                  {/* Tool Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-sm text-slate-300 mb-3">{tool.description}</p>
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-slate-400 mb-2">Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {tool.features.slice(0, 2).map((f, i) => (
                          <span key={i} className="px-2 py-1 bg-slate-600 text-xs text-slate-200 rounded">
                            {f}
                          </span>
                        ))}
                        {tool.features.length > 2 && (
                          <span className="px-2 py-1 bg-slate-600 text-xs text-slate-200 rounded">
                            +{tool.features.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                      <span>⏱️ Setup: {tool.setupTime}</span>
                      {tool.requiresKey && <span className="text-amber-400">🔑 API Key required</span>}
                    </div>

                    {/* Expandable API Key Section */}
                    {tool.requiresKey && (
                      <div className="mb-3">
                        <button
                          onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                          className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium text-slate-200 flex items-center justify-between transition"
                        >
                          <span>Configure API Key</span>
                          <ChevronDown size={14} className={`transition ${expandedTool === tool.id ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedTool === tool.id && (
                          <input
                            type="password"
                            placeholder={`Enter your ${tool.name} API key...`}
                            value={apiKeys[tool.id] || ''}
                            onChange={(e) => handleApiKeySave(tool.id, e.target.value)}
                            className="w-full mt-2 px-3 py-2 bg-slate-600 text-white placeholder-slate-400 rounded text-xs border border-slate-500 focus:border-purple-500 focus:outline-none"
                          />
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => handleCopyUrl(tool.url, tool.id)}
                        className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium text-slate-200 flex items-center justify-center gap-1 transition"
                      >
                        {copiedId === tool.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === tool.id ? 'Copied!' : 'Copy URL'}
                      </button>
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium text-white flex items-center justify-center gap-1 transition"
                      >
                        <Download size={14} /> Get
                      </a>
                      <a
                        href={tool.docs}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium text-slate-200 flex items-center gap-1 transition"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        <div className="max-w-7xl mx-auto text-center text-slate-400 text-sm">
          Showing {filteredTools.length} of {TOOLS_DATABASE.length} tools
          {selectedCategory && ` in ${selectedCategory}`}
        </div>
      </div>
    </div>
  );
};
