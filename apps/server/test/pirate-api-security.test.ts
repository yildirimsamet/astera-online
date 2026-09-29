import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import { pino } from 'pino';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TokenService } from '../src/auth/tokens.js';
import { systemClock } from '../src/clock.js';
import { createDb } from '../src/db/client.js';
import { registerPirateRoutes } from '../src/routes/pirates.js';
import { GameError } from '../src/services/planet.js';
import { Presence } from '../src/services/presence.js';
import { testEnv } from './helpers.js';

it('temporarily refuses pirate launches only for the IMG account', async () => {
  const logger: FastifyBaseLogger = pino({ level: 'silent' });
  const connection = createDb(testEnv().DATABASE_URL);
  const presence = new Presence(connection.db, systemClock);
  vi.spyOn(presence, 'touch').mockResolvedValue(false);
  const app = Fastify({ loggerInstance: logger });
  app.decorate('tokens', new TokenService('test-secret-that-is-long-enough', 15, 30));
  app.decorate('presence', presence);
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof GameError) return reply.status(error.status).send({ error: error.code });
    if (error instanceof z.ZodError) return reply.status(400).send({ error: 'BAD_REQUEST' });
    return reply.status(500).send({ error: 'INTERNAL' });
  });
  registerPirateRoutes(app);
  await app.ready();

  try {
    const img = {
      authorization: `Bearer ${await app.tokens.issueAccess('3d0e4b19-35bb-420d-87ad-b57d807c8d04')}`,
    };
    const other = {
      authorization: `Bearer ${await app.tokens.issueAccess(randomUUID())}`,
    };
    const request = (headers: typeof img, payload: Record<string, unknown>) => app.inject({
      method: 'POST',
      url: '/api/pirates/raid',
      headers,
      payload,
    });

    for (const payload of [{}, { pirateId: 'A'.repeat(22), fleet: { DART: 1 } }]) {
      const denied = await request(img, payload);
      expect(denied.statusCode, denied.body).toBe(403);
      expect(denied.json()).toMatchObject({ error: 'PIRATE_RAID_SUSPENDED' });
    }

    const allowed = await request(other, {});
    expect(allowed.statusCode, allowed.body).toBe(400);
    expect(allowed.json()).toMatchObject({ error: 'BAD_REQUEST' });

    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/pirates/raid',
      payload: { pirateId: 'A'.repeat(22), fleet: { DART: 1 } },
    });
    expect(unauthenticated.statusCode).toBe(401);
  } finally {
    await app.close();
    await connection.close();
  }
});
