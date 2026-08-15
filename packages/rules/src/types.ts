/** Shared vocabulary for the whole game. No behaviour lives here. */

export type HullId = 'WASP' | 'LANCE' | 'BULWARK' | 'HAULER' | 'BASTION';
export type MobileHullId = Exclude<HullId, 'BASTION'>;
export type HullClass = 'SKIRMISHER' | 'LANCE' | 'BULWARK' | 'SUPPORT';

export type BuildingId = 'CORE' | 'REFINERY' | 'EXTRACTOR' | 'VAULT' | 'SHIPYARD' | 'RING';
export type SatelliteId = 'TELESCOPE' | 'RADAR' | 'AEGIS' | 'VEIL' | 'DRILL';
export const SATELLITE_IDS = ['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL', 'DRILL'] as const;

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
export type SatelliteLevels = Partial<Record<SatelliteId, number>>;

/** Everything the score function needs to value a planet. */
export interface Holdings {
  buildings: BuildingLevels;
  satellites: SatelliteLevels;
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
