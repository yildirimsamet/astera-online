import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import {
  clanMemberships, clans, clanSupportWaves, galaxyEventOccurrences, honorTotals, hpRadiationSources,
  intergalacticConvoyRuns, missions, planetAegisEpochs, planetFaults, planets, radiationBombFlights, researchOrders, seasons, shards,
  strategicAssets, buildOrders, units,
} from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { buildPlanetView, loadPlanetViewData, loadPlanetViewsData } from '../src/services/planetView.js';
import { collectWorks } from '../src/services/build.js';
import { GameError, loadLocked } from '../src/services/planet.js';
import {
  giveInstrument, giveResearch, giveSatellite, giveUnits, landAndDockShips, seedWorld, setLevel, testDb, testEnv,
  TEST_DATABASE_URL, type Fixture,
} from './helpers.js';

/**
 * EVERY WORLD OF A COMMANDER IN ONE READ PER TABLE. Scaling plan F1.4 (M9).
 *
 * `/api/planets` read each world's tables on their own: 117 statements for four
 * worlds on a ruleset 19 galaxy, 25 more for every world. The list now reads each
 * table once for all of them and renders each world from the same pure arithmetic.
 * The oracle renders each world alone, so no world can borrow another's rows.
 */
const wire: string[] = [];
const statements: string[] = [];
const connection = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
  debug: (_connection, query) => { wire.push(query); } });
const db = drizzle(connection, { schema, logger: { logQuery: query => { statements.push(query); } } });
let built: ReturnType<typeof buildApp> | undefined;
let f: Fixture;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await connection.end(); await (await testDb()).close(); });

const SNAPSHOT = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const;
const minutes = (n: number) => new Date(f.clock.now().getTime() + n * 60_000);

/** One commander, a capital and three colonies, and every kind of state a view renders. */
async function richWorld(): Promise<{ capital: string; colonies: [string, string, string] }> {
  f = await seedWorld(5);
  const [p0, , , , ally] = f.playerIds as [string, string, string, string, string];
  const capital = f.planetIds[0]!;
  const colonies = [f.planetIds[1]!, f.planetIds[2]!, f.planetIds[3]!] as [string, string, string];
  await f.db.update(seasons).set({ rulesetVersion: 19, radiationBombStartsAt: minutes(-60) }).where(eq(seasons.id, f.seasonId));
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: p0, loyalty: 0.6 }).where(inArray(planets.id, colonies));

  // Hardware, fleets and research: the economy and every derived ceiling.
  await setLevel(f.db, capital, 'VAULT', 3);
  await setLevel(f.db, colonies[0], 'REFINERY', 4);
  await giveInstrument(f.db, capital, 'AEGIS', 2);
  await giveSatellite(f.db, colonies[1], 'FOUNDRY');
  await giveUnits(f.db, capital, { DART: 6, BALLISTA: 2 });
  await giveUnits(f.db, colonies[0], { DART: 3 }, 'cost-test-flight');
  await giveResearch(f.db, capital, 'SHIP_ARMOR', 1);
  await landAndDockShips(f.db, { planetId: colonies[0], ownerPlayerId: p0, fleet: { BALLISTA: 2 },
    damage: [{ hull: 'BALLISTA', count: 2, damageBp: 6500 }], at: f.clock.now() }, f.clock);

  // Queues: a build, a research order and every kind of strategic hardware.
  await f.db.insert(buildOrders).values({ planetId: capital, queue: 'YARD', slot: 0, kind: 'HULL', subject: 'DART',
    startedAt: f.clock.now(), readyAt: minutes(30), remainingSeconds: 1800, cost: { alloy: 150, crystal: 10, deuterium: 0 } });
  await f.db.insert(researchOrders).values({ playerId: p0, fundingPlanetId: capital, slot: 0, projectId: 'RADIATION_SHIELDING',
    level: 1, startedAt: f.clock.now(), readyAt: minutes(45), remainingSeconds: 2700, cost: { alloy: 1, crystal: 1, deuterium: 0 } });
  await f.db.insert(strategicAssets).values([
    { planetId: capital, type: 'DEATH_STAR', status: 'BUILDING', startedAt: f.clock.now(), readyAt: minutes(90) },
    { planetId: colonies[0], type: 'INTERCEPTOR', status: 'READY', startedAt: minutes(-30), readyAt: minutes(-1) },
    { planetId: colonies[1], type: 'RADIATION_BOMB_L1', status: 'BUILDING', startedAt: f.clock.now(), readyAt: minutes(60) },
  ]);

  // A convoy crossing that is up: one world still flying it, another already spent its strike.
  const [occurrence] = await f.db.insert(galaxyEventOccurrences).values({ seasonId: f.seasonId, sequence: 0,
    kind: 'TRADE_SHIP', definitionVersion: 1, startsAt: minutes(-10), endsAt: minutes(170),
    effect: { rate: { alloy: 1, crystal: 1, deuterium: 1 } } }).returning();
  const convoy = (planetId: string, status: 'outbound' | 'done') => ({ seasonId: f.seasonId, occurrenceId: occurrence!.id,
    planetId, ownerPlayerId: p0, status, fleet: { DART: 1 }, tech: {},
    interceptX: 1, interceptY: 0, interceptZ: 0, engagementEndX: 1, engagementEndY: 0, engagementEndZ: 0,
    returnX: 0, returnY: 0, returnZ: 0, departAt: minutes(-5), arriveAt: minutes(5), engagementEndsAt: new Date(minutes(5).getTime() + 5_000),
    homeAt: minutes(20), productionCap: { alloy: 1, crystal: 1, deuterium: 1 }, resourceQualityFactor: 1,
    shipQualityFactor: 1, quotedResourceReward: { alloy: 1, crystal: 1, deuterium: 1 },
    ...(status === 'done' ? { resourceReward: { alloy: 1, crystal: 1, deuterium: 1 }, awardedFleet: {} } : {}) });
  await f.db.insert(intergalacticConvoyRuns).values([convoy(colonies[1], 'outbound'), convoy(colonies[2], 'done')]);

  // Faults: a leaking vault mid-flood and a dark refinery.
  await f.db.insert(planetFaults).values([
    { planetId: colonies[2], kind: 'VAULT_LEAK', startedAt: minutes(-20), leakedAlloy: 40 },
    { planetId: colonies[1], kind: 'REFINERY_OUTAGE', startedAt: minutes(-20) },
  ]);
  await f.db.update(planets).set({ pendingLeakAlloy: 12 }).where(eq(planets.id, colonies[2]));

  // A clan, and a clanmate's wave stationed over a colony.
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Batch Test', nameKey: 'batch test',
    tag: 'BT', createdAt: f.clock.now() }).returning();
  await f.db.insert(clanMemberships).values([p0, ally].map((playerId, slot) => ({ seasonId: f.seasonId, clanId: clan!.id,
    playerId, role: slot === 0 ? 'LEADER' as const : 'MEMBER' as const, slot, joinedAt: minutes(-600),
    matureAt: minutes(-500), aidPolicyChangedAt: minutes(-600) })));
  const [outward] = await f.db.insert(missions).values({ seasonId: f.seasonId, ownerPlayerId: ally, kind: 'clan_support',
    status: 'resolved', originPlanetId: f.planetIds[4]!, targetPlanetId: colonies[0], fleet: { DART: 2 }, distance: 30,
    fuelPaid: 5, departAt: minutes(-30), arriveAt: minutes(-10) }).returning();
  const waveId = crypto.randomUUID();
  await f.db.insert(clanSupportWaves).values({ id: waveId, seasonId: f.seasonId, clanId: clan!.id, senderPlayerId: ally,
    hostPlayerId: p0, originPlanetId: f.planetIds[4]!, hostPlanetId: colonies[0], unitLocation: `support:${waveId}`,
    fleet: { DART: 2 }, reservedBulk: 2, fuelPaid: 5, status: 'STATIONED', outboundMissionId: outward!.id,
    sentAt: minutes(-30), arriveAt: minutes(-10), stationedAt: minutes(-10), expiresAt: minutes(300) });
  await f.db.insert(units).values({ planetId: colonies[0], ownerPlayerId: ally, hull: 'DART', location: `support:${waveId}`, count: 2 });

  // Honor in play, a radiation field over one colony and a bomb on its way to another.
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: p0, score: 4_000 });
  const [exposed] = await f.db.select().from(planets).where(eq(planets.id, colonies[2]));
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: exposed!.x, y: exposed!.y,
    // A free zone: since the monuments moved, only its history window survives.
    z: exposed!.z, radius: 5, mode: 'EMIT', intensityHpPerMinute: 0.01, activeFrom: minutes(-30) });
  const [bomb] = await f.db.insert(strategicAssets).values({ planetId: f.planetIds[4]!, type: 'RADIATION_BOMB_L1',
    status: 'LAUNCHED', startedAt: minutes(-60), remainingSeconds: 0 }).returning();
  await f.db.insert(radiationBombFlights).values({ seasonId: f.seasonId, assetId: bomb!.id, ownerPlayerId: ally,
    originPlanetId: f.planetIds[4]!, targetKind: 'PLANET', targetPlanetId: colonies[1], level: 1, status: 'OUTBOUND',
    departAt: minutes(-5), arriveAt: minutes(40), originPosition: { x: 0, y: 0, z: 0 }, targetPosition: { x: 1, y: 0, z: 0 } });

  // A bomb's aura anchored on a colony: the projection's own reads and a workshop it
  // shuts, along the Aegis epoch the dock above wrote under its lock. And a squadron
  // out of the capital holding a bay.
  const [aura] = await f.db.select().from(planets).where(eq(planets.id, colonies[0]));
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: colonies[0],
    x: aura!.x, y: aura!.y, z: aura!.z, radius: 3, mode: 'EMIT', intensityHpPerMinute: 0.02,
    activeFrom: minutes(-30), activeUntil: minutes(300) });
  await f.db.insert(missions).values({ seasonId: f.seasonId, ownerPlayerId: p0, kind: 'attack', originPlanetId: capital,
    targetPlanetId: f.planetIds[4]!, fleet: { DART: 1 }, distance: 30, fuelPaid: 5, departAt: minutes(-5), arriveAt: minutes(200) });

  // Time passes, so every world has an economy, a shield and a projection to advance.
  f.clock.advance(95);
  return { capital, colonies };
}

/** Each world rendered alone, in the list's order, in one snapshot. */
async function oracle(ids: readonly string[]) {
  const now = f.clock.now();
  return f.db.transaction(async tx => {
    const views = [];
    for (const id of ids) views.push(buildPlanetView((await loadPlanetViewsData(tx, [id], { now: () => now }))[0]!));
    return JSON.parse(JSON.stringify(views)) as unknown;
  }, SNAPSHOT);
}

/**
 * The view's own transaction, off the wire: the request also touches presence and
 * the placement gate in a transaction of its own before it.
 */
function viewTransactions(): string[][] {
  const found: string[][] = [];
  let open: string[] | null = null;
  for (const query of wire) {
    if (query.startsWith('begin')) open = [];
    else if (query === 'commit' || query.startsWith('rollback')) {
      if (open?.[0]?.startsWith('set transaction isolation level repeatable read read only')) found.push(open.slice(1));
      open = null;
    } else open?.push(query);
  }
  return found;
}

async function app() {
  built = buildApp({ db, env: testEnv({ PROJECTION_CACHE_ENABLED: 'false' }), clock: f.clock, logger: pino({ level: 'silent' }) });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  return async (url: string) => {
    statements.length = 0;
    wire.length = 0;
    const response = await built!.app.inject({ url, headers: { authorization } });
    const views = viewTransactions();
    return { response, statements: statements.length, view: views.length === 1 ? views[0]!.length : NaN };
  };
}

beforeEach(() => { statements.length = 0; });

it('renders every world exactly as it renders alone', async () => {
  const { capital, colonies } = await richWorld();
  const get = await app();
  const expected = await oracle([capital, ...colonies.toSorted()]);

  const { response } = await get('/api/planets');
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json<{ planets: unknown }>().planets).toEqual(expected);
  // The fixture reaches what it claims to: a busy bay, an irradiated workshop, a docked lot and a stationed wave.
  const shown = response.json<{ planets: { planet: { id: string }; workshopRadiation: boolean; flight: { used: number };
    clanSupport: { waves: unknown[] } | null }[] }>().planets;
  const at = (id: string) => shown.find(view => view.planet.id === id)!;
  expect(at(capital).flight.used).toBeGreaterThan(0);
  expect(at(colonies[0]).workshopRadiation).toBe(true);
  expect(await f.db.select().from(planetAegisEpochs).where(eq(planetAegisEpochs.planetId, colonies[0]))).not.toHaveLength(0);
  expect(at(colonies[0]).clanSupport?.waves).toHaveLength(1);
  expect(response.json()).toMatchObject({ playerId: f.playerIds[0], seasonId: f.seasonId, capitalPlanetId: capital });

  const detail = await get(`/api/planets/${colonies[2]}`);
  expect(detail.response.statusCode, detail.response.body).toBe(200);
  expect(detail.response.json()).toEqual((await oracle([colonies[2]]) as unknown[])[0]);
});

it.each([
  ['in Silent Space', async () => { await f.db.update(shards).set({ role: 'WAITING' }); }],
  ['on vacation', async () => { await f.db.update(planets).set({ vacationUntil: minutes(600), vacationStartedAt: minutes(-600) })
    .where(eq(planets.controllerPlayerId, f.playerIds[0]!)); }],
] as const)('renders a commander %s exactly as it renders alone', async (_name, vary) => {
  const { capital, colonies } = await richWorld();
  await vary();
  const get = await app();
  const { response } = await get('/api/planets');
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json<{ planets: unknown }>().planets).toEqual(await oracle([capital, ...colonies.toSorted()]));
});

/**
 * THE COST OF A LIST NO LONGER GROWS WITH ITS WORLDS. Counted inside the view's
 * snapshot: the commander, the world list and every world's tables. Before F1.4 a
 * plain ruleset 19 commander paid 25 more per world, and this rich one 124 for four.
 */
it('reads a plain commander\'s four worlds for the price of one', async () => {
  f = await seedWorld(4);
  await f.db.update(seasons).set({ rulesetVersion: 19, radiationBombStartsAt: minutes(-60) }).where(eq(seasons.id, f.seasonId));
  const get = await app();
  const one = await get('/api/planets');
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(inArray(planets.id, f.planetIds.slice(1)));
  const four = await get('/api/planets');
  const detail = await get(`/api/planets/${f.planetIds[1]!}`);
  const report = `view: one ${one.view}, four ${four.view}, detail ${detail.view}`;

  expect(four.view - one.view, report).toBe(0);
  expect(four.view, report).toBeLessThanOrEqual(32);
  expect(detail.view, report).toBeLessThanOrEqual(32);
});

it('keeps a rich commander\'s list far below its old per-world price', async () => {
  const { colonies } = await richWorld();
  const get = await app();
  const four = await get('/api/planets');
  const detail = await get(`/api/planets/${colonies[0]}`);
  const report = `view: four ${four.view}, detail ${detail.view}`;
  // A stationed clan wave brings its own names, ships and radiation: once, not per world.
  // A world under a bomb's aura still projects its dose with reads of its own (repair,
  // research, hardware, path, tech, lots); only that world pays them, and it is rare.
  expect(four.view, report).toBeLessThanOrEqual(50);
  expect(detail.view, report).toBeLessThanOrEqual(50);
});

it('reads every world inside one read-only snapshot and renders after it commits', async () => {
  await richWorld();
  const get = await app();
  const { response } = await get('/api/planets');
  expect(response.statusCode).toBe(200);
  const views = viewTransactions();
  expect(views).toHaveLength(1);
  const inside = new Set(views[0]);
  const worldReads = wire.filter(query =>
    /from "(buildings|units|satellites|planet_faults|strategic_assets|build_orders|ship_damage_lots)"/.test(query));
  expect(worldReads.length).toBeGreaterThan(0);
  for (const query of worldReads) expect(inside.has(query), query).toBe(true);
});

it('refuses a list that names a world the commander no longer controls, as one world did', async () => {
  const { capital, colonies } = await richWorld();
  await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1]! }).where(eq(planets.id, colonies[1]));
  const now = f.clock.now();
  const read = (ids: string[]) => f.db.transaction(tx => loadPlanetViewsData(tx, ids, { now: () => now }), SNAPSHOT);
  await expect(read([capital, colonies[1]])).rejects.toMatchObject({ code: 'PLACEMENT_CHANGED', status: 409 });
  await expect(read([capital, crypto.randomUUID()])).rejects.toMatchObject({ code: 'PLANET_NOT_FOUND', status: 404 });
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, colonies[1]));
  await expect(read([colonies[1]])).rejects.toBeInstanceOf(GameError);
  await expect(read([colonies[1]])).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED', status: 403 });
});

it('keeps the capital first and the colonies in id order', async () => {
  const { capital, colonies } = await richWorld();
  const get = await app();
  const ids = (await get('/api/planets')).response.json<{ planets: { planet: { id: string } }[] }>().planets.map(p => p.planet.id);
  expect(ids).toEqual([capital, ...colonies.toSorted()]);
});

it('writes nothing and locks nothing while it reads', async () => {
  await richWorld();
  const get = await app();
  await get('/api/planets');
  const [view] = viewTransactions();
  expect(view!.filter(q => /^(insert|update|delete)\b/i.test(q) || /\bfor (update|share|no key update|key share)\b/i.test(q))).toEqual([]);
});

/**
 * A MUTATION ANSWERS WITH THE WORLD AS A GET READS IT. Scaling plan F1.4, step 5.
 *
 * The mutation already locked and ticked its world, so the response takes no season
 * lock, no second tick and no radiation or Aegis write. It keeps the world's row lock:
 * a world the mutation did not hold (an abandoned colony answers with the capital)
 * still cannot change under the response between its reads.
 */
/** A mutation waits for a finished research order to land; keep the fixture's one queued. */
async function mutableWorld() {
  const worlds = await richWorld();
  await f.db.update(researchOrders).set({ readyAt: minutes(45) });
  return worlds;
}

async function wireOf<T>(run: () => Promise<T>) {
  wire.length = 0;
  const value = await run();
  return { value, queries: [...wire] };
}

it('renders a mutation response for the price of a read-only detail, writing nothing', async () => {
  const { capital, colonies } = await mutableWorld();
  const now = f.clock.now();
  const clock = { now: () => now };
  // The colony the mutation holds, under a bomb's aura, and a capital it never locked.
  for (const world of [colonies[0], capital]) {
    const inside = await db.transaction(async tx => {
      await loadLocked(tx, colonies[0], clock);
      return wireOf(() => loadPlanetViewData(tx, world, clock));
    });
    // The same world a GET reads once the mutation commits, at the same instant.
    const read = await db.transaction(tx => wireOf(() => loadPlanetViewsData(tx, [world], clock)), SNAPSHOT);
    const report = `${world === capital ? 'capital' : 'held colony'}: read ${read.queries.length}, mutation ${inside.queries.length}`;
    expect(inside.queries.length, report).toBe(read.queries.length);
    expect(inside.queries.filter(q => /^(insert|update|delete)\b/i.test(q)), report).toEqual([]);
    expect(inside.queries.filter(q => /\bfor (update|share|no key update|key share)\b/i.test(q)), report)
      .toEqual([expect.stringMatching(/^select .* from "planets" where "planets"\."id" in \(.*\) for update$/)]);
    expect(buildPlanetView(inside.value), report).toEqual(buildPlanetView(read.value[0]!));
  }
});

it('answers a mutation with the world a GET reads right after it', async () => {
  const { capital, colonies } = await mutableWorld();
  const get = await app();
  for (const world of [colonies[0], capital]) {
    const collected = await collectWorks(db, world, f.clock, f.playerIds[0]);
    const { response } = await get(`/api/planets/${world}`);
    expect(response.statusCode, response.body).toBe(200);
    expect(JSON.parse(JSON.stringify(collected.planet))).toEqual(response.json());
  }
});
