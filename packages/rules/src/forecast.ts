import { resolveCombat, type CombatSide } from './combat.js';
import {
  ALL_HULLS,
  COMBAT_CLASSES,
  HULLS,
  MOBILE_HULLS,
  combatValue,
  fleetEntries,
  fleetValue,
} from './hulls.js';
import type { ClassReading } from './intel.js';
import type { TechLevels } from './tech.js';
import type { CombatClass, Fleet, Grade, HullClass, HullId, HullProfile } from './types.js';

/**
 * HOW MUCH OF A WALL THIS WING CAN TAKE. D199.
 *
 * The launch sheet put the wing's firepower beside the wall's and stopped there, so
 * the one question it exists for — is this fight my size — was answered by losing
 * it. Measured on the battle engine: a wing equal to the wall only BREAKS it, and
 * loses two thirds of itself doing so; a clean sweep wants about half as much again.
 * Research, a charged Aegis, ground guns, transports in the line and the counter
 * cycle all move that, from a tenth to three times, so no fixed ratio can be printed.
 *
 * SO THE ENGINE ANSWERS IT. Every wall the reading still allows is built at the
 * tiers this wing flies (the attack band keeps both commanders within one tier of
 * each other, D168) and fought at the mean roll by `resolveCombat` — the function
 * the server grades with — until the wing stops clearing it and stops breaking it.
 * The spread between the least and the most favourable wall is the part of the
 * fight nobody has looked at yet, and it narrows as the reading improves.
 *
 * WHAT IT IS NOT: a verdict. The wall stays a probe's fuzzed, aged band and the
 * ±8% roll is left out on purpose; this is the rule applied to the inputs, and the
 * commander still decides what the band means.
 */

export interface ForecastSpan {
  low: number;
  high: number;
}

/** What is known about the wall's shape — a probe's `ClassReading`, or a crew seen exactly. */
export type WallKnowledge =
  | { kind: 'UNKNOWN' }
  | { kind: 'EVEN' }
  | { kind: 'DOMINANT'; cls: CombatClass }
  /** Whole percents, as the probe prints them. */
  | { kind: 'SHARES'; shares: Readonly<Record<CombatClass, number>> }
  /** A pirate crew under Telescope sight: the very hulls, scaled along the firepower axis. */
  | { kind: 'EXACT'; fleet: Fleet };

export interface ForecastInput {
  /** The launching commander's ladders — frozen at launch, so today's are the ones. */
  attackerTech: TechLevels;
  /** The doctrines a probe brought home, or none. */
  defenderTech: TechLevels;
  /** A pirate crew's handicap (D150). Absent for everybody else. */
  defenderDamageMult?: number;
  /** The Aegis charge, as far as it is known. */
  shield: ForecastSpan;
  /** Hulls in the line that fire nothing, as far as they are known. Ignored for EXACT. */
  unarmed: ForecastSpan;
  wall: WallKnowledge;
}

export interface Forecast {
  /**
   * The firepower at which this wing stops clearing a wall outright (DECISIVE):
   * anything BELOW it is cleared. `low` is the least favourable wall the reading
   * allows, `high` the most favourable.
   */
  clears: ForecastSpan;
  /** The firepower at which it stops even breaking one (PARTIAL or better). */
  breaks: ForecastSpan;
}

/** `varianceMin + 0.5 × span` is exactly 1: the roll neither side is lucky on. */
const MEAN_ROLL = (): number => 0.5;

const cost = (id: HullId): number => HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;

/** The hull of this class and shape nearest this tier. Every tier fields all five shapes (D196). */
function hullAt(cls: HullClass, profile: HullProfile, tier: number): HullId {
  let best: HullId | null = null;
  let gap = Infinity;
  for (const id of MOBILE_HULLS) {
    const h = HULLS[id];
    if (h.cls !== cls || h.profile !== profile || h.tier === null) continue;
    const d = Math.abs(h.tier - tier);
    if (d < gap) {
      best = id;
      gap = d;
    }
  }
  if (best === null) throw new Error(`No ${profile} hull in class ${cls}`);
  return best;
}

type Pick = (tier: number) => HullId;

/**
 * THE HULLS A WALL OF EACH CLASS MAY BE MADE OF, derived from the table rather than
 * named: the tier's Raider or the Skirmisher gun; the tier's Striker; the tier's
 * Fortress, its Escort or the Bulwark gun. The shield-breaker is left out — it is a
 * specialist nobody garrisons.
 */
const groundOf = (cls: CombatClass): Pick[] =>
  ALL_HULLS.filter((id) => HULLS[id].ground && HULLS[id].cls === cls).map((id) => () => id);

const PICKS: Readonly<Record<CombatClass, readonly Pick[]>> = {
  SKIRMISHER: [(t) => hullAt('SKIRMISHER', 'RAIDER', t), ...groundOf('SKIRMISHER')],
  LANCE: [(t) => hullAt('LANCE', 'STRIKER', t), ...groundOf('LANCE')],
  BULWARK: [
    (t) => hullAt('BULWARK', 'FORTRESS', t),
    (t) => hullAt('BULWARK', 'ESCORT', t),
    ...groundOf('BULWARK'),
  ],
};

const transportAt: Pick = (t) => hullAt('SUPPORT', 'TRANSPORT', t);

/** The wing's firepower split by tier; its whole value if nothing fires; tier 1 if it is empty. */
function tierShares(wing: Fleet): Map<number, number> {
  const out = new Map<number, number>();
  const add = (armedOnly: boolean): number => {
    let total = 0;
    for (const [id, n] of fleetEntries(wing)) {
      const h = HULLS[id];
      if (armedOnly && h.atk <= 0) continue;
      const tier = h.tier ?? 1;
      const v = n * cost(id);
      out.set(tier, (out.get(tier) ?? 0) + v);
      total += v;
    }
    return total;
  };
  let total = add(true);
  if (total <= 0) {
    out.clear();
    total = add(false);
  }
  if (total <= 0) return new Map([[1, 1]]);
  for (const [tier, v] of out) out.set(tier, v / total);
  return out;
}

type Shape = Record<CombatClass, number>;
const shape = (parts: Partial<Shape>): Shape => ({ SKIRMISHER: 0, BULWARK: 0, LANCE: 0, ...parts });

/**
 * THE EDGES OF WHAT A READING ALLOWS. A single class, every even pair and the
 * three-way split: a mixed wall can be worse than any pure one against a mixed
 * wing, so the mixes are walls in their own right, not points between the pure ones.
 */
function shapesFor(wall: Exclude<WallKnowledge, { kind: 'EXACT' }>): Shape[] {
  const [a, b, c] = COMBAT_CLASSES as readonly [CombatClass, CombatClass, CombatClass];
  const pairs = [shape({ [a]: 0.5, [b]: 0.5 }), shape({ [a]: 0.5, [c]: 0.5 }), shape({ [b]: 0.5, [c]: 0.5 })];
  const third = shape({ [a]: 1 / 3, [b]: 1 / 3, [c]: 1 / 3 });
  switch (wall.kind) {
    case 'UNKNOWN':
      return [shape({ [a]: 1 }), shape({ [b]: 1 }), shape({ [c]: 1 }), ...pairs, third];
    case 'EVEN':
      return [...pairs, third];
    case 'DOMINANT': {
      const others = COMBAT_CLASSES.filter((cls) => cls !== wall.cls);
      return [shape({ [wall.cls]: 1 }), ...others.map((o) => shape({ [wall.cls]: 0.5, [o]: 0.5 }))];
    }
    case 'SHARES': {
      const sum = COMBAT_CLASSES.reduce((s, cls) => s + Math.max(0, wall.shares[cls]), 0);
      if (sum <= 0) return shapesFor({ kind: 'UNKNOWN' });
      return [shape(Object.fromEntries(
        COMBAT_CLASSES.map((cls) => [cls, Math.max(0, wall.shares[cls]) / sum]),
      ))];
    }
  }
}

/** A wall's warships at a given firepower. */
interface Recipe {
  /** The wall's warships at a given firepower. */
  at: (firepower: number) => Fleet;
  /** How far `at(v)`'s firepower can land from `v`. */
  grain: number;
  /** Where `at` returns the very crew that was seen — a real wall, not a model of one. */
  anchor?: number;
}

/**
 * How far a wall built for a firepower can land from it: each hull type rounds to
 * a whole hull, so by at most half of one of each armed type.
 */
const grainOf = (ids: Iterable<HullId>): number => {
  let g = 0;
  for (const id of ids) if (HULLS[id].atk > 0) g += cost(id) / 2;
  return g;
};

function recipesFor(wall: WallKnowledge, tiers: Map<number, number>): Recipe[] {
  if (wall.kind === 'EXACT') {
    const seen = combatValue(wall.fleet);
    if (seen <= 0) return recipesFor({ kind: 'UNKNOWN' }, tiers);
    return [{
      grain: grainOf(fleetEntries(wall.fleet).map(([id]) => id)),
      anchor: seen,
      at: (firepower) => {
        const out: Fleet = {};
        for (const [id, n] of fleetEntries(wall.fleet)) {
          const count = Math.round((n * firepower) / seen);
          if (count > 0) out[id] = count;
        }
        return out;
      },
    }];
  }

  const recipes: Recipe[] = [];
  for (const s of shapesFor(wall)) {
    const present = COMBAT_CLASSES.filter((cls) => s[cls] > 0);
    // One pick per present class: the cartesian product of their hull choices.
    let choices: [CombatClass, Pick][][] = [[]];
    for (const cls of present) {
      choices = choices.flatMap((chosen) => PICKS[cls].map((pick): [CombatClass, Pick][] => [...chosen, [cls, pick]]));
    }
    for (const chosen of choices) {
      const share = new Map<HullId, number>();
      for (const [tier, tierShare] of tiers) {
        for (const [cls, pick] of chosen) {
          const id = pick(tier);
          share.set(id, (share.get(id) ?? 0) + tierShare * s[cls]);
        }
      }
      recipes.push({
        grain: grainOf(share.keys()),
        at: (firepower) => {
          const out: Fleet = {};
          for (const [id, fraction] of share) {
            const count = Math.round((firepower * fraction) / cost(id));
            if (count > 0) out[id] = count;
          }
          return out;
        },
      });
    }
  }
  return recipes;
}

/** `count` transports spread over the wing's tiers, whole hulls that add back up to `count`. */
function transports(count: number, tiers: Map<number, number>): Fleet {
  const n = Math.max(0, Math.round(count));
  if (n === 0) return {};
  const rows = [...tiers].map(([tier, share]) => ({ tier, exact: share * n }));
  const whole = rows.map((r) => Math.floor(r.exact));
  let left = n - whole.reduce((a, b) => a + b, 0);
  rows
    .map((r, i) => ({ i, rest: r.exact - Math.floor(r.exact) }))
    .sort((x, y) => y.rest - x.rest || x.i - y.i)
    .forEach(({ i }) => {
      if (left > 0) {
        whole[i] = (whole[i] ?? 0) + 1;
        left -= 1;
      }
    });
  const out: Fleet = {};
  rows.forEach((r, i) => {
    const k = whole[i] ?? 0;
    if (k <= 0) return;
    const id = transportAt(r.tier);
    out[id] = (out[id] ?? 0) + k;
  });
  return out;
}

const merge = (a: Fleet, b: Fleet): Fleet => {
  const out: Fleet = { ...a };
  for (const [id, n] of fleetEntries(b)) out[id] = (out[id] ?? 0) + n;
  return out;
};

function fight(wing: Fleet, wall: Fleet, shield: number, input: ForecastInput) {
  const defender: CombatSide = input.defenderDamageMult === undefined
    ? { tech: input.defenderTech }
    : { tech: input.defenderTech, damageMult: input.defenderDamageMult };
  return resolveCombat(wing, wall, shield, MEAN_ROLL, {
    attacker: { tech: input.attackerTech },
    defender,
  });
}

/**
 * THE WALK IS UPWARD, FROM NOTHING, AND STOPS AT THE FIRST LOSS.
 *
 * A line means "below this, the wing wins". Bisection cannot promise that, because
 * the outcome is not monotone in the wall's size: a PARTIAL needs 42% of the line's
 * VALUE destroyed and parked transports count in it, so a small wall in front of a
 * big hangar can hold where a larger one breaks. Halving between a win and a loss
 * finds A boundary, sometimes one far above a loss lower down — measured at twice
 * the true line. So the walk climbs from a sliver of the wing's own firepower,
 * stops at the first loss, and only then looks closer: doubling strides first,
 * quarter-octave steps inside the stride that lost, halving inside the step.
 *
 * MEASURED AGAINST A WALK IN 2% STEPS over a thousand edges of random wings, walls,
 * shields and hangars: 99% land within 4% of it, and six in a thousand sit more than
 * 10% above it — a dip of one or two hulls narrower than a quarter-octave step. A
 * probe's band is ±45% at par, so that is noise under the reading, never over it; a
 * crew seen exactly is anchored instead and never contradicted.
 */
const WALK_FLOOR = 1 / 64;
const WALK_CEILING = 64;
const WALK_STEP = 2 ** 0.25;
const REFINE = 5;

/**
 * The first loss above `from` (a win), or null once the walk has won past `limit`.
 * The stride that crosses the limit is still taken: looking closer inside it can
 * land the edge back under the limit, and stopping short would lose that edge.
 */
function walkUp(
  passesAt: (firepower: number) => boolean,
  from: number,
  start: number,
  limit: number,
): { lo: number; hi: number } | null {
  let lo = from;
  let v = Math.max(from * 2, start * WALK_FLOOR);
  const ceiling = start * WALK_CEILING;
  while (lo <= limit && v <= ceiling) {
    if (!passesAt(v)) {
      let hi = v;
      // A win at nothing says nothing about the stride above it; halve from there.
      for (let step = lo * WALK_STEP; lo > 0 && step < hi; step *= WALK_STEP) {
        if (!passesAt(step)) {
          hi = step;
          break;
        }
        lo = step;
      }
      for (let i = 0; i < REFINE; i++) {
        const mid = (lo + hi) / 2;
        if (passesAt(mid)) lo = mid;
        else hi = mid;
      }
      return { lo, hi };
    }
    lo = v;
    v *= 2;
  }
  return null;
}

/**
 * Where one wall stops being cleared, and where it stops being broken, as the
 * firepower of the first wall each fails against. Zero when the wing fails against
 * an empty-handed wall already: transports alone can hold a wing off.
 *
 * A LIMIT ENDS THE WALK EARLY, and then an edge past it comes back null — all a
 * caller hunting for the LOWEST edge needs to know is that this wall will not
 * lower it. The second walk resumes where the first stopped, because whatever is
 * cleared outright is certainly broken.
 *
 * AN ANCHOR IS A WALL THAT IS REAL. A crew under Telescope sight is drawn on the
 * sheet at its own firepower, so the zone it lands in must be the fight it would
 * be — which a walk from nothing cannot promise, because one hull of rounding in a
 * smaller copy of the crew can lose where the crew itself wins. So the walk starts
 * AT the crew: won, and the line is the first loss above it, strictly past its
 * point; lost, and the line is the first loss at or under it.
 */
function edgesOf(
  wallAt: (firepower: number) => Fleet,
  gradeAt: (firepower: number) => Grade,
  start: number,
  limit: { clears: number; breaks: number },
  anchor?: number,
): { clears: number | null; breaks: number | null } {
  const decisive = (v: number) => gradeAt(v) === 'DECISIVE';
  const standing = (v: number) => gradeAt(v) !== 'REPELLED';
  const top = start * WALK_CEILING;
  const firepowerAt = (v: number) => combatValue(wallAt(v));
  const edgeOf = (
    found: { lo: number; hi: number } | null,
    lim: number,
    above = false,
  ): number | null => {
    if (found) {
      if (found.hi > lim) return null;
      // Strictly past the last win, so a won wall never sits on its own line.
      return above ? Math.max(firepowerAt(found.hi), firepowerAt(found.lo) + 1) : firepowerAt(found.hi);
    }
    // No loss before the limit. Past the ceiling that is an answer; short of it, not one.
    return lim >= top ? firepowerAt(top) : null;
  };

  if (anchor !== undefined) {
    const anchored = (passes: (v: number) => boolean, lim: number) => {
      if (passes(anchor)) return edgeOf(walkUp(passes, anchor, start, lim), lim, true);
      const under = walkUp(passes, 0, start, anchor);
      return edgeOf(under && under.hi <= anchor ? under : { lo: 0, hi: anchor }, Infinity);
    };
    return { clears: anchored(decisive, limit.clears), breaks: anchored(standing, limit.breaks) };
  }

  if (!standing(0)) return { clears: 0, breaks: 0 };
  if (!decisive(0)) return { clears: 0, breaks: edgeOf(walkUp(standing, 0, start, limit.breaks), limit.breaks) };

  const clear = walkUp(decisive, 0, start, Math.max(limit.clears, limit.breaks));
  if (!clear) return { clears: edgeOf(null, limit.clears), breaks: edgeOf(null, limit.breaks) };
  const broken = standing(clear.hi) ? walkUp(standing, clear.hi, start, limit.breaks) : clear;
  return { clears: edgeOf(clear, limit.clears), breaks: edgeOf(broken, limit.breaks) };
}

interface Setting {
  shield: number;
  unarmed: number;
}

export function forecastLines(wing: Fleet, input: ForecastInput): Forecast {
  const tiers = tierShares(wing);
  const recipes = recipesFor(input.wall, tiers);
  // The walk's scale. A wing that cannot fire still has a size, and without it the
  // walk would never reach a wall of even one hull.
  const start = Math.max(1, combatValue(wing) || fleetValue(wing));

  /**
   * THE LEAST FAVOURABLE EDGE, OR THE MOST — never every edge in full. Hunting the
   * lowest, a wall's walk stops a grain past the lowest edge found so far: whatever
   * it would find beyond cannot lower it. The grain is what whole hulls can add to a
   * wall's firepower, which keeps the saving exact rather than close. The highest
   * needs no help — every walk already stops at its first loss.
   */
  const extreme = (setting: Setting, side: 'least' | 'most') => {
    const parked = input.wall.kind === 'EXACT' ? {} : transports(setting.unarmed, tiers);
    const keep = side === 'least' ? Math.min : Math.max;
    let clears: number | null = null;
    let breaks: number | null = null;
    for (const recipe of recipes) {
      const wallAt = (firepower: number) => merge(recipe.at(firepower), parked);
      const seen = new Map<number, Grade>();
      const gradeAt = (firepower: number): Grade => {
        let g = seen.get(firepower);
        if (g === undefined) {
          g = fight(wing, wallAt(firepower), setting.shield, input).grade;
          seen.set(firepower, g);
        }
        return g;
      };
      const limitPast = (edge: number | null) =>
        side === 'least' && edge !== null ? edge + recipe.grain : Infinity;
      const found = edgesOf(
        wallAt,
        gradeAt,
        start,
        { clears: limitPast(clears), breaks: limitPast(breaks) },
        recipe.anchor,
      );
      if (found.clears !== null) clears = clears === null ? found.clears : keep(clears, found.clears);
      if (found.breaks !== null) breaks = breaks === null ? found.breaks : keep(breaks, found.breaks);
    }
    return { clears: clears ?? 0, breaks: breaks ?? 0 };
  };

  // The hardest the reading allows, then the easiest.
  const hard = extreme({ shield: input.shield.high, unarmed: input.unarmed.high }, 'least');
  const easy = extreme({ shield: input.shield.low, unarmed: input.unarmed.low }, 'most');
  return {
    clears: { low: hard.clears, high: easy.clears },
    breaks: { low: hard.breaks, high: easy.breaks },
  };
}

/**
 * The share of this wing — by value, transports included — the fight is expected to
 * cost against a wall of this much firepower, least and most, over every wall the
 * reading allows.
 */
export function forecastLoss(wing: Fleet, firepower: ForecastSpan, input: ForecastInput): ForecastSpan {
  const total = fleetValue(wing);
  if (total <= 0) return { low: 0, high: 0 };
  const tiers = tierShares(wing);
  const recipes = recipesFor(input.wall, tiers);
  const worst: Setting = { shield: input.shield.high, unarmed: input.unarmed.high };
  const best: Setting = { shield: input.shield.low, unarmed: input.unarmed.low };
  const lossAt = (value: number, setting: Setting) => recipes.map((recipe) => {
    const parked = input.wall.kind === 'EXACT' ? {} : transports(setting.unarmed, tiers);
    const lost = fight(wing, merge(recipe.at(value), parked), setting.shield, input).attackerLossValue;
    return Math.min(1, lost / total);
  });
  return {
    low: Math.min(...lossAt(firepower.low, best)),
    high: Math.max(...lossAt(firepower.high, worst)),
  };
}

/** What the lines may assume from a probe's reading. Unread, empty or absent is unknown. */
export function wallKnowledgeOf(reading: ClassReading | undefined): WallKnowledge {
  switch (reading?.kind) {
    case 'EVEN':
      return { kind: 'EVEN' };
    case 'DOMINANT':
      return { kind: 'DOMINANT', cls: reading.cls };
    case 'SHARES':
      return { kind: 'SHARES', shares: reading.shares };
    default:
      return { kind: 'UNKNOWN' };
  }
}
