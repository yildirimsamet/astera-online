import { GALAXY_EVENTS, hashSeed, mulberry32 } from '@astera/rules';
import { BOTS } from './personas.js';

/**
 * WHO IS AT THE CONTROLS, AND WHEN. D159.
 *
 * Pure arithmetic over a wall clock: no database, no `Date.now()`, no ambient
 * randomness. Everything is derived from `(perGalaxy, seasonSeed, instant)`, so the
 * roster is reproducible, testable minute by minute, and identical on every process
 * that asks — which is what lets the presence sweep be a plain `UPDATE` with no
 * coordination behind it.
 *
 * TWO PROMISES ARE MADE TO THE OWNER AND BOTH ARE STRUCTURAL RATHER THAN AIMED AT:
 *
 *   · Nobody is awake between 01:00 and 08:00 Türkiye time. The zeros in
 *     `BOTS.awakeByLocalHour` are read as a blackout and the edge jitter below is
 *     clamped inside the active band, so no rounding can leak a commander into the
 *     quiet hours.
 *   · At least four and at most twelve are awake at every other minute. The count
 *     for a slot IS the curve's value — it is not sampled or drawn — and the jitter
 *     may only ever ADD a commander to a minute, never remove one. A floor that is
 *     computed cannot dip; a floor that is rolled for can, and would, at 08:07.
 *
 * The Türkiye clock comes from `GALAXY_EVENTS.calendar.utcOffsetMinutes`, the pinned
 * offset the public-event calendar already versions. A second copy of "+180" in this
 * file would be a second thing to forget on the day that law changes.
 */

const DAY_MINUTES = 24 * 60;
const OFFSET_MS = GALAXY_EVENTS.calendar.utcOffsetMinutes * 60_000;

interface LocalInstant {
  /** Days since the epoch, counted on the Türkiye calendar. */
  readonly day: number;
  /** Minutes since local midnight. */
  readonly minute: number;
}

const localInstant = (at: Date): LocalInstant => {
  const shifted = at.getTime() + OFFSET_MS;
  const totalMinutes = Math.floor(shifted / 60_000);
  return {
    day: Math.floor(totalMinutes / DAY_MINUTES),
    minute: ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES,
  };
};

/**
 * How many commanders the curve wants awake in the slot covering this instant.
 *
 * Exported because it is the honest way to describe the roster on `/health` and in
 * a test, and because a caller that re-derives it from the table would be a second
 * statement of the same rule.
 */
export function awakeTargetAt(perGalaxy: number, at: Date): number {
  if (perGalaxy <= 0) return 0;
  return scaledTarget(perGalaxy, hourTarget(localInstant(at).minute));
}

const hourTarget = (localMinute: number): number =>
  BOTS.awakeByLocalHour[Math.floor(localMinute / 60)] ?? 0;

/**
 * The published curve is written for a roster of `BOTS.perGalaxy`; a smaller galaxy
 * gets the same SHAPE rather than the same numbers. A waking hour never scales to
 * nobody — an empty sky during the day is the bug this whole feature is about.
 */
const scaledTarget = (perGalaxy: number, raw: number): number => {
  if (raw <= 0) return 0;
  if (perGalaxy === BOTS.perGalaxy) return Math.min(raw, perGalaxy);
  const scaled = Math.round((raw * perGalaxy) / BOTS.perGalaxy);
  return Math.max(1, Math.min(perGalaxy, scaled));
};

const SLOTS_PER_DAY = DAY_MINUTES / BOTS.slotMinutes;

/** One Türkiye day's roster: which ordinals are on in each slot. */
type DayRoster = readonly ReadonlySet<number>[];

/**
 * A DAY IS BUILT AS A WHOLE, because a slot's answer depends on the slot before it.
 *
 * Continuity is the thing being bought: a commander who is on at 19:00, off at
 * 19:30 and on again at 20:00 is not a person, and no amount of per-slot randomness
 * produces a session. So each slot KEEPS as many of the previous slot's commanders
 * as its target allows and fills the rest from whoever has been on least today.
 */
function buildDay(perGalaxy: number, seasonSeed: number, day: number): DayRoster {
  const roster: Set<number>[] = [];
  const order = dayOrder(perGalaxy, seasonSeed, day);
  const rank = new Map(order.map((ordinal, index) => [ordinal, index]));
  const awakeSoFar = new Array<number>(perGalaxy).fill(0);
  const runLength = new Map<number, number>();
  let previous: number[] = [];

  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    const target = scaledTarget(perGalaxy, hourTarget(slot * BOTS.slotMinutes));
    if (target === 0) {
      roster.push(new Set());
      runLength.clear();
      previous = [];
      continue;
    }

    /*
      Held over from the last slot, shortest sitting first.

      A commander at or past `maxSessionSlots` sorts behind everyone who is not, so
      they are the first to be let go — and the LAST to be picked back up by the
      fill below, because a long sitting is also a large `awakeSoFar`. That is what
      makes the cap a preference the schedule honours whenever it has the slack, and
      quietly suspends at the evening peak when the target is the whole roster.
    */
    const spent = (ordinal: number): boolean => (runLength.get(ordinal) ?? 0) >= BOTS.maxSessionSlots;
    const kept = previous
      .filter((ordinal) => !spent(ordinal))
      .sort((a, b) => (runLength.get(b) ?? 0) - (runLength.get(a) ?? 0)
        || (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
      .slice(-target);

    const onNow = new Set(kept);
    if (onNow.size < target) {
      const fill = [...Array(perGalaxy).keys()]
        .filter((ordinal) => !onNow.has(ordinal))
        .sort((a, b) =>
          Number(spent(a)) - Number(spent(b))
          || (awakeSoFar[a] ?? 0) - (awakeSoFar[b] ?? 0)
          || (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
      for (const ordinal of fill) {
        if (onNow.size >= target) break;
        onNow.add(ordinal);
      }
    }

    for (const ordinal of onNow) {
      runLength.set(ordinal, previous.includes(ordinal) ? (runLength.get(ordinal) ?? 0) + 1 : 1);
      awakeSoFar[ordinal] = (awakeSoFar[ordinal] ?? 0) + 1;
    }
    for (const ordinal of runLength.keys()) if (!onNow.has(ordinal)) runLength.delete(ordinal);

    roster.push(onNow);
    previous = [...onNow];
  }

  return roster;
}

/** A fresh deal of the roster each Türkiye day, so the same four are not always the morning. */
function dayOrder(perGalaxy: number, seasonSeed: number, day: number): number[] {
  const rng = mulberry32(hashSeed('astera:bots:day', seasonSeed, day));
  const order = [...Array(perGalaxy).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = order[i] ?? 0;
    const b = order[j] ?? 0;
    order[i] = b;
    order[j] = a;
  }
  return order;
}

/**
 * How far one commander stretches past the edges of a slot they are rostered for.
 *
 * ONE-DIRECTIONAL BY CONSTRUCTION: it may pull a start earlier and push an end
 * later, and it can do nothing else. Twelve commanders whose sessions all begin
 * exactly on the half hour is the shape of a scheduler; the stretch is what breaks
 * that up without ever costing the minimum four the owner asked for.
 */
const edgeStretch = (seasonSeed: number, day: number, slot: number, ordinal: number): number =>
  Math.floor(
    mulberry32(hashSeed('astera:bots:edge', seasonSeed, day, slot, ordinal))()
    * (BOTS.slotMinutes / 2 + 1),
  );

/** Two days is enough: the sweep asks about now, and midnight asks about both sides of it. */
const cache = new Map<string, DayRoster>();

function rosterFor(perGalaxy: number, seasonSeed: number, day: number): DayRoster {
  const key = `${String(perGalaxy)}:${String(seasonSeed)}:${String(day)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const built = buildDay(perGalaxy, seasonSeed, day);
  if (cache.size > 8) cache.clear();
  cache.set(key, built);
  return built;
}

/**
 * Which seated commanders are at the controls at this instant.
 *
 * Returns ordinals, not ids: the roster is a property of the SEAT, so it is the
 * same answer before and after a season wipe reseats the same names.
 */
export function botsAwakeAt(perGalaxy: number, seasonSeed: number, at: Date): Set<number> {
  if (perGalaxy <= 0) return new Set();
  const { day, minute } = localInstant(at);
  const slot = Math.floor(minute / BOTS.slotMinutes);
  const roster = rosterFor(perGalaxy, seasonSeed, day);

  // A slot the curve blacked out is a blackout, full stop. Nothing below may add
  // to it, which is what keeps 01:00–08:00 provably empty.
  const here = roster[slot];
  if (!here) return new Set();
  if (scaledTarget(perGalaxy, hourTarget(minute)) === 0) return new Set();

  const awake = new Set(here);
  const intoSlot = minute - slot * BOTS.slotMinutes;
  const leftOfSlot = BOTS.slotMinutes - intoSlot;

  // Staying a little past the end of a sitting they were already in.
  const before = roster[slot - 1];
  if (before) {
    for (const ordinal of before) {
      if (intoSlot < edgeStretch(seasonSeed, day, slot - 1, ordinal)) awake.add(ordinal);
    }
  }
  // Sitting down a little before the sitting they are about to be in.
  const after = roster[slot + 1];
  if (after) {
    for (const ordinal of after) {
      if (leftOfSlot <= edgeStretch(seasonSeed, day, slot + 1, ordinal)) awake.add(ordinal);
    }
  }

  return awake;
}
