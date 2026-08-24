import { COMBAT } from './constants.js';
import type { Fleet, GroundHullId, Hull, HullClass, HullId, MobileHullId } from './types.js';

/**
 * Four combat hulls, two turrets and a mining craft, priced on equal-budget power
 * rather than chosen for flavour. Three fill the counter cycle; the Hauler exists
 * to make looting expensive, and the two ground guns exist because they can never
 * leave — and because a defender with only one of them has no decision to make
 * (D27).
 *
 * THE WHOLE TABLE IS DERIVED FROM `atk × hp / value²` — see the Bulwark below for
 * why that quantity and not attack-per-resource. Speeds are set from one figure:
 * a raid on a neighbouring world is an 11-16 minute round trip on the R=2500 disc,
 * which is the tempo the owner chose with the numbers in front of them.
 */
export const HULLS: Record<HullId, Hull> = {
  WASP: { id: 'WASP', name: 'Wasp', cls: 'SKIRMISHER', atk: 15, hp: 25, speed: 130, cargo: 45, alloy: 240, crystal: 0, deuterium: 0, minShipyard: 0, ground: false },
  LANCE: { id: 'LANCE', name: 'Lance', cls: 'LANCE', atk: 78, hp: 112, speed: 100, cargo: 60, alloy: 820, crystal: 260, deuterium: 0, minShipyard: 2, ground: false },
  /**
   * THE BULWARK IS NOW COMPETITIVE AT EQUAL BUDGET, AND THAT IS THE CHANGE.
   *
   * `docs/balance.md` recorded a known problem it declined to fix: the Bulwark had
   * 4.2 attack per 1,000 resources against a Wasp's 26.9, so at equal budget it
   * lost every matchup in the game INCLUDING against the Lance it counters. Raising
   * its attack alone was measured across the whole range and handed the season to
   * whoever accumulated most — a subsidy to the largest stockpile, which is the
   * wealth-ladder failure arriving through a hull stat.
   *
   * THE FIX IS TO PRICE THE WHOLE TABLE ON THE RIGHT QUANTITY. With damage spread
   * across a force, equal-budget power goes as `atk × hp / value²`, not as attack
   * per resource. Holding that near-constant makes an expensive hull worth building
   * without subsidising anybody:
   *
   *   Wasp 6,510   ·   Lance 7,490   ·   Bulwark 8,460      (×10⁶)
   *
   * so each tech tier buys about 15% equal-budget power. THE COUNTER CYCLE BUYS
   * 156% (1.6 against 0.625), which is the point: information beats tech by
   * construction, and that is the claim the whole game rests on.
   */
  BULWARK: { id: 'BULWARK', name: 'Bulwark', cls: 'BULWARK', atk: 106, hp: 662, speed: 65, cargo: 90, alloy: 2150, crystal: 730, deuterium: 0, minShipyard: 4, ground: false },
  HAULER: { id: 'HAULER', name: 'Hauler', cls: 'SUPPORT', atk: 0, hp: 210, speed: 85, cargo: 2200, alloy: 1100, crystal: 200, deuterium: 0, minShipyard: 1, ground: false },
  /** Fast, expensive capacity. It shortens exposure; it never replaces a Hauler. D94. */
  RUNNER: { id: 'RUNNER', name: 'Runner', cls: 'SUPPORT', atk: 0, hp: 120, speed: 125, cargo: 380, alloy: 560, crystal: 250, deuterium: 90, minShipyard: 2, ground: false },
  /** Shield specialist. Its extra damage is resolved only against a live shield. D95. */
  BREACHER: { id: 'BREACHER', name: 'Breacher', cls: 'LANCE', atk: 55, hp: 300, speed: 78, cargo: 0, alloy: 1250, crystal: 550, deuterium: 200, minShipyard: 3, ground: false },
  /**
   * THE HEAVY GUN. Bulwark-class, so a swarm of Wasps overwhelms it and a Lance
   * breaks against it. Expensive, slow to accumulate, and what a planet buys when
   * it expects to be hit by something serious.
   */
  BASTION: { id: 'BASTION', name: 'Bastion', cls: 'BULWARK', atk: 118, hp: 906, speed: 0, cargo: 0, alloy: 2400, crystal: 800, deuterium: 0, minShipyard: 1, ground: true },
  /**
   * THE LIGHT GUN. D27. Skirmisher-class, so it tears into heavy hulls and is
   * picked apart by Lances — the exact inverse of the Bastion, which is its whole
   * reason to exist.
   *
   * Buildable from the first minute (`minShipyard: 0`) on purpose: a new commander
   * has no other way to defend anything, and `ABUSE.tierBand` is all that stands
   * between them and a developed neighbour.
   *
   * BOTH GROUND HULLS ARE PRICED AT 1.6× EQUAL-BUDGET POWER, and that multiplier is
   * what they are paid for never leaving: they cannot loot, cannot take Dominion,
   * and cannot be part of a decision made anywhere but at home. The two sit in
   * OPPOSITE CLASSES so that "how much defence" becomes "what KIND" — a question
   * only the information layer can answer.
   */
  THORN: { id: 'THORN', name: 'Thorn', cls: 'SKIRMISHER', atk: 49, hp: 174, speed: 0, cargo: 0, alloy: 700, crystal: 200, deuterium: 0, minShipyard: 0, ground: true },
  /**
   * The mining craft. D19.
   *
   * `speed` and `cargo` here are its NOMINAL figures — what it does with no Derrick
   * — and they exist so a ship card has something honest to print. The live values
   * come from `prospectorSpeed()` and `prospectorHold()`, because a Derrick lifts
   * every craft the player already owns. `speed` MUST equal `PROSPECTOR.speed`.
   *
   * SUPPORT class, so it is shielded while any combat hull on its side survives and
   * is prey to everything once they are gone. A Prospector sitting at home when a
   * raid lands is lost with the rest of the garrison — mining is not free money, it
   * is capital parked outdoors.
   */
  PROSPECTOR: { id: 'PROSPECTOR', name: 'Prospector', cls: 'SUPPORT', atk: 0, hp: 150, speed: 825, cargo: 1800, alloy: 650, crystal: 200, deuterium: 0, minShipyard: 1, ground: false },
};

/** What may be put in an attack fleet. A Prospector is deliberately not here. */
export const MOBILE_HULLS: readonly MobileHullId[] = [
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER',
];
export const ALL_HULLS: readonly HullId[] = [
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER',
  'BASTION', 'THORN', 'PROSPECTOR',
];

/** Every gun that never leaves the ground. Derived, so a third would be picked up. */
export const GROUND_HULLS: readonly GroundHullId[] = ALL_HULLS.filter(
  (id): id is GroundHullId => HULLS[id].ground,
);

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
  if (BEATS[defender] === attacker) return COMBAT.weakMult;
  return 1;
}

export const countOf = (fleet: Fleet, hull: HullId): number => fleet[hull] ?? 0;

export function fleetEntries(fleet: Fleet): [HullId, number][] {
  const out: [HullId, number][] = [];
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
    v += n * (h.alloy + h.crystal + h.deuterium);
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
