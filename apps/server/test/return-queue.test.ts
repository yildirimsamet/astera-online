import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { players, returnApplications, seasons, shards } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { cancelReturn, enqueueReturn } from '../src/services/returnQueue.js';
import { Presence } from '../src/services/presence.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2);
  const waiting = await createSeason(f.db, {
    shardCode: 'WAIT-QUEUE', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1,
  });
  await f.db.update(shards).set({ role: 'WAITING' }).where(eq(shards.id, waiting.shard.id));
  // Only the commander's placement is needed to test queue persistence.
  await f.db.update(players).set({ seasonId: waiting.season.id });
});
afterAll(async () => { await (await testDb()).close(); });

it('retries and concurrent requests preserve one durable application and sequence', async () => {
  const [a, b] = await Promise.all([
    enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0),
    enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0),
  ]);
  expect(a.id).toBe(b.id);
  expect(a.sequence).toBe(1n);
  expect(await f.db.select().from(returnApplications)).toHaveLength(1);
});

it('cancel and reapply move to the tail without renumbering somebody else', async () => {
  const a = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  const b = await enqueueReturn(f.db, f.accountIds[1]!, f.clock, 0);
  expect((await cancelReturn(f.db, f.accountIds[0]!, a.id, f.clock, 0)).status).toBe('CANCELLED');
  expect((await cancelReturn(f.db, f.accountIds[0]!, a.id, f.clock, 0)).status).toBe('CANCELLED');
  const again = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  expect(again.sequence).toBeGreaterThan(b.sequence);
  expect(again.id).not.toBe(a.id);
});

it('expires the old queue position before accepting a fresh application at 48 hours', async () => {
  const a = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  f.clock.advance(48 * 60);
  const again = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  expect(again.sequence).toBeGreaterThan(a.sequence);
  const [old] = await f.db.select().from(returnApplications).where(eq(returnApplications.id, a.id));
  expect(old?.status).toBe('EXPIRED');
});

it('rejects stale placement and another commander’s cancellation', async () => {
  await expect(enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1)).rejects.toMatchObject({ code: 'PLACEMENT_CHANGED' });
  const a = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  await expect(cancelReturn(f.db, f.accountIds[1]!, a.id, f.clock, 0))
    .rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
});

it('refuses admission at the season deadline even if its status is still live', async () => {
  const [source] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  f.clock.set(source!.endsAt);
  await expect(enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0)).rejects.toMatchObject({ code: 'SEASON_NOT_LIVE' });
});

it.each([47, 48, 49])('presence at hour %s extends only a still-valid application', async (hours) => {
  const a = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  f.clock.advance(hours * 60);
  expect(await new Presence(f.db, f.clock).touch(f.accountIds[0]!)).toBe(true);
  const [row] = await f.db.select().from(returnApplications).where(eq(returnApplications.id, a.id));
  expect(row?.status).toBe(hours < 48 ? 'QUEUED' : 'EXPIRED');
  expect(row?.sequence).toBe(a.sequence);
  if (hours < 48) expect(row?.expiresAt.getTime()).toBe(f.clock.now().getTime() + 48 * 60 * 60_000);
});

it('reports a failed presence transaction and lets the next request retry', async () => {
  const error = new Error('presence database failure');
  const report = vi.fn();
  const presence = new Presence(f.db, f.clock, 60_000, report);
  const transaction = vi.spyOn(f.db, 'transaction').mockRejectedValueOnce(error);
  try {
    expect(await presence.touch(f.accountIds[0]!)).toBe(false);
    expect(report).toHaveBeenCalledWith(error);
    expect(await presence.touch(f.accountIds[0]!)).toBe(true);
  } finally { transaction.mockRestore(); }
});
