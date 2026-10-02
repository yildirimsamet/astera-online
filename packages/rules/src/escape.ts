import {
  resolveBattle,
  type BattleResult,
  type CombatSide,
  type DefenderStack,
  type JointAttackerStack,
} from './combat.js';
import type { DefencePosture } from './clanSupport.js';
import { ESCAPE, MULTI_WORLD } from './constants.js';
import { missionFuel } from './fuel.js';
import { HULLS, combatValue, fleetCount, fleetEntries } from './hulls.js';
import type { Fleet, Rng } from './types.js';

/**
 * TAKTİK GERİ ÇEKİLME — THE FLEET ESCAPE. Owner decision, 2026-09-23.
 *
 * When a raid lands, the SHIPS in the defending line lift off instead of fighting if
 * all five hold in ruleset 13 onward:
 *
 *   1. there are ships in the line at all (guns never run);
 *   2. at least `ESCAPE.minimumCombatShips` armed ships stand in the line;
 *   3. the wing fires at least `ESCAPE.ratio` times what the line fires (`combatValue`
 *      on both sides — the axis a probe's defence band and the launch sheet share);
 *   4. the line, standing, would have been wiped out — the full fight grades DECISIVE;
 *   5. the world's tank pays `escapeFuel` for the lift, all of it or none (T6).
 *
 * The ships stay exactly where they were: nothing moves on the disc. The guns and the
 * Aegis fight the wing alone, re-resolved from the same seed, and every downstream
 * rule — loot, Dominion, the recovery shield — reads that battle.
 *
 * WHY THE DECISIVE GUARD. The ratio alone ran two ways the defender loses by: a wall
 * of transports that fires 9k and holds off a 27k raid every time would run from it
 * and hand over the stores, and a fleet under a charged Aegis would leave the dome to
 * a walkover (D173). A fleet only ever runs from a fight it had already lost, so the
 * escape can save ships and never cost anything — `test/escape.test.ts` holds that as
 * a property.
 *
 * WHY NOT A PROPERTY OF THE COMMANDER. Measured on the whole navy it would stop a
 * careful raider sending a slice under the line; the owner kept it per battle: fights
 * at 1–3× between equals are the game, and a raider sending just under the line meets
 * the bash limit and the recovery shield.
 */

/** Whether a season was dealt this rule. Never inside a running one. */
export const fleetEscapeApplies = (rulesetVersion: number): boolean =>
  rulesetVersion >= MULTI_WORLD.fleetEscapeRulesetVersion;

/** A new season keeps token garrisons in combat; old seasons retain their rule. */
export const fleetEscapeMinimumApplies = (rulesetVersion: number): boolean =>
  rulesetVersion >= MULTI_WORLD.fleetEscapeMinimumRulesetVersion;

/** Count only armed ships in the defending line: transports and guns do not qualify. */
export const escapeCombatShipCount = (line: Fleet): number =>
  fleetEntries(line).reduce((sum, [id, count]) =>
    sum + (!HULLS[id].ground && HULLS[id].cls !== 'SUPPORT' ? count : 0), 0);

/** The ships in a defending line: everything that is not a ground gun, armed or not. */
export function escapingShips(line: Fleet): Fleet {
  const ships: Fleet = {};
  for (const [id, count] of fleetEntries(line)) {
    if (!HULLS[id].ground) ships[id] = count;
  }
  return ships;
}

/** The lift is a launch: `missionFuel` for a round trip of `ESCAPE.fuelDistance`. */
export const escapeFuel = (ships: Fleet): number => missionFuel(ships, ESCAPE.fuelDistance, 2);

/** The strength half of the rule, inclusive: three times is enough. */
export const outmatches = (attackerPower: number, linePower: number): boolean =>
  attackerPower >= ESCAPE.ratio * linePower;

/**
 * THE FIREPOWER A LINE MAY HOLD AND STILL RUN FROM THIS WING — a third of the wing's.
 *
 * On the same axis as the defence band, so the launch sheet can draw it beside the
 * clear and break lines. It is the strength half only: a line under it still stands if
 * the wing could not clear it, and still stays if the tank is dry.
 */
export const escapeLine = (wing: Fleet): number => combatValue(wing) / ESCAPE.ratio;

export type EscapeVerdict = 'RUN' | 'STAND' | 'UNSURE';

/**
 * WHAT A COMMANDER CAN EXPECT BEFORE THE PRESS — the rule applied to the reading they
 * bought, never to the truth (CLAUDE.md: form an expectation and be able to be wrong).
 *
 * `wall` is the probe's defence band — `combatValue` of everything standing at home,
 * the axis the rule itself measures — and `clears` is `forecastLines(...).clears`: the
 * firepower below which this wing wipes the line. The ships run only from a line that
 * is both outmatched and cleared, so:
 *
 *   · STAND  — even the weakest wall the band allows is over the line, or the wing
 *              clears no wall the band allows;
 *   · RUN    — every wall the band allows is at or under the line and is cleared;
 *   · UNSURE — anything between.
 *
 * RUN is still conditional: the tank is never known to a raider. In ruleset 13
 * the probe also cannot establish the five-ship floor from a power band, so a
 * power-only RUN becomes UNSURE.
 *
 * `posture` is the world's defence posture as the probe read it (Klan Savunma Desteği,
 * ruleset 15). A SUPPORT or HOLD world has switched the retreat off, so its line
 * always STANDs; absent means a season without postures, where the rule decides.
 */
export function escapeVerdict(
  wingPower: number,
  wall: { low: number; high: number },
  clears: { low: number; high: number },
  minimumShipRule = false,
  posture?: DefencePosture,
): EscapeVerdict {
  if (posture !== undefined && posture !== 'ESCAPE') return 'STAND';
  const at = wingPower / ESCAPE.ratio;
  if (wall.low > at || wall.low >= clears.high) return 'STAND';
  if (wall.high <= at && wall.high < clears.low) return minimumShipRule ? 'UNSURE' : 'RUN';
  return 'UNSURE';
}

export type EscapeOutcome =
  /** The ships lifted off; `fuel` came out of the tank before the loot. */
  | { kind: 'ESCAPED'; ships: Fleet; fuel: number }
  /** They would have run, and the tank could not pay — the fight stood. */
  | { kind: 'STRANDED'; ships: Fleet; fuel: number; available: number };

export interface RaidResolution {
  /** The battle, with `defenders[0]` the host and any further stack a stationed wave. */
  result: BattleResult;
  /** Null when the rule never came into it: off, nothing to lift, or not outmatched and wiped. */
  escape: EscapeOutcome | null;
}

export interface RaidInput {
  stacks: readonly JointAttackerStack[];
  /** The defending line as `garrisonOf` builds it — ships plus whichever guns are online. */
  line: Fleet;
  shield: number;
  /**
   * A FRESH stream per call, from the battle's seed. The rule may resolve twice — once
   * standing, once without the ships — and both must be re-derivable from the report.
   */
  rng: () => Rng;
  defender: CombatSide;
  /** The attacked world's tank at the instant of the fight. */
  deuterium: number;
  /** `fleetEscapeApplies(season.rulesetVersion)`. */
  escape: boolean;
  /** Five in ruleset 13 onward, zero for seasons dealt the earlier escape rule. */
  minimumCombatShips: number;
  /**
   * CLANMATES' STATIONED WAVES IN THIS LINE (Klan Savunma Desteği). A supported world's
   * posture is SUPPORT, which never lifts — so `escape` must be false when any wave is
   * here, and asking otherwise is a caller bug, refused rather than guessed at.
   */
  support?: readonly DefenderStack[];
  /** Who the host is, for the outcome rows. Empty where nobody asks. */
  hostPlayerId?: string;
}

/** Whole drops only, and a tank the row cannot vouch for is empty. */
const tankOf = (deuterium: number): number =>
  Number.isFinite(deuterium) ? Math.floor(Math.max(0, deuterium)) : 0;

export function resolveRaid(input: RaidInput): RaidResolution {
  const host = (line: Fleet): DefenderStack =>
    ({ stackId: 'host', playerId: input.hostPlayerId ?? '', fleet: line, tech: input.defender });
  const support = input.support ?? [];
  if (support.length > 0) {
    if (input.escape) throw new RangeError('a line holding clan support never lifts');
    return {
      result: resolveBattle(input.stacks, [host(input.line), ...support], input.shield, input.rng()),
      escape: null,
    };
  }
  const standing = resolveBattle(input.stacks, [host(input.line)], input.shield, input.rng());
  if (!input.escape) return { result: standing, escape: null };

  const ships = escapingShips(input.line);
  if (fleetCount(ships) === 0) return { result: standing, escape: null };
  if (escapeCombatShipCount(input.line) < input.minimumCombatShips) {
    return { result: standing, escape: null };
  }

  const power = input.stacks.reduce((sum, stack) => sum + combatValue(stack.fleet), 0);
  if (!outmatches(power, combatValue(input.line)) || standing.grade !== 'DECISIVE') {
    return { result: standing, escape: null };
  }

  const fuel = escapeFuel(ships);
  const available = tankOf(input.deuterium);
  if (available < fuel) {
    return { result: standing, escape: { kind: 'STRANDED', ships, fuel, available } };
  }

  const guns: Fleet = {};
  for (const [id, count] of fleetEntries(input.line)) {
    if (HULLS[id].ground) guns[id] = count;
  }
  const result = resolveBattle(input.stacks, [host(guns)], input.shield, input.rng());
  return { result, escape: { kind: 'ESCAPED', ships, fuel } };
}
