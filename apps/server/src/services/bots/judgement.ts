import {
  type ClassReading,
  type Fleet,
  type HullId,
  type LineReading,
  type PowerRange,
  type PowerSpan,
  type ReadingRange,
  type ResearchProjectId,
  type TechLevels,
  HULLS,
  combatOutcomeTable,
  combatValue,
  exactPowerRange,
  fleetCargo,
  fleetCount,
  missionFuel,
  readPowerRange,
} from '@astera/rules';
import { BOTS } from './personas.js';

/**
 * WHETHER A FLIGHT IS WORTH FLYING, DECIDED THE WAY A PERSON DECIDES IT.
 * Owner report, 2026-09-19: *"Hayvan gibi filosu olan oyuncuya saçma sapan 1-2 tane
 * gemi gönderip duruyorlar."*
 *
 * A person reads the launch sheet first, and this is that sheet. Combat v3 (owner
 * 2026-10-25): the sheet's ruler is the matchup power ratio the probe's ranges allow
 * (`readPowerRange`), and the owner's outcome table says what the stronger side loses
 * at a ratio. Nothing here knows more than the report does.
 *
 * THREE QUESTIONS, IN THE ORDER A PERSON ASKS THEM:
 *
 *   1. Is the wing the stronger side against the worst wall the reading allows, padded
 *      by `wallMargin` because a reading ages and a fleet comes home? A careful habit
 *      wants the wall CLEARED (`clearRatio`); a raider settles for BREAKING it.
 *   2. Does the table's loss at that ratio stay inside what this habit will pay?
 *   3. Does what the wing can carry home pay for the fuel, several times over?
 *
 * AND THE SMALLEST WING THAT PASSES, not the largest. A commander who sends the
 * whole line at an open world leaves home undefended for nothing, and one who
 * sends exactly enough is what an experienced player looks like.
 *
 * Pure: no clock, no database. The brain reads; this decides.
 */

export interface Nerve {
  /** What the least favourable wall must still suffer: cleared outright, or broken. */
  readonly need: 'CLEARS' | 'BREAKS';
  /** The largest share of the wing, by value, the worst case may cost. */
  readonly maxLoss: number;
  /** How many times over the expected haul must pay the round trip's fuel. */
  readonly lootOverFuel: number;
}

/** What one probe report says about a world, as the launch sheet reads it. */
export interface WallReading {
  /** Firepower standing at home, fuzzed by the probe's accuracy. */
  readonly defence: PowerSpan;
  /** What a DECISIVE raid could carry away, fuzzed the same way. */
  readonly stock: PowerSpan;
  /** Null on a report written before D199 — an unmeasured dome. */
  readonly shield: PowerSpan | null;
  readonly classReading: ClassReading | null;
  /** Combat research windows (`researchOf`); undefined is anything the ladders allow. */
  readonly research: Partial<Record<ResearchProjectId, ReadingRange>> | undefined;
  /** The most Aegis a raised dome could hold, used only when `shield` is unmeasured. */
  readonly domeCeiling: number;
  /**
   * Klan Savunma Desteği: the clanmates' ships standing there, as the probe read them
   * apart from the home fleet. They fight in the same line, so they join the wall.
   */
  readonly support?: LineReading | null;
}

/**
 * THE RESEARCH A RECORD CARRIES, as the launch sheet reads it: combat v3 windows as they
 * are, an older report's exact levels as one-level windows, a caretaker as none (it holds
 * no research), and a record that never read it as anything the ladders allow.
 */
export function researchOf(silhouette: {
  kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL';
  research?: Partial<Record<ResearchProjectId, ReadingRange>>;
  doctrines?: Partial<Record<ResearchProjectId, number>>;
}): Partial<Record<ResearchProjectId, ReadingRange>> | undefined {
  if (silhouette.research) return silhouette.research;
  if (silhouette.doctrines) {
    return Object.fromEntries(Object.entries(silhouette.doctrines).map(([id, level]) => [id, { low: level, high: level }]));
  }
  return silhouette.kind === 'NEUTRAL' ? {} : undefined;
}

/**
 * THE LEAST RATIO AT WHICH THE STRONGER SIDE LOSES NO MORE THAN `maxLoss`, read off the
 * owner's outcome table between its rows; Infinity for a loss the table never gets down to.
 */
export function ratioForLoss(maxLoss: number): number {
  const rows = combatOutcomeTable();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!, loss = row.strongLoses.high;
    if (loss > maxLoss) continue;
    if (i === 0) return row.ratio;
    const before = rows[i - 1]!, previous = before.strongLoses.high;
    return before.ratio + (row.ratio - before.ratio) * (previous - maxLoss) / (previous - loss);
  }
  return Infinity;
}

export interface RaidPlan {
  readonly wing: Fleet;
  /** The part of the haul the wing can carry, from the band's LOW edge. */
  readonly expectedLoot: number;
  readonly fuel: number;
}

interface Common {
  readonly fleet: Fleet;
  readonly tech: TechLevels;
  readonly nerve: Nerve;
  readonly distance: number;
  /** What is in the tank. A flight it cannot fuel is not a plan. */
  readonly deuterium: number;
}

/**
 * COMMIT PART OF THE LINE, KEEP A GARRISON, AND BRING A HOLD. The warships fly at
 * the given share; every cargo hull goes, because a raid whose haul cannot come
 * home was flown for nothing. A transport never flies alone.
 */
export function raidingWing(fleet: Fleet, share: number): Fleet {
  const send: Fleet = {};
  const holds: Fleet = {};
  for (const [hull, count] of Object.entries(fleet) as [HullId, number][]) {
    if (count <= 0 || HULLS[hull].ground || hull === 'PROSPECTOR') continue;
    if (HULLS[hull].profile === 'TRANSPORT') {
      holds[hull] = count;
      continue;
    }
    const n = Math.floor(count * share);
    if (n > 0) send[hull] = n;
  }
  return fleetCount(send) > 0 ? { ...send, ...holds } : {};
}

/**
 * A WALL NO SHAPE OF IT COULD LOSE TO, refused without reading it: a wall `hopelessRatio`
 * times the wing's own firepower leaves the wing the weaker side at every edge any
 * reading allows.
 */
export const hopeless = (wing: Fleet, wallHigh: number): boolean =>
  wallHigh > combatValue(wing) * BOTS.hopelessRatio;

/** How many readings one decision may weigh. Shared across every candidate a turn weighs. */
export interface ForecastBudget {
  left: number;
}

/**
 * The shared walk: each offered share, smallest first, until one passes all three
 * questions. `haul` is the most there is to take before the hold caps it.
 */
function smallestWing(
  common: Common,
  weigh: (wing: Fleet) => PowerRange | null,
  wallHigh: number,
  margin: number,
  haul: number,
  budget: ForecastBudget,
): RaidPlan | null {
  const need = Math.max(1, ratioForLoss(common.nerve.maxLoss), common.nerve.need === 'CLEARS' ? BOTS.clearRatio : 1);
  let previous = '';
  for (const share of BOTS.wingShares) {
    const wing = raidingWing(common.fleet, share);
    const key = JSON.stringify(wing);
    // Two shares that floor to the same wing are one question, asked once.
    if (fleetCount(wing) === 0 || key === previous) continue;
    previous = key;

    const fuel = missionFuel(wing, common.distance, 2);
    if (fuel > common.deuterium) continue;

    if (hopeless(wing, wallHigh)) continue;
    if (budget.left <= 0) return null;
    budget.left -= 1;
    const power = weigh(wing);
    if (!power) continue;
    // The worst ratio the reading allows, padded: the wall is assumed `margin` times stronger.
    const worst = power.ratio.low / margin;
    // A strict pass: a wing exactly even with the wall is not the stronger side.
    if (!(worst >= need && worst > 1)) continue;

    const carried = Math.min(haul, fleetCargo(wing, common.tech));
    // A wing that can only break the wall comes home with part of the haul at best.
    const expectedLoot = worst >= BOTS.clearRatio ? carried : carried * 0.5;
    if (expectedLoot < fuel * common.nerve.lootOverFuel) continue;
    if (expectedLoot <= 0 && common.nerve.lootOverFuel > 0) continue;

    return { wing, expectedLoot, fuel };
  }
  return null;
}

export function planWorldRaid(
  input: Common & { readonly reading: WallReading },
  budget: ForecastBudget = { left: BOTS.forecastsPerTurn },
): RaidPlan | null {
  const { reading } = input;
  const lines: LineReading[] = [{ value: reading.defence, shape: reading.classReading, research: reading.research }];
  if (reading.support && reading.support.value.high > 0) lines.push(reading.support);
  // An unmeasured dome is anything up to the most the world can hold — the same
  // assumption the launch sheet makes, never the kindest one.
  const aegis = reading.shield ?? { low: 0, high: reading.domeCeiling };
  const wallHigh = (reading.defence.high + (reading.support?.value.high ?? 0)) * BOTS.wallMargin;
  return smallestWing(input, (wing) => readPowerRange({ fleet: wing, tech: input.tech }, lines, aegis),
    wallHigh, BOTS.wallMargin, Math.max(0, reading.stock.low), budget);
}

/**
 * A pirate's crew is known exactly — its level is public and its roster follows
 * from it — so the wall is the crew itself and needs no margin. Its holds fly behind
 * the line and are taken once it falls (`pirateOverrun`).
 */
export function planPirateRaid(input: Common & {
  readonly crew: Fleet;
  readonly damageMult: number;
  readonly hoard: { alloy: number; crystal: number; deuterium: number };
}, budget: ForecastBudget = { left: BOTS.forecastsPerTurn }): RaidPlan | null {
  if (fleetCount(input.crew) === 0) return null;
  if (input.hoard.alloy + input.hoard.crystal + input.hoard.deuterium <= 0) return null;
  const haul = input.hoard.alloy + input.hoard.crystal + input.hoard.deuterium;
  return smallestWing(input,
    (wing) => exactPowerRange({ fleet: wing, tech: input.tech }, input.crew, { tech: {}, damageMult: input.damageMult }),
    combatValue(input.crew), 1, haul, budget);
}

/**
 * THE BULLY. Owner instruction, 2026-09-19: five raids or more on PEOPLE inside a
 * day. The count is the caller's — raids on the server's own commanders are never
 * in it, because those are the outlet this feature wants used.
 */
export const isBully = (raidsOnPeopleToday: number): boolean => raidsOnPeopleToday >= BOTS.bullyRaidsPerDay;
