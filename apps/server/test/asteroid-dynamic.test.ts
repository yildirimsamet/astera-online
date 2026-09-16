import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import {
  ASTEROID_DYNAMIC,
  GALAXY_EVENTS,
  PROSPECTOR,
  activeAsteroids,
  dynamicAsteroidHourOf,
  plannedEffectFor,
  type AsteroidSpec,
} from '@astera/rules';
import { FixedClock, minutesSince } from '../src/clock.js';
import {
  asteroidSpawnHours,
  botProfiles,
  galaxyEventOccurrences,
  miningRuns,
  players,
  scheduledEvents,
  seasons,
} from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { launchMining, loadMiningSnapshot } from '../src/services/mining.js';
import { asteroidId, asteroidIndexFromId } from '../src/services/asteroidField.js';
import {
  ensureAsteroidHourEvents,
  openAsteroidHour,
} from '../src/services/asteroidSpawn.js';
import {
  adoptLiveEventCalendar,
  loadGalaxyEventSchedule,
} from '../src/services/galaxyEvents.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  truncateAll,
  type Fixture,
} from './helpers.js';

/**
 * THE FIELD FOLLOWS THE PEOPLE PLAYING IT. Owner instruction, 2026-09-16.
 * `packages/rules/test/asteroid-dynamic.test.ts` holds the arithmetic; this file holds
 * who is counted, when an hour is opened, what the mining paths read, and how the one
 * live season adopts the new shape without a reset.
 */

const HOUR = 3_600_000;
const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const dynamicRocks = (rocks: readonly AsteroidSpec[]) =>
  rocks.filter((rock) => dynamicAsteroidHourOf(rock.index) !== null);

/** Turn a fixture's legacy season into one on the dynamic field from its start. */
async function dynamicWorld(count: number): Promise<Fixture> {
  const f = await seedWorld(count);
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  await f.db.update(seasons)
    .set({ asteroidDynamicFrom: season!.startsAt })
    .where(eq(seasons.id, f.seasonId));
  return f;
}

async function hourRow(f: Fixture, hourStartsAt: Date) {
  const [row] = await f.db.select().from(asteroidSpawnHours).where(and(
    eq(asteroidSpawnHours.seasonId, f.seasonId),
    eq(asteroidSpawnHours.hourStartsAt, hourStartsAt),
  ));
  return row;
}

describe('opening an hour', () => {
  it('counts two rocks for each commander who played in the last hour, and never a bot', async () => {
    const f = await dynamicWorld(4);
    const hour = f.clock.now();
    // Two people at the controls, one who left over an hour ago, one the server plays.
    await f.db.update(players)
      .set({ lastActiveAt: new Date(hour.getTime() - (ASTEROID_DYNAMIC.activeWindowMinutes + 1) * 60_000) })
      .where(eq(players.id, f.playerIds[2]!));
    await f.db.insert(botProfiles).values({
      accountId: f.accountIds[3]!, ordinal: 1, persona: 'raider', nextActionAt: hour, createdAt: hour,
    });

    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });

    const row = await hourRow(f, hour);
    expect(row?.activePlayers).toBe(2);
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, new Date(hour.getTime() + HOUR));
    expect(dynamicRocks(snapshot.asteroids)).toHaveLength(2 * ASTEROID_DYNAMIC.perPlayerPerHour);
  });

  it('multiplies the hour by the shower that covers it', async () => {
    const f = await dynamicWorld(3);
    const hour = f.clock.now();
    await f.db.insert(galaxyEventOccurrences).values({
      seasonId: f.seasonId,
      sequence: 0,
      kind: 'ASTEROID_SHOWER',
      definitionVersion: GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version,
      startsAt: hour,
      endsAt: new Date(hour.getTime() + HOUR),
      effect: { asteroidSpawnMultiplier: 10 },
      createdAt: hour,
    });

    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, new Date(hour.getTime() + HOUR));
    expect(dynamicRocks(snapshot.asteroids)).toHaveLength(3 * 2 * 10);
  });

  it('opens each hour once and queues exactly one next hour', async () => {
    const f = await dynamicWorld(2);
    const hour = f.clock.now();
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });

    const rows = await f.db.select().from(asteroidSpawnHours)
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    expect(rows).toHaveLength(1);
    const next = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, f.seasonId),
      eq(scheduledEvents.kind, 'asteroid_hour'),
      eq(scheduledEvents.resolveAt, new Date(hour.getTime() + HOUR)),
    ));
    expect(next).toHaveLength(1);
  });

  it('pays a late hour only for the minutes it has left, and never backfills a lost one', async () => {
    const f = await dynamicWorld(2);
    const hour = f.clock.now();

    const halfway = new Date(hour.getTime() + HOUR / 2);
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: halfway });
    const late = await hourRow(f, hour);
    expect(late?.spawnFrom.getTime()).toBe(halfway.getTime());
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, new Date(hour.getTime() + HOUR));
    const rocks = dynamicRocks(snapshot.asteroids);
    expect(rocks).toHaveLength(2);
    for (const rock of rocks) {
      expect(rock.appearsAt).toBeGreaterThanOrEqual(minutesSince(hour, halfway));
    }

    // The next hour's event reaches the worker after that hour has already ended.
    const nextHour = new Date(hour.getTime() + HOUR);
    const afterIt = new Date(nextHour.getTime() + 70 * 60_000);
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: nextHour, now: afterIt });
    expect(await hourRow(f, nextHour)).toBeUndefined();
    // …and the current hour is queued to open now, for what is left of it.
    const current = new Date(nextHour.getTime() + HOUR);
    const queued = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'asteroid_hour'),
      eq(scheduledEvents.resolveAt, afterIt),
    ));
    expect(queued).toHaveLength(1);
    expect(queued[0]!.payload).toEqual({ hourStartsAt: current.toISOString() });
  });

  it('does nothing on a season still on the derived field', async () => {
    const f = await seedWorld(2);
    const hour = f.clock.now();
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });
    expect(await hourRow(f, hour)).toBeUndefined();
  });

  it('repairs a missing hour at worker start, once', async () => {
    const f = await dynamicWorld(2);
    const now = new Date(f.clock.now().getTime() + 3 * HOUR + 10 * 60_000);
    expect(await ensureAsteroidHourEvents(f.db, now)).toBeGreaterThan(0);
    expect(await ensureAsteroidHourEvents(f.db, now)).toBe(0);
    const pending = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, f.seasonId),
      eq(scheduledEvents.kind, 'asteroid_hour'),
    )).orderBy(asc(scheduledEvents.resolveAt));
    expect(pending.map((event) => event.payload)).toContainEqual({
      hourStartsAt: new Date(f.clock.now().getTime() + 3 * HOUR).toISOString(),
    });
  });

  it('carries only the hours whose rocks can still matter', async () => {
    const f = await dynamicWorld(2);
    const start = f.clock.now();
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: start, now: start });
    const much = new Date(start.getTime() + 13 * HOUR);
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, much);
    expect(dynamicRocks(snapshot.asteroids)).toHaveLength(0);
  });
});

describe('mining a dynamic rock', () => {
  it('flies to a rock of a stored hour by its public id and brings its ore home', async () => {
    const f = await dynamicWorld(2);
    const [mine] = f.planetIds as [string];
    await setLevel(f.db, mine, 'CORE', 10);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await placeAt(f.db, mine, { x: 0 });
    await giveUnits(f.db, mine, { PROSPECTOR: PROSPECTOR.max });

    const hour = f.clock.now();
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });
    f.clock.set(new Date(hour.getTime() + 50 * 60_000));
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const nowMinutes = minutesSince(season!.startsAt, f.clock.now());
    const rock = activeAsteroids(dynamicRocks(snapshot.asteroids), nowMinutes)
      .find((candidate) => candidate.expiresAt - nowMinutes > 45);
    expect(rock, 'no dynamic rock alive for the round trip').toBeDefined();

    const id = asteroidId(season!.asteroidKey, rock!.index);
    expect(asteroidIndexFromId(season!.asteroidKey, snapshot.asteroids, id)).toBe(rock!.index);

    const run = await launchMining(f.db, mine, rock!.index, 2, f.clock);
    f.clock.set(settledAt(run.arriveAt));
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();

    const [landed] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    expect(landed!.minedAlloy + landed!.minedCrystal + landed!.minedDeuterium).toBeGreaterThan(0);
  });
});

describe('season creation', () => {
  it('deals a season at the current ruleset onto the dynamic field from its first instant', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const startsAt = new Date('2026-09-01T21:00:00.000Z');
    const { season } = await createSeason(db, {
      shardCode: 'EU-DYNAMIC', seed: 11, startsAt, playerCap: 60,
    });
    expect(season.asteroidDynamicFrom?.getTime()).toBe(startsAt.getTime());
    expect(season.asteroidLegacyCalendar).toBeNull();
    const first = await db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, season.id),
      eq(scheduledEvents.kind, 'asteroid_hour'),
    ));
    expect(first.map((event) => event.resolveAt.getTime())).toEqual([startsAt.getTime()]);

    const { season: older } = await createSeason(db, {
      shardCode: 'EU-DERIVED', seed: 12, startsAt, playerCap: 60, rulesetVersion: 7,
    });
    expect(older.asteroidDynamicFrom).toBeNull();
  });
});

/* ── the live season, adopted without a reset ─────────────────── */

describe('adopting the working-week calendar on a live season', () => {
  // Wednesday 2026-09-02 00:00 TRT.
  const START = new Date('2026-09-01T21:00:00.000Z');
  const OLD_SHOWERS = [
    [2, 3], [10, 3], [13, 5], [16, 5], [20, 10], [23, 5],
  ] as const;
  const OLD_CONVOYS = [7, 12, 19] as const;
  const at = (day: number, hour: number, minute = 0) =>
    new Date(START.getTime() + ((day * 24 + hour) * 60 + minute) * 60_000);

  /**
   * A SEASON AS PRODUCTION HOLDS IT TODAY: dealt before this change, on the derived
   * field, with six showers and three convoys a day under the previous versions.
   */
  async function liveSeason() {
    const { db } = await testDb();
    await truncateAll(db);
    const { season } = await createSeason(db, {
      shardCode: 'EU-1', seed: 4512, startsAt: START, playerCap: 60,
    });
    await db.update(seasons)
      .set({ asteroidDynamicFrom: null, asteroidLegacyCalendar: null })
      .where(eq(seasons.id, season.id));
    await db.delete(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, season.id),
      inArray(scheduledEvents.kind, ['asteroid_hour', 'galaxy_event_start', 'galaxy_event_end']),
    ));
    await db.delete(galaxyEventOccurrences).where(and(
      eq(galaxyEventOccurrences.seasonId, season.id),
      inArray(galaxyEventOccurrences.kind, ['ASTEROID_SHOWER', 'INTERGALACTIC_CONVOY']),
    ));
    const days = Math.round((season.endsAt.getTime() - START.getTime()) / (24 * HOUR));
    const rows: (typeof galaxyEventOccurrences.$inferInsert)[] = [];
    const convoyEffect = { ...GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]!.effect, resourceCapHours: 2 };
    let showerSequence = 0;
    let convoySequence = 0;
    for (let day = 0; day < days; day += 1) {
      for (const [hour, multiplier] of OLD_SHOWERS) {
        rows.push({
          seasonId: season.id, sequence: showerSequence++, kind: 'ASTEROID_SHOWER',
          definitionVersion: 6, startsAt: at(day, hour), endsAt: at(day, hour + 1),
          effect: { asteroidSpawnMultiplier: multiplier }, createdAt: START,
        });
      }
      for (const hour of OLD_CONVOYS) {
        rows.push({
          seasonId: season.id, sequence: convoySequence++, kind: 'INTERGALACTIC_CONVOY',
          definitionVersion: 3, startsAt: at(day, hour), endsAt: at(day, hour + 2),
          effect: convoyEffect, createdAt: START,
        });
      }
    }
    const inserted = await db.insert(galaxyEventOccurrences).values(rows)
      .returning({ id: galaxyEventOccurrences.id, startsAt: galaxyEventOccurrences.startsAt, endsAt: galaxyEventOccurrences.endsAt });
    await db.insert(scheduledEvents).values(inserted.flatMap((row) => [
      { seasonId: season.id, kind: 'galaxy_event_start' as const, refId: row.id,
        dedupeKey: `galaxy-event:start:${row.id}`, resolveAt: row.startsAt },
      { seasonId: season.id, kind: 'galaxy_event_end' as const, refId: row.id,
        dedupeKey: `galaxy-event:end:${row.id}`, resolveAt: row.endsAt },
    ]));
    return { db, season };
  }

  const occurrences = async (seasonId: string) => {
    const { db } = await testDb();
    return db.select().from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, seasonId))
      .orderBy(
        asc(galaxyEventOccurrences.startsAt),
        asc(galaxyEventOccurrences.kind),
        asc(galaxyEventOccurrences.sequence),
      );
  };

  it('keeps every rock already in the sky exactly where and what it was', async () => {
    const { db, season } = await liveSeason();
    // Friday 20:40 TRT, inside the old x10 window.
    const now = at(2, 20, 40);
    const nowMinutes = minutesSince(START, now);
    const before = (await loadMiningSnapshot(db, season.id, now)).asteroids
      .filter((rock) => rock.appearsAt <= nowMinutes);
    expect(before.length).toBeGreaterThan(0);

    await db.transaction((tx) => adoptLiveEventCalendar(tx, { now, seasonId: season.id }));

    const after = (await loadMiningSnapshot(db, season.id, now)).asteroids;
    const cutover = at(2, 21);
    const cutoverMinute = minutesSince(START, cutover);
    const afterByIndex = new Map(after.map((rock) => [rock.index, rock]));
    for (const rock of before.filter((candidate) => candidate.expiresAt > nowMinutes)) {
      expect(afterByIndex.get(rock.index)).toEqual(rock);
    }
    // The derived field ends at the cutover; nothing of it appears later.
    expect(after.filter((rock) =>
      dynamicAsteroidHourOf(rock.index) === null && rock.appearsAt >= cutoverMinute)).toEqual([]);

    const [adopted] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(adopted!.asteroidDynamicFrom?.getTime()).toBe(cutover.getTime());
    const hourEvents = await db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, season.id),
      eq(scheduledEvents.kind, 'asteroid_hour'),
    ));
    expect(hourEvents.map((event) => event.resolveAt.getTime())).toEqual([cutover.getTime()]);
  });

  it('replaces every window from the cutover hour on and leaves the rest alone', async () => {
    const { db, season } = await liveSeason();
    const now = at(2, 20, 40);
    const cutover = at(2, 21);
    const before = await occurrences(season.id);

    const report = await db.transaction((tx) =>
      adoptLiveEventCalendar(tx, { now, seasonId: season.id }));
    expect(report).toHaveLength(1);
    expect(report[0]!.deleted).toBeGreaterThan(0);
    expect(report[0]!.inserted).toBeGreaterThan(0);

    const after = await occurrences(season.id);
    // Every window that opened before the cutover — including the open x10 — is untouched.
    const earlier = (rows: typeof after) => rows.filter((row) => row.startsAt < cutover);
    expect(earlier(after)).toEqual(earlier(before));
    // The merchant was never part of it.
    expect(after.filter((row) => row.kind === 'TRADE_SHIP'))
      .toEqual(before.filter((row) => row.kind === 'TRADE_SHIP'));

    const reshaped = after.filter((row) => row.startsAt >= cutover && row.kind !== 'TRADE_SHIP');
    expect(reshaped.length).toBeGreaterThan(0);
    for (const row of reshaped) {
      expect(row.effect).toEqual(plannedEffectFor(row.kind, row.startsAt.getTime() / 60_000, GALAXY_EVENTS));
      expect(row.definitionVersion).toBe(GALAXY_EVENTS.definitions[row.kind].version);
    }
    // Friday 21:00 opens the weekday convoy, Saturday 20:00 the x15 shower.
    expect(reshaped.find((row) => row.startsAt.getTime() === cutover.getTime())?.kind)
      .toBe('INTERGALACTIC_CONVOY');
    expect(reshaped.find((row) => row.startsAt.getTime() === at(3, 20).getTime()
      && row.kind === 'ASTEROID_SHOWER')?.effect).toEqual({ asteroidSpawnMultiplier: 15 });

    // Removed windows took their queue moments with them; new ones brought theirs.
    const moments = await db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, season.id),
      inArray(scheduledEvents.kind, ['galaxy_event_start', 'galaxy_event_end']),
      gte(scheduledEvents.resolveAt, cutover),
    ));
    const liveIds = new Set(after.map((row) => row.id));
    expect(moments.every((moment) => moment.refId !== null && liveIds.has(moment.refId))).toBe(true);
    for (const row of reshaped) {
      expect(moments.filter((moment) => moment.refId === row.id)).toHaveLength(2);
    }

    // Sequences never collide within a kind.
    for (const kind of ['ASTEROID_SHOWER', 'INTERGALACTIC_CONVOY'] as const) {
      const sequences = after.filter((row) => row.kind === kind).map((row) => row.sequence);
      expect(new Set(sequences).size).toBe(sequences.length);
    }
  });

  it('freezes the old shower calendar the derived field was built from', async () => {
    const { db, season } = await liveSeason();
    const now = at(2, 20, 40);
    const showers = (await loadGalaxyEventSchedule(db, season.id, START))
      .filter((event) => event.kind === 'ASTEROID_SHOWER');
    await db.transaction((tx) => adoptLiveEventCalendar(tx, { now, seasonId: season.id }));
    const [adopted] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(adopted!.asteroidLegacyCalendar).toEqual(showers);
  });

  it('changes nothing the second time it is run', async () => {
    const { db, season } = await liveSeason();
    const now = at(2, 20, 40);
    await db.transaction((tx) => adoptLiveEventCalendar(tx, { now, seasonId: season.id }));
    const once = await occurrences(season.id);
    const [first] = await db.select().from(seasons).where(eq(seasons.id, season.id));

    const later = at(2, 20, 50);
    const again = await db.transaction((tx) =>
      adoptLiveEventCalendar(tx, { now: later, seasonId: season.id }));
    expect(again[0]).toMatchObject({ deleted: 0, inserted: 0, frozen: false });
    expect(await occurrences(season.id)).toEqual(once);
    const [second] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(second!.asteroidDynamicFrom).toEqual(first!.asteroidDynamicFrom);
    expect(second!.asteroidLegacyCalendar).toEqual(first!.asteroidLegacyCalendar);
  });

  it('opens the first dynamic hour at the cutover for the people who are playing', async () => {
    const { db, season } = await liveSeason();
    const now = at(2, 20, 40);
    await db.transaction((tx) => adoptLiveEventCalendar(tx, { now, seasonId: season.id }));
    const clock = new FixedClock(at(2, 21));
    await new EventWorker(db, clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();
    const [row] = await db.select().from(asteroidSpawnHours)
      .where(eq(asteroidSpawnHours.seasonId, season.id));
    expect(row?.hourStartsAt.getTime()).toBe(at(2, 21).getTime());
    expect(row?.activePlayers).toBe(0);
  });
});
