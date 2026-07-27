/**
 * Prompt Library — centralized versioned prompt store with A/B testing and optimization
 *
 * Features:
 * - Versioned prompt templates usable across all apps
 * - Track prompt performance (quality score, cost, latency)
 * - A/B test variants and auto-rank by quality/cost
 * - Export prompts to sync across devices
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

export interface PromptVersion {
  id: string; // version ID (v1, v2, etc.)
  text: string;
  createdAt: number;
  author?: string;
  notes?: string;
}

export interface PromptMetrics {
  useCount: number;
  qualityScores: number[]; // Array of 1-10 ratings
  avgCost: number; // Tokens or dollars
  avgLatency: number; // ms
  lastUsed?: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string; // 'chat', 'analysis', 'code', 'creative', etc.
  description?: string;
  currentVersionId: string;
  versions: PromptVersion[];
  metrics?: PromptMetrics;
  isActive: boolean;
  tags?: string[];
}

class PromptLibrary {
  private prompts: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.loadPrompts();
  }

  private loadPrompts(): void {
    const storage = appStorage('prompt-library');
    const saved = storage.get<PromptTemplate[]>('templates', []);
    saved.forEach(p => this.prompts.set(p.id, p));
  }

  private savePrompts(): void {
    const storage = appStorage('prompt-library');
    storage.set('templates', Array.from(this.prompts.values()));
  }

  /**
   * Create a new prompt template with initial version
   */
  public createPrompt(
    name: string,
    text: string,
    category: string,
    options: Partial<PromptTemplate> = {}
  ): PromptTemplate {
    const id = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const versionId = `v1`;

    const template: PromptTemplate = {
      id,
      name,
      category,
      description: options.description,
      currentVersionId: versionId,
      versions: [
        {
          id: versionId,
          text,
          createdAt: Date.now(),
          author: options.tags?.[0],
          notes: 'Initial version',
        },
      ],
      isActive: true,
      tags: options.tags || [],
      metrics: {
        useCount: 0,
        qualityScores: [],
        avgCost: 0,
        avgLatency: 0,
      },
    };

    this.prompts.set(id, template);
    this.savePrompts();

    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Prompt created',
      message: `"${name}" added to library`,
      source: 'prompt-library',
    });

    return template;
  }

  /**
   * Create a new version of an existing prompt (A/B variant)
   */
  public createVersion(
    promptId: string,
    text: string,
    notes?: string,
    author?: string
  ): PromptTemplate | undefined {
    const prompt = this.prompts.get(promptId);
    if (!prompt) return undefined;

    const vNum = prompt.versions.length + 1;
    const versionId = `v${vNum}`;

    prompt.versions.push({
      id: versionId,
      text,
      createdAt: Date.now(),
      author,
      notes,
    });

    this.savePrompts();
    return prompt;
  }

  /**
   * Get a prompt (current version)
   */
  public getPrompt(id: string): PromptTemplate | undefined {
    return this.prompts.get(id);
  }

  /**
   * Get the current text of a prompt
   */
  public getPromptText(id: string): string | null {
    const prompt = this.prompts.get(id);
    if (!prompt) return null;
    const version = prompt.versions.find(v => v.id === prompt.currentVersionId);
    return version ? version.text : null;
  }

  /**
   * List all prompts (optionally filter by category)
   */
  public listPrompts(category?: string): PromptTemplate[] {
    const all = Array.from(this.prompts.values()).filter(p => p.isActive);
    return category ? all.filter(p => p.category === category) : all;
  }

  /**
   * Record usage metrics (called after every prompt use)
   */
  public recordUsage(
    promptId: string,
    qualityScore: number, // 1-10
    costTokens: number,
    latencyMs: number
  ): void {
    const prompt = this.prompts.get(promptId);
    if (!prompt) return;

    if (!prompt.metrics) {
      prompt.metrics = {
        useCount: 0,
        qualityScores: [],
        avgCost: 0,
        avgLatency: 0,
      };
    }

    const m = prompt.metrics;
    m.useCount += 1;
    m.qualityScores.push(qualityScore);
    m.avgCost = (m.avgCost * (m.useCount - 1) + costTokens) / m.useCount;
    m.avgLatency = (m.avgLatency * (m.useCount - 1) + latencyMs) / m.useCount;
    m.lastUsed = Date.now();

    this.savePrompts();
  }

  /**
   * Get average quality score for a prompt
   */
  public getQualityScore(promptId: string): number {
    const prompt = this.prompts.get(promptId);
    if (!prompt?.metrics?.qualityScores?.length) return 0;
    const sum = prompt.metrics.qualityScores.reduce((a, b) => a + b, 0);
    return sum / prompt.metrics.qualityScores.length;
  }

  /**
   * Promote a specific version to current (switch to this version)
   */
  public switchVersion(promptId: string, versionId: string): PromptTemplate | undefined {
    const prompt = this.prompts.get(promptId);
    if (!prompt) return undefined;

    const version = prompt.versions.find(v => v.id === versionId);
    if (!version) return undefined;

    prompt.currentVersionId = versionId;
    this.savePrompts();

    bus.emit('jackie-notification', {
      level: 'info',
      title: 'Switched prompt version',
      message: `"${prompt.name}" now using ${versionId}`,
      source: 'prompt-library',
    });

    return prompt;
  }

  /**
   * A/B test variants — compare versions by quality/cost
   */
  public compareVersions(promptId: string): {
    versions: Array<{
      id: string;
      qualityScore: number;
      avgCost: number;
      avgLatency: number;
      useCount: number;
      efficiency: number; // quality / cost
    }>;
  } {
    const prompt = this.prompts.get(promptId);
    if (!prompt) return { versions: [] };

    const versions = prompt.versions.map(v => {
      // Calculate metrics if we recorded usage for this version
      // Simplified: use overall metrics as proxy (real impl would track per-version)
      const m = prompt.metrics;
      const efficiency = m?.avgCost ? (this.getQualityScore(promptId) / m.avgCost) * 100 : 0;

      return {
        id: v.id,
        qualityScore: this.getQualityScore(promptId),
        avgCost: m?.avgCost || 0,
        avgLatency: m?.avgLatency || 0,
        useCount: m?.useCount || 0,
        efficiency,
      };
    });

    return { versions };
  }

  /**
   * Get recommended prompts by category (highest quality + efficiency)
   */
  public getRecommended(category?: string, limit: number = 5): PromptTemplate[] {
    const candidates = this.listPrompts(category);
    return candidates
      .sort((a, b) => {
        const scoreA = this.getQualityScore(a.id);
        const scoreB = this.getQualityScore(b.id);
        const costA = a.metrics?.avgCost || 1;
        const costB = b.metrics?.avgCost || 1;
        const effA = scoreA / costA;
        const effB = scoreB / costB;
        return effB - effA; // Highest efficiency first
      })
      .slice(0, limit);
  }

  /**
   * Export prompts for sync/backup
   */
  public export(): string {
    return JSON.stringify(Array.from(this.prompts.values()), null, 2);
  }

  /**
   * Import prompts from export (merge, don't overwrite)
   */
  public import(json: string): number {
    try {
      const imported = JSON.parse(json) as PromptTemplate[];
      let count = 0;
      imported.forEach(p => {
        if (!this.prompts.has(p.id)) {
          this.prompts.set(p.id, p);
          count++;
        }
      });
      this.savePrompts();
      return count;
    } catch (e) {
      console.error('[promptLibrary] Import failed:', e);
      return 0;
    }
  }

  /**
   * Delete a prompt (soft delete — mark inactive)
   */
  public deletePrompt(id: string): boolean {
    const prompt = this.prompts.get(id);
    if (!prompt) return false;
    prompt.isActive = false;
    this.savePrompts();
    return true;
  }
}

export const promptLibrary = new PromptLibrary();
