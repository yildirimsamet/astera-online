/** Seconds between two ships of a formation entering (or leaving) the warp. */
export const WARP_STAGGER = 0.09;
/** One take of the lab loop. */
export const WARP_SECONDS = 4;

/** One ship's frame. `travel` is along the course in planet radii, from the spot it sits or stops. */
export interface WarpShip {
  visible: boolean;
  travel: number;
  /** Length over width of the hull; 1 is the ship as built. */
  stretch: number;
  engine: number;
  flash: number;
  streak: number;
  ring: number;
  /** Frame of the 16-frame swirl: it draws in, turns, then collapses. */
  ringFrame: number;
}

const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));
const AT_REST: WarpShip = { visible: true, travel: 0, stretch: 1, engine: 0.2, flash: 0, streak: 0, ring: 0, ringFrame: 0 };

/** The second ship `index` jumps (departing) or bursts out of the warp (arriving). */
export function warpSecond(mode: 'depart' | 'arrive', index: number): number {
  return (mode === 'depart' ? 1.9 : 0.7) + index * WARP_STAGGER;
}

/** Engines spool, the ship gathers speed, a swirl opens ahead; it stretches into light and is gone. */
export function departShip(index: number, seconds: number): WarpShip {
  if (!Number.isFinite(seconds) || seconds < 0) return AT_REST;
  const t = seconds;
  const jump = warpSecond('depart', index);
  const cruise = (s: number): number => 0.25 * s + 0.9 * Math.max(0, s - 1) ** 2;
  const travel = t < jump ? cruise(t) : cruise(jump) + 30 * (t - jump);
  return {
    visible: t < jump + 0.12,
    travel,
    stretch: 1 + 22 * ramp(t, jump - 0.06, 0.14) ** 2,
    engine: 0.2 + 0.8 * ramp(t, 0, 1),
    flash: t >= jump ? Math.max(0, 1 - (t - jump) / 0.32) ** 2 : 0,
    streak: t >= jump - 0.03 ? Math.max(0, 1 - (t - jump) / 0.45) : 0,
    ring: ramp(t, jump - 0.75, 0.2) * (1 - ramp(t, jump + 0.32, 0.16)),
    ringFrame: t < jump ? 7 * ramp(t, jump - 0.75, 0.75) : 7 + 8 * ramp(t, jump, 0.45),
  };
}

/** A streak of light comes in, bursts, and the ship is there — stretched, settling, braking to a stop. */
export function arriveShip(index: number, seconds: number): WarpShip {
  if (!Number.isFinite(seconds) || seconds < 0) return { ...AT_REST, visible: false };
  const t = seconds;
  const at = warpSecond('arrive', index);
  const settle = Math.exp(-(t - at) * 2.4);
  return {
    visible: t >= at - 0.02,
    travel: t < at ? -1.2 - 30 * (at - t) : -1.2 * settle,
    stretch: t < at ? 23 : 1 + 22 * Math.max(0, 1 - (t - at) / 0.16) ** 2,
    engine: t < at ? 0 : 0.25 + 0.75 * settle,
    flash: t >= at ? Math.max(0, 1 - (t - at) / 0.32) ** 2 : 0,
    streak: t >= at - 0.4 && t < at + 0.25 ? (t < at ? ramp(t, at - 0.4, 0.3) : 1 - (t - at) / 0.25) : 0,
    ring: ramp(t, at - 0.1, 0.1) * (1 - ramp(t, at + 0.55, 0.3)),
    ringFrame: 15 - 15 * ramp(t, at - 0.1, 0.95),
  };
}
