import { COMBAT, SHIELD_BREAKER } from './constants.js';
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
  shieldBreakerDamage: number;
  /** Ordinary attacker fire left after Aegis, before defender HP removes units. */
  attackerHullDamage?: number;
  attackerLosses: Fleet;
  defenderLosses: Fleet;
}

export interface CombatResult {
  grade: Grade;
  /**
   * Share of the defender's DEFENCE destroyed — unit value where there were units,
   * and the Aegis where the shield was the whole of it. See `resolveCombat`.
   */
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
 * their side survives. Without this a transport dies in round one, the attacker
 * arrives with no cargo, and raiding cannot pay for itself. It is also what
 * creates the escort decision — bring enough combat hulls to cover the cargo.
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

const statsFor = (side: CombatSide): SideStats => {
  const damageMult = side.damageMult ?? 1;
  return {
    atk: (id) => HULLS[id].atk * hullTech(side.tech, id).atk * damageMult,
    hp: (id) => HULLS[id].hp * hullTech(side.tech, id).hp,
  };
};

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

/** Specialist damage, including the shield-only case where no unit is targetable. */
function specialistDamage(
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
export interface CombatSide {
  tech: TechLevels;
  /**
   * A FLAT MULTIPLIER ON EVERY SHOT THIS SIDE FIRES. Optional; 1 when absent.
   *
   * The pirate handicap (D150) and NOTHING ELSE. It is deliberately not research:
   * D137 caps the combined research product at 25% and this sits far outside
   * that, so routing it through the tech tables would silently break the ceiling
   * the whole ladder is priced against.
   *
   * IT LIVES ON `atk` AND NEVER ON `hp`. "Deals less damage" is the rule; "is
   * easier to kill" is a different rule nobody asked for, and an L4 pirate has to
   * stay dangerous to shoot at or its ship is not a prize. Applied inside
   * `statsFor`, so `damageMap`, `applyCasualties` and `specialistDamage` all read
   * it through the one `SideStats` they already share — a modifier honoured in the
   * damage pool and forgotten in the casualty maths is the bug this file hides
   * best, and there is now no seam for it to hide in.
   */
  damageMult?: number;
}

export interface CombatTech {
  attacker: CombatSide;
  defender: CombatSide;
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
    // Nullifier's total shield effect 5x without adding a fourth counter class.
    const specialistNormal = shieldLeft > 0
      ? specialistDamage({ NULLIFIER: A.NULLIFIER ?? 0 }, D, attackerRoll, a, d)
      : 0;
    const toA = damageMap(D, A, defenderRoll, d, a);

    // With no units to target, only a Nullifier has a planet-facing shield hit.
    // This preserves the established ordinary-combat model while ensuring its
    // advertised fivefold shield effect still exists against a bare Aegis.
    const incoming = sum(toD) + (fleetCount(D) === 0 ? specialistNormal : 0);
    const shieldBefore = Math.max(0, Math.round(shieldLeft));
    const specialistBonus = specialistNormal * SHIELD_BREAKER.bonusShieldDamageMult;
    const specialistAbsorbed = Math.min(shieldLeft, specialistBonus);
    shieldLeft -= specialistAbsorbed;
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
      shieldBreakerDamage: Math.round(specialistAbsorbed),
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

  /**
   * HOW MUCH OF THE DEFENCE CAME DOWN — AND THE AEGIS IS PART OF THE DEFENCE.
   *
   * Owner ruling: *"aegis'te bir savunma birimi sonucta. tabya gibi kirpi gibi
   * gemi gibi bir savunma birimi."*
   *
   * This was `defValueBefore > 0 ? … : 1`, and the `: 1` was doing two jobs. For a
   * WALKOVER it is right — a world with nothing on it and no shield has all of its
   * nothing destroyed, and the DECISIVE branch below picks that up. But a world
   * whose entire defence is an Aegis also has no unit VALUE, so it took the same
   * branch: a fleet with no Nullifier flew at a bare shield, landed no damage, spent
   * none of the shield, killed nobody, and came home at ratio 1 — which DECISIVE
   * refuses while `shieldLeft > 0`, so it fell through to PARTIAL and was paid a
   * partial haul for achieving literally nothing.
   *
   * So where the defence IS the shield, the shield is what the ratio measures. The
   * three cases read as one rule now: destroy the units where there are units,
   * destroy the shield where that is all there is, and an empty world is empty.
   *
   * NOTHING MOVES FOR A BATTLE THAT HAD UNITS IN IT. The first branch is unchanged
   * and is the one every ordinary fight takes, so no grade anywhere else shifts.
   */
  const lossRatio = defValueBefore > 0
    ? 1 - fleetValue(D) / defValueBefore
    : shield > 0
      ? 1 - shieldLeft / shield
      : 1;
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
