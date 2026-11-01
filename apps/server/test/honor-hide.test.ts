import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { honorSeasons, honorTotals } from '../src/db/schema.js';
import { hideHonorRanking } from '../src/services/honorActivation.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('Honor cannot be switched off', () => {
  it.each([false, true])('rejects the retired hide operation without changing a race (apply: %s)', async apply => {
    const f = await seedWorld(2, 7719);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 1_234_567 });
    const before = await f.db.select().from(honorSeasons);
    await expect(hideHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply }))
      .rejects.toThrow('Honor ranking is permanently active');
    expect(await f.db.select().from(honorSeasons)).toEqual(before);
    expect((await f.db.select().from(honorTotals).where(eq(honorTotals.seasonId, f.seasonId)))[0]?.score).toBe(1_234_567);
  });
});
