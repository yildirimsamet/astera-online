import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HULLS, MOBILE_HULLS, hullBuildable, monumentTierEligible, MONUMENT_BALANCE,
  hpLethalAtMs, settleMonumentHold, shipHpRepairCost, splitForHpLanding,
  MONUMENT_SEASON_DEFAULTS, monumentMotion, motionPositionAt, distance, resourceValue,
} from '../packages/rules/src/index.ts';
import {
  MODELS, radiationRate, lifetimeMinutes, makeLots, studyHold, landingBill, farmTrip,
  minimumBuildTech, proposedResearch, buildStudy, RADIATION_LEVEL_HP_PER_MINUTE, radiationLevelRate,
} from './monument-radiation-study.mjs';

const center = { x: 0, y: 0, z: 0 };
const source = rate => ({ id: 'study', mode: 'EMIT', center, radius: 1,
  activeFromMs: 0, activeUntilMs: null, intensityHpPerMinute: rate });
const close = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon,
  `${actual} differs from ${expected}`);

test('uses live hull profiles; T4 hulls are legal at an EASY-eligible core', () => {
  assert.equal(HULLS.CITADEL.hp, 2158);
  assert.ok(hullBuildable('CITADEL', 6, { STARSHIP_ENGINEERING: 2, SHIP_ARMOR: 2 }));
  assert.ok(monumentTierEligible('EASY', 9));
  assert.equal(monumentTierEligible('EASY', 10), false);
  close(lifetimeMinutes('CITADEL', 'EASY', 'CURRENT', 0, { SHIP_ARMOR: 5 }), 1348.75);
});

test('current thresholds agree with the production lethal predictor, including fractional wounds', () => {
  for (const hull of MOBILE_HULLS) {
    const tech = { SHIP_ARMOR: 3 };
    const damageBp = 4300, remainderBp = .37;
    const endMs = 48 * 3600_000;
    const actual = hpLethalAtMs([{ from: center, to: center, startMs: 0, endMs }], [source(5)],
      { hull, tech, damageBp, remainderBp });
    close(lifetimeMinutes(hull, 'HARD', 'CURRENT', 0, tech, damageBp, remainderBp), actual / 60000);
  }
});

test('flat calibration hits the approximate Corsair anchors and keeps armor distinct from protection', () => {
  close(radiationRate('CORSAIR', 'HARD', 'FLAT_CALIBRATED'), 12.5);
  close(radiationRate('CORSAIR', 'HARD', 'FLAT_CALIBRATED', 4), 5.25);
  assert.ok(Math.abs(lifetimeMinutes('CORSAIR', 'HARD', 'FLAT_CALIBRATED') - 120) < 1);
  assert.ok(Math.abs(lifetimeMinutes('CORSAIR', 'HARD', 'FLAT_CALIBRATED', 4, { SHIP_ARMOR: 5 }) - 360) < 1);
  close(lifetimeMinutes('CORSAIR', 'HARD', 'FLAT_CALIBRATED', 4), 1508 / 5.25, 1 / 60000);
});

test('repair invoices preserve sub-bp wounds above the free HP repair threshold', () => {
  const fleet = { CORSAIR: 10, ARGOSY: 1 };
  const lots = makeLots(fleet, { damageBp: 2000, remainderBp: .125 });
  const expected = splitForHpLanding(fleet, lots);
  const actual = landingBill(lots, {}, 6);
  assert.equal(actual.dockedCount, 11);
  assert.equal(actual.autoRepairedCount, 0);
  assert.deepEqual(actual.cost, shipHpRepairCost(expected.docked, 100));
});

test('calibrated analysis uses the production shielding snapshot without applying it twice', () => {
  const tech = { SHIP_ARMOR: 5, RADIATION_SHIELDING: 4 };
  close(lifetimeMinutes('CORSAIR', 'HARD', 'FLAT_CALIBRATED', 4, tech), 1885 / 5.25, 1 / 60000);
  const lots = makeLots({ CORSAIR: 1, ARGOSY: 1 }, { tech });
  const actual = studyHold(lots, { difficulty: 'HARD', model: 'FLAT_CALIBRATED', protectionLevel: 4, minutes: 60 });
  const expected = settleMonumentHold(lots, { fromMs: 0, toMs: 60 * 60000, position: center,
    sources: [source(12.5)], productionPerMinute: 8 });
  assert.deepEqual(actual.lots, expected.lots);
});

test('radiation level fixes the source strength; protection is a separate research level', () => {
  assert.deepEqual(RADIATION_LEVEL_HP_PER_MINUTE, { 1: 9, 2: 12.5 });
  assert.equal(MODELS.FLAT_CALIBRATED.EASY.radiationLevel, 1);
  assert.equal(MODELS.FLAT_CALIBRATED.HARD.radiationLevel, 2);
  for (let protection = 0; protection <= 4; protection++) {
    close(radiationLevelRate(2, protection), [12.5, 10.5, 8.5, 6.5, 5.25][protection]);
    for (const [difficulty, level] of [['EASY', 1], ['HARD', 2]]) {
      close(radiationLevelRate(level, protection), radiationRate('CORSAIR', difficulty, 'FLAT_CALIBRATED', protection));
    }
  }
  assert.throws(() => radiationLevelRate(3), RangeError, 'unused level 3 must not acquire an invented strength');
  for (const invalid of [0, -1, 1.5, '2', '__proto__', Infinity]) {
    assert.throws(() => radiationLevelRate(invalid), RangeError);
  }
  assert.throws(() => radiationLevelRate(2, 5), RangeError);
  assert.throws(() => radiationLevelRate(2, 0, -1), RangeError);
  close(radiationLevelRate(2, 4, 5), 7.35);
});

test('the same source and protection remove the same absolute HP from every hull', () => {
  for (const difficulty of ['EASY', 'HARD']) for (let level = 0; level <= 4; level++) {
    const rate = radiationRate('DART', difficulty, 'FLAT_CALIBRATED', level);
    for (const hull of MOBILE_HULLS) {
      close(radiationRate(hull, difficulty, 'FLAT_CALIBRATED', level), rate);
      const result = studyHold(makeLots({ [hull]: 1 }, { tech: { SHIP_ARMOR: 5 } }), {
        difficulty, model: 'FLAT_CALIBRATED', protectionLevel: level, minutes: 1,
      });
      const row = result.lots[0];
      close((row.damageBp + row.remainderBp) / 10000 * HULLS[hull].hp * 1.25, rate);
      close(lifetimeMinutes(hull, difficulty, 'FLAT_CALIBRATED', level), HULLS[hull].hp / rate, 1 / 60000);
    }
  }
  assert.equal(MODELS.HYBRID, undefined);
  assert.equal(MODELS.PERCENT_ONLY, undefined);
});

test('each research rung improves survival without erasing the high-HP advantage', () => {
  for (const hull of MOBILE_HULLS) {
    for (const difficulty of ['EASY', 'HARD']) {
      let previous = 0;
      for (let level = 0; level <= 4; level++) {
        const time = lifetimeMinutes(hull, difficulty, 'FLAT_CALIBRATED', level, { SHIP_ARMOR: 5 });
        assert.ok(time > previous, `${hull}/${difficulty}/${level}: ${time}`);
        previous = time;
      }
    }
  }
  assert.ok(lifetimeMinutes('CITADEL', 'HARD', 'FLAT_CALIBRATED', 4, { SHIP_ARMOR: 5 }) > 480,
    'the Corsair anchor is not an artificial lifetime cap on all hulls');
});

test('extra bomb HP damage adds before resistance and matters for heavy hulls', () => {
  for (const hull of MOBILE_HULLS) close(radiationRate(hull, 'EASY', 'FLAT_CALIBRATED', 4, 5)
    - radiationRate(hull, 'EASY', 'FLAT_CALIBRATED', 4), 2.1);
  assert.throws(() => radiationRate('DART', 'EASY', 'FLAT_CALIBRATED', 5), RangeError);
  assert.throws(() => radiationRate('DART', 'EASY', 'FLAT_CALIBRATED', -1), RangeError);
  assert.throws(() => radiationRate('DART', 'EASY', 'FLAT_CALIBRATED', 1, -5), RangeError);
});

test('study baseline reproduces production HOLD settlement at casualties and cargo fill boundaries', () => {
  const lots = [
    ...makeLots({ RAMPART: 1, COURIER: 2 }, { playerId: 'one' }),
    ...makeLots({ DART: 2, WAYFARER: 1 }, { playerId: 'two', tech: { SHIP_ARMOR: 2 }, damageBp: 1200, remainderBp: .125 }),
  ];
  for (const minutes of [0, 12, 38.5, 45, 60, 150]) {
    const expected = settleMonumentHold(lots, { fromMs: 0, toMs: minutes * 60000, position: center,
      sources: [source(2)], productionPerMinute: 3 });
    const actual = studyHold(lots, { difficulty: 'EASY', model: 'CURRENT', minutes });
    for (const key of ['lots', 'destroyed', 'shares']) {
      assert.equal(actual[key].length, expected[key].length);
      for (let i = 0; i < actual[key].length; i++) {
        for (const field of Object.keys(expected[key][i])) {
          if (typeof expected[key][i][field] === 'number') close(actual[key][i][field], expected[key][i][field]);
          else assert.deepEqual(actual[key][i][field], expected[key][i][field]);
        }
      }
    }
    close(actual.lostDeuterium, expected.lostDeuterium);
    close(actual.discardedDeuterium, expected.discardedDeuterium);
    close(actual.producedDeuterium, expected.producedDeuterium);
  }
  assert.equal(lots[0].damageBp, 0, 'settlement must not mutate inputs');
});

test('cargo-only owners cannot farm on allied guns; warships have no farm hold', () => {
  const alone = studyHold(makeLots({ COURIER: 10 }), { difficulty: 'EASY', minutes: 10 });
  close(alone.deliverableDeuterium, 0);
  const allied = studyHold([
    ...makeLots({ RAMPART: 1 }, { playerId: 'one' }),
    ...makeLots({ COURIER: 1 }, { playerId: 'two' }),
  ], { difficulty: 'EASY', minutes: 10 });
  close(allied.deliverableDeuterium, 0);
});

test('more ships do not multiply production or reduce each ship radiation; cargo is capped', () => {
  const one = studyHold(makeLots({ RAMPART: 1, COURIER: 1 }), { difficulty: 'EASY', model: 'FLAT_CALIBRATED', minutes: 2 });
  const many = studyHold(makeLots({ RAMPART: 100, COURIER: 100 }), { difficulty: 'EASY', model: 'FLAT_CALIBRATED', minutes: 2 });
  close(one.deliverableDeuterium, 6);
  close(many.deliverableDeuterium, 6);
  close(one.lots[0].damageBp + one.lots[0].remainderBp, many.lots[0].damageBp + many.lots[0].remainderBp);
  const cap = studyHold(makeLots({ CITADEL: 1, COURIER: 1 }), {
    difficulty: 'HARD', model: 'CURRENT_PLUS_RESEARCH', protectionLevel: 4, minutes: 2, outputPerMinute: 1000,
  });
  close(cap.deliverableDeuterium, HULLS.COURIER.cargo);
  close(cap.discardedDeuterium, 1000);
});

test('transport death loses its own accumulated cargo at the exact event', () => {
  const lots = makeLots({ RAMPART: 1, COURIER: 1 });
  const before = studyHold(lots, { difficulty: 'EASY', minutes: 45 - 1 / 60000 });
  assert.ok(before.deliverableDeuterium > 134.99);
  const at = studyHold(lots, { difficulty: 'EASY', minutes: 45 });
  close(at.deliverableDeuterium, 0);
  close(at.lostDeuterium, 135);
  assert.equal(at.lots.length, 1);
});

test('rebased flat rates end eight-hour farming when the cargo dies, even if a heavy guard survives', () => {
  const fleet = { CITADEL: 1, ARGOSY: 1 };
  const tech = { SHIP_ARMOR: 5 };
  close(studyHold(makeLots(fleet, { tech }), { difficulty: 'EASY', minutes: 480 }).deliverableDeuterium, 1440);
  close(studyHold(makeLots(fleet, { tech }), { difficulty: 'HARD', minutes: 480 }).deliverableDeuterium, 0);
  close(studyHold(makeLots(fleet, { tech }), { difficulty: 'HARD', model: 'CURRENT_PLUS_RESEARCH',
    protectionLevel: 4, minutes: 480 }).deliverableDeuterium, 3840);
  for (const difficulty of ['EASY', 'HARD']) {
    for (const hull of MOBILE_HULLS.filter(hull => HULLS[hull].family === 'CARGO')) {
      assert.ok(lifetimeMinutes(hull, difficulty, 'FLAT_CALIBRATED', 4, tech) < 480);
    }
    const result = studyHold(makeLots(fleet, { tech }), { difficulty, model: 'FLAT_CALIBRATED', protectionLevel: 4, minutes: 480 });
    assert.equal(result.lots.length, 1);
    assert.equal(result.lots[0].hull, 'CITADEL');
    close(result.deliverableDeuterium, 0);
    assert.ok(result.lostFuelReserve > 0);
  }
});

test('landing bill honors the real 20% free repair threshold and Industrial', () => {
  const fleet = { COURIER: 1, RAMPART: 1 };
  for (const damageBp of [2000, 2001, 6500]) {
    const lots = makeLots(fleet, { damageBp });
    const expected = splitForHpLanding(fleet, lots);
    const bill = landingBill(lots, { INDUSTRIAL: 2 }, 6);
    assert.deepEqual(bill.cost, shipHpRepairCost(expected.docked, 50));
    assert.equal(bill.dockedCount, damageBp <= 2000 ? 0 : 2);
  }
});

test('fuel escrow is not counted as consumed fuel; surviving refunds balance the actual invoice', () => {
  const result = farmTrip({ RAMPART: 1, COURIER: 1 }, {
    difficulty: 'EASY', model: 'FLAT_CALIBRATED', protectionLevel: 4, minutes: 20,
    tech: { SHIP_ARMOR: 5, INDUSTRIAL: 2 }, origin: 'NEAR',
  });
  assert.ok(result.refund > 0);
  close(result.prepaidFuel, result.outboundFuel + result.returnFuel + result.refund + result.lostFuelReserve);
  close(result.deliverableDeuterium, 60);
  close(result.netLiquidDeuterium, 60 - result.outboundFuel - result.returnFuel - result.repair.cost.deuterium);
});

test('validates time, fleet, model, and difficulty even for an empty fleet', () => {
  assert.throws(() => studyHold([], { difficulty: 'EASY', minutes: -1 }), RangeError);
  assert.throws(() => makeLots({ DART: -1 }), RangeError);
  assert.throws(() => studyHold([], { difficulty: 'EASY', model: 'unknown', minutes: 1 }), RangeError);
  assert.throws(() => studyHold([], { difficulty: 'OTHER', minutes: 0 }), RangeError);
  assert.throws(() => studyHold([], { difficulty: '__proto__', minutes: 0, outputPerMinute: 3 }), RangeError);
  assert.throws(() => radiationRate('DART', 'constructor', 'FLAT_CALIBRATED'), RangeError);
  assert.throws(() => radiationRate('DART', 'EASY', 'FLAT_CALIBRATED', .5), RangeError);
  assert.throws(() => radiationRate('DART', 'EASY', 'FLAT_CALIBRATED', 0, Infinity), RangeError);
  assert.equal(MODELS.CURRENT.EASY.flat, 2, 'historical pre-calibration baseline');
  assert.equal(radiationRate('DART', 'EASY', 'FLAT_CALIBRATED'), MONUMENT_BALANCE.EASY.intensityHpPerMinute);
});

test('farm examples include all hull production prerequisites without attributing armor to radiation research', () => {
  const fleet = { CITADEL: 1, ARGOSY: 1 };
  const tech = minimumBuildTech(fleet);
  assert.equal(tech.SHIP_ARMOR, 2);
  assert.equal(tech.SHIP_PROPULSION, 2);
  for (const hull of Object.keys(fleet)) assert.ok(hullBuildable(hull, 6, tech));
  assert.equal(minimumBuildTech({ RAMPART: 1, COURIER: 1 }).SHIP_ARMOR, undefined);
});

test('trip geometry accepts independent home positions and departure phases for average-cost samples', () => {
  const homePosition = { x: 0, y: 0, z: 4500 }, departAt = 12345678;
  const trip = farmTrip({ RAMPART: 1, COURIER: 1 }, {
    difficulty: 'EASY', model: 'FLAT_CALIBRATED', minutes: 5, homePosition, departAt,
  });
  const motion = monumentMotion(MONUMENT_SEASON_DEFAULTS.positions[4], 0);
  close(trip.returnDistance, distance(homePosition, motionPositionAt(motion,
    departAt + trip.outboundMinutes * 60000 + 5 * 60000)));
});

test('wounded ships retain their damage budget, and research does not heal the carried cohort', () => {
  const full = lifetimeMinutes('COURIER', 'EASY', 'FLAT_CALIBRATED', 4);
  const wounded = lifetimeMinutes('COURIER', 'EASY', 'FLAT_CALIBRATED', 4, {}, 5000);
  close(wounded, full / 2, 1 / 60000);
  const result = studyHold(makeLots({ RAMPART: 1, COURIER: 1 }, { damageBp: 5000 }), {
    difficulty: 'EASY', model: 'FLAT_CALIBRATED', protectionLevel: 4, minutes: 5,
  });
  assert.ok(result.lots.every(row => row.damageBp > 5000));
});

test('proposed research is accessible without first farming deuterium, with increasing cost and effect', () => {
  const ladder = proposedResearch();
  assert.equal(ladder.length, 4);
  for (let i = 0; i < ladder.length; i++) {
    const row = ladder[i];
    assert.equal(row.cost.deuterium, 0);
    assert.ok(row.minutesCore9 < row.minutesCore4);
    if (i > 0) {
      assert.ok(row.cost.alloy > ladder[i - 1].cost.alloy);
      assert.ok(row.reduction > ladder[i - 1].reduction);
    }
  }
});

test('all eight monument orbits can be sampled, with the matching difficulty enforced', () => {
  const homePosition = { x: 4500, y: 0, z: 0 }, departAt = 3600_000;
  const result = farmTrip({ RAMPART: 1, COURIER: 1 }, {
    difficulty: 'EASY', ordinal: 6, model: 'FLAT_CALIBRATED', minutes: 5, homePosition, departAt,
  });
  const motion = monumentMotion(MONUMENT_SEASON_DEFAULTS.positions[5], 0);
  close(result.returnDistance, distance(homePosition, motionPositionAt(motion,
    departAt + result.outboundMinutes * 60000 + 5 * 60000)));
  assert.throws(() => farmTrip({ RAMPART: 1, COURIER: 1 }, {
    difficulty: 'EASY', ordinal: 3, minutes: 10,
  }), RangeError);
});

test('total radiation loss burns escrow; lost hull value is an asset loss distinct from wallet deuterium', () => {
  const fleet = { STRONGHOLD: 1, WAYFARER: 1 };
  const result = farmTrip(fleet, { difficulty: 'HARD', model: 'FLAT_CALIBRATED', minutes: 80 });
  assert.equal(result.lots.length, 0);
  close(result.netLiquidDeuterium, -result.prepaidFuel);
  const assetValue = Object.entries(fleet).reduce((sum, [hull, count]) => sum + resourceValue(HULLS[hull]) * count, 0);
  close(result.netValueDeuteriumEquivalent, -result.prepaidFuel - assetValue / 32);
});

test('the reproducible report separates the accepted anchors from proposed production and other technology', () => {
  const report = buildStudy();
  assert.equal(report.status, 'IMPLEMENTED_PENDING_DEPLOY');
  assert.equal(report.model, 'FLAT_CALIBRATED');
  assert.deepEqual(report.radiationLevelHpPerMinute, RADIATION_LEVEL_HP_PER_MINUTE);
  assert.equal(report.hulls.length, MOBILE_HULLS.length);
  close(report.anchors.baseCorsairMinutes, lifetimeMinutes('CORSAIR', 'HARD', 'FLAT_CALIBRATED'));
  close(report.anchors.maxCorsairMinutes, lifetimeMinutes('CORSAIR', 'HARD', 'FLAT_CALIBRATED', 4, { SHIP_ARMOR: 5 }));
  assert.equal(report.anchors.maxArmor, 5);
  const corsair = report.hulls.find(row => row.hull === 'CORSAIR');
  close(corsair.difficulty.HARD.hpPerMinuteByLevel[0], 12.5);
  close(corsair.difficulty.HARD.hpPerMinuteByLevel[4], 5.25);
  assert.ok(report.averageTrips.every(row => row.samples === 576 && row.holdMinutes > 0));
  const base = report.averageTrips.find(row => row.difficulty === 'HARD' && row.fleet.CORSAIR === 1 && row.protectionLevel === 0);
  assert.equal(base.tech.SHIP_ARMOR, undefined);
  close(base.gross, 8 * base.holdMinutes);
  assert.ok(base.meanNetValue < 0, 'physical survival must not be presented as profitable farming');
  const option = base.productionOptions.find(row => row.outputPerMinute === 14);
  assert.ok(option.meanNetValue > 0, 'show a concrete viable production option, without changing game rules');
  close(option.meanNetValue - base.meanNetValue, 6 * base.holdMinutes);
  for (const row of report.proposedResearch) {
    close(row.hpPerMinute.HARD, radiationRate('DART', 'HARD', 'FLAT_CALIBRATED', row.level));
  }
  assert.equal(report.productionBudgets.find(row => row.EASY === 3 && row.HARD === 8).dailyMaximum, 63360);
  assert.equal(report.productionBudgets.find(row => row.EASY === 9 && row.HARD === 14)?.dailyMaximum, 132480);
  for (const row of report.averageTrips) {
    const output = row.difficulty === 'EASY' ? 9 : 14;
    const option = row.productionOptions.find(option => option.outputPerMinute === output);
    assert.ok(option.minNetValue > 0, 'candidate production covers the sampled fresh small fleets, even without protection');
    const settings = { difficulty: row.difficulty, model: report.model,
      protectionLevel: row.protectionLevel, tech: row.tech, minutes: row.holdMinutes };
    const baseline = farmTrip(row.fleet, settings);
    const trip = farmTrip(row.fleet, { ...settings, outputPerMinute: output });
    close(trip.deliverableDeuterium, option.gross);
    close(trip.netValueDeuteriumEquivalent - baseline.netValueDeuteriumEquivalent, option.gross - row.gross);
  }
  assert.ok(report.captures.every(row => row.checkpoints.every(point => point.minutes >= 0)));
});
