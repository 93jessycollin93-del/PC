/**
 * Bridge — `jackyClient` telemetry into Superstation envelopes.
 *
 * The client already knows more about the honesty of its numbers than it can
 * express: `JackyTelemetry.simulated` says whether the whole reading is
 * invented, and `reported` says which individual fields the engine actually
 * sent versus which are a `0` standing in for "not mentioned". Downstream that
 * detail gets flattened to a boolean, and panels have to remember to check it.
 *
 * This module maps both signals onto the fidelity ladder in
 * `superstation/SPEC.md` §4, so the distinction survives into every consumer:
 *
 *   link live,  every field reported     → live       (render it plainly)
 *   link live,  some fields missing      → degraded   (render, badged PARTIAL)
 *   link demo,  no engine configured     → simulated  (render, badged SIMULATED)
 *   link offline, engine unreachable     → simulated, or absent in strict mode
 *
 * Nothing here changes `jackyClient`. It is byte-identical across the fleet by
 * design and stays that way; this is a reader of it.
 */

import { Station, absent, degraded, live, simulated, stamp } from '../src/superstation/index.ts';
import type { PodManifest, Provenance } from '../src/superstation/index.ts';
import type { JackyLinkState, JackyTelemetry } from './jackyClient.ts';

/** Capability IDs this bridge publishes. Declared in `station.pod.json`. */
export const CAP_TELEMETRY = 'sas.telemetry.system';
export const CAP_LINK = 'sas.link.engine';

const SOURCE = 'jacky:/api/status';

/**
 * The subset of `jackyClient` this bridge needs.
 *
 * Deliberately structural rather than importing the singleton: the singleton
 * touches `localStorage` at construction, and a bridge that can only be
 * exercised inside a browser is a bridge that never gets tested.
 */
export interface TelemetrySource {
  getLinkState(): JackyLinkState;
  pollTelemetry(onData: (t: JackyTelemetry) => void, intervalMs?: number): () => void;
  onLinkChange(handler: (state: JackyLinkState) => void): () => void;
}

/** Field names in `JackyTelemetry.reported`, in the order a badge should list them. */
const TELEMETRY_FIELDS = ['gpuTempC', 'cpuPct', 'ramPct', 'vramPct'] as const;

/** Which numeric fields the engine did not actually send. */
export function missingFields(t: JackyTelemetry): string[] {
  const reported = t.reported ?? {};
  // Absent from the map (not `false`) means it WAS reported — see JackyTelemetry.
  return TELEMETRY_FIELDS.filter((f) => reported[f] === false);
}

export interface BridgeOptions {
  /**
   * Publish `absent` rather than `simulated` when the engine is configured but
   * unreachable.
   *
   * Off by default, because the client's drifting placeholders are what keeps
   * PC's monitors animating, and an animated panel badged SIMULATED is the
   * behaviour the fleet already ships. Turn it on for a surface that would
   * rather show nothing than show a shape — a mission-control strip, say —
   * where a moving needle implies a live link even with a badge next to it.
   */
  strictOffline?: boolean;
}

/**
 * Classify one telemetry reading.
 *
 * Exported separately from the publishing so it can be unit-tested against the
 * ladder without a station, a client or a clock.
 */
export function telemetryProvenance(
  t: JackyTelemetry,
  linkState: JackyLinkState,
  opts: BridgeOptions = {},
): Provenance {
  const observedAt = stamp(t.at);

  if (t.simulated) {
    if (linkState === 'offline') {
      return opts.strictOffline
        ? absent(SOURCE, 'engine configured but unreachable')
        : simulated(SOURCE, 'engine configured but unreachable — placeholder values');
    }
    return simulated(SOURCE, 'no engine configured — placeholder values by design');
  }

  const missing = missingFields(t);
  if (missing.length) {
    return degraded(
      SOURCE,
      `engine did not report ${missing.join(', ')} — shown as 0`,
      observedAt,
    );
  }
  return live(SOURCE, observedAt);
}

/** Publish one reading. Returns the envelope so callers can inspect it. */
export function publishTelemetry(
  station: Station,
  t: JackyTelemetry,
  linkState: JackyLinkState,
  opts: BridgeOptions = {},
) {
  const provenance = telemetryProvenance(t, linkState, opts);
  // `absent` carries no payload at all (SPEC.md §4) — a reading that isn't one.
  if (provenance.fidelity === 'absent') {
    return station.publishAbsent(CAP_TELEMETRY, SOURCE, provenance.reason ?? 'unreachable');
  }
  const { simulated: _drop, reported: _drop2, at: _drop3, ...payload } = t;
  return station.publish(CAP_TELEMETRY, payload, provenance);
}

/** Publish the link's own state as a first-class capability. */
export function publishLinkState(station: Station, state: JackyLinkState) {
  const provenance: Provenance =
    state === 'live'
      ? live('jacky:link', stamp())
      : state === 'offline'
        ? degraded('jacky:link', 'engine configured but unreachable')
        : simulated('jacky:link', 'no engine configured');
  return station.publish(CAP_LINK, { state }, provenance);
}

/**
 * Wire a client into a station: telemetry on every poll, link state on every
 * change. Returns a stop function that detaches both.
 */
export function startTelemetryBridge(
  station: Station,
  client: TelemetrySource,
  opts: BridgeOptions & { intervalMs?: number } = {},
): () => void {
  publishLinkState(station, client.getLinkState());
  const stopPoll = client.pollTelemetry(
    (t) => publishTelemetry(station, t, client.getLinkState(), opts),
    opts.intervalMs,
  );
  const stopLink = client.onLinkChange((state) => publishLinkState(station, state));
  return () => {
    stopPoll();
    stopLink();
  };
}

/** Build PC's station from its manifest. */
export function createStation(manifest: PodManifest, peers: PodManifest[] = []): Station {
  return new Station({ manifest, peers });
}
