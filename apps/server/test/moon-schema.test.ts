import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { moonSeedLedger, moons, planets } from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/*
  F2b (plan §4.1): the moon row and the seed ledger. The database itself refuses what no
  service may ever write, so a bug upstream cannot leave a second moon or a nameless rarity.
*/
describe('the moon tables', () => {
  let f: Fixture;
  const bornAt = new Date('2026-12-27T12:00:00Z');

  beforeEach(async () => { f = await seedWorld(1, 20_021); });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  const moonOf = (planetId: string, overrides: Partial<typeof moons.$inferInsert> = {}) => ({
    planetId, rarity: 'COMMON' as const, origin: 'BUILT' as const, visualSeed: 7, bornAt, ...overrides,
  });

  it('holds one moon a world, fresh and uncracked', async () => {
    const planetId = f.planetIds[0]!;
    await f.db.insert(moons).values(moonOf(planetId));
    const [row] = await f.db.select().from(moons).where(eq(moons.planetId, planetId));
    expect(row).toMatchObject({ rarity: 'COMMON', origin: 'BUILT', cracks: 0, lastHitAt: null,
      closedUntil: null, gateReadyAt: null, bornMissionId: null });
    await expect(f.db.insert(moons).values(moonOf(planetId, { rarity: 'EPIC' }))).rejects.toThrow();
  });

  it('refuses a rarity, an origin or a crack count no rule knows', async () => {
    const planetId = f.planetIds[0]!;
    // @ts-expect-error -- the database must refuse what the type already refuses
    await expect(f.db.insert(moons).values(moonOf(planetId, { rarity: 'MYTHIC' }))).rejects.toThrow();
    // @ts-expect-error -- as above
    await expect(f.db.insert(moons).values(moonOf(planetId, { origin: 'GIFT' }))).rejects.toThrow();
    await expect(f.db.insert(moons).values(moonOf(planetId, { cracks: -1 }))).rejects.toThrow();
  });

  it('goes with the planet row it orbits', async () => {
    const [world] = await f.db.insert(planets).values({
      seasonId: f.seasonId, kind: 'NEUTRAL', slotIndex: 9_901, x: 1, y: 2, z: 3, name: 'Gone',
    }).returning({ id: planets.id });
    await f.db.insert(moons).values(moonOf(world!.id, { origin: 'SEED', rarity: 'RARE' }));
    await f.db.delete(planets).where(eq(planets.id, world!.id));
    expect(await f.db.select().from(moons).where(eq(moons.planetId, world!.id))).toEqual([]);
  });

  it('writes a seeded slot into the ledger only once a season', async () => {
    await f.db.insert(moonSeedLedger).values({ seasonId: f.seasonId, slotIndex: 41 });
    await expect(f.db.insert(moonSeedLedger).values({ seasonId: f.seasonId, slotIndex: 41 })).rejects.toThrow();
    await f.db.insert(moonSeedLedger).values({ seasonId: f.seasonId, slotIndex: 42 });
    expect(await f.db.select().from(moonSeedLedger).where(eq(moonSeedLedger.seasonId, f.seasonId))).toHaveLength(2);
  });
});
