/**
 * Keyword retrieval (TF-IDF) — the floor that always works.
 *
 * The off-grid RAG pipeline this is built alongside retrieves by embedding
 * similarity, which needs an embedding model resident in memory. PC cannot
 * assume one exists: there may be no GPU box reachable, no model downloaded,
 * and no network to fetch one. A search feature that only works when a model
 * is loaded is exactly the kind of thing that is missing when you need it.
 *
 * So this is the always-available tier: pure TF-IDF scoring over the chunk
 * text, no model, no network, no async. Vector search (see vectorMath) is an
 * upgrade layered on top when embeddings happen to be available — never a
 * requirement. The gap between the two is modelled as data (`RetrievalMode`)
 * rather than a branch scattered through callers.
 */

export interface IndexedChunk {
  id: string;
  docId: string;
  content: string;
  position: number;
  /** Optional embedding. Absent means this chunk is keyword-searchable only. */
  embedding?: number[];
}

export interface ScoredChunk {
  chunk: IndexedChunk;
  score: number;
}

/**
 * Split text into comparable terms.
 *
 * Deliberately simple and language-agnostic: lowercase, split on non-word
 * characters, drop single characters. Anything cleverer (stemming, stopword
 * lists) is language-specific and would silently degrade for the user's own
 * notes in ways that are hard to notice.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 1);
}

/** Term frequency for one document, normalized by length. */
function termFrequencies(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  if (tokens.length === 0) return counts;
  for (const [term, n] of counts) counts.set(term, n / tokens.length);
  return counts;
}

/**
 * Inverse document frequency across the corpus.
 *
 * Uses the smoothed form `ln(1 + N/df)`, which stays positive for every term.
 * The unsmoothed `ln(N/df)` collapses to zero for a term appearing in every
 * chunk — meaning a single-document corpus would score every term at zero and
 * return nothing, which is the common case when someone has just added one note.
 */
export function inverseDocumentFrequency(
  chunks: readonly IndexedChunk[]
): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const chunk of chunks) {
    for (const term of new Set(tokenize(chunk.content))) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  const n = chunks.length;
  for (const [term, df] of docFreq) idf.set(term, Math.log(1 + n / df));
  return idf;
}

/**
 * Rank chunks against a query by TF-IDF. Pure: same inputs, same order, always.
 * Chunks that share no term with the query score 0 and are dropped, so an
 * unrelated query returns nothing rather than an arbitrary ranking of noise.
 */
export function searchByKeyword(
  query: string,
  chunks: readonly IndexedChunk[],
  topK = 5
): ScoredChunk[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || chunks.length === 0) return [];

  const idf = inverseDocumentFrequency(chunks);
  const scored: ScoredChunk[] = [];

  for (const chunk of chunks) {
    const tf = termFrequencies(tokenize(chunk.content));
    let score = 0;
    for (const term of queryTerms) {
      const termFreq = tf.get(term);
      if (termFreq) score += termFreq * (idf.get(term) ?? 0);
    }
    if (score > 0) scored.push({ chunk, score });
  }

  scored.sort((a, b) => b.score - a.score || a.chunk.position - b.chunk.position);
  return scored.slice(0, topK);
}
