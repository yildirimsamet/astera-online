import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  MULTI_WORLD,
  fleetCount,
  needsDock,
  piratePosition,
  type DamageLot,
  type Fleet,
} from '@astera/rules';
import {
  battleReports,
  missions,
  neutralPlanetState,
  notifications,
  pirateRaids,
  planets,
  units,
} from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import { openAsteroidHour } from '../src/services/asteroidSpawn.js';
import { launchAttack } from '../src/services/mission.js';
import { loadPirateSnapshot, pirateId } from '../src/services/pirateField.js';
import { launchPirateRaid } from '../src/services/pirateRaid.js';
import { joinSeason } from '../src/services/player.js';
import { createSeason } from '../src/services/season.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, makeAccount, setLevel, settledAt, testDb, truncateAll } from './helpers.js';

/**
 * KALICI GEMİ HASARI AGAINST THE GALAXY'S OWN FORCES. `plan.md` F3 (D1).
 *
 * A caretaker's garrison and a pirate's crew are not anybody's ships: they carry nothing
 * out of a fight. The raider does, exactly as against a commander — the damage rides
 * home and the Repair Station judges it when the wing lands.
 */

const silent = pino({ level: 'silent' });
const worker = (db: Awaited<ReturnType<typeof testDb>>['db'], clock: FixedClock) =>
  new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const ships = (lots: readonly DamageLot[]): number => lots.reduce((sum, lot) => sum + lot.count, 0);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

async function homeOf(db: Awaited<ReturnType<typeof testDb>>['db'], planetId: string): Promise<Fleet> {
  const rows = await db.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  const out: Fleet = {};
  for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
  return out;
}

describe('a raid on a caretaker world', () => {
  /**
   * Two Darts against one Stronghold leave a Dart 53–78% damaged across the whole roll
   * band (measured with `resolveCombat` over 1,500 seeds), so the lot always docks.
   */
  it('brings the raider\'s damage home and leaves the caretaker nothing to carry', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-DMG-N', seed: 91273, startsAt: clock.now(), playerCap: 60,
      rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
    });
    const account = await makeAccount(db, 'Wrecker');
    const joined = await joinSeason(db, account.id, season.id, clock);
    const [target] = await db.select({ id: planets.id }).from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
      .where(eq(neutralPlanetState.tier, 2));
    if (!target) throw new Error('no tier-two caretaker world');
    await db.update(planets).set({ x: 150, y: 0, z: 0, shield: 0 }).where(eq(planets.id, target.id));
    await db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, joined.planetId));
    await db.delete(units).where(eq(units.planetId, target.id));
    await db.insert(units).values({
      planetId: target.id, ownerPlayerId: null, hull: 'STRONGHOLD', location: 'home', count: 1,
    });
    await setLevel(db, joined.planetId, 'CORE', 5);
    await giveUnits(db, joined.planetId, { DART: 2 });
    await fuelUp(db, joined.planetId);

    const launch = await launchAttack(db, joined.planetId, target.id, { DART: 2 }, clock);
    clock.set(settledAt(launch.arriveAt));
    await worker(db, clock).tick();

    const [report] = await db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report?.targetKind).toBe('NEUTRAL');
    expect(report!.defenderDamage).toEqual([]);
    expect(report!.attackerDamage.length).toBeGreaterThan(0);
    for (const lot of report!.attackerDamage) expect(needsDock(lot.damageBp)).toBe(true);
    const [result] = await db.select().from(notifications)
      .where(and(eq(notifications.playerId, joined.playerId), eq(notifications.kind, 'raid_result')));
    expect(result?.payload).toMatchObject({ damaged: ships(report!.attackerDamage) });

    // A caretaker raid's way home carries no parent link; it is the one return this commander has.
    const [back] = await db.select().from(missions)
      .where(and(eq(missions.kind, 'return'), eq(missions.ownerPlayerId, joined.playerId)));
    expect(back?.damage).toEqual(report!.attackerDamage);
    const survivors = fleetCount(back!.fleet);
    clock.set(back!.arriveAt);
    await worker(db, clock).tick();
    const docked = await dockLotsOf(db, joined.planetId);
    expect(docked.map(({ hull, count, damageBp }) => ({ hull, count, damageBp }))).toEqual(report!.attackerDamage);
    expect((await homeOf(db, joined.planetId)).DART ?? 0).toBe(survivors - ships(report!.attackerDamage));
  });
});

describe('a raid on a pirate', () => {
  it('flies the hunters home damaged and judges them on landing', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const start = new Date('2026-09-01T21:00:00.000Z');
    const clock = new FixedClock(new Date(start.getTime() + 5 * 60_000));
    const { season } = await createSeason(db, {
      shardCode: 'EU-DMG-P', seed: 4513, startsAt: start, playerCap: 60,
      rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
    });
    const joined = [];
    for (let i = 0; i < 8; i++) {
      joined.push(await joinSeason(db, (await makeAccount(db, `Hunter${String(i)}`)).id, season.id, clock));
    }
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: start, now: clock.now() });

    // Stand the world beside the first pirate of the hour while it is flying.
    const snapshot = await loadPirateSnapshot(db, season.id, new Date(start.getTime() + 61 * 60_000));
    const spec = snapshot.pirates[0];
    if (!spec) throw new Error('the hour dealt no pirate');
    const minute = Math.ceil(spec.appearsAt) + 2;
    const at = piratePosition(spec, minute);
    const mine = joined[0]!.planetId;
    await db.update(planets).set({ x: at.x + 60, y: at.y, z: at.z }).where(eq(planets.id, mine));
    clock.set(new Date(start.getTime() + minute * 60_000));

    const wing: Fleet = { DART: 60 };
    await grant(db, mine, 200_000, 40_000);
    await giveUnits(db, mine, wing);
    await fuelUp(db, mine);
    const launch = await launchPirateRaid(db, mine, pirateId(snapshot.key, spec.index), wing, clock);
    clock.set(settledAt(launch.arriveAt));
    await worker(db, clock).tick();

    const [report] = await db.select().from(battleReports).where(eq(battleReports.pirateRaidId, launch.raidId));
    expect(report?.targetKind).toBe('PIRATE');
    expect(report!.defenderDamage).toEqual([]);
    const [raid] = await db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(raid!.homeAt, 'the hunters must survive to fly home').not.toBeNull();
    expect(raid!.damage ?? []).toEqual(report!.attackerDamage);
    expect(report!.attackerDamage.length, 'a surviving wing under fire ends on a part-hit ship').toBeGreaterThan(0);

    const before = await homeOf(db, mine);
    const returning = fleetCount(raid!.fleet) - fleetCount(report!.attackerLosses);
    clock.set(raid!.homeAt!);
    await worker(db, clock).tick();

    const toDock = report!.attackerDamage.filter((lot) => needsDock(lot.damageBp));
    const docked = await dockLotsOf(db, mine);
    expect(docked.map(({ hull, count, damageBp }) => ({ hull, count, damageBp }))).toEqual(toDock);
    const after = await homeOf(db, mine);
    const captured = raid!.capturedHull ? 1 : 0;
    expect(fleetCount(after) - fleetCount(before)).toBe(returning - ships(toDock) + captured);
    const [landed] = await db.select().from(notifications)
      .where(and(eq(notifications.playerId, joined[0]!.playerId), eq(notifications.kind, 'fleet_returned')));
    expect(landed?.payload).toMatchObject(toDock.length > 0 ? { docked: ships(toDock) } : {});
  });
});
