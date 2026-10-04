import { COMBAT, SHIELD_BREAKER, SHIP_DAMAGE } from './constants.js';
import {
  assertDamageCarried,
  carryToBp,
  normalizeLots,
  type DamageLots,
} from './damage.js';
import { hullTech, type TechLevels } from './tech.js';
import { normalizeHpDamage, type HpDamageLot, type HpDamageLots } from './radiationHp.js';
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
  /**
   * WHAT THE SURVIVORS CARRY OUT OF THE BATTLE. Kalıcı gemi hasarı, owner K1.
   *
   * The resolver always left one part-hit ship per hull on each side — the `carry` —
   * and used to forget it. It is returned here with whatever damage an attacker brought
   * in and did not die of. Ground guns are never listed: they rebuild from salvage. The
   * caller decides what the damage means (`splitForLanding`); an NPC side ignores it.
   */
  attackerDamage: HpDamageLot[];
  defenderDamage: HpDamageLot[];
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
  /**
   * DAMAGE THE WAVE ARRIVED WITH — radiation on the way in. Absent means every ship is
   * whole, which is every battle a defender fights: nothing at `home` is ever damaged.
   */
  damage?: HpDamageLots;
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
  /** This wave's damaged survivors; they fly home on this wave's return leg. */
  survivorDamage: HpDamageLot[];
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

/* ── ships that arrived damaged ─────────────────────────────────── */

/** Some damaged ships of one hull in one wave, and the hull each of them has left. */
interface Wounded {
  count: number;
  hpLeft: number;
  /** An untouched precise wound survives without an HP → BP round trip. */
  arrivalDamage?: HpDamageLot;
}
/** Per hull, a wave's damaged ships in the order they die: least hull left first. */
type WoundMap = Map<HullId, Wounded[]>;

interface CohortEntry { index: number; count: number; damage: number; contributionId: string }
interface Cohort { hull: HullId; hp: number; entries: CohortEntry[] }

const cohortKey = (hull: HullId, hp: number): string => `${hull}:${String(hp)}`;

const woundedCount = (wounded: WoundMap, hull: HullId): number =>
  (wounded.get(hull) ?? []).reduce((sum, group) => sum + group.count, 0);

/** A wave's arrival damage as the hull each ship has left, at its owner's armour. */
function combatLots(fleet: Fleet, lots: HpDamageLots | undefined, precise: boolean): HpDamageLot[] {
  return precise ? normalizeHpDamage(fleet, lots) : normalizeLots(lots);
}

function woundedFrom(stack: { fleet: Fleet; damage?: HpDamageLots }, stats: SideStats, precise = false): WoundMap {
  const lots = combatLots(stack.fleet, stack.damage, precise);
  assertDamageCarried(stack.fleet, lots);
  const out: WoundMap = new Map();
  for (const lot of lots) {
    const hp = stats.hp(lot.hull);
    const groups = out.get(lot.hull) ?? [];
    // Subtract the fractional field last: 9999 + (1 - epsilon) can round to
    // 10000, even though these two fields describe a ship with positive HP.
    const remainingBp = (SHIP_DAMAGE.destroyedBp - lot.damageBp) - (precise ? lot.remainderBp ?? 0 : 0);
    groups.push({
      count: lot.count, hpLeft: hp * remainingBp / SHIP_DAMAGE.destroyedBp,
      ...(precise ? { arrivalDamage: { hull: lot.hull, count: lot.count, damageBp: lot.damageBp, remainderBp: lot.remainderBp ?? 0 } } : {}),
    });
    out.set(lot.hull, groups);
  }
  for (const groups of out.values()) groups.sort((a, b) => a.hpLeft - b.hpLeft);
  return out;
}

/**
 * THE MOST DAMAGED SHIPS DIE FIRST. Kalıcı gemi hasarı, radiation's half.
 *
 * This round's fire on the cohort is spent on its damaged ships, least hull first, across
 * every wave in it; a ship it does not finish keeps the rest of the hit. Whatever is left
 * over returns to the ordinary healthy-cohort arithmetic below. That is also why the
 * ordinary `carry` is zero while any damaged ship stands: fire only reaches a healthy
 * ship once every damaged one is gone.
 */
function spendOnWounded(
  cohort: Cohort,
  fleets: Fleet[],
  wounded: readonly WoundMap[],
  losses: Fleet,
): number {
  const queue = cohort.entries
    .flatMap((entry) => (wounded[entry.index]!.get(cohort.hull) ?? []).map((group) => ({ entry, group })))
    .sort((a, b) =>
      a.group.hpLeft - b.group.hpLeft
      || a.entry.contributionId.localeCompare(b.entry.contributionId)
      || a.entry.index - b.entry.index);
  let left = cohort.entries.reduce((sum, entry) => sum + entry.damage, 0);
  for (const { entry, group } of queue) {
    if (!(left > 0)) break;
    const killed = Math.min(group.count, Math.floor(left / group.hpLeft));
    if (killed > 0) {
      group.count -= killed;
      left -= killed * group.hpLeft;
      const fleet = fleets[entry.index]!;
      fleet[cohort.hull] = (fleet[cohort.hull] ?? 0) - killed;
      losses[cohort.hull] = (losses[cohort.hull] ?? 0) + killed;
    }
    if (group.count === 0) continue;
    if (left > 0) {
      group.count -= 1;
      wounded[entry.index]!.get(cohort.hull)!.push({ count: 1, hpLeft: group.hpLeft - left });
      left = 0;
    }
    break;
  }
  for (const entry of cohort.entries) {
    const groups = (wounded[entry.index]!.get(cohort.hull) ?? [])
      .filter((group) => group.count > 0)
      .sort((a, b) => a.hpLeft - b.hpLeft);
    if (groups.length > 0) wounded[entry.index]!.set(cohort.hull, groups);
    else wounded[entry.index]!.delete(cohort.hull);
  }
  return Math.max(0, left);
}

/** Hull lost as damage on a survivor. A sliver is healthy; a survivor is never destroyed. */
function survivorBp(lost: number, hp: number): number {
  if (!(lost > 0)) return 0;
  if (lost >= hp) return SHIP_DAMAGE.destroyedBp - 1;
  return carryToBp(lost, hp);
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
  wounded: readonly WoundMap[],
): Fleet {
  const cohorts = new Map<string, Cohort>();
  for (let index = 0; index < fleets.length; index++) {
    for (const [hull, amount] of damage[index]!) {
      const count = fleets[index]![hull] ?? 0;
      if (count <= 0) continue;
      const hp = stats[index]!.hp(hull);
      const key = cohortKey(hull, hp);
      const cohort = cohorts.get(key) ?? { hull, hp, entries: [] };
      // The healthy ships only. A damaged one is spent before any of them.
      const healthy = count - woundedCount(wounded[index]!, hull);
      cohort.entries.push({ index, count: healthy, damage: amount, contributionId: contributionIds[index]! });
      cohorts.set(key, cohort);
    }
  }

  const losses: Fleet = {};
  for (const [key, cohort] of cohorts) {
    const totalCount = cohort.entries.reduce((sum, entry) => sum + entry.count, 0);
    /*
      WITHOUT A DAMAGED SHIP IN THE COHORT THIS IS THE ORIGINAL LINE, CHARACTER FOR
      CHARACTER. `combat-parity-digest.test.ts` pins every battle that has none.
    */
    const effective = cohort.entries.some((entry) => woundedCount(wounded[entry.index]!, cohort.hull) > 0)
      ? spendOnWounded(cohort, fleets, wounded, losses) + (carry.get(key) ?? 0)
      : cohort.entries.reduce((sum, entry) => sum + entry.damage, carry.get(key) ?? 0);
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
  preciseDamage = false,
): JointCombatResult {
  if (stacks.length === 0) {
    throw new RangeError('a combined attack needs at least one contribution');
  }
  const d = statsFor(defenderTech);
  const stats = stacks.map((stack) => statsFor(stack.tech));
  const live = stacks.map((stack) => ({ ...stack.fleet }));
  const starts = stacks.map((stack) => ({ ...stack.fleet }));
  const wounded = stacks.map((stack, i) => woundedFrom(stack, stats[i]!, preciseDamage));
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
      live, toA, stats, carryA, stacks.map((stack) => stack.contributionId), wounded,
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

  const survivorDamage = attackerSurvivorDamage(stacks, live, stats, wounded, carryA, preciseDamage);
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
      survivorDamage: survivorDamage[i]!,
    };
  });

  /* The defender never arrives damaged (nothing at `home` is), so only its carry remains. */
  const defenderDamage: HpDamageLot[] = [];
  for (const [hull] of fleetEntries(D)) {
    if (HULLS[hull].ground) continue;
    const lot = survivorLot(hull, 1, carryD.get(hull) ?? 0, d.hp(hull), preciseDamage);
    if (lot) defenderDamage.push(lot);
  }

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
    attackerDamage: combatLots(attackerSurvivors, survivorDamage.flat(), preciseDamage),
    defenderDamage: combatLots(D, defenderDamage, preciseDamage),
    contributions,
  };
}

/**
 * EACH WAVE'S DAMAGED SURVIVORS: what it brought in and outlived, plus the one part-hit
 * healthy ship its cohort ended on. A cohort shared by several waves hands that ship to
 * the wave with the most healthy ships of it left — the likeliest owner of the hull that
 * was being worked on — and to the lower contribution id on a tie, so the answer never
 * depends on the order the waves were listed in.
 */
function attackerSurvivorDamage(
  stacks: readonly JointAttackerStack[],
  live: readonly Fleet[],
  stats: readonly SideStats[],
  wounded: readonly WoundMap[],
  carry: ReadonlyMap<string, number>,
  precise = false,
): HpDamageLot[][] {
  return stackSurvivorDamage(stacks.map((stack) => stack.contributionId), live, stats, wounded, carry, precise);
}

/** The HP path preserves sub-bp wounds; the planet path keeps its pinned rounding. */
function survivorLot(hull: HullId, count: number, lostHp: number, hp: number, precise: boolean, hpLeft = hp - lostHp): HpDamageLot | null {
  if (!precise) {
    const damageBp = survivorBp(lostHp, hp);
    return damageBp > 0 ? { hull, count, damageBp } : null;
  }
  if (count === 0 || lostHp <= 0) return null;
  if (!(hpLeft > 0)) throw new RangeError('a monument survivor must have positive HP');
  const exact = lostHp / hp * SHIP_DAMAGE.destroyedBp;
  // The ship still exists. Float noise at the destruction boundary cannot round
  // its carried damage into a dead lot; radiation will resolve its next HP dose.
  const damageBp = Math.min(SHIP_DAMAGE.destroyedBp - 1, Math.floor(exact + 1e-8));
  const remainderBp = Math.min(1 - Number.EPSILON, Math.max(0, exact >= SHIP_DAMAGE.destroyedBp ? 1 : exact - damageBp));
  return { hull, count, damageBp, remainderBp };
}

/**
 * The same judgement for any side made of owned stacks — an attacking pool or, since
 * Klan Savunma Desteği, a defending line. `ids` break ties exactly as contribution ids
 * always did.
 */
function stackSurvivorDamage(
  ids: readonly string[],
  live: readonly Fleet[],
  stats: readonly SideStats[],
  wounded: readonly WoundMap[],
  carry: ReadonlyMap<string, number>,
  precise = false,
): HpDamageLot[][] {
  const out = ids.map((_, i) => {
    const lots: HpDamageLot[] = [];
    for (const [hull, groups] of wounded[i]!) {
      const hp = stats[i]!.hp(hull);
      for (const group of groups) {
        const lot = precise && group.arrivalDamage
          ? { ...group.arrivalDamage, count: group.count }
          : survivorLot(hull, group.count, hp - group.hpLeft, hp, precise, group.hpLeft);
        if (lot) lots.push(lot);
      }
    }
    return lots;
  });

  const holders = new Map<string, { hull: HullId; hp: number; members: { index: number; healthy: number }[] }>();
  for (let index = 0; index < ids.length; index++) {
    for (const [hull, count] of fleetEntries(live[index]!)) {
      const healthy = count - woundedCount(wounded[index]!, hull);
      if (healthy <= 0) continue;
      const hp = stats[index]!.hp(hull);
      const key = cohortKey(hull, hp);
      const row = holders.get(key) ?? { hull, hp, members: [] };
      row.members.push({ index, healthy });
      holders.set(key, row);
    }
  }
  for (const [key, { hull, hp, members }] of holders) {
    const lot = survivorLot(hull, 1, carry.get(key) ?? 0, hp, precise);
    if (!lot) continue;
    const [owner] = [...members].sort((a, b) =>
      b.healthy - a.healthy
      || ids[a.index]!.localeCompare(ids[b.index]!)
      || a.index - b.index);
    if (owner) out[owner.index]!.push(lot);
  }
  return out.map((lots, i) => combatLots(live[i]!, lots, precise));
}

/**
 * THE ONE ATTACKER AS A STACK — the exact stack `resolveCombat` has always fought
 * with. Exported so a caller that needs the joint resolver's shape for a lone raid
 * (`resolveRaid`) hands it the same stack rather than a lookalike: the parity test
 * in `test/clan-war` holds only for this one.
 */
export const soloStack = (fleet: Fleet, side: CombatSide, damage?: DamageLots): JointAttackerStack =>
  ({ contributionId: '', playerId: '', fleet, tech: side, ...(damage ? { damage } : {}) });

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
  /** Damage the attacker arrived with (radiation). Absent: every ship whole. */
  attackerDamage?: DamageLots,
): CombatResult {
  const joint = resolveJointCombat(
    [soloStack(attacker, tech.attacker, attackerDamage)],
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
    attackerDamage: joint.attackerDamage,
    defenderDamage: joint.defenderDamage,
  };
}

/* ── a defending line held by several commanders ──────────────── */

/**
 * ONE COMMANDER'S SHARE OF A DEFENDING LINE. Klan Savunma Desteği, 2026-10-01.
 *
 * Index 0 of a line is always the HOST — the world's owner, whose ships, ground guns
 * and Aegis these are. Every other stack is a clanmate's stationed wave: their ships,
 * fired and armoured by THEIR live research, and their casualties. A ground gun can
 * only stand in the host's stack; a wave is ships.
 */
export interface DefenderStack {
  stackId: string;
  playerId: string;
  fleet: Fleet;
  tech: CombatSide;
  /** A wave's carried damage. A planet host is healthy; a monument defender need not be. */
  damage?: HpDamageLots;
}

/** What one defending stack sent in, kept and lost. */
export interface DefenderOutcome {
  stackId: string;
  playerId: string;
  sent: Fleet;
  survivors: Fleet;
  losses: Fleet;
  /** The host's is net of `defenceSalvage`, so the parts sum to `defenderLossValue`. */
  lossValue: number;
  /** This stack's damaged survivors. Never a ground gun — those rebuild from salvage. */
  survivorDamage: HpDamageLot[];
}

export interface BattleResult extends JointCombatResult {
  defenders: DefenderOutcome[];
}

function assertDefendingLine(defenders: readonly DefenderStack[], monument: boolean, precise: boolean): void {
  if (defenders.length === 0) throw new RangeError('a battle needs a defending line');
  if (!monument && combatLots(defenders[0]!.fleet, defenders[0]!.damage, precise).length > 0) {
    throw new RangeError('the host stack stands at home and cannot carry damage');
  }
  for (const stack of monument ? defenders : defenders.slice(1)) {
    for (const [hull, count] of fleetEntries(stack.fleet)) {
      if (count > 0 && HULLS[hull].ground) {
        throw new RangeError(`a support wave cannot hold the ground gun ${hull}`);
      }
    }
  }
}

const mergedFleet = (fleets: readonly Fleet[]): Fleet => {
  const out: Fleet = {};
  for (const fleet of fleets) addInto(out, fleet);
  return out;
};

/**
 * THE BATTLE, WHOEVER HOLDS THE LINE.
 *
 * ONE DEFENDING STACK IS `resolveJointCombat`, CALLED, not re-derived: every battle
 * without clan support — which is every battle in a season dealt before ruleset 15 —
 * goes down the exact path `combat-parity-digest.test.ts` pins.
 *
 * SEVERAL STACKS reuse the attacking side's own machinery in the other direction. The
 * attackers' fire is split across (stack, hull) by hit points — `jointReturnFire`, the
 * function the defender always used against a joint pool — and the line's casualties go
 * through `applyJointCasualties`, so equal hulls at equal armour form one cohort whoever
 * owns them and a supporter's damaged ships die first. The line fires back stack by
 * stack, each at its owner's research. Support cover, the Aegis and the grade are the
 * whole line's. Still one attacker roll and one defender roll a round.
 */
export function resolveBattle(
  stacks: readonly JointAttackerStack[],
  defenders: readonly DefenderStack[],
  shield: number,
  rng: Rng,
  /** New ruleset callers explicitly opt in; legacy planet battles retain exact parity. */
  context: 'PLANET' | 'MONUMENT' | 'HP_PLANET' = 'PLANET',
): BattleResult {
  const monument = context === 'MONUMENT';
  const precise = context !== 'PLANET';
  if (monument && shield !== 0) throw new RangeError('a monument fleet has no planet shield');
  assertDefendingLine(defenders, monument, precise);
  if (defenders.length === 1 && !monument) {
    const only = defenders[0]!;
    const joint = resolveJointCombat(stacks, only.fleet, shield, rng, only.tech, precise);
    return {
      ...joint,
      defenders: [{
        stackId: only.stackId,
        playerId: only.playerId,
        sent: { ...only.fleet },
        survivors: joint.defenderSurvivors,
        losses: joint.defenderLosses,
        lossValue: joint.defenderLossValue,
        survivorDamage: joint.defenderDamage,
      }],
    };
  }
  if (stacks.length === 0) {
    throw new RangeError('a combined attack needs at least one contribution');
  }

  const stats = stacks.map((stack) => statsFor(stack.tech));
  const live = stacks.map((stack) => ({ ...stack.fleet }));
  const starts = stacks.map((stack) => ({ ...stack.fleet }));
  const wounded = stacks.map((stack, i) => woundedFrom(stack, stats[i]!, precise));

  const dStats = defenders.map((stack) => statsFor(stack.tech));
  const dLive = defenders.map((stack) => ({ ...stack.fleet }));
  const dStarts = defenders.map((stack) => ({ ...stack.fleet }));
  const dWounded = defenders.map((stack, j) => woundedFrom(stack, dStats[j]!, precise));
  const dIds = defenders.map((stack) => stack.stackId);

  const defValueBefore = fleetValue(mergedFleet(dStarts));
  const carryA = new Map<string, number>();
  const carryD = new Map<string, number>();
  const credited = stacks.map(() => 0);
  const rounds: CombatRound[] = [];
  let shieldLeft = shield;

  for (let r = 0; r < COMBAT.rounds; r++) {
    let alive = 0;
    for (const fleet of live) alive += fleetCount(fleet);
    if (alive === 0) break;
    // D173: no ship and no gun anywhere in the line is a walkover, not a battle.
    if (fleetCount(mergedFleet(dLive)) === 0) break;

    const span = COMBAT.varianceMax - COMBAT.varianceMin;
    const attackerRoll = COMBAT.varianceMin + rng() * span;
    const defenderRoll = COMBAT.varianceMin + rng() * span;

    // Each attacking stack's fire, split across every defending (stack, hull).
    const perStack = live.map((fleet, i) => jointReturnFire(fleet, dLive, dStats, attackerRoll, stats[i]!));
    const toD = dLive.map((_, j) => {
      const merged = new Map<HullId, number>();
      for (const maps of perStack) {
        for (const [hull, value] of maps[j]!) merged.set(hull, (merged.get(hull) ?? 0) + value);
      }
      return merged;
    });

    let specialistNormal = 0;
    if (shieldLeft > 0) {
      for (let i = 0; i < live.length; i++) {
        const shots = jointReturnFire({ NULLIFIER: live[i]!.NULLIFIER ?? 0 }, dLive, dStats, attackerRoll, stats[i]!);
        for (const map of shots) specialistNormal += sum(map);
      }
    }

    // The line fires back stack by stack, each at its owner's research.
    const toA = live.map(() => new Map<HullId, number>());
    for (let j = 0; j < dLive.length; j++) {
      const fire = jointReturnFire(dLive[j]!, live, stats, defenderRoll, dStats[j]!);
      for (let i = 0; i < live.length; i++) {
        for (const [hull, value] of fire[i]!) toA[i]!.set(hull, (toA[i]!.get(hull) ?? 0) + value);
      }
    }

    const incoming = toD.reduce((total, map) => total + sum(map), 0);
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
      CREDIT WHAT EACH DEFENDING COHORT COULD ABSORB. The cohort is (hull, hit points)
      across every stack — the unit casualties are resolved in — so overkill on one
      commander's Darts cannot be paid for out of another's spare hull.
    */
    const cohorts = new Map<string, { hull: HullId; members: number[]; remaining: number }>();
    for (let j = 0; j < dLive.length; j++) {
      for (const [hull, count] of fleetEntries(dLive[j]!)) {
        if (count <= 0) continue;
        const hp = dStats[j]!.hp(hull);
        const key = cohortKey(hull, hp);
        const groups = dWounded[j]!.get(hull) ?? [];
        const woundedHp = groups.reduce((total, group) => total + group.count * group.hpLeft, 0);
        const healthy = count - woundedCount(dWounded[j]!, hull);
        const row = cohorts.get(key) ?? { hull, members: [], remaining: 0 };
        row.members.push(j);
        row.remaining += healthy * hp + woundedHp;
        cohorts.set(key, row);
      }
    }
    for (const [key, { hull, members, remaining }] of cohorts) {
      const landedOnCohort = members.reduce((total, j) => total + (toD[j]!.get(hull) ?? 0), 0) * passRatio;
      if (landedOnCohort <= 0) continue;
      const left = Math.max(0, remaining - (carryD.get(key) ?? 0));
      const cap = landedOnCohort > left ? left / landedOnCohort : 1;
      for (let i = 0; i < perStack.length; i++) {
        const fired = members.reduce((total, j) => total + (perStack[i]![j]!.get(hull) ?? 0), 0);
        credited[i]! += fired * passRatio * cap;
      }
    }

    const scaledToD = toD.map((map) => {
      const scaled = new Map<HullId, number>();
      for (const [hull, value] of map) scaled.set(hull, value * passRatio);
      return scaled;
    });
    const defenderLosses = applyJointCasualties(dLive, scaledToD, dStats, carryD, dIds, dWounded);
    const attackerLosses = applyJointCasualties(
      live, toA, stats, carryA, stacks.map((stack) => stack.contributionId), wounded,
    );

    rounds.push({
      round: r + 1,
      attackerRoll,
      defenderRoll,
      attackerDamage: Math.round(incoming),
      defenderDamage: Math.round(toA.reduce((total, map) => total + sum(map), 0)),
      shieldBefore,
      shieldAfter,
      shieldAbsorbed: shieldBefore - shieldAfter,
      shieldBreakerDamage: Math.round(specialistAbsorbed),
      attackerHullDamage: Math.round(landed),
      attackerLosses,
      defenderLosses,
    });
  }

  // Salvage is the host's guns only — a wave holds none.
  const defenceSalvage: Fleet = {};
  for (const id of ALL_HULLS) {
    if (!HULLS[id].ground) continue;
    const lost = (dStarts[0]![id] ?? 0) - (dLive[0]![id] ?? 0);
    const back = Math.floor(lost * COMBAT.defenceSalvage);
    if (back > 0) defenceSalvage[id] = back;
  }

  const D = mergedFleet(dLive);
  const defStart = mergedFleet(dStarts);
  const lossRatio = defValueBefore > 0 ? 1 - fleetValue(D) / defValueBefore : 1;
  const grade: Grade =
    fleetCount(D) === 0 && (defValueBefore === 0 || shieldLeft <= 0)
      ? 'DECISIVE'
      : lossRatio >= COMBAT.partialThreshold
        ? 'PARTIAL'
        : 'REPELLED';

  const atkStart = mergedFleet(starts);
  const attackerSurvivors = mergedFleet(live);
  const attackerLosses = fleetDiff(atkStart, attackerSurvivors);
  const defenderLosses = fleetDiff(defStart, D);

  const survivorDamage = attackerSurvivorDamage(stacks, live, stats, wounded, carryA, precise);
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
      survivorDamage: survivorDamage[i]!,
    };
  });

  const defenderSurvivorDamage = stackSurvivorDamage(dIds, dLive, dStats, dWounded, carryD, precise)
    .map((lots) => lots.filter((lot) => !HULLS[lot.hull].ground));
  const salvageValue = fleetValue(defenceSalvage);
  const outcomes = defenders.map((stack, j) => {
    const losses = fleetDiff(dStarts[j]!, dLive[j]!);
    const lossValue = j === 0 ? Math.max(0, fleetValue(losses) - salvageValue) : fleetValue(losses);
    return {
      stackId: stack.stackId,
      playerId: stack.playerId,
      sent: dStarts[j]!,
      survivors: dLive[j]!,
      losses,
      lossValue,
      survivorDamage: defenderSurvivorDamage[j]!,
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
    defenderLossValue: Math.max(0, fleetValue(defenderLosses) - salvageValue),
    defenceSalvage,
    attackerDamage: combatLots(attackerSurvivors, survivorDamage.flat(), precise),
    defenderDamage: combatLots(D, defenderSurvivorDamage.flat(), precise),
    contributions,
    defenders: outcomes,
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
