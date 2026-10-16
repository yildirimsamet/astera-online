import { describe, expect, it } from 'vitest';
import { honorRadiationDamage } from '../src/honorRadiation.js';
import { createHonorCatalogue } from '../src/honorValuation.js';
import { HULLS } from '../src/hulls.js';
const source = (id: string, rate: number, origin: 'BOMB' | 'ENVIRONMENT' = 'BOMB') => ({ id, origin,
  center: { x: 0, y: 0, z: 0 }, radius: 10, mode: 'EMIT' as const, intensityHpPerMinute: rate,
  activeFromMs: 0, activeUntilMs: 60000, totalCapFromMs: 0 });
const path = [{ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, startMs: 0, endMs: 60000 }];
const input = { catalogue: createHonorCatalogue(), fleet: { DART: 1 }, damage: [], tech: {}, segments: path };
describe('radiation Honor attributes actual new damage, never all deaths to the last bomb', () => {
  it('awards only damage remaining after the host planet Aegis and ship research', () => {
    const segments = [{ ...path[0]!, target: { kind: 'PLANET' as const, id: 'host' }, radiationProtectionHpPerMinute: 10 }];
    expect(honorRadiationDamage({ ...input, segments, sources: [source('a', 9)] })).toEqual([]);
    const protectedDamage = honorRadiationDamage({ ...input, segments, tech: { RADIATION_SHIELDING: 2 },
      sources: [source('a', 9), source('b', 9)] });
    const baseline = honorRadiationDamage({ ...input, sources: [source('a', 5.44)] });
    expect(protectedDamage.reduce((n, row) => n + row.allMicros, 0)).toBeCloseTo(baseline[0]!.allMicros, -1);
    expect(protectedDamage[0]!.allMicros).toBe(protectedDamage[1]!.allMicros);
  });
  it('splits new damage between equal bomb sources and excludes environmental credit', () => {
    const result = honorRadiationDamage({ ...input, sources: [source('a', 9), source('b', 9), source('env', 9, 'ENVIRONMENT')] });
    expect(result.map(r => r.id)).toEqual(['a', 'b']);
    expect(result[0]?.armedMicros).toBe(result[1]?.armedMicros);
    expect(result.reduce((n,r) => n+r.allMicros, 0)).toBeLessThan(546_000_000);
  });
  it('caps lethal damage to the remaining health and does not credit previous wounds again', () => {
    const result = honorRadiationDamage({ ...input, damage: [{ hull: 'DART' as const, count: 1, damageBp: 9900 }],
      sources: [source('a', 100000)] });
    expect(result[0]?.allMicros).toBe(5_460_000);
  });
  it('does not count civilians as military credit, and does not irradiate exempt prospectors', () => {
    const result = honorRadiationDamage({ ...input, fleet: { COURIER: 1, PROSPECTOR: 1 }, sources: [source('a', 9)] });
    expect(result[0]?.armedMicros).toBe(0);
    expect(result[0]!.allMicros).toBeGreaterThan(0);
    expect(honorRadiationDamage({ ...input, fleet: { PROSPECTOR: 1 }, sources: [source('a', 9)] })).toEqual([]);
  });
  it('honours time windows, the total dose cap, and partitioned settlement', () => {
    const src = [source('a', 40), source('b', 40)];
    const full = honorRadiationDamage({ ...input, sources: src });
    const raw = Math.min(50, HULLS.DART.hp) / HULLS.DART.hp * 546_000_000;
    expect(full.reduce((n,r) => n+r.allMicros,0)).toBeLessThanOrEqual(Math.floor(raw));
    const empty = honorRadiationDamage({ ...input, sources: src, segments: [{ ...path[0]!, startMs: 60000, endMs: 120000 }] });
    expect(empty).toEqual([]);
  });
});
