import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { asteroidPosition, type AsteroidSpec } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { debrisFields, miningRuns, planets, seasons, sensorEpochs } from '../src/db/schema.js';
import { asteroidId, privateAsteroidField } from '../src/services/asteroidField.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import type { EventBus } from '../src/stream/bus.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('asteroid API fog and launch authority', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let bus: EventBus;
  let closeApp: () => Promise<void>;
  let authA: { authorization: string };
  let authB: { authorization: string };
  let targetId: string;
  let target: AsteroidSpec;
  let appearsAt: Date;

  beforeEach(async () => {
    f = await seedWorld(2, 8128);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privateAsteroidField(season!.asteroidKey);
    target = field.find((rock) =>
      !rock.isotopeRich
      && rock.radius > 600
      && rock.appearsAt > 30
      && rock.expiresAt - rock.appearsAt > 120,
    )!;
    targetId = asteroidId(season!.asteroidKey, target.index);
    appearsAt = new Date(f.clock.now().getTime() + target.appearsAt * 60_000);

    await f.db.delete(sensorEpochs);
    const contact = asteroidPosition(target, target.appearsAt);
    await placeAt(f.db, f.planetIds[0]!, contact);
    await placeAt(f.db, f.planetIds[1]!, { x: 0, y: 0, z: 0 });
    await refreshSensorEpoch(f.db, f.planetIds[0]!, f.clock.now());
    await refreshSensorEpoch(f.db, f.planetIds[1]!, f.clock.now());
    f.clock.set(new Date(appearsAt.getTime() + 1_000));

    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 10);
    await giveUnits(f.db, f.planetIds[0]!, { PROSPECTOR: 1 });
    await giveUnits(f.db, f.planetIds[1]!, { PROSPECTOR: 1 });

    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    bus = built.bus;
    closeApp = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    authA = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
    authB = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}` };
  });

  afterEach(async () => {
    await closeApp();
  });

  const field = async (auth: { authorization: string }) => {
    const response = await app.inject({ method: 'GET', url: '/api/mining/field', headers: auth });
    expect(response.statusCode).toBe(200);
    return response.json<{ asteroids: { id: string }[]; nextFieldChangeAt: string | null }>();
  };

  const launch = (
    auth: { authorization: string },
    payload: Record<string, unknown>,
  ) => app.inject({ method: 'POST', url: '/api/mining/launch', headers: auth, payload });

  it('serves two commanders different asteroid sets from the same shared field', async () => {
    const [a, b] = await Promise.all([field(authA), field(authB)]);
    expect(a.asteroids.some((rock) => rock.id === targetId)).toBe(true);
    expect(b.asteroids.some((rock) => rock.id === targetId)).toBe(false);
  });

  it('does not contaminate the second caller when the first caller warmed the projection cache', async () => {
    expect((await field(authA)).asteroids.some((rock) => rock.id === targetId)).toBe(true);
    expect((await field(authB)).asteroids.some((rock) => rock.id === targetId)).toBe(false);
    expect((await field(authA)).asteroids.some((rock) => rock.id === targetId)).toBe(true);
  });

  it('allows a launch exactly after discovery and returns only the opaque id', async () => {
    const response = await launch(authA, { asteroidId: targetId, craft: 1 });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ asteroidId: targetId });
    expect(response.json()).not.toHaveProperty('asteroidIndex');
  });

  it('wakes the commander’s other live clients when a mining run launches', async () => {
    await bus.start();
    const received: string[] = [];
    const unsubscribe = bus.subscribe(f.playerIds[0]!, (event) => {
      received.push(event.kind);
    });

    const response = await launch(authA, { asteroidId: targetId, craft: 1 });
    expect(response.statusCode, response.body).toBe(200);
    const deadline = Date.now() + 2_000;
    while (!received.includes('private:mining') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    unsubscribe();

    expect(received).toContain('private:mining');
  });

  it('wakes the commander’s other live clients when a salvage run launches', async () => {
    const [wreck] = await f.db.insert(debrisFields).values({
      seasonId: f.seasonId,
      planetId: f.planetIds[1]!,
      alloy: 2_000,
      crystal: 800,
      createdAt: f.clock.now(),
    }).returning();
    await bus.start();
    const received: string[] = [];
    const unsubscribe = bus.subscribe(f.playerIds[0]!, (event) => {
      received.push(event.kind);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/mining/harvest',
      headers: authA,
      payload: { fieldId: wreck!.id, craft: 1 },
    });
    expect(response.statusCode, response.body).toBe(200);
    const deadline = Date.now() + 2_000;
    while (!received.includes('private:mining') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    unsubscribe();

    expect(received).toContain('private:mining');
  });

  it('keeps every owned mining run in status when another controlled world is selected', async () => {
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[0], kind: 'COLONY' })
      .where(eq(planets.id, f.planetIds[1]!));
    const launched = await launch(authA, { asteroidId: targetId, craft: 1 });
    expect(launched.statusCode, launched.body).toBe(200);

    const status = await app.inject({
      method: 'GET',
      url: `/api/mining/status?planetId=${f.planetIds[1]!}`,
      headers: authA,
    });
    expect(status.statusCode, status.body).toBe(200);
    expect(status.json<{ runs: { id: string; planetId?: string }[] }>().runs)
      .toContainEqual(expect.objectContaining({
        id: launched.json<{ runId: string }>().runId,
        planetId: f.planetIds[0],
      }));
  });

  it('gives the same refusal for another player’s known id and a fabricated id', async () => {
    const shared = await launch(authB, { asteroidId: targetId, craft: 1 });
    const fabricated = await launch(authB, {
      asteroidId: 'AAAAAAAAAAAAAAAAAAAAAA',
      craft: 1,
    });
    expect(shared.statusCode).toBe(fabricated.statusCode);
    expect(shared.json()).toMatchObject({ error: 'ASTEROID_UNAVAILABLE' });
    expect(fabricated.json()).toEqual(shared.json());
  });

  it('does not reveal whether a hidden id is rich, empty, active or interceptable', async () => {
    const response = await launch(authB, { asteroidId: targetId, craft: 1 });
    expect(response.json()).toEqual({
      error: 'ASTEROID_UNAVAILABLE',
      message: 'That asteroid is not available to your sensors',
    });
  });

  it('rejects the old raw numeric index at the request boundary', async () => {
    const response = await launch(authA, { asteroidIndex: 7, craft: 1 });
    expect(response.statusCode).toBe(400);
  });

  it('refuses a valid id before the first earned contact', async () => {
    f.clock.set(new Date(appearsAt.getTime() - 1));
    const response = await launch(authA, { asteroidId: targetId, craft: 1 });
    expect(response.json()).toMatchObject({ error: 'ASTEROID_UNAVAILABLE' });
  });

  it('does not publish the private field key in either season or field payloads', async () => {
    const season = await app.inject({ method: 'GET', url: '/api/season', headers: authA });
    const mining = await app.inject({ method: 'GET', url: '/api/mining/field', headers: authA });
    const [row] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    expect(season.body).not.toContain(row!.asteroidKey);
    expect(mining.body).not.toContain(row!.asteroidKey);
  });

  it('does not let another commander discover a hidden rock by following a mining route', async () => {
    const launched = await launch(authA, { asteroidId: targetId, craft: 1 });
    expect(launched.statusCode, launched.body).toBe(200);
    const run = launched.json<{ runId: string; arriveAt: string }>();
    const departedAt = f.clock.now().getTime();
    const arrivesAt = new Date(run.arriveAt).getTime();
    f.clock.set(new Date(departedAt + (arrivesAt - departedAt) / 2));

    const hidden = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: authB });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json<{ contacts: { id: string }[] }>().contacts)
      .not.toContainEqual(expect.objectContaining({ id: run.runId }));

    const minute = (f.clock.now().getTime() - new Date('2026-01-01T00:00:00.000Z').getTime())
      / 60_000;
    await placeAt(f.db, f.planetIds[1]!, asteroidPosition(target, minute));
    await refreshSensorEpoch(f.db, f.planetIds[1]!, f.clock.now());
    expect((await field(authB)).asteroids.some((rock) => rock.id === targetId)).toBe(true);

    const earned = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: authB });
    const earnedContacts = earned.json<{ contacts: { id: string; route?: unknown }[] }>().contacts;
    expect(earnedContacts).toContainEqual(expect.objectContaining({ id: run.runId }));
    expect(earnedContacts.find((contact) => contact.id === run.runId)?.route)
      .toEqual(expect.any(Object));
  });

  it('keeps an already discovered race visible while its craft returns after the rock expires', async () => {
    const launched = await launch(authA, { asteroidId: targetId, craft: 1 });
    expect(launched.statusCode, launched.body).toBe(200);
    const run = launched.json<{ runId: string }>();

    // B earns the target while it exists. The target itself may later leave the
    // field, but that must not erase B's right to watch this known flight finish.
    const discoveredMinute = target.appearsAt + 1;
    await placeAt(f.db, f.planetIds[1]!, asteroidPosition(target, discoveredMinute));
    await refreshSensorEpoch(
      f.db,
      f.planetIds[1]!,
      new Date(new Date('2026-01-01T00:00:00.000Z').getTime() + discoveredMinute * 60_000),
    );

    /*
      AND B CAN ACTUALLY SEE THE CRAFT, which is a separate fact from having found
      the rock. Discovery decides whether the ROUTE is published; the sensor zones
      decide whether the craft is published at all. This test is about the first,
      so it hands B the instruments that settle the second and leaves the discovery
      history — recorded above, at the moment the rock was still there — to do its
      own job.
    */
    await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[1]!, 'TELESCOPE', 5);
    await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 5);

    const expiredAt = new Date(
      new Date('2026-01-01T00:00:00.000Z').getTime() + (target.expiresAt + 1) * 60_000,
    );
    await f.db.update(miningRuns).set({
      status: 'returning',
      arriveAt: new Date(expiredAt.getTime() - 5 * 60_000),
      homeAt: new Date(expiredAt.getTime() + 10 * 60_000),
    }).where(eq(miningRuns.id, run.runId));
    f.clock.set(expiredAt);

    const traffic = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: authB });
    expect(traffic.statusCode).toBe(200);
    const contacts = traffic.json<{ contacts: { id: string; route?: unknown }[] }>().contacts;
    expect(contacts).toContainEqual(expect.objectContaining({ id: run.runId }));
    expect(contacts.find((contact) => contact.id === run.runId)?.route)
      .toEqual(expect.any(Object));
  });
});
