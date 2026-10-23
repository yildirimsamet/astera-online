import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, aimCone, assistSteer, circleAim, createFlightState, createInput, gimbalAim, leadTime, sampleAssist, stepFlight,
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

/** A point `degrees` off the nose (local +X, screen left) at `distance` metres, for an unrotated pilot at the origin. */
const offNose = (degrees: number, distance: number): Vec3 => {
  const r = degrees * Math.PI / 180;
  return { x: Math.sin(r) * distance, y: 0, z: Math.cos(r) * distance };
};
const still = { x: 0, y: 0, z: 0 };
const circleDegrees = Math.acos(T.aimCircleCos) * 180 / Math.PI;
const degreesOff = (v: Vec3): number => Math.acos(Math.min(1, v.z / Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z))) * 180 / Math.PI;

describe('aim circle (owner 2026-10-21): the heading is the pilot\'s, only the guns follow', () => {
  it('is 8.5° wide either side of the nose (owner 2026-10-21: a little bigger than 7°)', () => {
    expect(circleDegrees).toBeCloseTo(8.5, 6);
  });

  it('flies shots twice as fast as before over the same range (owner 2026-10-21)', () => {
    expect(T.muzzleSpeed).toBe(1200);
    expect(T.muzzleSpeed * T.projectileLife).toBe(900);
  });

  it('puts the guns on a target inside the circle and lets go the moment it leaves', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    const inside = offNose(circleDegrees - 0.3, 400);
    expect(circleAim(out, pilot, inside, still)).toBe(1);
    expect(out.x / out.z).toBeCloseTo(inside.x / inside.z, 9);
    expect(Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z)).toBeCloseTo(1, 12);
    expect(circleAim(out, pilot, offNose(circleDegrees + 0.3, 400), still)).toBe(0);
  });

  it('leads a crossing target, and stops at the rim when the lead runs beyond it', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    // Slow: the lead is a little left of the hull and still inside.
    expect(circleAim(out, pilot, offNose(2, 300), { x: 20, y: 0, z: 0 })).toBe(1);
    expect(degreesOff(out)).toBeGreaterThan(2);
    // A turbo crosser: the lead is ~11° left; the guns stop on the rim, on the lead's side.
    expect(circleAim(out, pilot, offNose(2, 300), { x: 200, y: 0, z: 0 })).toBe(2);
    expect(degreesOff(out)).toBeGreaterThan(circleDegrees - 1);
    expect(degreesOff(out)).toBeLessThan(circleDegrees + 1);
    expect(out.x).toBeGreaterThan(0);
  });

  it('still follows a target whose hull has crossed out while its lead mark is inside', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    expect(circleAim(out, pilot, offNose(9, 300), { x: -110, y: 0, z: 0 })).toBe(1);
    expect(degreesOff(out)).toBeLessThan(circleDegrees);
  });

  it('ignores a target beyond aim range or behind', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    expect(circleAim(out, pilot, { x: 0, y: 5, z: T.aimRange + 100 }, still)).toBe(0);
    expect(circleAim(out, pilot, { x: 0, y: 0, z: -300 }, still)).toBe(0);
  });
});

/**
 * Owner 2026-10-21: "up close the assist lets go". The circle is drawn round the nose at
 * convergeDist and seen from the chase camera behind and above the ship; a cone from the nose
 * itself left a close target that sat inside the drawn circle outside. The rule is the cone
 * from the camera's eye through the drawn circle: what is inside on screen is inside.
 */
describe('aim circle as the pilot sees it', () => {
  const cone = { ex: 0, ey: 0, ez: 0, ax: 0, ay: 0, az: 0, cos: 0 };
  /** Is the world point inside the cone, measured from the eye? */
  const seen = (p: Vec3): number => {
    const dx = p.x - cone.ex; const dy = p.y - cone.ey; const dz = p.z - cone.ez;
    return (dx * cone.ax + dy * cone.ay + dz * cone.az) / Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  it('runs from the camera\'s eye through the circle drawn at convergence distance', () => {
    const pilot = createFlightState();
    aimCone(cone, pilot);
    expect(cone.ez).toBeCloseTo(-T.aimEyeBack, 9);
    expect(cone.ey).toBeCloseTo(T.aimEyeUp, 9);
    expect(Math.hypot(cone.ax, cone.ay, cone.az)).toBeCloseTo(1, 12);
    // The drawn rim, convergeDist ahead and convergeDist × tan(circle) to the side, is on the cone.
    const rim = T.convergeDist * Math.sqrt(1 - T.aimCircleCos * T.aimCircleCos) / T.aimCircleCos;
    expect(seen({ x: rim, y: 0, z: T.convergeDist })).toBeCloseTo(cone.cos, 3);
    expect(seen({ x: 0, y: 0, z: T.convergeDist })).toBeCloseTo(1, 12);
  });

  it('catches a close target that sits inside the drawn circle', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    // 60 m ahead, 12 m above the nose line: ~11° off the nose, inside the circle on screen.
    const close = { x: 0, y: 12, z: 60 };
    aimCone(cone, pilot);
    expect(seen(close)).toBeGreaterThan(cone.cos);
    expect(circleAim(out, pilot, close, still)).toBe(1);
    expect(out.y / out.z).toBeCloseTo(12 / 60, 9);
    // 10 m under the nose at 60 m is under the drawn circle too: no hold.
    expect(circleAim(out, pilot, { x: 0, y: -10, z: 60 }, still)).toBe(0);
  });

  it('holds a close crossing target the whole way across the circle', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    aimCone(cone, pilot);
    for (let x = -10; x <= 10; x += 2) {
      const p = { x, y: 4, z: 70 };
      if (seen(p) < cone.cos) continue;
      expect(circleAim(out, pilot, p, { x: -60, y: 0, z: 0 }), String(x)).not.toBe(0);
    }
  });

  it('never turns the guns behind the ship', () => {
    const pilot = createFlightState();
    const out = { x: 0, y: 0, z: 0 };
    // Between the eye and the ship: inside the cone, but behind the guns.
    expect(circleAim(out, pilot, { x: 0, y: 2, z: -10 }, still)).toBe(0);
  });
});
