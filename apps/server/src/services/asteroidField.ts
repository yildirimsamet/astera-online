import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  asteroidActive,
  asteroidDiscoveredAt,
  generateAsteroidSchedule,
  nextAsteroidDiscoveryAt,
  withAsteroidShowerLanes,
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
const idCache = new Map<string, Map<string, number>>();
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
  const signature = occurrences.map((occurrence) => [
    occurrence.sequence,
    occurrence.kind,
    occurrence.startsAtMinute,
    occurrence.endsAtMinute,
    occurrence.definitionVersion,
    occurrence.effect.asteroidSpawnMultiplier,
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
    (occurrence) => showerRng(key, occurrence.sequence),
  );
  composedFieldCache.set(cacheKey, field);
  trim(composedFieldCache);
  return field;
}

/** Stable 128-bit public handle; the raw schedule index is never serialised. */
export function asteroidId(key: string, index: number): string {
  return createHmac('sha256', key)
    .update(`asteroid:id:${String(index)}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}

function idsFor(key: string, field: readonly AsteroidSpec[]): Map<string, number> {
  // A base field and its event-composed field share the secret key but not their
  // number of indices. Keying only by the secret would make bonus ids unresolvable
  // if the base map happened to be cached first.
  const cacheKey = `${key}:${String(field.length)}`;
  const cached = idCache.get(cacheKey);
  if (cached) return cached;
  const ids = new Map(field.map((rock) => [asteroidId(key, rock.index), rock.index]));
  idCache.set(cacheKey, ids);
  trim(idCache);
  return ids;
}

/** Resolve only a canonical id for this exact season key. */
export function asteroidIndexFromId(
  key: string,
  field: readonly AsteroidSpec[],
  id: string,
): number | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(id)) return null;
  const index = idsFor(key, field).get(id);
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
      return asteroidDiscoveredAt(rock, epochs, whileAlive) !== null;
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
    .filter((rock) => asteroidDiscoveredAt(rock, epochs, nowMinutes) !== null)
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
