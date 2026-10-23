import type { ArenaMesh } from './mesh.js';

export interface Vec3 { x: number; y: number; z: number }
export interface Quaternion extends Vec3 { w: number }

/**
 * Sampled intent; steering has 0.001 resolution, throttle 0.01. `assistX/Y` is the
 * aim-assist channel: a direct fraction of the turn rate, added after the stick curve
 * and clamped to `assistMax` by the simulation itself.
 */
export interface FlightInput {
  steerX: number;
  steerY: number;
  throttle: number;
  turbo: boolean;
  assistX: number;
  assistY: number;
  /** LAND is flying the approach: a slow touch on any surface lands, not only on a deposit. */
  land?: boolean;
}
export interface SteeringSettings { sensitivity: number; invertPitch: boolean }
export interface FlightState {
  p: Vec3;
  q: Quaternion;
  s: number;
  throttle: number;
  omegaYaw: number;
  omegaPitch: number;
  fuel: number;
  /** Obstacle index + 1 while resting on a surface; 0 while flying free. */
  landed: number;
  /** Outward surface normal of the landing contact (unit, valid while landed). */
  nx: number;
  ny: number;
  nz: number;
  /** Lowest throttle seen since touchdown. Take-off needs more than this. */
  landThrottle: number;
  /** Remaining ticks of the take-off lift along the old surface normal. */
  liftoff: number;
  /** Strength of this tick's hard contact, 0..1 (presentation and audio only). */
  bump: number;
  /** Knock-back velocity from a bounce (m/s, world space); decays on its own. */
  kx: number;
  ky: number;
  kz: number;
}

export type ObstacleKind = 'rock' | 'crystal' | 'structure';
export interface SphereObstacle {
  id: number;
  kind: ObstacleKind;
  shape: 'sphere';
  p: Vec3;
  radius: number;
}
/**
 * A box turned about the vertical axis only. (ux, uz) is the unit local +X axis in
 * world XZ; local +Z is (-uz, ux). `radius` bounds the whole box for broad-phase.
 */
export interface BoxObstacle {
  id: number;
  kind: 'structure';
  shape: 'box';
  p: Vec3;
  hx: number;
  hy: number;
  hz: number;
  ux: number;
  uz: number;
  radius: number;
}
/**
 * A triangle-mesh collider (Y2): `layout.meshes[mesh]` turned by q and scaled uniformly,
 * centred on p. `radius` bounds it in metres for the broad phase.
 */
export interface MeshObstacle {
  id: number;
  kind: ObstacleKind;
  shape: 'mesh';
  p: Vec3;
  q: Quaternion;
  scale: number;
  mesh: number;
  radius: number;
}
export type ArenaObstacle = SphereObstacle | BoxObstacle | MeshObstacle;

/**
 * The heart's station, an exit dock, the wreck, the cave (Kovuk), the abandoned station (Sessiz
 * Liman), and from the station kit (V6d) the frontier outposts, the heart's refinery wings,
 * Sessiz Liman's annex and Tersane (Gangut's ring between two kit depots).
 */
export type StructureKind = 'hub' | 'dock' | 'wreck' | 'cave' | 'canyon' | 'honeycomb' | 'station' | 'outpost' | 'refinery' | 'annex' | 'yard';
/** Presentation anchor for a built structure; its gameplay shape is `colliders`. */
export interface ArenaStructure {
  id: number;
  kind: StructureKind;
  p: Vec3;
  ux: number;
  uz: number;
  scale: number;
  colliders: readonly number[];
  /** Colliders whose top face is a marked landing deck. */
  decks: readonly number[];
}
export interface ArenaField { p: Vec3; radius: number; height: number; dense: boolean }
/** A dust cloud (V6f): a sphere that cuts sight past `dustSight` metres of depth. */
export interface ArenaDust { p: Vec3; radius: number }

export interface ArenaLayout {
  version: number;
  radius: number;
  halfHeight: number;
  entries: readonly Vec3[];
  exits: readonly Vec3[];
  obstacles: readonly ArenaObstacle[];
  /** Collider meshes the mesh obstacles place (Y2). */
  meshes: readonly ArenaMesh[];
  structures: readonly ArenaStructure[];
  fields: readonly ArenaField[];
  dust: readonly ArenaDust[];
  /** Clear points where field farms float; a piece taken grows back on another one. */
  farmSpots: readonly Vec3[];
  /**
   * Obstacle indices of mineable deposits (land on one and mine), in a fixed order
   * shared by every peer: crystal formations plus alloy- and deuterium-veined rock.
   */
  deposits: readonly number[];
  /** Farm kind of each deposit, parallel to `deposits` (index into FARM_KINDS). */
  depositKinds: readonly number[];
}
