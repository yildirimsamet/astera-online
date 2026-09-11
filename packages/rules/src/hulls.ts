import { profileHull } from './economy-profile.js';
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
  WARDEN: { id: 'WARDEN', name: 'Warden', tier: 1, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 31, hp: 70, speed: 131, cargo: 35, alloy: scalePrice(412, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(110, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 0, requiredResearch: [], ground: false },
  COURIER: { id: 'COURIER', name: 'Courier', tier: 1, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 90, speed: 181, cargo: 700, alloy: scalePrice(500, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(150, ECONOMY_TEMPO.hullCrystalPrice), deuterium: 0, minShipyard: 1, requiredResearch: [], ground: false },

  VIPER: { id: 'VIPER', name: 'Viper', tier: 2, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER', atk: 50, hp: 89, speed: 213, cargo: 55, alloy: scalePrice(600, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(130, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(25, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  TALON: { id: 'TALON', name: 'Talon', tier: 2, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 125, hp: 79, speed: 150, cargo: 45, alloy: scalePrice(850, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(230, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(40, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  STRONGHOLD: { id: 'STRONGHOLD', name: 'Stronghold', tier: 2, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 45, hp: 617, speed: 81, cargo: 50, alloy: scalePrice(1400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(450, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(40, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  SENTINEL: { id: 'SENTINEL', name: 'Sentinel', tier: 2, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 118, hp: 198, speed: 138, cargo: 65, alloy: scalePrice(1200, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(420, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(75, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },
  WAYFARER: { id: 'WAYFARER', name: 'Wayfarer', tier: 2, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 260, speed: 138, cargo: 2200, alloy: scalePrice(900, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(300, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(100, ECONOMY_TEMPO.hullPrice), minShipyard: 2, requiredResearch: [], ground: false },

  TEMPEST: { id: 'TEMPEST', name: 'Tempest', tier: 3, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER', atk: 155, hp: 204, speed: 231, cargo: 80, alloy: scalePrice(1400, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(450, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(80, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_POWER', level: 2 }], ground: false },
  BALLISTA: { id: 'BALLISTA', name: 'Ballista', tier: 3, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 290, hp: 212, speed: 156, cargo: 70, alloy: scalePrice(1800, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(700, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(140, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_POWER', level: 2 }], ground: false },
  LEVIATHAN: { id: 'LEVIATHAN', name: 'Leviathan', tier: 3, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 180, hp: 941, speed: 88, cargo: 100, alloy: scalePrice(3200, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(1150, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(140, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_ARMOR', level: 2 }], ground: false },
  PRAETORIAN: { id: 'PRAETORIAN', name: 'Praetorian', tier: 3, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 240, hp: 451, speed: 144, cargo: 110, alloy: scalePrice(2500, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(900, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(150, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_ARMOR', level: 2 }], ground: false },
  ATLAS: { id: 'ATLAS', name: 'Atlas', tier: 3, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 800, speed: 94, cargo: 6000, alloy: scalePrice(2100, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(950, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(200, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'SHIP_PROPULSION', level: 2 }], ground: false },
  NULLIFIER: { id: 'NULLIFIER', name: 'Nullifier', tier: 3, family: 'SPECIALIST', profile: 'SHIELD_BREAKER', cls: 'LANCE', atk: 140, hp: 308, speed: 119, cargo: 20, alloy: scalePrice(1600, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(800, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(140, ECONOMY_TEMPO.hullPrice), minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }, { project: 'GRAVITIC_CHARGES', level: 1 }], ground: false },
  /**
   * THE GARBAGE COLLECTOR. D200, owner instruction.
   *
   * Flies WITH a fleet and nowhere else: SUPPORT class, so it eats the last shots —
   * covered while any combat hull on its side lives, prey once they are gone — and
   * it fires nothing. What it is for happens after the fight: every one that
   * survives lifts up to `SALVAGE.perCollector` of that battle's wreck on the way
   * home (`settleWreck`). It cannot be sent at a field or a rock on its own; the
   * attack lane refuses a wing with no combat hull and the mining lane is a
   * Prospector's alone.
   *
   * THE PRICE IS THE OWNER'S AND IS NEVER SCALED — 10k alloy, 5k crystal — so
   * `profileHull` carries it through rather than re-deriving it from a tier. It
   * fires nothing, so `atk × hp / value²` has nothing to price. Its hold is zero
   * on purpose: the salvage is not cargo, and the loot ceiling never sees it.
   */
  GARBAGE_COLLECTOR: { id: 'GARBAGE_COLLECTOR', name: 'Garbage Collector', tier: 3, family: 'SPECIALIST', profile: 'COLLECTOR', cls: 'SUPPORT', atk: 0, hp: 540, speed: 151, cargo: 0, alloy: 10_000, crystal: 5_000, deuterium: 0, minShipyard: 4, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 1 }], ground: false },

  CATACLYSM: { id: 'CATACLYSM', name: 'Cataclysm', tier: 4, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE', atk: 800, hp: 448, speed: 106, cargo: 160, alloy: scalePrice(4200, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(1700, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(325, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_POWER', level: 4 }, { project: 'SHIP_ARMOR', level: 2 }], ground: false },
  /**
   * THE TOP TIER'S SKIRMISHER, AND THE REASON THE TIER EXISTS AT ALL. D196.
   *
   * Until it arrived, tier 4 held a Lance and a Fortress and nothing that beat a
   * Bulwark — so the answer to a Citadel wall was a tier-THREE Tempest, which kept
   * 88% of its value at equal budget where a Cataclysm kept 1%. Reaching the top
   * made the catalogue smaller. Every figure below is `profileHull`'s, not a hand
   * number: this entry carries identity, gates and role, and the shared economy
   * prices it like everything else.
   */
  CORSAIR: { id: 'CORSAIR', name: 'Corsair', tier: 4, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER', atk: 360, hp: 1331, speed: 202, cargo: 285, alloy: scalePrice(4500, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(1200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(80, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_POWER', level: 2 }, { project: 'SHIP_PROPULSION', level: 4 }], ground: false },
  CITADEL: { id: 'CITADEL', name: 'Citadel', tier: 4, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK', atk: 300, hp: 1656, speed: 56, cargo: 180, alloy: scalePrice(5000, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(2100, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(300, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_ARMOR', level: 4 }, { project: 'SHIP_POWER', level: 2 }], ground: false },
  /**
   * THE TOP TIER'S ESCORT — the middle of a spread that had only its two ends. D196.
   *
   * `ROLE_SPREAD` is widest at tier 4 (1.531), and until this hull the choice there
   * was maximum attack (Cataclysm, a/h 0.303) or maximum armour (Citadel, 0.198)
   * with nothing between them. The tier meant to make the sharpest choice offered
   * the fewest. Bulwark-class like the Citadel, so it answers a Lance and falls to
   * a Skirmisher; cheaper than one, because it buys guns with the armour it gives up.
   */
  PALADIN: { id: 'PALADIN', name: 'Paladin', tier: 4, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK', atk: 339, hp: 1413, speed: 121, cargo: 475, alloy: scalePrice(4500, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(1200, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(80, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_ARMOR', level: 2 }, { project: 'SHIP_POWER', level: 2 }], ground: false },
  /**
   * THE TOP TIER'S TRANSPORT. D196, closing D195b's asymmetry: combat ran to tier 4
   * and logistics stopped at 3, so a Cataclysm fleet escorted an Atlas.
   *
   * The slowest hull in the game and the deepest hold — `SUPPORT_ROUND_TRIP`'s
   * fourth rung is 38 minutes, which is what buys the 26,000. D195's two rules are
   * at their extreme here: nothing carries more and nothing drinks less per unit of
   * its own price.
   */
  ARGOSY: { id: 'ARGOSY', name: 'Argosy', tier: 4, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT', atk: 0, hp: 1350, speed: 79, cargo: 26000, alloy: scalePrice(9000, ECONOMY_TEMPO.hullPrice), crystal: scalePrice(2600, ECONOMY_TEMPO.hullCrystalPrice), deuterium: scalePrice(130, ECONOMY_TEMPO.hullPrice), minShipyard: 6, requiredResearch: [{ project: 'STARSHIP_ENGINEERING', level: 2 }, { project: 'SHIP_PROPULSION', level: 2 }], ground: false },
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
// Preserve identities, gates and roles; apply the shared economy before deriving any catalog views.
for (const id of ALL_HULLS) HULLS[id] = profileHull(HULLS[id]);
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
 * AND NEITHER DOES A DEATH STAR, SINCE D179. This note said the opposite — that a
 * strike still took them, and that "the strike reaches things a raid cannot" was
 * where the difference between the two had to be legible. The owner removed fleet
 * damage from the strike entirely, so the difference now lives where it belongs:
 * a raid fights and takes loot, a strike levels buildings and stores and takes
 * nothing home. No craft standing at a world can be destroyed without a battle.
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
export const prospectorRoom = (owned: number, tech: TechLevels = {}): number =>
  Math.max(0, prospectorCeiling(tech) - owned);

/**
 * HOW MANY PROSPECTORS ONE WORLD MAY OWN. D131, extended at D170.
 *
 * Two, and a third from the third rung of Prospector Holds — which is 6,000 alloy
 * and 3,500 crystal of commander-wide research, so the extra craft is BOUGHT and
 * lifts every world the commander holds at once.
 *
 * D131's point survives intact: the ceiling is what makes a rock contested, since
 * nobody can simply out-mine a neighbour by owning more craft. What the rung
 * changes is where the ceiling sits, not that there is one — and a commander who
 * has not bought it reads exactly the number they always did.
 */
export const prospectorCeiling = (tech: TechLevels = {}): number =>
  PROSPECTOR.max
  + ((tech.PROSPECTOR_HOLDS ?? 0) >= PROSPECTOR.thirdCraftRung ? 1 : 0);

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
const BULK: Record<HullId, number> = Object.fromEntries(
  ALL_HULLS.map(id => [id, profileHull(HULLS[id]).bulk]),
) as Record<HullId, number>;
export const hullBulk = (id: HullId): number => BULK[id];

/**
 * THE ROUND TRIP THIS HULL WAS PRICED AGAINST. D195.
 *
 * `profileHull` derives a hull's SPEED from a class round trip — 15 minutes for a
 * Skirmisher, 20 for a Lance, 25 for a Bulwark, its own rung for a transport — and
 * since D195 the same figure sets how much it CARRIES and how much it DRINKS. It
 * is exported the way `hullBulk` is, and for the same reason: it is profile-derived
 * rather than authored, so a parallel table of "how fast is this thing" would drift
 * from the speed it is supposed to describe the first time either moved.
 *
 * `null` for anything with no class trip — the two guns and the Prospector.
 */
const ROUND_TRIP: Record<HullId, number | null> = Object.fromEntries(
  ALL_HULLS.map(id => [id, profileHull(HULLS[id]).referenceRoundTrip]),
) as Record<HullId, number | null>;
export const hullRoundTrip = (id: HullId): number | null => ROUND_TRIP[id];


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
 * WHAT A FLEET IS WORTH IN A FIGHT, WHICH IS NOT WHAT IT COST. D183, owner report:
 * *"Yük gemisi ekliyorum gücüm artıyor ama yük gemilerinin saldırısı 0. Saçma
 * değil mi?"*
 *
 * `fleetValue` is resources sunk in, and it is exactly right for what it grades —
 * a battle's exchange, Dominion, the size of a debris field. It is the wrong number
 * on a screen that says "this is the force you are sending", because an Atlas is
 * 3,050 of it and fires nothing: a commander packing cargo for the loot watched
 * that bar grow while the force they were sending stood still.
 *
 * ATTACK IS THE TEST, and it is the owner's own words. A hull that cannot fire is
 * not part of the force being compared — the two ground guns are (they fire), the
 * three transports and the Prospector are not (they do not). Derived from `atk`
 * rather than from a list, so a fourth transport is excluded the day it is added
 * rather than the day somebody notices it inflating a comparison.
 *
 * STILL PRICED IN RESOURCES. The other side of that comparison is a probe's
 * defence band, and two quantities in different units are not a comparison at all
 * (`ForceCompare`'s whole reason for existing). What changes is WHICH hulls are
 * counted, never the scale they are counted on.
 */
export function combatValue(fleet: Fleet): number {
  let v = 0;
  for (const [id, n] of fleetEntries(fleet)) {
    const h = HULLS[id];
    if (h.atk <= 0) continue;
    v += n * (h.alloy + h.crystal + h.deuterium);
  }
  return v;
}

/**
 * THE HULLS IN A LINE THAT FIRE NOTHING. D199.
 *
 * `combatValue`'s other half. A transport at home stands in the defending line —
 * a DECISIVE raid has to sink it — while adding nothing to the firepower a probe
 * reports, so a world of Atlases reads as undefended and still sends a small raid
 * home empty. Pass it a line built by `garrisonOf`; the test is `atk`, exactly as
 * `combatValue`'s is, so the two can never count the same hull twice or not at all.
 */
export function unarmedCount(fleet: Fleet): number {
  let n = 0;
  for (const [id, count] of fleetEntries(fleet)) {
    if (HULLS[id].atk <= 0) n += count;
  }
  return n;
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

export function fleetHp(fleet: Fleet): number {
  let hp = 0;
  for (const [id, n] of fleetEntries(fleet)) hp += n * HULLS[id].hp;
  return hp;
}

/**
 * A fleet travels at the speed of its slowest ship. Zero if it cannot travel.
 *
 * `tech` IS REQUIRED, AND THAT IS THE WHOLE GUARD. D180. It defaulted to `{}`, so
 * a caller that forgot it was quoted the catalogue speed of a commander with no
 * propulsion — up to half the real pace, silently. Callers that genuinely have no
 * commander pass `UNAIDED.tech` and say so; `fleetPace` is the composed answer
 * most callers actually want.
 */
export function fleetSpeed(fleet: Fleet, tech: TechLevels): number {
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
 * Not `transferCargoCapacity`, which counts only dedicated Fleet V2 transports
 * moving ore between a commander's own worlds. Two different ROSTERS — a Dart
 * raises this and not that — but since D180 the same `cargoMult` ladder lifts both.
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
