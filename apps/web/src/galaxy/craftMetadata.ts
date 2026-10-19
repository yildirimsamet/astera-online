/** Pure measured craft metadata. Importing artwork must not load the renderer. */
export type Facing = '+x' | '-x' | '+z' | '-z' | number | readonly [number, number, number];

/** Owner-reviewed correction applied after a craft is centred and aimed onto +Z. */
export interface CraftPose {
  /** Additive Three.js XYZ Euler angles, kept in editable degrees. */
  readonly rotation: readonly [number, number, number];
  /** Vertical offset in the caller's local normalised model space. */
  readonly height: number;
}

/**
 * The bearing of a nose, from the direction it points in its own file.
 *
 * Takes the X and Z of the measured nose vector — the axis of the body, signed
 * toward the pointed end — and returns the facing this file understands. Written
 * as a call at the declaration site so the numbers that were measured stay
 * visible there rather than being pre-baked into a radian nobody can check.
 */
export const noseBearing = (x: number, z: number): number => Math.atan2(x, z);

/** A measured 3D nose axis. Unlike a bearing, this can correct authored pitch. */
export const noseVector = (x: number, y: number, z: number): readonly [number, number, number] =>
  [x, y, z] as const;
