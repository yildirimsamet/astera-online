import { describe, expect, it } from 'vitest';
import { alloyRate, collectorCap, crystalRate, deuteriumCollectorCap, deuteriumRate, landHaulInWorks } from '../src/index.js';

/**
 * A SHIP'S HAUL LANDS IN THE WORKS, AS A WORLD'S DOES (owner K3, 2026-11-05). The screen already
 * said so; the ship paid it straight into storage. Each resource has its own ceiling, and only the
 * pile with nowhere to go is lost.
 */
describe('a haul landing aboard', () => {
  const modules = { REFINERY: 2, EXTRACTOR: 1, DEUTERIUM_PLANT: 1 };
  const empty = { bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 };

  it('goes into the works, not the store', () => {
    const landed = landHaulInWorks(empty, modules, { alloy: 120, crystal: 60, deuterium: 20 });
    expect(landed.buffer).toEqual({ bufferAlloy: 120, bufferCrystal: 60, bufferDeuterium: 20 });
    expect(landed.wasted).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });

  it('loses only the resource whose works are full', () => {
    const alloyCap = collectorCap(alloyRate(2));
    const landed = landHaulInWorks({ ...empty, bufferAlloy: alloyCap - 10 }, modules, { alloy: 50, crystal: 30, deuterium: 0 });
    expect(landed.buffer.bufferAlloy).toBe(alloyCap);
    expect(landed.buffer.bufferCrystal).toBe(30);
    expect(landed.wasted).toEqual({ alloy: 40, crystal: 0, deuterium: 0 });
  });

  it('sizes each ceiling from its own works', () => {
    const full = {
      bufferAlloy: collectorCap(alloyRate(2)),
      bufferCrystal: collectorCap(crystalRate(1)),
      bufferDeuterium: deuteriumCollectorCap(deuteriumRate(1), crystalRate(1)),
    };
    const landed = landHaulInWorks(full, modules, { alloy: 5, crystal: 6, deuterium: 7 });
    expect(landed.buffer).toEqual(full);
    expect(landed.wasted).toEqual({ alloy: 5, crystal: 6, deuterium: 7 });
  });

  it('never takes back what already stands above a ceiling', () => {
    const landed = landHaulInWorks({ ...empty, bufferAlloy: 1e9 }, modules, { alloy: 5, crystal: 0, deuterium: 0 });
    expect(landed.buffer.bufferAlloy).toBe(1e9);
    expect(landed.wasted.alloy).toBe(5);
  });
});
