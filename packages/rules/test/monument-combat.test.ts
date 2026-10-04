import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MOBILE_HULLS,
  RESEARCH_TECH,
  fleetCount,
  fleetEntries,
  fleetValue,
  monumentBattleControl,
  mulberry32,
  resolveBattle,
  resolveMonumentCombat,
  type DefenderStack,
  type Fleet,
  type HpDamageLots,
  type JointAttackerStack,
  type Rng,
  type TechLevels,
} from '../src/index.js';

const flat = (): Rng => () => 0.5;
const attacker = (fleet: Fleet, id = 'attacker', damage?: HpDamageLots, tech: TechLevels = {}): JointAttackerStack => ({
  contributionId: id, playerId: id, fleet, tech: { tech }, ...(damage ? { damage } : {}),
});
const defender = (fleet: Fleet, id = 'defender', damage?: HpDamageLots, tech: TechLevels = {}): DefenderStack => ({
  stackId: id, playerId: id, fleet, tech: { tech }, ...(damage ? { damage } : {}),
});
const compact = (fleet: Fleet): Fleet => Object.fromEntries(fleetEntries(fleet));

describe('monument capture condition', () => {
  it('captures only after the whole defence is gone and a combat attacker survives', () => {
    expect(monumentBattleControl({ DART: 1, COURIER: 2 }, {})).toBe('ATTACKER');
    expect(monumentBattleControl({ COURIER: 2 }, {})).toBe('EMPTY');
    expect(monumentBattleControl({}, {})).toBe('EMPTY');
    expect(monumentBattleControl({ DART: 100 }, { COURIER: 1 })).toBe('DEFENDER');
    expect(monumentBattleControl({}, { DART: 1 })).toBe('DEFENDER');
  });

  it('keeps cargo-only control after a repelled attack', () => {
    const result = resolveMonumentCombat([attacker({ COURIER: 1 })], [defender({ COURIER: 1 })], flat());
    expect(result.control).toBe('DEFENDER');
    expect(result.defenderSurvivors.COURIER).toBe(1);
  });

  it('handles an empty monument without allowing a cargo-only capture', () => {
    expect(resolveMonumentCombat([attacker({ DART: 1 })], [], flat()).control).toBe('ATTACKER');
    expect(resolveMonumentCombat([attacker({ COURIER: 1 })], [], flat()).control).toBe('EMPTY');
  });

  it('does not declare a capture on simultaneous destruction', () => {
    const result = resolveMonumentCombat(
      [attacker({ DART: 1 }, 'a', [{ hull: 'DART', count: 1, damageBp: 9999 }])],
      [defender({ CITADEL: 1 }, 'd', [{ hull: 'CITADEL', count: 1, damageBp: 9999 }])], flat(),
    );
    expect(fleetCount(result.attackerSurvivors)).toBe(0);
    expect(fleetCount(result.defenderSurvivors)).toBe(0);
    expect(result.control).toBe('EMPTY');
  });
});

describe('monument battle carries every owner’s HP damage', () => {
  it('honors the lone defender’s damaged hull rather than treating it as a home host', () => {
    const a = [attacker({ DART: 1 })];
    const healthy = resolveMonumentCombat(a, [defender({ DART: 10 })], flat());
    const wounded = resolveMonumentCombat(a, [defender({ DART: 10 }, 'd', [{ hull: 'DART', count: 5, damageBp: 9500 }])], flat());
    expect(wounded.rounds[0]?.defenderLosses.DART).toBe(5);
    expect(wounded.defenderLossValue).toBeGreaterThan(healthy.defenderLossValue);
    expect(wounded.defenders[0]?.losses.DART).toBeGreaterThanOrEqual(5);
  });

  it('keeps sub-bp damage on both sides when neither side fires', () => {
    const result = resolveMonumentCombat(
      [attacker({ COURIER: 3 }, 'a', [{ hull: 'COURIER', count: 2, damageBp: 0, remainderBp: 0.25 }])],
      [defender({ ATLAS: 2 }, 'd', [{ hull: 'ATLAS', count: 1, damageBp: 2000, remainderBp: 0.75 }])], flat(),
    );
    expect(result.attackerDamage[0]).toMatchObject({ hull: 'COURIER', count: 2, damageBp: 0 });
    expect(result.attackerDamage[0]?.remainderBp).toBeCloseTo(0.25, 8);
    expect(result.defenderDamage[0]).toMatchObject({ hull: 'ATLAS', count: 1, damageBp: 2000 });
    expect(result.defenderDamage[0]?.remainderBp).toBeCloseTo(0.75, 8);
    expect(result.contributions[0]?.survivorDamage).toEqual(result.attackerDamage);
    expect(result.defenders[0]?.survivorDamage).toEqual(result.defenderDamage);
  });

  it('spends fire on the most damaged defenders across all owners before healthy equivalents', () => {
    const result = resolveMonumentCombat([attacker({ DART: 1 })], [
      defender({ DART: 10 }, 'healthy'),
      defender({ DART: 10 }, 'worn', [{ hull: 'DART', count: 5, damageBp: 9500, remainderBp: 0.5 }]),
    ], flat());
    expect(result.rounds[0]?.defenderLosses.DART).toBe(5);
    expect(result.defenders.find((row) => row.playerId === 'worn')?.losses.DART).toBeGreaterThanOrEqual(5);
    expect(result.defenders.find((row) => row.playerId === 'healthy')?.losses.DART ?? 0).toBe(0);
  });

  it('reads each defender’s own armor and leaves transports covered by ally combat ships', () => {
    const result = resolveMonumentCombat([attacker({ DART: 1 })], [
      defender({ CITADEL: 2 }, 'plain'),
      defender({ CITADEL: 2 }, 'armored', undefined, { SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel }),
      defender({ ARGOSY: 2 }, 'cargo', [{ hull: 'ARGOSY', count: 2, damageBp: 5000, remainderBp: 0.25 }]),
    ], flat());
    expect(result.shieldLeft).toBe(0);
    const cargo = result.defenders.find((row) => row.playerId === 'cargo')!;
    expect(compact(cargo.losses)).toEqual({});
    expect(cargo.survivorDamage[0]?.remainderBp).toBeCloseTo(0.25, 8);
    const plain = result.defenders.find((row) => row.playerId === 'plain')!;
    const armored = result.defenders.find((row) => row.playerId === 'armored')!;
    // The shared pool apportions fire by effective HP, so these equal-count
    // hulls carry the same percentage; the armored stack absorbed more HP.
    expect(plain.survivorDamage[0]?.damageBp).toBe(armored.survivorDamage[0]?.damageBp);
    const plainSolo = resolveMonumentCombat([attacker({ DART: 1 })], [defender({ CITADEL: 2 }, 'plain')], flat());
    const armoredSolo = resolveMonumentCombat([attacker({ DART: 1 })], [defender({ CITADEL: 2 }, 'armored', undefined, { SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel })], flat());
    expect(plainSolo.defenderDamage[0]?.damageBp ?? 0).toBeGreaterThan(armoredSolo.defenderDamage[0]?.damageBp ?? 0);
  });

  it('never heals an untouched attacker while a cargo-only defender has no return fire', () => {
    const result = resolveMonumentCombat(
      [attacker({ CITADEL: 2 }, 'a', [{ hull: 'CITADEL', count: 2, damageBp: 1000, remainderBp: 0.125 }])],
      [defender({ COURIER: 1 })], flat(),
    );
    expect(result.control).toBe('ATTACKER');
    expect(result.attackerDamage[0]).toMatchObject({ count: 2, damageBp: 1000 });
    expect(result.attackerDamage[0]?.remainderBp).toBeCloseTo(0.125, 8);
  });

  it('preserves an untouched final sliver of HP when adding the BP fields would round to full destruction', () => {
    const remainderBp = 1 - Number.EPSILON;
    const result = resolveMonumentCombat(
      [attacker({ COURIER: 1 }, 'a', [{ hull: 'COURIER', count: 1, damageBp: 9999, remainderBp }])],
      [defender({ COURIER: 1 })], flat(),
    );
    expect(result.attackerSurvivors.COURIER).toBe(1);
    expect(result.attackerDamage).toEqual([{ hull: 'COURIER', count: 1, damageBp: 9999, remainderBp }]);
  });

  it('rejects malformed counts, damage, duplicate identities and non-monument hulls', () => {
    expect(() => resolveMonumentCombat([], [defender({ DART: 1 })], flat())).toThrow(RangeError);
    for (const fleet of [{ DART: -1 }, { DART: 0.5 }, { BASTION: 1 }, { PROSPECTOR: 1 }]) {
      expect(() => resolveMonumentCombat([attacker(fleet)], [defender({ DART: 1 })], flat())).toThrow(RangeError);
      expect(() => resolveMonumentCombat([attacker({ DART: 1 })], [defender(fleet)], flat())).toThrow(RangeError);
    }
    expect(() => resolveMonumentCombat([attacker({ DART: 1 })], [defender({ DART: 1 }, 'd', [{ hull: 'DART', count: 2, damageBp: 10 }])], flat())).toThrow(RangeError);
    expect(() => resolveMonumentCombat([attacker({ DART: 1 })], [defender({ DART: 1 }, 'd', [{ hull: 'DART', count: 1, damageBp: 0, remainderBp: 1 }])], flat())).toThrow(RangeError);
    expect(() => resolveMonumentCombat([attacker({ DART: 1 }), attacker({ DART: 1 })], [], flat())).toThrow(RangeError);
    expect(() => resolveMonumentCombat([attacker({ DART: 1 })], [defender({ DART: 1 }), defender({ DART: 1 })], flat())).toThrow(RangeError);
  });

  it('keeps the normal planet’s host damage prohibition', () => {
    expect(() => resolveBattle([attacker({ DART: 1 })], [defender({ DART: 10 }, 'host', [{ hull: 'DART', count: 1, damageBp: 1000 }])], 0, flat())).toThrow(RangeError);
  });

  it('conserves all owner fleets, losses and damage on seeded battles', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ hull: fc.constantFrom(...MOBILE_HULLS), count: fc.integer({ min: 1, max: 25 }), damageBp: fc.integer({ min: 0, max: 9500 }), armor: fc.integer({ min: 0, max: RESEARCH_TECH.weaponMaxLevel }) }), { minLength: 2, maxLength: 8 }),
      fc.integer({ min: 0, max: 1_000_000 }),
      (rows, seed) => {
        const split = Math.ceil(rows.length / 2);
        const attackers = rows.slice(0, split).map((row, i) => attacker({ [row.hull]: row.count }, `a${String(i)}`, [{ hull: row.hull, count: row.count, damageBp: row.damageBp, remainderBp: 0.375 }], { SHIP_ARMOR: row.armor }));
        const defenders = rows.slice(split).map((row, i) => defender({ [row.hull]: row.count }, `d${String(i)}`, [{ hull: row.hull, count: row.count, damageBp: row.damageBp, remainderBp: 0.375 }], { SHIP_ARMOR: row.armor }));
        const result = resolveMonumentCombat(attackers, defenders, mulberry32(seed));
        expect(result).toEqual(resolveMonumentCombat(attackers, defenders, mulberry32(seed)));
        expect(result.attackerLossValue).toBe(result.contributions.reduce((sum, row) => sum + row.lossValue, 0));
        expect(result.defenderLossValue).toBe(result.defenders.reduce((sum, row) => sum + row.lossValue, 0));
        for (const row of [...result.contributions, ...result.defenders]) {
          for (const [hull, count] of fleetEntries(row.sent)) expect((row.survivors[hull] ?? 0) + (row.losses[hull] ?? 0)).toBe(count);
          expect(fleetValue(row.losses)).toBe(row.lossValue);
          for (const damage of row.survivorDamage) {
            expect(damage.count).toBeLessThanOrEqual(row.survivors[damage.hull] ?? 0);
            expect(damage.damageBp + (damage.remainderBp ?? 0)).toBeLessThan(10000);
          }
        }
      },
    ), { seed: 20261003, numRuns: 150 });
  });
});
