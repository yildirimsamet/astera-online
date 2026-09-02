import { and, asc, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { accounts, galaxyEvents, planets, players } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';

export interface GalaxyEventPayloadByKind {
  bombardment: { planetName: string; commanderName: string };
  core_tier: { planetName: string; commanderName: string; tier: number };
  isotope_exhausted: Record<string, never>;
  wreck_formed: { planetName: string; commanderName: string };
  wreck_exhausted: { planetName: string; commanderName: string };
  dominion_leader: { planetName: string; commanderName: string };
  season_act: { act: 'war' | 'consolidation' | 'sunset' };
  neutral_claim: { planetName: string; tier: number; claimUntil: string };
  death_star_impact: {
    planetName: string;
    outcome: 'FIRST_STRIKE' | 'CAPTURED' | 'INEFFECTIVE';
    /** Capitals are destructible but never offer a control-transfer follow-up. D98. */
    capturable: boolean;
  };
  /**
   * A strategic weapon destroyed on a defender's ring. T10.
   *
   * The chronicle is the galaxy's memory of public transitions (D96), and there is
   * no larger one: 33,000 resources and an hour of build ending in a flash over
   * somebody's radar circle. Leaving it out would make the record silent about the
   * single most expensive thing that can happen in a season.
   */
  strategic_intercept: {
    planetName: string;
    commanderName: string;
    range: number;
    trigger?: 'RADAR' | 'TELESCOPE';
  };
  control_transfer: { planetName: string; commanderName: string };
  galaxy_event_started: {
    eventKind: 'ASTEROID_SHOWER';
    startsAt: string;
    endsAt: string;
    asteroidSpawnMultiplier: number;
  };
  galaxy_event_ended: {
    eventKind: 'ASTEROID_SHOWER';
    startsAt: string;
    endsAt: string;
    asteroidSpawnMultiplier: number;
  };
}

export type GalaxyEventKind = keyof GalaxyEventPayloadByKind;

export type GalaxyEventView = {
  [K in GalaxyEventKind]: {
  id: string;
  kind: K;
  subjectPlanetId: string | null;
  payload: GalaxyEventPayloadByKind[K];
  occurredAt: Date;
  }
}[GalaxyEventKind];

const WINDOW_MS = 24 * 60 * 60_000;

/** Snapshot only identity already public on the galaxy. */
export async function publicPlanetIdentity(tx: Tx, planetId: string) {
  const [row] = await tx
    .select({ planetName: planets.name, commanderName: accounts.displayName })
    .from(planets)
    .innerJoin(players, eq(planets.controllerPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(eq(planets.id, planetId))
    .limit(1);
  return row;
}

/** The same public ordering as `/api/leaderboard`, including both tie-breakers. */
export async function publicDominionLeader(tx: Tx, seasonId: string) {
  const score = sql<number>`round(${players.dominionTaken} - ${players.dominionLost})`;
  const [row] = await tx
    .select({
      planetId: planets.id,
      planetName: planets.name,
      commanderName: accounts.displayName,
    })
    .from(players)
    .innerJoin(
      planets,
      and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
    )
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(eq(players.seasonId, seasonId))
    .orderBy(desc(score), asc(players.joinedAt), asc(players.id))
    .limit(1);
  return row;
}

/** Insert and broadcast are one commit; duplicate worker delivery stays silent. */
export async function recordGalaxyEvent<K extends GalaxyEventKind>(
  tx: Tx,
  input: {
    seasonId: string;
    kind: K;
    refId: string;
    subjectPlanetId: string | null;
    payload: GalaxyEventPayloadByKind[K];
    occurredAt: Date;
  },
): Promise<void> {
  const inserted = await tx
    .insert(galaxyEvents)
    .values(input)
    .onConflictDoNothing()
    .returning({ id: galaxyEvents.id });
  if (inserted.length > 0) await publishShard(tx, input.seasonId, 'chronicle');
}

export async function readChronicle(
  db: Db,
  accountId: string,
  clock: Clock,
  limit: number,
  before?: string,
): Promise<{ events: GalaxyEventView[]; nextBefore: string | null }> {
  const [me] = await db
    .select({ seasonId: players.seasonId })
    .from(players)
    .where(eq(players.accountId, accountId))
    .limit(1);
  if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

  let cursor: { occurredAt: Date; id: string } | undefined;
  if (before) {
    const [found] = await db
      .select({ occurredAt: galaxyEvents.occurredAt, id: galaxyEvents.id })
      .from(galaxyEvents)
      .where(and(eq(galaxyEvents.id, before), eq(galaxyEvents.seasonId, me.seasonId)))
      .limit(1);
    if (!found) {
      throw new GameError('BAD_CHRONICLE_CURSOR', 'That Chronicle cursor is not visible', 400);
    }
    cursor = found;
  }

  const cutoff = new Date(clock.now().getTime() - WINDOW_MS);
  const rows = await db
    .select({
      id: galaxyEvents.id,
      kind: galaxyEvents.kind,
      subjectPlanetId: galaxyEvents.subjectPlanetId,
      payload: galaxyEvents.payload,
      occurredAt: galaxyEvents.occurredAt,
    })
    .from(galaxyEvents)
    .where(and(
      eq(galaxyEvents.seasonId, me.seasonId),
      gt(galaxyEvents.occurredAt, cutoff),
      cursor
        ? or(
            lt(galaxyEvents.occurredAt, cursor.occurredAt),
            and(eq(galaxyEvents.occurredAt, cursor.occurredAt), lt(galaxyEvents.id, cursor.id)),
          )
        : undefined,
    ))
    .orderBy(desc(galaxyEvents.occurredAt), desc(galaxyEvents.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return {
    events: page as GalaxyEventView[],
    nextBefore: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}
