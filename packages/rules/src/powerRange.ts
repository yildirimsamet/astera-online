import type { CombatSide } from './combat.js';
import { ALL_HULLS, COMBAT_CLASSES, HULLS, combatValue } from './hulls.js';
import type { ClassReading, ReadingRange } from './intel.js';
import { matchup, powerUnits, type Matchup, type PowerUnit } from './matchupPower.js';
import type { HpDamageLots } from './radiationHp.js';
import { RESEARCH_MAX_LEVEL } from './research.js';
import { COMBAT_RESEARCH_PROJECTS, type TechLevels } from './tech.js';
import type { CombatClass, Fleet, HullId, ResearchProjectId } from './types.js';

/**
 * GÖRECELİ GÜÇ ARALIĞI — combat v3, owner 2026-10-25 (docs/combat-v3-plan-2026-10-25.md §4).
 *
 * The attack sheet's ruler: this wing's matchup power against a wall a probe read as ranges,
 * from the worst wall the reading allows to the best. The probe never reads exactly (80% at
 * most), so the sheet shows a range and never one guessed figure.
 *
 * HOW: every corner of the reading. The class shares are walked at each corner of their
 * ranges (shares add up to 100, so a corner pins two classes and the third takes the rest);
 * the firing value, the research and the Aegis are monotone, so the worst wall takes the top
 * of each and the best the bottom. Each class is built from its weakest hull per resource for
 * the best wall and its strongest for the worst, measured under that corner's research: the
 * probe reads a class's value, never which hulls carry it.
 *
 * Measured over random walls of any firing hulls, research, Aegis and probe accuracy, the
 * ratio and their power always held the truth; the wing's own figure moves up to 3% with
 * their hull choice, which shifts where its counters land (test/power-range.test.ts).
 */

export interface PowerSpan { low: number; high: number }

/** One line of the wall as the probe read it: the host, or a clan's support beside it. */
export interface LineReading {
  /** `combatValue` of what fires. */
  value: PowerSpan;
  /** The probe's class reading. Absent or unread: any split. */
  shape?: ClassReading | null;
  /** Combat research windows; a project left out stands at zero. Absent: anything the ladders allow. */
  research?: Partial<Record<ResearchProjectId, ReadingRange>>;
}

export interface PowerWing {
  fleet: Fleet;
  tech: TechLevels;
  damage?: HpDamageLots;
  /** Grounded hulls stand in the line and fire nothing. */
  maintenance?: boolean;
}

export interface PowerRange {
  /** This wing's power against the wall. */
  mine: PowerSpan;
  /** The wall's power against this wing. */
  theirs: PowerSpan;
  /** Mine over theirs; `low` is the worse case for the wing. Infinity against a wall with no power. */
  ratio: PowerSpan;
}

const FIRING = ALL_HULLS.filter((id) => HULLS[id].atk > 0 && HULLS[id].cls !== 'SUPPORT');
const unitOf = (id: HullId, tech: TechLevels): PowerUnit => powerUnits({ [id]: 1 }, { tech })[0]!;
const perValue = (id: HullId, tech: TechLevels): number => {
  const u = unitOf(id, tech);
  return Math.sqrt(u.attack * u.ehp) / combatValue({ [id]: 1 });
};

/** The weakest or strongest hull per resource of a class, under this research. */
function hullFor(cls: CombatClass, tech: TechLevels, strongest: boolean): HullId {
  let best: HullId | null = null, score = strongest ? -Infinity : Infinity;
  for (const id of FIRING) {
    if (HULLS[id].cls !== cls) continue;
    const v = perValue(id, tech);
    if (strongest ? v > score : v < score) [best, score] = [id, v];
  }
  return best!;
}

type Shares = Record<CombatClass, ReadingRange>;
const all = (low: number, high: number): Shares =>
  ({ SKIRMISHER: { low, high }, BULWARK: { low, high }, LANCE: { low, high } });

/** Each class's share as a range in whole percents; old reports' steps read as what they promised. */
function sharesOf(shape: ClassReading | null | undefined): Shares {
  switch (shape?.kind) {
    case 'RANGES':
      return shape.shares;
    case 'SHARES': {
      // Rounded to tens by largest remainder: within one step of the truth.
      const out = all(0, 0);
      for (const cls of COMBAT_CLASSES) out[cls] = { low: Math.max(0, shape.shares[cls] - 10), high: Math.min(100, shape.shares[cls] + 10) };
      return out;
    }
    case 'DOMINANT':
      return { ...all(0, 50), [shape.cls]: { low: 50, high: 100 } };
    case 'EVEN':
      return all(0, 50);
    default:
      return all(0, 100);
  }
}

/** The corners of the share ranges where they add up to 100. */
function corners(shares: Shares): Record<CombatClass, number>[] {
  const out: Record<CombatClass, number>[] = [];
  for (const free of COMBAT_CLASSES) {
    const [a, b] = COMBAT_CLASSES.filter((cls) => cls !== free) as [CombatClass, CombatClass];
    for (const sa of [shares[a].low, shares[a].high]) for (const sb of [shares[b].low, shares[b].high]) {
      const rest = 100 - sa - sb;
      if (rest >= shares[free].low && rest <= shares[free].high) out.push({ [a]: sa, [b]: sb, [free]: rest } as Record<CombatClass, number>);
    }
  }
  return out;
}

function researchAt(research: LineReading['research'], top: boolean): TechLevels {
  const tech: TechLevels = {};
  for (const id of COMBAT_RESEARCH_PROJECTS) {
    tech[id] = research === undefined ? (top ? RESEARCH_MAX_LEVEL[id] : 0) : (top ? research[id]?.high : research[id]?.low) ?? 0;
  }
  return tech;
}

/** A line at the best or the worst corner: one hull per class, as one unit per resource of value. */
function lineAt(line: LineReading, worst: boolean): { value: number; perResource: Record<CombatClass, PowerUnit> } {
  const tech = researchAt(line.research, worst);
  const perResource = {} as Record<CombatClass, PowerUnit>;
  for (const cls of COMBAT_CLASSES) {
    const id = hullFor(cls, tech, worst);
    perResource[cls] = { ...unitOf(id, tech), count: 1 / combatValue({ [id]: 1 }) };
  }
  return { value: worst ? line.value.high : line.value.low, perResource };
}

const spanOf = (values: readonly number[]): PowerSpan => ({ low: Math.min(...values), high: Math.max(...values) });
const ratioOf = (m: Matchup): number =>
  m.defender.power > 0 ? m.attacker.power / m.defender.power : m.attacker.power > 0 ? Infinity : 0;

function rangeOf(fights: readonly Matchup[]): PowerRange {
  return {
    mine: spanOf(fights.map((m) => m.attacker.power)),
    theirs: spanOf(fights.map((m) => m.defender.power)),
    ratio: spanOf(fights.map(ratioOf)),
  };
}

/** The wing against every corner the reading allows; null for a wing with no ships. */
export function readPowerRange(wing: PowerWing, lines: readonly LineReading[], aegis: PowerSpan): PowerRange | null {
  const mine = powerUnits(wing.fleet, { tech: wing.tech }, wing.damage, wing.maintenance);
  if (!mine.some((unit) => unit.count > 0)) return null;
  // Every line at each of its share corners, combined across lines.
  let walls: Record<CombatClass, number>[][] = [[]];
  for (const line of lines) {
    const options = line.value.high > 0 ? corners(sharesOf(line.shape)) : [];
    if (options.length > 0) walls = walls.flatMap((wall) => options.map((shares) => [...wall, shares]));
    else walls = walls.map((wall) => [...wall, { SKIRMISHER: 0, BULWARK: 0, LANCE: 0 }]);
  }
  const fights: Matchup[] = [];
  for (const worst of [false, true]) {
    const built = lines.map((line) => lineAt(line, worst));
    for (const wall of walls) {
      const units = built.flatMap(({ value, perResource }, i) => COMBAT_CLASSES.filter((cls) => wall[i]![cls] > 0)
        .map((cls) => ({ ...perResource[cls], count: (perResource[cls].count * value * wall[i]![cls]) / 100 })));
      fights.push(matchup({ units: mine }, { units, aegis: worst ? aegis.high : aegis.low }));
    }
  }
  return rangeOf(fights);
}

/** A crew under Telescope sight: the very hulls, so the range is one number. */
export function exactPowerRange(wing: PowerWing, crew: Fleet, side: CombatSide, aegis = 0): PowerRange {
  return rangeOf([matchup(
    { units: powerUnits(wing.fleet, { tech: wing.tech }, wing.damage, wing.maintenance) },
    { units: powerUnits(crew, side), aegis },
  )]);
}
