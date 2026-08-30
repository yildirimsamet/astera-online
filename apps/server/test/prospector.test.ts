import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEATH_STAR, PROSPECTOR } from '@astera/rules';
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
import { launchTransfer } from '../src/services/movement.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { EventWorker } from '../src/worker/loop.js';
import {
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

/**
 * THE CAP IS A PROPERTY OF THE WORLD, NOT OF THE BUILD SCREEN. T1.
 *
 * `PROSPECTOR.max` was enforced at one of the four places a craft can arrive, so
 * a player could build two, fly them to a colony and build two more — repeated
 * once per world, and repeated again once the first pair had landed. The cap held
 * on paper and bought nothing.
 *
 * A Prospector cannot travel alone: `fleetSpeed` reads only `MOBILE_HULLS`, so a
 * lone mining craft quotes an infinite trip and is refused as immobile. Every
 * transfer here therefore flies with a warship escort, which is exactly the shape
 * the exploit had.
 */
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

  describe('arriving by transfer', () => {
    it('delivers a squadron the destination can hold', async () => {
      await giveUnits(f.db, home, { WASP: 1, PROSPECTOR: 1 });
      const launched = await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { WASP: 1, PROSPECTOR: 1 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );
      f.clock.set(launched.arriveAt);
      await workerFor(f).tick();

      expect(await prospectorsAt(f, colony)).toBe(1);
      expect(await prospectorsAt(f, home)).toBe(0);
    });

    /**
     * THE EXPLOIT, STATED AS A TEST.
     *
     * Two at home, two at the colony, and the second pair flown across is what
     * made a world hold four. The refusal happens at launch so the player is
     * never charged a flight for craft that could not land.
     */
    it('refuses a launch the destination could not hold', async () => {
      await giveUnits(f.db, home, { WASP: 1, PROSPECTOR: PROSPECTOR.max });
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max });

      await expect(
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { WASP: 1, PROSPECTOR: 1 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ).rejects.toMatchObject({
        code: 'TARGET_PROSPECTOR_CAP',
        params: { max: PROSPECTOR.max, have: PROSPECTOR.max },
      });
      expect(await prospectorsAt(f, home)).toBe(PROSPECTOR.max);
      expect(await f.db.select().from(missions)).toHaveLength(0);
    });

    /**
     * A destination with ROOM FOR ONE and a squadron of two. A guard that only
     * asks "is the target full?" passes this and still lands three craft.
     */
    it('adds the incoming craft to the destination before judging the room', async () => {
      await giveUnits(f.db, home, { WASP: 1, PROSPECTOR: PROSPECTOR.max });
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max - 1 });

      await expect(
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { WASP: 1, PROSPECTOR: PROSPECTOR.max },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ).rejects.toMatchObject({ code: 'TARGET_PROSPECTOR_CAP' });
    });

    /**
     * A transfer takes minutes, and the destination goes on living while it flies.
     * Checking only at launch lands craft on a world that filled up in the
     * meantime — so the arrival checks again, and a squadron with nowhere to land
     * is sent home rather than deleted.
     */
    it('sends home a squadron whose destination filled while it was in the air', async () => {
      await giveUnits(f.db, home, { WASP: 1, PROSPECTOR: PROSPECTOR.max });
      const launched = await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { WASP: 1, PROSPECTOR: PROSPECTOR.max },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max });

      f.clock.set(launched.arriveAt);
      await workerFor(f).tick();

      const [rerouted] = await f.db
        .select()
        .from(missions)
        .where(and(eq(missions.kind, 'transfer'), eq(missions.status, 'in_flight')));
      expect(rerouted?.parentMissionId).toBe(launched.missionId);

      f.clock.set(rerouted!.arriveAt);
      await workerFor(f).tick();

      // Nothing was destroyed by a rule, and nothing landed where it could not fit.
      expect(await prospectorsAt(f, colony)).toBe(PROSPECTOR.max);
      expect(await prospectorsAt(f, home)).toBe(PROSPECTOR.max);
      expect(await homeFleetAt(f, home)).toMatchObject({ WASP: 1 });
    });

    /**
     * The reserved stack stays on the ORIGIN's books for the whole trip. If a fix
     * moved those rows to the destination instead, the origin's quota would empty
     * mid-flight and the exploit would come straight back through the front door.
     */
    it('keeps the origin quota spent while its craft are in the air', async () => {
      await giveUnits(f.db, home, { WASP: 1, PROSPECTOR: PROSPECTOR.max });
      await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { WASP: 1, PROSPECTOR: PROSPECTOR.max },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );

      expect(await prospectorsAt(f, home)).toBe(PROSPECTOR.max);
      await expect(buildUnits(f.db, home, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
        code: 'PROSPECTOR_CAP',
      });
    });

    /**
     * TWO LAUNCHES THAT BOTH SEE THE LAST FREE BERTH.
     *
     * Both are allowed out, and that is deliberate rather than a hole. A launch
     * does not RESERVE a berth — the craft stay booked to the world they left for
     * the whole trip, which is what keeps the origin's own quota spent — so the
     * launch check can only answer for the destination as it stands right now.
     * That makes this exactly the case the arrival check exists for: the world
     * filled up behind them, and the second squadron is sent home rather than
     * squeezed in or deleted.
     *
     * What must hold under the race is the CAP, and that is what is asserted.
     */
    it('lands only what fits when two launches take off at the same instant', async () => {
      await giveUnits(f.db, home, { WASP: 2, PROSPECTOR: PROSPECTOR.max });
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max - 1 });
      const before = (await prospectorsAt(f, home)) + (await prospectorsAt(f, colony));

      const results = await Promise.allSettled([
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { WASP: 1, PROSPECTOR: 1 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { WASP: 1, PROSPECTOR: 1 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ]);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

      // Both arrive; the second finds the berth taken and turns for home.
      f.clock.advance(60);
      await workerFor(f).tick();
      f.clock.advance(60);
      await workerFor(f).tick();

      expect(await prospectorsAt(f, colony)).toBe(PROSPECTOR.max);
      expect((await prospectorsAt(f, home)) + (await prospectorsAt(f, colony))).toBe(before);
    });

    /** The fourth door, and it was already shut. A raid may not carry miners. */
    it('cannot smuggle one into an attack fleet', async () => {
      await giveUnits(f.db, home, { WASP: 5, PROSPECTOR: 1 });
      await expect(
        launchAttack(f.db, home, f.planetIds[2]!, { WASP: 5, PROSPECTOR: 1 }, f.clock),
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

    it('builds nothing and receives nothing, and loses nothing either', async () => {
      await giveUnits(f.db, colony, { PROSPECTOR: PROSPECTOR.max + 1 });
      await giveUnits(f.db, home, { WASP: 1, PROSPECTOR: 1 });

      await expect(buildUnits(f.db, colony, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
        code: 'PROSPECTOR_CAP',
      });
      await expect(
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { WASP: 1, PROSPECTOR: 1 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ).rejects.toMatchObject({ code: 'TARGET_PROSPECTOR_CAP' });
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
    await giveUnits(f.db, attacker, { WASP: 40 });
    await giveUnits(f.db, defender, { WASP: 5, PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ WASP: 40 });

    expect(report.grade).toBe('DECISIVE');
    const home = await homeFleetAt(f, defender);
    expect(home.PROSPECTOR).toBe(PROSPECTOR.max);
    expect(home.WASP).toBe(0);
  });

  it('leaves them untouched when the defence holds', async () => {
    await giveUnits(f.db, attacker, { WASP: 2 });
    await giveUnits(f.db, defender, { BASTION: 6, PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ WASP: 2 });

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
    await giveUnits(f.db, attacker, { WASP: 10, HAULER: 2 });
    await giveUnits(f.db, defender, { PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ WASP: 10, HAULER: 2 });

    expect(report.grade).toBe('DECISIVE');
    expect(report.defenderFleet).toEqual({});
    expect(report.defenderLosses).toEqual({});
    expect((await homeFleetAt(f, defender)).PROSPECTOR).toBe(PROSPECTOR.max);
  });

  /**
   * No death, no wreck. The debris rule takes a share of every non-ground hull
   * destroyed on either side; a craft that never entered the battle contributes
   * nothing to the field, and the raider must not find salvage that nobody lost.
   */
  it('leaves no wreckage behind, because nothing of theirs died', async () => {
    await giveUnits(f.db, attacker, { WASP: 10 });
    await giveUnits(f.db, defender, { PROSPECTOR: PROSPECTOR.max });

    const report = await raid({ WASP: 10 });

    expect(report.attackerLosses).toEqual({});
    expect(report.wreckValue).toBe(0);
    expect(await f.db.select().from(debrisFields)).toHaveLength(0);
  });

  it('still loses them to a Death Star', async () => {
    await giveUnits(f.db, defender, { WASP: 2, PROSPECTOR: PROSPECTOR.max });
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

    expect(await prospectorsAt(f, defender)).toBe(0);
    expect(DEATH_STAR.requiredCore).toBeGreaterThan(0);
  });
});
