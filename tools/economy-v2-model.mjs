#!/usr/bin/env node
/**
 * ECONOMY v2 — the whole model in one runnable file.
 *
 * Emits `docs/economy-v2.json` (the complete numeric tables) and prints the
 * progression validation for days 1/3/7/10/14 against the four phase targets.
 *
 *   node tools/economy-v2-model.mjs            # tables + validation
 *   node tools/economy-v2-model.mjs --json     # write docs/economy-v2.json
 *
 * Nothing here reads the shipped constants. It is a from-scratch derivation and
 * the numbers are meant to REPLACE `packages/rules/src/constants.ts`, not to be
 * compared with it.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ─────────────────────────────────────────────────────────────────────────
 * PARAMETERS — every number the model can be wrong about
 * ───────────────────────────────────────────────────────────────────────── */

const P = {
  season: { days: 14, actShares: { war: 4 / 14, consolidation: 8 / 14, sunset: 12 / 14 },
            investmentHorizonShare: 0.7, afterglowMinutes: 15 },

  // Production: base x L x g^L  (OGame shape: doubles at L1->L2, decays after)
  alloyBase: 132, alloyMult: 1.10,
  crystalBase: 48, crystalMult: 1.09,

  // Cost: base x k^L  (k close to OGame's 1.5)
  costBase: 52, costMult: 1.56,
  crystalCostShare: 0.2895,          // = 0.79 x income share, DERIVED
  // crystalCostMult DERIVED so the crystal cost share tracks the income share
  get crystalCostBase() { return this.costBase * this.crystalCostShare; },
  get crystalCostMult() { return this.costMult * (this.crystalMult / this.alloyMult); },

  capHours: 12,        // storage at Vault 0
  capHoursPerVault: 0.8, // the Vault is the BANK: every level adds this many hours of store
  worksHours: 10,      // uncollected buffer — a night plus margin
  queueDepth: 3,       // construction orders that may be pending at once

  // The floor is denominated in HOURS OF THAT RESOURCE'S OWN PRODUCTION, so it can
  // never be sized against alloy and misapplied to crystal. INVARIANT:
  // protectedHoursPerVault / storageHoursPerVault < 0.5 — at most half a store is ever safe.
  protectedHoursBase: 2, protectedHoursPerVault: 0.3,
  openingFloorAlloy: 840,

  // Build throughput, resource-units per minute
  conBase: 240, conPerCore: 0.22,        // buildings / instruments / satellites
  yardBase: 312, yardPerYard: 0.35,      // mobile hulls
  defBase: 1200, defPerYard: 0.35,       // ground guns — sized off the radar window
  researchTimeMult: 4,
  buildCapMinutes: 360,
  cancelRefund: 0.5,

  maxLevel: { CORE: 20, REFINERY: 20, EXTRACTOR: 20, VAULT: 16, SHIPYARD: 12 },
  practicalCeiling: 'A 14-day season tops out near Refinery 16-18; 20 is headroom, not a target.',

  combat: {
    rounds: 3, varianceMin: 0.92, varianceMax: 1.08,
    strongMult: 1.6, weakMult: 0.625,
    partialThreshold: 0.42,
    lootDecisive: 0.70, lootPartial: 0.35, lootBufferShare: 0.5,
    defenceSalvage: 0.6, engagementSeconds: 10,
  },

  travel: { baseMinutes: 1, distanceFactor: 1.2 },

  shield: { base: 60, mult: 1.5, regenPerHour: 0.35 },
  disruption: { decisiveMinutes: 20, partialMinutes: 7, maxPendingMinutes: 25 },
  debris: { share: 0.30, decayMinutes: 40, minimum: 250 },
  abuse: { bashLimit: 3, bashWindowMinutes: 720, tierBand: 2 },

  intel: {
    detectBase: 0.25, detectSlope: 0.18, detectMin: 0.05, detectMax: 0.95,
    accuracyBase: 0.55, accuracySlope: 0.12, accuracyMin: 0.30, accuracyMax: 1.0,
    intermittentRefreshMin: 20, intermittentDropRate: 0.25, degradedUnknownRate: 0.7,
    telescopeRange: [0, 500, 725, 1025, 1525, Infinity],
    telescopeSlots: [0, 1, 1, 2, 2, 3],
    telescopeCooldownHours: [0, 5, 4, 3, 2, 1],
    radarRange: [0, 0, 0, 190, 360, 570],
  },
  instrumentLevelWorth: 2,
  instrumentCostMult: { TELESCOPE: 3, RADAR: 2, AEGIS: 2, VEIL: 2 },

  probe: { alloy: 50, crystal: 30, speed: 260 },
  prospector: { speed: 825, launchMinutes: 0.13, hold: 300, max: 2 },

  galaxy: {
    baselinePlayers: 300, baselineRadius: 2500, thickness: 300, minSeparation: 225,
    asteroidsPerHourPerPlayer: 0.030,
    asteroidSpeedMin: 350, asteroidSpeedMax: 750,
    asteroidOrbitMinShare: 0.20, asteroidOrbitMaxShare: 0.95,
    asteroidLifeHoursMin: 2.5, asteroidLifeHoursMax: 5,
    asteroidOreByLevel: [0, 800, 1600, 3200, 6000, 11000],
    asteroidLevelWeights: [0, 0.40, 0.27, 0.18, 0.10, 0.05],
    asteroidCrystalShareMin: 0.25, asteroidCrystalShareMax: 0.65,
    neutralPerPlayer: { 1: 0.10, 2: 0.05, 3: 0.02 },
  },

  deuterium: { containmentRatio: 0.5, frontierStartsAtMinutes: 35 * 60,
               isotopeCadence: 9, isotopeBonusCadence: 10, isotopeShare: 0.104,
               graviticDiscoveryShieldShare: 0.25 },

  satellites: {
    UPLINK:  { alloy:  900, crystal:  300, minCoreSlot: 1 },
    FOUNDRY: { alloy: 2000, crystal:  700, production: 1.06 },
    DERRICK: { alloy: 2200, crystal:  800, hold: 2.6, speed: 1.5 },
    BEACON:  { alloy: 3000, crystal: 1000, speed: 1.3 },
  },
};

/* ─────────────────────────────────────────────────────────────────────────
 * FORMULAS
 * ───────────────────────────────────────────────────────────────────────── */

const r2 = (n) => Math.round(n);
const alloyRate    = (L) => P.alloyBase   * L * P.alloyMult   ** L;
const crystalRate  = (L) => P.crystalBase * L * P.crystalMult ** L;

/** Cost to go from `level` to `level + 1`. */
const upgradeCost = (L) => ({
  alloy: r2(P.costBase * P.costMult ** L),
  crystal: r2(P.crystalCostBase * P.crystalCostMult ** L),
  deuterium: 0,
});
const total = (c) => c.alloy + c.crystal + (c.deuterium ?? 0);

const storageHours = (vault) => P.capHours + P.capHoursPerVault * Math.max(0, vault);
const storageCap = (rate, vault = 0) => r2(storageHours(vault) * rate);
const worksCap   = (rate) => r2(P.worksHours * rate);
const deutStorageCap = (crystalRateAtLevel, vault = 0) => r2(storageCap(crystalRateAtLevel, vault) * P.deuterium.containmentRatio);
const deutWorksCap   = (crystalRateAtLevel) => r2(worksCap(crystalRateAtLevel)   * P.deuterium.containmentRatio);

const protectedHours = (vault) => P.protectedHoursBase + P.protectedHoursPerVault * Math.max(0, vault);
/**
 * The Vault floor, per resource, in hours of that resource's own production.
 * The opening floor binds only on a very young world; the growing part is hours.
 */
const vaultProtects = (vault, refinery = 1, extractor = 1) => {
  const h = protectedHours(vault);
  return {
    alloy: r2(Math.max(P.openingFloorAlloy, h * alloyRate(refinery))),
    crystal: r2(Math.max(P.openingFloorAlloy * (P.crystalBase / P.alloyBase), h * crystalRate(extractor))),
    deuterium: 0,
  };
};

const conThroughput  = (core) => P.conBase  * (1 + P.conPerCore  * core);
const yardThroughput = (yard) => P.yardBase * (1 + P.yardPerYard * yard);
const defThroughput  = (yard) => P.defBase  * (1 + P.defPerYard  * yard);

const buildMinutes    = (cost, core) => Math.min(P.buildCapMinutes, total(cost) / conThroughput(core));
const shipMinutes     = (cost, yard) => total(cost) / yardThroughput(yard);
const defenceMinutes  = (cost, yard) => total(cost) / defThroughput(yard);
const researchMinutes = (cost, core) => Math.min(P.buildCapMinutes, P.researchTimeMult * total(cost) / conThroughput(core));

const marginalAlloy   = (L) => alloyRate(L + 1)   - alloyRate(L);
const marginalCrystal = (L) => crystalRate(L + 1) - crystalRate(L);
const paybackRefinery = (L) => total(upgradeCost(L)) / marginalAlloy(L);
const paybackExtractor= (L) => total(upgradeCost(L)) / marginalCrystal(L);
const worthInvesting  = (payback, hoursRemaining) => payback < hoursRemaining * P.season.investmentHorizonShare;

const instrumentCost = (id, L) => {
  const base = upgradeCost(L * P.instrumentLevelWorth);
  const m = P.instrumentCostMult[id];
  return { alloy: r2(base.alloy * m), crystal: r2(base.crystal * m), deuterium: 0 };
};
const shieldHp = (L) => (L <= 0 ? 0 : r2(P.shield.base * P.shield.mult ** L));
const satelliteSlots = (core) => (core >= 9 ? 4 : core >= 5 ? 3 : core >= 3 ? 2 : core >= 1 ? 1 : 0);
const flightSlots = (core) => 3 + Math.floor(Math.max(0, core) / 3);
const coreTier = (core) => Math.max(1, Math.ceil(core / 3));
const travelExact = (dist, speed) => P.travel.baseMinutes + (dist / speed) * P.travel.distanceFactor;

/* ─────────────────────────────────────────────────────────────────────────
 * HULLS — atk x hp / V^2 held near a constant, tier buys ~15% per step
 * ───────────────────────────────────────────────────────────────────────── */

const HULLS = {
  WASP:       { cls:'SKIRMISHER', atk:  15, hp:  25, speed:130, cargo:  45, alloy: 240, crystal:   0, deuterium:  0, minShipyard:0, ground:false, research:null },
  LANCE:      { cls:'LANCE',      atk:  78, hp: 112, speed:100, cargo:  60, alloy: 820, crystal: 260, deuterium:  0, minShipyard:2, ground:false, research:null },
  BULWARK:    { cls:'BULWARK',    atk: 106, hp: 662, speed: 65, cargo:  90, alloy:2150, crystal: 730, deuterium:  0, minShipyard:4, ground:false, research:null },
  HAULER:     { cls:'SUPPORT',    atk:   0, hp: 210, speed: 85, cargo:2200, alloy:1100, crystal: 200, deuterium:  0, minShipyard:1, ground:false, research:null },
  RUNNER:     { cls:'SUPPORT',    atk:   0, hp: 120, speed:125, cargo: 380, alloy: 560, crystal: 250, deuterium: 90, minShipyard:2, ground:false, research:'DENSE_FUEL_CELLS' },
  BREACHER:   { cls:'LANCE',      atk:  55, hp: 300, speed: 78, cargo:   0, alloy:1250, crystal: 550, deuterium:200, minShipyard:3, ground:false, research:'GRAVITIC_CHARGES' },
  BASTION:    { cls:'BULWARK',    atk: 118, hp: 906, speed:  0, cargo:   0, alloy:2400, crystal: 800, deuterium:  0, minShipyard:1, ground:true,  research:null },
  THORN:      { cls:'SKIRMISHER', atk:  49, hp: 174, speed:  0, cargo:   0, alloy: 700, crystal: 200, deuterium:  0, minShipyard:0, ground:true,  research:null },
  PROSPECTOR: { cls:'SUPPORT',    atk:   0, hp: 150, speed:825, cargo:1800, alloy: 650, crystal: 200, deuterium:  0, minShipyard:1, ground:false, research:null },
};

const RESEARCH = {
  ISOTOPE_SPECTROMETRY: { alloy:0,     crystal: 900, deuterium:  0, prerequisite:null,                   availableAtMinutes: P.deuterium.frontierStartsAtMinutes, requiredCore:0 },
  DENSE_FUEL_CELLS:     { alloy:0,     crystal:1400, deuterium:150, prerequisite:'ISOTOPE_SPECTROMETRY', availableAtMinutes: P.deuterium.frontierStartsAtMinutes, requiredCore:0 },
  GRAVITIC_CHARGES:     { alloy:0,     crystal:1900, deuterium:350, prerequisite:'ISOTOPE_SPECTROMETRY', availableAtMinutes: P.deuterium.frontierStartsAtMinutes, requiredCore:0 },
  DEATH_STAR_PROTOCOL:  { alloy:11000, crystal:3600, deuterium:900, prerequisite:'GRAVITIC_CHARGES',     availableAtMinutes: P.season.actShares.war * P.season.days * 1440, requiredCore:6 },
};

const DEATH_STAR = { alloy:28000, crystal:9000, deuterium:2600, buildMinutes:60, speed:500,
                     requiredCore:6, requiredShipyard:5, probeVisibilityAccuracy:0.75 };

/**
 * THE COLONY IS THE LATE-GAME UN-LOSABLE SINK, and it has to be priced like one.
 * A settlement at 1,000 alloy is a rounding error by day 4; at this price it is the
 * decision that competes with a fleet, and each colony then runs its own building
 * ladder — which is where wealth that a raid can never take is supposed to go.
 */
const SETTLEMENT = { alloy: 2000, crystal: 1000, deuterium: 0, haulers: 2,
                     colonyCapacity: 'floor(highestCore / 3), capped at 3' };

/* opening grant — DERIVED from the opening sequence, never picked */
const OPENING = (() => {
  const step = upgradeCost(1);                 // Core, Refinery, Extractor each 1 -> 2
  const start = { alloy: 3 * step.alloy + 2 * HULLS.WASP.alloy, crystal: 3 * step.crystal, deuterium: 0 };
  const bonus = { alloy: r2(4 * alloyRate(1) / 10) * 10, crystal: r2(4 * crystalRate(1) / 10) * 10, deuterium: 0 };
  return { START: start, OPENING_BONUS: bonus,
           PLANET_START: { alloy: start.alloy + bonus.alloy, crystal: start.crystal + bonus.crystal, deuterium: 0 } };
})();

/* ─────────────────────────────────────────────────────────────────────────
 * PROGRESSION SIMULATION
 * ───────────────────────────────────────────────────────────────────────── */

const ARCHETYPES = {
  HARDCORE: { sessionsPerDay: 10, militaryShare: 0.42, raidsPerDay: 8, incomingRaidsPerDay: 2.5 },  // exchange ratio: Dominion gained per resource of fleet spent gaining it
  ACTIVE:   { sessionsPerDay: 5,  militaryShare: 0.35, raidsPerDay: 4, incomingRaidsPerDay: 2.0 },
  CASUAL:   { sessionsPerDay: 2,  militaryShare: 0.25, raidsPerDay: 1, incomingRaidsPerDay: 1.5 },
};

/** Sessions live inside a 16-hour waking window, so the overnight gap is real. */
function sessionMinutes(sessionsPerDay) {
  const set = new Set();
  for (let d = 0; d < P.season.days + 1; d++)
    for (let i = 0; i < sessionsPerDay; i++)
      set.add(d * 1440 + 480 + Math.round((i * 960) / sessionsPerDay));
  return set;
}

/**
 * What a raid is worth, against the GALAXY MEDIAN planet rather than against the
 * raider's own — a leader raids the middle of the ladder, not a mirror of itself.
 * `median` is the ACTIVE trajectory, computed in a first pass.
 */
function raidEconomy(medianLevels, own, arch) {
  const rA = alloyRate(medianLevels.REFINERY), rC = crystalRate(medianLevels.EXTRACTOR);
  const stockOccupancy = 0.45, worksOccupancy = 0.55;
  const floor = vaultProtects(medianLevels.VAULT, medianLevels.REFINERY, medianLevels.EXTRACTOR);
  const exposed = (rate, floorAmount, vault) =>
    Math.max(0, storageCap(rate, vault) * stockOccupancy - floorAmount) * P.combat.lootDecisive
    + worksCap(rate) * worksOccupancy * P.combat.lootDecisive * P.combat.lootBufferShare;
  const eA = exposed(rA, floor.alloy, medianLevels.VAULT), eC = exposed(rC, floor.crystal, medianLevels.VAULT);

  // What YOU lose is bounded by YOUR OWN planet, not by the galaxy median.
  const oA = alloyRate(own.REFINERY), oC = crystalRate(own.EXTRACTOR);
  const ownFloor = vaultProtects(own.VAULT, own.REFINERY, own.EXTRACTOR);
  const mA = exposed(oA, ownFloor.alloy, own.VAULT), mC = exposed(oC, ownFloor.crystal, own.VAULT);

  const winRate = 0.72;
  return {
    gainA: eA * winRate * arch.raidsPerDay / 1440, gainC: eC * winRate * arch.raidsPerDay / 1440,
    lossA: mA * 0.62 * arch.incomingRaidsPerDay / 1440, lossC: mC * 0.62 * arch.incomingRaidsPerDay / 1440,
  };
}

function simulate(name, arch, medianTrack, { minutes = P.season.days * 1440 } = {}) {
  const s = { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 };
  const inst = { TELESCOPE: 0, RADAR: 0, AEGIS: 0, VEIL: 0 };
  const sats = new Set();
  let alloy = OPENING.PLANET_START.alloy, crystal = OPENING.PLANET_START.crystal;
  let worksA = 0, worksC = 0, military = 0, econSpend = 0, milSpend = 0, wasted = 0;
  let produced = 0, raidTaken = 0, raidLost = 0, fleetLost = 0, debrisGained = 0;
  const RR = 2.4;   // Dominion per resource of fleet spent — mid of the healthy 1.3-3.5 band
  const queue = [];                                   // {kind,id,cost,readyAt}
  const sessions = sessionMinutes(arch.sessionsPerDay);
  const track = [];
  const snaps = [];
  const wantDays = [1, 3, 7, 10, 14];
  let lastSession = 0;

  const yardWant = (t) => (t < 3 * 1440 ? 2 : t < 7 * 1440 ? 4 : t < 10 * 1440 ? 6 : 8);

  const bestOption = (t, hoursRemaining, pending) => {
    const lvl = (id) => s[id] + pending.filter((q) => q.id === id).length;
    const opts = [];
    const push = (id, payback) => {
      const L = lvl(id);
      if (L >= P.maxLevel[id]) return;
      if (id !== 'CORE' && L >= lvl('CORE')) return;          // nothing may exceed the Core
      opts.push({ kind: 'building', id, cost: upgradeCost(L), payback });
    };
    push('REFINERY', paybackRefinery(lvl('REFINERY')));
    push('EXTRACTOR', paybackExtractor(lvl('EXTRACTOR')) * 0.55);   // crystal is the binding resource
    const blocked = Math.min(lvl('REFINERY'), lvl('EXTRACTOR')) >= lvl('CORE');
    push('CORE', paybackRefinery(lvl('REFINERY')) * (blocked ? 0.9 : 2.6));
    push('SHIPYARD', lvl('SHIPYARD') < yardWant(t) ? paybackRefinery(lvl('REFINERY')) * 0.5 : 1e9);
    push('VAULT', lvl('VAULT') < Math.max(0, lvl('REFINERY') - 3) ? paybackRefinery(lvl('REFINERY')) * 0.8 : 1e9);
    opts.sort((a, b) => a.payback - b.payback);
    return opts.find((o) => worthInvesting(o.payback, hoursRemaining));
  };

  for (let t = 0; t < minutes; t++) {
    const hoursRemaining = (minutes - t) / 60;
    const boost = sats.has('FOUNDRY') ? P.satellites.FOUNDRY.production : 1;
    const rA = alloyRate(s.REFINERY) * boost, rC = crystalRate(s.EXTRACTOR) * boost;
    const beforeA = worksA;
    worksA = Math.min(worksCap(rA), worksA + rA / 60);
    worksC = Math.min(worksCap(rC), worksC + rC / 60);
    wasted += Math.max(0, rA / 60 - (worksA - beforeA));
    produced += (rA + rC) / 60;

    while (queue.length && queue[0].readyAt <= t) {
      const done = queue.shift();
      if (done.kind === 'building') s[done.id] += 1;
      else if (done.kind === 'instrument') inst[done.id] += 1;
      else sats.add(done.id);
      if (queue.length) queue[0].readyAt = t + queue[0].minutes;
    }

    if (sessions.has(t)) {
      const elapsed = Math.max(1, t - lastSession); lastSession = t;
      const roomA = Math.max(0, storageCap(rA, s.VAULT) - alloy), roomC = Math.max(0, storageCap(rC, s.VAULT) - crystal);
      const takeA = Math.min(worksA, roomA), takeC = Math.min(worksC, roomC);
      alloy += takeA; crystal += takeC; worksA -= takeA; worksC -= takeC;

      const med = medianTrack ? medianTrack[Math.min(medianTrack.length - 1, t)] : s;
      const r = raidEconomy(med, s, arch);
      // every raid costs ships, and 30% of everything destroyed comes back as a public field
      const attrition = Math.min(military, (r.gainA + r.gainC) * elapsed / RR);
      military -= attrition; fleetLost += attrition;
      const defenceAttrition = Math.min(military, (r.lossA + r.lossC) * elapsed / (RR * 1.6));
      military -= defenceAttrition; fleetLost += defenceAttrition;
      const debris = (attrition + defenceAttrition) * P.debris.share * 0.6;
      military += debris; debrisGained += debris;
      const tookA = r.gainA * elapsed, tookC = r.gainC * elapsed;
      const lostA = Math.min(alloy + tookA, r.lossA * elapsed), lostC = Math.min(crystal + tookC, r.lossC * elapsed);
      raidTaken += tookA + tookC; raidLost += lostA + lostC;
      alloy = Math.max(0, alloy + tookA - lostA);
      crystal = Math.max(0, crystal + tookC - lostC);

      // military — capped by what the yard could physically have built since last session
      const yardCap = yardThroughput(s.SHIPYARD) * elapsed;
      const nextCost = bestOption(t, hoursRemaining, queue)?.cost ?? { alloy: 0, crystal: 0 };
      const keepA = Math.max(storageCap(rA, s.VAULT) * 0.88, nextCost.alloy * 1.1);
      const keepC = Math.max(storageCap(rC, s.VAULT) * 0.88, nextCost.crystal * 1.1);
      const surplus = Math.max(0, alloy - keepA) + Math.max(0, crystal - keepC);
      const want = Math.min(Math.max((alloy + crystal) * arch.militaryShare * 0.45, surplus), Math.max(0, alloy - nextCost.alloy) + Math.max(0, crystal - nextCost.crystal));
      const spend = Math.min(want, yardCap);
      if (spend > 150) {
        const mA = Math.min(alloy, spend * 0.76), mC = Math.min(crystal, spend * 0.24);
        alloy -= mA; crystal -= mC; military += mA + mC; milSpend += mA + mC;
      }

      // hardware then economy, up to the queue depth
      let guard = 0;
      while (queue.length < P.queueDepth && guard++ < 12) {
        let order = null;
        if (!sats.has('UPLINK') && satelliteSlots(s.CORE) > sats.size
            && alloy >= P.satellites.UPLINK.alloy && crystal >= P.satellites.UPLINK.crystal) {
          order = { kind: 'satellite', id: 'UPLINK', cost: P.satellites.UPLINK };
        } else if (sats.has('UPLINK') && inst.TELESCOPE + queue.filter(q => q.id === 'TELESCOPE').length < 3) {
          const c = instrumentCost('TELESCOPE', inst.TELESCOPE + queue.filter(q => q.id === 'TELESCOPE').length);
          if (alloy >= c.alloy && crystal >= c.crystal) order = { kind: 'instrument', id: 'TELESCOPE', cost: c };
        } else if (!sats.has('FOUNDRY') && satelliteSlots(s.CORE) > sats.size
            && alloy >= P.satellites.FOUNDRY.alloy && crystal >= P.satellites.FOUNDRY.crystal) {
          order = { kind: 'satellite', id: 'FOUNDRY', cost: P.satellites.FOUNDRY };
        } else if (!sats.has('DERRICK') && satelliteSlots(s.CORE) > sats.size
            && alloy >= P.satellites.DERRICK.alloy && crystal >= P.satellites.DERRICK.crystal) {
          order = { kind: 'satellite', id: 'DERRICK', cost: P.satellites.DERRICK };
        }
        if (!order) {
          const opt = bestOption(t, hoursRemaining, queue);
          if (!opt || alloy < opt.cost.alloy || crystal < opt.cost.crystal) break;
          order = opt;
        }
        alloy -= order.cost.alloy; crystal -= order.cost.crystal;
        econSpend += total(order.cost);
        order.minutes = buildMinutes(order.cost, s.CORE);
        order.readyAt = (queue.length === 0 ? t : Infinity) + order.minutes;
        queue.push(order);
        if (queue.length === 1) queue[0].readyAt = t + order.minutes;
      }
    }

    track.push({ ...s });
    const day = (t + 1) / 1440;
    if (Number.isInteger(day) && wantDays.includes(day)) {
      snaps.push({
        day, ...structuredClone(s), TELESCOPE: inst.TELESCOPE,
        sats: [...sats].join('+') || '—',
        alloyPerHour: r2(alloyRate(s.REFINERY) * boost),
        crystalPerHour: r2(crystalRate(s.EXTRACTOR) * boost),
        storedValue: r2(alloy + crystal), militaryValue: r2(military),
        losable: r2(alloy + crystal + worksA + worksC + military), unlosable: r2(econSpend),
        ARR: +((alloy + crystal + worksA + worksC + military) / Math.max(1, alloy + crystal + worksA + worksC + military + econSpend)).toFixed(3),
        tier: coreTier(s.CORE), bays: flightSlots(s.CORE),
      });
    }
  }
  return { name, snaps, track, econSpend: r2(econSpend), milSpend: r2(milSpend), wasted: r2(wasted),
           produced: r2(produced), raidTaken: r2(raidTaken), raidLost: r2(raidLost),
           fleetLost: r2(fleetLost), debrisGained: r2(debrisGained),
           TAX: +(raidLost / Math.max(1, produced)).toFixed(3), netRaid: r2(raidTaken - raidLost) };
}

/* ─────────────────────────────────────────────────────────────────────────
 * OUTPUT
 * ───────────────────────────────────────────────────────────────────────── */

const pad = (v, n) => String(v).padStart(n);
const fmt = (n) => n >= 10000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n));

function printEconomyTable() {
  console.log('\n=== BUILDING LADDER (cost to reach the NEXT level; build time at core = level) ===');
  console.log('  L   alloy   crystal    total  | build   | alloy/h  cryst/h | store@V=L-3  works A | vaultA  %store | payback R  payback X | cost/store');
  for (let L = 1; L <= 20; L++) {
    const c = upgradeCost(L);
    const rA = alloyRate(L), rC = crystalRate(L);
    const bm = buildMinutes(c, L);
    const vaultL = Math.max(0, Math.min(P.maxLevel.VAULT, L - 3));
    const v = vaultProtects(vaultL, L, L);
    const store = storageCap(rA, vaultL);
    console.log(
      `${pad(L,3)} ${pad(fmt(c.alloy),7)} ${pad(fmt(c.crystal),9)} ${pad(fmt(total(c)),8)}  |` +
      `${pad(bm < 1 ? (bm*60).toFixed(0)+'s' : bm < 60 ? bm.toFixed(1)+'m' : (bm/60).toFixed(1)+'h', 7)} |` +
      `${pad(fmt(rA),8)} ${pad(fmt(rC),8)} |${pad(fmt(store),12)} ${pad(fmt(worksCap(rA)),8)} |` +
      `${pad(fmt(v.alloy),7)} ${pad((100*v.alloy/store).toFixed(1)+'%',7)} |` +
      `${pad(paybackRefinery(L).toFixed(1)+'h',10)} ${pad(paybackExtractor(L).toFixed(1)+'h',10)} |` +
      `${pad((c.alloy/store).toFixed(2),10)}${c.alloy > store ? ' OVER' : ''}`);
  }
}

function printSunset() {
  console.log(`\n=== SUNSET — the level above which building stops repaying (payback < ${P.season.investmentHorizonShare} x remaining) ===`);
  for (const d of [1,3,5,7,9,11,12,13,13.5,14]) {
    const remaining = (P.season.days - d) * 24;
    let top = 0;
    for (let L = 1; L <= 20; L++) if (worthInvesting(paybackRefinery(L), remaining)) top = L;
    console.log(`  day ${pad(d,4)}  ${pad(remaining.toFixed(0),4)}h left  ->  Refinery stops above L${top}`);
  }
}

function printHulls() {
  console.log('\n=== HULLS ===');
  console.log('name          cls          atk    hp  speed  cargo   alloy crystal  deut   yard | value  atk*hp/V^2  hp/1k  atk/1k | build@yard4');
  for (const [id,h] of Object.entries(HULLS)) {
    const V = h.alloy + h.crystal + h.deuterium;
    const t = h.ground ? defenceMinutes(h, 4) : shipMinutes(h, 4);
    console.log(`${id.padEnd(12)} ${h.cls.padEnd(11)} ${pad(h.atk,5)} ${pad(h.hp,5)} ${pad(h.speed,6)} ${pad(h.cargo,6)} ${pad(fmt(h.alloy),7)} ${pad(fmt(h.crystal),7)} ${pad(h.deuterium,5)} ${pad(h.minShipyard,6)} |${pad(fmt(V),6)} ${pad((1e6*h.atk*h.hp/(V*V)).toFixed(0),11)} ${pad((1000*h.hp/V).toFixed(1),6)} ${pad((1000*h.atk/V).toFixed(1),7)} |${pad(t<1?(t*60).toFixed(0)+'s':t.toFixed(1)+'m',11)}`);
  }
}

function printTravel() {
  console.log('\n=== TRAVEL (one-way minutes; round trip is 2x) ===');
  const ds = [260, 510, 755, 1300, 2275, 4800];   // NN, 10th, 25th, mid, median pair, disc diameter
  console.log('hull        ' + ds.map(d=>pad('d='+d,9)).join(''));
  for (const id of ['WASP','LANCE','BULWARK','HAULER','RUNNER','BREACHER']) {
    console.log(id.padEnd(12) + ds.map(d=>pad(travelExact(d,HULLS[id].speed).toFixed(1),9)).join(''));
  }
  console.log('PROBE'.padEnd(12) + ds.map(d=>pad(travelExact(d,P.probe.speed).toFixed(1),9)).join(''));
  console.log('\n=== RADAR NOTICE (minutes of warning, by level, vs a fleet at that distance) ===');
  for (const id of ['WASP','BULWARK']) {
    for (const L of [3,4,5]) {
      const row = ds.map(d => {
        const oneWay = travelExact(d, HULLS[id].speed);
        const range = P.intel.radarRange[L];
        return pad(Math.min(oneWay, oneWay * range / d).toFixed(1), 9);
      }).join('');
      console.log(`${id.padEnd(9)}L${L}  ` + row);
    }
  }
}

function printScaling() {
  console.log('\n=== POPULATION SCALING (density held constant; radius is the only geometric lever) ===');
  console.log(' players  radius  asteroids/h  rocks in sky  T1/T2/T3 neutrals  telescope L1..L4          bays@core20');
  for (const N of [200, 300, 400, 500]) {
    const R = r2(P.galaxy.baselineRadius * Math.sqrt(N / P.galaxy.baselinePlayers));
    const k = R / P.galaxy.baselineRadius;
    const spawn = (N * P.galaxy.asteroidsPerHourPerPlayer);
    const sky = r2(spawn * (P.galaxy.asteroidLifeHoursMin + P.galaxy.asteroidLifeHoursMax) / 2);
    const nt = [1,2,3].map(t => Math.round(N * P.galaxy.neutralPerPlayer[t])).join('/');
    const tel = P.intel.telescopeRange.slice(1,5).map(v => r2(v*k)).join(',');
    console.log(`${pad(N,8)} ${pad(R,7)} ${pad(spawn.toFixed(2),12)} ${pad(sky,13)} ${pad(nt,18)}  ${pad(tel,24)} ${pad(flightSlots(20),11)}`);
  }
  console.log('  radar range is NOT scaled: it is sized in warning MINUTES, not in galaxy share.');
}

function printProgression() {
  console.log('\n=== PROGRESSION VALIDATION ===');
  const reference = simulate('REFERENCE', ARCHETYPES.ACTIVE, null).track;   // pass 1: galaxy median
  const results = Object.entries(ARCHETYPES).map(([n, a]) => simulate(n, a, reference));
  for (const res of results) {
    const a = ARCHETYPES[res.name];
    console.log(`\n-- ${res.name} (${a.sessionsPerDay} sessions/day in a 16h window, ${a.raidsPerDay} raids/day, ${Math.round(a.militaryShare*100)}% to military) --`);
    console.log('  day  CORE  REFN  EXTR  VLT  YARD  TEL  tier bays   alloy/h  cryst/h    stored   fleet+def   satellites');
    for (const s of res.snaps)
      console.log(`  ${pad(s.day,3)}  ${pad(s.CORE,4)}  ${pad(s.REFINERY,4)}  ${pad(s.EXTRACTOR,4)}  ${pad(s.VAULT,3)}  ${pad(s.SHIPYARD,4)}  ${pad(s.TELESCOPE,3)}  ${pad(s.tier,4)} ${pad(s.bays,4)}  ${pad(fmt(s.alloyPerHour),8)} ${pad(fmt(s.crystalPerHour),8)} ${pad(fmt(s.storedValue),9)} ${pad(fmt(s.militaryValue),11)}   ${s.sats}`);
    const faucet = res.produced + res.raidTaken + res.debrisGained;
    const sink = res.econSpend + res.milSpend + res.raidLost + res.fleetLost;
    console.log(`      FAUCETS  production ${fmt(res.produced)} + loot ${fmt(res.raidTaken)} + debris ${fmt(res.debrisGained)} = ${fmt(faucet)}`);
    console.log(`      SINKS    buildings ${fmt(res.econSpend)} + hulls ${fmt(res.milSpend)} + looted ${fmt(res.raidLost)} + ships lost ${fmt(res.fleetLost)} = ${fmt(sink)}`);
    console.log(`      TAX ${res.TAX} · production wasted to a full works ${fmt(res.wasted)} (${(100*res.wasted/Math.max(1,res.produced)).toFixed(1)}%) · standing fleet at wipe ${fmt(res.snaps.at(-1).militaryValue)}`);
  }
  console.log('\n-- phase targets --');
  const targets = [
    { day:3,  label:'D0-3  early',  want:'Shipyard>=2 (Lance), mines>=7',    check:s => s.SHIPYARD>=2 && s.REFINERY>=7 },
    { day:7,  label:'D4-7  mid',    want:'Shipyard>=4 (Bulwark), mines>=11', check:s => s.SHIPYARD>=4 && s.REFINERY>=11 },
    { day:10, label:'D8-11 late',   want:'Core>=14, mines>=14',              check:s => s.CORE>=14 && s.REFINERY>=14 },
    { day:14, label:'D12-14 chaos', want:'mines>=17',                        check:s => s.REFINERY>=17 },
  ];
  console.log('  (graded on ACTIVE, the design-target archetype; HARDCORE is the ceiling, CASUAL has its own test below)');
  for (const t of targets) {
    const a = results.find(r => r.name === 'ACTIVE').snaps.find(x => x.day === t.day);
    const h = results.find(r => r.name === 'HARDCORE').snaps.find(x => x.day === t.day);
    console.log(`  ${t.label.padEnd(15)} ${t.want.padEnd(36)} ACTIVE ${t.check(a) ? 'PASS' : 'MISS'} (mines ${a.REFINERY}, yard ${a.SHIPYARD})   HARDCORE mines ${h.REFINERY}`);
  }
  const cas = results.find(r => r.name === 'CASUAL'), act = results.find(r => r.name === 'ACTIVE');
  const share = cas.snaps.at(-1).alloyPerHour / act.snaps.at(-1).alloyPerHour;
  console.log(`  ${'CASUAL floor'.padEnd(15)} ${'income >= 50% of ACTIVE at the wipe'.padEnd(36)} ${(100*share).toFixed(0)}% ${share >= 0.5 ? 'PASS' : 'MISS'}   net raid ledger ${cas.netRaid >= 0 ? '+' : ''}${fmt(cas.netRaid)} ${cas.netRaid >= 0 ? 'PASS' : 'MISS (being farmed)'}`);
  const at = (n, d) => results.find(r => r.name===n).snaps.find(s => s.day===d);
  console.log('\n  ARR — share of Wealth that is actually LOSABLE (stock + works + hulls, against buildings). Healthy band 0.30-0.55');
  for (const r of results) {
    const row = r.snaps.map(sn => `d${sn.day}:${sn.ARR}`).join('  ');
    const bad = r.snaps.filter(sn => sn.ARR < 0.30 || sn.ARR > 0.55).map(sn => sn.day);
    console.log(`    ${r.name.padEnd(9)} ${row}${bad.length ? `   OUT OF BAND on day(s) ${bad.join(',')}` : '   in band all season'}`);
  }
  console.log('\n  TAX — share of a player\'s own output taken by raiders (healthy band 0.10-0.45)');
  for (const r of results) console.log(`    ${r.name.padEnd(9)} ${r.TAX}  ${r.TAX < 0.10 ? '(LOW — raiding is not paying)' : r.TAX > 0.45 ? '(HIGH — being farmed)' : '(in band)'}`);
  const tiers = results.map(r => r.snaps.at(-1).tier);
  console.log(`  development tiers at day 14: HARDCORE T${tiers[0]} · ACTIVE T${tiers[1]} · CASUAL T${tiers[2]}  ->  HARDCORE may attack CASUAL: ${Math.abs(tiers[0]-tiers[2]) <= P.abuse.tierBand ? 'YES' : 'NO (outside the +/-2 tier band)'}`);
  console.log('\n  effort gradient (HARDCORE : ACTIVE : CASUAL)');
  for (const d of [3, 7, 14]) {
    const h = at('HARDCORE', d), a = at('ACTIVE', d), c = at('CASUAL', d);
    console.log(`    day ${pad(d,2)}  income/h ${pad(fmt(h.alloyPerHour),7)} : ${pad(fmt(a.alloyPerHour),7)} : ${pad(fmt(c.alloyPerHour),7)}  (${(h.alloyPerHour/c.alloyPerHour).toFixed(2)}x)   military ${pad(fmt(h.militaryValue),9)} : ${pad(fmt(a.militaryValue),9)} : ${pad(fmt(c.militaryValue),8)}  (${(h.militaryValue/Math.max(1,c.militaryValue)).toFixed(1)}x)`);
  }
}

/* ── JSON emitter ─────────────────────────────────────────────────────── */

function buildJson() {
  const buildings = {};
  for (const [id, max] of Object.entries(P.maxLevel)) {
    const rows = [];
    for (let L = 1; L <= max; L++) {
      const c = upgradeCost(L - 1);                 // cost to REACH level L
      const row = { level: L, costAlloy: c.alloy, costCrystal: c.crystal,
                    costTotal: total(c), buildSeconds: r2(buildMinutes(c, Math.max(1, L - 1)) * 60) };
      if (id === 'REFINERY') Object.assign(row, { alloyPerHour: r2(alloyRate(L)), storageCapAtVault0: storageCap(alloyRate(L), 0), storageCapAtVault8: storageCap(alloyRate(L), 8), storageCapAtVault16: storageCap(alloyRate(L), 16), worksCap: worksCap(alloyRate(L)), paybackHours: +paybackRefinery(L).toFixed(2) });
      if (id === 'EXTRACTOR') Object.assign(row, { crystalPerHour: r2(crystalRate(L)), storageCapAtVault0: storageCap(crystalRate(L), 0), storageCapAtVault8: storageCap(crystalRate(L), 8), storageCapAtVault16: storageCap(crystalRate(L), 16), worksCap: worksCap(crystalRate(L)), deuteriumStorageCapAtVault0: deutStorageCap(crystalRate(L), 0), deuteriumWorksCap: deutWorksCap(crystalRate(L)), paybackHours: +paybackExtractor(L).toFixed(2) });
      if (id === 'VAULT') Object.assign(row, { storageHours: storageHours(L), protectedHours: +protectedHours(L).toFixed(2), protectedShareOfStore: +(protectedHours(L)/storageHours(L)).toFixed(3), storageMultiplierVsVault0: +(storageHours(L)/P.capHours).toFixed(2), exampleProtectsAlloyAtRefinery12: vaultProtects(L, 12, 12).alloy, exampleProtectsCrystalAtExtractor12: vaultProtects(L, 12, 12).crystal });
      if (id === 'CORE') Object.assign(row, { satelliteSlots: satelliteSlots(L), flightBays: flightSlots(L), developmentTier: coreTier(L), constructionThroughputPerMinute: r2(conThroughput(L)) });
      if (id === 'SHIPYARD') Object.assign(row, { yardThroughputPerMinute: r2(yardThroughput(L)), defenceThroughputPerMinute: r2(defThroughput(L)), unlocks: Object.entries(HULLS).filter(([,h]) => h.minShipyard === L).map(([k]) => k) });
      rows.push(row);
    }
    buildings[id] = { maxLevel: max, cappedByCore: id !== 'CORE', levels: rows };
  }

  const instruments = {};
  for (const id of Object.keys(P.instrumentCostMult)) {
    instruments[id] = { maxLevel: 5, costMultiplier: P.instrumentCostMult[id],
      requiresSatellite: (id === 'TELESCOPE' || id === 'RADAR') ? 'UPLINK' : null,
      levels: Array.from({ length: 5 }, (_, i) => {
        const L = i + 1, c = instrumentCost(id, L - 1);
        const row = { level: L, costAlloy: c.alloy, costCrystal: c.crystal, costTotal: total(c), buildSeconds: r2(buildMinutes(c, Math.max(1, 2 * (L - 1))) * 60) };
        if (id === 'TELESCOPE') Object.assign(row, { range: P.intel.telescopeRange[L] === Infinity ? null : P.intel.telescopeRange[L], watchSlots: P.intel.telescopeSlots[L], repointCooldownHours: P.intel.telescopeCooldownHours[L] });
        if (id === 'RADAR') Object.assign(row, { detectionRadius: P.intel.radarRange[L] });
        if (id === 'AEGIS') Object.assign(row, { shieldHp: shieldHp(L), regenPerHour: P.shield.regenPerHour });
        if (id === 'VEIL') Object.assign(row, { clarityPenalty: L, accuracyPenalty: L });
        return row;
      }) };
  }

  const hulls = {};
  for (const [id, h] of Object.entries(HULLS)) {
    const V = h.alloy + h.crystal + h.deuterium;
    hulls[id] = { ...h, resourceValue: V,
      buildSecondsByShipyard: Object.fromEntries(
        Array.from({ length: P.maxLevel.SHIPYARD + 1 }, (_, y) => y)
          .filter(y => y >= h.minShipyard)
          .map(y => [y, r2((h.ground ? defenceMinutes(h, y) : shipMinutes(h, y)) * 60)])),
      travelMinutesOneWay: h.speed > 0 ? Object.fromEntries([260,510,755,1300,2275,4800].map(d => [d, +travelExact(d, h.speed).toFixed(2)])) : null };
  }

  return {
    $schema: 'astera-economy/v2',
    generatedAt: new Date().toISOString().slice(0, 10),
    note: 'From-scratch 14-day seasonal PvP economy. Replaces packages/rules/src/constants.ts. Every number here is derived; see docs/balance.md for the formula behind each one.',
    formulas: {
      production: 'rate(L) = base * L * growth^L   per hour',
      upgradeCost: 'cost(L->L+1) = { alloy: costBase * costMult^L, crystal: crystalCostBase * crystalCostMult^L }',
      crystalCostMult: 'DERIVED = costMult * (crystalMult / alloyMult) — holds the crystal cost share at 0.79 of the crystal income share at every level',
      storage: 'storageCap = capHours * rate ; worksCap = worksHours * rate',
      vault: 'protects(L) = vaultFlat + vaultCoef * L * vaultMult^L  (alloy); crystal = alloy * crystalBase/alloyBase',
      buildTime: 'minutes = min(cap, costTotal / throughput) — buildings: 200*(1+0.12*core); ships: 260*(1+0.35*yard); ground: 1000*(1+0.35*yard); research: x4',
      payback: 'paybackHours(L) = costTotal(L) / (rate(L+1) - rate(L))',
      sunset: 'building is rational while paybackHours < hoursRemaining * 0.4',
      travel: 'oneWayMinutes = baseMinutes + (distance / slowestHullSpeed) * distanceFactor',
      radarNotice: 'minutes = min(oneWay, oneWay * radarRange / distance)',
      loot: 'raidable = max(0, storage - vaultFloor) + works * lootBufferShare ; loot = min(raidable * gradeShare, surviving cargo)',
      debris: 'field = share * resourceValue of every destroyed NON-GROUND hull on both sides',
    },
    parameters: JSON.parse(JSON.stringify({
      ...P,
      crystalCostBase: P.crystalCostBase, crystalCostMult: P.crystalCostMult,
      intel: { ...P.intel, telescopeRange: P.intel.telescopeRange.map(v => v === Infinity ? null : v) },
    })),
    opening: OPENING,
    startBuildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
    buildings, instruments,
    satellites: Object.fromEntries(Object.entries(P.satellites).map(([id, s]) => [id, { ...s, resourceValue: s.alloy + s.crystal, buildSecondsAtCore: Object.fromEntries([1,3,5,9].map(c => [c, r2(buildMinutes(s, c) * 60)])) }])),
    hulls,
    research: Object.fromEntries(Object.entries(RESEARCH).map(([id, r]) => [id, { ...r, costTotal: total(r), researchSecondsAtCore6: r2(researchMinutes(r, 6) * 60) }])),
    strategicAssets: { DEATH_STAR, SETTLEMENT },
    queues: { construction: 1, shipyard: 1, note: 'Two independent queues. Cancelling refunds cancelRefund of what was committed, which is what prices "dump resources into a queue to dodge a raid".', cancelRefund: P.cancelRefund },
    scaling: Object.fromEntries([200,300,400,500].map(N => {
      const R = r2(P.galaxy.baselineRadius * Math.sqrt(N / P.galaxy.baselinePlayers));
      const k = R / P.galaxy.baselineRadius;
      return [N, {
        galaxyRadius: R,
        thickness: P.galaxy.thickness, minSeparation: P.galaxy.minSeparation,
        asteroidSpawnPerHour: +(N * P.galaxy.asteroidsPerHourPerPlayer).toFixed(3),
        expectedRocksInSky: r2(N * P.galaxy.asteroidsPerHourPerPlayer
          * (P.galaxy.asteroidLifeHoursMin + P.galaxy.asteroidLifeHoursMax) / 2),
        neutralCounts: Object.fromEntries([1,2,3].map(t => [t, Math.round(N * P.galaxy.neutralPerPlayer[t])])),
        telescopeRange: P.intel.telescopeRange.map(v => v === Infinity ? null : r2(v * k)),
        radarRange: P.intel.radarRange,
        asteroidOrbitMin: r2(R * P.galaxy.asteroidOrbitMinShare),
        asteroidOrbitMax: r2(R * P.galaxy.asteroidOrbitMaxShare),
        unchanged: 'every production, cost, hull, loot, combat and build-time number',
      }];
    })),
    invariants: [
      'vaultMult (1.08) < alloyMult (1.10) — else the vault eventually protects 100% of storage and PvP dies silently',
      'crystalCostMult is DERIVED from costMult * (crystalMult/alloyMult) — two hand-picked multipliers drift and invert which resource is scarce',
      'START is arithmetic: exactly Core+Refinery+Extractor 1->2 plus two Wasps',
      'worksHours (12) >= the 2-logins-per-day gap — this single number decides whether a casual player is excluded',
      'buildTime is priced in RESOURCES, so it moves automatically when any price moves',
      'one Thorn must build faster than a Radar L3 warning at median distance, or the radar stops selling the window to arm',
      'no building may exceed the Command Core',
      'ground hulls leave no debris — they already have 60% salvage',
      'debris is strictly downstream of combat; if raiding stops, debris stops',
    ],
  };
}

/* ── main ─────────────────────────────────────────────────────────────── */

printEconomyTable();
printSunset();
printHulls();
printTravel();
printScaling();
printProgression();

console.log('\n=== OPENING GRANT (derived) ===');
console.log('  START        ', JSON.stringify(OPENING.START));
console.log('  OPENING_BONUS', JSON.stringify(OPENING.OPENING_BONUS));
console.log('  PLANET_START ', JSON.stringify(OPENING.PLANET_START));
console.log(`  crystalCostBase = ${P.crystalCostBase.toFixed(3)}   crystalCostMult = ${P.crystalCostMult.toFixed(4)} (DERIVED)`);
console.log(`  crystal cost share / crystal income share = ${(P.crystalCostShare / (P.crystalBase/P.alloyBase)).toFixed(3)} at EVERY level`);

if (process.argv.includes('--json')) {
  const out = resolve(ROOT, 'docs/economy-v2.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(buildJson(), null, 2));
  console.log(`\nwrote ${out}`);
}
