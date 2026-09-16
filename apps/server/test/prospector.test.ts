import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PROSPECTOR } from '@astera/rules';
import {
  battleReports,
  debrisFields,
  missions,
  planets,
  strategicAssets,
  units,
} from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { loadLocked } from '../src/services/planet.js';
import { launchTransfer } from '../src/services/movement.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveInstrument,
  giveUnits,
  grant,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

/** Every Prospector this planet owns, wherever it currently is. */
async function prospectorsAt(f: Fixture, planetId: string): Promise<number> {
  const rows = await f.db.select().from(units).where(eq(units.planetId, planetId));
  return rows
    .filter((row) => row.hull === 'PROSPECTOR')
    .reduce((sum, row) => sum + row.count, 0);
}

async function homeFleetAt(f: Fixture, planetId: string): Promise<Record<string, number>> {
  const rows = await f.db
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  return Object.fromEntries(rows.map((row) => [row.hull, row.count]));
}

/** Hand a world to another commander without going through settlement or a strike. */
async function handTo(f: Fixture, planetId: string, playerIndex: number): Promise<void> {
  const playerId = f.playerIds[playerIndex]!;
  await f.db
    .update(planets)
    .set({ controllerPlayerId: playerId, kind: 'COLONY' })
    .where(eq(planets.id, planetId));
  await f.db.update(units).set({ ownerPlayerId: playerId }).where(eq(units.planetId, planetId));
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/** A Prospector belongs to its build world and leaves it only on a mining run. */
describe('the Prospector cap', () => {
  let f: Fixture;
  let home: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [home, colony] = f.planetIds as [string, string, string];
    await handTo(f, colony, 0);
    await setLevel(f.db, home, 'CORE', 6);
    await setLevel(f.db, home, 'SHIPYARD', 4);
    await setLevel(f.db, colony, 'CORE', 6);
    await setLevel(f.db, colony, 'SHIPYARD', 4);
    await grant(f.db, home, 200_000, 60_000);
    await grant(f.db, colony, 200_000, 60_000);
    await f.db.delete(units).where(eq(units.planetId, home));
    await f.db.delete(units).where(eq(units.planetId, colony));
  });

  describe('building', () => {
    it('refuses an order that would take a world past the cap', async () => {
      await expect(
        buildUnits(f.db, home, 'PROSPECTOR', PROSPECTOR.max + 1, f.clock),
      ).rejects.toMatchObject({
        code: 'PROSPECTOR_CAP',
        params: { max: PROSPECTOR.max, have: 0 },
      });
    });

    /**
     * The count is keyed on the planet, never on the stack's location. A craft
     * away mining is still a craft this world owns, and a cap a launch could
     * empty is not a cap.
     */
    it('counts craft that are away, not only the ones standing at home', async () => {
      await giveUnits(f.db, home, { PROSPECTOR: PROSPECTOR.max }, 'mine:pretend-run');
      await expect(buildUnits(f.db, home, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
        code: 'PROSPECTOR_CAP',
      });
    });
  });

  describe('planet-to-planet transfer', () => {
    it('rejects a mixed fleet containing a Prospector before reserving craft', async () => {
      await giveUnits(f.db, home, { DART: 1, PROSPECTOR: 1 });
      await expect(launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { DART: 1, PROSPECTOR: 1 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      )).rejects.toMatchObject({ code: 'PROSPECTOR_TRANSFER_FORBIDDEN', status: 400 });

      expect(await prospectorsAt(f, home)).toBe(1);
      expect(await homeFleetAt(f, home)).toMatchObject({ DART: 1, PROSPECTOR: 1 });
      expect(await f.db.select().from(missions)).toHaveLength(0);
    });

    it('still transfers an ordinary fleet', async () => {
      await giveUnits(f.db, home, { DART: 1 });
      const launched = await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { DART: 1 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );
      expect(typeof launched.missionId).toBe('string');
    });

    /** A raid is a separate route and may not carry miners either. */
    it('cannot smuggle one into an attack fleet', async () => {
      await giveUnits(f.db, home, { DART: 5, PROSPECTOR: 1 });
      await expect(
        launchAttack(f.db, home, f.planetIds[2]!, { DART: 5, PROSPECTOR: 1 }, f.clock),
      ).rejects.toMatchObject({ code: 'NOT_A_WARSHIP' });
    });
  });

  /**
   * OVER THE CAP IS A LEGAL STATE, and no rule reaches in and deletes a craft to
   * restore it. A capture hands over whatever was standing there; the world then
   * builds nothing and receives nothing until it is back under the line.
   */
  describe('a world that is already over the line', () => {
    it('keeps the craft a capture handed it', async () => {
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max });
      await f.db.transaction((tx) =>
        transferPlanetControl(tx, {
          targetPlanetId: colony,
          newPlayerId: f.playerIds[1]!,
          expectedControllerPlayerId: f.playerIds[0]!,
          now: f.clock.now(),
          protectedUntil: f.clock.now(),
        }),
      );
      expect(await prospectorsAt(f, colony)).toBe(PROSPECTOR.max);
    });

    it('builds nothing and rejects a transfer without losing existing craft', async () => {
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max + 1 });
      await giveUnits(f.db, home, { DART: 1, PROSPECTOR: 1 });

      await expect(buildUnits(f.db, colony, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
        code: 'PROSPECTOR_CAP',
      });
      await expect(
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { DART: 1, PROSPECTOR: 1 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ).rejects.toMatchObject({ code: 'PROSPECTOR_TRANSFER_FORBIDDEN' });
      expect(await prospectorsAt(f, colony)).toBe(PROSPECTOR.max + 1);
    });
  });
});

/**
 * A PROSPECTOR IS NOT PART OF THE GARRISON. T2.
 *
 * It used to stand in the defending line, which read as "mining is capital parked
 * outdoors" and played as a penalty with no decision attached to it: the owner
 * never chose to commit the craft, and losing both ended mining outright. An
 * ordinary raid now goes straight past them.
 *
 * A DEATH STAR STILL TAKES THEM. That is the whole difference between a raid and
 * a strike, and it is the reason this pair of rules can coexist.
 */
describe('a Prospector does not fight', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [attacker, defender] = f.planetIds as [string, string];
    await setLevel(f.db, attacker, 'CORE', 6);
    await f.db.delete(units).where(eq(units.planetId, attacker));
    await f.db.delete(units).where(eq(units.planetId, defender));
    await grant(f.db, defender, 20_000, 2_000);
  });

  const raid = async (fleet: Record<string, number>) => {
    const launch = await launchAttack(f.db, attacker, defender, fleet, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await workerFor(f).tick();
    const [report] = await f.db
      .select()
      .from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    return report!;
  };

  it('leaves them untouched when the defence is overrun', async () => {
    await giveUnits(f.db, attacker, { DART: 40 });
    await giveUnits(f.db, defender, { DART: 5, PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ DART: 40 });

    expect(report.grade).toBe('DECISIVE');
    const home = await homeFleetAt(f, defender);
    expect(home.PROSPECTOR).toBe(PROSPECTOR.max);
    expect(home.DART).toBe(0);
  });

  it('leaves them untouched when the defence holds', async () => {
    await giveUnits(f.db, attacker, { DART: 2 });
    await giveUnits(f.db, defender, { BASTION: 6, PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ DART: 2 });

    expect(report.grade).toBe('REPELLED');
    // The roster too, not only the survivors: a raid the guns win outright can
    // leave the miners standing for the wrong reason — because nothing ever got
    // through to them — and that would pass whether or not they were in the line.
    expect(report.defenderFleet).toEqual({ BASTION: 6 });
    expect((await homeFleetAt(f, defender)).PROSPECTOR).toBe(PROSPECTOR.max);
  });

  /**
   * A world whose only craft are miners is an undefended world, and the report
   * has to say so — otherwise two mining craft quietly buy a REPELLED and the
   * grade stops meaning what the claim window and the loot table read it as.
   */
  it('leaves a world defended only by miners undefended', async () => {
    await giveUnits(f.db, attacker, { DART: 10, COURIER: 2 });
    await giveUnits(f.db, defender, { PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ DART: 10, COURIER: 2 });

    expect(report.grade).toBe('DECISIVE');
    expect(report.defenderFleet).toEqual({});
    expect(report.defenderLosses).toEqual({});
    expect((await homeFleetAt(f, defender)).PROSPECTOR).toBe(PROSPECTOR.max);
  });

  /**
   * AN AEGIS NEEDS A DEFENDING LINE. D173.
   *
   * This is Yasin's production incident in its smallest server-owned shape: two
   * mining craft were excluded correctly, but the idle shield then manufactured
   * three zero-damage rounds and a REPELLED grade. An unguarded world is a
   * walkover, so its raidable stock must enter the ordinary DECISIVE return leg.
   */
  it('loots a world whose only craft are miners even when its Aegis is charged', async () => {
    await giveUnits(f.db, attacker, { DART: 10, COURIER: 2 });
    await giveUnits(f.db, defender, { PROSPECTOR: PROSPECTOR.max });
    await giveInstrument(f.db, defender, 'AEGIS', 3);
    await f.db.update(planets).set({ shield: 203 }).where(eq(planets.id, defender));

    const launch = await launchAttack(f.db, attacker, defender, { DART: 10, COURIER: 2 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    const before = await f.db.transaction((tx) => loadLocked(tx, defender, f.clock));
    await workerFor(f).tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    if (!report) throw new Error('missing raid report');
    if (!report.missionId) throw new Error('player raid report has no mission');
    const [returning] = await f.db
      .select()
      .from(missions)
      .where(eq(missions.parentMissionId, report.missionId));
    const loot = report.loot.alloy + report.loot.crystal + report.loot.deuterium;

    expect(report.grade).toBe('DECISIVE');
    expect(report.rounds).toEqual([]);
    expect(report.defenderFleet).toEqual({});
    expect(loot).toBeGreaterThan(0);
    expect(returning?.loot).toEqual(report.loot);
    expect((await homeFleetAt(f, defender)).PROSPECTOR).toBe(PROSPECTOR.max);
    expect((await f.db.select().from(planets).where(eq(planets.id, defender)))[0]?.shield).toBe(203);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, defender));
    if (!after || !returning) throw new Error('missing settled world or return');
    for (const [stock, buffer] of [
      ['alloy', 'bufferAlloy'], ['crystal', 'bufferCrystal'], ['deuterium', 'bufferDeuterium'],
    ] as const) {
      expect(before[stock] + before[buffer] - after[stock] - after[buffer])
        .toBeCloseTo(report.loot[stock], 1);
    }
    const [homeBefore] = await f.db.select().from(planets).where(eq(planets.id, attacker));
    if (!homeBefore) throw new Error('missing home');
    f.clock.set(returning.arriveAt);
    await workerFor(f).tick();
    const [homeAfter] = await f.db.select().from(planets).where(eq(planets.id, attacker));
    if (!homeAfter) throw new Error('missing home after return');
    for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(homeAfter[resource] - homeBefore[resource]).toBeCloseTo(report.loot[resource], 1);
    }
    expect(await homeFleetAt(f, attacker)).toMatchObject({ DART: 10, COURIER: 2 });
  });

  /**
   * No death, no wreck. The debris rule takes a share of every non-ground hull
   * destroyed on either side; a craft that never entered the battle contributes
   * nothing to the field, and the raider must not find salvage that nobody lost.
   */
  it('leaves no wreckage behind, because nothing of theirs died', async () => {
    await giveUnits(f.db, attacker, { DART: 10 });
    await giveUnits(f.db, defender, { PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ DART: 10 });

    expect(report.attackerLosses).toEqual({});
    expect(report.wreckValue).toBe(0);
    expect(await f.db.select().from(debrisFields)).toHaveLength(0);
  });

  /**
   * AND KEEPS THEM THROUGH A DEATH STAR TOO, SINCE D179.
   *
   * This test read "still loses them to a Death Star" and was the one place the
   * difference between a raid and a strike was written down: a raid could not
   * reach a miner, a strike could. D179 removed fleet damage from the strike
   * entirely, on the owner's instruction, so there is no longer any way for a
   * craft standing at home to be destroyed without a battle — and the miner is
   * covered by the same sentence as everything else.
   */
  it('keeps them through a Death Star as well', async () => {
    await giveUnits(f.db, defender, { DART: 2, PROSPECTOR: PROSPECTOR.max });
    await setLevel(f.db, defender, 'CORE', 5);
    await f.db.insert(strategicAssets).values({
      planetId: attacker,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const launched = await launchDeathStar(f.db, attacker, defender, f.clock);
    f.clock.set(launched.arriveAt);
    await workerFor(f).tick();

    expect(await prospectorsAt(f, defender)).toBe(PROSPECTOR.max);
    expect(await homeFleetAt(f, defender)).toMatchObject({ DART: 2 });
  });
});
