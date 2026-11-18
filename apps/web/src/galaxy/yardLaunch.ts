type V = readonly [number, number, number];

/**
 * THE CRAFT A REPAIR HANDS OVER (plan 2026-11-18 §5 A11), in the colony ship's own model units, nose
 * along +X. Seconds: out of the cargo bay and round to a station beside the hull, held there a breath,
 * turned about on the spot, then back into the bay where it is kept (owner phone playtest 2026-11-18,
 * item 8: the ships used to burn away, and the player asked where they went); over at `total`.
 */
export const YARD_LAUNCH = { out: 2.2, hold: 0.9, turn: 0.4, back: 1.4, total: 4.9 } as const;
/** How far behind its station the turn is drawn: the ship swings round and comes up to it nose first. */
const SWING = 0.3;

const ease = (u: number): number => 1 - (1 - u) ** 3;
const smooth = (u: number): number => u * u * (3 - 2 * u);
const unit = (v: V): [number, number, number] => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** Where one of the craft is, and where its nose points, `t` seconds into the handover. */
export function yardLaunchAt(bay: V, slot: V, t: number): { at: [number, number, number]; facing: [number, number, number] } {
  if (t < YARD_LAUNCH.out) {
    const swing: V = [slot[0] - SWING, slot[1], slot[2]];
    const u = ease(Math.max(0, t) / YARD_LAUNCH.out);
    const point = (i: 0 | 1 | 2): number => (1 - u) ** 2 * bay[i] + 2 * (1 - u) * u * swing[i] + u ** 2 * slot[i];
    const along = (i: 0 | 1 | 2): number => (1 - u) * (swing[i] - bay[i]) + u * (slot[i] - swing[i]);
    return { at: [point(0), point(1), point(2)], facing: unit([along(0), along(1), along(2)]) };
  }
  // The bay's bearing in the ship's level plane: the craft turns to it and slides in level, nose first.
  const bearing = Math.atan2(bay[2] - slot[2], bay[0] - slot[0]);
  const turning = t - YARD_LAUNCH.out - YARD_LAUNCH.hold;
  if (turning < YARD_LAUNCH.turn) {
    // Held at its station, then turned about on the spot, the short way round, until it faces the bay.
    const angle = bearing * smooth(Math.max(0, turning) / YARD_LAUNCH.turn);
    return { at: [slot[0], slot[1], slot[2]], facing: [Math.cos(angle), 0, Math.sin(angle)] };
  }
  const u = smooth(Math.min(1, (turning - YARD_LAUNCH.turn) / YARD_LAUNCH.back));
  const point = (i: 0 | 1 | 2): number => slot[i] + (bay[i] - slot[i]) * u;
  return { at: [point(0), point(1), point(2)], facing: [Math.cos(bearing), 0, Math.sin(bearing)] };
}
