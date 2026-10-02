import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, SHIP_DAMAGE } from '@astera/rules';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { seasons } from '../src/db/schema.js';
import { landShips } from '../src/services/shipDamage.js';
import { grant, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE REPAIR STATION OVER HTTP. `plan.md` F4.
 *
 * One door: `POST /api/planets/:planetId/repairs`, naming the world in the path the way
 * a fault repair does, with either the lots to repair or `all`. Anything else in the body
 * is refused before the transaction opens. A cancel is the yard's own cancel door.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('POST /api/planets/:planetId/repairs', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let closeApp: () => Promise<void>;
  let auth: { authorization: string };
  let lotId: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion })
      .where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 4);
    await grant(f.db, f.planetIds[0]!, 200_000, 100_000);
    await f.db.transaction((tx) => landShips(tx, {
      planetId: f.planetIds[0]!,
      ownerPlayerId: f.playerIds[0]!,
      fleet: { BALLISTA: 1 },
      damage: [{ hull: 'BALLISTA', count: 1, damageBp: 6400 }],
      at: f.clock.now(),
    }));
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    closeApp = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
    const view = await app.inject({ method: 'GET', url: `/api/planets/${f.planetIds[0]!}`, headers: auth });
    lotId = view.json<{ dock: { lots: { id: string }[] } }>().dock.lots[0]!.id;
  });

  afterEach(async () => {
    await closeApp();
  });

  const repair = (body: unknown, planetId = f.planetIds[0]!, headers: Record<string, string> = auth) =>
    app.inject({ method: 'POST', url: `/api/planets/${planetId}/repairs`, headers, payload: body as object });

  it('starts a repair on the named lots and answers with the whole world', async () => {
    const response = await repair({ lotIds: [lotId] });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      orderId: string;
      planet: { dock: { lots: { repairing: boolean }[] }; queues: { REPAIR: unknown[] } };
    }>();
    expect(body.orderId).toEqual(expect.any(String));
    expect(body.planet.dock.lots[0]?.repairing).toBe(true);
    expect(body.planet.queues.REPAIR).toHaveLength(1);
  });

  it('starts one repair on everything waiting', async () => {
    expect((await repair({ all: true })).statusCode).toBe(200);
  });

  it('refuses a body that is neither, both, or something else', async () => {
    for (const body of [{}, { lotIds: [] }, { lotIds: ['not-a-uuid'] }, { all: false }, { all: true, lotIds: [lotId] }, { all: true, extra: 1 }]) {
      expect((await repair(body)).statusCode, JSON.stringify(body)).toBe(400);
    }
  });

  /**
   * ONE HAND-PICKED LIST NAMES AT MOST `repairLotsPerOrder` LOTS — the bound the client's
   * menu reads before it sends (`repairSelection`); a longer choice of everything goes as
   * `all`. At the bound the shape is accepted and the unknown lots are refused by the service.
   */
  it('takes a hand-picked list up to the bound the client reads, and refuses one longer', async () => {
    const ids = (n: number) => Array.from({ length: n }, () => randomUUID());
    expect((await repair({ lotIds: ids(SHIP_DAMAGE.repairLotsPerOrder + 1) })).statusCode).toBe(400);
    const atBound = await repair({ lotIds: ids(SHIP_DAMAGE.repairLotsPerOrder) });
    expect(atBound.statusCode).toBe(404);
    expect(atBound.json<{ error?: string }>().error).toBe('REPAIR_LOT_NOT_FOUND');
  });

  it('refuses another commander\'s world and a stranger with no session', async () => {
    const foreign = await repair({ all: true }, f.planetIds[1]);
    expect(foreign.statusCode).toBeGreaterThanOrEqual(400);
    expect(foreign.statusCode).toBeLessThan(500);
    expect((await repair({ all: true }, f.planetIds[0], {})).statusCode).toBe(401);
  });
});
