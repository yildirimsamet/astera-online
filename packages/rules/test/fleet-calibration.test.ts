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
    expect(HULLS.DART).toMatchObject({ alloy: 300, crystal: 60, deuterium: 0, atk: 21, hp: 77 });
    expect(hullFuelMass('DART')).toBe(7);
    expect(HULLS.GARBAGE_COLLECTOR).toMatchObject({ alloy: 10_000, crystal: 5_000, deuterium: 0, atk: 0, cargo: 0 });
    expect(HULLS.PROSPECTOR).toMatchObject({ alloy: 600, crystal: 180, deuterium: 0, atk: 0, cargo: 300, speed: 825 });
    expect(HULLS.THORN).toMatchObject({ alloy: 600, crystal: 150, atk: 42, hp: 215 });
    expect(HULLS.BASTION).toMatchObject({ alloy: 2400, crystal: 600, atk: 144, hp: 1000 });
  });
});
