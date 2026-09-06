/**
 * Tests for the jackyClient → Superstation bridge.
 *
 *     node lib/stationBridge.test.mjs
 *
 * Plain node, no runner and no install: this repo has no test dependency and
 * adding one to cover a 150-line module is a worse trade than a script that
 * runs anywhere. Node ≥ 22.18 strips the types on import.
 */

import assert from 'node:assert/strict';
import {
  CAP_LINK, CAP_TELEMETRY, createStation, missingFields,
  publishTelemetry, startTelemetryBridge, telemetryProvenance,
} from './stationBridge.ts';
import { badge, trustworthy, validate } from '../src/superstation/index.ts';

const manifest = {
  kernel: '1.0.0',
  pod: { id: 'sas.pod.pc', name: "Jackie's PC", role: 'surface', repo: '93jessycollin93-del/PC' },
  provides: [{ id: CAP_TELEMETRY, version: '1.0.0' }, { id: CAP_LINK, version: '1.0.0' }],
};

const AT = Date.parse('2026-09-06T22:30:00.000Z');
const full = { gpuTempC: 61, cpuPct: 12, ramPct: 44, vramPct: 30, simulated: false, at: AT };

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
};

console.log('stationBridge\n');

test('a complete engine reading is live and renders unbadged', () => {
  const p = telemetryProvenance(full, 'live');
  assert.equal(p.fidelity, 'live');
  assert.equal(p.observedAt, '2026-09-06T22:30:00.000Z');
  assert.equal(badge({ provenance: p }), null);
});

test('an unreported field degrades the reading rather than passing 0 off as real', () => {
  const partial = { ...full, gpuTempC: 0, reported: { gpuTempC: false } };
  assert.deepEqual(missingFields(partial), ['gpuTempC']);
  const p = telemetryProvenance(partial, 'live');
  assert.equal(p.fidelity, 'degraded');
  assert.match(p.reason, /did not report gpuTempC/);
  assert.equal(badge({ provenance: p }), 'PARTIAL');
});

test('fields absent from the reported map count as reported', () => {
  // `reported` records only failures — see the JackyTelemetry doc comment.
  const p = telemetryProvenance({ ...full, reported: {} }, 'live');
  assert.equal(p.fidelity, 'live');
});

test('demo mode is simulated, and says why', () => {
  const p = telemetryProvenance({ ...full, simulated: true }, 'demo');
  assert.equal(p.fidelity, 'simulated');
  assert.match(p.reason, /no engine configured/);
  assert.equal(trustworthy({ provenance: p }), false);
});

test('offline is simulated by default and absent in strict mode', () => {
  const drift = { ...full, simulated: true };
  assert.equal(telemetryProvenance(drift, 'offline').fidelity, 'simulated');
  const strict = telemetryProvenance(drift, 'offline', { strictOffline: true });
  assert.equal(strict.fidelity, 'absent');
  assert.match(strict.reason, /unreachable/);
});

test('published envelopes are valid and strip the honesty fields into provenance', () => {
  const station = createStation(manifest);
  const env = publishTelemetry(station, full, 'live');
  assert.deepEqual(validate(env), []);
  assert.equal(env.kind, CAP_TELEMETRY);
  assert.equal(env.pod, 'sas.pod.pc');
  assert.equal(env.payload.gpuTempC, 61);
  // `simulated` / `reported` / `at` are provenance, not payload — they must not
  // survive as fields a panel could read and reinterpret.
  assert.equal('simulated' in env.payload, false);
  assert.equal('reported' in env.payload, false);
  assert.equal('at' in env.payload, false);
});

test('a strict-mode absent publish carries no payload at all', () => {
  const station = createStation(manifest);
  const env = publishTelemetry(station, { ...full, simulated: true }, 'offline', { strictOffline: true });
  assert.equal(env.provenance.fidelity, 'absent');
  assert.deepEqual(env.payload, {});
  assert.deepEqual(validate(env), []);
});

test('the bridge publishes link state on start and on every change', () => {
  const station = createStation(manifest);
  const seen = [];
  station.on(CAP_LINK, (e) => seen.push(e.payload.state));

  let linkState = 'live';
  let pollFn = null;
  let linkFn = null;
  let stopped = { poll: false, link: false };
  const client = {
    getLinkState: () => linkState,
    pollTelemetry: (fn) => { pollFn = fn; return () => { stopped.poll = true; }; },
    onLinkChange: (fn) => { linkFn = fn; return () => { stopped.link = true; }; },
  };

  const stop = startTelemetryBridge(station, client);
  assert.deepEqual(seen, ['live']);

  linkState = 'offline';
  linkFn('offline');
  assert.deepEqual(seen, ['live', 'offline']);

  pollFn({ ...full, simulated: true });
  assert.equal(station.bus.latest(CAP_TELEMETRY).provenance.fidelity, 'simulated');
  assert.equal(station.isLive(CAP_TELEMETRY), false);

  linkState = 'live';
  pollFn(full);
  assert.equal(station.isLive(CAP_TELEMETRY), true);

  stop();
  assert.deepEqual(stopped, { poll: true, link: true });
});

test('a late subscriber receives the retained reading immediately', () => {
  const station = createStation(manifest);
  publishTelemetry(station, full, 'live');
  const seen = [];
  station.on('sas.telemetry', (e) => seen.push(e.kind));
  assert.deepEqual(seen, [CAP_TELEMETRY]);
});

console.log(`\n${process.exitCode ? 'FAILED' : `OK — ${passed} tests pass`}`);
