export type SignalRgb = readonly [red: number, green: number, blue: number];

/**
 * Public isotope anomalies use Deuterium's neon-green signature on body and trail.
 * Exact composition remains hidden by the API until Spectrometry; colour only
 * identifies the already-public `isotopeRich` fact.
 */
export function asteroidBodyColour(isotopeRich: boolean, intensity: number): SignalRgb {
  return isotopeRich
    ? [intensity * 0.48, intensity * 1.18, intensity * 0.22]
    : [intensity, intensity, intensity];
}

export function asteroidTrailColour(
  isotopeRich: boolean,
  intensity: number,
  back: number,
): SignalRgb {
  if (isotopeRich) {
    return [
      intensity * (0.5 - back * 0.12),
      intensity * (1.18 - back * 0.18),
      intensity * (0.24 - back * 0.06),
    ];
  }

  const cool = back ** 0.65;
  return [
    intensity * (1 - cool * 0.58),
    intensity * (0.82 - cool * 0.16),
    intensity * (0.48 + cool * 0.42),
  ];
}
