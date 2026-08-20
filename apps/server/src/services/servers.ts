import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { SEASON, SERVERS } from '@blindspace/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { addMinutes } from '../clock.js';
import {
  accounts,
  asteroidClaims,
  battleReports,
  buildings,
  debrisFields,
  miningRuns,
  missions,
  notifications,
  planets,
  players,
  probeReports,
  requestLog,
  satellites,
  scanEvents,
  scheduledEvents,
  seasons,
  shards,
  units,
  watches,
} from '../db/schema.js';
import { createSeason } from './season.js';
import { GameError } from './planet.js';

/**
 * THE GALAXIES, AS A PLACE YOU CHOOSE. D21.
 *
 * Ten of them, fifty worlds each, filled strictly in order. Every rule about which
 * one a player may enter lives in this file, and there is exactly one function that
 * decides it — `frontierOrdinal` — so the list the player reads and the check that
 * admits them can never disagree about which galaxy is open.
 */

/** What one row of the server list says. */
export interface ServerSummary {
  code: string;
  name: string;
  ordinal: number;
  /** Planets taken. The whole point of the list. */
  planets: number;
  capacity: number;
  /** Commanders whose last authenticated request was inside the online window. */
  online: number;
  status: ServerStatus;
  seasonEndsAt: Date | null;
}

/**
 * Why a galaxy can or cannot be entered.
 *
 * `locked` is the sequential-fill rule made visible: the galaxy is fine, it simply
 * is not this one's turn. Saying so is deliberate — a list of ten identical closed
 * doors reads as a broken game, while a list where one door is open and the rest
 * say "opens when Vantage fills" reads as a world with a shape.
 */
export type ServerStatus = 'open' | 'full' | 'locked' | 'closed';

/** Names, so a galaxy is somewhere rather than a row number. */
const SHARD_NAMES = [
  'Vantage', 'Kestrel', 'Halcyon', 'Orrery', 'Lodestar',
  'Bellwether', 'Quillon', 'Tessellate', 'Marrow', 'Vesper',
];

export const shardCodeFor = (ordinal: number): string => `EU-${String(ordinal)}`;
export const shardNameFor = (ordinal: number): string =>
  SHARD_NAMES[(ordinal - 1) % SHARD_NAMES.length] ?? `Galaxy ${String(ordinal)}`;

/* ── reading the list ───────────────────────────────────────── */

/**
 * Every galaxy, with its population and whether it will take anyone.
 *
 * THREE QUERIES, NEVER THIRTY. The shards, then one grouped count of planets per
 * season, then one grouped count of active players — rather than a pair of counts
 * per shard. Ten servers make an N+1 here look harmless; it is the same mistake at
 * fifty, and this endpoint is the one every player hits before they can play.
 */
export async function listServers(db: Db, clock: Clock): Promise<ServerSummary[]> {
  const rows = await db
    .select({ shard: shards, season: seasons })
    .from(shards)
    .leftJoin(seasons, and(eq(seasons.shardId, shards.id), eq(seasons.status, 'live')))
    .orderBy(asc(shards.ordinal));

  const since = addMinutes(clock.now(), -SERVERS.onlineWindowMinutes);

  const [taken, active] = await Promise.all([
    db
      .select({ seasonId: planets.seasonId, n: sql<number>`count(*)::int` })
      .from(planets)
      .groupBy(planets.seasonId),
    db
      .select({ seasonId: players.seasonId, n: sql<number>`count(*)::int` })
      .from(players)
      .where(gte(players.lastActiveAt, since))
      .groupBy(players.seasonId),
  ]);

  const planetsBySeason = new Map(taken.map((r) => [r.seasonId, r.n]));
  const onlineBySeason = new Map(active.map((r) => [r.seasonId, r.n]));

  // Status is deliberately not computed in this pass: whether a galaxy is `open`
  // or `locked` depends on every OTHER galaxy, so it cannot be known one row at a
  // time. Build the facts first, decide the frontier once, then label.
  const facts = rows.map(({ shard, season }) => ({
    code: shard.code,
    name: shard.name === '' ? shard.code : shard.name,
    ordinal: shard.ordinal,
    planets: season ? (planetsBySeason.get(season.id) ?? 0) : 0,
    capacity: shard.playerCap,
    online: season ? (onlineBySeason.get(season.id) ?? 0) : 0,
    seasonEndsAt: season?.endsAt ?? null,
    live: season !== null,
  }));

  const frontier = frontierOrdinal(facts.filter((f) => f.live));
  return facts.map(({ live, ...rest }) => ({ ...rest, status: statusOf(rest, live, frontier) }));
}

interface Fillable {
  ordinal: number;
  planets: number;
  capacity: number;
}

/**
 * THE SEQUENTIAL-FILL RULE, IN ONE PLACE.
 *
 * The frontier is the lowest-ordinal galaxy that is live and still has a free
 * slot. It is the only galaxy anyone may join, which is what "fill them in order"
 * means when written as something a request can be checked against.
 *
 * Why a rule and not a preference: `KNOWN RISKS` puts the empty shard second on
 * the list — "async PvP with 12 players is nothing" — and its mitigation is not to
 * open a second galaxy until the first fills. Ten galaxies offered freely on day
 * one is ten empty rooms, which is the failure the risk describes, arrived at by
 * giving players a choice they have no way to make well.
 *
 * Returns null when every galaxy is full, which is a real state and not an error:
 * the world is at capacity and the answer is a new season, not a bigger shard.
 */
export function frontierOrdinal(rows: readonly Fillable[]): number | null {
  const open = rows
    .filter((r) => r.planets < r.capacity)
    .sort((a, b) => a.ordinal - b.ordinal);
  return open[0]?.ordinal ?? null;
}

function statusOf(
  row: Fillable,
  live: boolean,
  frontier: number | null,
): ServerStatus {
  if (!live) return 'closed';
  if (row.planets >= row.capacity) return 'full';
  return row.ordinal === frontier ? 'open' : 'locked';
}

/* ── joining one ────────────────────────────────────────────── */

export interface JoinTarget {
  seasonId: string;
  shardCode: string;
  shardName: string;
  playerCap: number;
}

/**
 * Resolve which galaxy a request may actually enter, or say precisely why not.
 *
 * Every refusal here is a sentence the interface can show without inventing one,
 * because a player who is told "no" by a server list and not told which server to
 * try instead has been handed a dead end.
 */
export async function resolveJoinTarget(
  db: Db,
  shardCode: string,
  clock: Clock,
): Promise<JoinTarget> {
  const list = await listServers(db, clock);
  const target = list.find((s) => s.code === shardCode);
  if (!target) throw new GameError('NO_SUCH_SERVER', 'No galaxy by that name', 404);

  switch (target.status) {
    case 'closed':
      throw new GameError('NO_SEASON', `${target.name} is not open right now`, 409);
    case 'full':
      throw new GameError('SHARD_FULL', `${target.name} is full`, 409);
    case 'locked': {
      const frontier = list.find((s) => s.status === 'open');
      throw new GameError(
        'SERVER_LOCKED',
        frontier
          ? `${target.name} opens once ${frontier.name} is full. Join ${frontier.name}.`
          : `${target.name} is not open yet`,
        409,
      );
    }
    case 'open':
      break;
  }

  const [row] = await db
    .select({ season: seasons, shard: shards })
    .from(seasons)
    .innerJoin(shards, eq(seasons.shardId, shards.id))
    .where(and(eq(shards.code, shardCode), eq(seasons.status, 'live')))
    .limit(1);
  // Unreachable through `listServers`, which only reports 'open' for a live
  // season. Checked anyway: the alternative to this branch is a non-null
  // assertion on the row that decides where a player spends a season.
  if (!row) throw new GameError('NO_SEASON', `${target.name} is not open right now`, 409);

  return {
    seasonId: row.season.id,
    shardCode: row.shard.code,
    shardName: target.name,
    playerCap: row.shard.playerCap,
  };
}

export interface Placement {
  shardCode: string;
  shardName: string;
  seasonId: string;
  planetId: string;
  /** Carried so the client can name the world it is returning to without a second call. */
  planetName: string;
}

/** Where an account already is, if anywhere. Null means free to choose. */
export async function currentPlacement(db: Db, accountId: string): Promise<Placement | null> {
  const [row] = await db
    .select({
      shard: shards,
      seasonId: players.seasonId,
      planetId: planets.id,
      planetName: planets.name,
    })
    .from(players)
    .innerJoin(planets, eq(planets.playerId, players.id))
    .innerJoin(seasons, eq(players.seasonId, seasons.id))
    .innerJoin(shards, eq(seasons.shardId, shards.id))
    .where(eq(players.accountId, accountId))
    .limit(1);

  if (!row) return null;
  return {
    shardCode: row.shard.code,
    shardName: row.shard.name === '' ? row.shard.code : row.shard.name,
    seasonId: row.seasonId,
    planetId: row.planetId,
    planetName: row.planetName,
  };
}

/* ── opening and ending galaxies ────────────────────────────── */

export interface BootstrapOptions {
  count?: number;
  capacity?: number;
  days?: number;
  /** Seeds are derived from this so a bootstrap is reproducible when it needs to be. */
  seedBase?: number;
}

export interface BootstrapResult {
  created: string[];
  existing: string[];
}

/**
 * Bring the whole world into existence, or top it up.
 *
 * IDEMPOTENT BY CONSTRUCTION. Running it twice creates nothing the second time,
 * because the shard code is unique and a shard that already has a live season is
 * left alone. That matters more than it looks: this is the command that runs on a
 * fresh box, and a deploy script that cannot be re-run safely is a deploy script
 * that will be run twice by accident.
 */
export async function bootstrapServers(
  db: Db,
  clock: Clock,
  opts: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const count = opts.count ?? SERVERS.count;
  const capacity = opts.capacity ?? SERVERS.capacity;
  const days = opts.days ?? SEASON.days;
  const seedBase = opts.seedBase ?? Math.floor(Math.random() * 1_000_000);

  const created: string[] = [];
  const existing: string[] = [];

  for (let ordinal = 1; ordinal <= count; ordinal++) {
    const code = shardCodeFor(ordinal);
    const [live] = await db
      .select({ id: seasons.id })
      .from(seasons)
      .innerJoin(shards, eq(seasons.shardId, shards.id))
      .where(and(eq(shards.code, code), eq(seasons.status, 'live')))
      .limit(1);

    if (live) {
      existing.push(code);
      continue;
    }

    await createSeason(db, {
      shardCode: code,
      shardName: shardNameFor(ordinal),
      ordinal,
      // Distinct per galaxy, so two servers are two different places rather than
      // the same map twice. Derived rather than random so a seedBase reproduces
      // the whole world for a bug report.
      seed: seedBase + ordinal * 7919,
      startsAt: clock.now(),
      days,
      playerCap: capacity,
    });
    created.push(code);
  }

  return { created, existing };
}

export interface WipeResult {
  seasonsWiped: number;
  playersCleared: number;
  serversOpened: string[];
}

/**
 * THE WIPE. Every galaxy, at once, and everybody starts again. D21.
 *
 * Order matters and is the whole of the correctness here:
 *
 *   1. Fold each player's season into the permanent account record FIRST. After
 *      step 3 the numbers are gone and no amount of care recovers them.
 *   2. Mark the old seasons `wiped` before deleting anything, so a crash halfway
 *      leaves seasons that are visibly finished rather than live seasons with no
 *      planets in them — which is what a player would otherwise log in to.
 *   3. Delete the season world. `players` going is what releases the one-planet
 *      unique index, and therefore what lets everyone choose a galaxy again.
 *   4. Open the new seasons.
 *
 * Deletion is ordered child-before-parent by hand rather than left to a cascade,
 * because none of these foreign keys declare one — a cascade that does not exist
 * is the sort of thing that works in review and fails at 3am.
 */
export async function wipeAllServers(
  db: Db,
  clock: Clock,
  opts: BootstrapOptions = {},
): Promise<WipeResult> {
  const live = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, 'live'));

  const playersCleared = await db.transaction(async (tx) => {
    const roster = await tx
      .select({
        id: players.id,
        accountId: players.accountId,
        taken: players.dominionTaken,
        lost: players.dominionLost,
        wealth: players.wealth,
      })
      .from(players);

    /**
     * The record, merged in JavaScript rather than in SQL.
     *
     * A `jsonb_build_object` with four `coalesce(... ->> ...)` casts would do this
     * in one statement and would be unreadable and untestable. This runs once per
     * season across the whole world, offline, on a few hundred rows — the clarity
     * is worth more than the round trips, and every number in it is a fact a
     * player may one day be shown.
     */
    if (roster.length > 0) {
      const ids = [...new Set(roster.map((r) => r.accountId))];
      const before = await tx
        .select({ id: accounts.id, lifetime: accounts.lifetime })
        .from(accounts)
        .where(inArray(accounts.id, ids));
      const priorOf = new Map(before.map((a) => [a.id, a.lifetime]));

      for (const row of roster) {
        const prior = priorOf.get(row.accountId) ?? {};
        await tx
          .update(accounts)
          .set({
            lifetime: {
              ...prior,
              seasons: (prior.seasons ?? 0) + 1,
              dominionTaken: (prior.dominionTaken ?? 0) + row.taken,
              dominionLost: (prior.dominionLost ?? 0) + row.lost,
              bestWealth: Math.max(prior.bestWealth ?? 0, row.wealth),
            },
          })
          .where(eq(accounts.id, row.accountId));
      }
    }

    await tx.update(seasons).set({ status: 'wiped' }).where(eq(seasons.status, 'live'));
    await tx.update(seasons).set({ status: 'wiped' }).where(eq(seasons.status, 'frozen'));

    /**
     * Child rows first. Every one of these references something below it.
     *
     * `debris_fields` WAS MISSING, and it is the only table here whose absence is a
     * hard failure rather than a leak: its foreign keys to `missions`, `planets` and
     * `seasons` are all `ON DELETE no action`, so the `delete(missions)` below raised
     * a constraint violation and the whole wipe rolled back. Any galaxy where a
     * battle had produced wreckage — which is every galaxy that has been played —
     * could not be reset at all. It went unnoticed because the three wipe tests
     * never fought a battle.
     *
     * It goes before `mining_runs` as well as before `missions`: a harvest run
     * points at the field it was sent to.
     */
    await tx.delete(requestLog);
    await tx.delete(notifications);
    await tx.delete(scanEvents);
    await tx.delete(probeReports);
    await tx.delete(watches);
    await tx.delete(battleReports);
    await tx.delete(scheduledEvents);
    await tx.delete(miningRuns);
    await tx.delete(debrisFields);
    await tx.delete(missions);
    await tx.delete(asteroidClaims);
    await tx.delete(units);
    await tx.delete(satellites);
    await tx.delete(buildings);
    await tx.delete(planets);
    await tx.delete(players);

    return roster.length;
  });

  const opened = await bootstrapServers(db, clock, opts);
  return {
    seasonsWiped: live.length,
    playersCleared,
    serversOpened: opened.created,
  };
}
