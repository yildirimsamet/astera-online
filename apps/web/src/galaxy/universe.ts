import { starterGalaxyCentre, toWorld, type Vec3, type Vec3Tuple } from '@astera/rules';
import type { UniverseView } from '../api/starterSchemas.js';

export interface UniverseBall {
  ordinal: number;
  ships: number;
  own: boolean;
  position: Vec3Tuple;
  /** World units across. */
  size: number;
}

/** A galaxy's own width on this map, so that a ball stands about where its ships would. */
const BALL_MIN = 30;
const BALL_MAX = 52;
const FULL_SHIPS = 30;

/** Each galaxy at its real place, in the scene of someone standing `offset` from the main galaxy. */
export function universeBalls(galaxies: UniverseView['galaxies'], mine: number | null, offset: Vec3): UniverseBall[] {
  const listed = mine === null || galaxies.some(galaxy => galaxy.ordinal === mine) ? galaxies : [...galaxies, { ordinal: mine, ships: 1 }];
  return listed.map(({ ordinal, ships }) => {
    const { x, y, z } = starterGalaxyCentre(ordinal);
    return {
      ordinal,
      ships,
      own: ordinal === mine,
      position: toWorld({ x: x + offset.x, y: y + offset.y, z: z + offset.z }),
      size: BALL_MIN + (BALL_MAX - BALL_MIN) * Math.sqrt(Math.min(1, ships / FULL_SHIPS)),
    };
  });
}

/** Room around the farthest ball and the main galaxy's own edge. */
const MARGIN = 1.25;
const VERTICAL_FOV = 45;
/** Below this share of the view's distance, zooming in has left the universe. */
export const UNIVERSE_CLOSE_SHARE = 0.5;

/** Zooming well back in leaves the view. `opened` is this opening's own range, 0 until it has one. */
export function zoomedBackIn(range: number, opened: number): boolean {
  return opened > 0 && range < opened * UNIVERSE_CLOSE_SHARE;
}

/**
 * Back to where the player was, or to a focused subject where it is by now. Aboard, with nothing focused,
 * it ends on the ship: the pinch that opened this view had already pulled the camera off it.
 */
export function universeReturn(saved: readonly number[], subject: readonly number[] | null, home: readonly number[] | null = null): { to: readonly number[]; mode: 'follow' | 'manual'; acquired: boolean; home?: true } {
  if (subject) return { to: subject, mode: 'follow', acquired: true };
  return home ? { to: home, mode: 'manual', acquired: false, home: true } : { to: saved, mode: 'manual', acquired: false };
}

export interface UniverseFrame {
  centre: Vec3Tuple;
  distance: number;
  /** From the centre towards the camera. */
  direction: Vec3Tuple;
}

/** About what the main galaxy's glow covers on the map, seen from any side. */
const MAIN_DISC = 100;
const VIEW_ANGLES = 64;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * From above, at the angle that hides the fewest galaxies in line with the main one, and never your
 * own. The opening pose looks through your ship at the main galaxy, so without this your own galaxy
 * would always stand right in front of it.
 */
function clearestAngle(balls: readonly UniverseBall[], centre: Vec3Tuple): Vec3Tuple {
  const relative = balls.map(({ position, own }) => ({
    own, x: position[0] - centre[0], y: position[1] - centre[1], z: position[2] - centre[2],
  }));
  let best: Vec3Tuple = [0, 0.6, 0.8], bestScore = Infinity;
  for (let i = 0; i < VIEW_ANGLES; i++) {
    const y = 0.3 + 0.5 * (i / (VIEW_ANGLES - 1));
    const across = Math.sqrt(1 - y * y), turn = i * GOLDEN_ANGLE;
    const direction: Vec3Tuple = [across * Math.cos(turn), y, across * Math.sin(turn)];
    let score = 0;
    for (const ball of relative) {
      const along = ball.x * direction[0] + ball.y * direction[1] + ball.z * direction[2];
      const beside = Math.sqrt(Math.max(0, ball.x * ball.x + ball.y * ball.y + ball.z * ball.z - along * along));
      if (beside < MAIN_DISC) score += ball.own ? 1000 : 1;
    }
    if (score < bestScore) { best = direction; bestScore = score; }
  }
  return best;
}

/** Around the main galaxy, far enough back to hold every ball in the narrower side of the screen. */
export function universeFrame(balls: readonly UniverseBall[], offset: Vec3, aspect: number): UniverseFrame {
  const centre = toWorld(offset);
  const reach = Math.max(...balls.map(({ position, size }) =>
    Math.hypot(position[0] - centre[0], position[1] - centre[1], position[2] - centre[2]) + size / 2));
  const half = Math.atan(Math.tan((VERTICAL_FOV / 2) * Math.PI / 180) * Math.min(1, aspect));
  return { centre, distance: (reach * MARGIN) / Math.tan(half), direction: clearestAngle(balls, centre) };
}

/** Which names fit on the screen, the first in the list choosing first. Measured from what is shown. */
export function declutterLabels(
  labels: readonly { id: number; x: number; y: number }[],
  box: { width: number; height: number },
): Set<number> {
  const placed: { id: number; x: number; y: number }[] = [];
  for (const label of labels) {
    if (!placed.some(other => Math.abs(other.x - label.x) < box.width && Math.abs(other.y - label.y) < box.height)) placed.push(label);
  }
  return new Set(placed.map(label => label.id));
}

/** Gesture units: a mouse wheel tick is about a third of the way, a short pinch is most of it. */
export const OVERSCROLL_PER_WHEEL_PIXEL = 1 / 300;
export const OVERSCROLL_PER_PINCH_PIXEL = 1 / 90;

/**
 * "A LITTLE MORE" PAST THE ZOOM LIMIT. Pushing against the limit builds up until it opens the view, so
 * a zoom that merely reaches the limit does not. Anything else starts over.
 */
export function nextOverscroll(held: number, push: number, atLimit: boolean): { held: number; open: boolean } {
  if (!atLimit || push <= 0) return { held: 0, open: false };
  const next = held + push;
  return next >= 1 ? { held: 0, open: true } : { held: next, open: false };
}
