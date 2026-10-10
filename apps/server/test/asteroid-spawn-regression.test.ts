import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ASTEROID_DYNAMIC,
  GALAXY,
  dynamicAsteroidHourOf,
  planAsteroidHour,
  type AsteroidSpec,
} from '@astera/rules';
import { FixedClock, minutesSince } from '../src/clock.js';
import type { Tx } from '../src/db/client.js';
import {
  accounts,
  asteroidClaims,
  asteroidSpawnHours,
  galaxyEventOccurrences,
  miningRuns,
  players,
  scheduledEvents,
  seasons,
} from '../src/db/schema.js';
import {
  floorHour, ensureAsteroidHourEvents, openAsteroidHour, scheduleAsteroidHour,
} from '../src/services/asteroidSpawn.js';
import {
  adoptLiveEventCalendar,
  ensureGalaxyEventLifecycleEvents,
  processGalaxyEventLifecycle,
  restampFutureOccurrences,
} from '../src/services/galaxyEvents.js';
import { launchMining, loadMiningSnapshot, projectVisibleAsteroids } from '../src/services/mining.js';
import { joinSeason } from '../src/services/player.js';
import { createSeason } from '../src/services/season.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveResearch,
  giveSatellite,
  giveUnits,
  makeAccount,
  placeAt,
  setLevel,
  settledAt,
  testDb,
  truncateAll,
} from './helpers.js';

/**
 * Local incident diagnostics, not a season/economy simulation.
 * Actual PostgreSQL, queue, worker, calendar, private field, claims and mining arrival;
 * no mocked spawn/mining service. Runtime invariants and incident controls are
 * required to pass. Run with vitest.asteroid-repro.config.ts for an isolated local proof.
 */
const START = new Date('2026-10-04T18:56:16.282Z');
const HOUR = new Date('2026-10-09T17:00:00.000Z'); // Friday, 20:00 Türkiye
const HOUR_MS = 3_600_000;
const KEY = '00000000-0000-4000-8000-000000004242'; // Public fixture key, never a production secret.
const log = pino({ level: 'silent' });
const evidence = (scenario: string, facts: Record<string, unknown>) => {
  console.info('[asteroid-repro]', JSON.stringify({ scenario, ...facts }));
};

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

async function world(people = 36, history = true, at = HOUR) {
  const { db } = await testDb();
  await truncateAll(db);
  const clock = new FixedClock(START);
  const { season } = await createSeason(db, {
    shardCode: 'EU-ASTEROID-REPRO', seed: 4242, startsAt: START,
    days: 30, playerCap: 60, rulesetVersion: 16,
  });
  await db.update(seasons).set({ asteroidKey: KEY }).where(eq(seasons.id, season.id));
  const planetIds: string[] = [];
  for (let index = 0; index < people; index += 1) {
    const account = await makeAccount(db, `AsteroidRepro${index}`);
    await db.update(accounts).set({ createdAt: new Date(START.getTime() - 24 * HOUR_MS) })
      .where(eq(accounts.id, account.id));
    planetIds.push((await joinSeason(db, account.id, season.id, clock)).planetId);
  }
  await db.update(players).set({ lastActiveAt: at }).where(eq(players.seasonId, season.id));
  // Historical event deliveries are not the subject; retain the real current/future queue.
  await db.delete(scheduledEvents).where(lt(scheduledEvents.resolveAt, at));
  clock.set(at);
  const f = { db, clock, seasonId: season.id, planetIds, at };
  if (history) await storeHistory(f, [31, 32, 39, 36, 38]); // Newest first, prod's raw inputs.
  return f;
}

type World = Awaited<ReturnType<typeof world>>;

async function storeHistory(f: World, counts: readonly number[], firstHoursAgo = 1) {
  await f.db.insert(asteroidSpawnHours).values(counts.map((eligiblePlayers, index) => {
    const hourStartsAt = new Date(f.at.getTime() - (firstHoursAgo + index) * HOUR_MS);
    const minute = minutesSince(START, hourStartsAt);
    return {
      seasonId: f.seasonId, hourStartsAt, spawnFrom: hourStartsAt,
      eligiblePlayers, activePlayers: eligiblePlayers,
      lanes: planAsteroidHour({
        activePlayers: eligiblePlayers, hourStartsAtMinute: minute,
        spawnFromMinute: minute, seasonEndsAtMinute: 30 * 24 * 60, showers: [],
      }),
      levelWeights: ASTEROID_DYNAMIC.levelWeights, createdAt: hourStartsAt,
    };
  }));
}

const worker = (f: World) => new EventWorker(f.db, f.clock,
  { pollMs: 1000, batch: 1000, staleMinutes: 5 }, log);

async function boot(f: World) {
  await ensureAsteroidHourEvents(f.db, f.clock.now());
  const result = await worker(f).tick();
  expect(result.failed).toBe(0);
  expect(result.abandoned).toBe(0);
  return result;
}

async function currentHour(f: World) {
  const [row] = await f.db.select().from(asteroidSpawnHours).where(and(
    eq(asteroidSpawnHours.seasonId, f.seasonId), eq(asteroidSpawnHours.hourStartsAt, f.at),
  ));
  expect(row).toBeDefined();
  return row!;
}

async function shower(f: World) {
  const [row] = await f.db.select().from(galaxyEventOccurrences).where(and(
    eq(galaxyEventOccurrences.seasonId, f.seasonId),
    eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
    eq(galaxyEventOccurrences.startsAt, HOUR),
  ));
  expect(row).toBeDefined();
  return row!;
}

function fromCurrentHour<T extends { index: number }>(f: World, rocks: readonly T[]): T[] {
  const ordinal = Math.round((f.at.getTime() - floorHour(START).getTime()) / HOUR_MS);
  return rocks.filter((rock) => dynamicAsteroidHourOf(rock.index) === ordinal);
}

async function currentVisible(f: World) {
  const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
  return fromCurrentHour(f, projectVisibleAsteroids(snapshot, f.clock.now()));
}

function calendarShape(f: World) {
  // Delivery markers legitimately advance on boot; generation facts must remain identical.
  return f.db.select({
    id: galaxyEventOccurrences.id, kind: galaxyEventOccurrences.kind,
    sequence: galaxyEventOccurrences.sequence, startsAt: galaxyEventOccurrences.startsAt,
    endsAt: galaxyEventOccurrences.endsAt, definitionVersion: galaxyEventOccurrences.definitionVersion,
    effect: galaxyEventOccurrences.effect,
  }).from(galaxyEventOccurrences).orderBy(asc(galaxyEventOccurrences.id));
}

/** Observe the actual database lock, rather than relying on Promise scheduling order. */
async function blockedBackend(tx: Tx, blockingPid: number): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await tx.execute(sql`select pg_stat_clear_snapshot()`);
    const [row] = await tx.execute<{ pid: number }>(sql`
      select pid from pg_stat_activity
      where datname = current_database() and ${blockingPid} = any(pg_blocking_pids(pid))
      limit 1
    `);
    if (row) return row.pid;
    await delay(50);
  }
  throw new Error('Concurrent action never reached the PostgreSQL lock barrier');
}

async function oldFutureLunch() {
  const at = new Date('2026-10-09T09:00:00.000Z'); // 12:00 TRT, before the 12:30 shower.
  const f = await world(3, false, at);
  await f.db.update(galaxyEventOccurrences).set({
    definitionVersion: 9, effect: { asteroidSpawnMultiplier: 5 },
  }).where(and(
    eq(galaxyEventOccurrences.seasonId, f.seasonId),
    eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
    eq(galaxyEventOccurrences.startsAt, new Date(at.getTime() + 30 * 60_000)),
  ));
  return f;
}

async function oldEveningCalendar(f: World) {
  const occurrence = await shower(f);
  const endsAt = new Date(HOUR.getTime() + HOUR_MS);
  await f.db.update(galaxyEventOccurrences).set({
    definitionVersion: 9, endsAt, effect: { asteroidSpawnMultiplier: 3 },
  }).where(eq(galaxyEventOccurrences.id, occurrence.id));
  await f.db.update(scheduledEvents).set({ resolveAt: endsAt }).where(and(
    eq(scheduledEvents.refId, occurrence.id), eq(scheduledEvents.kind, 'galaxy_event_end'),
  ));
}

async function v10EveningCalendar(f: World) {
  const occurrence = await shower(f);
  await f.db.update(galaxyEventOccurrences).set({
    definitionVersion: 10, effect: { asteroidSpawnMultiplier: 6 },
  }).where(eq(galaxyEventOccurrences.id, occurrence.id));
}

async function deplete(f: World, rocks: readonly Pick<AsteroidSpec, 'index' | 'ore'>[]) {
  await f.db.insert(asteroidClaims).values(rocks.map((rock) => ({
    seasonId: f.seasonId, index: rock.index, oreTaken: rock.ore, updatedAt: f.clock.now(),
  })));
}

describe('controls: real worker and field', () => {
  it('reproduces the old v9 60-minute x3 evening as 105 total rocks', async () => {
    const f = await world();
    await oldEveningCalendar(f);
    await boot(f);
    const hour = await currentHour(f);
    expect(hour.lanes.map((lane) => lane.count)).toEqual([105]);
    evidence('old-v9-evening', { durationMinutes: 60, multiplier: 3, supply: hour.activePlayers, hourRocks: 105 });
  });

  it('produces 53 shower rocks + 18 normal rocks, including the smaller opening burst', async () => {
    const f = await world();
    await boot(f);
    const hour = await currentHour(f);
    expect(hour.eligiblePlayers).toBe(36);
    expect(hour.activePlayers).toBe(35);
    expect(hour.lanes.map((lane) => [lane.count, lane.frontCount])).toEqual([[53, 18], [18, 0]]);
    f.clock.set(new Date(HOUR.getTime() + 5 * 60_000));
    const five = await currentVisible(f);
    expect(five.length).toBeGreaterThanOrEqual(18);
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const rocks = fromCurrentHour(f, snapshot.asteroids);
    expect(rocks).toHaveLength(71);
    expect(rocks.slice(0, 18).every((rock) => rock.appearsAt <= minutesSince(START, f.clock.now()))).toBe(true);
    f.clock.set(new Date(HOUR.getTime() + 30 * 60_000));
    expect(await currentVisible(f)).toHaveLength(53);
    const allVisible = projectVisibleAsteroids(await loadMiningSnapshot(f.db, f.seasonId, f.clock.now()), f.clock.now());
    evidence('current-weekday-shower', {
      eligible: hour.eligiblePlayers, supply: hour.activePlayers,
      shower: 53, normal: 18, firstFiveMinutes: five.length,
      visibleIncludingPreviousHoursAtHalfHour: allVisible.length,
    });
  });

  it('plans the same new supply even when the previous stock has already been depleted', async () => {
    const f = await world();
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const stock = projectVisibleAsteroids(snapshot, f.clock.now());
    expect(stock.length).toBeGreaterThan(0);
    await deplete(f, stock);
    expect(projectVisibleAsteroids(await loadMiningSnapshot(f.db, f.seasonId, f.clock.now()), f.clock.now())).toHaveLength(0);
    await boot(f);
    const hour = await currentHour(f);
    expect(hour.lanes.map((lane) => [lane.count, lane.frontCount])).toEqual([[53, 18], [18, 0]]);
    evidence('stock-does-not-affect-new-supply', { previousStockDepleted: stock.length, newShower: 53, newNormal: 18 });
  });

  it('keeps one frozen hour through repeated boots and duplicate deliveries to two workers', async () => {
    const f = await world();
    await boot(f);
    const before = await currentHour(f);
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const rocks = fromCurrentHour(f, snapshot.asteroids);
    const calendar = await calendarShape(f);
    for (let index = 0; index < 5; index += 1) {
      await ensureGalaxyEventLifecycleEvents(f.db);
      await boot(f);
    }
    // Distinct legacy queue rows, same payload: exercise PK idempotency as well as queue dedupe.
    await f.db.insert(scheduledEvents).values([0, 1].map(() => ({
      seasonId: f.seasonId, kind: 'asteroid_hour' as const, resolveAt: HOUR,
      payload: { hourStartsAt: HOUR.toISOString() },
    })));
    const results = await Promise.all([worker(f).tick(), worker(f).tick()]);
    expect(results.every((result) => result.failed === 0)).toBe(true);
    expect(await currentHour(f)).toEqual(before);
    expect(await calendarShape(f)).toEqual(calendar);
    expect(fromCurrentHour(f, (await loadMiningSnapshot(f.db, f.seasonId, f.clock.now())).asteroids)).toEqual(rocks);
    const next = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'asteroid_hour'),
      eq(scheduledEvents.resolveAt, new Date(HOUR.getTime() + HOUR_MS)),
    ));
    expect(next).toHaveLength(1);
    evidence('restart-and-duplicate-delivery', { restarts: 5, duplicateDeliveries: 2, totalRocks: rocks.length, nextHourJobs: next.length });
  });

  it.each([
    { late: 4.99, count: 71, front: 18 },
    { late: 5.01, count: 62, front: 0 },
  ])('repairs a missing hour at minute $late: $count rocks, front=$front', async ({ late, count, front }) => {
    const f = await world();
    f.clock.set(new Date(HOUR.getTime() + late * 60_000));
    await boot(f);
    const hour = await currentHour(f);
    const immediate = (await currentVisible(f)).length;
    expect(hour.lanes.reduce((sum, lane) => sum + lane.count, 0)).toBe(count);
    expect(hour.lanes[0]!.frontCount).toBe(front);
    if (front > 0) expect(immediate).toBeGreaterThanOrEqual(front - 1);
    else expect(immediate).toBe(0);
    evidence('missing-hour-late-boot', { lateMinutes: late, plannedRocks: count, immediateRocks: immediate, front });
  });

  it('continues frozen v10 births after 40 + 20 removals without reviving a removed index', async () => {
    const f = await world();
    await v10EveningCalendar(f);
    await boot(f);
    f.clock.set(new Date(HOUR.getTime() + 30 * 60_000));
    const original = await currentVisible(f);
    expect(original).toHaveLength(105);
    const first = original.slice(0, 40);
    await deplete(f, first);
    expect(await currentVisible(f)).toHaveLength(65);
    const second = (await currentVisible(f)).slice(0, 20);
    await deplete(f, second);
    expect(await currentVisible(f)).toHaveLength(45);
    f.clock.set(new Date(HOUR.getTime() + 59.99 * 60_000));
    const later = await currentVisible(f);
    expect(later).toHaveLength(63);
    const removed = new Set([...first, ...second].map((rock) => rock.index));
    expect(later.some((rock) => removed.has(rock.index))).toBe(false);
    evidence('remove-and-continue', { before: 105, after40: 65, afterAnother20: 45, later: later.length, newNormalRocks: 18, removedIndexesRevived: 0 });
  });

  it('leaves a partly mined rock visible after a real mining arrival', async () => {
    const f = await world();
    await boot(f);
    const mine = f.planetIds[0]!;
    await setLevel(f.db, mine, 'CORE', 10);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await giveUnits(f.db, mine, { PROSPECTOR: 1 });
    await giveResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY');
    await giveResearch(f.db, mine, 'PROSPECTOR_HOLDS', 3);
    await giveSatellite(f.db, mine, 'DERRICK');
    await placeAt(f.db, mine, { x: 0 });
    f.clock.set(new Date(HOUR.getTime() + 30 * 60_000));
    const rock = (await currentVisible(f)).find((candidate) => candidate.level === 1)!;
    expect(rock).toBeDefined();
    expect(rock.ore).toBe(800);
    const run = await launchMining(f.db, mine, rock.index, 1, f.clock);
    expect(run.capacity).toBe(700); // Reproduce the single-craft capacity observed in production.
    f.clock.set(settledAt(run.arriveAt));
    expect((await worker(f).tick()).failed).toBe(0);
    const [landed] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    const [claim] = await f.db.select().from(asteroidClaims).where(and(
      eq(asteroidClaims.seasonId, f.seasonId), eq(asteroidClaims.index, rock.index),
    ));
    expect(claim!.oreTaken).toBe(run.capacity);
    expect(landed!.status).toBe('returning');
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const remaining = projectVisibleAsteroids(snapshot, f.clock.now()).find((candidate) => candidate.index === rock.index);
    expect(remaining?.oreRemaining).toBe(800 - run.capacity);
    evidence('partial-mining', { rockOre: 800, mined: claim!.oreTaken, remaining: remaining?.oreRemaining, stillVisible: remaining !== undefined });
  });

  it('adopts the full future calendar shape and preserves the 30-minute shower', async () => {
    const f = await world();
    await oldEveningCalendar(f);
    await f.db.transaction((tx) => adoptLiveEventCalendar(tx, {
      now: new Date(HOUR.getTime() - 10 * 60_000), seasonId: f.seasonId,
    }));
    await boot(f);
    const occurrence = await shower(f);
    const hour = await currentHour(f);
    expect(minutesSince(occurrence.startsAt, occurrence.endsAt)).toBe(30);
    expect(hour.lanes.map((lane) => lane.count)).toEqual([53, 18]);
    evidence('safe-calendar-adoption', { durationMinutes: 30, showerRocks: 53, hourRocks: 71 });
  });

  it('decays a contiguous recent population and produces zero with no population history', async () => {
    const at = new Date(HOUR.getTime() + HOUR_MS); // 21:00, no shower.
    const f = await world(0, false, at);
    await storeHistory(f, [50, 50, 50, 50, 50]);
    await boot(f);
    expect((await currentHour(f)).activePlayers).toBe(42);
    const empty = await world(0, false, at);
    await boot(empty);
    expect((await currentHour(empty)).activePlayers).toBe(0);
    expect((await currentHour(empty)).lanes).toEqual([]);
    evidence('population-controls', { noCurrentPlayersRecent50: 42, noCurrentPlayersNoHistory: 0 });
  });
});

describe('invariants: runtime safeguards', () => {
  it('does not attach a new multiplier to the old 60-minute window', async () => {
    const f = await world();
    await oldEveningCalendar(f);
    const now = new Date(HOUR.getTime() - 10 * 60_000);
    const before = await calendarShape(f);
    const queueBefore = await f.db.select().from(scheduledEvents).orderBy(asc(scheduledEvents.id));
    await expect(f.db.transaction((tx) => restampFutureOccurrences(tx, {
      now, seasonId: f.seasonId, kinds: ['ASTEROID_SHOWER'],
    }))).rejects.toThrow('adopt-event-calendar');
    expect(await calendarShape(f)).toEqual(before);
    expect(await f.db.select().from(scheduledEvents).orderBy(asc(scheduledEvents.id))).toEqual(queueBefore);
    await f.db.transaction((tx) => adoptLiveEventCalendar(tx, { now, seasonId: f.seasonId }));
    await boot(f);
    const occurrence = await shower(f);
    const hour = await currentHour(f);
    const count = hour.lanes.reduce((sum, lane) => sum + lane.count, 0);
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const generatedCount = fromCurrentHour(f, snapshot.asteroids).length;
    expect(generatedCount).toBe(count);
    evidence('restamp-duration-mismatch', {
      unsafeRestampRejected: true, version: occurrence.definitionVersion, effect: occurrence.effect,
      durationMinutes: minutesSince(occurrence.startsAt, occurrence.endsAt),
      workerPlannedRocks: count, actualGeneratedRocks: generatedCount,
      expectedCurrentDefinitionHourRocks: 71,
    });
    expect(occurrence.definitionVersion).toBe(11);
    expect(occurrence.effect).toEqual({ asteroidSpawnMultiplier: 3 });
    expect(minutesSince(occurrence.startsAt, occurrence.endsAt)).toBe(30);
    expect(count, 'adoption must replace the complete future window').toBe(71);
  });

  it('rejects a changed future half-hour shower once its containing hour is frozen', async () => {
    const at = new Date('2026-10-09T09:00:00.000Z'); // 12:00 TRT; shower opens at 12:30.
    const f = await world(3, false, at);
    const startsAt = new Date(at.getTime() + 30 * 60_000);
    await f.db.update(galaxyEventOccurrences).set({
      definitionVersion: 9, effect: { asteroidSpawnMultiplier: 5 },
    }).where(and(
      eq(galaxyEventOccurrences.seasonId, f.seasonId),
      eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      eq(galaxyEventOccurrences.startsAt, startsAt),
    ));
    await boot(f);
    const frozen = await currentHour(f);
    const before = await calendarShape(f);
    await expect(f.db.transaction((tx) => restampFutureOccurrences(tx, {
      now: new Date(at.getTime() + 10 * 60_000), seasonId: f.seasonId, kinds: ['ASTEROID_SHOWER'],
    }))).rejects.toThrow('adopt-event-calendar');
    expect(await calendarShape(f)).toEqual(before);
    expect(await currentHour(f)).toEqual(frozen);
    evidence('future-window-in-frozen-hour', { unsafeRestampRejected: true, frozenLanes: frozen.lanes });
  });

  it.each(['restamp', 'adopt'])('protects a concurrently opening worker hour when %s waited for its commit', async (operation) => {
    const f = await oldFutureLunch();
    const before = await calendarShape(f);
    const nextHour = new Date(f.at.getTime() + HOUR_MS);
    await scheduleAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: nextHour });
    let opening: Promise<void> | undefined;
    let stamping: Promise<PromiseSettledResult<unknown>> | undefined;
    try {
      await f.db.transaction(async (tx) => {
        // Hold deletion of the next job's unique key. A DELETE of this child row
        // holds no season FK lock, so only the worker blocks the calendar command.
        await tx.delete(scheduledEvents).where(and(
          eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'asteroid_hour'),
          eq(scheduledEvents.resolveAt, nextHour),
        ));
        const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        opening = openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: f.at, now: f.at });
        const workerPid = await blockedBackend(tx, holder!.pid);
        const action = operation === 'restamp'
          ? f.db.transaction((restampTx) => restampFutureOccurrences(restampTx, {
            now: f.at, seasonId: f.seasonId, kinds: ['ASTEROID_SHOWER'],
          }))
          : f.db.transaction((adoptionTx) => adoptLiveEventCalendar(adoptionTx, {
            now: new Date(f.at.getTime() - 1), seasonId: f.seasonId,
          }));
        stamping = Promise.allSettled([action]).then(([result]) => result);
        await blockedBackend(tx, workerPid);
      });
      await opening;
      const outcome = await stamping;
      if (operation === 'restamp') {
        if (outcome?.status !== 'rejected') throw new Error('Unsafe restamp unexpectedly completed');
        const reason: unknown = outcome.reason;
        if (!(reason instanceof Error)) throw new Error('Restamp must reject with an explicit error');
        expect(reason.message).toContain('adopt-event-calendar');
      } else {
        expect(outcome).toMatchObject({
          status: 'fulfilled', value: [{ cutoverAt: new Date(f.at.getTime() + HOUR_MS) }],
        });
      }
    } finally {
      // If a barrier fails, releasing its transaction must still drain both actions.
      await Promise.allSettled([opening, stamping]);
    }
    expect(await calendarShape(f)).toEqual(before);
    expect((await currentHour(f)).lanes.reduce((sum, lane) => sum + lane.count, 0)).toBe(10);
    evidence('calendar-worker-race-worker-first', { operation, oldHourRocks: 10, frozenHourPreserved: true });
  });

  it('uses the new effect when restamp commits before a concurrently opening worker', async () => {
    const f = await oldFutureLunch();
    let opening: Promise<void> | undefined;
    try {
      await f.db.transaction(async (tx) => {
        await tx.select().from(seasons).where(eq(seasons.id, f.seasonId)).for('update');
        const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        opening = openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: f.at, now: f.at });
        await blockedBackend(tx, holder!.pid);
        expect(await restampFutureOccurrences(tx, {
          now: f.at, seasonId: f.seasonId, kinds: ['ASTEROID_SHOWER'],
        })).toBe(1);
      });
      await opening;
    } finally {
      await Promise.allSettled([opening]);
    }
    expect((await currentHour(f)).lanes.reduce((sum, lane) => sum + lane.count, 0)).toBe(5);
    evidence('restamp-worker-race-restamp-first', { newHourRocks: 5, multiplier: 2 });
  });

  it('keeps an unchanged pending half-hour shower a no-op inside its frozen hour', async () => {
    const f = await world(3, false, new Date('2026-10-09T09:00:00.000Z'));
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: f.at, now: f.at });
    const frozen = await currentHour(f);
    const before = await calendarShape(f);
    expect(await f.db.transaction((tx) => restampFutureOccurrences(tx, {
      now: f.at, seasonId: f.seasonId, kinds: ['ASTEROID_SHOWER'],
    }))).toBe(0);
    expect(await calendarShape(f)).toEqual(before);
    expect(await currentHour(f)).toEqual(frozen);
  });

  it.each([0, 7])('keeps committed hours when an adoption command captured time before the boundary (hours ahead=%s)', async (hoursAhead) => {
    const f = await world(3, false, new Date('2026-10-10T10:00:00.000Z')); // Saturday 13:00 TRT.
    for (const { hours, multiplier } of [{ hours: 0, multiplier: 6 }, { hours: 7, multiplier: 10 }]) {
      await f.db.update(galaxyEventOccurrences).set({
        definitionVersion: 10, effect: { asteroidSpawnMultiplier: multiplier },
      }).where(and(
        eq(galaxyEventOccurrences.seasonId, f.seasonId),
        eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
        eq(galaxyEventOccurrences.startsAt, new Date(f.at.getTime() + hours * HOUR_MS)),
      ));
    }
    const plannedAt = new Date(f.at.getTime() + hoursAhead * HOUR_MS);
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: plannedAt, now: plannedAt });
    const hoursBefore = await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    const calendarBefore = await calendarShape(f);
    const fieldBefore = await loadMiningSnapshot(f.db, f.seasonId, plannedAt);
    const [report] = await f.db.transaction((tx) => adoptLiveEventCalendar(tx, {
      now: new Date(f.at.getTime() - 1), seasonId: f.seasonId,
    }));
    const cutover = new Date(plannedAt.getTime() + HOUR_MS);
    expect(report?.cutoverAt).toEqual(cutover);
    const calendarAfter = await calendarShape(f);
    expect(calendarAfter.filter((row) => row.startsAt < cutover))
      .toEqual(calendarBefore.filter((row) => row.startsAt < cutover));
    expect(calendarAfter.filter((row) => row.kind === 'ASTEROID_SHOWER' && row.startsAt >= cutover)
      .every((row) => row.definitionVersion === 11)).toBe(true);
    expect(await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId)))
      .toEqual(hoursBefore);
    expect((await loadMiningSnapshot(f.db, f.seasonId, plannedAt)).asteroids).toEqual(fieldBefore.asteroids);
    evidence('adoption-protects-committed-hour', { hoursAhead, cutoverAt: cutover.toISOString() });
  });

  it.each(['start', 'end'] as const)('preserves a processed shower (%s) when adoption waited across the boundary before its hour job ran', async (lifecycle) => {
    const f = await world(3, false, new Date('2026-10-10T10:00:00.000Z'));
    const where = and(
      eq(galaxyEventOccurrences.seasonId, f.seasonId),
      eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      eq(galaxyEventOccurrences.startsAt, f.at),
    );
    const [occurrence] = await f.db.update(galaxyEventOccurrences).set({
      definitionVersion: 10, effect: { asteroidSpawnMultiplier: 6 },
    }).where(where).returning();
    const processedAt = lifecycle === 'start' ? f.at : occurrence!.endsAt;
    await processGalaxyEventLifecycle(f.db, {
      occurrenceId: occurrence!.id, seasonId: f.seasonId, lifecycle, processedAt,
    });
    const [started] = await f.db.select().from(galaxyEventOccurrences).where(where);
    expect(lifecycle === 'start' ? started?.startProcessedAt : started?.endProcessedAt).toEqual(processedAt);
    if (lifecycle === 'end') expect(started?.startProcessedAt).toBeNull();
    expect(await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId)))
      .toEqual([]);
    const [report] = await f.db.transaction((tx) => adoptLiveEventCalendar(tx, {
      now: new Date(f.at.getTime() - 1), seasonId: f.seasonId,
    }));
    expect(report?.cutoverAt).toEqual(new Date(f.at.getTime() + HOUR_MS));
    const [after] = await f.db.select().from(galaxyEventOccurrences).where(where);
    expect(after).toEqual(started);
  });

  it.each(['start', 'end'] as const)('refuses to restamp a processed shower (%s) before its delayed hour opens', async (lifecycle) => {
    const f = await world(3, false, new Date('2026-10-10T10:00:00.000Z'));
    const where = and(
      eq(galaxyEventOccurrences.seasonId, f.seasonId),
      eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      eq(galaxyEventOccurrences.startsAt, f.at),
    );
    const [occurrence] = await f.db.update(galaxyEventOccurrences).set({
      definitionVersion: 10, effect: { asteroidSpawnMultiplier: 6 },
    }).where(where).returning();
    if (!occurrence) throw new Error('Missing shower fixture');
    await processGalaxyEventLifecycle(f.db, {
      occurrenceId: occurrence.id, seasonId: f.seasonId, lifecycle,
      processedAt: lifecycle === 'start' ? f.at : occurrence.endsAt,
    });
    const [processed] = await f.db.select().from(galaxyEventOccurrences).where(where);
    if (lifecycle === 'end') expect(processed?.startProcessedAt).toBeNull();
    expect(await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId)))
      .toEqual([]);
    const before = await calendarShape(f);
    const jobsBefore = await f.db.select().from(scheduledEvents).orderBy(asc(scheduledEvents.id));
    const command = { now: new Date(f.at.getTime() - 1), seasonId: f.seasonId, kinds: ['ASTEROID_SHOWER'] as const };
    await expect(f.db.transaction((tx) => restampFutureOccurrences(tx, command)))
      .rejects.toThrow('adopt-event-calendar');
    expect(await calendarShape(f)).toEqual(before);
    expect(await f.db.select().from(scheduledEvents).orderBy(asc(scheduledEvents.id))).toEqual(jobsBefore);
    expect((await f.db.select().from(galaxyEventOccurrences).where(where))[0]).toEqual(processed);

    // An already matching processed occurrence needs no write and remains a no-op.
    await f.db.update(galaxyEventOccurrences).set({
      definitionVersion: 11, effect: { asteroidSpawnMultiplier: 3 },
    }).where(where);
    const matching = await calendarShape(f);
    expect(await f.db.transaction((tx) => restampFutureOccurrences(tx, command))).toBe(0);
    expect(await calendarShape(f)).toEqual(matching);
    expect(await f.db.select().from(scheduledEvents).orderBy(asc(scheduledEvents.id))).toEqual(jobsBefore);
  });

  it('ignores population samples more than six actual hours old after an outage', async () => {
    const at = new Date(HOUR.getTime() + HOUR_MS);
    const f = await world(50, false, at);
    await f.db.update(players).set({ lastActiveAt: new Date(at.getTime() - 24 * HOUR_MS) })
      .where(eq(players.seasonId, f.seasonId));
    await storeHistory(f, [50, 50, 50, 50, 50], 24);
    await boot(f);
    const hour = await currentHour(f);
    // Read after every planned birth, without ticking the next hour's worker event.
    f.clock.set(new Date(at.getTime() + HOUR_MS));
    const visibleCount = (await currentVisible(f)).length;
    expect(visibleCount).toBe(hour.lanes.reduce((sum, lane) => sum + lane.count, 0));
    evidence('stale-population-after-outage', {
      seatedCommanders: f.planetIds.length,
      eligibleNow: hour.eligiblePlayers, youngestHistoryHoursOld: 24,
      supply: hour.activePlayers, workerPlannedRocks: hour.lanes.reduce((sum, lane) => sum + lane.count, 0),
      actualVisibleRocksAfterTheHour: visibleCount,
    });
    expect(hour.eligiblePlayers).toBe(0);
    expect(hour.activePlayers, 'an empty galaxy must not use yesterday’s samples as the last six hours').toBe(0);
  });

  it.each([{ age: 5, expected: 25 }, { age: 6, expected: 0 }])(
    'includes only the preceding five actual hours (sample age=$age)', async ({ age, expected }) => {
      const f = await world(0, false, new Date(HOUR.getTime() + HOUR_MS));
      await storeHistory(f, [50], age);
      await boot(f);
      expect((await currentHour(f)).activePlayers).toBe(expected);
    },
  );

  it('uses the captured settings of a newly opened hour in every subsequent process', async () => {
    const f = await world(3, false);
    const descriptor = Object.getOwnPropertyDescriptor(GALAXY, 'asteroidOreByLevel')!;
    const oreByLevel = GALAXY.asteroidOreByLevel.map((ore) => ore * 2);
    try {
      Object.defineProperty(GALAXY, 'asteroidOreByLevel', { value: oreByLevel });
      await boot(f);
    } finally {
      Object.defineProperty(GALAXY, 'asteroidOreByLevel', descriptor);
    }
    expect((await currentHour(f)).generation?.oreByLevel).toEqual(oreByLevel);
    f.clock.set(new Date(HOUR.getTime() + 30 * 60_000));
    const rocks = await currentVisible(f);
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every((rock) => rock.ore === oreByLevel[rock.level])).toBe(true);
    await deplete(f, rocks);
    const before = await readInFreshProcess(f, 1);
    const after = await readInFreshProcess(f, 3);
    expect(after).toEqual(before);
    expect(after.filter((rock) => rock.visible)).toHaveLength(0);
    evidence('new-hour-snapshot', { storedOreByLevel: oreByLevel, currentDefaultOre: GALAXY.asteroidOreByLevel, revived: 0 });
  });

  it.each([false, true])('keeps depleted rocks stable through a fresh-image settings change (legacy row=%s)', async (legacy) => {
    const f = await world();
    await v10EveningCalendar(f);
    await boot(f);
    if (legacy) await f.db.update(asteroidSpawnHours).set({ generation: null }).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    f.clock.set(new Date(HOUR.getTime() + 30 * 60_000));
    const rocks = await currentVisible(f);
    expect(rocks).toHaveLength(105);
    await deplete(f, rocks);
    expect(await currentVisible(f)).toHaveLength(0);
    const before = await readInFreshProcess(f, 1);
    const after = await readInFreshProcess(f, 2);
    // The stored hour also contains 18 future rocks; only the 105 already born were depleted.
    expect(before).toHaveLength(123);
    expect(before.filter((rock) => rock.oreTaken > 0)).toHaveLength(rocks.length);
    expect(before.filter((rock) => rock.visible)).toHaveLength(0);
    expect(after.map((rock) => rock.index)).toEqual(before.map((rock) => rock.index));
    expect(after.map((rock) => rock.oreTaken)).toEqual(before.map((rock) => rock.oreTaken));
    evidence('new-image-ore-table', {
      depletedBefore: before.filter((rock) => rock.oreTaken > 0).length,
      revivedAfter: after.filter((rock) => rock.visible).length,
      unchangedClaimSample: before[0], newImageSample: after[0],
    });
    expect(after.filter((rock) => rock.visible), 'persisted depletion must survive a balance change').toHaveLength(0);
    expect(after).toEqual(before);
  });
});

const regeneratedRockSchema = z.array(z.object({
  index: z.number().int(), level: z.number().int(), ore: z.number(),
  crystalShare: z.number(), deuteriumShare: z.number(), isotopeRich: z.boolean(),
  radius: z.number(), period: z.number(), phase: z.number(),
  inclination: z.number(), ascendingNode: z.number(), speed: z.number(),
  appearsAt: z.number(), expiresAt: z.number(), oreTaken: z.number(), visible: z.boolean(),
}).strict());

/** A second Node process really has an empty field cache, as a newly started image does. */
async function readInFreshProcess(f: World, oreMultiplier: number) {
  const code = `
    import { createDb } from './src/db/client.ts';
    import { GALAXY, ASTEROID_DYNAMIC, ASTEROID_SHOWER_FRONT_LOAD, DEUTERIUM, dynamicAsteroidHourOf } from '@astera/rules';
    const multiplier = Number(process.env.ASTERA_REPRO_ORE_MULTIPLIER);
    Object.defineProperty(GALAXY, 'asteroidOreByLevel', {
      value: GALAXY.asteroidOreByLevel.map((ore) => ore * multiplier),
    });
    if (multiplier !== 1) {
      Object.defineProperties(GALAXY, {
        asteroidOrbitMin: { value: 100 }, asteroidOrbitMax: { value: 500 },
        asteroidSpeedMin: { value: 100 }, asteroidSpeedMax: { value: 200 },
        asteroidLifeHoursMin: { value: 1 }, asteroidLifeHoursMax: { value: 2 },
        asteroidCrystalShareMin: { value: 0.01 }, asteroidCrystalShareMax: { value: 0.02 },
      });
      Object.defineProperty(ASTEROID_DYNAMIC, 'levelUnlockByDay', { value: [1] });
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', { value: 1 });
      Object.defineProperties(DEUTERIUM, {
        frontierStartsAtMinutes: { value: 999999 }, isotopeCadence: { value: 3 },
        isotopeBonusCadence: { value: 4 }, isotopeShareMin: { value: 0.5 }, isotopeShareMax: { value: 0.6 },
      });
    }
    const { loadMiningSnapshot, projectVisibleAsteroids } = await import('./src/services/mining.ts');
    const connection = createDb(process.env.DATABASE_URL);
    try {
      const now = new Date(process.env.ASTERA_REPRO_AT);
      const snapshot = await loadMiningSnapshot(connection.db, process.env.ASTERA_REPRO_SEASON, now);
      const visible = new Set(projectVisibleAsteroids(snapshot, now).map((rock) => rock.index));
      const ordinal = Number(process.env.ASTERA_REPRO_HOUR);
      const rocks = snapshot.asteroids.filter((rock) => dynamicAsteroidHourOf(rock.index) === ordinal);
      console.log(JSON.stringify(rocks.map((rock) => ({
        ...rock, oreTaken: snapshot.oreTaken.get(rock.index) ?? 0,
        visible: visible.has(rock.index),
      }))));
    } finally { await connection.close(); }
  `;
  const { stdout } = await promisify(execFile)(process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', code], {
      cwd: process.cwd(), timeout: 30_000,
      env: {
        ...process.env, ASTERA_REPRO_ORE_MULTIPLIER: String(oreMultiplier),
        ASTERA_REPRO_SEASON: f.seasonId, ASTERA_REPRO_AT: f.clock.now().toISOString(),
        ASTERA_REPRO_HOUR: String(Math.round((f.at.getTime() - floorHour(START).getTime()) / HOUR_MS)),
      },
    });
  return regeneratedRockSchema.parse(JSON.parse(stdout));
}
