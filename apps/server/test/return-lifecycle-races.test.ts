import { setTimeout as delay } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { players, returnApplications, seasons } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { enqueueReturn, refreshReturnActivity } from '../src/services/returnQueue.js';
import { Presence } from '../src/services/presence.js';
import { bootstrapServers, wipeAllServers } from '../src/services/servers.js';
import { seedWorld, testDb, truncateAll } from './helpers.js';
afterAll(async () => { await (await testDb()).close(); });
it('CR: admission checks the deadline after waiting for commander lock', async () => {
  const f = await seedWorld(1);
  const waiting = await createSeason(f.db, { shardCode: 'WAIT-CR', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1, role: 'WAITING' });
  await f.db.update(players).set({ seasonId: waiting.season.id });
  f.clock.set(new Date(waiting.season.endsAt.getTime() - 1_000));
  let action: Promise<unknown> | undefined;
  await f.db.transaction(async (tx) => {
    await tx.select().from(players).where(eq(players.id, f.playerIds[0]!)).for('update');
    const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    action = enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
    let blocked = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const [row] = await tx.execute<{ waiting: boolean }>(sql`select exists (select 1 from pg_stat_activity where ${holder!.pid} = any(pg_blocking_pids(pid))) as waiting`);
      if (row?.waiting) { blocked = true; break; }
      await delay(5);
    }
    expect(blocked).toBe(true);
    f.clock.set(waiting.season.endsAt);
  });
  await expect(action).rejects.toMatchObject({ code: 'SEASON_NOT_LIVE' });
});
it('CR: one bootstrap shares a cycle under a progressing clock', async () => {
  const { db } = await testDb();
  await truncateAll(db);
  let time = Date.UTC(2026, 0, 1);
  await bootstrapServers(db, { now: () => new Date(time += 1_000) }, { count: 2 });
  const rows = await db.select({ cycleId: seasons.cycleId }).from(seasons);
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(row => row.cycleId)).size).toBe(1);
});

it('wipe and presence serialize without a player/application deadlock', async () => {
  const f = await seedWorld(1);
  const waiting = await createSeason(f.db, { shardCode: 'WAIT-CR', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1, role: 'WAITING' });
  await f.db.update(players).set({ seasonId: waiting.season.id });
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  let wipe: ReturnType<typeof wipeAllServers> | undefined;
  const errors: unknown[] = [];
  await f.db.transaction(async (tx) => {
    await tx.select().from(players).where(eq(players.id, f.playerIds[0]!)).for('update');
    const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    wipe = wipeAllServers(f.db, f.clock, { count: 1 });
    void wipe.catch((error: unknown) => { errors.push(error); });
    let blocked = false;
    for (let attempt = 0; attempt < 400; attempt++) {
      const [row] = await tx.execute<{ waiting: boolean }>(sql`select exists (select 1 from pg_stat_activity where ${holder!.pid} = any(pg_blocking_pids(pid))) as waiting`);
      if (row?.waiting) { blocked = true; break; }
      await delay(5);
    }
    expect(blocked).toBe(true);
    await refreshReturnActivity(tx, f.playerIds[0]!, f.clock);
  }).catch((error: unknown) => { errors.push(error); });
  await wipe?.catch(() => undefined);
  expect(errors).toEqual([]);
  const [closed] = await f.db.select().from(returnApplications).where(eq(returnApplications.id, application.id));
  expect(closed?.status).toBe('SEASON_ENDED');
  expect(closed?.playerId).toBeNull();
});

it.each(['presence', 'enqueue'])('%s expires priority when its player lock wait crosses expiry', async (kind) => {
  const f = await seedWorld(1);
  const waiting = await createSeason(f.db, { shardCode: 'WAIT-CR', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1, role: 'WAITING' });
  await f.db.update(players).set({ seasonId: waiting.season.id });
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
  f.clock.set(new Date(application.expiresAt.getTime() - 1_000));
  let action: Promise<unknown> | undefined;
  await f.db.transaction(async (tx) => {
    await tx.select().from(players).where(eq(players.id, f.playerIds[0]!)).for('update');
    const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    action = kind === 'presence' ? new Presence(f.db, f.clock).touch(f.accountIds[0]!) : enqueueReturn(f.db, f.accountIds[0]!, f.clock, 0);
    let blocked = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const [row] = await tx.execute<{ waiting: boolean }>(sql`select exists (select 1 from pg_stat_activity where ${holder!.pid} = any(pg_blocking_pids(pid))) as waiting`);
      if (row?.waiting) { blocked = true; break; }
      await delay(5);
    }
    expect(blocked).toBe(true);
    f.clock.set(application.expiresAt);
  });
  await action;
  const [old] = await f.db.select().from(returnApplications).where(eq(returnApplications.id, application.id));
  expect(old?.status).toBe('EXPIRED');
  const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(player?.lastActiveAt).toEqual(f.clock.now());
});
