import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seasonSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { players } from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE TWO POPULATION FIGURES ON THE DISC. Owner instruction.
 *
 * `online` is a five-minute window and is what somebody at the controls right now
 * looks like. `onlineToday` is a day, and it is the figure that says whether a
 * galaxy is inhabited at all — the live count at four in the morning is honest and
 * says the wrong thing about a world three hundred people are playing.
 */
describe('galaxy population', () => {
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

  const season = async () => seasonSchema.parse(
    (await app.inject({ method: 'GET', url: '/api/season', headers: auth })).json(),
  );

  const seenAgo = async (playerId: string, minutes: number) => {
    await f.db
      .update(players)
      .set({ lastActiveAt: new Date(f.clock.now().getTime() - minutes * 60_000) })
      .where(eq(players.id, playerId));
  };

  it('counts the whole day as well as the live window', async () => {
    // One commander an hour ago, one twelve hours ago: both are gone from the
    // live figure and both were here today.
    await seenAgo(f.playerIds[1]!, 60);
    await seenAgo(f.playerIds[2]!, 12 * 60);

    const now = await season();
    expect(now.online).toBe(1);
    expect(now.onlineToday).toBe(3);
  });

  it('drops a commander from the day figure once a day has passed', async () => {
    await seenAgo(f.playerIds[1]!, 23 * 60 + 59);
    await seenAgo(f.playerIds[2]!, 24 * 60 + 1);

    const now = await season();
    expect(now.online).toBe(1);
    expect(now.onlineToday).toBe(2);
  });
});
