import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  SHIELD,
  STARTER,
  advanceEconomy,
  advanceVesselEconomy,
  alloyRate,
  collect,
  collectVessel,
  openingEconomy,
  vesselAegisHp,
  vesselEconomyInput,
} from '../src/index.js';

describe('the ship\'s works', () => {
  it('starts from the opening stock, with the prologue\'s batch still in the refinery', () => {
    expect(openingEconomy(100)).toMatchObject({
      alloy: STARTER.opening.alloy, crystal: STARTER.opening.crystal, deuterium: 0,
      bufferAlloy: STARTER.opening.works.alloy, bufferCrystal: 0, bufferDeuterium: 0, shield: 0, lastTickMinutes: 100,
    });
  });

  /**
   * OWNER 2026-11-06: the first screen said "collect alloy" over an empty refinery. An hour of the
   * first refinery's output waits there, so the first collect works and teaches.
   */
  it('leaves about an hour of the first refinery in the works, and the first collect takes it', () => {
    const waiting = STARTER.opening.works.alloy;
    expect(waiting).toBeGreaterThan(0);
    expect(Math.abs(waiting - alloyRate(1))).toBeLessThanOrEqual(alloyRate(1) * 0.25);
    expect(collectVessel(openingEconomy(0), STARTER.opening.modules).moved.alloy).toBe(waiting);
  });

  it('reads every module stage as the level the main rule expects', () => {
    expect(vesselEconomyInput({ REFINERY: 3, EXTRACTOR: 2, DEUTERIUM_PLANT: 1, VAULT: 1, AEGIS: 2 })).toEqual({
      refineryLevel: 3, extractorLevel: 2, plantLevel: 1, vaultLevel: 1, aegisLevel: 2,
    });
    expect(vesselEconomyInput({})).toEqual({ refineryLevel: 0, extractorLevel: 0, plantLevel: 0, vaultLevel: 0, aegisLevel: 0 });
  });

  it('makes nothing from a broken module', () => {
    const later = advanceVesselEconomy(openingEconomy(0), {}, 600);
    expect([later.bufferAlloy, later.bufferCrystal, later.bufferDeuterium]).toEqual([0, 0, 0]);
    const refineryOnly = advanceVesselEconomy(openingEconomy(0), { REFINERY: 1 }, 600);
    expect(refineryOnly.bufferAlloy).toBeGreaterThan(0);
    expect(refineryOnly.bufferCrystal).toBe(0);
    expect(refineryOnly.bufferDeuterium).toBe(0);
  });

  it('produces exactly what the main rule produces', () => {
    const modules = { REFINERY: 3, EXTRACTOR: 2, DEUTERIUM_PLANT: 1, VAULT: 1 };
    const ship = advanceVesselEconomy(openingEconomy(0), modules, 300);
    const main = advanceEconomy(openingEconomy(0), vesselEconomyInput(modules), 300);
    expect(ship).toEqual(main);
    expect(ship.bufferAlloy).toBeCloseTo(STARTER.opening.works.alloy + alloyRate(3) * 5, 8);
  });

  it('collects exactly as the main rule collects', () => {
    const modules = { REFINERY: 2, EXTRACTOR: 1 };
    const full = advanceVesselEconomy(openingEconomy(0), modules, 20 * 60);
    const ship = collectVessel(full, modules);
    expect(ship).toEqual(collect(full, vesselEconomyInput(modules)));
    expect(ship.moved.alloy).toBeGreaterThan(0);
  });

  it('never fills the Aegis past this galaxy\'s value', () => {
    const later = advanceVesselEconomy(openingEconomy(0), { AEGIS: 1 }, 60 * 24 * 10);
    expect(later.shield).toBe(vesselAegisHp(1));
  });

  it('refills the Aegis in the same time as in the main game', () => {
    const hours = 1;
    const ship = advanceVesselEconomy(openingEconomy(0), { AEGIS: 1 }, hours * 60);
    expect(ship.shield / vesselAegisHp(1)).toBeCloseTo(SHIELD.regenPerHour * hours, 8);
    expect(STARTER.combat.tempo).toBeLessThan(COMBAT.tempo);
  });

  it('keeps a part-filled Aegis in this galaxy\'s units from one tick to the next', () => {
    const one = advanceVesselEconomy(openingEconomy(0), { AEGIS: 2 }, 60);
    const two = advanceVesselEconomy(one, { AEGIS: 2 }, 120);
    const straight = advanceVesselEconomy(openingEconomy(0), { AEGIS: 2 }, 120);
    expect(two.shield).toBeCloseTo(straight.shield, 8);
  });
});
