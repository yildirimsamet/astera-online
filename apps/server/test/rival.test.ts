import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { rivalSetSchema, seasonSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import {
  battleReports,
  missions,
  probeReports,
  strategicImpacts,
} from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const errorSchema = z.object({ error: z.string() });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('seasonal rival marker', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => { await close(); });

  const set = (planetId: string | null) => app.inject({
    method: 'POST',
    url: '/api/rival',
    headers: auth,
    payload: { planetId },
  });

  it('stores exactly one marker in the existing season payload and replaces it', async () => {
    const initial = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    expect(seasonSchema.parse(initial.json()).rivalPlanetId).toBeNull();
    expect(rivalSetSchema.parse((await set(f.planetIds[1]!)).json())).toEqual({
      rivalPlanetId: f.planetIds[1],
      rivalPlayerId: f.playerIds[1],
      rivalCommitted: false,
    });
    expect(rivalSetSchema.parse((await set(f.planetIds[2]!)).json())).toEqual({
      rivalPlanetId: f.planetIds[2],
      rivalPlayerId: f.playerIds[2],
      rivalCommitted: false,
    });
    const changed = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    expect(seasonSchema.parse(changed.json()).rivalPlanetId).toBe(f.planetIds[2]);
    expect(rivalSetSchema.parse((await set(null)).json())).toEqual({
      rivalPlanetId: null,
      rivalPlayerId: null,
      rivalCommitted: false,
    });
  });

  it('commits the choice after a Death Star interaction', async () => {
    await set(f.planetIds[1]!);
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: {},
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(strategicImpacts).values({
      seasonId: f.seasonId,
      missionId: mission!.id,
      attackerPlayerId: f.playerIds[0]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      outcome: 'FIRST_STRIKE',
      damage: 500,
      destroyedFleet: {},
      createdAt: f.clock.now(),
    });

    expect((await set(f.planetIds[2]!)).statusCode).toBe(409);
    const clear = await set(null);
    expect(clear.statusCode).toBe(409);
    expect(errorSchema.parse(clear.json()).error).toBe('RIVAL_COMMITTED');
    expect(rivalSetSchema.parse((await set(f.planetIds[1]!)).json()).rivalCommitted).toBe(true);
    const season = seasonSchema.parse((await app.inject({
      method: 'GET', url: '/api/season', headers: auth,
    })).json());
    expect(season).toMatchObject({
      rivalPlanetId: f.planetIds[1],
      rivalPlayerId: f.playerIds[1],
      rivalCommitted: true,
    });
  });

  it('commits symmetrically after a conventional battle', async () => {
    await set(f.planetIds[1]!);
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'attack',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: f.planetIds[1]!,
      targetPlanetId: f.planetIds[0]!,
      fleet: { DART: 1 },
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(battleReports).values({
      seasonId: f.seasonId,
      missionId: mission!.id,
      attackerPlayerId: f.playerIds[1]!,
      defenderPlayerId: f.playerIds[0]!,
      targetPlanetId: f.planetIds[0]!,
      targetKind: 'PLAYER',
      grade: 'REPELLED',
      rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: { DART: 1 },
      defenderLosses: {},
      createdAt: f.clock.now(),
    });

    expect((await set(f.planetIds[2]!)).statusCode).toBe(409);
  });

  it('commits when a probe reaches the marked commander', async () => {
    await set(f.planetIds[1]!);
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'probe',
      status: 'in_flight',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: {},
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(probeReports).values({
      observerPlayerId: f.playerIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      missionId: mission!.id,
      accuracy: 0.5,
      stock: { low: 0, high: 0 },
      defence: { low: 0, high: 0 },
      fleetSize: { low: 0, high: 0 },
      fleetHome: true,
      detected: false,
      createdAt: f.clock.now(),
    });

    expect((await set(null)).statusCode).toBe(409);
  });

  it('refuses self and a planet outside the caller’s current galaxy', async () => {
    const self = await set(f.planetIds[0]!);
    expect(self.statusCode).toBe(400);
    expect(errorSchema.parse(self.json()).error).toBe('RIVAL_SELF');
    const foreign = await set(randomUUID());
    expect(foreign.statusCode).toBe(404);
    expect(errorSchema.parse(foreign.json()).error).toBe('RIVAL_NOT_VISIBLE');
  });

  it('requires authentication and rejects extra client-authored state', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/rival', payload: { planetId: null } })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'POST', url: '/api/rival', headers: auth,
      payload: { planetId: f.planetIds[1], bonus: 2 },
    })).statusCode).toBe(400);
  });
});
