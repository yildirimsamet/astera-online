import { describe, expect, it } from 'vitest';
import {
  COMBAT, COMBAT_HULLS, HULLS, RESEARCH_TECH, SUPPORT_HULLS,
  hullFuelMass, type HullId,
} from '../src/index.js';

/** Owner-requested 32 alloy = 16 crystal = 1 deuterium calibration, 2026-09-12. */
const cost = (id: HullId): number =>
  HULLS[id].alloy + 2 * HULLS[id].crystal + 32 * HULLS[id].deuterium;
const efficiency = (id: HullId): number => HULLS[id].atk * HULLS[id].hp / cost(id) ** 2;
const line = (profile: string): HullId[] => COMBAT_HULLS
  .filter((id) => HULLS[id].profile === profile)
  .sort((a, b) => HULLS[a].tier! - HULLS[b].tier!);

describe('economic fleet progression at 32:16:1', () => {
  for (const profile of ['RAIDER', 'STRIKER', 'FORTRESS', 'ESCORT']) {
    const ids = line(profile);
    it(`${profile} buys more combat, hold and fuel efficiency at every tier`, () => {
      expect(ids).toHaveLength(4);
      for (let i = 1; i < ids.length; i++) {
        const before = ids[i - 1]!, after = ids[i]!;
        const label = `${before} -> ${after}`;
        const gain = efficiency(after) / efficiency(before);
        expect(gain, `${label}: combat`).toBeGreaterThan(1.03);
        expect(gain, `${label}: bounded combat`).toBeLessThan(1.13);
        expect(HULLS[after].cargo, `${label}: hold`)
          .toBeGreaterThan(HULLS[before].cargo);
        expect(Math.sqrt(HULLS[after].atk * HULLS[after].hp) / hullFuelMass(after), `${label}: fuel`)
          .toBeGreaterThan(Math.sqrt(HULLS[before].atk * HULLS[before].hp) / hullFuelMass(before));
        for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
          expect(HULLS[after][resource], `${label}: ${resource}`).toBeGreaterThan(HULLS[before][resource]);
        }
      }
      const gap = efficiency(ids[3]!) / efficiency(ids[0]!);
      expect(gap).toBeGreaterThan(1.15);
      expect(gap).toBeLessThan(1.27);
      expect(gap * RESEARCH_TECH.powerCeiling)
        .toBeLessThan(COMBAT.strongMult / COMBAT.weakMult);
    });
  }

  it('never pays specialisation a hidden same-tier product bonus', () => {
    for (let tier = 1; tier <= 4; tier++) {
      const values = COMBAT_HULLS.filter((id) => HULLS[id].tier === tier
        && HULLS[id].profile !== 'SHIELD_BREAKER').map(efficiency);
      expect(Math.max(...values) / Math.min(...values), `tier ${String(tier)}`).toBeLessThan(1.06);
    }
  });

  it('makes every Lance visibly attack-led without changing its price or combat product', () => {
    const strikers = line('STRIKER');
    const raiders = line('RAIDER');
    const previousProducts = [21 * 75, 63 * 214, 160 * 538, 431 * 1425] as const;
    const previousPrices = [[390, 78, 0], [975, 234, 2], [2340, 585, 6], [5850, 1560, 20]] as const;
    const firstAttackLedProfile = [[41, 39], [119, 113], [301, 285], [807, 762]] as const;
    const revisedProfile = [[42, 38], [120, 111], [305, 282], [816, 754]] as const;
    expect(strikers).toHaveLength(4);
    for (let index = 0; index < strikers.length; index += 1) {
      const striker = strikers[index]!;
      const raider = raiders[index]!;
      expect(HULLS[striker].atk, striker).toBeGreaterThan(HULLS[striker].hp);
      expect(HULLS[striker].atk, `${striker} compared with its Raider`).toBeGreaterThan(HULLS[raider].atk);
      expect(HULLS[striker].hp, `${striker} compared with its Raider`).toBeLessThan(HULLS[raider].hp);
      expect(cost(striker), `${striker} price`).toBe(cost(raider));
      expect([HULLS[striker].alloy, HULLS[striker].crystal, HULLS[striker].deuterium], `${striker} unchanged recipe`)
        .toEqual(previousPrices[index]);
      expect(HULLS[striker].atk, `${striker} attack after the second owner adjustment`)
        .toBeGreaterThan(firstAttackLedProfile[index]![0]);
      expect(HULLS[striker].hp, `${striker} hull after the second owner adjustment`)
        .toBeLessThan(firstAttackLedProfile[index]![1]);
      expect([HULLS[striker].atk, HULLS[striker].hp], `${striker} revised profile`)
        .toEqual(revisedProfile[index]);
      const product = HULLS[striker].atk * HULLS[striker].hp;
      // Reciprocal redistribution preserves the unrounded product exactly;
      // rounding two small integer stats changes Pike's product by 1.34%.
      expect(
        Math.abs(product / previousProducts[index]! - 1),
        `${striker} product drift from the previous live catalogue`,
      ).toBeLessThan(0.02);
      // Pike's one-point move is coarse at this scale: 42/38 visibly rounds above
      // the later authored ratios. T2-T4 must still expose the intended widening,
      // while the whole line remains narrow enough not to erase tier efficiency.
      if (index > 1) {
        const previous = strikers[index - 1]!;
        expect(HULLS[striker].atk / HULLS[striker].hp, `${striker} specialisation`)
          .toBeGreaterThan(HULLS[previous].atk / HULLS[previous].hp);
      }
    }
    expect(HULLS.NULLIFIER.atk).toBeGreaterThan(HULLS.NULLIFIER.hp);
    expect(HULLS.NULLIFIER.atk).toBeGreaterThan(301);
    expect(HULLS.NULLIFIER.hp).toBeLessThan(285);
    expect([HULLS.NULLIFIER.atk, HULLS.NULLIFIER.hp]).toEqual([305, 282]);
    expect([HULLS.NULLIFIER.alloy, HULLS.NULLIFIER.crystal, HULLS.NULLIFIER.deuterium])
      .toEqual([2691, 674, 7]);
    expect(Math.abs(HULLS.NULLIFIER.atk * HULLS.NULLIFIER.hp / (160 * 538) - 1))
      .toBeLessThan(0.02);
    const visibleRatios = strikers.map((id) => HULLS[id].atk / HULLS[id].hp);
    expect(Math.max(...visibleRatios) / Math.min(...visibleRatios))
      .toBeLessThan(1.03);
  });

  it('preserves cargo as a secondary profile trade instead of paying every stat an efficiency bonus', () => {
    expect(line('RAIDER').map(id => HULLS[id].cargo)).toEqual([30, 64, 135, 285]);
    expect(line('STRIKER').map(id => HULLS[id].cargo)).toEqual([40, 85, 180, 380]);
    expect(line('FORTRESS').map(id => HULLS[id].cargo)).toEqual([50, 106, 225, 475]);
    expect(line('ESCORT').map(id => HULLS[id].cargo)).toEqual([36, 77, 162, 342]);
  });

  it('prices the Nullifier shield ability as an ordinary-combat opportunity cost', () => {
    expect(cost('NULLIFIER')).toBeGreaterThan(cost('BALLISTA'));
    const ratio = efficiency('NULLIFIER') / efficiency('BALLISTA');
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.85);
  });

  it('improves transport capacity per economic cost and preserves its separation from warships', () => {
    const transports = SUPPORT_HULLS.filter((id) => HULLS[id].profile === 'TRANSPORT')
      .sort((a, b) => HULLS[a].tier! - HULLS[b].tier!);
    for (let i = 1; i < transports.length; i++) {
      const before = transports[i - 1]!, after = transports[i]!;
      expect(HULLS[after].cargo / cost(after)).toBeGreaterThan(HULLS[before].cargo / cost(before));
    }
    const smallest = Math.min(...transports.map((id) => HULLS[id].cargo));
    const bestWarship = Math.max(...COMBAT_HULLS.map((id) => HULLS[id].cargo / cost(id)));
    const worstTransport = Math.min(...transports.map((id) => HULLS[id].cargo / cost(id)));
    expect(transports.map((id) => HULLS[id].cargo)).toEqual([1000, 3400, 9500, 26000]);
    expect(worstTransport / bestWarship).toBeGreaterThan(10);
    for (const id of COMBAT_HULLS) expect(HULLS[id].cargo, id).toBeLessThan(smallest);
  });

  it('preserves the paid opening and specialist identities', () => {
    expect(HULLS.DART).toMatchObject({ alloy: 390, crystal: 78, deuterium: 0, atk: 21, hp: 77 });
    expect(hullFuelMass('DART')).toBe(7);
    expect(HULLS.GARBAGE_COLLECTOR).toMatchObject({ alloy: 13_000, crystal: 6_500, deuterium: 0, atk: 0, cargo: 0 });
    expect(HULLS.PROSPECTOR).toMatchObject({ alloy: 780, crystal: 234, deuterium: 0, atk: 0, cargo: 400, speed: 825 });
    expect(HULLS.THORN).toMatchObject({ alloy: 600, crystal: 150, atk: 42, hp: 215 });
    expect(HULLS.BASTION).toMatchObject({ alloy: 2400, crystal: 600, atk: 144, hp: 1000 });
  });
});
