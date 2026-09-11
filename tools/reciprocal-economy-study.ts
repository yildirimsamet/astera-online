/** Shared-clock, paid capital cohort. Fixed ownership; no independent defender wallet or respawns. */
import { ALL_HULLS, HULLS, GALAXY, ABUSE, COMBAT, FUEL, PROBE, fleetEntries, fleetCount, fleetTravelExact, fleetCargo,
  hullBulk, hullRoundTrip, shipMinutes, mulberry32, resolveCombat, computeLoot, withinTierBand, travelExact } from '../packages/rules/src/index.js';
import type { Fleet, HullId, Resources } from '../packages/rules/src/types.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import { cloneWorld, completeWorldOrder, quoteWorldOrder, worldQueue, worldStats, worldProtection, developmentReserve, type WorldOrder } from './costed-world.js';
import { costedScenario } from './costed-progression-study.js';
import { prototypeRoster, withRoster } from './fleet-economy-next-study.js';
import { designHull, designFleetTarget, designSpeed, designEffort } from './economy-design-model.js';
import { yardSpeedMult } from '../packages/rules/src/tech.js';
import type { ActivityProfile } from '../packages/sim/src/player-calendar.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const noHulls = (): Fleet => ({});
const noStarts = (): Record<string, number> => ({});
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const add = (to: Fleet, from: Fleet, sign = 1) => { for (const [h, n] of fleetEntries(from)) to[h] = (to[h] ?? 0) + n * sign; };
const price = (f: Fleet): Resources => Object.fromEntries(keys.map(k => [k,
  fleetEntries(f).reduce((sum, [h, n]) => sum + HULLS[h][k] * n, 0)])) as unknown as Resources;

export function scaleContract(days: number, population: number) {
  if (!Number.isFinite(days) || days < 7 || days > 60 || !Number.isInteger(population) || population < 2) throw new Error('Invalid scale');
  return { days, population, radius: GALAXY.radius * Math.cbrt(population / 300), referenceRoundTrip: [15, 25],
    worksHours: 12, t3Window: [3 / 14 * days, 4 / 14 * days], t4Window: [7 / 14 * days, 8 / 14 * days] };
}
export function reciprocalScenario(days: number, count: number, seed: number) {
  if (![14, 30].includes(days) || !Number.isInteger(count) || count < 3 || count > 30) throw new Error('Invalid cohort');
  const players = Array.from({ length: count }, (_, i) => {
    const profile: ActivityProfile = i % 6 === 4 ? 'low' : i % 6 === 5 ? 'low-once' : 'average';
    const s = costedScenario(profile, days, { earlyMilitary: 0.2, lateMilitary: 0.25 }, 12);
    // Stagger by a few minutes, preserving every participant's actual session length.
    s.windows = s.windows.map(w => ({ start: w.start + i % 4 * 2, end: w.end + i % 4 * 2 }));
    const first = (['DART', 'PIKE', 'WARDEN'] as const)[i % 3]!;
    const second = (['VIPER', 'TALON', 'SENTINEL'] as const)[i % 3]!;
    s.desiredFleet = { CATACLYSM: 2, TEMPEST: 4, [second]: 8, [first]: 2, COURIER: 1 };
    s.packetChoices = [{ CATACLYSM: 2, TEMPEST: 2 }, { TEMPEST: 2, [second]: 4 }, { [second]: 4 }, { [first]: 2 }];
    return { ...s, profile, first, second };
  });
  return { days, end: days * 1440, seed, players, contactCount: 4, distance: 1250, maxLoss: 0.3, dispatchShare: 1 };
}
type Scenario = ReturnType<typeof reciprocalScenario>;

export function reciprocalEconomy(s: Scenario) {
  if (!Number.isFinite(s.end) || s.end <= 0 || !Number.isInteger(s.contactCount) || s.contactCount < 0
    || !Number.isFinite(s.distance) || s.distance <= 0 || !Number.isFinite(s.dispatchShare)
    || s.dispatchShare <= 0 || s.dispatchShare > 1) throw new Error('Invalid shared clock');
  const used = new Set(s.players.flatMap(p => fleetEntries(p.desiredFleet).map(([h]) => h)));
  const requirements = Object.fromEntries([...used].map(h => [h, HULLS[h].requiredResearch]));
  const design = s.players[0]?.world?.initial.design;
  if (s.players.some(p => JSON.stringify(p.world?.initial.design) !== JSON.stringify(design))) throw new Error('Mixed cohort designs');
  const roster = design ? Object.fromEntries(ALL_HULLS.map(h => [h, designHull(h)]))
    : { ...prototypeRoster(1.1, 0.52, 0), COURIER: { ...HULLS.COURIER } };
  const bulk = (h: HullId) => design ? designHull(h).bulk
    : h === 'COURIER' ? hullBulk(h) : [0, 3, 5, 8, 13][HULLS[h].tier ?? 1]!;
  // D195: fuel is a fraction of hull VALUE, tilted by the hull's own round trip.
  const designFuelMass = (h: HullId) => {
    const t = design ? designHull(h) : roster[h]!;
    const trip = (design ? designHull(h).referenceRoundTrip : hullRoundTrip(h))
      ?? FUEL.pivotRoundTrip;
    return Math.max(1, Math.ceil((t.alloy + t.crystal + t.deuterium) * FUEL.perValue
      * (FUEL.pivotRoundTrip / trip)));
  };
  return withRoster(roster, () => {
    const worth = (f: Fleet) => { const c = price(f); return design ? designEffort(c) : c.alloy + 3 * c.crystal + 90 * c.deuterium; };
    const lineWorth = (f: Fleet) => worth(Object.fromEntries(fleetEntries(f).filter(([h]) => HULLS[h].cls !== 'SUPPORT')));
    const load = (f: Fleet) => fleetEntries(f).reduce((sum, [h, n]) => sum + n * bulk(h), 0);
    const players = s.players.map(p => ({ world: cloneWorld(p.world!.initial), profile: p.profile,
      stock: { ...p.stock }, works: zero(), produced: zero(), overflow: zero(), spent: zero(), stolen: zero(),
      received: zero(), discarded: zero(), home: noHulls(), away: noHulls(), built: noHulls(), losses: noHulls(),
      firstBuilt: noHulls(), started: noStarts(), flights: 0,
      probes: 0, fuel: 0, decisionCount: 0, eligibleDecisions: 0, combatDecisions: 0 }));
    const orders: { player: number; at: number; due: number; queue: string; id: string; cost: Resources; done: boolean;
      worldOrder?: WorldOrder; hull?: HullId; count?: number }[] = [];
    const battles: { attacker: number; defender: number; at: number; launch: number; sent: Fleet; defence: Fleet;
      lost: Fleet; defenderLost: Fleet; lossFraction: number | null; loot: Resources; returnAt: number | null }[] = [];
    const missions: { attacker: number; defender: number; at: number; battleAt: number; returned: boolean; cargo: Resources;
      sentCombatValue: number; ownedCombatValue: number }[] = [];
    const reports = players.map(() => new Map<number, { seenAt: number; fleet: Fleet; tech: TechLevels }>());
    const probes = players.map(() => new Map<number, { at: number; returned: boolean }>());
    const transferred = zero();
    let now = 0, serial = 0;
    interface Event { at: number; serial: number; run: () => void }
    const heap: Event[] = [];
    const earlier = (a: Event, b: Event) => a.at < b.at || (a.at === b.at && a.serial < b.serial);
    const push = (at: number, run: () => void) => {
      const e = { at, run, serial: serial++ }; let i = heap.length; heap.push(e);
      while (i > 0) { const parent = (i - 1) >> 1; if (!earlier(e, heap[parent]!)) break; heap[i] = heap[parent]!; i = parent; }
      heap[i] = e;
    };
    const pop = () => {
      const first = heap[0]!, last = heap.pop()!;
      if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1; if (child + 1 < heap.length && earlier(heap[child + 1]!, heap[child]!)) child++;
        if (!earlier(heap[child]!, last)) break; heap[i] = heap[child]!; i = child;
      } heap[i] = last; } return first;
    };
    const advance = (at: number) => {
      for (const p of players) { const stats = worldStats(p.world);
        for (const k of keys) { const potential = stats.rate[k] * (at - now) / 60;
          const gain = Math.min(potential, Math.max(0, stats.works[k] - p.works[k]));
          p.works[k] += gain; p.produced[k] += gain; p.overflow[k] += potential - gain;
        }
      } now = at;
    };
    const pay = (i: number, bill: Resources) => {
      const p = players[i]!; if (keys.some(k => p.stock[k] + 1e-9 < bill[k])) return false;
      for (const k of keys) { p.stock[k] -= bill[k]; p.spent[k] += bill[k]; } return true;
    };
    const legalHull = (i: number, h: HullId) => HULLS[h].minShipyard <= players[i]!.world.buildings.SHIPYARD
      && (requirements[h] ?? HULLS[h].requiredResearch).every(r => (players[i]!.world.tech[r.project] ?? 0) >= r.level);
    const cache = new Map<string, boolean>();
    const acceptable = (i: number, fleet: Fleet, report: { fleet: Fleet; tech: TechLevels }) => {
      const key = JSON.stringify([fleet, report, players[i]!.world.tech]);
      if (!cache.has(key)) { let wins = 0, loss = 0;
        for (let n = 0; n < 4; n++) { const r = resolveCombat(fleet, report.fleet, 0, mulberry32(90210 + n),
          { attacker: { tech: players[i]!.world.tech }, defender: { tech: report.tech } });
          if (fleetCount(r.attackerSurvivors) && !fleetCount(r.defenderSurvivors)) wins++;
          loss += lineWorth(r.attackerLosses) / Math.max(1, lineWorth(fleet));
        } cache.set(key, wins >= 3 && loss / 4 <= s.maxLoss);
      } return cache.get(key)!;
    };
    const decide = (i: number) => {
      const p = players[i]!, config = s.players[i]!, stats = worldStats(p.world); p.decisionCount++;
      for (const k of keys) { const take = Math.min(p.works[k], Math.max(0, stats.storage[k] - p.stock[k])); p.stock[k] += take; p.works[k] -= take; }
      const ownedCombatValue = lineWorth(p.home) + lineWorth(p.away);
      const reserve = now < 1440 ? 0 : ownedCombatValue * (1 - s.dispatchShare);
      const packet = config.packetChoices!.find(f => fleetEntries(f).every(([h, n]) => (p.home[h] ?? 0) >= n)
        && lineWorth(p.home) - lineWorth(f) >= reserve - 1e-8);
      const sent: Fleet = packet ? { ...packet, ...((p.home.COURIER ?? 0) > 0 ? { COURIER: 1 } : {}) } : {};
      const contacts = Array.from({ length: Math.min(s.contactCount, players.length - 1) }, (_, n) =>
        (i + (n % 2 ? -1 : 1) * (Math.floor(n / 2) + 1) + players.length) % players.length);
      const eligible = contacts.filter(j => withinTierBand(p.world.buildings.CORE, players[j]!.world.buildings.CORE)
        && missions.filter(m => m.attacker === i && m.defender === j && m.at > now - ABUSE.bashWindowMinutes).length < ABUSE.bashLimit
        && !missions.some(m => m.attacker === i && m.defender === j && !m.returned));
      if (eligible.length) p.eligibleDecisions++;
      if (packet && p.flights < stats.bays) {
        p.combatDecisions++;
        const unknown = eligible.find(j => {
          const probe = probes[i]!.get(j), report = reports[i]!.get(j);
          return (!report || now - report.seenAt > 60) && (!probe || (probe.returned && now - probe.at >= PROBE.retargetCooldownMinutes))
            && (!report || acceptable(i, sent, report));
        });
        const probeLeg = travelExact(s.distance, PROBE.speed);
        const seasonEnd = config.seasonEnd ?? s.days * 1440;
        if (unknown !== undefined && now + 2 * probeLeg <= seasonEnd
          && pay(i, { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 })) {
          const probe = { at: now, returned: false }; probes[i]!.set(unknown, probe); p.probes++; p.flights++;
          const leg = probeLeg;
          push(now + leg, () => { const report = { seenAt: now, fleet: { ...players[unknown]!.home }, tech: { ...players[unknown]!.world.tech } };
            push(now + leg, () => { reports[i]!.set(unknown, report); probe.returned = true; p.flights--; }); });
        }
        const target = eligible.find(j => { const r = reports[i]!.get(j); return r && now - r.seenAt <= 60 && acceptable(i, sent, r); });
        if (target !== undefined && p.flights < stats.bays) {
          const mass = fleetEntries(sent).reduce((sum, [h, n]) => sum + n * designFuelMass(h), 0);
          const fuel = Math.ceil(mass * s.distance / FUEL.scale) * 2;
          const flightBoost = design ? designSpeed(p.world.tech) : 1;
          const leg = fleetTravelExact(s.distance, sent, { boost: flightBoost, tech: {} });
          if (now + 2 * leg + COMBAT.engagementSeconds / 60 <= seasonEnd
            && pay(i, { alloy: 0, crystal: 0, deuterium: fuel })) {
            p.fuel += fuel; p.flights++; add(p.home, sent, -1); add(p.away, sent);
            const tech = { ...p.world.tech }, mission = { attacker: i, defender: target, at: now,
              battleAt: now + leg + COMBAT.engagementSeconds / 60, returned: false, cargo: zero(),
              sentCombatValue: lineWorth(sent), ownedCombatValue };
            missions.push(mission);
            push(mission.battleAt, () => {
              const d = players[target]!, defence = { ...d.home };
              const r = resolveCombat(sent, defence, 0, mulberry32(s.seed + battles.length), { attacker: { tech }, defender: { tech: d.world.tech } });
              add(p.away, r.attackerLosses, -1); add(p.losses, r.attackerLosses);
              add(d.home, r.defenderLosses, -1); add(d.home, r.defenceSalvage); add(d.losses, r.defenderLosses);
              const haul = computeLoot(d.stock, d.works, worldProtection(d.world), r.grade, fleetCargo(r.attackerSurvivors, tech));
              for (const k of keys) { d.stock[k] -= haul.fromStock[k]; d.works[k] -= haul.fromBuffer[k]; d.stolen[k] += haul[k]; mission.cargo[k] = haul[k]; transferred[k] += haul[k]; }
              // The server reveals losses, not an exact surviving enemy roster or doctrine.
              // Keep the paid probe snapshot and its original age; do not grant free fresh intel.
              const returnAt = fleetCount(r.attackerSurvivors) ? now + fleetTravelExact(s.distance, r.attackerSurvivors, { boost: flightBoost, tech: {} }) : null;
              battles.push({ attacker: i, defender: target, at: now, launch: mission.at, sent, defence, lost: r.attackerLosses,
                defenderLost: r.defenderLosses, lossFraction: fleetCount(r.attackerSurvivors) && !fleetCount(r.defenderSurvivors)
                  ? lineWorth(r.attackerLosses) / Math.max(1, lineWorth(sent)) : null, loot: { ...mission.cargo }, returnAt });
              if (returnAt === null) { mission.returned = true; p.flights--; }
              else push(returnAt, () => { mission.returned = true; p.flights--; add(p.away, r.attackerSurvivors, -1); add(p.home, r.attackerSurvivors);
                // Like server settleReturn: a full store blocks collection, never destroys earned raid cargo.
                for (const k of keys) {
                  p.stock[k] += mission.cargo[k]; p.received[k] += mission.cargo[k]; mission.cargo[k] = 0;
                }
              });
            });
          }
        }
      }
      const pending = orders.filter(o => o.player === i && !o.done);
      let desiredFleet = config.desiredFleet;
      if (config.fleetBudgetHours !== undefined) {
        if (!design) throw new Error('Fleet budget requires target-derived design');
        const owned = { ...p.home }; add(owned, p.away);
        const tier = legalHull(i, 'CATACLYSM') ? 4 : legalHull(i, 'TEMPEST') ? 3 : legalHull(i, 'VIPER') ? 2 : 1;
        desiredFleet = { ...designFleetTarget(stats.rate, owned, tier, config.fleetBudgetHours),
          ...(config.desiredFleet.COURIER ? { COURIER: config.desiredFleet.COURIER } : {}) };
      }
      for (const [h, desired] of fleetEntries(desiredFleet)) {
        if (!legalHull(i, h) || pending.filter(o => o.queue === 'yard').length >= 3) continue;
        const committed = load(p.home) + load(p.away) + pending.reduce((sum, o) => sum + (o.hull ? bulk(o.hull) * o.count! : 0), 0);
        let count = Math.min(desired - (p.home[h] ?? 0) - (p.away[h] ?? 0) - pending.filter(o => o.hull === h).reduce((sum, o) => sum + o.count!, 0), Math.floor((stats.hangar - committed) / bulk(h)));
        for (const k of keys) if (HULLS[h][k]) count = Math.min(count, Math.floor(p.stock[k] / HULLS[h][k]));
        if (count <= 0) continue;
        const bill = price({ [h]: count });
        const minutes = design ? designHull(h).workMinutes * count / (1 + 0.12 * stats.yard) * yardSpeedMult(p.world.tech)
          : shipMinutes(bill, stats.yard, p.world.tech);
        const due = Math.max(now, ...pending.filter(o => o.queue === 'yard').map(o => o.due)) + minutes;
        if (due >= (config.seasonEnd ?? Infinity) || !pay(i, bill)) continue;
        const o = { player: i, at: now, due, queue: 'yard', id: h, hull: h, count, cost: bill, done: false }; orders.push(o);
        push(due, () => { o.done = true; add(p.home, { [h]: count }); add(p.built, { [h]: count }); p.firstBuilt[h] ??= now; }); break;
      }
      for (const a of config.development) {
        if (p.started[a.id] !== undefined) continue;
        const order = config.world!.orders[a.id]!, queue = worldQueue(order);
        const same = orders.filter(o => o.player === i && !o.done && o.queue === queue);
        if (same.length >= 3) continue;
        const projected = cloneWorld(p.world); for (const o of same) if (o.worldOrder) completeWorldOrder(projected, o.worldOrder);
        const quote = quoteWorldOrder(projected, order, now);
        if (!quote || keys.some(k => quote.cost[k] > Math.max(p.stock[k], stats.storage[k]))) continue;
        const reserve = developmentReserve(stats.rate, stats.storage, quote.cost, config.developmentReserveHours ?? 0);
        const due = Math.max(now, ...same.map(o => o.due)) + quote.minutes;
        if (due < (config.seasonEnd ?? Infinity) && keys.every(k => p.stock[k] - quote.cost[k] >= reserve[k]) && pay(i, quote.cost)) {
          const o = { player: i, at: now, due, queue, id: a.id, cost: quote.cost, worldOrder: order, done: false };
          orders.push(o); p.started[a.id] = now; push(due, () => { o.done = true; completeWorldOrder(p.world, order); });
        } break;
      }
    };
    for (const [i, p] of s.players.entries()) for (const w of p.windows)
      for (let at = w.start; at < Math.min(w.end, s.end); at += 2) push(at, () => { decide(i); });
    while (heap.length && heap[0]!.at <= s.end) { const e = pop(); advance(e.at); e.run(); }
    advance(s.end);
    const resourceError = Object.fromEntries(keys.map(k => [k, players.reduce((sum, p, i) => sum + s.players[i]!.stock[k]
      + p.produced[k] - p.spent[k] - p.stock[k] - p.works[k] - p.discarded[k], 0)
      - missions.reduce((sum, m) => sum + m.cargo[k], 0)]));
    const maxHullError = Math.max(0, ...players.flatMap(p => [...used].map(h => Math.abs((p.built[h] ?? 0)
      - (p.losses[h] ?? 0) - (p.home[h] ?? 0) - (p.away[h] ?? 0)))));
    return { players, orders, battles, missions, transferred, resourceError,
      maxResourceError: Math.max(...Object.values(resourceError).map(Math.abs)), maxHullError };
  });
}
