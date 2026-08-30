/** Shared vocabulary for the whole game. No behaviour lives here. */

export type HullId =
  | 'WASP' | 'LANCE' | 'BULWARK' | 'HAULER' | 'RUNNER' | 'BREACHER'
  | 'BASTION' | 'THORN'
  | 'PROSPECTOR';

/**
 * Never leaves the planet. TWO OF THEM, AND THAT IS THE POINT. D27.
 *
 * With a single ground hull its counter-class is a binary the design cannot win:
 * make it BULWARK-class and the cheapest ship in the game hard-counters every
 * defence anybody can build, so defence returns a third of its cost and nobody
 * buys it; make it LANCE-class and the only answer is a Shipyard-4 hull at twelve
 * times a Wasp, so raiding stops paying and sitting still wins the season. Both
 * branches were implemented and measured — see `docs/balance.md`.
 *
 * Two hulls in DIFFERENT classes turn that dead end into the decision the game is
 * about: the defender chooses what to be strong against, and the attacker has to
 * find out before they commit. "How much defence do they have" becomes "what KIND",
 * and that is a question only the information layer can answer.
 */
export type GroundHullId = 'BASTION' | 'THORN';

/**
 * Flies, but never on an attack. D19.
 *
 * Excluded from `MobileHullId` rather than merely refused at the launch endpoint,
 * so a mining craft cannot reach an attack fleet through any code path: it is not
 * in `MOBILE_HULLS`, so it contributes to neither `fleetSpeed` nor `fleetCargo`,
 * and the launch schema cannot name it.
 */
export type MiningHullId = 'PROSPECTOR';

export type MobileHullId = Exclude<HullId, GroundHullId | MiningHullId>;
export type HullClass = 'SKIRMISHER' | 'LANCE' | 'BULWARK' | 'SUPPORT';

/**
 * The five structures on the surface.
 *
 * The Orbital Ring is gone (D22). Its only job was rationing satellite slots, and
 * when satellites stopped being rationed it became a building you paid for and
 * received nothing from — the exact "paid no-op" the Drill had to be pulled from
 * the API for. Legacy `RING` rows may still exist in the database and are ignored
 * on read; nothing writes one.
 */
/**
 * THE HANGAR IS THE SIXTH, AND IT IS APPENDED. T4.
 *
 * `buildings.type` is plain text with no constraint and `buildingLevelsFrom` reads
 * a missing row as level 0, so a sixth building needs no migration and no backfill:
 * every existing world reads Hangar 0 on its next load. Appending rather than
 * inserting keeps that true for anything that has ever persisted an index.
 */
export type BuildingId =
  | 'CORE' | 'REFINERY' | 'EXTRACTOR' | 'VAULT' | 'SHIPYARD' | 'HANGAR' | 'DEUTERIUM_PLANT';
export const BUILDING_IDS = [
  'CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'HANGAR', 'DEUTERIUM_PLANT',
] as const;
/**
 * TWO KINDS OF HARDWARE, AND THEY ARE NOT ALIKE. D25.
 *
 * They used to be one list of five, all competing for the same orbit slots, and the
 * owner's verdict on it was blunt and correct: it was a muddle. A telescope is not
 * a satellite, a drill is a craft, and a shield sits on the planet it protects.
 *
 * INSTRUMENTS are on the ground and they are LEVELLED. They are what the
 * information game is made of, so each one has a ladder: a Telescope's reach and
 * slots, a Radar's warning minutes, an Aegis's shield, a Veil's concealment. Every
 * one of them ships with three renders, which is what a ladder looks like.
 *
 * SATELLITES are in orbit, they take a SLOT, and they are BUILT ONCE. No levels —
 * a satellite is a thing you have or do not. Each one changes a different number
 * across the whole planet, so which ones you can run at once is the identity choice
 * the design has always wanted, and the Command Core is what opens the slots.
 */
export type InstrumentId = 'TELESCOPE' | 'RADAR' | 'AEGIS' | 'VEIL';
export const INSTRUMENT_IDS = ['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL'] as const;

export type SatelliteId = 'FOUNDRY' | 'UPLINK' | 'DERRICK' | 'BEACON';
export const SATELLITE_IDS = ['FOUNDRY', 'UPLINK', 'DERRICK', 'BEACON'] as const;

/**
 * Which of the two an id belongs to.
 *
 * The two spaces are disjoint on purpose, so anywhere that holds "a piece of
 * hardware the player wants" can hold either and ask here which one it got.
 */
export function isSatellite(id: InstrumentId | SatelliteId): id is SatelliteId {
  return (SATELLITE_IDS as readonly string[]).includes(id);
}

/**
 * ALL A STRANGER IS ENTITLED TO KNOW ABOUT A CRAFT IN TRANSIT. D123.
 *
 * A silhouette, not a roster. The public payload used to carry the whole fleet,
 * which is precisely what Radar L4 and L5 are sold for — so the ladder was being
 * given away by the disc and the two instruments that SEE had nothing left to
 * sell. Three steps for the same reason `worldWeight` has three: a continuous
 * size is a number no eye can separate.
 */
export type MassClass = 'LIGHT' | 'MEDIUM' | 'HEAVY';

export type Grade = 'DECISIVE' | 'PARTIAL' | 'REPELLED';
export type ClarityState = 'FULL' | 'CLEAR' | 'INTERMITTENT' | 'DEGRADED' | 'BLIND';
export type FleetStatus = 'HOME' | 'AWAY' | 'UNKNOWN';
export type MissionKind =
  | 'attack'
  | 'probe'
  | 'return'
  | 'transfer'
  | 'clan_transfer'
  | 'settlement'
  | 'death_star';

export type PlanetKind = 'CAPITAL' | 'COLONY' | 'NEUTRAL';
export type NeutralTier = 1 | 2 | 3;
export type NeutralReserve = 'EMPTY' | 'LOW' | 'RICH';
export type NeutralThreat = 'UNGUARDED' | 'GUARDED' | 'FORTIFIED';
export type StrategicAssetStatus = 'BUILDING' | 'PAUSED' | 'READY' | 'LAUNCHED' | 'CONSUMED';

/** A pile of ships. Absent keys mean zero. */
export type Fleet = Partial<Record<HullId, number>>;

export interface Resources {
  alloy: number;
  crystal: number;
  deuterium: number;
}

/** Seasonal permissions, never account power and never levelled. D93. */
export type ResearchProjectId =
  | 'ISOTOPE_SPECTROMETRY'
  | 'DENSE_FUEL_CELLS'
  | 'GRAVITIC_CHARGES'
  | 'DEATH_STAR_PROTOCOL'
  | 'DEUTERIUM_SYNTHESIS'
  | 'YARD_AUTOMATION'
  | 'PROSPECTOR_HOLDS'
  | 'CARGO_HOLDS'
  | 'WASP_DOCTRINE'
  | 'LANCE_DOCTRINE'
  | 'BULWARK_DOCTRINE'
  | 'EMPLACEMENT_DOCTRINE'
  | 'WEAPONS_GENERAL'
  | 'INTERCEPTION_GRID'
  | 'STRATEGIC_STOCKPILE';
export const RESEARCH_PROJECT_IDS = [
  'ISOTOPE_SPECTROMETRY',
  'DENSE_FUEL_CELLS',
  'GRAVITIC_CHARGES',
  'DEATH_STAR_PROTOCOL',
  /**
   * THE FIRST LEVELLED PROJECT, and the reason T7 built a ladder into the model.
   * Appended, never inserted: a stored `project_id` is a string, but an id list
   * that reorders is one more thing that can silently disagree with a snapshot.
   */
  'DEUTERIUM_SYNTHESIS',
  /** The economy and logistics ladders. T8. */
  'YARD_AUTOMATION',
  'PROSPECTOR_HOLDS',
  'CARGO_HOLDS',
  /** Four doctrines and one general armour project. T9. */
  'WASP_DOCTRINE',
  'LANCE_DOCTRINE',
  'BULWARK_DOCTRINE',
  'EMPLACEMENT_DOCTRINE',
  'WEAPONS_GENERAL',
  /** The two strategic projects: one stops a weapon, one keeps a second on the pad. T10/T11. */
  'INTERCEPTION_GRID',
  'STRATEGIC_STOCKPILE',
] as const;

export interface Hull {
  readonly id: HullId;
  readonly name: string;
  readonly cls: HullClass;
  readonly atk: number;
  readonly hp: number;
  /** Zero for ground units — they never travel. */
  readonly speed: number;
  readonly cargo: number;
  readonly alloy: number;
  readonly crystal: number;
  readonly deuterium: number;
  readonly minShipyard: number;
  readonly ground: boolean;
}

/** Every rule that needs randomness takes it as an argument. Never `Math.random`. */
export type Rng = () => number;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BuildingLevels = Record<BuildingId, number>;

/** Instrument levels, by known key. Absent means not built. */
export type InstrumentLevels = Partial<Record<InstrumentId, number>>;

/**
 * Which satellites are in orbit. Presence is the whole state.
 *
 * A set rather than a level map, because that is what a satellite IS under D25 —
 * modelling it as `Partial<Record<Id, number>>` would leave a level field for
 * somebody to start reading, and a number nobody may raise is an invitation.
 */
export type SatelliteSet = readonly SatelliteId[];

/** Everything the score function needs to value a planet. */
export interface Holdings {
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  satellites: SatelliteSet;
  fleet: Fleet;
  ground: Fleet;
  alloy: number;
  crystal: number;
  deuterium: number;
}

/** Running positive and negative transfers behind the zero-sum Dominion ladder. */
export interface Ledger {
  taken: number;
  lost: number;
}
