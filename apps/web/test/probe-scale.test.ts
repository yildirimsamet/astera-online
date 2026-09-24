import { describe, expect, it } from 'vitest';
import { combatValue, computeLoot } from '@astera/rules';
import { probeAxis, yardstickOf } from '../src/lib/probeScale.js';
import { planetView } from './fixtures.js';

/**
 * A PROBE READING ON A NUMBER LINE, WITH YOU ON IT. Owner, 2026-09-24: "buradaki
 * progressbarlar neye göre sağa, neye göre ortada, neye göre sola yaslanıyor anlaşılmıyor."
 *
 * Each row was scaled to its own top, so every band touched the right edge and only its
 * start moved, with the doubt. Now each row is a line from zero, scaled to the larger of
 * the reading and the same measure taken on your own world — so where the band sits says
 * "smaller than mine" or "bigger than mine", which is the comparison a raid is decided on.
 */

describe('the probe axis', () => {
  it('scales to the larger of the reading and yours, with room at the end', () => {
    const axis = probeAxis(100, 400, 200);
    expect(axis.start).toBeCloseTo((100 / 440) * 100);
    expect(axis.width).toBeCloseTo((300 / 440) * 100);
    expect(axis.you).toBeCloseTo((200 / 440) * 100);
  });

  it('draws a reading smaller than yours on the left of your mark', () => {
    const axis = probeAxis(100, 400, 1_000);
    expect(axis.you).toBeCloseTo((1_000 / 1_100) * 100);
    expect(axis.start + axis.width).toBeLessThan(axis.you!);
  });

  it('keeps an exact reading visible', () => {
    expect(probeAxis(400, 400, null).width).toBe(3);
  });

  it('has no mark without a world of yours to measure', () => {
    const axis = probeAxis(100, 400, null);
    expect(axis.you).toBeNull();
    expect(axis.start).toBeCloseTo((100 / 440) * 100);
  });

  it('never divides by nothing', () => {
    const axis = probeAxis(0, 0, 0);
    expect(Number.isFinite(axis.start) && Number.isFinite(axis.width) && Number.isFinite(axis.you ?? 0)).toBe(true);
  });
});

describe('your own world, measured as a probe measures', () => {
  const world = planetView(
    { fleet: { DART: 12, PROSPECTOR: 2 }, ground: { THORN: 3 } },
    {
      alloy: 900, crystal: 300, deuterium: 50,
      bufferAlloy: 200, bufferCrystal: 0, bufferDeuterium: 0,
      vaultCapacity: { alloy: 500, crystal: 100, deuterium: 0 },
    },
  );

  it('reads stock as what a decisive raid could take: above the Vault, and a share of the works', () => {
    const loot = computeLoot(
      { alloy: 900, crystal: 300, deuterium: 50 },
      { alloy: 200, crystal: 0, deuterium: 0 },
      { alloy: 500, crystal: 100, deuterium: 0 },
      'DECISIVE',
      Number.MAX_SAFE_INTEGER,
    );
    expect(yardstickOf(world).stock).toBe(loot.alloy + loot.crystal + loot.deuterium);
    expect(yardstickOf(world).stock).toBeGreaterThan(0);
  });

  it('reads the armed value of everything at home that fires, ground guns included', () => {
    expect(yardstickOf(world).defence).toBe(combatValue({ DART: 12, PROSPECTOR: 2, THORN: 3 }));
    expect(yardstickOf(world).defence).toBeGreaterThan(combatValue({ DART: 12 }));
  });

  it('counts every craft at home, the unarmed ones too', () => {
    expect(yardstickOf(world).ships).toBe(17);
  });
});
