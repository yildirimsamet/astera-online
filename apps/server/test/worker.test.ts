import { and, eq, sql } from 'drizzle-orm';
import { DISRUPTION, fleetCargo } from '@astera/rules';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { battleReports, missions, planets, players, scheduledEvents, units } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { claimDue, complete, fail, failedEventCount, reap, schedule } from '../src/worker/queue.js';
import { abandon, strandedFlightCount, sweepStranded } from '../src/worker/abandon.js';
import { baysInUse } from '../src/services/flight.js';
import { launchAttack } from '../src/services/mission.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

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
        kind: 'asteroid_impact',
        resolveAt: new Date(f.clock.now().getTime() + 60_000),
      });
      expect(await claimDue(f.db, 10, f.clock.now())).toHaveLength(0);
    });

    it('claims an event the moment it is due', async () => {
      await schedule(f.db, {
        seasonId: f.seasonId,
        kind: 'asteroid_impact',
        resolveAt: f.clock.now(),
      });
      expect(await claimDue(f.db, 10, f.clock.now())).toHaveLength(1);
    });

    it('two concurrent workers never claim the same event', async () => {
      for (let i = 0; i < 20; i++) {
        await schedule(f.db, {
          seasonId: f.seasonId,
          kind: 'asteroid_impact',
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
          kind: 'asteroid_impact',
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
        await schedule(f.db, { seasonId: f.seasonId, kind: 'asteroid_impact', resolveAt: f.clock.now() });
      }
      expect(await claimDue(f.db, 2, f.clock.now())).toHaveLength(2);
    });
  });

  describe('failure handling', () => {
    it('returns a failed event to pending so it retries', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'asteroid_impact', resolveAt: f.clock.now() });
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
      await schedule(f.db, { seasonId: f.seasonId, kind: 'asteroid_impact', resolveAt: f.clock.now() });
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
      await schedule(f.db, { seasonId: f.seasonId, kind: 'asteroid_impact', resolveAt: f.clock.now() });
      const result = await makeWorker(f).tick();
      expect(result.claimed).toBe(1);
      expect(result.failed).toBe(0);

      const rows = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.status, 'done'));
      expect(rows).toHaveLength(1);
    });

    it('reports resolve-at lateness instead of mistaking handler duration for queue lag', async () => {
      await schedule(f.db, {
        seasonId: f.seasonId,
        kind: 'asteroid_impact',
        resolveAt: new Date(f.clock.now().getTime() - 1_500),
      });
      const worker = makeWorker(f);

      await worker.tick();

      expect(worker.status().latenessMs).toEqual({
        samples: 1,
        p50: 1_500,
        p95: 1_500,
        p99: 1_500,
        max: 1_500,
      });
    });
  });

  /**
   * A FLIGHT WHOSE EVENT ROW IS SIMPLY GONE. D46.
   *
   * Every safety net in the worker reads the EVENT: `reap` requeues a dead claim,
   * `fail` retries and then abandons, `/health` counts failed rows. A mission with
   * no event at all is invisible to all three — it sits `in_flight` for the rest of
   * the season holding a flight bay, and health reports `ok` throughout. One was
   * found thirteen hours past its arrival on a live galaxy, and nothing running
   * could have noticed it.
   */
  describe('a flight with no event to resolve it', () => {
    /** Launch a raid, then delete its arrival exactly as a lost row would be. */
    const orphan = async (): Promise<{ missionId: string; attacker: string }> => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveUnits(f.db, attacker, { WASP: 20 });
      f.clock.advance(300);
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 20 }, f.clock);
      await f.db
        .delete(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.refId, launch.missionId),
            eq(scheduledEvents.kind, 'mission_arrival'),
          ),
        );
      return { missionId: launch.missionId, attacker };
    };

    it('is left alone while it is still legitimately in the air', async () => {
      await orphan();
      expect(await sweepStranded(f.db, f.clock)).toBe(0);
      expect(await strandedFlightCount(f.db, f.clock.now())).toBe(0);
    });

    /**
     * And for a grace period after it too. A resolution can be a few seconds late
     * for entirely ordinary reasons — a poll interval, a retry, a restart — and
     * sweeping a flight that was about to resolve would destroy a real raid.
     */
    it('is left alone for a grace period past its own arrival', async () => {
      const { missionId } = await orphan();
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, missionId));
      f.clock.set(new Date(mission!.arriveAt.getTime() + 60_000));
      expect(await sweepStranded(f.db, f.clock)).toBe(0);
    });

    /**
     * AND THE SWEEP RUNS ON ITS OWN CLOCK, NOT THE QUEUE'S. D52.
     *
     * It is two correlated `NOT EXISTS` scans over tables that grow all season, and
     * it ran before `claimDue` on EVERY tick. That was defensible at a five-second
     * poll; `WORKER_POLL_MS` is now one second because it is the latency of the
     * whole world, and tying a repair's cost to that number means every future
     * improvement in how live the game feels is paid for again in table scans.
     *
     * The first tick still sweeps unconditionally: a process starting up after a
     * crash is exactly when there is most likely to be something to find.
     */
    it('sweeps on the first tick, and not again until its own interval', async () => {
      // Stranded up front, because `orphan` moves the clock and the whole point of
      // this test is what happens while the clock does NOT move. The second is
      // inserted directly rather than launched: one fleet per target is a real guard
      // (D28) and this test is about the sweep, not about launching.
      const { missionId: first } = await orphan();
      const [attacker, defender] = f.planetIds as [string, string];
      const overdue = new Date(f.clock.now().getTime() - 30 * 60_000);
      const [raw] = await f.db
        .insert(missions)
        .values({
          seasonId: f.seasonId,
          kind: 'attack',
          ownerPlayerId: f.playerIds[0]!,
          originPlanetId: attacker,
          targetPlanetId: defender,
          fleet: { WASP: 1 },
          distance: 100,
          departAt: new Date(overdue.getTime() - 60 * 60_000),
          arriveAt: overdue,
        })
        .returning();
      const second = raw!.id;
      await f.db.update(missions).set({ arriveAt: overdue }).where(eq(missions.id, first));
      // Held back until the second tick, so the first has exactly one thing to find.
      await f.db
        .update(missions)
        .set({ arriveAt: new Date(f.clock.now().getTime() + 60 * 60_000) })
        .where(eq(missions.id, second));

      const worker = makeWorker(f);
      expect((await worker.tick()).abandoned, 'a fresh worker must sweep at once').toBe(1);

      // Strand the second one, and ask again at the very same instant.
      await f.db.update(missions).set({ arriveAt: overdue }).where(eq(missions.id, second));
      expect((await worker.tick()).abandoned, 'swept again inside its own interval').toBe(0);

      f.clock.advance(1);
      expect((await worker.tick()).abandoned, 'never swept again at all').toBe(1);
    });

    it('is released once it is clearly never going to resolve', async () => {
      const { missionId, attacker } = await orphan();
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, missionId));
      f.clock.set(new Date(mission!.arriveAt.getTime() + 30 * 60_000));

      expect(await strandedFlightCount(f.db, f.clock.now())).toBe(1);
      expect(await sweepStranded(f.db, f.clock)).toBe(1);

      // Cancelled, not resolved: the server could not run the battle, so the
      // conservative reading is that the raid never happened.
      const [after] = await f.db.select().from(missions).where(eq(missions.id, missionId));
      expect(after!.status).toBe('cancelled');

      // The ships are home and the bay is free — the whole point of the sweep.
      const home = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
      expect(home.find((u) => u.hull === 'WASP')?.count).toBe(20);
      expect(await baysInUse(f.db, attacker)).toBe(0);
      expect(await strandedFlightCount(f.db, f.clock.now())).toBe(0);
    });

    /** Idempotent: a second sweep must not double-credit the same ships. */
    it('releases it exactly once', async () => {
      const { missionId, attacker } = await orphan();
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, missionId));
      f.clock.set(new Date(mission!.arriveAt.getTime() + 30 * 60_000));

      expect(await sweepStranded(f.db, f.clock)).toBe(1);
      expect(await sweepStranded(f.db, f.clock)).toBe(0);
      const home = await f.db
        .select()
        .from(units)
        .where(and(eq(units.planetId, attacker), eq(units.location, 'home')));
      expect(home.find((u) => u.hull === 'WASP')?.count).toBe(20);
    });

    /**
     * A RADAR WARNING IS NOT AN ARRIVAL, and it points at the same mission id.
     * Matching on `ref_id` alone would see one and call the flight healthy for as
     * long as the warning sat in the queue.
     */
    it('is not hidden by another event pointing at the same mission', async () => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveInstrument(f.db, defender, 'RADAR', 5);
      await giveUnits(f.db, attacker, { WASP: 20 });
      f.clock.advance(300);
      const launch = await launchAttack(f.db, attacker, defender, { WASP: 20 }, f.clock);

      // The warning survives; only the arrival is lost.
      await f.db
        .delete(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.refId, launch.missionId),
            eq(scheduledEvents.kind, 'mission_arrival'),
          ),
        );
      const left = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.refId, launch.missionId));
      expect(left.map((e) => e.kind)).toEqual(['radar_warning']);

      f.clock.set(new Date(launch.arriveAt.getTime() + 30 * 60_000));
      expect(await sweepStranded(f.db, f.clock)).toBe(1);
    });

    /** And the worker does it on its own, without anybody calling the sweep. */
    it('is released by an ordinary worker tick', async () => {
      const { missionId } = await orphan();
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, missionId));
      f.clock.set(new Date(mission!.arriveAt.getTime() + 30 * 60_000));

      const result = await makeWorker(f).tick();
      expect(result.abandoned).toBe(1);
      const [after] = await f.db.select().from(missions).where(eq(missions.id, missionId));
      expect(after!.status).toBe('cancelled');
    });
  });

  describe('crash recovery', () => {
    it('the reaper returns an abandoned claim to the queue', async () => {
      await schedule(f.db, { seasonId: f.seasonId, kind: 'asteroid_impact', resolveAt: f.clock.now() });
      const [event] = await claimDue(f.db, 1, f.clock.now()); // worker claims, then "dies"

      // Too soon: a live worker mid-transaction must not be stolen from.
      expect(await reap(f.db, 5, f.clock.now())).toBe(0);

      f.clock.advance(6);
      expect(await reap(f.db, 5, f.clock.now())).toBe(1);

      const [after] = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.id, event!.id));
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
      f.clock.set(settledAt(launch.arriveAt));
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
          kind: 'asteroid_impact',
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
      f.clock.set(settledAt(launch.arriveAt));

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
      // `grant` raises a Core to whatever holds the resources, which on a rich
      // defender puts it outside the attacker's tier band. See `levelWorld`.
      await levelWorld(f.db, [attacker, defender]);
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

      /**
       * THE ENGAGEMENT IS A REAL WINDOW, NOT AN ANIMATION. D44.
       *
       * A worker ticking at `arriveAt` resolves nothing: the fleet is over the
       * world and the battle has not happened yet.
       *
       * ASSERTED ON THE BATTLE, NOT ON THE EVENT COUNT. This read
       * `tick().processed === 0`, which was a proxy for "nothing was due" and
       * stopped being one when D45 gave every raid a radar warning to re-check at
       * the widest radar crossing. That event IS due here and processing it is
       * correct; what must still be true is that nothing has been decided.
       */
      f.clock.set(launch.arriveAt);
      const worker = makeWorker(f);
      await worker.tick();
      expect(await f.db.select().from(battleReports)).toHaveLength(0);
      const [midEngagement] = await f.db
        .select()
        .from(missions)
        .where(eq(missions.id, launch.missionId));
      expect(midEngagement!.status).toBe('in_flight');

      f.clock.set(settledAt(launch.arriveAt));
      await worker.tick();

      const [report] = await f.db.select().from(battleReports);
      expect(report).toBeDefined();
      expect(report!.grade).toBe('DECISIVE');
      expect(report!.loot.alloy).toBeGreaterThan(0);

      // The defender is poorer and disrupted.
      const [after] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(after!.alloy).toBeLessThan(before[0]!.alloy);
      expect(after!.disruptedUntil).not.toBeNull();
      expect(after!.disruptedUntil!.getTime() - f.clock.now().getTime())
        .toBe(DISRUPTION.decisiveMinutes * 60_000);

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
      expect(report!.loot.alloy + report!.loot.crystal).toBeLessThanOrEqual(
        fleetCargo(ret!.fleet, {}),
      );

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

    /**
     * THE BEACON SPEEDS THE TRIP HOME TOO. D25 sold "out and back".
     *
     * `launchAttack` passed `fleetSpeedMult(origin.orbit)` and the return leg called
     * the two-argument `fleetTravelMinutes`, so `boost` defaulted to 1: a raid flew
     * out 1.3× faster and walked home. The satellite costs 11,000 alloy and 3,500
     * crystal, and `packages/sim` already applies the multiplier to the return leg —
     * so the balance simulator was valuing a benefit the server did not deliver.
     *
     * Asserted as a comparison between two identical raids rather than against a
     * constant, so it survives any change to `SATELLITES.BEACON.speed`.
     */
    it('brings the survivors home at the speed the Beacon was bought for', async () => {
      const homeLeg = async (beacon: boolean): Promise<number> => {
        f = await seedWorld(2);
        const [attacker, defender] = f.planetIds as [string, string];
        // A real raiding distance. The seed puts these two 150 apart, where the
        // whole-minute rounding swallows a 30% difference and the assertion below
        // would pass against the bug it exists to catch.
        await placeAt(f.db, attacker, { x: 0 });
        await placeAt(f.db, defender, { x: 1_200 });
        await setLevel(f.db, attacker, 'CORE', 9);
        await giveUnits(f.db, attacker, { WASP: 60 });
        await grant(f.db, defender, 20_000, 2_000);
        if (beacon) await giveSatellite(f.db, attacker, 'BEACON');
        f.clock.advance(300);

        const launch = await launchAttack(f.db, attacker, defender, { WASP: 60 }, f.clock);
        f.clock.set(settledAt(launch.arriveAt));
        await makeWorker(f).tick();

        const [ret] = await f.db.select().from(missions).where(eq(missions.kind, 'return'));
        expect(ret, 'nothing survived to fly home').toBeDefined();
        return ret!.arriveAt.getTime() - ret!.departAt.getTime();
      };

      const plain = await homeLeg(false);
      const boosted = await homeLeg(true);
      expect(boosted, 'the trip home ignored the Beacon').toBeLessThan(plain);
    });

    it('leaves no units stranded in a mission location once it is over', async () => {
      const [attacker, defender] = f.planetIds as [string, string];
      await setLevel(f.db, attacker, 'CORE', 6);
      await giveUnits(f.db, attacker, { WASP: 60 });
      await grant(f.db, defender, 20_000, 2_000);
      f.clock.advance(300);

      const launch = await launchAttack(f.db, attacker, defender, { WASP: 60 }, f.clock);
      const worker = makeWorker(f);

      f.clock.set(settledAt(launch.arriveAt));
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
      await schedule(f.db, { seasonId: f.seasonId, kind: 'asteroid_impact', resolveAt: f.clock.now() });
      const [event] = await claimDue(f.db, 1, f.clock.now());
      await fail(f.db, event!.id, new Error('first go'));
      const [retry] = await claimDue(f.db, 1, f.clock.now());
      await complete(f.db, retry!.id);

      const [after] = await f.db
        .select()
        .from(scheduledEvents)
        .where(eq(scheduledEvents.id, retry!.id));
      expect(after!.status).toBe('done');
      expect(after!.lastError).toBeNull();
    });
  });
});

/**
 * THE STRANDED-FLIGHT LEAK, AND THE PROOF IT IS CLOSED. D28.
 *
 * `fail()` retries five times and then parks an event as `failed`. Nothing ever
 * read a `failed` row again — and because `claimMission` flips the mission inside
 * the same transaction that throws, every failed attempt rolled the mission back
 * to `in_flight`. The result was a flight that never landed: its units parked
 * off-planet forever, its origin-target pair blocked for the season, and — once
 * flight bays exist — a bay held with no path back.
 *
 * The leak predates bays. Bays are what made it unacceptable.
 */
describe('an event that gives up releases what it was holding', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 3);
      await grant(f.db, id, 200_000, 20_000);
    }
    await giveUnits(f.db, mine, { WASP: 40 });
    f.clock.advance(600);
  });

  /** Burn the retry budget without needing the handler to actually be broken. */
  const exhaust = async (eventId: string): Promise<void> => {
    for (let i = 0; i < 6; i++) {
      await f.db
        .update(scheduledEvents)
        .set({ attempts: sql`${scheduledEvents.attempts} + 1` })
        .where(eq(scheduledEvents.id, eventId));
      await fail(f.db, eventId, new Error('handler is broken'));
    }
  };

  it('marks the mission cancelled and brings the units home', async () => {
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.refId, launch.missionId));
    expect(event).toBeDefined();

    const before = await baysInUse(f.db, mine);
    expect(before).toBe(1);

    await exhaust(event!.id);
    const released = await abandon(f.db, event!, f.clock);
    expect(released).toBe(true);

    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(mission!.status).toBe('cancelled');

    // The bay is free again...
    expect(await baysInUse(f.db, mine)).toBe(0);

    // ...and the ships are not lost. A handler that cannot run is the server's
    // failure, not the player's.
    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, 'home')));
    expect(home.find((u) => u.hull === 'WASP')?.count).toBe(40);
  });

  it('is idempotent — abandoning twice releases nothing the second time', async () => {
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.refId, launch.missionId));
    await exhaust(event!.id);

    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    expect(await abandon(f.db, event!, f.clock)).toBe(false);
    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, 'home')));
    expect(home.find((u) => u.hull === 'WASP')?.count, 'units returned twice').toBe(40);
  });

  /**
   * A dead event is invisible to the lag metric, which only reads `pending` rows —
   * so the health check said "ok" while a player was permanently unable to launch.
   */
  it('a failed event is visible to the health check', async () => {
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);
    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.refId, launch.missionId));

    expect(await failedEventCount(f.db)).toBe(0);
    await exhaust(event!.id);
    expect(await failedEventCount(f.db)).toBe(1);
  });
});
