/** Candidate model only: optional non-regenerating shields; random targets per shot. */
import {
  ALL_HULLS, COMBAT, HULLS, counterMult, hullTech, monumentBattleControl, mulberry32,
  shipCanFight, shipHealthGroups, shipShieldMult,
} from '../packages/rules/src/index.ts';
import { retreatProbabilities, adaptiveRetreatPolicy } from './monument-escape-policy.mjs';

function shipsOf(fleet, damage, tech, shieldFraction, shieldResearch) {
  return shipHealthGroups(fleet, damage).flatMap(lot => {
    const hull = HULLS[lot.hull], factors = hullTech(tech, lot.hull);
    const maxHp = hull.hp * factors.hp;
    const hp = maxHp * ((10000 - lot.damageBp) - (lot.remainderBp ?? 0)) / 10000;
    const maxShield = hull.ground ? 0 : maxHp * shieldFraction * (shieldResearch ? shipShieldMult(tech) : 1);
    return Array.from({ length: lot.count }, () => ({ hull: lot.hull, hp, maxHp, shield: maxShield, maxShield,
      atk: hull.atk * factors.atk, canFire: shipCanFight(lot), fled: false }));
  });
}
const living = ships => ships.filter(ship => ship.hp > 0 && !ship.fled);
function targetIndices(ships) {
  const live = ships.map((ship, index) => ({ ship, index })).filter(row => row.ship.hp > 0 && !row.ship.fled);
  const covered = live.some(row => HULLS[row.ship.hull].cls !== 'SUPPORT');
  return live.filter(row => !covered || HULLS[row.ship.hull].cls !== 'SUPPORT').map(row => row.index);
}
function shots(from, to, targets, roll, rng) {
  const damage = new Float64Array(to.length);
  let count = 0;
  if (targets.length === 0) return { damage, count };
  for (const ship of from) {
    if (ship.hp <= 0 || ship.fled || !ship.canFire || ship.atk === 0) continue;
    const index = targets[Math.floor(rng() * targets.length)];
    damage[index] += ship.atk * roll * counterMult(HULLS[ship.hull].cls, HULLS[to[index].hull].cls);
    count++;
  }
  return { damage, count };
}
function liveShots(from, to, roll, rng) {
  const damage = new Float64Array(to.length), combat = [], cargo = [];
  for (let index = 0; index < to.length; index++) {
    const ship = to[index];
    if (ship.hp > 0 && !ship.fled) (HULLS[ship.hull].cls === 'SUPPORT' ? cargo : combat).push(index);
  }
  const shooters = from.filter(ship => ship.hp > 0 && !ship.fled && ship.canFire && ship.atk > 0);
  for (let i = shooters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shooters[i], shooters[j]] = [shooters[j], shooters[i]];
  }
  let count = 0;
  // Only this side's predicted damage changes targeting. Real HP stays untouched until BOTH sides fire.
  for (const ship of shooters) {
    const pool = combat.length ? combat : cargo;
    if (pool.length === 0) break;
    const slot = Math.floor(rng() * pool.length), index = pool[slot];
    damage[index] += ship.atk * roll * counterMult(HULLS[ship.hull].cls, HULLS[to[index].hull].cls);
    count++;
    if (damage[index] >= to[index].hp + to[index].shield) {
      pool[slot] = pool[pool.length - 1];
      pool.pop();
    }
  }
  return { damage, count, firstHull: shooters[0]?.hull };
}
const fleetOf = (ships, eligibleOnly = false) => {
  const fleet = {};
  for (const ship of ships) if (ship.hp > 0 && !ship.fled && (!eligibleOnly || ship.canFire)) fleet[ship.hull] = (fleet[ship.hull] ?? 0) + 1;
  return fleet;
};
function resultSide(ships) {
  const active = living(ships), escaped = ships.filter(ship => ship.fled);
  const lot = ship => ({ hull: ship.hull, count: 1, hpLeft: ship.hp, maxHp: ship.maxHp });
  return { sent: ships.length, active: active.length, fled: escaped.length,
    physical: active.length + escaped.length, dead: ships.length - active.length - escaped.length,
    damage: escaped.map(lot), activeDamage: active.filter(ship => ship.hp < ship.maxHp).map(lot),
    armed: {
      sent: ships.filter(ship => ship.atk > 0).length,
      active: active.filter(ship => ship.atk > 0).length,
      fled: escaped.filter(ship => ship.atk > 0).length,
      physical: active.filter(ship => ship.atk > 0).length + escaped.filter(ship => ship.atk > 0).length,
      dead: ships.filter(ship => ship.atk > 0 && ship.hp <= 0).length,
    } };
}

export function simulateRandomBattle(input, config, seed) {
  const shieldFraction = config.shieldFraction ?? 0;
  const a = shipsOf(input.attacker, input.attackerDamage, input.attackerTech ?? {}, shieldFraction, config.shieldResearch);
  const d = shipsOf(input.defender, input.defenderDamage, input.defenderTech ?? {}, shieldFraction, config.shieldResearch);
  // Optional ticket labeling for exact seeded cross-engine comparisons. Original
  // study ordering remains the default; uniform targeting physics is unchanged.
  if (config.canonicalOrder) for (const ships of [a, d]) ships.sort((left, right) =>
    ALL_HULLS.indexOf(left.hull) - ALL_HULLS.indexOf(right.hull) || left.hp - right.hp);
  const fireRng = mulberry32(seed), targetRng = mulberry32(seed ^ 0x4C83B12D);
  const retreatRng = mulberry32(seed ^ 0x78E5CA9E);
  const threshold = config.threshold ?? 0.3, chance = config.chance ?? 0;
  const probabilities = config.escapePolicy === 'ratio' ? retreatProbabilities(input.attacker, input.defender)
    : { attacker: chance, defender: chance };
  const escapeWindows = ['adaptive', 'adaptive-v2'].includes(config.escapePolicy)
    ? adaptiveRetreatPolicy(input.attacker, input.defender, { revised: config.escapePolicy === 'adaptive-v2' })
    : { attacker: { chance: probabilities.attacker, threshold }, defender: { chance: probabilities.defender, threshold } };
  const trace = [];
  let rounds = 0;
  for (let r = 0; r < config.rounds; r++) {
    if (living(a).length === 0 || living(d).length === 0) break;
    if (config.targeting === 'random_live' && ![...a, ...d].some(ship => ship.hp > 0 && !ship.fled && ship.canFire && ship.atk > 0)) break;
    const span = COMBAT.varianceMax - COMBAT.varianceMin;
    const aRoll = COMBAT.varianceMin + fireRng() * span, dRoll = COMBAT.varianceMin + fireRng() * span;
    // Freeze target sets and fire BEFORE either side takes damage; within-round overkill is lost.
    const toD = config.targeting === 'random_live' ? liveShots(a, d, aRoll, targetRng) : shots(a, d, targetIndices(d), aRoll, targetRng);
    const toA = config.targeting === 'random_live' ? liveShots(d, a, dRoll, targetRng) : shots(d, a, targetIndices(a), dRoll, targetRng);
    for (const [ships, incoming] of [[a, toA.damage], [d, toD.damage]]) {
      for (let i = 0; i < ships.length; i++) {
        const absorbed = Math.min(ships[i].shield, incoming[i]);
        ships[i].shield -= absorbed;
        ships[i].hp = Math.max(0, ships[i].hp - (incoming[i] - absorbed));
      }
    }
    if (r < 2) for (const [ships, window] of [[a, escapeWindows.attacker], [d, escapeWindows.defender]]) {
      if (window.chance === 0) continue;
      for (const ship of ships) if (ship.hp > 0 && !ship.fled && !HULLS[ship.hull].ground
        && ship.hp / ship.maxHp <= window.threshold + 1e-12 && retreatRng() < window.chance) ship.fled = true;
    }
    rounds++;
    if (config.trace) trace.push({ round: r + 1, aShots: toD.count, dShots: toA.count,
      aFirstShooter: toD.firstHull, dFirstShooter: toA.firstHull,
      aHp: a.map(ship => ship.hp), dHp: d.map(ship => ship.hp),
      ...(shieldFraction > 0 ? { aShield: a.map(ship => ship.shield), dShield: d.map(ship => ship.shield),
        aMaxShield: a.map(ship => ship.maxShield), dMaxShield: d.map(ship => ship.maxShield) } : {}),
      aMaxHp: a.map(ship => ship.maxHp), dMaxHp: d.map(ship => ship.maxHp) });
  }
  return { control: monumentBattleControl(fleetOf(a, true), fleetOf(d)), rounds,
    a: resultSide(a), d: resultSide(d), ...(config.trace ? { trace } : {}) };
}
