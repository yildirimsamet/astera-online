import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { planets } from '../src/db/schema.js';
import { collectWorks, upgradeBuilding } from '../src/services/build.js';
import { publicWorlds } from '../src/services/publicGalaxy.js';
import { seedWorld, setLevel, testDb } from './helpers.js';

/**
 * WHAT THE CLIENT MAY SKIP RE-READING. Query plan, 2026-11-03.
 *
 * The client re-read the whole 193 KB galaxy after every collect and every building
 * order: one galaxy read in five in production. Nothing on the shared disc reads a
 * commander's stores, and an order only joins a queue. A finished Core does move the
 * disc, and `build_complete` is what refreshes it (`event-stream.test.tsx`).
 */
afterAll(async () => { await (await testDb()).close(); });

const rich = async () => {
  const f = await seedWorld(1);
  const id = f.planetIds[0]!;
  await f.db.update(planets).set({ alloy: 900_000, crystal: 900_000, deuterium: 900_000, bufferAlloy: 500, bufferCrystal: 500 })
    .where(eq(planets.id, id));
  await setLevel(f.db, id, 'CORE', 6);
  return { f, id, shown: () => publicWorlds(f.db, f.seasonId, f.clock.now()) };
};

it('leaves the galaxy as it was after a collect', async () => {
  const { f, id, shown } = await rich();
  const before = await shown();
  await collectWorks(f.db, id, f.clock);
  expect(await shown()).toEqual(before);
});

it.each(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'HANGAR'] as const)(
  'leaves the galaxy as it was on queueing a %s upgrade', async (type) => {
    const { f, id, shown } = await rich();
    const before = await shown();
    await upgradeBuilding(f.db, id, type, f.clock);
    expect(await shown()).toEqual(before);
  });

it('shows a finished Core, and no other finished building', async () => {
  const { f, id, shown } = await rich();
  const before = await shown();
  for (const type of ['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'HANGAR', 'DEUTERIUM_PLANT'] as const) await setLevel(f.db, id, type, 9);
  expect(await shown()).toEqual(before);
  await setLevel(f.db, id, 'CORE', 7);
  expect((await shown())[0]?.coreLevel).toBe(7);
});
