import { describe, expect, it } from 'vitest';
import { LOW_TIER_PVP_BALANCE, STANDARD_PVP_BALANCE, vaultProtects } from '@astera/rules';
import { probeIntel, simCommanderPvpBalance } from '../../../packages/sim/src/season.js';
import { raidableNow } from '../../../packages/sim/src/invariants.js';

// Pure adapter checks only: no world/season construction, ticks or economy simulation.
const buildings = { CORE: 7, REFINERY: 0, EXTRACTOR: 0, DEUTERIUM_PLANT: 0, SHIPYARD: 0, HANGAR: 0, VAULT: 0 };
const target = {
  buildings, instruments: {}, fleet: {}, ground: {},
  alloy: 10_000, crystal: 0, deuterium: 0,
  bufferAlloy: 2_000, bufferCrystal: 0, bufferDeuterium: 0,
};

describe('PvP model adapters use the shipped loot profile', () => {
  it('a low-tier probe estimates 25% storage and 15% Works', () => {
    const floor = vaultProtects(0, 0, 0, 0).alloy;
    expect(probeIntel(4, target, 0, () => 0.5).takeable)
      .toBe(Math.floor((10_000 - floor) * 0.25) + 300);
  });

  it('a high-tier commander keeps standard rates when observing their small capital', () => {
    const floor = vaultProtects(0, 0, 0, 0).alloy;
    expect(probeIntel(4, target, 0, () => 0.5, STANDARD_PVP_BALANCE).takeable)
      .toBe(Math.floor((10_000 - floor) * 0.6) + 600);
  });

  it('counts controlled colonies, but not another commander’s colony', () => {
    const player = { id: 1, buildings };
    const world = { neutrals: [
      { controllerId: 2, buildings: { ...buildings, CORE: 20 } },
      { controllerId: 1, buildings: { ...buildings, CORE: 9 } },
    ] };
    expect(simCommanderPvpBalance(world, player)).toEqual(LOW_TIER_PVP_BALANCE);
    world.neutrals[1]!.buildings.CORE = 10;
    expect(simCommanderPvpBalance(world, player)).toEqual(STANDARD_PVP_BALANCE);
  });
});


it('the model’s raidability diagnostic uses the same low-tier exposure as its probe', () => {
  const floor = vaultProtects(0, 0, 0, 0).alloy;
  expect(raidableNow(target, LOW_TIER_PVP_BALANCE)).toBe(Math.floor((10_000 - floor) * 0.25) + 300);
  expect(raidableNow(target, STANDARD_PVP_BALANCE)).toBe(Math.floor((10_000 - floor) * 0.6) + 600);
});
