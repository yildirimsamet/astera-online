import { and, desc, eq, gt, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  ASTEROID_DYNAMIC,
  MULTI_WORLD,
  planAsteroidHour,
  supplyPopulation,
  planPirateHour,
  type AsteroidHourLane,
  type PirateHourLane,
} from '@astera/rules';
import { minutesSince } from '../clock.js';
import type { Db, Queryable } from '../db/client.js';
import {
  accounts,
  buildings,
  planets,
  asteroidSpawnHours,
  galaxyEventOccurrences,
  players,
  scheduledEvents,
  seasons,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { isPerson } from './people.js';

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
 * WHO PAYS FOR THE SKY: PEOPLE, AND ONLY PEOPLE. Owner instruction, 2026-09-26:
 * *"Asteroid ve korsan spawn oranları botları hesaba katmasın"* — and the showers
 * too. This one count sizes the hour's rocks, a shower's multiple of them and the
 * hour's pirates, so filtering it here filters all three. It reverses 2026-09-19,
 * which counted awake bots because a quiet galaxy left them nothing to mine or hunt;
 * the server's commanders now go on duty only while people are playing
 * (`bots/population.ts`), so the field is never theirs alone. A retired bot keeps
 * its `bot_profiles` row and stays out with the rest (`isPerson`).
 *
 * Plan §15.6 — *"Sybil sınırı şart"*. One rock an hour per active commander is the right rule and
 * an open door: a raw `lastActiveAt` sweep lets a hundred free accounts logging in buy a hundred
 * rocks an hour for whoever made them. The gate is the two things a fake account does not have — a
 * DAY in the season and a CORE that took real production to raise.
 *
 * BOTH, NOT EITHER. The plan writes "24 saat / küçük Core eşiği"; read as OR it defends nothing,
 * because a throwaway passes the clock by doing nothing for a day and a script passes a small Core
 * in minutes. Required together they cost a day AND production per fake commander.
 *
 * AND ONLY OF COMMANDERS WHO ARRIVED AFTER THE DOORS OPENED. Sybil is about INJECTING accounts
 * into a running galaxy; everybody present at the start is the baseline population, not an
 * injection. Gating them too would empty the sky for a season's first day — which is the one day
 * a new commander decides whether this game is worth playing, and the exact opening the whole
 * chat-log analysis is about. So a founder counts from the first hour, and a late arrival serves
 * the day and raises the Core.
 *
 * NOR IS AN ACCOUNT OLDER THAN THE SEASON. Owner instruction, 2026-09-27: *"Var olan eski
 * userlar legit sayılmalı."* An account that existed before the doors opened was made for an
 * earlier galaxy, not to inflate this one, so a veteran who comes back on day five counts from the
 * hour they play. Only accounts opened after the season started serve the day and the Core.
 *
 * A NEW COMMANDER IS NOT LOCKED OUT OF ANYTHING EITHER WAY — they fly at the same field. This
 * decides only what they ADD to it.
 *
 * The Core is the commander's best world, read the way `peakCoreLevels` reads it, so a second
 * colony cannot dilute the figure.
 */
export async function countEligibleCommanders(
  db: Queryable,
  seasonId: string,
  at: Date,
): Promise<number> {
  const [season] = await db
    .select({ startsAt: seasons.startsAt })
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  if (!season) return 0;
  const grace = ASTEROID_DYNAMIC.supply.graceMinutes * 60_000;
  const activeSince = new Date(at.getTime() - ASTEROID_DYNAMIC.activeWindowMinutes * 60_000);
  const foundedBy = new Date(season.startsAt.getTime() + grace);
  const joinedBefore = new Date(at.getTime() - grace);
  const rows = await db
    .select({
      playerId: players.id,
      joinedAt: players.joinedAt,
      accountCreatedAt: accounts.createdAt,
      peak: sql<number>`max(${buildings.level})::int`,
    })
    .from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .innerJoin(planets, eq(planets.controllerPlayerId, players.id))
    .innerJoin(buildings, and(eq(buildings.planetId, planets.id), eq(buildings.type, 'CORE')))
    .where(and(
      eq(players.seasonId, seasonId),
      gte(players.lastActiveAt, activeSince),
      isPerson,
    ))
    .groupBy(players.id, accounts.createdAt);
  return rows.filter((row) => row.accountCreatedAt < season.startsAt
    || row.joinedAt <= foundedBy
    || (row.joinedAt <= joinedBefore && row.peak >= ASTEROID_DYNAMIC.supply.coreLevel)).length;
}

/**
 * THE FIGURE THE HOUR ACTUALLY SPAWNS AGAINST — the rolling mean of recent eligible counts.
 *
 * The window reads the RAW counts each hour recorded, never the smoothed figures they produced:
 * averaging its own output filters twice and a genuine rise would crawl toward the truth without
 * ever arriving. See `supplyPopulation`.
 *
 * NOT DURING THE FOUNDING DAY. Owner decision, 2026-09-27. A new season's first hour opens before
 * anybody has joined it and is written at zero; averaged in, that zero held back ~40% of the rocks
 * of the next five hours exactly while the galaxy was filling. The founders are the baseline
 * population (see `countEligibleCommanders`), not a spike to damp, so for the season's first
 * `graceMinutes` an hour spawns against its own count. The window reads those raw counts as usual
 * afterwards, so day two starts from what day one really held.
 */
async function rollingSupply(
  db: Queryable,
  season: { id: string; startsAt: Date },
  hourStart: Date,
  eligibleNow: number,
): Promise<number> {
  const foundingEnds = season.startsAt.getTime() + ASTEROID_DYNAMIC.supply.graceMinutes * 60_000;
  if (hourStart.getTime() < foundingEnds) return eligibleNow;
  const rows = await db
    .select({ eligible: asteroidSpawnHours.eligiblePlayers })
    .from(asteroidSpawnHours)
    .where(and(
      eq(asteroidSpawnHours.seasonId, season.id),
      lt(asteroidSpawnHours.hourStartsAt, hourStart),
    ))
    .orderBy(desc(asteroidSpawnHours.hourStartsAt))
    .limit(ASTEROID_DYNAMIC.supply.windowHours - 1);
  return supplyPopulation(eligibleNow, rows.map((row) => row.eligible));
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

    /*
      TWO FIGURES, TWO QUESTIONS. `eligiblePlayers` is what the galaxy actually held this hour —
      the input the rolling window averages. `activePlayers` is what the hour SPAWNS against, and
      it is frozen with the lanes so a rock's identity survives every later balance change.
    */
    const countAt = input.now > hourStart ? input.now : hourStart;
    const eligiblePlayers = await countEligibleCommanders(tx, season.id, countAt);
    const activePlayers = await rollingSupply(tx, season, hourStart, eligiblePlayers);
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

    /*
      THE SAME COUNT SIZES THE PIRATES (ruleset 9, `PIRATE.dynamic`). One clock, one
      active count, one row: a pirate hour can never disagree with its rock hour
      about who was playing. A season created earlier keeps its derived lane.
    */
    const pirateLane = season.rulesetVersion >= MULTI_WORLD.dynamicPirateRulesetVersion
      ? planPirateHour({
        activePlayers,
        hourStartsAtMinute: minutesSince(season.startsAt, hourStart),
        spawnFromMinute: minutesSince(season.startsAt, spawnFrom),
        seasonEndsAtMinute: minutesSince(season.startsAt, season.endsAt),
      })
      : null;

    const inserted = await tx.insert(asteroidSpawnHours).values({
      seasonId: season.id,
      hourStartsAt: hourStart,
      spawnFrom,
      activePlayers,
      eligiblePlayers,
      lanes,
      levelWeights: ASTEROID_DYNAMIC.levelWeights,
      pirateLane,
      createdAt: input.now,
    }).onConflictDoNothing().returning({ seasonId: asteroidSpawnHours.seasonId });

    await queueNext(hourEnd);
    // New rocks are about to appear: the field projection and every open disc refetch.
    if (inserted.length > 0 && lanes.length > 0) await publishShard(tx, season.id, 'mining');
    // And new pirates: the shared pirate snapshot is cached until this says otherwise.
    if (inserted.length > 0 && pirateLane !== null) await publishShard(tx, season.id, 'pirate');
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

/** A stored pirate lane, parsed at the boundary like the rock lanes. */
export const pirateLaneSchema = z.object({
  fromMinute: z.number().finite(),
  untilMinute: z.number().finite(),
  count: z.number().int().nonnegative(),
}).strict();

/**
 * The stored pirate hours a pirate read at `now` still needs, with their ordinals.
 * A pirate lives at most `PIRATE.lifeHoursMax` after its hour; the same lookback as
 * the rocks covers that and a raid still flying home from one.
 */
export async function loadPirateHours(
  db: Queryable,
  season: { id: string; startsAt: Date },
  now: Date,
): Promise<{ hourOrdinal: number; lane: PirateHourLane }[]> {
  const rows = await db.select({
    hourStartsAt: asteroidSpawnHours.hourStartsAt,
    lane: asteroidSpawnHours.pirateLane,
  }).from(asteroidSpawnHours).where(and(
    eq(asteroidSpawnHours.seasonId, season.id),
    gte(asteroidSpawnHours.hourStartsAt, new Date(now.getTime() - FIELD_LOOKBACK_HOURS * HOUR_MS)),
    lte(asteroidSpawnHours.hourStartsAt, now),
    isNotNull(asteroidSpawnHours.pirateLane),
  )).orderBy(asteroidSpawnHours.hourStartsAt);
  return rows.map((row) => ({
    hourOrdinal: hourOrdinalOf(season.startsAt, row.hourStartsAt),
    lane: pirateLaneSchema.parse(row.lane),
  }));
}

/** One stored pirate hour by its ordinal, or null if it was never written. */
export async function loadPirateHour(
  db: Queryable,
  season: { id: string; startsAt: Date },
  hourOrdinal: number,
): Promise<PirateHourLane | null> {
  const hourStartsAt = new Date(floorHour(season.startsAt).getTime() + hourOrdinal * HOUR_MS);
  const [row] = await db.select({ lane: asteroidSpawnHours.pirateLane })
    .from(asteroidSpawnHours)
    .where(and(eq(asteroidSpawnHours.seasonId, season.id), eq(asteroidSpawnHours.hourStartsAt, hourStartsAt)));
  return row?.lane == null ? null : pirateLaneSchema.parse(row.lane);
}

/** The hour's ordinal from the season's first hour — the one `mining.ts` uses too. */
export const hourOrdinalOf = (seasonStartsAt: Date, hourStartsAt: Date): number =>
  Math.round((hourStartsAt.getTime() - floorHour(seasonStartsAt).getTime()) / HOUR_MS);

const levelWeightsSchema = z.array(z.number().finite().nonnegative()).min(2)
  .refine((weights) => weights.slice(1).some((weight) => weight > 0));
