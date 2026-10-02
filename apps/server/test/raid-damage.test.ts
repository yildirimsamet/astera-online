import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, fleetCount, needsDock, type DamageLot, type Fleet } from '@astera/rules';
import { battleReports, missions, notifications, seasons, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { readBattleReports } from '../src/services/reports.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

/**
 * KALICI GEMİ HASARI ON A RAID. Owner decision K1, 2026-09-29 (`plan.md` F3).
 *
 * The defender's part-hit ship is judged the moment the battle ends: at or under the
 * owner's twenty percent it is patched and stays in the line; above it, it steps off
 * into the Repair Station. The attacker's is judged when the wing lands at home. Both
 * are written on the report and told in the bell.
 *
 * The fleets are chosen so the outcome holds across the whole ±8% roll band — the
 * battle is seeded from a random mission id — measured with `resolveCombat` over 1,500
 * seeds: two Darts against one Stronghold leave the Stronghold 49–57% damaged and one
 * Dart 53–78%; one Dart against two Talons leaves a Talon 11–13% damaged.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const ships = (lots: readonly DamageLot[]): number => lots.reduce((sum, lot) => sum + lot.count, 0);

describe('persistent damage on a raid', () => {
  let f: Fixture;
  let raider: string;
  let target: string;

  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const home = async (planetId: string): Promise<Fleet> => {
    const rows = await f.db.select().from(units)
      .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
    const out: Fleet = {};
    for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
    return out;
  };

  const payloadOf = async (playerId: string, kind: 'raided' | 'raid_result' | 'fleet_returned') => {
    const [row] = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, playerId), eq(notifications.kind, kind)));
    expect(row, `no ${kind} notification`).toBeDefined();
    return row!.payload;
  };

  const ruleset = (version: number) =>
    f.db.update(seasons).set({ rulesetVersion: version }).where(eq(seasons.id, f.seasonId));

  /** Launch, fight, and hand back the report and the return leg. */
  const raid = async (wing: Fleet) => {
    await giveUnits(f.db, raider, wing);
    const launch = await launchAttack(f.db, raider, target, wing, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report, 'the raid never resolved').toBeDefined();
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    return { report: report!, back };
  };

  beforeEach(async () => {
    f = await seedWorld(2, 30_930);
    [raider, target] = f.planetIds as [string, string];
    await ruleset(MULTI_WORLD.shipDamageRulesetVersion);
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, raider);
  });

  it('docks the defender\'s badly damaged ship at once and the raider\'s when it lands', async () => {
    await giveUnits(f.db, target, { STRONGHOLD: 1 });
    const { report, back } = await raid({ DART: 2 });

    // The defender: judged on the spot.
    expect(report.defenderDamage).toHaveLength(1);
    const [hit] = report.defenderDamage;
    expect(hit).toMatchObject({ hull: 'STRONGHOLD', count: 1 });
    expect(needsDock(hit!.damageBp)).toBe(true);
    expect((await home(target)).STRONGHOLD ?? 0).toBe(0);
    expect(await dockLotsOf(f.db, target)).toMatchObject([
      { hull: 'STRONGHOLD', count: 1, damageBp: hit!.damageBp, repairing: false },
    ]);
    expect(await payloadOf(f.playerIds[1]!, 'raided')).toMatchObject({ docked: 1 });

    // The raider: carried home as it came out of the fight.
    expect(report.attackerDamage.length).toBeGreaterThan(0);
    for (const lot of report.attackerDamage) expect(needsDock(lot.damageBp)).toBe(true);
    expect(back?.damage).toEqual(report.attackerDamage);
    expect(await payloadOf(f.playerIds[0]!, 'raid_result'))
      .toMatchObject({ damaged: ships(report.attackerDamage) });

    // Each side's report shows its own damage, and only its own.
    const [defenderView] = (await readBattleReports(f.db, f.playerIds[1]!)).reports;
    expect(defenderView).toMatchObject({ yourDamage: report.defenderDamage });
    const [attackerView] = (await readBattleReports(f.db, f.playerIds[0]!)).reports;
    expect(attackerView).toMatchObject({ yourDamage: report.attackerDamage });
    expect(JSON.stringify(attackerView)).not.toContain('STRONGHOLD", "count');
    expect(attackerView).not.toHaveProperty('theirDamage');

    // ...and judged on landing.
    const survivors = fleetCount(back!.fleet);
    f.clock.set(back!.arriveAt);
    await worker().tick();
    const docked = await dockLotsOf(f.db, raider);
    expect(docked.map(({ hull, count, damageBp }) => ({ hull, count, damageBp }))).toEqual(report.attackerDamage);
    expect((await home(raider)).DART ?? 0).toBe(survivors - ships(report.attackerDamage));
    expect(await payloadOf(f.playerIds[0]!, 'fleet_returned'))
      .toMatchObject({ docked: ships(report.attackerDamage) });
  });

  it('patches a lightly damaged defender on the spot and says so', async () => {
    await giveUnits(f.db, target, { TALON: 2 });
    const { report } = await raid({ DART: 1 });

    expect(report.defenderDamage).toHaveLength(1);
    expect(report.defenderDamage[0]).toMatchObject({ hull: 'TALON', count: 1 });
    expect(needsDock(report.defenderDamage[0]!.damageBp)).toBe(false);
    expect((await home(target)).TALON).toBe(2);
    expect(await dockLotsOf(f.db, target)).toEqual([]);
    const raided = await payloadOf(f.playerIds[1]!, 'raided');
    expect(raided).toMatchObject({ autoRepaired: 1 });
    expect(raided).not.toHaveProperty('docked');
  });

  it('leaves a season dealt before the rule exactly as it was', async () => {
    await ruleset(13);
    await giveUnits(f.db, target, { STRONGHOLD: 1 });
    const { report, back } = await raid({ DART: 2 });

    expect(report.defenderDamage).toEqual([]);
    expect(report.attackerDamage).toEqual([]);
    expect((await home(target)).STRONGHOLD).toBe(1);
    expect(await dockLotsOf(f.db, target)).toEqual([]);
    expect(back?.damage ?? null).toBeNull();
    expect(await payloadOf(f.playerIds[1]!, 'raided')).not.toHaveProperty('docked');

    const survivors = fleetCount(back!.fleet);
    f.clock.set(back!.arriveAt);
    await worker().tick();
    expect((await home(raider)).DART).toBe(survivors);
    expect(await dockLotsOf(f.db, raider)).toEqual([]);
  });
});
