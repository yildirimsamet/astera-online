import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  HULLS,
  buildingCost,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
} from '@astera/rules';
import { missions, notifications, planets, units } from '../src/db/schema.js';
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

/** Wasps enough to fill a world to exactly `bulk` — the Wasp is one unit of room. */
const wasps = (bulk: number): Record<string, number> => ({ DART: bulk });

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
 * A FLEET IS BOUNDED BY A BUILDING, NOT BY A PURSE. T4.
 *
 * Nothing stopped a commander turning every resource they owned into hulls, so the
 * only question a rich player ever faced was "how many more can I afford" — the
 * wealth ladder arriving through the shipyard. The Hangar is the answer, and its
 * unit of room is the same `bulk` T6 will charge fuel on: two numbers for one idea
 * drift apart at the first edit.
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

  it('quotes and charges the Hangar-specific double upgrade price', async () => {
    await setLevel(f.db, home, 'HANGAR', 0);
    const before = await f.db.transaction((tx) => planetView(tx, home, f.clock));
    const price = buildingCost('HANGAR', 0);
    expect(before.nextCosts.HANGAR).toEqual(price);

    const [storedBefore] = await f.db.select().from(planets).where(eq(planets.id, home));
    await upgradeBuilding(f.db, home, 'HANGAR', f.clock);
    const [storedAfter] = await f.db.select().from(planets).where(eq(planets.id, home));

    expect(storedBefore!.alloy - storedAfter!.alloy).toBe(price.alloy);
    expect(storedBefore!.crystal - storedAfter!.crystal).toBe(price.crystal);
  });

  describe('building a ship', () => {
    it('refuses the order that would not fit, and names the figures', async () => {
      await setLevel(f.db, home, 'HANGAR', 0);
      const room = hangarCapacity(0);
      await giveUnits(f.db, home, wasps(room));

      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
        params: { capacity: room, used: room },
      });
    });

    it('fills a world to exactly its ceiling and no further', async () => {
      await setLevel(f.db, home, 'HANGAR', 0);
      const room = hangarCapacity(0);
      await giveUnits(f.db, home, wasps(room - 1));

      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).resolves.toBeTruthy();
    });

    it('charges the room the hull actually takes, not one per ship', async () => {
      await setLevel(f.db, home, 'HANGAR', 0);
      const room = hangarCapacity(0);
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
      await setLevel(f.db, home, 'HANGAR', 0);
      const room = hangarCapacity(0);
      await giveUnits(f.db, home, wasps(room - 10));

      await expect(buildUnits(f.db, home, 'DART', 6, f.clock)).resolves.toBeTruthy();
      await expect(buildUnits(f.db, home, 'DART', 6, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
    });

    /**
     * A craft away mining or in transit is still a craft this world owns. A ceiling
     * a launch could empty is not a ceiling — the same reasoning `PROSPECTOR.max`
     * carries, and the same reason it is counted over every unit row.
     */
    it('counts craft that are away from home', async () => {
      await setLevel(f.db, home, 'HANGAR', 0);
      await giveUnits(f.db, home, wasps(hangarCapacity(0)), 'mine:pretend-run');

      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });
    });

    it('raising the Hangar makes room', async () => {
      await setLevel(f.db, home, 'HANGAR', 0);
      await giveUnits(f.db, home, wasps(hangarCapacity(0)));
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).rejects.toMatchObject({
        code: 'HANGAR_FULL',
      });

      await setLevel(f.db, home, 'HANGAR', 1);
      await expect(buildUnits(f.db, home, 'DART', 1, f.clock)).resolves.toBeTruthy();
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
      await setLevel(f.db, home, 'HANGAR', 0);
      // A world packed to its hangar ceiling can still raise a gun...
      await giveUnits(f.db, home, wasps(hangarCapacity(0)));
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
      await setLevel(f.db, colony, 'HANGAR', 0);
      await giveUnits(f.db, colony, wasps(hangarCapacity(0)));
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
      await setLevel(f.db, colony, 'HANGAR', 0);
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
      await setLevel(f.db, colony, 'HANGAR', 0);
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
      await giveUnits(f.db, colony, wasps(hangarCapacity(0)));

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
      expect((await fleetAt(f, colony)).DART).toBe(hangarCapacity(0));
    });
  });

  describe('a world already over its ceiling', () => {
    it('keeps everything a capture handed it', async () => {
      await setLevel(f.db, colony, 'HANGAR', 0);
      const over = hangarCapacity(0) + 10;
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

      expect((await fleetAt(f, colony)).DART).toBe(over);
    });

    it('builds nothing, receives nothing, and loses nothing', async () => {
      await setLevel(f.db, colony, 'HANGAR', 0);
      const over = hangarCapacity(0) + 10;
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
      expect((await fleetAt(f, colony)).DART).toBe(over);
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
      ground: groundSlots(10),
      groundUsed: hullBulk('BASTION'),
    });
    expect(HULLS.BASTION.ground).toBe(true);
  });
});
