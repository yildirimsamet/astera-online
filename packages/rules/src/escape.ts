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
import { HULLS, fleetCount, fleetEntries } from './hulls.js';
import { matchup, powerUnits } from './matchupPower.js';
import type { Fleet, Rng } from './types.js';
import type { HpDamageLots } from './radiationHp.js';
import { partitionCombatFleet } from './shipMaintenance.js';
import { createBattleRecording, type BattleRecording } from './battleRecording.js';

/**
 * TAKTİK GERİ ÇEKİLME — THE FLEET ESCAPE. Owner decision, 2026-09-23.
 *
 * When a raid lands, the SHIPS in the defending line lift off instead of fighting if
 * all five hold in ruleset 13 onward:
 *
 *   1. there are ships in the line at all (guns never run);
 *   2. at least `ESCAPE.minimumCombatShips` armed ships stand in the line;
 *   3. the wing has at least `ESCAPE.ratio` times the line's matchup power — the ratio the
 *      battle is fought with (combat v3): counters, research, wounds, guns and Aegis in, cargo out;
 *   4. the line, standing, would have been wiped out — the full fight grades DECISIVE;
 *   5. the world's tank pays `escapeFuel` for the lift, all of it or none (T6).
 *
 * The ships stay exactly where they were: nothing moves on the disc. The guns and the
 * Aegis fight the wing alone, re-resolved from the same seed, and every downstream
 * rule — loot, Dominion, the recovery shield — reads that battle.
 *
 * WHY THE DECISIVE GUARD. Under the original 3× ratio, a transport wall worth 9k
 * could hold off a 27k raid yet run from it on the ratio alone and hand over the
 * stores; a fleet under a charged Aegis could also leave the dome to a walkover
 * (D173). The guard requires the standing line to be wiped out. It does not require
 * attacker survivors or guarantee a better economic outcome: mutual destruction
 * also qualifies (`docs/fleet-escape-review-2026-10-09.md`).
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

/** The strength half of the rule, inclusive at `ESCAPE.ratio`; float noise in the powers never decides it. */
export const outmatches = (attackerPower: number, linePower: number): boolean =>
  attackerPower >= ESCAPE.ratio * linePower * (1 - 1e-9);

export type EscapeVerdict = 'RUN' | 'STAND' | 'UNSURE';

/**
 * WHAT A COMMANDER CAN EXPECT BEFORE THE PRESS — the rule applied to the reading they
 * bought, never to the truth (CLAUDE.md: form an expectation and be able to be wrong).
 *
 * `ratio` is this wing's matchup power over the line's across the probe's reading, from
 * the least favourable to the most:
 *
 *   · STAND  — even the most favourable ratio is under the line;
 *   · RUN    — every ratio the reading allows is at or over it;
 *   · UNSURE — anything between.
 *
 * RUN is still conditional: the tank is never known to a raider, and a line the wing
 * could not have wiped standing never runs. `minimumShipRule` is set when the reading
 * cannot establish the five-ship floor, and turns RUN into UNSURE.
 *
 * `posture` is the world's defence posture as the probe read it (Klan Savunma Desteği,
 * ruleset 15). A SUPPORT or HOLD world has switched the retreat off, so its line
 * always STANDs; absent means a season without postures, where the rule decides.
 */
export function escapeVerdict(
  ratio: { low: number; high: number },
  minimumShipRule = false,
  posture?: DefencePosture,
): EscapeVerdict {
  if (posture !== undefined && posture !== 'ESCAPE') return 'STAND';
  if (!outmatches(ratio.high, 1)) return 'STAND';
  if (outmatches(ratio.low, 1)) return minimumShipRule ? 'UNSURE' : 'RUN';
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
  recording?: BattleRecording;
  homeDamage?: HpDamageLots;
  maintenance?: boolean;
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
  /** New HP seasons preserve radiation fractions through both standing and escaped resolutions. */
  preciseDamage?: boolean;
}

/** Whole drops only, and a tank the row cannot vouch for is empty. */
const tankOf = (deuterium: number): number =>
  Number.isFinite(deuterium) ? Math.floor(Math.max(0, deuterium)) : 0;

export function resolveRaid(input: RaidInput): RaidResolution {
  if (input.recording && (input.recording.ships.length > 0 || input.recording.rounds.length > 0)) throw new RangeError('use a fresh battle recording');
  const context = input.preciseDamage ? 'HP_PLANET' : 'PLANET';
  const partition = input.maintenance ? partitionCombatFleet(input.line, input.homeDamage) : null;
  const line = partition?.eligible ?? input.line;
  const host = (fleet: Fleet): DefenderStack =>
    ({ stackId: 'host', playerId: input.hostPlayerId ?? '', fleet, tech: input.defender,
      ...(partition ? { damage: partition.damage.filter((lot) => (fleet[lot.hull] ?? 0) > 0) } : {}) });
  const support = input.support ?? [];
  if (support.length > 0) {
    if (input.escape) throw new RangeError('a line holding clan support never lifts');
    return {
      result: resolveBattle(input.stacks, [host(line), ...support], input.shield, input.rng(), context, input.maintenance, input.recording),
      escape: null,
    };
  }
  const trial = input.recording && input.escape ? createBattleRecording({ hitLimit: input.recording.hitLimit }) : input.recording;
  const standing = resolveBattle(input.stacks, [host(line)], input.shield, input.rng(), context, input.maintenance, trial);
  const keepStanding = (escape: EscapeOutcome | null): RaidResolution => {
    if (input.recording && trial && input.recording !== trial) Object.assign(input.recording, trial);
    return { result: standing, escape };
  };
  if (!input.escape) return keepStanding(null);

  const ships = escapingShips(line);
  if (fleetCount(ships) === 0) return keepStanding(null);
  if (escapeCombatShipCount(line) < input.minimumCombatShips) {
    return keepStanding(null);
  }

  const m = matchup({ units: input.stacks.flatMap(stack => powerUnits(stack.fleet, stack.tech, stack.damage, input.maintenance)) },
    { units: powerUnits(line, input.defender, partition?.damage, input.maintenance), aegis: input.shield });
  if (!outmatches(m.attacker.power, m.defender.power) || standing.grade !== 'DECISIVE') {
    return keepStanding(null);
  }

  const fuel = escapeFuel(ships);
  const available = tankOf(input.deuterium);
  if (available < fuel) {
    return keepStanding({ kind: 'STRANDED', ships, fuel, available });
  }

  const guns: Fleet = {};
  for (const [id, count] of fleetEntries(line)) {
    if (HULLS[id].ground) guns[id] = count;
  }
  const result = resolveBattle(input.stacks, [host(guns)], input.shield, input.rng(), context, input.maintenance, input.recording);
  return { result, escape: { kind: 'ESCAPED', ships, fuel } };
}
