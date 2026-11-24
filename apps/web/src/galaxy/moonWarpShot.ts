type Vec = readonly [number, number, number];

/** How far above the jump line the camera sits, as an angle seen from the departing moon's back. */
const LIFT_DEG = 20;
/** How far the view dips below the jump line: the departing moon lands low, the destination high. */
const LOOK_DEG = 12;

/**
 * THE MOON GATE WARP SHOT (owner, 2026-11-24). A little behind and a little above the departing moon,
 * looking down the jump line: the departing moon is the foreground in the lower frame and the destination
 * moon lies ahead in the upper frame, whatever the distance between them. Both stay on the frame's centre
 * column, so a portrait phone keeps them as well as a wide screen.
 *
 * `world` is the departing moon's own planet. The shot is taken from straight above the jump line; when that
 * world would stand between the camera and either moon, the camera swings round the line (15° steps up to 45°,
 * either side) to the first angle that sees past it, staying above.
 *
 * `back` is how far behind the departing moon the camera stands. The shot orbits around a point beside
 * the departing moon, so a player who turns the camera turns it around the jump's start.
 */
export function moonWarpPose(origin: Vec, dest: Vec, back: number, world?: { centre: Vec; radius: number }): { at: [number, number, number]; towards: [number, number, number]; range: number } {
  let ax = dest[0] - origin[0];
  let ay = dest[1] - origin[1];
  let az = dest[2] - origin[2];
  const length = Math.hypot(ax, ay, az) || 1;
  ax /= length; ay /= length; az /= length;
  // "Above" is the galaxy's up made square to the jump line (a jump straight up borrows the x axis).
  let [px, py, pz] = Math.abs(ay) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const along = px * ax + py * ay + pz * az;
  px -= along * ax; py -= along * ay; pz -= along * az;
  const size = Math.hypot(px, py, pz) || 1;
  px /= size; py /= size; pz /= size;
  // The other square direction, to swing round the line.
  const sx = ay * pz - az * py, sy = az * px - ax * pz, sz = ax * py - ay * px;
  const lift = back * Math.tan((LIFT_DEG * Math.PI) / 180);
  const look = (LOOK_DEG * Math.PI) / 180;
  const range = Math.hypot(back, lift);
  const shot = (swing: number) => {
    const ux = px * Math.cos(swing) + sx * Math.sin(swing);
    const uy = py * Math.cos(swing) + sy * Math.sin(swing);
    const uz = pz * Math.cos(swing) + sz * Math.sin(swing);
    const camera: [number, number, number] = [origin[0] - ax * back + ux * lift, origin[1] - ay * back + uy * lift, origin[2] - az * back + uz * lift];
    const dir = [ax * Math.cos(look) - ux * Math.sin(look), ay * Math.cos(look) - uy * Math.sin(look), az * Math.cos(look) - uz * Math.sin(look)] as const;
    return { camera, dir };
  };
  const clear = (camera: readonly number[], target: Vec): boolean => {
    if (!world) return true;
    // Distance from the world's centre to the segment camera → target.
    const dx = target[0] - camera[0]!, dy = target[1] - camera[1]!, dz = target[2] - camera[2]!;
    const wx = world.centre[0] - camera[0]!, wy = world.centre[1] - camera[1]!, wz = world.centre[2] - camera[2]!;
    const t = Math.max(0, Math.min(1, (wx * dx + wy * dy + wz * dz) / (dx * dx + dy * dy + dz * dz || 1)));
    return Math.hypot(wx - dx * t, wy - dy * t, wz - dz * t) > world.radius * 1.1;
  };
  const swings = [0, 1, -1, 2, -2, 3, -3].map((step) => (step * Math.PI) / 12);
  const chosen = swings.map(shot).find((s) => clear(s.camera, dest) && clear(s.camera, origin)) ?? shot(0);
  const { camera, dir } = chosen;
  return {
    at: [camera[0] + dir[0] * range, camera[1] + dir[1] * range, camera[2] + dir[2] * range],
    towards: [-dir[0], -dir[1], -dir[2]],
    range,
  };
}
