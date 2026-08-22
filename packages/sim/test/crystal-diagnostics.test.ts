import { describe, expect, it } from 'vitest';
import { HULLS, OPENING_BONUS, PLANET_START, START } from '@astera/rules';
import { redistributedHullPrice, runSeason } from '../src/index.js';

describe('crystal-use experiment', () => {
  it.each(['LANCE', 'BULWARK', 'HAULER', 'PROSPECTOR'] as const)(
    'redistributes %s without changing its total price',
    (id) => {
      const stock = HULLS[id];
      for (const share of [0.25, 0.30, 0.35] as const) {
        const candidate = redistributedHullPrice(id, share);
        expect(candidate.alloy + candidate.crystal).toBe(stock.alloy + stock.crystal);
        expect(candidate.crystal).toBe(Math.round((stock.alloy + stock.crystal) * share));
      }
    },
  );

  it('does not redistribute Wasp or change opening arithmetic', () => {
    expect(redistributedHullPrice('WASP', 0.35)).toEqual({
      alloy: HULLS.WASP.alloy,
      crystal: HULLS.WASP.crystal,
    });
    expect(PLANET_START.alloy).toBe(START.alloy + OPENING_BONUS.alloy);
    expect(PLANET_START.crystal).toBe(START.crystal + OPENING_BONUS.crystal);
  });

  it('reports deterministic cap time, unused crystal and every tracked spend category', () => {
    const config = { players: 12, days: 3, seed: 42 };
    const first = runSeason(config).diagnostics;
    const second = runSeason(config).diagnostics;
    expect(first).toEqual(second);
    expect(first.capPlayerHours).toBeGreaterThanOrEqual(0);
    expect(first.medianUnused).toBeGreaterThanOrEqual(0);
    expect(Object.keys(first.spent).sort()).toEqual(
      ['buildings', 'combat', 'defence', 'hardware', 'hauler', 'prospector'].sort(),
    );
    // Mining is not part of this season model yet. Keeping the zero explicit
    // prevents a partial hull-price experiment from being reported as complete.
    expect(first.spent.prospector).toBe(0);
    expect(Object.values(first.spentShare).reduce((sum, share) => sum + share, 0)).toBeCloseTo(1);
  });
});
