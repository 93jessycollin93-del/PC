/**
 * Gives a fleet specialist an actual brain — a Router Forge artifact.
 *
 * This is the piece that turns the fleet from routing-by-declared-domain into
 * routing-by-what-the-question-says. A specialist stays a router, not a
 * language model: the artifact is a hashed n-gram classifier measured in
 * kilobytes, which is exactly why a hundred of them are affordable.
 *
 * The artifact is only compiled while the member is awake. Compiling
 * dequantizes int8 weights into a float matrix, which is the one part with a
 * real memory cost — so it happens on wake and is dropped on sleep, keeping
 * the dormant-costs-zero invariant true rather than merely claimed.
 */

import { compileNano, type CompiledNano } from '../router/nanoRuntime';
import { validateArtifact } from '../router/validate';
import type { NanoModel, RouteResult, RouterArtifact } from '../router/types';

export interface SpecialistRoute {
  /** The fleet member the question should go to. */
  memberId: string;
  /** The artifact's own label for this text. */
  label: string;
  confidence: number;
}

/**
 * Owns artifact→member bindings and the compiled instances.
 *
 * Kept separate from FleetService so residency stays one responsibility and
 * classification another; the fleet asks this for a destination and never
 * learns how the answer was reached.
 */
export class SpecialistRouterRegistry {
  private artifacts = new Map<string, RouterArtifact>();
  /** Compiled only while awake — see the note above about dequantization. */
  private compiled = new Map<string, CompiledNano>();
  /** Which fleet member each artifact label routes to. */
  private labelToMember = new Map<string, Map<string, string>>();

  /**
   * Attach an artifact and say which member each of its labels means.
   * Throws on a malformed file, with a message safe to show the user.
   */
  public attach(
    artifactId: string,
    raw: unknown,
    labelRouting: Record<string, string>
  ): RouterArtifact {
    const artifact = validateArtifact(raw);
    if (artifact.kind !== 'nano') {
      // Embed routers need an embedding model resident, which is exactly the
      // dependency this tier exists to avoid. Refusing plainly beats accepting
      // it and failing later with no network.
      throw new Error(
        `Only nano routers can back a specialist; '${artifact.name}' is '${artifact.kind}'`
      );
    }
    const missing = artifact.labels.filter(l => !labelRouting[l]);
    if (missing.length > 0) {
      // A label with no member is a silent dead end at route time.
      throw new Error(`No fleet member mapped for label(s): ${missing.join(', ')}`);
    }
    this.artifacts.set(artifactId, artifact);
    this.labelToMember.set(artifactId, new Map(Object.entries(labelRouting)));
    return artifact;
  }

  public detach(artifactId: string): boolean {
    this.compiled.delete(artifactId);
    this.labelToMember.delete(artifactId);
    return this.artifacts.delete(artifactId);
  }

  public list(): { id: string; name: string; labels: string[]; compiled: boolean }[] {
    return [...this.artifacts.entries()].map(([id, a]) => ({
      id,
      name: a.name,
      labels: a.labels,
      compiled: this.compiled.has(id),
    }));
  }

  /** Compile on wake. Idempotent, so re-waking costs nothing extra. */
  public wake(artifactId: string): boolean {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) return false;
    if (this.compiled.has(artifactId)) return true;
    this.compiled.set(artifactId, compileNano(artifact.labels, artifact.model as NanoModel));
    return true;
  }

  /** Drop the compiled matrix. This is what makes dormancy actually free. */
  public sleep(artifactId: string): boolean {
    return this.compiled.delete(artifactId);
  }

  public isAwake(artifactId: string): boolean {
    return this.compiled.has(artifactId);
  }

  /**
   * Classify text and resolve it to a fleet member.
   *
   * Returns undefined when the artifact is unknown or dormant — deliberately
   * NOT auto-waking, because waking has a RAM cost that only the fleet's
   * residency planner is allowed to approve.
   */
  public route(artifactId: string, text: string): SpecialistRoute | undefined {
    const runtime = this.compiled.get(artifactId);
    const routing = this.labelToMember.get(artifactId);
    if (!runtime || !routing) return undefined;
    const result: RouteResult = runtime.route(text);
    const memberId = routing.get(result.label);
    if (!memberId) return undefined;
    return { memberId, label: result.label, confidence: result.confidence };
  }

  /** The raw classification, for UI that wants to show the score breakdown. */
  public classify(artifactId: string, text: string): RouteResult | undefined {
    return this.compiled.get(artifactId)?.route(text);
  }
}

export const specialistRouters = new SpecialistRouterRegistry();
