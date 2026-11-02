import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { players } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * A WEALTH REFRESH MUST NOT STRENGTHEN ITS OWN LOCK. Production deadlock, 1 and 2 Nov 2026.
 *
 * `POST /api/planets/:id/collect` wrote the commander's Wealth, which takes the row's
 * no-key lock, and the Honor observation then asked for FOR UPDATE on that same row.
 * FOR UPDATE waits for the key-share lock any new row referring to the commander holds;
 * when that other transaction refreshed Wealth in its turn, each waited for the other.
 */
afterAll(async () => { await (await testDb()).close(); });

let f: Fixture;
let id: string;
beforeEach(async () => {
  f = await seedWorld(1, 7720);
  id = f.playerIds[0]!;
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
});

it('observes a commander whose row only a new row refers to', async () => {
  await f.db.transaction(async other => {
    await other.select({ id: players.id }).from(players).where(eq(players.id, id)).for('key share');
    await f.db.transaction(async tx => {
      await tx.execute(sql`set local lock_timeout = '500ms'`);
      await tx.update(players).set({ wealth: 1 }).where(eq(players.id, id));
      await observeHonorOwner(tx, id, f.clock.now());
    });
  });
});

it('still makes two observations of one commander take turns', async () => {
  await f.db.transaction(async first => {
    await observeHonorOwner(first, id, f.clock.now());
    await expect(f.db.transaction(async tx => {
      await tx.execute(sql`set local lock_timeout = '200ms'`);
      await observeHonorOwner(tx, id, f.clock.now());
    })).rejects.toMatchObject({ cause: { code: '55P03' } });
  });
});
