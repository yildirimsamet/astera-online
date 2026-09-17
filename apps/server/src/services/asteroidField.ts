import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  asteroidActive,
  orbitDiscoveredAt,
  generateAsteroidHour,
  generateAsteroidSchedule,
  nextAsteroidDiscoveryAt,
  withAsteroidShowerLanes,
  type AsteroidHourLane,
  type AsteroidSpec,
  type PlannedGalaxyEvent,
  type SensorEpoch,
} from '@astera/rules';
import { atMinute, minutesSince } from '../clock.js';

// The rules package cannot import crypto; the server supplies its deterministic
// keyed draws here and hands the pure generator an ordinary RNG function.
function keyedRng(key: string): { rng: () => number; isotopeSeed: number } {
  let counter = 0;
  const digest = (label: string) => createHmac('sha256', key).update(label).digest();
  const isotopeSeed = digest('asteroid:isotope-seed').readUInt32BE(0);
  return {
    isotopeSeed,
    rng: () => {
      const value = digest(`asteroid:draw:${String(counter)}`).readUInt32BE(0);
      counter += 1;
      return value / 0x1_0000_0000;
    },
  };
}

const fieldCache = new Map<string, AsteroidSpec[]>();
const composedFieldCache = new Map<string, AsteroidSpec[]>();
const CACHE_MAX = 32;

function trim<K, V>(cache: Map<K, V>): void {
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

/** The whole schedule keyed by a secret that never crosses the API boundary. */
export function privateAsteroidField(key: string): AsteroidSpec[] {
  const cached = fieldCache.get(key);
  if (cached) {
    fieldCache.delete(key);
    fieldCache.set(key, cached);
    return cached;
  }
  const source = keyedRng(key);
  const field = generateAsteroidSchedule(source.rng, undefined, source.isotopeSeed);
  fieldCache.set(key, field);
  trim(fieldCache);
  return field;
}

function showerRng(key: string, sequence: number): () => number {
  let counter = 0;
  return () => {
    const value = createHmac('sha256', key)
      .update(`asteroid:shower:v1:${String(sequence)}:${String(counter)}`)
      .digest()
      .readUInt32BE(0);
    counter += 1;
    return value / 0x1_0000_0000;
  };
}

/** Baseline plus immutable event lanes, cached by the complete occurrence snapshot. */
export function privateAsteroidFieldWithEvents(
  key: string,
  occurrences: readonly PlannedGalaxyEvent[],
): AsteroidSpec[] {
  if (occurrences.length === 0) return privateAsteroidField(key);
  /*
    THE SIGNATURE IS THE COMPLETE OCCURRENCE, AND IT HAS TO STAY THAT WAY.

    This cache is what makes the composed field cheap, and a signature that went
    stale or collided would serve a field from a different calendar — at which
    point asteroid ids stop resolving, because `idsFor` keys on the field's
    length. So every field that can change the composition is in the string.

    The effect is now one shape per kind (D156), so it is stringified per kind
    rather than by reaching for `asteroidSpawnMultiplier` unconditionally — that
    property does not exist on a `TradeShipEffect` and the reach was a type error
    the moment a second kind existed. Merchants are included even though
    `withAsteroidShowerLanes` filters them out internally: the signature describes
    the CALENDAR, and describing it partially is how a signature starts colliding.
  */
  const signature = occurrences.map((occurrence) => [
    occurrence.kind,
    occurrence.sequence,
    occurrence.startsAtMinute,
    occurrence.endsAtMinute,
    occurrence.definitionVersion,
    JSON.stringify(occurrence.effect),
  ].join(':')).join('|');
  const cacheKey = `${key}:${signature}`;
  const cached = composedFieldCache.get(cacheKey);
  if (cached) {
    composedFieldCache.delete(cacheKey);
    composedFieldCache.set(cacheKey, cached);
    return cached;
  }

  const isotopeSeed = keyedRng(key).isotopeSeed;
  const field = withAsteroidShowerLanes(
    privateAsteroidField(key),
    occurrences,
    isotopeSeed,
    { rngForOccurrence: (occurrence) => showerRng(key, occurrence.sequence) },
  );
  composedFieldCache.set(cacheKey, field);
  trim(composedFieldCache);
  return field;
}

/**
 * THE DYNAMIC FIELD'S ROCKS FOR ONE STORED HOUR. 2026-09-16.
 *
 * Keyed by the season secret, the hour and its lanes — the complete input — so a
 * cached hour can never be served for a different one. Rows are written once and
 * never updated, which is what makes this cache safe to keep for the process's life.
 */
const hourCache = new Map<string, AsteroidSpec[]>();
const HOUR_CACHE_MAX = 64;

function dynamicHourRng(key: string, hourOrdinal: number): () => number {
  let counter = 0;
  return () => {
    const value = createHmac('sha256', key)
      .update(`asteroid:dynamic:v1:${String(hourOrdinal)}:${String(counter)}`)
      .digest()
      .readUInt32BE(0);
    counter += 1;
    return value / 0x1_0000_0000;
  };
}

export function privateAsteroidHour(
  key: string,
  hour: {
    hourOrdinal: number;
    lanes: readonly AsteroidHourLane[];
    levelWeights: readonly number[];
  },
): AsteroidSpec[] {
  const cacheKey = `${key}:${String(hour.hourOrdinal)}:${JSON.stringify(hour.lanes)}:${JSON.stringify(hour.levelWeights)}`;
  const cached = hourCache.get(cacheKey);
  if (cached) {
    hourCache.delete(cacheKey);
    hourCache.set(cacheKey, cached);
    return cached;
  }
  const rocks = generateAsteroidHour({
    hourOrdinal: hour.hourOrdinal,
    lanes: hour.lanes,
    levelWeights: hour.levelWeights,
    rng: dynamicHourRng(key, hour.hourOrdinal),
    isotopeSeed: keyedRng(key).isotopeSeed,
  });
  hourCache.set(cacheKey, rocks);
  while (hourCache.size > HOUR_CACHE_MAX) {
    const oldest = hourCache.keys().next().value;
    if (oldest === undefined) break;
    hourCache.delete(oldest);
  }
  return rocks;
}

/**
 * EVERY ROCK A READ AT `nowMinutes` CAN SEE OR RESOLVE, FOR ONE SEASON. 2026-09-16.
 *
 * THREE SHAPES OF SEASON, ONE ANSWER:
 *   · never dynamic (`dynamicFromMinute` null): the whole derived field, exactly as
 *     before, built from the season's own calendar rows;
 *   · dynamic from the start: only the stored hours;
 *   · adopted mid-season: the derived field built from the FROZEN calendar and cut
 *     at the cutover, then the stored hours. The frozen copy is what keeps every rock
 *     that was already in the sky at the adoption the same rock afterwards.
 *
 * `lookbackMinutes` drops derived rocks that expired long enough ago that no craft
 * can still be flying home from them; the stored hours are already loaded that way.
 */
export function composeSeasonAsteroidField(input: {
  key: string;
  calendar: readonly PlannedGalaxyEvent[];
  dynamicFromMinute: number | null;
  legacyCalendar: readonly PlannedGalaxyEvent[] | null;
  hours: readonly {
    hourOrdinal: number;
    lanes: readonly AsteroidHourLane[];
    levelWeights: readonly number[];
  }[];
  nowMinutes: number;
  lookbackMinutes: number;
}): AsteroidSpec[] {
  if (input.dynamicFromMinute === null) {
    return privateAsteroidFieldWithEvents(input.key, input.calendar);
  }
  const cutover = input.dynamicFromMinute;
  const oldest = input.nowMinutes - input.lookbackMinutes;
  const legacy = input.legacyCalendar === null
    ? []
    : privateAsteroidFieldWithEvents(input.key, input.legacyCalendar)
      .filter((rock) => rock.appearsAt < cutover && rock.expiresAt > oldest);
  return [...legacy, ...input.hours.flatMap((hour) => privateAsteroidHour(input.key, hour))];
}

/** Stable 128-bit public handle; the raw schedule index is never serialised. */
export function asteroidId(key: string, index: number): string {
  const memoKey = `${key}:${String(index)}`;
  const memo = idMemo.get(memoKey);
  if (memo !== undefined) return memo;
  const id = createHmac('sha256', key)
    .update(`asteroid:id:${String(index)}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
  idMemo.set(memoKey, id);
  if (idMemo.size > ID_MEMO_MAX) {
    const oldest = idMemo.keys().next().value;
    if (oldest !== undefined) idMemo.delete(oldest);
  }
  return id;
}

/**
 * ID BY INDEX, MEMOISED PER ROCK. It used to be a map per field, keyed by the field's
 * LENGTH — sound while a season had one field, and wrong once the dynamic field made
 * the composed set a window that slides every hour: two different windows of equal
 * length would have shared a map and resolved an id to a rock the field did not hold.
 */
const idMemo = new Map<string, string>();
const ID_MEMO_MAX = 60_000;

/** Resolve only a canonical id for this exact season key. */
export function asteroidIndexFromId(
  key: string,
  field: readonly AsteroidSpec[],
  id: string,
): number | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(id)) return null;
  const index = field.find((rock) => asteroidId(key, rock.index) === id)?.index;
  if (index === undefined) return null;
  // Keep the final comparison fixed-time even though the map lookup already
  // avoids the O(n) schedule walk on every launch.
  const expected = Buffer.from(asteroidId(key, index));
  const supplied = Buffer.from(id);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? index : null;
}

export interface PrivateAsteroidView extends Omit<
  AsteroidSpec,
  'index' | 'deuteriumShare'
> {
  id: string;
  oreRemaining: number;
  active: true;
  deuteriumShare: number | null;
}

export interface AsteroidProjectionSnapshot {
  asteroids: AsteroidSpec[];
  startsAt: Date;
  oreTaken: ReadonlyMap<number, number>;
}

export function discoveredAsteroidIndexes(
  snapshot: AsteroidProjectionSnapshot,
  epochs: readonly SensorEpoch[],
  now: Date,
): ReadonlySet<number> {
  const nowMinutes = minutesSince(snapshot.startsAt, now);
  return new Set(snapshot.asteroids
    .filter((rock) => {
      // The field drops an expired rock, but traffic may still contain a craft
      // returning from it. Test discovery at the last instant the rock existed so
      // an already earned public race does not vanish halfway through its return.
      const whileAlive = Math.min(nowMinutes, rock.expiresAt - 1e-9);
      return orbitDiscoveredAt(rock, epochs, whileAlive) !== null;
    })
    .map((rock) => rock.index));
}

/** Apply discovery memory after the shared season snapshot has been cached. */
export function projectPlayerAsteroidField(
  snapshot: AsteroidProjectionSnapshot,
  key: string,
  epochs: readonly SensorEpoch[],
  now: Date,
  revealIsotopes: boolean,
): { asteroids: PrivateAsteroidView[]; nextFieldChangeAt: Date | null } {
  const nowMinutes = minutesSince(snapshot.startsAt, now);
  const asteroids = snapshot.asteroids
    .filter((rock) => asteroidActive(rock, nowMinutes))
    .filter((rock) => orbitDiscoveredAt(rock, epochs, nowMinutes) !== null)
    .map((rock): PrivateAsteroidView => ({
      id: asteroidId(key, rock.index),
      level: rock.level,
      ore: rock.ore,
      oreRemaining: Math.max(0, rock.ore - (snapshot.oreTaken.get(rock.index) ?? 0)),
      crystalShare: rock.crystalShare,
      radius: rock.radius,
      period: rock.period,
      phase: rock.phase,
      inclination: rock.inclination,
      ascendingNode: rock.ascendingNode,
      speed: rock.speed,
      appearsAt: rock.appearsAt,
      expiresAt: rock.expiresAt,
      active: true,
      isotopeRich: rock.isotopeRich,
      deuteriumShare: revealIsotopes ? rock.deuteriumShare : null,
    }))
    .filter((rock) => rock.oreRemaining > 0);

  const nextDiscovery = nextAsteroidDiscoveryAt(snapshot.asteroids, epochs, nowMinutes);
  const nextExpiry = asteroids.reduce<number | null>(
    (earliest, rock) => earliest === null || rock.expiresAt < earliest ? rock.expiresAt : earliest,
    null,
  );
  const nextMinute = [nextDiscovery, nextExpiry]
    .filter((minute): minute is number => minute !== null && minute > nowMinutes)
    .reduce<number | null>((earliest, minute) => earliest === null || minute < earliest
      ? minute
      : earliest, null);

  return {
    asteroids,
    nextFieldChangeAt: nextMinute === null ? null : atMinute(snapshot.startsAt, nextMinute),
  };
}
