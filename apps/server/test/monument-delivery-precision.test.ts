import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { planets } from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(1, 20_261_003); });
afterAll(async () => { await (await testDb()).close(); });

describe('delivered monument deuterium precision', () => {
  it('keeps fractional physical cargo when added to a populated home store', async () => {
    await f.db.update(planets).set({ deuterium: 100_000 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.transaction(async (tx) => {
      const [home] = await tx.select().from(planets).where(eq(planets.id, f.planetIds[0]!)).for('update');
      await tx.update(planets).set({ deuterium: home!.deuterium + 0.000125 }).where(eq(planets.id, home!.id));
    });
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.deuterium - 100_000).toBeCloseTo(0.000125, 9);
  });

  it('keeps the same precision if incoming cargo is buffered above the store', async () => {
    await f.db.update(planets).set({ bufferDeuterium: 100_000 + 0.000125 }).where(eq(planets.id, f.planetIds[0]!));
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.bufferDeuterium - 100_000).toBeCloseTo(0.000125, 9);
  });
});
