import { GALAXY_EVENTS } from './constants.js';
import type { Rng } from './types.js';

const DAY_MINUTES = 24 * 60;

export type GalaxyEventKind = 'ASTEROID_SHOWER';

export interface AsteroidShowerEffect {
  asteroidSpawnMultiplier: number;
}

export interface PlannedGalaxyEvent {
  sequence: number;
  kind: GalaxyEventKind;
  /** Minutes since the season's exact start instant. */
  startsAtMinute: number;
  /** Minutes since the season's exact start instant. */
  endsAtMinute: number;
  definitionVersion: number;
  effect: AsteroidShowerEffect;
}

export interface GalaxyEventsConfig {
  readonly version: number;
  readonly calendar: {
    readonly timeZone: string;
    readonly utcOffsetMinutes: number;
    readonly dailyCount: { readonly min: number; readonly max: number };
    readonly lowPriorityWindow: {
      readonly startsAtLocalMinute: number;
      readonly endsAtLocalMinute: number;
      readonly targetShare: number;
      readonly overflowWeight: number;
      readonly maxDailyCount: number;
    };
    readonly candidateAttempts: number;
  };
  readonly definitions: {
    readonly ASTEROID_SHOWER: {
      readonly version: number;
      readonly durationMinutes: number;
      readonly repeatCooldownMinutes: number;
      readonly effect: AsteroidShowerEffect;
    };
  };
  readonly mutuallyExclusive: readonly (readonly [string, string])[];
}

export interface GalaxyEventWindow {
  readonly kind: string;
  readonly startsAtMinute: number;
  readonly endsAtMinute: number;
}

/**
 * Fail closed when a generated multi-kind calendar violates an exclusion pair.
 * Windows are half-open, so one event ending exactly as another starts is legal.
 */
export function assertMutuallyExclusiveEventWindows(
  events: readonly GalaxyEventWindow[],
  exclusions: readonly (readonly [string, string])[],
): void {
  for (const [leftKind, rightKind] of exclusions) {
    if (leftKind.length === 0 || rightKind.length === 0 || leftKind === rightKind) {
      throw new RangeError('mutuallyExclusive pairs must name two different event kinds');
    }
    const left = events.filter((event) => event.kind === leftKind);
    const right = events.filter((event) => event.kind === rightKind);
    for (const leftEvent of left) {
      for (const rightEvent of right) {
        if (leftEvent.startsAtMinute < rightEvent.endsAtMinute
          && rightEvent.startsAtMinute < leftEvent.endsAtMinute) {
          throw new RangeError(`${leftKind} and ${rightKind} are mutually exclusive`);
        }
      }
    }
  }
}

export interface GenerateGalaxyEventScheduleInput {
  /** Absolute UTC epoch minute; may contain a fractional minute. */
  seasonStartsAtUnixMinute: number;
  seasonDurationMinutes: number;
  rng: Rng;
  config?: GalaxyEventsConfig;
}

interface CalendarBucket {
  localDay: number;
  dayStartsAt: number;
  eligibleStartsAt: number;
  eligibleEndsAt: number;
  idealCount: number;
  count: number;
}

function assertFiniteInteger(value: number, name: string, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${String(minimum)}`);
  }
}

function validateConfig(config: GalaxyEventsConfig): void {
  const { calendar } = config;
  assertFiniteInteger(calendar.dailyCount.min, 'dailyCount.min', 0);
  assertFiniteInteger(calendar.dailyCount.max, 'dailyCount.max', 0);
  if (calendar.dailyCount.min > calendar.dailyCount.max) {
    throw new RangeError('dailyCount.min cannot exceed dailyCount.max');
  }
  assertFiniteInteger(calendar.utcOffsetMinutes, 'utcOffsetMinutes', -DAY_MINUTES);
  assertFiniteInteger(calendar.candidateAttempts, 'candidateAttempts', 1);

  const low = calendar.lowPriorityWindow;
  assertFiniteInteger(low.startsAtLocalMinute, 'lowPriorityWindow.startsAtLocalMinute', 0);
  assertFiniteInteger(low.endsAtLocalMinute, 'lowPriorityWindow.endsAtLocalMinute', 1);
  if (low.endsAtLocalMinute > DAY_MINUTES || low.startsAtLocalMinute >= low.endsAtLocalMinute) {
    throw new RangeError('lowPriorityWindow must be a non-wrapping interval inside one day');
  }
  if (low.targetShare < 0 || low.targetShare > 1) {
    throw new RangeError('lowPriorityWindow.targetShare must be between 0 and 1');
  }
  if (low.overflowWeight < 0 || low.overflowWeight > 1) {
    throw new RangeError('lowPriorityWindow.overflowWeight must be between 0 and 1');
  }
  assertFiniteInteger(low.maxDailyCount, 'lowPriorityWindow.maxDailyCount', 0);

  const shower = config.definitions.ASTEROID_SHOWER;
  if (!Number.isFinite(shower.durationMinutes) || shower.durationMinutes <= 0) {
    throw new RangeError('ASTEROID_SHOWER.durationMinutes must be positive');
  }
  if (!Number.isFinite(shower.repeatCooldownMinutes) || shower.repeatCooldownMinutes < 0) {
    throw new RangeError('ASTEROID_SHOWER.repeatCooldownMinutes cannot be negative');
  }
  if (!Number.isFinite(shower.effect.asteroidSpawnMultiplier)
    || shower.effect.asteroidSpawnMultiplier <= 1) {
    throw new RangeError('ASTEROID_SHOWER multiplier must be greater than one');
  }
}

const randomInteger = (rng: Rng, minimum: number, maximum: number): number =>
  minimum + Math.floor(rng() * (maximum - minimum + 1));

/**
 * Split the season into Türkiye calendar dates without consulting process locale.
 * Largest-remainder allocation keeps a fixed five/day config at exactly seventy
 * occurrences across an arbitrary-start fourteen-day season.
 */
function calendarBuckets(input: GenerateGalaxyEventScheduleInput, config: GalaxyEventsConfig) {
  const seasonStartsAt = input.seasonStartsAtUnixMinute;
  const seasonEndsAt = seasonStartsAt + input.seasonDurationMinutes;
  const offset = config.calendar.utcOffsetMinutes;
  const firstDay = Math.floor((seasonStartsAt + offset) / DAY_MINUTES);
  const lastDay = Math.floor(((seasonEndsAt - Number.EPSILON) + offset) / DAY_MINUTES);
  const buckets: CalendarBucket[] = [];

  for (let localDay = firstDay; localDay <= lastDay; localDay += 1) {
    const dayStartsAt = localDay * DAY_MINUTES - offset;
    const eligibleStartsAt = Math.max(seasonStartsAt, dayStartsAt);
    const eligibleEndsAt = Math.min(seasonEndsAt, dayStartsAt + DAY_MINUTES);
    const dailyCount = randomInteger(
      input.rng,
      config.calendar.dailyCount.min,
      config.calendar.dailyCount.max,
    );
    const idealCount = dailyCount * (eligibleEndsAt - eligibleStartsAt) / DAY_MINUTES;
    buckets.push({
      localDay,
      dayStartsAt,
      eligibleStartsAt,
      eligibleEndsAt,
      idealCount,
      count: Math.floor(idealCount),
    });
  }

  const remainder = Math.round(buckets.reduce((sum, bucket) => sum + bucket.idealCount, 0))
    - buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const ranked = [...buckets].sort((left, right) =>
    (right.idealCount - Math.floor(right.idealCount))
      - (left.idealCount - Math.floor(left.idealCount))
    || left.localDay - right.localDay);
  for (let index = 0; index < remainder; index += 1) ranked[index % ranked.length]!.count += 1;
  return buckets;
}

function integerRange(from: number, until: number): { first: number; count: number } | null {
  const first = Math.ceil(from);
  const last = Math.ceil(until) - 1;
  return last < first ? null : { first, count: last - first + 1 };
}

function drawStarts(
  rng: Rng,
  count: number,
  from: number,
  until: number,
  minimumGap: number,
  after: number | null,
): number[] | null {
  if (count === 0) return [];
  const range = integerRange(from, until);
  if (!range) return null;
  const last = range.first + range.count - 1;
  const starts: number[] = [];
  let previous = after;
  for (let index = 0; index < count; index += 1) {
    const first = Math.max(range.first, previous === null ? range.first : previous + minimumGap);
    const latest = last - (count - index - 1) * minimumGap;
    if (latest < first) return null;
    const start = first + Math.floor(rng() * (latest - first + 1));
    starts.push(start);
    previous = start;
  }
  return starts;
}

function canFollow(previousStart: number, nextStart: number, minimumGap: number): boolean {
  return nextStart - previousStart >= minimumGap;
}

function planBucket(
  bucket: CalendarBucket,
  priorStarts: readonly number[],
  seasonEndsAt: number,
  rng: Rng,
  config: GalaxyEventsConfig,
): number[] {
  if (bucket.count === 0) return [];
  const low = config.calendar.lowPriorityWindow;
  const shower = config.definitions.ASTEROID_SHOWER;
  const minimumGap = shower.durationMinutes + shower.repeatCooldownMinutes;
  const latestStartExclusive = seasonEndsAt - shower.durationMinutes + 1;
  const lowFrom = Math.max(bucket.eligibleStartsAt, bucket.dayStartsAt + low.startsAtLocalMinute);
  const lowUntil = Math.min(
    bucket.eligibleEndsAt,
    bucket.dayStartsAt + low.endsAtLocalMinute,
    latestStartExclusive,
  );
  const normalFrom = Math.max(bucket.eligibleStartsAt, bucket.dayStartsAt + low.endsAtLocalMinute);
  const normalUntil = Math.min(bucket.eligibleEndsAt, latestStartExclusive);
  const hasLow = integerRange(lowFrom, lowUntil) !== null;
  const hasNormal = integerRange(normalFrom, normalUntil) !== null;

  let preferredLowCount = hasLow
    ? Math.min(low.maxDailyCount, Math.floor(bucket.count * low.targetShare))
    : 0;
  if (hasLow
    && preferredLowCount < Math.min(low.maxDailyCount, bucket.count)
    && rng() < low.overflowWeight) preferredLowCount += 1;
  if (!hasNormal) preferredLowCount = bucket.count;
  if (!hasLow) preferredLowCount = 0;
  if (preferredLowCount > low.maxDailyCount) {
    throw new RangeError(`Unable to schedule galaxy events for Türkiye day ${String(bucket.localDay)}`);
  }

  const maximumLowCount = hasLow ? Math.min(low.maxDailyCount, bucket.count) : 0;
  const lowCountCandidates = [preferredLowCount];
  for (let distance = 1; distance <= bucket.count; distance += 1) {
    if (preferredLowCount + distance <= maximumLowCount) {
      lowCountCandidates.push(preferredLowCount + distance);
    }
    if (preferredLowCount - distance >= 0) lowCountCandidates.push(preferredLowCount - distance);
  }

  for (const lowCount of lowCountCandidates) {
    const normalCount = bucket.count - lowCount;
    if ((!hasNormal && normalCount > 0) || (!hasLow && lowCount > 0)) continue;
    for (let attempt = 0; attempt < config.calendar.candidateAttempts; attempt += 1) {
      const previous = priorStarts.at(-1) ?? null;
      const quiet = drawStarts(rng, lowCount, lowFrom, lowUntil, minimumGap, previous);
      const normal = drawStarts(
        rng,
        normalCount,
        normalFrom,
        normalUntil,
        minimumGap,
        quiet?.at(-1) ?? previous,
      );
      if (!quiet || !normal) continue;
      const starts = [...quiet, ...normal].sort((left, right) => left - right);
      const combined = [...priorStarts.slice(-1), ...starts];
      if (starts.length !== new Set(starts).size) continue;
      if (combined.every((start, index) =>
        index === 0 || canFollow(combined[index - 1]!, start, minimumGap))) return starts;
    }
  }

  throw new RangeError(
    `Unable to schedule galaxy events for Türkiye day ${String(bucket.localDay)}`
    + ` (count=${String(bucket.count)}, preferredQuiet=${String(preferredLowCount)},`
    + ` prior=${String(priorStarts.at(-1) ?? 'none')})`,
  );
}

/** Generate the immutable event occurrence plan for one season. */
export function generateGalaxyEventSchedule(
  input: GenerateGalaxyEventScheduleInput,
): PlannedGalaxyEvent[] {
  const config = input.config ?? GALAXY_EVENTS;
  validateConfig(config);
  if (!Number.isFinite(input.seasonStartsAtUnixMinute)) {
    throw new RangeError('seasonStartsAtUnixMinute must be finite');
  }
  if (!Number.isFinite(input.seasonDurationMinutes) || input.seasonDurationMinutes <= 0) {
    throw new RangeError('seasonDurationMinutes must be positive');
  }

  const seasonEndsAt = input.seasonStartsAtUnixMinute + input.seasonDurationMinutes;
  const buckets = calendarBuckets(input, config);
  let starts: number[] | null = null;
  let lastFailure: unknown;
  // A late event on one Türkiye date can make a short final calendar fragment
  // impossible even though another valid placement exists. Retry the bounded
  // whole-season placement so the prior date is reconsidered too; never relax a
  // cooldown or silently drop the final occurrence.
  for (let attempt = 0; attempt < config.calendar.candidateAttempts; attempt += 1) {
    const candidate: number[] = [];
    try {
      for (const bucket of buckets) {
        candidate.push(...planBucket(bucket, candidate, seasonEndsAt, input.rng, config));
      }
      starts = candidate;
      break;
    } catch (error) {
      lastFailure = error;
    }
  }
  if (!starts) {
    const detail = lastFailure instanceof Error ? `: ${lastFailure.message}` : '';
    throw new RangeError(`Unable to schedule galaxy events${detail}`);
  }

  const shower = config.definitions.ASTEROID_SHOWER;
  const schedule = starts
    .sort((left, right) => left - right)
    .map((startsAt, sequence): PlannedGalaxyEvent => ({
      sequence,
      kind: 'ASTEROID_SHOWER',
      startsAtMinute: startsAt - input.seasonStartsAtUnixMinute,
      endsAtMinute: startsAt - input.seasonStartsAtUnixMinute + shower.durationMinutes,
      definitionVersion: shower.version,
      effect: { asteroidSpawnMultiplier: shower.effect.asteroidSpawnMultiplier },
    }));
  assertMutuallyExclusiveEventWindows(schedule, config.mutuallyExclusive);
  return schedule;
}
