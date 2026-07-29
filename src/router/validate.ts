import {
  EmbedModel,
  NanoModel,
  ROUTER_FORGE_FORMAT,
  ROUTER_FORGE_VERSION,
  RouterArtifact,
  RouterArtifactError,
} from './types';

/**
 * Structural validation, mirroring the Python forge's `validate_artifact`.
 * Throws RouterArtifactError with a user-presentable message.
 */
export function validateArtifact(value: unknown): RouterArtifact {
  const artifact = value as RouterArtifact;
  if (!artifact || typeof artifact !== 'object' || artifact.format !== ROUTER_FORGE_FORMAT) {
    throw new RouterArtifactError('This file is not a router-forge artifact.');
  }
  if (typeof artifact.version !== 'number' || artifact.version > ROUTER_FORGE_VERSION) {
    throw new RouterArtifactError(`Unsupported artifact version ${String(artifact.version)}.`);
  }
  if (artifact.kind !== 'nano' && artifact.kind !== 'embed' && artifact.kind !== 'llm') {
    throw new RouterArtifactError('Unknown router kind.');
  }
  if (!Array.isArray(artifact.labels) || artifact.labels.length < 2) {
    throw new RouterArtifactError('Artifact must carry at least 2 labels.');
  }
  if (typeof artifact.name !== 'string' || !artifact.name.trim()) {
    throw new RouterArtifactError('Artifact is missing its name.');
  }
  if (!artifact.model || typeof artifact.model !== 'object') {
    throw new RouterArtifactError('Artifact is missing its model payload.');
  }
  if (artifact.kind === 'nano') {
    const model = artifact.model as NanoModel;
    for (const key of ['hashDim', 'ngrams', 'weights', 'scales', 'biases'] as const) {
      if (model[key] === undefined) {
        throw new RouterArtifactError(`Nano artifact is missing model.${key}.`);
      }
    }
  }
  if (artifact.kind === 'embed') {
    const model = artifact.model as EmbedModel;
    if (typeof model.dims !== 'number' || !model.centroids || typeof model.centroids !== 'object') {
      throw new RouterArtifactError('Embed artifact is missing dims or centroids.');
    }
    for (const label of artifact.labels) {
      if (!Array.isArray(model.centroids[label]) || model.centroids[label].length !== model.dims) {
        throw new RouterArtifactError(`Embed artifact centroid for "${label}" is missing or malformed.`);
      }
    }
  }
  return artifact;
}
