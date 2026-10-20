import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFlightState, type FlightState } from '@astera/rules/arena';
import { absorbCorrection, applyCorrection, createCorrection, decayCorrection } from '../../src/arena/smoothing.js';

/**
 * Owner 2026-10-20: "hızlı giderken sağa sola dönerken oyun titriyor". A server
 * correction used to land on screen in one frame; the camera rides the ship, so the
 * whole view jumped. The correction must now leave the drawn pose where it was and
 * melt away over a few frames.
 */
const yaw = (angle: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
const state = (x: number, z: number, q: THREE.Quaternion): FlightState => {
  const s = createFlightState(); s.p.x = x; s.p.z = z; s.q.x = q.x; s.q.y = q.y; s.q.z = q.z; s.q.w = q.w; return s;
};
const drawn = (previous: FlightState, current: FlightState, blend: number, correction = createCorrection()) => {
  const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  out.position.set(previous.p.x + (current.p.x - previous.p.x) * blend, previous.p.y + (current.p.y - previous.p.y) * blend,
    previous.p.z + (current.p.z - previous.p.z) * blend);
  out.quaternion.set(previous.q.x, previous.q.y, previous.q.z, previous.q.w)
    .slerp(new THREE.Quaternion(current.q.x, current.q.y, current.q.z, current.q.w), blend);
  applyCorrection(correction, out);
  return out;
};
const close = (a: { position: THREE.Vector3; quaternion: THREE.Quaternion }, b: typeof a) => {
  expect(a.position.distanceTo(b.position)).toBeLessThan(1e-6);
  expect(a.quaternion.angleTo(b.quaternion)).toBeLessThan(1e-6);
};

describe('prediction error smoothing', () => {
  it('keeps the drawn pose exactly where it was at the moment of a correction', () => {
    const previous = state(0, 0, yaw(0.1)); const predicted = state(0, 3.3, yaw(0.2));
    const server = state(0.4, 6.1, yaw(0.26)); // one extra tick of turn and speed
    for (const blend of [0, 0.3, 0.75, 1]) {
      const correction = createCorrection(); const prior = state(0, 0, yaw(0.1));
      const before = drawn(prior, predicted, blend, correction);
      expect(absorbCorrection(correction, prior, predicted, server)).toBe(true);
      close(drawn(prior, server, blend, correction), before);
    }
    void previous;
  });

  it('stays continuous when corrections stack before the last one has melted', () => {
    const correction = createCorrection(); const previous = state(0, 0, yaw(0));
    let current = state(0, 3, yaw(0.05));
    absorbCorrection(correction, previous, current, state(0.2, 4, yaw(0.09)));
    current = state(0.2, 4, yaw(0.09));
    decayCorrection(correction, 0.03);
    const before = drawn(previous, current, 0.5, correction);
    const next = state(-0.3, 5.2, yaw(0.02));
    absorbCorrection(correction, previous, current, next);
    close(drawn(previous, next, 0.5, correction), before);
  });

  it('melts away in a fraction of a second', () => {
    const correction = createCorrection(); const previous = state(0, 0, yaw(0));
    absorbCorrection(correction, previous, state(0, 3, yaw(0)), state(2, 3, yaw(0.08)));
    const pose = () => { const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }; applyCorrection(correction, out); return out; };
    expect(pose().position.length()).toBeCloseTo(2, 5);
    decayCorrection(correction, 0.1);
    expect(pose().position.length()).toBeLessThan(1);
    expect(pose().position.length()).toBeGreaterThan(0.2);
    for (let i = 0; i < 30; i++) decayCorrection(correction, 1 / 60);
    expect(pose().position.length()).toBeLessThan(0.01);
    expect(pose().quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.001);
  });

  it('snaps a teleport instead of gliding across the map', () => {
    const correction = createCorrection(); const previous = state(0, 0, yaw(0));
    const server = state(400, 0, yaw(2));
    expect(absorbCorrection(correction, previous, state(0, 3, yaw(0)), server)).toBe(false);
    expect(previous.p).toEqual(server.p);
    const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    applyCorrection(correction, out);
    expect(out.position.length()).toBe(0);
    expect(out.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
  });
});
