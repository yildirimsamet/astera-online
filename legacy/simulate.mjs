#!/usr/bin/env node
/**
 * BLINDSPACE — headless season simulator.
 *
 * Runs a full season with bot archetypes executing the real formulas from
 * rules.mjs, and reports the six balance invariants from GDD §G.1 every day.
 *
 * The question it answers: do the numbers degenerate before day 14?
 *
 *   node simulate.mjs
 *   node simulate.mjs --players=200 --days=14 --seed=7
 *   node simulate.mjs --csv > season.csv
 *   node simulate.mjs --sweep=lumpiness    # vary one constant, compare outcomes
 */

import {
  ECON, COMBAT, HULLS, MOBILE_HULLS, ABUSE,
  alloyRate, crystalRate, upgradeCost, storageCap, vaultProtects, paybackHours,
  shieldHP, satSlots, travelMinutes, fleetSpeed, fleetCargo, fleetCount,
  fleetValue, fleetPower, resolveCombat, computeLoot, empireValue, investedInBuilding,
  canAttack, applyDisruption, productiveMinutes, dominion, bookBattle, mulberry32, median,
} from './rules.mjs';

/* ─────────────────────────── CLI ─────────────────────────── */

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const CFG = {
  players: +(argv.players ?? 120),
  days: +(argv.days ?? 14),
  seed: +(argv.seed ?? 42),
  csv: !!argv.csv,
  quiet: !!argv.quiet,
};

const C = CFG.csv ? new Proxy({}, { get: () => '' }) : {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', grey: '\x1b[90m', orange: '\x1b[38;5;208m',
};

/* ─────────────────────── ARCHETYPES ─────────────────────── */
/* Each is a spending policy plus a login cadence. Deliberately crude —
   the point is to bracket real behaviour, not to imitate it. */

const ARCHETYPES = {
  TURTLE: {
    defenceRatio: 2.2,
    share: 0.18, loginsPerDay: 4,
    buildOrder: ['REFINERY', 'EXTRACTOR', 'VAULT', 'CORE', 'RING'],
    sats: ['AEGIS', 'AEGIS', 'RADAR'],
    militaryShare: 0.35, groundShare: 0.90,   // spends military budget on turrets
    attackChance: 0.0, scouts: false,
  },
  RAIDER: {
    defenceRatio: 0.35,
    share: 0.22, loginsPerDay: 6,
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'EXTRACTOR', 'RING'],
    sats: ['RADAR', 'TELESCOPE', 'VEIL'],
    militaryShare: 0.65, groundShare: 0.10,
    attackChance: 0.55, scouts: false,
  },
  FARMER: {
    defenceRatio: 1.3,
    share: 0.24, loginsPerDay: 4,
    buildOrder: ['REFINERY', 'EXTRACTOR', 'VAULT', 'CORE', 'SHIPYARD'],
    sats: ['DRILL', 'AEGIS', 'RADAR'],
    militaryShare: 0.30, groundShare: 0.55,
    attackChance: 0.12, scouts: false,
  },
  CASUAL: {
    defenceRatio: 0.9,
    share: 0.24, loginsPerDay: 2,
    buildOrder: ['REFINERY', 'CORE', 'EXTRACTOR', 'SHIPYARD', 'VAULT'],
    sats: ['RADAR', 'AEGIS'],
    militaryShare: 0.40, groundShare: 0.45,
    attackChance: 0.20, scouts: false,
  },
  GRINDER: {
    defenceRatio: 0.45,
    share: 0.12, loginsPerDay: 10,
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'RING', 'EXTRACTOR'],
    sats: ['TELESCOPE', 'TELESCOPE', 'RADAR', 'VEIL'],
    militaryShare: 0.60, groundShare: 0.20,
    attackChance: 0.70, scouts: true,          // the informed player
  },
};

/* ───────────────────── WORLD SETUP ───────────────────── */

function buildGalaxy(rng) {
  const players = [];
  const names = [];
  for (const [type, def] of Object.entries(ARCHETYPES)) {
    const n = Math.max(1, Math.round(CFG.players * def.share));
    for (let i = 0; i < n; i++) names.push(type);
  }
  while (names.length < CFG.players) names.push('CASUAL');
  names.length = CFG.players;

  for (let i = 0; i < CFG.players; i++) {
    // Poisson-ish placement on a thin disc: rejection-sample against a min separation.
    let x, y, z, tries = 0;
    do {
      const r = Math.sqrt(rng()) * 1000;
      const th = rng() * Math.PI * 2;
      x = r * Math.cos(th); z = r * Math.sin(th); y = (rng() * 2 - 1) * 120;
      tries++;
    } while (tries < 30 && players.some((p) => dist({ x, y, z }, p) < 90));

    players.push({
      id: i, name: `P${String(i).padStart(3, '0')}`, type: names[i],
      x, y, z,
      buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, RING: 0 },
      satellites: {},
      fleet: { WASP: 12 },
      ground: {},
      alloy: 500, crystal: 120,
      lastTick: 0, joinedAt: 0, disruptedUntil: 0, disruptedMinutes: 0,
      nextLogin: Math.floor(rng() * 240),
      shield: 0, shieldTick: 0,
      // telemetry
      attacks: [], attacksToday: 0, scoutsSent: 0, scoutedThenAttacked: 0,
      lootToday: 0, lossToday: 0, disruptedToday: 0, evHistory: [], recentHits: {},
      ledger: { taken: 0, lost: 0 },
      knownStock: {},   // intel the bot has gathered: targetId -> {alloy, crystal, at}
      ev: 0,
    });
  }
  // Nearest 18 neighbours are this player's practical world for the season.
  for (const p of players) {
    p.neighbours = players
      .filter((q) => q.id !== p.id)
      .map((q) => ({ id: q.id, d: dist(p, q) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 18);
  }
  return players;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/* ───────────────────── ECONOMY ───────────────────── */

function sync(p, t) {
  if (t <= p.lastTick) return;
  const dt = productiveMinutes(p.lastTick, t, p.disruptedUntil || 0) / 60;
  const ra = alloyRate(p.buildings.REFINERY);
  const rc = crystalRate(p.buildings.EXTRACTOR);
  p.alloy = Math.min(p.alloy + ra * dt, storageCap(ra));
  p.crystal = Math.min(p.crystal + rc * dt, storageCap(rc));

  const wall = (t - p.lastTick) / 60;
  const maxShield = shieldHP(p.satellites.AEGIS || 0);
  if (maxShield > 0) p.shield = Math.min(maxShield, p.shield + maxShield * 0.05 * wall);
  p.lastTick = t;
}

const capsOf = (p) => ({
  alloy: storageCap(alloyRate(p.buildings.REFINERY)),
  crystal: storageCap(crystalRate(p.buildings.EXTRACTOR)),
});

function afford(p, cost) {
  return p.alloy >= cost.alloy && p.crystal >= cost.crystal;
}
function pay(p, cost) {
  p.alloy -= cost.alloy; p.crystal -= cost.crystal;
}

/* ───────────────────── BOT SESSION ───────────────────── */

function runSession(p, t, world, rng) {
  sync(p, t);
  const a = ARCHETYPES[p.type];

  // 0. Defence FIRST, sized as insurance on what you are holding.
  //    Buying it from leftovers means it never gets bought at all: buildings
  //    compound, so at the margin they always look like the better purchase.
  //    The first version of this bot did exactly that and produced 23 Bastions
  //    across 140 planets, which made 95% of all attacks DECISIVE and left the
  //    information layer with no uncertainty to resolve.
  {
    const raidable = Math.max(0, p.alloy - vaultProtects(p.buildings.VAULT));
    const target = raidable * a.defenceRatio;
    const held = fleetValue(p.ground);
    const B = HULLS.BASTION;
    if (held < target && p.buildings.SHIPYARD >= B.minShipyard) {
      const want = Math.floor((target - held) / (B.alloy + B.crystal));
      const n = Math.min(want, Math.floor(p.alloy * 0.5 / B.alloy), Math.floor(p.crystal / B.crystal));
      if (n > 0) {
        p.ground.BASTION = (p.ground.BASTION || 0) + n;
        p.alloy -= n * B.alloy; p.crystal -= n * B.crystal;
      }
    }
  }

  // 1. Buildings, in archetype priority order. CORE gates everything else.
  for (let pass = 0; pass < 3; pass++) {
    for (const key of a.buildOrder) {
      const lvl = p.buildings[key];
      if (key !== 'CORE' && lvl >= p.buildings.CORE) continue;
      const cost = upgradeCost(lvl);
      // Keep a working reserve so the bot isn't permanently broke.
      if (afford(p, cost) && p.alloy - cost.alloy > alloyRate(p.buildings.REFINERY) * 0.5) {
        pay(p, cost); p.buildings[key]++;
      }
    }
  }

  // 2. Satellites, up to the slot cap.
  const slots = satSlots(p.buildings.RING);
  const owned = Object.values(p.satellites).reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
  for (const s of a.sats) {
    const lvl = p.satellites[s] || 0;
    if (lvl === 0 && owned >= slots) continue;
    if (lvl >= p.buildings.CORE) continue;
    const cost = upgradeCost(lvl);
    if (afford(p, cost)) { pay(p, cost); p.satellites[s] = lvl + 1; break; }
  }

  // 3. Military. Ground turrets vs mobile hulls, per archetype.
  const budget = p.alloy * a.militaryShare;
  let spent = 0;
  const yard = p.buildings.SHIPYARD;
  // Mobile hulls: best available, with a Hauler tail for cargo.
  const ladder = ['BULWARK', 'LANCE', 'WASP'];
  for (const hull of ladder) {
    if (yard < HULLS[hull].minShipyard) continue;
    const room = budget - spent;
    if (room < HULLS[hull].alloy) continue;
    let n = Math.floor(room / HULLS[hull].alloy);
    if (HULLS[hull].crystal > 0) n = Math.min(n, Math.floor(p.crystal / HULLS[hull].crystal));
    n = Math.min(n, Math.floor(p.alloy / HULLS[hull].alloy));
    if (n > 0) {
      p.fleet[hull] = (p.fleet[hull] || 0) + n;
      p.alloy -= n * HULLS[hull].alloy; p.crystal -= n * HULLS[hull].crystal;
      spent += n * HULLS[hull].alloy;
    }
    break;
  }
  // Cargo, sized to what a neighbour is actually likely to be holding rather
  // than bought one at a time. A real player buys a batch; the first version of
  // this bot bought a single Hauler per session and arrived with no cargo.
  if (yard >= HULLS.HAULER.minShipyard && a.attackChance > 0) {
    const nb = p.neighbours[0] ? world[p.neighbours[0].id] : null;
    const caps = nb ? capsOf(nb) : { alloy: 5000, crystal: 1500 };
    const likelyLoot = (caps.alloy + caps.crystal) * 0.5 * 0.5;
    const want = Math.ceil(likelyLoot / HULLS.HAULER.cargo);
    const have = p.fleet.HAULER || 0;
    if (have < want) {
      let n = Math.min(want - have,
        Math.floor(p.alloy * 0.30 / HULLS.HAULER.alloy),
        Math.floor(p.crystal / Math.max(1, HULLS.HAULER.crystal)));
      if (n > 0) {
        p.fleet.HAULER = have + n;
        p.alloy -= n * HULLS.HAULER.alloy; p.crystal -= n * HULLS.HAULER.crystal;
      }
    }
  }

  // 4. Attack?
  if (rng() < a.attackChance) tryAttack(p, t, world, rng);

  const perDay = a.loginsPerDay;
  p.nextLogin = t + Math.max(20, Math.round((1440 / perDay) * (0.6 + rng() * 0.8)));
}

function tryAttack(p, t, world, rng) {
  const a = ARCHETYPES[p.type];
  const speed = fleetSpeed(p.fleet);
  if (speed <= 0 || fleetCount(p.fleet) < 8) return;
  p.ev = empireValue(p);

  let best = null;
  for (const nb of p.neighbours.slice(0, 10)) {
    const q = world[nb.id];
    if (q.awayUntil && q.awayUntil > t) { /* still a valid target */ }
    q.ev = q.ev || empireValue(q);

    const hits = (p.recentHits[q.id] || []).filter((x) => t - x < ABUSE.bashWindowMinutes).length;
    const gate = canAttack({ ev: p.ev }, { ev: q.ev, joinedAt: q.joinedAt, buildings: q.buildings }, t, hits);
    if (!gate.ok) continue;

    // What does this bot believe is in the vault, and how hard is the target?
    const intel = p.knownStock[q.id];
    const scouted = !!(a.scouts && intel && t - intel.at < 120);
    let believedStock, believedDefence;
    if (scouted) {
      believedStock = intel.alloy + intel.crystal;            // near-truth
      believedDefence = intel.defence;
    } else {
      const caps = capsOf(q);
      believedStock = (caps.alloy + caps.crystal) * 0.35;     // a guess
      believedDefence = null;                                 // no idea at all
    }
    const vault = vaultProtects(q.buildings.VAULT);
    const expectedLoot = Math.max(0, believedStock - vault * 2) * 0.5;
    const flight = travelMinutes(nb.d, speed);

    // Loot per minute of exposure, discounted by what the fight is expected to
    // cost. Blind attackers cannot make this discount — which is the whole point.
    const risk = believedDefence !== null ? 1 + believedDefence / Math.max(1, fleetValue(p.fleet)) : 1.6;
    const score = expectedLoot / ((flight + 10) * risk);
    if (!best || score > best.score) best = { q, d: nb.d, flight, score, scouted, believedDefence };
  }
  if (!best || best.score <= 0) return;

  // Informed bots probe first when they have no fresh intel.
  if (a.scouts && !best.scouted && rng() < 0.7) {
    p.scoutsSent++;
    sync(best.q, t);
    p.knownStock[best.q.id] = {
      alloy: best.q.alloy, crystal: best.q.crystal,
      defence: fleetValue({ ...best.q.fleet, ...best.q.ground }),
      at: t + 8,   // probe lands 8 minutes from now; intel is fresh from then
    };
    return; // spends the session on the probe; attacks next time
  }

  // Force sizing. A scouted attacker sends roughly what the job needs and keeps
  // the rest home; a blind attacker has to over-commit to be safe, which is
  // precisely the tax the information layer is supposed to charge.
  let commit;
  if (best.scouted && best.believedDefence !== null) {
    const mine = fleetValue(p.fleet);
    const need = (best.believedDefence * 1.8) / Math.max(1, mine);
    commit = Math.min(0.95, Math.max(0.25, need));
  } else {
    commit = 0.70 + rng() * 0.25;
  }
  // Escorts scale with the expected fight; cargo scales with the expected haul.
  // Scaling both together was wrong — a well-scouted attacker sent 25% of its
  // Haulers too and came home with nothing, which inverted the scouting edge.
  const send = {};
  for (const k of MOBILE_HULLS) {
    const have = p.fleet[k] || 0;
    if (have <= 0) continue;
    const n = k === 'HAULER' ? have : Math.floor(have * commit);
    if (n > 0) { send[k] = n; p.fleet[k] -= n; }
  }
  if (fleetCount(send) === 0) return;

  world.missions.push({
    from: p.id, to: best.q.id, fleet: send,
    arriveAt: t + best.flight, distance: best.d,
    scouted: best.scouted, returning: false,
  });
  p.attacksToday++;
  p.attacks.push(t);
  if (best.scouted) p.scoutedThenAttacked++;
  p.awayUntil = t + best.flight * 2;
}

/* ───────────────────── MISSION RESOLUTION ───────────────────── */

function resolveMission(m, t, world, rng, stats) {
  const atk = world[m.from];
  const def = world[m.to];

  if (m.returning) {
    for (const k in m.fleet) atk.fleet[k] = (atk.fleet[k] || 0) + m.fleet[k];
    sync(atk, t);
    const caps = capsOf(atk);
    atk.alloy = Math.min(caps.alloy, atk.alloy + (m.loot?.alloy || 0));
    atk.crystal = Math.min(caps.crystal, atk.crystal + (m.loot?.crystal || 0));
    return;
  }

  sync(def, t);
  const defenders = { ...def.fleet, ...def.ground };
  const result = resolveCombat(m.fleet, defenders, def.shield, rng);

  // Write survivors back to the defender.
  for (const k in def.fleet) def.fleet[k] = result.defenderSurvivors[k] || 0;
  for (const k in def.ground) def.ground[k] = (result.defenderSurvivors[k] || 0) + (result.defenceSalvage[k] || 0);
  def.shield = result.shieldLeft;

  const vault = vaultProtects(def.buildings.VAULT);
  const cargo = fleetCargo(result.attackerSurvivors);
  const loot = computeLoot({ alloy: def.alloy, crystal: def.crystal }, vault, result.grade, cargo);
  def.alloy -= loot.alloy; def.crystal -= loot.crystal;

  const wasUntil = def.disruptedUntil || 0;
  def.disruptedUntil = applyDisruption(wasUntil, t, result.grade);
  def.disruptedMinutes += Math.max(0, def.disruptedUntil - Math.max(wasUntil, t));
  def.disruptedToday += Math.max(0, def.disruptedUntil - Math.max(wasUntil, t));
  stats.disruptedMinutes += Math.max(0, def.disruptedUntil - Math.max(wasUntil, t));

  bookBattle(atk.ledger, def.ledger, loot.alloy + loot.crystal, result);
  stats.attacks++;
  stats.lootValue += loot.alloy + loot.crystal;
  stats.attackerLossValue += result.attackerLossValue;
  stats.defenderLossValue += result.defenderLossValue;
  stats.byGrade[result.grade]++;
  const gained = loot.alloy + loot.crystal + result.defenderLossValue;
  if (m.scouted) { stats.scoutedAttacks++; stats.scoutedLoot += gained; stats.scoutedLoss += result.attackerLossValue; }
  else { stats.blindAttacks++; stats.blindLoot += gained; stats.blindLoss += result.attackerLossValue; }

  atk.lootToday += loot.alloy + loot.crystal;
  atk.lossToday += result.attackerLossValue;
  def.lossToday += result.defenderLossValue + loot.alloy + loot.crystal;
  (atk.recentHits[def.id] ||= []).push(t);

  if (fleetCount(result.attackerSurvivors) > 0) {
    world.missions.push({
      from: m.from, to: m.to, fleet: result.attackerSurvivors,
      arriveAt: t + travelMinutes(m.distance, fleetSpeed(result.attackerSurvivors)),
      returning: true, loot,
    });
  }
}

/* ───────────────────── INVARIANTS ───────────────────── */

const BANDS = {
  ARR: [0.30, 0.55], VFR: [0.25, 0.65],
  TI: [-0.40, 0.55],   // passive share of an active player's ladder position (dominion)
  RR: [1.3, 2.5], SV: [0.10, 0.25], G: [1.5, 2.5],
  TAX: [0.15, 0.45],   // fraction of a peaceful player's daily output taken by raiders
};

function measure(world, day, dayStats) {
  const ps = world.filter((p) => p.id !== undefined);
  for (const p of ps) p.ev = empireValue(p);

  const evs = ps.map((p) => p.ev).sort((a, b) => b - a);

  const arr = median(ps.map((p) => {
    const risk = fleetValue(p.fleet) + p.alloy + p.crystal +
      Object.values(p.satellites).reduce((s, l) => s + investedInBuilding(l), 0);
    return p.ev > 0 ? risk / p.ev : 0;
  }));

  // VFR measures RAIDABLE fill, not raw fill. The first version measured
  // stock/cap and read a healthy 0.50 all season while the vault was in fact
  // protecting 100% of it — the diagnostic missed the bug it existed to catch.
  const vfr = median(ps.map((p) => {
    const c = capsOf(p);
    const vault = vaultProtects(p.buildings.VAULT);
    const raidable = Math.max(0, p.alloy - vault) + Math.max(0, p.crystal - vault);
    const raidableCap = Math.max(1, (c.alloy - vault) + (c.crystal - vault));
    return Math.max(0, raidable / raidableCap);
  }));

  const cutoff = day * 1440 - 2880;
  const passive = ps.filter((p) => p.attacks.filter((x) => x > cutoff).length === 0);
  const active = ps.filter((p) => p.attacks.filter((x) => x > cutoff).length >= 3);
  // TI is now measured on the LADDER (dominion), not on wealth. Wealth was never
  // the thing being competed over; measuring turtling against it asked the wrong
  // question. Expressed as passive share of the active player's ladder position.
  const activeDom = active.length ? median(active.map((p) => dominion(p.ledger))) : 0;
  const passiveDom = passive.length ? median(passive.map((p) => dominion(p.ledger))) : 0;
  const ti = activeDom > 0 ? passiveDom / activeDom : NaN;

  const rr = dayStats.attackerLossValue > 0
    ? (dayStats.lootValue + dayStats.defenderLossValue) / dayStats.attackerLossValue : NaN;

  const sv = median(ps.map((p) => {
    const prev = p.evHistory.at(-1);
    return prev && p.ev > 0 ? Math.abs(p.ev - prev) / p.ev : 0;
  }));

  const g = evs.length >= 20 ? evs[0] / median(evs.slice(0, 20)) : NaN;

  // Raid Tax: what fraction of a peaceful player's daily production is taken
  // from them by raiders. If builders out-earn raiders but pay no tax, the
  // galaxy is a farm rather than a war.
  // Mean, not median: on any given day most players are not raided at all, so
  // the median peaceful player always reads 0.00 and the diagnostic says nothing.
  const taxes = passive.map((p) => {
    const dayProd = (alloyRate(p.buildings.REFINERY) + crystalRate(p.buildings.EXTRACTOR)) * 24;
    const denied = (alloyRate(p.buildings.REFINERY) + crystalRate(p.buildings.EXTRACTOR)) * (p.disruptedToday / 60);
    return dayProd > 0 ? Math.min(2, (p.lossToday + denied) / dayProd) : 0;
  });
  const tax = taxes.length ? taxes.reduce((a, b) => a + b, 0) / taxes.length : NaN;

  for (const p of ps) p.evHistory.push(p.ev);
  return { day, ARR: arr, VFR: vfr, TI: ti, RR: rr, SV: sv, G: g, TAX: tax, evs, dayStats };
}

const verdict = (key, v) => {
  if (Number.isNaN(v)) return 'n/a';
  const [lo, hi] = BANDS[key];
  return v < lo ? 'LOW' : v > hi ? 'HIGH' : 'OK';
};
const colour = (key, v) => {
  const s = verdict(key, v);
  if (s === 'OK') return C.green;
  if (s === 'n/a') return C.grey;
  return C.red;
};

/* ───────────────────── MAIN ───────────────────── */

function runSeason() {
  const rng = mulberry32(CFG.seed);
  const world = buildGalaxy(rng);
  world.missions = [];
  const totalMinutes = CFG.days * 1440;
  const report = [];
  let dayStats = freshStats();

  for (let t = 0; t <= totalMinutes; t++) {
    // Missions due now
    for (let i = world.missions.length - 1; i >= 0; i--) {
      if (world.missions[i].arriveAt <= t) {
        const m = world.missions.splice(i, 1)[0];
        resolveMission(m, t, world, rng, dayStats);
      }
    }
    // Sessions due now
    for (const p of world) {
      if (p.nextLogin <= t) runSession(p, t, world, rng);
    }
    // Day boundary
    if (t > 0 && t % 1440 === 0) {
      for (const p of world) sync(p, t);
      report.push(measure(world, t / 1440, dayStats));
      for (const p of world) { p.attacksToday = 0; p.lootToday = 0; p.lossToday = 0; p.disruptedToday = 0; }
      dayStats = freshStats();
    }
  }
  return { world, report };
}

const freshStats = () => ({
  attacks: 0, lootValue: 0, attackerLossValue: 0,
  byGrade: { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 },
  defenderLossValue: 0, disruptedMinutes: 0,
  scoutedAttacks: 0, scoutedLoot: 0, scoutedLoss: 0,
  blindAttacks: 0, blindLoot: 0, blindLoss: 0,
});

/* ───────────────────── OUTPUT ───────────────────── */

const f = (v, d = 2) => (Number.isNaN(v) ? '  n/a' : v.toFixed(d).padStart(5));
const pad = (s, n) => String(s).padEnd(n);

function printReport({ world, report }) {
  if (CFG.csv) {
    console.log('day,ARR,VFR,TI,RR,SV,G,attacks,loot,losses,decisive,partial,repelled');
    for (const r of report) {
      console.log([r.day, r.ARR, r.VFR, r.TI, r.RR, r.SV, r.G,
        r.dayStats.attacks, Math.round(r.dayStats.lootValue), Math.round(r.dayStats.attackerLossValue),
        r.dayStats.byGrade.DECISIVE, r.dayStats.byGrade.PARTIAL, r.dayStats.byGrade.REPELLED,
      ].map((x) => (typeof x === 'number' && !Number.isInteger(x) ? x.toFixed(4) : x)).join(','));
    }
    return;
  }

  console.log(`\n${C.bold}${C.orange}BLINDSPACE${C.reset} ${C.dim}season simulation${C.reset}`);
  console.log(`${C.grey}${CFG.players} players · ${CFG.days} days · seed ${CFG.seed}${C.reset}\n`);

  console.log(`${C.bold}${pad('DAY', 5)}${['ARR', 'VFR', 'TI', 'RR', 'SV', 'G', 'TAX'].map((k) => pad(k, 8)).join('')}${pad('ATK', 6)}${pad('LOOT', 10)}${pad('D/P/R', 12)}${C.reset}`);
  console.log(C.grey + '─'.repeat(92) + C.reset);
  for (const r of report) {
    const cells = ['ARR', 'VFR', 'TI', 'RR', 'SV', 'G', 'TAX']
      .map((k) => `${colour(k, r[k])}${f(r[k])}${C.reset}   `).join('');
    const g = r.dayStats.byGrade;
    console.log(
      pad(r.day, 5) + cells +
      pad(r.dayStats.attacks, 6) +
      pad(Math.round(r.dayStats.lootValue).toLocaleString('en-US'), 10) +
      C.grey + pad(`${g.DECISIVE}/${g.PARTIAL}/${g.REPELLED}`, 12) + C.reset
    );
  }

  console.log(`\n${C.grey}bands  ${Object.entries(BANDS)
    .map(([k, [lo, hi]]) => `${k} ${lo}–${hi}`).join(' · ')}${C.reset}`);

  // ── Verdict ──
  const mid = report.slice(2);   // ignore the first two days, everyone is identical
  const fails = [];
  for (const k of Object.keys(BANDS)) {
    const vals = mid.map((r) => r[k]).filter((v) => !Number.isNaN(v));
    if (!vals.length) continue;
    const m = median(vals);
    const v = verdict(k, m);
    if (v !== 'OK') fails.push({ k, m, v });
  }

  console.log(`\n${C.bold}VERDICT${C.reset}`);
  if (!fails.length) {
    console.log(`${C.green}  ✓ All six invariants held their bands from day 3 onward.${C.reset}`);
    console.log(`${C.grey}    The economy does not degenerate. Proceed to the text prototype.${C.reset}`);
  } else {
    for (const { k, m, v } of fails) {
      console.log(`${C.red}  ✗ ${k} median ${m.toFixed(2)} is ${v}${C.reset}  ${C.grey}${LEVERS[k]}${C.reset}`);
    }
  }

  // ── Archetype outcomes ──
  console.log(`\n${C.bold}ARCHETYPE OUTCOMES${C.reset} ${C.dim}(median Empire Value at season end)${C.reset}`);
  const byType = {};
  for (const p of world) (byType[p.type] ||= []).push(p);
  const ranked = Object.entries(byType)
    .map(([t, ps]) => ({ t, n: ps.length, ev: median(ps.map((p) => p.ev)), dom: median(ps.map((p) => dominion(p.ledger))), atk: median(ps.map((p) => p.attacks.length)) }))
    .sort((a, b) => b.ev - a.ev);
  const top = ranked[0].ev;
  for (const r of ranked) {
    const bar = '█'.repeat(Math.max(1, Math.round((r.ev / top) * 26)));
    console.log(`  ${pad(r.t, 9)}${C.grey}n=${pad(r.n, 5)}${C.reset}${C.cyan}${pad(bar, 28)}${C.reset}${Math.round(r.ev).toLocaleString('en-US').padStart(10)}  ${C.grey}dominion ${Math.round(r.dom).toLocaleString('en-US').padStart(8)}${C.reset}`);
  }

  // ── The question the whole project turns on ──
  const sc  = report.reduce((s, r) => s + r.dayStats.scoutedAttacks, 0);
  const bl  = report.reduce((s, r) => s + r.dayStats.blindAttacks, 0);
  const scL = report.reduce((s, r) => s + r.dayStats.scoutedLoot, 0);
  const blL = report.reduce((s, r) => s + r.dayStats.blindLoot, 0);
  const scX = report.reduce((s, r) => s + r.dayStats.scoutedLoss, 0);
  const blX = report.reduce((s, r) => s + r.dayStats.blindLoss, 0);
  console.log(`\n${C.bold}DOES INTEL PAY?${C.reset} ${C.dim}(dominion per raid — the design's central claim)${C.reset}`);
  const scNet = sc ? (scL - scX) / sc : 0, blNet = bl ? (blL - blX) / bl : 0;
  const row = (label, n, loot, loss, net) =>
    console.log(`  ${pad(label, 10)}${String(n).padStart(5)} raids   taken ${Math.round(loot).toLocaleString('en-US').padStart(7)}   lost ${Math.round(loss).toLocaleString('en-US').padStart(7)}   ${C.bold}dominion ${Math.round(net).toLocaleString('en-US').padStart(7)}${C.reset}`);
  row('scouted', sc, sc ? scL / sc : 0, sc ? scX / sc : 0, scNet);
  row('blind',   bl, bl ? blL / bl : 0, bl ? blX / bl : 0, blNet);
  if (blNet !== 0) {
    const edge = scNet / Math.abs(blNet);
    const good = scNet > 0 && blNet <= 0 ? Infinity : edge;
    const col = good >= 1.35 ? C.green : good >= 1.1 ? C.yellow : C.red;
    const verdictTxt = blNet <= 0 && scNet > 0
      ? 'blind raiding LOSES money; scouted raiding profits. Exactly the intended shape.'
      : good >= 1.35 ? 'information is clearly worth paying for'
      : good >= 1.1 ? 'marginal — consider cheapening the probe'
      : 'INTEL IS NOT PAYING. Core loop is broken.';
    console.log(`  ${col}net edge: ${good === Infinity ? '∞' : good.toFixed(2) + '×'}${C.reset}  ${C.grey}${verdictTxt}${C.reset}`);
  }

  // ── Exchange ratio: value destroyed vs value spent destroying it ──
  const dLoss = report.reduce((s, r) => s + r.dayStats.defenderLossValue, 0);
  const aLoss = report.reduce((s, r) => s + r.dayStats.attackerLossValue, 0);
  const allLoot = report.reduce((s, r) => s + r.dayStats.lootValue, 0);
  console.log(`\n${C.bold}THE EXCHANGE${C.reset} ${C.dim}(what raiding actually accomplishes)${C.reset}`);
  console.log(`  ${pad('value looted', 24)}${Math.round(allLoot).toLocaleString('en-US').padStart(12)}`);
  console.log(`  ${pad('value DESTROYED on defence', 24)}${Math.round(dLoss).toLocaleString('en-US').padStart(12)}`);
  console.log(`  ${pad('attackers own losses', 24)}${Math.round(aLoss).toLocaleString('en-US').padStart(12)}`);
  console.log(`  ${C.bold}exchange ratio ${(dLoss / Math.max(1, aLoss)).toFixed(2)}×${C.reset}  ${C.grey}destroyed per unit spent${C.reset}`);
  console.log(`  ${C.grey}denial : theft  =  ${(dLoss / Math.max(1, allLoot)).toFixed(1)} : 1${C.reset}`);

  // ── Is anyone actually defended? ──
  const groundUnits = world.reduce((n, p) => n + fleetCount(p.ground), 0);
  const withGround = world.filter((p) => fleetCount(p.ground) > 0).length;
  const medCrystal = median(world.map((p) => p.crystal));
  const medExtractor = median(world.map((p) => p.buildings.EXTRACTOR));
  console.log(`\n${C.bold}DEFENCE CHECK${C.reset}`);
  console.log(`  ${pad('planets with any ground defence', 34)}${String(withGround).padStart(5)} / ${world.length}`);
  console.log(`  ${pad('total Bastions in the galaxy', 34)}${String(groundUnits).padStart(5)}`);
  console.log(`  ${pad('median crystal held', 34)}${String(Math.round(medCrystal)).padStart(5)}   ${C.grey}(a Bastion costs ${HULLS.BASTION.crystal})${C.reset}`);
  console.log(`  ${pad('median Extractor level', 34)}${String(medExtractor).padStart(5)}`);

  // ── The ladder ──
  // "Aggressive archetypes in the top 15" was the wrong health metric once blind
  // raiding started losing money: reckless attackers SHOULD fall down the ladder.
  // What matters is whether the INFORMED player wins.
  console.log(`\n${C.bold}THE LADDER${C.reset} ${C.dim}(Dominion — taken minus lost)${C.reset}`);
  const ladder = [...world].sort((a, b) => dominion(b.ledger) - dominion(a.ledger));
  const rankOf = {};
  ladder.forEach((p, i) => { (rankOf[p.type] ||= []).push(i + 1); });
  const rows = Object.entries(rankOf)
    .map(([t, rs]) => ({ t, med: median(rs), best: rs[0], dom: median(world.filter(p => p.type === t).map(p => dominion(p.ledger))) }))
    .sort((a, b) => a.med - b.med);
  for (const r of rows) {
    const mark = r.t === 'GRINDER' ? C.green + ' ← informed' + C.reset : '';
    console.log(`  ${pad(r.t, 9)}${C.grey}median rank${C.reset}${String(Math.round(r.med)).padStart(5)}   ${C.grey}best${C.reset}${String(r.best).padStart(4)}   ${C.grey}median dominion${C.reset}${String(Math.round(r.dom).toLocaleString('en-US')).padStart(9)}${mark}`);
  }
  const grinderRank = rows.findIndex((r) => r.t === 'GRINDER');
  const col = grinderRank === 0 ? C.green : grinderRank === 1 ? C.yellow : C.red;
  console.log(`  ${col}${grinderRank === 0 ? '✓ the informed archetype tops the ladder'
    : grinderRank === 1 ? '~ informed play is second — acceptable'
    : '✗ information does not win. Core loop is broken.'}${C.reset}`);

  // ── Curve sanity ──
  console.log(`\n${C.bold}CURVE CHECK${C.reset} ${C.dim}(payback hours by level — the brake)${C.reset}`);
  console.log('  ' + [1, 5, 10, 13, 15].map((L) => `L${L}: ${paybackHours(L).toFixed(1)}h`).join('   '));
  const topEV = Math.max(...world.map((p) => p.ev));
  const topCore = Math.max(...world.map((p) => p.buildings.CORE));
  console.log(`  ${C.grey}peak Command Core reached: L${topCore} · top Empire Value ${Math.round(topEV).toLocaleString('en-US')}${C.reset}`);
  if (topCore < 10) console.log(`  ${C.yellow}⚠ Core ceiling under L10 — season may be too short or costs too steep.${C.reset}`);
  if (topCore > 18) console.log(`  ${C.yellow}⚠ Core ceiling over L18 — growth is running away.${C.reset}`);
  console.log('');
}

const LEVERS = {
  TAX: '→ lever: loot %, attack frequency. LOW means builders are farming in peace.',
  ARR: '→ lever: building cost vs ship cost balance',
  VFR: '→ lever: upgrade lumpiness (ECON.costMult / capHours). LOW means nothing is worth raiding.',
  TI:  '→ lever: loot grade multipliers, Bastion cost-efficiency',
  RR:  '→ lever: COMBAT.lootDecisive/lootPartial, defenceSalvage, hull HP',
  SV:  '→ lever: loot %, travel times',
  G:   '→ lever: ECON.costMult drift, ABUSE.rankFloor',
};

/* ───────────────────── SWEEP MODE ───────────────────── */

function sweep(param) {
  const targets = {
    lumpiness: { obj: ECON, key: 'costMult', values: [1.45, 1.50, 1.55, 1.60, 1.65] },
    cap:       { obj: ECON, key: 'capHours', values: [6, 9, 12, 16, 24] },
    loot:      { obj: COMBAT, key: 'lootDecisive', values: [0.4, 0.5, 0.6, 0.75, 0.9] },
    vault:     { obj: ECON,   key: 'vaultMult',    values: [1.10, 1.18, 1.24, 1.30, 1.36] },
  }[param];
  if (!targets) { console.error(`Unknown sweep "${param}". Try: lumpiness | cap | loot`); process.exit(1); }

  console.log(`\n${C.bold}SWEEP${C.reset} ${C.dim}${param}${C.reset}\n`);
  console.log(`${C.bold}${pad('value', 9)}${['ARR', 'VFR', 'TI', 'RR', 'SV', 'G', 'TAX'].map((k) => pad(k, 8)).join('')}${C.reset}`);
  console.log(C.grey + '─'.repeat(66) + C.reset);
  const original = targets.obj ? targets.obj[targets.key] : null;
  for (const v of targets.values) {
    if (targets.obj) targets.obj[targets.key] = v;
    const { report } = runSeason();
    const mid = report.slice(2);
    const row = ['ARR', 'VFR', 'TI', 'RR', 'SV', 'G', 'TAX'].map((k) => {
      const m = median(mid.map((r) => r[k]).filter((x) => !Number.isNaN(x)));
      return `${colour(k, m)}${f(m)}${C.reset}   `;
    }).join('');
    console.log(pad(v, 9) + row);
  }
  if (targets.obj) targets.obj[targets.key] = original;
  console.log('');
}

/* ───────────────────── ENTRY ───────────────────── */

if (argv.sweep) sweep(String(argv.sweep));
else printReport(runSeason());
