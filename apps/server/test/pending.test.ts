import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  radarLead,
  radarRange,
} from '@astera/rules';
import { missions } from '../src/db/schema.js';
import { pendingThreads } from '../src/services/session.js';
import { inboundRadarLead, LEAD_TOLERANCE } from '../src/services/radar.js';
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
    await giveUnits(f.db, mine, { DART: 20 });
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
  const raid = async (radar = 5): Promise<{ arriveAt: Date; lead: number; missionId: string }> => {
    if (radar > 0) await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', radar);
    const launch = await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    const oneWay = (row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000;
    return {
      arriveAt: launch.arriveAt,
      lead: radarLead(radarRange(radar), row!.distance, oneWay),
      missionId: launch.missionId,
    };
  };

  /**
   * PUT THE TWO WORLDS FAR ENOUGH APART THAT THE CIRCLE ACTUALLY CUTS THE LEG.
   *
   * `seedWorld` lines its worlds up `TEST_SPACING` apart — 150 units — and the
   * NARROWEST radar circle is 1,200. So in the fixture's own geometry every rung
   * of the ladder swallows the whole leg, `radarLead` correctly returns
   * `min(1, range/dist) * oneWay` = the ENTIRE FLIGHT at every level, and the
   * rungs are indistinguishable from one another.
   *
   * Two things follow, and both of them bit. A test that wants an instant BEFORE
   * the warning has none to find, because the warning covers the flight from
   * departure. And a test that says it checks a circle "at its own size" is not
   * checking a size at all — at 150 units L1 and L5 behave identically.
   *
   * These tests passed anyway, on a margin of 0.125 min: a 150-unit hop used to
   * take 1.125 min, so `arriveAt - 1 min` landed just inside the flight. D152
   * lifted base speed by 1.25x, the same hop became 0.900 min, and `arriveAt - 1
   * min` moved to 0.1 min BEFORE the fleet had launched. Nothing about the radar
   * changed; the fixture was never far enough out to be asking the question.
   *
   * `radarRange(5) * 2` is the span the crossing-tolerance test below already
   * uses, so the two read the same geometry. Cores are pinned after `grant`
   * because a large setup purse raises them, and the standoffs the server's
   * `inboundRadarLead` works from are derived from the Core level.
   */
  const farApart = async (): Promise<void> => {
    const span = radarRange(5) * 2;
    await placeAt(f.db, mine, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, theirs, { x: span, y: 0, z: 0 });
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, theirs, 'CORE', 8);
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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 1000));

    expect(await pendingThreads(f.db, theirs, f.clock.now())).toEqual([]);
  });

  it('stays silent until the warning would have fired, then speaks', async () => {
    // There is no instant before the warning unless the circle cuts the leg.
    await farApart();
    const { arriveAt, lead } = await raid(5);
    expect(lead).toBeGreaterThan(1);
    // And the lead is a SHARE of the flight, not the whole of it — otherwise the
    // two probes below sit outside the flight rather than either side of a shell.
    expect(lead).toBeLessThan((arriveAt.getTime() - f.clock.now().getTime()) / 60_000);

    // A minute before the lead: nothing.
    f.clock.set(new Date(arriveAt.getTime() - (lead + 1) * 60_000));
    expect(await pendingThreads(f.db, theirs, f.clock.now())).toEqual([]);

    // Inside it: the warning.
    f.clock.set(new Date(arriveAt.getTime() - (lead - 1) * 60_000));
    const inside = await pendingThreads(f.db, theirs, f.clock.now());
    expect(inside).toHaveLength(1);
    expect(inside[0]!.kind).toBe('incoming');
  });

  it('uses the same crossing tolerance as the scheduled warning', async () => {
    const span = radarRange(5) * 2;
    await placeAt(f.db, mine, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, theirs, { x: span, y: 0, z: 0 });
    // `grant` may raise the Core to hold its large setup purse. Pin the geometry
    // this test passes to `inboundRadarLead` before the mission is created.
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, theirs, 'CORE', 8);
    const { arriveAt, missionId } = await raid(5);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, missionId));
    const oneWay = (row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000;
    const lead = inboundRadarLead(radarRange(5), {
      from: { x: 0, y: 0, z: 0 },
      to: { x: span, y: 0, z: 0 },
      originCoreLevel: 8,
      targetCoreLevel: 8,
      oneWayMinutes: oneWay,
    });

    // A worker delayed inside the shared slack has already fired the warning.
    f.clock.set(new Date(arriveAt.getTime() - (lead + LEAD_TOLERANCE / 2) * 60_000));
    const seen = await pendingThreads(f.db, theirs, f.clock.now());
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe('incoming');
  });

  /**
   * NO RADAR, NO WARNING — AND THAT IS THE ONLY LEVEL THAT GETS NONE.
   *
   * L1 and L2 used to be listed here beside L0, because the reach table was zero
   * for all three. The zeroes at L1 and L2 were inherited from the pre-D49 minutes
   * ladder and sold nothing at all; every rung that draws a circle now warns
   * inside it. What cannot leak a warning is the instrument nobody bought.
   */
  it('gives a radar-less world no fleet warning at any range', async () => {
    const { arriveAt } = await raid(0);
    for (const minutesOut of [30, 5, 1, 0]) {
      f.clock.set(new Date(arriveAt.getTime() - minutesOut * 60_000));
      expect(
        await pendingThreads(f.db, theirs, f.clock.now()),
        `leaked at ${String(minutesOut)} minutes out`,
      ).toEqual([]);
    }
  });

  /**
   * And the first rung that has a circle warns inside it, AT ITS OWN SIZE.
   *
   * Read either side of that rung's own shell rather than at a flat minute out:
   * the claim is that the circle has a size, so the test has to be able to fail
   * if it had a different one. In the fixture's cluster it could not — 150 units
   * is inside every rung, so this asserted nothing about L1 or L2 and passed on
   * the flight being a little over a minute long. See `farApart`.
   */
  it.each([1, 2])('gives a level-%i radar a warning inside its own circle', async (radar) => {
    await farApart();
    const { arriveAt, lead } = await raid(radar);
    expect(lead).toBeGreaterThan(0);

    // Outside this rung's shell, with the fleet already flying: still nothing.
    f.clock.set(new Date(arriveAt.getTime() - (lead + 1) * 60_000));
    expect(await pendingThreads(f.db, theirs, f.clock.now())).toEqual([]);

    // Inside it: the warning.
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const seen = await pendingThreads(f.db, theirs, f.clock.now());
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe('incoming');
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
    /*
      THE LEG HAS TO OUTRUN THE CIRCLE. It was 700 units against a Radar 5 that
      reached 570; the ladder reaches 2,200 now, so a 700-unit leg is caught at
      launch and there is no crossing left to measure. Derived from the radius, so
      the next table change cannot turn this into a test of nothing.
    */
    const span = Math.round(radarRange(5) * 1.6);
    await placeAt(w.db, fastFrom, { x: -span, z: 0 });
    await placeAt(w.db, fastAt, { x: 0, z: 0 });
    await placeAt(w.db, slowFrom, { x: -span, z: span + 900 });
    await placeAt(w.db, slowAt, { x: 0, z: span + 900 });
    await giveInstrument(w.db, fastAt, 'RADAR', 5);
    await giveInstrument(w.db, slowAt, 'RADAR', 5);
    await giveSatellite(w.db, fastAt, 'UPLINK');
    await giveSatellite(w.db, slowAt, 'UPLINK');
    await giveUnits(w.db, fastFrom, { DART: 20 });
    await giveUnits(w.db, slowFrom, { RAMPART: 4 });
    w.clock.advance(200);

    const fast = await launchAttack(w.db, fastFrom, fastAt, { DART: 20 }, w.clock);
    const slow = await launchAttack(w.db, slowFrom, slowAt, { RAMPART: 4 }, w.clock);

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
          return {
            // Radar tests centre-to-centre world coordinates. The visual thread
            // trims both endpoints around the planet meshes, so its displayed
            // length is deliberately not the sensor radius.
            distance: row!.distance * (out / span),
            lead: out,
          };
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
   *
   * WHAT IS WITHHELD IS NOW LEVELLED RATHER THAN ABSOLUTE. D123. A heading and a
   * route are never published to a defender at any radar level — those would give
   * away what L2's bearing costs — but the size and the roster are exactly what
   * `docs/game-design.md` has always advertised at L4 and L5, and until D123 there
   * was no field on this payload to sell them through. They were being handed out
   * for free on the public contact list instead, which is why the ladder read as
   * worthless.
   */
  it('tells a low radar that something is coming, and nothing else', async () => {
    const { arriveAt, lead } = await raid(3);
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const [inbound] = await pendingThreads(f.db, theirs, f.clock.now());

    expect(inbound!.kind).toBe('incoming');
    expect(inbound!.mass).toBeUndefined();
    expect(inbound!.fleet).toBeUndefined();
    expect(inbound!.originName).toBeUndefined();
    expect(inbound!.path).toBeUndefined();
    /**
     * AND IT NAMES THE DEFENDER'S OWN WORLD, WHICH IS NOT A RADAR PRODUCT.
     *
     * `targetName` used to be the literal sentence `'inbound fleet'` — user-facing
     * copy written on the server — and the world under the crosshair was nowhere
     * on the payload. A commander with four worlds could not tell which one to
     * defend. The radar ladder sells the ATTACKER's side: that something is coming
     * (L3), how big (L4), from where and with what (L5). None of that is this.
     */
    expect(inbound!.targetPlanetId).toBe(theirs);
    expect(inbound!.targetName).not.toBe('inbound fleet');
    // Not the attacker's world, under any key.
    expect(JSON.stringify(inbound)).not.toContain(mine);
  });

  /** L4 buys the size band: enough to choose between spending, flying out and standing. */
  it('estimates the size at radar 4, without naming a hull', async () => {
    const { arriveAt, lead } = await raid(4);
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const [inbound] = await pendingThreads(f.db, theirs, f.clock.now());

    expect(inbound!.mass).toBe('LIGHT');
    expect(inbound!.fleet).toBeUndefined();
    expect(inbound!.originName).toBeUndefined();
  });

  /** And L5, the top of the ladder, names the hulls and the world they left. */
  it('names the roster and the origin at radar 5', async () => {
    const { arriveAt, lead } = await raid(5);
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const [inbound] = await pendingThreads(f.db, theirs, f.clock.now());

    expect(inbound!.fleet).toEqual({ DART: 20 });
    expect(inbound!.mass).toBe('LIGHT');
    expect(inbound!.originName).toBeDefined();
    // A name, which is what turns a warning into a grudge — never a route.
    expect(inbound!.path).toBeUndefined();
  });

  it('tells you everything about your own craft, because you packed it', async () => {
    const { arriveAt, lead } = await raid();
    f.clock.set(new Date(arriveAt.getTime() - (lead / 2) * 60_000));
    const [own] = await pendingThreads(f.db, mine, f.clock.now());

    expect(own!.kind).toBe('fleet');
    expect(own!.leg).toBe('outbound');
    expect(own!.fleet).toEqual({ DART: 20 });
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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [home] = await pendingThreads(f.db, mine, f.clock.now());
    if (!home) {
      // Everything died — covered by its own case below.
      return;
    }
    expect(home.leg).toBe('return');
    const survivors = home.fleet?.DART ?? 0;
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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 3 }, f.clock);

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
    expect(out!.targetPlanetId).toBe(theirs);
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
    await giveUnits(f.db, mine, { DART: 20 });
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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);
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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 1000));

    const warned = await pendingThreads(f.db, theirs, f.clock.now());
    expect(warned).toHaveLength(1);
    expect(warned[0]!.kind).toBe('incoming');
    // A heading is never sold, at any level: it would give away what L2 costs.
    expect(warned[0]!.path).toBeUndefined();
    expect(warned[0]!.id).toBeUndefined();
    // An inbound thread carries no id, so it cannot collide with a contact either.
    expect(await drawnTwice(theirs)).toEqual([]);
  });

  /** And a bystander's disc is unaffected: everything is somebody else's. */
  it('draws nothing twice for a world that is not involved at all', async () => {
    const third = f.planetIds[2]!;
    await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);
    const probe = await launchProbe(f.db, mine, theirs, f.clock);
    // A share of the SHORTEST leg in the air, not a fixed half-minute: the probe
    // pays no launch overhead since D121 and is the craft that lands first.
    f.clock.advance(probe.flightMinutes / 2);

    expect(await pendingThreads(f.db, third, f.clock.now())).toEqual([]);
    expect(await drawnTwice(third)).toEqual([]);
    /*
      But it does see them, anonymously — and only them. The derived pirate lane is
      filtered out because this test is about MISSION traffic; a pirate crossing the
      bystander's circles is the feature working, not a duplicate. D150.
    */
    const { seasons } = await import('../src/db/schema.js');
    const { privatePirateField, pirateId } = await import('../src/services/pirateField.js');
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const pirates = new Set(privatePirateField(season!.asteroidKey).map((spec) =>
      pirateId(season!.asteroidKey, spec.index)));
    const seen = await galaxyTraffic(f.db, f.seasonId, third, f.clock.now());
    expect(seen.filter((contact) => !pirates.has(contact.id))).toHaveLength(2);
  });
});
