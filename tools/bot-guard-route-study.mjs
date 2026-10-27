/** Paid route replay against a dedicated LOCAL database. No production credentials or worker. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asc, eq } from '../apps/server/node_modules/drizzle-orm/index.js';
import { createDb } from '../apps/server/src/db/client.ts';
import { runMigrations } from '../apps/server/src/db/migrate.ts';
import { FixedClock } from '../apps/server/src/clock.ts';
import { makeAccount, truncateAll, pinnedKey } from '../apps/server/test/helpers.ts';
import { botProfiles, buildOrders, researchOrders, scheduledEvents, seasons } from '../apps/server/src/db/schema.ts';
import { createSeason } from '../apps/server/src/services/season.ts';
import { joinSeason } from '../apps/server/src/services/player.ts';
import { collectWorks, upgradeBuilding, buildUnits, installSatellite, raiseInstrument } from '../apps/server/src/services/build.ts';
import { completeResearch, applyResearchCompletion } from '../apps/server/src/services/research.ts';
import { applyBuildCompletion } from '../apps/server/src/services/buildQueue.ts';
import { GameError } from '../apps/server/src/services/planet.ts';
import { claimReward, rewardsView } from '../apps/server/src/services/rewards.ts';
import { claimableRouteRewards, guardRoute, selectedGoals, quoteGoal, completedLevel } from './bot-guard-route.mjs';

const rules = await import(process.env.GUARD_ROUTE_RULES ?? '../packages/rules/src/index.ts');
const { ACADEMY_STEPS, hashSeed, mulberry32, missionFuel, fleetValue } = rules;
const keys = ['alloy', 'crystal', 'deuterium'];
const zero = () => ({ alloy: 0, crystal: 0, deuterium: 0 });
const waitCodes = new Set(['QUEUE_FULL', 'QUEUE_SETTLING', 'RESEARCH_QUEUE_FULL', 'RESEARCH_CEILING',
  'CORE_CEILING', 'NEEDS_HULL_RESEARCH', 'SHIPYARD_TOO_LOW', 'RESEARCH_UNAVAILABLE', 'HANGAR_FULL',
  'SATELLITE_SLOTS_FULL', 'ORBIT_FULL']);

export function nextSessionMinute(after, schedule) {
  const windows = schedule === 'dense' ? [[0, 180], [240, 420], [480, 660], [720, 900]]
    : schedule === 'one-session' ? [[0, 60]] : [[0, 60], [360, 420], [780, 840]];
  const firstDay = Math.floor(after / 1440);
  for (let day = firstDay; day <= firstDay + 3; day++) {
    if (schedule === 'missed-day' && day === 2) continue;
    for (const [start, end] of windows) {
      const at = Math.max(after, day * 1440 + start);
      if (at < day * 1440 + end - 0.00001) return at;
    }
  }
  throw new Error('No upcoming session');
}

function snapshot(view) {
  return {
    buildings: view.buildings,
    research: Object.fromEntries(view.research.filter(r => r.level > 0).map(r => [r.id, r.level])),
    orbit: view.orbit,
    fleet: view.fleet,
    ground: view.ground,
    capacity: view.capacity,
    rates: Object.fromEntries(keys.map(k => [k, view.planet[`${k}PerHour`]])),
    caps: Object.fromEntries(keys.map(k => [k, view.planet[`${k}Cap`]])),
    stock: Object.fromEntries(keys.map(k => [k, view.planet[k]])),
    works: view.planet.works,
    fleetValue: fleetValue(view.fleet),
    fuelAt1000: missionFuel(Object.fromEntries(Object.entries(view.fleet)
      .filter(([id]) => id !== 'PROSPECTOR').map(([id, n]) => [id, Math.floor(n * 0.8)])), 1000, 2),
  };
}

export async function runGuardRouteStudy({ variant = 'balanced', days = 30, schedule = 'three-sessions' } = {}) {
  const url = new URL(process.env.GUARD_ROUTE_DATABASE_URL ?? 'postgres://astera:astera@127.0.0.1:5433/astera_guard_route_test');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5433' || url.pathname !== '/astera_guard_route_test') {
    throw new Error('This study only permits the dedicated local astera_guard_route_test database on port 5433');
  }
  const connection = createDb(url.href, { max: 1, applicationName: 'guard-route-study' });
  const { db } = connection;
  const start = new Date('2026-10-27T05:00:00.000Z'); // 08:00 Türkiye; the existing 01–08 blackout remains.
  const clock = new FixedClock(start);
  const route = guardRoute(variant, days >= 60);
  const result = { variant, days, schedule, starting: null, milestones: {}, purchases: [], serviceWaits: {},
    capacityWaits: {}, resourceWaits: {}, unexpectedErrors: [], spent: zero(), rewards: [], rewardTotals: zero(), minimumResources: Infinity,
    paymentChecks: 0, turns: 0, finished: false, final: null, remaining: [] };
  try {
    await runMigrations(db);
    await truncateAll(db);
    const { season } = await createSeason(db, { shardCode: 'EU-GUARD-STUDY', seed: 4242, startsAt: start,
      initializedAt: start, days, rulesetVersion: 16, playerCap: 60 });
    await db.update(seasons).set({ asteroidKey: pinnedKey(4242) }).where(eq(seasons.id, season.id));
    const account = await makeAccount(db, 'GuardRouteStudy');
    await db.insert(botProfiles).values({ accountId: account.id, ordinal: 0, persona: 'BUILDER', nextActionAt: start, createdAt: start });
    const seat = await joinSeason(db, account.id, season.id, clock, ACADEMY_STEPS.length, 'SERVER');

    const pending = async () => {
      const b = await db.select().from(buildOrders).where(eq(buildOrders.status, 'BUILDING')).orderBy(asc(buildOrders.readyAt));
      const r = await db.select().from(researchOrders).where(eq(researchOrders.status, 'BUILDING')).orderBy(asc(researchOrders.readyAt));
      return [...b.map(order => ({ type: 'build', order })), ...r.map(order => ({ type: 'research', order }))]
        .sort((left, right) => left.order.readyAt - right.order.readyAt);
    };
    const settleUntil = async at => {
      for (let i = 0; i < 100; i++) {
        const first = (await pending())[0];
        if (!first || first.order.readyAt.getTime() > start.getTime() + at * 60_000) break;
        clock.set(first.order.readyAt);
        await db.transaction(async tx => {
          if (first.type === 'build') await applyBuildCompletion(tx, first.order.id, first.order.readyAt.toISOString(), clock);
          else await applyResearchCompletion(tx, first.order.id, first.order.readyAt.toISOString(), clock);
          await tx.update(scheduledEvents).set({ status: 'done', claimedAt: null })
            .where(eq(scheduledEvents.refId, first.order.id));
        });
      }
      clock.set(new Date(start.getTime() + at * 60_000));
    };
    let at = 0;
    for (let turn = 0; at < days * 1440 - 1; turn++) {
      await settleUntil(at);
      let view = (await collectWorks(db, seat.planetId, clock, seat.playerId)).planet;
      result.starting ??= snapshot(view);
      if (variant === 'earned-rewards') {
        for (const id of claimableRouteRewards(await rewardsView(db, seat.planetId, clock))) {
          const claimed = await claimReward(db, seat.planetId, id, clock);
          result.rewards.push({ id, atDays: at / 1440, granted: claimed.granted });
          for (const k of keys) result.rewardTotals[k] += claimed.granted[k];
          view = claimed.planet;
        }
      }
      result.turns++;
      const reserve = zero();
      for (const goal of selectedGoals(view, route)) {
        const { cost, count } = quoteGoal(view, goal);
        const capacity = keys.filter(k => cost[k] > view.planet[`${k}Cap`]);
        const short = keys.filter(k => view.planet[k] - reserve[k] < cost[k]);
        if (capacity.length) {
          result.capacityWaits[goal.key] ??= { count: 0, cost, caps: Object.fromEntries(keys.map(k => [k, view.planet[`${k}Cap`]])) };
          result.capacityWaits[goal.key].count++;
        }
        if (short.length) {
          result.resourceWaits[goal.key] = (result.resourceWaits[goal.key] ?? 0) + 1;
          for (const k of keys) reserve[k] += cost[k];
          continue;
        }
        try {
          let paid;
          if (goal.kind === 'building') paid = await upgradeBuilding(db, seat.planetId, goal.id, clock, seat.playerId,
            goal.id === 'CORE' ? { confirmedLevel: goal.target } : {});
          else if (goal.kind === 'research') paid = await completeResearch(db, seat.planetId, goal.id, clock, seat.playerId);
          else if (goal.kind === 'hull') paid = await buildUnits(db, seat.planetId, goal.id, count, clock, seat.playerId);
          else if (goal.kind === 'satellite') paid = await installSatellite(db, seat.planetId, goal.id, clock, seat.playerId);
          else paid = await raiseInstrument(db, seat.planetId, goal.id, clock, seat.playerId);
          for (const k of keys) {
            const actual = view.planet[k] - paid.planet.planet[k];
            if (Math.abs(actual - cost[k]) > 1.01) throw new Error(`Payment mismatch ${goal.key}/${k}: ${actual} vs ${cost[k]}`);
            result.spent[k] += cost[k];
          }
          result.paymentChecks++;
          result.purchases.push({ atDays: at / 1440, goal: goal.key, count, cost,
            stockBefore: Object.fromEntries(keys.map(k => [k, view.planet[k]])),
            caps: Object.fromEntries(keys.map(k => [k, view.planet[`${k}Cap`]])) });
          view = paid.planet;
        } catch (error) {
          if (!(error instanceof GameError) || !waitCodes.has(error.code)) {
            result.unexpectedErrors.push({ goal: goal.key, message: error.message, code: error.code });
            throw error;
          }
          const key = `${goal.key}/${error.code}`;
          result.serviceWaits[key] = (result.serviceWaits[key] ?? 0) + 1;
          for (const k of keys) reserve[k] += cost[k];
        }
      }
      result.minimumResources = Math.min(result.minimumResources, ...keys.map(k => view.planet[k]));
      const complete = goal => completedLevel(view, goal) >= goal.target;
      for (let i = 0; i < route.length; i++) {
        const mark = route[i].milestone;
        if (mark && !result.milestones[mark] && route.slice(0, i + 1).every(complete)) {
          result.milestones[mark] = { atDays: at / 1440, ...snapshot(view) };
          process.stderr.write(`${variant}/${schedule}: ${mark} at day ${(at / 1440).toFixed(2)}\n`);
        }
      }
      result.remaining = route.filter(goal => !complete(goal)).map(goal => goal.key);
      result.final = snapshot(view);
      if (!result.remaining.length) { result.finished = true; break; }
      at = nextSessionMinute(at + 7 + mulberry32(hashSeed('guard-route-turn', turn))() * 16, schedule);
    }
    return result;
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.ASTERA_INCLUDE_LONG_TESTS !== '1') throw new Error('Explicit route-study opt-in required');
  const variants = (process.env.GUARD_ROUTE_VARIANTS ?? 'balanced').split(',');
  const schedule = process.env.GUARD_ROUTE_SCHEDULE ?? 'three-sessions';
  const days = Number(process.env.GUARD_ROUTE_DAYS ?? 30);
  const results = [];
  for (const variant of variants) results.push(await runGuardRouteStudy({ variant, days, schedule }));
  const report = { measuredAt: new Date().toISOString(), assumptions: {
    actualServerServices: true, fullAcademyStart: true, miningOrLootIncome: 0,
    rewardClaimsAfterJoining: variants.includes('earned-rewards') ? 'only earned season progression tiers, recorded per result' : 0,
    combatLosses: 0, cadence: '7–23 minutes inside explicitly supplied sessions',
    futureTempo: Boolean(process.env.GUARD_ROUTE_RULES),
    caveat: 'A fixed paid development route, not a season balance or PvP effectiveness simulation. Session availability is an input; the live demand-based scheduler does not guarantee these windows.',
  }, route: guardRoute(variants[0], days >= 60), results };
  if (process.env.GUARD_ROUTE_OUTPUT) writeFileSync(process.env.GUARD_ROUTE_OUTPUT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(results.map(r => ({ variant: r.variant, schedule: r.schedule, finished: r.finished,
    turns: r.turns, milestones: Object.fromEntries(Object.entries(r.milestones).map(([k, v]) => [k, v.atDays])),
    remaining: r.remaining, spent: r.spent })), null, 2));
}
