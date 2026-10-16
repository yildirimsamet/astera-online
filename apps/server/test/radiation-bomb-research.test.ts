import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { HULLS } from '@astera/rules';
import { planets, players, researchOrders, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { loadLocked } from '../src/services/planet.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { applyResearchCompletion } from '../src/services/research.js';
import { giveResearch, giveUnits, grant, seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });
async function setup() {
  const f = await seedWorld(2);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  const home = f.planetIds[1]!;
  await giveUnits(f.db, home, { CITADEL: 1 });
  await giveResearch(f.db, home, 'RADIATION_SHIELDING', 1);
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: home }, level: 1, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  const readyAt = new Date(f.clock.now().getTime() + 60000);
  const [order] = await f.db.insert(researchOrders).values({ playerId: f.playerIds[1]!, fundingPlanetId: home,
    projectId: 'RADIATION_SHIELDING', level: 2, slot: 0, startedAt: f.clock.now(), readyAt,
    remainingSeconds: 60, cost: { alloy: 1, crystal: 0, deuterium: 0 } }).returning();
  f.clock.set(new Date(readyAt.getTime() + 60000));
  return { f, home, order: order!, readyAt };
}

it('settles old protection up to research completion and applies new protection only afterwards, even for a late worker', async () => {
  const { f, home, order, readyAt } = await setup();
  await f.db.transaction(tx => applyResearchCompletion(tx, order.id, readyAt.toISOString(), f.clock));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [lot] = (await readHomeHealth(f.db, home)).damage;
  expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo((9 * .84 + 9 * .68) / HULLS.CITADEL.hp * 10000);
});

it('does not let a mutable read pay old protection past an overdue unresolved shielding boundary', async () => {
  const { f, home } = await setup();
  await expect(f.db.transaction(tx => loadLocked(tx, home, f.clock))).rejects.toMatchObject({ code: 'RADIATION_RESEARCH_PENDING' });
});

it('completes an overdue protection order when its commander no longer controls any planet', async () => {
  const { f, home, order, readyAt } = await setup();
  await f.db.update(planets).set({ controllerPlayerId: null, kind: 'NEUTRAL' }).where(eq(planets.id, home));
  await expect(f.db.transaction(tx => applyResearchCompletion(tx, order.id, readyAt.toISOString(), f.clock)))
    .resolves.toEqual({ playerId: f.playerIds[1] });
  const [completed] = await f.db.select().from(researchOrders).where(eq(researchOrders.id, order.id));
  expect(completed?.status).toBe('COMPLETED');
});

it('applies each historical protection interval to a late arrival without repricing its pre-upgrade wound', async () => {
  const { f, home, order, readyAt } = await setup();
  await f.db.transaction(tx => applyResearchCompletion(tx, order.id, readyAt.toISOString(), f.clock));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const arrived = new Date(readyAt.getTime() - 30000);
  const { landHpShips } = await import('../src/services/shipDamage.js');
  await f.db.transaction(tx => landHpShips(tx, { planetId: home, ownerPlayerId: f.playerIds[1]!,
    fleet: { CITADEL: 1 }, damage: [], at: f.clock.now(), radiationAt: arrived }));
  const health = await readHomeHealth(f.db, home);
  const expected = (9 * .84 * .5 + 9 * .68) / HULLS.CITADEL.hp * 10000;
  expect(health.damage.some(lot => Math.abs(lot.damageBp + (lot.remainderBp ?? 0) - expected) < 1e-6)).toBe(true);
});
