import { eq } from 'drizzle-orm';
import { alloyRate, crystalRate, neutralReserve, storageCap } from '@astera/rules';
import { afterAll, expect, it } from 'vitest';
import { neutralPlanetState, planets } from '../src/db/schema.js';
import { publicWorlds } from '../src/services/publicGalaxy.js';
import { seedWorld, setLevel, testDb } from './helpers.js';

/**
 * A NEUTRAL WORLD'S RESERVE IS MEASURED AGAINST ITS REAL STORE. Found 2026-11-01.
 *
 * The public reserve (EMPTY / LOW / RICH) divides what a neutral world holds by what
 * its store can hold, and the store grows with the Vault. The galaxy read only the
 * Core, Refinery and Extractor levels, so the Vault always counted as zero. Every
 * neutral world has a level-0 Vault today, which hid it; one with a Vault would read
 * fuller than it is and send raiders at a world that is not worth the trip.
 */
afterAll(async () => { await (await testDb()).close(); });

it('counts the Vault when it says how full a neutral world is', async () => {
  const f = await seedWorld(2);
  const id = f.planetIds[1]!;
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, id));
  await f.db.insert(neutralPlanetState).values({ planetId: id, tier: 2, profileSeed: 5, economyAnchorAt: f.clock.now() });
  for (const [type, level] of [['REFINERY', 8], ['EXTRACTOR', 8], ['VAULT', 6]] as const) await setLevel(f.db, id, type, level);
  const caps = (vault: number) => ({ alloy: storageCap(alloyRate(8), vault), crystal: storageCap(crystalRate(8), vault), deuterium: 0 });
  // Two thirds of the Vault-less store: RICH if the Vault is ignored, LOW once it counts.
  const held = { alloy: Math.floor(caps(0).alloy * 0.65), crystal: Math.floor(caps(0).crystal * 0.65), deuterium: 0 };
  expect(neutralReserve(held, caps(0))).toBe('RICH');
  expect(neutralReserve(held, caps(6))).toBe('LOW');
  await f.db.update(planets).set({ alloy: held.alloy, crystal: held.crystal }).where(eq(planets.id, id));

  const world = (await publicWorlds(f.db, f.seasonId, f.clock.now())).find((row) => row.id === id);
  expect(world?.neutral?.reserve).toBe('LOW');
});
