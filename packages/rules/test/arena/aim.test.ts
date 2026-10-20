import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, assistSteer, createFlightState, createInput, gimbalAim, leadTime, sampleAssist, stepFlight,
  type Vec3,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

const empty = layoutWith();
const angleTo = (state: ReturnType<typeof createFlightState>, target: Vec3): number => {
  const q = state.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const dx = target.x - state.p.x; const dy = target.y - state.p.y; const dz = target.z - state.p.z;
  return Math.acos((fx * dx + fy * dy + fz * dz) / Math.sqrt(dx * dx + dy * dy + dz * dz));
};

describe('lead solution', () => {
  it('is distance over muzzle speed for a still target', () => {
    expect(leadTime(0, 0, 600, 0, 0, 0, 600)).toBeCloseTo(1, 12);
  });

  it('meets a moving target exactly where the shot arrives', () => {
    fc.assert(fc.property(
      fc.integer({ min: -800, max: 800 }), fc.integer({ min: -300, max: 300 }), fc.integer({ min: 50, max: 900 }),
      fc.integer({ min: -150, max: 150 }), fc.integer({ min: -150, max: 150 }), fc.integer({ min: -150, max: 150 }),
      (px, py, pz, vx, vy, vz) => {
        const t = leadTime(px, py, pz, vx, vy, vz, T.muzzleSpeed);
        if (t < 0) return;
        const x = px + vx * t; const y = py + vy * t; const z = pz + vz * t;
        expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(T.muzzleSpeed * t, 6);
      }));
  });

  it('reports no solution when the target outruns the shot', () => {
    expect(leadTime(0, 0, 100, 0, 0, 700, 600)).toBe(-1);
  });
});

describe('gun gimbal', () => {
  it('bends the shot onto a target just off the nose, within range', () => {
    const shooter = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    const target = { x: 10, y: -6, z: 400 };
    expect(gimbalAim(out, shooter, target, { x: 0, y: 0, z: 0 })).toBe(true);
    const length = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z);
    expect(length).toBeCloseTo(1, 12);
    expect(out.x / out.z).toBeCloseTo(10 / 400, 6);
    expect(out.y / out.z).toBeCloseTo(-6 / 400, 6);
  });

  it('leaves the shot alone outside the cone or beyond range', () => {
    const shooter = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    expect(gimbalAim(out, shooter, { x: 60, y: 0, z: 400 }, { x: 0, y: 0, z: 0 })).toBe(false);
    expect(gimbalAim(out, shooter, { x: 0, y: 0, z: T.gimbalRange + 50 }, { x: 0, y: 0, z: 0 })).toBe(false);
    expect(gimbalAim(out, shooter, { x: 0, y: 0, z: -300 }, { x: 0, y: 0, z: 0 })).toBe(false);
  });
});

describe('steering magnet', () => {
  it('pulls the nose towards the lead point only while firing', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0 };
    const target = { x: -20, y: 10, z: 300 };
    assistSteer(out, pilot, target, { x: 0, y: 0, z: 0 }, 0, 0, true);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeLessThan(0);
    expect(Math.sqrt(out.x * out.x + out.y * out.y)).toBeLessThanOrEqual(T.assistMax + 1e-12);
    assistSteer(out, pilot, target, { x: 0, y: 0, z: 0 }, 0, 0, false);
    expect(out).toEqual({ x: 0, y: 0 });
  });

  it('ignores targets outside its cone or range and yields to a deliberate stick', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0 };
    assistSteer(out, pilot, { x: 200, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 0, 0, true);
    expect(out).toEqual({ x: 0, y: 0 });
    assistSteer(out, pilot, { x: 0, y: 5, z: T.assistRange + 100 }, { x: 0, y: 0, z: 0 }, 0, 0, true);
    expect(out).toEqual({ x: 0, y: 0 });
    const free = { x: 0, y: 0 };
    const held = { x: 0, y: 0 };
    assistSteer(free, pilot, { x: -20, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 0, 0, true);
    assistSteer(held, pilot, { x: -20, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1, 0, true);
    expect(Math.abs(held.x)).toBeLessThan(Math.abs(free.x));
  });

  it('closes a small aiming error over a few ticks without overshooting wildly', () => {
    const pilot = createFlightState();
    pilot.s = T.speedMax;
    const target = { x: -25, y: 12, z: 500 };
    const input = createInput();
    input.throttle = 1;
    input.steerX = 0;
    const out = { x: 0, y: 0 };
    const start = angleTo(pilot, target);
    let best = start;
    for (let i = 0; i < 45; i++) {
      assistSteer(out, pilot, target, { x: 0, y: 0, z: 0 }, 0, 0, true);
      sampleAssist(input, out.x, out.y);
      stepFlight(pilot, input, empty);
      best = Math.min(best, angleTo(pilot, target));
    }
    expect(best).toBeLessThan(start * 0.2);
    expect(angleTo(pilot, target)).toBeLessThan(start * 0.5);
  });
});
