import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { honorObservations, monumentBattles, monuments, monumentShipLots, monumentWaves, seasons, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { resolveMonumentArrival } from '../src/services/monumentArrival.js';
import { commitHonor } from '../src/services/honorCommitment.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('settles a delayed battle at its ETA but records current inventory at processing time', async () => {
  const f = await seedWorld(2, 8817);
  const start = f.clock.now();
  const eta = new Date(start.getTime() + 60_000);
  const recent = new Date(start.getTime() + 600_000);
  const processed = new Date(start.getTime() + 1_200_000);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion }).where(eq(seasons.id, f.seasonId));
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: 7270, productionPerMinute: 60, garrison: {}, garrisonTemplate: {},
    controllerPlayerId: f.playerIds[1]!, settledAt: start }).returning();
  const attackId = randomUUID();
  for (const [index, count] of [100, 1].entries()) {
    const id = index === 0 ? attackId : randomUUID();
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target!.id,
      playerId: f.playerIds[index]!, originPlanetId: f.planetIds[index]!, unitLocation: `monument:${id}`,
      purpose: 'ATTACK', sentFleet: { DART: count }, tech: {},
      route: [{ from: { x: 0, y: 0, z: 0 }, to: { x: 6000, y: 0, z: 0 }, startMs: start.getTime(), endMs: eta.getTime() }],
      status: index === 0 ? 'OUTBOUND' : 'HOLD', arriveAt: index === 0 ? eta : null,
      heldAt: index === 0 ? null : start, sentAt: start, radiationSettledAt: start, fuelPaid: 0 });
    await f.db.insert(monumentShipLots).values({ waveId: id, hull: 'DART', count, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(units).values({ planetId: f.planetIds[index]!, ownerPlayerId: f.playerIds[index]!,
      location: `monument:${id}`, hull: 'DART', count });
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[index]!, start));
  }
  await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'MONUMENT', id: attackId,
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: start, adminUsernames: new Set() }));
  // An unrelated inventory change was observed after ETA but before recovery.
  await f.db.insert(units).values({ planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[1]!,
    hull: 'DART', count: 1, location: randomUUID() });
  await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[1]!, recent));
  const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, attackId));
  await f.db.transaction(tx => resolveMonumentArrival(tx, { waveId: attackId, generation: wave!.generation, at: processed }));
  const [battle] = await f.db.select().from(monumentBattles);
  expect(battle?.createdAt).toEqual(eta);
  expect(battle?.defenderSurvivors.DART ?? 0).toBe(0);
  const observations = await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, f.playerIds[1]!));
  expect(observations).toHaveLength(4);
  // Activation records the empty inventory, then the actual wave is added at the same instant.
  expect(observations.map(row => row.at.getTime()).sort()).toEqual([start.getTime(), start.getTime(), recent.getTime(), processed.getTime()]);
  expect(observations.filter(row => row.at.getTime() === start.getTime()).map(row => row.navy).sort((a, b) => a - b)).toEqual([0, 546]);
  const after = observations.find(row => row.at.getTime() === processed.getTime());
  expect(after!.navy).toBeLessThan(observations.find(row => row.at.getTime() === recent.getTime())!.navy);
});
