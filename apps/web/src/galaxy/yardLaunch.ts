type V = readonly [number, number, number];

/**
 * THE FIRST SHIPS LEAVE THE YARD (plan 2026-11-18 §5 A11), in the colony ship's own model units, nose
 * along +X. Seconds: out of the bay and round to a station beside the hull, held there a breath, then
 * away ahead of the ship; the launch is over at `total`.
 */
export const YARD_LAUNCH = { out: 2.2, hold: 0.9, total: 5.2 } as const;
/** How far behind its station the turn is drawn: the ship swings round and comes up to it nose first. */
const SWING = 0.3;
/** Model units per second squared, away ahead of the hull. */
const AWAY = 1.6;

const ease = (u: number): number => 1 - (1 - u) ** 3;
const unit = (v: V): [number, number, number] => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** Where one of the first ships is, and where its nose points, `t` seconds into the launch. */
export function yardLaunchAt(bay: V, slot: V, t: number): { at: [number, number, number]; facing: [number, number, number] } {
  if (t < YARD_LAUNCH.out) {
    const swing: V = [slot[0] - SWING, slot[1], slot[2]];
    const u = ease(Math.max(0, t) / YARD_LAUNCH.out);
    const point = (i: 0 | 1 | 2): number => (1 - u) ** 2 * bay[i] + 2 * (1 - u) * u * swing[i] + u ** 2 * slot[i];
    const along = (i: 0 | 1 | 2): number => (1 - u) * (swing[i] - bay[i]) + u * (slot[i] - swing[i]);
    return { at: [point(0), point(1), point(2)], facing: unit([along(0), along(1), along(2)]) };
  }
  const away = Math.max(0, t - YARD_LAUNCH.out - YARD_LAUNCH.hold);
  return { at: [slot[0] + 0.5 * AWAY * away ** 2, slot[1], slot[2]], facing: [1, 0, 0] };
}
