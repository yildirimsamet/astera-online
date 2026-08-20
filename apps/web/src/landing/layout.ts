import * as THREE from 'three';

/**
 * PLACE THINGS ON THE SCREEN, NOT IN THE WORLD.
 *
 * The landing composition is a picture, and a picture has to survive being looked
 * at through a 390×844 phone and a 2560-wide desktop. World coordinates cannot do
 * that: a planet at `x = -4.4` sits comfortably left-of-centre in landscape and is
 * almost entirely off the edge in portrait, because a perspective camera's
 * horizontal reach is its vertical reach times the aspect ratio — and portrait
 * aspect is under a half.
 *
 * That is not a hypothetical. The first version of this scene was composed on a
 * wide window and showed, on a phone, a dark arc in the corner and a lot of empty
 * space.
 *
 * So the composition is authored in NORMALISED SCREEN COORDINATES — `u` from −1 at
 * the left edge to +1 at the right, `v` from −1 at the bottom to +1 at the top —
 * plus a depth in world units in front of the camera. This converts. A phone gets
 * the same picture as a desktop, cropped by nothing.
 */

export interface Framing {
  /** Vertical field of view, in degrees. */
  fov: number;
  /** Rendered width ÷ height. */
  aspect: number;
  /** Where the camera is on Z, looking toward −Z. */
  cameraZ: number;
}

/** Full world height of the view at `depth` units in front of the camera. */
export const heightAt = (framing: Framing, depth: number): number =>
  2 * Math.tan((framing.fov * Math.PI) / 360) * depth;

/**
 * A point on screen, at a chosen depth, as world coordinates.
 *
 * `u` and `v` are edge-relative, so |u| > 1 is deliberately off-screen — which is
 * how a planet is made to break the frame rather than sit inside it.
 */
export function place(
  framing: Framing,
  u: number,
  v: number,
  depth: number,
): [number, number, number] {
  const h = heightAt(framing, depth);
  const w = h * framing.aspect;
  return [(u * w) / 2, (v * h) / 2, framing.cameraZ - depth];
}

export const placeVector = (
  framing: Framing,
  u: number,
  v: number,
  depth: number,
): THREE.Vector3 => new THREE.Vector3(...place(framing, u, v, depth));

/**
 * A size given as a fraction of the view's HEIGHT at that depth.
 *
 * Height rather than width on purpose: height is the stable dimension between a
 * phone and a desktop, so "the hero world is two thirds as tall as the screen" is
 * a promise that survives both. Sizing by width would make the planet grow every
 * time the window got wider.
 */
export const sizeOf = (framing: Framing, fraction: number, depth: number): number =>
  heightAt(framing, depth) * fraction;
