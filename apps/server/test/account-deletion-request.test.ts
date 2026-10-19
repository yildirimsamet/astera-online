import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { MULTI_WORLD, SERVERS } from '@astera/rules';
import { buildApp, type BuiltApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import * as passwords from '../src/auth/password.js';
import { testDb, testEnv, truncateAll } from './helpers.js';
import { joinSettled, giveUnits, fuelUp, placeAt, TEST_SPACING } from './helpers.js';
import { createSeason } from '../src/services/season.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { announcements, chatMediaAssets, commanderTransfers, returnApplications, paddleSkinOrders, polarSkinOrders, shopierOrders, shopierPurchaseCodes, mediaDeletionQueue } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';

const password = 'fixture-correct-horse-battery';
const path = '/api/auth/account-deletion';
let built: BuiltApp;
let mediaDirectory: string;
const clock = new FixedClock(new Date('2026-10-19T00:00:00.000Z'));
beforeEach(async () => {
  const { db } = await testDb(); await truncateAll(db);
  mediaDirectory = await mkdtemp(join(tmpdir(), 'astera-deletion-media-'));
  clock.set(new Date('2026-10-19T00:00:00.000Z'));
  built = buildApp({ db, clock, env: testEnv({ ADMIN_USERNAMES: 'policyoperator', NATIVE_AUTH_ENABLED: 'true', CHAT_MEDIA_DIR: mediaDirectory }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
});

describe('operator approval of a verified deletion request', () => {
  async function pending() {
    const owner = await register();
    const response = await built.app.inject({ method: 'POST', url: path, headers: owner.headers, payload: { currentPassword: password, locale: 'tr' } });
    expect(response.statusCode).toBe(202);
    return { owner, requestId: response.json<{ request: Receipt }>().request.requestId };
  }
  const approve = (requestId: string, headers: { authorization: string }) => built.app.inject({ method: 'POST', url: `/api/admin/account-deletion/${requestId}/approve`, headers, payload: { confirm: true } });
  const complete = (requestId: string, headers: { authorization: string }) => built.app.inject({ method: 'POST', url: `/api/admin/account-deletion/${requestId}/complete`, headers, payload: { confirm: true } });
  async function world(accountId: string) {
    const { season } = await createSeason(built.db, { shardCode: 'EU-DELETION-REQUEST', seed: 91_273, startsAt: clock.now(), playerCap: SERVERS.capacity, rulesetVersion: MULTI_WORLD.rulesetVersion });
    return { ...await joinSettled(built.db, accountId, season.id, clock), season };
  }
  const assetId = '22222222-2222-4222-8222-222222222222';
  async function asset(accountId: string) {
    await built.db.insert(chatMediaAssets).values({ id: assetId, ownerAccountId: accountId, kind: 'image', mimeType: 'image/png', byteSize: 8, createdAt: clock.now() });
  }
  it('persists a private erasure journal before deletion and keeps it after the account has gone', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    const hash = createHash('sha256').update(owner.accountId).digest('hex');
    const filename = join(mediaDirectory, '.account-erasure-ledger', `${hash}.json`);
    const before = await readFile(filename, 'utf8');
    expect(before).toContain(requestId); expect(before).not.toContain(owner.accountId); expect(before).not.toContain('PolicyPilot'); expect(before).not.toContain(password);
    expect((await complete(requestId, operator.headers)).statusCode).toBe(200);
    expect(await readFile(filename, 'utf8')).toContain(hash);
    expect(await built.db.execute(sql`select id from accounts where id = ${owner.accountId}`)).toHaveLength(0);
    expect(await built.db.execute(sql`select account_id from community_policy_acceptances where account_id = ${owner.accountId}`)).toHaveLength(0);
  });
  it('refuses approval if the private erasure journal cannot be persisted and leaves access open', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    await writeFile(join(mediaDirectory, '.account-erasure-ledger'), 'blocked directory');
    const result = await approve(requestId, operator.headers);
    expect(result.statusCode).toBe(503);
    expect(result.json()).toMatchObject({ error: 'DELETION_LEDGER_UNAVAILABLE' });
    expect((await built.app.inject({ url: '/api/auth/me', headers: owner.headers })).statusCode).toBe(200);
  });
  it('records verified support requests by unique username, keeps access open, and preserves the original receipt on retry', async () => {
    const owner = await register(); const other = await register('OtherPilot'); const operator = await register('PolicyOperator');
    await built.db.execute(sql`update accounts set display_name = 'PolicyPilot' where id = ${other.accountId}`);
    const record = () => built.app.inject({ method: 'POST', url: '/api/admin/account-deletion', headers: operator.headers, payload: { username: 'PolicyPilot', locale: 'tr', confirm: true } });
    const first = await record();
    expect(first.statusCode).toBe(202);
    expect(first.headers['cache-control']).toBe('no-store');
    expect((await record()).json()).toEqual(first.json());
    const status = await built.app.inject({ url: path, headers: owner.headers });
    expect(status.json()).toEqual(first.json());
    expect((await built.app.inject({ url: path, headers: other.headers })).json()).toEqual({ request: null });
    expect((await built.app.inject({ url: '/api/auth/me', headers: owner.headers })).statusCode).toBe(200);
    expect(await built.db.execute(sql`select id from admin_actions where action = 'ACCOUNT_DELETION_SUPPORT_REQUEST'`)).toHaveLength(1);
  });
  it('rejects unprivileged or unconfirmed support requests and never guesses a display-name target', async () => {
    const owner = await register(); const operator = await register('PolicyOperator');
    const payload = { username: 'PolicyPilot', locale: 'en', confirm: true };
    expect((await built.app.inject({ method: 'POST', url: '/api/admin/account-deletion', headers: owner.headers, payload })).statusCode).toBe(403);
    for (const body of [{ ...payload, confirm: false }, { ...payload, accountId: owner.accountId }]) expect((await built.app.inject({ method: 'POST', url: '/api/admin/account-deletion', headers: operator.headers, payload: body })).statusCode).toBe(400);
    expect((await built.app.inject({ method: 'POST', url: '/api/admin/account-deletion', headers: operator.headers, payload: { ...payload, username: 'UnknownPilot' } })).statusCode).toBe(404);
    expect(await count()).toBe(0);
  });
  it('removes purchase notes, customer identifiers and checkout secrets while preserving delivery/refund tombstones', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    await built.db.insert(paddleSkinOrders).values({ accountId: owner.accountId, itemId: 'planet-lava', priceId: 'fixture-price', transactionId: 'fixture-transaction', customerId: 'private-customer', status: 'COMPLETED' });
    await built.db.insert(polarSkinOrders).values({ accountId: owner.accountId, itemId: 'planet-lava', productId: assetId, checkoutId: assetId, orderId: assetId, checkoutUrl: 'https://checkout.example.test/private-capability', status: 'COMPLETED' });
    await built.db.insert(shopierOrders).values({ orderId: 'fixture-order', accountId: owner.accountId, itemId: 'planet-lava', status: 'MATCHED', code: 'AST-PRIVATE', note: 'personal@example.test', total: '99', currency: 'TRY' });
    await built.db.insert(shopierPurchaseCodes).values({ accountId: owner.accountId, itemId: 'planet-lava', code: 'AST-PRIVATE', status: 'USED', orderId: 'fixture-order' });
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    expect((await complete(requestId, operator.headers)).statusCode).toBe(200);
    expect(await built.db.select().from(paddleSkinOrders)).toMatchObject([{ accountId: null, transactionId: 'fixture-transaction', customerId: null, status: 'COMPLETED' }]);
    expect(await built.db.select().from(polarSkinOrders)).toMatchObject([{ accountId: null, orderId: assetId, checkoutUrl: null, status: 'COMPLETED' }]);
    expect(await built.db.select().from(shopierOrders)).toMatchObject([{ accountId: null, orderId: 'fixture-order', note: null, code: null, total: '99' }]);
    expect(await built.db.select().from(shopierPurchaseCodes)).toHaveLength(0);
  });
  it('retries anonymous file jobs without requiring a surviving account request and protects live media references', async () => {
    const owner = await register(); const operator = await register('PolicyOperator');
    const requestId = '44444444-4444-4444-8444-444444444444';
    await asset(owner.accountId); await writeFile(join(mediaDirectory, assetId), 'live-file');
    await built.db.insert(mediaDeletionQueue).values({ assetId, requestId });
    const retry = (headers: { authorization: string }) => built.app.inject({ method: 'POST', url: `/api/admin/account-deletion/${requestId}/media-cleanup`, headers, payload: { confirm: true } });
    expect((await retry(owner.headers)).statusCode).toBe(403);
    expect((await retry(operator.headers)).json()).toEqual({ requestId, mediaCleanupPending: true });
    expect(await readFile(join(mediaDirectory, assetId), 'utf8')).toBe('live-file');
    await built.db.delete(chatMediaAssets);
    expect((await retry(operator.headers)).json()).toEqual({ requestId, mediaCleanupPending: false });
    await expect(readFile(join(mediaDirectory, assetId))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await retry(operator.headers)).json()).toEqual({ requestId, mediaCleanupPending: false });
  });
  it('deletes owned media after commit and preserves unrelated files', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    await asset(owner.accountId); await writeFile(join(mediaDirectory, assetId), 'fixture!');
    await writeFile(join(mediaDirectory, '33333333-3333-4333-8333-333333333333'), 'unrelated');
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    expect((await complete(requestId, operator.headers)).statusCode).toBe(200);
    await expect(readFile(join(mediaDirectory, assetId))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(mediaDirectory, '33333333-3333-4333-8333-333333333333'), 'utf8')).toBe('unrelated');
  });
  it('retains a failed media erasure durably and retries it through worker housekeeping', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    await asset(owner.accountId); await mkdir(join(mediaDirectory, assetId));
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    const result = await complete(requestId, operator.headers);
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ status: 'completed', mediaCleanupPending: true });
    expect(await built.db.execute(sql`select asset_id from media_deletion_queue`)).toHaveLength(1);
    const queue = await built.app.inject({ url: '/api/admin/account-deletion', headers: operator.headers });
    expect(queue.json()).toMatchObject({ requests: [], mediaPending: [{ requestId, files: 1 }] });
    await rm(join(mediaDirectory, assetId), { recursive: true }); await writeFile(join(mediaDirectory, assetId), 'fixture!');
    const worker = new EventWorker(built.db, clock, { pollMs: 1000, batch: 10, staleMinutes: 5, mediaDirectory }, pino({ level: 'silent' }));
    try { await worker.tick(); } finally { await worker.stop(); }
    await expect(readFile(join(mediaDirectory, assetId))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await built.db.execute(sql`select asset_id from media_deletion_queue`)).toHaveLength(0);
    expect((await complete(requestId, operator.headers)).json()).toEqual({ requestId, status: 'completed' });
  });
  it('defers cleanly on season-lock contention instead of returning a server error', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator'); const target = await world(owner.accountId);
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    let unlock: () => void = () => undefined; let entered: () => void = () => undefined;
    const held = new Promise<void>(resolve => { entered = resolve; }); const release = new Promise<void>(resolve => { unlock = resolve; });
    const holding = built.db.transaction(async tx => { await tx.execute(sql`select id from seasons where id = ${target.season.id} for update`); entered(); await release; });
    await held;
    try { const result = await complete(requestId, operator.headers); expect(result.statusCode).toBe(409); expect(result.json()).toMatchObject({ error: 'DELETION_BUSY' }); }
    finally { unlock(); await holding; }
    expect((await complete(requestId, operator.headers)).statusCode).toBe(200);
  });

  it('requires operator authority and approval before any destructive completion', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    expect((await complete(requestId, owner.headers)).statusCode).toBe(403);
    const response = await complete(requestId, operator.headers);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'DELETION_NOT_APPROVED' });
    expect((await built.app.inject({ url: '/api/auth/me', headers: owner.headers })).statusCode).toBe(200);
  });
  it('completes the exact approved request and safely coalesces operator retries', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    const results = await Promise.all([complete(requestId, operator.headers), complete(requestId, operator.headers)]);
    for (const result of results) { expect(result.statusCode).toBe(200); expect(result.json()).toEqual({ requestId, status: 'completed' }); }
    expect(await built.db.execute(sql`select id from accounts where id = ${owner.accountId}`)).toHaveLength(0);
    expect((await built.app.inject({ url: '/api/auth/me', headers: operator.headers })).statusCode).toBe(200);
    expect(await count()).toBe(0);
    const audit = await built.db.execute(sql`select id from admin_actions where action = 'ACCOUNT_DELETION_COMPLETED'`);
    expect(audit).toHaveLength(1);
  });
  it('leaves worlds and a neighbour’s incoming fleet intact while completion is unsafe', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    const target = await world(owner.accountId);
    const attacker = await joinSettled(built.db, operator.accountId, target.season.id, clock);
    await placeAt(built.db, target.planetId, { x: 0 }); await placeAt(built.db, attacker.planetId, { x: TEST_SPACING });
    await giveUnits(built.db, attacker.planetId, { DART: 3 }); await fuelUp(built.db, attacker.planetId);
    await launchAttack(built.db, attacker.planetId, target.planetId, { DART: 1 }, clock);
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    const result = await complete(requestId, operator.headers);
    expect(result.statusCode).toBe(409);
    expect(result.json()).toMatchObject({ error: 'WORLD_BUSY' });
    expect(await built.db.execute(sql`select id from planets where id = ${target.planetId}`)).toHaveLength(1);
    expect(await built.db.execute(sql`select id from missions where target_planet_id = ${target.planetId} and status = 'in_flight'`)).toHaveLength(1);
    expect(await count()).toBe(1);
  });
  it('refuses new flights toward an approved commander, so nobody can keep them busy', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    const target = await world(owner.accountId);
    const attacker = await joinSettled(built.db, operator.accountId, target.season.id, clock);
    await placeAt(built.db, target.planetId, { x: 0 }); await placeAt(built.db, attacker.planetId, { x: TEST_SPACING });
    await giveUnits(built.db, attacker.planetId, { DART: 3 }); await fuelUp(built.db, attacker.planetId);
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    await expect(launchAttack(built.db, attacker.planetId, target.planetId, { DART: 1 }, clock)).rejects.toMatchObject({ code: 'TARGET_LEAVING', status: 409 });
    await expect(launchProbe(built.db, attacker.planetId, target.planetId, clock)).rejects.toMatchObject({ code: 'TARGET_LEAVING', status: 409 });
    expect(await built.db.execute(sql`select id from missions where target_planet_id = ${target.planetId}`)).toHaveLength(0);
    expect((await complete(requestId, operator.headers)).statusCode).toBe(200);
  });
  it('anonymises move/news history and closes a queued return while preserving shared records', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    const target = await world(owner.accountId);
    await built.db.insert(commanderTransfers).values({ playerId: target.playerId, accountId: owner.accountId, cycleId: target.season.cycleId, sourceSeasonId: target.season.id, targetSeasonId: target.season.id, fromVersion: 0, toVersion: 1, direction: 'OUT', worlds: [], committedAt: clock.now() });
    await built.db.insert(returnApplications).values({ playerId: target.playerId, playerIdSnapshot: target.playerId, cycleId: target.season.cycleId, targetShardId: target.season.shardId, sequence: 1n, status: 'QUEUED', requestedAt: clock.now(), expiresAt: new Date(clock.now().getTime() + 86_400_000), updatedAt: clock.now() });
    await built.db.insert(announcements).values({ authorAccountId: owner.accountId, title: 'Shared news', bodyHtml: '<p>Keep the news</p>', publishedAt: clock.now() });
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    const result = await complete(requestId, operator.headers);
    expect(result.statusCode).toBe(200);
    expect(await built.db.execute(sql`select id from accounts where id = ${owner.accountId}`)).toHaveLength(0);
    const moves = await built.db.execute<{ account_id: string | null }>(sql`select account_id from commander_transfers`);
    expect(moves).toHaveLength(1); expect(moves[0]?.account_id).toBeNull();
    const applications = await built.db.execute<{ status: string; player_id: string | null }>(sql`select status, player_id from return_applications`);
    expect(applications[0]).toMatchObject({ status: 'CANCELLED', player_id: null });
    const news = await built.db.execute<{ author_account_id: string | null; title: string }>(sql`select author_account_id, title from announcements`);
    expect(news[0]).toMatchObject({ author_account_id: null, title: 'Shared news' });
  });

  it('does not expose or approve requests for an ordinary account', async () => {
    const { owner, requestId } = await pending();
    expect((await built.app.inject({ url: '/api/admin/account-deletion', headers: owner.headers })).statusCode).toBe(403);
    expect((await approve(requestId, owner.headers)).statusCode).toBe(403);
    expect((await built.app.inject({ url: '/api/auth/me', headers: owner.headers })).statusCode).toBe(200);
  });
  it('lists pending requests only for a configured operator with no-store', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    const result = await built.app.inject({ url: '/api/admin/account-deletion', headers: operator.headers });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ requests: [{ requestId, accountId: owner.accountId, username: 'policypilot', status: 'requested' }] });
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).not.toContain(password);
  });
  it('closes web and native access/refresh/login on approval without deleting the account', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    const webLogin = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'PolicyPilot', password } });
    const cookie = String(webLogin.headers['set-cookie']).split(';')[0]!;
    const nativeLogin = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username: 'PolicyPilot', password } });
    expect(nativeLogin.statusCode).toBe(200);
    const native = nativeLogin.json<{ accessToken: string; nativeSessionId: string; refreshToken: string }>();
    const result = await approve(requestId, operator.headers);
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ request: { requestId, status: 'approved' } });
    expect(result.headers['cache-control']).toBe('no-store');
    expect(await count()).toBe(1);
    expect((await built.app.inject({ url: '/api/auth/me', headers: owner.headers })).statusCode).toBe(401);
    expect((await built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${native.accessToken}` } })).statusCode).toBe(401);
    expect((await built.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie } })).statusCode).toBe(401);
    expect((await built.app.inject({ method: 'POST', url: '/api/native/auth/refresh', payload: { sessionId: native.nativeSessionId, refreshToken: native.refreshToken, nextRefreshToken: 'a'.repeat(43) } })).statusCode).toBe(401);
    for (const url of ['/api/auth/login', '/api/native/auth/login']) expect((await built.app.inject({ method: 'POST', url, payload: { username: 'PolicyPilot', password } })).statusCode).toBe(401);
    expect((await built.app.inject({ url: '/api/auth/me', headers: operator.headers })).statusCode).toBe(200);
  });
  it('cannot bypass closure with a freshly signed token for the current version', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    expect((await approve(requestId, operator.headers)).statusCode).toBe(200);
    const token = await built.app.tokens.issueAccess(owner.accountId, 1);
    expect((await built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
  });
  it('approves once across concurrent calls and never moves the request time or version again', async () => {
    const { owner, requestId } = await pending(); const operator = await register('PolicyOperator');
    const results = await Promise.all([approve(requestId, operator.headers), approve(requestId, operator.headers)]);
    for (const result of results) expect(result.statusCode).toBe(200);
    expect(results[0].json()).toEqual(results[1].json());
    const account = await built.db.execute<{ auth_version: number }>(sql`select auth_version from accounts where id = ${owner.accountId}`);
    expect(account[0]?.auth_version).toBe(1);
  });
  it('refuses an absent request without closing any account', async () => {
    const operator = await register('PolicyOperator');
    const response = await approve('11111111-1111-4111-8111-111111111111', operator.headers);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'DELETION_REQUEST_NOT_FOUND' });
    expect((await built.app.inject({ url: '/api/auth/me', headers: operator.headers })).statusCode).toBe(200);
  });
});
afterEach(async () => { vi.restoreAllMocks(); await built.close(); await rm(mediaDirectory, { recursive: true, force: true }); });
afterAll(async () => { await (await testDb()).close(); });

async function register(username = 'PolicyPilot') {
  const result = await built.app.inject({ method: 'POST', url: '/api/auth/register', payload: { communityPolicyVersion: COMMUNITY_POLICY_VERSION, username, password } });
  expect(result.statusCode).toBe(200);
  const account = result.json<{ accountId: string; accessToken: string }>();
  return { ...account, headers: { authorization: `Bearer ${account.accessToken}` } };
}
const count = async () => (await built.db.execute<{ count: number }>(sql`select count(*)::int as count from account_deletion_requests`))[0]?.count;
interface Receipt { requestId: string; requestedAt: string; status: 'requested' }

describe('shared authenticated account deletion requests', () => {
  it('requires authentication for reading and requesting deletion', async () => {
    for (const method of ['GET', 'POST'] as const) {
      const response = await built.app.inject({ method, url: path, ...(method === 'POST' ? { payload: { currentPassword: password, locale: 'tr' } } : {}) });
      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });
  it('returns only an empty own-account status before any request', async () => {
    const { headers } = await register();
    const result = await built.app.inject({ url: path, headers });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ request: null });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('records a verified request without deleting the account or revoking its credentials', async () => {
    const { headers, accountId } = await register();
    const result = await built.app.inject({ method: 'POST', url: path, headers, payload: { currentPassword: password, locale: 'tr' } });
    expect(result.statusCode).toBe(202);
    const receipt = result.json<{ request: Receipt }>().request;
    expect(receipt.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(receipt.requestedAt).toBe(clock.now().toISOString());
    expect(receipt.status).toBe('requested');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).not.toContain(password);
    expect(result.body).not.toContain(accountId);
    expect(await count()).toBe(1);
    const status = await built.app.inject({ url: path, headers });
    expect(status.json()).toEqual({ request: receipt });
    expect((await built.app.inject({ url: '/api/auth/me', headers })).statusCode).toBe(200);
    const account = await built.db.execute<{ auth_version: number }>(sql`select auth_version from accounts where id = ${accountId}`);
    expect(account[0]?.auth_version).toBe(0);
  });
  it('rejects an incorrect password without recording a request', async () => {
    const { headers } = await register();
    const result = await built.app.inject({ method: 'POST', url: path, headers, payload: { currentPassword: 'wrong-password', locale: 'en' } });
    expect(result.statusCode).toBe(401);
    expect(await count()).toBe(0);
  });
  it('does not accept another identity or extra fields from the client', async () => {
    const own = await register(); const other = await register('OtherPolicyPilot');
    const result = await built.app.inject({ method: 'POST', url: path, headers: own.headers, payload: { currentPassword: password, locale: 'en', accountId: other.accountId } });
    expect(result.statusCode).toBe(400);
    expect(await count()).toBe(0);
  });
  it('cannot read another account request through its own status', async () => {
    const own = await register(); const other = await register('OtherPolicyPilot');
    expect((await built.app.inject({ method: 'POST', url: path, headers: own.headers, payload: { currentPassword: password, locale: 'en' } })).statusCode).toBe(202);
    const result = await built.app.inject({ url: path, headers: other.headers });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ request: null });
  });
  it('coalesces concurrent submissions and preserves the original request time on retry', async () => {
    const { headers } = await register();
    const send = () => built.app.inject({ method: 'POST', url: path, headers, payload: { currentPassword: password, locale: 'en' } });
    const results = await Promise.all([send(), send()]);
    for (const result of results) expect(result.statusCode).toBe(202);
    expect(results[0].json()).toEqual(results[1].json());
    clock.set(new Date(clock.now().getTime() + 60_000));
    expect((await send()).json()).toEqual(results[0].json());
    expect(await count()).toBe(1);
  });
  it.each([{ currentPassword: '', locale: 'en' }, { currentPassword: password, locale: 'xx' }, { currentPassword: 'x'.repeat(201), locale: 'en' }])('rejects malformed requests before any password work: %j', async payload => {
    const { headers } = await register(); const verify = vi.spyOn(passwords, 'verifyPassword');
    const result = await built.app.inject({ method: 'POST', url: path, headers, payload });
    expect(result.statusCode).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    expect(await count()).toBe(0);
  });
  it('rejects stale proof when credentials change while password verification is running', async () => {
    const { headers, accountId } = await register();
    const verify = passwords.verifyPassword;
    vi.spyOn(passwords, 'verifyPassword').mockImplementationOnce(async (candidate, hash) => {
      const matches = await verify(candidate, hash);
      await built.db.execute(sql`update accounts set auth_version = auth_version + 1 where id = ${accountId}`);
      return matches;
    });
    const result = await built.app.inject({ method: 'POST', url: path, headers, payload: { currentPassword: password, locale: 'en' } });
    expect(result.statusCode).toBe(401);
    expect(await count()).toBe(0);
  });
  it('bounds password guessing per account across requests', async () => {
    const { headers } = await register();
    for (let attempt = 0; attempt < 10; attempt++) expect((await built.app.inject({ method: 'POST', url: path, headers, payload: { currentPassword: 'wrong-password', locale: 'en' } })).statusCode).toBe(401);
    const result = await built.app.inject({ method: 'POST', url: path, headers, payload: { currentPassword: password, locale: 'en' } });
    expect(result.statusCode).toBe(429);
    expect(await count()).toBe(0);
  });
});
