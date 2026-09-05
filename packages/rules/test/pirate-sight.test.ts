import { describe, expect, it } from 'vitest';
import {
  PIRATE,
  pirateDiscovered,
  pirateDiscoveredAt,
  piratePosition,
  pirateSightZone,
  pirateZone,
  sensorSphere,
  type PirateSpec,
  type SensorEpoch,
  type SensorSphere,
} from '../src/index.js';

/**
 * A PIRATE IS REMEMBERED, AND REMEMBERED IS IDENTIFIED. D158 · D160.
 *
 * D158 gave the lane the rock's discovery memory and then floored it at `CONTACT`
 * — the mark survived the eye, the manifest did not. The owner has ruled the rest
 * of the way (D160): *"görüş alanımdan çıkan korsanları ? olarak değil, görmek
 * istiyorum. Aynı asteroidlerde olduğu gibi."* A rock a commander has found stays
 * a rock with a yield on it for the rest of its life, and a pirate they have
 * ALREADY IDENTIFIED is the same fact: you looked, you counted the crew, you read
 * the level. Forgetting it a minute later is not fog, it is amnesia.
 *
 * WHAT MAKES THAT SAFE, AND IT IS THE WHOLE ARGUMENT: `sensor_epochs.reach` is the
 * TELESCOPE radius and nothing else (`refreshSensorEpoch`). So "discovered" already
 * means "was once inside an identifying circle" — the reading was paid for. D160
 * hands back a reading the commander bought; it never sells one they did not.
 *
 * MEMORY IS STILL A FLOOR AND NEVER A LIFT. A pirate that has never been inside a
 * telescope circle is exactly what it always was: `CONTACT` inside a radar one,
 * `NONE` outside every circle. Radar alone still buys the question mark only.
 *
 * WHAT MEMORY IS NOT IS SIGHT, and every surface has to say so. `remembered` —
 * computed from live `sensorZone` alone — marks an entry no circle is covering
 * right now, and the disc draws it faded. It does NOT mean the numbers are stale:
 * an orbit is a solved function of time and the crew is the lane's current state,
 * exactly as a discovered rock keeps serving its live `oreRemaining` to a commander
 * with no eyes on it. The faintness says "you cannot see this", not "this is old".
 *
 * D151 IS NOT IN TENSION WITH THAT. Its subject is a WORLD record, which really is
 * a snapshot taken by an arriving craft. A pirate is a body on a closed orbit, and
 * the rock lane settled how those are published three decisions earlier.
 *
 * THE MECHANISM IS THE ROCK'S, not a second one: same `sensor_epochs`, same
 * orbital-contact solve (`orbitDiscoveredAt`), so the two lanes cannot drift.
 */

const TAU = Math.PI * 2;

function pirate(overrides: Partial<PirateSpec> = {}): PirateSpec {
  return {
    index: 3,
    level: 2,
    roster: { DART: 4 },
    hoard: { alloy: 100, crystal: 50, deuterium: 0 },
    radius: 1_000,
    period: 100,
    phase: 0,
    inclination: 0,
    ascendingNode: 0,
    speed: (TAU * 1_000) / 100,
    appearsAt: 0,
    expiresAt: 500,
    ...overrides,
  };
}

/** A post sitting exactly where the pirate is at minute zero, with a small reach. */
function epoch(overrides: Partial<SensorEpoch> = {}): SensorEpoch {
  return {
    at: { x: 1_000, y: 0, z: 0 },
    reach: 100,
    startsAt: 0,
    endsAt: null,
    ...overrides,
  };
}

const eyes = (at = { x: 1_000, y: 0, z: 0 }, telescope = 5, radar = 5): SensorSphere[] =>
  [sensorSphere(at, telescope, radar)];

const BLIND: SensorSphere[] = [];

describe('a pirate a commander has already had eyes on', () => {
  it('is discovered at the instant it first crosses the sphere', () => {
    expect(pirateDiscoveredAt(pirate(), [epoch()], 40)).toBe(0);
  });

  /**
   * THE POINT OF THE WHOLE CHANGE. Half a period later the pirate is on the far
   * side of its orbit and nowhere near the post that found it — and it is still
   * discovered, because discovery is a fact about the past that cannot be undone.
   */
  it('stays discovered once the orbit has carried it away again', () => {
    const spec = pirate();
    const away = piratePosition(spec, 50);
    // Genuinely out of reach now, or the assertion below proves nothing.
    expect(Math.hypot(away.x - 1_000, away.y, away.z)).toBeGreaterThan(100);
    expect(pirateDiscoveredAt(spec, [epoch()], 50)).toBe(0);
  });

  it('is never discovered by a post that its orbit never enters', () => {
    expect(pirateDiscoveredAt(pirate(), [epoch({ at: { x: 0, y: 1_900, z: 0 } })], 400))
      .toBeNull();
  });

  /** A lane entry that has not appeared yet, and one that has gone, are both nothing. */
  it('remembers nothing outside the pirate’s own life', () => {
    expect(pirateDiscoveredAt(pirate({ appearsAt: 100 }), [epoch()], 40)).toBeNull();
    expect(pirateDiscoveredAt(pirate({ expiresAt: 30 }), [epoch()], 40)).toBeNull();
  });

  it('is not discovered by a commander who has never had a post at all', () => {
    expect(pirateDiscoveredAt(pirate(), [], 400)).toBeNull();
  });
});

describe('the zone a pirate is published at', () => {
  const spec = pirate();
  const here = piratePosition(spec, 0);

  it('reads live sight first, at full fidelity', () => {
    expect(pirateZone(eyes(here), spec, here, [], 0)).toBe('IDENTIFIED');
  });

  it('still falls back to a radar contact where the telescope does not reach', () => {
    const far = { x: here.x + 1_800, y: 0, z: 0 };
    expect(pirateZone(eyes(far), spec, here, [], 0)).toBe('CONTACT');
  });

  /**
   * THE POINT OF D160. The commander identified this pirate once; the orbit has
   * carried it out of every circle since, and they still know what it is.
   */
  it('keeps a discovered pirate identified after it leaves every circle', () => {
    const away = piratePosition(spec, 50);
    expect(pirateZone(BLIND, spec, away, [epoch()], 50)).toBe('IDENTIFIED');
  });

  it('leaves an undiscovered pirate outside every circle non-existent', () => {
    const away = piratePosition(spec, 50);
    expect(pirateZone(BLIND, spec, away, [], 50)).toBe('NONE');
  });

  /**
   * A MEMORY OF A TELESCOPE READING IS A TELESCOPE READING. The epoch's reach IS
   * the telescope radius, so this floor can only ever hand back sight that was
   * bought — which is why it may sit over a live radar contact.
   */
  it('holds a live radar contact at identified once it has been discovered', () => {
    const far = { x: here.x + 1_800, y: 0, z: 0 };
    expect(pirateZone(eyes(far), spec, here, [epoch()], 0)).toBe('IDENTIFIED');
  });

  /**
   * AND RADAR ALONE STILL BUYS NOTHING BUT THE QUESTION MARK. A pirate no
   * telescope has ever held is unchanged by D160 at every range.
   */
  it('leaves a never-identified pirate at contact inside a radar circle', () => {
    const far = { x: here.x + 1_800, y: 0, z: 0 };
    const never = [epoch({ at: { x: 0, y: 1_900, z: 0 } })];
    expect(pirateZone(eyes(far), spec, here, never, 0)).toBe('CONTACT');
  });

  /**
   * ONE STATEMENT OF THE FLOOR, READ BY EVERY CALLER. D160.
   *
   * `projectGalaxyTraffic` cannot call `pirateZone` — it already has the whole
   * lane's discovery answer as a precomputed set and re-solving per pirate would
   * be the same work twice — so the floor itself is the exported thing, and both
   * sites apply it rather than each writing `discovered ? … : live` for itself.
   * CLAUDE.md: nothing but `sight.ts` and this may hold an opinion about zones.
   */
  it('states the memory floor once, for both callers', () => {
    expect(pirateSightZone('NONE', true)).toBe('IDENTIFIED');
    expect(pirateSightZone('CONTACT', true)).toBe('IDENTIFIED');
    expect(pirateSightZone('IDENTIFIED', true)).toBe('IDENTIFIED');
    expect(pirateSightZone('NONE', false)).toBe('NONE');
    expect(pirateSightZone('CONTACT', false)).toBe('CONTACT');
  });

  /**
   * AND THE DISCOVERY QUESTION IS ASKED THE SAME WAY BY BOTH. D160.
   *
   * `orbitDiscoveredAt` returns null once `nowMinutes` reaches `expiresAt`, so a
   * pirate that expires while a raid is in the air would stop being discovered
   * mid-flight. `discoveredPirateIndexes` has always clamped to the last instant it
   * existed; `pirateZone` did not, so the launch gate and the disc could disagree
   * on the boundary. `pirateDiscovered` is now the one clamped question.
   */
  it('still knows a pirate it found, at the instant the lane drops it', () => {
    const spec = pirate();
    const at = piratePosition(spec, 50);
    expect(pirateDiscovered(spec, [epoch()], spec.expiresAt)).toBe(true);
    expect(pirateZone(BLIND, spec, at, [epoch()], spec.expiresAt)).toBe('IDENTIFIED');
    // ...and it never invents one it never had.
    expect(pirateDiscovered(spec, [], spec.expiresAt)).toBe(false);
  });

  /** The lane's own constants stay where they were: this changes sight, not combat. */
  it('changes nothing about what a pirate is worth fighting', () => {
    expect(PIRATE.damageMult[2]).toBeGreaterThan(0);
  });
});
