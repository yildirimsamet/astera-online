/** Second the drill's nose touches the rock. */
export const DIG_START = 1.2;
/** Second it backs off with a full hold. */
export const DIG_END = 3.2;

/** One frame of the dig. `gap` is how far the nose stands off the rock, in drill lengths. */
export interface MineFrame {
  gap: number;
  /** 0..1 how hard the sparks spray. */
  sparks: number;
  /** 0..1 the cut's glow on the rock. */
  heat: number;
  /** 0..1 how full the hold is. */
  cargo: number;
  /** 0..1 how fast the drill turns. */
  spin: number;
}

const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));
const WAITING: MineFrame = { gap: 2.2, sparks: 0, heat: 0, cargo: 0, spin: 0 };

/** Arrive slowing, bite and spin with sparks and a glowing cut, back off with the hold lit. */
export function mineFrame(seconds: number): MineFrame {
  if (!Number.isFinite(seconds) || seconds < 0) return WAITING;
  const t = seconds;
  const digging = t >= DIG_START && t < DIG_END;
  const approach = ramp(t, 0, DIG_START);
  const leave = ramp(t, DIG_END, 1.1);
  return {
    gap: t < DIG_START ? 2.2 * (1 - approach) ** 2 : 1.6 * leave ** 2,
    sparks: digging ? ramp(t, DIG_START, 0.15) * (1 - ramp(t, DIG_END - 0.2, 0.2)) : 0,
    heat: t < DIG_START ? 0 : ramp(t, DIG_START, 0.6) * (1 - ramp(t, DIG_END, 0.5)),
    cargo: ramp(t, DIG_START + 0.2, DIG_END - DIG_START - 0.2),
    spin: digging ? ramp(t, DIG_START, 0.25) : 0,
  };
}
