import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq, sql } from 'drizzle-orm';
import { MULTI_WORLD } from '@astera/rules';
import { botProfiles, players } from '../src/db/schema.js';
import { loadEnv } from '../src/env.js';
import { EventWorker } from '../src/worker/loop.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { BOTS } from '../src/services/bots/personas.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * HOW MANY COMMANDERS A GALAXY SEATS IS THE OPERATOR'S CALL, NOT A REBUILD.
 * Owner, 2026-09-19: fifty to a hundred in a thousand-seat galaxy is the plan, and
 * a local test galaxy may choose a lower ceiling. The default is the address cap.
 */

const silent = pino({ level: 'silent' });
const base = { DATABASE_URL: 'postgres://test' };

afterAll(async () => { await (await testDb()).close(); });

describe('BOTS_PER_GALAXY', () => {
  it('defaults to the roster the code was written for', () => {
    expect(loadEnv(base).BOTS_PER_GALAXY).toBe(BOTS.maxPerGalaxy);
  });

  it('takes any count the galaxy has bot seats for', () => {
    expect(loadEnv({ ...base, BOTS_PER_GALAXY: '100' }).BOTS_PER_GALAXY).toBe(100);
    expect(loadEnv({ ...base, BOTS_PER_GALAXY: '1' }).BOTS_PER_GALAXY).toBe(1);
  });

  it.each(['0', String(MULTI_WORLD.botSlots + 1), '2.5', 'many'])('refuses %s', (value) => {
    expect(() => loadEnv({ ...base, BOTS_PER_GALAXY: value })).toThrow(/BOTS_PER_GALAXY/);
  });
});

describe('seating to the configured roster', () => {
  let f: Fixture;
  const seatedCount = async (): Promise<number> => {
    const [row] = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId));
    return row?.n ?? 0;
  };

  beforeEach(async () => {
    f = await seedWorld(1);
    for (const name of ['Alp', 'Bora', 'Cem', 'Deniz', 'Ege']) await addBot(f.db, name, f.clock);
  });

  it('seats only as many as the operator asked for', async () => {
    expect(await ensureBotSeats(f.db, f.clock, silent, 3)).toBe(2);
    expect(await seatedCount()).toBe(2);
  });

  it('is what the worker passes on', async () => {
    const worker = new EventWorker(
      f.db, f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5, botsEnabled: true, botsPerGalaxy: 2 },
      silent,
    );
    await worker.tick();
    expect(await seatedCount()).toBe(2);
  });
});

/**
 * A HUNDRED BOTS NEED MORE THAN THREE TURNS A MINUTE. Owner report, 2026-09-19:
 * with a full roster each bot waited half an hour for its turn and the disc looked
 * dead. The worker looks every twenty seconds; each look still plays at most
 * `turnsPerSweep`, so no tick blocks longer than it did.
 */
describe('how often the roster is played', () => {
  it('sweeps every twenty seconds, three turns at a time', () => {
    expect(BOTS.sweepEveryMs).toBe(20_000);
    expect(BOTS.turnsPerSweep).toBe(3);
    // Nine turns a minute: a hundred bots on a 7–23 minute gap need about seven.
    const perMinute = (60_000 / BOTS.sweepEveryMs) * BOTS.turnsPerSweep;
    const needed = 100 / ((BOTS.turnGapMinutes.min + BOTS.turnGapMinutes.max) / 2);
    expect(perMinute).toBeGreaterThanOrEqual(needed);
  });
});
