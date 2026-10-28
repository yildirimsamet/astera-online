import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { COMBAT, TRAVEL, UNAIDED, distance, fleetTravelExact, missionFuel } from '@astera/rules';
import { missions, neutralPlanetState, planets, seasons, units } from '../src/db/schema.js';
import { fleetTruthFor } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import {
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
 * CHOOSING HOW LONG TO STAY IN THE AIR. Owner decision, 2026-09-21: every mission, attacks
 * included.
 *
 * The item exists for the commander who is asleep or at work — the chat logs lose people when
 * their FLEET dies, not when their mines are emptied. Slower personal flights now
 * also save fuel (owner, 2026-10-11).
 */
describe('the pace a launch is flown at', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  const minutesBetween = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / 60_000;

  /**
   * MEASURED AGAINST THE RULE, NOT AGAINST A SECOND LAUNCH. One fleet may only be committed once,
   * so a before/after pair of real launches is impossible from one world — and pinning the server
   * to `fleetTravelExact` is the stronger assertion anyway: it catches a server that is
   * self-consistently wrong.
   */
  const spanBetween = async (a: string, b: string): Promise<number> => {
    const rows = await f.db.select().from(planets);
    const from = rows.find((r) => r.id === a)!;
    const to = rows.find((r) => r.id === b)!;
    return distance(from, to);
  };

  beforeEach(async () => {
    f = await seedWorld(2);
    [attacker, defender] = f.planetIds as [string, string];
    await setLevel(f.db, attacker, 'CORE', 6);
    await giveUnits(f.db, attacker, { DART: 50 });
    await grant(f.db, defender, 20_000, 2_000);
    f.clock.advance(250);
  });

  it('flies at full speed when no pace is chosen', async () => {
    const departedAt = f.clock.now();
    const launch = await launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(row?.pace).toBe(1);
    expect(minutesBetween(departedAt, launch.arriveAt)).toBeGreaterThan(0);
  });

  it('lands later in exact proportion to the pace, and records it', async () => {
    const dist = await spanBetween(attacker, defender);
    const departedAt = f.clock.now();
    const slow = await launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.5,
    );
    const fullSpeed = fleetTravelExact(dist, { DART: 5 }, UNAIDED);
    // Database timestamps store whole milliseconds, unlike the continuous travel rule.
    expect(Math.abs(minutesBetween(departedAt, slow.arriveAt) - fullSpeed * 2)).toBeLessThan(1 / 60_000);

    const [row] = await f.db.select().from(missions).where(eq(missions.id, slow.missionId));
    expect(row?.pace).toBe(0.5);
  });

  it('discounts fuel at the chosen pace', async () => {
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, defender, { x: 4_000 });
    const dist = await spanBetween(attacker, defender);
    const slow = await launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.25,
    );
    const [row] = await f.db.select().from(missions).where(eq(missions.id, slow.missionId));
    expect(row?.fuelPaid).toBe(missionFuel({ DART: 5 }, dist, 2, 'HOSTILE', 0.25));
    expect(row?.fuelPaid).toBeLessThan(missionFuel({ DART: 5 }, dist, 2));
  });

  it('launches with exactly enough discounted fuel when full speed is unaffordable', async () => {
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, defender, { x: 4_000 });
    const dist = await spanBetween(attacker, defender);
    const fuel = missionFuel({ DART: 5 }, dist, 2, 'HOSTILE', 0.5);
    expect(fuel).toBeLessThan(missionFuel({ DART: 5 }, dist, 2));
    await f.db.update(planets).set({ deuterium: fuel, lastTickAt: f.clock.now() }).where(eq(planets.id, attacker));
    await expect(launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
    const launched = await launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.5);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, attacker));
    expect(row?.fuelPaid).toBe(fuel);
    expect(origin?.deuterium).toBe(0);
  });

  it('rolls back an unaffordable slowed launch', async () => {
    const fuel = missionFuel({ DART: 5 }, await spanBetween(attacker, defender), 2, 'HOSTILE', 0.5);
    await f.db.update(planets).set({ deuterium: fuel - 1, lastTickAt: f.clock.now() }).where(eq(planets.id, attacker));
    await expect(launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.5))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, attacker));
    expect(origin?.deuterium).toBe(fuel - 1);
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });

  it('serializes concurrent launches against a tank that funds only one slowed flight', async () => {
    f = await seedWorld(3);
    attacker = f.planetIds[0]!;
    defender = f.planetIds[1]!;
    const otherTarget = f.planetIds[2]!;
    await setLevel(f.db, attacker, 'CORE', 6);
    await giveUnits(f.db, attacker, { DART: 50 });
    await grant(f.db, defender, 20_000, 2_000);
    await grant(f.db, otherTarget, 20_000, 2_000);
    f.clock.advance(250);
    await placeAt(f.db, attacker, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, defender, { x: 4_000, y: 0, z: 0 });
    await placeAt(f.db, otherTarget, { x: -4_000, y: 0, z: 0 });
    const fuel = missionFuel({ DART: 5 }, await spanBetween(attacker, defender), 2, 'HOSTILE', 0.5);
    await f.db.update(planets).set({ deuterium: fuel, lastTickAt: f.clock.now() }).where(eq(planets.id, attacker));
    const results = await Promise.allSettled([
      launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.5),
      launchAttack(f.db, attacker, otherTarget, { DART: 5 }, f.clock, undefined, false, 0.5),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((result) => result.status === 'rejected');
    expect(failed?.status === 'rejected' ? failed.reason : null).toMatchObject({ code: 'INSUFFICIENT_FUEL' });
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, attacker));
    expect(origin?.deuterium).toBe(0);
    expect(await f.db.select().from(missions)).toHaveLength(1);
  });

  it('refuses a pace that is not on the ladder', async () => {
    await expect(
      launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.37),
    ).rejects.toMatchObject({ code: 'BAD_PACE' });
  });

  /**
   * A FLEET PARKED IN SPACE IS AN UNTOUCHABLE FLEET. The ceiling is what separates fleetsave from
   * removing the fleet from the game while still owning it.
   */
  it('refuses a pace that would keep the fleet in the air past the ceiling', async () => {
    await placeAt(f.db, defender, { x: 20_000 });
    const dist = await spanBetween(attacker, defender);
    // The premise: at full speed this flight is comfortably inside the ceiling.
    expect(fleetTravelExact(dist, { DART: 5 }, UNAIDED))
      .toBeLessThan(TRAVEL.pacedFlightCapMinutes);
    await expect(
      launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.1),
    ).rejects.toMatchObject({ code: 'PACE_TOO_SLOW' });
  });

  /**
   * BOTH LEGS AT THE CHOSEN PACE. Owner decision, 2026-10-06: "Bacakların eşit yarı yarıya
   * bölünmesi lazım. Hem gidiş hem dönüş için." A fleet flies home at the speed it flew out, so a
   * slow raid's round trip is two equal halves — the figure the launch sheet quotes.
   */
  it('sends the survivors home at the pace they went out', async () => {
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
    const departedAt = f.clock.now();
    const slow = await launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.5,
    );
    const outbound = minutesBetween(departedAt, slow.arriveAt);
    // The quote is exact minutes; each persisted Date truncates sub-millisecond
    // precision. Two legs may therefore differ from twice the stored leg by <2 ms.
    expect(Math.abs(slow.exposureMinutes - 2 * outbound) * 60_000).toBeLessThan(2);

    f.clock.set(settledAt(slow.arriveAt));
    await worker.tick();

    const rows = await f.db.select().from(missions).where(eq(missions.kind, 'return'));
    const home = rows[0];
    expect(home).toBeTruthy();
    expect(home?.pace).toBe(0.5);
    expect(minutesBetween(home!.departAt, home!.arriveAt)).toBeCloseTo(outbound, 3);
  });

  it.each(['neutral', 'protected', 'became-owned'] as const)(
    'keeps the chosen pace on the return from a %s target', async (kind) => {
      if (kind === 'neutral') {
        await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, defender));
        await f.db.insert(neutralPlanetState).values({ planetId: defender, tier: 1,
          profileSeed: 1, economyAnchorAt: f.clock.now() });
        await f.db.delete(units).where(eq(units.planetId, defender));
      }
      const departedAt = f.clock.now();
      const launched = await launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.25);
      const outbound = minutesBetween(departedAt, launched.arriveAt);
      if (kind === 'protected') await f.db.update(planets).set({
        protectedUntil: new Date(launched.arriveAt.getTime() + 3_600_000),
      }).where(eq(planets.id, defender));
      if (kind === 'became-owned') await f.db.update(planets).set({
        kind: 'COLONY', controllerPlayerId: f.playerIds[0]!,
      }).where(eq(planets.id, defender));
      f.clock.set(settledAt(launched.arriveAt));
      const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
      await worker.tick();
      const [home] = await f.db.select().from(missions).where(eq(missions.kind, 'return'));
      expect(home).toBeTruthy();
      expect(home!.pace).toBe(0.25);
      expect(minutesBetween(home!.departAt, home!.arriveAt)).toBeCloseTo(outbound, 3);
    },
  );

  /**
   * THE SCOUT IS TOLD WHEN THE FLEET WILL REALLY BE HOME: the way back takes as long as the way
   * out, plus the engagement it fights in between.
   */
  it('estimates a slow raid home on the equally slow way back', async () => {
    const departedAt = f.clock.now();
    const slow = await launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.25,
    );
    const outbound = minutesBetween(departedAt, slow.arriveAt);
    const truth = (await fleetTruthFor(f.db, [attacker], f.clock.now())).get(attacker);
    expect(truth?.status).toBe('AWAY');
    const estimate = minutesBetween(slow.arriveAt, truth!.expectedHomeAt!);
    expect(estimate).toBeCloseTo(outbound + COMBAT.engagementSeconds / 60, 3);
  });

  /** AND THE SEASON'S END IS MEASURED ON THAT SAME SLOW WAY BACK. */
  it('refuses a slow raid whose slow way home would land after the season ends', async () => {
    const dist = await spanBetween(attacker, defender);
    const full = fleetTravelExact(dist, { DART: 5 }, UNAIDED);
    const endsAt = new Date(f.clock.now().getTime() + (full / 0.25 + full + 2) * 60_000);
    await f.db.update(seasons).set({ endsAt }).where(eq(seasons.id, f.seasonId));
    await expect(launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.25,
    )).rejects.toMatchObject({ code: 'SEASON_ENDS_BEFORE_RETURN' });
  });

  it('accepts a slow raid whose slow way home lands before the season ends', async () => {
    const dist = await spanBetween(attacker, defender);
    const full = fleetTravelExact(dist, { DART: 5 }, UNAIDED);
    const endsAt = new Date(f.clock.now().getTime() + (2 * full / 0.25 + 2) * 60_000);
    await f.db.update(seasons).set({ endsAt }).where(eq(seasons.id, f.seasonId));
    await expect(launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.25,
    )).resolves.toBeTruthy();
  });
});
