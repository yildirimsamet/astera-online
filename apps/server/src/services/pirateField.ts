import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  activePirates,
  generatePirateSchedule,
  pirateDiscovered,
  type Fleet,
  type HullId,
  type PirateSpec,
  type SensorEpoch,
} from '@astera/rules';
import { minutesSince } from '../clock.js';
import { GameError } from './planet.js';
import { pirateState, seasons } from '../db/schema.js';
import type { Queryable } from '../db/client.js';

/**
 * THE SEASON'S PIRATE LANE, KEYED BY A SECRET THAT NEVER CROSSES THE API. D150.
 *
 * The mirror of `asteroidField.ts`, and the mirroring is deliberate: both are
 * derived server-private schedules addressed through opaque handles, so a second
 * shape here would be a second set of leaks to find. `packages/rules` may not
 * import `crypto` (A1), so the keyed determinism is injected from this side and
 * the pure generator is handed an ordinary function.
 *
 * AND SINCE D158 THE MIRRORING GOES ALL THE WAY. A rock is REMEMBERED once seen
 * (`sensor_epochs`, D143) and a pirate now is too, on the owner's instruction and
 * reversing D150's refusal — which used to be written in this very paragraph. The
 * memory is the SAME rows and the same solve (`discoveredPirateIndexes` below), so
 * the two lanes cannot answer the discovery question differently.
 *
 * AND SINCE D160 IT BUYS THE MANIFEST TOO. `pirateZone` floors a discovered pirate
 * at IDENTIFIED, not at CONTACT — this paragraph said the opposite until the floor
 * moved, and a stale docblock about fog is worse than none. It is safe because
 * `sensor_epochs.reach` is the TELESCOPE radius alone (`refreshSensorEpoch`): a
 * discovered pirate is one this commander already counted the crew of, so memory
 * hands back a reading they bought. A pirate no telescope ever held is untouched —
 * CONTACT inside a radar circle, nothing outside every circle.
 *
 * THE LANE IS DERIVED FROM THE SEASON'S EXISTING SECRET under its own HMAC
 * labels. A separate key column would have been a migration for no gain: distinct
 * labels already give the two lanes independent draws, so raising the pirate rate
 * cannot move a single rock and vice versa.
 */

function keyedRng(key: string): () => number {
  let counter = 0;
  return () => {
    const value = createHmac('sha256', key)
      .update(`pirate:draw:${String(counter)}`)
      .digest()
      .readUInt32BE(0);
    counter += 1;
    return value / 0x1_0000_0000;
  };
}

const fieldCache = new Map<string, PirateSpec[]>();
const idCache = new Map<string, Map<string, number>>();
const CACHE_MAX = 32;

function trim<K, V>(cache: Map<K, V>): void {
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

/** The whole lane for this season key. LRU-32, because generation is not free. */
export function privatePirateField(key: string): PirateSpec[] {
  const cached = fieldCache.get(key);
  if (cached) {
    fieldCache.delete(key);
    fieldCache.set(key, cached);
    return cached;
  }
  const field = generatePirateSchedule(keyedRng(key));
  fieldCache.set(key, field);
  trim(fieldCache);
  return field;
}

/** Stable 128-bit public handle; the raw lane index is never serialised. */
export function pirateId(key: string, index: number): string {
  return createHmac('sha256', key)
    .update(`pirate:id:${String(index)}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}

/**
 * A SHORT NAME A PLAYER CAN SAY OUT LOUD, taken from the opaque id.
 *
 * "Korsan L3-7" would read better and would also be a running count of how many
 * level 3 pirates the season has produced — the schedule leaking through the copy
 * rather than through the payload. Four characters of the handle are unique in
 * practice, disclose nothing, and are stable for the life of the pirate.
 */
export const pirateCallsign = (key: string, index: number): string =>
  pirateId(key, index).slice(0, 4);

function idsFor(key: string, field: readonly PirateSpec[]): Map<string, number> {
  const cacheKey = `${key}:${String(field.length)}`;
  const cached = idCache.get(cacheKey);
  if (cached) return cached;
  const ids = new Map(field.map((spec) => [pirateId(key, spec.index), spec.index]));
  idCache.set(cacheKey, ids);
  trim(idCache);
  return ids;
}

/** Resolve only a canonical id for this exact season key. */
export function pirateIndexFromId(
  key: string,
  field: readonly PirateSpec[],
  id: string,
): number | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(id)) return null;
  const index = idsFor(key, field).get(id);
  if (index === undefined) return null;
  // Fixed-time on the final comparison even though the map lookup already avoids
  // an O(n) walk of the lane on every launch.
  const expected = Buffer.from(pirateId(key, index));
  const supplied = Buffer.from(id);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? index : null;
}

/**
 * WHAT IS STILL FLYING: the roster it entered with, minus what has been shot off.
 *
 * Never negative, and never resurrects. A missing row means untouched, which is
 * why the losses argument is optional rather than the caller having to invent an
 * empty fleet at every site.
 */
export function livingRoster(roster: Fleet, losses: Fleet | undefined): Fleet {
  if (!losses) return { ...roster };
  const alive: Fleet = {};
  for (const [id, count] of Object.entries(roster) as [HullId, number][]) {
    const left = count - (losses[id] ?? 0);
    if (left > 0) alive[id] = left;
  }
  return alive;
}

/**
 * EVERY PIRATE THIS COMMANDER HAS EVER HAD INSIDE ONE OF THEIR POSTS. D158.
 *
 * The mirror of `discoveredAsteroidIndexes`. The expiry clamp — a pirate that has
 * just left the lane may still be the subject of a raid in the air, so discovery is
 * tested at the last instant it existed — now lives inside `pirateDiscovered`,
 * which `pirateZone` also calls. It was written here alone at first, so the disc
 * and the launch gate could answer the boundary differently.
 *
 * Indexes, not ids, because every caller is inside the server and the raw lane
 * index is exactly what must never be serialised.
 */
export function discoveredPirateIndexes(
  snapshot: PirateSnapshot,
  epochs: readonly SensorEpoch[],
  now: Date,
): ReadonlySet<number> {
  if (epochs.length === 0) return new Set();
  const nowMinutes = minutesSince(snapshot.startsAt, now);
  return new Set(snapshot.pirates
    .filter((spec) => pirateDiscovered(spec, epochs, nowMinutes))
    .map((spec) => spec.index));
}

export interface PirateStateRow {
  losses: Fleet;
  destroyedAt: Date | null;
  destroyedByPlayerId: string | null;
}

/**
 * The caller-independent season snapshot behind every pirate read. D99.
 *
 * Carries raw lane facts rather than a response: activity, damage and — above all
 * — FOG are applied at request time, per caller. A shared snapshot that had
 * already filtered for somebody would be a cache that leaks between commanders.
 */
export interface PirateSnapshot {
  pirates: PirateSpec[];
  startsAt: Date;
  key: string;
  state: ReadonlyMap<number, PirateStateRow>;
  /** The crew still aboard pirate `index`. */
  livingRosterOf: (index: number) => Fleet;
  destroyedAt: (index: number) => Date | null;
  /** Every pirate that is in the disc at `now` and has not been wiped out. */
  standing: (now: Date) => PirateSpec[];
}

export async function loadPirateSnapshot(
  db: Queryable,
  seasonId: string,
  _now: Date,
): Promise<PirateSnapshot> {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const rows = await db.select().from(pirateState).where(eq(pirateState.seasonId, seasonId));
  const state = new Map<number, PirateStateRow>(rows.map((row) => [row.index, {
    losses: row.losses,
    destroyedAt: row.destroyedAt,
    destroyedByPlayerId: row.destroyedByPlayerId,
  }]));
  const pirates = privatePirateField(season.asteroidKey);

  return {
    pirates,
    startsAt: season.startsAt,
    key: season.asteroidKey,
    state,
    livingRosterOf: (index) => {
      const spec = pirates[index];
      return spec ? livingRoster(spec.roster, state.get(index)?.losses) : {};
    },
    destroyedAt: (index) => state.get(index)?.destroyedAt ?? null,
    standing: (at) => activePirates(pirates, minutesSince(season.startsAt, at))
      .filter((spec) => state.get(spec.index)?.destroyedAt == null),
  };
}
