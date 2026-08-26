import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { radarLead, radarRange } from '@astera/rules';
import { missions } from '../src/db/schema.js';
import { pendingThreads } from '../src/services/session.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * WHAT IS STILL IN FLIGHT — from both ends of the same mission.
 *
 * This payload had no behavioural test of any kind, which is a gap worth naming:
 * it carries the radar gate, and its own docblock records that the gate was once
 * missing and told every player at any radar level exactly how long they had. It
 * also carries the countdown both sides of a raid watch, and those two sides
 * disagreed.
 */
describe('what is in flight', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 2);
      await grant(f.db, id, 300_000, 60_000);
    }
    f.clock.advance(200);
    await giveUnits(f.db, mine, { WASP: 20 });
  });

  /**
   * A raid in the air, and the defender able to see it.
   *
   * THE LEAD IS DERIVED FROM THE MISSION, NOT FROM A TABLE. D49: a radar is a
   * circle, so how much notice it buys depends on the leg and on how fast the
   * attacker chose to fly. The test reads the same three figures the server does
   * off the same row, which is what keeps it a test of the gate rather than a
   * second copy of the arithmetic.
   */
  const raid = async (radar = 5): Promise<{ arriveAt: Date; lead: number }> => {
    if (radar > 0) await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', radar);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    const oneWay = (row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000;
    return { arriveAt: launch.arriveAt, lead: radarLead(radarRange(radar), row!.distance, oneWay) };
  };

  /**
   * THE BUG THE OWNER REPORTED, AT ITS SOURCE.
   *
   * Two players watching one fleet saw two clocks — the attacker counting to
   * 2m40s while the defender read 2m55s. `minutesRemaining` is rounded, and the
   * client rebuilt the arrival instant from it; the attacker's own thread could
   * fall back on the exact `arriveAt` inside `path`, and a defender's inbound
   * thread carries no path by design. So only one side was ever exact.
   *
   * Both threads come from the same mission row, so the instant is the same fact.
   * Publishing it costs the fog nothing: the radar ladder sells whether you are
   * warned and how early (D9), never the precision of the clock, and the defender
   * already knows the arrival minute.
   */
  it('gives both sides of a raid the same arrival instant, to the millisecond', async () => {
    const { arriveAt, lead } = await raid();
    /**
     * Half way through the warning the radar actually bought, rather than a flat
     * three minutes. At D63's speeds the whole flight is shorter than that, so the
     * old line put the clock BEFORE the fleet crossed into the circle and the
     * defender correctly saw nothing — a test failing on its own setup.
     */
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));

    const [attacker] = await pendingThreads(f.db, mine, f.clock.now());
    const [defender] = await pendingThreads(f.db, theirs, f.clock.now());

    expect(attacker, 'the attacker sees nothing in flight').toBeDefined();
    expect(defender, 'the defender sees no inbound fleet').toBeDefined();
    expect(defender!.kind).toBe('incoming');
    expect(attacker!.arriveAt.getTime()).toBe(defender!.arriveAt.getTime());
    expect(attacker!.arriveAt.getTime()).toBe(arriveAt.getTime());
  });

  /**
   * And the instant does not depend on WHEN it is asked for, which is what makes
   * it immune to the drift the rounded figure had. `minutesRemaining` is allowed
   * to differ between two reads; the instant is not.
   */
  it('reports the same instant however often it is asked', async () => {
    const { arriveAt } = await raid();
    f.clock.set(new Date(arriveAt.getTime() - 4 * 60_000));
    const [first] = await pendingThreads(f.db, mine, f.clock.now());
    f.clock.advance(1.5);
    const [second] = await pendingThreads(f.db, mine, f.clock.now());

    expect(second!.arriveAt.getTime()).toBe(first!.arriveAt.getTime());
    expect(second!.minutesRemaining).toBeLessThan(first!.minutesRemaining);
  });

  /* ── the radar gate ───────────────────────────────────────── */

  /**
   * D9, and the docblock on `pendingThreads` records that this shipped broken
   * once: a forty-minute flight gave forty minutes of notice, to everybody, at
   * radar level zero. The gate is the whole radar ladder.
   */
  it('tells a planet with no radar nothing at all', async () => {
    const { arriveAt } = await raid(0);
    f.clock.set(new Date(arriveAt.getTime() - 60_000));
    expect(await pendingThreads(f.db, theirs, f.clock.now())).toEqual([]);
  });

  it('keeps a stored radar silent while its Uplink is absent', async () => {
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 1000));

    expect(await pendingThreads(f.db, theirs, f.clock.now())).toEqual([]);
  });

  it('stays silent until the warning would have fired, then speaks', async () => {
    const { arriveAt, lead } = await raid(5);
    expect(lead).toBeGreaterThan(1);

    // A minute before the lead: nothing.
    f.clock.set(new Date(arriveAt.getTime() - (lead + 1) * 60_000));
    expect(await pendingThreads(f.db, theirs, f.clock.now())).toEqual([]);

    // Inside it: the warning.
    f.clock.set(new Date(arriveAt.getTime() - (lead - 1) * 60_000));
    const inside = await pendingThreads(f.db, theirs, f.clock.now());
    expect(inside).toHaveLength(1);
    expect(inside[0]!.kind).toBe('incoming');
  });

  /**
   * A radar that detects scans but not fleets (L1 and L2) must not list an
   * inbound raid. The reach table is zero there, and `radarDetectsFleets` reads
   * exactly that — so a level that was never sold a fleet warning cannot leak one.
   */
  it.each([1, 2])('gives a level-%i radar no fleet warning at any range', async (radar) => {
    const { arriveAt } = await raid(radar);
    for (const minutesOut of [30, 5, 1, 0]) {
      f.clock.set(new Date(arriveAt.getTime() - minutesOut * 60_000));
      expect(
        await pendingThreads(f.db, theirs, f.clock.now()),
        `leaked at ${String(minutesOut)} minutes out`,
      ).toEqual([]);
    }
  });

  /**
   * THE POINT OF MAKING A RADAR A CIRCLE. D49.
   *
   * A radar catches a fleet at a DISTANCE, so two raids flown at two identical
   * defenders from the same range appear on the strip at the same distance out —
   * and therefore at very different TIMES, because one of them is flying twice as
   * fast as the other. A Bulwark siege fleet is telegraphed; a Wasp strike is not.
   * That is an interaction between two systems that already existed, and it is
   * exactly what a flat lead in minutes could not express.
   *
   * TWO SEPARATE PAIRS, because an inbound thread is deliberately anonymous: with
   * both raids aimed at one world there is no field on the payload that says which
   * of them the strip is reporting.
   */
  it('catches every fleet at the same distance out, whatever it flies at', async () => {
    const w = await seedWorld(4, 5150);
    const [fastFrom, fastAt, slowFrom, slowAt] = w.planetIds as [string, string, string, string];

    for (const id of w.planetIds) {
      await setLevel(w.db, id, 'CORE', 8);
      await setLevel(w.db, id, 'SHIPYARD', 4);
    }
    // Two pairs, 700 units apart each, far enough from one another to be separate.
    await placeAt(w.db, fastFrom, { x: -700, z: 0 });
    await placeAt(w.db, fastAt, { x: 0, z: 0 });
    await placeAt(w.db, slowFrom, { x: -700, z: 900 });
    await placeAt(w.db, slowAt, { x: 0, z: 900 });
    await giveInstrument(w.db, fastAt, 'RADAR', 5);
    await giveInstrument(w.db, slowAt, 'RADAR', 5);
    await giveSatellite(w.db, fastAt, 'UPLINK');
    await giveSatellite(w.db, slowAt, 'UPLINK');
    await giveUnits(w.db, fastFrom, { WASP: 20 });
    await giveUnits(w.db, slowFrom, { BULWARK: 4 });
    w.clock.advance(200);

    const fast = await launchAttack(w.db, fastFrom, fastAt, { WASP: 20 }, w.clock);
    const slow = await launchAttack(w.db, slowFrom, slowAt, { BULWARK: 4 }, w.clock);

    /** How far out the strip first admits this mission exists, and how long that left. */
    const caughtAt = async (
      missionId: string,
      defender: string,
    ): Promise<{ distance: number; lead: number }> => {
      const [row] = await w.db.select().from(missions).where(eq(missions.id, missionId));
      const span = (row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000;
      /**
       * STEPPED BY DISTANCE, NOT BY TIME.
       *
       * This swept in tenths of a minute, which was a few units of travel at the old
       * hull speeds and forty-three at D63's — so the circle it measured came out ten
       * units inside the real one and the assertion below failed on the sweep's own
       * granularity rather than on anything the radar did. Deriving the step from
       * this fleet's actual pace keeps the resolution fixed in UNITS at any speed,
       * which is what the assertion is written in.
       */
      const perMinute = row!.distance / span;
      const step = 5 / perMinute;
      for (let out = span; out >= 0; out -= step) {
        w.clock.set(new Date(row!.arriveAt.getTime() - out * 60_000));
        const seen = await pendingThreads(w.db, defender, w.clock.now());
        if (seen.some((t) => t.kind === 'incoming')) {
          return { distance: (row!.distance * out) / span, lead: out };
        }
      }
      throw new Error('never warned');
    };

    const caughtFast = await caughtAt(fast.missionId, fastAt);
    const caughtSlow = await caughtAt(slow.missionId, slowAt);

    // The same circle, to within the five game-unit sweep step above.
    expect(Math.abs(caughtFast.distance - radarRange(5))).toBeLessThanOrEqual(5.01);
    expect(Math.abs(caughtSlow.distance - radarRange(5))).toBeLessThanOrEqual(5.01);
    // And therefore a very different amount of warning.
    expect(caughtSlow.lead).toBeGreaterThan(caughtFast.lead * 1.5);
  });

  /* ── what each side is entitled to ────────────────────────── */

  /**
   * THE FOG IS ENFORCED BY OMISSION, and that is what makes it safe against a
   * modified client: there is no field carrying the answer, not a nulled one.
   */
  it('never tells the defender what is in it or where it came from', async () => {
    const { arriveAt, lead } = await raid();
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const [inbound] = await pendingThreads(f.db, theirs, f.clock.now());

    expect(inbound!.fleet).toBeUndefined();
    expect(inbound!.path).toBeUndefined();
    expect(inbound!.targetName).toBe('inbound fleet');
    // Not the attacker's world, under any key.
    expect(JSON.stringify(inbound)).not.toContain(mine);
  });

  it('tells you everything about your own craft, because you packed it', async () => {
    const { arriveAt, lead } = await raid();
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const [own] = await pendingThreads(f.db, mine, f.clock.now());

    expect(own!.kind).toBe('fleet');
    expect(own!.leg).toBe('outbound');
    expect(own!.fleet).toEqual({ WASP: 20 });
    expect(own!.path).toBeDefined();
    expect(own!.path!.arriveAt.getTime()).toBe(own!.arriveAt.getTime());
  });

  /**
   * A return leg is stored with its origin and target swapped, so the name worth
   * showing is at the other end — otherwise a fleet coming home would be labelled
   * with the player's own world.
   */
  it('names a returning fleet after where it has been', async () => {
    const { arriveAt } = await raid();
    f.clock.set(settledAt(arriveAt));
    await worker().tick();

    const [home] = await pendingThreads(f.db, mine, f.clock.now());
    expect(home, 'nothing came home from the raid').toBeDefined();
    expect(home!.leg).toBe('return');
    expect(home!.targetName).not.toBe('');
    expect(home!.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime() - 1000);
  });

  /**
   * A RETURNING FLEET IS THE SURVIVORS, AND ONLY THE SURVIVORS.
   *
   * The disc draws a squadron from `fleet` on the thread, so this is what decides
   * how many hulls come home on screen. If it carried what LEFT, a raid that lost
   * half its ships would fly home at full strength and the loss would only appear
   * in the battle report — the player would watch a fiction.
   */
  it('brings home only what survived, so the drawn squadron shrinks', async () => {
    // A defence that will certainly kill some of the attackers.
    await giveUnits(f.db, theirs, { BASTION: 8, THORN: 20 });
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [home] = await pendingThreads(f.db, mine, f.clock.now());
    if (!home) {
      // Everything died — covered by its own case below.
      return;
    }
    expect(home.leg).toBe('return');
    const survivors = home.fleet?.WASP ?? 0;
    expect(survivors, 'a fleet came home with more ships than it left with').toBeLessThan(20);
    expect(survivors).toBeGreaterThan(0);
  });

  /**
   * AND A FLEET THAT DIED ENTIRELY LEAVES NOTHING BEHIND ON THE DISC.
   *
   * No survivors means no return mission, which means no thread, which means the
   * galaxy draws nothing. The owner's rule: nothing may sit around with no purpose.
   */
  it('leaves no thread at all when the whole fleet is destroyed', async () => {
    await giveUnits(f.db, theirs, { BASTION: 40, THORN: 60 });
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 3 }, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const threads = await pendingThreads(f.db, mine, f.clock.now());
    expect(threads, 'a wiped fleet is still being drawn').toEqual([]);
  });

  it('carries a probe as its own kind, on both legs', async () => {
    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    const [out] = await pendingThreads(f.db, mine, f.clock.now());
    expect(out!.kind).toBe('probe');
    expect(out!.leg).toBe('outbound');
    expect(out!.arriveAt.getTime()).toBe(launch.arriveAt.getTime());
  });

  it('is empty when nothing is in the air', async () => {
    expect(await pendingThreads(f.db, mine, f.clock.now())).toEqual([]);
  });

  /** A resolved mission is not in flight, whatever else is true of it. */
  it('drops a thread the moment its mission stops flying', async () => {
    const { arriveAt } = await raid();
    f.clock.set(new Date(arriveAt.getTime() - 60_000));
    expect(await pendingThreads(f.db, mine, f.clock.now())).toHaveLength(1);

    await f.db.update(missions).set({ status: 'cancelled' }).where(eq(missions.status, 'in_flight'));
    expect(await pendingThreads(f.db, mine, f.clock.now())).toEqual([]);
  });
});

/**
 * WHOSE CRAFT IS THIS, ASKED OF EVERY LEG THAT TOUCHES A WORLD.
 *
 * `pendingThreads` matches `origin OR target` and used to special-case exactly one
 * foreign leg — an inbound attack. Four kinds of leg match that query without
 * belonging to the caller, and the other three fell through to the branch that
 * describes YOUR OWN craft: with a full `path` (so the disc drew a route line),
 * the `fleet` inside it, and `targetName` set to the other world's name.
 *
 * So a player who had just been probed could read WHO probed them off their own
 * pending strip, and a player who had just been raided watched the attacker's
 * survivors leave their orbit labelled as their own outbound squadron — which the
 * galaxy then drew bombarding the raider's homeworld when the phantom "arrived".
 *
 * And every one of those legs is ALSO published to the same caller by
 * `/api/galaxy/traffic`, because that list excludes only what the caller owns. One
 * mission, two payloads, two craft on one disc, disagreeing about what they were.
 *
 * The rule was already written down twice — in `flight.ts`, which counts bays, and
 * in `traffic.ts`, which decides what to publish. These hold the third caller to it.
 */
describe('whose craft is in flight', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 2);
      await grant(f.db, id, 300_000, 60_000);
    }
    f.clock.advance(200);
    await giveUnits(f.db, mine, { WASP: 20 });
  });

  /**
   * THE ONE INVARIANT UNDER ALL OF THIS: a craft is drawn exactly once per viewer.
   *
   * Your own craft come from `pending` and everybody else's from `traffic`, and the
   * two lists key on the same mission id — so an id appearing in both is, literally,
   * the same squadron rendered twice in the same scene from two different payloads.
   */
  const drawnTwice = async (planetId: string): Promise<string[]> => {
    const own = await pendingThreads(f.db, planetId, f.clock.now());
    const seen = await galaxyTraffic(f.db, f.seasonId, planetId, f.clock.now());
    const ids = new Set(own.map((t) => t.id).filter((id): id is string => id !== undefined));
    return seen.filter((c) => ids.has(c.id)).map((c) => c.id);
  };

  it('never tells a scouted world that a probe is inbound, or whose it is', async () => {
    await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.advance(0.5);

    const scouted = await pendingThreads(f.db, theirs, f.clock.now());
    expect(scouted, 'an inbound probe was listed as the target’s own craft').toEqual([]);
    expect(await drawnTwice(theirs)).toEqual([]);
  });

  it('never tells a scouted world about the probe flying home from it', async () => {
    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() + 1000));
    await worker().tick();

    // The prober's own craft, on its way back.
    const prober = await pendingThreads(f.db, mine, f.clock.now());
    expect(prober).toHaveLength(1);
    expect(prober[0]!.leg).toBe('return');

    const scouted = await pendingThreads(f.db, theirs, f.clock.now());
    expect(scouted, 'a probe leaving was listed as the scouted world’s own craft').toEqual([]);
    expect(await drawnTwice(theirs)).toEqual([]);
  });

  /**
   * THE WORST OF THE FOUR. A return leg is stored with its two ends SWAPPED, so a
   * raider's survivors flying home have the RAIDED world in `originPlanetId` — which
   * the old code read as "an outbound leg of yours".
   */
  it('never gives a raided world the attacker’s departing fleet as its own', async () => {
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const attacker = await pendingThreads(f.db, mine, f.clock.now());
    expect(attacker, 'nothing came home from the raid').toHaveLength(1);
    expect(attacker[0]!.leg).toBe('return');

    const raided = await pendingThreads(f.db, theirs, f.clock.now());
    expect(raided, 'the attacker’s fleet was listed as the defender’s own').toEqual([]);
    expect(await drawnTwice(theirs)).toEqual([]);
    // And nothing on the payload names the world it is flying to.
    expect(JSON.stringify(raided)).not.toContain(mine);
  });

  /**
   * The one foreign leg that IS reported, unchanged: a raid aimed at you, once the
   * radar has caught it. This is the branch the fix must not have taken with it.
   */
  it('still warns a defender about an inbound raid, and only about that', async () => {
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 1000));

    const warned = await pendingThreads(f.db, theirs, f.clock.now());
    expect(warned).toHaveLength(1);
    expect(warned[0]!.kind).toBe('incoming');
    expect(warned[0]!.path).toBeUndefined();
    expect(warned[0]!.fleet).toBeUndefined();
    expect(warned[0]!.id).toBeUndefined();
    // An inbound thread carries no id, so it cannot collide with a contact either.
    expect(await drawnTwice(theirs)).toEqual([]);
  });

  /** And a bystander's disc is unaffected: everything is somebody else's. */
  it('draws nothing twice for a world that is not involved at all', async () => {
    const third = f.planetIds[2]!;
    await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    const probe = await launchProbe(f.db, mine, theirs, f.clock);
    // A share of the SHORTEST leg in the air, not a fixed half-minute: the probe
    // pays no launch overhead since D121 and is the craft that lands first.
    f.clock.advance(probe.flightMinutes / 2);

    expect(await pendingThreads(f.db, third, f.clock.now())).toEqual([]);
    expect(await drawnTwice(third)).toEqual([]);
    // But it does see them, anonymously.
    expect(await galaxyTraffic(f.db, f.seasonId, third, f.clock.now())).toHaveLength(2);
  });
});
