import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatValue, HULLS } from '../packages/rules/src/hulls.ts';
import { budgetFleet, lossMetrics, sampleRaid, runAudit } from './combat-attrition-audit.mjs';

test('budget allocation respects cost, integer ships and declared mix', () => {
  const fleet = budgetFleet({ CORSAIR: 1, CATACLYSM: 1 }, 1_000_000);
  assert.ok(combatValue(fleet) <= 1_000_000);
  assert.ok(1_000_000 - combatValue(fleet) < combatValue({ CORSAIR: 1, CATACLYSM: 1 }));
  assert.ok(Number.isInteger(fleet.CORSAIR));
  assert.ok(fleet.CORSAIR > 0 && fleet.CATACLYSM > 0);
  assert.deepEqual(budgetFleet({ CORSAIR: 1 }, 0), {});
});

test('invalid budgets and compositions fail instead of corrupting the denominator', () => {
  for (const budget of [-1, NaN, Infinity]) {
    assert.throws(() => budgetFleet({ CORSAIR: 1 }, budget));
  }
  for (const weights of [{}, { CORSAIR: -1 }, { CORSAIR: 0 }, { CORSAIR: NaN }]) {
    assert.throws(() => budgetFleet(weights, 100));
  }
});

test('warship, mobile and all-unit losses have different denominators', () => {
  const start = { DART: 10, COURIER: 10, BASTION: 10 };
  const result = lossMetrics(start, { COURIER: 10, BASTION: 10 });
  assert.equal(result.armed.wiped, true);
  assert.equal(result.mobile.wiped, false);
  assert.equal(result.mobile.countLoss, 0.5);
  assert.equal(result.all.countLoss, 1 / 3);
  const dartPrice = HULLS.DART.alloy + HULLS.DART.crystal + HULLS.DART.deuterium;
  const cargoPrice = HULLS.COURIER.alloy + HULLS.COURIER.crystal + HULLS.COURIER.deuterium;
  assert.equal(result.mobile.valueLoss, dartPrice / (dartPrice + cargoPrice));
});

test('empty populations are not recorded as destroyed fleets; 90% is inclusive', () => {
  assert.equal(lossMetrics({}, {}).armed.wiped, false);
  assert.equal(lossMetrics({}, {}).armed.nearCount, false);
  assert.equal(lossMetrics({ DART: 10 }, { DART: 1 }).armed.nearCount, true);
  assert.equal(lossMetrics({ DART: 100 }, { DART: 11 }).armed.nearCount, false);
});

test('mutual destruction is measured from survivors rather than DECISIVE label', () => {
  const row = sampleRaid({ attacker: { PIKE: 100 }, defender: { PIKE: 100 }, seed: 42 });
  assert.equal(row.a.armed.wiped, true);
  assert.equal(row.d.armed.wiped, true);
  assert.equal(row.rounds, 1);
  assert.deepEqual(sampleRaid({ attacker: { PIKE: 100 }, defender: { PIKE: 100 }, seed: 42 }), row);
});

test('escaped defenders survive and inputs remain untouched', () => {
  const attacker = { CORSAIR: 350 }, defender = { CORSAIR: 100 };
  const row = sampleRaid({ attacker, defender, seed: 42 });
  assert.equal(row.escape, 'ESCAPED');
  assert.equal(row.d.armed.countLoss, 0);
  assert.equal(row.d.armed.wiped, false);
  assert.deepEqual(attacker, { CORSAIR: 350 });
  assert.deepEqual(defender, { CORSAIR: 100 });
});

test('exact mirror comparisons do not turn budget rounding into a strength imbalance', () => {
  const cells = runAudit(1).cells.filter(cell => cell.control === 'EXACT_MIRROR');
  assert.equal(cells.length, 96);
  for (const cell of cells) {
    assert.equal(cell.actualRatio, cell.ratio);
    if (cell.ratio === 1) assert.deepEqual(cell.attacker, cell.defender);
  }
});
