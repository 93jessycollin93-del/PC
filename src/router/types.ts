/** Identifies a JSON document as a Router Forge artifact. */
export const ROUTER_FORGE_FORMAT = 'router-forge' as const;

/** Highest artifact version this build can run. Bump when the shape changes. */
export const ROUTER_FORGE_VERSION = 1;

/** Payload of a nano router: hashed char n-grams -> int8 logistic regression. */
export interface NanoModel {
  hashDim: number;
  ngrams: number[];
  /** base64 of int8 weight rows, one row of hashDim bytes per label. */
  weights: string;
  /** Per-label dequantization scale: float weight = int8 * scale. */
  scales: number[];
  biases: number[];
}

/** Payload of an embed router: unit centroid per label, cosine similarity. */
export interface EmbedModel {
  embeddingModel: string;
  dims: number;
  centroids: Record<string, number[]>;
}

/**
 * One Router Forge artifact - the portable JSON the PC forge exports. The
 * labels mean whatever the router was attached to; this runtime does not care.
 */
export interface RouterArtifact {
  format: typeof ROUTER_FORGE_FORMAT;
  version: number;
  kind: 'nano' | 'embed' | 'llm';
  name: string;
  task?: string;
  labels: string[];
  trainedOn?: { examples: number; accuracy: number | null; holdout: boolean };
  model: NanoModel | EmbedModel | Record<string, unknown>;
}

/** What every router answers, identical across Python and TypeScript. */
export interface RouteResult {
  label: string;
  confidence: number;
  scores: Record<string, number>;
}

/** Summary row for listing imported routers in the UI. */
export interface StoredRouterSummary {
  name: string;
  kind: RouterArtifact['kind'];
  task: string;
  labels: string[];
  sizeBytes: number;
}

/** A file failed structural validation - message is user-presentable. */
export class RouterArtifactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouterArtifactError';
  }
}
