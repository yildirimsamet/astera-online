import { and, count, eq, gt, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  ASTEROID_DYNAMIC,
  planAsteroidHour,
  type AsteroidHourLane,
} from '@astera/rules';
import { minutesSince } from '../clock.js';
import type { Db, Queryable } from '../db/client.js';
import {
  asteroidSpawnHours,
  botProfiles,
  galaxyEventOccurrences,
  players,
  scheduledEvents,
  seasons,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';

/**
 * THE DYNAMIC ASTEROID FIELD'S CLOCK. Owner instruction, 2026-09-16:
 * *"Her saat başı aktif oyuncuya bakılır ve önümüzdeki 1 saat ne kadar atılacağı
 * belirlenir."*
 *
 * One `asteroid_hour` event per hour per season. It counts the people who played in
 * the hour just gone, reads which showers cover the hour, stores the lanes and level
 * weights the rules use, and queues the next hour. The rocks themselves are never stored —
 * `asteroidField.ts` derives them from the row — so the row is the whole state, and
 * writing it exactly once is what keeps a rock's identity stable.
 */

export const HOUR_MS = 3_600_000;

export const floorHour = (at: Date): Date =>
  new Date(Math.floor(at.getTime() / HOUR_MS) * HOUR_MS);

const hourKey = (seasonId: string, hourStartsAt: Date): string =>
  `asteroid-hour:${seasonId}:${hourStartsAt.toISOString()}`;

export const asteroidHourPayloadSchema = z.object({
  hourStartsAt: z.string().datetime(),
}).strict();

/** Queue the event that opens one hour. Idempotent on the hour. */
export async function scheduleAsteroidHour(
  db: Queryable,
  input: { seasonId: string; hourStartsAt: Date; resolveAt?: Date },
): Promise<void> {
  await schedule(db, {
    seasonId: input.seasonId,
    kind: 'asteroid_hour',
    dedupeKey: hourKey(input.seasonId, input.hourStartsAt),
    payload: { hourStartsAt: input.hourStartsAt.toISOString() },
    resolveAt: input.resolveAt ?? input.hourStartsAt,
  });
}

/**
 * THE COMMANDERS WHO COUNT FOR THE NEXT HOUR: people, in this season, who played in
 * the last `activeWindowMinutes`. Owner instruction: *"bot hesaplar bu aktif sayıya
 * dahil edilmemeli."* A bot stamps `last_active_at` while its roster is awake, so it
 * is excluded by its profile row rather than by its activity.
 */
export async function countActiveCommanders(
  db: Queryable,
  seasonId: string,
  at: Date,
): Promise<number> {
  const since = new Date(at.getTime() - ASTEROID_DYNAMIC.activeWindowMinutes * 60_000);
  const [row] = await db
    .select({ n: count() })
    .from(players)
    .leftJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .where(and(
      eq(players.seasonId, seasonId),
      gte(players.lastActiveAt, since),
      isNull(botProfiles.accountId),
    ));
  return row?.n ?? 0;
}

const showerEffect = z.object({ asteroidSpawnMultiplier: z.number().finite().gt(1) });

/**
 * OPEN ONE HOUR. Runs from the worker; safe to run twice.
 *
 * A LATE HOUR IS PAID FOR WHAT IS LEFT OF IT. Within `lateStartGraceMinutes` of the
 * hour the whole hour is planned; later than that, spawning starts now. An hour that
 * has already ended is not opened at all — a worker coming back from an outage does
 * not drop missed hours into the sky at once — and the hour that is running now is
 * queued in its place.
 */
export async function openAsteroidHour(
  db: Db,
  input: { seasonId: string; hourStartsAt: Date; now: Date },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [season] = await tx.select().from(seasons)
      .where(eq(seasons.id, input.seasonId))
      .for('share');
    if (season?.status !== 'live' || season.asteroidDynamicFrom === null) return;

    const hourStart = floorHour(input.hourStartsAt);
    const hourEnd = new Date(hourStart.getTime() + HOUR_MS);
    if (hourStart >= season.endsAt) return;

    const queueNext = async (hourStartsAt: Date, resolveAt?: Date) => {
      if (hourStartsAt < season.endsAt) {
        await scheduleAsteroidHour(tx, { seasonId: season.id, hourStartsAt, resolveAt });
      }
    };

    if (input.now >= hourEnd) {
      const current = floorHour(input.now);
      await queueNext(current, current.getTime() === input.now.getTime() ? undefined : input.now);
      return;
    }
    if (hourEnd <= season.asteroidDynamicFrom) {
      await queueNext(floorHour(season.asteroidDynamicFrom), season.asteroidDynamicFrom);
      return;
    }

    const lateMinutes = (input.now.getTime() - hourStart.getTime()) / 60_000;
    const earliest = new Date(Math.max(
      hourStart.getTime(),
      season.asteroidDynamicFrom.getTime(),
      season.startsAt.getTime(),
    ));
    const spawnFrom = lateMinutes > ASTEROID_DYNAMIC.lateStartGraceMinutes && input.now > earliest
      ? input.now
      : earliest;

    const activePlayers = await countActiveCommanders(tx, season.id, input.now > hourStart ? input.now : hourStart);
    const showerRows = await tx.select().from(galaxyEventOccurrences).where(and(
      eq(galaxyEventOccurrences.seasonId, season.id),
      eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      lt(galaxyEventOccurrences.startsAt, hourEnd),
      gt(galaxyEventOccurrences.endsAt, hourStart),
    ));
    const lanes = planAsteroidHour({
      activePlayers,
      hourStartsAtMinute: minutesSince(season.startsAt, hourStart),
      spawnFromMinute: minutesSince(season.startsAt, spawnFrom),
      seasonEndsAtMinute: minutesSince(season.startsAt, season.endsAt),
      showers: showerRows.map((row) => ({
        startsAtMinute: minutesSince(season.startsAt, row.startsAt),
        endsAtMinute: minutesSince(season.startsAt, row.endsAt),
        multiplier: showerEffect.parse(row.effect).asteroidSpawnMultiplier,
      })),
    });

    const inserted = await tx.insert(asteroidSpawnHours).values({
      seasonId: season.id,
      hourStartsAt: hourStart,
      spawnFrom,
      activePlayers,
      lanes,
      levelWeights: ASTEROID_DYNAMIC.levelWeights,
      createdAt: input.now,
    }).onConflictDoNothing().returning({ seasonId: asteroidSpawnHours.seasonId });

    await queueNext(hourEnd);
    // New rocks are about to appear: the field projection and every open disc refetch.
    if (inserted.length > 0 && lanes.length > 0) await publishShard(tx, season.id, 'mining');
  });
}

/**
 * AFTER A RESTART, MAKE SURE EVERY DYNAMIC SEASON HAS ITS NEXT HOUR QUEUED.
 *
 * The chain is self-scheduling, so one lost event would stop a galaxy's rocks for
 * good. This queues the running hour (if it has no row yet) and the next boundary;
 * dedupe keys make it a no-op wherever the chain is intact. Returns how many events
 * it actually added.
 */
export async function ensureAsteroidHourEvents(db: Db, now: Date): Promise<number> {
  const live = await db.select().from(seasons).where(and(
    eq(seasons.status, 'live'),
    isNotNull(seasons.asteroidDynamicFrom),
    gt(seasons.endsAt, now),
  ));
  let added = 0;
  for (const season of live) {
    const from = season.asteroidDynamicFrom;
    if (from === null) continue;
    const wanted: { hourStartsAt: Date; resolveAt: Date }[] = [];
    if (from > now) {
      wanted.push({ hourStartsAt: floorHour(from), resolveAt: from });
    } else {
      const current = floorHour(now);
      const [row] = await db.select({ at: asteroidSpawnHours.hourStartsAt })
        .from(asteroidSpawnHours)
        .where(and(
          eq(asteroidSpawnHours.seasonId, season.id),
          eq(asteroidSpawnHours.hourStartsAt, current),
        ));
      if (!row) wanted.push({ hourStartsAt: current, resolveAt: now });
      const next = new Date(current.getTime() + HOUR_MS);
      if (next < season.endsAt) wanted.push({ hourStartsAt: next, resolveAt: next });
    }
    for (const event of wanted) {
      const [queued] = await db.select({ id: scheduledEvents.id })
        .from(scheduledEvents)
        .where(eq(scheduledEvents.dedupeKey, hourKey(season.id, event.hourStartsAt)));
      if (queued) continue;
      await scheduleAsteroidHour(db, { seasonId: season.id, ...event });
      added += 1;
    }
  }
  return added;
}

/** The stored hours a field read at `now` still needs. See `FIELD_LOOKBACK_HOURS`. */
export async function loadAsteroidHours(
  db: Queryable,
  seasonId: string,
  now: Date,
): Promise<{
  hourStartsAt: Date;
  lanes: AsteroidHourLane[];
  levelWeights: number[];
}[]> {
  const rows = await db.select({
    hourStartsAt: asteroidSpawnHours.hourStartsAt,
    lanes: asteroidSpawnHours.lanes,
    levelWeights: asteroidSpawnHours.levelWeights,
  }).from(asteroidSpawnHours).where(and(
    eq(asteroidSpawnHours.seasonId, seasonId),
    gte(asteroidSpawnHours.hourStartsAt, new Date(now.getTime() - FIELD_LOOKBACK_HOURS * HOUR_MS)),
  )).orderBy(asteroidSpawnHours.hourStartsAt);
  return rows.map((row) => ({
    hourStartsAt: row.hourStartsAt,
    lanes: lanesSchema.parse(row.lanes),
    levelWeights: levelWeightsSchema.parse(row.levelWeights),
  }));
}

/**
 * HOW FAR BACK A FIELD READ LOOKS. A rock of hour H lives until at most H + 1h + 5h;
 * a craft returning from it is still drawn for its return leg. Twelve hours covers
 * both with room, and bounds the field a read has to derive.
 */
export const FIELD_LOOKBACK_HOURS = 12;

const lanesSchema = z.array(z.object({
  fromMinute: z.number().finite(),
  untilMinute: z.number().finite(),
  count: z.number().int().nonnegative(),
  frontCount: z.number().int().nonnegative(),
}).strict());

const levelWeightsSchema = z.array(z.number().finite().nonnegative()).min(2)
  .refine((weights) => weights.slice(1).some((weight) => weight > 0));
