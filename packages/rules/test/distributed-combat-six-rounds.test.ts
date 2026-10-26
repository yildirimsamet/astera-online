import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COMBAT, HULLS, counterMult, fleetCount, mulberry32, resolveBattle,
  resolveMonumentCombat, resolveRaid, seededFrom,
  type Fleet, type HullId, type JointAttackerStack,
} from '../src/index.js';
import { resolveRandomBattle, resolveVolley, type VolleyShip } from '../src/randomBattle.js';
import { distributedCombatReference } from './fixtures/distributed-combat-reference.js';
import { createBattleRecording, type RecordedShot } from '../src/battleRecording.js';

const ship = (hull: HullId, hp = 1000, attack = 0, shield = 0): VolleyShip =>
  ({ hull, hp, attack, shield, owner: 0, canFire: true, retreated: false });
const attack = (fleet: Fleet): JointAttackerStack[] =>
  [{ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} } }];
const defence = (fleet: Fleet) => [{ stackId: 'd', playerId: 'd', fleet, tech: { tech: {} } }];
const mean = () => .5;

/*
 * The per-ship engine's invariants, kept through combat v3 (owner 2026-10-25): eight rounds,
 * one target per shot. The v3 rules themselves are pinned in combat-v3.test.ts.
 */
describe('per-ship combat: invariants carried into v3', () => {
  it.each(distributedCombatReference)('$name preserves ownership, shot budgets and determinism', spec => {
    // These inputs cover the earlier all-target calibration. Its numeric golden
    // results remain in the fixture as history, not as expectations for v3.
    const rng = () => typeof spec.seed === 'string' ? seededFrom(spec.seed) : mulberry32(spec.seed);
    const recording = createBattleRecording();
    const result = resolveRandomBattle(spec.attackers, spec.defenders, spec.shield, rng(), spec.precise, spec.maintenance, recording);
    expect(result).toEqual(resolveRandomBattle(spec.attackers, spec.defenders, spec.shield, rng(), spec.precise, spec.maintenance));
    expect(result.rounds.every(round => round.distributedFire === true && round.targetLimit === COMBAT.targetsPerShot)).toBe(true);
    for (const owner of [...result.contributions, ...result.defenders]) {
      expect(fleetCount(owner.sent)).toBe(fleetCount(owner.survivors) + fleetCount(owner.losses));
      expect(fleetCount(owner.retreated ?? {})).toBeLessThanOrEqual(fleetCount(owner.survivors));
    }
    for (const round of recording.rounds) for (const shot of [...round.attackerShots, ...round.defenderShots]) {
      expect(new Set(shot.hits.map(hit => hit.targetId)).size).toBe(shot.hits.length);
      expect(shot.hits.reduce((sum, hit) => sum + (hit.normalAegisDamage + hit.shieldDamage + hit.hullDamage) / hit.counter, shot.unusedBaseDamage)).toBeCloseTo(shot.baseDamage, 7);
      for (const hit of shot.hits) {
        expect(hit.hpAfter).toBeGreaterThanOrEqual(0);
        expect(hit.hpBefore - hit.hpAfter).toBeCloseTo(hit.hullDamage, 7);
        expect(hit.shieldBefore - hit.shieldAfter).toBeCloseTo(hit.shieldDamage, 7);
      }
    }
  });

  it('never mutates the live round snapshot it fires from', () => {
    const from = [ship('CORSAIR', 1000, 408)], to = Array.from({ length: 10 }, () => ship('DART'));
    const before = structuredClone({ from, to });
    const r = resolveVolley(from, to, 1, mulberry32(19), 0, 1);
    expect(r.hp.reduce((sum, hp) => sum + 1000 - hp, 0)).toBeCloseTo(408, 8);
    expect({ from, to }).toEqual(before);
  });

  it('redistributes same-shot overkill to other warships before cargo', () => {
    const r = resolveVolley([ship('CORSAIR', 1000, 100)],
      [ship('DART', 10), ship('DART', 1000), ship('COURIER', 100)], 1, () => 0, 0, 1);
    expect(r.hp).toEqual([0, 910, 100]);
    expect(r.credited).toEqual([100]);
  });

  it('protects cargo AND collectors, then moves surplus to one of them within the same shot', () => {
    const from = [ship('CORSAIR', 1000, 20)];
    const protectedHit = resolveVolley(from,
      [ship('DART', 1000), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)], 1, () => 0, 0, 1);
    expect(protectedHit.hp).toEqual([980, 100, 100]);
    const overflow = resolveVolley(from,
      [ship('DART', 5, 0, 3), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)], 1, () => 0, 0, 1);
    expect(overflow.hp[0]).toBe(0);
    // Twelve base damage left, landing on one SUPPORT target at the existing 1.6 counter.
    expect(overflow.hp.slice(1).sort()).toEqual([100 - 12 * COMBAT.strongMult, 100].sort());
  });

  it('converts surplus back to base damage before applying a different target counter', () => {
    const r = resolveVolley([ship('CATACLYSM', 1000, 100)],
      [ship('DART', 30), ship('CITADEL', 1000)], 1, () => 0, 0, 1);
    expect(r.hp[0]).toBe(0);
    expect(r.hp[1]).toBeCloseTo(949.21875, 10);
    expect(r.hullDamage).toBeCloseTo(80.78125, 10);
  });

  it('keeps Nullifier bonus shield-only and credits actual hull damage once', () => {
    const r = resolveVolley([ship('NULLIFIER', 1000, 100)], [ship('DART', 1000)], 1, () => 0, 500, 1);
    expect(r.specialistAbsorbed).toBe(500);
    expect(r.aegis).toBe(0);
    expect(r.hp).toEqual([840]);
    expect(r.credited).toEqual([160]);
  });

  it('allows late-round escape, preserving living ships and their owner/wounds', () => {
    let lateEscapes = 0;
    for (let seed = 0; seed < 64; seed++) {
      const r = resolveBattle(attack({ CITADEL: 10 }), defence({ CITADEL: 10 }), 0, mulberry32(seed), 'HP_PLANET');
      for (const round of r.rounds) {
        if (round.round >= 4) lateEscapes += (round.retreats ?? []).reduce((sum, row) => sum + fleetCount(row.fleet), 0);
        if (round.round === COMBAT.rounds) expect(round.retreats).toEqual([]);
      }
      expect(fleetCount(r.attackerSurvivors) + fleetCount(r.attackerLosses)).toBe(10);
      expect(fleetCount(r.defenderSurvivors) + fleetCount(r.defenderLosses)).toBe(10);
    }
    expect(lateEscapes).toBeGreaterThan(0);
  });

  it('lets a ship killed in the round still fire that round', () => {
    const r = resolveBattle(attack({ DART: 1 }), defence({ DART: 30 }), 0, mean);
    expect(r.rounds[0]!.attackerLosses).toEqual({ DART: 1 });
    expect(r.rounds[0]!.attackerDamage).toBeGreaterThan(0);
    expect(r.rounds).toHaveLength(1); expect(r.rounds[0]!.retreats).toEqual([]);
  });

  it('settles the reported heavy-wing-versus-many-Darts battle as a decisive raid', () => {
    const fleet = { ATLAS: 1, CITADEL: 3, CORSAIR: 5, PALADIN: 5, CATACLYSM: 11 };
    const tech = { SHIP_POWER: 5, SHIP_ARMOR: 5, SHIP_SHIELDS: 4 };
    const r = resolveRaid({ stacks: attack(fleet).map(row => ({ ...row, tech: { tech } })),
      line: { DART: 235, THORN: 15, COURIER: 2 }, shield: 150,
      rng: () => seededFrom('9865571b-fda2-4af5-86e7-a051712410d2'),
      defender: { tech: { SHIP_POWER: 2 } }, deuterium: 0, escape: true,
      minimumCombatShips: 5, maintenance: true, preciseDamage: true });
    expect(r.escape).toBeNull(); expect(r.result.grade).toBe('DECISIVE');
    const active = fleetCount(r.result.defenderSurvivors) - fleetCount(r.result.defenderRetreated ?? {});
    expect(active).toBe(0);
  });

  it('keeps cargo-only monument control and allows a surviving warship to evict support', () => {
    const held = resolveMonumentCombat(attack({ COURIER: 2 }), defence({ GARBAGE_COLLECTOR: 1 }), mean);
    expect(held.control).toBe('DEFENDER'); expect(held.rounds).toEqual([]);
    const won = resolveMonumentCombat(attack({ CORSAIR: 3 }), defence({ CORSAIR: 1, GARBAGE_COLLECTOR: 1 }), mean);
    expect(won.control).toBe('ATTACKER');
  });
});


it('conserves base-shot energy through mixed counters, shields, cargo and repeated overkill', () => {
  fc.assert(fc.property(fc.constantFrom('DART' as const, 'CITADEL' as const, 'CATACLYSM' as const),
    fc.array(fc.record({ hull: fc.constantFrom('DART' as const, 'CITADEL' as const, 'CATACLYSM' as const, 'COURIER' as const, 'GARBAGE_COLLECTOR' as const),
      hp: fc.integer({ min: 1, max: 1000 }), shield: fc.integer({ min: 0, max: 500 }), retreated: fc.boolean() }), { minLength: 1, maxLength: 25 }),
    fc.integer({ min: 1, max: 10000 }), fc.nat(), (hull, targets, power, seed) => {
      const to = targets.map(target => ({ ...ship(target.hull, target.hp, 0, target.shield), retreated: target.retreated }));
      const from = [ship(hull, 1000, power / 4), { ...ship(hull, 1000, power * 3 / 4), owner: 1 }];
      const shots: RecordedShot[] = [];
      const r = resolveVolley(from, to, 1, mulberry32(seed), 0, 2,
        { fromIds: ['a', 'b'], toIds: to.map((_, i) => String(i)), shots });
      let capacity = 0, consumed = 0, actualHull = 0;
      for (let i = 0; i < to.length; i++) {
        const before = to[i]!;
        if (before.retreated) {
          expect(r.hp[i]).toBe(before.hp);
          expect(r.shields[i]).toBe(before.shield);
          continue;
        }
        const multiplier = counterMult(HULLS[hull].cls, HULLS[before.hull].cls);
        capacity += (before.hp + before.shield) / multiplier;
        consumed += (before.hp - r.hp[i]! + before.shield - r.shields[i]!) / multiplier;
        actualHull += before.hp - r.hp[i]!;
        expect(r.hp[i]).toBeGreaterThanOrEqual(0);
        expect(r.shields[i]).toBeGreaterThanOrEqual(0);
      }
      const unused = shots.reduce((sum, shot) => sum + shot.unusedBaseDamage, 0)
        + (shots.some(shot => shot.sourceId === 'a') ? 0 : power / 4)
        + (shots.some(shot => shot.sourceId === 'b') ? 0 : power * 3 / 4);
      expect(consumed).toBeLessThanOrEqual(Math.min(capacity, power) + 1e-7);
      expect(consumed + unused).toBeCloseTo(power, 7);
      for (const shot of shots) expect(new Set(shot.hits.map(hit => hit.targetId)).size).toBe(shot.hits.length);
      expect(r.credited.reduce((sum, value) => sum + value, 0)).toBeCloseTo(actualHull, 7);
      expect(r.hullDamage).toBeCloseTo(actualHull, 7);
    }), { seed: 20261023, numRuns: 150 });
});
