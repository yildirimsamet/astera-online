import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HULLS, MONUMENT_BALANCE, MONUMENT_CAPACITY, MONUMENT_SEASON_DEFAULTS, distance, interpolatePosition, monumentDifficulty, seededFrom, travelExact, type Vec3 } from '@astera/rules';
import { galaxySchema, monumentsSchema, monumentSendSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { clanWarOperations, hpRadiationSources, monumentProbes, monuments, monumentShipLots, monumentWaves, notifications, planets, radiationSources, seasons, units } from '../src/db/schema.js';
import * as stream from '../src/stream/bus.js';
import * as monumentService from '../src/services/monument.js';
import { clanActor, createClan } from '../src/services/clan.js';
import { fuelUp, giveUnits, grant, levelWorld, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture;
let app: FastifyInstance;
let closeApp: () => Promise<void>;
let m: typeof monuments.$inferSelect;
let auth: { authorization: string };
let other: { authorization: string };
const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
const key = () => ({ ...auth, 'idempotency-key': randomUUID() });
const post = (url: string, payload: object, headers: Record<string, string> = key()) => app.inject({ method: 'POST', url, payload, headers });
const launchBody = () => ({ originPlanetId: f.planetIds[0]!, fleet: { CITADEL: 2, ARGOSY: 1 }, purpose: 'ATTACK' });
beforeEach(async () => {
  f = await seedWorld(3, 20_261_011);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  await levelWorld(f.db, f.planetIds);
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'HANGAR', 10);
    await fuelUp(f.db, id);
    await giveUnits(f.db, id, { CITADEL: 2, ARGOSY: 1 });
    await f.db.update(planets).set({ x: 3500, y: 0, z: 0 }).where(eq(planets.id, id));
  }
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, settledAt: f.clock.now() }).returning())[0]!;
  const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
  app = built.app;
  closeApp = built.close;
  await app.ready();
  auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  other = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}` };
});
afterEach(async () => { await closeApp(); });
afterAll(async () => { await (await testDb()).close(); });

async function hold(index: number, cargo = 200, target = m) {
  const id = randomUUID();
  await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[index]! }).where(eq(monuments.id, target.id));
  await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target.id, playerId: f.playerIds[index]!,
    originPlanetId: f.planetIds[index]!, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { CITADEL: 2, ARGOSY: 2 },
    tech: { SHIP_ARMOR: 3 }, route: [], fuelPaid: 0, status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now() });
  const lots = await f.db.insert(monumentShipLots).values([
    { waveId: id, hull: 'CITADEL', count: 2, damageBp: 2000, remainderBp: 0.125, deuterium: 0 },
    { waveId: id, hull: 'ARGOSY', count: 2, damageBp: 0, remainderBp: 0, deuterium: cargo },
  ]).returning();
  await giveUnits(f.db, f.planetIds[index]!, { CITADEL: 2, ARGOSY: 2 }, `monument:${id}`);
  return { id, lots };
}

async function outbound() {
  const own = await hold(0);
  const route = [{ from: { x: 3500, y: 0, z: 0 }, to: { x: m.x, y: m.y, z: m.z },
    startMs: f.clock.now().getTime(), endMs: f.clock.now().getTime() + 20 * 60_000 }];
  await f.db.update(monumentWaves).set({ status: 'OUTBOUND', heldAt: null,
    arriveAt: new Date(route[0]!.endMs), route }).where(eq(monumentWaves.id, own.id));
  await f.db.update(monuments).set({ controllerPlayerId: null }).where(eq(monuments.id, m.id));
  return { ...own, route };
}

describe('Easy / Hard HTTP contracts and personal dispatch boundaries', () => {
  it('publishes radiation levels on monument clouds without relabelling zones or the legacy four-HP cloud', async () => {
    const sources = await f.db.insert(hpRadiationSources).values([
      { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id, x: m.x, y: m.y, z: m.z,
        radius: 1000, intensityHpPerMinute: 2, mode: 'EMIT', activeFrom: f.clock.now() },
      { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id, x: m.x, y: m.y, z: m.z,
        radius: 1000, intensityHpPerMinute: 5, mode: 'EMIT', activeFrom: f.clock.now() },
      { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id, x: m.x, y: m.y, z: m.z,
        radius: 1000, intensityHpPerMinute: 4, mode: 'EMIT', activeFrom: f.clock.now() },
      { seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
        radius: 100, intensityHpPerMinute: 2, mode: 'EMIT', activeFrom: f.clock.now() },
      { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id, x: m.x, y: m.y, z: m.z,
        radius: 1000, intensityHpPerMinute: 2, mode: 'SHELTER', activeFrom: f.clock.now() },
    ]).returning();
    const response = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(response.statusCode, response.body).toBe(200);
    const clouds = galaxySchema.parse(response.json()).hpRadiation;
    if (!clouds) throw new Error('Expected HP radiation in the galaxy response');
    expect(clouds.find(row => row.id === sources[0]!.id)).toMatchObject({ intensityHpPerMinute: 2, level: 1 });
    expect(clouds.find(row => row.id === sources[1]!.id)).toMatchObject({ intensityHpPerMinute: 5, level: 2 });
    for (const source of sources.slice(2)) expect(clouds.find(row => row.id === source.id)).not.toHaveProperty('level');
  });
  it('parses all eight real targets and private access with the actual client schemas without publishing private access', async () => {
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    await f.db.update(monuments).set({ difficulty: 'HARD', ...MONUMENT_SEASON_DEFAULTS.positions[0] }).where(eq(monuments.id, m.id));
    await f.db.insert(monuments).values(MONUMENT_SEASON_DEFAULTS.positions.slice(1).map((position, index) => {
      const ordinal = index + 2;
      const difficulty = monumentDifficulty(ordinal);
      const balance = MONUMENT_BALANCE[difficulty];
      return { seasonId: f.seasonId, ordinal, difficulty, ...position, capacity: balance.capacity,
        productionPerMinute: balance.productionPerMinute, garrison: { ...balance.garrison }, settledAt: f.clock.now() };
    }));
    const list = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(list.statusCode, list.body).toBe(200);
    const view = monumentsSchema.parse(list.json());
    expect(view.monuments).toHaveLength(8);
    expect(view.monuments.filter(row => row.difficulty === 'EASY')).toHaveLength(4);
    expect(view.monuments.filter(row => row.difficulty === 'HARD')).toHaveLength(4);
    for (const row of view.monuments) expect(row.sendAccess).toEqual({ playerTier: 4, tierAllowed: row.difficulty === 'HARD', cargoOnly: false });
    const eighth = view.monuments.find(row => row.ordinal === 8)!;
    const detail = await app.inject({ method: 'GET', url: `/api/monuments/${eighth.id}`, headers: auth });
    expect(monumentsSchema.parse(detail.json()).monuments).toEqual([eighth]);
    const galaxy = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(galaxy.statusCode, galaxy.body).toBe(200);
    expect(galaxySchema.parse(galaxy.json()).monuments).toHaveLength(8);
    expect(galaxy.body).not.toContain('sendAccess');
  });

  it('replays an accepted initial dispatch before checking the now-active personal cycle', async () => {
    await f.db.update(monuments).set({ difficulty: 'HARD' }).where(eq(monuments.id, m.id));
    await giveUnits(f.db, f.planetIds[0]!, { CITADEL: 4, ARGOSY: 2 });
    const headers = key();
    const url = `/api/monuments/${m.id}/send`;
    const payload = { ...launchBody(), acknowledgeShieldLoss: true };
    const responses = await Promise.all([post(url, payload, headers), post(url, payload, headers)]);
    for (const response of responses) expect(response.statusCode, response.body).toBe(200);
    expect(responses[0].json()).toEqual(responses[1].json());
    expect(monumentSendSchema.parse(responses[0].json()).wave.status).toBe('OUTBOUND');
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
    const rejected = await post(url, payload);
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json()).toMatchObject({ error: 'MONUMENT_FLEET_ACTIVE' });
  });

  it('keeps recall available after Easy becomes tier-ineligible, while refusing new cargo atomically', async () => {
    await f.db.update(monuments).set({ difficulty: 'EASY', capacity: 1550 }).where(eq(monuments.id, m.id));
    const own = await hold(0);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    const before = await f.db.select().from(units);
    const fuel = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.deuterium;
    const denied = await post(`/api/monuments/${m.id}/send`, {
      originPlanetId: f.planetIds[0]!, purpose: 'REINFORCE', fleet: { ARGOSY: 1 }, acknowledgeShieldLoss: true,
    });
    expect(denied.statusCode, denied.body).toBe(403);
    expect(denied.json()).toMatchObject({ error: 'MONUMENT_TIER_FORBIDDEN', params: { tier: 4, maxTier: 3 } });
    expect(await f.db.select().from(units)).toEqual(before);
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.deuterium).toBe(fuel);
    const recalled = await post(`/api/monuments/waves/${own.id}/recall`, { all: true });
    expect(recalled.statusCode, recalled.body).toBe(200);
    expect(recalled.json()).toMatchObject({ wave: { status: 'RETURNING' } });
  });

  it('reopens combat access on an overdue final return without a worker tick', async () => {
    await f.db.update(monuments).set({ difficulty: 'HARD' }).where(eq(monuments.id, m.id));
    const own = await outbound();
    f.clock.advance(0.1);
    const turned = await post(`/api/monuments/waves/${own.id}/recall`, { all: true });
    expect(turned.statusCode, turned.body).toBe(200);
    const homeAt = turned.json<{ wave: { arriveAt: string } }>().wave.arriveAt;
    f.clock.set(new Date(homeAt));
    const read = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(read.statusCode, read.body).toBe(200);
    const view = monumentsSchema.parse(read.json());
    expect(view.waves).toEqual([]);
    expect(view.monuments[0]?.sendAccess?.cargoOnly).toBe(false);
    const again = await post(`/api/monuments/${m.id}/send`, { ...launchBody(), acknowledgeShieldLoss: true });
    expect(again.statusCode, again.body).toBe(200);
  });
});

describe('whole monument flight recall regressions over HTTP', () => {
  it('recalls every survivor atomically even when a cached cohort dies before the request', async () => {
    const own = await outbound();
    await f.db.update(monumentShipLots).set({ damageBp: 9900 }).where(eq(monumentShipLots.id, own.lots[0]!.id));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: HULLS.CITADEL.hp * 0.05, activeFrom: f.clock.now() });
    const cached = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(cached.statusCode, cached.body).toBe(200);
    expect(cached.json()).toMatchObject({ waves: [{ fleet: { CITADEL: 2, ARGOSY: 2 } }] });
    f.clock.advance(1);
    const url = `/api/monuments/waves/${own.id}/recall`;
    const stale = await post(url, { selections: own.lots.map(lot => ({ lotId: lot.id, count: lot.count })) });
    expect(stale.statusCode, stale.body).toBe(400);
    expect(stale.json()).toMatchObject({ error: 'BAD_MONUMENT_RECALL' });
    const turned = await post(url, { all: true });
    expect(turned.statusCode, turned.body).toBe(200);
    expect(turned.json()).toMatchObject({ wave: { id: own.id, status: 'RETURNING', reservedBulk: 0 } });
    const remaining = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, own.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ hull: 'ARGOSY', count: 2, deuterium: 200 });
    expect(remaining[0]!.damageBp).toBeGreaterThan(0);
    const ships = await f.db.select().from(units).where(eq(units.location, `monument:${own.id}`));
    expect(ships).toMatchObject([{ hull: 'ARGOSY', count: 2 }]);
  });

  it('replays simultaneous and later whole-fleet retries without a second turn', async () => {
    const own = await outbound();
    f.clock.advance(1);
    const url = `/api/monuments/waves/${own.id}/recall`;
    const headers = { ...auth, 'idempotency-key': `monument-flight-recall:${own.id}` };
    const replies = await Promise.all([post(url, { all: true }, headers), post(url, { all: true }, headers)]);
    for (const reply of replies) expect(reply.statusCode, reply.body).toBe(200);
    expect(replies[0].json()).toEqual(replies[1].json());
    const before = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, own.id));
    f.clock.advance(5);
    const replay = await post(url, { all: true }, headers);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(replies[0].json());
    expect(await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, own.id))).toEqual(before);
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
    expect((await f.db.select().from(monumentShipLots)).reduce((sum, lot) => sum + lot.count, 0)).toBe(4);
  });

  it('rejects another owner and ambiguous or malformed whole-fleet commands', async () => {
    const own = await outbound();
    const url = `/api/monuments/waves/${own.id}/recall`;
    expect((await post(url, { all: true }, { ...other, 'idempotency-key': randomUUID() })).statusCode).toBe(403);
    for (const payload of [{ all: false }, { all: 'true' }, { all: true, selections: [] },
      { all: true, selections: [{ lotId: own.lots[0]!.id, count: 1 }] }, {}, { all: true, waveId: own.id }]) {
      expect((await post(url, payload)).statusCode).toBe(400);
    }
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('OUTBOUND');
  });

  it('refuses a wholly dead flight without returning or recreating ships', async () => {
    const own = await outbound();
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: 100_000, activeFrom: f.clock.now() });
    f.clock.advance(1);
    const response = await post(`/api/monuments/waves/${own.id}/recall`, { all: true });
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json()).toMatchObject({ error: 'MONUMENT_NOT_RECALLABLE' });
    expect((await f.db.select().from(monumentWaves)).filter(wave => wave.status === 'RETURNING')).toEqual([]);
  });

  it('exposes native home/speed facts that predict the actual turn between reads, including at launch', async () => {
    const own = await outbound();
    const initial = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(initial.statusCode, initial.body).toBe(200);
    const forecast = initial.json<{ waves: { returnForecast: { homePosition: Vec3; speed: number; minutes: number } }[] }>().waves[0]!.returnForecast;
    expect(forecast).toMatchObject({ minutes: 0, homePosition: own.route[0]!.from });
    expect(forecast.speed).toBeGreaterThan(0);
    f.clock.advance(0.5);
    const now = f.clock.now().getTime();
    const leg = own.route[0]!;
    const position = interpolatePosition(leg.from, leg.to, leg.startMs, leg.endMs, now);
    const predicted = travelExact(distance(position, forecast.homePosition), forecast.speed);
    const turned = await post(`/api/monuments/waves/${own.id}/recall`, { all: true });
    expect(turned.statusCode, turned.body).toBe(200);
    const actual = turned.json<{ wave: { arriveAt: string } }>().wave.arriveAt;
    expect(Math.abs(Date.parse(actual) - now - predicted * 60_000)).toBeLessThanOrEqual(1);
  });
});

describe('monument public facts and private manifests over HTTP', () => {
  it('delivers an overdue surviving probe on read even when its owner has no monument fleet', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    let id = randomUUID();
    while (seededFrom('monument:probe:v1', season!.asteroidKey, id)() < 0.75) id = randomUUID();
    const outAt = new Date(f.clock.now().getTime() + 60_000);
    await f.db.insert(monumentProbes).values({ id, seasonId: f.seasonId, monumentId: m.id,
      playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, departAt: f.clock.now(), arriveAt: outAt,
      outboundRoute: [{ from: { x: 3500, y: 0, z: 0 }, to: { x: m.x, y: m.y, z: m.z }, startMs: f.clock.now().getTime(), endMs: outAt.getTime() }] });
    f.clock.advance(120);
    const read = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(read.statusCode, read.body).toBe(200);
    expect(read.json()).toMatchObject({ probes: [], probeReports: [{ monumentId: m.id, fleet: {} }] });
    await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect((await f.db.select().from(notifications)).filter((row) => row.kind === 'probe_report')).toHaveLength(1);
  });

  it('keeps parallel reads consistent with physical partial recalls', async () => {
    const own = await hold(0);
    f.clock.advance(1);
    for (let round = 0; round < 2; round++) {
      const jobs = Array.from({ length: 24 }, () => app.inject({ method: 'GET', url: '/api/monuments', headers: auth }));
      const recall = post(`/api/monuments/waves/${own.id}/recall`, { selections: [{ lotId: own.lots[1]!.id, count: 1 }] });
      const responses = await Promise.all([...jobs, recall]);
      expect(responses.map((response) => response.statusCode), responses.filter((response) => response.statusCode !== 200).map((response) => response.body).join('\n'))
        .toEqual(Array(25).fill(200));
    }
  });

  it('reads one consistent manifest snapshot while a separate recall commits between its queries', async () => {
    const own = await hold(0);
    const cargoId = own.lots.find((lot) => lot.hull === 'ARGOSY')?.id;
    if (!cargoId) throw new Error('missing cargo fixture');
    const readRosters = monumentService.readMonumentRosters;
    let intercepted = false;
    const snapshot = vi.spyOn(monumentService, 'readMonumentRosters').mockImplementation(async (tx, ids, extra) => {
      if (intercepted) return readRosters(tx, ids, extra);
      intercepted = true;
      const before = await tx.select().from(monumentShipLots).where(eq(monumentShipLots.id, cargoId));
      const moved = await post(`/api/monuments/waves/${own.id}/recall`, { selections: [{ lotId: cargoId, count: 1 }] });
      expect(moved.statusCode, moved.body).toBe(200);
      const after = await tx.select().from(monumentShipLots).where(eq(monumentShipLots.id, cargoId));
      expect(after).toEqual(before);
      return readRosters(tx, ids, extra);
    });
    try {
      const view = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
      expect(view.statusCode, view.body).toBe(200);
      expect(intercepted).toBe(true);
      expect(view.json()).toMatchObject({ waves: [{ fleet: { CITADEL: 2, ARGOSY: 2 } }] });
      expect((await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.id, cargoId)))[0]?.count).toBe(1);
    } finally { snapshot.mockRestore(); }
  });

  it('reconciles two overdue targets together and emits each physical loss only once during concurrent reads', async () => {
    const [second] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 2,
      x: -6000, y: 0, z: 0, capacity: MONUMENT_CAPACITY, productionPerMinute: 60, settledAt: f.clock.now() }).returning();
    if (!second) throw new Error('missing second monument fixture');
    await hold(0, 200, m);
    await hold(0, 200, second);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE',
      x: 0, y: 0, z: 0, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: 1000, activeFrom: f.clock.now() });
    f.clock.advance(3);
    const responses = await Promise.all(Array.from({ length: 8 }, () => app.inject({ method: 'GET', url: '/api/monuments', headers: auth })));
    expect(responses.map((response) => response.statusCode)).toEqual(Array(8).fill(200));
    for (const response of responses) expect(response.json()).toMatchObject({ monuments: [
      { controller: { kind: 'NEUTRAL' }, used: 0 }, { controller: { kind: 'NEUTRAL' }, used: 0 },
    ], waves: [] });
    expect((await f.db.select().from(notifications)).filter((row) => row.kind === 'radiation_lost')).toHaveLength(2);
    expect(await f.db.select().from(monumentShipLots)).toEqual([]);
  });

  it('publishes an empty garrison return time only if it fits before the season cutoff', async () => {
    await f.db.update(monuments).set({ emptySince: f.clock.now() }).where(eq(monuments.id, m.id));
    let view = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(view.json()).toMatchObject({ monuments: [{ respawnAt: new Date(f.clock.now().getTime() + 86_400_000).toISOString() }] });
    await f.db.update(seasons).set({ endsAt: new Date(f.clock.now().getTime() + 43_200_000) }).where(eq(seasons.id, f.seasonId));
    view = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(view.json()).toMatchObject({ monuments: [{ respawnAt: null }] });
  });

  it('projects ordinary own HOLD reads and quotes without waiting for or writing the home world', async () => {
    const own = await hold(0, 200);
    const beforeLots = await f.db.select().from(monumentShipLots);
    const beforeWorlds = await f.db.select().from(planets);
    f.clock.advance(1);
    let release: () => void = vi.fn();
    let ready: () => void = vi.fn();
    const started = new Promise<void>((resolve) => { ready = resolve; });
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const blocker = f.db.transaction(async (tx) => {
      await tx.select().from(planets).where(eq(planets.id, f.planetIds[0]!)).for('update');
      ready();
      await wait;
    });
    await started;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const reads = Promise.all([
        app.inject({ method: 'GET', url: '/api/monuments', headers: auth }),
        post(`/api/monuments/${m.id}/quote`, { originPlanetId: f.planetIds[0]!, fleet: { CITADEL: 1 }, purpose: 'REINFORCE' }),
        post(`/api/monuments/waves/${own.id}/recall/quote`, { selections: [{ lotId: own.lots[1]!.id, count: 1 }] }),
      ]);
      const responses = await Promise.race([reads, new Promise<null>((resolve) => { timeout = setTimeout(() => { resolve(null); }, 1200); })]);
      expect(responses, 'ordinary reads/quotes waited for an unrelated home-row mutation').not.toBeNull();
      expect(responses?.map((response) => response.statusCode)).toEqual([200, 200, 200]);
      expect(await f.db.select().from(monumentShipLots)).toEqual(beforeLots);
      expect(await f.db.select().from(planets)).toEqual(beforeWorlds);
      expect(responses?.[0]?.json()).toMatchObject({ waves: [{ deuterium: 260 }] });
    } finally { if (timeout) clearTimeout(timeout); release(); await blocker; }
  });

  it('publishes only current radiation at the monument, including overlapping zones and shelters', async () => {
    const now = f.clock.now();
    const base = { seasonId: f.seasonId, anchorKind: 'MONUMENT' as const, anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 1000, mode: 'EMIT' as const, activeFrom: now };
    await f.db.insert(hpRadiationSources).values([
      { ...base, intensityHpPerMinute: 4, activeFrom: new Date(now.getTime() - 60_000), activeUntil: now },
      { ...base, intensityHpPerMinute: 6 },
      { ...base, intensityHpPerMinute: 99, activeFrom: new Date(now.getTime() + 60_000) },
      { ...base, anchorKind: 'ZONE', anchorId: null, intensityHpPerMinute: 2 },
      { ...base, anchorKind: 'ZONE', anchorId: null, x: m.x + 1000, intensityHpPerMinute: 99 },
    ]);
    for (const url of ['/api/galaxy', '/api/monuments']) {
      const read = await app.inject({ method: 'GET', url, headers: auth });
      expect(read.statusCode, read.body).toBe(200);
      expect(read.json()).toMatchObject({ monuments: [{ radiationHpPerMinute: 8 }] });
    }
    await f.db.insert(hpRadiationSources).values({ ...base, anchorKind: 'ZONE', anchorId: null, mode: 'SHELTER', intensityHpPerMinute: 0 });
    const sheltered = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(sheltered.json()).toMatchObject({ monuments: [{ radiationHpPerMinute: 0 }] });
  });

  it('keeps frozen monument and galaxy reads available without settling or mutating', async () => {
    await hold(0, 500);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    const before = await f.db.select().from(monumentShipLots);

    const monumentsRead = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(monumentsRead.statusCode, monumentsRead.body).toBe(200);
    expect(monumentsRead.json<{ waves: unknown[] }>().waves[0]).toMatchObject({ status: 'HOLD', deuterium: 500 });
    const galaxyRead = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(galaxyRead.statusCode, galaxyRead.body).toBe(200);
    expect(galaxyRead.json<{ monuments: unknown[] }>().monuments).toHaveLength(1);
    expect(await f.db.select().from(monumentShipLots)).toEqual(before);
  });

  it('keeps the public galaxy projection available when an unrelated monument roster needs repair', async () => {
    const enemy = await hold(1, 500);
    await f.db.delete(monumentShipLots).where(eq(monumentShipLots.id, enemy.lots[0]!.id));
    const before = await f.db.select().from(monumentWaves);
    const response = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ monuments: unknown[] }>().monuments).toMatchObject([{ id: m.id, controller: { kind: 'PLAYER', playerId: f.playerIds[1] } }]);
    expect(await f.db.select().from(monumentWaves)).toEqual(before);
  });

  it('keeps a late read at the season cutoff and refuses every new native action before a delayed close worker', async () => {
    const held = await hold(0, 500);
    const at = f.clock.now(), cutoff = new Date(at.getTime() + 600_000);
    await f.db.update(seasons).set({ endsAt: cutoff }).where(eq(seasons.id, f.seasonId));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: 4, activeFrom: at });
    f.clock.set(new Date(cutoff.getTime() + 120_000));
    const read = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(read.statusCode, read.body).toBe(200);
    expect(read.json<{ waves: { returnForecast: unknown }[] }>().waves[0]?.returnForecast)
      .toMatchObject({ doseHp: 0, minutes: 0, arriveAt: cutoff.toISOString(), destroyed: 0 });
    const snapshot = await f.db.select().from(monumentShipLots);
    f.clock.advance(60);
    expect((await app.inject({ method: 'GET', url: '/api/monuments', headers: auth })).statusCode).toBe(200);
    expect(await f.db.select().from(monumentShipLots)).toEqual(snapshot);
    const selection = { selections: [{ lotId: held.lots[0]!.id, count: 1 }] };
    for (const [url, payload] of [
      [`/api/monuments/${m.id}/quote`, launchBody()], [`/api/monuments/${m.id}/send`, launchBody()],
      [`/api/monuments/${m.id}/probe`, { originPlanetId: f.planetIds[0]! }],
      [`/api/monuments/waves/${held.id}/recall/quote`, selection], [`/api/monuments/waves/${held.id}/recall`, selection],
    ] as const) {
      const denied = await post(url, payload);
      expect(denied.statusCode, denied.body).toBe(409);
      expect(denied.json<{ error: string }>().error).toBe('SEASON_FROZEN');
    }
  });
  it('publishes a lazy final HOLD death to the public control cache and its owner once', async () => {
    await hold(0, 500);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: 1000, activeFrom: f.clock.now() });
    f.clock.advance(3);
    const changed = vi.spyOn(stream, 'publishShard');
    try {
      const view = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
      expect(view.statusCode, view.body).toBe(200);
      expect(view.json()).toMatchObject({ monuments: [{ controller: { kind: 'NEUTRAL' }, used: 0 }], waves: [] });
      expect(changed).toHaveBeenCalledWith(expect.anything(), f.seasonId, 'control');
      await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
      const notices = await f.db.select().from(notifications).where(eq(notifications.kind, 'radiation_lost'));
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({ playerId: f.playerIds[0], payload: { targetKind: 'MONUMENT', monumentId: m.id, lost: 4, left: 0 } });
    } finally { changed.mockRestore(); }
  });
  it('marks the actual monument through the existing clan route, with strict alternatives and one retry-safe operation', async () => {
    await grant(f.db, f.planetIds[0]!, 600_000, 300_000);
    const actor = await clanActor(f.db, f.accountIds[0]!);
    await f.db.transaction((tx) => createClan(tx, { actor, name: 'Monument Hunters', tag: 'MH', description: '', recruiting: true, clock: f.clock }));
    const headers = key();
    const payload = { targetMonumentId: m.id };
    const first = await post('/api/clan/war/target', payload, headers);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ operation: { target: { kind: 'MONUMENT', monumentId: m.id, planetId: null, playerId: null } } });
    expect((await post('/api/clan/war/target', payload, headers)).json()).toEqual(first.json());
    const operations = await f.db.select().from(clanWarOperations);
    expect(operations).toHaveLength(1);
    expect(operations[0]?.targetMonumentId).toBe(m.id);
    expect((await post('/api/clan/war/target', { targetMonumentId: m.id, targetPlanetId: f.planetIds[1] })).statusCode).toBe(400);
    expect((await post('/api/clan/war/target', payload, { ...other, 'idempotency-key': randomUUID() })).statusCode).toBe(403);
  });

  it('requires authentication for reading and every action', async () => {
    for (const url of ['/api/monuments', `/api/monuments/${m.id}`]) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    }
    for (const suffix of ['quote', 'send', 'probe']) expect((await app.inject({ method: 'POST',
      url: `/api/monuments/${m.id}/${suffix}`, payload: launchBody() })).statusCode).toBe(401);
  });

  it('publishes public models/control/clouds without an enemy fleet, tech, damage or cargo', async () => {
    const enemy = await hold(1, 777);
    const enemyReservation = await post(`/api/monuments/${m.id}/send`, {
      originPlanetId: f.planetIds[1]!, fleet: { CITADEL: 1 }, purpose: 'REINFORCE',
      acknowledgeShieldLoss: false, acknowledgeRadiationLoss: false,
    }, { ...other, 'idempotency-key': randomUUID() });
    expect(enemyReservation.statusCode, enemyReservation.body).toBe(200);
    await f.db.insert(radiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 500, mode: 'EMIT', intensityPctPerMinute: 1, activeFrom: f.clock.now() });
    const [cloud] = await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 500, intensityHpPerMinute: 4, mode: 'EMIT', activeFrom: f.clock.now() }).returning();
    const list = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ monuments: [{ id: m.id, ordinal: 1, position: { x: 6000, y: 0, z: 0 },
      capacity: MONUMENT_CAPACITY, productionPerMinute: 60, radiationHpPerMinute: 4, reserved: 0,
      controller: { kind: 'PLAYER', playerId: f.playerIds[1] } }], waves: [], probes: [] });
    for (const secret of [enemy.id, 'ARGOSY', 'SHIP_ARMOR', 'remainderBp', '"deuterium":777']) expect(list.body).not.toContain(secret);
    const galaxy = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(galaxy.body).not.toContain('reserved');
    expect(galaxy.json()).toMatchObject({ radiationModel: 'HP', radiation: [], monuments: [{ id: m.id }], hpRadiation: [{ id: cloud!.id,
      intensityHpPerMinute: 4, center: { x: 6000, y: 0, z: 0 }, radius: 500 }] });
    expect(galaxy.body).not.toContain(enemy.id);
  });

  it('never opens monument or HP payloads in a pre-16 galaxy', async () => {
    await hold(0);
    await f.db.update(seasons).set({ rulesetVersion: 15 }).where(eq(seasons.id, f.seasonId));
    const response = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    expect(response.json()).toMatchObject({ monuments: [], waves: [], probes: [] });
    const detail = await app.inject({ method: 'GET', url: `/api/monuments/${m.id}`, headers: auth });
    expect(detail.statusCode).toBe(404);
    const transaction = vi.spyOn(f.db, 'transaction');
    const galaxy = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(transaction).not.toHaveBeenCalled();
    transaction.mockRestore();
    expect(galaxy.json()).toMatchObject({ monuments: [], hpRadiation: [] });
    expect((await post(`/api/monuments/${m.id}/send`, launchBody())).statusCode).toBe(409);
  });

  it('shows exact health/load and return forecast only for the owner', async () => {
    const own = await hold(0);
    const response = await app.inject({ method: 'GET', url: `/api/monuments/${m.id}`, headers: auth });
    expect(response.statusCode).toBe(200);
    const ownView = response.json<{ waves: unknown[] }>();
    expect(ownView).toMatchObject({ waves: [{ id: own.id, playerId: f.playerIds[0], status: 'HOLD',
      lots: expect.arrayContaining([expect.objectContaining({ hull: 'CITADEL', count: 2, damageBp: 2000, remainderBp: 0.125 })]) as unknown[],
      deuterium: 200, returnForecast: { destroyed: 0, deuterium: 200 } }] });
    const outsider = await app.inject({ method: 'GET', url: `/api/monuments/${m.id}`, headers: other });
    expect(outsider.json()).toMatchObject({ waves: [], probeReports: [] });
    expect(outsider.body).not.toContain(own.id);
  });

  it('quotes the deterministic HOLD rate for a friendly reinforcement without promising an attack result', async () => {
    await hold(0, 200);
    const response = await post(`/api/monuments/${m.id}/quote`, {
      originPlanetId: f.planetIds[0]!, fleet: { CITADEL: 1 }, purpose: 'REINFORCE',
      acknowledgeShieldLoss: true, acknowledgeRadiationLoss: false,
    });
    expect(response.statusCode, response.body).toBe(200);
    const quoteView = response.json<{ holdForecast: { productionPerMinute: number; nextLossAt: string | null } }>();
    expect(quoteView).toMatchObject({ holdForecast: { productionPerMinute: expect.any(Number) as number, nextLossAt: null } });
    expect(quoteView.holdForecast.productionPerMinute).toBeGreaterThan(0);
    const attack = await post(`/api/monuments/${m.id}/quote`, { ...launchBody(), acknowledgeShieldLoss: true });
    expect(attack.statusCode, attack.body).toBe(403);
  });
});

describe('monument dispatch, probe and physical partial recall over HTTP', () => {
  it('forecasts the first outbound casualty and the complete wing death using its own armor and actual route', async () => {
    const start = f.clock.now().getTime();
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: 1000, activeFrom: f.clock.now() });
    const sent = await post(`/api/monuments/${m.id}/send`, { ...launchBody(), acknowledgeRadiationLoss: true });
    expect(sent.statusCode, sent.body).toBe(200);
    const response = await app.inject({ method: 'GET', url: '/api/monuments', headers: auth });
    const [wave] = response.json<{ waves: { nextLossAt: string | null; fadeAt: string | null; lots: { hull: string; maxHp: number }[] }[] }>().waves;
    const hp = wave!.lots.map(lot => lot.maxHp);
    expect(wave!.nextLossAt).not.toBeNull();
    expect(new Date(wave!.nextLossAt!).getTime()).toBe(start + Math.ceil(Math.min(...hp) / 1000 * 60_000));
    expect(wave!.fadeAt).not.toBeNull();
    expect(new Date(wave!.fadeAt!).getTime()).toBe(start + Math.ceil(Math.max(...hp) / 1000 * 60_000));
  });
  it('forecasts a lethal outbound route and requires the sender’s explicit loss acknowledgement', async () => {
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 10_000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    const quote = await post(`/api/monuments/${m.id}/quote`, launchBody());
    expect(quote.statusCode).toBe(200);
    expect(quote.json()).toMatchObject({ outboundForecast: { destroyed: 3 } });
    expect((await post(`/api/monuments/${m.id}/send`, launchBody())).json()).toMatchObject({ error: 'RADIATION_LETHAL', params: { count: 3 } });
    expect(await f.db.select().from(monumentWaves)).toEqual([]);
    expect((await post(`/api/monuments/${m.id}/send`, { ...launchBody(), acknowledgeRadiationLoss: true })).statusCode).toBe(200);
  });

  it('has no fill time for a gun-only HOLD and forecasts physical cargo lost on return', async () => {
    const own = await hold(0, 500);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 10_000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    const response = await app.inject({ method: 'GET', url: `/api/monuments/${m.id}`, headers: auth });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ waves: [{ returnForecast: { destroyed: 4, deuterium: 0, lostDeuterium: 500 } }] });
    await f.db.delete(monumentShipLots).where(eq(monumentShipLots.hull, 'ARGOSY'));
    await f.db.update(units).set({ count: 0 }).where(eq(units.location, `monument:${own.id}`));
    await giveUnits(f.db, f.planetIds[0]!, { CITADEL: 2 }, `monument:${own.id}`);
    await f.db.delete(hpRadiationSources);
    const gunOnly = await app.inject({ method: 'GET', url: `/api/monuments/${m.id}`, headers: auth });
    expect(gunOnly.statusCode).toBe(200);
    expect(gunOnly.json()).toMatchObject({ waves: [{ fillsAt: null, productionPerMinute: 0 }] });
  });

  it('splits one owner’s production between their physical waves without duplicating the rate', async () => {
    await hold(0, 500);
    await hold(0, 500);
    const response = await app.inject({ method: 'GET', url: `/api/monuments/${m.id}`, headers: auth });
    expect(response.statusCode).toBe(200);
    const view = response.json<{ waves: { productionPerMinute: number }[] }>();
    expect(view.waves).toHaveLength(2);
    expect(view.waves.reduce((sum, wave) => sum + wave.productionPerMinute, 0)).toBeCloseTo(60, 8);
  });

  it('quotes before committing and retries a send without another unit, tankful or bay', async () => {
    const url = `/api/monuments/${m.id}`;
    const quoted = await post(`${url}/quote`, launchBody());
    expect(quoted.statusCode, quoted.body).toBe(200);
    expect(await f.db.select().from(monumentWaves)).toEqual([]);
    const headers = key();
    const first = await post(`${url}/send`, launchBody(), headers);
    expect(first.statusCode).toBe(200);
    const replay = await post(`${url}/send`, launchBody(), headers);
    expect(replay.json()).toEqual(first.json());
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
    const physical = await f.db.select().from(units).where(eq(units.ownerPlayerId, f.playerIds[0]!));
    expect(physical.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });

  it('rejects a foreign origin, forged actor, forbidden hull and malformed selection', async () => {
    expect((await post(`/api/monuments/${m.id}/send`, { ...launchBody(), originPlanetId: f.planetIds[1]! })).statusCode).toBe(403);
    for (const extra of [{ playerId: f.playerIds[1]! }, { fleet: { PROSPECTOR: 1 } }, { fleet: { GARRISON: 1 } },
      { fleet: {} }, { fleet: { DART: -1 } }, { fleet: { DART: 0.5 } }]) {
      expect((await post(`/api/monuments/${m.id}/send`, { ...launchBody(), ...extra })).statusCode).toBe(400);
    }
    expect(await f.db.select().from(monumentWaves)).toEqual([]);
  });

  it('quotes the selected ships’ own cargo/health and recalls the same fraction once', async () => {
    const own = await hold(0, 300);
    const cargo = own.lots.find((lot) => lot.hull === 'ARGOSY')!;
    const payload = { selections: [{ lotId: cargo.id, count: 1 }] };
    const url = `/api/monuments/waves/${own.id}/recall`;
    const quote = await post(`${url}/quote`, payload);
    expect(quote.statusCode).toBe(200);
    expect(quote.json()).toMatchObject({ deuterium: 150, fleet: { ARGOSY: 1 }, destroyed: 0, arrivalDeuterium: 150 });
    const headers = key();
    const first = await post(url, payload, headers);
    expect(first.statusCode).toBe(200);
    expect((await post(url, payload, headers)).json()).toEqual(first.json());
    const native = await f.db.select().from(monumentWaves);
    expect(native).toHaveLength(2);
    const [returning] = native.filter((wave) => wave.status === 'RETURNING');
    expect(await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, returning!.id)))
      .toMatchObject([{ hull: 'ARGOSY', count: 1, deuterium: 150 }]);
    expect((await f.db.select().from(monumentShipLots)).reduce((sum, lot) => sum + lot.deuterium, 0)).toBe(300);
  });

  it('cannot recall another owner’s wave or insert a foreign lot into one’s own recall', async () => {
    const own = await hold(0);
    const enemy = await hold(1);
    const payload = { selections: [{ lotId: enemy.lots[0]!.id, count: 1 }] };
    expect((await post(`/api/monuments/waves/${enemy.id}/recall`, payload)).statusCode).toBe(403);
    expect((await post(`/api/monuments/waves/${own.id}/recall`, payload)).statusCode).toBe(400);
    expect(await f.db.select().from(monumentWaves)).toHaveLength(2);
  });

  it('retries a probe at the same idempotency key without the cooldown or a second charge', async () => {
    const headers = key();
    const url = `/api/monuments/${m.id}/probe`;
    const payload = { originPlanetId: f.planetIds[0]! };
    const first = await post(url, payload, headers);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ probe: { monumentId: m.id, status: 'OUTBOUND' }, lossProbability: 0.75 });
    expect((await post(url, payload, headers)).json()).toEqual(first.json());
    expect((await post(url, payload)).json()).toMatchObject({ error: 'PROBE_COOLDOWN' });
  });

  it('refuses a missing mutation key and a reused key with a changed body', async () => {
    const url = `/api/monuments/${m.id}/send`;
    expect((await post(url, launchBody(), auth)).statusCode).toBe(400);
    const headers = key();
    expect((await post(url, launchBody(), headers)).statusCode).toBe(200);
    expect((await post(url, { ...launchBody(), fleet: { CITADEL: 1 } }, headers)).statusCode).toBe(409);
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
  });
});
