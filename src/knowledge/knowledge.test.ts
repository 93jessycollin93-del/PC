/**
 * Offline document search.
 *
 * These drive the REAL chunker, the REAL TF-IDF scorer and the REAL service —
 * the only injected boundary is the embedder, which stands in for a model that
 * genuinely may not exist. Deleting any implementation under test fails these.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chunkDocument } from './chunking';
import { searchByKeyword, tokenize, inverseDocumentFrequency, type IndexedChunk } from './keywordIndex';
import { cosineSimilarity, topKSimilar } from './vectorMath';
import { KnowledgeService } from './knowledgeService';

describe('chunking', () => {
  it('keeps whole paragraphs together when they fit', () => {
    const chunks = chunkDocument('First para here.\n\nSecond para here.', { chunkSize: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('First para');
    expect(chunks[0].content).toContain('Second para');
  });

  it('splits a paragraph too large to fit, with overlap', () => {
    const chunks = chunkDocument('x'.repeat(1200), { chunkSize: 500, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.content.length <= 500)).toBe(true);
  });

  it('numbers chunk positions consecutively from zero', () => {
    const chunks = chunkDocument('y'.repeat(1500), { chunkSize: 300, overlap: 50 });
    expect(chunks.map(c => c.position)).toEqual(chunks.map((_, i) => i));
  });

  it('returns nothing for text below the minimum length', () => {
    expect(chunkDocument('hi')).toEqual([]);
    expect(chunkDocument('')).toEqual([]);
  });
});

describe('keyword retrieval', () => {
  const chunks: IndexedChunk[] = [
    { id: 'a', docId: 'd1', position: 0, content: 'the gpu runs the model locally on your own hardware' },
    { id: 'b', docId: 'd1', position: 1, content: 'cloud providers meter every token you send them' },
    { id: 'c', docId: 'd2', position: 0, content: 'offline mode keeps the desktop usable with no network' },
  ];

  it('ranks the chunk that actually answers the query first', () => {
    const [top] = searchByKeyword('gpu hardware', chunks);
    expect(top.chunk.id).toBe('a');
  });

  it('returns nothing when no chunk shares a term with the query', () => {
    expect(searchByKeyword('zebra tapestry', chunks)).toEqual([]);
  });

  it('still scores terms in a single-document corpus', () => {
    // Unsmoothed IDF collapses to zero when a term is in every chunk, which
    // would return nothing for someone who has added exactly one note.
    const one: IndexedChunk[] = [{ id: 'x', docId: 'd', position: 0, content: 'local first routing' }];
    expect(searchByKeyword('routing', one).length).toBe(1);
  });

  it('drops single characters but keeps real terms, across scripts', () => {
    expect(tokenize('a GPU runs 42 modèles')).toEqual(['gpu', 'runs', '42', 'modèles']);
  });

  it('gives a rarer term a higher idf than a ubiquitous one', () => {
    const idf = inverseDocumentFrequency(chunks);
    expect(idf.get('gpu')!).toBeGreaterThan(idf.get('the')!);
  });

  it('honours topK', () => {
    expect(searchByKeyword('the', chunks, 1)).toHaveLength(1);
  });
});

describe('vector math', () => {
  it('scores identical vectors as 1 and orthogonal as 0', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('treats a zero vector as no similarity rather than dividing by zero', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('returns the k nearest candidates, best first', () => {
    const out = topKSimilar([1, 0], [[0, 1], [1, 0], [0.9, 0.1]], 2);
    expect(out).toHaveLength(2);
    expect(out[0].index).toBe(1);
  });
});

describe('knowledge service', () => {
  let svc: KnowledgeService;
  beforeEach(() => {
    svc = new KnowledgeService();
  });

  it('searches by keyword with no embedder at all — the off-grid baseline', () => {
    svc.addDocument({ id: 'd1', title: 'Notes' }, 'The local box runs the model.\n\nNothing is sent anywhere.');
    const out = svc.search('local box');
    expect(out.mode).toBe('keyword');
    expect(out.results.length).toBeGreaterThan(0);
  });

  it('reports semantic as unavailable when nothing can embed', () => {
    svc.addDocument({ id: 'd1', title: 'N' }, 'some reasonably long content to chunk properly here');
    expect(svc.canSearchSemantically()).toBe(false);
  });

  it('uses semantic search when an embedder is genuinely available', () => {
    // A toy embedder: presence of two marker words. Enough to prove the
    // service routes to the vector path and returns its ranking.
    svc.setEmbedder(text => [/gpu/i.test(text) ? 1 : 0, /cloud/i.test(text) ? 1 : 0]);
    svc.addDocument({ id: 'd1', title: 'A' }, 'the gpu is the thing that runs it all locally here');
    svc.addDocument({ id: 'd2', title: 'B' }, 'the cloud is the thing that meters every token sent');
    const out = svc.search('gpu');
    expect(out.mode).toBe('semantic');
    expect(out.results[0].chunk.docId).toBe('d1');
  });

  it('falls back to keyword when the embedder throws — a broken model must not break search', () => {
    svc.setEmbedder(() => {
      throw new Error('model unloaded');
    });
    svc.addDocument({ id: 'd1', title: 'A' }, 'the local box runs the model with no network at all');
    const out = svc.search('local box');
    expect(out.mode).toBe('keyword');
    expect(out.results.length).toBeGreaterThan(0);
  });

  it('replaces a document instead of duplicating it when re-added', () => {
    svc.addDocument({ id: 'd1', title: 'v1' }, 'the first version of this note has some content');
    const first = svc.getChunks().length;
    svc.addDocument({ id: 'd1', title: 'v2' }, 'the second version of this note has some content');
    expect(svc.listDocuments()).toHaveLength(1);
    expect(svc.getChunks().length).toBe(first);
    expect(svc.listDocuments()[0].title).toBe('v2');
  });

  it('removes a document and its chunks together, leaving no orphans', () => {
    svc.addDocument({ id: 'd1', title: 'A' }, 'content that is long enough to become a chunk here');
    expect(svc.removeDocument('d1')).toBe(true);
    expect(svc.getChunks()).toHaveLength(0);
    expect(svc.removeDocument('nope')).toBe(false);
  });

  it('returns an empty result for an empty query rather than everything', () => {
    svc.addDocument({ id: 'd1', title: 'A' }, 'content that is long enough to become a chunk here');
    expect(svc.search('   ').results).toEqual([]);
  });

  it('searches nothing gracefully before any document is added', () => {
    expect(svc.search('anything').results).toEqual([]);
  });

  it('lists documents newest first', () => {
    svc.addDocument({ id: 'old', title: 'Old', addedAt: 1 }, 'a document with enough text to chunk');
    svc.addDocument({ id: 'new', title: 'New', addedAt: 2 }, 'another document with enough text to chunk');
    expect(svc.listDocuments().map(d => d.id)).toEqual(['new', 'old']);
  });

  it('clears everything', () => {
    svc.addDocument({ id: 'd1', title: 'A' }, 'content that is long enough to become a chunk here');
    svc.clear();
    expect(svc.listDocuments()).toEqual([]);
    expect(svc.getChunks()).toEqual([]);
  });
});
