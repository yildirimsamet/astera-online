import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ABUSE,
  COMBAT,
  HULLS,
  distance,
  engagementEndsAt,
  fleetTravelMinutes,
} from '@astera/rules';
import { missions, notifications, planets, scheduledEvents, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { raiseInstrument } from '../src/services/build.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * A world that has been running a while.
 *
 * These used to advance past the newcomer grace period, which no longer exists
 * (D14). The advance stays because the assertions below are about a settled
 * world — accrued resources, telescope windows that have turned over — and
 * removing it would quietly change what they test.
 */
const SETTLED_MINUTES = 250;


const silent = pino({ level: 'silent' });

// The database pool is shared across this whole file, so it is torn down at FILE
// scope. An afterAll inside a describe would close it out from under any describe
// that follows.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('launching a fleet', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;
  let other: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [attacker, defender, other] = f.planetIds as [string, string, string];
    // A second target at exactly the defender's distance, so a test can compare
    // two launches without both being committed to the same planet.
    await placeAt(f.db, other, { x: -150 });
    await setLevel(f.db, attacker, 'CORE', 6);
    await giveUnits(f.db, attacker, { WASP: 50, HAULER: 5, BASTION: 3 });
    await grant(f.db, defender, 20_000, 2_000);
    // Clear newcomer grace so the interesting rules are the ones being tested.
    f.clock.advance(SETTLED_MINUTES);
  });


  describe('validation', () => {
    it('refuses to attack your own planet', async () => {
      await expect(
        launchAttack(f.db, attacker, attacker, { WASP: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'SELF_ATTACK' });
    });

    it('refuses an empty fleet', async () => {
      await expect(
        launchAttack(f.db, attacker, defender, {}, f.clock),
      ).rejects.toMatchObject({ code: 'EMPTY_FLEET' });
      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 0 }, f.clock),
      ).rejects.toMatchObject({ code: 'EMPTY_FLEET' });
    });

    it('refuses more ships than are actually at home', async () => {
      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 51 }, f.clock),
      ).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    });

    it('refuses to send ground defence — Bastions cannot travel', async () => {
      await expect(
        launchAttack(f.db, attacker, defender, { BASTION: 1 }, f.clock),
      ).rejects.toMatchObject({ code: 'GROUND_UNIT' });
    });

    it('refuses fractional and negative ship counts', async () => {
      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 1.5 }, f.clock),
      ).rejects.toMatchObject({ code: 'BAD_FLEET' });
      await expect(
        launchAttack(f.db, attacker, defender, { WASP: -3 }, f.clock),
      ).rejects.toMatchObject({ code: 'BAD_FLEET' });
    });

    it('404s on a planet that does not exist', async () => {
      await expect(
        launchAttack(
          f.db,
          attacker,
          '00000000-0000-0000-0000-000000000000',
          { WASP: 5 },
          f.clock,
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('abuse guards', () => {
    /**
     * D14: there is no newcomer grace, and this is the test that says so out loud.
     *
     * A four-hour shield on every fresh account used to make this exact launch
     * fail. It was removed by owner decision, and the failure mode of quietly
     * putting it back is a game whose first hours teach the wrong lesson — so the
     * assertion is now that a minutes-old commander is a legal target.
     */
    it('leaves a newcomer open to attack', async () => {
      const fresh = await seedWorld(2, 777);
      const [a, b] = fresh.planetIds as [string, string];
      await setLevel(fresh.db, a, 'CORE', 6);
      await giveUnits(fresh.db, a, { WASP: 30 });
      // No clock advance: both planets are minutes old.
      const mission = await launchAttack(fresh.db, a, b, { WASP: 10 }, fresh.clock);
      expect(mission.arriveAt.getTime()).toBeGreaterThan(fresh.clock.now().getTime());
    });

    /**
     * THE BAND, FROM THE OUTSIDE. D49.
     *
     * It used to be a Wealth ratio, and the test set two `players.wealth` columns
     * directly. It is now the public development tier, so the arrangement is a
     * Core level — which is also the point of the change: the thing that decides
     * whether a launch is legal is the thing the attacker could already see on the
     * map before they packed a fleet.
     */
    it('refuses a target more than two development tiers away', async () => {
      // Attacker is Core 6 — tier 2 — from the fixture. Tier 5 is three above.
      await setLevel(f.db, defender, 'CORE', 15);

      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'TIER_BAND' });
    });

    /** And the edge of the band is legal, in both directions. */
    it('allows a target exactly two tiers away, above and below', async () => {
      await setLevel(f.db, defender, 'CORE', 12); // tier 4, two above tier 2
      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 5 }, f.clock),
      ).resolves.toBeTruthy();

      await setLevel(f.db, attacker, 'CORE', 9); // tier 3
      await setLevel(f.db, other, 'CORE', 1); // tier 1, two below
      await expect(
        launchAttack(f.db, attacker, other, { WASP: 5 }, f.clock),
      ).resolves.toBeTruthy();
    });

    it('stops the fourth raid on the same target inside the window', async () => {
      const worker = new EventWorker(
        f.db,
        f.clock,
        { pollMs: 1000, batch: 100, staleMinutes: 5 },
        silent,
      );
      /**
       * THE FLEET HAS TO COME HOME BETWEEN RAIDS, and this loop now waits for it.
       *
       * It used to launch again the moment the battle resolved, and passed only
       * because the target had a garrison big enough to destroy the raiders — a
       * wiped fleet has no return leg to be committed to. D22 leaves a fresh planet
       * with no ships at all, so five Wasps now win, survive, and turn for home,
       * and the second launch was refused by FLEET_ALREADY_COMMITTED before the
       * bash limit was ever reached. The test was passing for the wrong reason.
       *
       * Flying the return leg is also the honest sequence: three raids on the same
       * neighbour, each one completed, and the fourth refused because of the LIMIT
       * rather than because the fleet is still in the air.
       */
      for (let i = 0; i < ABUSE.bashLimit; i++) {
        const departedAt = f.clock.now().getTime();
        const launch = await launchAttack(f.db, attacker, defender, { WASP: 5 }, f.clock);
        const oneWay = (launch.arriveAt.getTime() - departedAt) / 60_000;

        f.clock.set(settledAt(launch.arriveAt));
        await worker.tick();

        // The survivors fly the same leg back, then land.
        f.clock.advance(oneWay + 1);
        await worker.tick();
        f.clock.advance(1);
      }
      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'BASH_LIMIT' });
    });
  });

  describe('what a launch does', () => {
    it('moves the ships off the home stack, in the same transaction', async () => {
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 30 }, f.clock);

      const home = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
      expect(home.find((u) => u.hull === 'WASP')!.count).toBe(20);

      const away = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, launch.missionId)));
      expect(away.find((u) => u.hull === 'WASP')!.count).toBe(30);
    });

    it('leaves ground defence at home — it never travels', async () => {
      await launchAttack(f.db, attacker, defender, { WASP: 50 }, f.clock);
      const home = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
      expect(home.find((u) => u.hull === 'BASTION')!.count).toBe(3);
    });

    it('reports exposure as the full round trip', async () => {
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const [a] = await f.db.select().from(planets).where(eq(planets.id, attacker));
      const [b] = await f.db.select().from(planets).where(eq(planets.id, defender));
      const oneWay = fleetTravelMinutes(distance(a!, b!), { WASP: 10 });
      expect(launch.exposureMinutes).toBe(oneWay * 2);
    });

    it('reports the home defence that will actually remain', async () => {
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 30 }, f.clock);
      // 20 Wasps + 5 Haulers left at home, plus 3 Bastions.
      expect(launch.homeDefenceAfter).toBe(20 + 5 + 3);
    });

    it('a slower fleet takes longer — composition is a time decision', async () => {
      await giveUnits(f.db, attacker, { WASP: 50, HAULER: 5, BULWARK: 2 });
      // Two equidistant targets, because only one fleet may be committed to a
      // given planet at a time. The comparison is about hull speed, not range.
      const fast = await launchAttack(f.db, attacker, defender, { WASP: 1 }, f.clock);
      const slow = await launchAttack(f.db, attacker, other, { BULWARK: 1 }, f.clock);
      expect(slow.exposureMinutes).toBeGreaterThan(fast.exposureMinutes);
      expect(HULLS.BULWARK.speed).toBeLessThan(HULLS.WASP.speed);
    });

    /**
     * THE ARRIVAL AND THE OUTCOME ARE TEN SECONDS APART. D44.
     *
     * `arriveAt` is when the fleet is over the target and it did not move: it is
     * what both sides read, what the radar counts down to, and what the client
     * flies the craft against. What moved is when the battle is SETTLED — the
     * engagement is a real window in which the mission is still `in_flight` and
     * nothing has been decided, which is the only reason the client may draw a
     * bombardment rather than a re-enactment of a recorded fact.
     */
    it('lands the fleet at arriveAt and settles the battle an engagement later', async () => {
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const [event] = await f.db
        .select()
        .from(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.kind, 'mission_arrival'),
            eq(scheduledEvents.refId, launch.missionId),
          ),
        );
      expect(event!.resolveAt.getTime()).toBe(engagementEndsAt(launch.arriveAt.getTime()));
      expect(event!.resolveAt.getTime() - launch.arriveAt.getTime()).toBe(
        COMBAT.engagementSeconds * 1000,
      );
    });

    /**
     * AND THE ETA THE PLAYER READS IS UNCHANGED BY IT.
     *
     * The engagement is deliberately far below the granularity of every clock in
     * the interface — ETAs are whole minutes — so a ten-second window must not
     * show up as an extra minute anywhere. This is what stops a piece of theatre
     * quietly rewriting the travel model.
     */
    it('does not lengthen the flight the player was quoted', async () => {
      const departedAt = f.clock.now().getTime();
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const quoted = (launch.arriveAt.getTime() - departedAt) / 60_000;
      expect(quoted).toBe(Math.ceil(quoted));
      expect(launch.exposureMinutes).toBe(quoted * 2);
    });

    /** A probe has no engagement: it resolves the instant it gets there. */
    it('gives a probe no engagement window at all', async () => {
      const probe = await launchProbe(f.db, attacker, defender, f.clock);
      const [event] = await f.db
        .select()
        .from(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.kind, 'mission_arrival'),
            eq(scheduledEvents.refId, probe.missionId),
          ),
        );
      expect(event!.resolveAt.getTime()).toBe(probe.arriveAt.getTime());
    });

    it('records the mission as in flight', async () => {
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const [m] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
      expect(m!.status).toBe('in_flight');
      expect(m!.kind).toBe('attack');
    });
  });

  describe('radar warning', () => {
    /**
     * BELOW L3 NOBODY IS WARNED — which is a fact about the NOTIFICATION, not
     * about the event. D45.
     *
     * This used to assert that no event was scheduled, and that mechanism has
     * changed: one warning is now scheduled for every raid and the defender's
     * radar is read at the moment it fires, because freezing the level at launch
     * meant a radar installed mid-flight bought nothing while the pending strip —
     * which reads the live level — warned anyway. The rule the test protects is
     * unchanged and is asserted here as what a player would actually experience.
     * `notifications.test.ts` walks the whole ladder.
     */
    it('warns nobody below Radar L3, however long the fleet is in the air', async () => {
      await setLevel(f.db, defender, 'CORE', 6);
      await grant(f.db, defender, 200_000, 200_000);
      // The Radar hangs off an Uplink in orbit (D25).
      await giveSatellite(f.db, defender, 'UPLINK');
      await raiseInstrument(f.db, defender, 'RADAR', f.clock);
      // Paying for a Radar made the defender rich, and rich means TALL — see
      // `levelWorld`. This test is about the warning, not about the tier band.
      await levelWorld(f.db, f.planetIds);

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const worker = new EventWorker(
        f.db,
        f.clock,
        { pollMs: 1000, batch: 100, staleMinutes: 5 },
        pino({ level: 'silent' }),
      );
      // Every rung of the ladder, right up to the moment it lands.
      for (const out of [12, 8, 5, 1]) {
        f.clock.set(new Date(launch.arriveAt.getTime() - out * 60_000));
        await worker.tick();
      }

      const told = await f.db
        .select()
        .from(notifications)
        .where(eq(notifications.kind, 'incoming_fleet'));
      expect(told).toHaveLength(0);
    });

    /**
     * The warning fires shortly before impact, not at launch: a 40-minute flight
     * must not give 40 minutes of notice, or the panic session evaporates.
     */
    it('fires shortly before impact once Radar reaches L3', async () => {
      await setLevel(f.db, defender, 'CORE', 8);
      await grant(f.db, defender, 500_000, 500_000);
      await giveSatellite(f.db, defender, 'UPLINK');
      for (let i = 0; i < 3; i++) await raiseInstrument(f.db, defender, 'RADAR', f.clock);
      await levelWorld(f.db, f.planetIds);

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const [warning] = await f.db
        .select()
        .from(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.kind, 'radar_warning'),
            eq(scheduledEvents.refId, launch.missionId),
          ),
        );
      expect(warning).toBeDefined();
      expect(warning!.resolveAt.getTime()).toBeLessThan(launch.arriveAt.getTime());
      const leadMinutes =
        (launch.arriveAt.getTime() - warning!.resolveAt.getTime()) / 60_000;
      expect(leadMinutes).toBeGreaterThan(0);
      /**
       * NEVER MORE THAN THE FLIGHT ITSELF, AND ON A LONG LEG NEVER CLOSE TO IT.
       *
       * D49 made the fuse a crossing rather than a constant, so there is no single
       * figure to assert against any more — the honest bound is D9's own words.
       * The test planets are a cluster, so this is deliberately generous; the
       * proportional bound lives in `rules/test/intel.test.ts`.
       */
      const flightMinutes =
        (launch.arriveAt.getTime() - f.clock.now().getTime()) / 60_000;
      expect(leadMinutes).toBeLessThanOrEqual(flightMinutes);
    });
  });
});
