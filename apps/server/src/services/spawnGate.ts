import { and, eq, gt, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { decideSpawnGate, SPAWN_GATE } from '@astera/rules';
import type { Clock } from '../clock.js';
import { minutesSince } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { asteroidClaims, asteroidSpawnHours, galaxyEventOccurrences, players, seasons, spawnGateSkips } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { rawAsteroidField } from './mining.js';
import { isPerson } from './people.js';
import { loadPirateSnapshot } from './pirateField.js';
import { GameError } from './planet.js';
import { FIELD_LOOKBACK_HOURS } from './asteroidSpawn.js';

/**
 * THE SPAWN GATE'S WRITER. Owner rule, 2026-10-17: *"aktif galakside dolaşan asteroid sayısı
 * son 5 dakikalık oyuncu sayısını geçmesin (event vakti hariç)"*, and the same for pirate
 * fleets, which have no event exception. The hourly plans are untouched. The worker walks the
 * planned births since its last pass in birth order and skips each one that would bring the
 * drifting count to the number of people (never bots) who played in the last five minutes.
 * Decisions are stored once under a per-season advisory lock; `spawnGateRead.ts` makes every read honour
 * them and hides births not decided yet, so no replica shows something the gate later skips.
 */
export async function advanceSpawnGate(db: Db, input: { seasonId: string; clock: Clock }) {
  return db.transaction(async (tx) => {
    // A private lock, not the season row: gameplay that locks the season never waits on the gate.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`spawn-gate:${input.seasonId}`}))`);
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId));
    if (season?.status !== 'live' || season.spawnGateFrom === null || season.spawnGateThrough === null) {
      return { status: 'OFF' as const };
    }
    const now = input.clock.now();
    let until = new Date(Math.min(now.getTime(), season.endsAt.getTime()));
    /*
      NEVER DECIDE PAST A PLAN THAT IS NOT WRITTEN YET. An hour the worker opens a few minutes
      late still owns births from its first minute; deciding through that time before the row
      existed would let those births appear ungated once it lands.
    */
    if (season.asteroidDynamicFrom !== null) {
      const [latest] = await tx.select({ at: sql<Date | null>`max(${asteroidSpawnHours.hourStartsAt})` }).from(asteroidSpawnHours)
        .where(and(eq(asteroidSpawnHours.seasonId, season.id), lte(asteroidSpawnHours.hourStartsAt, until)));
      const covered = latest?.at ? new Date(new Date(latest.at).getTime() + 3_600_000) : season.spawnGateThrough;
      if (covered < until) until = covered;
    }
    if (until <= season.spawnGateThrough) return { status: 'UP_TO_DATE' as const };
    const fromMinute = minutesSince(season.startsAt, season.spawnGateThrough);
    const toMinute = minutesSince(season.startsAt, until);
    const online = await onlinePeople(tx, season.id, now);
    const lookback = new Date(now.getTime() - FIELD_LOOKBACK_HOURS * 3_600_000);
    const skippedRows = await tx.select({ kind: spawnGateSkips.kind, index: spawnGateSkips.index }).from(spawnGateSkips)
      .where(and(eq(spawnGateSkips.seasonId, season.id), gte(spawnGateSkips.appearsAt, lookback)));
    const skipped = (kind: 'ASTEROID' | 'PIRATE') =>
      new Set(skippedRows.filter((row) => row.kind === kind).map((row) => row.index));
    const isBirth = (spec: { appearsAt: number }) => spec.appearsAt > fromMinute && spec.appearsAt <= toMinute;

    // Rocks: showers exempt; a mined-out rock no longer drifts.
    const { field } = await rawAsteroidField(tx, season.id, now);
    const rockSkips = skipped('ASTEROID');
    const candidates = field.asteroids.filter((rock) => rock.appearsAt <= fromMinute && !rockSkips.has(rock.index));
    const claims = candidates.length === 0 ? [] : await tx.select().from(asteroidClaims).where(and(
      eq(asteroidClaims.seasonId, season.id), inArray(asteroidClaims.index, candidates.map((rock) => rock.index))));
    const taken = new Map(claims.map((claim) => [claim.index, claim.oreTaken]));
    const showers = await tx.select({ startsAt: galaxyEventOccurrences.startsAt, endsAt: galaxyEventOccurrences.endsAt })
      .from(galaxyEventOccurrences).where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
        lt(galaxyEventOccurrences.startsAt, until),
        gt(galaxyEventOccurrences.endsAt, season.spawnGateThrough),
      ));
    const windows = showers.map((row) => [minutesSince(season.startsAt, row.startsAt), minutesSince(season.startsAt, row.endsAt)] as const);
    const rockBirths = field.asteroids.filter(isBirth);
    const rockAlive = candidates.filter((rock) => (taken.get(rock.index) ?? 0) < rock.ore);
    const rocksSkipped = decideSpawnGate({ births: rockBirths, alive: rockAlive, cap: online,
      exempt: (minute) => windows.some(([start, end]) => minute >= start && minute < end) });

    // Pirate fleets: no exception; a destroyed crew no longer drifts.
    const snapshot = await loadPirateSnapshot(tx, season.id, now, { gated: false });
    const pirateSkips = skipped('PIRATE');
    const pirateBirths = snapshot.pirates.filter(isBirth);
    const pirateAlive = snapshot.pirates.filter((spec) => spec.appearsAt <= fromMinute && !pirateSkips.has(spec.index)
      && snapshot.destroyedAt(spec.index) === null);
    const piratesSkipped = decideSpawnGate({ births: pirateBirths, alive: pirateAlive, cap: online });

    const appearsAt = (minute: number) => new Date(season.startsAt.getTime() + minute * 60_000);
    const rows = [
      ...rockBirths.filter((rock) => rocksSkipped.includes(rock.index))
        .map((rock) => ({ seasonId: season.id, kind: 'ASTEROID' as const, index: rock.index, appearsAt: appearsAt(rock.appearsAt), decidedAt: now })),
      ...pirateBirths.filter((spec) => piratesSkipped.includes(spec.index))
        .map((spec) => ({ seasonId: season.id, kind: 'PIRATE' as const, index: spec.index, appearsAt: appearsAt(spec.appearsAt), decidedAt: now })),
    ];
    if (rows.length > 0) await tx.insert(spawnGateSkips).values(rows).onConflictDoNothing();
    await tx.update(seasons).set({ spawnGateThrough: until }).where(eq(seasons.id, season.id));
    // Kept births become visible now: open discs refetch their field.
    if (rockBirths.length > rocksSkipped.length) await publishShard(tx, season.id, 'mining');
    if (pirateBirths.length > piratesSkipped.length) await publishShard(tx, season.id, 'pirate');
    return {
      status: 'ADVANCED' as const, online,
      asteroids: { born: rockBirths.length - rocksSkipped.length, skipped: rocksSkipped.length },
      pirates: { born: pirateBirths.length - piratesSkipped.length, skipped: piratesSkipped.length },
    };
  });
}

/** Every live season with the gate on, each in its own transaction; one failure skips one season. */
export async function advanceSpawnGates(db: Db, clock: Clock, onError: (err: unknown, seasonId: string) => void): Promise<number> {
  const live = await db.select({ id: seasons.id }).from(seasons)
    .where(and(eq(seasons.status, 'live'), isNotNull(seasons.spawnGateFrom)));
  let advanced = 0;
  for (const { id } of live) {
    try {
      if ((await advanceSpawnGate(db, { seasonId: id, clock })).status === 'ADVANCED') advanced += 1;
    } catch (err) {
      onError(err, id);
    }
  }
  return advanced;
}

/** Explicit operator cutover for a live season; new seasons open with the gate on. */
export async function activateSpawnGate(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async (tx) => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || now >= season.endsAt) throw new GameError('SEASON_FROZEN', 'An open season is required', 409);
    if (season.spawnGateFrom !== null) return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: season.spawnGateFrom };
    if (input.apply) await tx.update(seasons).set({ spawnGateFrom: now, spawnGateThrough: now }).where(eq(seasons.id, season.id));
    return { status: 'READY' as const, applied: input.apply, startsAt: now };
  });
}

/** People — never the server's commanders — who played in the last five minutes. */
async function onlinePeople(tx: Tx, seasonId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - SPAWN_GATE.onlineWindowMinutes * 60_000);
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(players)
    .where(and(eq(players.seasonId, seasonId), gte(players.lastActiveAt, since), isPerson));
  return row?.n ?? 0;
}

