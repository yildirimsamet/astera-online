import type {
  BuildingId, GroundHullId, InstrumentId, MobileHullId, SatelliteId,
} from '@astera/rules';

/** A hull that fights. Haulers are cargo and are bought on their own terms. */
export type CombatHullId = Exclude<MobileHullId, 'HAULER' | 'RUNNER'>;

/** Target shares of the military budget, by hull. Need not sum to exactly 1. */
export type Composition = Partial<Record<CombatHullId, number>>;

/** How a planet splits its ground guns. D27. Shares of the defence budget. */
export type GroundMix = Partial<Record<GroundHullId, number>>;

/**
 * Five spending policies plus a login cadence. Deliberately crude — the point is
 * to bracket real behaviour, not to imitate it.
 *
 * GRINDER is the one that matters: it is the informed player, and the design's
 * central claim is that it should top the ladder.
 */
export interface Archetype {
  readonly share: number;
  readonly loginsPerDay: number;
  /**
   * THE HANGAR IS LAST ON EVERY LIST, AND IT IS DEMAND-DRIVEN. T4.
   *
   * The loop skips a Hangar whose ceiling the fleet is nowhere near, so position
   * decides only what it CROWDS OUT once the construction queue is full — and a
   * ceiling-lifter should never crowd out the economy that fills it. A commander
   * raises a Hangar when they hit one, and grows the rest of the time.
   *
   * POSITION WAS MEASURED AND MAKES NO DIFFERENCE — the demand gate already stops
   * an early buy, so second and last produce an identical ladder across all five
   * gate seeds. It is last because that is the honest model, not because it moved a
   * number: a commander raises a Hangar when they hit one and grows the rest of the
   * time, and a bot that bought capacity ahead of production would be a model of a
   * worse player than the one being measured.
   */
  readonly buildOrder: readonly BuildingId[];
  /**
   * ONE WISHLIST, SPANNING BOTH KINDS OF HARDWARE. D25.
   *
   * Instruments sit on the ground and carry levels; satellites take an orbit slot
   * and are bought once. They are still one queue, because a player has one budget
   * and one set of priorities — and because the Uplink GATES the Telescope and the
   * Radar, so anything that models the two categories as separate passes can leave
   * an archetype permanently unable to reach its own first choice.
   *
   * That is not hypothetical: modelling them as two passes made the GRINDER — the
   * informed player the design's central claim rests on — skip its gated Telescope,
   * spend on a cheap Veil instead, and never once buy the Uplink that would have
   * opened it. It played fourteen days blind, and the season's raid return fell
   * with it.
   *
   * Order is what the archetype IS. The Core opens orbit slots at 1, 3, 5 and 9, so
   * the first satellite here is what a planet runs for most of a season and the last
   * is one a casual player may never reach.
   */
  readonly wants: readonly (InstrumentId | SatelliteId)[];
  /**
   * Defence value held per unit of raidable stock — insurance, bought FIRST.
   *
   * Buying defence from leftovers means it never gets bought: buildings compound,
   * so at the margin they always look like the better purchase. The first version
   * of these bots did exactly that and produced 23 Bastions across 140 planets,
   * which made 95% of attacks DECISIVE and left the fog with nothing to resolve.
   */
  readonly defenceRatio: number;
  /**
   * WHAT THIS ARCHETYPE HABITUALLY BUILDS.
   *
   * Before this existed the buy loop walked `['BULWARK','LANCE','WASP']` and took
   * the first hull it could afford, spending the entire military budget on it. That
   * is the most expensive affordable hull, every session, for every bot — the exact
   * inverse of the dominant composition. Every raid-return reading the project has
   * ever taken was measured in a galaxy where nobody had noticed how combat works.
   *
   * A mix is a HABIT, not a solution. These are hand-set and deliberately
   * imperfect: a galaxy of optimal players is exactly as wrong as a galaxy of
   * idiots, because if everybody fields the right fleet then nothing is left for
   * information to buy. Only `adaptsComposition` reasons about it, and only one
   * archetype has it.
   */
  readonly composition: Composition;
  /**
   * WHAT THIS PLANET PUTS ON THE GROUND. D27.
   *
   * A habit, like `composition`, and for the same reason: if every defender built
   * the perfect counter to whoever was coming there would be nothing for an
   * attacker's scouting to discover. The spread across archetypes is what makes a
   * neighbourhood worth reading — a galaxy where everyone defends identically is a
   * galaxy where "what kind of defence" is not a question.
   */
  readonly groundMix: GroundMix;
  /**
   * Whether this archetype picks its fleet from what it has measured.
   *
   * TRUE FOR GRINDER AND NOTHING ELSE, and that is the design's central claim
   * expressed as a boolean: the informed player is the one who brings the right
   * ships. Granting it to a second archetype does not make the simulation more
   * realistic, it deletes the thing the simulation exists to test.
   */
  readonly adaptsComposition: boolean;
  readonly militaryShare: number;
  readonly attackChance: number;
  /** Chance of using a login to launch an available mining squadron. */
  readonly miningChance: number;
  /** Desired owned Prospectors, still bounded by the rules-level ownership cap. */
  readonly prospectorTarget: 1 | 2;
  /** Whether this habit values isotope access enough to buy the seasonal project. */
  readonly researchesIsotopes: boolean;
  readonly researchesRunner: boolean;
  /** Whether this habit turns a shield-heavy battle report into Breacher access. */
  readonly researchesBreacher: boolean;
  readonly scouts: boolean;
}

export type ArchetypeName = 'TURTLE' | 'RAIDER' | 'FARMER' | 'CASUAL' | 'GRINDER';

export const ARCHETYPES: Record<ArchetypeName, Archetype> = {
  TURTLE: {
    share: 0.18, loginsPerDay: 4, defenceRatio: 2.2,
    buildOrder: ['REFINERY', 'EXTRACTOR', 'VAULT', 'CORE', 'HANGAR', 'DEUTERIUM_PLANT'],
    wants: ['AEGIS', 'UPLINK', 'RADAR', 'FOUNDRY'],
    // Never attacks, so this is a home garrison: the cheapest hit points it can
    // put on the pad beside the Bastions it actually relies on.
    composition: { WASP: 1 }, adaptsComposition: false,
    // Heavy first, and enough light guns that a swarm cannot simply walk in.
    groundMix: { BASTION: 0.65, THORN: 0.35 },
    militaryShare: 0.35, attackChance: 0, miningChance: 0.2, prospectorTarget: 1,
    researchesIsotopes: false, researchesRunner: false, researchesBreacher: false, scouts: false,
  },
  RAIDER: {
    share: 0.22, loginsPerDay: 6, defenceRatio: 0.35,
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'EXTRACTOR', 'HANGAR', 'DEUTERIUM_PLANT'],
    wants: ['UPLINK', 'RADAR', 'TELESCOPE', 'VEIL', 'BEACON'],
    // Attacks constantly and scouts never, so it cannot learn what it is flying
    // into. A generalist mix is what that player ends up with: enough Lances to
    // hurt a fleet, enough Wasps to be cheap about it, and no idea which it needs.
    composition: { WASP: 0.55, LANCE: 0.45 }, adaptsComposition: false,
    // Barely defends at all, so it buys the cheap gun it can afford between raids.
    groundMix: { THORN: 0.8, BASTION: 0.2 },
    militaryShare: 0.65, attackChance: 0.55, miningChance: 0.25, prospectorTarget: 1,
    researchesIsotopes: false, researchesRunner: false, researchesBreacher: false, scouts: false,
  },
  FARMER: {
    share: 0.24, loginsPerDay: 4, defenceRatio: 1.3,
    buildOrder: ['REFINERY', 'EXTRACTOR', 'VAULT', 'CORE', 'SHIPYARD', 'HANGAR', 'DEUTERIUM_PLANT'],
    wants: ['FOUNDRY', 'AEGIS', 'UPLINK', 'RADAR'],
    // Raids occasionally and cheaply; the fleet is a sideline to the economy.
    composition: { WASP: 0.7, LANCE: 0.3 }, adaptsComposition: false,
    // Hedged. It does not know who is coming and does not intend to find out.
    groundMix: { BASTION: 0.5, THORN: 0.5 },
    militaryShare: 0.3, attackChance: 0.12, miningChance: 0.7, prospectorTarget: 2,
    researchesIsotopes: true, researchesRunner: false, researchesBreacher: false, scouts: false,
  },
  CASUAL: {
    share: 0.24, loginsPerDay: 2, defenceRatio: 0.9,
    buildOrder: ['REFINERY', 'CORE', 'EXTRACTOR', 'SHIPYARD', 'VAULT', 'HANGAR', 'DEUTERIUM_PLANT'],
    wants: ['UPLINK', 'RADAR', 'AEGIS', 'FOUNDRY'],
    // Two logins a day buys the cheap thing and moves on.
    composition: { WASP: 0.8, LANCE: 0.2 }, adaptsComposition: false,
    // Two logins a day buys what is cheap and available from the first minute.
    groundMix: { THORN: 0.7, BASTION: 0.3 },
    militaryShare: 0.4, attackChance: 0.2, miningChance: 0.35, prospectorTarget: 1,
    researchesIsotopes: false, researchesRunner: false, researchesBreacher: false, scouts: false,
  },
  GRINDER: {
    share: 0.12, loginsPerDay: 10, defenceRatio: 0.45,
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'EXTRACTOR', 'HANGAR', 'DEUTERIUM_PLANT'],
    wants: ['UPLINK', 'TELESCOPE', 'RADAR', 'VEIL', 'BEACON'],
    // The only archetype that reasons about its fleet. `composition` here is the
    // fallback for a Shipyard too low to offer a choice.
    composition: { WASP: 0.6, LANCE: 0.4 }, adaptsComposition: true,
    // Light-heavy: it expects to be hit by the same heavies it flies itself.
    groundMix: { BASTION: 0.4, THORN: 0.6 },
    militaryShare: 0.6, attackChance: 0.7, miningChance: 0.85, prospectorTarget: 2,
    researchesIsotopes: true, researchesRunner: true, researchesBreacher: true, scouts: true,
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as ArchetypeName[];
