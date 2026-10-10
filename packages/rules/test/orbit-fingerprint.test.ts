import { describe, expect, it } from 'vitest';
import { orbitFingerprint } from './orbitFingerprint.js';

describe('portable historical orbit fingerprints', () => {
  it('tolerates only the measured last-bit radius and period differences between Node 22 and 24', () => {
    expect(orbitFingerprint([{ index: 7, radius: 3303.3341805407495, period: 51.47845685678401 }]))
      .toBe(orbitFingerprint([{ index: 7, radius: 3303.33418054075, period: 51.478456856784 }]));
  });

  it('still detects meaningful orbit changes and exact identity, roster and RNG draw changes', () => {
    const field = [{ index: 7, level: 2, radius: 3303.3341805407495, period: 51.47845685678401,
      phase: 0.123456789012345, fleet: { DART: 2 } }];
    for (const change of [{ index: 8 }, { level: 3 }, { radius: field[0]!.radius + 0.000001 },
      { period: field[0]!.period + 0.000001 }, { phase: 0.123456789012346 }, { fleet: { DART: 3 } }]) {
      expect(orbitFingerprint([{ ...field[0], ...change }])).not.toBe(orbitFingerprint(field));
    }
  });

  it('preserves integer precision and does not round unrelated fractional values', () => {
    expect(orbitFingerprint({ index: Number.MAX_SAFE_INTEGER })).not.toBe(orbitFingerprint({ index: Number.MAX_SAFE_INTEGER - 1 }));
    expect(orbitFingerprint({ appearsAt: 0.123456789012345 })).not.toBe(orbitFingerprint({ appearsAt: 0.123456789012346 }));
  });
});
