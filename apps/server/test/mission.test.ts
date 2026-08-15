import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ABUSE, HULLS, fleetTravelMinutes, distance } from '@blindspace/rules';
import { missions, planets, players, scheduledEvents, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { installSatellite } from '../src/services/build.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

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

  beforeEach(async () => {
    f = await seedWorld(2);
    [attacker, defender] = f.planetIds as [string, string];
    await setLevel(f.db, attacker, 'CORE', 6);
    await giveUnits(f.db, attacker, { WASP: 50, HAULER: 5, BASTION: 3 });
    await grant(f.db, defender, 20_000, 2_000);
    // Clear newcomer grace so the interesting rules are the ones being tested.
    f.clock.advance(ABUSE.graceMinutes + 10);
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
    it('protects a newcomer', async () => {
      const fresh = await seedWorld(2, 777);
      const [a, b] = fresh.planetIds as [string, string];
      await setLevel(fresh.db, a, 'CORE', 6);
      await giveUnits(fresh.db, a, { WASP: 30 });
      // No clock advance: both are minutes old.
      await expect(
        launchAttack(fresh.db, a, b, { WASP: 10 }, fresh.clock),
      ).rejects.toMatchObject({ code: 'NEWCOMER_GRACE' });
    });

    it('refuses a target far below you on the ladder', async () => {
      await f.db
        .update(players)
        .set({ wealth: 1_000_000 })
        .where(eq(players.id, f.playerIds[0]!));
      await f.db.update(players).set({ wealth: 100 }).where(eq(players.id, f.playerIds[1]!));

      await expect(
        launchAttack(f.db, attacker, defender, { WASP: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'RANK_FLOOR' });
    });

    it('stops the fourth raid on the same target inside the window', async () => {
      const worker = new EventWorker(
        f.db,
        f.clock,
        { pollMs: 1000, batch: 100, staleMinutes: 5 },
        silent,
      );
      for (let i = 0; i < ABUSE.bashLimit; i++) {
        const launch = await launchAttack(f.db, attacker, defender, { WASP: 5 }, f.clock);
        f.clock.set(launch.arriveAt);
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
      const fast = await launchAttack(f.db, attacker, defender, { WASP: 1 }, f.clock);
      const slow = await launchAttack(f.db, attacker, defender, { BULWARK: 1 }, f.clock);
      expect(slow.exposureMinutes).toBeGreaterThan(fast.exposureMinutes);
      expect(HULLS.BULWARK.speed).toBeLessThan(HULLS.WASP.speed);
    });

    it('schedules the arrival at the moment the fleet lands', async () => {
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
      expect(event!.resolveAt.getTime()).toBe(launch.arriveAt.getTime());
    });

    it('records the mission as in flight', async () => {
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const [m] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
      expect(m!.status).toBe('in_flight');
      expect(m!.kind).toBe('attack');
    });
  });

  describe('radar warning', () => {
    it('is not scheduled at all below Radar L3', async () => {
      await setLevel(f.db, defender, 'CORE', 6);
      await setLevel(f.db, defender, 'RING', 2);
      await grant(f.db, defender, 200_000, 200_000);
      await installSatellite(f.db, defender, 'RADAR', f.clock);

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 10 }, f.clock);
      const warnings = await f.db
        .select()
        .from(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.kind, 'radar_warning'),
            eq(scheduledEvents.refId, launch.missionId),
          ),
        );
      expect(warnings).toHaveLength(0);
    });

    /**
     * The warning fires shortly before impact, not at launch: a 40-minute flight
     * must not give 40 minutes of notice, or the panic session evaporates.
     */
    it('fires shortly before impact once Radar reaches L3', async () => {
      await setLevel(f.db, defender, 'CORE', 8);
      await setLevel(f.db, defender, 'RING', 2);
      await grant(f.db, defender, 500_000, 500_000);
      for (let i = 0; i < 3; i++) await installSatellite(f.db, defender, 'RADAR', f.clock);

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
      expect(leadMinutes).toBeLessThanOrEqual(12);
    });
  });
});
