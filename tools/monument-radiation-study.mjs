/** Focused, deterministic balance study. No DB, server changes, or season simulation.
 * nice -n 10 node --import tsx --test tools/monument-radiation-study.test.mjs
 * nice -n 10 node --import tsx tools/monument-radiation-study.mjs
 */
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  HULLS, MOBILE_HULLS, MONUMENT_BALANCE, MONUMENT_SEASON_DEFAULTS, monumentDifficulty,
  hullTech, hullBulk, hpLethalAtMs, applyHpDose, segmentsExposureHp, normalizeMonumentLots,
  produceMonumentDeuterium, splitForHpLanding, shipHpRepairCost, shipHpRepairMinutes, repairPct,
  monumentFuelReserves, priceMonumentReturn, missionFuel, resourceValue,
  monumentMotion, motionPositionAt, interceptMotion, fleetPace, distance, travelExact,
  resolveMonumentCombat, mulberry32, selectMonumentHold,
  RESEARCH_PROJECTS, RESEARCH_TECH, RADIATION_LEVEL_HP_PER_MINUTE, radiationDamageMult, researchMinutes,
} from '../packages/rules/src/index.ts';

export { RADIATION_LEVEL_HP_PER_MINUTE };
// CURRENT names the historical pre-calibration baseline, not today's production constants.
export const MODELS = {
  CURRENT: {
    EASY: { flat: 2 }, HARD: { flat: 5 },
  },
  CURRENT_PLUS_RESEARCH: {
    EASY: { flat: 2 }, HARD: { flat: 5 },
  },
  FLAT_CALIBRATED: {
    EASY: { radiationLevel: MONUMENT_BALANCE.EASY.radiationLevel },
    HARD: { radiationLevel: MONUMENT_BALANCE.HARD.radiationLevel },
  },
};
// Reduces source intensity, never a fraction of ship HP. One ladder for all hulls/sources.
export const PROTECTION = [0, ...RESEARCH_TECH.radiationDamageLadder.map(mult => Number((1 - mult).toFixed(2)))];
const CENTER = { x: 0, y: 0, z: 0 };
const source = rate => ({ id: 'study', mode: 'EMIT', center: CENTER, radius: 1,
  activeFromMs: 0, activeUntilMs: null, intensityHpPerMinute: rate });
const segment = (startMs, endMs) => [{ from: CENTER, to: CENTER, startMs, endMs }];

function protectedRadiationRate(flat, protectionLevel, extraHp, enabled = true) {
  if (!Number.isFinite(flat) || flat <= 0
    || !Number.isInteger(protectionLevel) || protectionLevel < 0 || protectionLevel >= PROTECTION.length
    || !Number.isFinite(extraHp) || extraHp < 0) throw new RangeError('Bad study radiation configuration');
  return (flat + extraHp) * (enabled ? radiationDamageMult({ RADIATION_SHIELDING: protectionLevel }) : 1);
}

export function radiationLevelRate(radiationLevel, protectionLevel = 0, extraHp = 0) {
  if (!Number.isInteger(radiationLevel) || !Object.hasOwn(RADIATION_LEVEL_HP_PER_MINUTE, radiationLevel)) {
    throw new RangeError('Unknown study radiation level');
  }
  return protectedRadiationRate(RADIATION_LEVEL_HP_PER_MINUTE[radiationLevel], protectionLevel, extraHp);
}

export function radiationRate(hull, difficulty, model = 'CURRENT', protectionLevel = 0, extraHp = 0) {
  const config = MODELS[model]?.[difficulty];
  if (!MOBILE_HULLS.includes(hull) || !config) throw new RangeError('Bad study radiation configuration');
  if (config.radiationLevel !== undefined) return radiationLevelRate(config.radiationLevel, protectionLevel, extraHp);
  return protectedRadiationRate(config.flat, protectionLevel, extraHp, model !== 'CURRENT');
}

export function lifetimeMinutes(hull, difficulty, model = 'CURRENT', protectionLevel = 0,
  tech = {}, damageBp = 0, remainderBp = 0, extraHp = 0) {
  const rate = radiationRate(hull, difficulty, model, protectionLevel, extraHp);
  const snapshot = { ...tech, RADIATION_SHIELDING: model === 'CURRENT' ? 0 : protectionLevel };
  const rawRate = radiationRate(hull, difficulty, model, 0, extraHp);
  const endMs = Math.ceil((HULLS[hull].hp * hullTech(tech, hull).hp / rate + 1) * 60000);
  return hpLethalAtMs(segment(0, endMs), [source(rawRate)], { hull, tech: snapshot, damageBp, remainderBp }) / 60000;
}

export function makeLots(fleet, { tech = {}, playerId = 'one', damageBp = 0, remainderBp = 0,
  reserveDistance = 10500 } = {}) {
  for (const [hull, count] of Object.entries(fleet)) {
    if (!MOBILE_HULLS.includes(hull) || !Number.isSafeInteger(count) || count < 0) throw new RangeError('Bad study fleet');
  }
  const reserves = monumentFuelReserves(fleet, reserveDistance);
  return normalizeMonumentLots(Object.entries(fleet).filter(([, count]) => count > 0).map(([hull, count]) => ({
    id: `${playerId}:${hull}`, waveId: `${playerId}:wave`, playerId, hull, count,
    damageBp, remainderBp, deuterium: 0, returnFuelReserve: reserves.perShip[hull] * count, tech,
  })));
}

export function minimumBuildTech(fleet) {
  const tech = {};
  for (const hull of Object.keys(fleet)) {
    if (!MOBILE_HULLS.includes(hull)) throw new RangeError('Bad study hull');
    for (const requirement of HULLS[hull].requiredResearch) {
      tech[requirement.project] = Math.max(tech[requirement.project] ?? 0, requirement.level);
    }
  }
  return tech;
}

/** Reuses actual production allocation, integer-ms casualty boundaries, and carried HP fractions.
 * The flat dose is identical for every hull with the same protection.
 * No fresh arrivals/battles/recalls in this one HOLD window, and no radiation shelter.
 */
export function studyHold(lots, { difficulty, model = 'CURRENT', protectionLevel = 0,
  minutes, outputPerMinute = MONUMENT_BALANCE[difficulty]?.productionPerMinute, extraHp = 0 }) {
  radiationRate('DART', difficulty, model, protectionLevel, extraHp);
  const toMs = Math.round(minutes * 60000);
  if (!Number.isFinite(minutes) || minutes < 0 || !Number.isSafeInteger(toMs)
    || !Number.isFinite(outputPerMinute) || outputPerMinute < 0) throw new RangeError('Bad study HOLD window');
  let rows = normalizeMonumentLots(lots.map(row => ({ ...row,
    tech: model === 'CURRENT' && row.tech.RADIATION_SHIELDING === undefined ? row.tech
      : { ...row.tech, RADIATION_SHIELDING: model === 'CURRENT' ? 0 : protectionLevel },
  })));
  const paid = new Map([...new Set(rows.map(row => row.playerId))].sort().map(id => [id, 0]));
  const destroyed = [];
  let cursor = 0, lostDeuterium = 0, discardedDeuterium = 0, lostFuelReserve = 0;
  let firstLossMinutes = null;
  while (cursor < toMs) {
    let until = toMs;
    for (const row of rows) {
      const rate = radiationRate(row.hull, difficulty, model, 0, extraHp);
      const death = hpLethalAtMs(segment(cursor, toMs), [source(rate)], row);
      if (death !== null) until = Math.min(until, death);
    }
    const production = produceMonumentDeuterium(rows, outputPerMinute * (until - cursor) / 60000);
    for (const share of production.shares) paid.set(share.playerId, (paid.get(share.playerId) ?? 0) + share.deuterium);
    discardedDeuterium += production.discardedDeuterium;
    const kept = [];
    for (const row of production.lots) {
      const rate = radiationRate(row.hull, difficulty, model, 0, extraHp);
      const outcome = applyHpDose({ [row.hull]: row.count }, [row],
        segmentsExposureHp(segment(cursor, until), [source(rate)]), row.tech);
      if (!outcome.fleet[row.hull]) {
        destroyed.push(row);
        lostDeuterium += row.deuterium;
        lostFuelReserve += row.returnFuelReserve ?? 0;
        firstLossMinutes ??= until / 60000;
      } else {
        const damage = outcome.lots[0];
        kept.push({ ...row, damageBp: damage?.damageBp ?? 0, remainderBp: damage?.remainderBp ?? 0 });
      }
    }
    rows = kept;
    cursor = until;
  }
  return { lots: rows, destroyed, lostDeuterium, lostFuelReserve, discardedDeuterium, firstLossMinutes,
    producedDeuterium: outputPerMinute * toMs / 60000,
    deliverableDeuterium: rows.reduce((sum, row) => sum + row.deuterium, 0),
    shares: [...paid].map(([playerId, deuterium]) => ({ playerId, deuterium })),
  };
}

export function landingBill(lots, tech = {}, yard = 6) {
  const fleet = {};
  for (const row of lots) fleet[row.hull] = (fleet[row.hull] ?? 0) + row.count;
  const landing = splitForHpLanding(fleet, lots);
  const pct = repairPct(tech);
  return { cost: shipHpRepairCost(landing.docked, pct), minutes: shipHpRepairMinutes(landing.docked, yard, tech, pct),
    dockedCount: landing.docked.reduce((sum, row) => sum + row.count, 0),
    autoRepairedCount: landing.autoRepaired.reduce((sum, row) => sum + row.count, 0) };
}

/** A fresh, sole-owner farming trip AFTER capture, at full pace, with real 8h/16h motion. */
export function farmTrip(fleet, { difficulty, model = 'CURRENT', protectionLevel = 0, minutes,
  tech = {}, origin = 'NEAR', departAt = 0, homePosition,
  ordinal = difficulty === 'EASY' ? 5 : 1, outputPerMinute, extraHp = 0 }) {
  if (monumentDifficulty(ordinal) !== difficulty) throw new RangeError('Study monument difficulty mismatch');
  const monumentOrigin = MONUMENT_SEASON_DEFAULTS.positions[ordinal - 1];
  const motion = monumentMotion(monumentOrigin, 0);
  const side = origin === 'NEAR' ? 1 : -1;
  const home = homePosition ?? Object.fromEntries(Object.entries(monumentOrigin).map(([axis, value]) => [axis, value * .75 * side]));
  const speed = fleetPace(fleet, { boost: 1, tech });
  const meeting = interceptMotion(home, speed, motion, departAt, departAt + 48 * 3600_000);
  if (!meeting) throw new RangeError('Study fleet cannot reach monument');
  const lots = makeLots(fleet, { tech });
  const capacity = selectMonumentHold(lots, MONUMENT_BALANCE[difficulty].capacity);
  if (capacity.choices.some(choice => choice.returnCount > 0)) throw new RangeError('Study fleet exceeds HOLD capacity');
  const held = studyHold(lots, { difficulty, model, protectionLevel, minutes, outputPerMinute, extraHp });
  const recallAt = meeting.arriveAt + Math.round(minutes * 60000);
  const returnDistance = distance(home, motionPositionAt(motion, recallAt));
  const pricing = priceMonumentReturn(held.lots, returnDistance);
  const outboundFuel = missionFuel(fleet, distance(home, meeting.at), 1);
  const repair = landingBill(held.lots, tech);
  const lostResources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const row of held.destroyed) for (const key of Object.keys(lostResources)) lostResources[key] += HULLS[row.hull][key] * row.count;
  const prepaidFuel = outboundFuel + lots.reduce((sum, row) => sum + (row.returnFuelReserve ?? 0), 0);
  const netLiquidDeuterium = held.deliverableDeuterium - outboundFuel - pricing.fuel
    - held.lostFuelReserve - repair.cost.deuterium;
  const netValueDeuteriumEquivalent = held.deliverableDeuterium - outboundFuel - pricing.fuel
    - held.lostFuelReserve - resourceValue(repair.cost) / 32 - resourceValue(lostResources) / 32;
  const survivorFleet = {};
  for (const row of held.lots) survivorFleet[row.hull] = (survivorFleet[row.hull] ?? 0) + row.count;
  return { ...held, repair, lostResources, prepaidFuel, outboundFuel, returnFuel: pricing.fuel, refund: pricing.refund,
    netLiquidDeuterium, netValueDeuteriumEquivalent, outboundMinutes: meeting.flightMinutes,
    returnMinutes: held.lots.length ? travelExact(returnDistance, fleetPace(survivorFleet, { boost: 1, tech })) : 0,
    returnDistance, usedCapacity: capacity.usedCapacity,
  };
}

export function proposedResearch() {
  return [1, 2, 3, 4].map(level => {
    const cost = RESEARCH_PROJECTS.RADIATION_SHIELDING.costAt(level);
    return { level, reduction: PROTECTION[level], cost,
      hpPerMinute: Object.fromEntries(['EASY', 'HARD'].map(difficulty => [difficulty,
        radiationRate('DART', difficulty, 'FLAT_CALIBRATED', level)])),
      minutesCore4: researchMinutes(cost, 4), minutesCore6: researchMinutes(cost, 6), minutesCore9: researchMinutes(cost, 9) };
  });
}

export function buildStudy() {
  const model = 'FLAT_CALIBRATED';
  const productionBudgets = [
    { EASY: MONUMENT_BALANCE.EASY.productionPerMinute, HARD: MONUMENT_BALANCE.HARD.productionPerMinute },
    { EASY: 6, HARD: 12 }, { EASY: 8, HARD: 14 }, { EASY: 9, HARD: 14 },
  ].map(output => ({ ...output, dailyMaximum: 4 * (output.EASY + output.HARD) * 1440 }));
  const hulls = MOBILE_HULLS.map(hull => ({ hull, tier: HULLS[hull].tier, hp: HULLS[hull].hp,
    armoredHp: HULLS[hull].hp * hullTech({ SHIP_ARMOR: 5 }, hull).hp,
    farmCargo: HULLS[hull].family === 'CARGO' ? HULLS[hull].cargo : 0, bulk: hullBulk(hull),
    difficulty: Object.fromEntries(['EASY', 'HARD'].map(difficulty => [difficulty, {
      currentMinutes: lifetimeMinutes(hull, difficulty), currentArmor5Minutes: lifetimeMinutes(hull, difficulty, 'CURRENT', 0, { SHIP_ARMOR: 5 }),
      hpPerMinuteByLevel: PROTECTION.map((_, level) => radiationRate(hull, difficulty, model, level)),
      minutesByLevel: PROTECTION.map((_, level) => lifetimeMinutes(hull, difficulty, model, level)),
      armor5MinutesByLevel: PROTECTION.map((_, level) => lifetimeMinutes(hull, difficulty, model, level, { SHIP_ARMOR: 5 })),
    }])) }));
  const templates = [
    { DART: 1, COURIER: 1 }, { PIKE: 1, COURIER: 1 }, { RAMPART: 1, COURIER: 1 },
    { VIPER: 1, COURIER: 1 }, { STRONGHOLD: 1, WAYFARER: 1 },
    { TEMPEST: 1, COURIER: 1 }, { LEVIATHAN: 1, ATLAS: 1 },
    { CORSAIR: 1, COURIER: 1 }, { CORSAIR: 1, ARGOSY: 1 }, { CITADEL: 1, ARGOSY: 1 },
    { RAMPART: 10, COURIER: 1 }, { LEVIATHAN: 10, ATLAS: 1 }, { CITADEL: 10, ARGOSY: 1 },
  ];
  const trips = [];
  for (const difficulty of ['EASY', 'HARD']) for (const fleet of templates) {
    const buildTech = minimumBuildTech(fleet);
    for (const [protectionLevel, tech] of [[0, buildTech], [4, { ...buildTech, SHIP_ARMOR: 5, INDUSTRIAL: 2 }]]) {
      const firstDeath = Math.min(...Object.keys(fleet).map(hull => lifetimeMinutes(hull, difficulty, model, protectionLevel, tech)));
      for (const fraction of [.18, .5, .75, .9]) for (const origin of ['NEAR', 'FAR']) {
        const minutes = Math.round(firstDeath * fraction * 60000) / 60000;
        const result = farmTrip(fleet, { difficulty, model, protectionLevel, tech, minutes, origin });
        trips.push({ difficulty, fleet, protectionLevel, tech, origin, fractionOfFirstDeath: fraction, firstDeath,
          ...result, lots: undefined, destroyed: undefined, shares: undefined });
      }
    }
  }
  const captures = [];
  const captureTemplates = {
    EASY: [{ RAMPART: 12, COURIER: 1 }, { WARDEN: 10, COURIER: 1 }, { VIPER: 5, COURIER: 1 }, { LEVIATHAN: 2, ATLAS: 1 }],
    HARD: [{ LEVIATHAN: 16, ATLAS: 1 }, { TEMPEST: 24, ATLAS: 1 }, { CITADEL: 5, ARGOSY: 1 }, { CORSAIR: 8, ARGOSY: 1 }],
  };
  for (const difficulty of ['EASY', 'HARD']) for (const fleet of captureTemplates[difficulty]) {
    const buildTech = minimumBuildTech(fleet);
    for (const [protectionLevel, tech] of [[0, buildTech], [4, { ...buildTech, SHIP_ARMOR: 5, SHIP_POWER: 5, INDUSTRIAL: 2 }]]) {
      for (let seed = 1; seed <= 8; seed++) {
        const battle = resolveMonumentCombat([{ contributionId: 'a', playerId: 'one', fleet, tech: { tech } }],
          [{ stackId: 'd', playerId: 'npc', fleet: MONUMENT_BALANCE[difficulty].garrison, tech: { tech: {} } }], mulberry32(seed));
        const contribution = battle.contributions[0];
        const survivorLots = makeLots(contribution.survivors, { tech }).flatMap(row => {
          const damaged = contribution.survivorDamage.filter(lot => lot.hull === row.hull);
          const healthy = row.count - damaged.reduce((sum, lot) => sum + lot.count, 0);
          return [...damaged.map((lot, i) => ({ ...row, ...lot, id: `${row.id}:${i}`, returnFuelReserve: (row.returnFuelReserve / row.count) * lot.count })),
            ...(healthy > 0 ? [{ ...row, count: healthy, returnFuelReserve: (row.returnFuelReserve / row.count) * healthy }] : [])];
        });
        const firstDeath = survivorLots.length ? Math.min(...survivorLots.map(row => lifetimeMinutes(
          row.hull, difficulty, model, protectionLevel, tech, row.damageBp, row.remainderBp))) : null;
        captures.push({ difficulty, fleet, tech, protectionLevel, seed, control: battle.control,
          survivors: contribution.survivors, losses: contribution.losses, wounds: contribution.survivorDamage,
          firstDeathMinutesAfterBattle: firstDeath,
          grossAt75PctFirstDeath: battle.control === 'ATTACKER' && firstDeath !== null ? studyHold(survivorLots, {
            difficulty, model, protectionLevel, minutes: firstDeath * .75 }).deliverableDeuterium : 0,
          checkpoints: battle.control !== 'ATTACKER' ? [] : [15, 30, 45, 60, 90, 120].map(minutes => {
            const hold = studyHold(survivorLots, { difficulty, model, protectionLevel, minutes });
            return { minutes, deliverableDeuterium: hold.deliverableDeuterium, lostDeuterium: hold.lostDeuterium,
              destroyedShips: hold.destroyed.reduce((sum, row) => sum + row.count, 0),
              survivingShips: hold.lots.reduce((sum, row) => sum + row.count, 0) };
          }) });
      }
    }
  }
  const progression = [];
  for (const difficulty of ['EASY', 'HARD']) for (const fleet of [{ RAMPART: 1, COURIER: 1 }, { CORSAIR: 1, ARGOSY: 1 }]) {
    const tech = minimumBuildTech(fleet);
    for (let protectionLevel = 0; protectionLevel <= 4; protectionLevel++) {
      const firstDeath = Math.min(...Object.keys(fleet).map(hull => lifetimeMinutes(hull, difficulty, model, protectionLevel, tech)));
      const minutes = Math.round(firstDeath * .75 * 60000) / 60000;
      progression.push({ difficulty, fleet, protectionLevel, tech, firstDeath, minutes,
        ...farmTrip(fleet, { difficulty, model, protectionLevel, tech, minutes }), lots: undefined, destroyed: undefined, shares: undefined });
    }
  }
  const averageTrips = [];
  const averageFleets = [{ RAMPART: 1, COURIER: 1 }, { STRONGHOLD: 1, WAYFARER: 1 },
    { LEVIATHAN: 1, ATLAS: 1 }, { CORSAIR: 1, ARGOSY: 1 }, { CITADEL: 1, ARGOSY: 1 }];
  for (const difficulty of ['EASY', 'HARD']) for (const fleet of averageFleets) {
    const buildTech = minimumBuildTech(fleet);
    for (const [protectionLevel, tech] of [[0, buildTech], [4, buildTech], [4, { ...buildTech, SHIP_ARMOR: 5, INDUSTRIAL: 2 }]]) {
      const firstDeath = Math.min(...Object.keys(fleet).map(hull => lifetimeMinutes(hull, difficulty, model, protectionLevel, tech)));
      const minutes = Math.round(firstDeath * .75 * 60000) / 60000, samples = [];
      for (let homeIndex = 0; homeIndex < 12; homeIndex++) {
        const y = 1 - 2 * (homeIndex + .5) / 12, angle = homeIndex * Math.PI * (3 - Math.sqrt(5));
        const planar = Math.sqrt(1 - y * y);
        const homePosition = { x: 4500 * planar * Math.cos(angle), y: 4500 * y, z: 4500 * planar * Math.sin(angle) };
        for (let phase = 0; phase < 12; phase++) for (const ordinal of difficulty === 'EASY' ? [5, 6, 7, 8] : [1, 2, 3, 4]) {
          const trip = farmTrip(fleet, { difficulty, model, protectionLevel, tech, minutes, homePosition,
            ordinal, departAt: phase * 16 * 3600_000 / 12 });
          const cycleMinutes = trip.outboundMinutes + minutes + trip.returnMinutes + trip.repair.minutes;
          samples.push({ fuel: trip.outboundFuel + trip.returnFuel, netValue: trip.netValueDeuteriumEquivalent,
            cycleMinutes, netValuePerHour: trip.netValueDeuteriumEquivalent / cycleMinutes * 60 });
        }
      }
      const mean = key => samples.reduce((sum, row) => sum + row[key], 0) / samples.length;
      const gross = MONUMENT_BALANCE[difficulty].productionPerMinute * minutes;
      const minNetValue = Math.min(...samples.map(row => row.netValue));
      const maxNetValue = Math.max(...samples.map(row => row.netValue));
      const productionOptions = [...new Set(productionBudgets.map(output => output[difficulty]))].map(output => {
        const newGross = output * minutes;
        // Every sampled trip returns before its first casualty. No cargo cap at these outputs.
        const capacity = Object.entries(fleet).reduce((sum, [hull, count]) => sum
          + (HULLS[hull].family === 'CARGO' ? HULLS[hull].cargo * count : 0), 0);
        if (newGross > capacity) throw new RangeError('Production sensitivity requires an uncapped cargo hold');
        return { outputPerMinute: output, gross: newGross,
          meanNetValue: mean('netValue') + newGross - gross,
          minNetValue: minNetValue + newGross - gross, maxNetValue: maxNetValue + newGross - gross };
      });
      averageTrips.push({ difficulty, fleet, protectionLevel, tech, samples: samples.length,
        holdMinutes: minutes, gross,
        meanFuel: mean('fuel'), meanNetValue: mean('netValue'), meanCycleMinutes: mean('cycleMinutes'),
        meanNetValuePerHour: mean('netValuePerHour'),
        minNetValue, maxNetValue,
        breakEvenOutputMean: (gross - mean('netValue')) / minutes,
        breakEvenOutputAllSamples: (gross - minNetValue) / minutes, productionOptions });
    }
  }
  const report = {
    date: '2026-10-12', status: 'IMPLEMENTED_PENDING_DEPLOY', model, models: MODELS,
    radiationLevelHpPerMinute: RADIATION_LEVEL_HP_PER_MINUTE, protection: PROTECTION,
    anchors: { hull: 'CORSAIR', baseHp: HULLS.CORSAIR.hp, maxArmor: 5,
      baseCorsairMinutes: lifetimeMinutes('CORSAIR', 'HARD', model),
      maxCorsairMinutes: lifetimeMinutes('CORSAIR', 'HARD', model, 4, { SHIP_ARMOR: 5 }),
      maxShieldWithoutArmorMinutes: lifetimeMinutes('CORSAIR', 'HARD', model, 4) },
    scope: `${hulls.length} live mobile hulls; ${trips.length} endpoint trips, ${averageTrips.reduce((sum, row) => sum + row.samples, 0)} sampled-position/phase/monument trips, ${progression.length} fixed-tech research progression trips, ${captures.length} seeded NPC battles. No DB, season simulation, PvP simulation, shelter, new arrivals or tactical bombs.`,
    assumptions: { maxArmor: 5, radiationInFlight: false, farmAfterCapture: true, soloProductionPerMinute: { EASY: 3, HARD: 8 },
      flightPace: 1, beaconBoost: 1, propulsion: 'minimum hull build prerequisite', homeRadius: 4500, monumentRadius: 6000, periodsHours: [8, 16], repairYard: 6,
      equivalent: '32 alloy or 16 crystal = 1 deuterium, valuation only; not an exchange or actual currency debit.' },
    proposedResearch: proposedResearch(), productionBudgets, hulls, trips, captures, progression, averageTrips,
  };
  return report;
}

async function main() {
  const report = buildStudy();
  await writeFile(new URL('../docs/evidence/monument-radiation-calibration-2026-10-12.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ scope: report.scope, anchors: report.anchors,
    bestTrips: ['EASY', 'HARD'].map(difficulty => report.trips.filter(row => row.difficulty === difficulty)
      .sort((a, b) => b.netValueDeuteriumEquivalent - a.netValueDeuteriumEquivalent)[0]),
    proposedResearch: report.proposedResearch }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
