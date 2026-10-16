import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { RESEARCH_PROJECTS } from '@astera/rules';
import { planets, researchOrders, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb } from '../src/services/radiationBomb.js';
import { buildDeathStar, buildInterceptor } from '../src/services/strategic.js';
import { planetView } from '../src/services/planetView.js';
import { applyResearchCompletion, completeResearch } from '../src/services/research.js';
import { giveInstrument, giveResearch, giveSatellite, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let home: string;
beforeEach(async () => {
  f = await seedWorld(1);
  home = f.planetIds[0]!;
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() });
  await setLevel(f.db, home, 'CORE', 13);
  await setLevel(f.db, home, 'SHIPYARD', 5);
  await grant(f.db, home, 1000000, 1000000);
  await f.db.update(planets).set({ deuterium: 1000000 }).where(eq(planets.id, home));
});
afterAll(async () => { await (await testDb()).close(); });

it('refuses every strategic weapon below Core 13 without spending resources or occupying stock', async () => {
  await setLevel(f.db, home, 'CORE', 12);
  const [before] = await f.db.select().from(planets).where(eq(planets.id, home));
  await expect(buildDeathStar(f.db, home, f.clock)).rejects.toMatchObject({ code: 'DEATH_STAR_LOCKED' });
  for (const level of [1, 2, 3] as const) {
    await expect(buildRadiationBomb(f.db, home, level, f.clock)).rejects.toMatchObject({ code: 'RADIATION_BOMB_LOCKED' });
  }
  const [after] = await f.db.select().from(planets).where(eq(planets.id, home));
  expect(after).toEqual(before);
  expect(await f.db.select().from(strategicAssets)).toEqual([]);
});

it('allows the Death Star and all independent bomb levels at Core 13', async () => {
  await buildDeathStar(f.db, home, f.clock);
  for (const level of [1, 2, 3] as const) await buildRadiationBomb(f.db, home, level, f.clock);
  expect(await f.db.select().from(strategicAssets)).toHaveLength(4);
});

it.each([[0, 2], [1, 4], [2, 6]] as const)('enforces and publishes %s Grid research → %s total charges', async (level, capacity) => {
  await giveSatellite(f.db, home, 'UPLINK');
  await giveInstrument(f.db, home, 'RADAR', 3);
  if (level > 0) await giveResearch(f.db, home, 'INTERCEPTION_GRID', level);
  for (let i = 0; i < capacity; i++) await buildInterceptor(f.db, home, f.clock);
  await expect(buildInterceptor(f.db, home, f.clock)).rejects.toMatchObject({ code: 'INTERCEPTOR_LOADED' });
  const view = await f.db.transaction(tx => planetView(tx, home, f.clock));
  expect(view.interceptors).toHaveLength(capacity);
  expect(await f.db.select().from(strategicAssets)).toHaveLength(capacity);
});

it('lets an existing Grid level one commander buy level two once, without offering level three', async () => {
  f.clock.advance(RESEARCH_PROJECTS.INTERCEPTION_GRID.availableAtMinutes + 1);
  await giveResearch(f.db, home, 'GRAVITIC_CHARGES', 1);
  await giveResearch(f.db, home, 'INTERCEPTION_GRID', 1);
  await completeResearch(f.db, home, 'INTERCEPTION_GRID', f.clock);
  const [order] = await f.db.select().from(researchOrders);
  expect(order!.level).toBe(2);
  await expect(completeResearch(f.db, home, 'INTERCEPTION_GRID', f.clock)).rejects.toMatchObject({ code: 'RESEARCH_ALREADY_COMPLETE' });
  f.clock.set(order!.readyAt);
  await f.db.transaction(tx => applyResearchCompletion(tx, order!.id, order!.readyAt.toISOString(), f.clock));
  await expect(completeResearch(f.db, home, 'INTERCEPTION_GRID', f.clock)).rejects.toMatchObject({ code: 'RESEARCH_ALREADY_COMPLETE' });
});
