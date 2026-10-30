import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAN, MONUMENT_CAPACITY } from '@astera/rules';
import { buildApp } from '../src/app.js';
import {
  accounts, honorTotals, hpRadiationSources, monumentShipLots, monumentWaves, monuments, planets, seasons,
} from '../src/db/schema.js';
import { acceptClanRequest, applyToClan, clanActor, createClan } from '../src/services/clan.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { readPublicMonumentFacts } from '../src/services/monumentView.js';
import { hpRadiationForGalaxy } from '../src/services/radiationSources.js';
import { publishPrivate, publishShard } from '../src/stream/bus.js';
import { grant, levelWorld, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE GALAXY READ, CACHED. Scaling plan F1.8 (C3 + C4 + Q3).
 *
 * Every commander polls `/api/galaxy`, and a warm read still ran the season's rules,
 * its monuments (under a season lock), its radiation, both podiums and the clan's
 * presence for every caller. Those are the galaxy's, not the caller's: they are read
 * once per galaxy and projected to the request's instant, so a warm read runs only
 * the caller's own rows and answers exactly what an uncached read answers.
 */
const silent = pino({ level: 'silent' });
const MIN = 60_000;
/** The identity and placement gate's statements (C1/C2, separate F1.8 items). */
const GATE = 6;
/** The caller's own rows: Telescope watches, clan membership, own faults. */
const OWN = 3;

let f: Fixture;
let m: typeof monuments.$inferSelect;
let cached: ReturnType<typeof buildApp>;
let fresh: ReturnType<typeof buildApp>;
let tokens: string[];

const statements = (response: LightMyRequestResponse) => Number(response.headers['x-db-statements']);
const read = (built: ReturnType<typeof buildApp>, seat = 0) =>
  built.app.inject({ url: '/api/galaxy', headers: { authorization: `Bearer ${tokens[seat]!}` } });
/** The cached answer converges on the uncached one well inside the 30 s repair TTL. */
const converges = async (seat = 0) => {
  await vi.waitFor(async () => {
    expect((await read(cached, seat)).json()).toEqual((await read(fresh, seat)).json());
  }, { timeout: 3_000, interval: 50 });
};

beforeEach(async () => {
  f = await seedWorld(3, 20_261_030);
  await f.db.update(seasons).set({ rulesetVersion: 16, monumentMotionStartsAt: f.clock.now(), monumentRadiationStartsAt: f.clock.now() })
    .where(eq(seasons.id, f.seasonId));
  await levelWorld(f.db, f.planetIds);
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', CLAN.founderCoreLevel);
    await grant(f.db, id, 600_000, 300_000);
  }
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, settledAt: f.clock.now(), controllerPlayerId: f.playerIds[1]! }).returning())[0]!;
  const wave = randomUUID();
  await f.db.insert(monumentWaves).values({ id: wave, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[1]!,
    originPlanetId: f.planetIds[1]!, unitLocation: `monument:${wave}`, purpose: 'ATTACK', sentFleet: { CITADEL: 2 },
    tech: {}, route: [], fuelPaid: 0, status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now() });
  await f.db.insert(monumentShipLots).values({ waveId: wave, hull: 'CITADEL', count: 2, damageBp: 0, remainderBp: 0, deuterium: 0 });
  const now = f.clock.now().getTime();
  await f.db.insert(hpRadiationSources).values([
    // On the monument, live: in its own dose and on the map.
    { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id, x: m.x, y: m.y, z: m.z, radius: 900, mode: 'EMIT',
      radiationLevel: 2, intensityHpPerMinute: 12.5, activeFrom: new Date(now - 10 * MIN) },
    // Ended a day and a half ago: gone from both.
    { seasonId: f.seasonId, anchorKind: 'ZONE', anchorId: null, x: 0, y: 0, z: 0, radius: 500, mode: 'EMIT',
      intensityHpPerMinute: 5, activeFrom: new Date(now - 48 * 60 * MIN), activeUntil: new Date(now - 36 * 60 * MIN) },
    // Opens in an hour: drawn, not yet dosing.
    { seasonId: f.seasonId, anchorKind: 'ZONE', anchorId: null, x: 100, y: 0, z: 0, radius: 500, mode: 'EMIT',
      intensityHpPerMinute: 5, activeFrom: new Date(now + 60 * MIN) },
    // A bomb's aura: shown while it burns, then history only the server keeps.
    { seasonId: f.seasonId, origin: 'BOMB', anchorKind: 'PLANET', anchorId: f.planetIds[2]!, x: 10, y: 0, z: 0, radius: 1,
      mode: 'EMIT', radiationLevel: 1, intensityHpPerMinute: 6, activeFrom: new Date(now - 5 * MIN), activeUntil: new Date(now + 20 * MIN) },
  ]);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  await f.db.insert(honorTotals).values(f.playerIds.map((playerId, index) => ({ seasonId: f.seasonId, playerId, score: 300 - index * 100 })));
  const leader = await clanActor(f.db, f.accountIds[0]!);
  const { clanId } = await f.db.transaction(tx => createClan(tx, { actor: leader, name: 'Outer Horizon', tag: 'OH',
    description: 'Together at the rim.', recruiting: true, clock: f.clock }));
  const member = await clanActor(f.db, f.accountIds[2]!);
  const application = await f.db.transaction(tx => applyToClan(tx, { actor: member, clanId, now: f.clock.now() }));
  await f.db.transaction(tx => acceptClanRequest(tx, { actor: leader, requestId: application.requestId, acknowledgeHostile: true, now: f.clock.now() }));
  // The third commander is an operator: hidden from everyone else's galaxy and podium.
  const [admin] = await f.db.select({ username: accounts.username }).from(accounts).where(eq(accounts.id, f.accountIds[2]!));
  const env = { ADMIN_USERNAMES: admin!.username };
  cached = buildApp({ env: testEnv(env), clock: f.clock, logger: silent, db: f.db });
  fresh = buildApp({ env: testEnv({ ...env, PROJECTION_CACHE_ENABLED: 'false' }), clock: f.clock, logger: silent, db: f.db });
  await cached.app.ready();
  await fresh.app.ready();
  await cached.app.bus.start();
  tokens = await Promise.all(f.accountIds.map(id => cached.app.tokens.issueAccess(id)));
});
afterEach(async () => { await cached.close(); await fresh.close(); });
afterAll(async () => { await (await testDb()).close(); });

describe('a warm galaxy read', () => {
  it('runs only the caller’s own rows, member or not', async () => {
    for (const seat of [0, 1]) {
      await read(cached, seat);
      const warm = await read(cached, seat);
      expect(warm.statusCode).toBe(200);
      expect(statements(warm), `seat ${String(seat)}`).toBeLessThanOrEqual(GATE + OWN);
    }
  });

  it('answers exactly what an uncached read answers, now and later', async () => {
    for (const seat of [0, 1, 2]) {
      await read(cached, seat);
      expect((await read(cached, seat)).json()).toEqual((await read(fresh, seat)).json());
    }
    // The monument moves and the bomb's aura burns out without a database write.
    f.clock.advance(25);
    expect((await read(cached)).json()).toEqual((await read(fresh)).json());
  });

  it('lists the worlds in one order, however the rows lie on disk', async () => {
    // Changing an indexed column and back rewrites the row at the heap's end with new
    // index entries; without an order the next read lists it elsewhere.
    const [first] = await f.db.select({ id: planets.id, slot: planets.slotIndex }).from(planets)
      .where(eq(planets.seasonId, f.seasonId)).orderBy(planets.slotIndex).limit(1);
    for (const slot of [1_000_000, first!.slot]) {
      await f.db.update(planets).set({ slotIndex: slot }).where(eq(planets.id, first!.id));
    }
    const order = (await f.db.select({ id: planets.id, slot: planets.slotIndex }).from(planets).where(eq(planets.seasonId, f.seasonId)))
      .sort((a, b) => a.slot - b.slot || (a.id < b.id ? -1 : 1)).map(row => row.id);
    const listed = (await read(fresh)).json<{ planets: { id: string }[] }>().planets.map(world => world.id);
    expect(listed.filter(id => order.includes(id))).toEqual(order.filter(id => listed.includes(id)));
  });

  it('draws the monuments and radiation the locked SQL readers draw', async () => {
    const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
    for (const minutes of [0, 25, 90]) {
      f.clock.advance(minutes);
      await read(cached);
      const body = (await read(cached)).json<{ monuments: unknown; hpRadiation: unknown }>();
      const old = await f.db.transaction(tx => readPublicMonumentFacts(tx, f.seasonId, f.clock.now()));
      expect(body.monuments, `+${String(minutes)} min`).toEqual(wire(old));
      expect(body.hpRadiation, `+${String(minutes)} min`).toEqual(wire(await hpRadiationForGalaxy(f.db, f.seasonId, f.clock.now())));
    }
  });
});

describe('what moves it', () => {
  beforeEach(async () => { await read(cached); await read(cached, 2); });

  it('a new radiation source', async () => {
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', anchorId: null, x: 200, y: 0, z: 0,
      radius: 400, mode: 'EMIT', intensityHpPerMinute: 3, activeFrom: f.clock.now() });
    await f.db.transaction(tx => publishShard(tx, f.seasonId, 'world'));
    await converges();
  });

  it('a monument changing hands', async () => {
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[0]! }).where(eq(monuments.id, m.id));
    await f.db.transaction(tx => publishShard(tx, f.seasonId, 'control'));
    await converges();
  });

  it('a score that reorders the podium', async () => {
    await f.db.update(honorTotals).set({ score: 1_000 }).where(eq(honorTotals.playerId, f.playerIds[1]!));
    await f.db.transaction(tx => publishShard(tx, f.seasonId, 'score'));
    await converges();
  });

  it('a clanmate opening their door to support', async () => {
    await f.db.update(planets).set({ defencePosture: 'SUPPORT' }).where(eq(planets.id, f.planetIds[2]!));
    // `setDefencePosture` tells every other member, not the galaxy.
    await f.db.transaction(tx => publishPrivate(tx, f.playerIds[0]!, 'posture'));
    await converges();
  });

  it('but not a fleet leaving or landing somewhere else', async () => {
    // The two commonest events in a galaxy move none of its shared facts.
    await cached.app.inject({ url: '/api/galaxy/traffic', headers: { authorization: `Bearer ${tokens[0]!}` } });
    const before = cached.app.projections.status();
    await f.db.transaction(tx => publishShard(tx, f.seasonId, 'launch'));
    await f.db.transaction(tx => publishShard(tx, f.seasonId, 'arrival'));
    // Traffic does move on them; once it has, both events have been delivered.
    await vi.waitFor(() => {
      expect(cached.app.projections.status().traffic.invalidations).toBeGreaterThanOrEqual(before.traffic.invalidations + 1);
    }, { timeout: 3_000, interval: 20 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(cached.app.projections.status().galaxyFacts.invalidations).toBe(before.galaxyFacts.invalidations);
  });

  it('a clan renamed', async () => {
    await f.db.execute(sql`update clans set name = 'Inner Horizon'`);
    await f.db.transaction(tx => publishShard(tx, f.seasonId, 'clan'));
    await converges();
  });
});

describe('the season lock', () => {
  it('is never taken by a galaxy read', async () => {
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>(resolve => { locked = resolve; });
    const holder = f.db.transaction(async tx => {
      await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, f.seasonId)).for('update');
      locked();
      await new Promise<void>(resolve => { release = resolve; });
    });
    await held;
    try {
      const response = await Promise.race([
        read(cached),
        new Promise<null>(resolve => setTimeout(() => { resolve(null); }, 3_000)),
      ]);
      expect(response?.statusCode, 'a cold galaxy read waited on the season row').toBe(200);
    } finally {
      release();
      await holder;
    }
  });
});
