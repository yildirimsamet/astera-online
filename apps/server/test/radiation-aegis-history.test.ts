import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { SHIELD, shieldHp } from '@astera/rules';
import { buildOrders, hpRadiationSources, planetAegisEpochs, planets, seasons } from '../src/db/schema.js';
import { loadLocked, saveResources } from '../src/services/planet.js';
import { projectLateHomeArrival, settlePlanetRadiationAt } from '../src/services/planetRadiation.js';
import { planetView } from '../src/services/planetView.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { giveInstrument, giveUnits, seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each([false, true])('does not rewind the economy when a late Aegis upgrade has no radiation history to block a newer tick (recovering: %s)', async recovering => {
  const f = await seedWorld(1);
  const home = f.planetIds[0]!;
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() });
  await setLevel(f.db, home, 'CORE', 12);
  await giveInstrument(f.db, home, 'AEGIS', 10);
  if (recovering) await f.db.update(planets).set({ recoveryUntil: new Date(f.clock.now().getTime() + 10 * 60000) })
    .where(eq(planets.id, home));
  const readyAt = new Date(f.clock.now().getTime() + 60000);
  const [order] = await f.db.insert(buildOrders).values({ planetId: home, queue: 'CONSTRUCTION', slot: 0,
    kind: 'INSTRUMENT', subject: 'AEGIS', count: 1, startedAt: f.clock.now(), readyAt,
    remainingSeconds: 60, cost: { alloy: 1, crystal: 0, deuterium: 0 } }).returning();
  f.clock.advance(2);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const [before] = await f.db.select().from(planets).where(eq(planets.id, home));
  await f.db.transaction(tx => applyBuildCompletion(tx, order!.id, readyAt.toISOString(), f.clock));
  const [after] = await f.db.select().from(planets).where(eq(planets.id, home));
  expect(after!.lastTickAt).toEqual(before!.lastTickAt);
  expect(after!.bufferAlloy).toBe(before!.bufferAlloy);
  expect(after!.bufferCrystal).toBe(before!.bufferCrystal);
});

it('includes a captured planet’s recovery in the displayed radiation protection return time', async () => {
  const f = await seedWorld(1);
  const home = f.planetIds[0]!;
  const start = f.clock.now().getTime();
  await setLevel(f.db, home, 'CORE', 12);
  await giveInstrument(f.db, home, 'AEGIS', 10);
  await f.db.update(planets).set({ shield: 0, shieldRegenAt: new Date(start + 15 * 60000),
    recoveryUntil: new Date(start + 30 * 60000) }).where(eq(planets.id, home));
  f.clock.advance(5);
  const view = await f.db.transaction(tx => planetView(tx, home, f.clock));
  expect(view.planet.radiationProtectionRestoresAt!.getTime())
    .toBe(start + 30 * 60000 + Math.ceil(3600000 / (shieldHp(10) * SHIELD.regenPerHour)));
});

it('does not move a historical recharge boundary when a late arrival is reconciled after the shield has recharged', async () => {
  const f = await seedWorld(1);
  const home = f.planetIds[0]!;
  const start = f.clock.now().getTime();
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() });
  await setLevel(f.db, home, 'CORE', 12);
  await giveInstrument(f.db, home, 'AEGIS', 10);
  await giveUnits(f.db, home, { CITADEL: 1 });
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, home));
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    x: 0, y: 0, z: 0, radius: 1, mode: 'EMIT', intensityHpPerMinute: 18, activeFrom: f.clock.now() });
  await f.db.transaction(async tx => {
    const world = await loadLocked(tx, home, f.clock);
    await saveResources(tx, home, { alloy: world.alloy, crystal: world.crystal, deuterium: world.deuterium, shield: 0 });
  });
  f.clock.advance(20);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const before = await f.db.select().from(planetAegisEpochs).where(eq(planetAegisEpochs.planetId, home));
  const arrival = new Date(start + 10 * 60000);
  const expected = await f.db.transaction(async tx => {
    const state = await settlePlanetRadiationAt(tx, home, arrival);
    if (!state) throw new Error('Missing radiation state');
    return projectLateHomeArrival(tx, state, { CITADEL: 1 }, [], arrival);
  });
  await f.db.transaction(tx => loadLocked(tx, home, f.clock, { radiationAt: arrival }));
  expect(await f.db.select().from(planetAegisEpochs).where(eq(planetAegisEpochs.planetId, home))).toEqual(before);
  const actual = await f.db.transaction(async tx => {
    const state = await settlePlanetRadiationAt(tx, home, arrival);
    if (!state) throw new Error('Missing radiation state');
    return projectLateHomeArrival(tx, state, { CITADEL: 1 }, [], arrival);
  });
  expect(actual).toEqual(expected);
});
