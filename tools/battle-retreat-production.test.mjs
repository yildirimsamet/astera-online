import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_HULLS, mulberry32, resolveMonumentCombat, fleetCount, resolveBattle, monumentBattleControl, activeBattleFleet } from '../packages/rules/src/index.ts';
import { simulateRandomBattle } from './monument-random-target-model.mjs';

// Controlled RNG seam: exactly the same three streams as the independently approved study.
function stream(seed) {
  const fire = mulberry32(seed);
  let i = 0;
  return () => i++ < 2 ? seed / 0x100000000 : fire();
}
function hp(fleet, lots) {
  let damaged = 0;
  for (const lot of lots) damaged += lot.count * (lot.damageBp + (lot.remainderBp ?? 0));
  return fleetCount(fleet) * 10000 - damaged;
}
function compare(input, seed, joint = false, splitDefence = joint, planet = false) {
  const rows = (fleet, damage, attacking) => Object.entries(fleet).flatMap(([hull, n]) => {
    const parts = (attacking ? joint : splitDefence) ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n];
    const wounds = (damage ?? []).filter(lot => lot.hull === hull).map(lot => ({ ...lot }));
    return parts.filter(n => n > 0).map((n, i) => {
      let room = n;
      const ownDamage = [];
      for (const lot of wounds) {
        const count = Math.min(room, lot.count);
        if (count > 0) ownDamage.push({ ...lot, count });
        lot.count -= count;
        room -= count;
      }
      return { ...(attacking ? { contributionId: `a${hull}${i}` } : { stackId: `d${hull}${i}` }),
        playerId: `${attacking ? 'a' : 'd'}${i}`, fleet: { [hull]: n },
        tech: { tech: (attacking ? input.attackerTech : input.defenderTech) ?? {} }, damage: ownDamage };
    });
  });
  const a = rows(input.attacker, input.attackerDamage, true), d = rows(input.defender, input.defenderDamage, false);
  const result = planet ? resolveBattle(a, d, 0, stream(seed), 'HP_PLANET', true) : resolveMonumentCombat(a, d, stream(seed), true);
  const actual = { ...result, control: monumentBattleControl(activeBattleFleet(result.attackerSurvivors, result.attackerRetreated), activeBattleFleet(result.defenderSurvivors, result.defenderRetreated)) };
  const expected = simulateRandomBattle(input, { rounds: 3, targeting: 'random_live', escapePolicy: 'adaptive-v2', shieldFraction: .25, shieldResearch: true, canonicalOrder: true }, seed);
  assert.equal(actual.control, expected.control);
  if (!planet) assert.equal(result.control, expected.control);
  assert.equal(actual.rounds.length, expected.rounds);
  for (const [side, physical, fled, loss, lots] of [
    [expected.a, actual.attackerSurvivors, actual.attackerRetreated, actual.attackerLosses, actual.attackerDamage],
    [expected.d, actual.defenderSurvivors, actual.defenderRetreated, actual.defenderLosses, actual.defenderDamage],
  ]) {
    assert.equal(fleetCount(physical), side.physical, JSON.stringify({ input, seed, joint, physical, fled, expected: side.physical }));
    assert.equal(fleetCount(fled ?? {}), side.fled, JSON.stringify({ input, seed, joint, physical, fled, expected: side.fled }));
    assert.equal(fleetCount(loss), side.dead);
    const expectedHp = (side.physical - side.damage.length - side.activeDamage.length) * 10000
      + [...side.damage, ...side.activeDamage].reduce((sum, row) => sum + row.hpLeft / row.maxHp * 10000, 0);
    assert.ok(Math.abs(hp(physical, lots) - expectedHp) < 1e-6, `preserved HP ${hp(physical, lots)} vs ${expectedHp}`);
  }
}

test('production and independent approved simulator agree across hulls, sizes, ratios and joint owners', () => {
  let battles = 0;
  for (const hull of MOBILE_HULLS) for (const size of [2, 10, 30]) for (const ratio of [1, 1.5, 2, 2.5, 3]) for (let seed = 0; seed < 16; seed++) {
    const input = { attacker: { [hull]: size * ratio }, defender: { [hull]: size } };
    for (const planet of [false, true]) for (const splitA of [false, true]) for (const splitD of [false, true]) {
      compare(input, seed, splitA, splitD, planet);
      battles++;
    }
  }
  assert.equal(battles, MOBILE_HULLS.length * 3 * 5 * 16 * 8);
});

test('production and approved simulator agree on carried wounds without healing, including radiation-critical survivors', () => {
  for (const damageBp of [1000, 3000, 5000, 7000, 9000, 9500]) for (const ratio of [1, 1.5, 2, 2.5, 3]) for (let seed = 0; seed < 32; seed++) {
    compare({ attacker: { CORSAIR: 20 * ratio }, defender: { CORSAIR: 20 },
      defenderDamage: [{ hull: 'CORSAIR', count: 20, damageBp }] }, seed);
  }
});

test('mixed fleets, counters, cargo, research and distributed wounds match the independent model', () => {
  for (const level of [0, 1, 2, 3, 4]) for (let seed = 0; seed < 64; seed++) {
    const input = { attacker: { DART: 12, PIKE: 8, CORSAIR: 3, ARGOSY: 2 },
      defender: { RAMPART: 10, SENTINEL: 4, CORSAIR: 2, COURIER: 3 },
      attackerTech: { SHIP_POWER: level, SHIP_ARMOR: 4 - level, SHIP_SHIELDS: level },
      defenderTech: { SHIP_POWER: 4 - level, SHIP_ARMOR: level, SHIP_SHIELDS: 4 - level },
      attackerDamage: [{ hull: 'DART', count: 4, damageBp: 2500, remainderBp: .25 },
        { hull: 'PIKE', count: 2, damageBp: 6000, remainderBp: .5 }],
      defenderDamage: [{ hull: 'RAMPART', count: 5, damageBp: 5500 },
        { hull: 'CORSAIR', count: 1, damageBp: 7000, remainderBp: .75 }] };
    for (const splitA of [false, true]) for (const splitD of [false, true]) compare(input, seed, splitA, splitD);
  }
});
