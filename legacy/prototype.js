/**
 * BLINDSPACE — text prototype.
 *
 * Answers exactly one question: does the choice between striking blind and
 * spending eight minutes to know feel like a real decision?
 *
 * Real wall clock. Close the tab, come back in three hours, and three hours of
 * galaxy will have happened without you. No map, no 3D, no styling to speak of.
 */

import {
  HULLS, MOBILE_HULLS,
  alloyRate, crystalRate, upgradeCost, storageCap, vaultProtects,
  travelMinutes, fleetSpeed, fleetCargo, fleetCount, fleetValue, fleetPower,
  resolveCombat, computeLoot, empireValue, dominion, bookBattle,
  applyDisruption, productiveMinutes, DISRUPTION,
  clarity, clarityState, telescopeReading, detectChance, probeAccuracy, fuzzBand,
} from './rules.mjs';

const SAVE = 'blindspace.proto.v2';
const MAX_CATCHUP_MIN = 7 * 24 * 60;
const GRACE_MIN = 240;        // newcomer immunity — 4h, or until Command Core L4

/* ─────────────────── WORLD ─────────────────── */

/** Seven neighbours, each built to make a different decision interesting. */
const BOTS = [
  { name: 'GRIMHOLD', d: 180, veil: 0, radar: 2, aggression: 0.04, greed: 0.5, watchesYou: true,
    note: 'strikes when your fleet is out' },
  { name: 'MARROW',   d: 155, veil: 3, radar: 1, aggression: 0.02, greed: 0.7,
    note: 'invisible until your telescope outgrows their veil' },
  { name: 'VOSK',     d: 240, veil: 2, radar: 3, aggression: 0.005, greed: 1.4, turtle: true,
    note: 'looks rich because it is; also heavily defended' },
  { name: 'KETH',     d: 310, veil: 0, radar: 0, aggression: 0.010, greed: 1.3, soft: true,
    note: 'fat and lightly defended — if the timing is right' },
  { name: 'SILT',     d: 420, veil: 1, radar: 1, aggression: 0.015, greed: 0.6,
    note: 'poor, far, rarely worth the flight' },
  { name: 'ODEN',     d: 520, veil: 1, radar: 2, aggression: 0.012, greed: 1.5,
    note: 'wealthy, but a long way out' },
  { name: 'THRACE',   d: 610, veil: 0, radar: 1, aggression: 0.030, greed: 0.9, hunter: true,
    note: 'keeps a large fleet' },
];

function freshState() {
  return {
    startedAt: Date.now(),
    t: 0,
    seen: 0,
    player: {
      buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, RING: 0 },
      telescope: 0,
      fleet: { WASP: 12 }, ground: {},
      alloy: 500, crystal: 120,
      awayUntil: 0, disruptedUntil: 0,
      ledger: { taken: 0, lost: 0 },
    },
    bots: BOTS.map((b, i) => ({
      id: i, name: b.name, d: b.d, veil: b.veil, radar: b.radar,
      aggression: b.aggression, greed: b.greed, note: b.note,
      watchesYou: !!b.watchesYou, turtle: !!b.turtle, soft: !!b.soft, hunter: !!b.hunter,
      core: 2, refinery: b.soft ? 3 : 2, vault: b.turtle ? 2 : 1, shipyard: 1,
      fleet: { WASP: b.hunter ? 18 : b.soft ? 5 : 7 }, ground: b.turtle ? { BASTION: 2 } : {},
      alloy: 800 * b.greed, crystal: 200,
      awayUntil: 0, disruptedUntil: 0, nextAct: 20 + i * 7, suspicion: 0,
      ledger: { taken: 0, lost: 0 },
    })),
    missions: [],
    watching: null,
    teleLast: {},          // botId -> {status, at}
    probes: {},            // botId -> last report
    radarLog: [],
    events: [],
    unlocked: { telescope: false, probe: true },
    tm: { sessions: 0, attacks: 0, attacksAfterScout: 0, probes: 0, probesDetected: 0,
          upgrades: 0, lootTotal: 0, lostTotal: 0, firstPlay: Date.now() },
  };
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupt save — start over */ }
  return freshState();
}
const save = () => localStorage.setItem(SAVE, JSON.stringify(S));

/* ─────────────────── TIME ─────────────────── */

const nowMinutes = () => Math.floor((Date.now() - S.startedAt) / 60000);

function log(text, cls = '') {
  S.events.unshift({ t: S.t, text, cls, unseen: true });
  if (S.events.length > 120) S.events.length = 120;
}

/* ─────────────────── ECONOMY ─────────────────── */

const pCaps = () => ({
  alloy: storageCap(alloyRate(S.player.buildings.REFINERY)),
  crystal: storageCap(crystalRate(S.player.buildings.EXTRACTOR)),
});

function tickPlayer() {
  const p = S.player, c = pCaps();
  if (productiveMinutes(S.t - 1, S.t, p.disruptedUntil || 0) === 0) return;
  p.alloy = Math.min(c.alloy, p.alloy + alloyRate(p.buildings.REFINERY) / 60);
  p.crystal = Math.min(c.crystal, p.crystal + crystalRate(p.buildings.EXTRACTOR) / 60);
}

function tickBot(b) {
  if (productiveMinutes(S.t - 1, S.t, b.disruptedUntil || 0) === 0) return;
  const capA = storageCap(alloyRate(b.refinery));
  b.alloy = Math.min(capA * b.greed, b.alloy + (alloyRate(b.refinery) * b.greed) / 60);
  b.crystal = Math.min(capA * 0.3, b.crystal + crystalRate(b.refinery) / 60);
}

/* ─────────────────── BOT BEHAVIOUR ─────────────────── */

function botAct(b) {
  // Build
  const cost = upgradeCost(b.refinery);
  if (b.alloy > cost.alloy * 1.6 && b.refinery < b.core + 2) {
    b.alloy -= cost.alloy; b.refinery++;
    if (b.refinery > b.core) b.core = b.refinery;
  }
  const defTarget = Math.max(0, b.alloy - vaultProtects(b.vault)) * (b.turtle ? 2.2 : b.soft ? 0.5 : 1.1);
  if (fleetValue(b.ground) < defTarget && b.alloy > HULLS.BASTION.alloy && b.crystal > HULLS.BASTION.crystal) {
    b.ground.BASTION = (b.ground.BASTION || 0) + 1;
    b.alloy -= HULLS.BASTION.alloy; b.crystal -= HULLS.BASTION.crystal;
  }
  if (b.turtle && b.alloy > HULLS.BASTION.alloy * 1.5) {
    b.ground.BASTION = (b.ground.BASTION || 0) + 1;
    b.alloy -= HULLS.BASTION.alloy;
  } else if (b.alloy > HULLS.WASP.alloy * 6) {
    const n = Math.floor((b.alloy * 0.35) / HULLS.WASP.alloy);
    b.fleet.WASP = (b.fleet.WASP || 0) + n;
    b.alloy -= n * HULLS.WASP.alloy;
  }
  if (b.hunter && b.alloy > HULLS.LANCE.alloy && b.crystal > HULLS.LANCE.crystal) {
    b.fleet.LANCE = (b.fleet.LANCE || 0) + 1;
    b.alloy -= HULLS.LANCE.alloy; b.crystal -= HULLS.LANCE.crystal;
  }

  // Raid somewhere else — this is what gives your telescope something to read.
  const playerAway = S.player.awayUntil > S.t;
  const protectedStill = S.t < GRACE_MIN && S.player.buildings.CORE < 4;
  const wantsYou = protectedStill ? 0
    : b.watchesYou && playerAway ? 0.50
    : b.aggression + b.suspicion;

  if (Math.random() < wantsYou && fleetCount(b.fleet) > 6 && b.awayUntil <= S.t) {
    launchBotAttack(b);
  } else if (Math.random() < 0.06 && b.awayUntil <= S.t && fleetCount(b.fleet) > 4) {
    // Off raiding a third party. Fleet leaves orbit and is visibly gone.
    b.awayUntil = S.t + 18 + Math.floor(Math.random() * 40);
    b.alloy += 400 + Math.random() * 900;
  }
  b.suspicion = Math.max(0, b.suspicion - 0.02);
  b.nextAct = S.t + 12 + Math.floor(Math.random() * 26);
}

function launchBotAttack(b) {
  const send = {};
  for (const k of MOBILE_HULLS) {
    const n = Math.floor((b.fleet[k] || 0) * 0.8);
    if (n > 0) { send[k] = n; b.fleet[k] -= n; }
  }
  if (fleetCount(send) === 0) return;
  const flight = travelMinutes(b.d, fleetSpeed(send));
  b.awayUntil = S.t + flight * 2;
  S.missions.push({ kind: 'raid-player', bot: b.id, fleet: send, arriveAt: S.t + flight, flight });
}

/* ─────────────────── MISSION RESOLUTION ─────────────────── */

function resolve(m) {
  const p = S.player;

  if (m.kind === 'raid-player') {
    const b = S.bots[m.bot];
    const defenders = { ...p.fleet, ...p.ground };
    const r = resolveCombat(m.fleet, defenders, 0);
    for (const k in p.fleet) p.fleet[k] = r.defenderSurvivors[k] || 0;
    for (const k in p.ground) p.ground[k] = (r.defenderSurvivors[k] || 0) + (r.defenceSalvage[k] || 0);

    const vault = vaultProtects(p.buildings.VAULT);
    const loot = computeLoot({ alloy: p.alloy, crystal: p.crystal }, vault, r.grade, fleetCargo(r.attackerSurvivors));
    p.alloy -= loot.alloy; p.crystal -= loot.crystal;
    for (const k in r.attackerSurvivors) b.fleet[k] = (b.fleet[k] || 0) + r.attackerSurvivors[k];
    b.alloy += loot.alloy;

    bookBattle(b.ledger, p.ledger, loot.alloy + loot.crystal, r);
    p.disruptedUntil = applyDisruption(p.disruptedUntil || 0, S.t, r.grade);
    S.tm.lostTotal += loot.alloy + loot.crystal + r.defenderLossValue;
    const lost = fleetCount(r.defenderLosses);
    if (r.grade === 'REPELLED') {
      log(`<b>${b.name}</b> attacked you and was <span class="win">REPELLED</span>. You lost ${lost} units.`, 'win');
    } else {
      const mins = Math.max(0, p.disruptedUntil - S.t);
      log(`<b>${b.name}</b> raided you. <span class="lose">−${Math.round(loot.alloy).toLocaleString()} alloy</span>, ${lost} units lost. Surface works disrupted for ${mins} min.`, 'lose');
    }
    return;
  }

  if (m.kind === 'probe') {
    const b = S.bots[m.bot];
    const acc = probeAccuracy(S.player.buildings.SHIPYARD + 1, b.veil);
    const defence = fleetPower({ ...(b.awayUntil > S.t ? {} : b.fleet), ...b.ground });
    S.probes[b.id] = {
      at: S.t,
      accuracy: acc,
      alloy: fuzzBand(b.alloy, acc),
      defence: fuzzBand(defence * 1000, acc),
      fleetHome: b.awayUntil <= S.t,
    };
    if (Math.random() < detectChance(b.radar, S.player.buildings.SHIPYARD)) {
      b.suspicion = Math.min(0.10, b.suspicion + 0.04);
      S.tm.probesDetected++;
      log(`Probe reached <b>${b.name}</b> — and tripped their radar.`, 'info');
    } else {
      log(`Probe reached <b>${b.name}</b>. Report filed.`, 'info');
    }
    return;
  }

  if (m.kind === 'attack') {
    const b = S.bots[m.bot];
    const homeFleet = b.awayUntil > S.t ? {} : b.fleet;
    const defenders = { ...homeFleet, ...b.ground };
    const r = resolveCombat(m.fleet, defenders, 0);

    for (const k in b.fleet) if (b.awayUntil <= S.t) b.fleet[k] = r.defenderSurvivors[k] || 0;
    for (const k in b.ground) b.ground[k] = (r.defenderSurvivors[k] || 0) + (r.defenceSalvage[k] || 0);

    const vault = vaultProtects(b.vault);
    const loot = computeLoot({ alloy: b.alloy, crystal: b.crystal }, vault, r.grade, fleetCargo(r.attackerSurvivors));
    b.alloy -= loot.alloy; b.crystal -= loot.crystal;
    b.suspicion = Math.min(0.15, b.suspicion + 0.06);
    bookBattle(p.ledger, b.ledger, loot.alloy + loot.crystal, r);
    b.disruptedUntil = applyDisruption(b.disruptedUntil || 0, S.t, r.grade);

    const lost = fleetCount(r.attackerLosses);
    const cls = r.grade === 'REPELLED' ? 'lose' : 'win';
    log(`<span class="${cls}">${r.grade}</span> at <b>${b.name}</b> — +${Math.round(loot.alloy).toLocaleString()} alloy, ${lost} ships lost.`, cls);
    S.tm.lootTotal += loot.alloy + loot.crystal;

    if (fleetCount(r.attackerSurvivors) > 0) {
      S.missions.push({
        kind: 'return', bot: m.bot, fleet: r.attackerSurvivors, loot,
        arriveAt: S.t + travelMinutes(b.d, fleetSpeed(r.attackerSurvivors)),
      });
    } else {
      log(`Your entire fleet was destroyed at <b>${b.name}</b>.`, 'lose');
      S.player.awayUntil = 0;
      unlockTelescope();
    }
    return;
  }

  if (m.kind === 'return') {
    for (const k in m.fleet) p.fleet[k] = (p.fleet[k] || 0) + m.fleet[k];
    const c = pCaps();
    p.alloy = Math.min(c.alloy, p.alloy + m.loot.alloy);
    p.crystal = Math.min(c.crystal, p.crystal + m.loot.crystal);
    p.awayUntil = 0;
    log(`Fleet returned — ${fleetCount(m.fleet)} ships, +${Math.round(m.loot.alloy).toLocaleString()} alloy.`, 'info');
    unlockTelescope();
  }
}

function unlockTelescope() {
  if (S.unlocked.telescope) return;
  S.unlocked.telescope = true;
  S.player.telescope = 1;
  log(`<span class="info">★ TELESCOPE UNLOCKED</span> — you may watch one planet.`, 'info');
}

/* ─────────────────── CLOCK ─────────────────── */

function step() {
  S.t++;
  for (let i = S.missions.length - 1; i >= 0; i--) {
    if (S.missions[i].arriveAt <= S.t) resolve(S.missions.splice(i, 1)[0]);
  }
  for (const b of S.bots) {
    tickBot(b);
    if (S.t >= b.nextAct) botAct(b);
  }
  tickPlayer();
}

function catchUp() {
  const target = Math.min(nowMinutes(), S.t + MAX_CATCHUP_MIN);
  const before = { alloy: S.player.alloy, ev: empireValue(playerForScore()) };
  const from = S.t;
  while (S.t < target) step();
  return { minutes: S.t - from, before };
}

const playerForScore = () => ({
  buildings: S.player.buildings, satellites: { TELESCOPE: S.player.telescope },
  fleet: S.player.fleet, ground: S.player.ground,
  alloy: S.player.alloy, crystal: S.player.crystal,
});

/* ─────────────────── PLAYER ACTIONS ─────────────────── */

function upgrade(key) {
  const p = S.player, lvl = p.buildings[key];
  if (key !== 'CORE' && lvl >= p.buildings.CORE) return;
  const c = upgradeCost(lvl);
  if (p.alloy < c.alloy || p.crystal < c.crystal) return;
  p.alloy -= c.alloy; p.crystal -= c.crystal; p.buildings[key]++;
  S.tm.upgrades++;
  render();
}

function upgradeTelescope() {
  const p = S.player;
  const c = upgradeCost(p.telescope);
  if (p.alloy < c.alloy || p.crystal < c.crystal) return;
  p.alloy -= c.alloy; p.crystal -= c.crystal; p.telescope++;
  render();
}

function build(hull, n = 1) {
  const p = S.player, h = HULLS[hull];
  if (p.buildings.SHIPYARD < h.minShipyard) return;
  const max = Math.min(n, Math.floor(p.alloy / h.alloy), h.crystal ? Math.floor(p.crystal / h.crystal) : Infinity);
  if (max < 1) return;
  p.alloy -= max * h.alloy; p.crystal -= max * h.crystal;
  const bucket = h.ground ? p.ground : p.fleet;
  bucket[hull] = (bucket[hull] || 0) + max;
  render();
}

function sendProbe(botId) {
  const p = S.player;
  const COST = 220;
  if (p.alloy < COST) return;
  p.alloy -= COST;
  S.tm.probes++;
  S.missions.push({ kind: 'probe', bot: botId, arriveAt: S.t + 8 });
  log(`Probe launched at <b>${S.bots[botId].name}</b>. 8 minutes out.`, 'info');
  save(); render();
}

function launchAttack(botId, send) {
  const p = S.player, b = S.bots[botId];
  if (fleetCount(send) === 0) return;
  for (const k in send) p.fleet[k] -= send[k];
  const flight = travelMinutes(b.d, fleetSpeed(send));
  p.awayUntil = S.t + flight * 2;
  S.missions.push({ kind: 'attack', bot: botId, fleet: send, arriveAt: S.t + flight });

  S.tm.attacks++;
  const rep = S.probes[botId];
  if (rep && S.t - rep.at <= 45) S.tm.attacksAfterScout++;

  log(`Fleet launched at <b>${b.name}</b> — ${fleetCount(send)} ships, ${flight} min out.`, 'info');
  save(); render();
}

/* ─────────────────── TELESCOPE ─────────────────── */

function readTelescope(botId) {
  const p = S.player, b = S.bots[botId];
  if (!S.unlocked.telescope || S.watching !== botId) return null;
  const c = clarity(p.telescope, b.veil);
  const st = clarityState(c);
  const truth = b.awayUntil > S.t ? 'AWAY' : 'HOME';
  const last = S.teleLast[botId];
  const since = last ? S.t - last.at : 0;
  const r = telescopeReading(st, truth, since, b.awayUntil > S.t ? b.awayUntil - S.t : null);
  if (r.status !== 'UNKNOWN') S.teleLast[botId] = { status: r.status, at: S.t - r.stale };
  return { ...r, state: st, clarity: c };
}

/* ─────────────────── RENDER ─────────────────── */

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function render() {
  const p = S.player, c = pCaps();
  const away = p.awayUntil > S.t;

  $('planet').innerHTML = `
    <div class="row"><span class="k">Alloy</span><span class="v">${fmt(p.alloy)} / ${fmt(c.alloy)}</span></div>
    <div class="bar${p.alloy / c.alloy > 0.9 ? ' warn' : ''}"><i style="width:${Math.min(100, (p.alloy / c.alloy) * 100)}%"></i></div>
    <div class="row"><span class="k">Crystal</span><span class="v">${fmt(p.crystal)} / ${fmt(c.crystal)}</span></div>
    <div class="bar${p.crystal / c.crystal > 0.9 ? ' warn' : ''}"><i style="width:${Math.min(100, (p.crystal / c.crystal) * 100)}%"></i></div>
    <div class="row"><span class="k">Protected by vault</span><span class="v">${fmt(vaultProtects(p.buildings.VAULT))} each</span></div>
    <div class="row"><span class="k">Home defence</span><span class="v">${away ? '<span class="tag away">FLEET OUT</span> ' : ''}${fleetCount(p.fleet) + fleetCount(p.ground)} units</span></div>
    <div class="row"><span class="k">Wealth</span><span class="v">${fmt(empireValue(playerForScore()))}</span></div>
    <div class="row"><span class="k">Dominion <span class="muted">— the ladder</span></span><span class="v" style="color:${dominion(p.ledger) >= 0 ? 'var(--good)' : 'var(--crit)'}">${dominion(p.ledger) >= 0 ? '+' : ''}${fmt(dominion(p.ledger))}</span></div>
    ${(p.disruptedUntil || 0) > S.t ? `<div class="expose">Surface works disrupted — <b>no production</b> for another <b>${p.disruptedUntil - S.t} min</b>.</div>` : ''}
    ${S.t < GRACE_MIN && p.buildings.CORE < 4 ? `<div class="expose">Newcomer grace: nobody can attack you for another <b>${GRACE_MIN - S.t} min</b>.</div>` : ''}
    ${away ? `<div class="expose">Your fleet is away. Home is defended by ${fleetCount(p.fleet) + fleetCount(p.ground)} units for another <b>${p.awayUntil - S.t} min</b>.</div>` : ''}
  `;

  $('buildings').innerHTML = Object.entries({
    CORE: 'Command Core', REFINERY: 'Alloy Refinery', EXTRACTOR: 'Crystal Extractor',
    VAULT: 'Vault', SHIPYARD: 'Shipyard', RING: 'Orbital Ring',
  }).map(([k, name]) => {
    const lvl = p.buildings[k], cost = upgradeCost(lvl);
    const gated = k !== 'CORE' && lvl >= p.buildings.CORE;
    const can = !gated && p.alloy >= cost.alloy && p.crystal >= cost.crystal;
    return `<tr><td>${name}</td><td class="n">L${lvl}</td>
      <td class="n">${fmt(cost.alloy)}${cost.crystal ? ' + ' + fmt(cost.crystal) + 'c' : ''}</td>
      <td class="n"><button data-up="${k}" ${can ? '' : 'disabled'}>${gated ? 'core' : '+'}</button></td></tr>`;
  }).join('') + (S.unlocked.telescope ? (() => {
    const cost = upgradeCost(p.telescope);
    const can = p.alloy >= cost.alloy && p.crystal >= cost.crystal;
    return `<tr><td class="hint">Telescope</td><td class="n">L${p.telescope}</td>
      <td class="n">${fmt(cost.alloy)}${cost.crystal ? ' + ' + fmt(cost.crystal) + 'c' : ''}</td>
      <td class="n"><button data-tele="1" ${can ? '' : 'disabled'}>+</button></td></tr>`;
  })() : '');

  $('yard').innerHTML = ['WASP', 'HAULER', 'LANCE', 'BULWARK', 'BASTION'].map((k) => {
    const h = HULLS[k];
    const locked = p.buildings.SHIPYARD < h.minShipyard;
    const have = (h.ground ? p.ground[k] : p.fleet[k]) || 0;
    const can = !locked && p.alloy >= h.alloy && p.crystal >= h.crystal;
    return `<tr><td>${h.name}${h.ground ? ' <span class="muted">ground</span>' : ''}</td>
      <td class="n">×${have}</td>
      <td class="n">${fmt(h.alloy)}${h.crystal ? ' + ' + fmt(h.crystal) + 'c' : ''}</td>
      <td class="n">${locked ? `<span class="muted">yard L${h.minShipyard}</span>`
        : `<button data-build="${k}" ${can ? '' : 'disabled'}>+1</button>
           <button data-build="${k}" data-n="5" ${can ? '' : 'disabled'}>+5</button>`}</td></tr>`;
  }).join('');

  // Intel
  let intel = '';
  if (!S.unlocked.telescope) {
    intel = `<p class="muted">No telescope yet. Send your fleet somewhere and see what comes back.</p>`;
  } else {
    const w = S.watching;
    if (w === null) {
      intel = `<p class="muted">Telescope L${p.telescope} idle. Choose a planet to watch below.</p>`;
    } else {
      const r = readTelescope(w);
      const b = S.bots[w];
      const cls = r.status === 'HOME' ? 'home' : r.status === 'AWAY' ? 'away' : 'unk';
      intel = `<div id="tele">
        <div class="row"><span class="k">Watching</span><span class="v"><b>${b.name}</b></span></div>
        <div class="row"><span class="k">Fleet</span><span class="v"><span class="tag ${cls}">${r.status}</span></span></div>
        <div class="row"><span class="k">Signal</span><span class="v">${r.state}${r.clarity === 0 ? ' <span class="muted">(may be stale)</span>' : ''}</span></div>
        ${r.stale > 0 ? `<div class="row"><span class="k">Last confirmed</span><span class="v">${r.stale} min ago</span></div>` : ''}
        ${r.eta !== null && r.eta !== undefined ? `<div class="row"><span class="k">Returns in</span><span class="v">${r.eta} min</span></div>` : ''}
      </div>`;
    }
  }
  const reports = Object.entries(S.probes)
    .sort((a, b) => b[1].at - a[1].at).slice(0, 3)
    .map(([id, r]) => {
      const b = S.bots[id];
      const age = S.t - r.at;
      return `<div class="row"><span class="k">${b.name} <span class="muted">${age}m ago</span></span>
        <span class="v">${fmt(r.alloy.low)}–${fmt(r.alloy.high)} alloy · def ${fmt(r.defence.low)}–${fmt(r.defence.high)}</span></div>`;
    }).join('');
  $('intel').innerHTML = intel + (reports ? `<p class="muted" style="margin:10px 0 2px">PROBE REPORTS</p>${reports}` : '');

  // Galaxy
  $('galaxy').innerHTML = S.bots.map((b) => {
    const spd = fleetSpeed(p.fleet) || HULLS.WASP.speed;
    const flight = travelMinutes(b.d, spd);
    const watched = S.watching === b.id;
    const rep = S.probes[b.id];
    const fresh = rep && S.t - rep.at <= 45;
    return `<tr>
      <td><b>${b.name}</b><br><span class="muted">${b.note}</span></td>
      <td class="n">${flight}m</td>
      <td class="n">
        ${S.unlocked.telescope ? `<button data-watch="${b.id}" ${watched ? 'disabled' : ''}>${watched ? 'watching' : 'watch'}</button>` : ''}
        <button data-probe="${b.id}" ${p.alloy < 220 ? 'disabled' : ''}>scout</button>
        <button class="go" data-attack="${b.id}" ${away || fleetCount(p.fleet) === 0 ? 'disabled' : ''}>attack</button>
        ${fresh ? '<br><span class="muted hint">intel fresh</span>' : ''}
      </td></tr>`;
  }).join('');

  $('log').innerHTML = S.events.slice(0, 40)
    .map((e) => `<div class="${e.cls}">${e.text}</div>`).join('') || '<div class="muted">Nothing yet.</div>';

  save();
}

/* ─────────────────── ATTACK DIALOG ─────────────────── */

function openAttack(botId) {
  const p = S.player, b = S.bots[botId];
  const dlg = $('attack-dlg');
  const hulls = MOBILE_HULLS.filter((k) => (p.fleet[k] || 0) > 0);
  const sel = Object.fromEntries(hulls.map((k) => [k, p.fleet[k]]));
  const rep = S.probes[botId];
  const fresh = rep && S.t - rep.at <= 45;

  const draw = () => {
    const send = {};
    for (const k of hulls) if (sel[k] > 0) send[k] = sel[k];
    const spd = fleetSpeed(send) || 1;
    const flight = fleetCount(send) ? travelMinutes(b.d, spd) : 0;
    const homeLeft = fleetCount(p.fleet) - fleetCount(send) + fleetCount(p.ground);

    $('attack-body').innerHTML = `
      <p style="margin:0 0 8px"><b>Attack ${b.name}</b> <span class="muted">${b.d} units out</span></p>
      ${fresh ? `<p class="hint" style="margin:0 0 8px">Probe ${S.t - rep.at} min ago: ${fmt(rep.alloy.low)}–${fmt(rep.alloy.high)} alloy,
         defence ${fmt(rep.defence.low)}–${fmt(rep.defence.high)}, fleet was ${rep.fleetHome ? 'HOME' : 'AWAY'}.</p>`
        : `<p class="muted" style="margin:0 0 8px">No fresh intel. You are guessing.</p>`}
      ${hulls.map((k) => `
        <div class="row"><span class="k">${HULLS[k].name}</span><span class="v" id="lab-${k}">${sel[k]} / ${p.fleet[k]}</span></div>
        <input type="range" min="0" max="${p.fleet[k]}" value="${sel[k]}" data-hull="${k}">
      `).join('')}
      <div class="expose">
        Home defence after launch: <b>${homeLeft} units</b><br>
        You will be exposed for <b>${flight * 2} minutes</b><br>
        <span class="muted">Cargo ${fmt(fleetCargo(send))} · power ${fleetPower(send).toFixed(1)}</span>
      </div>
      <p class="center">
        <button id="atk-cancel">cancel</button>
        <button class="go" id="atk-go" ${fleetCount(send) === 0 ? 'disabled' : ''}>launch — irreversible</button>
      </p>`;

    $('attack-body').querySelectorAll('input[data-hull]').forEach((el) => {
      el.oninput = () => { sel[el.dataset.hull] = +el.value; draw(); };
    });
    $('atk-cancel').onclick = () => dlg.close();
    $('atk-go').onclick = () => { dlg.close(); launchAttack(botId, send); };
  };
  draw();
  dlg.showModal();
}

/* ─────────────────── RETURN OVERLAY ─────────────────── */

function showReturn(gap) {
  if (gap.minutes < 3) return;
  const unseen = S.events.filter((e) => e.unseen);
  if (!unseen.length) return;
  const h = Math.floor(gap.minutes / 60), m = gap.minutes % 60;
  $('return-body').innerHTML = `
    <p style="margin:0 0 4px;letter-spacing:.16em;font-size:10px;color:var(--dim)">WHILE YOU WERE GONE</p>
    <p style="margin:0 0 10px;font-size:16px"><b>${h ? h + 'h ' : ''}${m}m</b></p>
    ${unseen.slice(0, 6).map((e) => `<div style="padding:4px 0;border-top:1px solid var(--line)" class="${e.cls}">${e.text}</div>`).join('')}
    <p class="center" style="margin-top:12px"><button class="go" id="ret-ok">continue</button></p>`;
  $('return-dlg').showModal();
  $('ret-ok').onclick = () => { $('return-dlg').close(); };
  S.events.forEach((e) => { e.unseen = false; });
}

/* ─────────────────── TELEMETRY ─────────────────── */

function showStats() {
  const t = S.tm;
  const rate = t.attacks ? ((t.attacksAfterScout / t.attacks) * 100).toFixed(0) : '—';
  const days = ((Date.now() - t.firstPlay) / 86400000).toFixed(1);
  const pass = t.attacks >= 4 && t.attacksAfterScout / t.attacks >= 0.5;
  $('stats-body').innerHTML = `
    <p style="margin:0 0 10px"><b>Session data</b> <span class="muted">— for the person running the test</span></p>
    <div class="row"><span class="k">Days elapsed</span><span class="v">${days}</span></div>
    <div class="row"><span class="k">Sessions</span><span class="v">${t.sessions}</span></div>
    <div class="row"><span class="k">Attacks launched</span><span class="v">${t.attacks}</span></div>
    <div class="row"><span class="k">Probes sent</span><span class="v">${t.probes}</span></div>
    <div class="row"><span class="k">Probes detected</span><span class="v">${t.probesDetected}</span></div>
    <div class="row"><span class="k">Upgrades bought</span><span class="v">${t.upgrades}</span></div>
    <div class="row"><span class="k">Total looted</span><span class="v">${fmt(t.lootTotal)}</span></div>
    <div class="row"><span class="k">Total lost</span><span class="v">${fmt(t.lostTotal)}</span></div>
    <div class="row"><span class="k">Dominion</span><span class="v">${fmt(dominion(S.player.ledger))}</span></div>
    <div class="expose" style="margin-top:12px">
      <b>Scouted before attacking: ${rate}${rate === '—' ? '' : '%'}</b><br>
      <span class="muted">${t.attacks < 4 ? 'Not enough raids yet — needs 4+.'
        : pass ? 'PASS — the information layer is being used unprompted.'
        : 'FAIL — probe is mispriced, or its payoff is not visible enough.'}</span>
    </div>
    <p class="center" style="margin-top:10px">
      <button id="st-copy">copy JSON</button>
      <button id="st-close">close</button></p>`;
  $('stats-dlg').showModal();
  $('st-close').onclick = () => $('stats-dlg').close();
  $('st-copy').onclick = () => navigator.clipboard?.writeText(JSON.stringify(t, null, 2));
}

/* ─────────────────── WIRING ─────────────────── */

document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.up) upgrade(el.dataset.up);
  else if (el.dataset.tele) upgradeTelescope();
  else if (el.dataset.build) build(el.dataset.build, +(el.dataset.n || 1));
  else if (el.dataset.watch) { S.watching = +el.dataset.watch; render(); }
  else if (el.dataset.probe) sendProbe(+el.dataset.probe);
  else if (el.dataset.attack) openAttack(+el.dataset.attack);
});

$('stats-btn').onclick = showStats;
$('reset-btn').onclick = () => {
  if (confirm('Wipe this galaxy and start over?')) { localStorage.removeItem(SAVE); location.reload(); }
};

const gap = catchUp();
S.tm.sessions++;
render();
showReturn(gap);

// Keep the clock live while the tab is open.
setInterval(() => { if (nowMinutes() > S.t) { catchUp(); render(); } }, 15000);

/* Test hook — lets smoke-test.mjs drive the clock without a browser. */
export const __test = { step, catchUp, launchAttack, sendProbe, upgrade, build, render, state: () => S };
