import { distance, fleetCount } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { markersFor } from '../src/galaxy/Squadrons.js';
import { RADAR_LESSON, RADAR_LESSON_CONTACT, lessonBearing, lessonFlight, lessonFrame, lessonSide, stagedChangeIn, stagedContact } from '../src/starter/director/radarLesson.js';

/**
 * THE RADAR, SHOWN ON A STAGED CONTACT (owner phone playtest 2026-11-18, item 28; owner decision: staged,
 * client only). A question mark in the radar's band, which comes into the telescope's sphere in two
 * seconds and is seen there for what it is: a fleet of Darts, drawn as four models, passing the ship by.
 * It never says it is coming for the ship: that would be a red warning, which is the lesson's point.
 */
const sensor = { at: { x: 1000, y: 0, z: -400 }, identify: 300, detect: 700 };
const flight = lessonFlight(sensor, 0.7);
const T0 = 1_000_000;
/** Its pace once inside the telescope's sphere: slower, to be watched there (owner 2026-11-18). */
const inside = flight.unitsPerMs * RADAR_LESSON.cruise;
const exitAt = T0 + RADAR_LESSON.enterMs + distance(flight.entry, flight.exit) / inside;
const outAt = exitAt + distance(flight.exit, flight.out) / inside;

describe('the staged contact\'s line', () => {
  it('starts in the radar\'s band and leaves through it, crossing the telescope\'s sphere in between', () => {
    const from = (point: { x: number; y: number; z: number }) => distance(point, sensor.at);
    expect(from(flight.start)).toBeGreaterThan(sensor.identify);
    expect(from(flight.start)).toBeLessThan(sensor.detect);
    expect(from(flight.entry)).toBeCloseTo(sensor.identify, 6);
    expect(from(flight.exit)).toBeCloseTo(sensor.identify, 6);
    expect(from(flight.out)).toBeCloseTo(sensor.detect, 6);
  });

  it('passes the ship by, never at it', () => {
    for (let share = 0; share <= 1; share += 0.05) {
      const point = { x: flight.entry.x + (flight.exit.x - flight.entry.x) * share, y: flight.entry.y, z: flight.entry.z + (flight.exit.z - flight.entry.z) * share };
      expect(distance(point, sensor.at)).toBeGreaterThanOrEqual(sensor.identify * RADAR_LESSON.pass - 1e-6);
    }
  });

  it('keeps to the ship\'s own plane', () => {
    for (const point of [flight.start, flight.entry, flight.exit, flight.out]) expect(point.y).toBe(sensor.at.y);
  });
});

describe('the staged contact over time', () => {
  it('is a still question mark until it moves', () => {
    const still = stagedContact(flight, null, T0);
    expect(still).toMatchObject({ id: RADAR_LESSON_CONTACT, kind: 'unknown', from: flight.start, to: flight.start });
    expect(still?.fleet).toBeUndefined();
    expect(stagedChangeIn(flight, null, T0)).toBeNull();
  });

  it('waits where it is until the moment it is set off, while the camera comes round', () => {
    expect(stagedContact(flight, T0, T0 - 500)).toMatchObject({ kind: 'unknown', from: flight.start, to: flight.start });
    expect(stagedChangeIn(flight, T0, T0 - 500)).toBe(500);
  });

  it('slows once it is inside the telescope\'s sphere, to be watched there', () => {
    const seen = stagedContact(flight, T0, T0 + RADAR_LESSON.enterMs + 10);
    // A date holds whole milliseconds.
    expect(Math.abs((seen?.endAt.getTime() ?? 0) - exitAt)).toBeLessThan(1);
    expect(RADAR_LESSON.cruise).toBeLessThan(1);
  });

  it('comes into the telescope\'s sphere two seconds after it starts, still unnamed on the way', () => {
    const coming = stagedContact(flight, T0, T0 + 1000);
    expect(coming).toMatchObject({ kind: 'unknown', from: flight.start, to: flight.entry });
    expect(coming?.startAt.getTime()).toBe(T0);
    expect(coming?.endAt.getTime()).toBe(T0 + RADAR_LESSON.enterMs);
    expect(stagedChangeIn(flight, T0, T0 + 1000)).toBe(RADAR_LESSON.enterMs - 1000);
  });

  it('is seen for what it is inside the sphere: a fleet of Darts, four models of it', () => {
    const seen = stagedContact(flight, T0, T0 + RADAR_LESSON.enterMs + 10);
    expect(seen).toMatchObject({ kind: 'fleet', from: flight.entry, to: flight.exit, fleet: RADAR_LESSON.fleet });
    expect(fleetCount(RADAR_LESSON.fleet)).toBe(40);
    expect(markersFor(RADAR_LESSON.fleet)).toHaveLength(4);
  });

  it('is a question mark again past the sphere, and gone once it is out of the radar\'s reach', () => {
    expect(stagedContact(flight, T0, exitAt + 10)).toMatchObject({ kind: 'unknown', from: flight.exit, to: flight.out });
    expect(stagedContact(flight, T0, outAt + 10)).toBeNull();
    expect(stagedChangeIn(flight, T0, outAt + 10)).toBeNull();
  });

  it('never says it is coming for the ship, nor whose it is', () => {
    for (const at of [T0 + 500, T0 + RADAR_LESSON.enterMs + 500, exitAt + 500]) {
      const contact = stagedContact(flight, T0, at);
      expect(contact?.inbound).toBeUndefined();
      expect(contact?.scout).toBeUndefined();
      expect(contact?.effectOnly).toBeUndefined();
    }
  });
});

describe('the side it is watched from (owner 2026-11-18: from the side, a little far, closer as it comes into sight)', () => {
  const side = lessonSide(flight);
  const length = distance(flight.entry, flight.exit);
  const line = { x: (flight.exit.x - flight.entry.x) / length, z: (flight.exit.z - flight.entry.z) / length };
  const along = (from: { x: number; y: number; z: number }, by: number) => ({ x: from.x + line.x * by, y: from.y, z: from.z + line.z * by });
  const level = Math.hypot(side.x, side.z);
  const normal = { x: (flight.entry.x - sensor.at.x) / sensor.identify, z: (flight.entry.z - sensor.at.z) / sensor.identify };
  /** Straight out from where it comes in, on the radar's sphere. */
  const rim = { x: flight.entry.x + normal.x * (sensor.detect - sensor.identify), y: flight.entry.y, z: flight.entry.z + normal.z * (sensor.detect - sensor.identify) };

  it('looks along the telescope\'s sphere where it comes in, so it crosses the sphere\'s outline as it is seen', () => {
    expect(Math.hypot(side.x, side.y, side.z)).toBeCloseTo(1, 6);
    expect((side.x * normal.x + side.z * normal.z) / level).toBeCloseTo(0, 6);
  });

  it('is from the side and a little above, behind it, so it flies on into the sphere across the frame', () => {
    const heading = (side.x * line.x + side.z * line.z) / level;
    expect(heading).toBeLessThan(0);
    expect(Math.abs(heading)).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(side.y).toBeGreaterThan(0);
    expect(side.y).toBeLessThan(0.5);
  });

  it('holds the radar\'s band a little far off: the telescope\'s edge to one side, the radar\'s to the other, the question mark between', () => {
    const band = lessonFrame(flight, 'band');
    expect(distance(band.at, flight.entry)).toBeCloseTo(band.half, 6);
    expect(distance(band.at, rim)).toBeCloseTo(band.half, 6);
    expect(distance(flight.start, band.at)).toBeLessThan(band.half);
  });

  it('closes in a little as it comes into the telescope\'s sphere, and holds it while it is watched there', () => {
    const band = lessonFrame(flight, 'band');
    const sight = lessonFrame(flight, 'sight');
    expect(sight.half).toBeLessThan(band.half);
    expect(sight.half).toBeGreaterThan(band.half * 0.5);
    const watched = along(flight.entry, inside * RADAR_LESSON.watchMs);
    for (const point of [flight.entry, watched]) expect(distance(point, sight.at)).toBeLessThan(sight.half);
  });

  it('is watched from behind and beside it, along the sphere, on any ship\'s line', () => {
    for (const angle of [0, 1.3, 2.9, 4.4, 6]) {
      const other = lessonFlight(sensor, angle);
      const view = lessonSide(other);
      const flat = Math.hypot(view.x, view.z);
      const way = distance(other.entry, other.exit);
      const heading = (view.x * (other.exit.x - other.entry.x) + view.z * (other.exit.z - other.entry.z)) / way / flat;
      const across = (view.x * (other.entry.x - sensor.at.x) + view.z * (other.entry.z - sensor.at.z)) / sensor.identify / flat;
      expect(heading).toBeCloseTo(-RADAR_LESSON.pass, 6);
      expect(across).toBeCloseTo(0, 6);
    }
  });

  it('runs a line of its own for each ship, the same one every time', () => {
    expect(lessonBearing('ship-a')).toBe(lessonBearing('ship-a'));
    expect(lessonBearing('ship-a')).not.toBe(lessonBearing('ship-b'));
    for (const id of ['ship-a', 'ship-b', '']) {
      expect(lessonBearing(id)).toBeGreaterThanOrEqual(0);
      expect(lessonBearing(id)).toBeLessThan(2 * Math.PI);
    }
  });
});
