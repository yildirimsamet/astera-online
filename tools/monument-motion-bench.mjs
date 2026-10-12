/** Small deterministic CPU benchmark of the production solver; no season/economy simulation.
 * Run after other checks: nice -n 10 node --import tsx tools/monument-motion-bench.mjs
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { MONUMENT_SEASON_DEFAULTS, monumentMotion, interceptMotion, distance, travelExact } from '../packages/rules/src/index.ts';

const results = [];
for (const speed of [113, 75, 56, 28.25, 11.3, 5.6]) {
  const samples = speed === 113 ? 2048 : 256;
  const durations = [];
  let maximumMinutes = 0;
  for (let i = 0; i < samples + 32; i++) {
    const angle = i * 2.399963229728653;
    const radius = 4500 * ((i % 17) + 1) / 17;
    const altitude = Math.sin(i * 0.7183) * 0.7;
    const horizontal = radius * Math.sqrt(1 - altitude ** 2);
    const from = { x: horizontal * Math.cos(angle), y: radius * altitude, z: horizontal * Math.sin(angle) };
    const motion = monumentMotion(MONUMENT_SEASON_DEFAULTS.positions[i % 8], 0);
    const now = i * 617233;
    const started = performance.now();
    const meeting = interceptMotion(from, speed, motion, now, now + 48 * 3600_000);
    const elapsed = performance.now() - started;
    assert.ok(meeting, `No meeting at speed ${speed}, sample ${i}`);
    assert.ok(Math.abs(travelExact(distance(from, meeting.at), speed) - meeting.flightMinutes) < 1e-4);
    if (i >= 32) {
      durations.push(elapsed);
      maximumMinutes = Math.max(maximumMinutes, meeting.flightMinutes);
    }
  }
  durations.sort((a, b) => a - b);
  const percentile = p => durations[Math.floor((durations.length - 1) * p)];
  results.push({ speed, samples, cpuMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), maximum: durations.at(-1) }, maximumFlightMinutes: maximumMinutes });
}
const report = { at: new Date().toISOString(), node: process.version, samplesAreFinite: true,
  scope: 'Production interception CPU only; excludes database, network, rendering, and pathological isolated tangents.', results };
await writeFile(new URL('../docs/evidence/monument-motion-bench-2026-10-12.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
