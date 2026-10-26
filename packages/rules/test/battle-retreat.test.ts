import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  COMBAT, ESCAPE, HULLS, battleBalance, combatValue, createBattleRecording, fleetCount, fleetDiff, fleetEntries, fleetValue,
  hullTech, matchup, mulberry32, pirateOverrun, powerUnits, resolveBattle, resolveCombat, resolveJointCombat,
  resolveMonumentCombat, shipShieldHp, type Fleet, type JointAttackerStack,
} from '../src/index.js';

const side = { tech: {} };
const attack = (id: string, fleet: Fleet): JointAttackerStack => ({ contributionId: id, playerId: id, fleet, tech: side });
const defence = (id: string, fleet: Fleet) => ({ stackId: id, playerId: id, fleet, tech: side });
const mean = () => 0.5;
const count = (fleet: Fleet | undefined) => fleetCount(fleet ?? {});

describe('approved shared random-fire and damaged-ship retreat', () => {
  it('uses a 25% base shield, the existing research ladder and a 3x automatic escape threshold', () => {
    expect(ESCAPE.ratio).toBe(3);
    expect(shipShieldHp({}, 'CORSAIR')).toBe(HULLS.CORSAIR.hp * 0.25);
    expect(shipShieldHp({ SHIP_SHIELDS: 4 }, 'CORSAIR')).toBe(HULLS.CORSAIR.hp * 0.5);
    expect(shipShieldHp({ SHIP_ARMOR: 3 }, 'CORSAIR')).toBe(HULLS.CORSAIR.hp * hullTech({ SHIP_ARMOR: 3 }, 'CORSAIR').hp * 0.25);
    expect(shipShieldHp({}, 'BASTION')).toBe(0);
  });

  it('has simultaneous firing and never regenerates hull or shield between rounds', () => {
    const r = resolveCombat({ CORSAIR: 1 }, { CORSAIR: 1 }, 0, mean, { attacker: side, defender: side });
    expect(r.rounds.length).toBeGreaterThan(1);
    // Both fire from round entry with the same roll; the 377-point shields go once and never return.
    expect(r.rounds[0]!.attackerDamage).toBe(r.rounds[0]!.defenderDamage);
    for (const absorbed of [r.rounds.map(x => x.attackerShipShieldAbsorbed), r.rounds.map(x => x.defenderShipShieldAbsorbed)]) {
      expect(absorbed[0]).toBe(377);
      expect(absorbed.slice(1).every(value => value === 0)).toBe(true);
    }
  });

  it('continues shooting at cargo in the SAME volley after the last warship dies', () => {
    const recording = createBattleRecording();
    const r = resolveBattle([attack('a', { CATACLYSM: 3 })], [defence('d', { DART: 1, ARGOSY: 1 })], 0, mean, 'PLANET', false, recording);
    expect(r.rounds[0]!.defenderLosses.DART).toBe(1);
    const argosy = recording.ships.find(ship => ship.hull === 'ARGOSY')!.id;
    const spill = recording.rounds[0]!.attackerShots.find(shot => shot.hits.some(hit => hit.targetId === argosy))!;
    expect(spill.hits[0]!.hpAfter).toBe(0);
    expect(spill.hits.find(hit => hit.targetId === argosy)!.pass).toBeGreaterThan(0);
  });

  it('cargo-only sides keep their wounds, never shoot, and leave the defender in control', () => {
    const r = resolveMonumentCombat([attack('a', { ARGOSY: 2 })], [defence('d', { ARGOSY: 3 })], mean);
    expect(r.rounds).toEqual([]);
    expect(r.control).toBe('DEFENDER');
    expect(r.attackerSurvivors).toEqual({ ARGOSY: 2 });
    expect(r.defenderSurvivors).toEqual({ ARGOSY: 3 });
  });

  // Combat v3 slows the stronger side's fire, so a lone defender can still win a rare one (owner 2026-10-25).
  it.each([[2, 1], [3, 1], [5, 2]] as const)('%i Corsairs take a monument from %i Corsairs at equal research, all but rarely', (sent, held) => {
    let taken = 0;
    for (const level of [0, 4]) for (let seed = 0; seed < 128; seed++) {
      const tech = { tech: { SHIP_SHIELDS: level } };
      const result = resolveMonumentCombat([{ ...attack('a', { CORSAIR: sent }), tech }],
        [{ ...defence('d', { CORSAIR: held }), tech }], mulberry32(seed), true);
      expect((result.defenderSurvivors.CORSAIR ?? 0) + (result.defenderLosses.CORSAIR ?? 0)).toBe(held);
      if (result.control !== 'ATTACKER') continue;
      taken++;
      expect(fleetCount(result.attackerCombatSurvivors ?? {})).toBeGreaterThan(0);
      expect((result.defenderSurvivors.CORSAIR ?? 0) - (result.defenderRetreated?.CORSAIR ?? 0)).toBe(0);
    }
    expect(taken / 256).toBeGreaterThanOrEqual(0.98);
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
        // With its only ship gone the line is empty: the battle ends the round it left.
        expect(r.rounds.at(-1)!.retreats?.some(row => row.side === 'DEFENCE')).toBe(true);
      }
      expect(r.rounds[COMBAT.rounds - 1]?.retreats ?? []).toEqual([]);
    }
    expect(retreats).toBeGreaterThan(0);
  });

  it('lets a ship retreat only at or below its side’s hull window, whatever cargo either side brings', () => {
    let found = 0;
    for (let seed = 0; seed < 64; seed++) {
      const a = { CORSAIR: 2, ARGOSY: 3 }, d = { CORSAIR: 1 };
      const balance = battleBalance(matchup({ units: powerUnits(a, side) }, { units: powerUnits(d, side) }));
      expect(balance).toEqual(battleBalance(matchup({ units: powerUnits({ CORSAIR: 2 }, side) }, { units: powerUnits(d, side) })));
      const recording = createBattleRecording();
      resolveBattle([attack('a', a)], [defence('d', d)], 0, mulberry32(seed), 'MONUMENT', false, recording);
      for (const round of recording.rounds) for (const id of round.retreated) {
        const ship = recording.ships.find(s => s.id === id)!, state = round.after.find(s => s.id === id)!;
        const window = ship.side === 'ATTACK' ? balance.attacker : balance.defender;
        expect(window).not.toBeNull();
        expect(state.hp / ship.maxHp).toBeLessThanOrEqual(window!.threshold + 1e-9);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
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
    expect(checked).toBeGreaterThan(0);
  });

  it('cannot capture with an inactive survivor after the only eligible ship of the SAME hull dies', () => {
    let checked = 0;
    for (let seed = 0; seed < 128; seed++) {
      const attackers = [{ ...attack('a', { DART: 2 }), damage: [
        { hull: 'DART' as const, count: 1, damageBp: 6000 },
        { hull: 'DART' as const, count: 1, damageBp: 9500 },
      ] }];
      const defenders = [{ ...defence('d', { PIKE: 1, ARGOSY: 1 }),
        damage: [{ hull: 'PIKE' as const, count: 1, damageBp: 6000 }],
        tech: { tech: {}, shipShields: false }, maintenanceExempt: true }];
      const result = resolveMonumentCombat(attackers, defenders, mulberry32(seed), true);
      if (result.attackerSurvivors.DART !== 1 || count(result.attackerRetreated) > 0 || result.defenderSurvivors.PIKE || result.attackerDamage[0]?.damageBp !== 9500 || (result.attackerDamage[0].remainderBp ?? 0) !== 0) continue;
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
