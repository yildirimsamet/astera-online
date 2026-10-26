import {
  COMBAT_CLASSES,
  HULLS,
  combatValue,
  counteredBy,
  counters,
  fleetEntries,
} from './hulls.js';
import { INTEL } from './constants.js';
import type { ClassReading } from './intel.js';
import type { CombatClass, Fleet, HullClass } from './types.js';

/**
 * WHAT THE WING'S OWN CLASSES DO AGAINST THE WALL THE PROBE READ — AND WHAT IT DID NOT READ.
 * 2026-09-21.
 *
 * THE RULE WAS IN THE GAME AND NOWHERE ON THE SCREEN. `MatchupMark` — the chip that draws the
 * counter cycle's x1.6 and x0.625 — has existed and been unit-tested since D124 and was rendered
 * by nothing. Its docblock says why, and the reason was correct when it was written: *"a probe
 * reports a defence value and a ship count and never a composition (D127)"*. D199 changed that and
 * the chip was never revisited; the cycle that decides every fight was legible only in the battle
 * report, after the fleet was gone. Measured: a mirror-class wing loses 631,777 where the correct
 * counter loses 159,289.
 *
 * BUT A READING IS NOT A WALL, AND THIS IS THE HALF THAT IS EASY TO GET WRONG. A par probe
 * (accuracy 0.55, exactly what an equal Shipyard buys) names only the MAJORITY: a pure Lance wall
 * and a 51/49 Lance/Skirmisher wall both read `DOMINANT: LANCE`. Measured, the same advice against
 * those two walls costs 256,277 and 504,946 alloy-equivalent — double. A surface that printed one
 * answer for both would be inventing precision the commander did not buy, which is the exact
 * failure D127's rule exists to prevent.
 *
 * SO THE UNREAD SHARE IS PART OF THE ANSWER, not an omission from it: a `DOMINANT` reading admits
 * the pure wall AND both 50/50 edges, and this function must not collapse that knowledge back to
 * one class.
 *
 * SUPPORT IS NOT A ROW. It sits outside the cycle in both directions and a chip claiming otherwise
 * would teach a rule that does not exist; `CounterLine` gives it its own sentence for the same
 * reason.
 *
 * ROWS ARE ORDERED BY WHAT THE WING ACTUALLY CARRIES, on `combatValue` — the axis the launch sheet
 * already compares the two sides on — so the first row is the one most of the fleet is flying
 * under, not the first letter of an enum.
 */
export interface WingMatchupRow {
  cls: CombatClass;
  /** Share of the READ wall this class is strong against. */
  strongShare: number;
  /** Share of the READ wall that is strong against it. */
  weakShare: number;
  /** A range reading's tops: the floors are the shares above. */
  strongHigh?: number;
  weakHigh?: number;
}

/** One class the reading actually resolved, and how much of the wall it holds. */
export interface WallShareRow {
  cls: CombatClass;
  share: number;
  /** A range reading's top; `share` is then its floor. */
  high?: number;
}

export interface WingMatchup {
  /**
   * How much of the wall the reading actually resolved.
   *
   * `MAJORITY` — one class holds more than half and the rest is unmeasured.
   * `SPLIT`    — the whole composition is known.
   * `MIXED`    — no class holds half; there is no single hard counter to name.
   * `RANGES`   — every class as a range (combat v3): floors in the shares, tops beside them.
   */
  kind: 'MAJORITY' | 'SPLIT' | 'MIXED' | 'RANGES';
  rows: readonly WingMatchupRow[];
  /**
   * THE READING ITSELF, LARGEST CLASS FIRST — independent of what the player is carrying.
   *
   * `rows` answers "what does MY Bulwark do against this wall", which needs a wing to be keyed by;
   * a commander who has not picked a ship yet, or who is carrying one class, still paid for the
   * whole reading and is owed all of it. A `SHARES` probe that resolved 60 Lance · 30 Bulwark ·
   * 10 Skirmisher carries three rows here; a `DOMINANT` one carries the single class it named,
   * with the rest of the wall in `unknownShare`; `EVEN` and `UNREAD` carry none.
   *
   * Zero shares are dropped: a class the probe measured at nothing is not part of the wall.
   */
  wallShares: readonly WallShareRow[];
  /** The share of the wall this reading left unmeasured. Zero only for a full split. */
  unknownShare: number;
  /**
   * The class the reading NAMED — the majority for `MAJORITY`, the largest component for `SPLIT`,
   * null for `MIXED`. It is what a surface says "mostly X" about; `beats` is what to do about it.
   */
  wall: CombatClass | null;
  /** What to bring, when the reading resolves enough to name one thing. Null for `MIXED`. */
  beats: CombatClass | null;
  /** A single-class wing has no cover if its own counter sits in the unread share. */
  wingSingleClass: boolean;
}

export function matchupsAgainst(
  wing: Fleet,
  reading: ClassReading | undefined,
): WingMatchup | null {
  const known = knownShares(reading);
  if (!known) return null;

  const carried = new Map<CombatClass, number>();
  for (const [id, n] of fleetEntries(wing)) {
    const hull = HULLS[id];
    if (hull.atk <= 0) continue;
    if (!isCombatClass(hull.cls)) continue;
    carried.set(hull.cls, (carried.get(hull.cls) ?? 0) + combatValue({ [id]: n }));
  }

  const { highs } = known;
  const rows = [...carried.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([cls]) => ({
      cls,
      strongShare: known.shares[counters(cls)],
      ...(highs ? { strongHigh: highs[counters(cls)] } : {}),
      weakShare: known.shares[counteredBy(cls)],
      ...(highs ? { weakHigh: highs[counteredBy(cls)] } : {}),
    }));

  // A range is named and ranked by its middle: all the reading says about where the truth sits.
  const middle = { ...known.shares };
  if (highs) for (const cls of COMBAT_CLASSES) middle[cls] = (known.shares[cls] + highs[cls]) / 2;
  const wallShares = COMBAT_CLASSES
    .map((cls) => ({ cls, share: known.shares[cls], ...(highs ? { high: highs[cls] } : {}) }))
    .filter((row) => (row.high ?? row.share) > 0)
    .sort((a, b) => middle[b.cls] - middle[a.cls]);

  return {
    kind: known.kind,
    rows,
    wallShares,
    unknownShare: known.unknownShare,
    wall: known.kind === 'MIXED' ? null : largestOf(middle),
    beats: known.kind === 'MIXED' ? null : bestAgainst(middle),
    wingSingleClass: carried.size === 1,
  };
}

/**
 * WHAT THE READING RESOLVED, AS SHARES OF THE WALL, PLUS WHAT IT DID NOT.
 *
 * A `DOMINANT` reading is a FLOOR, not a figure: it says one class holds more than
 * `INTEL.classMajority` and says nothing about the rest. Crediting it the majority share and
 * leaving the remainder explicitly unknown is the honest reading of that sentence: it admits the
 * pure wall and both 50/50 edges.
 */
function knownShares(reading: ClassReading | undefined):
  { kind: WingMatchup['kind']; shares: Record<CombatClass, number>; highs?: Record<CombatClass, number>; unknownShare: number } | null {
  const empty = (): Record<CombatClass, number> =>
    ({ SKIRMISHER: 0, BULWARK: 0, LANCE: 0 });
  switch (reading?.kind) {
    case 'DOMINANT': {
      const shares = empty();
      shares[reading.cls] = INTEL.classMajority;
      return { kind: 'MAJORITY', shares, unknownShare: 1 - INTEL.classMajority };
    }
    case 'SHARES': {
      const sum = COMBAT_CLASSES.reduce((t, cls) => t + Math.max(0, reading.shares[cls]), 0);
      if (sum <= 0) return null;
      const shares = empty();
      for (const cls of COMBAT_CLASSES) shares[cls] = Math.max(0, reading.shares[cls]) / sum;
      return { kind: 'SPLIT', shares, unknownShare: 0 };
    }
    case 'EVEN':
      return { kind: 'MIXED', shares: empty(), unknownShare: 1 };
    case 'RANGES': {
      const shares = empty(), highs = empty();
      for (const cls of COMBAT_CLASSES) {
        shares[cls] = reading.shares[cls].low / 100;
        highs[cls] = reading.shares[cls].high / 100;
      }
      return { kind: 'RANGES', shares, highs, unknownShare: Math.max(0, 1 - COMBAT_CLASSES.reduce((t, cls) => t + shares[cls], 0)) };
    }
    default:
      return null;
  }
}

/**
 * THE CLASS WITH THE BEST NET EXPOSURE TO WHAT WAS READ — never the largest share blindly.
 *
 * Against a 60% Lance / 30% Bulwark / 10% Skirmisher wall the biggest component is Lance, but
 * bringing its counter also hands 30% of the wall a counter of its own. Net share is the figure a
 * commander is actually choosing on. Ties answer null rather than picking a side.
 */
function bestAgainst(shares: Record<CombatClass, number>): CombatClass | null {
  const ranked = [...COMBAT_CLASSES]
    .map((cls) => ({
      cls,
      net: shares[counters(cls)] - shares[counteredBy(cls)],
    }))
    .sort((a, b) => b.net - a.net);
  const [top, next] = ranked;
  if (!top || top.net <= 0) return null;
  return next?.net === top.net ? null : top.cls;
}

/** The biggest component the reading resolved; ties answer null rather than picking one. */
function largestOf(shares: Record<CombatClass, number>): CombatClass | null {
  const ranked = [...COMBAT_CLASSES]
    .map((cls) => ({ cls, share: shares[cls] }))
    .sort((a, b) => b.share - a.share);
  const [top, next] = ranked;
  if (!top || top.share <= 0) return null;
  return next?.share === top.share ? null : top.cls;
}

const isCombatClass = (cls: HullClass): cls is CombatClass =>
  (COMBAT_CLASSES as readonly HullClass[]).includes(cls);
