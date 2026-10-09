/** Owner decision, 2026-10-09: reduce monument probe losses from 90% to 75%. */
export const MONUMENT_PROBE_LOSS_CHANCE = 0.75;

/** The approved arrival loss is independent of radiation, sensors and research. */
export function monumentProbeSurvives(draw: number): boolean {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Probe RNG draw must be in [0, 1)');
  return draw >= MONUMENT_PROBE_LOSS_CHANCE;
}
