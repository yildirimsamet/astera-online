import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  HULLS,
  buildingCost,
  groundSlots,
  hangarCapacity,
  hangarCeiling,
  hangarLoad,
  hullBulk,
} from '@astera/rules';
import { buildings, missions, notifications, planets, units } from '../src/db/schema.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { launchTransfer } from '../src/services/movement.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  grant,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

/**
 * A fleet taking exactly `bulk` room: Darts (3) and Ramparts (4) reach every figure
 * from six up, so a test can fill a world to the berth.
 */
const wasps = (bulk: number): Record<string, number> => {
  const dart = hullBulk('DART');
  const rampart = hullBulk('RAMPART');
  for (let darts = 0; darts < rampart; darts++) {
    const rest = bulk - darts * dart;
    if (rest >= 0 && rest % rampart === 0) return { DART: darts, RAMPART: rest / rampart };
  }
  throw new Error(`no exact fill for ${String(bulk)}`);
};

async function fleetAt(f: Fixture, planetId: string): Promise<Record<string, number>> {
  const rows = await f.db.select().from(units).where(eq(units.planetId, planetId));
  const out: Record<string, number> = {};
  for (const row of rows) out[row.hull] = (out[row.hull] ?? 0) + row.count;
  return out;
}

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
 * A FLEET IS BOUNDED BY A BUILDING, NOT BY A PURSE. T4, restored 2026-09-18.
 *
 * D184 removed the Hangar, and commanders held their Core low to stay in the
 * beginners' tier band while printing an unbounded fleet there. The Hangar is back
 * and its rungs open only at the Core levels where a tier changes (4/7/10/13/16),
 * so staying small now also means staying few. Its unit of room is `bulk`.
 *
 * OVERFLOW IS LEGAL, and every test here that could delete a ship asserts that it
 * does not. A world can be handed one over its ceiling by a capture or a battle it
 * survived; the rule is that nothing NEW comes in, never that something already
 * there goes.
 */
describe('the Hangar', () => {
  let f: Fixture;
  let home: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [home, colony] = f.planetIds as [string, string, string];
    await handTo(f, colony, 0);
    for (const id of [home, colony]) {
      await setLevel(f.db, id, 'CORE', 10);
      await setLevel(f.db, id, 'SHIPYARD', 4);
      await grant(f.db, id, 2_000_000, 600_000);
      await f.db.delete(units).where(eq(units.planetId, id));
    }
  });

  it('quotes and charges the Hangar-specific upgrade price', async () => {
    await setLevel(f.db, home, 'HANGAR', 1);
    const before = await f.db.transaction((tx) => planetView(tx, home, f.clock));
    const price = buildingCost('HANGAR', 1);
    expect(before.nextCosts.HANGAR).toEqual(price);

    const [storedBefore] = await f.db.select().from(planets).where(eq(planets.id, home));
    await upgradeBuilding(f.db, home, 'HANGAR', f.clock);
    const [storedAfter] = await f.db.select().from(planets).where(eq(planets.id, home));

    expect(storedBefore!.alloy - storedAfter!.alloy).toBe(price.alloy);
    expect(storedBefore!.crystal - storedAfter!.crystal).toBe(price.crystal);
  });

  describe('building a ship', () => {
    it('refuses the order that would not fit, and names the figures', async () => {
      await setLevel(f.db, home, 'HANGAR', 1);
      const room = hangarCapacity(1);
      await giveUnits(f.db, home, wasps(room));

      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
        params: { capacity: room, used: room },
      });
    });

    it('fills a world to exactly its ceiling and no further', async () => {
      await setLevel(f.db, home, 'HANGAR', 1);
      const room = hangarCapacity(1);
      await giveUnits(f.db, home, wasps(room - hullBulk('DART')));

      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).resolves.toBeTruthy();
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
    });

    it('charges the room the hull actually takes, not one per ship', async () => {
      await setLevel(f.db, home, 'HANGAR', 1);
      const room = hangarCapacity(1);
      await giveUnits(f.db, home, wasps(room - hullBulk('RAMPART')));

      await expect(buildUnits(f.db, home, 'RAMPART', 1, f.clock)).resolves.toBeTruthy();
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
    });

    /**
     * The queue is the state the next order inherits. Two orders that each fit and
     * together do not must be refused on the second, or the ceiling is a suggestion
     * anybody can walk past by tapping twice.
     */
    it('counts what is already in the yard queue', async () => {
      await setLevel(f.db, home, 'HANGAR', 1);
      const room = hangarCapacity(1);
      await giveUnits(f.db, home, wasps(room - 6 * hullBulk('DART')));

      // Four fit and three fit; four and three together do not.
      await expect(buildUnits(f.db, home, 'DART', 4, f.clock)).resolves.toBeTruthy();
      await expect(buildUnits(f.db, home, 'DART', 3, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
    });

    /**
     * A craft away mining or in transit is still a craft this world owns. A ceiling
     * a launch could empty is not a ceiling — the same reasoning `PROSPECTOR.max`
     * carries, and the same reason it is counted over every unit row.
     */
    it('counts craft that are away from home', async () => {
      await setLevel(f.db, home, 'HANGAR', 1);
      await giveUnits(f.db, home, wasps(hangarCapacity(1)), 'mine:pretend-run');

      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
    });

    it('raising the Hangar makes room', async () => {
      await setLevel(f.db, home, 'HANGAR', 1);
      await giveUnits(f.db, home, wasps(hangarCapacity(1)));
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });

      await setLevel(f.db, home, 'HANGAR', 2);
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).resolves.toBeTruthy();
    });

    it('treats a world with no Hangar row as standing at the base rung', async () => {
      await f.db.delete(buildings).where(and(eq(buildings.planetId, home), eq(buildings.type, 'HANGAR')));
      await giveUnits(f.db, home, wasps(hangarCapacity(1)));
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
        params: { capacity: hangarCapacity(1) },
      });
    });
  });

  /**
   * THE CORE OPENS THE RUNGS. Owner design: Hangar 2 at Core 4, 3 at 7, 4 at 10,
   * 5 at 13, 6 at 16 — and a Core-16 world may buy 7 to 10 with resources alone.
   */
  describe('raising the Hangar', () => {
    it('refuses a rung the Core has not opened, and names the Core it needs', async () => {
      await setLevel(f.db, home, 'CORE', 6);
      await setLevel(f.db, home, 'HANGAR', 2);
      await expect(upgradeBuilding(f.db, home, 'HANGAR', f.clock)).rejects.toMatchObject({
        code: 'CORE_CEILING',
        params: { requiredCore: 7 },
      });
    });

    it('allows the rung the moment its Core gate is reached', async () => {
      await setLevel(f.db, home, 'CORE', 7);
      await setLevel(f.db, home, 'HANGAR', 2);
      await expect(upgradeBuilding(f.db, home, 'HANGAR', f.clock)).resolves.toMatchObject({ level: 3 });
    });

    it('lets a Core-16 world buy the rungs past six, and stops at ten', async () => {
      await setLevel(f.db, home, 'CORE', 16);
      await grant(f.db, home, 50_000_000, 20_000_000);
      await setLevel(f.db, home, 'HANGAR', 6);
      await expect(upgradeBuilding(f.db, home, 'HANGAR', f.clock)).resolves.toMatchObject({ level: 7 });

      await setLevel(f.db, home, 'HANGAR', 10);
      await expect(upgradeBuilding(f.db, home, 'HANGAR', f.clock)).rejects.toMatchObject({
        code: 'AT_MAX_LEVEL',
      });
    });

    it('does not let a queued order walk past the gate', async () => {
      await setLevel(f.db, home, 'CORE', 4);
      await setLevel(f.db, home, 'HANGAR', 1);
      expect(hangarCeiling(4)).toBe(2);
      await expect(upgradeBuilding(f.db, home, 'HANGAR', f.clock)).resolves.toMatchObject({ level: 2 });
      await expect(upgradeBuilding(f.db, home, 'HANGAR', f.clock)).rejects.toMatchObject({
        code: 'CORE_CEILING',
      });
    });
  });

  /**
   * TWO POOLS, AND THEY DO NOT TOUCH. T4b.
   *
   * Capping ships without capping guns would put every surplus a commander owns
   * into turrets — a turtle slope the Hangar itself creates. But one shared pool
   * would bind attack and defence to a single slider, and the game wants both
   * decisions. So the Core, which already says how big a world is, opens the
   * emplacements, and the Hangar opens the fleet.
   */
  describe('ground emplacements', () => {
    it('refuses a gun the world has no room to stand', async () => {
      await setLevel(f.db, home, 'CORE', 10);
      const room = groundSlots(10);
      await giveUnits(f.db, home, { THORN: Math.floor(room / hullBulk('THORN')) });

      await expect(buildUnits(f.db, home, 'BASTION', 1, f.clock)).rejects.toMatchObject({
        code: 'GROUND_SLOTS_FULL',
        params: { capacity: room },
      });
    });

    it('raising the Core opens more ground', async () => {
      await setLevel(f.db, home, 'CORE', 6);
      await giveUnits(f.db, home, { THORN: Math.floor(groundSlots(6) / hullBulk('THORN')) });
      await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).rejects.toMatchObject({
        code: 'GROUND_SLOTS_FULL',
      });

      await setLevel(f.db, home, 'CORE', 12);
      await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).resolves.toBeTruthy();
    });

    it('spends neither pool on the other', async () => {
      await setLevel(f.db, home, 'CORE', 10);
      await setLevel(f.db, home, 'HANGAR', 1);
      // A world packed to its hangar ceiling can still raise a gun...
      await giveUnits(f.db, home, wasps(hangarCapacity(1)));
      await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).resolves.toBeTruthy();

      // ...and a world packed with guns can still build a ship, given the room.
      const fresh = f.planetIds[2]!;
      await setLevel(f.db, fresh, 'CORE', 10);
      await setLevel(f.db, fresh, 'SHIPYARD', 4);
      await grant(f.db, fresh, 2_000_000, 600_000);
      await f.db.delete(units).where(eq(units.planetId, fresh));
      await giveUnits(f.db, fresh, { THORN: Math.floor(groundSlots(10) / hullBulk('THORN')) });
      await expect(buildUnits(f.db, fresh, 'DART', 1, f.clock)).resolves.toBeTruthy();
    });
  });

  describe('arriving by transfer', () => {
    it('refuses a launch the destination has no room for', async () => {
      await setLevel(f.db, colony, 'HANGAR', 1);
      await giveUnits(f.db, colony, wasps(hangarCapacity(1)));
      await giveUnits(f.db, home, { DART: 5 });

      await expect(
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { DART: 5 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ).rejects.toMatchObject({ code: 'TARGET_HANGAR_FULL' });
      expect(await f.db.select().from(missions)).toHaveLength(0);
    });

    it('lands a squadron the destination can hold', async () => {
      await setLevel(f.db, colony, 'HANGAR', 1);
      await giveUnits(f.db, home, { DART: 5 });

      const launched = await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { DART: 5 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );
      f.clock.set(launched.arriveAt);
      await workerFor(f).tick();

      expect((await fleetAt(f, colony)).DART).toBe(5);
    });

    /** The far world goes on living while the squadron flies. Nothing is deleted. */
    it('sends home a squadron whose destination filled in the air', async () => {
      await setLevel(f.db, colony, 'HANGAR', 1);
      await giveUnits(f.db, home, { DART: 5 });
      const launched = await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { DART: 5 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );
      await giveUnits(f.db, colony, wasps(hangarCapacity(1)));

      f.clock.set(launched.arriveAt);
      await workerFor(f).tick();
      const [rerouted] = await f.db
        .select()
        .from(missions)
        .where(and(eq(missions.kind, 'transfer'), eq(missions.status, 'in_flight')));
      expect(rerouted?.parentMissionId).toBe(launched.missionId);
      const [notice] = await f.db
        .select()
        .from(notifications)
        .where(eq(notifications.refId, launched.missionId));
      expect(notice).toMatchObject({
        playerId: f.playerIds[0],
        kind: 'fleet_returned',
        payload: {
          trip: 'transfer_rerouted',
          reason: 'CAPACITY',
          targetPlanetId: colony,
        },
      });

      f.clock.set(rerouted!.arriveAt);
      await workerFor(f).tick();
      expect((await fleetAt(f, home)).DART).toBe(5);
      expect(hangarLoad(await fleetAt(f, colony))).toBe(hangarCapacity(1));
    });
  });

  describe('a world already over its ceiling', () => {
    it('keeps everything a capture handed it', async () => {
      await setLevel(f.db, colony, 'HANGAR', 1);
      const over = hangarCapacity(1) + 10;
      await giveUnits(f.db, colony, wasps(over));

      await f.db.transaction((tx) =>
        transferPlanetControl(tx, {
          targetPlanetId: colony,
          newPlayerId: f.playerIds[1]!,
          expectedControllerPlayerId: f.playerIds[0]!,
          now: f.clock.now(),
          protectedUntil: f.clock.now(),
        }),
      );

      expect(hangarLoad(await fleetAt(f, colony))).toBe(over);
    });

    it('builds nothing, receives nothing, and loses nothing', async () => {
      await setLevel(f.db, colony, 'HANGAR', 1);
      const over = hangarCapacity(1) + 10;
      await giveUnits(f.db, colony, wasps(over));
      await giveUnits(f.db, home, { DART: 1 });

      await expect(buildUnits(f.db, colony, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
      await expect(
        launchTransfer(
          f.db,
          f.playerIds[0]!,
          home,
          colony,
          { DART: 1 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          f.clock,
        ),
      ).rejects.toMatchObject({ code: 'TARGET_HANGAR_FULL' });
      expect(hangarLoad(await fleetAt(f, colony))).toBe(over);
    });
  });

  /**
   * The order screen must not offer a ship the server will refuse. `planetView`
   * carries both ceilings and both loads so the client can grey the control out
   * before it is pressed — the same shape the Prospector cap already uses.
   */
  it('reports both ceilings and both loads to the client', async () => {
    await setLevel(f.db, home, 'HANGAR', 2);
    await setLevel(f.db, home, 'CORE', 10);
    await giveUnits(f.db, home, { DART: 7, BASTION: 1 });

    const view = await f.db.transaction((tx) => planetView(tx, home, f.clock));

    expect(view.capacity).toEqual({
      hangar: hangarCapacity(2),
      hangarUsed: hangarLoad({ DART: 7 }),
      hangarCeiling: hangarCeiling(10),
      ground: groundSlots(10),
      groundUsed: hullBulk('BASTION'),
    });
    expect(HULLS.BASTION.ground).toBe(true);
  });
});
