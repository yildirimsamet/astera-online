/** The approved arrival loss is independent of radiation, sensors and research. */
export function monumentProbeSurvives(draw: number): boolean {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Probe RNG draw must be in [0, 1)');
  return draw >= 0.9;
}
