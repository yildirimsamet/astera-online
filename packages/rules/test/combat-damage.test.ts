import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS, HULLS, MOBILE_HULLS, fleetEntries, mulberry32, normalizeLots,
  resolveBattle, resolveCombat, resolveJointCombat,
  type DamageLot, type Fleet, type HullId, type JointAttackerStack,
} from '../src/index.js';

const NO_TECH = { attacker: { tech: {} }, defender: { tech: {} } };
const lot = (hull: HullId, count: number, damageBp: number): DamageLot => ({ hull, count, damageBp });

describe('persistent wounds with random per-ship targets', () => {
  it('keeps multiple independently wounded survivors instead of concentrating fire into one carry', () => {
    const result = resolveCombat({ DART: 5 }, { COURIER: 50 }, 0, mulberry32(123), NO_TECH);
    expect(result.defenderDamage.reduce((sum, row) => sum + row.count, 0)).toBeGreaterThan(1);
    expect(result.attackerDamage).toEqual([]);
  });

  it('carries untouched arrival damage exactly, with no hull or shield turned into free repair', () => {
    const damage = [{ hull: 'COURIER' as const, count: 2, damageBp: 5000, remainderBp: 0.125 }];
    const result = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { COURIER: 5 }, tech: { tech: {} }, damage }],
      [{ stackId: 'd', playerId: 'd', fleet: {}, tech: { tech: {} } }], 0, mulberry32(9), 'MONUMENT');
    expect(result.attackerDamage).toEqual(damage);
    expect(result.contributions[0]!.survivorDamage).toEqual(damage);
    expect(result.rounds).toEqual([]);
  });

  it('keeps every owner’s wounds invariant when contribution enumeration is reversed', () => {
    const rows: JointAttackerStack[] = [
      { contributionId: 'a', playerId: 'p1', fleet: { COURIER: 10 }, tech: { tech: {} } },
      { contributionId: 'b', playerId: 'p2', fleet: { COURIER: 4 }, tech: { tech: { SHIP_ARMOR: 3 } }, damage: [lot('COURIER', 1, 9000)] },
    ];
    const a = resolveJointCombat(rows, { DART: 10 }, 0, mulberry32(55), { tech: {} }, true);
    const b = resolveJointCombat([...rows].reverse(), { DART: 10 }, 0, mulberry32(55), { tech: {} }, true);
    for (const own of a.contributions) expect(b.contributions.find(row => row.contributionId === own.contributionId)).toEqual(own);
    expect(b.attackerSurvivors).toEqual(a.attackerSurvivors);
    expect(b.attackerDamage).toEqual(a.attackerDamage);
  });

  it('never reports wounds on ground guns or destroyed ships', () => {
    const result = resolveCombat({ DART: 200 }, { BASTION: 3, COURIER: 1 }, 0, mulberry32(3), NO_TECH);
    expect(result.defenderDamage.every(row => !HULLS[row.hull].ground && (result.defenderSurvivors[row.hull] ?? 0) >= row.count)).toBe(true);
  });

  it('refuses arrival wounds on ships the wave did not bring', () => {
    expect(() => resolveCombat({ COURIER: 5 }, { DART: 1 }, 0, mulberry32(1), NO_TECH, [lot('COURIER', 6, 5000)])).toThrow(RangeError);
    expect(() => resolveJointCombat([{ contributionId: 'c', playerId: 'p', fleet: { PIKE: 1 }, tech: { tech: {} }, damage: [lot('DART', 1, 5000)] }],
      { DART: 1 }, 0, mulberry32(1), { tech: {} })).toThrow(RangeError);
  });
});

/* ── properties over random battles ──────────────────────────────── */

const arbFleet = (pool: readonly HullId[]) => fc
  .array(fc.tuple(fc.constantFrom(...pool), fc.integer({ min: 1, max: 120 })), { minLength: 1, maxLength: 4 })
  .map((rows) => {
    const out: Fleet = {};
    for (const [hull, n] of rows) out[hull] = (out[hull] ?? 0) + n;
    return out;
  });

const tally = (lots: readonly DamageLot[]): Fleet => {
  const out: Fleet = {};
  for (const row of lots) out[row.hull] = (out[row.hull] ?? 0) + row.count;
  return out;
};

describe('damage properties', () => {
  it('random fire can wound several survivors, all wounds belong to living ships', () => {
    fc.assert(fc.property(
      arbFleet(MOBILE_HULLS), arbFleet(ALL_HULLS), fc.integer({ min: 1, max: 1_000_000 }),
      (attacker, defender, seed) => {
        const result = resolveCombat(attacker, defender, 0, mulberry32(seed), NO_TECH);
        for (const [side, lots, survivors] of [
          ['attacker', result.attackerDamage, result.attackerSurvivors],
          ['defender', result.defenderDamage, result.defenderSurvivors],
        ] as const) {
          for (const [hull, count] of fleetEntries(tally(lots))) {
            expect(count, `${side} ${hull}`).toBeLessThanOrEqual(survivors[hull] ?? 0);
            expect(survivors[hull] ?? 0).toBeGreaterThan(0);
          }
          for (const row of lots) {
            expect(row.damageBp).toBeGreaterThanOrEqual(1);
            expect(row.damageBp).toBeLessThanOrEqual(9999);
            expect(HULLS[row.hull].ground).toBe(false);
          }
        }
      },
    ), { numRuns: 150 });
  });

  it('with prior damage: every ship is accounted for and no damaged survivor heals', () => {
    const arbStack = arbFleet(MOBILE_HULLS).chain((fleet) => {
      const entries = fleetEntries(fleet);
      return fc.tuple(
        fc.constant(fleet),
        fc.array(
          fc.tuple(fc.integer({ min: 0, max: entries.length - 1 }), fc.integer({ min: 1, max: 9999 })),
          { maxLength: 6 },
        ).map((rows) => {
          const used: Fleet = {};
          const lots: DamageLot[] = [];
          for (const [index, bp] of rows) {
            const [hull, count] = entries[index]!;
            if ((used[hull] ?? 0) >= count) continue;
            used[hull] = (used[hull] ?? 0) + 1;
            lots.push(lot(hull, 1, bp));
          }
          return lots;
        }),
      );
    });
    fc.assert(fc.property(
      fc.array(arbStack, { minLength: 1, maxLength: 3 }), arbFleet(ALL_HULLS), fc.integer({ min: 1, max: 1_000_000 }),
      (waves, defender, seed) => {
        const stacks: JointAttackerStack[] = waves.map(([fleet, damage], i) => ({
          contributionId: `c${String(i)}`, playerId: `p${String(i)}`, fleet, tech: { tech: {} }, damage,
        }));
        const result = resolveJointCombat(stacks, defender, 0, mulberry32(seed), { tech: {} });
        const merged: DamageLot[] = [];
        result.contributions.forEach((row, i) => {
          const before = tally(waves[i]![1]);
          const after = tally(row.survivorDamage);
          for (const hull of ALL_HULLS) {
            const sent = row.sent[hull] ?? 0;
            const survived = row.survivors[hull] ?? 0;
            const lost = row.losses[hull] ?? 0;
            expect(survived + lost).toBe(sent);
            expect(after[hull] ?? 0).toBeLessThanOrEqual(survived);
            // Even random targeting cannot erase arrival wounds without destroying their ships.
            expect(after[hull] ?? 0).toBeGreaterThanOrEqual(Math.max(0, (before[hull] ?? 0) - lost));
          }
          merged.push(...row.survivorDamage);
        });
        expect(result.attackerDamage).toEqual(normalizeLots(merged));
      },
    ), { numRuns: 150 });
  });
});
