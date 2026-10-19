import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp, type BuiltApp } from '../src/app.js';
import { accounts, chatMediaAssets, chatMessages, contentReports } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const uploadSchema = z.object({ media: z.object({ kind: z.literal('image'), assetId: z.string().uuid(), mimeType: z.literal('image/png') }) });
const messageSchema = z.object({ message: z.object({ id: z.string().uuid() }) });
const reportSchema = z.object({ report: z.object({ id: z.string().uuid() }) });
let f: Fixture; let built: BuiltApp; let directory: string;
let admin: { authorization: string }; let reporter: { authorization: string }; let cookie: string;
beforeEach(async () => {
  f = await seedWorld(3); directory = await mkdtemp(join(tmpdir(), 'astera-report-media-'));
  await f.db.update(accounts).set({ username: 'reviewoperator' }).where(eq(accounts.id, f.accountIds[0]!));
  await f.db.update(accounts).set({ username: 'evidenceauthor' }).where(eq(accounts.id, f.accountIds[2]!));
  built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: 'reviewoperator,evidenceauthor', CHAT_MEDIA_DIR: directory }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
  admin = { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}` };
  reporter = { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[1]!)}` };
  cookie = `bs_refresh=${await built.app.tokens.issueRefresh(f.accountIds[0]!)}`;
});
afterEach(async () => { await built.close(); await rm(directory, { recursive: true, force: true }); });
afterAll(async () => { await (await testDb()).close(); });
async function reportedMedia() {
  const uploaded = await built.app.inject({ method: 'POST', url: '/api/admin/chat/media', headers: { ...admin, 'content-type': 'application/octet-stream', 'x-media-type': 'image/png' }, payload: png });
  expect(uploaded.statusCode).toBe(200); const { media } = uploadSchema.parse(uploaded.json<unknown>());
  const sent = await built.app.inject({ method: 'POST', url: '/api/chat/messages', headers: admin, payload: { content: 'Reviewable attachment', language: 'en', media } });
  expect(sent.statusCode).toBe(200); const message = messageSchema.parse(sent.json<unknown>()).message;
  const reported = await built.app.inject({ method: 'POST', url: '/api/community/reports', headers: reporter, payload: { kind: 'message', channel: 'general', messageId: message.id, reason: 'OTHER', details: '' } });
  expect(reported.statusCode).toBe(202);
  const id = reportSchema.parse(reported.json<unknown>()).report.id;
  return { id, media, messageId: message.id, url: `/api/admin/content-reports/${id}/media` };
}
it('allows only operators to read the exact reported bytes with bearer or same-origin refresh cookie', async () => {
  const { url } = await reportedMedia();
  expect((await built.app.inject({ url })).statusCode).toBe(401);
  expect((await built.app.inject({ url, headers: reporter })).statusCode).toBe(403);
  for (const headers of [admin, { cookie }]) {
    const result = await built.app.inject({ url, headers });
    expect(result.statusCode).toBe(200); expect(result.rawPayload).toEqual(png);
    expect(result.headers['content-type']).toBe('image/png'); expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.headers['x-content-type-options']).toBe('nosniff');
  }
});
it('does not expose unreported files through selectors and honors bounded range reads', async () => {
  const { url } = await reportedMedia();
  expect((await built.app.inject({ url: `/api/admin/content-reports/${randomUUID()}/media`, headers: admin })).statusCode).toBe(404);
  expect((await built.app.inject({ url: `${url}?assetId=${randomUUID()}`, headers: admin })).statusCode).toBe(400);
  const partial = await built.app.inject({ url, headers: { ...admin, range: 'bytes=0-7' } });
  expect(partial.statusCode).toBe(206); expect(partial.rawPayload).toEqual(png.subarray(0, 8));
  expect((await built.app.inject({ url, headers: { ...admin, range: 'bytes=999999-9999999' } })).statusCode).toBe(416);
});
it('keeps reported evidence inspectable after a message edit but stops at closure or the 30-day expiry', async () => {
  const { id, url, messageId } = await reportedMedia();
  await f.db.update(chatMessages).set({ content: '**', media: null }).where(eq(chatMessages.id, messageId));
  expect((await built.app.inject({ url, headers: admin })).statusCode).toBe(200);
  const createdAt = f.clock.now(); f.clock.set(new Date(createdAt.getTime() + 30 * 86_400_000));
  expect((await built.app.inject({ url, headers: admin })).statusCode).toBe(404);
  f.clock.set(createdAt);
  await f.db.update(contentReports).set({ status: 'DISMISSED', resolvedAt: createdAt, moderatorAccountId: f.accountIds[0]! }).where(eq(contentReports.id, id));
  expect((await built.app.inject({ url, headers: admin })).statusCode).toBe(404);
});
it('returns a private missing result for erased files or mismatched evidence without disclosing storage paths', async () => {
  const { id, media, url } = await reportedMedia();
  await f.db.update(chatMediaAssets).set({ mimeType: 'video/mp4' }).where(eq(chatMediaAssets.id, media.assetId));
  expect((await built.app.inject({ url, headers: admin })).statusCode).toBe(404);
  await f.db.update(chatMediaAssets).set({ mimeType: 'image/png' }).where(eq(chatMediaAssets.id, media.assetId));
  await unlink(join(directory, media.assetId));
  const missing = await built.app.inject({ url, headers: admin });
  expect(missing.statusCode).toBe(404); expect(missing.body).not.toContain(directory);
  await f.db.update(contentReports).set({ evidence: { username: 'Operator', playerId: f.playerIds[0]!, content: '', media: { kind: 'youtube', videoId: 'abcdefghijk' } } }).where(eq(contentReports.id, id));
  expect((await built.app.inject({ url, headers: admin })).statusCode).toBe(404);
});

it('allows evidence review of a reported private DM without making unreported DM media readable', async () => {
  const author = { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[2]!)}` };
  const uploaded = await built.app.inject({ method: 'POST', url: '/api/admin/chat/media', headers: { ...author, 'content-type': 'application/octet-stream', 'x-media-type': 'image/png' }, payload: png });
  const { media } = uploadSchema.parse(uploaded.json<unknown>());
  const sent = await built.app.inject({ method: 'POST', url: '/api/dm/messages', headers: author, payload: { recipientPlayerId: f.playerIds[1], content: 'Private evidence', media } });
  expect(sent.statusCode).toBe(200); const message = messageSchema.parse(sent.json<unknown>()).message;
  expect((await built.app.inject({ url: `/api/chat/media/${media.assetId}?channel=dm&messageId=${message.id}`, headers: admin })).statusCode).toBe(404);
  const reported = await built.app.inject({ method: 'POST', url: '/api/community/reports', headers: reporter, payload: { kind: 'message', channel: 'dm', messageId: message.id, reason: 'OTHER', details: '' } });
  const id = reportSchema.parse(reported.json<unknown>()).report.id;
  const result = await built.app.inject({ url: `/api/admin/content-reports/${id}/media`, headers: admin });
  expect(result.statusCode).toBe(200); expect(result.rawPayload).toEqual(png);
});
it('revokes both bearer and cookie inspection when an operator session is invalidated', async () => {
  const { url } = await reportedMedia();
  await f.db.update(accounts).set({ authVersion: 1 }).where(eq(accounts.id, f.accountIds[0]!));
  expect((await built.app.inject({ url, headers: admin })).statusCode).toBe(401);
  expect((await built.app.inject({ url, headers: { cookie } })).statusCode).toBe(401);
});
