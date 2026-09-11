import { describe, expect, it } from 'vitest';
import { HULLS , hullBulk } from '../packages/rules/src/hulls.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import { cost } from './fleet-economy-study.js';
import { affordablePacket, measureBattle, prototypeRoster, withRoster } from './fleet-economy-next-study.js';

/** Ground-excluded bulk of a wing. The Hangar that metered it is gone (D184); the studies still size fleets by it. */
const fleetBulk = (fleet: Record<string, number | undefined>): number =>
  Object.entries(fleet).reduce(
    (sum, [id, n]) => sum + (HULLS[id as keyof typeof HULLS].ground ? 0 : hullBulk(id as never) * (n ?? 0)),
    0,
  );

describe('mixed fleet and prototype experiment', () => {
  it('funds the whole mixed fleet, including aggregate return fuel', () => {
    const packet = { VIPER: 2, TALON: 1 };
    const recipe = cost(packet);
    const wallet = { ...recipe, deuterium: recipe.deuterium + missionFuel(packet, 1250, 2) };
    expect(affordablePacket(packet, wallet, fleetBulk(packet))).toEqual(packet);
    expect(affordablePacket(packet, { ...wallet, deuterium: wallet.deuterium - 1 }, 100)).toEqual({});
  });
  it('refuses zero and fractional composition packets', () => {
    expect(() => affordablePacket({}, { alloy: 100, crystal: 100, deuterium: 100 }, 10)).toThrow();
    expect(() => affordablePacket({ VIPER: 0.5 }, { alloy: 100, crystal: 100, deuterium: 100 }, 10)).toThrow();
    expect(() => affordablePacket({ VIPER: -1, TALON: 1 }, { alloy: 10000, crystal: 10000, deuterium: 10000 }, 100)).toThrow();
  });
  it('never reports mutual destruction as an attacker victory', () => {
    const r = measureBattle({ TALON: 45 }, { BALLISTA: 15 }, 0, {}, { SHIP_POWER: 2 });
    expect(r.mutualDestruction).toBe(r.samples);
    expect(r.attackerVictory).toBe(0);
    expect(r.meanAttackerReplacement).toEqual(cost({ TALON: 45 }));
    expect(r.meanAttackerYardMinutes).toBeGreaterThan(0);
  });
  it('measures shields and surviving forces instead of counting damage as victory', () => {
    const r = measureBattle({ VIPER: 1 }, { BALLISTA: 30 }, 1e6);
    expect(r.attackerVictory).toBe(0);
    expect(r.defenderVictory).toBe(r.samples);
    expect(r.meanDefenderReplacement).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
  it('keeps the game grade and haul separate from fleet destruction', () => {
    const r = measureBattle({ VIPER: 1 }, { BALLISTA: 30 }, 1e6, {}, {}, 128,
      { alloy: 10000, crystal: 10000, deuterium: 10000 });
    expect(r.grades.REPELLED).toBe(128);
    expect(r.meanLoot).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(r.meanNetResources?.deuterium).toBe(-HULLS.VIPER.deuterium - missionFuel({ VIPER: 1 }, 1250, 2));
  });
  it('restores production hull objects even if a prototype run fails', () => {
    const original = HULLS.DART;
    const roster = prototypeRoster(1.6);
    expect(() => withRoster(roster, () => {
      expect(HULLS.DART).not.toBe(original);
      throw new Error('experiment failed');
    })).toThrow('experiment failed');
    expect(HULLS.DART).toBe(original);
  });
  it('derives adjacent combat efficiency while keeping costs independent of that tuning', () => {
    const a = prototypeRoster(1.5), b = prototypeRoster(1.7);
    expect(a.DART?.alloy).toBe(b.DART?.alloy);
    expect(a.VIPER?.alloy).toBe(b.VIPER?.alloy);
    expect(b.VIPER?.atk).toBeGreaterThan(a.VIPER?.atk ?? 0);
    expect(a.DART?.deuterium).toBe(0);
  });
  it('can narrow attack/HP role differences without changing recipes', () => {
    const flat = prototypeRoster(1.65, 0.5, 0);
    expect(flat.VIPER?.atk).toBe(flat.TALON?.atk);
    expect(flat.VIPER?.hp).toBe(flat.SENTINEL?.hp);
    expect(flat.VIPER?.alloy).toBe(prototypeRoster(1.65, 0.5).VIPER?.alloy);
  });
});
