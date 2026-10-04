import {
  resolveBattle,
  type BattleResult,
  type DefenderStack,
  type JointAttackerStack,
} from './combat.js';
import { HULLS, MOBILE_HULLS, combatValue, fleetCount, fleetEntries, fleetValue } from './hulls.js';
import { allocateJointDominion, type JointDominionShare } from './clanWar.js';
import { applyHpDose, type HpDamageLots } from './radiationHp.js';
import type { Fleet, Rng } from './types.js';

const MOBILE: ReadonlySet<string> = new Set(MOBILE_HULLS);
const byId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function assertMonumentFleet(fleet: Fleet, damage?: HpDamageLots): void {
  applyHpDose(fleet, damage, 0);
  for (const [hull] of fleetEntries(fleet)) {
    if (!MOBILE.has(hull)) throw new RangeError('a monument battle only holds mobile fleet hulls');
  }
}

export type MonumentBattleControl = 'ATTACKER' | 'DEFENDER' | 'EMPTY';

/** Cargo can preserve existing control, but cannot capture an empty monument. */
export function monumentBattleControl(attacker: Fleet, defender: Fleet): MonumentBattleControl {
  assertMonumentFleet(attacker);
  assertMonumentFleet(defender);
  if (fleetCount(defender) > 0) return 'DEFENDER';
  return combatValue(attacker) > 0 ? 'ATTACKER' : 'EMPTY';
}

export interface MonumentCombatResult extends BattleResult {
  control: MonumentBattleControl;
}

export interface MonumentDominionParticipant {
  playerId: string;
  /** The actual battle-start fleet, never the survivors after the fight. */
  fleet: Fleet;
}

/** Personal integer shares of an already computed ordinary PvP side transfer. */
export function allocateMonumentDominion(
  total: number,
  participants: readonly MonumentDominionParticipant[],
): JointDominionShare[] {
  if (!Number.isSafeInteger(total)) throw new RangeError('monument Dominion transfer must be a safe integer');
  const power = new Map<string, number>();
  const nonCombatValue = new Map<string, number>();
  for (const row of participants) {
    if (!row.playerId) throw new RangeError('missing monument Dominion owner');
    assertMonumentFleet(row.fleet);
    const own = (power.get(row.playerId) ?? 0) + combatValue(row.fleet);
    if (!Number.isSafeInteger(own)) throw new RangeError('monument Dominion power exceeds integer range');
    power.set(row.playerId, own);
    let cargo = nonCombatValue.get(row.playerId) ?? 0;
    for (const [hull, count] of fleetEntries(row.fleet)) {
      if (HULLS[hull].family === 'CARGO' || hull === 'GARBAGE_COLLECTOR') cargo += fleetValue({ [hull]: count });
    }
    if (!Number.isSafeInteger(cargo)) throw new RangeError('monument Dominion cargo value exceeds integer range');
    nonCombatValue.set(row.playerId, cargo);
  }
  // Owner-approved fallback for a side held only by cargo ships and Collectors. Combat sides
  // retain battle-start power; cargo never inflates their participation weight.
  const weights = [...power.values()].some((value) => value > 0) ? power : nonCombatValue;
  if (total !== 0 && ![...weights.values()].some((value) => value > 0)) {
    throw new RangeError('nonzero monument Dominion needs a participating power or cargo value');
  }
  return allocateJointDominion(total, [...weights].map(([playerId, raw]) => ({ playerId, raw })));
}

/** The common ownership-aware battle, without a planet shield or healthy host. */
export function resolveMonumentCombat(
  attackers: readonly JointAttackerStack[],
  defenders: readonly DefenderStack[],
  rng: Rng,
): MonumentCombatResult {
  const identities = new Set<string>();
  for (const row of attackers) {
    if (!row.contributionId || !row.playerId || identities.has(row.contributionId)) throw new RangeError('bad monument attacker identity');
    identities.add(row.contributionId);
    assertMonumentFleet(row.fleet, row.damage);
  }
  for (const row of defenders) {
    if (!row.stackId || !row.playerId || identities.has(row.stackId)) throw new RangeError('bad monument defender identity');
    identities.add(row.stackId);
    assertMonumentFleet(row.fleet, row.damage);
  }
  const a = [...attackers].sort((left, right) => byId(left.contributionId, right.contributionId));
  const d: DefenderStack[] = defenders.length > 0
    ? [...defenders].sort((left, right) => byId(left.stackId, right.stackId))
    : [{ stackId: '', playerId: '', fleet: {}, tech: { tech: {} } }];
  const result = resolveBattle(a, d, 0, rng, 'MONUMENT');
  return {
    ...result,
    defenders: defenders.length > 0 ? result.defenders : [],
    control: monumentBattleControl(result.attackerSurvivors, result.defenderSurvivors),
  };
}
