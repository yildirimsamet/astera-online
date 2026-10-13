import { setTimeout as delay } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { players } from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { seedWorld, testDb } from './helpers.js';

/**
 * A RELOCATION WAITS BRIEFLY FOR IN-FLIGHT WRITES INSTEAD OF GIVING UP AT ONCE.
 * Resource analysis follow-up 2026-10-14.
 *
 * The transfer took its galaxy's placement fence with `pg_try_advisory_xact_lock`, so
 * any authenticated request holding the shared side at that instant deferred the
 * move to the next five-minute sweep (`CONTENTION`, still seen in production after
 * the read routes stopped leasing). It now waits inside its own `lock_timeout`
 * (150 ms): a write that finishes in time lets the move through, a longer one still
 * defers — bounded, never stuck.
 */
afterAll(async () => { await (await testDb()).close(); });

async function idleCommander() {
  const f = await seedWorld(2);
  f.clock.advance(48 * 60);
  await f.db.update(players).set({ lastProgressAt: f.clock.now() }).where(eq(players.id, f.playerIds[1]!));
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  if (!target) throw new Error('no waiting galaxy');
  return { f, target };
}

/** An authenticated write in flight: the shared side of the galaxy's placement fence. */
async function holdLease(db: Awaited<ReturnType<typeof seedWorld>>['db'], seasonId: string, ms: number) {
  let held = () => { /* replaced below */ };
  const acquired = new Promise<void>(resolve => { held = resolve; });
  const done = db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${`placement:${seasonId}`}, 0))`);
    held();
    await delay(ms);
  });
  await acquired;
  return done;
}

it('moves once a write holding the placement fence finishes within the wait', async () => {
  const { f, target } = await idleCommander();
  const lease = holdLease(f.db, f.seasonId, 60);
  const result = await transferCommander(f.db, f.playerIds[0]!, target.id, f.clock);
  await lease;
  expect(result.status).toBe('MOVED');
});

it('still defers, without hanging, when the fence stays held past the wait', async () => {
  const { f, target } = await idleCommander();
  const lease = holdLease(f.db, f.seasonId, 1_500);
  const started = Date.now();
  const result = await transferCommander(f.db, f.playerIds[0]!, target.id, f.clock);
  const waited = Date.now() - started;
  await lease;
  expect(result.status).toBe('CONTENTION');
  expect(waited).toBeLessThan(1_000);
  const [player] = await f.db.select({ seasonId: players.seasonId, version: players.placementVersion })
    .from(players).where(eq(players.id, f.playerIds[0]!));
  expect(player).toEqual({ seasonId: f.seasonId, version: 0 });
});
