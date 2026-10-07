import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { COMBAT, TRAVEL, UNAIDED, distance, fleetTravelExact, missionFuel } from '@astera/rules';
import { missions, planets, seasons } from '../src/db/schema.js';
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
 * their FLEET dies, not when their mines are emptied — and it buys that with TIME ONLY. A pace
 * that also cut fuel would be the global fuel cut this plan measured and killed: an attacker
 * would fly slow, pay less, and distance would stop being protection.
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
    expect(minutesBetween(departedAt, slow.arriveAt)).toBeCloseTo(fullSpeed * 2, 5);

    const [row] = await f.db.select().from(missions).where(eq(missions.id, slow.missionId));
    expect(row?.pace).toBe(0.5);
  });

  /** The owner's constraint: this item moves the clock and nothing else. */
  it('charges identical fuel however slowly it is flown', async () => {
    const dist = await spanBetween(attacker, defender);
    const slow = await launchAttack(
      f.db, attacker, defender, { DART: 5 }, f.clock, undefined, false, 0.25,
    );
    const [row] = await f.db.select().from(missions).where(eq(missions.id, slow.missionId));
    // The round trip at the undiscounted rate: the pace never reaches this figure.
    expect(row?.fuelPaid).toBe(missionFuel({ DART: 5 }, dist, 2));
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
    expect(slow.exposureMinutes).toBeCloseTo(2 * outbound, 6);

    f.clock.set(settledAt(slow.arriveAt));
    await worker.tick();

    const rows = await f.db.select().from(missions).where(eq(missions.kind, 'return'));
    const home = rows[0];
    expect(home).toBeTruthy();
    expect(home?.pace).toBe(0.5);
    expect(minutesBetween(home!.departAt, home!.arriveAt)).toBeCloseTo(outbound, 3);
  });

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
