import { COMBAT, PROSPECTOR } from './constants.js';
import { cargoMult } from './tech.js';
import type { TechLevels } from './tech.js';
import { ECONOMY_TEMPO, scalePrice } from './tempo.js';
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
 * a raid on a neighbouring world is an 11-16 minute round trip in the R=2000 sphere,
 * which is the tempo the owner chose with the numbers in front of them.
 */
export const HULLS: Record<HullId, Hull> = {
  WASP: { id: 'WASP', name: 'Wasp', cls: 'SKIRMISHER', atk: 15, hp: 25, speed: 130, cargo: 45, alloy: scalePrice(240, ECONOMY_TEMPO.hullPrice), crystal: 0, deuterium: 0, minShipyard: 0, ground: false },
  LANCE: { id: 'LANCE', name: 'Lance', cls: 'LANCE', atk: 78, hp: 112, speed: 100, cargo: 60, alloy: scalePrice(820, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(260, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 2, ground: false },
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
  BULWARK: { id: 'BULWARK', name: 'Bulwark', cls: 'BULWARK', atk: 106, hp: 662, speed: 65, cargo: 90, alloy: scalePrice(2150, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(730, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 4, ground: false },
  HAULER: { id: 'HAULER', name: 'Hauler', cls: 'SUPPORT', atk: 0, hp: 210, speed: 85, cargo: 2200, alloy: scalePrice(1100, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 1, ground: false },
  /** Fast, expensive capacity. It shortens exposure; it never replaces a Hauler. D94. */
  RUNNER: { id: 'RUNNER', name: 'Runner', cls: 'SUPPORT', atk: 0, hp: 120, speed: 125, cargo: 380, alloy: scalePrice(560, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(250, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(90, ECONOMY_TEMPO.hullPrice), minShipyard: 2, ground: false },
  /** Shield specialist. Its extra damage is resolved only against a live shield. D95. */
  BREACHER: { id: 'BREACHER', name: 'Breacher', cls: 'LANCE', atk: 55, hp: 300, speed: 78, cargo: 0, alloy: scalePrice(1250, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(550, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(200, ECONOMY_TEMPO.hullPrice), minShipyard: 3, ground: false },
  /**
   * THE HEAVY GUN. Bulwark-class, so a swarm of Wasps overwhelms it and a Lance
   * breaks against it. Expensive, slow to accumulate, and what a planet buys when
   * it expects to be hit by something serious.
   */
  BASTION: { id: 'BASTION', name: 'Bastion', cls: 'BULWARK', atk: 118, hp: 906, speed: 0, cargo: 0, alloy: scalePrice(2400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(800, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 1, ground: true },
  /**
   * THE LIGHT GUN. D27. Skirmisher-class, so it tears into heavy hulls and is
   * picked apart by Lances — the exact inverse of the Bastion, which is its whole
   * reason to exist.
   *
   * Buildable from the first minute (`minShipyard: 0`) on purpose: a new commander
   * has no other way to defend anything, and `ABUSE.bashLimit` is all that stands
   * between them and a developed neighbour.
   *
   * BOTH GROUND HULLS ARE PRICED AT 1.6× EQUAL-BUDGET POWER, and that multiplier is
   * what they are paid for never leaving: they cannot loot, cannot take Dominion,
   * and cannot be part of a decision made anywhere but at home. The two sit in
   * OPPOSITE CLASSES so that "how much defence" becomes "what KIND" — a question
   * only the information layer can answer.
   */
  THORN: { id: 'THORN', name: 'Thorn', cls: 'SKIRMISHER', atk: 49, hp: 174, speed: 0, cargo: 0, alloy: scalePrice(700, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 0, ground: true },
  /**
   * The mining craft. D19.
   *
   * `speed` and `cargo` here are its NOMINAL figures — what it does with no Derrick
   * — and they exist so a ship card has something honest to print. The live values
   * come from `prospectorSpeed()` and `prospectorHold()`, because a Derrick lifts
   * every craft the player already owns. `speed` MUST equal `PROSPECTOR.speed`.
   *
   * SUPPORT class, so on a mission it is shielded while any combat hull on its side
   * survives and is prey to everything once they are gone. AT HOME IT IS NOT IN THE
   * LINE AT ALL — see `NON_COMBATANT_HULLS` for why a raid goes past it and a Death
   * Star does not. The class still decides what happens to a craft caught out on a
   * run, which is where mining's real exposure lives.
   */
  PROSPECTOR: { id: 'PROSPECTOR', name: 'Prospector', cls: 'SUPPORT', atk: 0, hp: 150, speed: 825, cargo: PROSPECTOR.hold, alloy: scalePrice(650, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 1, ground: false },
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

/**
 * CRAFT THAT DO NOT STAND IN THE LINE WHEN A RAID LANDS.
 *
 * The Prospector used to defend, and the docblock above it called that "capital
 * parked outdoors". It read well and played badly: the owner never CHOSE to
 * commit the craft — it was simply at home — and losing both ended mining
 * outright, so an ordinary raid quietly deleted a whole system the defender had
 * no way to withdraw from. A penalty with no decision attached to it is not a
 * risk, and this game charges for risks it lets you take.
 *
 * A DEATH STAR STILL TAKES THEM (`DESTROYED_HOME`), and that is the point. The
 * difference between a raid and a strike has to be legible somewhere, and "the
 * strike reaches things a raid cannot" is the cleanest place to put it.
 *
 * A LIST RATHER THAN A NAME, so a second civilian craft is excluded the day it is
 * added rather than the day somebody notices it has been fighting.
 */
export const NON_COMBATANT_HULLS: readonly HullId[] = ['PROSPECTOR'];

/**
 * WHAT A RAID ACTUALLY MEETS: the fighting hulls standing at home, plus the
 * emplacements that can never leave.
 *
 * Every surface that resolves a battle builds its defenders here — the player
 * raid, the neutral raid and the simulator. One definition is not tidiness: this
 * code base has already shipped an effect honoured in one place and forgotten in
 * another (the satellites), and a craft that is spared on one path and killed on
 * the other would be the same bug wearing a different hat.
 *
 * Counts are SUMMED rather than spread. Home and ground are disjoint today, so
 * the two are equal — but a summed merge cannot silently drop a stack the day
 * they stop being.
 */
export function garrisonOf(home: Fleet, ground: Fleet): Fleet {
  const line: Fleet = {};
  for (const [id, count] of fleetEntries(home)) {
    if (NON_COMBATANT_HULLS.includes(id)) continue;
    line[id] = (line[id] ?? 0) + count;
  }
  for (const [id, count] of fleetEntries(ground)) line[id] = (line[id] ?? 0) + count;
  return line;
}

/**
 * BERTHS LEFT FOR MINING CRAFT on a world that already owns `owned`.
 *
 * `PROSPECTOR.max` is a property of the WORLD, and a craft can reach one through
 * four doors: it can be built there, flown there by transfer, delivered there by
 * an arrival, or handed over with the world itself. The arithmetic lives here so
 * the doors cannot answer the question differently — the cap used to be enforced
 * at the build screen alone, and a player could hold four simply by building two
 * and flying two more across.
 *
 * Never negative: a world CAN legally be over the line (a capture hands over
 * whatever was standing there) and no rule deletes a craft to tidy that up. Over
 * the line means nothing new comes in, not that something already there goes.
 */
export const prospectorRoom = (owned: number): number =>
  Math.max(0, PROSPECTOR.max - owned);

/**
 * ROOM, PRICED OFF WORTH. T4.
 *
 * What a craft takes up in a Hangar — and, from T6, the mass it burns fuel to move.
 * ONE NUMBER FOR ONE IDEA: two figures for "how big is this ship" drift apart at
 * the first edit, and the symptom would be a fleet that fits in a hangar it cannot
 * afford to fly.
 *
 * DERIVED FROM THE HULL'S OWN PRICE, and that is the whole design. The table above
 * is held at a near-constant `atk × hp / value²` so each tech tier buys about 15%
 * of equal-budget power against the counter cycle's 156%. A capacity measured in
 * VALUE leaves that arithmetic exactly where it is — it caps how much military a
 * world may hold, and cares not at all which hulls it is made of. A hand-set bulk
 * would be a second pricing axis, silently re-rating every hull against the claim
 * the whole game rests on, and nothing in the hull table would show it.
 *
 * THE WASP IS THE UNIT, so a player reads whole small numbers on a card and a
 * hangar figure they can hold in their head. Rounding is the only licence taken and
 * `test/capacity.test.ts` holds it inside 15%.
 */
const BULK_UNIT = HULLS.WASP.alloy + HULLS.WASP.crystal + HULLS.WASP.deuterium;
const BULK: Record<HullId, number> = Object.fromEntries(
  ALL_HULLS.map((id) => [
    id,
    Math.max(1, Math.round(
      (HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium) / BULK_UNIT,
    )),
  ]),
) as Record<HullId, number>;

export const hullBulk = (id: HullId): number => BULK[id];

/**
 * Room this fleet takes in a HANGAR. Emplacements are not in it.
 *
 * Two named functions rather than one that sums whatever it is handed, because a
 * caller passing the wrong half is exactly the failure this code base has already
 * shipped once (D131): a rule honoured on one path and forgotten on another. Here
 * the split is in the function name, so there is no half to pass.
 */
export function hangarLoad(fleet: Fleet): number {
  let load = 0;
  for (const [id, count] of fleetEntries(fleet)) {
    if (!HULLS[id].ground) load += count * BULK[id];
  }
  return load;
}

/** Room this fleet takes on the GROUND. Nothing that flies is in it. */
export function groundLoad(fleet: Fleet): number {
  let load = 0;
  for (const [id, count] of fleetEntries(fleet)) {
    if (HULLS[id].ground) load += count * BULK[id];
  }
  return load;
}

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

/**
 * What this fleet can carry home. T8.
 *
 * THIS IS THE LOOT CEILING, which is why the research that lifts it is the
 * smallest and dearest of the three economy ladders — it is the only one that
 * moves raid returns directly.
 *
 * Not `transferCargoCapacity`, which counts only Haulers and Runners moving ore
 * between a commander's own worlds. Two different questions, deliberately kept
 * apart: what a raid carries away, and what a logistics run can move.
 */
export function fleetCargo(fleet: Fleet, tech: TechLevels): number {
  let c = 0;
  for (const id of MOBILE_HULLS) c += (fleet[id] ?? 0) * HULLS[id].cargo;
  return Math.floor(c * cargoMult(tech));
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
