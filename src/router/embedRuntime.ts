import { scoresToResult } from './nanoRuntime';
import { EmbedModel, RouteResult } from './types';

/**
 * The embed router runtime: cosine similarity of the query embedding against
 * one unit centroid per label. Mirrors the Python embed path exactly - the
 * query vector is normalized here, so the embedder may return raw vectors.
 */
export function routeWithEmbedding(
  labels: string[],
  model: EmbedModel,
  queryVector: number[],
): RouteResult {
  let sumSquares = 0;
  for (const v of queryVector) {
    sumSquares += v * v;
  }
  const norm = Math.sqrt(sumSquares) || 1;
  const unit = queryVector.map(v => v / norm);
  const raw = labels.map(label => {
    const centroid = model.centroids[label];
    let dot = 0;
    for (let i = 0; i < unit.length; i++) {
      dot += unit[i] * centroid[i];
    }
    return dot;
  });
  return scoresToResult(labels, raw);
}
