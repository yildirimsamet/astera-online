import { createHmac } from 'node:crypto';
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import {
  GALAXY_EVENTS,
  MULTI_WORLD,
  generateGalaxyEventSchedule,
  type PlannedGalaxyEvent,
} from '@astera/rules';
import { z } from 'zod';
import type { Clock } from '../clock.js';
import { addMinutes, minutesSince } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  galaxyEventOccurrences,
  notifications,
  players,
  scheduledEvents,
  seasons,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { recordGalaxyEvent } from './chronicle.js';
import { GameError } from './planet.js';

const effectSchema = z.object({
  asteroidSpawnMultiplier: z.number().finite().gt(1),
}).strict();

function calendarRng(asteroidKey: string): () => number {
  let counter = 0;
  return () => {
    const digest = createHmac('sha256', asteroidKey)
      .update(`galaxy-events:v1:${String(counter)}`)
      .digest();
    counter += 1;
    return digest.readUInt32BE(0) / 0x1_0000_0000;
  };
}

/** Seed occurrences and their two queue moments in the season-creation transaction. */
export async function seedGalaxyEventCalendar(
  tx: Tx,
  season: typeof seasons.$inferSelect,
): Promise<void> {
  if (season.rulesetVersion < MULTI_WORLD.galaxyEventsRulesetVersion) return;
  const durationMinutes = minutesSince(season.startsAt, season.endsAt);
  const plan = generateGalaxyEventSchedule({
    seasonStartsAtUnixMinute: season.startsAt.getTime() / 60_000,
    seasonDurationMinutes: durationMinutes,
    rng: calendarRng(season.asteroidKey),
  });
  if (plan.length === 0) return;

  const inserted = await tx
    .insert(galaxyEventOccurrences)
    .values(plan.map((event) => ({
      seasonId: season.id,
      sequence: event.sequence,
      kind: event.kind,
      definitionVersion: event.definitionVersion,
      startsAt: addMinutes(season.startsAt, event.startsAtMinute),
      endsAt: addMinutes(season.startsAt, event.endsAtMinute),
      effect: event.effect,
      createdAt: season.startsAt,
    })))
    .returning({
      id: galaxyEventOccurrences.id,
      startsAt: galaxyEventOccurrences.startsAt,
      endsAt: galaxyEventOccurrences.endsAt,
    });

  await tx.insert(scheduledEvents).values(inserted.flatMap((occurrence) => [
    {
      seasonId: season.id,
      kind: 'galaxy_event_start' as const,
      refId: occurrence.id,
      dedupeKey: `galaxy-event:start:${occurrence.id}`,
      resolveAt: occurrence.startsAt,
    },
    {
      seasonId: season.id,
      kind: 'galaxy_event_end' as const,
      refId: occurrence.id,
      dedupeKey: `galaxy-event:end:${occurrence.id}`,
      resolveAt: occurrence.endsAt,
    },
  ]));
}

/** Repair only missing queue rows for already-persisted live-season occurrences. */
export async function ensureGalaxyEventLifecycleEvents(db: Db): Promise<number> {
  const occurrences = await db
    .select({
      id: galaxyEventOccurrences.id,
      seasonId: galaxyEventOccurrences.seasonId,
      startsAt: galaxyEventOccurrences.startsAt,
      endsAt: galaxyEventOccurrences.endsAt,
    })
    .from(galaxyEventOccurrences)
    .innerJoin(seasons, eq(galaxyEventOccurrences.seasonId, seasons.id))
    .where(eq(seasons.status, 'live'));
  if (occurrences.length === 0) return 0;

  const inserted = await db
    .insert(scheduledEvents)
    .values(occurrences.flatMap((occurrence) => [
      {
        seasonId: occurrence.seasonId,
        kind: 'galaxy_event_start' as const,
        refId: occurrence.id,
        dedupeKey: `galaxy-event:start:${occurrence.id}`,
        resolveAt: occurrence.startsAt,
      },
      {
        seasonId: occurrence.seasonId,
        kind: 'galaxy_event_end' as const,
        refId: occurrence.id,
        dedupeKey: `galaxy-event:end:${occurrence.id}`,
        resolveAt: occurrence.endsAt,
      },
    ]))
    .onConflictDoNothing({ target: scheduledEvents.dedupeKey })
    .returning({ id: scheduledEvents.id });
  return inserted.length;
}

/** Immutable rules projection used only by the server-private asteroid field. */
export async function loadGalaxyEventSchedule(
  db: Queryable,
  seasonId: string,
  seasonStartsAt: Date,
): Promise<PlannedGalaxyEvent[]> {
  const rows = await db
    .select()
    .from(galaxyEventOccurrences)
    .where(eq(galaxyEventOccurrences.seasonId, seasonId))
    .orderBy(asc(galaxyEventOccurrences.sequence));
  return rows.map((row) => ({
    sequence: row.sequence,
    kind: row.kind,
    startsAtMinute: minutesSince(seasonStartsAt, row.startsAt),
    endsAtMinute: minutesSince(seasonStartsAt, row.endsAt),
    definitionVersion: row.definitionVersion,
    effect: effectSchema.parse(row.effect),
  }));
}

export interface ActiveGalaxyEventView {
  id: string;
  kind: 'ASTEROID_SHOWER';
  startsAt: Date;
  endsAt: Date;
  asteroidSpawnMultiplier: number;
}

/**
 * Serialize changes to the season's notification audience with lifecycle fanout.
 * Membership changes share the row; a lifecycle transition takes it exclusively.
 */
export async function lockGalaxyEventAudience(
  tx: Tx,
  seasonId: string,
  purpose: 'membership' | 'lifecycle',
): Promise<void> {
  const [season] = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .for(purpose === 'membership' ? 'share' : 'update');
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
}

/** Authenticated, active-only surface. Future occurrence timestamps never leave the server. */
export async function activeGalaxyEvents(
  db: Db,
  accountId: string,
  clock: Clock,
): Promise<ActiveGalaxyEventView[]> {
  const [me] = await db
    .select({ seasonId: players.seasonId })
    .from(players)
    .where(eq(players.accountId, accountId))
    .limit(1);
  if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  const now = clock.now();
  const rows = await db
    .select()
    .from(galaxyEventOccurrences)
    .where(and(
      eq(galaxyEventOccurrences.seasonId, me.seasonId),
      lte(galaxyEventOccurrences.startsAt, now),
      gt(galaxyEventOccurrences.endsAt, now),
    ))
    .orderBy(asc(galaxyEventOccurrences.startsAt));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    asteroidSpawnMultiplier: effectSchema.parse(row.effect).asteroidSpawnMultiplier,
  }));
}

type Lifecycle = 'start' | 'end';

async function claimLifecycle(
  tx: Tx,
  occurrenceId: string,
  seasonId: string,
  lifecycle: Lifecycle,
  processedAt: Date,
) {
  return lifecycle === 'start'
    ? (await tx
        .update(galaxyEventOccurrences)
        .set({ startProcessedAt: processedAt })
        .where(and(
          eq(galaxyEventOccurrences.id, occurrenceId),
          eq(galaxyEventOccurrences.seasonId, seasonId),
          isNull(galaxyEventOccurrences.startProcessedAt),
        ))
        .returning())[0]
    : (await tx
        .update(galaxyEventOccurrences)
        .set({ endProcessedAt: processedAt })
        .where(and(
          eq(galaxyEventOccurrences.id, occurrenceId),
          eq(galaxyEventOccurrences.seasonId, seasonId),
          isNull(galaxyEventOccurrences.endProcessedAt),
        ))
        .returning())[0];
}

/** One bulk INSERT and one shard invalidation, even with three hundred players. */
async function notifySeason(
  tx: Tx,
  occurrence: typeof galaxyEventOccurrences.$inferSelect,
  lifecycle: Lifecycle,
): Promise<void> {
  const audience = await tx
    .select({ id: players.id })
    .from(players)
    .where(eq(players.seasonId, occurrence.seasonId));
  if (audience.length === 0) return;
  const effect = effectSchema.parse(occurrence.effect);
  await tx
    .insert(notifications)
    .values(audience.map(({ id }) => ({
      playerId: id,
      kind: lifecycle === 'start' ? 'galaxy_event_started' as const : 'galaxy_event_ended' as const,
      refId: occurrence.id,
      createdAt: lifecycle === 'start' ? occurrence.startsAt : occurrence.endsAt,
      payload: {
        eventKind: occurrence.kind,
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString(),
        asteroidSpawnMultiplier: effect.asteroidSpawnMultiplier,
      },
    })))
    .onConflictDoNothing();
}

/** Idempotent lifecycle side effects; gameplay authority is the occurrence clock, not this worker. */
export async function processGalaxyEventLifecycle(
  db: Db,
  input: { occurrenceId: string; seasonId: string; lifecycle: Lifecycle; processedAt: Date },
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockGalaxyEventAudience(tx, input.seasonId, 'lifecycle');
    const occurrence = await claimLifecycle(
      tx,
      input.occurrenceId,
      input.seasonId,
      input.lifecycle,
      input.processedAt,
    );
    if (!occurrence) return;
    const effect = effectSchema.parse(occurrence.effect);
    await notifySeason(tx, occurrence, input.lifecycle);
    await recordGalaxyEvent(tx, {
      seasonId: occurrence.seasonId,
      kind: input.lifecycle === 'start' ? 'galaxy_event_started' : 'galaxy_event_ended',
      refId: occurrence.id,
      subjectPlanetId: null,
      payload: {
        eventKind: occurrence.kind,
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString(),
        asteroidSpawnMultiplier: effect.asteroidSpawnMultiplier,
      },
      occurredAt: input.lifecycle === 'start' ? occurrence.startsAt : occurrence.endsAt,
    });
    await publishShard(tx, occurrence.seasonId, 'galaxy-event');
  });
}

/** Backfill only an event that is active at the exact join instant. */
export async function notifyActiveGalaxyEventsForPlayer(
  tx: Tx,
  input: { playerId: string; seasonId: string; at: Date },
): Promise<void> {
  const rows = await tx
    .select()
    .from(galaxyEventOccurrences)
    .where(and(
      eq(galaxyEventOccurrences.seasonId, input.seasonId),
      lte(galaxyEventOccurrences.startsAt, input.at),
      gt(galaxyEventOccurrences.endsAt, input.at),
    ));
  if (rows.length === 0) return;
  await tx.insert(notifications).values(rows.map((occurrence) => ({
    playerId: input.playerId,
    kind: 'galaxy_event_started' as const,
    refId: occurrence.id,
    createdAt: occurrence.startsAt,
    payload: {
      eventKind: occurrence.kind,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      asteroidSpawnMultiplier: effectSchema.parse(occurrence.effect).asteroidSpawnMultiplier,
    },
  }))).onConflictDoNothing();
}

export const galaxyEventConfig = GALAXY_EVENTS;
