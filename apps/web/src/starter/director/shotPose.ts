/**
 * WHERE THE CAMERA GOES FOR A SHOT (plan 2026-11-18, Faz 5.1): the subject at the centre, at the shot's
 * range, seen from the side the camera already looks from, or swung round it by the shot's turn about
 * the vertical. The height of the view is kept, so a turn reads as a walk round the subject.
 */
type Vec = readonly [number, number, number];

export interface ShotAim {
  to: Vec;
  range: number;
  turn?: number | undefined;
  /** The side to look from, when the subject has one of its own (a bay): it outranks the turn. */
  towards?: Vec | undefined;
}
export interface ShotPose { to: [number, number, number]; range: number; towards: [number, number, number] }

export function shotPose(view: { target: Vec; camera: Vec }, aim: ShotAim): ShotPose {
  if (aim.towards) return { to: [aim.to[0], aim.to[1], aim.to[2]], range: aim.range, towards: [aim.towards[0], aim.towards[1], aim.towards[2]] };
  const dx = view.camera[0] - view.target[0];
  const dy = view.camera[1] - view.target[1];
  const dz = view.camera[2] - view.target[2];
  const turn = aim.turn ?? 0;
  const x = dx * Math.cos(turn) + dz * Math.sin(turn);
  const z = -dx * Math.sin(turn) + dz * Math.cos(turn);
  const length = Math.hypot(x, dy, z) || 1;
  return { to: [aim.to[0], aim.to[1], aim.to[2]], range: aim.range, towards: [x / length, dy / length, z / length] };
}

/** How far above the hull's plane a bay is looked at from: low enough that the hull runs away behind it. */
const BAY_LIFT = 0.7;

/**
 * The side a bay is seen from (live play 2026-11-18): outward from the hull's centre and a little above,
 * so the bay is in front and the rest of the ship stretches away behind it. A bay at the centre has no
 * outside: null, and the shot keeps the side the camera is on.
 */
export function bayView(bay: Vec, centre: Vec): [number, number, number] | null {
  const dx = bay[0] - centre[0];
  const dz = bay[2] - centre[2];
  const flat = Math.hypot(dx, dz);
  if (flat < 1e-6) return null;
  const length = Math.hypot(1, BAY_LIFT);
  return [dx / flat / length, BAY_LIFT / length, dz / flat / length];
}

/**
 * Where a scene about the ship ends (live play 2026-11-18): on the ship at its own range, seen from the
 * side the player looked from before the scene, never on the last close-up nor back out at a far view.
 */
export function returnPose(view: { target: Vec; camera: Vec }, ship: Vec, range: number): ShotPose {
  return shotPose(view, { to: ship, range });
}

/**
 * How long the camera stays on a scene's last shot before it flies home, seconds (live play
 * 2026-11-18): a scene that follows within it (a short repair coming back) starts where the camera is,
 * instead of the camera going home and straight back.
 */
export const SHOT_RETURN_HOLD = 1.6;
/** The flight back to the player's own view once a scene has ended, seconds. */
export const SHOT_RETURN_SECONDS = 0.9;
/** From a scene's end until the camera is the player's view again: the hold, then the flight home. */
export const SHOT_HOME_MS = Math.round((SHOT_RETURN_HOLD + SHOT_RETURN_SECONDS) * 1000);

/** The flight home once a scene has ended: none when it ended on a subject that stays, or began nowhere. */
export function homeward(view: { target: Vec; camera: Vec } | null, stays: boolean, ship: Vec, range: number): { pose: ShotPose; hold: number } | null {
  if (!view || stays) return null;
  return { pose: returnPose(view, ship, range), hold: SHOT_RETURN_HOLD };
}

/** The shot as the camera rig takes it: a key per shot, the subject read when it starts, a flight time. */
export interface DirectorShot {
  key: number;
  at: () => [number, number, number] | null;
  range: number;
  turn?: number | undefined;
  /** The side to look from, read when the shot starts. */
  towards?: (() => [number, number, number] | null) | undefined;
  /** A scene that ends on this shot leaves the camera on its subject (a rock, a contact), not on the ship. */
  stays?: boolean | undefined;
  seconds: number;
}
