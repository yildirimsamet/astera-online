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
  collectorCap,
  crystalRate,
  deuteriumRate,
  landHaulInWorks,
  openingEconomy,
  vesselRate,
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
      refineryLevel: 3, extractorLevel: 2, plantLevel: 1, vaultLevel: 1, aegisLevel: 2, production: STARTER.outputMult,
    });
    expect(vesselEconomyInput({})).toEqual({ refineryLevel: 0, extractorLevel: 0, plantLevel: 0, vaultLevel: 0, aegisLevel: 0, production: STARTER.outputMult });
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
    expect(ship.bufferAlloy).toBeCloseTo(STARTER.opening.works.alloy + vesselRate.alloy(3) * 5, 8);
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

/** Owner 2026-11-09: every works on the ship makes three times what the same level makes on a world. */
describe('the ship makes three times a world', () => {
  const empty = { ...openingEconomy(0), bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, alloy: 0, crystal: 0, deuterium: 0 };
  const works = { REFINERY: 2, EXTRACTOR: 2, DEUTERIUM_PLANT: 2 };

  it('names the rate of every resource, for every level', () => {
    for (const level of [1, 2, 3, 4]) {
      expect(vesselRate.alloy(level)).toBe(alloyRate(level) * 3);
      expect(vesselRate.crystal(level)).toBe(crystalRate(level) * 3);
      expect(vesselRate.deuterium(level)).toBe(deuteriumRate(level) * 3);
    }
  });

  it('fills the works three times as fast', () => {
    const after = advanceVesselEconomy(empty, works, 60);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(2) * 3, 6);
    expect(after.bufferCrystal).toBeCloseTo(crystalRate(2) * 3, 6);
    expect(after.bufferDeuterium).toBeCloseTo(deuteriumRate(2) * 3, 6);
  });

  it('holds as many hours as before, so leaving the ship costs no more', () => {
    const week = advanceVesselEconomy(empty, works, 7 * 24 * 60);
    expect(week.bufferAlloy).toBe(collectorCap(alloyRate(2) * 3));
  });

  it('lands a haul against the larger works', () => {
    const haul = { alloy: 100_000, crystal: 0, deuterium: 0 };
    const { buffer } = landHaulInWorks({ bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 }, works, haul);
    const week = advanceVesselEconomy(empty, works, 7 * 24 * 60);
    expect(buffer.bufferAlloy).toBeCloseTo(week.bufferAlloy, 6);
  });
});
