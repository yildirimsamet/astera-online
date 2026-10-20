import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_LAYOUT, ARENA_TUNING as T, createFlightState, createInput, queryObstacles, stepFlight,
} from '../../src/arena/index.js';
import { box, layoutWith, sphere } from './helpers.js';

const r = T.shipHitRadius;
const length = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);

describe('broad-phase obstacle grid', () => {
  it('never misses an obstacle whose bounds overlap the query, and never repeats one', () => {
    fc.assert(fc.property(
      fc.integer({ min: -2600, max: 2600 }), fc.integer({ min: -650, max: 650 }), fc.integer({ min: -2600, max: 2600 }),
      fc.integer({ min: 1, max: 400 }),
      (x, y, z, size) => {
        const out: number[] = [];
        const count = queryObstacles(ARENA_LAYOUT, x - size, y - size, z - size, x + size, y + size, z + size, out);
        const found = out.slice(0, count);
        expect(new Set(found).size).toBe(found.length);
        for (const o of ARENA_LAYOUT.obstacles) {
          const overlaps = Math.abs(o.p.x - x) <= size + o.radius && Math.abs(o.p.y - y) <= size + o.radius
            && Math.abs(o.p.z - z) <= size + o.radius;
          if (overlaps) expect(found).toContain(o.id);
        }
      }), { numRuns: 120 });
  });
});

describe('ship collision against rocks, structures and the boundary', () => {
  it('cannot tunnel through a small rock even at an absurd configured speed', () => {
    const state = createFlightState();
    const input = createInput();
    input.throttle = 1;
    state.s = 9000;
    stepFlight(state, input, layoutWith([sphere(0, 0, 0, 80, 8)]), undefined, { ...T, speedMax: 9000 });
    expect(state.p.z).toBeLessThanOrEqual(80 - 8 - r);
    expect(state.s).toBeLessThan(9000 * (1 - T.bounceLoss) + 1e-6);
    expect(state.kz).toBeLessThan(0);
    expect(state.landed).toBe(0);
    expect(state.bump).toBe(1);
  });

  it('resolves a ship that starts inside a rock without NaN or a landing', () => {
    const state = createFlightState();
    stepFlight(state, createInput(), layoutWith([sphere(0, 0, 0, 0, 8)]));
    expect(length(state.p.x, state.p.y, state.p.z)).toBeGreaterThanOrEqual(8 + r);
    expect(Number.isFinite(state.p.x + state.p.y + state.p.z)).toBe(true);
    expect(state.landed).toBe(0);
  });

  it('stops at a thin wall at turbo speed instead of passing through it', () => {
    const state = createFlightState();
    state.s = T.speedMax * T.turboSpeedMul;
    const input = createInput();
    input.throttle = 1;
    input.turbo = true;
    const layout = layoutWith([box(0, 0, 0, 40, 50, 50, 1)]);
    for (let i = 0; i < 60; i++) {
      stepFlight(state, input, layout);
      expect(state.p.z).toBeLessThanOrEqual(39 - r + 1e-9);
    }
  });

  it('pushes a ship that starts inside a box out through the nearest face', () => {
    const state = createFlightState();
    state.p.x = 18;
    stepFlight(state, createInput(), layoutWith([box(0, 0, 0, 0, 20, 30, 30)]));
    expect(state.p.x).toBeGreaterThanOrEqual(20 + r - 1e-9);
    expect(Math.abs(state.p.z)).toBeLessThan(1e-9);
  });

  it('respects a box turned about the vertical axis', () => {
    const c = Math.SQRT1_2;
    const layout = layoutWith([box(0, 0, 0, 100, 30, 30, 30, c, c)]);
    const state = createFlightState();
    state.s = T.speedMax;
    const input = createInput();
    input.throttle = 1;
    // Closest point of the turned box along the flight line is its corner at z = 100 - 30·√2.
    let deepest = -Infinity;
    for (let i = 0; i < 60; i++) {
      stepFlight(state, input, layout);
      deepest = Math.max(deepest, state.p.z);
      expect(state.p.z).toBeLessThanOrEqual(100 - 30 * Math.SQRT2 - r + 1e-6);
    }
    expect(deepest).toBeGreaterThan(100 - 30 * Math.SQRT2 - r - 2);
  });

  it('scrapes along a rock at a shallow angle, keeping speed and heading', () => {
    // A huge rock whose surface the flight line just grazes.
    const layout = layoutWith([sphere(0, 400 + r - 3, 0, 1500, 400)]);
    const state = createFlightState();
    state.s = T.speedMax;
    const input = createInput();
    input.throttle = 1;
    const heading = { ...state.q };
    let bumped = false;
    for (let i = 0; i < 1200 && state.p.z < 1800; i++) {
      stepFlight(state, input, layout);
      if (state.bump > 0) bumped = true;
      const o = layout.obstacles[0];
      if (!o) throw new Error('missing rock');
      expect(length(state.p.x - o.p.x, state.p.y - o.p.y, state.p.z - o.p.z)).toBeGreaterThanOrEqual(o.radius + r - 1e-6);
      expect(state.landed).toBe(0);
    }
    expect(bumped).toBe(true);
    expect(state.p.z).toBeGreaterThanOrEqual(1800);
    expect(state.q).toEqual(heading);
  });

  it('slides along the disc rim and the ceiling without turning the ship', () => {
    const layout = layoutWith([], T.arenaRadius, T.arenaHalfHeight);
    const rim = createFlightState();
    rim.p.x = T.arenaRadius - r;
    rim.s = T.speedMax;
    const input = createInput();
    input.throttle = 1;
    const heading = { ...rim.q };
    for (let i = 0; i < 30; i++) stepFlight(rim, input, layout);
    expect(rim.p.z).toBeGreaterThan(0);
    expect(Math.sqrt(rim.p.x * rim.p.x + rim.p.z * rim.p.z)).toBeLessThanOrEqual(T.arenaRadius - r + 1e-9);
    expect(rim.q).toEqual(heading);

    const ceiling = createFlightState();
    ceiling.p.y = T.arenaHalfHeight - r - 1;
    ceiling.q.x = -Math.sqrt(0.5) * 0.5;
    ceiling.q.w = Math.sqrt(1 - ceiling.q.x * ceiling.q.x);
    ceiling.s = T.speedMax;
    for (let i = 0; i < 30; i++) stepFlight(ceiling, input, layout);
    expect(ceiling.p.y).toBeLessThanOrEqual(T.arenaHalfHeight - r + 1e-9);
    expect(ceiling.p.z).toBeGreaterThan(30);
  });
});
