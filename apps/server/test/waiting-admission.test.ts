import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { shards } from '../src/db/schema.js';
import { joinSeason } from '../src/services/player.js';
import { listServers } from '../src/services/servers.js';
import { createSeason } from '../src/services/season.js';
import { makeAccount, seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('never advertises a waiting shard, even with an official ordinal or no MAIN shards', async () => {
  const f = await seedWorld(0);
  await f.db.update(shards).set({ role: 'WAITING' });
  expect(await listServers(f.db, f.clock)).toEqual([]);
});

it('rejects direct new commander admission into a waiting shard', async () => {
  const f = await seedWorld(0);
  const waiting = await createSeason(f.db, {
    shardCode: 'WAIT-ADMISSION', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1,
  });
  await f.db.update(shards).set({ role: 'WAITING' }).where(eq(shards.id, waiting.shard.id));
  const account = await makeAccount(f.db, 'WaitingJoin');
  await expect(joinSeason(f.db, account.id, waiting.season.id, f.clock))
    .rejects.toMatchObject({ code: 'WAITING_JOIN_FORBIDDEN' });
});
