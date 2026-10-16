import { protectedRadiationHp, segmentsExposureHp, type TechLevels } from '@astera/rules';
import type { HpRadiationSourceView } from '../api/schemas.js';
import { toHpRadiationSources } from './radiation.js';

export interface TargetRadiation {
  rate: number;
  protectedRate: number;
  nextChangeAt: number | null;
  nextRate: number | null;
  sources: readonly HpRadiationSourceView[];
  planetProtection?: number;
}

/** Same target identity and dose profile as settlement; cosmetic aura radius is irrelevant. */
export function radiationAtTarget(target: { kind: 'PLANET' | 'MONUMENT'; id: string },
  sources: readonly HpRadiationSourceView[], now: number, tech: TechLevels = {}, planetProtection = 0): TargetRadiation | null {
  const active = sources.filter(source => source.target?.kind === target.kind && source.target.id === target.id
    && source.activeFrom.getTime() <= now && (source.activeUntil === null || source.activeUntil.getTime() > now));
  if (active.length === 0) return null;
  const profile = toHpRadiationSources(active);
  const at = { x: 0, y: 0, z: 0 };
  const rateAt = (startMs: number) => Math.round(segmentsExposureHp([
    { from: at, to: at, startMs, endMs: startMs + 1, target },
  ], profile) * 60000 * 1e8) / 1e8;
  const rate = rateAt(now);
  if (rate <= 0) return null;
  let nextChangeAt: number | null = null;
  let nextRate: number | null = null;
  const expiries = [...new Set(active.flatMap(source => source.activeUntil ? [source.activeUntil.getTime()] : []))].sort((a, b) => a - b);
  for (const expiry of expiries) {
    const after = rateAt(expiry);
    if (after < rate) { nextChangeAt = expiry; nextRate = after; break; }
  }
  const protection = target.kind === 'PLANET' ? planetProtection : 0;
  return { rate, protectedRate: protectedRadiationHp(Math.max(0, rate - protection), tech), planetProtection: protection, nextChangeAt, nextRate,
    sources: active.filter(source => source.mode === 'EMIT') };
}
