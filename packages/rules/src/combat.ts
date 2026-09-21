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
   * Share of defending unit value destroyed; 1 for an unguarded walkover (D173).
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

/** The Nullifier's class-adjusted contribution while an Aegis covers a defending line. */
function specialistDamage(
  attackers: Fleet,
  defenders: Fleet,
  roll: number,
  a: SideStats,
  d: SideStats,
): number {
  return sum(damageMap(attackers, defenders, roll, a, d));
}

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

/**
 * ONE COMMANDER'S SHARE OF A COMBINED ATTACKING POOL. Klan Ortak Savaşı.
 *
 * The fleet stays its OWNER'S at every step: their research fires it, their
 * research decides what it takes to kill, and its casualties are theirs. A stack
 * is one contribution — one wave, one origin, one snapshot of research — and a
 * commander who sent three waves is three stacks here, deliberately, so the return
 * legs and the loot can be paid to the wave that earned them.
 */
export interface JointAttackerStack {
  contributionId: string;
  playerId: string;
  fleet: Fleet;
  /** The OWNER'S side, snapshotted when the wave was sent. Never the leader's. */
  tech: CombatSide;
}

/** What one contribution did and what it cost, once the board is settled. */
export interface JointContributionOutcome {
  contributionId: string;
  playerId: string;
  sent: Fleet;
  survivors: Fleet;
  losses: Fleet;
  /** `fleetValue(losses)`; the per-stack parts sum to `attackerLossValue` exactly. */
  lossValue: number;
  /**
   * POST-SHIELD HULL DAMAGE CREDITED TO THIS STACK, and the one input Dominion
   * attribution reads. Capped at what the defending line could actually absorb in
   * the round it was fired: overkill is not a contribution to anything, and
   * paying score for it would make a wildly oversized wing the best way to farm
   * the ladder.
   */
  hullDamage: number;
}

export interface JointCombatResult extends CombatResult {
  contributions: JointContributionOutcome[];
}

/**
 * THE DEFENDER FIRING BACK AT A POOL OF SEPARATELY-OWNED STACKS.
 *
 * `damageMap`'s own arithmetic, with the target pool keyed by (stack, hull)
 * instead of by hull: two commanders' Darts have different hit points the moment
 * their Ship Armour differs, so one entry per hull would price one owner's armour
 * onto another owner's ships.
 *
 * SUPPORT COVER IS THE WHOLE ALLIED SIDE'S, not each stack's. A commander who sent
 * only holds is covered by an ally's guns, and every hold on the field is exposed
 * together the moment the last allied combat hull dies. Anything else would make a
 * cargo-only contribution either invulnerable or suicidal depending on nothing the
 * player can see.
 */
function jointReturnFire(
  attackers: Fleet,
  stacks: readonly Fleet[],
  stats: readonly SideStats[],
  roll: number,
  a: SideStats,
): Map<HullId, number>[] {
  const out = stacks.map(() => new Map<HullId, number>());

  let combatHp = 0;
  for (let i = 0; i < stacks.length; i++) {
    for (const [id, n] of fleetEntries(stacks[i]!)) {
      if (HULLS[id].cls !== 'SUPPORT') combatHp += n * stats[i]!.hp(id);
    }
  }
  const supportShielded = combatHp > 0;

  let pool = 0;
  for (let i = 0; i < stacks.length; i++) {
    for (const [id, n] of fleetEntries(stacks[i]!)) {
      if (supportShielded && HULLS[id].cls === 'SUPPORT') continue;
      pool += n * stats[i]!.hp(id);
    }
  }
  if (pool <= 0) return out;

  for (let i = 0; i < stacks.length; i++) {
    for (const [defId, defN] of fleetEntries(stacks[i]!)) {
      if (supportShielded && HULLS[defId].cls === 'SUPPORT') continue;
      const share = (defN * stats[i]!.hp(defId)) / pool;
      let raw = 0;
      for (const [atkId, atkN] of fleetEntries(attackers)) {
        raw += atkN * a.atk(atkId) * counterMult(HULLS[atkId].cls, HULLS[defId].cls);
      }
      out[i]!.set(defId, raw * share * roll);
    }
  }
  return out;
}

/**
 * Apply return fire across ownership rows without rounding once per row.
 *
 * A contribution is bookkeeping, not armour. Identical hulls with identical hit
 * points form one casualty cohort, so dividing one wing into one-ship waves cannot
 * turn every fractional hit into a survivor. The exact cohort loss is allocated
 * back by live hull count, with contribution id as the deterministic remainder
 * tie-breaker.
 */
function applyJointCasualties(
  fleets: Fleet[],
  damage: readonly Map<HullId, number>[],
  stats: readonly SideStats[],
  carry: Map<string, number>,
  contributionIds: readonly string[],
): Fleet {
  interface Entry { index: number; count: number; damage: number; contributionId: string }
  interface Cohort { hull: HullId; hp: number; entries: Entry[] }
  const cohorts = new Map<string, Cohort>();
  for (let index = 0; index < fleets.length; index++) {
    for (const [hull, amount] of damage[index]!) {
      const count = fleets[index]![hull] ?? 0;
      if (count <= 0) continue;
      const hp = stats[index]!.hp(hull);
      const key = `${hull}:${String(hp)}`;
      const cohort = cohorts.get(key) ?? { hull, hp, entries: [] };
      cohort.entries.push({ index, count, damage: amount, contributionId: contributionIds[index]! });
      cohorts.set(key, cohort);
    }
  }

  const losses: Fleet = {};
  for (const [key, cohort] of cohorts) {
    const totalCount = cohort.entries.reduce((sum, entry) => sum + entry.count, 0);
    const effective = cohort.entries.reduce((sum, entry) => sum + entry.damage, carry.get(key) ?? 0);
    const killed = Math.min(totalCount, Math.floor(effective / cohort.hp));
    carry.set(key, effective - killed * cohort.hp);
    if (killed === 0) continue;

    const allocations = cohort.entries.map((entry) => {
      const exact = killed * entry.count / totalCount;
      return { entry, killed: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let left = killed - allocations.reduce((sum, row) => sum + row.killed, 0);
    allocations.sort((a, b) =>
      b.remainder - a.remainder
      || a.entry.contributionId.localeCompare(b.entry.contributionId)
      || a.entry.index - b.entry.index);
    for (const allocation of allocations) {
      if (left === 0) break;
      if (allocation.killed >= allocation.entry.count) continue;
      allocation.killed += 1;
      left -= 1;
    }
    for (const allocation of allocations) {
      if (allocation.killed === 0) continue;
      const fleet = fleets[allocation.entry.index]!;
      fleet[cohort.hull] = (fleet[cohort.hull] ?? 0) - allocation.killed;
      losses[cohort.hull] = (losses[cohort.hull] ?? 0) + allocation.killed;
    }
  }
  return losses;
}

const addInto = (target: Fleet, source: Fleet): void => {
  for (const id of Object.keys(source) as HullId[]) {
    target[id] = (target[id] ?? 0) + (source[id] ?? 0);
  }
};

/**
 * THE ONE RESOLVER. Three rounds, simultaneous fire, +/-8% variance, shield soaks
 * everything first — and an attacking side that may belong to several commanders.
 *
 * `resolveCombat` IS this function with one stack, rather than a second copy of
 * it. The alternative was two implementations of the most delicate arithmetic in
 * the game, kept in step by hand; the parity test in `test/clan-war` holds the
 * claim that a single stack resolves EXACTLY as the ordinary resolver always did,
 * down to the number of rolls drawn.
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
 * ONE ATTACKER ROLL AND ONE DEFENDER ROLL PER ROUND, whatever the pool holds. The
 * number of commanders in a joint war must not be the number of dice it throws,
 * or a five-member clan would be playing a different game of chance from a lone
 * raider.
 *
 * @param rng seeded from the mission id, so any report can be re-derived.
 */
export function resolveJointCombat(
  stacks: readonly JointAttackerStack[],
  defender: Fleet,
  shield: number,
  rng: Rng,
  defenderTech: CombatSide,
): JointCombatResult {
  if (stacks.length === 0) {
    throw new RangeError('a combined attack needs at least one contribution');
  }
  const d = statsFor(defenderTech);
  const stats = stacks.map((stack) => statsFor(stack.tech));
  const live = stacks.map((stack) => ({ ...stack.fleet }));
  const starts = stacks.map((stack) => ({ ...stack.fleet }));
  const D: Fleet = { ...defender };
  const defStart: Fleet = { ...defender };

  const defValueBefore = fleetValue(D);
  const carryA = new Map<string, number>();
  const carryD = new Map<HullId, number>();
  const credited = stacks.map(() => 0);
  const rounds: CombatRound[] = [];
  let shieldLeft = shield;

  for (let r = 0; r < COMBAT.rounds; r++) {
    let alive = 0;
    for (const fleet of live) alive += fleetCount(fleet);
    if (alive === 0) break;
    /**
     * AN AEGIS IS COVER FOR A DEFENDING LINE, NOT A LINE OF ITS OWN. D173.
     *
     * Owner instruction after Yasin's production raid: "Sıfır kişi varsa bu WIN
     * sayılır ve yağmalanabilir kaynakları almaları lazım." With no combat hull
     * or ground gun to fight, there is no target to distribute ordinary fire
     * across and therefore no battle round. The raid is the same walkover it is
     * on an unshielded world; the idle shield spends nothing and the grade below
     * opens the ordinary DECISIVE loot path.
     */
    if (fleetCount(D) === 0) break;

    const span = COMBAT.varianceMax - COMBAT.varianceMin;
    const attackerRoll = COMBAT.varianceMin + rng() * span;
    const defenderRoll = COMBAT.varianceMin + rng() * span;

    const perStack = live.map((fleet, i) => damageMap(fleet, D, attackerRoll, stats[i]!, d));
    const toD = perStack.length === 1
      ? perStack[0]!
      : (() => {
        const merged = new Map<HullId, number>();
        for (const map of perStack) {
          for (const [id, value] of map) merged.set(id, (merged.get(id) ?? 0) + value);
        }
        return merged;
      })();
    // Reuse the same class-adjusted map and roll. Four extra copies make the
    // Nullifier's total shield effect 5x without adding a fourth counter class.
    let specialistNormal = 0;
    if (shieldLeft > 0) {
      for (let i = 0; i < live.length; i++) {
        specialistNormal += specialistDamage(
          { NULLIFIER: live[i]!.NULLIFIER ?? 0 },
          D,
          attackerRoll,
          stats[i]!,
          d,
        );
      }
    }
    const toA = jointReturnFire(D, live, stats, defenderRoll, d);
    // Ordinary fire and the first copy of the Nullifier's shot follow the same
    // class-adjusted damage map. The four bonus copies below hit only the shield.
    const incoming = sum(toD);
    const shieldBefore = Math.max(0, Math.round(shieldLeft));
    const specialistBonus = specialistNormal * SHIELD_BREAKER.bonusShieldDamageMult;
    const specialistAbsorbed = Math.min(shieldLeft, specialistBonus);
    shieldLeft -= specialistAbsorbed;
    const absorbed = Math.min(shieldLeft, incoming);
    shieldLeft -= absorbed;
    const shieldAfter = Math.max(0, Math.round(shieldLeft));
    const passRatio = incoming > 0 ? (incoming - absorbed) / incoming : 0;

    const landed = incoming - absorbed;
    /*
      CREDIT WHAT EACH DEFENDING HULL COULD ABSORB, HULL BY HULL.

      One global overkill ratio lets excess fire against one class consume spare
      HP from another class in the reward split. It also forgets partial damage
      carried from an earlier round. Casualties already resolve per hull, so the
      attribution that feeds Dominion must use the same remaining HP boundary.
    */
    for (const [hull, damage] of toD) {
      const landedOnHull = damage * passRatio;
      if (landedOnHull <= 0) continue;
      const remainingHp = Math.max(
        0,
        (D[hull] ?? 0) * d.hp(hull) - (carryD.get(hull) ?? 0),
      );
      const cap = landedOnHull > remainingHp ? remainingHp / landedOnHull : 1;
      for (let i = 0; i < perStack.length; i++) {
        credited[i]! += (perStack[i]!.get(hull) ?? 0) * passRatio * cap;
      }
    }

    const defenderLosses = applyCasualties(D, toD, passRatio, carryD, d);
    const attackerLosses = applyJointCasualties(
      live, toA, stats, carryA, stacks.map((stack) => stack.contributionId),
    );

    rounds.push({
      round: r + 1,
      attackerRoll,
      defenderRoll,
      attackerDamage: Math.round(incoming),
      defenderDamage: Math.round(toA.reduce((total, map) => total + sum(map), 0)),
      shieldBefore,
      shieldAfter,
      // Stored as the visible before→after movement so the report's arithmetic
      // is exact even when the resolver carried fractional damage internally.
      shieldAbsorbed: shieldBefore - shieldAfter,
      shieldBreakerDamage: Math.round(specialistAbsorbed),
      attackerHullDamage: Math.round(landed),
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

  /** The share of the defending LINE destroyed; no line means a complete walkover. D173. */
  const lossRatio = defValueBefore > 0 ? 1 - fleetValue(D) / defValueBefore : 1;
  const grade: Grade =
    fleetCount(D) === 0 && (defValueBefore === 0 || shieldLeft <= 0)
      ? 'DECISIVE'
      : lossRatio >= COMBAT.partialThreshold
        ? 'PARTIAL'
        : 'REPELLED';

  const atkStart: Fleet = {};
  const attackerSurvivors: Fleet = {};
  for (let i = 0; i < stacks.length; i++) {
    addInto(atkStart, starts[i]!);
    addInto(attackerSurvivors, live[i]!);
  }
  const attackerLosses = fleetDiff(atkStart, attackerSurvivors);
  const defenderLosses = fleetDiff(defStart, D);

  const contributions = stacks.map((stack, i) => {
    const losses = fleetDiff(starts[i]!, live[i]!);
    return {
      contributionId: stack.contributionId,
      playerId: stack.playerId,
      sent: starts[i]!,
      survivors: live[i]!,
      losses,
      lossValue: fleetValue(losses),
      hullDamage: credited[i]!,
    };
  });

  return {
    grade,
    lossRatio,
    rounds,
    shieldLeft: Math.max(0, Math.round(shieldLeft)),
    attackerSurvivors,
    defenderSurvivors: D,
    attackerLosses,
    defenderLosses,
    attackerLossValue: fleetValue(attackerLosses),
    defenderLossValue: Math.max(0, fleetValue(defenderLosses) - fleetValue(defenceSalvage)),
    defenceSalvage,
    contributions,
  };
}

/**
 * ONE ATTACKER, ONE DEFENDER — the ordinary raid, and every battle in the game
 * that is not a clan's joint war.
 *
 * A thin naming of `resolveJointCombat` with a single stack rather than a second
 * resolver. See that function for the rules; see `test/clan-war` for the parity
 * this delegation exists to make unbreakable.
 */
export function resolveCombat(
  attacker: Fleet,
  defender: Fleet,
  shield: number,
  rng: Rng,
  tech: CombatTech,
): CombatResult {
  const joint = resolveJointCombat(
    [{ contributionId: '', playerId: '', fleet: attacker, tech: tech.attacker }],
    defender,
    shield,
    rng,
    tech.defender,
  );
  return {
    grade: joint.grade,
    lossRatio: joint.lossRatio,
    rounds: joint.rounds,
    shieldLeft: joint.shieldLeft,
    attackerSurvivors: joint.attackerSurvivors,
    defenderSurvivors: joint.defenderSurvivors,
    attackerLosses: joint.attackerLosses,
    defenderLosses: joint.defenderLosses,
    attackerLossValue: joint.attackerLossValue,
    defenderLossValue: joint.defenderLossValue,
    defenceSalvage: joint.defenceSalvage,
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
