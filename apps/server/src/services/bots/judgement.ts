import {
  type ClassReading,
  type Fleet,
  type ForecastInput,
  type ForecastSpan,
  type HullId,
  type TechLevels,
  HULLS,
  combatValue,
  fleetCargo,
  fleetCount,
  forecastLines,
  forecastLoss,
  missionFuel,
  wallKnowledgeOf,
} from '@astera/rules';
import { BOTS } from './personas.js';

/**
 * WHETHER A FLIGHT IS WORTH FLYING, DECIDED THE WAY A PERSON DECIDES IT.
 * Owner report, 2026-09-19: *"Hayvan gibi filosu olan oyuncuya saçma sapan 1-2 tane
 * gemi gönderip duruyorlar."*
 *
 * The brain used to check only that a record EXISTED and then fly most of whatever
 * stood on the pad — so two Darts went at a war fleet, every evening, because the
 * probe that said so was never read. A person reads the launch sheet first, and this
 * is that sheet: the same `forecastLines` / `forecastLoss` the phone draws, run by
 * the same `resolveCombat` the server grades with, against the same bands the probe
 * brought home. Nothing here knows more than the report does.
 *
 * THREE QUESTIONS, IN THE ORDER A PERSON ASKS THEM:
 *
 *   1. Does the least favourable wall the reading allows still fall? The habit's
 *      nerve says what "fall" means — a careful commander wants it CLEARED, a raider
 *      settles for BROKEN. The wall is the band's top, widened by `wallMargin`
 *      because a reading ages and a fleet comes home.
 *   2. Is the worst loss the lines allow one this habit will pay?
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
  readonly defence: ForecastSpan;
  /** What a DECISIVE raid could carry away, fuzzed the same way. */
  readonly stock: ForecastSpan;
  /** Null on a report written before D199 — an unmeasured dome. */
  readonly shield: ForecastSpan | null;
  readonly unarmed: ForecastSpan | null;
  readonly classReading: ClassReading | null;
  readonly doctrines: TechLevels;
  /** The most Aegis a raised dome could hold, used only when `shield` is unmeasured. */
  readonly domeCeiling: number;
  /**
   * Klan Savunma Desteği: the clanmates' ships standing there, as the probe read them
   * apart from the home fleet. They fight in the same line, so they join the wall.
   */
  readonly support?: ForecastSpan | null;
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
 * A WALL NO SHAPE OF IT COULD LOSE TO, refused without asking the engine. A forecast
 * is a few dozen fights on the worker that lands every raid on time; a wall
 * `hopelessRatio` times the wing's own firepower is past even the most favourable
 * edge any reading allows.
 */
export const hopeless = (wing: Fleet, wallHigh: number): boolean =>
  wallHigh > combatValue(wing) * BOTS.hopelessRatio;

/** How many forecasts one decision may run. Shared across every candidate a turn weighs. */
export interface ForecastBudget {
  left: number;
}

/**
 * The shared walk: each offered share, smallest first, until one passes all three
 * questions. `haul` is the most there is to take before the hold caps it.
 */
function smallestWing(
  common: Common,
  input: ForecastInput,
  wall: ForecastSpan,
  haul: number,
  budget: ForecastBudget,
): RaidPlan | null {
  let previous = '';
  for (const share of BOTS.wingShares) {
    const wing = raidingWing(common.fleet, share);
    const key = JSON.stringify(wing);
    // Two shares that floor to the same wing are one question, asked once.
    if (fleetCount(wing) === 0 || key === previous) continue;
    previous = key;

    const fuel = missionFuel(wing, common.distance, 2);
    if (fuel > common.deuterium) continue;

    if (hopeless(wing, wall.high)) continue;
    if (budget.left <= 0) return null;
    budget.left -= 1;
    const lines = forecastLines(wing, input);
    const edge = common.nerve.need === 'CLEARS' ? lines.clears.low : lines.breaks.low;
    // `clears`/`breaks` are the firepower at which the wing STOPS winning: below wins.
    if (!(wall.high < edge)) continue;

    const loss = forecastLoss(wing, wall, input);
    if (loss.high > common.nerve.maxLoss) continue;

    const carried = Math.min(haul, fleetCargo(wing, common.tech));
    // A wing that can only break the wall comes home with part of the haul at best.
    const expectedLoot = lines.clears.low > wall.high ? carried : carried * 0.5;
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
  const none = { low: 0, high: 0 };
  const forecast: ForecastInput = {
    attackerTech: input.tech,
    defenderTech: reading.doctrines,
    // An unmeasured dome is anything up to the most the world can hold — the same
    // assumption the launch sheet makes, never the kindest one.
    shield: reading.shield ?? { low: 0, high: reading.domeCeiling },
    unarmed: reading.unarmed ?? none,
    wall: wallKnowledgeOf(reading.classReading ?? undefined),
  };
  const wall = {
    low: reading.defence.low + (reading.support?.low ?? 0),
    high: (reading.defence.high + (reading.support?.high ?? 0)) * BOTS.wallMargin,
  };
  return smallestWing(input, forecast, wall, Math.max(0, reading.stock.low), budget);
}

/**
 * A pirate's crew is known exactly — its level is public and its roster follows
 * from it — so the wall is the crew itself and needs no margin.
 */
export function planPirateRaid(input: Common & {
  readonly crew: Fleet;
  readonly damageMult: number;
  readonly hoard: { alloy: number; crystal: number; deuterium: number };
}, budget: ForecastBudget = { left: BOTS.forecastsPerTurn }): RaidPlan | null {
  if (fleetCount(input.crew) === 0) return null;
  const forecast: ForecastInput = {
    attackerTech: input.tech,
    defenderTech: {},
    defenderDamageMult: input.damageMult,
    shield: { low: 0, high: 0 },
    unarmed: { low: 0, high: 0 },
    wall: { kind: 'EXACT', fleet: input.crew },
  };
  // The launch sheet's own axis for a crew: what of it can fire.
  const firepower = combatValue(input.crew);
  const haul = input.hoard.alloy + input.hoard.crystal + input.hoard.deuterium;
  return smallestWing(input, forecast, { low: firepower, high: firepower }, haul, budget);
}

/**
 * THE BULLY. Owner instruction, 2026-09-19: five raids or more on PEOPLE inside a
 * day. The count is the caller's — raids on the server's own commanders are never
 * in it, because those are the outlet this feature wants used.
 */
export const isBully = (raidsOnPeopleToday: number): boolean => raidsOnPeopleToday >= BOTS.bullyRaidsPerDay;
