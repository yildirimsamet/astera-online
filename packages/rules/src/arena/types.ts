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
export type ArenaObstacle = SphereObstacle | BoxObstacle;

export type StructureKind = 'hub' | 'gate' | 'outpost' | 'wreck' | 'relay';
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

export interface ArenaLayout {
  version: number;
  radius: number;
  halfHeight: number;
  entries: readonly Vec3[];
  exits: readonly Vec3[];
  obstacles: readonly ArenaObstacle[];
  structures: readonly ArenaStructure[];
  fields: readonly ArenaField[];
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
