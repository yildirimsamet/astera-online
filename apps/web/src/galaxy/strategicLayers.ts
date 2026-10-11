import { seededFrom } from '@astera/rules';

export type StrategicImpactKind = 'surface' | 'interception';
const ramp = (seconds: number, start: number, span: number): number => Math.max(0, Math.min(1, (seconds - start) / span));
const finiteAge = (seconds: number): number => Number.isFinite(seconds) ? seconds : -1;

/** Absolute server age; resuming a hidden tab cannot restart any destruction. */
export function strategicLayers(seconds: number, kind: StrategicImpactKind) {
  const age = finiteAge(seconds);
  const live = age >= 0 && age < 8;
  const airborne = kind === 'interception';
  const fireEnd = airborne ? 1.35 : 2.8;
  const smokeStart = airborne ? 0.24 : 0.45;
  const smokeEnd = airborne ? 1.9 : 7.6;
  const debrisEnd = airborne ? 1.9 : 7.4;
  return {
    flash: live ? Math.max(0, 1 - age / 0.22) ** 1.2 : 0,
    fire: live && age < fireEnd ? ramp(age, 0.015, 0.055) * (1 - ramp(age, airborne ? 0.45 : 0.85, fireEnd - (airborne ? 0.45 : 0.85))) ** 0.75 : 0,
    fireProgress: ramp(age, 0.015, fireEnd - 0.015),
    shock: live && !airborne ? ramp(age, 0.035, 0.06) * (1 - ramp(age, 0.1, 0.8)) ** 1.2 : 0,
    shockProgress: ramp(age, 0.035, 0.865),
    smoke: live && age < smokeEnd ? ramp(age, smokeStart, 0.55) * (1 - ramp(age, 1.4, smokeEnd - 1.4)) ** 1.2 : 0,
    smokeProgress: ramp(age, smokeStart, smokeEnd - smokeStart),
    debris: live && age < debrisEnd ? ramp(age, 0.025, 0.055) * (1 - ramp(age, debrisEnd - (airborne ? 0.55 : 1.5), airborne ? 0.55 : 1.5)) : 0,
    debrisProgress: ramp(age, 0.025, debrisEnd - 0.025),
  };
}

export interface ImpactFragment {
  direction: readonly [number, number, number];
  speed: number;
  size: number;
  delay: number;
  spin: readonly [number, number, number];
}

/** Irregular three-dimensional rupture, computed once from the public event id. */
export function strategicEjecta(key: string, count: number): ImpactFragment[] {
  const random = seededFrom('strategic-ejecta', key);
  return Array.from({ length: Math.max(0, Math.min(48, Math.floor(count))) }, (): ImpactFragment => {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    return {
      direction: [Math.cos(angle) * ring, Math.sin(angle) * ring, z],
      speed: 0.85 + random() * 2.15,
      size: 0.035 + random() ** 2 * 0.1,
      delay: random() * 0.18,
      spin: [(random() - 0.5) * 8, (random() - 0.5) * 8, (random() - 0.5) * 8],
    };
  });
}

/** Source fire already contains its cooling; opacity keeps its turbulent middle intact. */
export function bombardmentLayers(progress: number) {
  const t = finiteAge(progress);
  const live = t >= 0 && t <= 1;
  return {
    flash: live ? (1 - ramp(t, 0, 0.14)) ** 0.8 : 0,
    fire: live ? ramp(t, 0, 0.035) * (1 - ramp(t, 0.48, 0.32)) ** 0.9 : 0,
    fireProgress: ramp(t, 0, 0.8),
    smoke: live ? ramp(t, 0.14, 0.16) * (1 - ramp(t, 0.64, 0.36)) ** 0.65 : 0,
    smokeProgress: ramp(t, 0.14, 0.86),
    ejecta: live ? ramp(t, 0, 0.035) * (1 - ramp(t, 0.62, 0.38)) : 0,
  };
}
