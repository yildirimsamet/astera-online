import { and, eq } from 'drizzle-orm';
import { HULLS, piratePosition } from '@astera/rules';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { seasons, units } from '../src/db/schema.js';
import { pirateId, privatePirateField } from '../src/services/pirateField.js';
import { giveUnits, placeAt, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('pirate summary ETA is a combat estimate', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };
  let id: string;
  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const spec = privatePirateField(season!.asteroidKey)[0]!;
    const minute = Math.ceil(spec.appearsAt) + 5;
    f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
    const at = piratePosition(spec, minute);
    await placeAt(f.db, f.planetIds[0]!, { x: at.x + 100, y: at.y, z: at.z });
    id = pirateId(season!.asteroidKey, spec.index);
    const built = buildApp({ env: testEnv({ PROJECTION_CACHE_ENABLED: 'false' }), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });
  afterEach(async () => { await close(); });
  const pirate = async () => {
    const response = await app.inject({ method: 'GET', url: '/api/pirates', headers: auth });
    expect(response.statusCode, response.body).toBe(200);
    const result = response.json<{ pirates: { id: string; reachMinutes: number | null; reach: { hull: string; minutes: number }[] }[] }>().pirates.find((row) => row.id === id);
    expect(result).toBeDefined();
    return result!;
  };
  it('quotes the warship even when the hauler can arrive earlier, retaining both selected-fleet rows', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { DART: 2, COURIER: 2 });
    const target = await pirate();
    const warship = target.reach.find((row) => row.hull === 'DART');
    const carrier = target.reach.find((row) => row.hull === 'COURIER');
    expect(HULLS.COURIER.speed).toBeGreaterThan(HULLS.DART.speed);
    expect(carrier).toBeDefined();
    expect(warship).toBeDefined();
    expect(carrier!.minutes).toBeLessThan(warship!.minutes);
    expect(target.reachMinutes).toBe(warship!.minutes);
  });
  it('has no attack ETA with only haulers at home', async () => {
    await f.db.delete(units).where(and(eq(units.planetId, f.planetIds[0]!), eq(units.location, 'home')));
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    const target = await pirate();
    expect(target.reach.some((row) => row.hull === 'COURIER')).toBe(true);
    expect(target.reachMinutes).toBeNull();
  });
});
