import { BREACHER, COMBAT } from './constants.js';
import {
  ALL_HULLS,
  HULLS,
  counterMult,
  fleetCount,
  fleetDiff,
  fleetEntries,
  fleetValue,
} from './hulls.js';
import type { Fleet, Grade, HullId, Rng } from './types.js';

export interface CombatRound {
  round: number;
  attackerDamage: number;
  defenderDamage: number;
  shieldAbsorbed: number;
  /** Bonus shield-only damage actually absorbed; never spills into unit HP. D95. */
  breacherShieldDamage: number;
  attackerLosses: Fleet;
  defenderLosses: Fleet;
}

export interface CombatResult {
  grade: Grade;
  /** Share of the defender's unit VALUE destroyed. */
  lossRatio: number;
  rounds: CombatRound[];
  shieldLeft: number;
  attackerSurvivors: Fleet;
  defenderSurvivors: Fleet;
  attackerLosses: Fleet;
  defenderLosses: Fleet;
  attackerLossValue: number;
  /** Net of salvage — what the attacker actually took off the board. */
  defenderLossValue: number;
  /** Ground units rebuilt free from wreckage, applied by the caller after loot. */
  defenceSalvage: Fleet;
}

/**
 * Damage each defending type receives this round, split by that type's share of
 * the targetable HP pool.
 *
 * Support hulls fly behind the line: they take nothing while any combat hull on
 * their side survives. Without this a Hauler (80 HP, taking 1.6x from everything)
 * dies in round one, the attacker arrives with no cargo, and raiding cannot pay
 * for itself. It is also what creates the escort decision — bring enough combat
 * hulls to cover the cargo you brought.
 */
function damageMap(attackers: Fleet, defenders: Fleet, roll: number): Map<HullId, number> {
  const out = new Map<HullId, number>();

  let combatHp = 0;
  for (const [id, n] of fleetEntries(defenders)) {
    if (HULLS[id].cls !== 'SUPPORT') combatHp += n * HULLS[id].hp;
  }
  const supportShielded = combatHp > 0;

  const targets = fleetEntries(defenders).filter(
    ([id]) => !(supportShielded && HULLS[id].cls === 'SUPPORT'),
  );
  let pool = 0;
  for (const [id, n] of targets) pool += n * HULLS[id].hp;
  if (pool <= 0) return out;

  for (const [defId, defN] of targets) {
    const share = (defN * HULLS[defId].hp) / pool;
    let raw = 0;
    for (const [atkId, atkN] of fleetEntries(attackers)) {
      raw += atkN * HULLS[atkId].atk * counterMult(HULLS[atkId].cls, HULLS[defId].cls);
    }
    out.set(defId, raw * share * roll);
  }
  return out;
}

/** Apply damage, carrying the fraction of a part-damaged hull into the next round. */
function applyCasualties(
  fleet: Fleet,
  damage: Map<HullId, number>,
  passRatio: number,
  carry: Map<HullId, number>,
): Fleet {
  const losses: Fleet = {};
  for (const [id, dmg] of damage) {
    const effective = dmg * passRatio + (carry.get(id) ?? 0);
    const killed = Math.min(fleet[id] ?? 0, Math.floor(effective / HULLS[id].hp));
    carry.set(id, effective - killed * HULLS[id].hp);
    if (killed > 0) {
      fleet[id] = (fleet[id] ?? 0) - killed;
      losses[id] = killed;
    }
  }
  return losses;
}

const sum = (m: Map<HullId, number>): number => {
  let t = 0;
  for (const v of m.values()) t += v;
  return t;
};

/** Breacher damage, including the shield-only case where no unit is targetable. */
function breacherDamage(attackers: Fleet, defenders: Fleet, roll: number): number {
  const mapped = sum(damageMap(attackers, defenders, roll));
  if (mapped > 0 || fleetCount(defenders) > 0) return mapped;
  let raw = 0;
  for (const [id, count] of fleetEntries(attackers)) raw += HULLS[id].atk * count;
  return raw * roll;
}

/**
 * Three rounds, simultaneous fire, +/-8% variance, shield soaks everything first.
 *
 * Variance is deliberately small: the whole game is built on information reducing
 * uncertainty, so if randomness dominated outcomes intel would be worthless and
 * the core loop would collapse.
 *
 * @param rng seeded from the mission id, so any report can be re-derived.
 */
export function resolveCombat(
  attacker: Fleet,
  defender: Fleet,
  shield: number,
  rng: Rng,
): CombatResult {
  const A: Fleet = { ...attacker };
  const D: Fleet = { ...defender };
  const atkStart: Fleet = { ...attacker };
  const defStart: Fleet = { ...defender };

  const defValueBefore = fleetValue(D);
  const carryA = new Map<HullId, number>();
  const carryD = new Map<HullId, number>();
  const rounds: CombatRound[] = [];
  let shieldLeft = shield;

  for (let r = 0; r < COMBAT.rounds; r++) {
    if (fleetCount(A) === 0) break;
    if (fleetCount(D) === 0 && shieldLeft <= 0) break;

    const span = COMBAT.varianceMax - COMBAT.varianceMin;
    const attackerRoll = COMBAT.varianceMin + rng() * span;
    const toD = damageMap(A, D, attackerRoll);
    // Reuse the same class-adjusted map and roll. Four extra copies make the
    // Breacher's total shield effect 5x without adding a fourth counter class.
    const breacherNormal = shieldLeft > 0
      ? breacherDamage({ BREACHER: A.BREACHER ?? 0 }, D, attackerRoll)
      : 0;
    const toA = damageMap(D, A, COMBAT.varianceMin + rng() * span);

    // With no units to target, only a Breacher has a planet-facing shield hit.
    // This preserves the established ordinary-combat model while ensuring its
    // advertised fivefold shield effect still exists against a bare Aegis.
    const incoming = sum(toD) + (fleetCount(D) === 0 ? breacherNormal : 0);
    const breacherBonus = breacherNormal * BREACHER.bonusShieldDamageMult;
    const breacherAbsorbed = Math.min(shieldLeft, breacherBonus);
    shieldLeft -= breacherAbsorbed;
    const absorbed = Math.min(shieldLeft, incoming);
    shieldLeft -= absorbed;
    const passRatio = incoming > 0 ? (incoming - absorbed) / incoming : 0;

    const defenderLosses = applyCasualties(D, toD, passRatio, carryD);
    const attackerLosses = applyCasualties(A, toA, 1, carryA);

    rounds.push({
      round: r + 1,
      attackerDamage: Math.round(incoming),
      defenderDamage: Math.round(sum(toA)),
      shieldAbsorbed: Math.round(absorbed + breacherAbsorbed),
      breacherShieldDamage: Math.round(breacherAbsorbed),
      attackerLosses,
      defenderLosses,
    });
  }

  // Salvage is computed AFTER the rounds, so it never softens the grade or the loot.
  const defenceSalvage: Fleet = {};
  for (const id of ALL_HULLS) {
    if (!HULLS[id].ground) continue;
    const lost = (defStart[id] ?? 0) - (D[id] ?? 0);
    const back = Math.floor(lost * COMBAT.defenceSalvage);
    if (back > 0) defenceSalvage[id] = back;
  }

  const lossRatio = defValueBefore > 0 ? 1 - fleetValue(D) / defValueBefore : 1;
  const grade: Grade =
    fleetCount(D) === 0 && shieldLeft <= 0
      ? 'DECISIVE'
      : lossRatio >= COMBAT.partialThreshold
        ? 'PARTIAL'
        : 'REPELLED';

  const attackerLosses = fleetDiff(atkStart, A);
  const defenderLosses = fleetDiff(defStart, D);

  return {
    grade,
    lossRatio,
    rounds,
    shieldLeft: Math.max(0, Math.round(shieldLeft)),
    attackerSurvivors: A,
    defenderSurvivors: D,
    attackerLosses,
    defenderLosses,
    attackerLossValue: fleetValue(attackerLosses),
    defenderLossValue: Math.max(0, fleetValue(defenderLosses) - fleetValue(defenceSalvage)),
    defenceSalvage,
  };
}

/* ── the engagement window ──────────────────────────────────── */

/** The engagement, in milliseconds. `COMBAT.engagementSeconds`, once. */
export const ENGAGEMENT_MS = COMBAT.engagementSeconds * 1000;

/**
 * When a landing's outcome is settled: the moment the fleet arrives, plus the
 * engagement. D44.
 *
 * THE SERVER SCHEDULES AGAINST THIS AND THE CLIENT DRAWS AGAINST IT, from the one
 * definition — which is what makes the ten seconds a state of the world rather
 * than an animation the client happens to play. Two copies of `+ 10s` would drift
 * the instant either side was tuned, and the symptom would be a squadron still
 * firing at a world whose battle report had already been written.
 */
export const engagementEndsAt = (arriveAtMs: number): number => arriveAtMs + ENGAGEMENT_MS;

/** Is this fleet over its target right now, with nothing yet decided? */
export const isEngaging = (arriveAtMs: number, nowMs: number): boolean =>
  nowMs >= arriveAtMs && nowMs < engagementEndsAt(arriveAtMs);
