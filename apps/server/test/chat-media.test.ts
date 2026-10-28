import { chatMediaUploadSchema, chatPageSchema, chatPostSchema, clanChatPostSchema, dmPostSchema } from '../../web/src/api/schemas.js';
import { access, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ECONOMY_PROFILE } from '@astera/rules';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, chatArchive, clanMemberships, clans, seasons, chatMediaAssets } from '../src/db/schema.js';
import { cleanupChatUploads } from '../src/services/chatMedia.js';
import { archiveSeasonChat } from '../src/services/chatArchive.js';
import { maskChatMessages } from '../src/services/chatModeration.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
interface Media { kind: 'image' | 'video' | 'youtube'; assetId?: string; mimeType?: string; videoId?: string }
interface Message { id: string; content: string; media: Media | null }
afterAll(async () => { await (await testDb()).close(); });

describe('admin chat media', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let directory: string;
  let auth: { authorization: string; 'x-astera-rules': string }[];
  let cookie: string;
  beforeEach(async () => {
    f = await seedWorld(3, 9292);
    await f.db.update(accounts).set({ username: 'mediaadmin' }).where(eq(accounts.id, f.accountIds[0]!));
    directory = await mkdtemp(join(tmpdir(), 'astera-media-'));
    const built = buildApp({ env: testEnv({ REQUIRE_CURRENT_RULES: 'true', ADMIN_USERNAMES: 'mediaadmin,otheradmin', CHAT_MEDIA_DIR: directory }), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
    app = built.app; close = built.close; await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await tokens.issueAccess(id)}`, 'x-astera-rules': ECONOMY_PROFILE.id })));
    cookie = `bs_refresh=${await tokens.issueRefresh(f.accountIds[1]!)}`;
  });
  afterEach(async () => { await close(); await rm(directory, { recursive: true, force: true }); });
  const upload = (who = 0, payload = png, type = 'image/png') => app.inject({ method: 'POST', url: '/api/admin/chat/media', headers: { ...auth[who], 'content-type': 'application/octet-stream', 'x-media-type': type }, payload });
  const send = (who: number, media: Media, content = '') => app.inject({ method: 'POST', url: '/api/chat/messages', headers: auth[who], payload: { content, media } });

  it('uploads by signature, sends without a caption, protects native reads and supports seeking', async () => {
    expect((await upload(1)).statusCode).toBe(403);
    const uploaded = await upload();
    expect(uploaded.statusCode, uploaded.body).toBe(200);
    const media = chatMediaUploadSchema.parse(uploaded.json()).media;
    expect(media).toMatchObject({ kind: 'image', mimeType: 'image/png' });
    if (media.kind !== 'image') throw new Error('Expected image upload');
    expect((await send(1, media)).statusCode).toBe(403);
    expect((await send(0, { ...media, kind: 'video' })).statusCode).toBe(400);
    const sent = await send(0, { ...media, mimeType: 'text/html' });
    expect(sent.statusCode, sent.body).toBe(200);
    const message = chatPostSchema.parse(sent.json()).message;
    expect(message.content).toBe(''); expect(message.media).toEqual(media);
    const url = `/api/chat/media/${media.assetId}?channel=general&messageId=${message.id}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    const read = await app.inject({ method: 'GET', url, headers: { cookie, range: 'bytes=0-7' } });
    expect(read.statusCode, read.body).toBe(206);
    expect(read.rawPayload).toEqual(png.subarray(0, 8));
    expect(read.headers['content-range']).toBe(`bytes 0-7/${png.length}`);
    expect(read.headers['cache-control']).toContain('no-store');
    const head = await app.inject({ method: 'HEAD', url, headers: { cookie } });
    expect(head.statusCode).toBe(200);
    expect(head.rawPayload).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url, headers: { cookie, range: 'bytes=99999-' } })).statusCode).toBe(416);
    expect((await app.inject({ method: 'GET', url: `/api/chat/media/${media.assetId}`, headers: auth[0] })).statusCode).toBe(404);
    const listed = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[1] });
    expect(chatPageSchema.parse(listed.json()).messages[0]?.media).toEqual(media);
    await app.inject({ method: 'POST', url: '/api/chat/messages', headers: auth[1], payload: { content: 'Nice photo', replyToMessageId: message.id } });
    const history = (await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[1] })).json<{ messages: { replyTo: { media: Media | null } | null }[] }>();
    expect(history.messages[1]?.replyTo?.media).toEqual(media);
    await maskChatMessages(f.db, f.accountIds[0]!, { channel: 'general', seasonId: f.seasonId, language: 'tr', username: 'mediaadmin', count: 1 }, f.clock.now());
    expect((await app.inject({ method: 'GET', url, headers: { cookie } })).statusCode).toBe(404);
  });

  it('protects unsent upload ownership even from another admin and revokes cookie reads', async () => {
    await f.db.update(accounts).set({ username: 'otheradmin' }).where(eq(accounts.id, f.accountIds[2]!));
    const media = chatMediaUploadSchema.parse((await upload()).json()).media;
    if (media.kind === 'youtube') throw new Error('Expected upload');
    const url = `/api/chat/media/${media.assetId}`;
    expect((await app.inject({ method: 'GET', url, headers: auth[0] })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url, headers: auth[2] })).statusCode).toBe(404);
    expect((await send(2, media)).statusCode).toBe(404);
    const sent = await send(0, media);
    const message = chatPostSchema.parse(sent.json()).message;
    await f.db.update(accounts).set({ authVersion: 1 }).where(eq(accounts.id, f.accountIds[1]!));
    expect((await app.inject({ method: 'GET', url: `${url}?channel=general&messageId=${message.id}`, headers: { cookie } })).statusCode).toBe(401);
  });

  it('rejects invalid file content, mismatched types and oversized images', async () => {
    expect((await upload(0, Buffer.from('<svg onload="alert(1)"></svg>'), 'image/png')).statusCode).toBe(400);
    expect((await upload(0, png, 'video/mp4')).statusCode).toBe(400);
    expect((await upload(0, Buffer.alloc(0))).statusCode).toBe(400);
    const large = Buffer.alloc(10 * 1024 * 1024 + 1); png.copy(large);
    expect((await upload(0, large)).statusCode).toBe(413);
  });

  it('uploads real MP4 video and limits private file reads to participants', async () => {
    const video = await readFile(new URL('./fixtures/chat-video.mp4', import.meta.url));
    const uploaded = await upload(0, video, 'video/mp4');
    expect(uploaded.statusCode, uploaded.body).toBe(200);
    const media = chatMediaUploadSchema.parse(uploaded.json()).media;
    expect(media).toMatchObject({ kind: 'video', mimeType: 'video/mp4' });
    const sent = await app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: f.playerIds[1], content: 'Video', media } });
    expect(sent.statusCode, sent.body).toBe(200);
    const message = dmPostSchema.parse(sent.json()).message;
    if (media.kind === 'youtube') throw new Error('Expected video upload');
    const url = `/api/chat/media/${media.assetId}?channel=dm&messageId=${message.id}`;
    expect((await app.inject({ method: 'GET', url, headers: auth[2] })).statusCode).toBe(404);
    const read = await app.inject({ method: 'GET', url, headers: { ...auth[1], range: 'bytes=-16' } });
    expect(read.statusCode, read.body).toBe(206);
    expect(read.rawPayload).toEqual(video.subarray(video.length - 16));
    await f.db.transaction(tx => archiveSeasonChat(tx, f.clock.now()));
  });

  it('collects old orphans with a bounded query budget and preserves retained media', async () => {
    const old = new Date(f.clock.now().getTime() - 2 * 86_400_000);
    const ids = Array.from({ length: 32 }, () => randomUUID());
    await f.db.insert(chatMediaAssets).values(ids.map(id => ({ id, ownerAccountId: f.accountIds[0]!, kind: 'image' as const, mimeType: 'image/png', byteSize: png.length, createdAt: old, claimedAt: old, channel: 'general' as const, messageId: randomUUID() })));
    const orphan = randomUUID();
    for (const id of [...ids, orphan]) {
      await writeFile(join(directory, id), png);
      await utimes(join(directory, id), old, old);
    }
    const query = vi.spyOn(f.db, 'select');
    try {
      await cleanupChatUploads(f.db, directory, f.clock.now());
      expect(query.mock.calls.length).toBeLessThanOrEqual(4);
      await expect(access(join(directory, ids[0]!))).resolves.toBeUndefined();
      await expect(access(join(directory, orphan))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { query.mockRestore(); }
  });

  it('claims each upload once under concurrent sends and expires unsent assets', async () => {
    const media = (await upload()).json<{ media: Media }>().media;
    const results = await Promise.all([send(0, media, 'one'), send(0, media, 'two')]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 409]);
    const expired = (await upload()).json<{ media: Media }>().media;
    f.clock.advance(25 * 60);
    expect((await send(0, expired)).statusCode).toBe(404);
  });

  it('accepts only validated YouTube IDs from admins and retains media in the season archive', async () => {
    const media = { kind: 'youtube' as const, videoId: 'dQw4w9WgXcQ' };
    expect((await send(1, media)).statusCode).toBe(403);
    expect((await send(0, { kind: 'youtube', videoId: 'javascript:bad' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/chat/messages', headers: auth[0], payload: { content: '' } })).statusCode).toBe(400);
    const sent = await send(0, media);
    expect(sent.statusCode, sent.body).toBe(200);
    const id = sent.json<{ message: Message }>().message.id;
    await f.db.transaction(tx => archiveSeasonChat(tx, f.clock.now()));
    const [archived] = await f.db.select().from(chatArchive).where(eq(chatArchive.id, id));
    expect(archived).toMatchObject({ media });
    await maskChatMessages(f.db, f.accountIds[0]!, { channel: 'general', seasonId: f.seasonId, language: 'tr', username: 'mediaadmin', count: 1 }, f.clock.now());
    const messages = (await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[1] })).json<{ messages: Message[] }>().messages;
    expect(messages[0]).toMatchObject({ content: '**', media: null });
  });

  it('supports admin clan posting and media DMs while enforcing each room visibility', async () => {
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Media Clan', nameKey: 'media clan', tag: 'MC', createdAt: f.clock.now() }).returning();
    await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: clan!.id, playerId: f.playerIds[1]!, role: 'LEADER', slot: 0, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
    const media = (await upload()).json<{ media: Media }>().media;
    const sent = await app.inject({ method: 'POST', url: `/api/admin/clans/${clan!.id}/chat`, headers: auth[0], payload: { content: '', media } });
    expect(sent.statusCode, sent.body).toBe(200);
    const id = clanChatPostSchema.parse(sent.json()).message.id;
    const url = `/api/chat/media/${media.assetId}?channel=clan&messageId=${id}`;
    expect((await app.inject({ method: 'GET', url, headers: auth[2] })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url, headers: auth[1] })).statusCode).toBe(200);
    await f.db.update(seasons).set({ status: 'frozen', endsAt: new Date(f.clock.now().getTime() - 86_400_000) }).where(eq(seasons.id, f.seasonId));
    expect((await app.inject({ method: 'GET', url: '/api/clan/chat', headers: auth[1] })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url, headers: auth[1] })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: `/api/chat/reactions?channel=clan&messageId=${id}`, headers: auth[1] })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url, headers: auth[0] })).statusCode).toBe(200);
    await f.db.update(seasons).set({ status: 'live', endsAt: new Date(f.clock.now().getTime() + 86_400_000) }).where(eq(seasons.id, f.seasonId));
    const youtube = { kind: 'youtube', videoId: 'dQw4w9WgXcQ' };
    const dm = await app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: f.playerIds[1], content: '', media: youtube } });
    expect(dm.statusCode, dm.body).toBe(200);
    expect(dmPostSchema.parse(dm.json()).message.media).toEqual(youtube);
    expect((await app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[1], payload: { recipientPlayerId: f.playerIds[0], content: '', media: youtube } })).statusCode).toBe(403);
  });
});
