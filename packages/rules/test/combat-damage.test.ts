import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  COMBAT,
  HULLS,
  MOBILE_HULLS,
  counterMult,
  fleetEntries,
  hullTech,
  mulberry32,
  normalizeLots,
  resolveCombat,
  resolveJointCombat,
  type DamageLot,
  type Fleet,
  type HullId,
  type JointAttackerStack,
} from '../src/index.js';

/**
 * KALICI GEMİ HASARI IN THE RESOLVER. Owner decision K1, 2026-09-29 (`plan.md` F1).
 *
 * The resolver already carried a part-damaged ship from round to round: damage lands on
 * one ship of a type until it dies, and what is left over is `carry`. It threw that away
 * when the battle ended. Now the carry comes back out as a damage lot, and an attacker
 * who arrives damaged (radiation) loses its most damaged ships first. Kills, rolls and
 * grades are pinned separately by `combat-parity-digest.test.ts`.
 */

/** A die that always lands mid-band, so every roll is the same known number. */
const MID = (): number => 0.5;
const ROLL = COMBAT.varianceMin + 0.5 * (COMBAT.varianceMax - COMBAT.varianceMin);
const NO_TECH = { attacker: { tech: {} }, defender: { tech: {} } };
const lot = (hull: HullId, count: number, damageBp: number): DamageLot => ({ hull, count, damageBp });
const hp = (hull: HullId): number => HULLS[hull].hp * hullTech({}, hull).hp;

/** One Dart's shot at a transport, exactly as `damageMap` builds it. */
const dartShot = (mult = 1): number =>
  1 * (HULLS.DART.atk * hullTech({}, 'DART').atk * mult) * counterMult('SKIRMISHER', 'SUPPORT') * 1 * ROLL;

/** Three rounds of the same shot into one pile, with the resolver's own carry arithmetic. */
function carryAfterThreeRounds(shot: number, hull: HullId): { killed: number; carry: number } {
  let carry = 0;
  let killed = 0;
  for (let round = 0; round < COMBAT.rounds; round++) {
    const effective = shot * 1 + carry;
    const k = Math.floor(effective / hp(hull));
    killed += k;
    carry = effective - k * hp(hull);
  }
  return { killed, carry };
}

describe('the carry comes out of the battle as damage', () => {
  it('leaves the defender one part-damaged ship per hull', () => {
    const { killed, carry } = carryAfterThreeRounds(dartShot(), 'COURIER');
    expect(killed).toBe(1);
    const result = resolveCombat({ DART: 1 }, { COURIER: 50 }, 0, MID, NO_TECH);
    expect(result.defenderLosses).toEqual({ COURIER: killed });
    expect(result.defenderDamage).toEqual([lot('COURIER', 1, Math.round((carry / hp('COURIER')) * 10_000))]);
    expect(result.attackerDamage).toEqual([]);
  });

  it('leaves the attacker one part-damaged ship per hull, on its contribution', () => {
    const { killed, carry } = carryAfterThreeRounds(dartShot(), 'COURIER');
    const expected = [lot('COURIER', 1, Math.round((carry / hp('COURIER')) * 10_000))];
    const solo = resolveCombat({ COURIER: 50 }, { DART: 1 }, 0, MID, NO_TECH);
    expect(solo.attackerLosses).toEqual({ COURIER: killed });
    expect(solo.attackerDamage).toEqual(expected);
    expect(solo.defenderDamage).toEqual([]);

    const joint = resolveJointCombat(
      [{ contributionId: 'c', playerId: 'p', fleet: { COURIER: 50 }, tech: { tech: {} } }],
      { DART: 1 }, 0, MID, { tech: {} },
    );
    expect(joint.contributions[0]?.survivorDamage).toEqual(expected);
    expect(joint.attackerDamage).toEqual(expected);
  });

  it('never reports damage on a ground gun — they rebuild from salvage instead', () => {
    const result = resolveCombat({ DART: 10 }, { BASTION: 5 }, 0, MID, NO_TECH);
    expect(result.defenderSurvivors.BASTION ?? 0).toBeGreaterThan(0);
    expect(result.defenderDamage.some((row) => HULLS[row.hull].ground)).toBe(false);
  });

  it('reports nothing for a hull that was wiped out', () => {
    const result = resolveCombat({ DART: 200 }, { COURIER: 1 }, 0, MID, NO_TECH);
    expect(result.defenderSurvivors.COURIER ?? 0).toBe(0);
    expect(result.defenderDamage).toEqual([]);
  });
});

describe('an attacker that arrives damaged loses its most damaged ships first', () => {
  /** The defender's handicap tunes one Dart to exactly a quarter of a transport per round. */
  const quarter = (0.25 * hp('COURIER')) / dartShot();

  it('kills the half-dead transport and wounds the next damaged one, not a healthy one', () => {
    const result = resolveCombat(
      { COURIER: 5 },
      { DART: 1 },
      0,
      MID,
      { attacker: { tech: {} }, defender: { tech: {}, damageMult: quarter } },
      [lot('COURIER', 2, 5000)],
    );
    // Three quarters of a hull: the first half-damaged ship dies on half of it, and the
    // quarter left lands on the second, which now carries three quarters of damage.
    expect(result.attackerLosses).toEqual({ COURIER: 1 });
    expect(result.attackerSurvivors).toEqual({ COURIER: 4 });
    expect(result.attackerDamage).toEqual([lot('COURIER', 1, 7500)]);
  });

  it('spends a damaged wave first inside a shared cohort, and gives the leftover to the largest healthy wave', () => {
    const fifth = (0.2 * hp('COURIER')) / dartShot();
    const stacks: JointAttackerStack[] = [
      { contributionId: 'a', playerId: 'p1', fleet: { COURIER: 10 }, tech: { tech: {} } },
      { contributionId: 'b', playerId: 'p2', fleet: { COURIER: 4 }, tech: { tech: {} }, damage: [lot('COURIER', 1, 9000)] },
    ];
    const result = resolveJointCombat(stacks, { DART: 1 }, 0, MID, { tech: {}, damageMult: fifth });
    const [a, b] = result.contributions;
    expect(b?.losses).toEqual({ COURIER: 1 });
    expect(b?.survivorDamage).toEqual([]);
    expect(a?.losses).toEqual({});
    // Three fifths of a hull: one tenth kills b's wreck, half a hull is left on a healthy ship.
    expect(a?.survivorDamage).toEqual([lot('COURIER', 1, 5000)]);
    expect(result.attackerDamage).toEqual([lot('COURIER', 1, 5000)]);
  });

  it('breaks an even tie by contribution id, so the answer never depends on array order', () => {
    const tenth = (0.1 * hp('COURIER')) / dartShot();
    const stacks = (order: 'ab' | 'ba'): JointAttackerStack[] => {
      const rows: JointAttackerStack[] = [
        { contributionId: 'a', playerId: 'p1', fleet: { COURIER: 5 }, tech: { tech: {} } },
        { contributionId: 'b', playerId: 'p2', fleet: { COURIER: 5 }, tech: { tech: {} } },
      ];
      return order === 'ab' ? rows : [rows[1]!, rows[0]!];
    };
    for (const order of ['ab', 'ba'] as const) {
      const result = resolveJointCombat(stacks(order), { DART: 1 }, 0, MID, { tech: {}, damageMult: tenth });
      const byId = new Map(result.contributions.map((row) => [row.contributionId, row]));
      expect(byId.get('a')?.survivorDamage).toEqual([lot('COURIER', 1, 3000)]);
      expect(byId.get('b')?.survivorDamage).toEqual([]);
    }
  });

  it('refuses damage on ships the wave did not bring', () => {
    expect(() => resolveCombat({ COURIER: 5 }, { DART: 1 }, 0, MID, NO_TECH, [lot('COURIER', 6, 5000)]))
      .toThrow(RangeError);
    expect(() => resolveJointCombat(
      [{ contributionId: 'c', playerId: 'p', fleet: { PIKE: 1 }, tech: { tech: {} }, damage: [lot('DART', 1, 5000)] }],
      { DART: 1 }, 0, MID, { tech: {} },
    )).toThrow(RangeError);
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
  it('without prior damage: at most one damaged survivor per hull, per side and per wave', () => {
    fc.assert(fc.property(
      arbFleet(MOBILE_HULLS), arbFleet(ALL_HULLS), fc.integer({ min: 1, max: 1_000_000 }),
      (attacker, defender, seed) => {
        const result = resolveCombat(attacker, defender, 0, mulberry32(seed), NO_TECH);
        for (const [side, lots, survivors] of [
          ['attacker', result.attackerDamage, result.attackerSurvivors],
          ['defender', result.defenderDamage, result.defenderSurvivors],
        ] as const) {
          for (const [hull, count] of fleetEntries(tally(lots))) {
            expect(count, `${side} ${hull}`).toBe(1);
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
            // The damaged die first, so a damaged ship survives only while the losses fell short of them.
            expect(after[hull] ?? 0).toBeGreaterThanOrEqual(Math.max(0, (before[hull] ?? 0) - lost));
          }
          merged.push(...row.survivorDamage);
        });
        expect(result.attackerDamage).toEqual(normalizeLots(merged));
      },
    ), { numRuns: 150 });
  });
});
