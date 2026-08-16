import {
  ABUSE,
  HULLS,
  MOBILE_HULLS,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  bookBattle,
  canAttack,
  computeLoot,
  crystalRate,
  distance,
  dominion,
  emptyLedger,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeed,
  fleetValue,
  generateGalaxy,
  investedInBuilding,
  mulberry32,
  resolveCombat,
  satelliteEntries,
  satelliteSlots,
  storageCap,
  travelMinutes,
  upgradeCost,
  vaultProtects,
  wealth,
  type BuildingLevels,
  type Fleet,
  type Ledger,
  type Rng,
  type SatelliteLevels,
} from '@blindspace/rules';
import { ARCHETYPES, ARCHETYPE_NAMES, type ArchetypeName } from './archetypes.js';
import { measure, type Invariants } from './invariants.js';

export interface SimPlayer {
  id: number;
  name: string;
  type: ArchetypeName;
  x: number; y: number; z: number;
  buildings: BuildingLevels;
  satellites: SatelliteLevels;
  fleet: Fleet;
  ground: Fleet;
  alloy: number;
  crystal: number;
  shield: number;
  lastTick: number;
  joinedAt: number;
  disruptedUntil: number;
  nextLogin: number;
  ledger: Ledger;
  attacks: number[];
  scoutsSent: number;
  lootToday: number;
  lossToday: number;
  disruptedToday: number;
  wealthNow: number;
  wealthHistory: number[];
  recentHits: Map<number, number[]>;
  intel: Map<number, { stock: number; defence: number; at: number }>;
  neighbours: { id: number; d: number }[];
}

export interface Mission {
  from: number;
  to: number;
  fleet: Fleet;
  arriveAt: number;
  distance: number;
  scouted: boolean;
  returning: boolean;
  loot?: { alloy: number; crystal: number };
}

export interface DayStats {
  attacks: number;
  lootValue: number;
  attackerLossValue: number;
  defenderLossValue: number;
  disruptedMinutes: number;
  byGrade: Record<'DECISIVE' | 'PARTIAL' | 'REPELLED', number>;
  scoutedAttacks: number; scoutedGain: number; scoutedLoss: number;
  blindAttacks: number; blindGain: number; blindLoss: number;
}

export const freshStats = (): DayStats => ({
  attacks: 0, lootValue: 0, attackerLossValue: 0, defenderLossValue: 0,
  disruptedMinutes: 0,
  byGrade: { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 },
  scoutedAttacks: 0, scoutedGain: 0, scoutedLoss: 0,
  blindAttacks: 0, blindGain: 0, blindLoss: 0,
});

export interface SimConfig {
  players: number;
  days: number;
  seed: number;
}

export interface World {
  players: SimPlayer[];
  missions: Mission[];
  rng: Rng;
}

/* ── setup ─────────────────────────────────────────────────────── */

export function buildWorld(cfg: SimConfig): World {
  const rng = mulberry32(cfg.seed);
  const galaxy = generateGalaxy(cfg.seed, cfg.players);

  const names: ArchetypeName[] = [];
  for (const type of ARCHETYPE_NAMES) {
    const n = Math.max(1, Math.round(cfg.players * ARCHETYPES[type].share));
    for (let i = 0; i < n; i++) names.push(type);
  }
  while (names.length < cfg.players) names.push('CASUAL');
  names.length = cfg.players;

  const players: SimPlayer[] = galaxy.slots.map((slot, i) => ({
    id: i,
    name: `P${String(i).padStart(3, '0')}`,
    type: names[i] ?? 'CASUAL',
    x: slot.x, y: slot.y, z: slot.z,
    buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, RING: 0 },
    satellites: {},
    fleet: { WASP: 12 },
    ground: {},
    alloy: 500, crystal: 120,
    shield: 0, lastTick: 0, joinedAt: 0, disruptedUntil: 0,
    nextLogin: Math.floor(rng() * 240),
    ledger: emptyLedger(),
    attacks: [], scoutsSent: 0,
    lootToday: 0, lossToday: 0, disruptedToday: 0,
    wealthNow: 0, wealthHistory: [],
    recentHits: new Map(), intel: new Map(),
    neighbours: [],
  }));

  for (const p of players) {
    p.neighbours = players
      .filter((q) => q.id !== p.id)
      .map((q) => ({ id: q.id, d: distance(p, q) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 18);
  }

  return { players, missions: [], rng };
}

/* ── economy ───────────────────────────────────────────────────── */

const capsOf = (p: SimPlayer) => ({
  alloy: storageCap(alloyRate(p.buildings.REFINERY)),
  crystal: storageCap(crystalRate(p.buildings.EXTRACTOR)),
});

function sync(p: SimPlayer, t: number): void {
  const next = advanceEconomy(
    {
      alloy: p.alloy, crystal: p.crystal, shield: p.shield,
      lastTickMinutes: p.lastTick, disruptedUntilMinutes: p.disruptedUntil,
    },
    {
      refineryLevel: p.buildings.REFINERY,
      extractorLevel: p.buildings.EXTRACTOR,
      aegisLevel: p.satellites.AEGIS ?? 0,
    },
    t,
  );
  p.alloy = next.alloy;
  p.crystal = next.crystal;
  p.shield = next.shield;
  p.lastTick = next.lastTickMinutes;
}

const holdingsOf = (p: SimPlayer) => ({
  buildings: p.buildings, satellites: p.satellites,
  fleet: p.fleet, ground: p.ground, alloy: p.alloy, crystal: p.crystal,
});

/* ── a bot session ─────────────────────────────────────────────── */

function runSession(p: SimPlayer, t: number, world: World, rng: Rng): void {
  sync(p, t);
  const a = ARCHETYPES[p.type];

  // 0. Defence first, as insurance on what is currently raidable.
  {
    const raidable = Math.max(0, p.alloy - vaultProtects(p.buildings.VAULT));
    const target = raidable * a.defenceRatio;
    const held = fleetValue(p.ground);
    const B = HULLS.BASTION;
    if (held < target && p.buildings.SHIPYARD >= B.minShipyard) {
      const want = Math.floor((target - held) / (B.alloy + B.crystal));
      const n = Math.min(
        want,
        Math.floor((p.alloy * 0.5) / B.alloy),
        Math.floor(p.crystal / B.crystal),
      );
      if (n > 0) {
        p.ground.BASTION = (p.ground.BASTION ?? 0) + n;
        p.alloy -= n * B.alloy;
        p.crystal -= n * B.crystal;
      }
    }
  }

  // 1. Buildings, in archetype order. CORE gates everything else.
  for (let pass = 0; pass < 3; pass++) {
    for (const key of a.buildOrder) {
      const lvl = p.buildings[key];
      if (key !== 'CORE' && lvl >= p.buildings.CORE) continue;
      const cost = upgradeCost(lvl);
      if (
        p.alloy >= cost.alloy && p.crystal >= cost.crystal &&
        p.alloy - cost.alloy > alloyRate(p.buildings.REFINERY) * 0.5
      ) {
        p.alloy -= cost.alloy;
        p.crystal -= cost.crystal;
        p.buildings[key] = lvl + 1;
      }
    }
  }

  // 2. Satellites, up to the slot cap.
  {
    const slots = satelliteSlots(p.buildings.RING);
    const owned = satelliteEntries(p.satellites).length;
    for (const s of a.sats) {
      const lvl = p.satellites[s] ?? 0;
      if (lvl === 0 && owned >= slots) continue;
      if (lvl >= p.buildings.CORE) continue;
      const cost = upgradeCost(lvl);
      if (p.alloy >= cost.alloy && p.crystal >= cost.crystal) {
        p.alloy -= cost.alloy;
        p.crystal -= cost.crystal;
        p.satellites[s] = lvl + 1;
        break;
      }
    }
  }

  // 3. Offensive hulls from what remains.
  {
    const budget = p.alloy * a.militaryShare;
    const yard = p.buildings.SHIPYARD;
    for (const hull of ['BULWARK', 'LANCE', 'WASP'] as const) {
      const h = HULLS[hull];
      if (yard < h.minShipyard || budget < h.alloy) continue;
      let n = Math.floor(budget / h.alloy);
      if (h.crystal > 0) n = Math.min(n, Math.floor(p.crystal / h.crystal));
      n = Math.min(n, Math.floor(p.alloy / h.alloy));
      if (n > 0) {
        p.fleet[hull] = (p.fleet[hull] ?? 0) + n;
        p.alloy -= n * h.alloy;
        p.crystal -= n * h.crystal;
      }
      break;
    }

    // Cargo sized to what a neighbour is likely holding, not bought one at a time.
    if (yard >= HULLS.HAULER.minShipyard && a.attackChance > 0) {
      const nb = p.neighbours[0] ? world.players[p.neighbours[0].id] : undefined;
      const caps = nb ? capsOf(nb) : { alloy: 5000, crystal: 1500 };
      const want = Math.ceil(((caps.alloy + caps.crystal) * 0.25) / HULLS.HAULER.cargo);
      const have = p.fleet.HAULER ?? 0;
      const n = Math.min(
        want - have,
        Math.floor((p.alloy * 0.3) / HULLS.HAULER.alloy),
        Math.floor(p.crystal / HULLS.HAULER.crystal),
      );
      if (n > 0) {
        p.fleet.HAULER = have + n;
        p.alloy -= n * HULLS.HAULER.alloy;
        p.crystal -= n * HULLS.HAULER.crystal;
      }
    }
  }

  if (rng() < a.attackChance) tryAttack(p, t, world, rng);

  p.nextLogin = t + Math.max(20, Math.round((1440 / a.loginsPerDay) * (0.6 + rng() * 0.8)));
}

function tryAttack(p: SimPlayer, t: number, world: World, rng: Rng): void {
  const a = ARCHETYPES[p.type];
  const speed = fleetSpeed(p.fleet);
  if (speed <= 0 || fleetCount(p.fleet) < 8) return;
  p.wealthNow = wealth(holdingsOf(p));

  let best: { q: SimPlayer; d: number; flight: number; score: number; scouted: boolean; defence: number | null } | null = null;

  for (const nb of p.neighbours.slice(0, 10)) {
    const q = world.players[nb.id];
    if (!q) continue;
    q.wealthNow = q.wealthNow || wealth(holdingsOf(q));

    const hits = (p.recentHits.get(q.id) ?? []).filter((x) => t - x < ABUSE.bashWindowMinutes).length;
    const gate = canAttack(
      { playerId: String(p.id), wealth: p.wealthNow },
      { playerId: String(q.id), wealth: q.wealthNow },
      hits,
    );
    if (!gate.ok) continue;

    const known = p.intel.get(q.id);
    const scouted = Boolean(a.scouts && known && t - known.at < 120);
    const stock = scouted && known ? known.stock : (capsOf(q).alloy + capsOf(q).crystal) * 0.35;
    const defence = scouted && known ? known.defence : null;

    const vault = vaultProtects(q.buildings.VAULT);
    const expectedLoot = Math.max(0, stock - vault * 2) * 0.5;
    const flight = travelMinutes(nb.d, speed);
    // A blind attacker cannot make this risk discount. That is the whole point.
    const risk = defence !== null ? 1 + defence / Math.max(1, fleetValue(p.fleet)) : 1.6;
    const score = expectedLoot / ((flight + 10) * risk);

    if (!best || score > best.score) best = { q, d: nb.d, flight, score, scouted, defence };
  }
  if (!best || best.score <= 0) return;

  if (a.scouts && !best.scouted && rng() < 0.7) {
    p.scoutsSent++;
    sync(best.q, t);
    p.intel.set(best.q.id, {
      stock: best.q.alloy + best.q.crystal,
      defence: fleetValue({ ...best.q.fleet, ...best.q.ground }),
      at: t + 8,
    });
    return; // spends the session on the probe
  }

  // Escorts scale with the expected fight; cargo scales with the expected haul.
  const commit =
    best.scouted && best.defence !== null
      ? Math.min(0.95, Math.max(0.25, (best.defence * 1.8) / Math.max(1, fleetValue(p.fleet))))
      : 0.7 + rng() * 0.25;

  const send: Fleet = {};
  for (const k of MOBILE_HULLS) {
    const have = p.fleet[k] ?? 0;
    if (have <= 0) continue;
    const n = k === 'HAULER' ? have : Math.floor(have * commit);
    if (n > 0) {
      send[k] = n;
      p.fleet[k] = have - n;
    }
  }
  if (fleetCount(send) === 0) return;

  world.missions.push({
    from: p.id, to: best.q.id, fleet: send,
    arriveAt: t + best.flight, distance: best.d,
    scouted: best.scouted, returning: false,
  });
  p.attacks.push(t);
}

/* ── mission resolution ────────────────────────────────────────── */

function resolveMission(m: Mission, t: number, world: World, stats: DayStats): void {
  const atk = world.players[m.from];
  const def = world.players[m.to];
  if (!atk || !def) return;

  if (m.returning) {
    for (const [hull, n] of fleetEntries(m.fleet)) {
      atk.fleet[hull] = (atk.fleet[hull] ?? 0) + n;
    }
    sync(atk, t);
    const caps = capsOf(atk);
    atk.alloy = Math.min(caps.alloy, atk.alloy + (m.loot?.alloy ?? 0));
    atk.crystal = Math.min(caps.crystal, atk.crystal + (m.loot?.crystal ?? 0));
    return;
  }

  sync(def, t);
  const defenders: Fleet = { ...def.fleet, ...def.ground };
  // Seeded from the mission, so any battle can be re-derived from its inputs.
  const rng = mulberry32((m.from * 7919 + m.to * 104729 + m.arriveAt) >>> 0);
  const r = resolveCombat(m.fleet, defenders, def.shield, rng);

  for (const k of Object.keys(def.fleet) as (keyof Fleet)[]) {
    def.fleet[k] = r.defenderSurvivors[k] ?? 0;
  }
  for (const k of Object.keys(def.ground) as (keyof Fleet)[]) {
    def.ground[k] = (r.defenderSurvivors[k] ?? 0) + (r.defenceSalvage[k] ?? 0);
  }
  def.shield = r.shieldLeft;

  const loot = computeLoot(
    { alloy: def.alloy, crystal: def.crystal },
    vaultProtects(def.buildings.VAULT),
    r.grade,
    fleetCargo(r.attackerSurvivors),
  );
  def.alloy -= loot.alloy;
  def.crystal -= loot.crystal;

  const wasUntil = def.disruptedUntil;
  def.disruptedUntil = applyDisruption(wasUntil, t, r.grade);
  const added = Math.max(0, def.disruptedUntil - Math.max(wasUntil, t));
  def.disruptedToday += added;

  bookBattle(atk.ledger, def.ledger, loot.alloy + loot.crystal, r);

  const lootValue = loot.alloy + loot.crystal;
  const gained = lootValue + r.defenderLossValue;
  stats.attacks++;
  stats.lootValue += lootValue;
  stats.attackerLossValue += r.attackerLossValue;
  stats.defenderLossValue += r.defenderLossValue;
  stats.disruptedMinutes += added;
  stats.byGrade[r.grade]++;
  if (m.scouted) {
    stats.scoutedAttacks++; stats.scoutedGain += gained; stats.scoutedLoss += r.attackerLossValue;
  } else {
    stats.blindAttacks++; stats.blindGain += gained; stats.blindLoss += r.attackerLossValue;
  }

  atk.lootToday += lootValue;
  def.lossToday += r.defenderLossValue + lootValue;
  const hits = atk.recentHits.get(def.id) ?? [];
  hits.push(t);
  atk.recentHits.set(def.id, hits);

  if (fleetCount(r.attackerSurvivors) > 0) {
    world.missions.push({
      from: m.from, to: m.to, fleet: r.attackerSurvivors,
      arriveAt: t + travelMinutes(m.distance, fleetSpeed(r.attackerSurvivors)),
      distance: m.distance, scouted: m.scouted, returning: true, loot,
    });
  }
}

/* ── the season loop ───────────────────────────────────────────── */

export interface DayReport {
  day: number;
  stats: DayStats;
  invariants: Invariants;
}

export function runSeason(cfg: SimConfig): { world: World; days: DayReport[] } {
  const world = buildWorld(cfg);
  const total = cfg.days * 1440;
  const days: DayReport[] = [];
  let stats = freshStats();

  for (let t = 0; t <= total; t++) {
    for (let i = world.missions.length - 1; i >= 0; i--) {
      const m = world.missions[i];
      if (m && m.arriveAt <= t) {
        world.missions.splice(i, 1);
        resolveMission(m, t, world, stats);
      }
    }
    for (const p of world.players) {
      if (p.nextLogin <= t) runSession(p, t, world, world.rng);
    }
    if (t > 0 && t % 1440 === 0) {
      for (const p of world.players) {
        sync(p, t);
        p.wealthNow = wealth(holdingsOf(p));
      }
      const day = t / 1440;
      days.push({ day, stats, invariants: measure(day, world.players, stats) });
      for (const p of world.players) {
        p.wealthHistory.push(p.wealthNow);
        p.lootToday = 0;
        p.lossToday = 0;
        p.disruptedToday = 0;
      }
      stats = freshStats();
    }
  }
  return { world, days };
}

export { dominion, investedInBuilding, capsOf, holdingsOf };
