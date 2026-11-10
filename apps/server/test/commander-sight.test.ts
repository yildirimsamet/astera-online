import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { arenaShips, arenaAdmirals, arenaAdmiralLegs, missions } from '../src/db/schema.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { giveInstrument, giveSatellite, placeAt, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

interface SightWorld { id: string; commanderShip?: { ship: string; level: number; docked: boolean } }

afterAll(async () => { await (await testDb()).close(); });
describe('commander ships seen by another commander', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  beforeEach(async () => {
    f = await seedWorld(3);
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await placeAt(f.db, f.planetIds[0]!, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, f.planetIds[1]!, { x: 200, y: 0, z: 0 });
    await placeAt(f.db, f.planetIds[2]!, { x: 400, y: 0, z: 0 });
    await giveSatellite(f.db, f.planetIds[0]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[0]!, 'TELESCOPE', 5);
    await f.db.insert(arenaShips).values({ playerId: f.playerIds[1]!, ship: 'muhafiz', level: 20,
      chosenAt: f.clock.now(), fuel: 100, ammo: 100 });
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app; close = built.close;
    await app.ready();
  });
  afterEach(async () => { await close(); });
  const world = async () => {
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const res = await app.inject({ method: 'GET', url: '/api/galaxy', headers: {
      authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`,
    } });
    expect(res.statusCode).toBe(200);
    const planet = res.json<{ planets: SightWorld[] }>().planets.find(p => p.id === f.planetIds[1]);
    expect(planet).toBeDefined();
    return planet!;
  };
  it('publishes the orbiting class and level on a telescope-resolved capital, without private ship fields', async () => {
    expect((await world()).commanderShip).toEqual({ ship: 'muhafiz', level: 20, docked: false });
  });
  it.each(['repair', 'service'] as const)('shows a stationary ship during %s', async readyReason => {
    await f.db.update(arenaShips).set({ readyReason, readyAt: new Date(f.clock.now().getTime() + 60_000) });
    expect((await world()).commanderShip).toEqual({ ship: 'muhafiz', level: 20, docked: true });
  });
  it('shows an expired service as orbiting without requiring its worker to run', async () => {
    await f.db.update(arenaShips).set({ readyReason: 'service', readyAt: f.clock.now() });
    expect((await world()).commanderShip?.docked).toBe(false);
  });
  it.each(['sortieId', 'admiralId'] as const)('does not park a ship away on %s', async key => {
    await f.db.update(arenaShips).set({ [key]: randomUUID() });
    expect(await world()).not.toHaveProperty('commanderShip');
  });
  it('does not park a commander ship still flying home alone', async () => {
    await f.db.insert(arenaAdmirals).values({ playerId: f.playerIds[1]!, seasonId: f.seasonId,
      ship: 'muhafiz', level: 20, status: 'returned', createdAt: f.clock.now(), homeDepartAt: f.clock.now(),
      finishedAt: new Date(f.clock.now().getTime() + 60_000) });
    expect(await world()).not.toHaveProperty('commanderShip');
  });
  it('does not disclose a parked ship outside telescope sight', async () => {
    await f.db.delete(arenaShips).where(eq(arenaShips.playerId, f.playerIds[1]!));
    await f.db.insert(arenaShips).values({ playerId: f.playerIds[2]!, ship: 'akinci', chosenAt: f.clock.now(), fuel: 100, ammo: 100 });
    await placeAt(f.db, f.planetIds[2]!, { x: 10000 });
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const res = await app.inject({ method: 'GET', url: '/api/galaxy', headers: { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` } });
    expect(res.json<{ planets: SightWorld[] }>().planets.find(p => p.id === f.planetIds[2])).not.toHaveProperty('commanderShip');
  });
  it('does not disclose another parked ship through the naked-eye floor alone', async () => {
    await giveInstrument(f.db, f.planetIds[0]!, 'TELESCOPE', 0);
    expect(await world()).not.toHaveProperty('commanderShip');
  });
  it('publishes the frozen escort on an identified flight, hides it on radar-only contacts', async () => {
    const now = f.clock.now();
    const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, ownerPlayerId: f.playerIds[1]!,
      originPlanetId: f.planetIds[1]!, targetPlanetId: f.planetIds[2]!, kind: 'attack', status: 'in_flight',
      fleet: { DART: 10 }, distance: 200, fuelPaid: 0, departAt: new Date(now.getTime() - 60_000), arriveAt: new Date(now.getTime() + 60_000) }).returning();
    const [task] = await f.db.insert(arenaAdmirals).values({ playerId: f.playerIds[1]!, seasonId: f.seasonId,
      ship: 'akinci', level: 6, createdAt: now }).returning();
    await f.db.insert(arenaAdmiralLegs).values({ admiralId: task!.id, kind: 'mission', refId: mission!.id });
    const contacts = await galaxyTraffic(f.db, f.seasonId, f.planetIds[0]!, now, f.playerIds[0], [f.planetIds[0]!]);
    expect(contacts.find(c => c.id === mission!.id)?.admiral).toEqual({ ship: 'akinci', level: 6 });
    await giveInstrument(f.db, f.planetIds[0]!, 'TELESCOPE', 0);
    await giveInstrument(f.db, f.planetIds[0]!, 'RADAR', 5);
    await placeAt(f.db, f.planetIds[0]!, { x: -2000 });
    const radar = await galaxyTraffic(f.db, f.seasonId, f.planetIds[0]!, now, f.playerIds[0], [f.planetIds[0]!]);
    const contact = radar.find(c => c.id === mission!.id);
    expect(contact).toBeDefined();
    expect(contact?.kind).toBe('unknown');
    expect(contact).not.toHaveProperty('admiral');
  });
});
