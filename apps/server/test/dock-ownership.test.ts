import { randomUUID } from 'node:crypto';
import { and, eq, like } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, type Fleet, type HullId } from '@astera/rules';
import { buildOrders, planets, seasons, shipDamageLots, units } from '../src/db/schema.js';
import { secedeColony } from '../src/services/loyalty.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { startRepair } from '../src/services/repair.js';
import { dockLotsOf, landShips } from '../src/services/shipDamage.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * THE DOCK BELONGS TO ITS WORLD. Kalıcı gemi hasarı, `plan.md` D7.
 *
 * A damaged ship waiting for repair is standing on the world, so it follows the rule the
 * world's `home` ships follow when the world changes hands: a seceding colony's fleet
 * flies to its commander's capital, a captured colony's standing ships become the
 * captor's. Anything else would strand a lot on a world its owner no longer holds.
 */

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the dock when a colony changes hands', () => {
  let f: Fixture;
  let colony: string;
  let capital: string;
  let owner: string;
  let captor: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [colony, capital] = f.planetIds as [string, string];
    [captor, owner] = f.playerIds as [string, string];
    // The second commander owns the first world as a colony beside their own capital.
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: owner }).where(eq(planets.id, colony));
  });

  const dock = (planetId: string, playerId: string, fleet: Fleet) =>
    f.db.transaction((tx) => landShips(tx, {
      planetId,
      ownerPlayerId: playerId,
      fleet,
      damage: Object.entries(fleet).map(([hull, count]) => ({ hull: hull as HullId, count, damageBp: 6500 })),
      at: f.clock.now(),
    }));

  const dockRows = (planetId: string) =>
    f.db.select().from(units).where(and(eq(units.planetId, planetId), like(units.location, 'dock:%')));

  it('flies a seceding colony\'s docked ships to its commander\'s capital, still theirs', async () => {
    await dock(colony, owner, { BALLISTA: 2 });
    expect(await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()))).toBe(true);

    expect(await dockLotsOf(f.db, colony)).toEqual([]);
    expect(await dockLotsOf(f.db, capital)).toMatchObject([{ hull: 'BALLISTA', count: 2, damageBp: 6500 }]);
    expect(await dockRows(colony)).toEqual([]);
    expect(await dockRows(capital)).toMatchObject([{ hull: 'BALLISTA', count: 2, ownerPlayerId: owner }]);
  });

  /*
    A REPAIR RUNNING ON THE COLONY IS CANCELLED WITH ITS QUEUE, and the lot waits again — tied
    to no order of the world left behind. A link kept to that order would point across worlds,
    and the day the colony's own queue is cleared (a reclaim, a demolition) the delete fails.
  */
  it('lets a lot under repair wait again at the capital, tied to no order of the world left behind', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion })
      .where(eq(seasons.id, f.seasonId));
    await dock(colony, owner, { BALLISTA: 2 });
    await setLevel(f.db, colony, 'SHIPYARD', 4);
    await grant(f.db, colony, 200_000, 100_000);
    await startRepair(f.db, colony, { all: true }, f.clock, owner);
    expect(await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()))).toBe(true);

    const [lot] = await f.db.select().from(shipDamageLots);
    expect(lot).toMatchObject({ planetId: capital, repairOrderId: null });
    expect(await dockLotsOf(f.db, capital)).toMatchObject([{ hull: 'BALLISTA', count: 2, repairing: false }]);
    await expect(f.db.delete(buildOrders).where(eq(buildOrders.planetId, colony))).resolves.toBeDefined();
  });

  it('hands a captured colony\'s docked ships to the captor, exactly as its standing ships', async () => {
    await giveUnits(f.db, colony, { DART: 3 });
    await dock(colony, owner, { BALLISTA: 2 });
    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colony,
      newPlayerId: captor,
      expectedControllerPlayerId: owner,
      now: f.clock.now(),
      protectedUntil: new Date(f.clock.now().getTime() + 60_000),
    }));

    const [standing] = await f.db.select().from(units)
      .where(and(eq(units.planetId, colony), eq(units.location, 'home'), eq(units.hull, 'DART')));
    expect(standing?.ownerPlayerId).toBe(captor);
    expect(await dockRows(colony)).toMatchObject([{ hull: 'BALLISTA', count: 2, ownerPlayerId: captor }]);
    expect(await dockLotsOf(f.db, colony)).toMatchObject([{ hull: 'BALLISTA', count: 2 }]);
  });
});
