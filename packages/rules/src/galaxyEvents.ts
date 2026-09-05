import { GALAXY_EVENTS } from './constants.js';
import type { TradeRate } from './trade.js';
import type { Rng } from './types.js';

const DAY_MINUTES = 24 * 60;

export type GalaxyEventKind = 'ASTEROID_SHOWER' | 'TRADE_SHIP';

/**
 * THE PLANNING ORDER, AND IT IS A CONTRACT RATHER THAN A LIST. D156.
 *
 * A season's calendar is dealt once at creation and persisted, so a change that
 * silently re-deals it would not fail anywhere — every future season would just
 * quietly be a different season, and the Asteroid Shower has been live since
 * D149. Two properties keep that impossible, and both are load-bearing:
 *
 *   · ONE STREAM PER KIND. `rngFor` is asked once for each kind, so a lane added
 *     later cannot consume a draw an existing lane was going to take.
 *   · A FIXED KIND ORDER WITH ASTEROID_SHOWER FIRST, iterated from THIS array and
 *     never from the caller's `kinds`, so asking for a subset cannot reorder what
 *     is left. A new kind is APPENDED. It is never inserted.
 *
 * `galaxy-events.test.ts` asserts the shower slice of a full calendar equals the
 * shower-only calendar, which is the in-repo form of that proof.
 */
export const GALAXY_EVENT_KINDS: readonly GalaxyEventKind[] = ['ASTEROID_SHOWER', 'TRADE_SHIP'];

export interface AsteroidShowerEffect {
  asteroidSpawnMultiplier: number;
}

export interface TradeShipEffect {
  rate: TradeRate;
}

/** What each kind's occurrence carries. One entry per member of the union. */
export interface GalaxyEventEffects {
  ASTEROID_SHOWER: AsteroidShowerEffect;
  TRADE_SHIP: TradeShipEffect;
}

interface PlannedGalaxyEventBase {
  /**
   * Position in this KIND's own calendar, 0-based and in start order.
   *
   * Per kind, never global: the persisted unique index is
   * `(season_id, kind, sequence)`, so a shower and a merchant may both be number
   * three and an added lane never renumbers an existing one.
   */
  sequence: number;
  /** Minutes since the season's exact start instant. */
  startsAtMinute: number;
  /** Minutes since the season's exact start instant. */
  endsAtMinute: number;
  definitionVersion: number;
}

export type PlannedGalaxyEvent =
  | (PlannedGalaxyEventBase & { kind: 'ASTEROID_SHOWER'; effect: AsteroidShowerEffect })
  | (PlannedGalaxyEventBase & { kind: 'TRADE_SHIP'; effect: TradeShipEffect });

export interface GalaxyEventDefinition<Effect> {
  readonly version: number;
  /**
   * Starts on one full Türkiye calendar date, FOR THIS KIND ALONE.
   *
   * It used to live on `calendar`, where it read as a property of the schedule
   * rather than of the event, and the day a second kind arrived the two would
   * have had to share a rate. A shower is five a day; a merchant is three.
   */
  readonly dailyCount: { readonly min: number; readonly max: number };
  readonly durationMinutes: number;
  readonly repeatCooldownMinutes: number;
  /**
   * THIS KIND'S OWN NIGHT, AND EXACTLY HOW MANY OF ITS WINDOWS BELONG IN IT. D166.
   *
   * Optional, and absent for a kind that is happy with the calendar-wide
   * `lowPriorityWindow`. That shared rule is a SHARE with a ceiling plus an
   * `overflowWeight` coin flip — right for a shower nobody has to attend, and wrong
   * for a promise like "one merchant a night", which either lands every night or is
   * not a promise. So a kind may state its own hours and an EXACT count instead.
   *
   * The exact count is a floor and a ceiling at once: the planner places precisely
   * this many starts inside the window and none of the rest, and fails the day
   * rather than quietly delivering a different shape.
   */
  readonly quietWindow?: {
    readonly startsAtLocalMinute: number;
    readonly endsAtLocalMinute: number;
    readonly exactDailyCount: number;
  };
  readonly effect: Effect;
}

export type GalaxyEventDefinitions = {
  readonly [Kind in GalaxyEventKind]: GalaxyEventDefinition<GalaxyEventEffects[Kind]>;
};

export interface GalaxyEventsConfig {
  readonly version: number;
  /** Everything genuinely common to every kind: the clock, the quiet band, effort. */
  readonly calendar: {
    readonly timeZone: string;
    readonly utcOffsetMinutes: number;
    readonly lowPriorityWindow: {
      readonly startsAtLocalMinute: number;
      readonly endsAtLocalMinute: number;
      readonly targetShare: number;
      readonly overflowWeight: number;
      readonly maxDailyCount: number;
    };
    readonly candidateAttempts: number;
  };
  readonly definitions: GalaxyEventDefinitions;
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
  /**
   * One independent stream per kind, so a new lane cannot re-roll an existing one.
   *
   * Asked exactly once per PLANNED kind, and never for a kind this season is not
   * entitled to — a caller may build its streams lazily.
   */
  rngFor: (kind: GalaxyEventKind) => Rng;
  config?: GalaxyEventsConfig;
  /** Which kinds this season is entitled to. Defaults to all of them. */
  kinds?: readonly GalaxyEventKind[];
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

/**
 * What one kind's occurrence is allowed to carry.
 *
 * Dispatched on the effect's own SHAPE rather than on a name, because the loop
 * that calls it walks every definition in the config: reaching for one kind by
 * name is exactly how `validateConfig` stayed single-kind by construction while
 * looking generic.
 */
function validateEffect(kind: string, effect: AsteroidShowerEffect | TradeShipEffect): void {
  if ('asteroidSpawnMultiplier' in effect) {
    if (!Number.isFinite(effect.asteroidSpawnMultiplier) || effect.asteroidSpawnMultiplier <= 1) {
      throw new RangeError(`${kind} multiplier must be greater than one`);
    }
    return;
  }
  for (const [resource, units] of Object.entries(effect.rate)) {
    if (!Number.isFinite(units) || units <= 0) {
      throw new RangeError(`${kind} rate.${resource} must be positive`);
    }
  }
}

function validateConfig(config: GalaxyEventsConfig): void {
  const { calendar } = config;
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

  // Every definition, by iteration. A kind added to the union but left out of the
  // config is a type error; a kind added to the config and forgotten here is not,
  // which is why nothing below names one.
  for (const [kind, definition] of Object.entries(config.definitions)) {
    assertFiniteInteger(definition.dailyCount.min, `${kind}.dailyCount.min`, 0);
    assertFiniteInteger(definition.dailyCount.max, `${kind}.dailyCount.max`, 0);
    if (definition.dailyCount.min > definition.dailyCount.max) {
      throw new RangeError(`${kind}.dailyCount.min cannot exceed dailyCount.max`);
    }
    if (!Number.isFinite(definition.durationMinutes) || definition.durationMinutes <= 0) {
      throw new RangeError(`${kind}.durationMinutes must be positive`);
    }
    if (!Number.isFinite(definition.repeatCooldownMinutes)
      || definition.repeatCooldownMinutes < 0) {
      throw new RangeError(`${kind}.repeatCooldownMinutes cannot be negative`);
    }
    validateEffect(kind, definition.effect);
  }
}

const randomInteger = (rng: Rng, minimum: number, maximum: number): number =>
  minimum + Math.floor(rng() * (maximum - minimum + 1));

/**
 * Split the season into Türkiye calendar dates without consulting process locale.
 * Largest-remainder allocation keeps a fixed five/day config at exactly seventy
 * occurrences across an arbitrary-start fourteen-day season.
 *
 * THE DRAW ORDER IS PART OF THE CONTRACT: one `randomInteger` per bucket, taken
 * here, BEFORE any placement draw. Reordering this against `planBucket` would
 * re-deal every existing season's shower calendar.
 */
function calendarBuckets(
  seasonStartsAt: number,
  seasonDurationMinutes: number,
  config: GalaxyEventsConfig,
  dailyCount: { readonly min: number; readonly max: number },
  rng: Rng,
) {
  const seasonEndsAt = seasonStartsAt + seasonDurationMinutes;
  const offset = config.calendar.utcOffsetMinutes;
  const firstDay = Math.floor((seasonStartsAt + offset) / DAY_MINUTES);
  const lastDay = Math.floor(((seasonEndsAt - Number.EPSILON) + offset) / DAY_MINUTES);
  const buckets: CalendarBucket[] = [];

  for (let localDay = firstDay; localDay <= lastDay; localDay += 1) {
    const dayStartsAt = localDay * DAY_MINUTES - offset;
    const eligibleStartsAt = Math.max(seasonStartsAt, dayStartsAt);
    const eligibleEndsAt = Math.min(seasonEndsAt, dayStartsAt + DAY_MINUTES);
    const drawnCount = randomInteger(rng, dailyCount.min, dailyCount.max);
    const idealCount = drawnCount * (eligibleEndsAt - eligibleStartsAt) / DAY_MINUTES;
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

/**
 * Place one Türkiye date's starts for ONE kind.
 *
 * `definition` carries the gap, and that is the whole of the per-kind rule: a
 * trade ship's three-hour cooldown says nothing about a shower, and a shower's two
 * says nothing about a trade ship. The low-priority night band is shared, because
 * quiet hours are a property of the players rather than of the event.
 */
function planBucket(
  bucket: CalendarBucket,
  priorStarts: readonly number[],
  seasonEndsAt: number,
  rng: Rng,
  config: GalaxyEventsConfig,
  definition: GalaxyEventDefinition<unknown>,
): number[] {
  if (bucket.count === 0) return [];
  /**
   * THE KIND'S OWN NIGHT WHERE IT HAS ONE, THE CALENDAR'S OTHERWISE. D166.
   *
   * `own` is what makes the merchant's "exactly one a night" expressible: it fixes
   * both the hours and the count, so the search below has a single candidate
   * instead of a preferred one surrounded by fallbacks. A kind without it takes the
   * shared heuristic unchanged — including the `rng()` draw, which is why the
   * shower's stream is byte-identical across this change (D149).
   */
  const own = definition.quietWindow;
  const shared = config.calendar.lowPriorityWindow;
  const window = own ?? shared;
  const maxLowForKind = own ? own.exactDailyCount : shared.maxDailyCount;
  const minimumGap = definition.durationMinutes + definition.repeatCooldownMinutes;
  /*
    THE LAST MINUTE A WINDOW MAY OPEN ON, AND IT HAS TO BE FLOORED. D166.

    Starts are integers while a season's start is not — it is a wall-clock instant
    divided by 60,000 — so `seasonEndsAt` can carry a fraction. `X.5 - duration + 1`
    then admits the integer `X - duration + 1`, whose window ends half a minute past
    the season. The `+ 1` is the exclusive bound; the floor is what keeps it from
    rounding a fractional season outward.
  */
  const latestStartExclusive = Math.floor(seasonEndsAt - definition.durationMinutes) + 1;
  const lowFrom = Math.max(bucket.eligibleStartsAt, bucket.dayStartsAt + window.startsAtLocalMinute);
  const lowUntil = Math.min(
    bucket.eligibleEndsAt,
    bucket.dayStartsAt + window.endsAtLocalMinute,
    latestStartExclusive,
  );
  /*
    A KIND WITH ITS OWN NIGHT HAS TWO ORDINARY BANDS, NOT ONE. The shared window
    opens at midnight, so "not quiet" is simply everything after it; the merchant's
    opens at 01:00, which leaves the hour before it ordinary as well. Modelling that
    as one range from `endsAtLocalMinute` would silently make the small hours
    eligible for a `normal` start, which is the opposite of the instruction.
  */
  const normalFrom = Math.max(bucket.eligibleStartsAt, bucket.dayStartsAt + window.endsAtLocalMinute);
  const normalUntil = Math.min(bucket.eligibleEndsAt, latestStartExclusive);
  /*
    A KIND WITH ITS OWN NIGHT LEAVES A SLIVER THAT BELONGS TO NEITHER BAND.

    The shared window opens at midnight, so "not quiet" is simply everything after
    it. The merchant's opens at 01:00, which leaves 00:00–01:00 outside both — and a
    season fragment landing entirely inside that hour has nowhere legal to put its
    one start, so the whole calendar failed to generate. A fragment is the ragged
    end of a season and nobody is promised anything about it, so the night band is
    stretched to cover the sliver rather than the day being refused. A WHOLE day
    never reaches this: it always has room after 08:00.
  */
  const stranded = own !== undefined
    && integerRange(lowFrom, lowUntil) === null
    && integerRange(normalFrom, normalUntil) === null;
  const quietFrom = stranded ? bucket.eligibleStartsAt : lowFrom;
  const quietUntil = stranded
    ? Math.min(bucket.eligibleEndsAt, latestStartExclusive)
    : lowUntil;
  const hasLow = integerRange(quietFrom, quietUntil) !== null;
  const hasNormal = integerRange(normalFrom, normalUntil) !== null;

  let preferredLowCount = hasLow
    ? Math.min(maxLowForKind, own ? own.exactDailyCount : Math.floor(bucket.count * shared.targetShare))
    : 0;
  if (!own
    && hasLow
    && preferredLowCount < Math.min(shared.maxDailyCount, bucket.count)
    && rng() < shared.overflowWeight) preferredLowCount += 1;
  if (!hasNormal) preferredLowCount = bucket.count;
  if (!hasLow) preferredLowCount = 0;
  if (preferredLowCount > maxLowForKind && hasNormal) {
    throw new RangeError(`Unable to schedule galaxy events for Türkiye day ${String(bucket.localDay)}`);
  }

  const maximumLowCount = hasLow ? Math.min(maxLowForKind, bucket.count) : 0;
  /*
    AN EXACT COUNT IS A CEILING THAT ONLY BENDS DOWNWARD. `maximumLowCount` already
    holds it, so the walk below can never place a SECOND merchant at night. What it
    may still do is place none — and it has to, because the first and last buckets
    of a season are partial days whose eligible span can miss 01:00–08:00 entirely.
    A whole day always has room (four starts at a 240-minute gap need 960 of 1,440),
    so the promise holds wherever a promise is meaningful, and the season's ragged
    ends do not fail the whole calendar.
  */
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
      const quiet = drawStarts(rng, lowCount, quietFrom, quietUntil, minimumGap, previous);
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

/** Absolute start instants for one kind's whole season, in ascending order. */
function planKind(
  input: GenerateGalaxyEventScheduleInput,
  config: GalaxyEventsConfig,
  definition: GalaxyEventDefinition<unknown>,
  rng: Rng,
): number[] {
  const seasonEndsAt = input.seasonStartsAtUnixMinute + input.seasonDurationMinutes;
  const buckets = calendarBuckets(
    input.seasonStartsAtUnixMinute,
    input.seasonDurationMinutes,
    config,
    definition.dailyCount,
    rng,
  );
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
        candidate.push(...planBucket(bucket, candidate, seasonEndsAt, rng, config, definition));
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
  return starts.sort((left, right) => left - right);
}

/**
 * Turn one kind's start instants into its occurrence rows.
 *
 * The switch is exhaustive over `GalaxyEventKind`, so a third kind is a COMPILE
 * error here rather than a silently untyped effect — which is the one thing a
 * discriminated union buys that a generic map does not. Each effect is copied
 * rather than shared, so a live plan can never alias the constants object.
 */
function occurrencesFor(
  kind: GalaxyEventKind,
  config: GalaxyEventsConfig,
  starts: readonly number[],
  seasonStartsAtUnixMinute: number,
): PlannedGalaxyEvent[] {
  switch (kind) {
    case 'ASTEROID_SHOWER': {
      const definition = config.definitions.ASTEROID_SHOWER;
      return starts.map((startsAt, sequence) => ({
        sequence,
        kind,
        startsAtMinute: startsAt - seasonStartsAtUnixMinute,
        endsAtMinute: startsAt - seasonStartsAtUnixMinute + definition.durationMinutes,
        definitionVersion: definition.version,
        effect: { asteroidSpawnMultiplier: definition.effect.asteroidSpawnMultiplier },
      }));
    }
    case 'TRADE_SHIP': {
      const definition = config.definitions.TRADE_SHIP;
      return starts.map((startsAt, sequence) => ({
        sequence,
        kind,
        startsAtMinute: startsAt - seasonStartsAtUnixMinute,
        endsAtMinute: startsAt - seasonStartsAtUnixMinute + definition.durationMinutes,
        definitionVersion: definition.version,
        effect: { rate: { ...definition.effect.rate } },
      }));
    }
  }
}

/**
 * Generate the immutable event occurrence plan for one season.
 *
 * Kinds are planned one at a time, each from its own stream, in
 * `GALAXY_EVENT_KINDS` order — see that constant for why both halves of that
 * sentence are load-bearing. The result is grouped by kind and ascending within
 * each group; `sequence` is per kind, so no caller depends on the array order.
 */
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

  const entitled = input.kinds ?? GALAXY_EVENT_KINDS;
  const schedule: PlannedGalaxyEvent[] = [];
  for (const kind of GALAXY_EVENT_KINDS) {
    if (!entitled.includes(kind)) continue;
    const definition = config.definitions[kind];
    const starts = planKind(input, config, definition, input.rngFor(kind));
    schedule.push(...occurrencesFor(kind, config, starts, input.seasonStartsAtUnixMinute));
  }

  assertMutuallyExclusiveEventWindows(schedule, config.mutuallyExclusive);
  return schedule;
}
