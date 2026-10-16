import { HULLS, fleetEntries } from './hulls.js';
import { honorNumber } from './honor.js';
import { honorFleetValue, type HonorCatalogue } from './honorValuation.js';
import { radiationRateProfile, type Segment } from './radiation.js';
import { normalizeHpDamage, type HpDamageLots, type HpRadiationSource } from './radiationHp.js';
import { hullTech, radiationDamageMult, type TechLevels } from './tech.js';
import type { Fleet } from './types.js';
import { RADIATION_BOMB } from './radiationBomb.js';

/** Attribute only newly removed health. Natural radiation participates in the
 * dose, but never earns a commander credit. Overlapping bombs share the dose;
 * neither a final blow nor processing frequency gives a second full hull value. */
export function honorRadiationDamage(input: {
  catalogue: HonorCatalogue; fleet: Fleet; damage: HpDamageLots | null | undefined;
  tech: TechLevels; segments: readonly Segment[]; sources: readonly HpRadiationSource[];
}): { id: string; armedMicros: number; allMicros: number }[] {
  const lots = normalizeHpDamage(input.fleet, input.damage);
  const cohorts = [...lots];
  for (const [hull, count] of fleetEntries(input.fleet)) {
    const healthy = count - lots.filter(lot => lot.hull === hull).reduce((n, lot) => n + lot.count, 0);
    if (healthy > 0) cohorts.push({ hull, count: healthy, damageBp: 0, remainderBp: 0 });
  }
  const health = cohorts.filter(row => row.hull !== 'PROSPECTOR' && !HULLS[row.hull].ground).map(row => {
    const hp = HULLS[row.hull].hp * hullTech(input.tech, row.hull).hp;
    return { ...row, hp, remaining: hp * (1 - (row.damageBp + (row.remainderBp ?? 0)) / 10000),
      value: honorFleetValue(input.catalogue, { [row.hull]: row.count }),
      armed: honorFleetValue(input.catalogue, { [row.hull]: row.count }, true) };
  });
  const totals = new Map<string, { all: number; armed: number }>();
  const shelters = input.sources.filter(source => source.mode === 'SHELTER');
  for (const segment of input.segments) {
    const profiles = input.sources.filter(source => source.mode === 'EMIT').map(source => ({ source,
      pieces: radiationRateProfile(segment, [source, ...shelters], row => row.intensityHpPerMinute) }));
    const boundaries = [...new Set([segment.startMs, segment.endMs,
      ...profiles.flatMap(p => p.pieces.flatMap(piece => [piece.startMs, piece.endMs])),
      ...input.sources.flatMap(source => source.totalCapFromMs === undefined ? [] : [source.totalCapFromMs])])]
      .filter(at => at >= segment.startMs && at <= segment.endMs).sort((a, b) => a - b);
    for (let i = 1; i < boundaries.length; i++) {
      const from = boundaries[i - 1]!, until = boundaries[i]!;
      const active = profiles.map(p => ({ source: p.source,
        rate: p.pieces.find(piece => piece.startMs <= from && piece.endMs >= until)?.rate ?? 0 })).filter(p => p.rate > 0);
      const rate = active.reduce((n, p) => n + p.rate, 0);
      if (rate === 0) continue;
      const capped = input.sources.some(source => source.totalCapFromMs !== undefined && source.totalCapFromMs <= from);
      const protection = segment.target?.kind === 'PLANET' ? segment.radiationProtectionHpPerMinute ?? 0 : 0;
      const dose = Math.max(0, Math.min(rate, capped ? RADIATION_BOMB.maxHpPerMinute / 60000 : Infinity) - protection / 60000)
        * (until - from) * radiationDamageMult(input.tech);
      for (const row of health) {
        const taken = Math.min(row.remaining, dose);
        if (taken <= 0) continue;
        row.remaining -= taken;
        for (const p of active) if (p.source.origin === 'BOMB') {
          const total = totals.get(p.source.id) ?? { all: 0, armed: 0 };
          const fraction = taken / row.hp * p.rate / rate * 1_000_000;
          total.all += row.value * fraction;
          total.armed += row.armed * fraction;
          totals.set(p.source.id, total);
        }
      }
    }
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => ({ id,
    armedMicros: honorNumber(BigInt(Math.floor(value.armed + 1e-6))),
    allMicros: honorNumber(BigInt(Math.floor(value.all + 1e-6))) }));
}
