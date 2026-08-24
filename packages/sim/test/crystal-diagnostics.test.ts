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
      deuterium: HULLS.WASP.deuterium,
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
      ['buildings', 'combat', 'defence', 'hardware', 'hauler', 'prospector', 'research'].sort(),
    );
    expect(first.spent.prospector).toBeGreaterThan(0);
    expect(first.mining.launches).toBeGreaterThan(0);
    expect(first.mining.oreClaimed).toBeGreaterThan(0);
    expect(first.mining.alloyDelivered + first.mining.crystalDelivered).toBeGreaterThan(0);
    expect(first.spent.research).toBeGreaterThanOrEqual(0);
    expect(Object.values(first.spentShare).reduce((sum, share) => sum + share, 0)).toBeCloseTo(1);
  });

  it('never creates more than two owned Prospectors or over-claims a rock', () => {
    const { world } = runSeason({ players: 20, days: 5, seed: 99 });
    for (const player of world.players) {
      const away = world.miningRuns
        .filter((run) => run.playerId === player.id)
        .reduce((sum, run) => sum + run.craft, 0);
      expect((player.fleet.PROSPECTOR ?? 0) + away).toBeLessThanOrEqual(2);
    }
    for (const [index, taken] of world.asteroidClaims) {
      const rock = world.asteroids.find((candidate) => candidate.index === index);
      expect(rock).toBeDefined();
      expect(taken).toBeLessThanOrEqual(rock!.ore);
    }
  });
});
