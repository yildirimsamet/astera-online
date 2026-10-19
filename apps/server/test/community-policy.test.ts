import { MULTI_WORLD } from '@astera/rules';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import { accounts, chatMessages, clans, clanMemberships, seasons } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const version = '2026-10-19'; const path = '/api/community/policy';
let f: Fixture; let built: BuiltApp; let headers: { authorization: string };
beforeEach(async () => {
  f = await seedWorld(2);
  const [table] = await f.db.execute<{ relation: string | null }>(sql`select to_regclass('community_policy_acceptances')::text as relation`);
  if (table?.relation) await f.db.execute(sql`delete from community_policy_acceptances where account_id=${f.accountIds[0]}`);
  built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ NATIVE_AUTH_ENABLED: 'true' }), logger: pino({ level: 'silent' }) }); await built.app.ready();
  headers = { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}` };
});
afterEach(async () => { await built.close(); }); afterAll(async () => { await (await testDb()).close(); });
const accept = (payload: Record<string, unknown> = { version, locale: 'en' }) => built.app.inject({ method: 'POST', url: path, headers, payload });
it('requires authentication and reports the current version without inventing consent for an existing account', async () => {
  expect((await built.app.inject({ url: path })).statusCode).toBe(401);
  const response = await built.app.inject({ url: path, headers }); expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
  expect(response.json()).toEqual({ version, acceptedAt: null });
});
it('accepts only the current version and known locale without a client-selected account', async () => {
  expect((await accept({ version: 'old', locale: 'en' })).statusCode).toBe(403);
  expect((await accept({ version, locale: 'xx' })).statusCode).toBe(400);
  expect((await accept({ version, locale: 'en', accountId: f.accountIds[1] })).statusCode).toBe(400);
  expect((await built.app.inject({ url: path, headers })).json()).toEqual({ version, acceptedAt: null });
});
it('stores explicit acceptance once across concurrent retries and preserves the original time and locale', async () => {
  const results = await Promise.all([accept({ version, locale: 'ja' }), accept({ version, locale: 'ja' })]);
  expect(results.map(value => value.statusCode)).toEqual([200, 200]); expect(results[0].json()).toEqual(results[1].json());
  f.clock.set(new Date(f.clock.now().getTime() + 1000)); expect((await accept()).json()).toEqual(results[0].json());
  expect(await f.db.execute(sql`select locale from community_policy_acceptances where account_id=${f.accountIds[0]}`)).toEqual([{ locale: 'ja' }]);
});
it('requires consent for new messages but keeps reading, reporting and blocking available', async () => {
  const denied = await built.app.inject({ method: 'POST', url: '/api/chat/messages', headers, payload: { content: 'Not yet accepted', language: 'tr' } });
  expect(denied.statusCode).toBe(403); expect(denied.json()).toMatchObject({ error: 'COMMUNITY_POLICY_REQUIRED' });
  expect((await built.app.inject({ url: '/api/chat/messages?language=tr', headers })).statusCode).toBe(200);
  const [message] = await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, language: 'tr', content: 'Reportable', createdAt: f.clock.now() }).returning();
  if (!message) throw new Error('Missing message');
  expect((await built.app.inject({ method: 'POST', url: '/api/community/reports', headers, payload: { kind: 'message', channel: 'general', messageId: message.id, reason: 'SPAM', details: '' } })).statusCode).toBe(202);
  expect((await built.app.inject({ method: 'POST', url: '/api/community/blocks', headers, payload: { targetPlayerId: f.playerIds[1] } })).statusCode).toBe(200);
});
it('permits new messages after acceptance and still enforces the other message rules', async () => {
  expect((await accept()).statusCode).toBe(200);
  expect((await built.app.inject({ method: 'POST', url: '/api/chat/messages', headers, payload: { content: 'Accepted message', language: 'tr' } })).statusCode).toBe(200);
  expect((await built.app.inject({ method: 'POST', url: '/api/dm/messages', headers, payload: { recipientPlayerId: f.playerIds[0], content: 'Self DM' } })).statusCode).toBe(400);
});
it.each(['/api/auth/register', '/api/native/auth/register', '/api/onboarding/claim', '/api/native/onboarding/claim'])('requires explicit consent before %s can publish a new commander name', async url => {
  const payload = { username: 'PolicyNewAccount', password: 'fixture-password-123' };
  const denied = await built.app.inject({ method: 'POST', url, headers: { origin: 'https://localhost' }, payload });
  expect(denied.statusCode).toBe(403); expect(denied.json()).toMatchObject({ error: 'COMMUNITY_POLICY_REQUIRED' });
  expect(await f.db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, 'policynewaccount'))).toHaveLength(0);
});
it('atomically registers the account and its explicit policy evidence', async () => {
  const response = await built.app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'PolicyNewAccount', password: 'fixture-password-123', communityPolicyVersion: version, communityPolicyLocale: 'tr' } });
  expect(response.statusCode).toBe(200);
  expect(await f.db.execute(sql`select p.version,p.locale from community_policy_acceptances p join accounts a on a.id=p.account_id where a.username='policynewaccount'`)).toEqual([{ version, locale: 'tr' }]);
});

it('requires current acceptance before founding a clan', async () => {
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.clanRulesetVersion }).where(eq(seasons.id, f.seasonId));
  const create = await built.app.inject({ method: 'POST', url: '/api/clan/create', headers: { ...headers, 'idempotency-key': 'policy-create-clan' }, payload: { name: 'Policy Clan', tag: 'PLC', description: 'New content', recruiting: true } });
  expect(create.statusCode).toBe(403); expect(create.json()).toMatchObject({ error: 'COMMUNITY_POLICY_REQUIRED' });
});
it('requires acceptance before publishing a changed clan description', async () => {
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.clanRulesetVersion }).where(eq(seasons.id, f.seasonId));
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Existing Clan', nameKey: 'existing clan', tag: 'EXS', description: 'Original', createdAt: f.clock.now() }).returning();
  if (!clan) throw new Error('Missing clan');
  await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: clan.id, playerId: f.playerIds[0]!, slot: 0, role: 'LEADER', joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
  const change = () => built.app.inject({ method: 'POST', url: '/api/clan/settings', headers: { ...headers, 'idempotency-key': 'policy-settings-clan' }, payload: { description: 'Changed content', recruiting: true } });
  const denied = await change(); expect(denied.statusCode).toBe(403); expect(denied.json()).toMatchObject({ error: 'COMMUNITY_POLICY_REQUIRED' });
  expect((await f.db.select().from(clans).where(eq(clans.id, clan.id)))[0]?.description).toBe('Original');
  await accept(); expect((await change()).statusCode).toBe(200);
  expect((await f.db.select().from(clans).where(eq(clans.id, clan.id)))[0]?.description).toBe('Changed content');
});
it('requires acceptance for new emoji but permits removing an existing reaction', async () => {
  const [message] = await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, language: 'tr', content: 'Emoji history', createdAt: f.clock.now() }).returning();
  if (!message) throw new Error('Missing message');
  const react = (emoji: string | null) => built.app.inject({ method: 'POST', url: '/api/chat/reactions', headers, payload: { channel: 'general', messageId: message.id, emoji } });
  expect((await react('👍')).statusCode).toBe(403);
  await accept(); expect((await react('👍')).statusCode).toBe(200);
  await f.db.execute(sql`delete from community_policy_acceptances where account_id=${f.accountIds[0]}`);
  expect((await react(null)).statusCode).toBe(200);
});
it('rolls back a new account when storing its explicit agreement fails', async () => {
  await f.db.execute(sql`create function policy_test_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture policy storage failure'; end $$`);
  await f.db.execute(sql`create trigger policy_test_fail before insert on community_policy_acceptances for each row execute function policy_test_fail()`);
  try {
    const result = await built.app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'PolicyStorageFail', password: 'fixture-password-123', communityPolicyVersion: version, communityPolicyLocale: 'en' } });
    expect(result.statusCode).toBe(500);
    expect(await f.db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, 'policystoragefail'))).toHaveLength(0);
  } finally {
    await f.db.execute(sql`drop trigger policy_test_fail on community_policy_acceptances`); await f.db.execute(sql`drop function policy_test_fail()`);
  }
});
