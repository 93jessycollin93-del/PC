/**
 * Response Analyzer — Compare and score AI responses
 */

import { AgentResponse } from './agentRegistry';

export interface ResponseMetrics {
    agentId: string;
    agentName: string;
    length: number;
    wordCount: number;
    lineCount: number;
    latencyMs: number;
    hasError: boolean;
    codeBlockCount: number;
    averageLineLength: number;
}

export interface ComparisonScore {
    agentId: string;
    agentName: string;
    readabilityScore: number; // 0-100
    completenessScore: number; // 0-100
    speedScore: number; // 0-100
    overallScore: number; // 0-100
    userRating?: number; // 1-5 stars
}

/**
 * Extract metrics from a response
 */
export const extractMetrics = (response: AgentResponse): ResponseMetrics => {
    const lines = response.content.split('\n');
    const words = response.content.split(/\s+/).filter(w => w.length > 0);
    const codeBlocks = (response.content.match(/```/g) || []).length / 2;

    return {
        agentId: response.agentId,
        agentName: response.agentName,
        length: response.content.length,
        wordCount: words.length,
        lineCount: lines.length,
        latencyMs: response.latencyMs,
        hasError: !!response.error,
        codeBlockCount: codeBlocks,
        averageLineLength: response.content.length / Math.max(lines.length, 1),
    };
};

/**
 * Calculate readability score (0-100)
 * Based on word count, line length, and structure
 */
const calculateReadabilityScore = (metrics: ResponseMetrics): number => {
    if (metrics.hasError) return 0;

    let score = 50; // Base score

    // Penalize if too short
    if (metrics.wordCount < 10) score -= 20;
    // Penalize if too long
    if (metrics.wordCount > 5000) score -= 15;

    // Reward good formatting (code blocks, line breaks)
    if (metrics.lineCount > 10) score += 15;
    if (metrics.codeBlockCount > 0) score += 10;

    // Penalize overly long lines (hard to read)
    if (metrics.averageLineLength > 100) score -= 10;

    return Math.max(0, Math.min(100, score));
};

/**
 * Calculate completeness score (0-100)
 * Based on response length and depth
 */
const calculateCompletenessScore = (metrics: ResponseMetrics): number => {
    if (metrics.hasError) return 0;

    let score = 50; // Base score

    // Reward word count (more comprehensive)
    if (metrics.wordCount > 500) score += 20;
    if (metrics.wordCount > 1000) score += 10;
    if (metrics.wordCount > 2000) score += 5;

    // Reward code examples
    if (metrics.codeBlockCount > 0) score += 15;

    return Math.max(0, Math.min(100, score));
};

/**
 * Calculate speed score (0-100)
 * Based on response latency (lower is better)
 */
const calculateSpeedScore = (metrics: ResponseMetrics, allMetrics: ResponseMetrics[]): number => {
    if (metrics.hasError) return 0;

    const avgLatency = allMetrics.reduce((sum, m) => sum + m.latencyMs, 0) / allMetrics.length;
    const latencyRatio = metrics.latencyMs / avgLatency;

    // Score: 100 = 0.5x avg, 50 = 1x avg, 0 = 3x+ avg
    if (latencyRatio <= 0.5) return 100;
    if (latencyRatio <= 1) return 75;
    if (latencyRatio <= 1.5) return 50;
    if (latencyRatio <= 2) return 25;
    return 0;
};

/**
 * Calculate similarity between two responses (0-1)
 * Uses simple string similarity (not ML-based)
 */
export const calculateSimilarity = (response1: AgentResponse, response2: AgentResponse): number => {
    const text1 = response1.content.toLowerCase();
    const text2 = response2.content.toLowerCase();

    if (text1 === text2) return 1;
    if (text1.length === 0 || text2.length === 0) return 0;

    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length >= text2.length ? text1 : text2;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) matches++;
    }

    return matches / longer.length;
};

/**
 * Score all responses in an experiment
 */
export const scoreResponses = (responses: AgentResponse[]): ComparisonScore[] => {
    const metrics = responses.map(r => extractMetrics(r));

    return metrics.map(m => {
        const readabilityScore = calculateReadabilityScore(m);
        const completenessScore = calculateCompletenessScore(m);
        const speedScore = calculateSpeedScore(m, metrics);
        const overallScore = (readabilityScore + completenessScore + speedScore) / 3;

        return {
            agentId: m.agentId,
            agentName: m.agentName,
            readabilityScore: Math.round(readabilityScore),
            completenessScore: Math.round(completenessScore),
            speedScore: Math.round(speedScore),
            overallScore: Math.round(overallScore),
        };
    });
};

/**
 * Find consensus in responses (similar answers from multiple agents)
 */
export const findConsensus = (responses: AgentResponse[], threshold: number = 0.7): string[] => {
    const consensus: string[] = [];

    for (let i = 0; i < responses.length; i++) {
        let similarCount = 1;
        for (let j = i + 1; j < responses.length; j++) {
            const similarity = calculateSimilarity(responses[i], responses[j]);
            if (similarity >= threshold) {
                similarCount++;
            }
        }

        if (similarCount >= Math.ceil(responses.length / 2)) {
            consensus.push(responses[i].agentId);
        }
    }

    return [...new Set(consensus)];
};

/**
 * Extract key differences between responses
 */
export const findDifferences = (
    response1: AgentResponse,
    response2: AgentResponse
): { unique1: string[]; unique2: string[] } => {
    const lines1 = response1.content.split('\n');
    const lines2 = response2.content.split('\n');

    const unique1 = lines1.filter(line => !lines2.includes(line));
    const unique2 = lines2.filter(line => !lines1.includes(line));

    return { unique1, unique2 };
};
