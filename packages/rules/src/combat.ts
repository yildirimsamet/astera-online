import { BREACHER, COMBAT } from './constants.js';
import { hullTech, type TechLevels } from './tech.js';
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
  /** The bounded shot multiplier rolled for each side. Present on newly resolved reports. */
  attackerRoll?: number;
  defenderRoll?: number;
  attackerDamage: number;
  defenderDamage: number;
  /** Defender Aegis charge around this round's hit. Present on newly resolved reports. */
  shieldBefore?: number;
  shieldAfter?: number;
  shieldAbsorbed: number;
  /** Bonus shield-only damage actually absorbed; never spills into unit HP. D95. */
  breacherShieldDamage: number;
  /** Ordinary attacker fire left after Aegis, before defender HP removes units. */
  attackerHullDamage?: number;
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
/**
 * ONE SIDE'S EFFECTIVE STATS. T9.
 *
 * Passed in rather than read from `HULLS` at each site, so a doctrine cannot be
 * honoured in the damage pool and forgotten in the casualty maths — which is
 * exactly the shape of bug this file would hide best. A commander with no
 * research gets the table's own numbers back, unchanged.
 */
export interface SideStats {
  atk: (id: HullId) => number;
  hp: (id: HullId) => number;
}

const statsFor = (tech: TechLevels): SideStats => ({
  atk: (id) => HULLS[id].atk * hullTech(tech, id).atk,
  hp: (id) => HULLS[id].hp * hullTech(tech, id).hp,
});

function damageMap(
  attackers: Fleet,
  defenders: Fleet,
  roll: number,
  a: SideStats,
  d: SideStats,
): Map<HullId, number> {
  const out = new Map<HullId, number>();

  let combatHp = 0;
  for (const [id, n] of fleetEntries(defenders)) {
    if (HULLS[id].cls !== 'SUPPORT') combatHp += n * d.hp(id);
  }
  const supportShielded = combatHp > 0;

  const targets = fleetEntries(defenders).filter(
    ([id]) => !(supportShielded && HULLS[id].cls === 'SUPPORT'),
  );
  let pool = 0;
  for (const [id, n] of targets) pool += n * d.hp(id);
  if (pool <= 0) return out;

  for (const [defId, defN] of targets) {
    const share = (defN * d.hp(defId)) / pool;
    let raw = 0;
    for (const [atkId, atkN] of fleetEntries(attackers)) {
      raw += atkN * a.atk(atkId) * counterMult(HULLS[atkId].cls, HULLS[defId].cls);
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
  own: SideStats,
): Fleet {
  const losses: Fleet = {};
  for (const [id, dmg] of damage) {
    const effective = dmg * passRatio + (carry.get(id) ?? 0);
    const killed = Math.min(fleet[id] ?? 0, Math.floor(effective / own.hp(id)));
    carry.set(id, effective - killed * own.hp(id));
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
function breacherDamage(
  attackers: Fleet,
  defenders: Fleet,
  roll: number,
  a: SideStats,
  d: SideStats,
): number {
  const mapped = sum(damageMap(attackers, defenders, roll, a, d));
  if (mapped > 0 || fleetCount(defenders) > 0) return mapped;
  let raw = 0;
  for (const [id, count] of fleetEntries(attackers)) raw += a.atk(id) * count;
  return raw * roll;
}

/**
 * Three rounds, simultaneous fire, +/-8% variance, shield soaks everything first.
 *
 * Each returned round is also the immutable explanation of that calculation. The
 * rolls and Aegis before→after path used to die with this stack frame, leaving a
 * report able to say only that "some shield damage" happened. Keeping the trace
 * here prevents the API from reconstructing history from a shield that may have
 * recharged and lets the UI explain the same order the resolver actually used.
 *
 * Variance is deliberately small: the whole game is built on information reducing
 * uncertainty, so if randomness dominated outcomes intel would be worthless and
 * the core loop would collapse.
 *
 * @param rng seeded from the mission id, so any report can be re-derived.
 */
/**
 * WHOSE RESEARCH APPLIES TO WHICH SIDE. T9.
 *
 * REQUIRED, not defaulted. A neutral default would let a caller forget it and
 * silently resolve a battle in a game where nobody had researched anything — and
 * the compiler would say nothing. The empty pair is spelled out at the call sites
 * that genuinely have no research to offer.
 */
export interface CombatTech {
  attacker: TechLevels;
  defender: TechLevels;
}

export function resolveCombat(
  attacker: Fleet,
  defender: Fleet,
  shield: number,
  rng: Rng,
  tech: CombatTech,
): CombatResult {
  const a = statsFor(tech.attacker);
  const d = statsFor(tech.defender);
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
    const defenderRoll = COMBAT.varianceMin + rng() * span;
    const toD = damageMap(A, D, attackerRoll, a, d);
    // Reuse the same class-adjusted map and roll. Four extra copies make the
    // Breacher's total shield effect 5x without adding a fourth counter class.
    const breacherNormal = shieldLeft > 0
      ? breacherDamage({ BREACHER: A.BREACHER ?? 0 }, D, attackerRoll, a, d)
      : 0;
    const toA = damageMap(D, A, defenderRoll, d, a);

    // With no units to target, only a Breacher has a planet-facing shield hit.
    // This preserves the established ordinary-combat model while ensuring its
    // advertised fivefold shield effect still exists against a bare Aegis.
    const incoming = sum(toD) + (fleetCount(D) === 0 ? breacherNormal : 0);
    const shieldBefore = Math.max(0, Math.round(shieldLeft));
    const breacherBonus = breacherNormal * BREACHER.bonusShieldDamageMult;
    const breacherAbsorbed = Math.min(shieldLeft, breacherBonus);
    shieldLeft -= breacherAbsorbed;
    const absorbed = Math.min(shieldLeft, incoming);
    shieldLeft -= absorbed;
    const shieldAfter = Math.max(0, Math.round(shieldLeft));
    const passRatio = incoming > 0 ? (incoming - absorbed) / incoming : 0;

    const defenderLosses = applyCasualties(D, toD, passRatio, carryD, d);
    const attackerLosses = applyCasualties(A, toA, 1, carryA, a);

    rounds.push({
      round: r + 1,
      attackerRoll,
      defenderRoll,
      attackerDamage: Math.round(incoming),
      defenderDamage: Math.round(sum(toA)),
      shieldBefore,
      shieldAfter,
      // Stored as the visible before→after movement so the report's arithmetic
      // is exact even when the resolver carried fractional damage internally.
      shieldAbsorbed: shieldBefore - shieldAfter,
      breacherShieldDamage: Math.round(breacherAbsorbed),
      attackerHullDamage: Math.round(incoming - absorbed),
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
