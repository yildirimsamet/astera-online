type Vec = readonly [number, number, number];

/** How far above the jump line the camera sits, as an angle seen from the departing moon's back. */
const LIFT_DEG = 22;
/** How far the view dips below the jump line: the departing moon lands low, the destination high. */
const LOOK_DEG = 10;

/**
 * THE MOON GATE WARP SHOT (owner, 2026-11-24). A little behind and a little above the departing moon,
 * looking down the jump line: the departing moon is the foreground in the lower frame and the destination
 * moon lies ahead in the upper frame, whatever the distance between them. Both stay on the frame's centre
 * column, so a portrait phone keeps them as well as a wide screen.
 *
 * `back` is how far behind the departing moon the camera stands. The shot orbits around a point beside
 * the departing moon, so a player who turns the camera turns it around the jump's start.
 */
export function moonWarpPose(origin: Vec, dest: Vec, back: number): { at: [number, number, number]; towards: [number, number, number]; range: number } {
  let ax = dest[0] - origin[0];
  let ay = dest[1] - origin[1];
  let az = dest[2] - origin[2];
  const length = Math.hypot(ax, ay, az) || 1;
  ax /= length; ay /= length; az /= length;
  // "Above" is the galaxy's up, made square to the jump line; a jump straight up borrows the x axis.
  let [ux, uy, uz] = Math.abs(ay) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const along = ux * ax + uy * ay + uz * az;
  ux -= along * ax; uy -= along * ay; uz -= along * az;
  const up = Math.hypot(ux, uy, uz) || 1;
  ux /= up; uy /= up; uz /= up;

  const lift = back * Math.tan((LIFT_DEG * Math.PI) / 180);
  const camera = [origin[0] - ax * back + ux * lift, origin[1] - ay * back + uy * lift, origin[2] - az * back + uz * lift];
  const look = (LOOK_DEG * Math.PI) / 180;
  const dir = [ax * Math.cos(look) - ux * Math.sin(look), ay * Math.cos(look) - uy * Math.sin(look), az * Math.cos(look) - uz * Math.sin(look)];
  const range = Math.hypot(back, lift);
  return {
    at: [camera[0]! + dir[0]! * range, camera[1]! + dir[1]! * range, camera[2]! + dir[2]! * range],
    towards: [-dir[0]!, -dir[1]!, -dir[2]!],
    range,
  };
}
