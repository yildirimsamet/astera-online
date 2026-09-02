import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { assertSchemaCurrent, pendingMigrations } from '../src/db/migrate.js';
import { EventWorker } from '../src/worker/loop.js';
import { missions, scheduledEvents, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { baysInUse } from '../src/services/flight.js';
import type { Db } from '../src/db/client.js';
import { giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

/**
 * THE OUTAGE THIS FILE EXISTS TO PREVENT. D47.
 *
 * A schema change added a column and generated a migration. The migration was
 * never run against the development database. Everything typechecked, every test
 * passed — the suite migrates its own database on the way in, so it could not
 * see the problem — the server booted cleanly and `/health` said `ok`.
 *
 * Underneath, one insert threw on every worker tick, which meant **no fleet in
 * the galaxy ever landed again**: raids hung over their targets for ever, mining
 * craft never came home, no battle report was written and no debris was left. It
 * ran for an hour before anyone read the log.
 *
 * Two properties keep it from happening again, and both are here: the server
 * REFUSES to run against a database it is ahead of, and a repair that throws
 * cannot take the event queue down with it.
 */

const silent = pino({ level: 'silent' });
const worker = (f: Fixture, db: Db = f.db) =>
  new EventWorker(db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('a database that is behind the build', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2);
  });

  /**
   * The guard must not cry wolf. A migrated database is the normal case and every
   * boot depends on this reading zero.
   */
  it('reports nothing pending once the migrations have run', async () => {
    expect(await pendingMigrations(f.db)).toBe(0);
    await expect(assertSchemaCurrent(f.db)).resolves.toBeUndefined();
  });

  /**
   * And when it IS behind, it refuses — with a message that names the command.
   *
   * The count is faked rather than the database being un-migrated, because
   * rolling a real migration back mid-suite would leave the shared test database
   * broken for every file that runs after this one.
   */
  it('refuses to start, and says how to fix it', async () => {
    const behind = {
      execute: async () => Promise.resolve([{ n: 0 }]),
    } as unknown as Db;

    await expect(assertSchemaCurrent(behind)).rejects.toThrow(/migration\(s\) behind/);
    await expect(assertSchemaCurrent(behind)).rejects.toThrow(/season migrate/);
  });

  /** A database with no migrations table at all is the same failure, not a crash. */
  it('treats a database it cannot read as completely un-migrated', async () => {
    const empty = {
      execute: async () => Promise.reject(new Error('relation does not exist')),
    } as unknown as Db;

    await expect(assertSchemaCurrent(empty)).rejects.toThrow(/migration\(s\) behind/);
  });
});

/**
 * A REPAIR THAT FAILS MUST NOT STOP THE QUEUE. D47.
 *
 * The stranded-flight sweep (D46) runs before events are claimed. Unguarded, one
 * throw inside it means nothing else in the galaxy resolves — which is exactly how
 * a single broken insert became a total outage. Releasing a stranded flight is
 * housekeeping; landing everybody's fleets is the job.
 */
describe('the worker when its housekeeping is broken', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2);
  });

  it('still resolves due events when the stranded sweep throws', async () => {
    const [attacker, defender] = f.planetIds as [string, string];
    await setLevel(f.db, attacker, 'CORE', 6);
    await giveUnits(f.db, attacker, { DART: 20 });
    f.clock.advance(300);
    const launch = await launchAttack(f.db, attacker, defender, { DART: 20 }, f.clock);

    /**
     * A pool that fails exactly the sweep and nothing else.
     *
     * Discriminated on the query itself rather than on call order: `claimDue`
     * reaches for the same `execute`, and failing that too would prove nothing —
     * of course the queue stops if the queue is broken. The sweep is the only
     * caller that reads `missions` or `mining_runs` through raw SQL.
     */
    const mentions = (query: unknown, needle: string): boolean =>
      JSON.stringify((query as { queryChunks?: unknown }).queryChunks ?? '').includes(needle);

    let refused = 0;
    const brittle: Db = new Proxy(f.db, {
      get(target, prop, receiver) {
        if (prop === 'execute') {
          return (query: unknown, ...rest: unknown[]) => {
            if (mentions(query, 'missions m') || mentions(query, 'mining_runs r')) {
              refused += 1;
              throw new Error('housekeeping is broken');
            }
            const real = Reflect.get(target, prop, receiver) as (
              ...a: unknown[]
            ) => unknown;
            return real.call(target, query, ...rest);
          };
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });

    f.clock.set(settledAt(launch.arriveAt));
    const result = await worker(f, brittle).tick();

    expect(refused, 'the sweep was never reached, so nothing was proven').toBeGreaterThan(0);
    expect(result.processed).toBeGreaterThan(0);
    const [after] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(after!.status).toBe('resolved');
  });

  /**
   * And the healthy path still repairs: a flight whose event row has vanished is
   * released, its ships come home, and its bay is freed.
   */
  it('releases a flight whose event row has vanished', async () => {
    const [attacker, defender] = f.planetIds as [string, string];
    await setLevel(f.db, attacker, 'CORE', 6);
    await giveUnits(f.db, attacker, { DART: 20 });
    f.clock.advance(300);
    const launch = await launchAttack(f.db, attacker, defender, { DART: 20 }, f.clock);
    await f.db
      .delete(scheduledEvents)
      .where(
        and(
          eq(scheduledEvents.refId, launch.missionId),
          eq(scheduledEvents.kind, 'mission_arrival'),
        ),
      );

    f.clock.set(new Date(launch.arriveAt.getTime() + 30 * 60_000));
    expect((await worker(f).tick()).abandoned).toBe(1);

    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
    expect(home.find((u) => u.hull === 'DART')?.count).toBe(20);
    expect(await baysInUse(f.db, attacker)).toBe(0);
  });
});
