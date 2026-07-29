/**
 * Local-first routing.
 *
 * The bug these guard: `MODEL_REGISTRY.ollama` was `[]`, and route() builds its
 * candidate list by iterating that registry — so the user's own GPU box could
 * never be chosen as a primary route no matter how healthy it was. It was only
 * ever reachable as a post-failure fallback, which is backwards from the
 * intended policy ("local first; if local is not there, carry on").
 *
 * These drive the REAL router and assert the routing OUTCOME (which provider
 * actually gets chosen), not that a probe was consulted — a test that asserted
 * "the probe was called" would still pass against a router that ignored its
 * verdict, which is exactly the defect class that let this ship.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { modelRouter, isLocalProvider } from './modelRouter';

describe('local-first routing', () => {
  beforeEach(() => {
    // Default every test to "box is down" so each one opts in explicitly.
    modelRouter.setLocalAvailabilityProbe(() => false);
  });

  it('routes to the local box when it is reachable, over free cloud tiers', () => {
    modelRouter.setLocalAvailabilityProbe(() => true);

    const decision = modelRouter.route('hello', ['chat'], 2000);

    // The outcome the user feels: the request stays on their hardware.
    expect(decision.provider).toBe('ollama');
    expect(decision.estimatedCost).toBe(0);
  });

  it('does NOT route to the local box when it is unreachable', () => {
    modelRouter.setLocalAvailabilityProbe(() => false);

    const decision = modelRouter.route('hello', ['chat'], 2000);

    // Routing at a dead box would fail the call outright, so it must lose to
    // every cloud option rather than merely rank lower.
    expect(decision.provider).not.toBe('ollama');
  });

  it('prefers local even though it holds no API key', () => {
    // Local scored `hasKey ? 100 : -100` like a cloud provider would have
    // permanently benched the box, since it has no key to hold.
    modelRouter.setLocalAvailabilityProbe(() => true);

    const decision = modelRouter.route('write a function', ['chat', 'code'], 2000);

    expect(decision.provider).toBe('ollama');
    expect(decision.reason).toContain('your own hardware');
  });

  it('still serves a capability the local entry cannot cover', () => {
    // The local entry declares chat/code/analysis but not vision. Local-first
    // must not mean local-only: an uncovered capability still has to route.
    modelRouter.setLocalAvailabilityProbe(() => true);

    // No registered model claims 'vision', so this throws rather than
    // silently handing the work to a model that cannot do it.
    expect(() => modelRouter.route('describe this image', ['vision'], 2000)).toThrow();
  });

  it('treats a throwing probe as "box unreachable" rather than crashing routing', () => {
    modelRouter.setLocalAvailabilityProbe(() => {
      throw new Error('jacky unreachable');
    });

    const decision = modelRouter.route('hello', ['chat'], 2000);

    expect(decision.provider).not.toBe('ollama');
  });

  it('identifies which providers run on the user hardware', () => {
    expect(isLocalProvider('ollama')).toBe(true);
    expect(isLocalProvider('groq')).toBe(false);
  });
});
