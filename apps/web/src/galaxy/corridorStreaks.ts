/**
 * THE SPEED OF A CLAN CORRIDOR LEG, AS THE CRAFT ITSELF SHOWS IT (owner, 2026-11-24).
 *
 * The lane's own route already flows in the clan's green. The craft now burns a long, bright
 * plume and lane streaks rush back past it, so speed is read from what moves PAST the fleet, not
 * from a glow around it. Every other flight keeps its ordinary look.
 */
export interface CorridorSpeedLook {
  /** Lane streaks around the formation. */
  streaks: boolean;
  /** How much longer every engine plume reaches. */
  plume: number;
  /** How much brighter it burns. */
  intensity: number;
}

const ORDINARY: CorridorSpeedLook = { streaks: false, plume: 1, intensity: 1 };
const CORRIDOR: CorridorSpeedLook = { streaks: true, plume: 2.4, intensity: 1.25 };

export const corridorSpeedLook = (corridor: boolean | undefined): CorridorSpeedLook =>
  corridor === true ? CORRIDOR : ORDINARY;

/**
 * Where one streak sits on the heading axis, in `[-span / 2, span / 2]`. `offset` is its seed in
 * `[0, 1)`; `flow` is how far it runs backward each second, in the span's own units, so the craft
 * seems to overtake it.
 */
export function streakAlong(offset: number, seconds: number, span: number, flow: number): number {
  const phase = (((offset + seconds * flow / span) % 1) + 1) % 1;
  return span / 2 - phase * span;
}

/** One in the middle of the span, nothing at either end: a streak is born and dies unseen. */
export function streakFade(along: number, span: number): number {
  const edge = Math.min(1, Math.max(0, 1 - Math.abs(along) / (span / 2)));
  const k = Math.min(1, edge / 0.45);
  return k * k * (3 - 2 * k);
}
