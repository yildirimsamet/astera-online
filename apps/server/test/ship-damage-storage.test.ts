import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, like, sql } from 'drizzle-orm';
import { fleetCount, type DamageLot, type Fleet, type HullId } from '@astera/rules';
import { accounts, shipDamageLots, units } from '../src/db/schema.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { awayFleet, totalUnitsOf } from '../src/services/planet.js';
import { planetView } from '../src/services/planetView.js';
import { wipeAllServers } from '../src/services/servers.js';
import { dockDamaged, dockLotsOf, landShips, shipsOfLots } from '../src/services/shipDamage.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { giveUnits, seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * THE REPAIR STATION'S DOCK, IN STORAGE. Kalıcı gemi hasarı, `plan.md` F2.
 *
 * A damaged ship above the owner's twenty percent stands in `units` at `dock:<lot>`,
 * and its lot row says how damaged it is. `units` stays the only record of how many
 * ships exist: a landing or a battle moves ships between locations and never makes or
 * loses one. Everything that deletes a world in bulk must know the new table, or a
 * galaxy with a single docked ship could never be wiped again.
 */

const lot = (hull: HullId, count: number, damageBp: number): DamageLot => ({ hull, count, damageBp });

describe('the Repair Station dock', () => {
  let f: Fixture;
  let planetId: string;
  let playerId: string;

  beforeEach(async () => {
    f = await seedWorld(2, 7717);
    planetId = f.planetIds[0]!;
    playerId = f.playerIds[0]!;
  });

  afterAll(async () => {
    const { close } = await testDb();
    await close();
  });

  const home = async (): Promise<Fleet> => {
    const rows = await f.db.select().from(units)
      .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
    const out: Fleet = {};
    for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
    return out;
  };

  it('holds only ships above the free-repair line and short of destruction', async () => {
    const insert = (damageBp: number) => f.db.insert(shipDamageLots)
      .values({ planetId, hull: 'BALLISTA', damageBp, createdAt: f.clock.now() });
    await expect(insert(2000)).rejects.toThrow();
    await expect(insert(10_000)).rejects.toThrow();
    await expect(insert(2001)).resolves.toBeDefined();
    await expect(insert(9999)).resolves.toBeDefined();
  });

  it('lands a fleet: the patched go home, the damaged go to the dock, none made or lost', async () => {
    const before = await totalUnitsOf(f.db, planetId);
    const homeBefore = (await home()).BALLISTA ?? 0;

    const report = await f.db.transaction((tx) => landShips(tx, {
      planetId,
      ownerPlayerId: playerId,
      at: f.clock.now(),
      fleet: { BALLISTA: 10 },
      damage: [lot('BALLISTA', 1, 2000), lot('BALLISTA', 2, 2001)],
    }));

    expect(report.autoRepaired).toEqual([lot('BALLISTA', 1, 2000)]);
    expect(report.docked).toEqual([lot('BALLISTA', 2, 2001)]);
    expect((await home()).BALLISTA).toBe(homeBefore + 8);
    const docked = await dockLotsOf(f.db, planetId);
    expect(docked).toHaveLength(1);
    expect(docked[0]).toMatchObject({ hull: 'BALLISTA', count: 2, damageBp: 2001, repairing: false });
    const [row] = await f.db.select().from(units)
      .where(and(eq(units.planetId, planetId), eq(units.location, `dock:${docked[0]!.id}`)));
    expect(row).toMatchObject({ hull: 'BALLISTA', count: 2, ownerPlayerId: playerId });
    expect(fleetCount(await totalUnitsOf(f.db, planetId))).toBe(fleetCount(before) + 10);
  });

  it('lands an undamaged fleet exactly as a landing always did', async () => {
    const homeBefore = await home();
    const report = await f.db.transaction((tx) => landShips(tx, {
      planetId, ownerPlayerId: playerId, at: f.clock.now(), fleet: { PIKE: 4, DART: 2 }, damage: null,
    }));
    expect(report).toEqual({ autoRepaired: [], docked: [] });
    expect(await home()).toEqual({
      ...homeBefore,
      PIKE: (homeBefore.PIKE ?? 0) + 4,
      DART: (homeBefore.DART ?? 0) + 2,
    });
    expect(await dockLotsOf(f.db, planetId)).toEqual([]);
  });

  it('keeps two landings apart even when their damage is the same', async () => {
    for (let i = 0; i < 2; i++) {
      await f.db.transaction((tx) => landShips(tx, {
        planetId, ownerPlayerId: playerId, at: f.clock.now(), fleet: { TALON: 1 }, damage: [lot('TALON', 1, 5000)],
      }));
    }
    const docked = await dockLotsOf(f.db, planetId);
    expect(docked.map((row) => [row.hull, row.count, row.damageBp])).toEqual([
      ['TALON', 1, 5000],
      ['TALON', 1, 5000],
    ]);
  });

  it('moves a defender\'s badly damaged ships off the line and leaves the lightly hit at home', async () => {
    await giveUnits(f.db, planetId, { TALON: 5 });
    const report = await f.db.transaction((tx) => dockDamaged(tx, {
      planetId, ownerPlayerId: playerId, at: f.clock.now(), lots: [lot('TALON', 1, 6400), lot('TALON', 1, 1500)],
    }));
    expect(report.autoRepaired).toEqual([lot('TALON', 1, 1500)]);
    expect(report.docked).toEqual([lot('TALON', 1, 6400)]);
    expect((await home()).TALON).toBe(4);
    expect(shipsOfLots(await dockLotsOf(f.db, planetId))).toEqual({ TALON: 1 });
  });

  it('refuses to dock ships the world does not have at home', async () => {
    await giveUnits(f.db, planetId, { TALON: 1 });
    await expect(f.db.transaction((tx) => dockDamaged(tx, {
      planetId, ownerPlayerId: playerId, at: f.clock.now(), lots: [lot('TALON', 2, 6400)],
    }))).rejects.toThrow(RangeError);
    expect((await home()).TALON).toBe(1);
  });

  it('counts docked ships as owned, never as away', async () => {
    await f.db.transaction((tx) => landShips(tx, {
      planetId, ownerPlayerId: playerId, at: f.clock.now(), fleet: { VIPER: 3 }, damage: [lot('VIPER', 3, 7000)],
    }));
    expect(await awayFleet(f.db, planetId)).toEqual({});
    expect(shipsOfLots(await dockLotsOf(f.db, planetId))).toEqual({ VIPER: 3 });
    expect((await totalUnitsOf(f.db, planetId)).VIPER).toBe(3);
    const view = await f.db.transaction((tx) => planetView(tx, planetId, f.clock));
    expect(view.fleetDocked).toEqual({ VIPER: 3 });
    expect(view.fleetAway).toEqual({});
  });

  /** A docked lot tied to a running repair order: every foreign key the dock adds. */
  const dockWithOrder = async () => {
    await f.db.transaction((tx) => landShips(tx, {
      planetId, ownerPlayerId: playerId, at: f.clock.now(), fleet: { BALLISTA: 2 }, damage: [lot('BALLISTA', 2, 6000)],
    }));
    // Raw on purpose: the REPAIR queue reaches the TypeScript types with the Repair Station (F4).
    const inserted = await f.db.execute<{ id: string }>(sql`
      insert into build_orders
        (planet_id, queue, slot, kind, subject, count, status, started_at, ready_at, remaining_seconds, cost)
      values (${planetId}, 'REPAIR', 0, 'REPAIR', 'BALLISTA', 2, 'BUILDING',
        ${f.clock.now().toISOString()}, ${new Date(f.clock.now().getTime() + 60_000).toISOString()}, 60,
        '{"alloy":1,"crystal":1,"deuterium":0}'::jsonb)
      returning id`);
    await f.db.update(shipDamageLots).set({ repairOrderId: inserted[0]!.id })
      .where(eq(shipDamageLots.planetId, planetId));
    expect((await dockLotsOf(f.db, planetId))[0]?.repairing).toBe(true);
  };

  it('lets a galaxy be wiped with ships in the dock and a repair running', async () => {
    await dockWithOrder();
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 4 });
    expect(await f.db.select().from(shipDamageLots)).toEqual([]);
    expect(await f.db.select().from(units).where(like(units.location, 'dock:%'))).toEqual([]);
  });

  it('lets a commander be deleted with ships in the dock and a repair running', async () => {
    await dockWithOrder();
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));
    await deleteAccount(f.db, f.clock, account!.username);
    expect(await f.db.select().from(shipDamageLots)).toEqual([]);
    expect(await f.db.select().from(units).where(eq(units.planetId, planetId))).toEqual([]);
  });
});
