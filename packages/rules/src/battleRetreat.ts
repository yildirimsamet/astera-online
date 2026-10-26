import { COMBAT } from './constants.js';
import { fleetDiff, fleetEntries } from './hulls.js';
import { matchupRatio, type Matchup } from './matchupPower.js';
import type { Fleet } from './types.js';
import type { CombatRound } from './combat.js';

export interface RetreatWindow { chance: number; threshold: number }

/**
 * ÜSTÜNLÜK TÖRPÜSÜ (combat v3): what the stronger side's fire is multiplied by at `ratio`.
 * R^−exponent, the exponent read between the table's ratios by linear interpolation; 1 past the last.
 */
export function handicapFactor(ratio: number): number {
  const { ratios, exponents } = COMBAT.handicap;
  if (!(ratio > 1) || ratio >= ratios.at(-1)!) return 1;
  const i = ratios.findIndex(anchor => anchor >= ratio);
  const t = (ratio - ratios[i - 1]!) / (ratios[i]! - ratios[i - 1]!);
  return ratio ** -(exponents[i - 1]! + (exponents[i]! - exponents[i - 1]!) * t);
}

/**
 * SAVAŞ TEMPOSU: the one damage scale both sides fire with, so the geometric-mean share of a
 * line lost per round is `COMBAT.tempo`. A fight one side cannot answer keeps raw damage.
 */
export function tempoScale(m: Matchup): number {
  const onDefender = m.attacker.dps / m.defender.ehp, onAttacker = m.defender.dps / m.attacker.ehp;
  const lethality = Math.sqrt(onDefender * onAttacker);
  return Number.isFinite(lethality) && lethality > 0 ? COMBAT.tempo / lethality : 1;
}

const tierOf = (weakerPower: number): number => COMBAT.retreatTiers.filter(edge => weakerPower >= edge).length;
const lerp = (a: RetreatWindow, b: RetreatWindow, t: number): RetreatWindow =>
  ({ threshold: a.threshold + (b.threshold - a.threshold) * t, chance: a.chance + (b.chance - a.chance) * t });

/**
 * SAVAŞ İÇİ KAÇIŞ (combat v3): the weak side's window at `ratio` inside the weaker side's tier,
 * read between anchors by linear interpolation; the stronger side's 1:1 chance fades to
 * nothing by `strongRetreatUntil`.
 */
export function retreatWindows(ratio: number, weakerPower: number): { weak: RetreatWindow; strong: RetreatWindow | null } {
  const table = COMBAT.retreatWindows[tierOf(weakerPower)]!, anchors = COMBAT.retreatRatios;
  const even = table[0]!;
  let weak: RetreatWindow = { ...table.at(-1)! };
  for (let i = 1; i < anchors.length; i++) {
    if (ratio <= anchors[i]!) {
      weak = lerp(table[i - 1]!, table[i]!, (Math.max(ratio, anchors[0]!) - anchors[i - 1]!) / (anchors[i]! - anchors[i - 1]!));
      break;
    }
  }
  const until = COMBAT.strongRetreatUntil;
  const strong = ratio < until
    ? { threshold: even.threshold, chance: even.chance * (until - Math.max(1, ratio)) / (until - 1) }
    : null;
  return { weak, strong };
}

export interface OutcomeRow {
  ratio: number;
  /** The weaker side's average share kept, across the power tiers. */
  weakKeeps: { low: number; high: number };
  /** The stronger side's average share lost; at 1:1 both sides are the weaker. */
  strongLoses: { low: number; high: number };
}

/** The owner's table as rows, for the attack sheet's rule and the Wiki. */
export function combatOutcomeTable(): OutcomeRow[] {
  const { evenKept, ratios, weakKept, strongLost } = COMBAT.outcomeTargets;
  const least = Math.min(...evenKept), most = Math.max(...evenKept);
  return [
    { ratio: 1, weakKeeps: { low: least, high: most }, strongLoses: { low: 1 - most, high: 1 - least } },
    ...ratios.map((ratio, i) => ({
      ratio,
      weakKeeps: { low: Math.max(weakKept[i]!, least), high: Math.max(weakKept[i]!, most) },
      strongLoses: { low: strongLost[i]!, high: strongLost[i]! },
    })),
  ];
}

/** Everything a battle fixes at entry from the two sides' matchup powers. */
export interface BattleBalance {
  attackerPower: number;
  defenderPower: number;
  /** Stronger over weaker, ≥ 1. */
  ratio: number;
  stronger: 'ATTACK' | 'DEFENCE' | null;
  tempo: number;
  /** The stronger side's fire multiplier; 1 for an even fight. */
  handicap: number;
  attacker: RetreatWindow | null;
  defender: RetreatWindow | null;
}

export function battleBalance(m: Matchup): BattleBalance {
  const attackerPower = m.attacker.power, defenderPower = m.defender.power;
  const ratio = matchupRatio(m);
  const stronger = attackerPower > defenderPower ? 'ATTACK' : defenderPower > attackerPower ? 'DEFENCE' : null;
  const { weak, strong } = retreatWindows(ratio, Math.min(attackerPower, defenderPower));
  // A side without a gun is not in the fight the windows are fitted to: unescorted holds are taken (owner 2026-10-06).
  const windowOf = (power: number, own: RetreatWindow | null) => power > 0 ? own : null;
  return { attackerPower, defenderPower, ratio, stronger, tempo: tempoScale(m),
    handicap: stronger === null ? 1 : handicapFactor(ratio),
    attacker: windowOf(attackerPower, stronger === 'ATTACK' ? strong : weak),
    defender: windowOf(defenderPower, stronger === 'DEFENCE' ? strong : weak) };
}

/** Physical survival is for ownership/accounting; only the active remainder can fight or loot. */
export const activeBattleFleet = (survivors: Fleet, retreated?: Fleet): Fleet => fleetDiff(survivors, retreated ?? {});

/** Sum immutable ownership telemetry without exposing the raw owner rows. */
function battleOwnedFleet(rounds: readonly CombatRound[], field: 'retreats' | 'casualties', side: 'ATTACK' | 'DEFENCE', playerId?: string): Fleet {
  const result: Fleet = {};
  for (const round of rounds) for (const row of round[field] ?? []) {
    if (row.side !== side || (playerId !== undefined && row.playerId !== playerId)) continue;
    for (const [hull, count] of fleetEntries(row.fleet)) result[hull] = (result[hull] ?? 0) + count;
  }
  return result;
}

export const battleRetreated = (rounds: readonly CombatRound[], side: 'ATTACK' | 'DEFENCE', playerId?: string): Fleet =>
  battleOwnedFleet(rounds, 'retreats', side, playerId);
export const battleCasualties = (rounds: readonly CombatRound[], side: 'ATTACK' | 'DEFENCE', playerId: string): Fleet =>
  battleOwnedFleet(rounds, 'casualties', side, playerId);
