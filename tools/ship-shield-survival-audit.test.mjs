import test from 'node:test';
import assert from 'node:assert/strict';
import { fleetSurvival, summarizeSurvival, measureSurvivalCell } from './ship-shield-survival-audit.mjs';

test('warship survival excludes surviving cargo and distinguishes counts from value', () => {
  const metric = fleetSurvival({ CORSAIR: 2, ARGOSY: 2 }, { CORSAIR: 0, ARGOSY: 2 });
  assert.equal(metric.armed, 0);
  assert.equal(metric.mobile, 0.5);
  assert.equal(metric.armedValue, 0);
  assert.equal(fleetSurvival({ CORSAIR: 4 }, { CORSAIR: 1 }).armed, 0.25);
});

test('means include wipeouts while conditional means exclude them', () => {
  const result = summarizeSurvival([0, 0.25, 0.5, 1]);
  assert.equal(result.samples, 4);
  assert.equal(result.aliveProbability, 0.75);
  assert.equal(result.wipedProbability, 0.25);
  assert.equal(result.meanRemaining, 0.4375);
  assert.ok(Math.abs(result.meanWhenAlive - 7 / 12) < 1e-12);
  assert.equal(result.nearlyWipedProbability, 0.25);
});

test('no survivor is never reported as a conditional 100% survival', () => {
  assert.equal(summarizeSurvival([0, 0]).meanWhenAlive, null);
  assert.equal(summarizeSurvival([1, 1]).wipedProbability, 0);
  assert.equal(summarizeSurvival([0, 0]).aliveProbability, 0);
  assert.throws(() => summarizeSurvival([]), RangeError);
});

test('runs the current engine, keeping one-time shield and research effects', () => {
  const base = { attacker: { CORSAIR: 300 }, defender: { CORSAIR: 100 },
    attackerTech: { SHIP_POWER: 2, SHIP_ARMOR: 2 }, defenderTech: { SHIP_POWER: 2, SHIP_ARMOR: 2 } };
  const plain = measureSurvivalCell(base, 32);
  assert.equal(plain.worseArmed.aliveProbability, 0);
  assert.equal(plain.worseArmed.meanRemaining, 0);
  const shielded = measureSurvivalCell({ ...base,
    attackerTech: { ...base.attackerTech, SHIP_SHIELDS: 4 },
    defenderTech: { ...base.defenderTech, SHIP_SHIELDS: 4 } }, 32);
  assert.equal(shielded.worseArmed.aliveProbability, 1);
  assert.ok(shielded.worseArmed.meanRemaining > 0.15 && shielded.worseArmed.meanRemaining < 0.3);
});

test('captures exact per-side figures and can be reproduced without changing inputs', () => {
  const input = { attacker: { DART: 100 }, defender: { DART: 100 }, attackerTech: {}, defenderTech: {} };
  const copy = structuredClone(input);
  const result = measureSurvivalCell(input, 16);
  assert.deepEqual(measureSurvivalCell(input, 16), result);
  assert.deepEqual(input, copy);
  assert.equal(result.worseArmed.wipedProbability, 0);
  assert.equal(result.bothWipedProbability, 0);
  assert.equal(result.roundLimitProbability, 1);
  assert.ok(result.actualRatio === 1);
  for (const n of [0, -1, 1.5, NaN]) assert.throws(() => measureSurvivalCell(input, n), RangeError);
});
