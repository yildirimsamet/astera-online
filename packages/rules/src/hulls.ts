import { COMBAT } from './constants.js';
import type { Fleet, Hull, HullClass, HullId, MobileHullId } from './types.js';

/**
 * Four hulls and one turret, derived from the combat formula rather than chosen
 * for flavour. Three fill the counter cycle; the Hauler exists to make looting
 * expensive, and the Bastion exists because it can never leave.
 */
export const HULLS: Record<HullId, Hull> = {
  WASP: { id: 'WASP', name: 'Wasp', cls: 'SKIRMISHER', atk: 14, hp: 24, speed: 46, cargo: 40, alloy: 260, crystal: 0, minShipyard: 0, ground: false },
  LANCE: { id: 'LANCE', name: 'Lance', cls: 'LANCE', atk: 46, hp: 62, speed: 34, cargo: 50, alloy: 950, crystal: 190, minShipyard: 2, ground: false },
  BULWARK: { id: 'BULWARK', name: 'Bulwark', cls: 'BULWARK', atk: 26, hp: 210, speed: 21, cargo: 70, alloy: 2500, crystal: 620, minShipyard: 4, ground: false },
  HAULER: { id: 'HAULER', name: 'Hauler', cls: 'SUPPORT', atk: 0, hp: 80, speed: 30, cargo: 900, alloy: 1150, crystal: 130, minShipyard: 1, ground: false },
  BASTION: { id: 'BASTION', name: 'Bastion', cls: 'BULWARK', atk: 34, hp: 260, speed: 0, cargo: 0, alloy: 1700, crystal: 380, minShipyard: 1, ground: true },
};

export const MOBILE_HULLS: readonly MobileHullId[] = ['WASP', 'LANCE', 'BULWARK', 'HAULER'];
export const ALL_HULLS: readonly HullId[] = ['WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION'];

/** WASP ▸ BULWARK ▸ LANCE ▸ WASP. Support is prey to everything and deals nothing. */
const BEATS: Record<Exclude<HullClass, 'SUPPORT'>, HullClass> = {
  SKIRMISHER: 'BULWARK',
  BULWARK: 'LANCE',
  LANCE: 'SKIRMISHER',
};

export function counterMult(attacker: HullClass, defender: HullClass): number {
  if (attacker === 'SUPPORT') return 0;
  if (defender === 'SUPPORT') return COMBAT.strongMult;
  if (BEATS[attacker] === defender) return COMBAT.strongMult;
  if (BEATS[defender as Exclude<HullClass, 'SUPPORT'>] === attacker) return COMBAT.weakMult;
  return 1;
}

export const countOf = (fleet: Fleet, hull: HullId): number => fleet[hull] ?? 0;

export function fleetEntries(fleet: Fleet): Array<[HullId, number]> {
  const out: Array<[HullId, number]> = [];
  for (const id of ALL_HULLS) {
    const n = fleet[id] ?? 0;
    if (n > 0) out.push([id, n]);
  }
  return out;
}

export function fleetCount(fleet: Fleet): number {
  let n = 0;
  for (const [, c] of fleetEntries(fleet)) n += c;
  return n;
}

/** Resources sunk into these units. This is what grades a battle and feeds Dominion. */
export function fleetValue(fleet: Fleet): number {
  let v = 0;
  for (const [id, n] of fleetEntries(fleet)) {
    const h = HULLS[id];
    v += n * (h.alloy + h.crystal);
  }
  return v;
}

/**
 * Rough combat heft. ADVISORY ONLY — it ignores the counter matrix, so 26 Wasps
 * and 1 Bastion read as near-equal while one annihilates the other. Never grade
 * an outcome with this; grading uses fleetValue.
 */
export function fleetPower(fleet: Fleet): number {
  let p = 0;
  for (const [id, n] of fleetEntries(fleet)) {
    const h = HULLS[id];
    p += n * h.atk * h.hp;
  }
  return p / 1000;
}

export function fleetHp(fleet: Fleet): number {
  let hp = 0;
  for (const [id, n] of fleetEntries(fleet)) hp += n * HULLS[id].hp;
  return hp;
}

/** A fleet travels at the speed of its slowest ship. Zero if it cannot travel. */
export function fleetSpeed(fleet: Fleet): number {
  let s = Infinity;
  for (const id of MOBILE_HULLS) {
    if ((fleet[id] ?? 0) > 0) s = Math.min(s, HULLS[id].speed);
  }
  return Number.isFinite(s) ? s : 0;
}

export function fleetCargo(fleet: Fleet): number {
  let c = 0;
  for (const id of MOBILE_HULLS) c += (fleet[id] ?? 0) * HULLS[id].cargo;
  return c;
}

/** Units in `before` that are missing from `after`. */
export function fleetDiff(before: Fleet, after: Fleet): Fleet {
  const d: Fleet = {};
  for (const id of ALL_HULLS) {
    const n = (before[id] ?? 0) - (after[id] ?? 0);
    if (n > 0) d[id] = n;
  }
  return d;
}
