/**
 * Semantic Memory Fabric — unified memory recall layer
 *
 * Features:
 * - Unified memory store for decisions, learnings, facts, and context
 * - Tag-based organization and semantic search
 * - Auto-ingestion from app namespaces (vault_memory, archivePod, prompt-library)
 * - Recall & ranking by relevance (tag match + keyword match)
 * - Conversation history linking for context
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'decision' | 'learning' | 'fact' | 'context' | 'conversation';
  title: string;
  content: string;
  tags: string[];
  relatedEntries?: string[];
  sourceApp?: string;
  lastAccessed?: number;
  accessCount?: number;
}

export interface MemoryRecall {
  entries: MemoryEntry[];
  query: string;
  timestamp: number;
}

class MemoryFabric {
  private memories: Map<string, MemoryEntry> = new Map();
  private recallHistory: MemoryRecall[] = [];
  private maxRecallHistory: number = 100;

  constructor() {
    this.loadMemories();
  }

  /**
   * Store a memory entry
   */
  public remember(
    title: string,
    content: string,
    type: 'decision' | 'learning' | 'fact' | 'context' | 'conversation' = 'fact',
    tags: string[] = [],
    sourceApp?: string
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      title,
      content,
      tags: tags.map(t => t.toLowerCase()),
      sourceApp,
      accessCount: 0,
    };

    this.memories.set(entry.id, entry);
    this.saveMemories();

    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Memory stored',
      message: `"${title.slice(0, 40)}..."`,
      source: 'memory-fabric',
    });

    return entry;
  }

  /**
   * Recall memories by query (semantic search)
   */
  public recall(query: string, limit: number = 10): MemoryEntry[] {
    const queryLower = query.toLowerCase();
    const queryTags = query.split(/\s+/).filter(t => t.length > 2);

    const scored = Array.from(this.memories.values()).map(entry => {
      let score = 0;

      // Title match (highest weight)
      if (entry.title.toLowerCase().includes(queryLower)) score += 10;

      // Content match
      if (entry.content.toLowerCase().includes(queryLower)) score += 5;

      // Tag matches
      queryTags.forEach(tag => {
        if (entry.tags.some(t => t.includes(tag))) score += 3;
      });

      // Recency boost (logarithmic)
      const ageMinutes = (Date.now() - entry.timestamp) / 1000 / 60;
      const recencyBoost = Math.max(0, 2 * Math.log(1 + 1000 / (ageMinutes + 1)));
      score += recencyBoost;

      // Access history boost
      score += (entry.accessCount || 0) * 0.5;

      return { entry, score };
    });

    const results = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => {
        const entry = s.entry;
        entry.lastAccessed = Date.now();
        entry.accessCount = (entry.accessCount || 0) + 1;
        return entry;
      });

    this.saveMemories();

    // Log recall for history
    const recall: MemoryRecall = {
      entries: results,
      query,
      timestamp: Date.now(),
    };
    this.recallHistory.push(recall);
    if (this.recallHistory.length > this.maxRecallHistory) {
      this.recallHistory.shift();
    }

    return results;
  }

  /**
   * Recall by tag
   */
  public recallByTag(tag: string): MemoryEntry[] {
    const tagLower = tag.toLowerCase();
    return Array.from(this.memories.values())
      .filter(entry => entry.tags.some(t => t === tagLower))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }

  /**
   * Get all memories
   */
  public getAll(): MemoryEntry[] {
    return Array.from(this.memories.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get memory by ID
   */
  public getMemory(id: string): MemoryEntry | undefined {
    return this.memories.get(id);
  }

  /**
   * Link related memories
   */
  public linkMemories(fromId: string, toId: string): boolean {
    const from = this.memories.get(fromId);
    const to = this.memories.get(toId);
    if (!from || !to) return false;

    if (!from.relatedEntries) from.relatedEntries = [];
    if (!from.relatedEntries.includes(toId)) {
      from.relatedEntries.push(toId);
    }

    if (!to.relatedEntries) to.relatedEntries = [];
    if (!to.relatedEntries.includes(fromId)) {
      to.relatedEntries.push(fromId);
    }

    this.saveMemories();
    return true;
  }

  /**
   * Delete a memory
   */
  public forget(id: string): boolean {
    return this.memories.delete(id);
  }

  /**
   * Get recall stats
   */
  public getStats(): {
    total: number;
    byType: Record<string, number>;
    topTags: string[];
    recentRecalls: MemoryRecall[];
  } {
    const all = Array.from(this.memories.values());
    const byType: Record<string, number> = {
      decision: 0,
      learning: 0,
      fact: 0,
      context: 0,
      conversation: 0,
    };

    all.forEach(m => {
      byType[m.type]++;
    });

    const tagCounts = new Map<string, number>();
    all.forEach(m => {
      m.tags.forEach(t => {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    return {
      total: all.length,
      byType,
      topTags,
      recentRecalls: this.recallHistory.slice(-5),
    };
  }

  /**
   * Ingest memories from app namespace
   */
  public ingestFromNamespace(namespace: string): number {
    const storage = appStorage(namespace);
    const keys = storage.keys();
    let ingested = 0;

    keys.forEach(key => {
      const value = storage.get<any>(key, null);
      if (value && typeof value === 'object') {
        // Auto-detect memory-like structures
        if (value.content || value.message || value.text) {
          const content = value.content || value.message || value.text;
          const title = value.title || value.name || key;
          const tags = value.tags || [namespace];

          this.remember(title, content, 'fact', tags, namespace);
          ingested++;
        }
      }
    });

    return ingested;
  }

  /**
   * Export all memories
   */
  public export(): string {
    return JSON.stringify(
      {
        memories: Array.from(this.memories.values()),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Private methods
   */
  private loadMemories(): void {
    const storage = appStorage('memory-fabric');
    const saved = storage.get<MemoryEntry[]>('entries', []);
    saved.forEach(m => this.memories.set(m.id, m));
  }

  private saveMemories(): void {
    const storage = appStorage('memory-fabric');
    storage.set('entries', Array.from(this.memories.values()));
  }
}

export const memoryFabric = new MemoryFabric();
