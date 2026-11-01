import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { accounts, legacyFacts } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { recordLegacyFact } from '../src/services/legacy.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { legacyRevealsSchema } from '../../web/src/api/legacySchemas.js';

let f: Fixture;
let app: FastifyInstance;
let close: () => Promise<void>;
let headers: { authorization: string }[];

beforeEach(async () => {
  f = await seedWorld(2, 7342);
  f.clock.advance(12 * 24 * 60);
  const [operator] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[1]!));
  const built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: operator!.username }), logger: pino({ level: 'silent' }) });
  app = built.app; close = built.close;
  await app.ready();
  const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
  headers = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  // 100 probes in one receipt crosses two goals (10 and 100) inside the gameplay transaction;
  // a season played this year also earns this year's pin.
  await f.db.transaction(tx => recordLegacyFact(tx, { accountId: f.accountIds[0]!, seasonId: f.seasonId,
    metric: 'PROBES', sourceKey: 'reveal:probes', amount: 100, at: f.clock.now() }));
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });

const pending = async (who = 0, query = '') => {
  const response = await app.inject({ url: `/api/legacy/me/reveals${query}`, headers: headers[who] });
  expect(response.statusCode).toBe(200);
  return legacyRevealsSchema.parse(response.json());
};
const pieces = (list: { awards: { definitionId: string; tier: number }[] }) => list.awards.map(award => `${award.definitionId}:${String(award.tier)}`);
const reveal = (awardIds: readonly string[], who = 0) =>
  app.inject({ method: 'POST', url: '/api/legacy/me/reveals', headers: headers[who], payload: { awardIds } });

it('requires a commander on both ends', async () => {
  expect((await app.inject({ url: '/api/legacy/me/reveals' })).statusCode).toBe(401);
  expect((await app.inject({ method: 'POST', url: '/api/legacy/me/reveals', payload: { awardIds: [] } })).statusCode).toBe(401);
});

it('keeps a won piece waiting until its owner has watched it, then never again', async () => {
  const first = await pending();
  expect(pieces(first)).toEqual(['deep-sight:1', 'deep-sight:2', 'year-of-service:1']);
  expect(first.total).toBe(3);
  // Reading is not watching: closing the app before the reveal ran leaves the queue as it was.
  expect((await pending()).awards).toHaveLength(3);

  const ack = await reveal([first.awards[0]!.id]);
  expect(ack.statusCode).toBe(200);
  expect(ack.json()).toEqual({ revealed: 1 });
  expect(pieces(await pending())).toEqual(['deep-sight:2', 'year-of-service:1']);
  // A repeated acknowledgement is harmless and changes nothing.
  expect((await reveal([first.awards[0]!.id])).json()).toEqual({ revealed: 0 });
});

it('ignores a piece that belongs to somebody else and never shows another commander a queue', async () => {
  const mine = await pending();
  expect((await reveal(mine.awards.map(award => award.id), 1)).json()).toEqual({ revealed: 0 });
  expect((await pending()).awards).toHaveLength(3);
  expect((await pending(1)).awards).toEqual([]);
});

it('drops a revoked piece from the queue', async () => {
  const second = (await pending()).awards.find(award => award.definitionId === 'deep-sight' && award.tier === 2);
  const revoke = await app.inject({ method: 'POST', url: `/api/admin/legacy/awards/${second!.id}/revoke`, headers: headers[1],
    payload: { reason: 'evidence review' } });
  expect(revoke.statusCode).toBe(200);
  expect(pieces(await pending())).toEqual(['deep-sight:1', 'year-of-service:1']);
});

it('evaluates the ledger when asked to, so a crossing the live gate missed is still revealed', async () => {
  // Written past the gameplay path: nothing has evaluated it yet.
  await f.db.insert(legacyFacts).values({ accountId: f.accountIds[0]!, seasonId: f.seasonId, metric: 'PIRATE_VICTORIES',
    sourceKey: 'reveal:pirates', amount: 10, occurredAt: f.clock.now(), origin: 'EVENT' });
  expect((await pending()).awards.some(award => award.definitionId === 'pirate-hunter')).toBe(false);
  expect((await pending(0, '?refresh=1')).awards.some(award => award.definitionId === 'pirate-hunter')).toBe(true);
});

it('refuses a malformed acknowledgement', async () => {
  expect((await reveal(['not-a-uuid'])).statusCode).toBe(400);
  const many = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  expect((await reveal(many)).statusCode).toBe(400);
});
