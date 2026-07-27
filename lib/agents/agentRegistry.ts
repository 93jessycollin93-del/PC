/**
 * Agent Registry — Configuration for all AI providers
 * Centralized management of API keys, model versions, and agent capabilities
 */

export type AgentProvider = 'claude' | 'gemini' | 'grok' | 'openrouter' | 'groq' | 'ollama';

export interface AgentConfig {
    id: string;
    name: string;
    provider: AgentProvider;
    model: string;
    description?: string;
    capabilities: string[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    apiKeyEnvVar?: string;
    baseUrl?: string;
    isLocal?: boolean;
    enabled: boolean;
}

export interface AgentResponse {
    agentId: string;
    agentName: string;
    content: string;
    tokensUsed?: number;
    latencyMs: number;
    timestamp: Date;
    error?: string;
}

export const AGENT_REGISTRY: AgentConfig[] = [
    {
        id: 'claude-opus',
        name: 'Claude Opus',
        provider: 'claude',
        model: 'claude-opus-4-1-20250805',
        description: 'Most capable; best for complex reasoning',
        capabilities: ['code', 'analysis', 'creative', 'research'],
        temperature: 0.7,
        maxTokens: 4096,
        enabled: true,
    },
    {
        id: 'claude-sonnet',
        name: 'Claude Sonnet',
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        description: 'Fast and capable; balanced',
        capabilities: ['code', 'analysis', 'creative', 'research'],
        temperature: 0.7,
        maxTokens: 4096,
        enabled: true,
    },
    {
        id: 'claude-haiku',
        name: 'Claude Haiku',
        provider: 'claude',
        model: 'claude-haiku-4-5-20251001',
        description: 'Fastest; good for simple tasks',
        capabilities: ['code', 'analysis', 'creative'],
        temperature: 0.7,
        maxTokens: 2048,
        enabled: true,
    },
    {
        id: 'gemini-2-0',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        description: 'Free tier; multimodal',
        capabilities: ['code', 'analysis', 'creative', 'vision'],
        temperature: 0.7,
        maxTokens: 4096,
        enabled: true,
    },
    {
        id: 'grok-2',
        name: 'Grok-2',
        provider: 'grok',
        model: 'grok-2-1212',
        description: 'Creative; real-time data',
        capabilities: ['code', 'creative', 'research'],
        temperature: 0.8,
        maxTokens: 4096,
        enabled: true,
    },
    {
        id: 'groq-mixtral',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
        description: 'Free tier; fast',
        capabilities: ['code', 'analysis'],
        temperature: 0.7,
        maxTokens: 4096,
        enabled: true,
    },
];

/**
 * Get agent config by ID
 */
export const getAgentConfig = (agentId: string): AgentConfig | undefined => {
    return AGENT_REGISTRY.find(a => a.id === agentId);
};

/**
 * Get enabled agents
 */
export const getEnabledAgents = (): AgentConfig[] => {
    return AGENT_REGISTRY.filter(a => a.enabled);
};

/**
 * Filter agents by capability
 */
export const getAgentsByCapability = (capability: string): AgentConfig[] => {
    return AGENT_REGISTRY.filter(a => a.capabilities.includes(capability) && a.enabled);
};

/**
 * Get API key for agent from environment or localStorage
 */
export const getAgentApiKey = (agentId: string): string | undefined => {
    const config = getAgentConfig(agentId);
    if (!config) return undefined;

    // Check environment (server-side)
    if (typeof process !== 'undefined' && process.env) {
        const envKey = process.env[config.apiKeyEnvVar || `${config.provider.toUpperCase()}_API_KEY`];
        if (envKey) return envKey;
    }

    // Check localStorage (client-side)
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`agent_apikey_${agentId}`);
        if (stored) return stored;
    }

    return undefined;
};

/**
 * Store API key in localStorage
 */
export const setAgentApiKey = (agentId: string, apiKey: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(`agent_apikey_${agentId}`, apiKey);
    }
};

/**
 * Check if agent has required API key
 */
export const isAgentConfigured = (agentId: string): boolean => {
    const config = getAgentConfig(agentId);
    if (!config) return false;
    if (config.isLocal) return true; // Ollama is local
    return !!getAgentApiKey(agentId);
};
