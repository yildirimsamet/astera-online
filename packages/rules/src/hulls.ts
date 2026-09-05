import { COMBAT, PROSPECTOR } from './constants.js';
import { cargoMult, hullTech } from './tech.js';
import type { TechLevels } from './tech.js';
import { ECONOMY_TEMPO, scalePrice } from './tempo.js';
import type {
  CombatClass,
  Fleet,
  GroundHullId,
  Hull,
  HullClass,
  HullId,
  MobileHullId,
} from './types.js';

/**
 * Fleet Catalog V2. D148.
 *
 * Every mobile entry is an authored decision rather than a configurable module:
 * Raiders buy speed with durability, Strikers buy attack with durability,
 * Fortresses buy durability with speed and Escorts sit between those extremes.
 * Tier efficiency is deliberately shallow — roughly 1.00 / 1.06 / 1.12 / 1.18
 * in `atk × hp / value²` — so the 1.6/0.625 counter still matters more than tech.
 * Phase 3 owns final numeric calibration; this is the executable starting table.
 *
 * EVERY `speed` HERE IS D148'S AUTHORED FIGURE x1.25, ROUNDED TO A WHOLE UNIT.
 * D152, owner instruction. The lift is uniform, so every profile relation the
 * table was authored around — Raider over Striker over Fortress, Courier faster
 * and Wayfarer fatter, Tempest the combat ceiling — survives it untouched; what
 * moves is the tempo of the whole galaxy, not the shape of a choice inside it.
 * `atk x hp / value^2` does not read speed, so no price moved with it.
 *
 * THE PROBE AND THE PROSPECTOR ARE NOT IN THIS TABLE'S UNITS and did not take the
 * factor. `PROBE.speed` is calibrated against `GALAXY_SPAN` so the gradient of
 * looking stays what D121 measured, and `PROSPECTOR.speed` is calibrated against
 * ROCK speed so a drill keeps D74's interception lead. Raising either with the
 * warships would have moved a number that answers a different question.
 */
export const HULLS: Record<HullId, Hull> = {
  DART: { id: 'DART', name: 'Dart', tier: 1, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER', atk: 18, hp: 19, speed: 200, cargo: 35, alloy: scalePrice(240, ECONOMY_TEMPO.hullPrice), crystal: 0, deuterium: 0, minShipyard: 0, requiredResearch: [], ground: false },
  PIKE: { id: 'PIKE', name: 'Pike', tier: 1, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 58, hp: 21, speed: 144, cargo: 25, alloy: scalePrice(320, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(90, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 0, requiredResearch: [], ground: false },
  RAMPART: { id: 'RAMPART', name: 'Rampart', tier: 1, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 14, hp: 148, speed: 75, cargo: 20, alloy: scalePrice(400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(140, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 0, requiredResearch: [], ground: false },
  WARDEN: { id: 'WARDEN', name: 'Warden', tier: 1, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 31, hp: 70, speed: 131, cargo: 35, alloy: scalePrice(412, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(110, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(25, ECONOMY_TEMPO.hullPrice), minShipyard: 0, requiredResearch: [], ground: false },
  COURIER: { id: 'COURIER', name: 'Courier', tier: 1, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 90, speed: 181, cargo: 700, alloy: scalePrice(500, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(150, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(50, ECONOMY_TEMPO.hullPrice), minShipyard: 1, requiredResearch: [], ground: false },

  VIPER: { id: 'VIPER', name: 'Viper', tier: 2, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER', atk: 50, hp: 89, speed: 213, cargo: 55, alloy: scalePrice(600, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(130, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(50, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  TALON: { id: 'TALON', name: 'Talon', tier: 2, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 125, hp: 79, speed: 150, cargo: 45, alloy: scalePrice(850, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(230, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(80, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  STRONGHOLD: { id: 'STRONGHOLD', name: 'Stronghold', tier: 2, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 45, hp: 617, speed: 81, cargo: 50, alloy: scalePrice(1400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(450, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(80, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  SENTINEL: { id: 'SENTINEL', name: 'Sentinel', tier: 2, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 118, hp: 198, speed: 138, cargo: 65, alloy: scalePrice(1200, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(420, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(150, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  WAYFARER: { id: 'WAYFARER', name: 'Wayfarer', tier: 2, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 260, speed: 138, cargo: 2200, alloy: scalePrice(900, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(300, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(200, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },

  TEMPEST: { id: 'TEMPEST', name: 'Tempest', tier: 3, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER', atk: 155, hp: 204, speed: 231, cargo: 80, alloy: scalePrice(1400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(450, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(160, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_POWER', level: 2 }], ground: false },
  BALLISTA: { id: 'BALLISTA', name: 'Ballista', tier: 3, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 290, hp: 212, speed: 156, cargo: 70, alloy: scalePrice(1800, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(700, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(280, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_POWER', level: 2 }], ground: false },
  LEVIATHAN: { id: 'LEVIATHAN', name: 'Leviathan', tier: 3, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 180, hp: 941, speed: 88, cargo: 100, alloy: scalePrice(3200, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(1150, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(280, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_ARMOR', level: 2 }], ground: false },
  PRAETORIAN: { id: 'PRAETORIAN', name: 'Praetorian', tier: 3, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 240, hp: 451, speed: 144, cargo: 110, alloy: scalePrice(2500, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(900, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(300, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_ARMOR', level: 2 }], ground: false },
  ATLAS: { id: 'ATLAS', name: 'Atlas', tier: 3, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 800, speed: 94, cargo: 6000, alloy: scalePrice(2100, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(950, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(400, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_PROPULSION', level: 2 }], ground: false },
  NULLIFIER: { id: 'NULLIFIER', name: 'Nullifier', tier: 3, family: 'SPECIALIST', profile: 'SHIELD_BREAKER', cls: 'LANCE', atk: 140, hp: 308, speed: 119, cargo: 20, alloy: scalePrice(1600, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(800, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(280, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'GRAVITIC_CHARGES', level: 1 }], ground: false },

  CATACLYSM: { id: 'CATACLYSM', name: 'Cataclysm', tier: 4, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 800, hp: 448, speed: 106, cargo: 160, alloy: scalePrice(4200, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(1700, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(650, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_POWER', level: 4 }, { project: 'SHIP_ARMOR', level: 2 }], ground: false },
  CITADEL: { id: 'CITADEL', name: 'Citadel', tier: 4, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 300, hp: 1656, speed: 56, cargo: 180, alloy: scalePrice(5000, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(2100, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(600, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_ARMOR', level: 4 }, { project: 'SHIP_POWER', level: 2 }], ground: false },

  /**
   * THE HEAVY GUN. Bulwark-class, so a Skirmisher swarm overwhelms it and a Lance
   * breaks against it. Expensive, slow to accumulate, and what a planet buys when
   * it expects to be hit by something serious.
   */
  BASTION: { id: 'BASTION', name: 'Bastion', tier: null, family: 'PRESERVED', profile: 'EMPLACEMENT', cls: 'BULWARK', atk: 118, hp: 906, speed: 0, cargo: 0, alloy: scalePrice(2400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(800, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 1, requiredResearch: [], ground: true },
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
  THORN: { id: 'THORN', name: 'Thorn', tier: null, family: 'PRESERVED', profile: 'EMPLACEMENT', cls: 'SKIRMISHER', atk: 49, hp: 174, speed: 0, cargo: 0, alloy: scalePrice(700, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 0, requiredResearch: [], ground: true },
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
  PROSPECTOR: { id: 'PROSPECTOR', name: 'Prospector', tier: null, family: 'PRESERVED', profile: 'MINER', cls: 'SUPPORT', atk: 0, hp: 150, speed: 825, cargo: PROSPECTOR.hold, alloy: scalePrice(650, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 1, requiredResearch: [], ground: false },
};

/** What may be put in an attack fleet. A Prospector is deliberately not here. */
export const ALL_HULLS: readonly HullId[] = Object.keys(HULLS) as HullId[];
export const MOBILE_HULLS: readonly MobileHullId[] = ALL_HULLS.filter(
  (id): id is MobileHullId => !HULLS[id].ground && id !== 'PROSPECTOR',
);
export const FLEET_V2_HULLS: readonly MobileHullId[] = MOBILE_HULLS;
export const COMBAT_HULLS: readonly MobileHullId[] = MOBILE_HULLS.filter(
  (id) => HULLS[id].cls !== 'SUPPORT',
);
export const SUPPORT_HULLS: readonly MobileHullId[] = MOBILE_HULLS.filter(
  (id) => HULLS[id].cls === 'SUPPORT',
);

/** Whether the commander holds every authored research rung for this hull. */
export function hullRequirementsMet(id: HullId, tech: TechLevels): boolean {
  return HULLS[id].requiredResearch.every(
    ({ project, level }) => Math.floor(tech[project] ?? 0) >= level,
  );
}

/**
 * The complete production gate shared by server, simulator and presentation.
 * Keeping Shipyard and research checks together prevents a card from advertising
 * a hull that the build endpoint (or balance bot) interprets differently.
 */
export function hullBuildable(id: HullId, shipyard: number, tech: TechLevels): boolean {
  return shipyard >= HULLS[id].minShipyard && hullRequirementsMet(id, tech);
}

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
 * THE DART IS THE UNIT, so a player reads whole small numbers on a card and a
 * hangar figure they can hold in their head. Rounding is the only licence taken and
 * `test/capacity.test.ts` holds it inside 15%.
 */
const BULK_UNIT = HULLS.DART.alloy + HULLS.DART.crystal + HULLS.DART.deuterium;
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

/**
 * SKIRMISHER ▸ BULWARK ▸ LANCE ▸ SKIRMISHER. Support is prey and deals nothing.
 *
 * EXPORTED, BECAUSE A RULE THE PLAYER CANNOT SEE IS NOT A USABLE RULE (D124).
 *
 * This was private for most of the project's life, and the consequence was
 * measurable: `HullClass` appeared ZERO times in `apps/web/src`, so the whole of
 * combat — the one relation that decides every fight — was invisible on every
 * screen a fleet is chosen on. The multipliers were printed in exactly one place,
 * `CombatFormula` in the battle report, which is to say AFTER the fleet was gone.
 *
 * `counterMult` alone could never have fixed that. It answers one pairwise
 * question, which is all a resolver needs and nothing a card can draw: a hull sheet
 * asking "what am I strong against" would have to probe the function with every
 * class and reconstruct the cycle from the answers. So the relation is published as
 * DATA, and `counterMult` is now a reader of it rather than its only witness.
 */
export const COUNTERS: Readonly<Record<CombatClass, CombatClass>> = {
  SKIRMISHER: 'BULWARK',
  BULWARK: 'LANCE',
  LANCE: 'SKIRMISHER',
};

/** The three rungs, in cycle order. SUPPORT is deliberately not among them. */
export const COMBAT_CLASSES: readonly CombatClass[] = ['SKIRMISHER', 'BULWARK', 'LANCE'];

const inCycle = (cls: HullClass): cls is CombatClass => cls !== 'SUPPORT';

/**
 * What this class is STRONG against — `strongMult`. Null for SUPPORT.
 *
 * The null is not an oversight to be defaulted away by a caller. Support is
 * outside the cycle in both directions, and a chip reading "Courier ▸ strong vs
 * Bulwark" would be teaching a rule that does not exist.
 */
export const counters = (cls: HullClass): CombatClass | null =>
  inCycle(cls) ? COUNTERS[cls] : null;

/** What is strong against THIS class — the thing to be afraid of. Null for SUPPORT. */
export const counteredBy = (cls: HullClass): CombatClass | null =>
  inCycle(cls) ? COMBAT_CLASSES.find((other) => COUNTERS[other] === cls) ?? null : null;

export function counterMult(attacker: HullClass, defender: HullClass): number {
  if (attacker === 'SUPPORT') return 0;
  if (defender === 'SUPPORT') return COMBAT.strongMult;
  if (COUNTERS[attacker] === defender) return COMBAT.strongMult;
  if (COUNTERS[defender] === attacker) return COMBAT.weakMult;
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
 * HOW A FLEET IS SPLIT ACROSS THE COUNTER CYCLE, as shares of its VALUE.
 *
 * The axis is deliberate. `fleetValue` is the one quantity a commander can already
 * read on BOTH sides of a decision: it is what a probe's defence band reports and
 * what a battle is graded on. Splitting that same axis by class means two bars on a
 * launch sheet are the same currency, and the comparison is arithmetic the player
 * could in principle do by hand.
 *
 * An HP share would have been closer to what `damageMap` actually weights by — and
 * would have been a SECOND, invisible currency on a screen that already shows the
 * first. A number nobody can check against anything else on the page is the exact
 * failure this whole surface exists to fix.
 *
 * Ground hulls are counted. The two guns sit in opposite classes on purpose (D27),
 * a probe's defence band is taken over everything standing on the world, and a
 * share that dropped them would describe a different wall than the one being flown
 * at.
 */
export function classShares(fleet: Fleet): Readonly<Record<HullClass, number>> {
  const byClass: Record<HullClass, number> = {
    SKIRMISHER: 0, LANCE: 0, BULWARK: 0, SUPPORT: 0,
  };
  let total = 0;
  for (const [id, n] of fleetEntries(fleet)) {
    const h = HULLS[id];
    const v = n * (h.alloy + h.crystal + h.deuterium);
    byClass[h.cls] += v;
    total += v;
  }
  if (total <= 0) return byClass;
  for (const cls of Object.keys(byClass) as HullClass[]) byClass[cls] /= total;
  return byClass;
}

/**
 * The class holding the most value — "mostly Bulwark", in one word.
 *
 * NULL ON AN EXACT TIE, and that is the point rather than an omission. On a wall
 * split evenly between two classes there is no dominant one, and a caller that
 * printed a winner anyway would be an interface asserting a reading nobody took —
 * on the screen where that reading decides what gets committed.
 */
export function dominantClass(fleet: Fleet): HullClass | null {
  const shares = classShares(fleet);
  let best: HullClass | null = null;
  let bestShare = 0;
  let tied = false;
  for (const cls of Object.keys(shares) as HullClass[]) {
    const share = shares[cls];
    if (share <= 0) continue;
    if (share > bestShare) {
      best = cls;
      bestShare = share;
      tied = false;
    } else if (share === bestShare) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Rough combat heft. ADVISORY ONLY — it ignores the counter matrix, so a Dart swarm
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
export function fleetSpeed(fleet: Fleet, tech: TechLevels = {}): number {
  let s = Infinity;
  for (const id of MOBILE_HULLS) {
    if ((fleet[id] ?? 0) > 0) {
      s = Math.min(s, HULLS[id].speed * hullTech(tech, id).speed);
    }
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
 * Not `transferCargoCapacity`, which counts only dedicated Fleet V2 transports moving ore
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
