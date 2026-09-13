import { and, asc, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, expect, it } from 'vitest';
import { ACADEMY_STEPS, MULTI_WORLD, PROSPECTOR, claimOre, piratePosition } from '@astera/rules';
import { TokenService } from '../src/auth/tokens.js';
import { buildApp } from '../src/app.js';
import { asteroidClaims, miningRuns, missions, neutralPlanetState, pirateRaids, planets, seasons, scheduledEvents } from '../src/db/schema.js';
import { resolveMiningArrival } from '../src/services/mining.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { joinSeason } from '../src/services/player.js';
import { claimReward } from '../src/services/rewards.js';
import { loadLocked } from '../src/services/planet.js';
import { createSeason } from '../src/services/season.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { launchSettlement } from '../src/services/movement.js';
import { reinforceNeutral } from '../src/services/neutral.js';
import { EventWorker } from '../src/worker/loop.js';
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

it('can legally fund Core 6, both founding couriers and the charge in under 26 minutes after Academy exit', async () => {
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
  expect(world.alloy).toBeGreaterThanOrEqual(MULTI_WORLD.settlement.charge.alloy);
  expect(world.crystal).toBeGreaterThanOrEqual(MULTI_WORLD.settlement.charge.crystal);
  expect(world.deuterium).toBeGreaterThan(0);
  expect((f.clock.now().getTime() - startedAt) / 60_000).toBeLessThan(26);
});

async function soloOpeningPlan(armyHull: 'PIKE' | 'WARDEN', armyCount: number, repeatRaid: boolean) {
  const f = await seedWorld(0);
  const { season } = await createSeason(f.db, { shardCode: 'SNOWBALL-D209', seed: 4242,
    startsAt: f.clock.now(), playerCap: 300, rulesetVersion: MULTI_WORLD.rulesetVersion });
  const account = await makeAccount(f.db, 'SoloOpening');
  const joined = await joinSeason(f.db, account.id, season.id, f.clock, ACADEMY_STEPS.length);
  const id = joined.planetId;
  const startedAt = f.clock.now().getTime();
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  const state = () => f.db.transaction((tx) => loadLocked(tx, id, f.clock));
  const next = async () => {
    const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.status, 'pending'))
      .orderBy(asc(scheduledEvents.resolveAt)).limit(1);
    if (!event) throw new Error('no scheduled moment left in solo opening');
    if (event.resolveAt > f.clock.now()) f.clock.set(event.resolveAt);
    if ((f.clock.now().getTime() - startedAt) / 60_000 > 120) throw new Error('solo route exceeded two hours');
    await worker.tick();
  };
  const until = async (condition: () => Promise<boolean>) => {
    for (let step = 0; step < 100; step += 1) {
      if (await condition()) return;
      await next();
    }
    throw new Error('solo opening did not converge in 100 moments');
  };
  const [home] = await f.db.select().from(planets).where(eq(planets.id, id));
  if (!home) throw new Error('no solo capital');
  const neutrals = (await f.db.select().from(planets).where(and(eq(planets.seasonId, season.id), eq(planets.kind, 'NEUTRAL'))))
    .sort((left, right) => Math.hypot(left.x - home.x, left.y - home.y, left.z - home.z)
      - Math.hypot(right.x - home.x, right.y - home.y, right.z - home.z));
  const tierOneIds = new Set((await f.db.select().from(neutralPlanetState)
    .where(eq(neutralPlanetState.tier, 1))).map((row) => row.planetId));
  const target = neutrals.find((world) => tierOneIds.has(world.id));
  if (!target) throw new Error('no seeded tier-one target');
  const noFlight = async () => (await f.db.select({ id: missions.id }).from(missions)
    .where(and(eq(missions.ownerPlayerId, joined.playerId), eq(missions.status, 'in_flight')))).length === 0;
  await buildUnits(f.db, id, 'DART', 1, f.clock, joined.playerId);
  for (const world of neutrals.slice(0, 5)) {
    await launchProbe(f.db, id, world.id, f.clock, joined.playerId);
    await until(noFlight);
  }
  await until(async () => (await state()).buildings.CORE === 3);
  for (const reward of ['CORE:3', 'SHIPS:5', 'RAID:1', 'PROBE:1', 'PROBE:3', 'PROBE:5']) {
    await claimReward(f.db, id, reward, f.clock);
  }
  await buildUnits(f.db, id, 'COURIER', 1, f.clock, joined.playerId);
  await buildUnits(f.db, id, armyHull, armyCount, f.clock, joined.playerId);
  await until(async () => ((await state()).homeFleet[armyHull] ?? 0) === armyCount + (armyHull === 'WARDEN' ? 1 : 0));
  await launchAttack(f.db, id, target.id, { DART: 5,
    WARDEN: 1 + (armyHull === 'WARDEN' ? armyCount : 0),
    PIKE: armyHull === 'PIKE' ? armyCount : 0, COURIER: 2 }, f.clock, joined.playerId);
  await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  await until(noFlight);
  if (repeatRaid) {
    // The first sweep leaves T1 permanently empty. Reuse the paid survivors for
    // one more haul while the capital upgrades; a live claim is not extended.
    const survivors = (await state()).homeFleet;
    await launchAttack(f.db, id, target.id, { DART: survivors.DART ?? 0, WARDEN: survivors.WARDEN ?? 0,
      PIKE: survivors.PIKE ?? 0, COURIER: 2 }, f.clock, joined.playerId);
  }
  await until(async () => (await state()).buildings.CORE === 4);
  await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  await until(async () => (await state()).buildings.CORE === 5);
  await claimReward(f.db, id, 'CORE:5', f.clock);
  await upgradeBuilding(f.db, id, 'CORE', f.clock, joined.playerId);
  await until(async () => (await state()).buildings.CORE === 6);
  await until(noFlight);
  await launchSettlement(f.db, joined.playerId, id, target.id, f.clock);
  await until(async () => (await f.db.select().from(planets).where(eq(planets.id, target.id)))[0]?.controllerPlayerId === joined.playerId);
  const minutes = (f.clock.now().getTime() - startedAt) / 60_000;
  console.info(`D209 solo colony: ${minutes.toFixed(2)} minutes after Academy exit; paid ${armyCount} ${armyHull}, ${repeatRaid ? 2 : 1} raids; seed 4242, no extra grants, no trade, no moved worlds`);
  return { minutes };
}

it('measures a solo first-session colony with paid ships and real seeded geometry, without merchant or extra grants', async () => {
  const route = await soloOpeningPlan('PIKE', 12, true);
  expect(route.minutes).toBeLessThan(120);
});

it('rejects the cheaper escort opening because its single raid never clears the seeded guard', async () => {
  await expect(soloOpeningPlan('WARDEN', 8, false)).rejects.toMatchObject({ code: 'NO_ACTIVE_CLAIM' });
});

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
