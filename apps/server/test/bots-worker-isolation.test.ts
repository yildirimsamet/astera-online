import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { scheduledEvents } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { schedule } from '../src/worker/queue.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * HOUSEKEEPING MAY NEVER STOP THE EVENT QUEUE.
 *
 * This project learned it the expensive way: an unguarded stranded-flight repair
 * threw before `claimDue` and turned "one stranded mission" into "no fleet in the
 * galaxy ever lands again", every tick, silently, while `/health` said `ok`. A
 * cosmetic population feature is nowhere near important enough to be the second
 * thing that does it — so the sweep is broken on purpose here and the queue is
 * asked to carry on regardless.
 *
 * ITS OWN FILE, AND THE MOCK IS HOISTED. `vi.mock` at module scope replaces the
 * module for this file alone; doing it with `vi.resetModules()` inside a test
 * instead gives the NEXT test file a second copy of `helpers.ts` — a second
 * connection pool with its own `truncateAll` — which is a hard-to-read way to make
 * an unrelated suite fail on a season that has just been deleted underneath it.
 */
vi.mock('../src/services/bots/sweep.js', () => ({
  runBotSweep: () => Promise.reject(new Error('the roster exploded')),
  ensureBotSeats: () => Promise.resolve(0),
  botStatus: () => Promise.resolve({ seated: 0, awake: 0 }),
}));

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

let f: Fixture;

beforeEach(async () => {
  f = await seedWorld(2);
});

describe('a bot sweep that throws', () => {
  it('never stops the event queue', async () => {
    await schedule(f.db, {
      seasonId: f.seasonId,
      kind: 'asteroid_impact',
      resolveAt: f.clock.now(),
    });
    const worker = new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5, botsEnabled: true },
      silent,
    );

    const result = await worker.tick();
    expect(result.claimed).toBeGreaterThan(0);
    expect(result.botTurns).toBe(0);

    // A season schedules its own moments at creation, so name the one this test put there.
    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, 'asteroid_impact'),
        eq(scheduledEvents.seasonId, f.seasonId),
      ));
    expect(event?.status).toBe('done');
  });
});
