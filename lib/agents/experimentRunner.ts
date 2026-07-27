/**
 * Experiment Runner — Orchestrate parallel AI agent calls
 * Run the same prompt across multiple agents and collect responses
 */

import { AgentConfig, AgentResponse, getAgentConfig, getAgentApiKey } from './agentRegistry';

export interface Experiment {
    id: string;
    title: string;
    prompt: string;
    selectedAgentIds: string[];
    responses: Map<string, AgentResponse>;
    theme?: string; // 'code' | 'creative' | 'analysis' | 'research'
    createdAt: Date;
    updatedAt: Date;
    isRunning: boolean;
    completedCount: number;
    totalCount: number;
}

export interface ExperimentResult {
    experiment: Experiment;
    responses: AgentResponse[];
    error?: string;
}

/**
 * Create a new experiment
 */
export const createExperiment = (
    title: string,
    prompt: string,
    agentIds: string[],
    theme?: string
): Experiment => {
    return {
        id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        prompt,
        selectedAgentIds: agentIds,
        responses: new Map(),
        theme,
        createdAt: new Date(),
        updatedAt: new Date(),
        isRunning: false,
        completedCount: 0,
        totalCount: agentIds.length,
    };
};

/**
 * Call a single AI agent
 */
const callAgent = async (agentId: string, prompt: string): Promise<AgentResponse> => {
    const config = getAgentConfig(agentId);
    if (!config) {
        throw new Error(`Agent not found: ${agentId}`);
    }

    const startTime = performance.now();
    const apiKey = getAgentApiKey(agentId);

    try {
        // Route to appropriate API
        let response: AgentResponse;

        if (config.provider === 'claude') {
            response = await callClaudeApi(config, prompt, apiKey);
        } else if (config.provider === 'gemini') {
            response = await callGeminiApi(config, prompt, apiKey);
        } else if (config.provider === 'grok') {
            response = await callGrokApi(config, prompt, apiKey);
        } else if (config.provider === 'groq') {
            response = await callGroqApi(config, prompt, apiKey);
        } else if (config.provider === 'openrouter') {
            response = await callOpenRouterApi(config, prompt, apiKey);
        } else if (config.provider === 'ollama') {
            response = await callOllamaApi(config, prompt);
        } else {
            throw new Error(`Unknown provider: ${config.provider}`);
        }

        response.latencyMs = performance.now() - startTime;
        response.timestamp = new Date();
        return response;
    } catch (error) {
        const latencyMs = performance.now() - startTime;
        return {
            agentId,
            agentName: config.name,
            content: '',
            latencyMs,
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

/**
 * Call Claude API
 */
const callClaudeApi = async (
    config: AgentConfig,
    prompt: string,
    apiKey?: string
): Promise<AgentResponse> => {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens || 2048,
            temperature: config.temperature || 0.7,
            system: config.systemPrompt || 'You are a helpful AI assistant.',
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        agentId: config.id,
        agentName: config.name,
        content: data.content[0]?.text || '',
        tokensUsed: data.usage?.output_tokens,
        latencyMs: 0,
        timestamp: new Date(),
    };
};

/**
 * Call Gemini API
 */
const callGeminiApi = async (
    config: AgentConfig,
    prompt: string,
    apiKey?: string
): Promise<AgentResponse> => {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (!key) throw new Error('GOOGLE_API_KEY not configured');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: config.temperature || 0.7,
                    maxOutputTokens: config.maxTokens || 2048,
                },
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        agentId: config.id,
        agentName: config.name,
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        latencyMs: 0,
        timestamp: new Date(),
    };
};

/**
 * Call Grok API (via xAI)
 */
const callGrokApi = async (
    config: AgentConfig,
    prompt: string,
    apiKey?: string
): Promise<AgentResponse> => {
    const key = apiKey || process.env.XAI_API_KEY;
    if (!key) throw new Error('XAI_API_KEY not configured');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens || 2048,
        }),
    });

    if (!response.ok) {
        throw new Error(`Grok API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        agentId: config.id,
        agentName: config.name,
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.completion_tokens,
        latencyMs: 0,
        timestamp: new Date(),
    };
};

/**
 * Call Groq API
 */
const callGroqApi = async (
    config: AgentConfig,
    prompt: string,
    apiKey?: string
): Promise<AgentResponse> => {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not configured');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens || 2048,
        }),
    });

    if (!response.ok) {
        throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        agentId: config.id,
        agentName: config.name,
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.completion_tokens,
        latencyMs: 0,
        timestamp: new Date(),
    };
};

/**
 * Call OpenRouter API
 */
const callOpenRouterApi = async (
    config: AgentConfig,
    prompt: string,
    apiKey?: string
): Promise<AgentResponse> => {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY not configured');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens || 2048,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        agentId: config.id,
        agentName: config.name,
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.completion_tokens,
        latencyMs: 0,
        timestamp: new Date(),
    };
};

/**
 * Call Ollama API (local)
 */
const callOllamaApi = async (config: AgentConfig, prompt: string): Promise<AgentResponse> => {
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: config.model,
            prompt,
            stream: false,
            temperature: config.temperature || 0.7,
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        agentId: config.id,
        agentName: config.name,
        content: data.response || '',
        latencyMs: 0,
        timestamp: new Date(),
    };
};

/**
 * Run experiment: call all agents in parallel
 */
export const runExperiment = async (
    experiment: Experiment,
    onProgress?: (completed: number, total: number) => void
): Promise<ExperimentResult> => {
    experiment.isRunning = true;
    experiment.completedCount = 0;

    const promises = experiment.selectedAgentIds.map(async (agentId) => {
        try {
            const response = await callAgent(agentId, experiment.prompt);
            experiment.responses.set(agentId, response);
            experiment.completedCount++;
            onProgress?.(experiment.completedCount, experiment.totalCount);
            return response;
        } catch (error) {
            const errorResponse: AgentResponse = {
                agentId,
                agentName: getAgentConfig(agentId)?.name || agentId,
                content: '',
                latencyMs: 0,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            experiment.responses.set(agentId, errorResponse);
            experiment.completedCount++;
            onProgress?.(experiment.completedCount, experiment.totalCount);
            return errorResponse;
        }
    });

    try {
        const responses = await Promise.all(promises);
        experiment.isRunning = false;
        experiment.updatedAt = new Date();
        return { experiment, responses };
    } catch (error) {
        experiment.isRunning = false;
        return {
            experiment,
            responses: Array.from(experiment.responses.values()),
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

/**
 * Save experiment to localStorage
 */
export const saveExperiment = (experiment: Experiment) => {
    if (typeof window !== 'undefined') {
        const serialized = {
            ...experiment,
            responses: Array.from(experiment.responses.entries()),
            createdAt: experiment.createdAt.toISOString(),
            updatedAt: experiment.updatedAt.toISOString(),
        };
        localStorage.setItem(`exp_${experiment.id}`, JSON.stringify(serialized));
    }
};

/**
 * Load experiment from localStorage
 */
export const loadExperiment = (experimentId: string): Experiment | null => {
    if (typeof window !== 'undefined') {
        const data = localStorage.getItem(`exp_${experimentId}`);
        if (data) {
            const parsed = JSON.parse(data);
            return {
                ...parsed,
                responses: new Map(parsed.responses),
                createdAt: new Date(parsed.createdAt),
                updatedAt: new Date(parsed.updatedAt),
            };
        }
    }
    return null;
};

/**
 * List all saved experiments
 */
export const listExperiments = (): Experiment[] => {
    if (typeof window !== 'undefined') {
        const experiments: Experiment[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('exp_')) {
                const data = localStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    experiments.push({
                        ...parsed,
                        responses: new Map(parsed.responses),
                        createdAt: new Date(parsed.createdAt),
                        updatedAt: new Date(parsed.updatedAt),
                    });
                }
            }
        }
        return experiments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return [];
};
