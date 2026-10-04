import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, shipHpRepairCost, shipHpRepairMinutes, type HpDamageLot } from '@astera/rules';
import { buildOrders, seasons, shipDamageLots, units } from '../src/db/schema.js';
import { landHpShips, dockLotsOf, dockView } from '../src/services/shipDamage.js';
import { loadLocked, totalUnitsOf } from '../src/services/planet.js';
import { startRepair } from '../src/services/repair.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
const lot = (damageBp = 2000, remainderBp = 0.375): HpDamageLot => ({ hull: 'COURIER', count: 1, damageBp, remainderBp });
const land = (damage: HpDamageLot[]) => f.db.transaction(async (tx) => {
  await loadLocked(tx, f.planetIds[0]!, f.clock);
  return landHpShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    fleet: { COURIER: damage.reduce((n, row) => n + row.count, 0) }, damage, at: f.clock.now() });
});
beforeEach(async () => {
  f = await seedWorld(1, 20_261_003);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion }).where(eq(seasons.id, f.seasonId));
  await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 4);
});
afterAll(async () => { await (await testDb()).close(); });

describe('precise HP landing persistence and normal repairs', () => {
  it('lands exact twenty percent at home and stores the positive fraction above it in the dock', async () => {
    const population = (await totalUnitsOf(f.db, f.planetIds[0]!)).COURIER ?? 0;
    const report = await land([lot(2000, 0), lot()]);
    expect(report.autoRepaired).toEqual([lot(2000, 0)]);
    expect(report.docked).toEqual([lot()]);
    const [stored] = await f.db.select().from(shipDamageLots);
    expect(stored).toMatchObject({ damageBp: 2000, remainderBp: 0.375 });
    const [docked] = await dockLotsOf(f.db, f.planetIds[0]!);
    expect(docked).toMatchObject({ damageBp: 2000, remainderBp: 0.375, count: 1 });
    expect(dockView([docked!], 4, {}).lots[0]?.cost).toEqual(shipHpRepairCost([lot()], 100));
    expect((await totalUnitsOf(f.db, f.planetIds[0]!)).COURIER).toBe(population + 2);
  });

  it('keeps distinct carried fractions apart and preserves a barely surviving ship', async () => {
    const damage = [lot(3000, 0.25), lot(3000, 0.75), lot(9999, 1 - Number.EPSILON)];
    await land(damage);
    const rows = await f.db.select().from(shipDamageLots);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => [row.damageBp, row.remainderBp]).sort()).toEqual(damage.map((row) => [row.damageBp, row.remainderBp]).sort());
  });

  it('enforces the real threshold and rejects malformed fractions in PostgreSQL', async () => {
    const insert = (damageBp: number, remainderBp: number) => f.db.insert(shipDamageLots).values({
      planetId: f.planetIds[0]!, hull: 'COURIER', damageBp, remainderBp, createdAt: f.clock.now(),
    });
    await expect(insert(2000, 0)).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(insert(1999, 0.9)).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(insert(2000, Number.MIN_VALUE)).resolves.toBeDefined();
    for (const fraction of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) await expect(insert(3000, fraction)).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('uses exact fractional cost and duration through the ordinary queued repair, then releases the same ship whole', async () => {
    const wound = lot(5000, 0.5);
    await land([wound]);
    const [docked] = await dockLotsOf(f.db, f.planetIds[0]!);
    await startRepair(f.db, f.planetIds[0]!, { lotIds: [docked!.id] }, f.clock, f.playerIds[0]);
    const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.kind, 'REPAIR'));
    expect(order?.cost).toEqual(shipHpRepairCost([wound], 100));
    expect(order!.readyAt.getTime() - order!.startedAt.getTime()).toBe(Math.ceil(shipHpRepairMinutes([wound], 4, {}, 100) * 60) * 1000);
    const total = await totalUnitsOf(f.db, f.planetIds[0]!);
    f.clock.set(order!.readyAt);
    await f.db.transaction((tx) => applyBuildCompletion(tx, order!.id, order!.readyAt.toISOString(), f.clock));
    expect(await dockLotsOf(f.db, f.planetIds[0]!)).toEqual([]);
    expect(await totalUnitsOf(f.db, f.planetIds[0]!)).toEqual(total);
    const [home] = await f.db.select().from(units).where(and(eq(units.planetId, f.planetIds[0]!), eq(units.location, 'home'), eq(units.hull, 'COURIER')));
    expect(home?.count).toBe(total.COURIER);
  });

  it('rolls the physical landing and its exact health metadata back together', async () => {
    const before = await totalUnitsOf(f.db, f.planetIds[0]!);
    await expect(f.db.transaction(async (tx) => {
      await loadLocked(tx, f.planetIds[0]!, f.clock);
      await landHpShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, fleet: { COURIER: 1 }, damage: [lot()], at: f.clock.now() });
      throw new Error('caller rollback');
    })).rejects.toThrow('caller rollback');
    expect(await totalUnitsOf(f.db, f.planetIds[0]!)).toEqual(before);
    expect(await f.db.select().from(shipDamageLots)).toEqual([]);
  });
});
