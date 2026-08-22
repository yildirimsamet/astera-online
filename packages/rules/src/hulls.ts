import { COMBAT } from './constants.js';
import type { Fleet, GroundHullId, Hull, HullClass, HullId, MobileHullId } from './types.js';

/**
 * Four hulls and two turrets, derived from the combat formula rather than chosen
 * for flavour. Three fill the counter cycle; the Hauler exists to make looting
 * expensive, and the two ground guns exist because they can never leave — and
 * because a defender with only one of them has no decision to make (D27).
 */
export const HULLS: Record<HullId, Hull> = {
  WASP: { id: 'WASP', name: 'Wasp', cls: 'SKIRMISHER', atk: 14, hp: 24, speed: 435, cargo: 40, alloy: 260, crystal: 0, minShipyard: 0, ground: false },
  LANCE: { id: 'LANCE', name: 'Lance', cls: 'LANCE', atk: 46, hp: 62, speed: 322, cargo: 50, alloy: 950, crystal: 190, minShipyard: 2, ground: false },
  /**
   * ATTACK DELIBERATELY LEFT AT 26, AND THAT IS A MEASURED DECISION. D27.
   *
   * It is true and easily reproduced that a Bulwark loses every equal-budget
   * matchup in the game, including against the Lance it counters — 4.2 attack per
   * 1,000 resources against a Wasp's 26.9, a gap no 1.6x counter can cover. The
   * obvious repair is to raise the number, and it was tried across the whole range.
   *
   * IT HANDS THE SEASON TO WHOEVER ACCUMULATES MOST. Measured on five seeds at 50
   * players, with everything else held: at 26 the informed archetype tops the
   * ladder 5/5; at 32 it drops to 2/5; at 52 it is 0/5 and the board reads
   * RAIDER RAIDER RAIDER RAIDER TURTLE. Buffing the dearest hull in the game is a
   * subsidy to the player with the largest stockpile, which is the wealth-ladder
   * failure `docs/balance.md` exists to prevent, arriving through a hull stat
   * instead of through a score.
   *
   * SO THE BULWARK IS NOT AN EXCHANGE HULL. Its 210 hit points are what it sells:
   * it survives to carry loot home and to raid again, and `fleetValue` exchange
   * ratios cannot see that. Read the low attack as the price of the durability,
   * not as a bug awaiting a fix.
   */
  BULWARK: { id: 'BULWARK', name: 'Bulwark', cls: 'BULWARK', atk: 26, hp: 210, speed: 199, cargo: 70, alloy: 2500, crystal: 620, minShipyard: 4, ground: false },
  HAULER: { id: 'HAULER', name: 'Hauler', cls: 'SUPPORT', atk: 0, hp: 80, speed: 284, cargo: 1800, alloy: 1150, crystal: 130, minShipyard: 1, ground: false },
  /**
   * THE HEAVY GUN. Bulwark-class, so a swarm of Wasps overwhelms it and a Lance
   * breaks against it. Expensive, slow to accumulate, and what a planet buys when
   * it expects to be hit by something serious.
   */
  BASTION: { id: 'BASTION', name: 'Bastion', cls: 'BULWARK', atk: 34, hp: 260, speed: 0, cargo: 0, alloy: 1700, crystal: 380, minShipyard: 1, ground: true },
  /**
   * THE LIGHT GUN. D27. Skirmisher-class, so it tears into heavy hulls and is
   * picked apart by Lances — the exact inverse of the Bastion, which is its whole
   * reason to exist.
   *
   * Buildable from the first minute (`minShipyard: 0`) on purpose: a new commander
   * has no way to defend anything at all today, and `ABUSE.tierBand` is the only
   * thing standing between them and a developed neighbour. A gun a beginner can
   * actually afford is a decision they can actually make.
   *
   * THE PRICE IS THE WHOLE BALANCE, and it was swept rather than chosen. Ground
   * defence that works makes raiding less profitable, so the question is only how
   * much. Measured across five seeds at 50 players, holding the stats and moving
   * the price alone:
   *
   *     920  -> RR 0.96   raiding is net-negative; the loop stops paying
   *   1,380  -> RR 1.21   still under the 1.30 floor
   *   1,840  -> RR 1.40   in band, TAX 0.100, informed archetype tops all five
   *   2,300  -> RR 1.36   in band, but the informed archetype falls to 3/5
   *
   * 1,840 is the point where a planet can afford real defence AND a raid still
   * repays the fleet it costs. Both neighbours of it are worse on a band that
   * matters, which is what makes this a floor-and-ceiling rather than a taste.
   */
  THORN: { id: 'THORN', name: 'Thorn', cls: 'SKIRMISHER', atk: 16, hp: 60, speed: 0, cargo: 0, alloy: 800, crystal: 120, minShipyard: 0, ground: true },
  /**
   * The mining craft. D19.
   *
   * `speed` and `cargo` here are its NOMINAL figures — what it does with a Drill at
   * L1 — and they exist so a ship card has something honest to print. The live
   * values come from `prospectorSpeed()` and `prospectorHold()`, because raising
   * the Drill upgrades every craft the player already owns.
   *
   * SUPPORT class, so it is shielded while any combat hull on its side survives
   * and is prey to everything once they are gone. A Prospector sitting at home when
   * a raid lands is lost with the rest of the garrison — mining is not free money,
   * it is capital parked outdoors.
   */
  PROSPECTOR: { id: 'PROSPECTOR', name: 'Prospector', cls: 'SUPPORT', atk: 0, hp: 70, speed: 330, cargo: 1800, alloy: 700, crystal: 120, minShipyard: 1, ground: false },
};

/** What may be put in an attack fleet. A Prospector is deliberately not here. */
export const MOBILE_HULLS: readonly MobileHullId[] = ['WASP', 'LANCE', 'BULWARK', 'HAULER'];
export const ALL_HULLS: readonly HullId[] = [
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION', 'THORN', 'PROSPECTOR',
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
