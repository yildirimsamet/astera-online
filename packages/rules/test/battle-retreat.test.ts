import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ESCAPE, HULLS, battleRetreatPolicy, combatValue, fleetCount, fleetDiff, fleetEntries, fleetValue,
  hullTech, mulberry32, pirateOverrun, resolveBattle, resolveCombat, resolveJointCombat,
  resolveMonumentCombat, shipShieldHp, type Fleet, type JointAttackerStack,
} from '../src/index.js';

const side = { tech: {} };
const attack = (id: string, fleet: Fleet): JointAttackerStack => ({ contributionId: id, playerId: id, fleet, tech: side });
const defence = (id: string, fleet: Fleet) => ({ stackId: id, playerId: id, fleet, tech: side });
const mean = () => 0.5;
const count = (fleet: Fleet | undefined) => fleetCount(fleet ?? {});

describe('approved shared random-fire and damaged-ship retreat', () => {
  it('uses a 25% base shield, the existing research ladder and a 4x automatic escape threshold', () => {
    expect(ESCAPE.ratio).toBe(4);
    expect(shipShieldHp({}, 'CORSAIR')).toBe(HULLS.CORSAIR.hp * 0.25);
    expect(shipShieldHp({ SHIP_SHIELDS: 4 }, 'CORSAIR')).toBe(HULLS.CORSAIR.hp * 0.5);
    expect(shipShieldHp({ SHIP_ARMOR: 3 }, 'CORSAIR')).toBe(HULLS.CORSAIR.hp * hullTech({ SHIP_ARMOR: 3 }, 'CORSAIR').hp * 0.25);
    expect(shipShieldHp({}, 'BASTION')).toBe(0);
  });

  it.each([
    [100, 100, [.25, .25], [.25, .25]],
    [149, 100, [.25, .25], [.25, .25]],
    [150, 100, [.20, .30], [.33, .30]],
    [199, 100, [.20, .30], [.33, .30]],
    [200, 100, [.15, .30], [.55, .55]],
    [299, 100, [.15, .30], [.55, .55]],
    [300, 100, [.10, .25], [.70, .70]],
    [400, 100, [.10, .25], [.70, .70]],
    [100, 0, [.10, .25], [.70, .70]],
    [0, 0, [.25, .25], [.25, .25]],
  ] as const)('freezes the exact policy band for %i:%i in both orientations, excluding cargo', (a, d, attack, defence) => {
    const expectedA = { chance: attack[0], threshold: attack[1] };
    const expectedD = { chance: defence[0], threshold: defence[1] };
    const fleets = [{ DART: a, ARGOSY: 10000 }, { DART: d, GARBAGE_COLLECTOR: 10000 }];
    expect(battleRetreatPolicy(fleets[0]!, fleets[1]!)).toEqual({ attacker: expectedA, defender: expectedD });
    expect(battleRetreatPolicy(fleets[1]!, fleets[0]!)).toEqual({ attacker: expectedD, defender: expectedA });
  });

  it('has simultaneous firing and never regenerates hull or shield between rounds', () => {
    const r = resolveCombat({ CORSAIR: 1 }, { CORSAIR: 1 }, 0, mean, { attacker: side, defender: side });
    expect(r.rounds).toHaveLength(3);
    expect(r.rounds.map(x => x.attackerShipShieldAbsorbed)).toEqual([377, 0, 0]);
    expect(r.rounds.map(x => x.defenderShipShieldAbsorbed)).toEqual([377, 0, 0]);
    expect(r.attackerSurvivors).toEqual({ CORSAIR: 1 });
    expect(r.defenderSurvivors).toEqual({ CORSAIR: 1 });
    expect(r.attackerDamage).toEqual(r.defenderDamage);
    expect(r.attackerDamage[0]!.damageBp).toBeGreaterThan(5000);
    expect(count(r.attackerRetreated) + count(r.defenderRetreated)).toBe(0);
  });

  it('continues shooting at cargo in the SAME volley after the last warship dies', () => {
    const r = resolveBattle([attack('a', { CATACLYSM: 3 })], [defence('d', { DART: 1, ARGOSY: 1 })], 0, mean);
    expect(r.rounds[0]!.defenderLosses).toEqual({ DART: 1, ARGOSY: 1 });
    expect(r.rounds[0]!.defenderDamage).toBe(Math.round(HULLS.DART.atk * 0.625));
  });

  it('cargo-only sides keep their wounds, never shoot, and leave the defender in control', () => {
    const r = resolveMonumentCombat([attack('a', { ARGOSY: 2 })], [defence('d', { ARGOSY: 3 })], mean);
    expect(r.rounds).toEqual([]);
    expect(r.control).toBe('DEFENDER');
    expect(r.attackerSurvivors).toEqual({ ARGOSY: 2 });
    expect(r.defenderSurvivors).toEqual({ ARGOSY: 3 });
  });

  it.each([[2, 1], [3, 1], [5, 2]] as const)('%i Corsairs reliably take a monument from %i Corsairs at equal research', (sent, held) => {
    for (const level of [0, 4]) for (let seed = 0; seed < 128; seed++) {
      const tech = { tech: { SHIP_SHIELDS: level } };
      const result = resolveMonumentCombat([{ ...attack('a', { CORSAIR: sent }), tech }],
        [{ ...defence('d', { CORSAIR: held }), tech }], mulberry32(seed), true);
      expect(result.control).toBe('ATTACKER');
      expect(fleetCount(result.attackerCombatSurvivors ?? {})).toBeGreaterThan(0);
      expect((result.defenderSurvivors.CORSAIR ?? 0) - (result.defenderRetreated?.CORSAIR ?? 0)).toBe(0);
      expect((result.defenderSurvivors.CORSAIR ?? 0) + (result.defenderLosses.CORSAIR ?? 0)).toBe(held);
    }
  });

  it('retreating defenders yield the monument without becoming deaths or losing their wounds', () => {
    let retreats = 0;
    for (let seed = 0; seed < 128; seed++) {
      const r = resolveMonumentCombat([attack('a', { CORSAIR: 3 })], [defence('d', { CORSAIR: 1 })], mulberry32(seed));
      expect(r.control).toBe('ATTACKER');
      if (count(r.defenderRetreated) > 0) {
        retreats++;
        expect(r.defenderSurvivors).toEqual({ CORSAIR: 1 });
        expect(r.defenderLosses).toEqual({});
        expect(r.defenderLossValue).toBe(0);
        expect(r.defenders[0]!.survivorDamage[0]!.damageBp).toBeGreaterThan(0);
        expect(r.defenders[0]!.retreated).toEqual({ CORSAIR: 1 });
        expect(r.rounds).toHaveLength(1);
      }
      expect(r.rounds[2]?.retreats ?? []).toEqual([]);
    }
    expect(retreats).toBeGreaterThan(65);
    expect(retreats).toBeLessThan(110);
  });

  it('the new 55% HP window reaches the simulation and ignores cargo in the power ratio', () => {
    let found = 0;
    for (let seed = 0; seed < 64; seed++) {
      const r = resolveBattle([attack('a', { CORSAIR: 2 })], [{ ...defence('d', { CORSAIR: 1 }),
        damage: [{ hull: 'CORSAIR', count: 1, damageBp: 1800 }] }], 0, mulberry32(seed), 'MONUMENT');
      if (r.rounds.length === 1 && count(r.defenderRetreated)) {
        const damage = r.defenders[0]!.survivorDamage[0]!;
        expect(damage.damageBp).toBeGreaterThanOrEqual(4500);
        if (damage.damageBp < 5000) found++;
      }
    }
    expect(found).toBeGreaterThan(10);
  });

  it('one ship cannot capture after retreating, and a defender keeps its retreated survivors physically', () => {
    let checked = 0;
    for (let seed = 0; seed < 64; seed++) {
      const r = resolveMonumentCombat([attack('a', { CORSAIR: 1 })], [defence('d', { CORSAIR: 3 })], mulberry32(seed));
      expect(r.control).toBe('DEFENDER');
      if (count(r.attackerRetreated)) {
        checked++;
        expect(r.attackerSurvivors).toEqual({ CORSAIR: 1 });
        expect(r.attackerLosses).toEqual({});
        expect(r.grade).toBe('REPELLED');
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('cannot capture with an inactive survivor after the only eligible ship of the SAME hull dies', () => {
    let checked = 0;
    for (let seed = 0; seed < 32; seed++) {
      const attackers = [{ ...attack('a', { DART: 2 }), damage: [
        { hull: 'DART' as const, count: 1, damageBp: 6000 },
        { hull: 'DART' as const, count: 1, damageBp: 9500 },
      ] }];
      const defenders = [{ ...defence('d', { PIKE: 1, ARGOSY: 1 }),
        damage: [{ hull: 'PIKE' as const, count: 1, damageBp: 9900 }],
        tech: { tech: {}, shipShields: false }, maintenanceExempt: true }];
      const result = resolveMonumentCombat(attackers, defenders, mulberry32(seed), true);
      if (result.attackerSurvivors.DART !== 1 || count(result.attackerRetreated) > 0 || result.defenderSurvivors.PIKE || result.attackerDamage[0]?.damageBp !== 9500) continue;
      checked++;
      expect(result.attackerDamage[0].damageBp).toBe(9500);
      expect(result.control).toBe('DEFENDER');
      expect(pirateOverrun(result, { DART: 1 }).defenderSurvivors.ARGOSY).toBe(1);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('splitting identical owner stats into waves does not change aggregate shots, retreats or losses', () => {
    const one = [attack('one', { CORSAIR: 40 })];
    const many = Array.from({ length: 40 }, (_, i) => attack(`wave-${String(i).padStart(2, '0')}`, { CORSAIR: 1 }));
    const d = [defence('d', { CORSAIR: 100 })];
    for (let seed = 0; seed < 8; seed++) {
      const a = resolveBattle(one, d, 0, mulberry32(seed));
      const b = resolveBattle(many, d, 0, mulberry32(seed));
      for (const key of ['attackerSurvivors', 'defenderSurvivors', 'attackerLosses', 'defenderLosses', 'attackerRetreated', 'defenderRetreated', 'grade'] as const) {
        expect(b[key]).toEqual(a[key]);
      }
    }
  });

  it('all entrypoints agree on the same solo battle', () => {
    for (let seed = 0; seed < 12; seed++) {
      const a = { CORSAIR: 30 }, d = { CORSAIR: 10 };
      const solo = resolveCombat(a, d, 0, mulberry32(seed), { attacker: side, defender: side });
      const joint = resolveJointCombat([attack('a', a)], d, 0, mulberry32(seed), side);
      const battle = resolveBattle([attack('a', a)], [defence('d', d)], 0, mulberry32(seed));
      const monument = resolveMonumentCombat([attack('a', a)], [defence('d', d)], mulberry32(seed));
      for (const r of [joint, battle, monument]) {
        expect(r.attackerSurvivors).toEqual(solo.attackerSurvivors);
        expect(r.defenderSurvivors).toEqual(solo.defenderSurvivors);
        expect(r.attackerRetreated).toEqual(solo.attackerRetreated);
        expect(r.defenderRetreated).toEqual(solo.defenderRetreated);
      }
    }
  });

  it('records each owner’s real deaths per round without merging allied casualties', () => {
    const result = resolveBattle([attack('a', { DART: 15 }), attack('b', { DART: 15 })],
      [defence('host', { CORSAIR: 2 }), defence('ally', { PIKE: 5 })], 0, mulberry32(18), 'HP_PLANET', true);
    for (const [side, rows] of [['ATTACK', result.contributions], ['DEFENCE', result.defenders]] as const) {
      for (const row of rows) {
        const losses: Fleet = {};
        for (const round of result.rounds) for (const own of round.casualties ?? []) {
          if (own.side !== side || own.playerId !== row.playerId) continue;
          for (const [hull, count] of fleetEntries(own.fleet)) losses[hull] = (losses[hull] ?? 0) + count;
        }
        expect(losses).toEqual(row.losses);
      }
    }
    expect(fleetCount(result.attackerLosses) + fleetCount(result.defenderLosses)).toBeGreaterThan(0);
  });

  it('conserves every owner fleet and counts only physical destruction as loss', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 1, max: 40 }), (seed, n) => {
      const a = [attack('a', { CORSAIR: n }), attack('b', { DART: n, ARGOSY: 2 })];
      const d = [defence('host', { CORSAIR: n, BASTION: 3 }), defence('ally', { PIKE: n })];
      const r = resolveBattle(a, d, 1000, mulberry32(seed), 'HP_PLANET', true);
      for (const row of [...r.contributions, ...r.defenders]) {
        expect(row.losses).toEqual(fleetDiff(row.sent, row.survivors));
        for (const [hull, fled] of fleetEntries(row.retreated ?? {})) expect(fled).toBeLessThanOrEqual(row.survivors[hull] ?? 0);
        expect(row.survivorDamage.every(lot => lot.damageBp < 10000)).toBe(true);
      }
      expect(r.attackerLossValue).toBe(fleetValue(r.attackerLosses));
      expect(r.defenderLossValue).toBe(fleetValue(r.defenderLosses) - fleetValue(r.defenceSalvage));
      expect(r.contributions.reduce((s, x) => s + x.hullDamage, 0)).toBeLessThanOrEqual(
        d.reduce((s, x) => s + fleetEntries(x.fleet).reduce((v, [id, n]) => v + HULLS[id].hp * n, 0), 0) + 1e-7);
      expect(combatValue(r.attackerLosses)).toBeGreaterThanOrEqual(0);
    }), { seed: 20261022, numRuns: 60 });
  });
});
