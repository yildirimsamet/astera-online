import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { accounts, adminActions, cosmeticEntitlements, legacyAwards, seasonResults, seasons, shards } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { recordLegacyFact } from '../src/services/legacy.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { legacyAwardDetailSchema, legacyCatalogueSchema, legacyCollectionSchema, legacyProfileSchema, legacyProgressSchema, legacySeasonsSchema } from '../../web/src/api/legacySchemas.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { commanderRows, demolish } from '../src/services/reclaim.js';

let f: Fixture;
let app: FastifyInstance;
let close: () => Promise<void>;
let headers: { authorization: string }[];
const profile = z.object({ publicId: z.string().uuid(), commanderName: z.string(), self: z.boolean(),
  showcase: z.array(z.object({ awardId: z.string().uuid() })), activeTitle: z.unknown().nullable(),
  collection: z.object({ count: z.number().int() }) });

beforeEach(async () => {
  f = await seedWorld(2, 7341);
  f.clock.advance(12 * 24 * 60);
  const [operator] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[1]!));
  const built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: operator!.username }), logger: pino({ level: 'silent' }) });
  app = built.app; close = built.close;
  await app.ready();
  const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
  headers = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  await f.db.transaction(tx => recordLegacyFact(tx, { accountId: f.accountIds[0]!, seasonId: f.seasonId,
    metric: 'PROBES', sourceKey: 'api:probes', amount: 100, at: f.clock.now() }));
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });

it('requires authentication, publishes an opaque profile and keeps personal data and live intelligence out of the public contract', async () => {
  expect((await app.inject({ url: '/api/legacy/me' })).statusCode).toBe(401);
  const me = await app.inject({ url: '/api/legacy/me', headers: headers[0] });
  expect(me.statusCode).toBe(200);
  const owner = profile.parse(me.json());
  legacyProfileSchema.parse(me.json());
  legacyCatalogueSchema.parse((await app.inject({ url: '/api/legacy/catalogue', headers: headers[0] })).json());
  legacyProgressSchema.parse((await app.inject({ url: '/api/legacy/me/progress', headers: headers[0] })).json());
  legacySeasonsSchema.parse((await app.inject({ url: `/api/legacy/profiles/${owner.publicId}/seasons`, headers: headers[0] })).json());
  const other = await app.inject({ url: `/api/legacy/profiles/${owner.publicId}`, headers: headers[1] });
  expect(other.statusCode).toBe(200);
  expect(profile.parse(other.json()).self).toBe(false);
  for (const field of ['accountId', 'email', 'username', 'fleet', 'wealth', 'resources', 'lastActiveAt', 'isBot']) {
    expect(other.json()).not.toHaveProperty(field);
  }
  expect((await app.inject({ url: `/api/legacy/profiles/${owner.publicId}` })).statusCode).toBe(401);
  const byPlayer = await app.inject({ url: `/api/legacy/players/${f.playerIds[0]!}`, headers: headers[1] });
  expect(profile.parse(byPlayer.json()).publicId).toBe(owner.publicId);
});

it('returns a precise award detail only inside its owner profile, without private evidence', async () => {
  await f.db.update(shards).set({ name: '' });
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const me = legacyProfileSchema.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  const other = legacyProfileSchema.parse((await app.inject({ url: '/api/legacy/me', headers: headers[1] })).json());
  const collection = legacyCollectionSchema.parse((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/collection`, headers: headers[0] })).json());
  const award = collection.awards.find(row => row.definitionId === 'season-memento')!;
  const url = `/api/legacy/profiles/${me.publicId}/awards/${award.id}`;
  const detail = await app.inject({ url, headers: headers[1] });
  expect(detail.statusCode).toBe(200);
  legacyAwardDetailSchema.parse(detail.json());
  expect(detail.json()).toMatchObject({ award: { id: award.id }, owners: 2 });
  expect(legacyAwardDetailSchema.parse(detail.json()).condition.goal).toBeGreaterThan(0);
  expect(detail.json()).not.toHaveProperty('evidence');
  expect((await app.inject({ url })).statusCode).toBe(401);
  expect((await app.inject({ url: `/api/legacy/profiles/${other.publicId}/awards/${award.id}`, headers: headers[1] })).statusCode).toBe(404);
  const history = legacySeasonsSchema.parse((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/seasons`, headers: headers[1] })).json());
  expect(history.seasons).toHaveLength(1);
  expect(legacyAwardDetailSchema.parse(detail.json()).season?.galaxy).toBe(history.seasons[0]!.galaxy);
});

it('counts owners of the same definition, tier and edition rather than everybody with any award', async () => {
  await f.db.transaction(tx => recordLegacyFact(tx, { accountId: f.accountIds[1]!, seasonId: f.seasonId,
    metric: 'PROBES', sourceKey: 'api:other-probes', amount: 10, at: f.clock.now() }));
  const me = legacyProfileSchema.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  await app.inject({ url: '/api/legacy/me', headers: headers[1] });
  const url = `/api/legacy/profiles/${me.publicId}/collection`;
  let collection = legacyCollectionSchema.parse((await app.inject({ url, headers: headers[0] })).json());
  const first = collection.awards.find(row => row.definitionId === 'deep-sight' && row.tier === 1)!;
  const second = collection.awards.find(row => row.definitionId === 'deep-sight' && row.tier === 2)!;
  expect(first.owners).toBe(2);
  expect(second.owners).toBe(1);
  await f.db.insert(legacyAwards).values({ accountId: f.accountIds[1]!, definitionId: 'deep-sight', tier: 2,
    edition: 'another-edition', sourceSeasonId: f.seasonId, rarity: 'RARE', ruleVersion: 1,
    grantedAt: f.clock.now(), evidence: {} });
  const detailUrl = `/api/legacy/profiles/${me.publicId}/awards/${second.id}`;
  const detail = legacyAwardDetailSchema.parse((await app.inject({ url: detailUrl, headers: headers[1] })).json());
  expect(detail.owners).toBe(1);
  await f.db.update(legacyAwards).set({ revokedAt: f.clock.now(), revocationReason: 'ADMIN' })
    .where(eq(legacyAwards.accountId, f.accountIds[1]!));
  collection = legacyCollectionSchema.parse((await app.inject({ url, headers: headers[0] })).json());
  expect(collection.awards.find(row => row.id === first.id)?.owners).toBe(1);
});

it('names the season of an award, the podium place and the career summary a visitor reads first', async () => {
  const before = legacyProfileSchema.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  expect(before.career).toEqual({ seasons: 0, bestHonorRank: null, bestDominionRank: null });
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  // A closed ladder: second on Honor with a score, first on Dominion.
  await f.db.update(seasonResults).set({ honorRank: 2, honorScore: 40, finalRank: 1, dominion: 500 })
    .where(eq(seasonResults.accountId, f.accountIds[0]!));
  const me = legacyProfileSchema.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  const history = legacySeasonsSchema.parse((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/seasons`, headers: headers[1] })).json());
  const season = history.seasons[0]!;
  expect(me.career).toEqual({ seasons: 1, bestHonorRank: 2, bestDominionRank: 1 });
  const collection = legacyCollectionSchema.parse((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/collection`, headers: headers[1] })).json());
  expect(collection.awards.find(row => row.definitionId === 'season-memento')).toMatchObject({ seasonOrdinal: season.ordinal, rank: null });
  expect(collection.awards.find(row => row.definitionId === 'dominion-podium')).toMatchObject({ seasonOrdinal: season.ordinal, rank: 1, tier: 1 });
  expect(collection.awards.find(row => row.definitionId === 'honor-podium')).toMatchObject({ seasonOrdinal: season.ordinal, rank: 2, tier: 2 });
  expect(collection.awards.find(row => row.definitionId === 'deep-sight')).toMatchObject({ seasonOrdinal: season.ordinal, rank: null });
});

it('evaluates proven pre-existing paid rights when another commander opens a profile', async () => {
  await f.db.insert(cosmeticEntitlements).values({ accountId: f.accountIds[1]!, cosmeticId: 'planet-lava',
    source: 'PADDLE', orderRef: 'pre-legacy:paid', grantedAt: f.clock.now() });
  const other = legacyProfileSchema.parse((await app.inject({ url: `/api/legacy/players/${f.playerIds[1]!}`, headers: headers[0] })).json());
  const collection = legacyCollectionSchema.parse((await app.inject({ url: `/api/legacy/profiles/${other.publicId}/collection`, headers: headers[0] })).json());
  expect(collection.awards.some(row => row.definitionId === 'show-off')).toBe(true);
});

it('opens an archived commander through its opaque result after the seasonal player has been removed', async () => {
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const me = legacyProfileSchema.parse((await app.inject({ url: '/api/legacy/me', headers: headers[1] })).json());
  const history = legacySeasonsSchema.parse((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/seasons`, headers: headers[0] })).json());
  await f.db.transaction(async tx => {
    const rows = await commanderRows(tx, [f.planetIds[1]!], f.playerIds[1]!);
    await demolish(tx, [f.planetIds[1]!], f.playerIds[1]!, rows);
  });
  const url = `/api/legacy/results/${history.seasons[0]!.resultId}`;
  const response = await app.inject({ url, headers: headers[0] });
  expect(response.statusCode).toBe(200);
  expect(legacyProfileSchema.parse(response.json())).toMatchObject({ publicId: me.publicId, self: false });
  expect((await app.inject({ url })).statusCode).toBe(401);
});

it('bounds collection requests, validates ownership, and persists the chosen shelf and title', async () => {
  const me = profile.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  expect((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/collection?limit=10000`, headers: headers[0] })).statusCode).toBe(400);
  for (const cursor of ['-1', '0', '2147483648', '99999999999999999999']) {
    expect((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/seasons?cursor=${cursor}`, headers: headers[0] })).statusCode).toBe(400);
  }
  expect((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/seasons?cursor=2147483647`, headers: headers[0] })).statusCode).toBe(200);
  const result = await app.inject({ url: `/api/legacy/profiles/${me.publicId}/collection?limit=1`, headers: headers[0] });
  legacyCollectionSchema.parse(result.json());
  const collection = z.object({ awards: z.array(z.object({ id: z.string().uuid(), owners: z.number().int().positive() })),
    nextCursor: z.string().nullable() }).parse(result.json());
  expect(collection.awards).toHaveLength(1);
  expect(collection.nextCursor).not.toBeNull();
  const awardId = collection.awards[0]!.id;
  expect((await app.inject({ method: 'PUT', url: '/api/legacy/me/showcase', headers: headers[1], payload: { awardIds: [awardId] } })).statusCode).toBe(403);
  expect((await app.inject({ method: 'PUT', url: '/api/legacy/me/showcase', headers: headers[0], payload: { awardIds: [awardId], accountId: f.accountIds[1] } })).statusCode).toBe(400);
  expect((await app.inject({ method: 'PUT', url: '/api/legacy/me/showcase', headers: headers[0], payload: { awardIds: [awardId] } })).statusCode).toBe(200);
  expect((await app.inject({ method: 'PUT', url: '/api/legacy/me/title', headers: headers[0], payload: { awardId } })).statusCode).toBe(200);
  expect(profile.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json()).showcase).toMatchObject([{ awardId }]);
});

it('requires an operator and a reason to revoke an award, clears its presentation and keeps the audit through reevaluation', async () => {
  const me = profile.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  const collection = z.object({ awards: z.array(z.object({ id: z.string().uuid() })) }).parse(
    (await app.inject({ url: `/api/legacy/profiles/${me.publicId}/collection`, headers: headers[0] })).json());
  const awardId = collection.awards[0]!.id;
  await app.inject({ method: 'PUT', url: '/api/legacy/me/showcase', headers: headers[0], payload: { awardIds: [awardId] } });
  const url = `/api/admin/legacy/awards/${awardId}/revoke`;
  expect((await app.inject({ method: 'POST', url, headers: headers[0], payload: { reason: 'Confirmed exploit' } })).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url, headers: headers[1], payload: { reason: '' } })).statusCode).toBe(400);
  expect((await app.inject({ method: 'POST', url, headers: headers[1], payload: { reason: 'Confirmed exploit' } })).statusCode).toBe(200);
  expect((await app.inject({ method: 'POST', url, headers: headers[1], payload: { reason: 'Confirmed exploit' } })).statusCode).toBe(200);
  const updated = profile.parse((await app.inject({ url: '/api/legacy/me', headers: headers[0] })).json());
  expect(updated.showcase).toEqual([]);
  expect(await f.db.select().from(adminActions).where(eq(adminActions.action, 'LEGACY_AWARD_REVOKED'))).toHaveLength(1);
  const inspect = `/api/admin/legacy/profiles/${me.publicId}/awards`;
  expect((await app.inject({ url: inspect, headers: headers[0] })).statusCode).toBe(403);
  const audit = await app.inject({ url: inspect, headers: headers[1] });
  expect(audit.statusCode).toBe(200);
  expect(audit.headers['cache-control']).toBe('private, no-store');
  const auditRows = z.object({ awards: z.array(z.object({ id: z.string().uuid(), revocationReason: z.string().nullable() })) }).parse(audit.json());
  expect(auditRows.awards.find(row => row.id === awardId)?.revocationReason).toBe('ADMIN');
  const restore = `${url.slice(0, -'revoke'.length)}restore`;
  expect((await app.inject({ method: 'POST', url: restore, headers: headers[0], payload: { reason: 'Reviewed evidence' } })).statusCode).toBe(403);
  await f.db.update(seasons).set({ status: 'frozen', endReason: 'FORCED_WIPE',
    closedAt: new Date(f.clock.now().getTime() - 11 * 86400000) }).where(eq(seasons.id, f.seasonId));
  expect((await app.inject({ method: 'POST', url: restore, headers: headers[1], payload: { reason: 'Reviewed evidence' } })).statusCode).toBe(409);
  await f.db.update(seasons).set({ status: 'live', closedAt: null, endReason: null }).where(eq(seasons.id, f.seasonId));
  expect((await app.inject({ method: 'POST', url: restore, headers: headers[1], payload: { reason: 'Reviewed evidence' } })).statusCode).toBe(200);
  expect((await app.inject({ method: 'POST', url: restore, headers: headers[1], payload: { reason: 'Reviewed evidence' } })).statusCode).toBe(200);
  const publicAwards = legacyCollectionSchema.parse((await app.inject({ url: `/api/legacy/profiles/${me.publicId}/collection`, headers: headers[0] })).json());
  expect(publicAwards.awards.some(row => row.id === awardId)).toBe(true);
  expect(await f.db.select().from(adminActions).where(eq(adminActions.action, 'LEGACY_AWARD_RESTORED'))).toHaveLength(1);
});
