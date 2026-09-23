import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, escapeFuel, type Fleet } from '@astera/rules';
import { battleReports, missions, notifications, planets, seasons, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { planetView } from '../src/services/planetView.js';
import { readBattleReports } from '../src/services/reports.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveUnits,
  levelWorld,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * TAKTİK GERİ ÇEKİLME ON THE RAID LANE. Owner decision, 2026-09-23.
 *
 * The rule itself — the ratio, the DECISIVE guard, the fuel gate, the property that
 * running never costs the defender anything — is `packages/rules/test/escape.test.ts`.
 * This file holds what only the server can get wrong: that the ships that ran are
 * still at home afterwards (a battle that never saw them reads their absence as
 * annihilation), that the lift is burned out of the tank before the raider loads, that
 * the report says what happened to each side and no more, and that a running season
 * keeps the rule it was dealt.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/** Fires 9,360. Its lift is 12 deuterium. */
const LINE: Fleet = { DART: 20 };
const LIFT = escapeFuel(LINE);
/** Exactly three times the line, with holds for the loot that do not count toward it. */
const TRIPLE: Fleet = { DART: 60, COURIER: 20 };
const DOUBLE: Fleet = { DART: 40, COURIER: 20 };
const TANK = 1_000;

describe('the fleet escape on a raid', () => {
  let f: Fixture;
  let raider: string;
  let target: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const home = async (planetId: string): Promise<Fleet> => {
    const rows = await f.db.select().from(units)
      .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
    const fleet: Fleet = {};
    for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
    return fleet;
  };

  const tank = async (planetId: string): Promise<number> => {
    const [row] = await f.db.select({ deuterium: planets.deuterium }).from(planets)
      .where(eq(planets.id, planetId));
    return row!.deuterium;
  };

  const raid = async (wing: Fleet) => {
    await giveUnits(f.db, raider, wing);
    const launch = await launchAttack(f.db, raider, target, wing, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report, 'the raid never resolved').toBeDefined();
    return report!;
  };

  const rulesetOf = (version: number) =>
    f.db.update(seasons).set({ rulesetVersion: version }).where(eq(seasons.id, f.seasonId));

  beforeEach(async () => {
    f = await seedWorld(2, 23_092);
    [raider, target] = f.planetIds as [string, string];
    await rulesetOf(MULTI_WORLD.fleetEscapeRulesetVersion);
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, raider);
    /*
      A WORLD WITH NO PLANT KEEPS ITS TANK EXACTLY WHERE IT WAS (`advanceState`), so the
      tank at the fight is the tank set here and the arithmetic below is exact. The
      works hold no deuterium either, so every drop the raider takes comes off the
      stock the lift was burned from.
    */
    await setLevel(f.db, target, 'DEUTERIUM_PLANT', 0);
    await f.db.update(planets)
      .set({ alloy: 20_000, crystal: 8_000, deuterium: TANK, bufferDeuterium: 0 })
      .where(eq(planets.id, target));
    await giveUnits(f.db, target, { ...LINE, PROSPECTOR: 2 });
  });

  it('lifts the ships off a three-to-one raid and leaves every one of them home', async () => {
    const report = await raid(TRIPLE);
    expect(report.fleetEscape).toEqual({ kind: 'ESCAPED', ships: LINE, fuel: LIFT });
    expect(await home(target)).toEqual({ ...LINE, PROSPECTOR: 2 });
    // Nothing stood in the line, so the raid was a walkover and took its share.
    expect(report.grade).toBe('DECISIVE');
    expect(report.defenderLosses).toEqual({});
    expect(report.defenderFleet).toEqual({});
    expect(report.loot.alloy).toBeGreaterThan(0);
  });

  it('burns the lift out of the tank before the raider loads', async () => {
    const report = await raid(TRIPLE);
    expect(await tank(target)).toBeCloseTo(TANK - LIFT - report.loot.deuterium, 6);
  });

  it('strands the fleet when the tank is one drop short, and the fight stands', async () => {
    await f.db.update(planets).set({ deuterium: LIFT - 1 }).where(eq(planets.id, target));
    const report = await raid(TRIPLE);
    expect(report.fleetEscape).toEqual({
      kind: 'STRANDED', ships: LINE, fuel: LIFT, available: LIFT - 1,
    });
    expect(report.defenderLosses).toEqual(LINE);
    expect(await home(target)).toEqual({ PROSPECTOR: 2 });
    // Nothing lifted, so nothing was burned: whatever left the tank left in a hold.
    expect(await tank(target)).toBeCloseTo(LIFT - 1 - report.loot.deuterium, 6);
  });

  it('fights a two-to-one raid exactly as it always did', async () => {
    const report = await raid(DOUBLE);
    expect(report.fleetEscape).toBeNull();
    expect(report.defenderLosses).toEqual(LINE);
    expect(await home(target)).toEqual({ PROSPECTOR: 2 });
  });

  it('keeps a running season on the rule it was dealt', async () => {
    await rulesetOf(MULTI_WORLD.fleetEscapeRulesetVersion - 1);
    const report = await raid(TRIPLE);
    expect(report.fleetEscape).toBeNull();
    expect(report.defenderLosses).toEqual(LINE);
    expect(await tank(target)).toBeCloseTo(TANK - report.loot.deuterium, 6);
  });

  it('leaves the guns to fight the raid alone when the ships run', async () => {
    await giveUnits(f.db, target, { BASTION: 2 });
    const report = await raid({ DART: 100, COURIER: 20 });
    expect(report.fleetEscape).toEqual({ kind: 'ESCAPED', ships: LINE, fuel: LIFT });
    expect(report.defenderFleet).toEqual({ BASTION: 2 });
    expect(report.defenderLosses).toEqual({ BASTION: 2 });
    const after = await home(target);
    expect(after.DART).toBe(LINE.DART);
    expect(after.PROSPECTOR).toBe(2);
  });

  /** The escape as each side's own report reads it; a strategic row has none. */
  const escapeSeenBy = async (playerId: string) => {
    const [view] = (await readBattleReports(f.db, playerId, 5)).reports;
    expect(view && 'fleetEscape' in view, 'no battle report for that commander').toBe(true);
    return view && 'fleetEscape' in view ? view.fleetEscape : undefined;
  };

  it('tells the defender what ran and what it burned, and the raider only that it ran', async () => {
    await raid(TRIPLE);
    expect(await escapeSeenBy(f.playerIds[1]!)).toEqual({ kind: 'ESCAPED', ships: LINE, fuel: LIFT });
    expect(await escapeSeenBy(f.playerIds[0]!)).toEqual({ kind: 'ESCAPED' });
  });

  it('never tells the raider that the tank was dry', async () => {
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, target));
    await raid(TRIPLE);
    expect(await escapeSeenBy(f.playerIds[1]!)).toEqual({
      kind: 'STRANDED', ships: LINE, fuel: LIFT, available: 0,
    });
    expect(await escapeSeenBy(f.playerIds[0]!)).toBeNull();
  });

  const notified = async (missionId: string) => {
    const rows = await f.db.select().from(notifications).where(eq(notifications.refId, missionId));
    return {
      raided: rows.find((row) => row.kind === 'raided')!.payload,
      result: rows.find((row) => row.kind === 'raid_result')!.payload,
    };
  };

  it('says so in both notifications, and the raider hears only that the ships ran', async () => {
    const report = await raid(TRIPLE);
    const { raided, result } = await notified(report.missionId!);
    expect(raided).toMatchObject({ escape: 'ESCAPED', escapeShips: 20 });
    expect(result).toMatchObject({ targetFled: true });
    expect(result).not.toHaveProperty('escapeShips');
  });

  it('tells a stranded defender why, and the raider nothing', async () => {
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, target));
    const report = await raid(TRIPLE);
    const { raided, result } = await notified(report.missionId!);
    expect(raided).toMatchObject({ escape: 'STRANDED', escapeShips: 20 });
    expect(result).not.toHaveProperty('targetFled');
  });

  it('adds nothing to a fight the rule never came into', async () => {
    const report = await raid(DOUBLE);
    const { raided, result } = await notified(report.missionId!);
    expect(raided).not.toHaveProperty('escape');
    expect(result).not.toHaveProperty('targetFled');
  });

  it('tells the planet screen which rule this season was dealt', async () => {
    const view = await f.db.transaction((tx) => planetView(tx, target, f.clock));
    expect(view.rulesetVersion).toBe(MULTI_WORLD.fleetEscapeRulesetVersion);
  });

  it('sends the raider home with what it carried, like any other win', async () => {
    const report = await raid(TRIPLE);
    const [back] = await f.db.select().from(missions)
      .where(and(eq(missions.parentMissionId, report.missionId!), eq(missions.kind, 'return')));
    expect(back?.fleet).toEqual(TRIPLE);
  });
});
