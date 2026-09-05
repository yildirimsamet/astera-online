import { createHmac } from 'node:crypto';
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import {
  GALAXY_EVENTS,
  MULTI_WORLD,
  generateGalaxyEventSchedule,
  type GalaxyEventKind,
  type OrbitElements,
  type PlannedGalaxyEvent,
  type TradeRate,
  type TradeShipSpec,
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
  type GalaxyEventLifecyclePayload,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { recordGalaxyEvent } from './chronicle.js';
import { tradeShipOf } from './tradeField.js';
import { GameError } from './planet.js';

const showerEffectSchema = z.object({
  asteroidSpawnMultiplier: z.number().finite().gt(1),
}).strict();

const tradeRateSchema = z.object({
  alloy: z.number().finite().positive(),
  crystal: z.number().finite().positive(),
  deuterium: z.number().finite().positive(),
}).strict();

const tradeEffectSchema = z.object({ rate: tradeRateSchema }).strict();

/**
 * THE PERSISTED `kind` COLUMN IS THE DISCRIMINATOR, BECAUSE THE JSONB HAS NONE.
 *
 * This used to be one flat object schema and four call sites that read
 * `.asteroidSpawnMultiplier` off it unconditionally — `activeGalaxyEvents`,
 * `notifySeason`, `processGalaxyEventLifecycle` and
 * `notifyActiveGalaxyEventsForPlayer`. The first TRADE_SHIP occurrence in any
 * season would have thrown in all four, and one of those runs inside the worker:
 * a lifecycle handler that raises stops the event queue, which is D47's outage —
 * no fleet in the galaxy lands again and `/health` still says ok.
 *
 * Pairing the column with the payload and discriminating on it also refuses a row
 * whose effect does not match its kind, which a bare `z.union` of two `.strict()`
 * objects would have quietly accepted in the wrong lane if the shapes ever
 * converged.
 */
const effectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ASTEROID_SHOWER'), effect: showerEffectSchema }).strict(),
  z.object({ kind: z.literal('TRADE_SHIP'), effect: tradeEffectSchema }).strict(),
]);

type OccurrenceEffect = z.infer<typeof effectSchema>;

/** Parse one persisted row into its kind-tagged effect. The only reader of `effect`. */
const occurrenceEffect = (
  row: { kind: GalaxyEventKind; effect: unknown },
): OccurrenceEffect => effectSchema.parse({ kind: row.kind, effect: row.effect });

/**
 * ONE HMAC STREAM PER KIND, AND THE SHOWER'S LABEL IS FROZEN.
 *
 * A season's calendar is dealt once at creation and persisted, so a change that
 * re-deals it fails nowhere — every future season would just quietly be a
 * different season, and the Asteroid Shower has been live since D149. Its label
 * therefore stays `galaxy-events:v1:<n>` byte for byte; the merchant gets its own
 * namespace, which cannot collide because `trade-ship` is not a number.
 */
const CALENDAR_LABEL: Record<GalaxyEventKind, string> = {
  ASTEROID_SHOWER: 'galaxy-events:v1',
  TRADE_SHIP: 'galaxy-events:trade-ship:v1',
};

function calendarRng(asteroidKey: string, kind: GalaxyEventKind): () => number {
  let counter = 0;
  const label = CALENDAR_LABEL[kind];
  return () => {
    const digest = createHmac('sha256', asteroidKey)
      .update(`${label}:${String(counter)}`)
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
  /*
    ONE LANE PER RULESET BOUNDARY, AND THE OLDER SEASONS KEEP THEIR CALENDAR. D156.

    `generateGalaxyEventSchedule` is multi-kind, so this asks for a stream per kind
    rather than handing over one generator. A ruleset-4 season is entitled to the
    Asteroid Shower alone and is dealt exactly the calendar it has always been
    dealt — same kind, same stream, same HMAC sequence, byte for byte. The merchant
    is gated on its own boundary rather than on `galaxyEventsRulesetVersion`,
    because raising that to 5 would have stopped seeding showers for every
    ruleset-4 season still alive.

    `rngFor` is asked once per planned kind and memoised here anyway: a stream that
    was rebuilt mid-deal would restart at counter zero and re-deal what it had
    already dealt.
  */
  const kinds: GalaxyEventKind[] = ['ASTEROID_SHOWER'];
  if (season.rulesetVersion >= MULTI_WORLD.tradeShipRulesetVersion) kinds.push('TRADE_SHIP');
  const streams = new Map<GalaxyEventKind, () => number>();
  const plan = generateGalaxyEventSchedule({
    seasonStartsAtUnixMinute: season.startsAt.getTime() / 60_000,
    seasonDurationMinutes: durationMinutes,
    rngFor: (kind) => {
      const existing = streams.get(kind);
      if (existing) return existing;
      const stream = calendarRng(season.asteroidKey, kind);
      streams.set(kind, stream);
      return stream;
    },
    kinds,
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
    /*
      ORDERED BY KIND THEN SEQUENCE, SO THE ROW ORDER IS TOTAL.

      `sequence` alone stopped being a unique key the day a second lane arrived,
      and a tie the database is free to break either way would make
      `privateAsteroidFieldWithEvents`'s cache signature unstable for one
      unchanged calendar — a miss on every read rather than a wrong field, but the
      cache exists because generation is not free. The composed field itself is
      order-independent: `withAsteroidShowerLanes` filters and re-sorts the
      showers internally.
    */
    .orderBy(asc(galaxyEventOccurrences.kind), asc(galaxyEventOccurrences.sequence));
  return rows.map((row) => {
    const base = {
      sequence: row.sequence,
      startsAtMinute: minutesSince(seasonStartsAt, row.startsAt),
      endsAtMinute: minutesSince(seasonStartsAt, row.endsAt),
      definitionVersion: row.definitionVersion,
    };
    const parsed = occurrenceEffect(row);
    return parsed.kind === 'ASTEROID_SHOWER'
      ? { ...base, kind: parsed.kind, effect: parsed.effect }
      : { ...base, kind: parsed.kind, effect: parsed.effect };
  });
}

interface ActiveGalaxyEventBase {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * WHAT AN ACTIVE PUBLIC EVENT LOOKS LIKE ON THE WIRE. D149/D156.
 *
 * A discriminated union rather than a widened object, because the two kinds share
 * a clock and nothing else, and a client that had to guess which fields were
 * present would guess wrong exactly once.
 *
 * THE MERCHANT PUBLISHES ITS ORBIT, AND THAT IS CORRECT HERE AND ONLY HERE. A
 * pirate's orbital elements ARE its route, and D150 keeps them server-private
 * because a pirate is a private opportunity that sight is sold for. A trade ship
 * is an announced moment — fog hides pre-decision knowledge, never a public live
 * event — so the disc may draw the whole circle. `asteroidSchema` already
 * publishes exactly these six numbers for a discovered rock, and handing them over
 * is what lets the launch screen run the same shared `interceptOrbit` the server
 * runs: without it the sheet and the server would disagree about the meeting
 * minute, which is the one number a convoy is committed against.
 *
 * IT STAYS GATED TO THE OCCURRENCE THAT IS ACTIVE RIGHT NOW. The future calendar
 * never leaves the server, so no elements are derived for a merchant that has not
 * appeared and none survive one that has gone.
 */
export type ActiveGalaxyEventView =
  | (ActiveGalaxyEventBase & {
      kind: 'ASTEROID_SHOWER';
      asteroidSpawnMultiplier: number;
    })
  | (ActiveGalaxyEventBase & {
      kind: 'TRADE_SHIP';
      rate: TradeRate;
      /** Minutes since season start — the same clock `orbit` is evaluated on. */
      appearsAtMinute: number;
      expiresAtMinute: number;
      orbit: OrbitElements;
    });

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
    .select({
      seasonId: players.seasonId,
      seasonStartsAt: seasons.startsAt,
      asteroidKey: seasons.asteroidKey,
    })
    .from(players)
    .innerJoin(seasons, eq(players.seasonId, seasons.id))
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

  return rows.map((row): ActiveGalaxyEventView => {
    const base = { id: row.id, startsAt: row.startsAt, endsAt: row.endsAt };
    const parsed = occurrenceEffect(row);
    if (parsed.kind === 'ASTEROID_SHOWER') {
      return {
        ...base,
        kind: parsed.kind,
        asteroidSpawnMultiplier: parsed.effect.asteroidSpawnMultiplier,
      };
    }
    /*
      The ship is derived from the same season secret and the same occurrence the
      server solves a rendezvous against, so the circle the client draws and the
      circle the server aims at are one object, not two that have to agree.
    */
    const spec = tradeShipOf(me.asteroidKey, {
      sequence: row.sequence,
      kind: parsed.kind,
      startsAtMinute: minutesSince(me.seasonStartsAt, row.startsAt),
      endsAtMinute: minutesSince(me.seasonStartsAt, row.endsAt),
      definitionVersion: row.definitionVersion,
      effect: parsed.effect,
    });
    return {
      ...base,
      kind: parsed.kind,
      rate: spec.rate,
      appearsAtMinute: spec.appearsAt,
      expiresAtMinute: spec.expiresAt,
      orbit: {
        radius: spec.radius,
        period: spec.period,
        phase: spec.phase,
        inclination: spec.inclination,
        ascendingNode: spec.ascendingNode,
        speed: spec.speed,
      },
    };
  });
}

/**
 * THE MERCHANT ONE OCCURRENCE ID NAMES, OR NULL. D156.
 *
 * The single door between "a client sent me a uuid" and "here is the ship the
 * server will solve a rendezvous against". It exists so `trade.ts` never has to
 * hold an opinion about how a calendar row becomes a ship: `occurrenceEffect` is
 * the only reader of the jsonb column and `tradeShipOf` the only generator, and
 * both stay behind this function.
 *
 * SCOPED TO THE CALLER'S OWN SEASON, which is a fog rule and not a tidiness one.
 * An id from another galaxy must be indistinguishable from an id that names
 * nothing — otherwise a probe of this route reports whether some other shard has a
 * merchant up right now.
 *
 * NULL COVERS EVERY "NOT THAT" — no such row, another season's row, a row that is
 * an Asteroid Shower. The caller turns all of them into one refusal, because from
 * the player's seat they are one fact: there is no merchant there.
 */
export async function tradeShipOccurrence(
  tx: Queryable,
  seasonId: string,
  occurrenceId: string,
): Promise<TradeShipSpec | null> {
  const [row] = await tx
    .select({
      occurrence: galaxyEventOccurrences,
      seasonStartsAt: seasons.startsAt,
      asteroidKey: seasons.asteroidKey,
    })
    .from(galaxyEventOccurrences)
    .innerJoin(seasons, eq(seasons.id, galaxyEventOccurrences.seasonId))
    .where(and(
      eq(galaxyEventOccurrences.id, occurrenceId),
      eq(galaxyEventOccurrences.seasonId, seasonId),
    ))
    .limit(1);
  if (!row) return null;
  const parsed = occurrenceEffect(row.occurrence);
  if (parsed.kind !== 'TRADE_SHIP') return null;
  return tradeShipOf(row.asteroidKey, {
    sequence: row.occurrence.sequence,
    kind: parsed.kind,
    startsAtMinute: minutesSince(row.seasonStartsAt, row.occurrence.startsAt),
    endsAtMinute: minutesSince(row.seasonStartsAt, row.occurrence.endsAt),
    definitionVersion: row.occurrence.definitionVersion,
    effect: parsed.effect,
  });
}

type Lifecycle = 'start' | 'end';

/**
 * The one payload every lifecycle surface writes — notification and Chronicle.
 *
 * Built in one place so a third kind cannot be taught to two of the three readers
 * and quietly forgotten by the fourth, which is exactly the shape the bug in
 * `effectSchema` had.
 */
function lifecyclePayload(
  occurrence: typeof galaxyEventOccurrences.$inferSelect,
): GalaxyEventLifecyclePayload {
  const window = {
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
  };
  const parsed = occurrenceEffect(occurrence);
  return parsed.kind === 'ASTEROID_SHOWER'
    ? {
        eventKind: parsed.kind,
        ...window,
        asteroidSpawnMultiplier: parsed.effect.asteroidSpawnMultiplier,
      }
    : { eventKind: parsed.kind, ...window, rate: parsed.effect.rate };
}

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
  const payload = lifecyclePayload(occurrence);
  await tx
    .insert(notifications)
    .values(audience.map(({ id }) => ({
      playerId: id,
      kind: lifecycle === 'start' ? 'galaxy_event_started' as const : 'galaxy_event_ended' as const,
      refId: occurrence.id,
      createdAt: lifecycle === 'start' ? occurrence.startsAt : occurrence.endsAt,
      payload,
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
    await notifySeason(tx, occurrence, input.lifecycle);
    await recordGalaxyEvent(tx, {
      seasonId: occurrence.seasonId,
      kind: input.lifecycle === 'start' ? 'galaxy_event_started' : 'galaxy_event_ended',
      refId: occurrence.id,
      subjectPlanetId: null,
      payload: lifecyclePayload(occurrence),
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
    payload: lifecyclePayload(occurrence),
  }))).onConflictDoNothing();
}

export const galaxyEventConfig = GALAXY_EVENTS;
