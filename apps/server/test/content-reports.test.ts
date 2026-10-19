import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import { accounts, chatMessages, clanMessages, clanMemberships, clans, dmBlocks, dmConversations, dmMessages, contentReports, players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { EventWorker } from '../src/worker/loop.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { createSeason } from '../src/services/season.js';

let f: Fixture; let built: BuiltApp; let auth: { authorization: string }[];
const path = '/api/community/reports';
beforeEach(async () => {
  f = await seedWorld(3);
  await f.db.update(accounts).set({ username: 'reportoperator' }).where(eq(accounts.id, f.accountIds[0]!));
  built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: 'reportoperator,deskoperator' }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
  auth = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await built.app.tokens.issueAccess(id)}` })));
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });
async function message() {
  const [row] = await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[2]!, language: 'tr', content: 'Server-owned evidence', createdAt: f.clock.now() }).returning();
  if (!row) throw new Error('No message fixture'); return row;
}
const report = (payload: Record<string, unknown>, who = 1) => built.app.inject({ method: 'POST', url: path, headers: auth[who], payload });

it('requires authentication and records a private receipt without exposing moderation evidence to the reporter', async () => {
  const row = await message(); const payload = { kind: 'message', channel: 'general', messageId: row.id, reason: 'HARASSMENT', details: 'Please review this message.' };
  expect((await built.app.inject({ method: 'POST', url: path, payload })).statusCode).toBe(401);
  const result = await report(payload);
  expect(result.statusCode).toBe(202); expect(result.headers['cache-control']).toBe('no-store');
  expect(result.json()).toMatchObject({ report: { status: 'received' } });
  expect(result.body).not.toContain('Server-owned evidence'); expect(result.body).not.toContain(f.accountIds[2]);
});
it('coalesces concurrent repeated reports and keeps the first receipt', async () => {
  const row = await message(); const body = { kind: 'message', channel: 'general', messageId: row.id, reason: 'SPAM', details: '' };
  const results = await Promise.all([report(body), report(body)]);
  expect(results.map(result => result.statusCode)).toEqual([202, 202]);
  expect(results[0].json()).toEqual(results[1].json());
});
it('reports a visible player and refuses self reports or client-authored evidence', async () => {
  expect((await report({ kind: 'player', playerId: f.playerIds[2], reason: 'INAPPROPRIATE_NAME', details: '' })).statusCode).toBe(202);
  expect((await report({ kind: 'player', playerId: f.playerIds[1], reason: 'SPAM', details: '' })).statusCode).toBe(400);
  const row = await message();
  expect((await report({ kind: 'message', channel: 'general', messageId: row.id, reason: 'SPAM', details: '', evidence: 'forged text' })).statusCode).toBe(400);
});
it('does not expose a private clan or conversation through fabricated message selectors', async () => {
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Private Clan', tag: 'PVT', nameKey: 'private clan', createdAt: f.clock.now() }).returning();
  if (!clan) throw new Error('No clan fixture');
  const [clanMessage] = await f.db.insert(clanMessages).values({ seasonId: f.seasonId, clanId: clan.id, authorPlayerId: f.playerIds[2]!, content: 'private clan evidence', createdAt: f.clock.now() }).returning();
  const ids = [f.playerIds[0]!, f.playerIds[2]!].sort();
  const [conversation] = await f.db.insert(dmConversations).values({ seasonId: f.seasonId, playerLowId: ids[0]!, playerHighId: ids[1]! }).returning();
  if (!conversation) throw new Error('No conversation fixture');
  const [dm] = await f.db.insert(dmMessages).values({ conversationId: conversation.id, authorPlayerId: f.playerIds[2]!, content: 'private DM evidence', createdAt: f.clock.now() }).returning();
  for (const [channel, messageId] of [['clan', clanMessage?.id], ['dm', dm?.id], ['general', randomUUID()]] as const) {
    const result = await report({ kind: 'message', channel, messageId, reason: 'SPAM', details: '' });
    expect(result.statusCode).toBe(404); expect(result.body).not.toContain('private');
  }
});
it('restricts the review queue to operators and gets evidence from the actual message', async () => {
  const row = await message();
  expect((await report({ kind: 'message', channel: 'general', messageId: row.id, reason: 'SPAM', details: 'Review please' })).statusCode).toBe(202);
  expect((await built.app.inject({ url: '/api/admin/content-reports', headers: auth[1] })).statusCode).toBe(403);
  const result = await built.app.inject({ url: '/api/admin/content-reports', headers: auth[0] });
  expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(result.json()).toMatchObject({ reports: [{ evidence: { content: 'Server-owned evidence' }, reason: 'SPAM', status: 'PENDING' }] });
});
it('keeps the moderation queue available to an operator without a galaxy placement', async () => {
  const [operator] = await f.db.insert(accounts).values({ username: 'deskoperator', displayName: 'Desk Operator', passwordHash: 'fixture-unused' }).returning();
  if (!operator) throw new Error('Missing operator fixture');
  const token = await built.app.tokens.issueAccess(operator.id);
  const result = await built.app.inject({ url: '/api/admin/content-reports', headers: { authorization: `Bearer ${token}` } });
  expect(result.statusCode).toBe(200);
});
async function reported() {
  const row = await message();
  const result = await report({ kind: 'message', channel: 'general', messageId: row.id, reason: 'SPAM', details: '' });
  expect(result.statusCode).toBe(202);
  return { message: row, id: result.json<{ report: { id: string } }>().report.id };
}
const resolve = (id: string, action: 'MASK' | 'DISMISS', who = 0) => built.app.inject({ method: 'POST', url: `/api/admin/content-reports/${id}/resolve`, headers: auth[who], payload: { action, confirm: true } });

it('masks only the reported message, records an audit, and coalesces operator retries', async () => {
  const target = await reported(); const unrelated = await message();
  expect((await resolve(target.id, 'MASK', 1)).statusCode).toBe(403);
  const result = await resolve(target.id, 'MASK');
  expect(result.statusCode).toBe(200); expect(result.json()).toEqual({ id: target.id, status: 'RESOLVED' });
  expect((await resolve(target.id, 'MASK')).json()).toEqual(result.json());
  expect(await f.db.select().from(chatMessages).where(eq(chatMessages.id, target.message.id))).toMatchObject([{ content: '**', media: null }]);
  expect(await f.db.select().from(chatMessages).where(eq(chatMessages.id, unrelated.id))).toMatchObject([{ content: 'Server-owned evidence' }]);
  expect(await f.db.execute(sql`select id from admin_actions where action = 'CONTENT_REPORT_MASK'`)).toHaveLength(1);
  expect((await built.app.inject({ url: '/api/admin/content-reports', headers: auth[0] })).json()).toEqual({ reports: [] });
});
it('does not reinterpret an already closed report as a different decision', async () => {
  const target = await reported();
  expect((await resolve(target.id, 'DISMISS')).json()).toEqual({ id: target.id, status: 'DISMISSED' });
  expect((await resolve(target.id, 'MASK')).statusCode).toBe(409);
  expect(await f.db.select().from(chatMessages).where(eq(chatMessages.id, target.message.id))).toMatchObject([{ content: 'Server-owned evidence' }]);
});
it('rejects masking a profile report without changing its pending state', async () => {
  const response = await report({ kind: 'player', playerId: f.playerIds[2], reason: 'INAPPROPRIATE_NAME', details: '' });
  const id = response.json<{ report: { id: string } }>().report.id;
  expect((await resolve(id, 'MASK')).statusCode).toBe(400);
  expect(await f.db.select().from(contentReports).where(eq(contentReports.id, id))).toMatchObject([{ status: 'PENDING', resolvedAt: null }]);
});
it('keeps content and report pending if the moderation audit cannot commit', async () => {
  const target = await reported();
  await f.db.execute(sql`create function content_report_test_failure() returns trigger language plpgsql as $$ begin if new.action = 'CONTENT_REPORT_MASK' then raise exception 'fixture audit failure'; end if; return new; end $$`);
  await f.db.execute(sql`create trigger content_report_test_failure before insert on admin_actions for each row execute function content_report_test_failure()`);
  try { expect((await resolve(target.id, 'MASK')).statusCode).toBe(500); }
  finally { await f.db.execute(sql`drop trigger content_report_test_failure on admin_actions`); await f.db.execute(sql`drop function content_report_test_failure()`); }
  expect(await f.db.select().from(chatMessages).where(eq(chatMessages.id, target.message.id))).toMatchObject([{ content: 'Server-owned evidence' }]);
  expect(await f.db.select().from(contentReports).where(eq(contentReports.id, target.id))).toMatchObject([{ status: 'PENDING', resolvedAt: null }]);
});
it('enforces report metadata and resolution state at the database boundary', async () => {
  const target = await reported();
  await expect(f.db.execute(sql`update content_reports set status = 'RESOLVED' where id = ${target.id}`)).rejects.toMatchObject({ cause: { code: '23514', constraint_name: 'content_reports_resolution_check' } });
  await expect(f.db.execute(sql`update content_reports set kind = 'player' where id = ${target.id}`)).rejects.toMatchObject({ cause: { code: '23514', constraint_name: 'content_reports_target_check' } });
});
it('bounds new reports per account, preserves duplicate receipts, and renews the budget at its time boundary', async () => {
  const targets = await Promise.all(Array.from({ length: 6 }, () => message()));
  const payload = (id: string) => ({ kind: 'message', channel: 'general', messageId: id, reason: 'SPAM', details: '' });
  for (const target of targets.slice(0, 5)) expect((await report(payload(target.id))).statusCode).toBe(202);
  const last = targets[5]; const first = targets[0]; if (!last || !first) throw new Error('Missing message fixtures');
  expect((await report(payload(last.id))).statusCode).toBe(429);
  expect((await report(payload(first.id))).statusCode).toBe(202);
  f.clock.set(new Date(f.clock.now().getTime() + 15 * 60_000));
  expect((await report(payload(last.id))).statusCode).toBe(202);
});
it('preserves the original own receipt if the reported message disappears before a network retry', async () => {
  const target = await reported();
  await f.db.delete(chatMessages).where(eq(chatMessages.id, target.message.id));
  const result = await report({ kind: 'message', channel: 'general', messageId: target.message.id, reason: 'SPAM', details: '' });
  expect(result.statusCode).toBe(202);
  expect(result.json()).toMatchObject({ report: { id: target.id, status: 'received' } });
});
it.each([false, true])('expires moderation evidence at the 30-day boundary even if erasure journal maintenance fails: %s', async brokenJournal => {
  const old = await reported(); const freshMessage = await message();
  expect((await report({ kind: 'message', channel: 'general', messageId: freshMessage.id, reason: 'SPAM', details: '' })).statusCode).toBe(202);
  await f.db.update(contentReports).set({ createdAt: new Date(f.clock.now().getTime() - 30 * 86_400_000) }).where(eq(contentReports.id, old.id));
  const directory = await mkdtemp(join(tmpdir(), 'astera-report-retention-'));
  if (brokenJournal) { await mkdir(join(directory, '.account-erasure-ledger')); await writeFile(join(directory, '.account-erasure-ledger', `${'0'.repeat(64)}.json`), 'broken journal record'); }
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 10, staleMinutes: 5, mediaDirectory: directory, erasureSecret: 'fixture-journal-key' }, pino({ level: 'silent' }));
  try {
    try { await worker.tick(); } finally { await worker.stop(); }
    const remaining = await f.db.select().from(contentReports);
    expect(remaining).toHaveLength(1); expect(remaining[0]?.messageId).toBe(freshMessage.id);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
it('removes the account link on target erasure and deletes the reporter’s own records on reporter erasure', async () => {
  const target = await reported();
  const rows = await f.db.select({ id: accounts.id, username: accounts.username }).from(accounts);
  const accused = rows.find(row => row.id === f.accountIds[2]); const reporter = rows.find(row => row.id === f.accountIds[1]);
  if (!accused || !reporter) throw new Error('Missing erasure fixtures');
  await deleteAccount(f.db, f.clock, accused.username);
  expect(await f.db.select().from(contentReports).where(eq(contentReports.id, target.id))).toMatchObject([{ targetAccountId: null, evidence: { content: 'Server-owned evidence' } }]);
  await deleteAccount(f.db, f.clock, reporter.username);
  expect(await f.db.select().from(contentReports)).toHaveLength(0);
});
it.each(['clan', 'dm'] as const)('accepts readable %s evidence and masks only that exact private message', async channel => {
  const authorPlayerId = f.playerIds[2]; const reporterPlayerId = f.playerIds[1];
  if (!authorPlayerId || !reporterPlayerId) throw new Error('Missing private channel fixtures');
  let messageId: string;
  if (channel === 'clan') {
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Reported Clan', tag: 'RPT', nameKey: 'reported clan', createdAt: f.clock.now() }).returning();
    if (!clan) throw new Error('No clan fixture');
    await f.db.insert(clanMemberships).values([reporterPlayerId, authorPlayerId].map((playerId, slot) => ({ seasonId: f.seasonId, clanId: clan.id, playerId, slot, role: 'MEMBER' as const, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() })));
    const [row] = await f.db.insert(clanMessages).values({ clanId: clan.id, seasonId: f.seasonId, authorPlayerId, content: 'Private evidence', createdAt: f.clock.now() }).returning();
    if (!row) throw new Error('No clan message fixture'); messageId = row.id;
  } else {
    const pair = [reporterPlayerId, authorPlayerId].sort(); const low = pair[0]; const high = pair[1]; if (!low || !high) throw new Error('No DM pair');
    const [conversation] = await f.db.insert(dmConversations).values({ seasonId: f.seasonId, playerLowId: low, playerHighId: high }).returning();
    if (!conversation) throw new Error('No DM conversation fixture');
    const [row] = await f.db.insert(dmMessages).values({ conversationId: conversation.id, authorPlayerId, content: 'Private evidence', createdAt: f.clock.now() }).returning();
    if (!row) throw new Error('No DM message fixture'); messageId = row.id;
    await f.db.insert(dmBlocks).values({ blockerPlayerId: reporterPlayerId, targetPlayerId: authorPlayerId, createdAt: f.clock.now() });
  }
  const receipt = await report({ kind: 'message', channel, messageId, reason: 'HARASSMENT', details: '' });
  expect(receipt.statusCode).toBe(202); const id = receipt.json<{ report: { id: string } }>().report.id;
  expect((await resolve(id, 'MASK')).statusCode).toBe(200);
  const table = channel === 'clan' ? clanMessages : dmMessages;
  expect(await f.db.select({ content: table.content, media: table.media }).from(table).where(eq(table.id, messageId))).toEqual([{ content: '**', media: null }]);
});
it('allows a retained DM peer to be reported after a galaxy change without exposing an unrelated galaxy profile', async () => {
  const target = f.playerIds[2]; const reporter = f.playerIds[1]; if (!target || !reporter) throw new Error('No players');
  const { season } = await createSeason(f.db, { shardCode: 'RPT-OTHER', seed: 91273, startsAt: f.clock.now(), playerCap: 10 });
  await f.db.update(players).set({ seasonId: season.id }).where(eq(players.id, target));
  const payload = { kind: 'player', playerId: target, reason: 'HARASSMENT', details: '' };
  expect((await report(payload)).statusCode).toBe(404);
  const pair = [target, reporter].sort(); const low = pair[0]; const high = pair[1]; if (!low || !high) throw new Error('Missing pair');
  const [conversation] = await f.db.insert(dmConversations).values({ seasonId: f.seasonId, playerLowId: low, playerHighId: high }).returning();
  if (!conversation) throw new Error('Missing conversation');
  await f.db.insert(dmMessages).values({ conversationId: conversation.id, authorPlayerId: target, content: 'Retained message', createdAt: f.clock.now() });
  expect((await report(payload)).statusCode).toBe(202);
});
