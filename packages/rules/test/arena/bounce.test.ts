import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T, createFlightState, createInput, hullGap, stepFlight, type FlightState } from '../../src/arena/index.js';
import { box, layoutWith } from './helpers.js';

/**
 * A ship flying +Z into a huge flat wall whose face is tilted so the flight line meets it
 * at `angle` degrees (90 = head-on). The ship starts 0.3 m short of the face.
 */
function approach(angle: number, speed: number): { state: FlightState; layout: ReturnType<typeof layoutWith>; n: { x: number; z: number } } {
  const radians = angle * Math.PI / 180;
  const ux = Math.sin(radians); const uz = Math.cos(radians);
  // The face towards the ship points along −(local +Z) = (uz, 0, −ux).
  const layout = layoutWith([box(0, 0, 0, 400, 400, 400, 5, ux, uz)]);
  const state = createFlightState();
  state.s = speed;
  // The face plane crosses the flight line at z = 400 − 5/ux; start 12 m (along its normal) short.
  state.p.z = 400 - 17 / ux;
  for (let i = 0; i < 4; i++) state.p.z += (hullGap(layout, 0, state.p, state.q, T) - 0.3) / ux;
  return { state, layout, n: { x: uz, z: -ux } };
}

/** One tick at a throttle that holds the speed, then the velocity the ship leaves with. */
function hit(angle: number, speed: number) {
  const { state, layout, n } = approach(angle, speed);
  const input = createInput();
  input.throttle = Math.min(1, speed / T.speedMax);
  stepFlight(state, input, layout);
  // Heading is +Z (never turned by a hit): velocity = forward × s + knock.
  const vx = state.kx; const vy = state.ky; const vz = state.s + state.kz;
  return {
    state, layout,
    speed: Math.sqrt(vx * vx + vy * vy + vz * vz),
    out: vx * n.x + vz * n.z,
    // Along the face, in the direction the flight line slides: (ux, 0, uz) = (−n.z, 0, n.x).
    along: -vx * n.z + vz * n.x,
    approach: speed * Math.sin(angle * Math.PI / 180),
  };
}

/** How far the ship is knocked back from the wall with the throttle off afterwards. */
function knockedBack(speed: number): number {
  const { state, layout } = hit(90, speed);
  const input = createInput();
  let farthest = 0;
  for (let i = 0; i < 90; i++) {
    stepFlight(state, input, layout);
    farthest = Math.max(farthest, hullGap(layout, 0, state.p, state.q, T, 200));
  }
  return farthest;
}

describe('bounce: the impact depends on the angle and the speed (owner 2026-10-21)', () => {
  it('a graze slides on and keeps most of its speed; head-on loses its forward speed', () => {
    const graze = hit(15, 100); const glance = hit(45, 100); const headOn = hit(90, 100);
    for (const h of [graze, glance, headOn]) {
      expect(h.state.landed).toBe(0);
      // Never driven into the surface, and the hit never turns the ship.
      expect(h.out).toBeGreaterThan(0);
      expect(h.state.q).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    }
    expect(graze.speed).toBeGreaterThan(85);
    expect(glance.speed).toBeLessThan(graze.speed);
    expect(glance.speed).toBeGreaterThan(30);
    expect(glance.speed).toBeLessThan(75);
    expect(headOn.speed).toBeLessThan(glance.speed);
    expect(headOn.state.s).toBe(0);
    // Sliding keeps its direction along the surface: friction slows it, never reverses it.
    expect(graze.along).toBeGreaterThan(0);
    expect(glance.along).toBeGreaterThan(0);
    // The harder the surface is met, the harder it pushes back.
    expect(glance.out).toBeGreaterThan(graze.out);
    expect(headOn.out).toBeGreaterThan(glance.out);
  });

  it('a harder hit springs back proportionally more, within a bounded restitution', () => {
    const slow = hit(90, 30); const fast = hit(90, T.speedMax);
    const springSlow = slow.out / slow.approach; const springFast = fast.out / fast.approach;
    expect(springFast).toBeGreaterThan(springSlow);
    for (const spring of [springSlow, springFast]) {
      expect(spring).toBeGreaterThan(0.1);
      expect(spring).toBeLessThan(0.42);
    }
  });

  it('knocks back a few metres from a soft bump and a couple of ship lengths from full speed, never more', () => {
    const soft = knockedBack(30); const hard = knockedBack(T.speedMax); const turbo = knockedBack(T.speedMax * T.turboSpeedMul);
    expect(soft).toBeGreaterThan(1);
    expect(soft).toBeLessThan(6);
    // About a ship length from full speed: 14 m at 80 m/s (KG-X25; 23 m at the old 120).
    expect(hard).toBeGreaterThan(10);
    expect(hard).toBeLessThan(35);
    expect(turbo).toBeGreaterThan(hard);
    expect(turbo).toBeLessThan(55);
  });
});
