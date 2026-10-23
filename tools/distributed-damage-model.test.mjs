import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HULLS, fleetCount } from '../packages/rules/src/hulls.ts';
import { mulberry32, seededFrom } from '../packages/rules/src/rng.ts';
import { resolveRandomBattle } from '../packages/rules/src/randomBattle.ts';
import { battleRetreatPolicy } from '../packages/rules/src/battleRetreat.ts';
import { distributedVolley, prepareStudyEngine } from './distributed-damage-model.mjs';

const ship = (hull, hp = 1000, attack = 0, shield = 0) => ({ hull, hp, maxHp: hp, attack, shield, owner: 0, canFire: true, retreated: false });
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const shot = (from, to, rng = () => 0, aegis = 0) => distributedVolley(from, to, 1, rng, aegis, 1);
const aStack = (fleet, tech = {}, extra = {}) => [{ contributionId: 'a', playerId: 'a', fleet, tech: { tech }, ...extra }];
const dStack = (fleet, tech = {}, extra = {}) => [{ stackId: 'host', playerId: 'd', fleet, tech: { tech }, ...extra }];

test('408 damage is shared across ALL ten eligible targets and conserved', () => {
  const from = [ship('CORSAIR', 1000, 408)], to = Array.from({ length: 10 }, () => ship('DART'));
  const original = structuredClone({ from, to });
  const r = shot(from, to, mulberry32(19));
  assert.equal(r.hp.filter(hp => hp < 1000).length, 10);
  close(r.hp.reduce((sum, hp) => sum + 1000 - hp, 0), 408);
  assert.ok(new Set(r.hp).size > 1);
  close(r.baseSpent + r.baseUnused, r.baseFired);
  assert.deepEqual({ from, to }, original);
});

test('single target receives entire attack; personal shield precedes hull', () => {
  const r = shot([ship('CORSAIR', 1000, 40)], [ship('DART', 100, 0, 10)]);
  close(r.shields[0], 0); close(r.hp[0], 70); close(r.personal, 10);
});

test('Aegis precedes personal shield and hull without duplicate absorption', () => {
  const r = shot([ship('CORSAIR', 1000, 30)], [ship('DART', 100, 0, 5)], () => 0, 15);
  close(r.aegis, 0); close(r.personal, 5); close(r.hp[0], 90); close(r.normalAbsorbed, 15);
});

test('cargo AND collector receive nothing while armed target survives', () => {
  const r = shot([ship('CORSAIR', 1000, 40)], [ship('DART'), ship('COURIER'), ship('GARBAGE_COLLECTOR')]);
  close(r.hp[0], 960); close(r.hp[1], 1000); close(r.hp[2], 1000);
});

test('same-shot surplus reaches cargo and collector immediately after final warship dies', () => {
  const r = shot([ship('CORSAIR', 1000, 20)], [ship('DART', 5, 0, 3), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)]);
  // Existing counterMult is 1.6 into SUPPORT; 12 base surplus yields 19.2 effective.
  close(r.hp[0], 0); close(r.hp[1], 90.4); close(r.hp[2], 90.4);
  close(r.baseSpent, 20); close(r.baseUnused, 0);
});

test('surplus is redistributed to living combat units before protected support', () => {
  const r = shot([ship('CORSAIR', 1000, 100)], [ship('DART', 10), ship('DART', 1000), ship('COURIER', 100)]);
  close(r.hp[0], 0); close(r.hp[1], 910); close(r.hp[2], 100);
});

test('mixed target counters are applied once and overflow returns to BASE damage units', () => {
  const r = shot([ship('CATACLYSM', 1000, 100)], [ship('DART', 30), ship('CITADEL', 1000)]);
  close(r.hp[0], 0); close(r.hp[1], 1000 - 50.78125);
  close(r.baseSpent, 100); close(r.baseUnused, 0);
});

test('dead and retreated targets are never hit; retreated/dead/unarmed shooters cannot fire', () => {
  const from = [ship('CORSAIR', 1000, 20), { ...ship('CORSAIR', 1000, 999), retreated: true }, ship('CORSAIR', 0, 999), ship('COURIER', 1000, 0)];
  const r = shot(from, [ship('DART', 0), { ...ship('DART'), retreated: true }, ship('DART')]);
  assert.deepEqual(r.hp, [0, 1000, 980]); close(r.baseFired, 20);
});

test('subsequent shooters cannot waste damage on targets killed earlier in their volley', () => {
  const r = shot([ship('CORSAIR', 1000, 20), ship('CORSAIR', 1000, 20)], [ship('DART', 10), ship('COURIER', 100)]);
  close(r.hp[0], 0); close(r.hp[1], 52); close(r.baseSpent, 40);
});

test('no remaining targets stops safely and records genuinely unused damage', () => {
  const r = shot([ship('CORSAIR', 1000, 100)], [ship('DART', 10)]);
  close(r.hp[0], 0); close(r.baseSpent, 10); close(r.baseUnused, 90);
});

test('ground gun shields support and cannot be skipped', () => {
  const r = shot([ship('CORSAIR', 1000, 40)], [ship('THORN'), ship('GARBAGE_COLLECTOR')]);
  close(r.hp[0], 960); close(r.hp[1], 1000);
});

test('zero attack and empty target populations terminate without damage', () => {
  close(shot([ship('CORSAIR', 1000, 0)], [ship('DART')]).hp[0], 1000);
  assert.deepEqual(shot([ship('CORSAIR', 1000, 40)], []).hp, []);
});

test('personal shields are consumed once and wounds persist into the next volley', () => {
  const from = [ship('CORSAIR', 1000, 30)], to = [ship('DART', 100, 0, 40)];
  const r1 = shot(from, to);
  close(r1.hp[0], 100); close(r1.shields[0], 10);
  const r2 = shot(from, [{ ...to[0], hp: r1.hp[0], shield: r1.shields[0] }]);
  close(r2.hp[0], 80); close(r2.shields[0], 0);
});

test('Nullifier shield-only bonus cannot spill into hull or duplicate base damage', () => {
  const r = shot([ship('NULLIFIER', 1000, 100)], [ship('DART', 1000)], () => 0, 500);
  close(r.specialistAbsorbed, 500); close(r.hp[0], 840);
  close(r.credited[0], 160); close(r.baseSpent, 100); close(r.baseUnused, 0);
});

test('random adversarial volleys conserve base damage across counters/shields/cargo', () => {
  const rng = mulberry32(2387), hulls = ['DART', 'PIKE', 'CITADEL', 'COURIER', 'GARBAGE_COLLECTOR'];
  for (let trial = 0; trial < 100; trial++) {
    const from = Array.from({ length: 1 + trial % 8 }, (_, i) => ship(i % 2 ? 'CATACLYSM' : 'CORSAIR', 1000, rng() * 2000));
    const to = Array.from({ length: 1 + trial % 17 }, (_, i) => ship(hulls[i % hulls.length], 1 + rng() * 500, 0, rng() * 100));
    const r = shot(from, to, rng, rng() * 500);
    close(r.baseSpent + r.baseUnused, r.baseFired);
    assert.ok(r.hp.every((hp, i) => hp >= 0 && hp <= to[i].hp));
    assert.ok(r.shields.every((shield, i) => shield >= 0 && shield <= to[i].shield));
  }
});

test('untouched copied resolver is bit-for-bit equal to production, including actual battle', async () => {
  const { baseline } = await prepareStudyEngine();
  for (let seed = 0; seed < 16; seed++) {
    const a = aStack({ CORSAIR: 8, CATACLYSM: 4, COURIER: 2 }), d = dStack({ PIKE: 11, THORN: 4, GARBAGE_COLLECTOR: 1 });
    assert.deepEqual(baseline(a, d, 150, mulberry32(seed), true, true), resolveRandomBattle(a, d, 150, mulberry32(seed), true, true));
  }
  const { report: r, missions, defenderTech } = JSON.parse(readFileSync(new URL('./fixtures/distributed-damage-live-battle-20261023.json', import.meta.url), 'utf8'));
  const mission = missions.find(m => m.kind === 'attack');
  const a = [{ ...aStack(r.attacker_fleet, mission.tech)[0], contributionId: mission.id, playerId: r.attacker_player_id }];
  const d = [{ ...dStack(r.defender_fleet, defenderTech)[0], playerId: r.defender_player_id }];
  const result = baseline(a, d, 150, seededFrom(mission.id), true, true);
  assert.deepEqual(result.rounds, r.rounds); assert.deepEqual(result.attackerDamage, r.attacker_damage);
});

test('simultaneous firing survives same-round annihilation; dead ships cannot retreat', async () => {
  const { candidate } = await prepareStudyEngine();
  const a = aStack({ DART: 1 }, {}, { tech: { tech: {}, damageMult: 100 } });
  const d = dStack({ DART: 1 }, {}, { tech: { tech: {}, damageMult: 100 } });
  const r = candidate(a, d, 0, mulberry32(1), true, true);
  assert.equal(fleetCount(r.attackerSurvivors), 0); assert.equal(fleetCount(r.defenderSurvivors), 0);
  assert.equal(r.rounds.length, 1); assert.deepEqual(r.rounds[0].retreats, []);
});

test('engine is deterministic and maintains survivors/deaths/retreat accounting for every round', async () => {
  const { candidate, trace } = await prepareStudyEngine();
  for (let seed = 0; seed < 32; seed++) {
    const a = aStack({ CORSAIR: 20, GARBAGE_COLLECTOR: 2 }), d = dStack({ CORSAIR: 10, COURIER: 3 });
    const result = candidate(a, d, 0, mulberry32(seed), true, true);
    assert.deepEqual(result, candidate(a, d, 0, mulberry32(seed), true, true));
    assert.equal(fleetCount(result.attackerSurvivors) + fleetCount(result.attackerLosses), 22);
    assert.equal(fleetCount(result.defenderSurvivors) + fleetCount(result.defenderLosses), 13);
    for (const round of result.rounds) {
      if (round.round === 3) assert.deepEqual(round.retreats, []);
      for (const row of round.retreats) for (const hull of Object.keys(row.fleet)) assert.equal(HULLS[hull].ground, false);
    }
    for (const row of trace) for (const side of ['attacker', 'defender']) {
      assert.equal(row[side].eligible, row[side].eligibleHp.length);
      assert.ok(row[side].eligibleHp.every(p => p > 0 && p <= row[side].threshold + 1e-12));
    }
    const policy = battleRetreatPolicy(a[0].fleet, d[0].fleet);
    for (const prefix of ['attacker', 'defender']) for (const lot of result[`${prefix}RetreatDamage`]) {
      const hpRatio = 1 - (lot.damageBp + (lot.remainderBp ?? 0)) / 10000;
      assert.ok(hpRatio > 0 && hpRatio <= policy[prefix].threshold + 1e-10);
    }
  }
});

test('joint attackers and stationed defenders keep the same aggregate physical outcome', async () => {
  const { candidate } = await prepareStudyEngine();
  for (let seed = 0; seed < 16; seed++) {
    const a = aStack({ CORSAIR: 12, CATACLYSM: 8 }), d = dStack({ CORSAIR: 8, CATACLYSM: 6 });
    const aJoint = [
      ...aStack({ CORSAIR: 6, CATACLYSM: 4 }),
      ...aStack({ CORSAIR: 6, CATACLYSM: 4 }, {}, { contributionId: 'b', playerId: 'b' }),
    ];
    const dSupport = [
      ...dStack({ CORSAIR: 4, CATACLYSM: 3 }),
      ...dStack({ CORSAIR: 4, CATACLYSM: 3 }, {}, { stackId: 'support', playerId: 's' }),
    ];
    const solo = candidate(a, d, 0, mulberry32(seed), true, true);
    const joint = candidate(aJoint, dSupport, 0, mulberry32(seed), true, true);
    for (const key of ['attackerSurvivors', 'defenderSurvivors', 'attackerLosses', 'defenderLosses', 'attackerRetreated', 'defenderRetreated', 'attackerDamage', 'defenderDamage']) assert.deepEqual(joint[key], solo[key]);
    assert.equal(joint.grade, solo.grade);
  }
});

test('matched Power 5 and Armor 5 scale mobile damage and HP equally without changing physical outcomes', async () => {
  const { candidate } = await prepareStudyEngine();
  for (const shields of [0, 4]) for (let seed = 0; seed < 16; seed++) {
    const a = { CORSAIR: 12, CATACLYSM: 8 }, d = { CORSAIR: 8, CATACLYSM: 6 };
    const baseTech = { SHIP_SHIELDS: shields }, grownTech = { ...baseTech, SHIP_POWER: 5, SHIP_ARMOR: 5 };
    const base = candidate(aStack(a, baseTech), dStack(d, baseTech), 0, mulberry32(seed), true, true);
    const grown = candidate(aStack(a, grownTech), dStack(d, grownTech), 0, mulberry32(seed), true, true);
    for (const key of ['attackerSurvivors', 'defenderSurvivors', 'attackerLosses', 'defenderLosses', 'attackerRetreated', 'defenderRetreated']) assert.deepEqual(grown[key], base[key]);
    assert.equal(grown.grade, base.grade);
  }
});
