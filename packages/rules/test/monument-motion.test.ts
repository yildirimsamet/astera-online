import { describe, expect, it } from 'vitest';
import { MONUMENT_SEASON_DEFAULTS, distance, travelExact, monumentMotion, motionPositionAt, motionVelocityAt, interceptMotion } from '../src/index.js';

describe('shared monument tumble', () => {
  const point = MONUMENT_SEASON_DEFAULTS.positions[0]!;
  const motion = monumentMotion(point, 0);
  it('keeps the external shell and pairwise distances while moving vertically and horizontally', () => {
    for (const t of [0, 123_000, 9_000_000, 48_000_000]) {
      const moved = MONUMENT_SEASON_DEFAULTS.positions.map(p => motionPositionAt(monumentMotion(p, 0), t));
      for (let i = 0; i < moved.length; i++) {
        expect(Math.hypot(moved[i]!.x, moved[i]!.y, moved[i]!.z)).toBeCloseTo(6000, 8);
        for (let j = 0; j < i; j++) expect(distance(moved[i]!, moved[j]!)).toBeCloseTo(distance(MONUMENT_SEASON_DEFAULTS.positions[i]!, MONUMENT_SEASON_DEFAULTS.positions[j]!), 8);
      }
    }
    expect(motionPositionAt(motion, 8 * 3600_000)).not.toEqual(point);
    expect(distance(motionPositionAt(motion, 16 * 3600_000), point)).toBeLessThan(1e-7);
    expect(motionPositionAt(motion, 2 * 3600_000).y).not.toBeCloseTo(point.y);
  });
  it('uses a common epoch and agrees with its derivative', () => {
    expect(motionPositionAt(monumentMotion(point, 123_000), 123_000)).toEqual(point);
    const t = 42_000_000, h = 100;
    const a = motionPositionAt(motion, t - h), b = motionPositionAt(motion, t + h);
    expect(distance(motionVelocityAt(motion, t), { x:(b.x-a.x)/(2*h), y:(b.y-a.y)/(2*h), z:(b.z-a.z)/(2*h) })).toBeLessThan(1e-8);
  });
  it('meets the moving target on the actual first outbound leg, including slow fleets', () => {
    const from = { x:4100, y:500, z:500 };
    for (const speed of [113, 75, 56, 28.25, 11.3]) {
      const result = interceptMotion(from, speed, motion, 0, 48 * 3600_000);
      expect(result).not.toBeNull();
      if (!result) throw new Error('meeting missing');
      expect(distance(result.at, motionPositionAt(motion, result.arriveAt))).toBeLessThan(1e-7);
      expect(travelExact(distance(from, result.at), speed)).toBeCloseTo(result.flightMinutes, 5);
      for (let t = 0; t < result.arriveAt - 1000; t += 1000) expect(travelExact(distance(from, motionPositionAt(motion,t)),speed)*60_000-t).toBeGreaterThan(0);
    }
  });
  it('returns null for invalid speed or expired target and preserves the 113 bound', () => {
    const from = { x:-4500, y:0, z:0 };
    expect(interceptMotion(from, 0, motion, 0, 1e9)).toBeNull();
    expect(interceptMotion(from, 113, motion, 0, 1000)).toBeNull();
    expect(interceptMotion(from, 113, motion, 0, 1e9)!.flightMinutes).toBeLessThanOrEqual(10500*1.2/113);
  });
  it('freezes on the exact cutoff without changing any earlier position',()=>{
    const stopped={...motion,stopAtMs:1000_000};
    expect(motionPositionAt(stopped,900_000)).toEqual(motionPositionAt(motion,900_000));
    expect(motionPositionAt(stopped,2000_000)).toEqual(motionPositionAt(motion,1000_000));
    expect(motionVelocityAt(stopped,2000_000)).toEqual({x:0,y:0,z:0});
  });
  it('finds an isolated tangent and a sub-second first interception window for a slow fleet', () => {
    const from = { x: 4500, y: 0, z: 0 };
    const orbit = monumentMotion({ x: -6000, y: 0, z: 0 }, 0);
    const omega = 2 * Math.PI / orbit.periodYMs;
    // Independent one-axis distance/derivative: the second rotation leaves this origin on X.
    const separation = (t: number) => Math.sqrt(6000 ** 2 + 4500 ** 2 - 2 * 6000 * 4500 * Math.cos(Math.PI + omega * t));
    const slope = (t: number) => 6000 * 4500 * omega * Math.sin(Math.PI + omega * t) / separation(t);
    let low = 4 * 3_600_000, high = 5 * 3_600_000;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (slope(mid) * mid - separation(mid) < 0) low = mid;
      else high = mid;
    }
    const tangentAt = (low + high) / 2;
    const tangentSpeed = separation(tangentAt) / tangentAt * 72_000;
    const tangent = interceptMotion(from, tangentSpeed, orbit, 0, tangentAt + 60_000);
    expect(tangent).not.toBeNull();
    expect(tangent!.arriveAt).toBeCloseTo(tangentAt, -1);
    const speed = tangentSpeed * (1 + 1e-8);
    low = 4 * 3_600_000; high = tangentAt;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (separation(mid) - speed / 72_000 * mid > 0) low = mid;
      else high = mid;
    }
    const narrow = interceptMotion(from, speed, orbit, 0, tangentAt + 60_000);
    expect(narrow).not.toBeNull();
    expect(Math.abs(narrow!.arriveAt - high)).toBeLessThan(0.1);
    expect(tangentAt - narrow!.arriveAt).toBeLessThan(1000);
  });
});
