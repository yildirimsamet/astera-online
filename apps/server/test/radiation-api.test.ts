import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, TRAVEL } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { radiationSources, seasons } from '../src/db/schema.js';
import { addRadiationSource, endRadiationSource } from '../src/services/radiation.js';
import { fuelUp, giveUnits, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * RADIATION OVER HTTP. `plan.md` F9.
 *
 * The galaxy carries every cloud a flight in the air could still be crossing — lit, not
 * yet lit, or ended within the longest a flight can be up — because the client forecasts
 * a route and draws its own fleet's fade with the same function the server settles with.
 * The launch doors take the commander's acknowledgement of a lethal route.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('radiation on the wire', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let closeApp: () => Promise<void>;
  let auth: { authorization: string };

  const storm = () => addRadiationSource(f.db, {
    seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
    radius: 1_000_000, intensityPctPerMinute: 200, mode: 'EMIT', label: 'storm',
  }, f.clock);

  beforeEach(async () => {
    f = await seedWorld(2);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion })
      .where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) await setLevel(f.db, id, 'SHIPYARD', 4);
    await fuelUp(f.db, f.planetIds[0]!);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    closeApp = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => {
    await closeApp();
  });

  it('shows every cloud a flight could still be crossing, and not one long gone', async () => {
    const live = await storm();
    const soon = await addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 5, y: 6, z: 7 } },
      radius: 9, intensityPctPerMinute: 0, mode: 'SHELTER', label: 'haven',
      activeFrom: new Date(f.clock.now().getTime() + 60 * 60_000),
    }, f.clock);
    const recent = await storm();
    await endRadiationSource(f.db, recent.id, f.clock);
    const old = await storm();
    await f.db.update(radiationSources)
      .set({ activeUntil: new Date(f.clock.now().getTime() - (2 * TRAVEL.pacedFlightCapMinutes + 1) * 60_000) })
      .where(eq(radiationSources.id, old.id));

    const response = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(response.statusCode).toBe(200);
    const { radiation } = response.json<{ radiation: { id: string }[] }>();
    expect(radiation.map((source) => source.id).sort()).toEqual([live.id, soon.id, recent.id].sort());
    expect(radiation.find((source) => source.id === soon.id)).toEqual({
      id: soon.id, mode: 'SHELTER', center: { x: 5, y: 6, z: 7 }, radius: 9, intensityPctPerMinute: 0,
      activeFrom: soon.activeFrom.toISOString(), activeUntil: null,
    });
  });

  it('shows no cloud in a season dealt before the rule', async () => {
    await storm();
    await f.db.update(seasons).set({ rulesetVersion: 13 }).where(eq(seasons.id, f.seasonId));
    const response = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(response.json<{ radiation: unknown[] }>().radiation).toEqual([]);
  });

  it('refuses a lethal launch with the count, and flies it once acknowledged', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { DART: 3 });
    await storm();
    const launch = (extra: object) => app.inject({
      method: 'POST', url: '/api/fleet/launch', headers: auth,
      payload: { originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, fleet: { DART: 3 }, ...extra },
    });
    const refused = await launch({});
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'RADIATION_LETHAL', params: { count: 3 } });
    expect((await launch({ acknowledgeRadiation: true })).statusCode).toBe(200);
  });

  it('takes the same acknowledgement on a transfer', async () => {
    const { planets } = await import('../src/db/schema.js');
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 3);
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    await storm();
    const send = (extra: object) => app.inject({
      method: 'POST', url: '/api/fleet/transfer', headers: auth,
      payload: {
        originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, fleet: { COURIER: 2 },
        cargo: { alloy: 0, crystal: 0, deuterium: 0 }, ...extra,
      },
    });
    expect((await send({})).json()).toMatchObject({ error: 'RADIATION_LETHAL' });
    expect((await send({ acknowledgeRadiation: true })).statusCode).toBe(200);
  });
});
