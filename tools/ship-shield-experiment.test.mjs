import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fleetEntries, resolveCombat, mulberry32, RESEARCH_PROJECTS } from '../packages/rules/src/index.ts';
import { MAX_FLEET_TECH } from '../packages/sim/src/fleet-calibration.ts';
import { shieldHit, shieldBattle, runShieldExperiment } from './ship-shield-experiment.mjs';

const clean = fleet => Object.fromEntries(fleetEntries(fleet));
test('max research calibration includes all four shield levels', () => {
  assert.equal(MAX_FLEET_TECH.SHIP_SHIELDS, RESEARCH_PROJECTS.SHIP_SHIELDS.maxLevel);
});
test('archived sweeps reject changed production sources instead of overwriting historical evidence', () => {
  assert.throws(() => runShieldExperiment(1, [{ basis: 'HP', coefficient: 2.1 }]), /Source changed since prior audit/);
});
test('sweeps reject invalid sample counts and empty or invalid configuration lists', () => {
  for (const samples of [0, -1, 1.5, NaN]) {
    assert.throws(() => runShieldExperiment(samples, [{ basis: 'HP', coefficient: 2 }]), RangeError);
  }
  for (const configs of [[], [{ basis: 'other', coefficient: 2 }], [{ basis: 'HP', coefficient: -1 }]]) {
    assert.throws(() => runShieldExperiment(1, configs), RangeError);
  }
});
test('personal shield cannot borrow protection from unhit ships', () => {
  assert.deepEqual(shieldHit(10, 100, 0, 150, 20), { count: 9, wound: 10 });
  assert.deepEqual(shieldHit(10, 100, 0, 120, 20), { count: 9, wound: 0 });
});
test('shields recharge but hull wounds persist', () => {
  const first = shieldHit(10, 100, 0, 60, 20);
  assert.deepEqual(first, { count: 10, wound: 40 });
  assert.deepEqual(shieldHit(first.count, 100, first.wound, 60, 20), { count: 10, wound: 80 });
  assert.deepEqual(shieldHit(10, 100, 80, 40, 20), { count: 9, wound: 0 });
});
test('small hits, zero damage, zero ships, overkill and zero shield', () => {
  assert.deepEqual(shieldHit(10, 100, 40, 0, 20), { count: 10, wound: 40 });
  assert.deepEqual(shieldHit(10, 100, 40, 20, 20), { count: 10, wound: 40 });
  assert.deepEqual(shieldHit(0, 100, 0, 1000, 20), { count: 0, wound: 0 });
  assert.deepEqual(shieldHit(2, 100, 0, 1000, 20), { count: 0, wound: 0 });
  assert.deepEqual(shieldHit(10, 100, 40, 190, 0), { count: 8, wound: 30 });
});
test('zero shield matches real healthy solo combat across the prior matrix', () => {
  const report = JSON.parse(readFileSync(new URL('../docs/evidence/combat-attrition-astera-2026-10-20.json', import.meta.url)));
  for (const cell of report.cells) for (const seed of [42, 97, 1337]) {
    const args = { attacker: cell.attacker, defender: cell.defender, shield: cell.shield,
      attackerTech: cell.attackerTech, defenderTech: cell.defenderTech, seed, coefficient: 0 };
    const actual = resolveCombat(args.attacker, args.defender, args.shield, mulberry32(seed),
      { attacker: { tech: args.attackerTech, shipShields: false }, defender: { tech: args.defenderTech, shipShields: false } });
    const experiment = shieldBattle(args);
    assert.deepEqual(experiment.attacker, clean(actual.attackerSurvivors));
    assert.deepEqual(experiment.defender, clean(actual.defenderSurvivors));
    assert.equal(experiment.rounds, actual.rounds.length);
  }
});
test('production shields match the independent healthy-battle prototype at every research rung', () => {
  const report = JSON.parse(readFileSync(new URL('../docs/evidence/combat-attrition-astera-2026-10-20.json', import.meta.url)));
  for (const [level, coefficient] of [1, 1.25, 1.5, 1.7, 2].entries()) {
    for (const cell of report.cells) for (const seed of [42, 97, 1337]) {
      const actual = resolveCombat(cell.attacker, cell.defender, cell.shield, mulberry32(seed), {
        attacker: { tech: { ...cell.attackerTech, SHIP_SHIELDS: level } },
        defender: { tech: { ...cell.defenderTech, SHIP_SHIELDS: level } },
      });
      const experiment = shieldBattle({ ...cell, seed, coefficient });
      assert.deepEqual(clean(actual.attackerSurvivors), experiment.attacker);
      assert.deepEqual(clean(actual.defenderSurvivors), experiment.defender);
      assert.equal(actual.rounds.length, experiment.rounds);
    }
  }
});
test('fixed inputs remain reproducible and unmodified', () => {
  const attacker = { CORSAIR: 100 }, defender = { CATACLYSM: 100 };
  const args = { attacker, defender, coefficient: 1, seed: 10 };
  assert.deepEqual(shieldBattle(args), shieldBattle(args));
  assert.deepEqual(attacker, { CORSAIR: 100 });
  assert.deepEqual(defender, { CATACLYSM: 100 });
});
test('ground units get no new shield and empty battles stop immediately', () => {
  const args = { attacker: { THORN: 50 }, defender: { BASTION: 10 }, seed: 42 };
  assert.deepEqual(shieldBattle({ ...args, coefficient: 8 }), shieldBattle({ ...args, coefficient: 0 }));
  assert.equal(shieldBattle({ attacker: {}, defender: {}, seed: 42 }).rounds, 0);
});
test('large shields preserve support cover and losses never create ships or invalid wounds', () => {
  for (let seed = 0; seed < 100; seed++) {
    const attacker = { CORSAIR: 100, ARGOSY: 10 }, defender = { PALADIN: 50, ARGOSY: 10 };
    const r = shieldBattle({ attacker, defender, seed, coefficient: 100 });
    assert.deepEqual(r.attacker, attacker);
    assert.deepEqual(r.defender, defender);
    assert.equal(r.attackerWounds.ARGOSY ?? 0, 0);
    assert.equal(r.defenderWounds.ARGOSY ?? 0, 0);
    for (const side of ['attacker', 'defender']) {
      for (const wound of Object.values(r[`${side}Wounds`])) assert.ok(Number.isFinite(wound) && wound >= 0);
    }
  }
});
