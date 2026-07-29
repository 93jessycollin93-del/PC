/**
 * Knowledge service — the one seam callers depend on for document search.
 *
 * Two retrieval implementations exist (keyword TF-IDF and embedding
 * similarity) and they are NOT equally available: embeddings need a model
 * resident in memory, which off-grid may simply not be there. Rather than let
 * every caller branch on "do we have embeddings", the gap is normalized here
 * once and published as data (`RetrievalMode`) the UI can render.
 *
 * Callers get one method — `search()` — and never learn which tier answered.
 * Adding a third retrieval strategy later means implementing it here, with no
 * change to any caller.
 */

import { chunkDocument, type ChunkOptions } from './chunking';
import { searchByKeyword, type IndexedChunk, type ScoredChunk } from './keywordIndex';
import { cosineSimilarity } from './vectorMath';

export type RetrievalMode = 'keyword' | 'semantic';

export interface KnowledgeDocument {
  id: string;
  title: string;
  /** Where this came from — a note, an app, an imported file. */
  source?: string;
  addedAt: number;
}

export interface SearchOutcome {
  results: ScoredChunk[];
  /** Which tier actually answered, so the UI can be honest about it. */
  mode: RetrievalMode;
}

/** Produces embeddings when one is available. Absent means keyword-only. */
export type Embedder = (text: string) => number[] | null;

export class KnowledgeService {
  private documents = new Map<string, KnowledgeDocument>();
  private chunks: IndexedChunk[] = [];

  /**
   * Injected rather than imported so this module stays pure and testable, and
   * so the app can wire a real embedder later without touching this file.
   * Defaults to "no embedder", which is the honest off-grid baseline.
   */
  private embedder: Embedder = () => null;

  public setEmbedder(embedder: Embedder): void {
    this.embedder = embedder;
  }

  /** Can semantic search actually run right now? Capability as data. */
  public canSearchSemantically(): boolean {
    if (this.chunks.every(c => !c.embedding)) return false;
    try {
      return this.embedder('probe') !== null;
    } catch {
      return false;
    }
  }

  /**
   * Add a document. Chunking happens immediately; embedding is attempted only
   * if an embedder is wired, and a failure there is not fatal — the document
   * stays fully keyword-searchable, which is the point of the two tiers.
   */
  public addDocument(
    doc: Omit<KnowledgeDocument, 'addedAt'> & { addedAt?: number },
    text: string,
    options?: ChunkOptions
  ): number {
    const record: KnowledgeDocument = {
      ...doc,
      addedAt: doc.addedAt ?? Date.now(),
    };
    this.documents.set(record.id, record);

    // Re-adding the same id replaces its chunks rather than duplicating them.
    this.chunks = this.chunks.filter(c => c.docId !== record.id);

    const produced = chunkDocument(text, options);
    for (const chunk of produced) {
      let embedding: number[] | undefined;
      try {
        embedding = this.embedder(chunk.content) ?? undefined;
      } catch {
        embedding = undefined;
      }
      this.chunks.push({
        id: `${record.id}#${chunk.position}`,
        docId: record.id,
        content: chunk.content,
        position: chunk.position,
        embedding,
      });
    }
    return produced.length;
  }

  public removeDocument(docId: string): boolean {
    const existed = this.documents.delete(docId);
    this.chunks = this.chunks.filter(c => c.docId !== docId);
    return existed;
  }

  public listDocuments(): KnowledgeDocument[] {
    return [...this.documents.values()].sort((a, b) => b.addedAt - a.addedAt);
  }

  public getChunks(): readonly IndexedChunk[] {
    return this.chunks;
  }

  public clear(): void {
    this.documents.clear();
    this.chunks = [];
  }

  /**
   * Search. Uses embeddings when they are genuinely available and falls back to
   * keyword otherwise — the caller does not choose, and cannot get it wrong.
   */
  public search(query: string, topK = 5): SearchOutcome {
    if (!query.trim() || this.chunks.length === 0) {
      return { results: [], mode: 'keyword' };
    }

    if (this.canSearchSemantically()) {
      let queryVec: number[] | null = null;
      try {
        queryVec = this.embedder(query);
      } catch {
        queryVec = null;
      }
      if (queryVec) {
        const results = this.chunks
          .filter(c => c.embedding)
          .map(chunk => ({
            chunk,
            score: cosineSimilarity(queryVec as number[], chunk.embedding as number[]),
          }))
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);
        // An embedder that returns a vector matching nothing is a worse answer
        // than keyword would give, so fall through rather than return empty.
        if (results.length > 0) return { results, mode: 'semantic' };
      }
    }

    return { results: searchByKeyword(query, this.chunks, topK), mode: 'keyword' };
  }
}

/** Shared instance for the app; tests construct their own. */
export const knowledgeService = new KnowledgeService();
