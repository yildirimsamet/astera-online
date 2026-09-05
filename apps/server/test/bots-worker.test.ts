import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq, gte, sql } from 'drizzle-orm';
import { SERVERS } from '@astera/rules';
import { botProfiles, players } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { addBot } from '../src/services/bots/roster.js';
import { addMinutes } from '../src/clock.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * THE SWEEP RIDES ON THE WORKER, AND IT MAY NEVER TAKE THE WORKER DOWN.
 *
 * `reclaimIdleSeats` and the stranded-flight repair are both wrapped in their own
 * `try/catch` for a reason this project learned the hard way: a repair that throws
 * before `claimDue` turns "one world could not be reclaimed" into "no fleet in the
 * galaxy ever lands again", every second, silently. A cosmetic population feature
 * is nowhere near important enough to be an exception.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const worker = (f: Fixture, botsEnabled: boolean): EventWorker =>
  new EventWorker(
    f.db,
    f.clock,
    { pollMs: 1000, batch: 100, staleMinutes: 5, botsEnabled },
    silent,
  );

let f: Fixture;

/** 20:00 Türkiye time, when the roster is busy. */
const evening = new Date(Date.UTC(2026, 0, 1, 17, 0));

const onlineCount = async (at: Date): Promise<number> => {
  const [row] = await f.db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    // Through the query builder, never a raw `sql` template: postgres.js cannot
    // bind a JS `Date` as a parameter inside one. A known trap in this codebase.
    .where(gte(players.lastActiveAt, addMinutes(at, -SERVERS.onlineWindowMinutes)));
  return row?.n ?? 0;
};

beforeEach(async () => {
  f = await seedWorld(2);
  f.clock.set(evening);
  for (const name of ['Alp', 'Bora', 'Cem', 'Deniz', 'Ege', 'Ferda']) {
    await addBot(f.db, name, f.clock);
  }
});

describe('bots on the worker tick', () => {
  it('does nothing at all while the feature is off', async () => {
    await worker(f, false).tick();
    const seated = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(seated[0]?.n).toBe(0);
    expect(await onlineCount(evening)).toBe(0);
  });

  it('seats the roster and reports its turns once it is on', async () => {
    const result = await worker(f, true).tick();
    expect(result.botTurns).toBeGreaterThan(0);
    const seated = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(seated[0]?.n).toBe(6);
    expect(await onlineCount(evening)).toBeGreaterThanOrEqual(1);
  });
});
