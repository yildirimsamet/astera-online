import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, expect, it } from 'vitest';
import {
  ACADEMY_STEPS, ALL_HULLS, BUILDING_IDS, HULLS, MULTI_WORLD, PROBE, PROSPECTOR, RESEARCH_PROJECTS, SHIELD, alloyRate, buildingCost, buildingMinutes,
  claimOre, crystalRate, deuteriumRate, piratePosition, productionMult,
  storageCap, fleetEntries, fleetSpeed, fleetTravelExact, fleetSpeedMult, hullWorkMinutes, interceptOrbit, missionFuel, prospectorHold,
  prospectorReturnSpeed, prospectorSpeed, researchMinutes, resolveCombat, shieldHp, travelExact,
  type Fleet, type HullId, type Resources,
} from '@astera/rules';
import { TokenService } from '../src/auth/tokens.js';
import { buildApp } from '../src/app.js';
import { asteroidClaims, battleReports, buildOrders, miningRuns, missions, neutralPlanetState, pirateRaids, planets, playerResearch, researchOrders, rewardGrants, seasons, scheduledEvents, tradeRuns, units } from '../src/db/schema.js';
import { launchMining, loadMiningSnapshot, prospectorsRestingUntil, resolveMiningArrival } from '../src/services/mining.js';
import { buildUnits, collectWorks, upgradeBuilding } from '../src/services/build.js';
import { joinSeason } from '../src/services/player.js';
import { claimReward, rewardsView } from '../src/services/rewards.js';
import { GameError, loadLocked } from '../src/services/planet.js';
import { createSeason } from '../src/services/season.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { launchSettlement, launchTransfer } from '../src/services/movement.js';
import { completeResearch } from '../src/services/research.js';
import { activeGalaxyEvents } from '../src/services/galaxyEvents.js';
import { launchTrade } from '../src/services/trade.js';
import { reinforceNeutral } from '../src/services/neutral.js';
import { EventWorker } from '../src/worker/loop.js';
import { projectPlayerAsteroidField } from '../src/services/asteroidField.js';
import { sensorHistoryForPlayer } from '../src/services/sensorHistory.js';
import { baysOf } from '../src/services/flight.js';
import { hullProductionAccessible } from '../src/services/hullAccess.js';
import { privatePirateField, pirateId } from '../src/services/pirateField.js';
import { launchPirateRaid, resolvePirateArrival, resolvePirateReturn } from '../src/services/pirateRaid.js';
import { giveUnits, makeAccount, placeAt, seedWorld, setLevel, settleBuilds, testDb, testEnv } from './helpers.js';

/** Single-account adversarial proofs. Fixtures and locks use only the isolated test DB. */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

it('cannot unlock capital rewards by supplying a captured high-Core colony to the HTTP API', async () => {
  const f = await seedWorld(2);
  const capital = f.planetIds[0]!;
  const colony = f.planetIds[1]!;
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
    .where(eq(planets.id, colony));
  await setLevel(f.db, capital, 'CORE', 2);
  await setLevel(f.db, colony, 'CORE', 8);
  const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
  try {
    await built.app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const headers = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
    const view = await built.app.inject({ method: 'GET', url: `/api/rewards?planetId=${colony}`, headers });
    expect(view.statusCode).toBe(200);
    const body = view.json<{ chains: { id: string; progress: number }[] }>();
    expect(body.chains.find((chain) => chain.id === 'CORE')?.progress).toBe(2);
    const claim = await built.app.inject({ method: 'POST', url: '/api/rewards/claim', headers,
      payload: { id: 'CORE:7', planetId: colony } });
    expect(claim.statusCode).toBe(400);
    expect(claim.json<{ error: string }>().error).toBe('REWARD_LOCKED');
  } finally {
    await built.close();
  }
});

it('reaches Core 6 but needs additional income for founding after the three checkpoint milestones', async () => {
  const f = await seedWorld(0);
  const account = await makeAccount(f.db, 'FastOpening');
  const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock, ACADEMY_STEPS.length);
  const startedAt = f.clock.now().getTime();
  const id = joined.planetId;
  // No grants, free hulls, merchant, raid or collection is added to this test.
  // The package and its one already-paid Core upgrade come through joinSeason.
  await buildUnits(f.db, id, 'COURIER', 1, f.clock, joined.playerId);
  await settleBuilds(f, id);
  await claimReward(f.db, id, 'CORE:3', f.clock);
  await claimReward(f.db, id, 'RAID:1', f.clock);
  await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  await settleBuilds(f, id);
  await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  await settleBuilds(f, id);
  await claimReward(f.db, id, 'CORE:5', f.clock);
  await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  await settleBuilds(f, id);
  const world = await f.db.transaction((tx) => loadLocked(tx, id, f.clock));
  expect(world.buildings.CORE).toBe(6);
  expect(world.homeFleet.COURIER).toBe(MULTI_WORLD.settlement.transports);
  expect(world.alloy).toBeLessThan(MULTI_WORLD.settlement.charge.alloy);
  expect(world.crystal).toBeGreaterThanOrEqual(MULTI_WORLD.settlement.charge.crystal);
  expect(world.deuterium).toBeGreaterThan(0);
  console.info(`D209 capital-only gate: ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)} minutes;`
    + ` founding alloy shortage ${MULTI_WORLD.settlement.charge.alloy - world.alloy}`);
  expect((f.clock.now().getTime() - startedAt) / 60_000).toBeGreaterThan(26);
});

interface OpeningStrategy {
  producerLevel: 3 | 5 | 6;
  mining: boolean;
  shipyard: 1 | 2;
  asteroidKey?: string;
  route?: 'directT2' | 'raidT1T2' | 'colonyT1T2';
  waves?: 1 | 3;
  merchant?: boolean;
}

async function soloOpeningPlan(
  armyHull: 'PIKE' | 'WARDEN', armyCount: number, repeatRaid: boolean, waitForIncome = false,
  strategy?: OpeningStrategy,
) {
  const f = await seedWorld(0);
  const { season } = await createSeason(f.db, { shardCode: 'SNOWBALL-D209', seed: 4242,
    startsAt: f.clock.now(), playerCap: 300, rulesetVersion: MULTI_WORLD.rulesetVersion });
  if (strategy) {
    // Reproducible TEST-ONLY field, identical for each strategy. The actor never
    // receives this key or the raw schedule; all mining uses earned opaque ids.
    await f.db.update(seasons).set({ asteroidKey: strategy.asteroidKey ?? '00000000-0000-4000-8000-000000004242' })
      .where(eq(seasons.id, season.id));
  }
  const account = await makeAccount(f.db, 'SoloOpening');
  const joined = await joinSeason(f.db, account.id, season.id, f.clock, ACADEMY_STEPS.length);
  const id = joined.planetId;
  const startedAt = f.clock.now().getTime();
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  // Runtime/horizon are measurement bounds, not gameplay time gates. Full T2
  // one-wave invoices are >60k A; do not truncate a legal slow reference at 24h.
  const measurementMinutes = strategy?.route ? 48 * 60 : waitForIncome ? 24 * 60 : 120;
  const benchmarkStartedAt = Date.now();
  const assertRuntimeBudget = () => {
    // Vitest timeout does not cancel an async SQL loop: a timed-out benchmark
    // would keep writing while the next case truncates. Abort HERE, first.
    if (Date.now() - benchmarkStartedAt > (strategy ? 250_000 : 50_000)) {
      throw new Error('benchmark runtime exhausted before the test runner timeout');
    }
  };
  const state = () => f.db.transaction((tx) => loadLocked(tx, id, f.clock));
  const initial = await state();
  const colonyStarts: { planetId: string; initial: typeof initial; startedAt: number }[] = [];
  let foundingCount = 0;
  let capitalCoreGoal = 0;
  let colonyHarvestEnabled = false;
  let tradeEnabled = strategy?.merchant ?? false;
  let deuteriumReserve = 0;
  let prepareArmy: (() => Promise<void>) | undefined;
  const prepaidOrders = new Set((await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, id)))
    .map((order) => order.id));
  const initialRewards = new Set((await f.db.select().from(rewardGrants).where(eq(rewardGrants.playerId, joined.playerId)))
    .filter((reward) => reward.claimedAt !== null).map((reward) => reward.rewardId));
  const next = async () => {
    const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.status, 'pending'))
      .orderBy(asc(scheduledEvents.resolveAt)).limit(1);
    if (!event) throw new Error('no scheduled moment left in solo opening');
    const nextAt = strategy?.mining
      ? Math.min(event.resolveAt.getTime(), f.clock.now().getTime() + 60_000)
      : event.resolveAt.getTime();
    if (nextAt > f.clock.now().getTime()) f.clock.set(new Date(nextAt));
    if ((f.clock.now().getTime() - startedAt) / 60_000 > measurementMinutes) {
      throw new Error('solo route exceeded its measurement horizon');
    }
    await worker.tick();
    await background();
  };
  const until = async (condition: () => Promise<boolean>) => {
    for (let step = 0; step < (strategy ? 2000 : 100); step += 1) {
      if (await condition()) return;
      await next();
    }
    throw new Error('solo opening did not converge within its scheduled-moment budget');
  };
  const fund = async (cost: Resources, label: string, planetId = id) => {
    if (!waitForIncome) return;
    for (let step = 0; step < (strategy ? 2000 : 100); step += 1) {
      await background();
      await collectWorks(f.db, planetId, f.clock, joined.playerId);
      const current = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
      if (current.alloy >= cost.alloy && current.crystal >= cost.crystal
        && current.deuterium >= cost.deuterium) return;
      const boost = productionMult(current.orbit);
      const rates = { alloy: alloyRate(current.buildings.REFINERY) * boost,
        crystal: crystalRate(current.buildings.EXTRACTOR) * boost,
        deuterium: deuteriumRate(current.buildings.DEUTERIUM_PLANT) * boost };
      const waitMinutes = Math.max(...(['alloy', 'crystal', 'deuterium'] as const).map((resource) => {
        const missing = Math.max(0, cost[resource] - current[resource]);
        return missing === 0 ? 0 : rates[resource] > 0 ? missing / rates[resource] * 60 : Infinity;
      }));
      const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.status, 'pending'))
        .orderBy(asc(scheduledEvents.resolveAt)).limit(1);
      // A normal return can fund the purchase earlier than passive production.
      const incomeAt = f.clock.now().getTime() + Math.ceil(waitMinutes * 60) * 1000;
      const nextAt = Math.min(incomeAt, event?.resolveAt.getTime() ?? Infinity,
        strategy?.mining ? f.clock.now().getTime() + 60_000 : Infinity);
      if (!Number.isFinite(nextAt) || (nextAt - startedAt) / 60_000 > measurementMinutes) {
        throw new Error(`cannot legally fund ${label} within ${String(measurementMinutes)} minutes`);
      }
      if (!strategy || step === 0 || step % 30 === 0) console.info(`D209 funding ${label}: minute ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)};`
        + ` store ${current.alloy.toFixed(2)}/${current.crystal.toFixed(2)}/${current.deuterium.toFixed(2)};`
        + ` cost ${cost.alloy}/${cost.crystal}/${cost.deuterium}`);
      f.clock.set(new Date(Math.max(f.clock.now().getTime(), nextAt)));
      await worker.tick();
    }
    throw new Error(`funding ${label} did not converge`);
  };
  const raiseCore = async () => {
    await fund(buildingCost('CORE', (await state()).buildings.CORE), 'Core upgrade');
    await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  };
  const [home] = await f.db.select().from(planets).where(eq(planets.id, id));
  if (!home) throw new Error('no solo capital');
  const neutrals = (await f.db.select().from(planets).where(and(eq(planets.seasonId, season.id), eq(planets.kind, 'NEUTRAL'))))
    .sort((left, right) => Math.hypot(left.x - home.x, left.y - home.y, left.z - home.z)
      - Math.hypot(right.x - home.x, right.y - home.y, right.z - home.z));
  const tierOneIds = new Set((await f.db.select().from(neutralPlanetState)
    .where(eq(neutralPlanetState.tier, 1))).map((row) => row.planetId));
  const tierTwoIds = new Set((await f.db.select().from(neutralPlanetState)
    .where(eq(neutralPlanetState.tier, 2))).map((row) => row.planetId));
  const tierOne = neutrals.find((world) => tierOneIds.has(world.id));
  const tierTwo = neutrals.find((world) => tierTwoIds.has(world.id));
  const firstTarget = strategy?.route === 'directT2' ? tierTwo : tierOne;
  if (!firstTarget) throw new Error('no seeded target of the requested tier');
  let target = firstTarget;
  let targetTier: 1 | 2 = strategy?.route === 'directT2' ? 2 : 1;
  const targetGuard = async () => Object.fromEntries((await f.db.select().from(units)
    .where(and(eq(units.planetId, target.id), eq(units.location, 'home'))))
    .filter((row) => row.count > 0).map((row) => [row.hull, row.count]));
  expect(await targetGuard()).toEqual({ ...MULTI_WORLD.neutral[targetTier].fleet, ...MULTI_WORLD.neutral[targetTier].ground });
  // The first untouched target has its FULL authored dome. Price a wing against
  // that actual seeded shield, never the old T1 zero-shield assumption.
  expect(target.shield).toBe(shieldHp(MULTI_WORLD.neutral[targetTier].instruments.AEGIS));
  console.info(`D209 target: guard ${JSON.stringify(await targetGuard())}; shield ${target.shield}`);
  const inspectRaids = async (label: string) => {
    const reports = await f.db.select().from(battleReports).where(and(
      eq(battleReports.targetPlanetId, target.id), eq(battleReports.attackerPlayerId, joined.playerId)));
    const [claim] = await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.id));
    console.info(`D209 ${label}: minute ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)};`
      + ` reports ${JSON.stringify(reports.map((report) => ({ grade: report.grade, loot: report.loot,
        attackerLosses: report.attackerLosses, defenderLosses: report.defenderLosses })))}`
      + `; remaining guard ${JSON.stringify(await targetGuard())}; claim ${claim?.claimUntil?.toISOString() ?? 'none'}`);
  };
  const background = async () => {
    if (!strategy) return;
    assertRuntimeBudget();
    await collectWorks(f.db, id, f.clock, joined.playerId);
    const earned = await rewardsView(f.db, id, f.clock);
    for (const chain of earned.chains) for (const tier of chain.tiers) {
      if (tier.state === 'claimable') await claimReward(f.db, id, tier.id, f.clock);
    }
    // Parallel progression uses the real surface queue and pays the exact cost.
    const capital = await state();
    if (capital.buildings.CORE < capitalCoreGoal && capital.alloy >= buildingCost('CORE', capital.buildings.CORE).alloy
      && capital.crystal >= buildingCost('CORE', capital.buildings.CORE).crystal) {
      const active = (await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, id)))
        .some((order) => order.kind === 'BUILDING' && order.status === 'BUILDING');
      if (!active) await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
    }
    if (colonyHarvestEnabled) for (const world of colonyStarts) {
      await collectWorks(f.db, world.planetId, f.clock, joined.playerId);
      const colony = await f.db.transaction((tx) => loadLocked(tx, world.planetId, f.clock));
      const dist = Math.hypot(colony.x - home.x, colony.y - home.y, colony.z - home.z);
      const shuttle = { COURIER: 1 };
      const fuel = missionFuel(shuttle, dist, 1);
      const colonyBays = await baysOf(f.db, world.planetId, colony.buildings.CORE);
      if ((colony.homeFleet.COURIER ?? 0) > 0 && colony.deuterium >= fuel
        && colony.alloy + colony.crystal >= 500 && colonyBays.used < colonyBays.total - 1) {
        const alloy = Math.min(1000, Math.floor(colony.alloy));
        const crystal = Math.min(1000 - alloy, Math.floor(colony.crystal));
        await launchTransfer(f.db, joined.playerId, world.planetId, id, shuttle,
          { alloy, crystal, deuterium: 0 }, f.clock);
      }
      const bank = await state(), capitalBays = await baysOf(f.db, id, bank.buildings.CORE);
      if ((bank.homeFleet.COURIER ?? 0) > 2 && bank.deuterium >= fuel + 10
        && capitalBays.used < capitalBays.total - 1) {
        await launchTransfer(f.db, joined.playerId, id, world.planetId, shuttle,
          { alloy: 0, crystal: 0, deuterium: 10 }, f.clock);
      }
    }
    if (tradeEnabled) {
      const bank = await state(), bays = await baysOf(f.db, id, bank.buildings.CORE);
      if ((bank.homeFleet.COURIER ?? 0) >= 2 && bank.crystal >= 2500 && bays.used < bays.total - 1) {
        // Only the active public announcement is read, never future calendar or
        // raw occurrence rows. Swap surplus C, retaining >1,500 for other work.
        const events = await activeGalaxyEvents(f.db, account.id, f.clock);
        for (const event of events) if (event.kind === 'TRADE_SHIP') {
          const crystal = 1000;
          const alloy = Math.floor(crystal * event.rate.crystal / event.rate.alloy);
          const convoy = { COURIER: 2 } as const;
          const hit = interceptOrbit(bank, fleetSpeed(convoy, {}) * fleetSpeedMult(bank.orbit),
            event.orbit, event.expiresAtMinute,
            (f.clock.now().getTime() - season.startsAt.getTime()) / 60_000);
          if (!hit) continue;
          const fuel = missionFuel(convoy, Math.hypot(hit.at.x - bank.x,
            hit.at.y - bank.y, hit.at.z - bank.z), 2);
          const maximumDeuterium = Math.floor(crystal * event.rate.crystal / event.rate.deuterium);
          // A C→D quote that returns less fuel than this convoy burns is a trap,
          // not a speedrun. Otherwise retain the full committed raid/build reserve.
          const buyDeuterium = bank.deuterium < deuteriumReserve
            && maximumDeuterium > fuel && bank.deuterium >= fuel;
          if (!buyDeuterium && bank.deuterium < deuteriumReserve + fuel) continue;
          const want: Resources = buyDeuterium
            ? { alloy: 0, crystal: 0, deuterium: maximumDeuterium }
            : { alloy, crystal: 0, deuterium: 0 };
          try {
            const trade = await launchTrade(f.db, id, { occurrenceId: event.id,
              fleet: convoy, give: { alloy: 0, crystal, deuterium: 0 },
              want }, f.clock, joined.playerId);
            console.info(`D209 merchant: C${crystal}->${JSON.stringify(want)}; minute ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)}; fuel ${trade.fuel}`);
            break;
          } catch (error) {
            if (!(error instanceof GameError)
              || !['CANNOT_INTERCEPT', 'TRADE_WINDOW_CLOSED', 'INSUFFICIENT_FUEL'].includes(error.code)) throw error;
          }
        }
      }
    }
    if (!strategy.mining) return;
    for (const mineId of [id, ...colonyStarts.map((world) => world.planetId)]) {
    await collectWorks(f.db, mineId, f.clock, joined.playerId);
    const current = await f.db.transaction((tx) => loadLocked(tx, mineId, f.clock)), craft = current.homeFleet.PROSPECTOR ?? 0;
    if (craft === 0 || await prospectorsRestingUntil(f.db, mineId, f.clock.now())) continue;
    const bays = await baysOf(f.db, mineId, current.buildings.CORE);
    // Leave one bay for the opening's probes/raid/settlement, never evade the server cap.
    if (bays.used >= bays.total - 1) continue;
    const snapshot = await loadMiningSnapshot(f.db, season.id, f.clock.now());
    const epochs = await sensorHistoryForPlayer(f.db, joined.playerId, season.id, snapshot.startsAt);
    const field = projectPlayerAsteroidField(snapshot, snapshot.asteroidKey, epochs, f.clock.now(), false);
    const minute = (f.clock.now().getTime() - snapshot.startsAt.getTime()) / 60_000;
    const options = field.asteroids.filter((rock) => !rock.isotopeRich).flatMap((rock) => {
      const hit = interceptOrbit(current, prospectorSpeed(current.orbit), rock, rock.expiresAt, minute);
      if (!hit) return [];
      const roundTrip = hit.flightMinutes + travelExact(Math.hypot(hit.at.x - current.x,
        hit.at.y - current.y, hit.at.z - current.z), prospectorReturnSpeed(current.orbit));
      const ore = Math.min(rock.oreRemaining, prospectorHold(current.orbit, {}) * craft);
      return [{ rock, score: ore * (1 - rock.crystalShare) / Math.max(0.01, roundTrip) }];
    }).sort((left, right) => right.score - left.score);
    for (const option of options) {
      try {
        const run = await launchMining(f.db, mineId, option.rock.id, craft, f.clock, joined.playerId);
        console.info(`D209 adaptive mining: ${craft} craft at minute`
          + ` ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)}; capacity ${run.capacity}`);
        break;
      } catch (error) {
        // Known normal target/flight refusals only; do not swallow implementation errors.
        if (!(error instanceof GameError)
          || !['ALREADY_MINING', 'ASTEROID_EMPTY', 'CANNOT_INTERCEPT', 'NO_FREE_BAY'].includes(error.code)) throw error;
      }
    }
    }
  };
  const noFlight = async () => (await f.db.select({ id: missions.id }).from(missions)
    .where(and(eq(missions.ownerPlayerId, joined.playerId), eq(missions.status, 'in_flight'), ne(missions.kind, 'transfer')))).length === 0;
  await buildUnits(f.db, id, 'DART', 1, f.clock, joined.playerId);
  for (const world of neutrals.slice(0, 5)) {
    await launchProbe(f.db, id, world.id, f.clock, joined.playerId);
    await until(noFlight);
  }
  await until(async () => (await state()).buildings.CORE === 3);
  for (const reward of strategy ? [] : ['CORE:3', 'SHIPS:5', 'RAID:1', 'PROBE:1', 'PROBE:3', 'PROBE:5']) {
    await claimReward(f.db, id, reward, f.clock);
  }
  await fund(HULLS.COURIER, 'second Courier');
  await buildUnits(f.db, id, 'COURIER', 1, f.clock, joined.playerId);
  if (strategy) {
    if (strategy.mining) {
      await fund(HULLS.PROSPECTOR, 'second Prospector');
      await buildUnits(f.db, id, 'PROSPECTOR', 1, f.clock, joined.playerId);
    }
    if (strategy.route === 'directT2' || strategy.route === 'colonyT1T2') {
      await fund(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(1), 'Deuterium Synthesis 1');
      await completeResearch(f.db, id, 'DEUTERIUM_SYNTHESIS', f.clock, joined.playerId);
      await until(async () => (await f.db.select().from(playerResearch).where(and(
        eq(playerResearch.playerId, joined.playerId), eq(playerResearch.projectId, 'DEUTERIUM_SYNTHESIS'))))[0]?.level === 1);
      for (let level = 0; level < 3; level++) {
        await fund(buildingCost('DEUTERIUM_PLANT', level), 'Deuterium Plant');
        await upgradeBuilding(f.db, id, 'DEUTERIUM_PLANT', f.clock, joined.playerId);
        await until(async () => (await state()).buildings.DEUTERIUM_PLANT > level);
      }
    }
    // Capital/Core and productive investments run while the yard/miners work.
    for (;;) {
      const current = await state();
      for (const producer of ['REFINERY', 'EXTRACTOR'] as const) {
        while ((await state()).buildings[producer] < Math.min(strategy.producerLevel, current.buildings.CORE)) {
          const nextLevel = (await state()).buildings[producer] + 1;
          await fund(buildingCost(producer, nextLevel - 1), `${producer} ${String(nextLevel)}`);
          await upgradeBuilding(f.db, id, producer, f.clock, joined.playerId);
          await until(async () => (await state()).buildings[producer] >= nextLevel);
        }
      }
      if (current.buildings.CORE >= 6) break;
      await raiseCore();
      await until(async () => (await state()).buildings.CORE > current.buildings.CORE);
    }
    if (strategy.shipyard === 2) {
      await fund(buildingCost('SHIPYARD', 1), 'Shipyard 2');
      await upgradeBuilding(f.db, id, 'SHIPYARD', f.clock, joined.playerId);
      await until(async () => (await state()).buildings.SHIPYARD === 2);
    }
    // The owner-revised first slot is Core 9. Buy it in parallel with the paid
    // fleet so the benchmark cannot claim a world behind the old Core 6 gate.
    capitalCoreGoal = MULTI_WORLD.colonyCoreThresholds[0];
    if (!tradeEnabled) await until(async () => (await state()).homeFleet.COURIER === 2);
    prepareArmy = async () => {
    const current = await state();
    const base: Fleet = Object.fromEntries(fleetEntries(current.homeFleet)
      .filter(([hull]) => !HULLS[hull].ground && HULLS[hull].atk > 0));
    base.COURIER = 2;
    const candidates = ALL_HULLS.filter((hull) => !HULLS[hull].ground && HULLS[hull].atk > 0
      && hullProductionAccessible(hull, current.buildings.SHIPYARD, {}));
    const rewards = await rewardsView(f.db, id, f.clock);
    const shipRewards = rewards.chains.find((chain) => chain.id === 'SHIPS')?.tiers ?? [];
    const plans: { orders: [HullId, number][]; netAlloy: number; minutes: number }[] = [];
    for (let x = 0; x < candidates.length; x++) for (let y = x; y < candidates.length; y++) {
      const left = candidates[x]!, right = candidates[y]!;
      const countLimit = targetTier === 2 ? 80 : 40;
      for (let a = 0; a <= countLimit; a++) for (let b = 0; b <= countLimit; b++) {
        if (x === y && b !== 0) continue;
        const wing: Fleet = { ...base };
        wing[left] = (wing[left] ?? 0) + a;
        wing[right] = (wing[right] ?? 0) + b;
        let draw = 0;
        let simulatedWing = wing, simulatedGuard: Fleet = {
          ...MULTI_WORLD.neutral[targetTier].fleet, ...MULTI_WORLD.neutral[targetTier].ground,
        };
        let shield = target.shield, clears = false;
        // Endpoint rolls are a heuristic, NOT a monotonic victory proof: integer
        // casualties change the remaining class mix. Real reports govern retries.
        for (let wave = 0; wave < (strategy.waves ?? 1); wave++) {
          const fight = resolveCombat(simulatedWing, simulatedGuard, shield,
            () => draw++ % 2 === 0 ? 0 : 1, { attacker: { tech: {} }, defender: { tech: {} } });
          if (fight.attackerSurvivors.COURIER !== 2) break;
          if (fight.grade === 'DECISIVE') { clears = true; break; }
          simulatedWing = fight.attackerSurvivors; simulatedGuard = fight.defenderSurvivors;
          const roundTrip = 2 * fleetTravelExact(Math.hypot(target.x - home.x, target.y - home.y, target.z - home.z),
            simulatedWing, { boost: fleetSpeedMult(current.orbit), tech: {} });
          shield = Math.min(target.shield, fight.shieldLeft + target.shield * SHIELD.regenPerHour * roundTrip / 60);
        }
        if (!clears) continue;
        const costD = HULLS[left].deuterium * a + HULLS[right].deuterium * b;
        const distance = Math.hypot(target.x - home.x, target.y - home.y, target.z - home.z);
        if (current.buildings.DEUTERIUM_PLANT === 0 && costD + missionFuel(wing, distance, 2) > current.deuterium) continue;
        const orders: [HullId, number][] = [];
        if (a > 0) orders.push([left, a]);
        if (b > 0) orders.push([right, b]);
        const newRewards = shipRewards.filter((tier) => tier.state !== 'claimed' && tier.goal <= (wing.DART ?? 0))
          .reduce((sum, tier) => sum + tier.alloy, 0);
        plans.push({ orders, netAlloy: HULLS[left].alloy * a + HULLS[right].alloy * b - newRewards,
          minutes: orders.reduce((sum, [hull, count]) => sum
            + hullWorkMinutes(hull, count, current.buildings.SHIPYARD, {}), 0) });
      }
    }
    plans.sort((left, right) => left.netAlloy - right.netAlloy || left.minutes - right.minutes);
    const plan = plans[0];
    if (!plan) throw new Error('no paid, fuel-affordable army clears the current garrison in the bounded search');
    console.info(`D209 adaptive army ${JSON.stringify(strategy)}: ${JSON.stringify(plan)}`);
    const plannedWing: Fleet = { ...base };
    for (const [hull, count] of plan.orders) plannedWing[hull] = (plannedWing[hull] ?? 0) + count;
    deuteriumReserve = plan.orders.reduce((sum, [hull, count]) => sum + HULLS[hull].deuterium * count, 0)
      + missionFuel(plannedWing, Math.hypot(target.x - home.x, target.y - home.y, target.z - home.z), 2);
    // Core is ready and the plan preserves two transports. Let the REAL first
    // haul fund settlement; reserving another 1,000/500 before sailing would
    // artificially delay a player who can spend that money on the paid wing.
    const reserve: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
    for (const [hull, wanted] of plan.orders) {
      let purchased = 0;
      while (purchased < wanted) {
        const spec = HULLS[hull];
        await fund({ alloy: spec.alloy + reserve.alloy, crystal: spec.crystal + reserve.crystal,
          deuterium: spec.deuterium }, hull);
        const bank = await state();
        const count = Math.min(wanted - purchased, Math.floor((bank.alloy - reserve.alloy) / spec.alloy),
          Math.floor((bank.crystal - reserve.crystal) / spec.crystal),
          spec.deuterium > 0 ? Math.floor(bank.deuterium / spec.deuterium) : Infinity);
        const have = bank.homeFleet[hull] ?? 0;
        await buildUnits(f.db, id, hull, count, f.clock, joined.playerId);
        deuteriumReserve -= spec.deuterium * count;
        purchased += count;
        await until(async () => ((await state()).homeFleet[hull] ?? 0) >= have + count);
      }
    }
    };
    await prepareArmy();
  } else if (waitForIncome) {
    await until(async () => (await state()).homeFleet.COURIER === 2);
    let purchased = 0;
    while (purchased < armyCount) {
      await fund(HULLS[armyHull], armyHull);
      const current = await state(), unit = HULLS[armyHull];
      const count = Math.min(armyCount - purchased, Math.floor(current.alloy / unit.alloy),
        Math.floor(current.crystal / unit.crystal));
      console.info(`D209 paid army batch: ${count} ${armyHull} at minute`
        + ` ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)};`
        + ` store cap A ${storageCap(alloyRate(current.buildings.REFINERY), current.buildings.VAULT).toFixed(2)}`);
      await buildUnits(f.db, id, armyHull, count, f.clock, joined.playerId);
      purchased += count;
      await until(async () => ((await state()).homeFleet[armyHull] ?? 0)
        === purchased + (armyHull === 'WARDEN' ? 1 : 0));
    }
  } else {
    const current = await state(), unit = HULLS[armyHull];
    console.info(`D209 strict army purchase at minute ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)};`
      + ` store ${current.alloy}/${current.crystal}; cost ${unit.alloy * armyCount}/${unit.crystal * armyCount}`);
    await buildUnits(f.db, id, armyHull, armyCount, f.clock, joined.playerId);
  }
  if (!strategy) await until(async () => ((await state()).homeFleet[armyHull] ?? 0) === armyCount + (armyHull === 'WARDEN' ? 1 : 0));
  const attackWing: Fleet = strategy ? Object.fromEntries(fleetEntries((await state()).homeFleet)
    .filter(([hull]) => HULLS[hull].atk > 0 && !HULLS[hull].ground)) : { DART: 5,
    WARDEN: 1 + (armyHull === 'WARDEN' ? armyCount : 0),
    PIKE: armyHull === 'PIKE' ? armyCount : 0 };
  attackWing.COURIER = 2;
  if (strategy) await fund({ alloy: 0, crystal: 0,
    deuterium: missionFuel(attackWing, Math.hypot(target.x - home.x, target.y - home.y, target.z - home.z), 2) }, 'raid fuel');
  tradeEnabled = false;
  if (strategy) await until(async () => ((await state()).homeFleet.COURIER ?? 0) >= 2);
  await launchAttack(f.db, id, target.id, attackWing, f.clock, joined.playerId);
  if (!strategy) await raiseCore();
  await until(noFlight);
  await inspectRaids('first raid returned');
  if (repeatRaid && !waitForIncome) {
    // The first sweep leaves T1 permanently empty. Reuse the paid survivors for
    // one more haul while the capital upgrades; a live claim is not extended.
    const survivors = (await state()).homeFleet;
    await launchAttack(f.db, id, target.id, { DART: survivors.DART ?? 0, WARDEN: survivors.WARDEN ?? 0,
      PIKE: survivors.PIKE ?? 0, COURIER: 2 }, f.clock, joined.playerId);
  }
  if (!strategy) {
    await until(async () => (await state()).buildings.CORE === 4);
    await raiseCore();
    await until(async () => (await state()).buildings.CORE === 5);
    await claimReward(f.db, id, 'CORE:5', f.clock);
    await raiseCore();
    await until(async () => (await state()).buildings.CORE === 6);
  }
  await until(noFlight);
  if (repeatRaid && waitForIncome) {
    // The dearer fixed army takes longer to fund. Keep the same two raids, but
    // defer the empty-world sweep until the fixed-route Core work is complete.
    const survivors = (await state()).homeFleet;
    console.info(`D209 deferred second raid at minute`
      + ` ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)}`);
    await launchAttack(f.db, id, target.id, { DART: survivors.DART ?? 0, WARDEN: survivors.WARDEN ?? 0,
      PIKE: survivors.PIKE ?? 0, COURIER: 2 }, f.clock, joined.playerId);
    await until(noFlight);
    await inspectRaids('second raid returned');
  }
  const currentWing = async (): Promise<Fleet> => {
    const wing: Fleet = Object.fromEntries(fleetEntries((await state()).homeFleet)
      .filter(([hull]) => HULLS[hull].atk > 0 && !HULLS[hull].ground));
    wing.COURIER = 2;
    return wing;
  };
  const raidUntilClaim = async (alreadyRaided: boolean) => {
    for (let wave = 0; wave < 8; wave++) {
      const [claim] = await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.id));
      if (alreadyRaided && claim?.claimUntil && claim.claimUntil > f.clock.now()) return;
      const wing = await currentWing();
      await fund({ alloy: 0, crystal: 0,
        deuterium: missionFuel(wing, Math.hypot(target.x - home.x, target.y - home.y, target.z - home.z), 2) }, 'cleanup raid fuel');
      await launchAttack(f.db, id, target.id, wing, f.clock, joined.playerId);
      await until(noFlight);
      await inspectRaids('adaptive cleanup returned');
      alreadyRaided = true;
    }
    throw new Error('paid survivors did not clear the actual guard within eight raids');
  };
  if (strategy) await raidUntilClaim(true);
  if (strategy?.route && strategy.route !== 'directT2') {
    if (strategy.route === 'colonyT1T2') {
      await fund(MULTI_WORLD.settlement.charge, 'T1 founding charge');
      await launchSettlement(f.db, joined.playerId, id, target.id, f.clock);
      await until(async () => (await f.db.select().from(planets).where(eq(planets.id, target.id)))[0]?.controllerPlayerId === joined.playerId);
      foundingCount++;
      const colonyId = target.id;
      const colonyState = () => f.db.transaction((tx) => loadLocked(tx, colonyId, f.clock));
      colonyStarts.push({ planetId: colonyId, initial: await colonyState(), startedAt: f.clock.now().getTime() });
      console.info(`D209 intermediate T1 colony: ${((f.clock.now().getTime() - startedAt) / 60_000).toFixed(2)} minutes`);
      capitalCoreGoal = MULTI_WORLD.colonyCoreThresholds[1];
      for (let core = 2; core <= 5; core++) {
        for (const producer of ['REFINERY', 'EXTRACTOR'] as const) {
          while ((await colonyState()).buildings[producer] < core) {
            const level = (await colonyState()).buildings[producer];
            await fund(buildingCost(producer, level), 'colony producer', colonyId);
            await upgradeBuilding(f.db, colonyId, producer, f.clock, joined.playerId);
            await until(async () => (await colonyState()).buildings[producer] > level);
          }
        }
        if (core === 2) {
          await fund(buildingCost('DEUTERIUM_PLANT', 0), 'colony fuel plant', colonyId);
          await upgradeBuilding(f.db, colonyId, 'DEUTERIUM_PLANT', f.clock, joined.playerId);
          await until(async () => (await colonyState()).buildings.DEUTERIUM_PLANT === 1);
          await fund(buildingCost('SHIPYARD', 0), 'colony shipyard', colonyId);
          await upgradeBuilding(f.db, colonyId, 'SHIPYARD', f.clock, joined.playerId);
          await until(async () => (await colonyState()).buildings.SHIPYARD === 1);
          for (let craft = 0; craft < 2; craft++) {
            await fund(HULLS.PROSPECTOR, 'colony Prospector', colonyId);
            await buildUnits(f.db, colonyId, 'PROSPECTOR', 1, f.clock, joined.playerId);
            await until(async () => (await f.db.select().from(units).where(and(
              eq(units.planetId, colonyId), eq(units.hull, 'PROSPECTOR')))).reduce((sum, row) => sum + row.count, 0) > craft);
          }
        }
        if (core < 5) {
          await fund(buildingCost('CORE', core), 'colony Core', colonyId);
          await upgradeBuilding(f.db, colonyId, 'CORE', f.clock, joined.playerId);
          await until(async () => (await colonyState()).buildings.CORE > core);
        }
      }
      // Settlement transports stay on the colony. Pay for the replacement pair;
      // the colony's two original transports shuttle only actual earned stock.
      await fund({ alloy: HULLS.COURIER.alloy * 2, crystal: HULLS.COURIER.crystal * 2, deuterium: 0 }, 'replacement Couriers');
      await buildUnits(f.db, id, 'COURIER', 2, f.clock, joined.playerId);
      await until(async () => (await state()).homeFleet.COURIER === 2);
      colonyHarvestEnabled = true;
    }
    if (!tierTwo || !prepareArmy) throw new Error('T2 continuation unavailable');
    target = tierTwo; targetTier = 2;
    tradeEnabled = strategy.merchant ?? false;
    expect(await targetGuard()).toEqual({ ...MULTI_WORLD.neutral[2].fleet, ...MULTI_WORLD.neutral[2].ground });
    expect(target.shield).toBe(shieldHp(MULTI_WORLD.neutral[2].instruments.AEGIS));
    await prepareArmy();
    await fund({ alloy: 0, crystal: 0, deuterium: missionFuel(await currentWing(),
      Math.hypot(target.x - home.x, target.y - home.y, target.z - home.z), 2) }, 'T2 raid fuel');
    tradeEnabled = false;
    await until(async () => ((await state()).homeFleet.COURIER ?? 0) >= 2);
    if (strategy.route === 'colonyT1T2') await until(async () => (await state()).buildings.CORE >= 9);
    await raidUntilClaim(false);
  }
  if (strategy) await until(async () => (await state()).buildings.CORE
    >= MULTI_WORLD.colonyCoreThresholds[foundingCount]!);
  // Core 9/12/15 can take longer than the claim left by the clearing raid. A real
  // speed-run reopens the now-empty caretaker world before it sends settlers;
  // otherwise this benchmark measures an expired token rather than the new gate.
  if (strategy) await raidUntilClaim(true);
  await fund(MULTI_WORLD.settlement.charge, 'founding charge');
  await inspectRaids('settlement attempted');
  await launchSettlement(f.db, joined.playerId, id, target.id, f.clock);
  await until(async () => (await f.db.select().from(planets).where(eq(planets.id, target.id)))[0]?.controllerPlayerId === joined.playerId);
  foundingCount++;
  const minutes = (f.clock.now().getTime() - startedAt) / 60_000;
  if (strategy) {
    const worldStarts = [{ planetId: id, initial, startedAt }, ...colonyStarts];
    const worldIds = worldStarts.map((world) => world.planetId);
    const endTime = f.clock.now().getTime();
    const ends = await Promise.all(worldIds.map((worldId) => f.db.transaction((tx) => loadLocked(tx, worldId, f.clock))));
    const orders = (await f.db.select().from(buildOrders).where(inArray(buildOrders.planetId, worldIds)))
      .sort((left, right) => left.readyAt.getTime() - right.readyAt.getTime());
    const newOrders = orders.filter((order) => !prepaidOrders.has(order.id));
    expect(newOrders.every((order) => order.status === 'COMPLETED')).toBe(true);
    for (const [index, world] of worldStarts.entries()) {
    expect(ends[index]?.orbit).toEqual(world.initial.orbit);
    const levels = { ...world.initial.buildings };
    for (const order of orders.filter((order) => order.planetId === world.planetId)) {
      if (order.kind === 'BUILDING') {
        const building = BUILDING_IDS.find((building) => building === order.subject);
        if (!building) throw new Error(`unrecognised building receipt ${order.subject}`);
        const targetLevel = ++levels[building];
        expect(order.cost).toEqual(buildingCost(building, targetLevel - 1));
        expect(order.readyAt.getTime() - order.startedAt.getTime(), order.subject)
          .toBeGreaterThanOrEqual(Math.ceil(buildingMinutes(building, targetLevel, {}) * 60) * 1000);
      } else if (order.kind === 'HULL') {
        const hull = ALL_HULLS.find((hull) => hull === order.subject);
        if (!hull) throw new Error(`unrecognised hull receipt ${order.subject}`);
        expect(order.cost).toEqual({ alloy: HULLS[hull].alloy * order.count,
          crystal: HULLS[hull].crystal * order.count, deuterium: HULLS[hull].deuterium * order.count });
        expect(order.readyAt.getTime() - order.startedAt.getTime(), order.subject)
          .toBeGreaterThanOrEqual(Math.ceil(hullWorkMinutes(hull, order.count, levels.SHIPYARD, {}) * 60) * 1000);
      }
    }
    }
    const researchReceipts = await f.db.select().from(researchOrders).where(eq(researchOrders.playerId, joined.playerId));
    for (const order of researchReceipts) {
      expect(order.status).toBe('COMPLETED');
      expect(order.cost).toEqual(RESEARCH_PROJECTS[order.projectId].costAt(order.level));
      const coreAtStart = initial.buildings.CORE + orders.filter((built) => built.planetId === id
        && built.kind === 'BUILDING' && built.subject === 'CORE' && built.readyAt <= order.startedAt).length;
      expect(order.readyAt.getTime() - order.startedAt.getTime())
        .toBeGreaterThanOrEqual(Math.ceil(researchMinutes(order.cost, coreAtStart) * 60) * 1000);
    }
    const receipts = (await f.db.select().from(rewardGrants).where(eq(rewardGrants.playerId, joined.playerId)))
      .filter((reward) => reward.claimedAt !== null && !initialRewards.has(reward.rewardId));
    const runs = (await f.db.select().from(miningRuns).where(inArray(miningRuns.planetId, worldIds)))
      .filter((run) => run.status === 'done');
    const flights = await f.db.select().from(missions).where(eq(missions.ownerPlayerId, joined.playerId));
    const returns = flights.filter((flight) => flight.kind === 'return' && worldIds.includes(flight.targetPlanetId) && flight.status === 'resolved');
    const probes = flights.filter((flight) => flight.kind === 'probe' && worldIds.includes(flight.originPlanetId)).length;
    const fuel = flights.filter((flight) => worldIds.includes(flight.originPlanetId)
      && (flight.kind === 'attack' || flight.kind === 'settlement' || flight.kind === 'transfer'))
      .reduce((sum, flight) => sum + missionFuel(flight.fleet, flight.distance, flight.kind === 'attack' ? 2 : 1), 0);
    const trades = await f.db.select().from(tradeRuns).where(eq(tradeRuns.ownerPlayerId, joined.playerId));
    expect(trades.every((trade) => trade.status === 'done')).toBe(true);
    const passive = (resource: 'alloy' | 'crystal' | 'deuterium', world: typeof worldStarts[number]) => {
      const producer = resource === 'alloy' ? 'REFINERY' : resource === 'crystal' ? 'EXTRACTOR' : 'DEUTERIUM_PLANT';
      const rate = resource === 'alloy' ? alloyRate : resource === 'crystal' ? crystalRate : deuteriumRate;
      let level = world.initial.buildings[producer], at = world.startedAt, income = 0;
      for (const order of orders.filter((order) => order.planetId === world.planetId && order.kind === 'BUILDING' && order.subject === producer)) {
        income += rate(level) * productionMult(world.initial.orbit) * (order.readyAt.getTime() - at) / 3_600_000;
        level++; at = order.readyAt.getTime();
      }
      return income + rate(level) * productionMult(world.initial.orbit) * (endTime - at) / 3_600_000;
    };
    for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
      const initialBuffer = resource === 'alloy' ? initial.bufferAlloy
        : resource === 'crystal' ? initial.bufferCrystal : initial.bufferDeuterium;
      const income = { opening: initial[resource] + initialBuffer,
        captureStock: colonyStarts.reduce((sum, world) => sum + world.initial[resource]
          + (resource === 'alloy' ? world.initial.bufferAlloy : resource === 'crystal' ? world.initial.bufferCrystal : world.initial.bufferDeuterium), 0),
        production: worldStarts.reduce((sum, world) => sum + passive(resource, world), 0),
        rewards: receipts.reduce((sum, reward) => sum + reward[resource], 0),
        mining: runs.reduce((sum, run) => sum + (resource === 'alloy' ? run.minedAlloy
          : resource === 'crystal' ? run.minedCrystal : run.minedDeuterium), 0),
        raid: returns.reduce((sum, flight) => sum + (flight.loot?.[resource] ?? 0), 0),
        trade: trades.reduce((sum, trade) => sum + trade.want[resource], 0) };
      const spending = { invoices: newOrders.reduce((sum, order) => sum + order.cost[resource], 0)
          + researchReceipts.reduce((sum, order) => sum + order.cost[resource], 0),
        probes: resource === 'alloy' ? probes * PROBE.alloy : resource === 'crystal' ? probes * PROBE.crystal : 0,
        founding: MULTI_WORLD.settlement.charge[resource] * foundingCount,
        trade: trades.reduce((sum, trade) => sum + trade.give[resource], 0),
        fuel: resource === 'deuterium' ? fuel + trades.reduce((sum, trade) => sum
          + missionFuel(trade.fleet, Math.hypot(trade.interceptX - home.x,
            trade.interceptY - home.y, trade.interceptZ - home.z), 2), 0) : 0 };
      const finalBuffer = ends.reduce((sum, end) => sum + (resource === 'alloy' ? end.bufferAlloy
        : resource === 'crystal' ? end.bufferCrystal : end.bufferDeuterium), 0);
      const bank = ends.reduce((sum, end) => sum + end[resource], 0);
      const transit = flights.filter((flight) => flight.kind === 'transfer' && flight.status === 'in_flight')
        .reduce((sum, flight) => sum + (flight.cargo?.[resource] ?? 0), 0);
      const available = Object.values(income).reduce((sum, value) => sum + value, 0);
      const accounted = Object.values(spending).reduce((sum, value) => sum + value, 0) + bank + finalBuffer + transit;
      // Capacity losses may waste income; they may never create extra ore.
      console.info(`D209 resource audit ${resource}: ${JSON.stringify({ income, spending,
        bank, buffer: finalBuffer, transit, uncollectedOrWasted: available - accounted })}`);
      expect(accounted, `${resource} conservation`).toBeLessThanOrEqual(available + 0.01 * worldIds.length);
    }
  }
  console.info(`D209 solo colony: ${minutes.toFixed(2)} minutes after Academy exit;`
    + ` ${strategy ? JSON.stringify(strategy) + ' army ' + JSON.stringify(attackWing) : 'paid ' + String(armyCount) + ' ' + armyHull}`
    + `; target T${targetTier}; ${foundingCount} colonies; seed 4242, no extra grants,`
    + ` ${strategy?.merchant ? 'normal merchant' : 'no trade'}, no moved worlds`);
  return { minutes };
}

it('blocks the unaltered checkpoint opening because its dearer army exceeds the available cash', async () => {
  await expect(soloOpeningPlan('PIKE', 12, true)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
});

it('remeasures the checkpoint army with legal income and confirms two raids cannot clear the stronger guard', async () => {
  await expect(soloOpeningPlan('PIKE', 12, true, true)).rejects.toMatchObject({ code: 'NO_ACTIVE_CLAIM' });
});

it('rejects the unchanged cheaper escort opening because the adjusted economy cannot fund its later purchases', async () => {
  await expect(soloOpeningPlan('WARDEN', 8, false)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
});

it.each<OpeningStrategy>([
  { producerLevel: 3, mining: false, shipyard: 1 },
  { producerLevel: 5, mining: false, shipyard: 1 },
  { producerLevel: 3, mining: true, shipyard: 1 },
  { producerLevel: 5, mining: true, shipyard: 1 },
  { producerLevel: 3, mining: true, shipyard: 2 },
  { producerLevel: 5, mining: true, shipyard: 2 },
  { producerLevel: 5, mining: true, shipyard: 2, asteroidKey: '00000000-0000-4000-8000-000000004243' },
  { producerLevel: 5, mining: true, shipyard: 2, asteroidKey: '00000000-0000-4000-8000-000000004244' },
])('calibrates a legal adaptive opening: %j', async (strategy) => {
  const route = await soloOpeningPlan('PIKE', 12, false, true, strategy);
  expect(route.minutes).toBeGreaterThan(0);
}, 300_000);

it.each<OpeningStrategy>([
  { producerLevel: 5, mining: true, shipyard: 2, route: 'directT2', waves: 1 },
  { producerLevel: 5, mining: true, shipyard: 2, route: 'directT2', waves: 3 },
  { producerLevel: 6, mining: true, shipyard: 2, route: 'directT2', waves: 3 },
  { producerLevel: 5, mining: true, shipyard: 2, route: 'raidT1T2', waves: 3 },
  { producerLevel: 6, mining: true, shipyard: 2, route: 'raidT1T2', waves: 3 },
  { producerLevel: 5, mining: true, shipyard: 2, route: 'colonyT1T2', waves: 3 },
  { producerLevel: 6, mining: true, shipyard: 2, route: 'directT2', waves: 3, merchant: true },
  { producerLevel: 6, mining: true, shipyard: 2, route: 'raidT1T2', waves: 3, merchant: true },
])('speedruns T2 through ordinary paid services: %j', async (strategy) => {
  const route = await soloOpeningPlan('PIKE', 12, false, true, strategy);
  expect(route.minutes).toBeGreaterThan(0);
}, 300_000);

it('confirms the unresolved pirate repeat-purse defect through two ordinary launches and returns', async () => {
  const f = await seedWorld(1, 4242, { pirates: true });
  const mine = f.planetIds[0]!;
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  if (!season) throw new Error('missing fixture season');
  const spec = privatePirateField(season.asteroidKey).find((pirate) =>
    Object.keys(pirate.roster).length === 1 && pirate.roster.DART === 2 && pirate.level === 1);
  if (!spec) throw new Error('no reproducible two-Dart pirate');
  const minute = spec.appearsAt + 1;
  f.clock.set(new Date(season.startsAt.getTime() + minute * 60_000));
  const position = piratePosition(spec, minute);
  await placeAt(f.db, mine, { ...position, x: position.x - 20 });
  await giveUnits(f.db, mine, { DART: 2, COURIER: 1 });
  const payouts = [];
  for (let wave = 0; wave < 2; wave += 1) {
    const launched = await launchPirateRaid(f.db, mine, pirateId(season.asteroidKey, spec.index),
      { DART: 2, COURIER: 1 }, f.clock);
    f.clock.set(launched.arriveAt);
    await f.db.transaction((tx) => resolvePirateArrival(tx, launched.raidId, f.clock));
    const [run] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launched.raidId));
    if (!run?.loot || !run.homeAt) throw new Error('proof fleet did not survive and return');
    payouts.push(run.loot);
    f.clock.set(run.homeAt);
    await f.db.transaction((tx) => resolvePirateReturn(tx, launched.raidId, f.clock));
  }
  expect(payouts.reduce((sum, loot) => sum + loot.alloy, 0)).toBeGreaterThan(spec.hoard.alloy);
  expect(payouts.reduce((sum, loot) => sum + loot.crystal, 0)).toBeGreaterThan(spec.hoard.crystal);
  // This is a diagnostic proof of CURRENT behaviour, not an acceptance claim
  // that a pirate may mint its original stock twice. Repair needs an owner rule
  // for partial payouts / once-per-world attempts / persistent remaining purse.
});

it('does not hold neutral state while waiting for the world lock required by settlement and combat', async () => {
  const f = await seedWorld(0);
  const { season } = await createSeason(f.db, { shardCode: 'NEUTRAL-LOCK-AUDIT', seed: 4242,
    startsAt: f.clock.now(), playerCap: 300, rulesetVersion: MULTI_WORLD.rulesetVersion });
  const [target] = await f.db.select({ id: planets.id }).from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .where(and(eq(planets.seasonId, season.id), eq(neutralPlanetState.tier, 2)));
  if (!target) throw new Error('no seeded tier-two world');
  let inspect!: () => void;
  const inspection = new Promise<void>((resolve) => { inspect = resolve; });
  let ready!: () => void;
  const locked = new Promise<void>((resolve) => { ready = resolve; });
  const settlementOrder = f.db.transaction(async (tx) => {
    await tx.select().from(planets).where(eq(planets.id, target.id)).for('update');
    ready();
    await inspection;
    // NOWAIT exposes the opposite order without waiting for PostgreSQL to kill
    // one side of an actual world->state / state->world deadlock.
    await tx.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, target.id))
      .for('update', { noWait: true });
  });
  await locked;
  const reinforcement = f.db.transaction((tx) => reinforceNeutral(tx, target.id, f.clock.now()));
  const outcomes = Promise.allSettled([settlementOrder, reinforcement]);
  try {
    let waiting = 0;
    for (let attempt = 0; attempt < 200 && waiting === 0; attempt += 1) {
      const result = await f.db.execute<{ count: number }>(sql`
        SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE 'select%from "planets"%for update%'
      `);
      waiting = result[0]?.count ?? 0;
      if (waiting === 0) await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    expect(waiting).toBe(1);
  } finally {
    inspect();
  }
  expect((await outcomes).map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
});

it('serialises two first mining arrivals from one commander without losing the ore ledger', async () => {
  const f = await seedWorld(2);
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
    .where(eq(planets.id, f.planetIds[1]!));
  const rock = f.asteroids.find((candidate) => candidate.ore > PROSPECTOR.hold * PROSPECTOR.max * 2);
  if (!rock) throw new Error('fixture has no rock with room for two legal squads');
  const runs = await f.db.insert(miningRuns).values(f.planetIds.map((planetId) => ({
    planetId, seasonId: f.seasonId, asteroidIndex: rock.index,
    craft: PROSPECTOR.max, holdEach: PROSPECTOR.hold,
    interceptX: 0, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: f.clock.now(),
  }))).returning();

  // A real PostgreSQL table lock forces both arrivals to overlap at their first
  // INSERT. SELECT FOR UPDATE is allowed through; no query or row lock is mocked.
  // Before the fix both read an absent row and overwrite each other's total.
  let unlock!: () => void;
  const released = new Promise<void>((resolve) => { unlock = resolve; });
  let ready!: () => void;
  const locked = new Promise<void>((resolve) => { ready = resolve; });
  const gate = f.db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE asteroid_claims IN SHARE MODE`);
    ready();
    await released;
  });
  await locked;
  const arrivals = Promise.all(runs.map((run) => f.db.transaction((tx) =>
    resolveMiningArrival(tx, run.id, f.clock.now()))));
  try {
    let waiting = 0;
    for (let attempt = 0; attempt < 200 && waiting < 2; attempt += 1) {
      const result = await f.db.execute<{ count: number }>(sql`
        SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE 'insert into "asteroid_claims"%'
      `);
      waiting = result[0]?.count ?? 0;
      if (waiting < 2) await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    expect(waiting, 'both real arrival transactions reached the contention point').toBe(2);
  } finally {
    unlock();
    await gate;
    await arrivals;
  }
  const completed = await f.db.select().from(miningRuns);
  const taken = completed.reduce((sum, run) => sum + run.minedAlloy + run.minedCrystal + run.minedDeuterium, 0);
  const each = claimOre(rock.ore, PROSPECTOR.hold * PROSPECTOR.max, rock.crystalShare, rock.deuteriumShare);
  expect(taken).toBeCloseTo(each.taken * 2, 2);
  const [claim] = await f.db.select().from(asteroidClaims)
    .where(and(eq(asteroidClaims.seasonId, f.seasonId), eq(asteroidClaims.index, rock.index)));
  expect(claim?.oreTaken).toBeCloseTo(taken, 2);
});
