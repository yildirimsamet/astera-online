import type { MiningRun } from '../api/schemas.js';

/*
  THE DIG AT A PROSPECTOR'S ROCK (owner approved the lab dig, 2026-11-12). The run used to turn home the
  instant it arrived with nothing drawn between. The drill now stops on its target's near face
  (`runPosition`'s reach), bites for `DIG_SECONDS` with sparks, dust and a glowing cut, and when the
  server's answer is a full hold the chunks fly in and it backs off with the hold lit. Purely drawn:
  the rules and every time stay as they were. An empty answer stops the bite — there was nothing left.
*/

/** How long the drill bites. */
export const DIG_SECONDS = 2;
/** After the bite: the cut cools and the dust settles while the drill eases away. */
export const DIG_TAIL_SECONDS = 0.8;

export interface DigFrame {
  /** 0..1 how hard the sparks spray. */
  sparks: number;
  /** 0..1 the cut's glow. */
  heat: number;
  /** 0..1 how full the hold is. */
  cargo: number;
  /** 0..1 how fast the drill turns. */
  spin: number;
}

type DigRun = Pick<MiningRun, 'status' | 'arriveAt' | 'homeAt' | 'recalledAt' | 'minedAlloy' | 'minedCrystal' | 'minedDeuterium'>;

const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));
const IDLE: DigFrame = { sparks: 0, heat: 0, cargo: 0, spin: 0 };

/** One frame of the bite, `seconds` after arrival. */
export function digFrame(seconds: number): DigFrame {
  if (!Number.isFinite(seconds) || seconds < 0) return IDLE;
  const t = seconds;
  return {
    sparks: t < DIG_SECONDS ? ramp(t, 0, 0.15) * (1 - ramp(t, DIG_SECONDS - 0.2, 0.2)) : 0,
    heat: ramp(t, 0, 0.6) * (1 - ramp(t, DIG_SECONDS, 0.5)),
    cargo: ramp(t, 0.2, DIG_SECONDS - 0.2),
    spin: t < DIG_SECONDS ? ramp(t, 0, 0.25) : 1 - ramp(t, DIG_SECONDS, 0.3),
  };
}

/** The server answered that this run reached its target and filled its hold. */
export function runLaden(run: DigRun): boolean {
  return run.status === 'returning' && !run.recalledAt && run.minedAlloy + run.minedCrystal + run.minedDeuterium > 0;
}

/**
 * Seconds into this run's dig at `now`, or null when it is not digging: before it arrives, once the cut
 * has cooled, after an empty answer, and never for a run that was turned round in open space.
 */
export function runDig(run: DigRun, now: number): number | null {
  if (run.recalledAt || run.status === 'done') return null;
  if (run.status === 'returning' && !runLaden(run)) return null;
  const t = (now - run.arriveAt.getTime()) / 1000;
  if (!Number.isFinite(t) || t < 0 || t > DIG_SECONDS + DIG_TAIL_SECONDS) return null;
  return t;
}

/** How long a full drill stays on its rock before the drawn trip home begins; it still lands on time. */
export function digHoldMs(run: DigRun): number {
  if (!runLaden(run) || !run.homeAt) return 0;
  return Math.max(0, Math.min(DIG_SECONDS * 1000, (run.homeAt.getTime() - run.arriveAt.getTime()) / 2));
}
