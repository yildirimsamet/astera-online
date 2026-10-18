import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { accounts, planets, players, shards } from '../src/db/schema.js';
import { runSilentSpaceSweep } from '../src/services/silentSpace.js';
import * as maintenance from '../src/services/silentSpace.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { enqueueReturn } from '../src/services/returnQueue.js';
import { seedWorld, testDb, testEnv } from './helpers.js';

afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await (await testDb()).close(); });

it('keeps only the exact exempt account while an ordinary idle commander still moves', async () => {
  const f = await seedWorld(2); f.clock.advance(48 * 60);
  const before = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const result = await runSilentSpaceSweep(f.db, f.clock, { exemptAccountIds: [f.accountIds[0]!] });
  expect(result.movedOut).toBe(1);
  const review = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  const ordinary = await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!));
  expect(review[0]?.seasonId).toBe(f.seasonId); expect(ordinary[0]?.seasonId).not.toBe(f.seasonId);
  expect(await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!))).toEqual(before);
});

it('does not create a waiting shard just to skip the sole exempt commander', async () => {
  const f = await seedWorld(1); f.clock.advance(48 * 60);
  expect((await runSilentSpaceSweep(f.db, f.clock, { exemptAccountIds: f.accountIds })).movedOut).toBe(0);
  expect(await f.db.select().from(shards).where(eq(shards.role, 'WAITING'))).toHaveLength(0);
});

it('protects the stable identity through a rename while a reused username stays ordinary', async () => {
  const f = await seedWorld(2); f.clock.advance(48 * 60);
  await f.db.update(accounts).set({ username: 'review-name-reused' }).where(eq(accounts.id, f.accountIds[0]!));
  await f.db.update(accounts).set({ username: 'renamed-review' }).where(eq(accounts.id, f.accountIds[0]!));
  await f.db.update(accounts).set({ username: 'review-name-reused' }).where(eq(accounts.id, f.accountIds[1]!));
  expect((await runSilentSpaceSweep(f.db, f.clock, { exemptAccountIds: [f.accountIds[0]!] })).movedOut).toBe(1);
  const [review] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(review?.seasonId).toBe(f.seasonId);
});

it('retains default departures when the allowlist is absent or refers to a missing account', async () => {
  const f = await seedWorld(2); f.clock.advance(48 * 60);
  expect((await runSilentSpaceSweep(f.db, f.clock, { exemptAccountIds: [randomUUID()] })).movedOut).toBe(2);
});

it('allows removal of an exemption without getting stuck behind the departure cursor', async () => {
  const f = await seedWorld(1); f.clock.advance(48 * 60);
  expect((await runSilentSpaceSweep(f.db, f.clock, { exemptAccountIds: f.accountIds })).movedOut).toBe(0);
  f.clock.advance(5);
  expect((await runSilentSpaceSweep(f.db, f.clock)).movedOut).toBe(1);
});

it('does not block returning a review identity that an operator had moved to the waiting room', async () => {
  const f = await seedWorld(1); f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('MOVED');
  await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await runSilentSpaceSweep(f.db, f.clock, { exemptAccountIds: f.accountIds })).returned).toBe(1);
  const [review] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(review?.seasonId).toBe(f.seasonId);
});

it('threads the parsed environment through the real app and worker into maintenance', async () => {
  const f = await seedWorld(0); const id = randomUUID();
  const sweep = vi.spyOn(maintenance, 'runSilentSpaceSweep').mockResolvedValue({ ran: true, checked: 0, movedOut: 0, returned: 0, deferred: {}, failed: 0 });
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ROLE: 'worker', SILENT_SPACE_ENABLED: 'true', SILENT_SPACE_EXEMPT_ACCOUNT_IDS: id }) });
  try {
    await built.app.ready(); await built.worker.tick();
    expect(sweep).toHaveBeenCalledOnce();
    expect(sweep.mock.calls[0]?.[2]).toMatchObject({ exemptAccountIds: [id] });
  } finally { await built.close(); }
});
