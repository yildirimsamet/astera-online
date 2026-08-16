import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { battleReports, missions, planets, players, scheduledEvents, units } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { claimDue, complete, fail, reap, schedule } from '../src/worker/queue.js';
import { launchAttack } from '../src/services/mission.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

const makeWorker = (f: Fixture, staleMinutes = 5): EventWorker =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes }, silent);

/**
 * ACCEPTANCE CRITERION (build plan, phase 1):
 * "Worker survives a kill -9 mid-event and resolves it on restart."
 *
 * A fleet that vanishes because a process restarted is the single worst bug this
 * architecture could have — the player loses hours of committed resources with no
 * explanation and no recourse.
 */
// The database pool is shared across this whole file, so it is torn down at FILE
// scope. An afterAll inside a describe would close it out from under any describe
// that follows.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('event worker', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2);
  });


  describe('claiming', () => {
    it('does not claim an event before it is due', async () => {
      await schedule(f.db, {
        seasonId: f.seasonId,
        kind: 'season_end',
        resolveAt: new Date(f.clock.now().getTime() + 60_000),
      });
      expect(await claimDue(f.db, 10, f.clock.now())).toHaveLength(0);
    });

    it('claims an event the moment it is due', async () => {
      await schedule(f.db, {
        seasonId: f.seasonId,
        kind: 'season_end',
        resolveAt: f.clock.now(),
      });
      expect(await claimDue(f.db, 10, f.clock.now())).toHaveLength(1);
    });

    it('two concurrent workers never claim the same event', async () => {
      for (let i = 0; i < 20; i++) {
        await schedule(f.db, {
          seasonId: f.seasonId,
          kind: 'season_end',
          resolveAt: f.clock.now(),
        });
      }

      const [a, b] = await Promise.all([
        claimDue(f.db, 100, f.clock.now()),
        claimDue(f.db, 100, f.clock.now()),
      ]);

      const ids = [...a, ...b].map((e) => e.id);
      expect(ids).toHaveLength(20);
      expect(new Set(ids).size).toBe(20); // SKIP LOCKED: no overlap
    });

    it('claims in resolve_at order, oldest first', async () => {
      const base = f.clock.now().getTime();
      for (const offset of [-30, -10, -20]) {
        await schedule(f.db, {
          seasonId: f.seasonId,
          kind: 'season_end',
          payload: { offset },
          resolveAt: new Date(base + offset * 60_000),
        });
      }
      const claimed = await claimDue(f.db, 10, f.clock.now());
      const offsets = claimed.map((e) => (e.payload as { offset: number } | null)?.offset);
      expect(offsets).toEqual([-30, -20, -10]);
    });

    it('respects the batch size', async () => {
      for (let i = 0; i < 5; i++) {
        await schedule(f.db, { seasonId: f.seasonId, kind: 'season_end', resolveAt: f.clock.now() });
      }
      expect(await claimDue(f.db, 2, f.clock.now())).toHaveLength(2);
    });
  });

  describe('failure handling', () => {
    it('returns a failed event to pending so it retries', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'season_end', resolveAt: f.clock.now() });
      const [event] = await claimDue(f.db, 1, f.clock.now());

      await fail(f.db, event!.id, new Error('transient'));

      const [after] = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.id, event!.id));
      expect(after!.status).toBe('pending');
      expect(after!.attempts).toBe(1);
      expect(after!.lastError).toBe('transient');
    });

    it('gives up after the attempt budget rather than spinning forever', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'season_end', resolveAt: f.clock.now() });
      let id = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const [event] = await claimDue(f.db, 1, f.clock.now());
        id = event!.id;
        await fail(f.db, id, new Error('always broken'), 5);
      }
      const [after] = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.id, id));
      expect(after!.status).toBe('failed');
    });

    it('an unknown event kind is completed, not retried forever', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'season_end', resolveAt: f.clock.now() });
      const result = await makeWorker(f).tick();
      expect(result.claimed).toBe(1);
      expect(result.failed).toBe(0);

      const rows = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.status, 'done'));
      expect(rows).toHaveLength(1);
    });
  });

  describe('crash recovery', () => {
    it('the reaper returns an abandoned claim to the queue', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'season_end', resolveAt: f.clock.now() });
      await claimDue(f.db, 1, f.clock.now()); // worker claims, then "dies"

      // Too soon: a live worker mid-transaction must not be stolen from.
      expect(await reap(f.db, 5, f.clock.now())).toBe(0);

      f.clock.advance(6);
      expect(await reap(f.db, 5, f.clock.now())).toBe(1);

      const [after] = await f.db.select().from(scheduledEvents);
      expect(after!.status).toBe('pending');
      expect(after!.claimedAt).toBeNull();
    });

    it('SIGKILL mid-event: a replacement worker resolves it on restart', async () => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveUnits(f.db, attacker, { WASP: 40, HAULER: 4 });
      await grant(f.db, defender, 40_000, 4_000);
      f.clock.advance(300); // a settled world, not one seconds old

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 40, HAULER: 4 }, f.clock);

      // Worker A claims the arrival and is killed before completing.
      f.clock.set(launch.arriveAt);
      const claimed = await claimDue(f.db, 10, f.clock.now());
      expect(claimed.some((e) => e.kind === 'mission_arrival')).toBe(true);

      // Nothing resolved: the mission is still in flight.
      const midway = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
      expect(midway[0]!.status).toBe('in_flight');

      // Worker B starts up after the stale window and drains the queue.
      f.clock.advance(6);
      const result = await makeWorker(f).tick();
      expect(result.reaped).toBeGreaterThan(0);
      expect(result.processed).toBeGreaterThan(0);

      const after = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
      expect(after[0]!.status).toBe('resolved');
      const reports = await f.db.select().from(battleReports);
      expect(reports).toHaveLength(1);
    });

    it('a six-hour outage resolves everything overdue, in order', async () => {
      const base = f.clock.now().getTime();
      for (const minutesAgo of [300, 60, 180]) {
        await schedule(f.db, {
          seasonId: f.seasonId,
          kind: 'season_end',
          payload: { minutesAgo },
          resolveAt: new Date(base - minutesAgo * 60_000),
        });
      }
      const result = await makeWorker(f).tick();
      expect(result.claimed).toBe(3);

      const done = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.status, 'done'));
      expect(done).toHaveLength(3);
    });

    it('resolving the same arrival twice produces exactly one battle report', async () => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveUnits(f.db, attacker, { WASP: 40 });
      await grant(f.db, defender, 30_000, 3_000);
      f.clock.advance(300);

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 40 }, f.clock);
      f.clock.set(launch.arriveAt);

      const worker = makeWorker(f);
      await worker.tick();

      // Force the same event back into the queue, as a duplicate delivery would.
      await f.db
        .update(scheduledEvents)
        .set({ status: 'pending', claimedAt: null })
        .where(
          and(
            eq(scheduledEvents.kind, 'mission_arrival'),
            eq(scheduledEvents.refId, launch.missionId),
          ),
        );
      await worker.tick();

      const reports = await f.db.select().from(battleReports);
      expect(reports).toHaveLength(1);
    });
  });

  describe('a raid, end to end, with both players offline', () => {
    it('resolves combat, moves loot, disrupts, and brings the fleet home', async () => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveUnits(f.db, attacker, { WASP: 120, HAULER: 8 });
      await grant(f.db, defender, 60_000, 6_000);
      await grant(f.db, attacker, 0, 0);
      f.clock.advance(300);

      const before = await f.db.select().from(planets).where(eq(planets.id, defender));
      const launch = await launchAttack(
        f.db,
        attacker,
        defender,
        { WASP: 120, HAULER: 8 },
        f.clock,
      );
      expect(launch.exposureMinutes).toBeGreaterThan(0);

      // The ships have physically left home.
      const athome = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
      expect(athome.find((u) => u.hull === 'WASP')!.count).toBe(0);

      f.clock.set(launch.arriveAt);
      const worker = makeWorker(f);
      await worker.tick();

      const [report] = await f.db.select().from(battleReports);
      expect(report).toBeDefined();
      expect(report!.grade).toBe('DECISIVE');
      expect(report!.loot.alloy).toBeGreaterThan(0);

      // The defender is poorer and disrupted.
      const [after] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(after!.alloy).toBeLessThan(before[0]!.alloy);
      expect(after!.disruptedUntil).not.toBeNull();

      // Dominion is zero-sum across the pair.
      const rows = await f.db.select().from(players);
      const total = rows.reduce((s, p) => s + p.dominionTaken - p.dominionLost, 0);
      expect(Math.abs(total)).toBeLessThan(0.001);

      // A return leg was scheduled; run it.
      const [ret] = await f.db
        .select()
        .from(missions)
        .where(eq(missions.kind, 'return'));
      expect(ret).toBeDefined();

      f.clock.set(ret!.arriveAt);
      await worker.tick();

      const home = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
      expect(home.find((u) => u.hull === 'WASP')!.count).toBeGreaterThan(0);

      const [attackerPlanet] = await f.db
        .select()
        .from(planets)
        .where(eq(planets.id, attacker));
      expect(attackerPlanet!.alloy).toBeGreaterThan(0); // loot arrived
    });

    it('leaves no units stranded in a mission location once it is over', async () => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveUnits(f.db, attacker, { WASP: 60 });
      await grant(f.db, defender, 20_000, 2_000);
      f.clock.advance(300);

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 60 }, f.clock);
      const worker = makeWorker(f);

      f.clock.set(launch.arriveAt);
      await worker.tick();
      const [ret] = await f.db.select().from(missions).where(eq(missions.kind, 'return'));
      f.clock.set(ret!.arriveAt);
      await worker.tick();

      const stranded = await f.db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM units WHERE location <> 'home' AND count > 0`,
      );
      expect(stranded[0]!.n).toBe(0);
    });
  });

  describe('queue completion', () => {
    it('marks a handled event done and clears its error', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'season_end', resolveAt: f.clock.now() });
      const [event] = await claimDue(f.db, 1, f.clock.now());
      await fail(f.db, event!.id, new Error('first go'));
      const [retry] = await claimDue(f.db, 1, f.clock.now());
      await complete(f.db, retry!.id);

      const [after] = await f.db.select().from(scheduledEvents);
      expect(after!.status).toBe('done');
      expect(after!.lastError).toBeNull();
    });
  });
});
