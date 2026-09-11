/** Current-rule physical session baseline. Prepared, known targets; no invented loot, unlocks or reinforcements. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABUSE, COMBAT, FUEL, HULLS, fleetCount, fleetEntries, fleetTravelExact, hullBulk, hullRoundTrip, missionFuel,
  mulberry32, resolveCombat, shipMinutes, PROBE, travelExact } from '../packages/rules/src/index.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import type { Fleet, Hull, HullId, Resources } from '../packages/rules/src/types.js';
import { cost } from './fleet-economy-study.js';
import { assertAcyclic, type Action } from './economy-calendar-model.js';
import { prototypeRoster, withRoster } from './fleet-economy-next-study.js';
import { completeWorldOrder, quoteWorldOrder, worldStats, worldQueue, cloneWorld, developmentReserve, type CostedWorld, type WorldOrder } from './costed-world.js';
import { designHull, designFleetTarget, designSpeed, designEffort } from './economy-design-model.js';
import { yardSpeedMult } from '../packages/rules/src/tech.js';

/** Ground-excluded bulk of a wing. The Hangar that metered it is gone (D184); the studies still size fleets by it. */
const fleetBulk = (fleet: Record<string, number | undefined>): number =>
  Object.entries(fleet).reduce(
    (sum, [id, n]) => sum + (HULLS[id as keyof typeof HULLS].ground ? 0 : hullBulk(id as never) * (n ?? 0)),
    0,
  );

interface Target {
  id: string; distance: number; fleet: Fleet; tech?: TechLevels;
  /** Optional paid stationary defender; rebuilds its initial roster, does not launch counter-raids. */
  economy?: { stock: Resources; rate: Resources; windows: { start: number; end: number }[]; yard: number; hangar: number; batchRebuild?: boolean; minimumRebuildFraction?: number };
}
export interface SessionScenario {
  initialFleet: Fleet; desiredFleet: Fleet; packet: Fleet; stock: Resources; rate: Resources;
  hangar: number; bays: number; yard: number; end: number; seed: number;
  windows: { start: number; end: number }[]; targets: Target[];
  development: Action[];
  /** Fully costed building/research mode replaces external rates/capacities and bundle prices. */
  world?: { initial: CostedWorld; orders: Record<string, WorldOrder> };
  /** Paid action effects; capacity is usable only once its development event completes. */
  infrastructure?: Record<string, { yardLevel?: number; hangarGain?: number }>;
  /** Exogenous sensitivity only: destroys a fraction of docked hulls, no loot or opponent invented. */
  shocks?: { at: number; homeLossFraction: number }[];
  /** Optional tempo-only experiment, applied as one speed multiplier to this packet's live hull speeds. */
  baseRoundTripAt1250?: number;
  speedMultiplier?: number;
  roster?: Partial<Record<HullId, Hull>>;
  bulk?: Partial<Record<HullId, number>>;
  minimumDispatchFraction?: number;
  hullRequires?: Partial<Record<HullId, string[]>>;
  /** Ordered tactical preferences; only existing home ships may satisfy a choice. */
  packetChoices?: Fleet[];
  /** Experiment: exact known stationary defence, independent forecast seeds; not real fog/skill simulation. */
  maxExpectedLossFraction?: number;
  /** Paid physical probe schedule. Exact prepared-roster snapshots are optimistic, not a full fog model. */
  intel?: { maxAgeMinutes: number; requires?: string[] };
  /** Actual season boundary, distinct from a shorter observation horizon. */
  seasonEnd?: number;
  /** Keep this many hours of current production available for military use, not fictitiously spent. */
  developmentReserveHours?: number;
  /** Target-derived candidate: grow holdings with production; no free hulls or automatic retirement. */
  fleetBudgetHours?: number;
}
const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const emptyFleet = (): Fleet => ({});
function add(to: Fleet, from: Fleet, sign = 1) {
  for (const [h, n] of fleetEntries(from)) {
    const next = (to[h] ?? 0) + sign * n;
    if (next) to[h] = next; else Reflect.deleteProperty(to, h);
  }
}
export function sessionScenario(): SessionScenario {
  const packet = { VIPER: 24 };
  return { initialFleet: { ...packet }, desiredFleet: { ...packet }, packet,
    stock: { alloy: 12000, crystal: 4500, deuterium: 700 }, rate: { alloy: 300, crystal: 120, deuterium: 20 },
    hangar: fleetBulk(packet), bays: 1, yard: 4, end: 180, seed: 42,
    windows: [{ start: 0, end: 90 }], development: [],
    targets: Array.from({ length: 5 }, (_, i) => ({ id: `target-${i}`, distance: 1250, fleet: { SENTINEL: 12 } })) };
}

export function fleetSession(s: SessionScenario) {
  const requirements = Object.fromEntries(fleetEntries(s.desiredFleet).map(([h]) => [h, HULLS[h].requiredResearch]));
  if (s.world) {
    if ([...Object.values(s.world.initial.buildings), ...Object.values(s.world.initial.tech)].some(n => !Number.isInteger(n) || n < 0)
      || s.development.some(a => {
        const order = s.world!.orders[a.id];
        return order && a.queue !== worldQueue(order);
      })) throw new Error('Invalid costed world');
    s = { ...s, ...worldStats(s.world.initial) };
  }
  if (!s.roster) {
    if (s.bulk) throw new Error('Physical override requires a candidate catalog');
    return executeSession(s, requirements);
  }
  const used = [s.initialFleet, s.desiredFleet, s.packet, ...(s.packetChoices ?? []), ...s.targets.map(t => t.fleet)];
  if (used.some(f => fleetEntries(f).some(([h]) => !s.roster?.[h]
    || !Number.isFinite(s.bulk?.[h]) || (s.bulk?.[h] ?? 0) <= 0))) throw new Error('Incomplete candidate catalog');
  return withRoster(s.roster, () => executeSession(s, requirements));
}

function executeSession(s: SessionScenario, requirements: Partial<Record<HullId, Hull['requiredResearch']>>) {
  const bulk = (h: HullId) => s.roster ? s.bulk![h]! : hullBulk(h);
  // D195: fuel is a fraction of hull VALUE, tilted by the hull's own round trip.
  const fuelMassOf = (h: HullId) => {
    const t = s.roster?.[h] ?? HULLS[h];
    const trip = hullRoundTrip(h) ?? FUEL.pivotRoundTrip;
    return Math.max(1, Math.ceil((t.alloy + t.crystal + t.deuterium) * FUEL.perValue
      * (FUEL.pivotRoundTrip / trip)));
  };
  const load = (f: Fleet) => fleetEntries(f).reduce((n, [h, count]) => n + count * bulk(h), 0);
  const fuelFor = (f: Fleet, distance: number) => {
    if (!s.roster) return missionFuel(f, distance, 2);
    const mass = fleetEntries(f).reduce((n, [h, count]) => n + count * fuelMassOf(h), 0);
    return Math.ceil(mass * distance / FUEL.scale) * 2;
  };
  const fleets = [s.initialFleet, s.desiredFleet, s.packet, ...(s.packetChoices ?? []), ...s.targets.map(t => t.fleet)];
  const valid = (n: number) => Number.isFinite(n) && n >= 0;
  const engagement = COMBAT.engagementSeconds / 60;
  const speedMultiplier = s.speedMultiplier ?? 1;
  const minimumDispatchFraction = s.minimumDispatchFraction ?? 1;
  const actionIds = new Set(s.development.map(a => a.id));
  if (s.world && (s.infrastructure || s.development.some(a => !s.world!.orders[a.id] || a.rateGain)
    || Object.keys(s.world.orders).some(id => !actionIds.has(id)))) throw new Error('Unpriced or mixed world development');
  if (!fleetCount(s.packet) || ![s.hangar, s.end, ...keys.map(k => s.stock[k]), ...keys.map(k => s.rate[k])].every(valid)
    || (s.seasonEnd !== undefined && (!valid(s.seasonEnd) || s.seasonEnd === 0))
    || !valid(s.developmentReserveHours ?? 0)
    || (s.fleetBudgetHours !== undefined && (!s.world?.initial.design || !valid(s.fleetBudgetHours)))
    || (s.intel && (!Number.isFinite(s.intel.maxAgeMinutes) || s.intel.maxAgeMinutes <= 0
      || s.intel.requires?.some(id => !actionIds.has(id))))
    || !Number.isInteger(s.bays) || s.bays < 1 || !Number.isInteger(s.yard) || s.yard < 0
    || fleets.some(f => Object.values(f).some(n => !Number.isInteger(n) || n < 0))
    || s.targets.some(t => !valid(t.distance)) || new Set(s.targets.map(t => t.id)).size !== s.targets.length
    || s.targets.some(t => t.economy && (!Number.isInteger(t.economy.yard) || t.economy.yard < 0
      || !valid(t.economy.minimumRebuildFraction ?? 0) || (t.economy.minimumRebuildFraction ?? 0) > 1
      || !valid(t.economy.hangar) || load(t.fleet) > t.economy.hangar
      || keys.some(k => !valid(t.economy!.stock[k]) || !valid(t.economy!.rate[k]))
      || t.economy.windows.some(w => !valid(w.start) || !valid(w.end) || w.end < w.start)
      || fleetEntries(t.fleet).some(([h]) => HULLS[h].ground || HULLS[h].requiredResearch.length > 0)))
    || s.windows.some(w => !valid(w.start) || !valid(w.end) || w.end < w.start)
    || [s.initialFleet, s.desiredFleet, s.packet].some(f => fleetEntries(f).some(([h]) => HULLS[h].ground))
    || s.packetChoices?.some(f => fleetCount(f) === 0 || fleetEntries(f).some(([h]) => HULLS[h].ground))
    || Object.values(s.hullRequires ?? {}).some(ids => ids.some(id => !actionIds.has(id)))
    || Object.entries(s.infrastructure ?? {}).some(([id, effect]) => !actionIds.has(id)
      || !valid(effect.hangarGain ?? 0) || !Number.isInteger(effect.yardLevel ?? 0) || (effect.yardLevel ?? 0) < 0)
    || s.shocks?.some(shock => !valid(shock.at) || !valid(shock.homeLossFraction) || shock.homeLossFraction > 1)
    || actionIds.size !== s.development.length || s.development.some(a => !valid(a.minutes) || a.minutes === 0
      || a.requires.some(id => !actionIds.has(id) || id === a.id)
      || !valid(a.notBefore ?? 0) || (a.expiresAt !== undefined && (!valid(a.expiresAt) || a.expiresAt <= (a.notBefore ?? 0)))
      || keys.some(k => !valid(a.cost[k]) || !valid(a.rateGain?.[k] ?? 0)))
    || !Number.isFinite(speedMultiplier) || speedMultiplier < 1 || speedMultiplier > 1.5
    || !Number.isFinite(minimumDispatchFraction) || minimumDispatchFraction <= 0 || minimumDispatchFraction > 1
    || (s.maxExpectedLossFraction !== undefined && (!Number.isFinite(s.maxExpectedLossFraction)
      || s.maxExpectedLossFraction < 0 || s.maxExpectedLossFraction > 1))
    || (s.baseRoundTripAt1250 !== undefined && (!Number.isFinite(s.baseRoundTripAt1250) || s.baseRoundTripAt1250 <= engagement))
    || load(s.initialFleet) > s.hangar) throw new Error('Invalid physical session');
  assertAcyclic(s.development);
  const tempo = s.baseRoundTripAt1250 === undefined ? 1
    : 2 * fleetTravelExact(1250, s.packet, { boost: 1, tech: {} }) / (s.baseRoundTripAt1250 - engagement);
  const flight = (distance: number, fleet: Fleet, tech: TechLevels) => fleetTravelExact(distance, fleet,
    { boost: s.world?.initial.design ? designSpeed(tech) : tempo * speedMultiplier, tech: {} });
  const home = { ...s.initialFleet }, away: Fleet = {}, built: Fleet = {}, losses: Fleet = {};
  const world = s.world ? cloneWorld(s.world.initial) : null;
  let yard = s.yard, hangar = s.hangar;
  const stock = { ...s.stock }, rate = { ...s.rate }, produced = zero(), works = zero(), overflow = zero(), spent = zero();
  const developmentStarted: Record<string, number> = {}, developmentCompleted: Record<string, number> = {};
  const firstBuilt: Partial<Record<HullId, number>> = {};
  const jobs: { action: Action; due: number; done: boolean }[] = [];
  const targets = s.targets.map(t => ({ ...t, fleet: { ...t.fleet }, attempted: false }));
  const defenders = targets.flatMap((t, targetIndex) => t.economy ? [{ id: t.id, targetIndex,
    config: t.economy, initial: { ...t.fleet }, stock: { ...t.economy.stock }, works: zero(),
    produced: zero(), overflow: zero(), spent: zero(), built: emptyFleet(), losses: emptyFleet(),
    maxCommittedBulk: load(t.fleet) }] : []);
  const defenderOrders: { defender: number; hull: HullId; count: number; at: number; due: number; done: boolean }[] = [];
  const defenderRecovery: { collapsedAt: number | null; halfAt: number | null; fullAt: number | null }[] =
    defenders.map(() => ({ collapsedAt: null, halfAt: null, fullAt: null }));
  const forecasts = new Map<string, { victoryRate: number; meanLoss: number }>();
  const intelSpent = zero();
  const probes: { target: string; at: number; seenAt: number; returnAt: number; fleet?: Fleet; tech?: TechLevels; delivered: boolean }[] = [];
  const reportFor = (id: string, at: number) => probes.findLast(p => p.target === id && p.delivered
    && at - p.seenAt <= s.intel!.maxAgeMinutes);
  const worth = (f: Fleet) => { const c = cost(f); return world?.design ? designEffort(c) : c.alloy + 3 * c.crystal + 90 * c.deuterium; };
  const acceptable = (send: Fleet, target: Target) => {
    if (s.maxExpectedLossFraction === undefined) return true;
    const key = JSON.stringify([send, target.fleet, world?.tech, target.tech]);
    let forecast = forecasts.get(key);
    if (!forecast) {
      let victoryRate = 0, meanLoss = 0;
      for (let i = 0; i < 16; i++) {
        const r = resolveCombat(send, target.fleet, 0, mulberry32(0xc0de + i),
          { attacker: { tech: world?.tech ?? {} }, defender: { tech: target.tech ?? {} } });
        if (fleetCount(r.attackerSurvivors) > 0 && !fleetCount(r.defenderSurvivors)) victoryRate += 1 / 16;
        meanLoss += worth(r.attackerLosses) / worth(send) / 16;
      }
      forecast = { victoryRate, meanLoss }; forecasts.set(key, forecast);
    }
    return forecast.victoryRate >= 0.75 && forecast.meanLoss <= s.maxExpectedLossFraction;
  };
  const orders: { hull: HullId; count: number; at: number; due: number; done: boolean }[] = [];
  const shocks: { at: number; before: Fleet; lost: Fleet; actualLossFraction: number; recoveredAt: number | null }[] = [];
  const launches: { target: string; at: number; battleAt: number; returnAt: number | null;
    sent: Fleet; attackerTech: TechLevels; defenderTech?: TechLevels; defenderAtBattle?: Fleet; survivors?: Fleet; lost?: Fleet; grade?: string; winningLossFraction?: number | null }[] = [];
  interface Event { time: number; kind: 'decision' | 'built' | 'battle' | 'returned' | 'development' | 'shock' | 'defender-decision' | 'defender-built' | 'probe-seen' | 'probe-returned'; index: number; seq: number }
  const events: Event[] = [];
  let seq = 0, now = 0, activeFlights = 0, fuelSpent = 0, maxCommittedBulk = load(home);
  const push = (time: number, kind: Event['kind'], index = 0) => events.push({ time, kind, index, seq: seq++ });
  const decisions = new Set<number>();
  for (const w of s.windows) for (let t = w.start; t < Math.min(w.end, s.end); t += 2) decisions.add(t);
  for (const t of decisions) push(t, 'decision');
  for (const [index, shock] of (s.shocks ?? []).entries()) push(shock.at, 'shock', index);
  for (const [index, d] of defenders.entries()) {
    const times = new Set<number>();
    for (const w of d.config.windows) for (let t = w.start; t < Math.min(w.end, s.end); t += 2) times.add(t);
    for (const t of times) push(t, 'defender-decision', index);
  }
  const advance = (t: number) => {
    for (const k of keys) {
      const gain = (t - now) / 60 * rate[k];
      const cap = world ? worldStats(world).works[k] : 12 * rate[k];
      const accepted = Math.min(gain, Math.max(0, cap - works[k]));
      works[k] += accepted; produced[k] += accepted; overflow[k] += gain - accepted;
    }
    for (const d of defenders) for (const k of keys) {
      const gain = (t - now) / 60 * d.config.rate[k];
      const accepted = Math.min(gain, Math.max(0, 12 * d.config.rate[k] - d.works[k]));
      d.works[k] += accepted; d.produced[k] += accepted; d.overflow[k] += gain - accepted;
    }
    now = t;
  };
  while (events.length) {
    const decision = (event: Event) => event.kind === 'decision' || event.kind === 'defender-decision';
    events.sort((a, b) => a.time - b.time || Number(decision(a)) - Number(decision(b)) || a.seq - b.seq);
    const e = events.shift()!;
    if (e.time > s.end) break;
    advance(e.time);
    if (e.kind === 'defender-built') {
      const o = defenderOrders[e.index]!, d = defenders[o.defender]!; o.done = true;
      add(targets[d.targetIndex]!.fleet, { [o.hull]: o.count }); add(d.built, { [o.hull]: o.count });
    } else if (e.kind === 'defender-decision') {
      const d = defenders[e.index]!, target = targets[d.targetIndex]!;
      for (const k of keys) {
        const take = Math.min(d.works[k], Math.max(0, 48 * d.config.rate[k] - d.stock[k]));
        d.stock[k] += take; d.works[k] -= take;
      }
      const pending = defenderOrders.filter(o => o.defender === e.index && !o.done);
      if (pending.length < 3) for (const [h, desired] of fleetEntries(d.initial)) {
        if (d.config.yard < HULLS[h].minShipyard) continue;
        const queued = pending.filter(o => o.hull === h).reduce((sum, o) => sum + o.count, 0);
        const committed = load(target.fleet) + pending.reduce((sum, o) => sum + bulk(o.hull) * o.count, 0);
        let count = Math.min(desired - (target.fleet[h] ?? 0) - queued, Math.floor((d.config.hangar - committed) / bulk(h)));
        const price = cost({ [h]: 1 });
        for (const k of keys) if (price[k]) count = Math.min(count, Math.floor(d.stock[k] / price[k]));
        if (d.config.batchRebuild && count < desired - (target.fleet[h] ?? 0) - queued) continue;
        if (count < Math.min(desired - (target.fleet[h] ?? 0) - queued,
          Math.ceil(desired * (d.config.minimumRebuildFraction ?? 0)))) continue;
        if (count <= 0) continue;
        const bill = cost({ [h]: count });
        for (const k of keys) { d.stock[k] -= bill[k]; d.spent[k] += bill[k]; }
        const due = Math.max(e.time, ...pending.map(o => o.due)) + shipMinutes(bill, d.config.yard, {});
        defenderOrders.push({ defender: e.index, hull: h, count, at: e.time, due, done: false });
        push(due, 'defender-built', defenderOrders.length - 1);
        d.maxCommittedBulk = Math.max(d.maxCommittedBulk, committed + bulk(h) * count);
        break;
      }
    } else if (e.kind === 'shock') {
      const before = { ...home }; add(before, away);
      const lost: Fleet = {};
      for (const [h, n] of fleetEntries(home)) {
        const count = Math.floor(n * s.shocks![e.index]!.homeLossFraction);
        if (count > 0) lost[h] = count;
      }
      add(home, lost, -1); add(losses, lost);
      shocks.push({ at: e.time, before, lost, actualLossFraction: worth(before) ? worth(lost) / worth(before) : 0, recoveredAt: null });
    } else if (e.kind === 'probe-seen') {
      const p = probes[e.index]!, target = targets.find(t => t.id === p.target)!;
      p.fleet = { ...target.fleet }; p.tech = { ...target.tech };
    } else if (e.kind === 'probe-returned') {
      probes[e.index]!.delivered = true; activeFlights--;
    } else if (e.kind === 'development') {
      const j = jobs[e.index]!; j.done = true; developmentCompleted[j.action.id] = e.time;
      for (const k of keys) rate[k] += j.action.rateGain?.[k] ?? 0;
      if (world) {
        completeWorldOrder(world, s.world!.orders[j.action.id]!);
        const stats = worldStats(world); Object.assign(rate, stats.rate); yard = stats.yard;
      }
      const effect = s.infrastructure?.[j.action.id];
      yard = Math.max(yard, effect?.yardLevel ?? 0); hangar += effect?.hangarGain ?? 0;
    } else if (e.kind === 'built') {
      const o = orders[e.index]!; o.done = true;
      add(home, { [o.hull]: o.count }); add(built, { [o.hull]: o.count });
      firstBuilt[o.hull] ??= e.time;
    } else if (e.kind === 'battle') {
      const l = launches[e.index]!, target = targets.find(t => t.id === l.target)!;
      l.defenderAtBattle = { ...target.fleet }; l.defenderTech = { ...target.tech };
      const r = resolveCombat(l.sent, target.fleet, 0, mulberry32(s.seed + e.index),
        { attacker: { tech: l.attackerTech }, defender: { tech: l.defenderTech } });
      target.fleet = { ...r.defenderSurvivors }; add(target.fleet, r.defenceSalvage);
      const defenderIndex = defenders.findIndex(d => d.id === target.id);
      const defender = defenders[defenderIndex];
      if (defender) {
        add(defender.losses, r.defenderLosses);
        const recovery = defenderRecovery[defenderIndex]!;
        if (recovery.collapsedAt === null && worth(target.fleet) < worth(defender.initial) / 2) recovery.collapsedAt = e.time;
      }
      add(away, r.attackerLosses, -1); add(losses, r.attackerLosses);
      l.survivors = r.attackerSurvivors; l.lost = r.attackerLosses; l.grade = r.grade;
      l.winningLossFraction = fleetCount(r.attackerSurvivors) && !fleetCount(r.defenderSurvivors)
        ? worth(r.attackerLosses) / worth(l.sent) : null;
      if (fleetCount(l.survivors)) {
        l.returnAt = e.time + flight(target.distance, l.survivors, l.attackerTech);
        push(l.returnAt, 'returned', e.index);
      } else activeFlights--;
    } else if (e.kind === 'returned') {
      const l = launches[e.index]!;
      add(home, l.survivors!); add(away, l.survivors!, -1); activeFlights--;
    } else {
      for (const k of keys) {
        const take = Math.min(works[k], Math.max(0, (world ? worldStats(world).storage[k] : 48 * rate[k]) - stock[k]));
        stock[k] += take; works[k] -= take;
      }
      const fraction = (packet: Fleet) => Math.min(1, ...fleetEntries(packet).map(([h, n]) => (home[h] ?? 0) / n));
      const packet = (s.packetChoices ?? [s.packet]).find(p => fraction(p) >= minimumDispatchFraction) ?? s.packet;
      const availableFraction = fraction(packet);
      const send: Fleet = Object.fromEntries(fleetEntries(packet)
        .map(([h, n]) => [h, Math.floor(n * availableFraction)]));
      const intelReady = !s.intel?.requires?.some(id => developmentCompleted[id] === undefined);
      if (s.intel && intelReady && fleetCount(send) && activeFlights < (world ? worldStats(world).bays : s.bays)) {
        const unknown = targets.find(t => (t.economy !== undefined || !t.attempted) && !reportFor(t.id, e.time)
          && (() => {
            const last = probes.findLast(p => p.target === t.id && p.delivered);
            return !last || acceptable(send, { ...t, fleet: last.fleet!, tech: last.tech });
          })()
          && !probes.some(p => p.target === t.id && (!p.delivered || e.time - p.at < PROBE.retargetCooldownMinutes)));
        const probeLeg = unknown ? travelExact(unknown.distance, PROBE.speed) : 0;
        if (unknown && (s.seasonEnd === undefined || e.time + 2 * probeLeg <= s.seasonEnd)
          && stock.alloy >= PROBE.alloy && stock.crystal >= PROBE.crystal) {
          for (const k of ['alloy', 'crystal'] as const) { stock[k] -= PROBE[k]; spent[k] += PROBE[k]; intelSpent[k] += PROBE[k]; }
          const leg = probeLeg;
          probes.push({ target: unknown.id, at: e.time, seenAt: e.time + leg, returnAt: e.time + 2 * leg, delivered: false });
          activeFlights++; push(e.time + leg, 'probe-seen', probes.length - 1); push(e.time + 2 * leg, 'probe-returned', probes.length - 1);
        }
      }
      const target = fleetCount(send) > 0 ? targets.find(t => (t.economy
        ? fleetCount(t.fleet) > 0 && !launches.some(l => l.target === t.id && l.battleAt > e.time)
          && launches.filter(l => l.target === t.id && l.at > e.time - ABUSE.bashWindowMinutes).length < ABUSE.bashLimit
        : !t.attempted) && (!s.intel || (intelReady && reportFor(t.id, e.time)))
          && acceptable(send, s.intel ? { ...t, fleet: reportFor(t.id, e.time)!.fleet!, tech: reportFor(t.id, e.time)!.tech } : t)) : undefined;
      if (target && activeFlights < (world ? worldStats(world).bays : s.bays) && availableFraction >= minimumDispatchFraction && fleetCount(send) > 0) {
        const fuel = fuelFor(send, target.distance);
        const leg = flight(target.distance, send, world?.tech ?? {});
        // Match the server's launch check: the planned full return may equal season end.
        if ((s.seasonEnd === undefined || e.time + 2 * leg + engagement <= s.seasonEnd)
          && stock.deuterium >= fuel) {
          stock.deuterium -= fuel; fuelSpent += fuel; spent.deuterium += fuel;
          target.attempted = true; activeFlights++; add(home, send, -1); add(away, send);
          const battleAt = e.time + leg + engagement;
          launches.push({ target: target.id, at: e.time, battleAt, returnAt: null, sent: send, attackerTech: { ...world?.tech } });
          push(battleAt, 'battle', launches.length - 1);
        }
      }
      const pending = orders.filter(o => !o.done);
      const yardJobs = jobs.filter(j => !j.done && j.action.queue === 'yard');
      let desiredFleet = s.desiredFleet;
      if (s.fleetBudgetHours !== undefined && world) {
        const owned = { ...home }; add(owned, away);
        const ready = (h: HullId) => yard >= HULLS[h].minShipyard
          && (requirements[h] ?? HULLS[h].requiredResearch).every(r => (world.tech[r.project] ?? 0) >= r.level);
        const tier = ready('CATACLYSM') ? 4 : ready('TEMPEST') ? 3 : ready('VIPER') ? 2 : 1;
        desiredFleet = { ...designFleetTarget(rate, owned, tier, s.fleetBudgetHours),
          ...(s.desiredFleet.COURIER ? { COURIER: s.desiredFleet.COURIER } : {}) };
      }
      if (pending.length + yardJobs.length < 3) for (const [h, desired] of fleetEntries(desiredFleet)) {
        if (yard < HULLS[h].minShipyard) continue;
        if (world && (requirements[h] ?? []).some(req => (world.tech[req.project] ?? 0) < req.level)) continue;
        if (!(s.hullRequires?.[h] ?? []).every(id => developmentCompleted[id] !== undefined)) continue;
        const queued = pending.filter(o => o.hull === h).reduce((n, o) => n + o.count, 0);
        const missing = desired - (home[h] ?? 0) - (away[h] ?? 0) - queued;
        const committed = load(home) + load(away) + pending.reduce((n, o) => n + bulk(o.hull) * o.count, 0);
        let count = Math.min(missing, Math.floor((hangar - committed) / bulk(h)));
        const price = cost({ [h]: 1 });
        for (const k of keys) if (price[k]) count = Math.min(count, Math.floor(stock[k] / price[k]));
        if (count <= 0) continue;
        const bill = cost({ [h]: count });
        const minutes = world?.design ? designHull(h).workMinutes * count / (1 + 0.12 * yard) * yardSpeedMult(world.tech)
          : shipMinutes(bill, yard, world?.tech ?? {});
        const due = Math.max(e.time, ...pending.map(o => o.due), ...yardJobs.map(j => j.due)) + minutes;
        if (s.seasonEnd !== undefined && due >= s.seasonEnd) continue;
        for (const k of keys) { stock[k] -= bill[k]; spent[k] += bill[k]; }
        orders.push({ hull: h, count, at: e.time, due, done: false }); push(due, 'built', orders.length - 1);
        maxCommittedBulk = Math.max(maxCommittedBulk, committed + bulk(h) * count);
        break;
      }
      const quoted = (a: Action): Action | null => {
        if (!world) return a;
        const projected = cloneWorld(world);
        for (const j of jobs.filter(j => !j.done && j.action.queue === a.queue)) completeWorldOrder(projected, s.world!.orders[j.action.id]!);
        const quote = quoteWorldOrder(projected, s.world!.orders[a.id]!, e.time);
        if (quote && keys.some(k => quote.cost[k] > Math.max(stock[k], worldStats(world).storage[k]))) return null;
        return quote ? { ...a, ...quote } : null;
      };
      const candidateAction = s.development.find(a => developmentStarted[a.id] === undefined
        && e.time >= (a.notBefore ?? 0) && (a.expiresAt === undefined || e.time < a.expiresAt)
        && a.requires.every(id => developmentCompleted[id] !== undefined)
        && jobs.filter(j => !j.done && j.action.queue === a.queue).length
          + (a.queue === 'yard' ? orders.filter(o => !o.done).length : 0) < 3 && quoted(a) !== null);
      const action = candidateAction ? quoted(candidateAction) : null;
      const reserve = action ? developmentReserve(rate, world ? worldStats(world).storage
        : { alloy: rate.alloy * 48, crystal: rate.crystal * 48, deuterium: rate.deuterium * 48 }, action.cost, s.developmentReserveHours ?? 0) : zero();
      if (action && keys.every(k => stock[k] - action.cost[k] >= reserve[k])) {
        const due = Math.max(e.time, ...jobs.filter(j => !j.done && j.action.queue === action.queue).map(j => j.due),
          ...(action.queue === 'yard' ? orders.filter(o => !o.done).map(o => o.due) : [])) + action.minutes;
        if (s.seasonEnd === undefined || due < s.seasonEnd) {
          for (const k of keys) { stock[k] -= action.cost[k]; spent[k] += action.cost[k]; }
          developmentStarted[action.id] = e.time; jobs.push({ action, due, done: false });
          push(due, 'development', jobs.length - 1);
        }
      }
    }
    for (const shock of shocks) if (shock.recoveredAt === null
      && fleetEntries(shock.before).every(([h, n]) => (home[h] ?? 0) + (away[h] ?? 0) >= n)) shock.recoveredAt = e.time;
    for (const [index, d] of defenders.entries()) {
      const recovery = defenderRecovery[index]!;
      if (recovery.collapsedAt === null) continue;
      const value = worth(targets[d.targetIndex]!.fleet), reference = worth(d.initial);
      if (recovery.halfAt === null && value >= reference / 2) recovery.halfAt = e.time;
      if (recovery.fullAt === null && value >= reference) recovery.fullAt = e.time;
    }
  }
  advance(s.end);
  const hullConservationError = Object.fromEntries([...new Set(fleets.flatMap(f => fleetEntries(f).map(([h]) => h)))].map(h =>
    [h, (s.initialFleet[h] ?? 0) + (built[h] ?? 0) - (losses[h] ?? 0) - (home[h] ?? 0) - (away[h] ?? 0)]));
  return { launches, probes, intelSpent, orders, home, away, built, losses, targets, stock, rate, works, produced, overflow, spent,
    defenders: defenders.map((d, index) => ({ ...d, fleet: targets[d.targetIndex]!.fleet, recovery: defenderRecovery[index]!,
      orders: defenderOrders.filter(o => o.defender === index),
      hullConservationError: Object.fromEntries(fleetEntries(d.initial).map(([h, n]) =>
        [h, n + (d.built[h] ?? 0) - (d.losses[h] ?? 0) - (targets[d.targetIndex]!.fleet[h] ?? 0)])),
      resourceConservationError: Object.fromEntries(keys.map(k =>
        [k, d.config.stock[k] + d.produced[k] - d.spent[k] - d.stock[k] - d.works[k]])) })),
    developmentStarted, developmentCompleted, firstBuilt, jobs, infrastructure: { yard, hangar }, shocks, world,
    fuelSpent, maxCommittedBulk, hullConservationError,
    resourceConservationError: Object.fromEntries(keys.map(k => [k, s.stock[k] + produced[k] - spent[k] - stock[k] - works[k]])) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const distance of [500, 1250, 2500]) for (const minutes of [15, 90, 150]) for (const seed of [1, 42, 1337])
    for (const reservePackets of [1, 2]) for (const development of [false, true])
      for (const baseRoundTripAt1250 of [null, 15, 25]) for (const catalog of ['live', 'candidate'] as const)
        for (const minimumDispatchFraction of [0.5, 1]) {
    const scenario = sessionScenario(); scenario.windows = [{ start: 0, end: minutes }]; scenario.end = minutes + 120;
    scenario.seed = seed; scenario.targets = scenario.targets.map(t => ({ ...t, distance }));
    scenario.minimumDispatchFraction = minimumDispatchFraction;
    scenario.initialFleet = { VIPER: 24 * reservePackets }; scenario.desiredFleet = { ...scenario.initialFleet };
    scenario.hangar = fleetBulk(scenario.initialFleet);
    if (catalog === 'candidate') {
      scenario.roster = prototypeRoster(1.1, 0.52, 0); scenario.bulk = { VIPER: 5, SENTINEL: 5 };
      scenario.hangar = 24 * reservePackets * 5;
      scenario.targets = scenario.targets.map(t => ({ ...t, fleet: { SENTINEL: 24 } }));
    }
    if (baseRoundTripAt1250 !== null) scenario.baseRoundTripAt1250 = baseRoundTripAt1250;
    if (development) scenario.development = [{ id: 'industry', queue: 'construction', minutes: 60, requires: [],
      cost: { alloy: 6000, crystal: 1800, deuterium: 100 }, rateGain: { alloy: 150, crystal: 60, deuterium: 10 } }];
    rows.push({ distance, minutes, seed, reservePackets, development, baseRoundTripAt1250, catalog, minimumDispatchFraction,
      scenario, result: fleetSession(scenario) });
  }
  const files = ['tools/fleet-session-study.ts', 'tools/costed-world.ts', 'packages/rules/src/research.ts', 'packages/rules/src/tech.ts', 'tools/fleet-economy-study.ts', 'packages/rules/src/hulls.ts',
    'packages/rules/src/combat.ts', 'packages/rules/src/economy.ts', 'packages/rules/src/fuel.ts',
    'packages/rules/src/travel.ts', 'packages/rules/src/constants.ts', 'tools/fleet-economy-next-study.ts', 'tools/economy-calendar-model.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    caveat: 'Physical session baseline plus candidate g1.1/l.52/flat-role roster with independent bulk5 for T2. Candidate defender24 versus live defender12: not an equal-difficulty causal comparison. Optional 15/25 minute base tempo is an explicit flight-only candidate. Initial fleet/stock, yard4, hangar and gates assumed prepared, not paid from a season. Reserve fleet increases initial military wealth, not free efficiency. Known stationary targets, no shield/tech, one visit each, no loot/debris/defender economy or counter-raids. 12h Works/48h storage and industry bundle are prototypes. Current shipMinutes is retained and needs new production calibration. Not full new economy validation.', rows }, null, 2) + '\n');
}
