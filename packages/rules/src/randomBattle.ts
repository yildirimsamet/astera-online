import { COMBAT, SHIELD_BREAKER, SHIP_DAMAGE } from './constants.js';
import { ALL_HULLS, COMBAT_HULLS, HULLS, counterMult, fleetCount, fleetDiff, fleetEntries, fleetValue } from './hulls.js';
import { carryToBp, normalizeLots } from './damage.js';
import { normalizeHpDamage, type HpDamageLot } from './radiationHp.js';
import { shipCanFight, shipHealthGroups } from './shipMaintenance.js';
import { hullTech, shipShieldHp } from './tech.js';
import { mulberry32 } from './rng.js';
import { battleRetreatPolicy, type RetreatWindow } from './battleRetreat.js';
import type { Fleet, HullId, Rng } from './types.js';
import type { BattleResult, CombatRound, CombatOwnerFleet, DefenderStack, JointAttackerStack } from './combat.js';
import type { BattleRecording, BattleShipState, RecordedAegisStrike, RecordedRound, RecordedShot } from './battleRecording.js';

/** The immutable inputs a volley needs; full battle ships also carry wound identity. */
export interface VolleyShip {
  hull: HullId;
  owner: number;
  hp: number;
  maxHp?: number;
  shield: number;
  attack: number;
  canFire: boolean;
  retreated: boolean;
}
interface Ship extends VolleyShip {
  maxHp: number;
  arrival: HpDamageLot;
  arrivalHp: number;
}
interface CaptureBudget { remaining: number; exceeded: boolean }
const add = (fleet: Fleet, hull: HullId, n = 1) => { fleet[hull] = (fleet[hull] ?? 0) + n; };
const fleetOf = (ships: readonly Ship[], include: (ship: Ship) => boolean): Fleet => {
  const fleet: Fleet = {};
  for (const ship of ships) if (include(ship)) add(fleet, ship.hull);
  return fleet;
};
const alive = (ship: VolleyShip) => ship.hp > 0;
const active = (ship: VolleyShip) => alive(ship) && !ship.retreated;
const firing = (ship: VolleyShip) => active(ship) && ship.canFire && ship.attack > 0;
const byString = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const hullOrder = new Map(ALL_HULLS.map((hull, index) => [hull, index]));
const ownerId = (stack: JointAttackerStack | DefenderStack): string => 'contributionId' in stack ? stack.contributionId : stack.stackId;

/** Physical order is independent of wave enumeration and identical-wave splitting. */
function shipsOf(stacks: readonly (JointAttackerStack | DefenderStack)[], maintenance: boolean): Ship[] {
  return stacks.flatMap((stack, owner) => shipHealthGroups(stack.fleet, stack.damage).flatMap(lot => {
    const tech = hullTech(stack.tech.tech, lot.hull), maxHp = HULLS[lot.hull].hp * tech.hp;
    const hp = maxHp * ((10000 - lot.damageBp) - (lot.remainderBp ?? 0)) / 10000;
    return Array.from({ length: lot.count }, (): Ship => ({ hull: lot.hull, owner, hp, maxHp,
      shield: stack.tech.shipShields === false ? 0 : shipShieldHp(stack.tech.tech, lot.hull),
      attack: HULLS[lot.hull].atk * tech.atk * (stack.tech.damageMult ?? 1),
      canFire: !maintenance || ('maintenanceExempt' in stack && stack.maintenanceExempt === true) || HULLS[lot.hull].ground || shipCanFight(lot),
      retreated: false, arrival: lot, arrivalHp: hp }));
  })).sort((a, b) => (hullOrder.get(a.hull) ?? 0) - (hullOrder.get(b.hull) ?? 0)
    || a.maxHp - b.maxHp || a.attack - b.attack || a.shield - b.shield || a.hp - b.hp
    || Number(a.canFire) - Number(b.canFire)
    || byString(ownerId(stacks[a.owner]!), ownerId(stacks[b.owner]!)));
}

function shuffle(items: VolleyShip[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

/** Prefer stronger counters; sample distinct members uniformly within a priority. */
function selectTargets(pool: readonly number[], multipliers: Float64Array, limit: number, rng: Rng): number[] {
  const selected: number[] = [];
  for (const multiplier of [COMBAT.strongMult, 1, COMBAT.weakMult]) {
    const candidates = pool.filter(index => multipliers[index] === multiplier);
    const count = Math.min(candidates.length, limit - selected.length);
    if (count === candidates.length) selected.push(...candidates);
    else for (let i = 0; i < count; i++) {
      const slot = i + Math.floor(rng() * (candidates.length - i));
      [candidates[i], candidates[slot]] = [candidates[slot]!, candidates[i]!];
      selected.push(candidates[i]!);
    }
    if (selected.length === limit) break;
  }
  return selected;
}

/**
 * Predict a volley without changing either population's round-entry firing rights.
 * Each shooter spreads BASE damage among at most ten distinct targets, selected
 * by counter priority and then at random within the priority. Excess returns to
 * base units and stays within the selection. SUPPORT remains covered until all
 * armed targets die and only uses remaining distinct-target slots.
 */
export function resolveVolley(from: readonly VolleyShip[], to: readonly VolleyShip[], roll: number, rng: Rng, aegis: number, owners: number,
  recording?: { fromIds: readonly string[]; toIds: readonly string[]; shots: RecordedShot[]; strikes?: RecordedAegisStrike[]; budget?: CaptureBudget }) {
  const hp = to.map(ship => ship.hp), shields = to.map(ship => ship.shield);
  const combat: number[] = [], cargo: number[] = [];
  for (let i = 0; i < to.length; i++) if (active(to[i]!)) (HULLS[to[i]!.hull].cls === 'SUPPORT' ? cargo : combat).push(i);
  // Reuse storage and class multipliers: large fleets otherwise allocate and look
  // up counters for every shooter-target pair. Target order and RNG draws stay exact.
  const weights = new Float64Array(COMBAT.targetsPerShot);
  const counters = new Map<HullId, Float64Array>();
  const shooters = from.filter(firing);
  // Restore the original global shield-opening rule. It targets Aegis, not ten
  // ships: class adjustment uses the armed line's max-HP shares (cargo only if unescorted).
  // No target/variance RNG is consumed, and all normal targeting remains unchanged.
  let specialistAbsorbed = 0;
  if (aegis > 0) {
    const line = combat.length > 0 ? combat : cargo;
    let hpWeight = 0, counterWeight = 0;
    for (const index of line) {
      const target = to[index]!, weight = target.maxHp ?? target.hp;
      hpWeight += weight;
      counterWeight += weight * counterMult(HULLS.NULLIFIER.cls, HULLS[target.hull].cls);
    }
    const classMultiplier = hpWeight > 0 ? counterWeight / hpWeight : 0;
    for (const ship of shooters) if (ship.hull === 'NULLIFIER' && aegis > 0) {
      const baseDamage = ship.attack * roll;
      const damage = Math.min(aegis, baseDamage * classMultiplier * SHIELD_BREAKER.bonusShieldDamageMult);
      const aegisBefore = aegis;
      aegis -= damage; specialistAbsorbed += damage;
      if (recording?.strikes && !recording.budget?.exceeded && damage > 0) {
        if (recording.budget?.remaining === 0) recording.budget.exceeded = true;
        else {
          recording.strikes.push({ sourceId: recording.fromIds[from.indexOf(ship)]!, baseDamage, classMultiplier,
            bonusMultiplier: SHIELD_BREAKER.bonusShieldDamageMult, damage, aegisBefore, aegisAfter: aegis });
          if (recording.budget) recording.budget.remaining--;
        }
      }
    }
  }
  shuffle(shooters, rng);
  let incoming = 0, personal = 0, hullDamage = 0, normalAbsorbed = 0;
  const credited = Array.from({ length: owners }, () => 0);
  for (const ship of shooters) {
    if (combat.length === 0 && cargo.length === 0) break;
    let multipliers = counters.get(ship.hull);
    if (!multipliers) {
      const cls = HULLS[ship.hull].cls;
      multipliers = Float64Array.from(to, target => counterMult(cls, HULLS[target.hull].cls));
      counters.set(ship.hull, multipliers);
    }
    let budget = ship.attack * roll;
    const shot: RecordedShot | undefined = recording && !recording.budget?.exceeded ? { sourceId: recording.fromIds[from.indexOf(ship)]!,
      order: recording.shots.length + 1, baseDamage: budget, unusedBaseDamage: 0, hits: [] } : undefined;
    let pool = selectTargets(combat.length > 0 ? combat : cargo, multipliers, COMBAT.targetsPerShot, rng);
    let selectedCount = pool.length;
    let pass = 0;
    while (budget > 0 && (combat.length > 0 || cargo.length > 0)) {
      if (pool.length === 0) {
        if (combat.length > 0 || selectedCount === COMBAT.targetsPerShot) break;
        pool = selectTargets(cargo, multipliers, COMBAT.targetsPerShot - selectedCount, rng);
        selectedCount += pool.length;
        if (pool.length === 0) break;
      }
      let total = 0;
      for (let slot = 0; slot < pool.length; slot++) {
        const weight = 1 - rng();
        weights[slot] = weight;
        total += weight;
      }
      let remainingShare = budget, overflow = 0, dead = false;
      for (let slot = 0; slot < pool.length; slot++) {
        const index = pool[slot]!;
        const share = slot === pool.length - 1 ? remainingShare : Math.min(remainingShare, budget * weights[slot]! / total);
        remainingShare -= share;
        const multiplier = multipliers[index]!;
        let damage = share * multiplier;
        const hpBefore = hp[index]!, shieldBefore = shields[index]!, aegisBefore = aegis;
        const absorbed = Math.min(aegis, damage);
        aegis -= absorbed;
        damage -= absorbed;
        normalAbsorbed += absorbed;
        const ownAbsorbed = Math.min(shields[index]!, damage);
        shields[index]! -= ownAbsorbed;
        damage -= ownAbsorbed;
        personal += ownAbsorbed;
        const landed = Math.min(hp[index]!, damage);
        hp[index] = Math.max(0, hp[index]! - landed);
        credited[ship.owner]! += landed;
        hullDamage += landed;
        incoming += absorbed + ownAbsorbed + landed;
        if (shot && recording) {
          if (recording.budget?.remaining === 0) recording.budget.exceeded = true;
          else {
            shot.hits.push({ targetId: recording.toIds[index]!, pass, baseShare: share, counter: multiplier,
              hpBefore, hpAfter: hp[index], shieldBefore, shieldAfter: shields[index]!, aegisBefore, aegisAfter: aegis,
              bonusAegisDamage: 0, normalAegisDamage: absorbed, shieldDamage: ownAbsorbed, hullDamage: landed });
            if (recording.budget) recording.budget.remaining--;
          }
        }
        if (hp[index] === 0) {
          dead = true;
          overflow += Math.max(0, damage - landed) / multiplier;
        }
      }
      if (dead) {
        for (const targets of [pool, combat, cargo]) {
          let kept = 0;
          for (const index of targets) if (hp[index]! > 0) targets[kept++] = index;
          targets.length = kept;
        }
      }
      // Any overflow killed a target, so each extra pass makes finite progress.
      budget = overflow;
      pass++;
    }
    if (shot && recording && !recording.budget?.exceeded) {
      shot.unusedBaseDamage = budget;
      recording.shots.push(shot);
    }
  }
  const losses: Fleet = {};
  for (let i = 0; i < to.length; i++) if (to[i]!.hp > 0 && hp[i] === 0) add(losses, to[i]!.hull);
  return { hp, shields, incoming, personal, hullDamage, specialistAbsorbed, normalAbsorbed, aegis, credited, losses };
}

function apply(ships: Ship[], result: ReturnType<typeof resolveVolley>): void {
  for (let i = 0; i < ships.length; i++) {
    ships[i]!.hp = result.hp[i]!;
    ships[i]!.shield = result.shields[i]!;
  }
}

function retreat(ships: readonly Ship[], policy: RetreatWindow, rng: Rng): void {
  for (const ship of ships) if (active(ship) && !HULLS[ship.hull].ground
    && ship.hp / ship.maxHp <= policy.threshold + 1e-12 && rng() < policy.chance) ship.retreated = true;
}

function damageOf(ships: readonly Ship[], precise: boolean): HpDamageLot[] {
  const fleet = fleetOf(ships, alive);
  const lots: HpDamageLot[] = [];
  for (const ship of ships) {
    if (!alive(ship) || HULLS[ship.hull].ground || ship.hp >= ship.maxHp) continue;
    if (precise && ship.hp === ship.arrivalHp) {
      lots.push({ ...ship.arrival, count: 1 });
      continue;
    }
    const lost = ship.maxHp - ship.hp;
    if (!precise) {
      // Positive HP can be smaller than one ulp of maxHp, making subtraction round to maxHp.
      const damageBp = lost < ship.maxHp ? carryToBp(lost, ship.maxHp) : SHIP_DAMAGE.destroyedBp - 1;
      if (damageBp > 0) lots.push({ hull: ship.hull, count: 1, damageBp });
      continue;
    }
    const exact = lost / ship.maxHp * SHIP_DAMAGE.destroyedBp;
    const damageBp = Math.min(9999, Math.floor(exact + 1e-8));
    lots.push({ hull: ship.hull, count: 1, damageBp,
      remainderBp: Math.min(1 - Number.EPSILON, Math.max(0, exact >= 10000 ? 1 : exact - damageBp)) });
  }
  return precise ? normalizeHpDamage(fleet, lots) : normalizeLots(lots);
}

export function resolveRandomBattle(
  stacks: readonly JointAttackerStack[], defenders: readonly DefenderStack[], shield: number,
  rng: Rng, precise: boolean, maintenance: boolean,
  recording?: BattleRecording,
): BattleResult {
  if (stacks.length === 0 || defenders.length === 0) throw new RangeError('a battle needs both owned sides');
  if (!Number.isFinite(shield) || shield < 0) throw new RangeError('bad planet shield');
  const a = shipsOf(stacks, maintenance), d = shipsOf(defenders, maintenance);
  const aIds = a.map((_, i) => `A${i}`), dIds = d.map((_, i) => `D${i}`);
  const state = (ship: Ship, id: string): BattleShipState => ({ id, hp: ship.hp, shield: ship.shield,
    status: !alive(ship) ? 'DESTROYED' : ship.retreated ? 'RETREATED' : 'ACTIVE' });
  if (recording) {
    if (recording.ships.length > 0 || recording.rounds.length > 0) throw new RangeError('use a fresh battle recording');
    recording.initialAegis = shield;
    for (const [side, ships, ids, owners] of [['ATTACK', a, aIds, stacks], ['DEFENCE', d, dIds, defenders]] as const) {
      for (let i = 0; i < ships.length; i++) {
        const ship = ships[i]!, owner = owners[ship.owner]!;
        recording.ships.push({ ...state(ship, ids[i]!), side, hull: ship.hull, playerId: owner.playerId, stackId: ownerId(owner),
          maxHp: ship.maxHp, maxShield: ship.shield, attack: ship.attack, canFire: ship.canFire && ship.attack > 0,
          cls: HULLS[ship.hull].cls, ground: HULLS[ship.hull].ground });
      }
    }
  }
  const starts = stacks.map(stack => ({ ...stack.fleet })), dStarts = defenders.map(stack => ({ ...stack.fleet }));
  const startA = fleetOf(a, () => true), startD = fleetOf(d, () => true);
  const policy = battleRetreatPolicy(startA, startD);
  // Separate streams keep targeting and escape rolls from consuming the fire variance stream.
  const targetRng = mulberry32(Math.floor(rng() * 0x100000000) ^ 0x4C83B12D);
  const retreatRng = mulberry32(Math.floor(rng() * 0x100000000) ^ 0x78E5CA9E);
  const credited = stacks.map(() => 0), rounds: CombatRound[] = [];
  const captureBudget: CaptureBudget | undefined = recording?.hitLimit === undefined ? undefined : { remaining: recording.hitLimit, exceeded: false };
  let shieldLeft = shield, shieldProtectedArmed = 0;
  const unableToFight = maintenance && !a.some(ship => ship.canFire && COMBAT_HULLS.some(hull => hull === ship.hull));
  for (let round = 1; round <= COMBAT.rounds; round++) {
    if (!a.some(active) || !d.some(active) || (!a.some(firing) && !d.some(firing))) break;
    const attackerRoll = COMBAT.varianceMin + rng() * (COMBAT.varianceMax - COMBAT.varianceMin);
    const defenderRoll = COMBAT.varianceMin + rng() * (COMBAT.varianceMax - COMBAT.varianceMin);
    const shieldBefore = Math.round(shieldLeft);
    const turn: RecordedRound | undefined = recording && !recording.truncated ? { round, attackerRoll, defenderRoll, aegisBefore: shieldLeft,
      aegisAfter: shieldLeft, aegisStrikes: [], attackerShots: [], defenderShots: [], retreated: [], after: [] } : undefined;
    const outgoing = resolveVolley(a, d, attackerRoll, targetRng, shieldLeft, stacks.length,
      turn ? { fromIds: aIds, toIds: dIds, shots: turn.attackerShots, strikes: turn.aegisStrikes, budget: captureBudget } : undefined);
    const incoming = resolveVolley(d, a, defenderRoll, targetRng, 0, defenders.length,
      turn ? { fromIds: dIds, toIds: aIds, shots: turn.defenderShots, budget: captureBudget } : undefined);
    if (d.some(firing)) shieldProtectedArmed += outgoing.normalAbsorbed;
    shieldLeft = outgoing.aegis;
    for (let i = 0; i < credited.length; i++) credited[i]! += outgoing.credited[i]!;
    const casualties: CombatOwnerFleet[] = [];
    for (const [side, ships, hits, owners] of [['ATTACK', a, incoming, stacks], ['DEFENCE', d, outgoing, defenders]] as const) {
      const dead = owners.map((): Fleet => ({}));
      for (let j = 0; j < ships.length; j++) {
        const ship = ships[j]!;
        if (ship.hp > 0 && hits.hp[j] === 0) add(dead[ship.owner]!, ship.hull);
      }
      for (let i = 0; i < owners.length; i++) if (fleetCount(dead[i]!) > 0) {
        const owner = owners[i]!;
        casualties.push({ side, playerId: owner.playerId, stackId: ownerId(owner), fleet: dead[i]! });
      }
    }
    apply(a, incoming);
    apply(d, outgoing);
    const beforeA = a.map(ship => ship.retreated), beforeD = d.map(ship => ship.retreated);
    if (round < COMBAT.rounds) {
      retreat(a, policy.attacker, retreatRng);
      retreat(d, policy.defender, retreatRng);
    }
    if (recording && captureBudget?.exceeded) { recording.truncated = true; recording.rounds.length = 0; }
    if (turn && recording && !recording.truncated) {
      turn.aegisAfter = shieldLeft;
      turn.after = [...a.map((ship, i) => state(ship, aIds[i]!)), ...d.map((ship, i) => state(ship, dIds[i]!))];
      turn.retreated = [...a.filter((ship, i) => ship.retreated && !beforeA[i]).map(ship => aIds[a.indexOf(ship)]!),
        ...d.filter((ship, i) => ship.retreated && !beforeD[i]).map(ship => dIds[d.indexOf(ship)]!)];
      recording.rounds.push(turn);
    }
    const retreats: CombatOwnerFleet[] = [];
    for (const [side, ships, before, owners] of [['ATTACK', a, beforeA, stacks], ['DEFENCE', d, beforeD, defenders]] as const) {
      const escaped = owners.map((): Fleet => ({}));
      for (let j = 0; j < ships.length; j++) {
        const ship = ships[j]!;
        if (ship.retreated && !before[j]) add(escaped[ship.owner]!, ship.hull);
      }
      for (let i = 0; i < owners.length; i++) {
        const fleet = escaped[i]!;
        if (fleetCount(fleet) === 0) continue;
        const owner = owners[i]!;
        retreats.push({ side, playerId: owner.playerId, stackId: 'contributionId' in owner ? owner.contributionId : owner.stackId, fleet });
      }
    }
    rounds.push({ round, distributedFire: true, targetLimit: COMBAT.targetsPerShot, attackerRoll, defenderRoll,
      attackerDamage: Math.round(outgoing.incoming), defenderDamage: Math.round(incoming.incoming),
      shieldBefore, shieldAfter: Math.round(shieldLeft), shieldAbsorbed: shieldBefore - Math.round(shieldLeft),
      shieldBreakerDamage: Math.round(outgoing.specialistAbsorbed),
      attackerShipShieldAbsorbed: Math.round(incoming.personal), defenderShipShieldAbsorbed: Math.round(outgoing.personal),
      attackerHullDamage: Math.round(outgoing.hullDamage), attackerLosses: incoming.losses, defenderLosses: outgoing.losses,
      retreats, casualties });
  }
  const attackerSurvivors = fleetOf(a, alive), defenderSurvivors = fleetOf(d, alive);
  const attackerRetreated = fleetOf(a, ship => ship.retreated), defenderRetreated = fleetOf(d, ship => ship.retreated);
  const attackerLosses = fleetDiff(startA, attackerSurvivors), defenderLosses = fleetDiff(startD, defenderSurvivors);
  const defenceSalvage: Fleet = {};
  for (const [hull, count] of fleetEntries(defenderLosses)) if (HULLS[hull].ground) {
    const back = Math.floor(count * COMBAT.defenceSalvage);
    if (back > 0) defenceSalvage[hull] = back;
  }
  const defenderActive = fleetOf(d, active), before = fleetValue(startD);
  const lossRatio = before > 0 ? 1 - fleetValue(defenderActive) / before : unableToFight ? 0 : 1;
  const grade = unableToFight ? 'REPELLED' : fleetCount(defenderActive) === 0 && (before === 0 || shieldLeft <= 0)
    ? 'DECISIVE' : lossRatio >= COMBAT.partialThreshold ? 'PARTIAL' : 'REPELLED';
  // Per-shot floating sums may exceed the entry charge by an ulp; Honor validates this physical budget strictly.
  return { grade, lossRatio, rounds, shieldLeft: Math.max(0, Math.round(shieldLeft)),
    shieldProtectedArmed: Math.min(shield, shieldProtectedArmed),
    attackerSurvivors, defenderSurvivors, attackerRetreated, defenderRetreated,
    attackerCombatSurvivors: fleetOf(a, firing),
    attackerRetreatDamage: damageOf(a.filter(ship => ship.retreated), precise),
    defenderRetreatDamage: damageOf(d.filter(ship => ship.retreated), precise),
    attackerLosses, defenderLosses, attackerLossValue: fleetValue(attackerLosses),
    defenderLossValue: Math.max(0, fleetValue(defenderLosses) - fleetValue(defenceSalvage)), defenceSalvage,
    attackerDamage: damageOf(a, precise), defenderDamage: damageOf(d, precise),
    contributions: stacks.map((stack, i) => {
      const own = a.filter(ship => ship.owner === i), survivors = fleetOf(own, alive), losses = fleetDiff(starts[i]!, survivors);
      return { contributionId: stack.contributionId, playerId: stack.playerId, sent: starts[i]!, survivors,
        retreated: fleetOf(own, ship => ship.retreated), losses, lossValue: fleetValue(losses),
        hullDamage: credited[i]!, survivorDamage: damageOf(own, precise) };
    }),
    defenders: defenders.map((stack, i) => {
      const own = d.filter(ship => ship.owner === i), survivors = fleetOf(own, alive), losses = fleetDiff(dStarts[i]!, survivors);
      return { stackId: stack.stackId, playerId: stack.playerId, sent: dStarts[i]!, survivors,
        retreated: fleetOf(own, ship => ship.retreated), losses,
        lossValue: Math.max(0, fleetValue(losses) - (i === 0 ? fleetValue(defenceSalvage) : 0)),
        survivorDamage: damageOf(own, precise) };
    }) };
}
