/** Shared vocabulary for the whole game. No behaviour lives here. */

export type HullId =
  | 'WASP' | 'LANCE' | 'BULWARK' | 'HAULER'
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
export type BuildingId = 'CORE' | 'REFINERY' | 'EXTRACTOR' | 'VAULT' | 'SHIPYARD';
export const BUILDING_IDS = ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'] as const;
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

export type Grade = 'DECISIVE' | 'PARTIAL' | 'REPELLED';
export type ClarityState = 'FULL' | 'CLEAR' | 'INTERMITTENT' | 'DEGRADED' | 'BLIND';
export type FleetStatus = 'HOME' | 'AWAY' | 'UNKNOWN';
export type MissionKind = 'attack' | 'probe' | 'return';

/** A pile of ships. Absent keys mean zero. */
export type Fleet = Partial<Record<HullId, number>>;

export interface Resources {
  alloy: number;
  crystal: number;
}

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
}

/** Running tally behind the Dominion ladder. Sums to zero across a battle. */
export interface Ledger {
  taken: number;
  lost: number;
}
