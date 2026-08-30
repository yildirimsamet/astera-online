import { describe, expect, it } from 'vitest';
import { SENSOR, sensorZone, type SensorSphere } from '@astera/rules';
import { nextCrossing, zoneAlong, type Segment } from '../src/galaxy/crossing.js';

/**
 * WHEN A CONTACT CROSSES YOUR SENSOR BOUNDARY. D125, and the owner's three zones.
 *
 * The crossing is the moment the ladder exists to sell — nothing becoming a
 * question mark, a question mark resolving into a craft you can read — and it only
 * lands on the right second if the client knows when to ask again. These hold the
 * arithmetic that decides it.
 *
 * The zone itself is `@astera/rules/sight`'s to define and is tested there. What
 * is tested here is the SOLVE: given a straight window and a set of circles, the
 * first instant the answer changes.
 */
const at = (x: number): { x: number; y: number; z: number } => ({ x, y: 0, z: 0 });

const leg = (fromX: number, toX: number): Segment => ({
  from: at(fromX),
  to: at(toX),
  startAt: new Date(0),
  endAt: new Date(100_000),
});

/** One world's eyes, stated as the two radii rather than as instrument levels. */
const post = (x: number, identify: number, detect = 0): SensorSphere =>
  ({ at: at(x), identify, detect });

describe('sensor boundary crossings', () => {
  it('reads the same zone the server does', () => {
    expect(zoneAlong(leg(0, 100), [post(0, 10, 50)], 0)).toBe('IDENTIFIED');
    expect(sensorZone([post(0, 10, 50)], at(30))).toBe('CONTACT');
    expect(sensorZone([post(0, 10, 50)], at(80))).toBe('NONE');
  });

  /**
   * THERE IS NO UNBOUNDED REACH ANY MORE. The telescope ladder ends at a number,
   * because one maxed instrument with an infinite reach deleted the horizon for a
   * whole season — measured on a real account. The far rim is always somebody
   * else's business.
   */
  it('never identifies a point past the widest reach', () => {
    expect(sensorZone([post(0, SENSOR.maxRadius)], at(99_999))).toBe('NONE');
    expect(sensorZone([post(0, SENSOR.maxRadius)], at(SENSOR.maxRadius - 1)))
      .toBe('IDENTIFIED');
  });

  it('finds the instant a craft enters reach', () => {
    // Flies from 100 to 0; the boundary at radius 10 is crossed at 90% of the leg.
    const crossing = nextCrossing(leg(100, 0), [post(0, 10)]);
    expect(crossing).not.toBeNull();
    expect(crossing!.getTime()).toBeCloseTo(90_000, -2);
  });

  /** A craft LEAVING has to go back to a question mark, or the reading outlives its licence. */
  it('finds the instant a craft leaves reach', () => {
    const crossing = nextCrossing(leg(0, 100), [post(0, 10)]);
    expect(crossing!.getTime()).toBeCloseTo(10_000, -2);
  });

  it('says nothing when the whole leg stays outside', () => {
    expect(nextCrossing(leg(500, 400), [post(0, 10)])).toBeNull();
  });

  it('says nothing when the whole leg stays inside', () => {
    expect(nextCrossing(leg(-5, 5), [post(0, 10)])).toBeNull();
  });

  it('does not turn a tangential touch into a visibility change', () => {
    const tangent: Segment = {
      from: { x: -100, y: 10, z: 0 },
      to: { x: 100, y: 10, z: 0 },
      startAt: new Date(0),
      endAt: new Date(100_000),
    };
    expect(nextCrossing(tangent, [post(0, 10)])).toBeNull();
  });

  it('treats overlapping posts as one combined visible volume', () => {
    const crossing = nextCrossing(leg(-100, 100), [post(-20, 40), post(20, 40)]);
    // The union begins at x=-60, 20% into the window. The overlap at the centre
    // must not be mistaken for an exit and a second entry.
    expect(crossing?.getTime()).toBeCloseTo(20_000, -2);
  });

  /** A leg that clips a reach and leaves again reports the FIRST change, not the last. */
  it('reports the first change on a leg that passes through', () => {
    const crossing = nextCrossing(leg(-100, 100), [post(0, 10)]);
    expect(crossing!.getTime()).toBeCloseTo(45_000, -2);
  });

  it('takes the earliest crossing across several worlds', () => {
    const crossing = nextCrossing(leg(200, 0), [post(0, 10), post(150, 20)]);
    // The far post is met first: entering its reach at x = 170.
    expect(crossing!.getTime()).toBeCloseTo(15_000, -2);
  });

  /**
   * BOTH CIRCLES OF ONE POST, IN ONE SOLVE — and this is what the split call
   * could not do.
   *
   * The caller used to build two arrays and solve twice, once for telescope
   * spheres and once for radar spheres, then take whichever came first. That
   * worked and it re-derived a model that already exists. One post carrying both
   * radii wakes on the radar boundary at 60% and again on the telescope boundary
   * at 95%, and `nextCrossing` returns the first of them because it is the first
   * time the ANSWER changes.
   */
  it('wakes on the radar boundary before the telescope one', () => {
    const both = post(0, 10, 80);
    const segment = leg(200, 0);

    const first = nextCrossing(segment, [both]);
    expect(first!.getTime()).toBeCloseTo(60_000, -2);

    // And the second transition is found from the window that starts after it.
    const rest: Segment = { ...segment, from: at(75) };
    const second = nextCrossing(rest, [both]);
    expect(second).not.toBeNull();
  });

  /** A post with no radar has one circle, and only one transition to find. */
  it('ignores a circle of zero radius', () => {
    const crossing = nextCrossing(leg(200, 0), [post(0, 10, 0)]);
    expect(crossing!.getTime()).toBeCloseTo(95_000, -2);
  });

  it('is silent with no posts at all', () => {
    expect(nextCrossing(leg(100, 0), [])).toBeNull();
  });
});
