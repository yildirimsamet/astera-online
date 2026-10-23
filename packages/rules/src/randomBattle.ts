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

interface Ship {
  hull: HullId;
  owner: number;
  hp: number;
  maxHp: number;
  shield: number;
  attack: number;
  canFire: boolean;
  retreated: boolean;
  arrival: HpDamageLot;
  arrivalHp: number;
}
const add = (fleet: Fleet, hull: HullId, n = 1) => { fleet[hull] = (fleet[hull] ?? 0) + n; };
const fleetOf = (ships: readonly Ship[], include: (ship: Ship) => boolean): Fleet => {
  const fleet: Fleet = {};
  for (const ship of ships) if (include(ship)) add(fleet, ship.hull);
  return fleet;
};
const alive = (ship: Ship) => ship.hp > 0;
const active = (ship: Ship) => alive(ship) && !ship.retreated;
const firing = (ship: Ship) => active(ship) && ship.canFire && ship.attack > 0;
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

function shuffle(items: Ship[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

/** Predict only this volley's kills. Both real populations retain their entry firing rights. */
function volley(from: readonly Ship[], to: readonly Ship[], roll: number, rng: Rng, aegis: number, owners: number) {
  const hp = to.map(ship => ship.hp), shields = to.map(ship => ship.shield);
  const combat: number[] = [], cargo: number[] = [];
  for (let i = 0; i < to.length; i++) if (active(to[i]!)) (HULLS[to[i]!.hull].cls === 'SUPPORT' ? cargo : combat).push(i);
  const shooters = from.filter(firing);
  shuffle(shooters, rng);
  let incoming = 0, personal = 0, hullDamage = 0, specialistAbsorbed = 0, normalAbsorbed = 0;
  const credited = Array.from({ length: owners }, () => 0);
  for (const ship of shooters) {
    const pool = combat.length > 0 ? combat : cargo;
    if (pool.length === 0) break;
    const slot = Math.floor(rng() * pool.length), index = pool[slot]!, target = to[index]!;
    let damage = ship.attack * roll * counterMult(HULLS[ship.hull].cls, HULLS[target.hull].cls);
    incoming += damage;
    if (ship.hull === 'NULLIFIER') {
      const bonus = Math.min(aegis, damage * SHIELD_BREAKER.bonusShieldDamageMult);
      aegis -= bonus;
      specialistAbsorbed += bonus;
    }
    const absorbed = Math.min(aegis, damage);
    aegis -= absorbed;
    damage -= absorbed;
    normalAbsorbed += absorbed;
    const ownAbsorbed = Math.min(shields[index]!, damage);
    shields[index]! -= ownAbsorbed;
    damage -= ownAbsorbed;
    personal += ownAbsorbed;
    hullDamage += damage;
    const landed = Math.min(hp[index]!, damage);
    credited[ship.owner]! += landed;
    hp[index] = Math.max(0, hp[index]! - damage);
    if (hp[index] === 0) {
      pool[slot] = pool[pool.length - 1]!;
      pool.pop();
    }
  }
  const losses: Fleet = {};
  for (let i = 0; i < to.length; i++) if (to[i]!.hp > 0 && hp[i] === 0) add(losses, to[i]!.hull);
  return { hp, shields, incoming, personal, hullDamage, specialistAbsorbed, normalAbsorbed, aegis, credited, losses };
}

function apply(ships: Ship[], result: ReturnType<typeof volley>): void {
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
      const damageBp = carryToBp(lost, ship.maxHp);
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
): BattleResult {
  if (stacks.length === 0 || defenders.length === 0) throw new RangeError('a battle needs both owned sides');
  if (!Number.isFinite(shield) || shield < 0) throw new RangeError('bad planet shield');
  const a = shipsOf(stacks, maintenance), d = shipsOf(defenders, maintenance);
  const starts = stacks.map(stack => ({ ...stack.fleet })), dStarts = defenders.map(stack => ({ ...stack.fleet }));
  const startA = fleetOf(a, () => true), startD = fleetOf(d, () => true);
  const policy = battleRetreatPolicy(startA, startD);
  // Separate streams keep targeting and escape rolls from consuming the fire variance stream.
  const targetRng = mulberry32(Math.floor(rng() * 0x100000000) ^ 0x4C83B12D);
  const retreatRng = mulberry32(Math.floor(rng() * 0x100000000) ^ 0x78E5CA9E);
  const credited = stacks.map(() => 0), rounds: CombatRound[] = [];
  let shieldLeft = shield, shieldProtectedArmed = 0;
  const unableToFight = maintenance && !a.some(ship => ship.canFire && COMBAT_HULLS.some(hull => hull === ship.hull));
  for (let round = 1; round <= COMBAT.rounds; round++) {
    if (!a.some(active) || !d.some(active) || (!a.some(firing) && !d.some(firing))) break;
    const attackerRoll = COMBAT.varianceMin + rng() * (COMBAT.varianceMax - COMBAT.varianceMin);
    const defenderRoll = COMBAT.varianceMin + rng() * (COMBAT.varianceMax - COMBAT.varianceMin);
    const shieldBefore = Math.round(shieldLeft);
    const outgoing = volley(a, d, attackerRoll, targetRng, shieldLeft, stacks.length);
    const incoming = volley(d, a, defenderRoll, targetRng, 0, defenders.length);
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
    if (round < 3) {
      retreat(a, policy.attacker, retreatRng);
      retreat(d, policy.defender, retreatRng);
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
    rounds.push({ round, attackerRoll, defenderRoll,
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
