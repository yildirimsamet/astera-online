import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  allocateMonumentDominion,
  fleetValue,
  lootMonumentDeuterium,
  monumentCargoCapacity,
  splitMonumentBattleSurvivors,
  type MobileHullId,
  type MonumentShipLot,
} from '../src/index.js';

const lot = (id: string, playerId: string, hull: MobileHullId, over: Partial<MonumentShipLot> = {}): MonumentShipLot => ({
  id, playerId, waveId: `${playerId}-wave`, hull, count: 1,
  damageBp: 0, remainderBp: 0, deuterium: 0, tech: {}, ...over,
});
const loadOf = (lots: readonly MonumentShipLot[]): number => lots.reduce((sum, row) => sum + row.deuterium, 0);

describe('monument physical battle cargo', () => {
  it('splits different surviving health states with their own share of the original cargo', () => {
    const source = lot('source', 'a', 'COURIER', { count: 4, deuterium: 800.5 });
    const outcome = { survivors: 3, damage: [{ hull: 'COURIER' as const, count: 1, damageBp: 3000, remainderBp: 0.25 }] };
    const result = splitMonumentBattleSurvivors(source, outcome, ['damaged', 'healthy']);
    expect(result.lots).toEqual([
      { ...source, id: 'damaged', count: 1, deuterium: 200.125, damageBp: 3000, remainderBp: 0.25 },
      { ...source, id: 'healthy', count: 2, deuterium: 400.25 },
    ]);
    expect(result.destroyedCount).toBe(1);
    expect(result.destroyedDeuterium).toBe(200.125);
    expect(loadOf(result.lots) + result.destroyedDeuterium).toBe(source.deuterium);
    expect(source.count).toBe(4);
  });

  it('keeps per-wave provenance and precise existing damage without healing at the boundary', () => {
    const source = lot('source', 'a', 'ATLAS', { count: 2, deuterium: 200, damageBp: 2000, remainderBp: 0.5, tech: { SHIP_ARMOR: 4 } });
    const result = splitMonumentBattleSurvivors(source, { survivors: 2, damage: [source] }, ['after']);
    expect(result.lots).toEqual([{ ...source, id: 'after' }]);
    expect(result.destroyedDeuterium).toBe(0);
  });

  it('handles full destruction and never transfers a lost ship’s load into the survivors', () => {
    const source = lot('source', 'a', 'ARGOSY', { count: 2, deuterium: 400 });
    expect(splitMonumentBattleSurvivors(source, { survivors: 0, damage: [] }, [])).toEqual({ lots: [], destroyedCount: 2, destroyedDeuterium: 400 });
    const part = splitMonumentBattleSurvivors(source, { survivors: 1, damage: [] }, ['alive']);
    expect(part.lots[0]?.deuterium).toBe(200);
    expect(part.destroyedDeuterium).toBe(200);
  });

  it('rejects ship creation, malformed damage and missing or duplicate new lot identities', () => {
    const source = lot('source', 'a', 'COURIER', { count: 2 });
    for (const survivors of [-1, 3, 0.5, Number.NaN]) {
      expect(() => splitMonumentBattleSurvivors(source, { survivors, damage: [] }, ['after'])).toThrow(RangeError);
    }
    expect(() => splitMonumentBattleSurvivors(source, { survivors: 1, damage: [{ hull: 'ATLAS', count: 1, damageBp: 10 }] }, ['after'])).toThrow(RangeError);
    expect(() => splitMonumentBattleSurvivors(source, { survivors: 1, damage: [] }, [])).toThrow(RangeError);
    expect(() => splitMonumentBattleSurvivors(source, { survivors: 1, damage: [] }, [''])).toThrow(RangeError);
    expect(() => splitMonumentBattleSurvivors(source, { survivors: 2, damage: [{ hull: 'COURIER', count: 1, damageBp: 10 }] }, ['same', 'same'])).toThrow(RangeError);
    const wounded = { ...source, damageBp: 2000, remainderBp: 0.5 };
    expect(() => splitMonumentBattleSurvivors(wounded, { survivors: 1, damage: [] }, ['after'])).toThrow(RangeError);
  });

  it('loots only destroyed enemy physical cargo up to the victor’s surviving dedicated free holds', () => {
    const winners = [lot('combat', 'a', 'CITADEL'), lot('small', 'a', 'COURIER', { deuterium: 990 }), lot('large', 'b', 'ATLAS')];
    const deadEnemy = [lot('enemy', 'enemy', 'ARGOSY', { deuterium: 200 })];
    const result = lootMonumentDeuterium(winners, deadEnemy);
    expect(result.shares).toEqual([{ playerId: 'a', deuterium: 10 }, { playerId: 'b', deuterium: 190 }]);
    expect(result.lots.find((row) => row.id === 'combat')?.deuterium).toBe(0);
    expect(loadOf(result.lots)).toBeCloseTo(1190);
    expect(result.discardedDeuterium).toBe(0);
  });

  it('preserves the ordinary joint loot’s equal owner sharing before capacity, independently of production weights', () => {
    const winners = [lot('a-combat', 'a', 'CITADEL', { count: 100 }), lot('a-cargo', 'a', 'COURIER'), lot('b-cargo', 'b', 'ATLAS')];
    const result = lootMonumentDeuterium(winners, [lot('enemy', 'enemy', 'ARGOSY', { deuterium: 100.5 })]);
    expect(result.shares).toEqual([{ playerId: 'a', deuterium: 50.25 }, { playerId: 'b', deuterium: 50.25 }]);
  });

  it('never exceeds free capacity, and discards uncarried loot rather than filling a hidden warehouse', () => {
    const winners = [lot('cargo', 'a', 'COURIER', { deuterium: 990 })];
    const result = lootMonumentDeuterium(winners, [lot('enemy', 'enemy', 'ARGOSY', { deuterium: 50 })]);
    expect(result.lots[0]?.deuterium).toBe(1000);
    expect(result.discardedDeuterium).toBe(40);
    expect(lootMonumentDeuterium([lot('fighter', 'a', 'CITADEL')], [lot('enemy', 'enemy', 'ARGOSY', { deuterium: 50 })]).discardedDeuterium).toBe(50);
    expect(() => lootMonumentDeuterium(winners, [lot('own', 'a', 'ARGOSY', { deuterium: 50 })])).toThrow(RangeError);
  });

  it('conserves original cargo under arbitrary battle casualties and split health groups', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 100 }), (count, fill, rolls) => {
      const source = lot('source', 'a', 'COURIER', { count, deuterium: count * fill });
      const survivors = Math.min(count, rolls);
      const damaged = Math.floor(survivors / 2);
      const damage = damaged > 0 ? [{ hull: 'COURIER' as const, count: damaged, damageBp: 5000, remainderBp: 0.375 }] : [];
      const ids = survivors === 0 ? [] : damaged === 0 ? ['healthy'] : ['damaged', 'healthy'];
      const result = splitMonumentBattleSurvivors(source, { survivors, damage }, ids);
      expect(loadOf(result.lots) + result.destroyedDeuterium).toBeCloseTo(source.deuterium, 6);
      expect(result.lots.reduce((sum, row) => sum + row.count, 0) + result.destroyedCount).toBe(count);
      for (const row of result.lots) expect(row.deuterium).toBeLessThanOrEqual(monumentCargoCapacity(row));
    }), { seed: 20261003, numRuns: 150 });
  });
});

describe('monument Dominion participation power', () => {
  it('aggregates each owner’s battle-start power, even after all their ships die', () => {
    const contribution = [
      { playerId: 'a', fleet: { DART: 1 } }, { playerId: 'a', fleet: { DART: 2 } },
      { playerId: 'b', fleet: { DART: 1 } }, { playerId: 'cargo', fleet: { ARGOSY: 100 } },
    ];
    expect(allocateMonumentDominion(100, contribution)).toEqual([
      { playerId: 'a', delta: 75 }, { playerId: 'b', delta: 25 }, { playerId: 'cargo', delta: 0 },
    ]);
    expect(allocateMonumentDominion(-100, contribution)).toEqual([
      { playerId: 'a', delta: -75 }, { playerId: 'b', delta: -25 }, { playerId: 'cargo', delta: 0 },
    ]);
  });

  it('handles integer remainder ties deterministically and conserves the whole side transfer', () => {
    const participants = [{ playerId: 'b', fleet: { DART: 1 } }, { playerId: 'a', fleet: { DART: 1 } }];
    expect(allocateMonumentDominion(1, participants)).toEqual([{ playerId: 'a', delta: 1 }, { playerId: 'b', delta: 0 }]);
    expect(allocateMonumentDominion(-1, participants)).toEqual([{ playerId: 'a', delta: -1 }, { playerId: 'b', delta: 0 }]);
    expect(allocateMonumentDominion(0, [{ playerId: 'cargo', fleet: { ARGOSY: 1 } }])).toEqual([{ playerId: 'cargo', delta: 0 }]);
  });

  it('uses the approved cargo build-value fallback only when the whole side has no combat power', () => {
    const cargoOnly = [
      { playerId: 'a', fleet: { COURIER: 1 } }, { playerId: 'b', fleet: { ARGOSY: 1 } },
    ];
    const a = fleetValue(cargoOnly[0]!.fleet);
    const b = fleetValue(cargoOnly[1]!.fleet);
    expect(allocateMonumentDominion(-(a + b), cargoOnly)).toEqual([{ playerId: 'a', delta: -a }, { playerId: 'b', delta: -b }]);
    expect(allocateMonumentDominion(100, [{ playerId: 'a', fleet: { DART: 1 } }, ...cargoOnly.slice(1)])).toEqual([{ playerId: 'a', delta: 100 }, { playerId: 'b', delta: 0 }]);
    expect(allocateMonumentDominion(-1, [{ playerId: 'cargo', fleet: { ARGOSY: 1 } }])).toEqual([{ playerId: 'cargo', delta: -1 }]);
  });

  it('rejects invalid transfers, empty nonzero sides and missing owners', () => {
    const participants = [{ playerId: 'a', fleet: { DART: 1 } }];
    for (const amount of [0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) expect(() => allocateMonumentDominion(amount, participants)).toThrow(RangeError);
    expect(() => allocateMonumentDominion(1, [])).toThrow(RangeError);
    expect(() => allocateMonumentDominion(1, [{ playerId: '', fleet: { DART: 1 } }])).toThrow(RangeError);
  });

  it('includes Collector build value in the approved zero-combat fallback', () => {
    const collector = { playerId: 'a', fleet: { GARBAGE_COLLECTOR: 2 } };
    const cargo = { playerId: 'b', fleet: { COURIER: 1 } };
    const a = fleetValue(collector.fleet);
    const b = fleetValue(cargo.fleet);
    expect(allocateMonumentDominion(-(a + b), [collector, cargo])).toEqual([
      { playerId: 'a', delta: -a }, { playerId: 'b', delta: -b },
    ]);
    expect(allocateMonumentDominion(-7, [collector])).toEqual([{ playerId: 'a', delta: -7 }]);
    expect(allocateMonumentDominion(20, [collector, { playerId: 'b', fleet: { DART: 1 } }])).toEqual([
      { playerId: 'a', delta: 0 }, { playerId: 'b', delta: 20 },
    ]);
  });

  it('is zero-sum across two sides for arbitrary signed transfers and participation powers', () => {
    fc.assert(fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 8 }), (total, weights) => {
      const participants = weights.map((count, i) => ({ playerId: String(i), fleet: { DART: count } }));
      const attack = allocateMonumentDominion(total, participants);
      const defence = allocateMonumentDominion(-total, [...participants].reverse());
      expect(attack.reduce((sum, row) => sum + row.delta, 0)).toBe(total);
      expect(defence.reduce((sum, row) => sum + row.delta, 0)).toBe(-total);
      expect(attack).toEqual(allocateMonumentDominion(total, [...participants].reverse()));
    }), { seed: 20261003, numRuns: 150 });
  });
});
